/**
 * TIS TIS - Admin API: Link Stripe Customer to Account
 *
 * Este endpoint vincula un stripe_customer_id a una cuenta existente
 * cuando el webhook de Stripe falló en crear el registro de suscripción.
 *
 * Uso: POST /api/admin/link-stripe
 * Headers: x-admin-key: <ADMIN_API_KEY>
 * Body: {
 *   email: string,              // Email del usuario
 *   stripe_customer_id: string, // ID del cliente en Stripe (cus_XXXXX)
 *   plan?: string,              // Plan: starter, essentials, growth
 *   create_subscription?: boolean // Si crear registro de suscripción
 * }
 *
 * IMPORTANTE: Este endpoint solo debe usarse cuando el webhook de Stripe
 * falló y el cliente ya pagó pero no tiene registro de suscripción.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import Stripe from 'stripe';

// Verify admin API key (timing-safe)
function verifyAdminKey(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;

  // In production, ADMIN_API_KEY is required
  if (!expectedKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Admin API] ADMIN_API_KEY not configured in production');
      return false;
    }
    // Allow in development without key
    return true;
  }

  if (!adminKey) {
    return false;
  }

  try {
    const keyBuffer = Buffer.from(adminKey);
    const expectedBuffer = Buffer.from(expectedKey);
    if (keyBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(keyBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// Admin client with service role
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(`Missing env vars: URL=${!!url}, SERVICE_KEY=${!!serviceKey}`);
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  // Verify admin authorization
  if (!verifyAdminKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      email,
      stripe_customer_id,
      plan = 'essentials',
      create_subscription = true
    } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log('🔗 [LinkStripe] Starting link process for:', email.substring(0, 3) + '***');

    const supabase = getSupabaseAdmin();
    const stripe = getStripeClient();

    // 1. Find user in auth.users
    const { data: users } = await supabase.auth.admin.listUsers();
    const authUser = users?.users?.find(u => u.email === email);

    if (!authUser) {
      return NextResponse.json({ error: 'User not found in auth.users' }, { status: 404 });
    }

    console.log('✅ [LinkStripe] Found auth user:', authUser.id);

    // 2. Find client record
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*, tenants(*)')
      .eq('contact_email', email)
      .single();

    if (clientError || !client) {
      return NextResponse.json({
        error: 'Client not found. Run setup-user first.',
        details: clientError?.message
      }, { status: 404 });
    }

    console.log('✅ [LinkStripe] Found client:', client.id);

    // 3. If no stripe_customer_id provided, try to find in Stripe by email
    let finalStripeCustomerId = stripe_customer_id;

    if (!finalStripeCustomerId) {
      console.log('🔍 [LinkStripe] No stripe_customer_id provided, searching in Stripe...');

      const customers = await stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        finalStripeCustomerId = customers.data[0].id;
        console.log('✅ [LinkStripe] Found Stripe customer:', finalStripeCustomerId);
      } else {
        return NextResponse.json({
          error: 'No Stripe customer found for this email. Provide stripe_customer_id manually or check Stripe Dashboard.',
        }, { status: 404 });
      }
    }

    // 4. Verify stripe_customer_id exists in Stripe
    try {
      const stripeCustomer = await stripe.customers.retrieve(finalStripeCustomerId);
      if ((stripeCustomer as any).deleted) {
        return NextResponse.json({ error: 'Stripe customer has been deleted' }, { status: 400 });
      }
      console.log('✅ [LinkStripe] Verified Stripe customer exists:', finalStripeCustomerId);
    } catch (stripeError) {
      return NextResponse.json({
        error: 'Invalid stripe_customer_id',
        details: stripeError instanceof Error ? stripeError.message : 'Unknown error'
      }, { status: 400 });
    }

    // 5. Update client with stripe_customer_id
    const { error: updateClientError } = await supabase
      .from('clients')
      .update({
        stripe_customer_id: finalStripeCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id);

    if (updateClientError) {
      console.error('❌ [LinkStripe] Failed to update client:', updateClientError);
      return NextResponse.json({
        error: 'Failed to update client',
        details: updateClientError.message
      }, { status: 500 });
    }

    console.log('✅ [LinkStripe] Updated client with stripe_customer_id');

    // 6. Create subscription record if requested
    let subscriptionCreated = false;
    let subscriptionId: string | null = null;

    if (create_subscription && client.tenant_id) {
      // Check if subscription already exists
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('client_id', client.id)
        .single();

      if (existingSub) {
        // Update existing subscription
        const { error: updateSubError } = await supabase
          .from('subscriptions')
          .update({
            stripe_customer_id: finalStripeCustomerId,
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSub.id);

        if (updateSubError) {
          console.error('⚠️ [LinkStripe] Failed to update subscription:', updateSubError);
        } else {
          subscriptionId = existingSub.id;
          console.log('✅ [LinkStripe] Updated existing subscription');
        }
      } else {
        // Create new subscription record
        // Try to get active subscription from Stripe
        let stripeSubscriptionId: string | null = null;
        let periodEnd: string | null = null;

        try {
          const subscriptions = await stripe.subscriptions.list({
            customer: finalStripeCustomerId,
            status: 'active',
            limit: 1,
          });

          if (subscriptions.data.length > 0) {
            const stripeSub = subscriptions.data[0];
            stripeSubscriptionId = stripeSub.id;
            periodEnd = new Date((stripeSub as any).current_period_end * 1000).toISOString();
            console.log('✅ [LinkStripe] Found active Stripe subscription:', stripeSubscriptionId);
          }
        } catch (err) {
          console.warn('⚠️ [LinkStripe] Could not fetch Stripe subscriptions:', err);
        }

        const { data: newSub, error: createSubError } = await supabase
          .from('subscriptions')
          .insert({
            client_id: client.id,
            tenant_id: client.tenant_id,
            stripe_customer_id: finalStripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            plan: plan,
            status: 'active',
            current_period_end: periodEnd,
            max_branches: 1,
            current_branches: 1,
            branches: 1,
            monthly_amount: plan === 'starter' ? 2999 : plan === 'essentials' ? 4999 : 7999,
            currency: 'MXN',
          })
          .select()
          .single();

        if (createSubError) {
          console.error('⚠️ [LinkStripe] Failed to create subscription:', createSubError);
        } else {
          subscriptionCreated = true;
          subscriptionId = newSub.id;
          console.log('✅ [LinkStripe] Created subscription record');
        }
      }
    }

    // 7. Also update tenant.client_id if not set
    if (client.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('client_id')
        .eq('id', client.tenant_id)
        .single();

      if (tenant && !tenant.client_id) {
        await supabase
          .from('tenants')
          .update({ client_id: client.id })
          .eq('id', client.tenant_id);
        console.log('✅ [LinkStripe] Updated tenant.client_id');
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Stripe customer linked successfully',
      data: {
        user_id: authUser.id,
        client_id: client.id,
        tenant_id: client.tenant_id,
        stripe_customer_id: finalStripeCustomerId,
        subscription_created: subscriptionCreated,
        subscription_id: subscriptionId,
        plan: plan,
      },
      next_steps: [
        '1. El usuario debe cerrar sesión completamente',
        '2. Limpiar localStorage (DevTools → Application → Clear site data)',
        '3. Iniciar sesión de nuevo',
        '4. Ir a Configuración → Facturación para verificar que funciona',
      ],
    });

  } catch (error) {
    console.error('💥 [LinkStripe] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// GET endpoint to check Stripe status for an email
export async function GET(req: NextRequest) {
  // Verify admin authorization
  if (!verifyAdminKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const stripe = getStripeClient();

  // Find in database
  const { data: client } = await supabase
    .from('clients')
    .select('id, tenant_id, stripe_customer_id, contact_email')
    .eq('contact_email', email)
    .single();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('client_id', client?.id || '')
    .single();

  // Search in Stripe
  let stripeCustomer = null;
  let stripeSubscriptions: Stripe.Subscription[] = [];

  try {
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (customers.data.length > 0) {
      stripeCustomer = customers.data[0];

      // Get subscriptions for this customer
      const subs = await stripe.subscriptions.list({
        customer: stripeCustomer.id,
        limit: 5,
      });
      stripeSubscriptions = subs.data;
    }
  } catch (err) {
    console.error('Error fetching from Stripe:', err);
  }

  return NextResponse.json({
    email,
    database: {
      client_exists: !!client,
      client_id: client?.id,
      tenant_id: client?.tenant_id,
      stripe_customer_id_in_db: client?.stripe_customer_id,
      has_subscription: !!subscription,
      subscription_status: subscription?.status,
      subscription_plan: subscription?.plan,
    },
    stripe: {
      customer_exists: !!stripeCustomer,
      customer_id: stripeCustomer?.id,
      customer_email: stripeCustomer?.email,
      subscriptions_count: stripeSubscriptions.length,
      active_subscription: stripeSubscriptions.find(s => s.status === 'active')?.id,
    },
    needs_linking: !client?.stripe_customer_id && !!stripeCustomer,
    needs_subscription_record: !!client?.stripe_customer_id && !subscription,
  });
}

// =====================================================
// TIS TIS PLATFORM - Change Plan API
// Handles plan upgrades and downgrades via Stripe
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getPlanConfig } from '@/src/shared/config/plans';

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Create authenticated client from Bearer token
function createAuthenticatedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

// Get access token from request headers
function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Plan price IDs from Stripe (you need to set these in your .env or Stripe dashboard)
const PLAN_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || 'price_starter',
  essentials: process.env.STRIPE_PRICE_ESSENTIALS || 'price_essentials',
  growth: process.env.STRIPE_PRICE_GROWTH || 'price_growth',
};

export async function POST(request: NextRequest) {
  try {
    // Get access token from Authorization header
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      console.error('[Change Plan] No access token in request');
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const body = await request.json();
    const { newPlan } = body;

    // Validate plan
    if (!newPlan || !['starter', 'essentials', 'growth'].includes(newPlan)) {
      return NextResponse.json(
        { error: 'Plan inválido' },
        { status: 400 }
      );
    }

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[Change Plan] Auth error:', authError);
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Get user's tenant and role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userRole || userRole.role !== 'owner') {
      return NextResponse.json(
        { error: 'Solo el propietario puede cambiar el plan' },
        { status: 403 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get tenant info for creating Stripe customer if needed
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug')
      .eq('id', userRole.tenant_id)
      .single();

    if (!tenant) {
      console.error('[Change Plan] Tenant not found:', userRole.tenant_id);
      return NextResponse.json({
        error: 'Tenant no encontrado'
      }, { status: 404 });
    }

    // Get client from tenant
    let { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, stripe_customer_id')
      .eq('tenant_id', userRole.tenant_id)
      .single();

    // If no client exists, create one with Stripe customer
    if (!client) {
      console.log('[Change Plan] Creating client for tenant:', userRole.tenant_id);

      const stripe = getStripeClient();

      // Create Stripe customer
      const stripeCustomer = await stripe.customers.create({
        email: user.email || '',
        name: tenant.name,
        metadata: {
          tenant_id: userRole.tenant_id,
          tenant_slug: tenant.slug,
        },
      });

      // Create client record
      const { data: newClient, error: createError } = await supabaseAdmin
        .from('clients')
        .insert({
          user_id: user.id,
          tenant_id: userRole.tenant_id,
          business_name: tenant.name,
          contact_email: user.email || '',
          stripe_customer_id: stripeCustomer.id,
          status: 'active',
        })
        .select('id, stripe_customer_id')
        .single();

      if (createError) {
        console.error('[Change Plan] Error creating client:', createError);
        return NextResponse.json({
          error: 'Error al crear información de facturación. Por favor contacta a soporte.'
        }, { status: 500 });
      }

      client = newClient;
      console.log('[Change Plan] Client created:', client.id);
    }

    // If client exists but has no Stripe customer, create one
    if (!client.stripe_customer_id) {
      console.log('[Change Plan] Creating Stripe customer for existing client:', client.id);

      const stripe = getStripeClient();

      const stripeCustomer = await stripe.customers.create({
        email: user.email || '',
        name: tenant.name,
        metadata: {
          tenant_id: userRole.tenant_id,
          tenant_slug: tenant.slug,
          client_id: client.id,
        },
      });

      // Update client with Stripe customer ID
      await supabaseAdmin
        .from('clients')
        .update({ stripe_customer_id: stripeCustomer.id })
        .eq('id', client.id);

      client.stripe_customer_id = stripeCustomer.id;
      console.log('[Change Plan] Stripe customer created:', stripeCustomer.id);
    }

    // Get active subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('client_id', client.id)
      .eq('status', 'active')
      .single();

    // If no subscription exists, create a checkout session for the new plan
    if (!subscription) {
      console.log('[Change Plan] No active subscription, creating checkout session');

      const stripe = getStripeClient();

      // Get or create the price for the new plan
      let priceId = PLAN_PRICE_IDS[newPlan];

      // If price doesn't exist in env, create it dynamically
      if (priceId.startsWith('price_')) {
        const product = await stripe.products.create({
          name: `TIS TIS - Plan ${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}`,
          description: `Suscripción mensual al plan ${newPlan}`,
        });

        const newPlanConfig = getPlanConfig(newPlan);
        const price = await stripe.prices.create({
          product: product.id,
          currency: 'mxn',
          unit_amount: newPlanConfig?.monthlyPriceCentavos || 749000,
          recurring: { interval: 'month' },
        });

        priceId = price.id;
      }

      // Create checkout session
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: client.stripe_customer_id,
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/dashboard/settings?tab=billing&success=true`,
        cancel_url: `${baseUrl}/dashboard/settings?tab=billing&cancelled=true`,
        metadata: {
          tenant_id: userRole.tenant_id,
          client_id: client.id,
          plan: newPlan,
        },
      });

      return NextResponse.json({
        success: true,
        requiresCheckout: true,
        checkoutUrl: checkoutSession.url,
        message: 'No tienes una suscripción activa. Serás redirigido al proceso de pago.',
      });
    }

    // Check if already on this plan
    if (subscription.plan === newPlan) {
      return NextResponse.json(
        { error: 'Ya estás en este plan' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // Check if upgrading or downgrading using centralized plan order
    const newPlanOrder = getPlanConfig(newPlan)?.order || 0;
    const currentPlanOrder = getPlanConfig(subscription.plan)?.order || 0;

    const isUpgrade = newPlanOrder > currentPlanOrder;
    const isDowngrade = newPlanOrder < currentPlanOrder;

    // Get current Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    // Find the main plan item (not branch add-ons)
    const mainPlanItem = stripeSubscription.items.data.find((item) => {
      const product = item.price.product;
      if (typeof product === 'object' && product !== null) {
        // Check if it's a plan product (not a branch add-on)
        return !(product as Stripe.Product).name?.includes('Sucursal Extra');
      }
      return true; // Assume first item is the plan
    });

    if (!mainPlanItem) {
      return NextResponse.json(
        { error: 'No se pudo encontrar el item del plan actual' },
        { status: 500 }
      );
    }

    // Create or get the price for the new plan
    let newPriceId = PLAN_PRICE_IDS[newPlan];

    // If price doesn't exist, create it dynamically
    if (newPriceId.startsWith('price_')) {
      // Create a product and price for this plan
      const product = await stripe.products.create({
        name: `TIS TIS - Plan ${newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}`,
        description: `Suscripción mensual al plan ${newPlan}`,
      });

      const newPlanConfig = getPlanConfig(newPlan);
      const price = await stripe.prices.create({
        product: product.id,
        currency: 'mxn',
        unit_amount: newPlanConfig?.monthlyPriceCentavos || 749000,
        recurring: { interval: 'month' },
      });

      newPriceId = price.id;
    }

    // Update the subscription in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        items: [
          {
            id: mainPlanItem.id,
            price: newPriceId,
          },
        ],
        // For upgrades: charge immediately with proration
        // For downgrades: apply at end of period
        proration_behavior: isUpgrade ? 'create_prorations' : 'none',
        billing_cycle_anchor: isDowngrade ? 'unchanged' : undefined,
        metadata: {
          ...stripeSubscription.metadata,
          plan: newPlan,
        },
      }
    );

    // Get plan configs for branch limits
    const newPlanCfg = getPlanConfig(newPlan);
    const oldPlanCfg = getPlanConfig(subscription.plan);

    // Update local subscription record
    await supabaseAdmin
      .from('subscriptions')
      .update({
        plan: newPlan,
        updated_at: new Date().toISOString(),
        // Update max_branches based on centralized plan config
        max_branches: newPlanCfg?.branchLimit || 1,
      })
      .eq('id', subscription.id);

    // Log the plan change
    const priceImpact = ((newPlanCfg?.monthlyPriceCentavos || 0) - (oldPlanCfg?.monthlyPriceCentavos || 0)) / 100;
    await supabaseAdmin.from('subscription_changes').insert({
      subscription_id: subscription.id,
      tenant_id: userRole.tenant_id,
      client_id: client.id,
      change_type: isUpgrade ? 'plan_upgraded' : 'plan_downgraded',
      previous_value: { plan: subscription.plan },
      new_value: { plan: newPlan },
      price_impact: priceImpact,
      created_by: user.id,
      metadata: {
        stripe_subscription_id: updatedSubscription.id,
        proration: isUpgrade,
      },
    });

    console.log(`✅ Plan changed: ${subscription.plan} → ${newPlan} for tenant ${userRole.tenant_id}`);

    return NextResponse.json({
      success: true,
      message: isUpgrade
        ? 'Plan mejorado exitosamente. Se ha aplicado el prorrateo.'
        : 'Plan cambiado. El cambio se aplicará en tu próximo ciclo de facturación.',
      newPlan,
      isUpgrade,
    });

  } catch (error: any) {
    console.error('Change plan error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al cambiar el plan' },
      { status: 500 }
    );
  }
}

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

// Plan price IDs from Stripe (set these in your .env or Stripe dashboard)
const PLAN_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  essentials: process.env.STRIPE_PRICE_ESSENTIALS || '',
  growth: process.env.STRIPE_PRICE_GROWTH || '',
};

// Helper to get or create a price for a plan
async function getOrCreatePriceForPlan(stripe: Stripe, planName: string): Promise<string> {
  // First check if we have a configured price ID
  const configuredPriceId = PLAN_PRICE_IDS[planName];
  if (configuredPriceId && configuredPriceId.startsWith('price_')) {
    return configuredPriceId;
  }

  // Search for existing product with this plan name
  const productName = `TIS TIS - Plan ${planName.charAt(0).toUpperCase() + planName.slice(1)}`;
  console.log('[Change Plan] Searching for existing product:', productName);

  const existingProducts = await stripe.products.search({
    query: `name:"${productName}"`,
  });

  let productId: string;

  if (existingProducts.data.length > 0) {
    productId = existingProducts.data[0].id;
    console.log('[Change Plan] Found existing product:', productId);

    // Check if there's already an active price for this product
    const existingPrices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 1,
    });

    if (existingPrices.data.length > 0) {
      console.log('[Change Plan] Found existing price:', existingPrices.data[0].id);
      return existingPrices.data[0].id;
    }
  } else {
    // Create new product
    console.log('[Change Plan] Creating new product:', productName);
    const product = await stripe.products.create({
      name: productName,
      description: `Suscripción mensual al plan ${planName}`,
    });
    productId = product.id;
  }

  // Create price for the product
  const planConfig = getPlanConfig(planName);
  console.log('[Change Plan] Creating price for product:', productId);
  const price = await stripe.prices.create({
    product: productId,
    currency: 'mxn',
    unit_amount: planConfig?.monthlyPriceCentavos || 749000,
    recurring: { interval: 'month' },
  });

  console.log('[Change Plan] Created price:', price.id);
  return price.id;
}

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
      .select('id, name, slug, plan')
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

      // Get or create the price for the new plan (reuses existing if found)
      const priceId = await getOrCreatePriceForPlan(stripe, newPlan);

      // Create checkout session - detect URL automatically
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'https://tistis-platform-5fc5.vercel.app';

      console.log('[Change Plan] Creating checkout session (no subscription)');
      console.log('  tenant_id:', userRole.tenant_id);
      console.log('  client_id:', client.id);
      console.log('  newPlan:', newPlan);
      console.log('  priceId:', priceId);

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: client.stripe_customer_id,
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/dashboard/settings/subscription?success=true&plan=${newPlan}`,
        cancel_url: `${baseUrl}/dashboard/settings/subscription?cancelled=true`,
        metadata: {
          tenant_id: userRole.tenant_id,
          client_id: client.id,
          plan: newPlan,
        },
      });

      console.log('[Change Plan] Checkout session created:', checkoutSession.id);
      console.log('[Change Plan] Checkout URL:', checkoutSession.url);

      return NextResponse.json({
        success: true,
        requiresCheckout: true,
        checkoutUrl: checkoutSession.url,
        message: 'No tienes una suscripción activa. Serás redirigido al proceso de pago.',
      });
    }

    // Check if already on this plan - compare with TENANT plan (what user sees in dashboard)
    // Note: subscription.plan might be out of sync if a previous checkout failed after webhook
    if (tenant.plan?.toLowerCase() === newPlan.toLowerCase()) {
      return NextResponse.json(
        { error: 'Ya estás en este plan' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // Check if upgrading or downgrading using centralized plan order
    // IMPORTANT: Use tenant.plan (what user sees) NOT subscription.plan (might be out of sync)
    const newPlanOrder = getPlanConfig(newPlan)?.order || 0;
    const currentPlanOrder = getPlanConfig(tenant.plan)?.order || 0;

    console.log('[Change Plan] Plan comparison:');
    console.log('  tenant.plan:', tenant.plan, '-> order:', currentPlanOrder);
    console.log('  newPlan:', newPlan, '-> order:', newPlanOrder);
    console.log('  subscription.plan:', subscription.plan, '(might be out of sync)');

    const isUpgrade = newPlanOrder > currentPlanOrder;
    const isDowngrade = newPlanOrder < currentPlanOrder;

    console.log('[Change Plan] isUpgrade:', isUpgrade, 'isDowngrade:', isDowngrade);

    // Check if this is a real Stripe subscription (starts with 'sub_')
    const isRealStripeSubscription = subscription.stripe_subscription_id?.startsWith('sub_');

    // Try to get the Stripe subscription
    let stripeSubscription: Stripe.Subscription | null = null;

    if (isRealStripeSubscription) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id
        );
      } catch (stripeError: any) {
        console.log('[Change Plan] Stripe subscription not found:', stripeError.message);
        stripeSubscription = null;
      }
    }

    // If no valid Stripe subscription, redirect to checkout
    if (!stripeSubscription) {
      console.log('[Change Plan] No valid Stripe subscription found, creating checkout session');

      // Get or create the price for the new plan (reuses existing if found)
      const priceId = await getOrCreatePriceForPlan(stripe, newPlan);

      // Create checkout session - detect URL automatically
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'https://tistis-platform-5fc5.vercel.app';

      console.log('[Change Plan] Creating checkout session for plan change');
      console.log('  tenant_id:', userRole.tenant_id);
      console.log('  client_id:', client.id);
      console.log('  previous_subscription_id:', subscription.id);
      console.log('  newPlan:', newPlan);
      console.log('  priceId:', priceId);

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: client.stripe_customer_id,
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/dashboard/settings/subscription?success=true&plan=${newPlan}`,
        cancel_url: `${baseUrl}/dashboard/settings/subscription?cancelled=true`,
        metadata: {
          tenant_id: userRole.tenant_id,
          client_id: client.id,
          plan: newPlan,
          previous_subscription_id: subscription.id,
        },
      });

      console.log('[Change Plan] Checkout session created:', checkoutSession.id);
      console.log('[Change Plan] Checkout URL:', checkoutSession.url);

      return NextResponse.json({
        success: true,
        requiresCheckout: true,
        checkoutUrl: checkoutSession.url,
        message: 'Tu suscripción actual necesita ser vinculada a Stripe. Serás redirigido al proceso de pago.',
      });
    }

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

    // Get or create the price for the new plan (reuses existing if found)
    const newPriceId = await getOrCreatePriceForPlan(stripe, newPlan);
    console.log('[Change Plan] Using price for subscription update:', newPriceId);

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
    const oldPlanCfg = getPlanConfig(tenant.plan); // Use tenant.plan, not subscription.plan

    // Get current_period_end from the updated subscription
    const periodEnd = (updatedSubscription as any).current_period_end;
    const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
    console.log('[Change Plan] current_period_end:', currentPeriodEnd);

    // Update local subscription record
    await supabaseAdmin
      .from('subscriptions')
      .update({
        plan: newPlan,
        updated_at: new Date().toISOString(),
        // Update max_branches based on centralized plan config
        max_branches: newPlanCfg?.branchLimit || 1,
        // IMPORTANT: Update billing date from Stripe
        current_period_end: currentPeriodEnd,
      })
      .eq('id', subscription.id);

    // CRITICAL: Also update tenant.plan - this is what the dashboard reads
    const { error: tenantUpdateError } = await supabaseAdmin
      .from('tenants')
      .update({
        plan: newPlan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userRole.tenant_id);

    if (tenantUpdateError) {
      console.error('[Change Plan] Error updating tenant plan:', tenantUpdateError);
    } else {
      console.log('[Change Plan] Tenant plan updated to:', newPlan);
    }

    // Log the plan change
    const priceImpact = ((newPlanCfg?.monthlyPriceCentavos || 0) - (oldPlanCfg?.monthlyPriceCentavos || 0)) / 100;
    await supabaseAdmin.from('subscription_changes').insert({
      subscription_id: subscription.id,
      tenant_id: userRole.tenant_id,
      client_id: client.id,
      change_type: isUpgrade ? 'plan_upgraded' : 'plan_downgraded',
      previous_value: { plan: tenant.plan }, // Use tenant.plan
      new_value: { plan: newPlan },
      price_impact: priceImpact,
      created_by: user.id,
      metadata: {
        stripe_subscription_id: updatedSubscription.id,
        proration: isUpgrade,
      },
    });

    console.log(`✅ Plan changed: ${tenant.plan} → ${newPlan} for tenant ${userRole.tenant_id}`);

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

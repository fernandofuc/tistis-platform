// =====================================================
// TIS TIS PLATFORM - Change Plan API
// Handles plan upgrades and downgrades via Stripe
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getPlanConfig } from '@/src/shared/config/plans';
import { checkRateLimit, getClientIP, strictLimiter, rateLimitExceeded } from '@/src/shared/lib/rate-limit';
import { createComponentLogger } from '@/src/shared/lib';

// Create logger for change plan endpoint
const logger = createComponentLogger('stripe-change-plan');

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
// Uses the same naming convention as .env.example for consistency
const PLAN_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PLAN_PRICE_ID || '',
  essentials: process.env.STRIPE_ESSENTIALS_PLAN_PRICE_ID || '',
  growth: process.env.STRIPE_GROWTH_PLAN_PRICE_ID || '',
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
  logger.debug('Searching for existing product', { productName });

  const existingProducts = await stripe.products.search({
    query: `name:"${productName}"`,
  });

  let productId: string;

  if (existingProducts.data.length > 0) {
    productId = existingProducts.data[0].id;
    logger.debug('Found existing product', { productId });

    // Check if there's already an active price for this product
    const existingPrices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 1,
    });

    if (existingPrices.data.length > 0) {
      logger.debug('Found existing price', { priceId: existingPrices.data[0].id });
      return existingPrices.data[0].id;
    }
  } else {
    // Create new product
    logger.debug('Creating new product', { productName });
    const product = await stripe.products.create({
      name: productName,
      description: `Suscripción mensual al plan ${planName}`,
    });
    productId = product.id;
  }

  // Create price for the product
  const planConfig = getPlanConfig(planName);
  logger.debug('Creating price for product', { productId });
  const price = await stripe.prices.create({
    product: productId,
    currency: 'mxn',
    unit_amount: planConfig?.monthlyPriceCentavos || 749000,
    recurring: { interval: 'month' },
  });

  logger.debug('Created price', { priceId: price.id });
  return price.id;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - prevent abuse of plan change endpoint
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, strictLimiter);

    if (!rateLimitResult.success) {
      return rateLimitExceeded(rateLimitResult);
    }

    // Get access token from Authorization header
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      logger.warn('No access token in request');
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
      logger.warn('Auth error', { errorMessage: authError?.message });
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
      logger.error('Tenant not found', { tenantId: userRole.tenant_id });
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
      logger.info('Creating client for tenant', { tenantId: userRole.tenant_id });

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
        logger.error('Error creating client', { errorMessage: createError.message });
        return NextResponse.json({
          error: 'Error al crear información de facturación. Por favor contacta a soporte.'
        }, { status: 500 });
      }

      client = newClient;
      logger.info('Client created', { clientId: client.id });
    }

    // If client exists but has no Stripe customer, create one
    if (!client.stripe_customer_id) {
      logger.info('Creating Stripe customer for existing client', { clientId: client.id });

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
      logger.info('Stripe customer created', { stripeCustomerId: stripeCustomer.id });
    }

    // Get active or trialing subscription
    // IMPORTANT: Include 'trialing' status so users in trial period can change plans
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('client_id', client.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // If no subscription exists, create a checkout session for the new plan
    if (!subscription) {
      logger.info('No active/trialing subscription, creating checkout session');

      const stripe = getStripeClient();

      // Get or create the price for the new plan (reuses existing if found)
      const priceId = await getOrCreatePriceForPlan(stripe, newPlan);

      // Create checkout session - detect URL automatically
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'https://tistis-platform-5fc5.vercel.app';

      logger.debug('Creating checkout session (no subscription)', {
        tenantId: userRole.tenant_id,
        clientId: client.id,
        newPlan,
        priceId,
      });

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

      logger.info('Checkout session created', { sessionId: checkoutSession.id });

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

    logger.debug('Plan comparison', {
      tenantPlan: tenant.plan,
      currentPlanOrder,
      newPlan,
      newPlanOrder,
      subscriptionPlan: subscription.plan,
    });

    const isUpgrade = newPlanOrder > currentPlanOrder;
    const isDowngrade = newPlanOrder < currentPlanOrder;

    logger.debug('Plan change direction', { isUpgrade, isDowngrade });

    // Check if this is a real Stripe subscription (starts with 'sub_')
    const isRealStripeSubscription = subscription.stripe_subscription_id?.startsWith('sub_');

    // Try to get the Stripe subscription
    let stripeSubscription: Stripe.Subscription | null = null;

    if (isRealStripeSubscription) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id
        );
      } catch (stripeError: unknown) {
        const err = stripeError as Error;
        logger.warn('Stripe subscription not found', { errorMessage: err.message });
        stripeSubscription = null;
      }
    }

    // If no valid Stripe subscription, redirect to checkout
    if (!stripeSubscription) {
      logger.info('No valid Stripe subscription found, creating checkout session');

      // Get or create the price for the new plan (reuses existing if found)
      const priceId = await getOrCreatePriceForPlan(stripe, newPlan);

      // Create checkout session - detect URL automatically
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'https://tistis-platform-5fc5.vercel.app';

      logger.debug('Creating checkout session for plan change', {
        tenantId: userRole.tenant_id,
        clientId: client.id,
        previousSubscriptionId: subscription.id,
        newPlan,
        priceId,
      });

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

      logger.info('Checkout session created for plan change', { sessionId: checkoutSession.id });

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
    logger.debug('Using price for subscription update', { newPriceId });

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

    // Get current_period_end from the updated subscription (try root level first, then items)
    let periodEnd = (updatedSubscription as any).current_period_end;
    if (!periodEnd) {
      const items = (updatedSubscription as any).items?.data;
      periodEnd = items?.[0]?.current_period_end;
    }
    const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
    logger.debug('current_period_end extracted', { currentPeriodEnd });

    // Update local subscription record
    // IMPORTANT: We do NOT update max_branches here!
    // max_branches = contracted branches (what customer pays for)
    // branchLimit = plan's maximum capacity (what they CAN have if they pay)
    // The user keeps their current contracted branches; to add more they must pay.
    await supabaseAdmin
      .from('subscriptions')
      .update({
        plan: newPlan,
        updated_at: new Date().toISOString(),
        // NOTE: max_branches is NOT updated - it represents contracted branches,
        // not the plan limit. User must pay to add more branches via /api/branches/add-extra
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
      logger.error('Error updating tenant plan', { errorMessage: tenantUpdateError.message });
    } else {
      logger.debug('Tenant plan updated', { newPlan });
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

    logger.info('Plan changed successfully', {
      previousPlan: tenant.plan,
      newPlan,
      tenantId: userRole.tenant_id,
      isUpgrade,
    });

    return NextResponse.json({
      success: true,
      message: isUpgrade
        ? 'Plan mejorado exitosamente. Se ha aplicado el prorrateo.'
        : 'Plan cambiado. El cambio se aplicará en tu próximo ciclo de facturación.',
      newPlan,
      isUpgrade,
    });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Change plan error', { errorMessage: err.message }, err);
    return NextResponse.json(
      { error: err.message || 'Error al cambiar el plan' },
      { status: 500 }
    );
  }
}

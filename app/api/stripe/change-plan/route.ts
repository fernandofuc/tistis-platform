// =====================================================
// TIS TIS PLATFORM - Change Plan API
// Handles plan upgrades and downgrades via Stripe
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/src/shared/lib/supabase';

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Plan price IDs from Stripe (you need to set these in your .env or Stripe dashboard)
const PLAN_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || 'price_starter',
  essentials: process.env.STRIPE_PRICE_ESSENTIALS || 'price_essentials',
  growth: process.env.STRIPE_PRICE_GROWTH || 'price_growth',
  scale: process.env.STRIPE_PRICE_SCALE || 'price_scale',
};

// Plan prices in MXN centavos
const PLAN_PRICES: Record<string, number> = {
  starter: 349000,
  essentials: 749000,
  growth: 1249000,
  scale: 1999000,
};

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();
    const { newPlan } = body;

    // Validate plan
    if (!newPlan || !['starter', 'essentials', 'growth', 'scale'].includes(newPlan)) {
      return NextResponse.json(
        { error: 'Plan inválido' },
        { status: 400 }
      );
    }

    // Authenticate user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
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

    // Get client from tenant
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, stripe_customer_id')
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Get active subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('client_id', client.id)
      .eq('status', 'active')
      .single();

    if (!subscription) {
      return NextResponse.json(
        { error: 'No se encontró una suscripción activa' },
        { status: 404 }
      );
    }

    // Check if already on this plan
    if (subscription.plan === newPlan) {
      return NextResponse.json(
        { error: 'Ya estás en este plan' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // Check if upgrading or downgrading
    const planTiers: Record<string, number> = {
      starter: 1,
      essentials: 2,
      growth: 3,
      scale: 4,
    };

    const isUpgrade = planTiers[newPlan] > planTiers[subscription.plan];
    const isDowngrade = planTiers[newPlan] < planTiers[subscription.plan];

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

      const price = await stripe.prices.create({
        product: product.id,
        currency: 'mxn',
        unit_amount: PLAN_PRICES[newPlan],
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

    // Update local subscription record
    await supabaseAdmin
      .from('subscriptions')
      .update({
        plan: newPlan,
        updated_at: new Date().toISOString(),
        // Update max_branches based on plan (Starter = 1, others = 9)
        max_branches: newPlan === 'starter' ? 1 : 9,
      })
      .eq('id', subscription.id);

    // Log the plan change
    await supabaseAdmin.from('subscription_changes').insert({
      subscription_id: subscription.id,
      tenant_id: userRole.tenant_id,
      client_id: client.id,
      change_type: isUpgrade ? 'plan_upgraded' : 'plan_downgraded',
      previous_value: { plan: subscription.plan },
      new_value: { plan: newPlan },
      price_impact: (PLAN_PRICES[newPlan] - PLAN_PRICES[subscription.plan]) / 100,
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

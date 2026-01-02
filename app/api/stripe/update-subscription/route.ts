// =====================================================
// TIS TIS PLATFORM - Update Subscription API
// Handles branch quantity changes with Stripe billing
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/src/shared/lib/supabase';
import { checkRateLimit, getClientIP, strictLimiter, rateLimitExceeded } from '@/src/shared/lib/rate-limit';
import { getPlanConfig, getNextBranchPrice, calculateBranchCostPesos } from '@/src/shared/config/plans';

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// NOTE: Pricing is now centralized in src/shared/config/plans.ts
// Use getNextBranchPrice() for progressive pricing (returns pesos)
// Multiply by 100 for Stripe (which uses centavos)

// Get price for additional branch based on plan and current count
// Returns price in CENTAVOS for Stripe API
function getBranchPrice(plan: string, currentBranches: number): number {
  const priceInPesos = getNextBranchPrice(plan, currentBranches - 1); // -1 because we're adding TO this count
  return priceInPesos * 100; // Convert to centavos for Stripe
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - prevent abuse of subscription update endpoint
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, strictLimiter);

    if (!rateLimitResult.success) {
      return rateLimitExceeded(rateLimitResult);
    }

    const supabase = createServerClient();
    const body = await request.json();
    const { action } = body; // 'add_branch' | 'remove_branch'

    if (!action || !['add_branch', 'remove_branch'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "add_branch" or "remove_branch"' },
        { status: 400 }
      );
    }

    // Authenticate user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant and role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userRole || !['admin', 'owner'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden modificar la suscripción' },
        { status: 403 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get client from tenant
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get active or trialing subscription
    // Users in trial period should also be able to update their subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('client_id', client.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Validate plan allows branch modifications
    if (subscription.plan === 'starter') {
      return NextResponse.json({
        error: 'plan_not_supported',
        message: 'El plan Starter solo permite 1 sucursal. Actualiza a Essentials o superior.',
        upgrade_required: true,
      }, { status: 403 });
    }

    const currentBranches = subscription.max_branches || 1;
    const stripe = getStripeClient();

    // ============================================
    // ADD BRANCH
    // ============================================
    if (action === 'add_branch') {
      const newBranchCount = currentBranches + 1;

      // SECURITY: Check plan limit before adding
      const planConfig = getPlanConfig(subscription.plan);
      const planLimit = planConfig?.branchLimit || 1;

      if (newBranchCount > planLimit) {
        return NextResponse.json({
          error: 'plan_limit_reached',
          message: `El plan ${subscription.plan} permite máximo ${planLimit} sucursales. Mejora tu plan para agregar más.`,
          current: currentBranches,
          plan_limit: planLimit,
          upgrade_required: true,
        }, { status: 403 });
      }

      const branchPrice = getBranchPrice(subscription.plan, newBranchCount);

      if (branchPrice === 0) {
        return NextResponse.json({
          error: 'pricing_not_found',
          message: 'No se encontró precio para sucursal adicional en este plan',
        }, { status: 400 });
      }

      console.log(`📈 Adding branch: ${currentBranches} → ${newBranchCount}, price: ${branchPrice / 100} MXN`);

      // Get Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id
      );

      // Create or update subscription item for extra branches
      // We'll add a new line item for the extra branch
      const priceData = {
        currency: 'mxn',
        product_data: {
          name: `Sucursal Extra #${newBranchCount} - Plan ${subscription.plan}`,
        },
        unit_amount: branchPrice,
        recurring: {
          interval: 'month' as const,
        },
      };

      // Create the price in Stripe
      const stripePrice = await stripe.prices.create(priceData);

      // Add the new item to subscription (with proration)
      const updatedSubscription = await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        {
          items: [
            ...stripeSubscription.items.data.map((item) => ({
              id: item.id,
            })),
            {
              price: stripePrice.id,
              quantity: 1,
            },
          ],
          proration_behavior: 'create_prorations',
          metadata: {
            ...stripeSubscription.metadata,
            branches: String(newBranchCount),
          },
        }
      );

      // Calculate new monthly amount
      const planBasePrice = planConfig?.monthlyPricePesos || 0;
      const totalExtraBranchesCost = calculateBranchCostPesos(subscription.plan, newBranchCount);
      const newMonthlyAmount = planBasePrice + totalExtraBranchesCost;

      // Update local subscription
      await supabaseAdmin
        .from('subscriptions')
        .update({
          max_branches: newBranchCount,
          branches: newBranchCount,
          monthly_amount: newMonthlyAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      // Log the change
      await supabaseAdmin.from('subscription_changes').insert({
        subscription_id: subscription.id,
        tenant_id: userRole.tenant_id,
        client_id: client.id,
        change_type: 'branch_added',
        previous_value: { branches: currentBranches },
        new_value: { branches: newBranchCount },
        price_impact: branchPrice / 100,
        created_by: user.id,
        metadata: {
          stripe_subscription_id: updatedSubscription.id,
          branch_price: branchPrice / 100,
        },
      });

      console.log('✅ Branch added to subscription:', newBranchCount);

      return NextResponse.json({
        success: true,
        message: 'Sucursal agregada exitosamente',
        branches: newBranchCount,
        price_added: branchPrice / 100,
        currency: 'MXN',
      });
    }

    // ============================================
    // REMOVE BRANCH
    // ============================================
    if (action === 'remove_branch') {
      // Cannot go below 1 branch
      if (currentBranches <= 1) {
        return NextResponse.json({
          error: 'minimum_branches',
          message: 'No puedes tener menos de 1 sucursal',
        }, { status: 400 });
      }

      const newBranchCount = currentBranches - 1;
      const removedBranchPrice = getBranchPrice(subscription.plan, currentBranches);

      console.log(`📉 Removing branch: ${currentBranches} → ${newBranchCount}, credit: ${removedBranchPrice / 100} MXN`);

      // Get Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id
      );

      // Find and remove the extra branch item
      // Remove the last added branch item
      const branchItems = stripeSubscription.items.data.filter(
        (item) => item.price.product &&
        typeof item.price.product === 'object' &&
        (item.price.product as Stripe.Product).name?.includes('Sucursal Extra')
      );

      if (branchItems.length > 0) {
        const itemToRemove = branchItems[branchItems.length - 1];

        // Remove the item with proration credit
        await stripe.subscriptions.update(
          subscription.stripe_subscription_id,
          {
            items: [
              {
                id: itemToRemove.id,
                deleted: true,
              },
            ],
            proration_behavior: 'create_prorations',
            metadata: {
              ...stripeSubscription.metadata,
              branches: String(newBranchCount),
            },
          }
        );
      }

      // Calculate new monthly amount after removing branch
      const planConfigRemove = getPlanConfig(subscription.plan);
      const planBasePriceRemove = planConfigRemove?.monthlyPricePesos || 0;
      const totalExtraBranchesCostRemove = calculateBranchCostPesos(subscription.plan, newBranchCount);
      const newMonthlyAmountRemove = planBasePriceRemove + totalExtraBranchesCostRemove;

      // Update local subscription
      await supabaseAdmin
        .from('subscriptions')
        .update({
          max_branches: newBranchCount,
          branches: newBranchCount,
          monthly_amount: newMonthlyAmountRemove,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      // Log the change
      await supabaseAdmin.from('subscription_changes').insert({
        subscription_id: subscription.id,
        tenant_id: userRole.tenant_id,
        client_id: client.id,
        change_type: 'branch_removed',
        previous_value: { branches: currentBranches },
        new_value: { branches: newBranchCount },
        price_impact: -(removedBranchPrice / 100), // Negative = credit
        created_by: user.id,
        metadata: {
          stripe_subscription_id: subscription.stripe_subscription_id,
          credit_amount: removedBranchPrice / 100,
        },
      });

      console.log('✅ Branch removed from subscription:', newBranchCount);

      return NextResponse.json({
        success: true,
        message: 'Sucursal eliminada. Se aplicará crédito prorrateado.',
        branches: newBranchCount,
        credit_amount: removedBranchPrice / 100,
        currency: 'MXN',
      });
    }

  } catch (error: any) {
    console.error('Update subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// GET - Get current subscription info
// ======================
export async function GET(request: NextRequest) {
  try {
    console.log('📊 [GET Subscription] Starting...');

    // Get auth token from request header (sent by client)
    const authHeader = request.headers.get('Authorization');
    console.log('📊 [GET Subscription] Auth header present:', !!authHeader);

    const supabase = createServerClient();

    // If we have an auth header, set the session
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      console.log('📊 [GET Subscription] Auth result:', {
        hasUser: !!user,
        userId: user?.id?.substring(0, 8),
        authError: authError?.message
      });

      if (!user || authError) {
        console.log('📊 [GET Subscription] Invalid token, returning 401');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Continue with authenticated user
      // Get user's tenant
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!userRole) {
        return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
      }

      const supabaseAdmin = getSupabaseAdmin();

      // Get client from tenant
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('tenant_id', userRole.tenant_id)
        .single();

      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }

      // Get subscription
      const { data: subscription, error: subscriptionError } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('client_id', client.id)
        .in('status', ['active', 'past_due'])
        .single();

      console.log('📊 [GET Subscription] Query result:', {
        client_id: client.id,
        subscription_found: !!subscription,
        subscription_plan: subscription?.plan,
        subscription_status: subscription?.status,
        error: subscriptionError?.message,
      });

      if (!subscription) {
        return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
      }

      // Get current branch count
      const { count: currentBranchCount } = await supabaseAdmin
        .from('branches')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', userRole.tenant_id)
        .eq('is_active', true);

      // Get pricing for next branch
      const nextBranchNumber = (subscription.max_branches || 1) + 1;
      const nextBranchPrice = getBranchPrice(subscription.plan, nextBranchNumber);

      return NextResponse.json({
        data: {
          plan: subscription.plan,
          status: subscription.status,
          max_branches: subscription.max_branches || 1,
          current_branches: currentBranchCount || 1,
          can_add_branch: subscription.plan !== 'starter',
          can_remove_branch: (currentBranchCount || 1) > 1,
          next_branch_price: nextBranchPrice / 100,
          currency: 'MXN',
          period_end: subscription.current_period_end,
        },
      });
    }

    // No auth header - try cookie-based auth (fallback)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('📊 [GET Subscription] Cookie auth result:', {
      hasUser: !!user,
      userId: user?.id?.substring(0, 8),
      authError: authError?.message
    });

    if (!user) {
      console.log('📊 [GET Subscription] No user found, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userRole) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get client from tenant
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get subscription
    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('client_id', client.id)
      .in('status', ['active', 'past_due'])
      .single();

    console.log('📊 [GET Subscription] Query result:', {
      client_id: client.id,
      subscription_found: !!subscription,
      subscription_plan: subscription?.plan,
      subscription_status: subscription?.status,
      error: subscriptionError?.message,
    });

    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    // Get current branch count
    const { count: currentBranchCount } = await supabaseAdmin
      .from('branches')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', userRole.tenant_id)
      .eq('is_active', true);

    // Get pricing for next branch
    const nextBranchNumber = (subscription.max_branches || 1) + 1;
    const nextBranchPrice = getBranchPrice(subscription.plan, nextBranchNumber);

    return NextResponse.json({
      data: {
        plan: subscription.plan,
        status: subscription.status,
        max_branches: subscription.max_branches || 1,
        current_branches: currentBranchCount || 1,
        can_add_branch: subscription.plan !== 'starter',
        can_remove_branch: (currentBranchCount || 1) > 1,
        next_branch_price: nextBranchPrice / 100,
        currency: 'MXN',
        period_end: subscription.current_period_end,
      },
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

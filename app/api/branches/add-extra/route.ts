// =====================================================
// TIS TIS PLATFORM - Add Extra Branch API
// Adds a new branch with billing (charges for extra branch)
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getUserFromRequest } from '@/src/shared/lib/supabase-server';
import { getPlanConfig, getNextBranchPrice, calculateBranchCostPesos } from '@/src/shared/config/plans';

// Stripe client
function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// Service role client for admin operations
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// NOTE: Pricing is now centralized in src/shared/config/plans.ts
// Use getNextBranchPrice() for progressive pricing

// ======================
// POST - Add extra branch with billing
// ======================
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getUserFromRequest(request);
    const body = await request.json();
    const { name, city, state, address, phone, whatsapp_number, confirmBilling } = body;

    // Authenticate user
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant and role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single() as { data: { tenant_id: string; role: string } | null };

    if (!userRole?.tenant_id || !userRole?.role) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    const tenantId = userRole.tenant_id;
    const userRoleType = userRole.role;

    // Only admins/owners can add branches
    if (!['admin', 'owner'].includes(userRoleType)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden agregar sucursales' },
        { status: 403 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Step 1: Get client_id for this tenant
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !clientData) {
      console.error('Error fetching client:', clientError);
      return NextResponse.json(
        { error: 'No se encontró cliente asociado al tenant' },
        { status: 404 }
      );
    }

    // Step 2: Get subscription for this client
    // Include 'trialing' status so users in trial can also add branches
    const { data: subscriptionData, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, plan, max_branches, current_branches, branch_unit_price, client_id, stripe_subscription_id')
      .eq('client_id', clientData.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscriptionData) {
      console.error('Error fetching subscription:', subError);
      return NextResponse.json(
        { error: 'No se encontró una suscripción activa' },
        { status: 404 }
      );
    }

    const plan = subscriptionData.plan?.toLowerCase() || 'starter';
    const planConfig = getPlanConfig(plan);
    const planLimit = planConfig?.branchLimit || 1;
    const contractedBranches = subscriptionData.max_branches || 1;
    const currentBranches = subscriptionData.current_branches || 1;

    // Check if Starter plan (no extra branches allowed)
    if (plan === 'starter') {
      return NextResponse.json({
        error: 'plan_not_allowed',
        message: 'El plan Starter solo permite 1 sucursal. Mejora tu plan para agregar más.',
        upgrade_required: true,
      }, { status: 403 });
    }

    // Check if at the plan's absolute limit
    if (currentBranches >= planLimit) {
      return NextResponse.json({
        error: 'plan_limit_reached',
        message: `El plan ${plan} permite máximo ${planLimit} sucursales. Mejora tu plan para agregar más.`,
        current: currentBranches,
        plan_limit: planLimit,
        upgrade_required: true,
      }, { status: 403 });
    }

    // Get progressive pricing for the next branch
    const extraBranchPrice = getNextBranchPrice(plan, currentBranches);

    // If still has contracted branches available, redirect to normal creation
    // This shouldn't happen if the UI is correct, but handle it gracefully
    if (currentBranches < contractedBranches) {
      return NextResponse.json({
        error: 'not_at_contracted_limit',
        message: 'Aún tienes sucursales contratadas disponibles. Usa la creación normal.',
        current: currentBranches,
        contracted: contractedBranches,
        use_endpoint: '/api/branches',
      }, { status: 400 });
    }

    // At contracted limit - need to pay for extra branch
    // If user hasn't confirmed billing, return pricing info
    if (!confirmBilling) {
      return NextResponse.json({
        requires_confirmation: true,
        pricing: {
          extra_branch_price: extraBranchPrice,
          currency: 'MXN',
          billing_period: 'mensual',
          current_branches: currentBranches,
          contracted_branches: contractedBranches,
          plan_limit: planLimit,
          new_total_branches: currentBranches + 1,
          plan: plan,
        },
        message: `Agregar una sucursal extra tiene un costo adicional de $${extraBranchPrice.toLocaleString()} MXN/mes. Este monto se sumará a tu facturación mensual.`,
      });
    }

    // User confirmed - proceed with creating the branch and updating billing

    // 1. Create the branch
    const baseSlug = (name || 'sucursal')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    const { data: existingSlugs } = await supabaseAdmin
      .from('branches')
      .select('slug')
      .eq('tenant_id', tenantId)
      .like('slug', `${baseSlug}%`);

    let slug = baseSlug;
    if (existingSlugs && existingSlugs.length > 0) {
      slug = `${baseSlug}-${existingSlugs.length + 1}`;
    }

    const { data: newBranch, error: createError } = await supabaseAdmin
      .from('branches')
      .insert({
        tenant_id: tenantId,
        name: name || 'Nueva Sucursal',
        slug: slug,
        city: city || 'Por configurar',
        state: state || 'Por configurar',
        country: 'Mexico',
        address: address || '',
        phone: phone || '',
        whatsapp_number: whatsapp_number || '',
        is_headquarters: false,
        is_active: true,
        timezone: 'America/Mexico_City',
        operating_hours: {
          monday: { open: '09:00', close: '18:00', enabled: true },
          tuesday: { open: '09:00', close: '18:00', enabled: true },
          wednesday: { open: '09:00', close: '18:00', enabled: true },
          thursday: { open: '09:00', close: '18:00', enabled: true },
          friday: { open: '09:00', close: '18:00', enabled: true },
          saturday: { open: '09:00', close: '14:00', enabled: true },
          sunday: { enabled: false },
        },
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating branch:', createError);
      return NextResponse.json(
        { error: 'Error al crear sucursal', details: createError.message },
        { status: 500 }
      );
    }

    // 2. Update Stripe subscription with the new branch item
    // This ensures the customer is charged for the extra branch
    const stripe = getStripeClient();
    let stripeUpdateSuccess = false;

    if (subscriptionData.stripe_subscription_id) {
      try {
        console.log(`💳 Updating Stripe subscription: ${subscriptionData.stripe_subscription_id}`);

        // Get the current Stripe subscription
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscriptionData.stripe_subscription_id
        );

        // Create price for the extra branch (price in centavos for Stripe)
        const branchPriceCentavos = extraBranchPrice * 100;

        const priceData = {
          currency: 'mxn',
          product_data: {
            name: `Sucursal Extra #${currentBranches + 1} - Plan ${plan}`,
          },
          unit_amount: branchPriceCentavos,
          recurring: {
            interval: 'month' as const,
          },
        };

        // Create the price in Stripe
        const stripePrice = await stripe.prices.create(priceData);

        // Add the new item to subscription (with proration)
        await stripe.subscriptions.update(
          subscriptionData.stripe_subscription_id,
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
              branches: String(currentBranches + 1),
            },
          }
        );

        stripeUpdateSuccess = true;
        console.log(`✅ Stripe subscription updated: +$${extraBranchPrice}/mes`);

      } catch (stripeError) {
        console.error('❌ Error updating Stripe subscription:', stripeError);
        // If Stripe fails, we should NOT proceed with creating the branch
        // Delete the branch we just created
        await supabaseAdmin
          .from('branches')
          .delete()
          .eq('id', newBranch.id);

        return NextResponse.json({
          error: 'stripe_error',
          message: 'Error al procesar el pago. Por favor intenta de nuevo.',
          details: stripeError instanceof Error ? stripeError.message : 'Unknown error',
        }, { status: 500 });
      }
    } else {
      console.warn('⚠️ No stripe_subscription_id found - billing not updated');
    }

    // 3. Update local subscription max_branches and monthly_amount
    // Calculate new total monthly amount: plan price + all extra branches cost
    const newContractedBranches = contractedBranches + 1;
    const planBasePrice = planConfig?.monthlyPricePesos || 0;
    const totalExtraBranchesCost = calculateBranchCostPesos(plan, newContractedBranches);
    const newMonthlyAmount = planBasePrice + totalExtraBranchesCost;

    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        max_branches: newContractedBranches, // Increase contracted branches by 1
        branch_unit_price: extraBranchPrice,
        monthly_amount: newMonthlyAmount, // Update total monthly amount
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionData.id);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      // Branch was created but subscription update failed - log but don't fail
    }

    // 4. Log the subscription change (ignore errors - non-critical)
    try {
      await supabaseAdmin.from('subscription_changes').insert({
        subscription_id: subscriptionData.id,
        tenant_id: tenantId,
        client_id: subscriptionData.client_id,
        change_type: 'branch_added',
        previous_value: { max_branches: contractedBranches, current_branches: currentBranches },
        new_value: { max_branches: contractedBranches + 1, current_branches: currentBranches + 1 },
        price_impact: extraBranchPrice,
        reason: `Sucursal extra agregada: ${newBranch.name}`,
        metadata: {
          branch_id: newBranch.id,
          branch_name: newBranch.name,
          plan: plan,
          stripe_updated: stripeUpdateSuccess,
          stripe_subscription_id: subscriptionData.stripe_subscription_id,
          new_monthly_amount: newMonthlyAmount,
        },
        created_by: user.id,
      });
    } catch (logError) {
      console.error('Error logging subscription change:', logError);
    }

    // 5. Log audit (ignore errors - non-critical)
    try {
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: user.id,
        action: 'extra_branch_created',
        entity_type: 'branch',
        entity_id: newBranch.id,
        new_data: {
          branch_name: newBranch.name,
          branch_id: newBranch.id,
          extra_cost: extraBranchPrice,
        },
      });
    } catch (auditError) {
      console.error('Error logging audit:', auditError);
    }

    console.log('✅ Extra branch created:', newBranch.id, newBranch.name, `+$${extraBranchPrice}/mes`, stripeUpdateSuccess ? '(Stripe updated)' : '(No Stripe)');

    return NextResponse.json({
      success: true,
      data: newBranch,
      billing: {
        extra_cost_added: extraBranchPrice,
        new_contracted_branches: contractedBranches + 1,
        stripe_updated: stripeUpdateSuccess,
        message: stripeUpdateSuccess
          ? `Sucursal creada exitosamente. Se agregó $${extraBranchPrice.toLocaleString()} MXN/mes a tu facturación.`
          : `Sucursal creada exitosamente. El cobro se reflejará en tu próxima factura.`,
      },
    });

  } catch (error) {
    console.error('Add extra branch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// GET - Get extra branch pricing info
// ======================
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getUserFromRequest(request);

    // Authenticate user
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single() as { data: { tenant_id: string } | null };

    if (!userRole?.tenant_id) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    const tenantId = userRole.tenant_id;
    const supabaseAdmin = getSupabaseAdmin();

    // Step 1: Get client_id for this tenant
    const { data: clientData } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .single();

    if (!clientData) {
      return NextResponse.json({
        error: 'No client found',
        can_add_extra: false,
      }, { status: 404 });
    }

    // Step 2: Get subscription for this client
    // Include 'trialing' status so users in trial can also add branches
    const { data: subscriptionData } = await supabaseAdmin
      .from('subscriptions')
      .select('id, plan, max_branches, current_branches, branch_unit_price')
      .eq('client_id', clientData.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscriptionData) {
      return NextResponse.json({
        error: 'No subscription found',
        can_add_extra: false,
      }, { status: 404 });
    }

    const plan = subscriptionData.plan?.toLowerCase() || 'starter';
    const planConfig = getPlanConfig(plan);
    const planLimit = planConfig?.branchLimit || 1;
    const contractedBranches = subscriptionData.max_branches || 1;
    const currentBranches = subscriptionData.current_branches || 1;

    // Use progressive pricing from plans.ts
    const nextBranchPrice = getNextBranchPrice(plan, currentBranches);
    const canAddExtra = plan !== 'starter' && currentBranches < planLimit;

    return NextResponse.json({
      plan,
      current_branches: currentBranches,
      contracted_branches: contractedBranches, // Sucursales pagadas
      plan_limit: planLimit, // Límite máximo del plan
      can_add_extra: canAddExtra,
      extra_branch_price: nextBranchPrice, // Precio de la siguiente sucursal
      currency: 'MXN',
      // For backwards compatibility, also include max_branches (now means contracted)
      max_branches: contractedBranches,
    });

  } catch (error) {
    console.error('Get branch pricing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

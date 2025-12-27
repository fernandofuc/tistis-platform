// =====================================================
// TIS TIS PLATFORM - Cancel Subscription API
// Handles subscription cancellation with 90-day data retention
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/src/shared/lib/supabase';
import { checkRateLimit, getClientIP, strictLimiter, rateLimitExceeded } from '@/src/shared/lib/rate-limit';

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Cancellation reasons for analytics
const VALID_REASONS = [
  'too_expensive',
  'not_using',
  'missing_features',
  'technical_issues',
  'switching',
  'closing_business',
  'other',
];

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - prevent abuse of cancellation endpoint
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, strictLimiter);

    if (!rateLimitResult.success) {
      return rateLimitExceeded(rateLimitResult);
    }

    const supabase = createServerClient();
    const body = await request.json();
    const { reason, reasonDetails } = body;

    // Validate reason
    if (reason && !VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: 'Razón de cancelación inválida' },
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
        { error: 'Solo el propietario puede cancelar la suscripción' },
        { status: 403 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get client from tenant
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('id, stripe_customer_id, business_name')
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

    const stripe = getStripeClient();

    // Cancel Stripe subscription at period end (gives them remaining time)
    const cancelledSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: true,
        metadata: {
          cancellation_reason: reason || 'not_specified',
          cancellation_details: reasonDetails || '',
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
        },
      }
    );

    // Calculate data retention date (90 days from now)
    const dataRetentionDate = new Date();
    dataRetentionDate.setDate(dataRetentionDate.getDate() + 90);

    // Update local subscription record
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'cancelling', // Will be 'cancelled' after period ends
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        cancellation_details: reasonDetails,
        data_retention_until: dataRetentionDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    // Update tenant status
    await supabaseAdmin
      .from('tenants')
      .update({
        status: 'cancelling',
        cancelled_at: new Date().toISOString(),
        data_retention_until: dataRetentionDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userRole.tenant_id);

    // Deactivate all user_roles for this tenant (blocks access for all staff)
    await supabaseAdmin
      .from('user_roles')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivation_reason: 'subscription_cancelled',
      })
      .eq('tenant_id', userRole.tenant_id);

    // Log the cancellation
    await supabaseAdmin.from('subscription_changes').insert({
      subscription_id: subscription.id,
      tenant_id: userRole.tenant_id,
      client_id: client.id,
      change_type: 'subscription_cancelled',
      previous_value: {
        status: 'active',
        plan: subscription.plan,
      },
      new_value: {
        status: 'cancelling',
        reason: reason,
        data_retention_until: dataRetentionDate.toISOString(),
      },
      created_by: user.id,
      metadata: {
        stripe_subscription_id: cancelledSubscription.id,
        cancel_at_period_end: true,
        current_period_end: (cancelledSubscription as any).current_period_end,
        reason_details: reasonDetails,
      },
    });

    // Get period end for response
    const periodEnd = (cancelledSubscription as any).current_period_end;

    // Log cancellation reason for analytics (non-blocking)
    try {
      await supabaseAdmin.from('cancellation_feedback').insert({
        tenant_id: userRole.tenant_id,
        client_id: client.id,
        subscription_id: subscription.id,
        plan_at_cancellation: subscription.plan,
        reason: reason || 'not_specified',
        reason_details: reasonDetails,
        subscription_duration_days: Math.floor(
          (new Date().getTime() - new Date(subscription.created_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
        monthly_amount: subscription.monthly_amount,
        branches_count: subscription.max_branches || 1,
        created_by: user.id,
      });
      console.log('Cancellation feedback logged');
    } catch (feedbackErr) {
      // Non-blocking - just log the error
      console.error('Failed to log cancellation feedback:', feedbackErr);
    }

    console.log(`❌ Subscription cancelled: ${client.business_name} (${subscription.plan})`);
    console.log(`   Reason: ${reason || 'not_specified'}`);
    console.log(`   Data retained until: ${dataRetentionDate.toISOString()}`);

    return NextResponse.json({
      success: true,
      message: 'Suscripción cancelada exitosamente',
      access_until: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      data_retention_until: dataRetentionDate.toISOString(),
    });

  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al cancelar la suscripción' },
      { status: 500 }
    );
  }
}

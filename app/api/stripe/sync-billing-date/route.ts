// =====================================================
// TIS TIS PLATFORM - Sync Billing Date from Stripe
// One-time utility to sync current_period_end from Stripe
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stripe_subscription_id } = body;

    if (!stripe_subscription_id || !stripe_subscription_id.startsWith('sub_')) {
      return NextResponse.json(
        { error: 'Invalid stripe_subscription_id' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const supabase = getSupabaseAdmin();

    // Fetch subscription from Stripe
    console.log('[Sync] Fetching subscription from Stripe:', stripe_subscription_id);
    const stripeSubscription = await stripe.subscriptions.retrieve(stripe_subscription_id);

    // Log full subscription details for debugging
    console.log('[Sync] Stripe subscription status:', stripeSubscription.status);
    console.log('[Sync] Stripe subscription object keys:', Object.keys(stripeSubscription));

    const periodEnd = (stripeSubscription as any).current_period_end;
    const periodStart = (stripeSubscription as any).current_period_start;

    // If no period end, return debug info about the subscription
    if (!periodEnd) {
      // Get all keys to see what Stripe returned
      const allKeys = Object.keys(stripeSubscription);

      // Try to get period from items if available
      const items = (stripeSubscription as any).items?.data;
      const firstItemPeriod = items?.[0]?.current_period_end;

      return NextResponse.json(
        {
          error: 'No current_period_end found in Stripe subscription',
          debug: {
            status: (stripeSubscription as any).status,
            cancel_at_period_end: (stripeSubscription as any).cancel_at_period_end,
            canceled_at: (stripeSubscription as any).canceled_at,
            ended_at: (stripeSubscription as any).ended_at,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            all_keys: allKeys,
            items_count: items?.length || 0,
            first_item_period_end: firstItemPeriod,
            raw_subscription: JSON.stringify(stripeSubscription).substring(0, 2000),
          },
        },
        { status: 404 }
      );
    }

    const currentPeriodEnd = new Date(periodEnd * 1000).toISOString();
    console.log('[Sync] Got current_period_end:', currentPeriodEnd);

    // Update in Supabase
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', stripe_subscription_id)
      .select('id, plan, current_period_end')
      .single();

    if (error) {
      console.error('[Sync] Error updating subscription:', error);
      return NextResponse.json(
        { error: 'Failed to update subscription: ' + error.message },
        { status: 500 }
      );
    }

    console.log('[Sync] Successfully updated subscription:', data);

    return NextResponse.json({
      success: true,
      message: 'Billing date synced successfully',
      subscription: data,
      next_billing_date: currentPeriodEnd,
      next_billing_date_formatted: new Date(currentPeriodEnd).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    });

  } catch (error: any) {
    console.error('[Sync] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error syncing billing date' },
      { status: 500 }
    );
  }
}

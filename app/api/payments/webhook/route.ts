// =====================================================
// TIS TIS PLATFORM - Stripe Connect Webhook
// Handle Stripe Connect events
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Create Stripe client lazily (consistent with other Stripe endpoints)
function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// Supabase Admin Client (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Webhook secret for verifying events
const endpointSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET!;

// ======================
// POST - Handle Stripe webhook events
// ======================
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('[Stripe Webhook] No signature found');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = getStripeClient().webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Check for duplicate event (idempotency)
    const { data: existingEvent } = await supabaseAdmin
      .from('stripe_webhook_events')
      .select('id, status')
      .eq('stripe_event_id', event.id)
      .single();

    if (existingEvent?.status === 'processed') {
      console.log('[Stripe Webhook] Duplicate event, skipping:', event.id);
      return NextResponse.json({ received: true, status: 'duplicate' });
    }

    // Record the event
    const { data: webhookRecord } = await supabaseAdmin
      .from('stripe_webhook_events')
      .upsert({
        stripe_event_id: event.id,
        event_type: event.type,
        status: 'pending',
        payload: event.data,
        connected_account_id: event.account || null,
      })
      .select()
      .single();

    // Process the event based on type
    try {
      switch (event.type) {
        case 'account.updated':
          await handleAccountUpdated(event.data.object as Stripe.Account);
          break;

        case 'account.application.deauthorized':
          await handleAccountDeauthorized(event.account!);
          break;

        case 'payment_intent.succeeded':
          await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event.account || undefined);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'payout.paid':
        case 'payout.failed':
          await handlePayoutEvent(event.data.object as Stripe.Payout, event.type, event.account || undefined);
          break;

        default:
          console.log('[Stripe Webhook] Unhandled event type:', event.type);
      }

      // Mark as processed
      if (webhookRecord) {
        await supabaseAdmin
          .from('stripe_webhook_events')
          .update({ status: 'processed', processed_at: new Date().toISOString() })
          .eq('id', webhookRecord.id);
      }
    } catch (processError) {
      console.error('[Stripe Webhook] Processing error:', processError);

      // Mark as failed
      if (webhookRecord) {
        await supabaseAdmin
          .from('stripe_webhook_events')
          .update({
            status: 'failed',
            error_message: processError instanceof Error ? processError.message : 'Unknown error',
            retry_count: (webhookRecord as { retry_count?: number }).retry_count ? (webhookRecord as { retry_count: number }).retry_count + 1 : 1,
          })
          .eq('id', webhookRecord.id);
      }

      // Still return 200 to prevent Stripe retries (we handle our own retries)
      return NextResponse.json({ received: true, status: 'failed' });
    }

    return NextResponse.json({ received: true, status: 'processed' });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}

// ======================
// HELPER - Get tenant by Stripe account
// ======================
async function getTenantByStripeAccount(stripeAccountId: string) {
  const { data: connectAccount } = await supabaseAdmin
    .from('stripe_connect_accounts')
    .select('id, tenant_id')
    .eq('stripe_account_id', stripeAccountId)
    .single();

  return connectAccount;
}

// ======================
// EVENT HANDLERS
// ======================

async function handleAccountUpdated(account: Stripe.Account) {
  console.log('[Stripe Webhook] Account updated:', account.id);

  // Find tenant by Stripe account ID
  const connectAccount = await getTenantByStripeAccount(account.id);

  if (!connectAccount) {
    console.log('[Stripe Webhook] Account not found in DB:', account.id);
    return;
  }

  // Determine new status
  let newStatus = 'pending';
  if (account.charges_enabled && account.details_submitted) {
    newStatus = 'connected';
  } else if (account.requirements?.disabled_reason) {
    newStatus = 'restricted';
  }

  // Update account status
  await supabaseAdmin
    .from('stripe_connect_accounts')
    .update({
      status: newStatus,
      is_charges_enabled: account.charges_enabled,
      is_payouts_enabled: account.payouts_enabled,
      is_details_submitted: account.details_submitted,
      business_name: account.business_profile?.name || null,
      business_type: account.business_type || null,
      default_currency: account.default_currency || 'mxn',
      connected_at: newStatus === 'connected' ? new Date().toISOString() : null,
      last_sync_at: new Date().toISOString(),
    })
    .eq('id', connectAccount.id);

  // If bank account info available
  if (account.external_accounts?.data?.[0]) {
    const bankAccount = account.external_accounts.data[0];
    if (bankAccount.object === 'bank_account') {
      await supabaseAdmin
        .from('stripe_connect_accounts')
        .update({
          bank_name: (bankAccount as Stripe.BankAccount).bank_name || null,
          bank_last_four: (bankAccount as Stripe.BankAccount).last4 || null,
        })
        .eq('id', connectAccount.id);
    }
  }
}

async function handleAccountDeauthorized(accountId: string) {
  console.log('[Stripe Webhook] Account deauthorized:', accountId);

  await supabaseAdmin
    .from('stripe_connect_accounts')
    .update({ status: 'disabled' })
    .eq('stripe_account_id', accountId);
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('[Stripe Webhook] Payment succeeded:', paymentIntent.id);

  // Update payment intent record
  await supabaseAdmin
    .from('stripe_payment_intents')
    .update({
      status: 'succeeded',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  // If this is for a membership, activate it
  if (paymentIntent.metadata?.membership_id) {
    await supabaseAdmin
      .from('loyalty_memberships')
      .update({
        status: 'active',
        payment_status: 'paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentIntent.metadata.membership_id);
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('[Stripe Webhook] Payment failed:', paymentIntent.id);

  await supabaseAdmin
    .from('stripe_payment_intents')
    .update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, connectedAccountId?: string) {
  console.log('[Stripe Webhook] Subscription updated:', subscription.id);

  // Get tenant_id from connected account
  const stripeAccountId = connectedAccountId || (subscription.application as string);
  if (!stripeAccountId) {
    console.log('[Stripe Webhook] No connected account ID for subscription:', subscription.id);
    return;
  }

  const connectAccount = await getTenantByStripeAccount(stripeAccountId);
  if (!connectAccount) {
    console.log('[Stripe Webhook] Tenant not found for subscription:', subscription.id);
    return;
  }

  // Get period dates from subscription (handle different Stripe API versions)
  const subscriptionData = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  const periodStart = subscriptionData.current_period_start
    ? new Date(subscriptionData.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = subscriptionData.current_period_end
    ? new Date(subscriptionData.current_period_end * 1000).toISOString()
    : null;

  await supabaseAdmin
    .from('stripe_subscriptions')
    .upsert({
      tenant_id: connectAccount.tenant_id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      stripe_connected_account_id: stripeAccountId,
      stripe_price_id: subscription.items.data[0]?.price.id || '',
      status: subscription.status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'stripe_subscription_id',
    });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[Stripe Webhook] Subscription deleted:', subscription.id);

  await supabaseAdmin
    .from('stripe_subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  // Update related membership
  const { data: sub } = await supabaseAdmin
    .from('stripe_subscriptions')
    .select('membership_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (sub?.membership_id) {
    await supabaseAdmin
      .from('loyalty_memberships')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.membership_id);
  }
}

async function handlePayoutEvent(payout: Stripe.Payout, eventType: string, connectedAccountId?: string) {
  console.log('[Stripe Webhook] Payout event:', eventType, payout.id);

  if (!connectedAccountId) {
    console.log('[Stripe Webhook] No connected account ID for payout:', payout.id);
    return;
  }

  const connectAccount = await getTenantByStripeAccount(connectedAccountId);
  if (!connectAccount) {
    console.log('[Stripe Webhook] Tenant not found for payout:', payout.id);
    return;
  }

  const status = eventType === 'payout.paid' ? 'paid' : 'failed';

  await supabaseAdmin
    .from('stripe_payouts')
    .upsert({
      tenant_id: connectAccount.tenant_id,
      stripe_payout_id: payout.id,
      stripe_connected_account_id: connectedAccountId,
      amount: payout.amount,
      currency: payout.currency,
      status: status,
      arrival_date: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
      failure_code: payout.failure_code || null,
      failure_message: payout.failure_message || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'stripe_payout_id',
    });
}


import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Use service role for webhook (server-side only)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature if secret is configured
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      // For testing without webhook secret
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('📨 Stripe webhook received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('💰 Payment succeeded for invoice:', invoice.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('❌ Payment failed for invoice:', invoice.id);
        // Could send email notification here
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('✅ Checkout completed:', session.id);

  const { plan, customerName, proposalId } = session.metadata || {};
  const customerEmail = session.customer_email || session.customer_details?.email;

  if (!customerEmail) {
    console.error('No customer email found in session');
    return;
  }

  // Find or create client
  let { data: existingClient } = await supabase
    .from('clients')
    .select('id, user_id')
    .eq('contact_email', customerEmail)
    .single();

  let clientId: string | null = existingClient?.id || null;

  if (!existingClient) {
    // Create new client
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        contact_email: customerEmail,
        contact_name: customerName,
        business_name: customerName,
        status: 'active',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating client:', error);
      return;
    }
    clientId = newClient?.id || null;
  } else {
    // Update existing client to active
    await supabase
      .from('clients')
      .update({ status: 'active' })
      .eq('id', existingClient.id);
  }

  // Update proposal if exists
  if (proposalId) {
    await supabase
      .from('proposals')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', proposalId);
  }

  console.log('✅ Client updated/created:', clientId);
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('🆕 Subscription created:', subscription.id);

  const { plan, customerName } = subscription.metadata || {};
  const customerId = subscription.customer as string;

  // Get customer email from Stripe
  const customer = await stripe.customers.retrieve(customerId);
  const customerEmail = (customer as Stripe.Customer).email;

  if (!customerEmail) {
    console.error('No customer email found');
    return;
  }

  // Find client by email
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('contact_email', customerEmail)
    .single();

  if (!client) {
    console.error('Client not found for email:', customerEmail);
    return;
  }

  // Get price amount
  const priceAmount = subscription.items.data[0]?.price?.unit_amount || 0;

  // Create subscription record
  const { error } = await supabase.from('subscriptions').insert({
    client_id: client.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0]?.price?.id,
    plan: plan || 'essentials',
    monthly_amount: priceAmount / 100,
    currency: 'MXN',
    status: subscription.status === 'active' ? 'active' : 'pending',
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  });

  if (error) {
    console.error('Error creating subscription:', error);
  } else {
    console.log('✅ Subscription record created');
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('🔄 Subscription updated:', subscription.id);

  const status = subscription.status === 'active' ? 'active' :
                 subscription.status === 'past_due' ? 'past_due' :
                 subscription.status === 'canceled' ? 'cancelled' : 'pending';

  await supabase
    .from('subscriptions')
    .update({
      status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('❌ Subscription deleted:', subscription.id);

  await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}

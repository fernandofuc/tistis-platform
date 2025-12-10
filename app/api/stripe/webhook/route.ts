export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Create Stripe client lazily
function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// Create Supabase client lazily to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  const stripe = getStripeClient();

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
  const supabase = getSupabaseClient();

  const { plan, customerName, proposalId, branches, addons } = session.metadata || {};
  const customerEmail = session.customer_email || session.customer_details?.email;

  if (!customerEmail) {
    console.error('No customer email found in session');
    return;
  }

  console.log('📋 Checkout metadata:', { plan, customerName, branches, addons, proposalId });

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
        locations_count: branches ? parseInt(branches) : 1,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating client:', error);
      return;
    }
    clientId = newClient?.id || null;
    console.log('✅ New client created:', clientId);
  } else {
    // Update existing client to active
    await supabase
      .from('clients')
      .update({
        status: 'active',
        locations_count: branches ? parseInt(branches) : 1,
      })
      .eq('id', existingClient.id);
    console.log('✅ Existing client updated:', existingClient.id);
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
    console.log('✅ Proposal marked as accepted:', proposalId);
  }

  // Create onboarding data record for the new client
  if (clientId) {
    const { error: onboardingError } = await supabase
      .from('onboarding_data')
      .upsert({
        client_id: clientId,
        business_name: customerName,
        completed: false,
      }, { onConflict: 'client_id' });

    if (onboardingError) {
      console.error('Error creating onboarding data:', onboardingError);
    } else {
      console.log('✅ Onboarding data created for client:', clientId);
    }
  }

  console.log('✅ Checkout processing complete for client:', clientId);
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('🆕 Subscription created:', subscription.id);
  const stripe = getStripeClient();
  const supabase = getSupabaseClient();

  const { plan, customerName, branches, addons, vertical, proposalId } = subscription.metadata || {};
  const customerId = subscription.customer as string;

  console.log('📋 Subscription metadata:', { plan, customerName, branches, addons });

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

  // Calculate total monthly amount from all line items
  let totalMonthlyAmount = 0;
  for (const item of subscription.items.data) {
    const unitAmount = item.price?.unit_amount || 0;
    const quantity = item.quantity || 1;
    totalMonthlyAmount += unitAmount * quantity;
  }

  // Parse addons
  let parsedAddons: string[] = [];
  if (addons) {
    try {
      parsedAddons = JSON.parse(addons);
    } catch {
      parsedAddons = [];
    }
  }

  // Create subscription record
  const periodStart = (subscription as any).current_period_start;
  const periodEnd = (subscription as any).current_period_end;

  const { error } = await supabase.from('subscriptions').insert({
    client_id: client.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0]?.price?.id,
    plan: plan || 'essentials',
    addons: parsedAddons,
    branches: branches ? parseInt(branches) : 1,
    monthly_amount: totalMonthlyAmount / 100,
    currency: 'MXN',
    status: subscription.status === 'active' ? 'active' : 'pending',
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  });

  if (error) {
    console.error('Error creating subscription:', error);
    return;
  }

  console.log('✅ Subscription record created for client:', client.id);
  console.log('   Plan:', plan, '| Branches:', branches, '| Amount:', totalMonthlyAmount / 100, 'MXN');

  // Get the newly created subscription ID
  const { data: newSubscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  // 🚀 TRIGGER ASSEMBLY ENGINE - Auto-provision micro-app
  await triggerAssemblyEngine({
    client_id: client.id,
    subscription_id: newSubscription?.id,
    vertical: vertical || 'dental', // Use vertical from metadata, default to dental
    plan: (plan as 'starter' | 'essentials' | 'growth' | 'scale') || 'essentials',
    addons: parsedAddons,
    branches: branches ? parseInt(branches) : 1,
    proposal_id: proposalId
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('🔄 Subscription updated:', subscription.id);
  const supabase = getSupabaseClient();

  const status = subscription.status === 'active' ? 'active' :
                 subscription.status === 'past_due' ? 'past_due' :
                 subscription.status === 'canceled' ? 'cancelled' : 'pending';

  // Cast to any to access current_period_start/end which exist at runtime but have type issues
  const periodStart = (subscription as any).current_period_start;
  const periodEnd = (subscription as any).current_period_end;

  await supabase
    .from('subscriptions')
    .update({
      status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('❌ Subscription deleted:', subscription.id);
  const supabase = getSupabaseClient();

  await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}

// ============================================
// ASSEMBLY ENGINE TRIGGER
// Automatically provisions micro-app for new clients
// ============================================

interface AssemblyTriggerParams {
  client_id: string;
  subscription_id?: string;
  vertical: string;
  plan: 'starter' | 'essentials' | 'growth' | 'scale';
  addons: string[];
  branches: number;
  proposal_id?: string;
}

async function triggerAssemblyEngine(params: AssemblyTriggerParams) {
  console.log('🚀 [AssemblyTrigger] Starting micro-app provisioning...');
  console.log('📋 [AssemblyTrigger] Params:', params);

  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/assemble`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: params.client_id,
        subscription_id: params.subscription_id,
        vertical: params.vertical,
        plan: params.plan,
        addons: params.addons,
        branches: params.branches,
        proposal_id: params.proposal_id
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ [AssemblyTrigger] Assembly Engine failed:', {
        status: response.status,
        error: errorData
      });

      // Notify team of assembly failure (non-blocking)
      const supabase = getSupabaseClient();
      await supabase.from('notification_queue').insert({
        type: 'assembly_failed',
        recipient_type: 'internal',
        recipient_id: 'team',
        payload: {
          client_id: params.client_id,
          error: errorData,
          params: params
        },
        priority: 'urgent'
      });

      return;
    }

    const result = await response.json();
    console.log('✅ [AssemblyTrigger] Assembly Engine succeeded:', {
      deployment_id: result.data?.deployment_id,
      components_count: result.data?.components_count,
      estimated_minutes: result.data?.estimated_duration_minutes
    });

    // TODO: Trigger n8n Master Deployment workflow here
    // This will be implemented when n8n webhook is configured
    // await triggerN8nDeployment(result.data?.deployment_id);

  } catch (error) {
    console.error('💥 [AssemblyTrigger] Unexpected error:', error);
  }
}

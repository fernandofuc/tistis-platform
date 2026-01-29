export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { emailService } from '@/src/lib/email';
import { provisionTenant } from '@/lib/provisioning';
import { getPlanConfig, PLAN_CONFIG } from '@/src/shared/config/plans';
import { createComponentLogger } from '@/src/shared/lib';
import { voiceSyncService } from '@/src/features/voice-agent/services/voice-sync.service';
import { isValidUUID } from '@/src/shared/lib/auth-helper';

// Create logger for Stripe webhook
const logger = createComponentLogger('stripe-webhook');

// ============================================
// VALID PLANS - Source of truth
// ============================================
const VALID_PLANS = ['starter', 'essentials', 'growth'] as const;
type ValidPlan = typeof VALID_PLANS[number];

function isValidPlan(plan: string | undefined): plan is ValidPlan {
  return VALID_PLANS.includes(plan as ValidPlan);
}

// Create Stripe client lazily
function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// Create Supabase client lazily to avoid build-time errors
// CRITICAL: Must use SERVICE_ROLE_KEY to bypass RLS policies
// Webhooks run server-to-server without user auth context
function getSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    logger.error('SUPABASE_SERVICE_ROLE_KEY is not configured', {
      impact: 'Webhook will fail to update database due to RLS policies',
      action: 'Add SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables',
    });
    // Still try with anon key but log the warning
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ============================================
// IDEMPOTENCY: Check if event was already processed SUCCESSFULLY
// CRITICAL FIX: Only skip events that SUCCEEDED, allow retry of FAILED events
// ============================================
async function isEventProcessedSuccessfully(eventId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('webhook_events')
    .select('id, status')
    .eq('event_id', eventId)
    .single();

  // Only skip if event was processed SUCCESSFULLY
  // Allow retry for failed events
  return data?.status === 'success';
}

async function markEventProcessed(eventId: string, eventType: string, status: 'success' | 'failed', errorMessage?: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from('webhook_events').upsert({
    event_id: eventId,
    event_type: eventType,
    status,
    error_message: errorMessage,
    processed_at: new Date().toISOString(),
    retry_count: status === 'failed' ? 1 : 0,
  }, { onConflict: 'event_id' });
}

// Track retry attempts for failed events
async function incrementRetryCount(eventId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('webhook_events')
    .select('retry_count')
    .eq('event_id', eventId)
    .single();

  const currentCount = data?.retry_count || 0;
  const newCount = currentCount + 1;

  await supabase
    .from('webhook_events')
    .update({ retry_count: newCount, processed_at: new Date().toISOString() })
    .eq('event_id', eventId);

  return newCount;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  const stripe = getStripeClient();

  if (!signature) {
    logger.warn('Missing Stripe signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  // ============================================
  // SPRINT 1 FIX: STRIPE_WEBHOOK_SECRET SIEMPRE OBLIGATORIO
  // Cambio de política: Ahora es obligatorio en TODOS los entornos
  // para prevenir que se despliegue accidentalmente sin verificación
  // ============================================
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const isStaging = process.env.VERCEL_ENV === 'preview';
  const isLocalhost = process.env.NEXT_PUBLIC_URL?.includes('localhost') || false;

  // CRÍTICO: Webhook secret es obligatorio en producción y staging
  if ((isProduction || isStaging) && !process.env.STRIPE_WEBHOOK_SECRET) {
    logger.error('STRIPE_WEBHOOK_SECRET is REQUIRED in production/staging', {
      isProduction,
      isStaging,
      vercelEnv: process.env.VERCEL_ENV,
    });
    return NextResponse.json({
      error: 'Webhook configuration error: STRIPE_WEBHOOK_SECRET not configured',
      code: 'WEBHOOK_SECRET_MISSING'
    }, { status: 500 });
  }

  // En localhost sin secret: advertir pero permitir (solo desarrollo local)
  if (!process.env.STRIPE_WEBHOOK_SECRET && !isLocalhost) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured and not running on localhost');
    return NextResponse.json({
      error: 'Webhook configuration error',
      code: 'WEBHOOK_SECRET_REQUIRED'
    }, { status: 500 });
  }

  try {
    // Verify webhook signature - SIEMPRE si el secret está configurado
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      logger.debug('Webhook signature verified successfully');
    } else if (isLocalhost) {
      // SOLO permitido en localhost para desarrollo local
      logger.warn('⚠️ Running WITHOUT signature verification - LOCALHOST ONLY');
      event = JSON.parse(body) as Stripe.Event;

      // Verificar que el evento tenga estructura básica válida
      if (!event.id || !event.type || !event.data) {
        logger.error('Invalid webhook event structure');
        return NextResponse.json({ error: 'Invalid event structure' }, { status: 400 });
      }
    } else {
      // Nunca debería llegar aquí por las validaciones anteriores
      logger.error('Unexpected state: No webhook secret and not localhost');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('Webhook signature verification failed', {
      errorMessage: error.message,
      signatureProvided: !!signature,
      secretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ============================================
  // FIX 6: Idempotency check - Skip only SUCCESSFULLY processed events
  // CRITICAL: Allow retry of FAILED events so provisioning can complete
  // ============================================
  if (await isEventProcessedSuccessfully(event.id)) {
    logger.info('Event already processed successfully, skipping', { eventId: event.id, eventType: event.type });
    return NextResponse.json({ received: true, skipped: true });
  }

  // Track retry attempts for previously failed events
  const retryCount = await incrementRetryCount(event.id);
  if (retryCount > 1) {
    logger.info('Retry attempt for event', { eventId: event.id, retryCount });
  }

  // Log which Supabase key is being used (for debugging)
  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  logger.info('Stripe webhook received', {
    eventType: event.type,
    eventId: event.id,
    hasServiceRole,
  });

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
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        logger.debug('Unhandled event type', { eventType: event.type });
    }

    // ✅ Mark event as processed successfully
    await markEventProcessed(event.id, event.type, 'success');
    logger.info('Webhook processed successfully', { eventId: event.id, eventType: event.type });
    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Webhook handler error', {
      eventId: event.id,
      eventType: event.type,
      errorMessage: err.message,
      retryCount,
    }, err);

    // ❌ Mark event as failed (will be retried by Stripe)
    await markEventProcessed(event.id, event.type, 'failed', err.message);

    // If this is the 3rd+ retry, enqueue to Dead Letter Queue for manual review
    // Stripe typically retries up to 3 times within 3 days
    if (retryCount >= 3) {
      logger.warn('Max retries exceeded, enqueueing to Dead Letter Queue', {
        eventId: event.id,
        eventType: event.type,
        retryCount,
      });

      try {
        const supabase = getSupabaseClient();
        await supabase.from('webhook_dead_letters').insert({
          channel: 'stripe',
          payload: event,
          error_message: err.message,
          error_stack: err.stack || null,
          status: 'pending',
          max_retries: 3,
          retry_count: 0, // DLQ has its own retry counter
          next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
        });
        logger.info('Event enqueued to Dead Letter Queue', { eventId: event.id });
      } catch (dlqError) {
        logger.error('Failed to enqueue to Dead Letter Queue', {
          eventId: event.id,
        }, dlqError as Error);
      }
    }

    // Return 500 so Stripe retries the webhook
    return NextResponse.json(
      { error: err.message || 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  logger.info('Checkout completed', { sessionId: session.id });
  const supabase = getSupabaseClient();

  const { plan, customerName, proposalId, branches, addons, client_id, tenant_id, previous_subscription_id } = session.metadata || {};
  // Normalize email to lowercase for consistent storage and comparison
  const rawEmail = session.customer_email || session.customer_details?.email;
  const customerEmail = rawEmail?.toLowerCase();

  // ============================================
  // SEC-FIX 3: Validate UUID format for metadata fields to prevent SQL injection
  // ============================================
  const validClientId = client_id && isValidUUID(client_id) ? client_id : undefined;
  const validTenantId = tenant_id && isValidUUID(tenant_id) ? tenant_id : undefined;
  const validPreviousSubId = previous_subscription_id && isValidUUID(previous_subscription_id) ? previous_subscription_id : undefined;
  const validProposalId = proposalId && isValidUUID(proposalId) ? proposalId : undefined;

  // Log invalid UUIDs for debugging (potential tampering)
  if (client_id && !validClientId) {
    logger.warn('Invalid client_id format in metadata', { sessionId: session.id });
  }
  if (tenant_id && !validTenantId) {
    logger.warn('Invalid tenant_id format in metadata', { sessionId: session.id });
  }
  if (previous_subscription_id && !validPreviousSubId) {
    logger.warn('Invalid previous_subscription_id format in metadata', { sessionId: session.id });
  }
  if (proposalId && !validProposalId) {
    logger.warn('Invalid proposalId format in metadata', { sessionId: session.id });
  }

  // ============================================
  // PLAN CHANGE FLOW: Handle upgrade/downgrade from existing subscription
  // ============================================
  if (validPreviousSubId && validClientId) {
    logger.info('Plan change detected - updating existing subscription', {
      previousSubscriptionId: validPreviousSubId,
      newPlan: plan,
      clientId: validClientId,
    });

    const validatedPlan = isValidPlan(plan) ? plan : 'essentials';

    // Get the new Stripe subscription ID from the checkout session
    const stripeSubscriptionId = session.subscription as string;

    if (stripeSubscriptionId) {
      // Fetch the Stripe subscription to get current_period_end
      const stripe = getStripeClient();
      let currentPeriodEnd: string | null = null;

      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        // Try root level first, then items (some Stripe API versions put it in items)
        let periodEnd = (stripeSubscription as any).current_period_end;
        if (!periodEnd) {
          const items = (stripeSubscription as any).items?.data;
          periodEnd = items?.[0]?.current_period_end;
        }
        if (periodEnd) {
          currentPeriodEnd = new Date(periodEnd * 1000).toISOString();
          logger.debug('Got current_period_end from Stripe', { currentPeriodEnd });
        }
      } catch (err) {
        logger.warn('Could not fetch Stripe subscription for period_end', { stripeSubscriptionId });
      }

      // Update the existing subscription record with the new Stripe subscription
      // CRITICAL: When changing from trial to paid plan, we must also update:
      // - status: 'active' (no longer trialing)
      // - trial_status: 'converted' (trial was converted to paid)
      // This is required because the validate_trial_data trigger blocks
      // non-starter plans from having active trials
      //
      // IMPORTANT: We do NOT update max_branches here!
      // max_branches = contracted branches (what customer pays for)
      // branchLimit = plan's maximum capacity (what they CAN have if they pay)
      // If customer had 1 branch on Starter and upgrades to Essentials,
      // they still only have 1 contracted branch. To add more, they must
      // use /api/branches/add-extra and pay for each extra branch.
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          plan: validatedPlan,
          stripe_subscription_id: stripeSubscriptionId,
          status: 'active',
          // CRITICAL: End the trial when upgrading to a paid plan
          trial_status: 'converted',
          updated_at: new Date().toISOString(),
          // NOTE: max_branches is NOT updated - it represents contracted branches,
          // not the plan limit. User must pay to add more branches.
          // IMPORTANT: Update billing date
          current_period_end: currentPeriodEnd,
        })
        .eq('id', validPreviousSubId);

      if (updateError) {
        logger.error('Error updating subscription', { error: updateError.message });
        throw new Error(`Failed to update subscription: ${updateError.message}`);
      }

      logger.info('Subscription updated to plan', { plan: validatedPlan });

      // CRITICAL: Also update tenant.plan - this is what the dashboard reads
      // First, try to get tenant_id from metadata, then from client
      let tenantIdToUpdate = validTenantId;

      if (!tenantIdToUpdate && validClientId) {
        logger.debug('tenant_id not in metadata, fetching from client', { clientId: validClientId });
        const { data: clientData } = await supabase
          .from('clients')
          .select('tenant_id')
          .eq('id', validClientId)
          .single();

        if (clientData?.tenant_id) {
          tenantIdToUpdate = clientData.tenant_id;
          logger.debug('Found tenant_id from client', { tenantId: tenantIdToUpdate });
        }
      }

      if (tenantIdToUpdate) {
        const { error: tenantUpdateError } = await supabase
          .from('tenants')
          .update({
            plan: validatedPlan,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenantIdToUpdate);

        if (tenantUpdateError) {
          logger.error('Error updating tenant plan', { error: tenantUpdateError.message });
          // Don't throw - subscription is already updated
        } else {
          logger.info('Tenant plan updated', { plan: validatedPlan, tenantId: tenantIdToUpdate });
        }
      } else {
        logger.warn('Could not find tenant_id to update plan');
      }

      // Log the plan change
      await supabase.from('subscription_changes').insert({
        subscription_id: validPreviousSubId,
        tenant_id: tenantIdToUpdate || null,
        client_id: validClientId,
        change_type: 'plan_changed_via_checkout',
        new_value: { plan: validatedPlan, stripe_subscription_id: stripeSubscriptionId },
        metadata: {
          checkout_session_id: session.id,
        },
      });

      logger.info('Plan change completed successfully', { sessionId: session.id });
      return; // Exit early - no need to create new client/subscription
    }
  }

  // ============================================
  // FIX 1: Email obligatorio - BLOQUEAR si falta (Stripe reintentará)
  // ============================================
  if (!customerEmail) {
    logger.error('No customer email found in session', { sessionId: session.id });
    throw new Error('Customer email is required for checkout completion');
  }

  // ============================================
  // FIX 4: Validar plan obligatorio y válido
  // ============================================
  if (!plan) {
    logger.warn('No plan in metadata, defaulting to essentials', { sessionId: session.id });
  }

  const validatedPlan = isValidPlan(plan) ? plan : 'essentials';
  if (plan && !isValidPlan(plan)) {
    logger.warn('Invalid plan in metadata, using essentials', { invalidPlan: plan });
  }

  logger.debug('Checkout metadata', { plan: validatedPlan, branches, hasAddons: !!addons, hasProposalId: !!proposalId });

  // Find or create client (case-insensitive email match)
  let { data: existingClient } = await supabase
    .from('clients')
    .select('id, user_id')
    .ilike('contact_email', customerEmail)
    .maybeSingle();

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
        locations_count: branches ? parseInt(branches, 10) : 1,
        // Store metadata for subscription handler (race condition prevention)
        metadata: {
          plan: validatedPlan,
          customerName,
          branches: branches ? parseInt(branches, 10) : 1,
        },
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Error creating client', { error: error.message });
      throw new Error(`Failed to create client: ${error.message}`);
    }
    clientId = newClient?.id || null;
    logger.info('New client created', { clientId });
  } else {
    // Update existing client to active
    await supabase
      .from('clients')
      .update({
        status: 'active',
        locations_count: branches ? parseInt(branches, 10) : 1,
      })
      .eq('id', existingClient.id);
    logger.info('Existing client updated', { clientId: existingClient.id });
  }

  // Update proposal if exists (using validated UUID)
  if (validProposalId) {
    await supabase
      .from('proposals')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', validProposalId);
    logger.info('Proposal marked as accepted', { proposalId: validProposalId });
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
      logger.warn('Error creating onboarding data', { error: onboardingError.message, clientId });
    } else {
      logger.debug('Onboarding data created for client', { clientId });
    }
  }

  logger.info('Checkout processing complete', { clientId, plan: validatedPlan });

  // 📧 Send Welcome Email
  if (customerEmail && customerName) {
    const planPrice = getPlanPrice(plan || 'essentials');
    const dashboardUrl = `${process.env.NEXT_PUBLIC_URL || 'https://app.tistis.com'}/dashboard`;

    try {
      const emailResult = await emailService.sendWelcome(customerEmail, {
        customerName: customerName,
        planName: getPlanDisplayName(plan || 'essentials'),
        planPrice: planPrice,
        dashboardUrl: dashboardUrl,
        supportEmail: 'soporte@tistis.com',
      });

      if (emailResult.success) {
        logger.info('Welcome email sent successfully');
      } else {
        logger.error('Failed to send welcome email', { error: emailResult.error });
      }
    } catch (emailError) {
      logger.error('Error sending welcome email', {}, emailError as Error);
    }
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  logger.info('Subscription created', { subscriptionId: subscription.id });
  const stripe = getStripeClient();
  const supabase = getSupabaseClient();

  const { plan: metadataPlan, customerName, customerPhone, branches, addons, vertical, proposalId } = subscription.metadata || {};
  const customerId = subscription.customer as string;

  // SEC-FIX 3: Validate proposalId UUID format
  const validProposalIdSub = proposalId && isValidUUID(proposalId) ? proposalId : undefined;
  if (proposalId && !validProposalIdSub) {
    logger.warn('Invalid proposalId format in subscription metadata', { subscriptionId: subscription.id });
  }

  // ============================================
  // CRITICAL FIX: Detect plan from Stripe product name if not in metadata
  // This handles cases where metadata didn't propagate correctly
  // ============================================
  let detectedPlan = metadataPlan;

  if (!detectedPlan || !isValidPlan(detectedPlan)) {
    logger.debug('Plan not in metadata, detecting from product name');

    // Try to detect plan from the subscription items (product names)
    for (const item of subscription.items.data) {
      const price = item.price;
      let productName = '';

      // Get product name - it might be expanded or just an ID
      if (typeof price.product === 'object' && price.product !== null) {
        productName = (price.product as Stripe.Product).name || '';
      } else if (typeof price.product === 'string') {
        // Need to fetch the product
        try {
          const product = await stripe.products.retrieve(price.product);
          productName = product.name || '';
        } catch (e) {
          logger.warn('Could not fetch product', { productId: price.product });
        }
      }

      // Check product name for plan indicators
      const nameLower = productName.toLowerCase();
      if (nameLower.includes('growth')) {
        detectedPlan = 'growth';
        logger.debug('Detected plan from product name', { productName, plan: 'growth' });
        break;
      } else if (nameLower.includes('essentials')) {
        detectedPlan = 'essentials';
        logger.debug('Detected plan from product name', { productName, plan: 'essentials' });
        break;
      } else if (nameLower.includes('starter')) {
        detectedPlan = 'starter';
        logger.debug('Detected plan from product name', { productName, plan: 'starter' });
        break;
      }
    }
  }

  // Use detected plan or metadata plan
  const plan = detectedPlan;

  // Log without exposing PII
  logger.debug('Subscription metadata', { plan, metadataPlan, branches, hasAddons: !!addons, hasCustomerPhone: !!customerPhone });

  // ============================================
  // FIX: Detect PLAN CHANGE scenario
  // When a plan change happens via checkout, both checkout.session.completed
  // and customer.subscription.created fire. The checkout handler already
  // updates the existing subscription, so we need to skip creating a duplicate.
  // ============================================

  // Check if this subscription was created as part of a plan change
  // by looking for recent checkout sessions with previous_subscription_id
  try {
    const recentSessions = await stripe.checkout.sessions.list({
      subscription: subscription.id,
      limit: 1,
    });

    const checkoutSession = recentSessions.data[0];
    if (checkoutSession?.metadata?.previous_subscription_id) {
      logger.info('Plan change subscription - skipping (handled by checkout.session.completed)', {
        previousSubscriptionId: checkoutSession.metadata.previous_subscription_id,
        newSubscriptionId: subscription.id,
      });

      // The checkout.session.completed handler already:
      // 1. Updated the existing subscription with the new stripe_subscription_id
      // 2. Updated the tenant.plan
      // So we just need to exit here to prevent duplicate processing
      return;
    }
  } catch (sessionError) {
    // If we can't find the checkout session, continue with normal flow
    // This happens for subscriptions created directly (not via checkout)
    logger.debug('No checkout session found, proceeding with normal flow');
  }

  // Get customer email from Stripe (normalize to lowercase)
  const customer = await stripe.customers.retrieve(customerId);
  const rawCustomerEmail = (customer as Stripe.Customer).email;
  const customerEmail = rawCustomerEmail?.toLowerCase();

  // ============================================
  // FIX 1: Email obligatorio - BLOQUEAR si falta
  // ============================================
  if (!customerEmail) {
    logger.error('No customer email found for subscription', { subscriptionId: subscription.id });
    throw new Error('Customer email is required for subscription creation');
  }

  // ============================================
  // FIX 2: RACE CONDITION PREVENTION - Use UPSERT
  // This prevents duplicate client creation when checkout.session.completed
  // and customer.subscription.created webhooks arrive simultaneously
  // ============================================

  // First, try to get existing client
  let { data: existingClient } = await supabase
    .from('clients')
    .select('id, metadata')
    .ilike('contact_email', customerEmail)
    .maybeSingle();

  // ============================================
  // FIX 4: Validar plan - Multiple fallbacks
  // Priority: 1. Stripe product name (detected above)
  //          2. Subscription metadata
  //          3. Client metadata (set by checkout.session.completed)
  //          4. Default to essentials
  // ============================================
  let finalPlan = plan; // Already detected from product name or metadata

  if (!finalPlan || !isValidPlan(finalPlan)) {
    // Try to get plan from client.metadata (set by checkout handler)
    const clientMetadataPlan = existingClient?.metadata?.plan;
    if (clientMetadataPlan && isValidPlan(clientMetadataPlan)) {
      finalPlan = clientMetadataPlan;
      logger.debug('Got plan from client.metadata', { plan: finalPlan });
    }
  }

  const validatedPlan = isValidPlan(finalPlan) ? finalPlan : 'essentials';
  if (!finalPlan) {
    logger.warn('No plan found in any source, defaulting to essentials');
  } else if (!isValidPlan(finalPlan)) {
    logger.warn('Invalid plan, using essentials', { invalidPlan: finalPlan });
  }

  // ============================================
  // SPRINT 1 FIX: Use UPSERT to prevent race condition duplicates
  // If client exists: update metadata with new plan info
  // If client doesn't exist: create new client
  //
  // NOTE: Uses partial unique index idx_clients_email_unique_no_tenant
  // which only applies when tenant_id IS NULL (initial signup).
  // Email must be lowercase (enforced at application level).
  // ============================================
  let client: { id: string; metadata: Record<string, unknown> | null } | null = existingClient;

  if (!client) {
    logger.info('Client not found, using UPSERT to create atomically');

    // Use UPSERT with onConflict to handle race conditions
    // Note: This requires a UNIQUE constraint on contact_email (case-insensitive)
    const { data: upsertedClient, error: upsertError } = await supabase
      .from('clients')
      .upsert({
        contact_email: customerEmail,
        contact_name: customerName || (customer as Stripe.Customer).name || 'Cliente',
        business_name: customerName || (customer as Stripe.Customer).name || 'Negocio',
        status: 'active',
        locations_count: branches ? parseInt(branches, 10) : 1,
        stripe_customer_id: customerId, // Link Stripe customer
        metadata: {
          plan: validatedPlan,
          created_by: 'subscription_webhook',
          stripe_customer_id: customerId,
        },
      }, {
        onConflict: 'contact_email',
        ignoreDuplicates: false // Update if exists
      })
      .select('id, metadata')
      .single();

    if (upsertError) {
      // If UPSERT fails due to constraint, try to fetch existing client
      logger.warn('UPSERT failed, attempting to fetch existing client', { error: upsertError.message });

      const { data: retryClient } = await supabase
        .from('clients')
        .select('id, metadata')
        .ilike('contact_email', customerEmail)
        .single();

      if (retryClient) {
        client = retryClient;
        logger.info('Found existing client after UPSERT conflict', { clientId: client.id });
      } else {
        logger.error('Failed to create or find client', { error: upsertError.message });
        throw new Error(`Failed to create client: ${upsertError.message}`);
      }
    } else {
      client = upsertedClient;
      logger.info('Client created/updated via UPSERT', { clientId: client?.id });
    }
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

  // max_branches = sucursales CONTRATADAS (lo que el cliente paga)
  // current_branches = sucursales que se crearán (igual a branches inicialmente)
  // El plan_limit (límite máximo del plan) se calcula en el frontend
  const contractedBranches = branches ? parseInt(branches, 10) : 1;

  // ============================================
  // FIX: Check if subscription already exists (prevents duplicates)
  // ============================================
  const { data: existingSubscription } = await supabase
    .from('subscriptions')
    .select('id, client_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (existingSubscription) {
    logger.info('Subscription already exists, updating instead', { subscriptionId: subscription.id });

    // Update existing subscription
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status === 'active' ? 'active' : 'pending',
        current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    if (updateError) {
      logger.error('Error updating existing subscription', { error: updateError.message });
    } else {
      logger.info('Existing subscription updated, skipping duplicate creation');
    }

    // Exit early - tenant provisioning was already done
    return;
  }

  // Create new subscription record
  const { error } = await supabase.from('subscriptions').insert({
    client_id: client.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0]?.price?.id,
    plan: validatedPlan, // Use validated plan
    addons: parsedAddons,
    branches: contractedBranches,
    max_branches: contractedBranches, // Sucursales contratadas (puede aumentar con extras)
    current_branches: contractedBranches, // Sucursales que se crearán en provisioning
    monthly_amount: totalMonthlyAmount / 100,
    currency: 'MXN',
    status: subscription.status === 'active' ? 'active' : 'pending',
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  });

  if (error) {
    logger.error('Error creating subscription record', { error: error.message, clientId: client.id });
    throw new Error(`Failed to create subscription record: ${error.message}`);
  }

  logger.info('Subscription record created', {
    clientId: client.id,
    plan: validatedPlan,
    contractedBranches,
    monthlyAmount: totalMonthlyAmount / 100,
  });

  // Get the newly created subscription ID
  const { data: newSubscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  // ============================================
  // 🏗️ AUTO-PROVISION TENANT (NUEVO)
  // Crea automáticamente:
  // - Tenant para la micro-app
  // - Branch principal
  // - Usuario admin en auth.users
  // - Staff record
  // - User role para permisos
  // - Servicios y FAQs por defecto según vertical
  // ============================================
  logger.info('Starting tenant provisioning', { clientId: client.id, plan: validatedPlan });

  const provisionResult = await provisionTenant({
    client_id: client.id,
    customer_email: customerEmail,
    customer_name: customerName || 'Nuevo Cliente',
    customer_phone: customerPhone || undefined,
    // Currently active verticals: dental, restaurant (more will be added later)
    vertical: (vertical as 'dental' | 'restaurant') || 'dental',
    plan: validatedPlan, // Use validated plan
    branches_count: branches ? parseInt(branches, 10) : 1,
    subscription_id: newSubscription?.id,
  });

  if (provisionResult.success) {
    logger.info('Tenant provisioned successfully', {
      tenantId: provisionResult.tenant_id,
      tenantSlug: provisionResult.tenant_slug,
      branchId: provisionResult.branch_id,
      userId: provisionResult.user_id,
    });

    // ============================================
    // Update client with tenant_id for future reference
    // ============================================
    if (provisionResult.tenant_id) {
      await supabase
        .from('clients')
        .update({ tenant_id: provisionResult.tenant_id })
        .eq('id', client.id);
      logger.info('Client linked to tenant', { clientId: client.id, tenantId: provisionResult.tenant_id });

      // ============================================
      // 🎙️ SYNC VOICE LIMITS FOR NEW TENANT
      // Enable voice features if plan supports it
      // ============================================
      try {
        const voiceSyncResult = await voiceSyncService.handlePlanUpgrade(
          provisionResult.tenant_id,
          validatedPlan,
          customerId
        );

        if (voiceSyncResult.success) {
          logger.info('Voice limits synced for new tenant', {
            tenantId: provisionResult.tenant_id,
            voiceEnabled: voiceSyncResult.voiceEnabled,
            includedMinutes: voiceSyncResult.includedMinutes,
          });
        } else {
          logger.warn('Voice sync warning', { message: voiceSyncResult.message });
        }
      } catch (voiceError) {
        logger.warn('Non-critical: Voice sync failed', {}, voiceError as Error);
        // Don't throw - voice sync is non-critical
      }
    }

    // 📧 Enviar email con credenciales de acceso
    // NOTA: Solo se envía si se creó un usuario nuevo (temp_password exists)
    // Si el usuario ya tiene cuenta TIS TIS, no se envía email de credenciales
    if (provisionResult.temp_password) {
      try {
        const dashboardUrl = `${process.env.NEXT_PUBLIC_URL || 'https://app.tistis.com'}/dashboard`;

        await emailService.sendCredentials(customerEmail, {
          customerName: customerName || 'Nuevo Cliente',
          dashboardUrl: dashboardUrl,
          email: customerEmail,
          tempPassword: provisionResult.temp_password,
          tenantSlug: provisionResult.tenant_slug || '',
        });

        logger.info('Credentials email sent successfully');
      } catch (emailError) {
        logger.error('Error sending credentials email', {}, emailError as Error);
      }
    } else {
      // Usuario existente - puede usar su misma cuenta de TIS TIS
      logger.info('User already has TIS TIS account - no credentials email needed');
    }
  } else {
    // ============================================
    // FIX 5: BLOQUEAR si provisioning falla
    // Esto hará que Stripe reintente el webhook
    // ============================================
    logger.error('Tenant provisioning FAILED', {
      error: provisionResult.error,
      details: provisionResult.details,
      clientId: client.id,
    });

    // Notificar al equipo de TIS TIS sobre el fallo
    await supabase.from('notification_queue').insert({
      notification_type: 'system_alert',
      priority: 'urgent',
      recipient_type: 'internal_team',
      recipient_emails: ['soporte@tistis.com'],
      subject: `⚠️ Error en provisioning de tenant`,
      body: `Error al provisionar tenant para cliente ${customerEmail}.\nError: ${provisionResult.error}`,
      metadata: {
        client_id: client.id,
        error: provisionResult.error,
        details: provisionResult.details,
      },
      client_id: client.id,
    });

    // ============================================
    // FIX 5: THROW to make Stripe retry the webhook
    // ============================================
    throw new Error(`Tenant provisioning failed: ${provisionResult.error}`);
  }

  // 🚀 TRIGGER ASSEMBLY ENGINE - Auto-provision micro-app
  // El Assembly Engine configura los componentes y features según el plan
  await triggerAssemblyEngine({
    client_id: client.id,
    subscription_id: newSubscription?.id,
    tenant_id: provisionResult.tenant_id, // Ahora incluimos el tenant_id
    vertical: vertical || 'services',
    plan: validatedPlan, // Use validated plan
    addons: parsedAddons,
    branches: branches ? parseInt(branches, 10) : 1,
    proposal_id: validProposalIdSub // Use validated UUID
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  logger.info('Subscription updated', { subscriptionId: subscription.id, status: subscription.status });
  const stripe = getStripeClient();
  const supabase = getSupabaseClient();

  // ============================================
  // CRITICAL: Fetch fresh subscription from Stripe to ensure accurate data
  // The webhook payload may not include all fields (especially period dates)
  // ============================================
  let periodStart = (subscription as any).current_period_start;
  let periodEnd = (subscription as any).current_period_end;

  // If period dates are missing, fetch fresh from Stripe
  if (!periodStart || !periodEnd) {
    try {
      logger.debug('Fetching fresh data from Stripe');
      const freshSubscription = await stripe.subscriptions.retrieve(subscription.id);
      periodStart = (freshSubscription as any).current_period_start || periodStart;
      periodEnd = (freshSubscription as any).current_period_end || periodEnd;
      logger.debug('Got fresh period dates', {
        periodStart: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      });
    } catch (err) {
      logger.warn('Could not fetch fresh data from Stripe', { subscriptionId: subscription.id });
    }
  }

  const status = subscription.status === 'active' ? 'active' :
                 subscription.status === 'past_due' ? 'past_due' :
                 subscription.status === 'canceled' ? 'cancelled' : 'pending';

  // Get branches count from metadata (set by update-subscription endpoint)
  const metadataBranches = subscription.metadata?.branches;
  const branchesCount = metadataBranches ? parseInt(metadataBranches, 10) : undefined;

  // Get plan from metadata if changed
  const metadataPlan = subscription.metadata?.plan;

  // ============================================
  // CRITICAL FIX: Detect plan from Stripe product name if not in metadata
  // This handles cases where metadata didn't propagate correctly
  // ============================================
  let detectedPlan = metadataPlan;

  if (!detectedPlan || !isValidPlan(detectedPlan)) {
    logger.debug('Plan not in metadata, detecting from product name');

    // Try to detect plan from the subscription items (product names)
    for (const item of subscription.items.data) {
      const price = item.price;
      let productName = '';

      // Get product name - it might be expanded or just an ID
      if (typeof price.product === 'object' && price.product !== null) {
        productName = (price.product as Stripe.Product).name || '';
      } else if (typeof price.product === 'string') {
        // Need to fetch the product
        try {
          const product = await stripe.products.retrieve(price.product);
          productName = product.name || '';
        } catch (e) {
          logger.warn('Could not fetch product', { productId: price.product });
        }
      }

      // Check product name for plan indicators (skip branch add-ons)
      const nameLower = productName.toLowerCase();
      if (nameLower.includes('sucursal') || nameLower.includes('branch')) {
        continue; // Skip branch items, look for plan items
      }

      if (nameLower.includes('growth')) {
        detectedPlan = 'growth';
        logger.debug('Detected plan from product name', { productName, plan: 'growth' });
        break;
      } else if (nameLower.includes('essentials')) {
        detectedPlan = 'essentials';
        logger.debug('Detected plan from product name', { productName, plan: 'essentials' });
        break;
      } else if (nameLower.includes('starter')) {
        detectedPlan = 'starter';
        logger.debug('Detected plan from product name', { productName, plan: 'starter' });
        break;
      }
    }
  }

  // Calculate total monthly amount from all line items
  let totalMonthlyAmount = 0;
  for (const item of subscription.items.data) {
    const unitAmount = item.price?.unit_amount || 0;
    const quantity = item.quantity || 1;
    totalMonthlyAmount += unitAmount * quantity;
  }

  // Build update object
  const updateData: Record<string, unknown> = {
    status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  // Update branches count if changed
  if (branchesCount !== undefined) {
    updateData.max_branches = branchesCount;
    updateData.branches = branchesCount;
    logger.debug('Branches count updated', { branchesCount });
  }

  // Update plan if detected or in metadata
  if (detectedPlan && isValidPlan(detectedPlan)) {
    updateData.plan = detectedPlan;
    logger.debug('Plan updated', { plan: detectedPlan });
  }

  // Update monthly amount if changed
  if (totalMonthlyAmount > 0) {
    updateData.monthly_amount = totalMonthlyAmount / 100;
    logger.debug('Monthly amount updated', { monthlyAmount: totalMonthlyAmount / 100 });
  }

  const { error } = await supabase
    .from('subscriptions')
    .update(updateData)
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    logger.error('Error updating subscription', { error: error.message, subscriptionId: subscription.id });
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  logger.info('Subscription record updated', {
    status,
    subscriptionId: subscription.id,
    periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  });

  // ============================================
  // Also update tenant plan if plan changed (use detected plan, not just metadata)
  // ============================================
  if (detectedPlan && isValidPlan(detectedPlan)) {
    // Get tenant_id from the subscription's client
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('client_id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (subData?.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('tenant_id')
        .eq('id', subData.client_id)
        .single();

      if (clientData?.tenant_id) {
        await supabase
          .from('tenants')
          .update({ plan: detectedPlan, updated_at: new Date().toISOString() })
          .eq('id', clientData.tenant_id);
        logger.info('Tenant plan updated', { plan: detectedPlan, tenantId: clientData.tenant_id });

        // ============================================
        // 🎙️ SYNC VOICE LIMITS ON PLAN CHANGE
        // Enables/disables voice based on new plan
        // ============================================
        try {
          const customerId = subscription.customer as string;
          const voiceSyncResult = await voiceSyncService.syncVoiceLimits({
            tenantId: clientData.tenant_id,
            plan: detectedPlan,
            stripeCustomerId: customerId,
          });

          if (voiceSyncResult.success) {
            logger.info('Voice limits synced on plan change', {
              tenantId: clientData.tenant_id,
              voiceEnabled: voiceSyncResult.voiceEnabled,
              includedMinutes: voiceSyncResult.includedMinutes,
            });
          } else {
            logger.warn('Voice sync warning', { message: voiceSyncResult.message });
          }
        } catch (voiceError) {
          logger.warn('Non-critical: Voice sync failed on plan change', {}, voiceError as Error);
          // Don't throw - voice sync is non-critical
        }
      }
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  logger.info('Subscription deleted', { subscriptionId: subscription.id });
  const stripe = getStripeClient();
  const supabase = getSupabaseClient();

  // Get subscription details before updating
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, client_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  // 📧 Send Cancellation Email
  const customerId = subscription.customer as string;
  const customer = await stripe.customers.retrieve(customerId);
  // Normalize email to lowercase for consistent comparison
  const rawEmail = (customer as Stripe.Customer).email;
  const customerEmail = rawEmail?.toLowerCase();
  const customerName = (customer as Stripe.Customer).name || 'Cliente';

  if (customerEmail) {
    // Calculate end date (current period end)
    const periodEnd = (subscription as any).current_period_end;
    const endDate = periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : new Date().toISOString();

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://app.tistis.com';

    try {
      const emailResult = await emailService.sendSubscriptionCancelled(customerEmail, {
        customerName: customerName,
        planName: getPlanDisplayName(sub?.plan || 'essentials'),
        endDate: endDate,
        reactivateUrl: `${baseUrl}/reactivate?customer=${customerId}`,
        feedbackUrl: `${baseUrl}/feedback?customer=${customerId}`,
      });

      if (emailResult.success) {
        logger.info('Cancellation email sent successfully');
      } else {
        logger.error('Failed to send cancellation email', { error: emailResult.error });
      }
    } catch (emailError) {
      logger.error('Error sending cancellation email', {}, emailError as Error);
    }
  }
}

// ============================================
// ASSEMBLY ENGINE TRIGGER
// Automatically provisions micro-app for new clients
// ============================================

interface AssemblyTriggerParams {
  client_id: string;
  subscription_id?: string;
  tenant_id?: string; // ID del tenant recién creado
  vertical: string;
  plan: 'starter' | 'essentials' | 'growth';
  addons: string[];
  branches: number;
  proposal_id?: string;
}

async function triggerAssemblyEngine(params: AssemblyTriggerParams): Promise<void> {
  logger.info('Starting micro-app provisioning', {
    clientId: params.client_id,
    plan: params.plan,
    vertical: params.vertical,
    branches: params.branches,
  });

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
        tenant_id: params.tenant_id,
        vertical: params.vertical,
        plan: params.plan,
        addons: params.addons,
        branches: params.branches,
        proposal_id: params.proposal_id
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Assembly Engine failed', {
        status: response.status,
        clientId: params.client_id,
        error: errorData,
      });

      // Notify team of assembly failure
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

      // CRITICAL: Throw error to trigger Stripe webhook retry
      // This ensures micro-app gets provisioned even if first attempt fails
      throw new Error(`Assembly Engine failed with status ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    logger.info('Assembly Engine succeeded', {
      deploymentId: result.data?.deployment_id,
      componentsCount: result.data?.components_count,
      estimatedMinutes: result.data?.estimated_duration_minutes,
    });

    // Note: Deployment is now handled entirely by Assembly Engine
    // No external workflow trigger needed

  } catch (error) {
    logger.error('Critical error in Assembly Engine trigger', {
      clientId: params.client_id,
      subscriptionId: params.subscription_id,
    }, error as Error);

    // CRITICAL: Re-throw error to make webhook handler fail
    // This ensures Stripe retries the webhook for micro-app provisioning
    throw error;
  }
}

// ============================================
// INVOICE PAYMENT HANDLERS
// ============================================

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  logger.info('Payment succeeded for invoice', { invoiceId: invoice.id });
  const stripe = getStripeClient();
  const supabase = getSupabaseClient();

  // Skip if no customer
  if (!invoice.customer) {
    logger.debug('No customer on invoice, skipping');
    return;
  }

  // Get customer email (normalize to lowercase)
  const customer = await stripe.customers.retrieve(invoice.customer as string);
  const rawEmail = (customer as Stripe.Customer).email;
  const customerEmail = rawEmail?.toLowerCase();
  const customerName = (customer as Stripe.Customer).name || 'Cliente';

  if (!customerEmail) {
    logger.warn('No customer email found for invoice', { invoiceId: invoice.id });
    return;
  }

  // Get subscription details if exists
  let planName = 'Suscripción';
  const subscriptionId = (invoice as any).subscription;
  let nextBillingDate: string | undefined;

  // ============================================
  // CRITICAL FIX: Update subscription billing dates on payment success
  // This ensures current_period_end is always in sync with Stripe
  // ============================================
  if (subscriptionId) {
    try {
      // Fetch fresh subscription data from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId as string);
      const periodStart = (stripeSubscription as any).current_period_start;
      const periodEnd = (stripeSubscription as any).current_period_end;

      logger.debug('Syncing billing dates from Stripe subscription', {
        subscriptionId,
        periodStart: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      });

      // Update subscription in database with fresh dates
      const { data: sub, error: updateError } = await supabase
        .from('subscriptions')
        .update({
          current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          status: 'active', // Payment succeeded means subscription is active
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscriptionId as string)
        .select('plan')
        .single();

      if (updateError) {
        logger.error('Error updating subscription dates', { error: updateError.message });
      } else {
        logger.info('Subscription billing dates synced successfully');
        if (sub?.plan) {
          planName = getPlanDisplayName(sub.plan);
        }
      }

      // Set next billing date from the period end
      if (periodEnd) {
        nextBillingDate = new Date(periodEnd * 1000).toISOString();
      }

      // ============================================
      // 🎙️ RESET VOICE USAGE FOR NEW BILLING PERIOD
      // This ensures minutes reset at the start of each period
      // ============================================
      if (periodStart && periodEnd && sub?.plan === 'growth') {
        try {
          // Get tenant_id from subscription -> client
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('client_id')
            .eq('stripe_subscription_id', subscriptionId as string)
            .single();

          if (subData?.client_id) {
            const { data: clientData } = await supabase
              .from('clients')
              .select('tenant_id')
              .eq('id', subData.client_id)
              .single();

            if (clientData?.tenant_id) {
              const resetResult = await voiceSyncService.resetUsageForNewPeriod({
                tenantId: clientData.tenant_id,
                billingPeriodStart: new Date(periodStart * 1000).toISOString(),
                billingPeriodEnd: new Date(periodEnd * 1000).toISOString(),
              });

              if (resetResult.success) {
                logger.info('Voice usage reset for new billing period', {
                  tenantId: clientData.tenant_id,
                  previousMinutes: resetResult.previousPeriodMinutes,
                  newPeriodId: resetResult.newPeriodId,
                });
              } else {
                logger.warn('Voice usage reset warning', { message: resetResult.message });
              }
            }
          }
        } catch (voiceError) {
          logger.warn('Non-critical: Voice usage reset failed', {}, voiceError as Error);
          // Don't throw - voice reset is non-critical
        }
      }
    } catch (err) {
      logger.warn('Error fetching Stripe subscription', { subscriptionId });

      // Fallback: try to get plan from database without updating dates
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('stripe_subscription_id', subscriptionId as string)
        .single();

      if (sub?.plan) {
        planName = getPlanDisplayName(sub.plan);
      }
    }
  }

  // Fallback for next billing date from invoice
  if (!nextBillingDate) {
    const nextPaymentAttempt = (invoice as any).next_payment_attempt;
    nextBillingDate = nextPaymentAttempt
      ? new Date(nextPaymentAttempt * 1000).toISOString()
      : undefined;
  }

  // 📧 Send Payment Confirmed Email
  try {
    const dashboardUrl = `${process.env.NEXT_PUBLIC_URL || 'https://app.tistis.com'}/dashboard`;

    const emailResult = await emailService.sendPaymentConfirmed(customerEmail, {
      customerName: customerName,
      planName: planName,
      amount: (invoice.amount_paid || 0) / 100,
      currency: (invoice.currency || 'MXN').toUpperCase(),
      invoiceNumber: invoice.number || undefined,
      nextBillingDate: nextBillingDate,
      dashboardUrl: dashboardUrl,
    });

    if (emailResult.success) {
      logger.info('Payment confirmed email sent successfully');
    } else {
      logger.error('Failed to send payment email', { error: emailResult.error });
    }
  } catch (emailError) {
    logger.error('Error sending payment email', {}, emailError as Error);
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  logger.warn('Payment failed for invoice', { invoiceId: invoice.id });
  const stripe = getStripeClient();
  const supabase = getSupabaseClient();

  // Skip if no customer
  if (!invoice.customer) {
    logger.debug('No customer on invoice, skipping');
    return;
  }

  // Get customer email (normalize to lowercase)
  const customer = await stripe.customers.retrieve(invoice.customer as string);
  const rawEmail = (customer as Stripe.Customer).email;
  const customerEmail = rawEmail?.toLowerCase();
  const customerName = (customer as Stripe.Customer).name || 'Cliente';

  if (!customerEmail) {
    logger.warn('No customer email found for failed invoice', { invoiceId: invoice.id });
    return;
  }

  // Get subscription details if exists
  let planName = 'Suscripción';
  const failedSubscriptionId = (invoice as any).subscription;
  if (failedSubscriptionId) {
    // ============================================
    // CRITICAL FIX: Update subscription status to past_due on payment failure
    // This prevents free access while payment is failing
    // ============================================
    const { data: sub, error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', failedSubscriptionId as string)
      .select('plan, client_id')
      .single();

    if (updateError) {
      logger.error('Error updating subscription status to past_due', { error: updateError.message });
    } else {
      logger.warn('Subscription marked as past_due', { subscriptionId: failedSubscriptionId });
    }

    if (sub?.plan) {
      planName = getPlanDisplayName(sub.plan);
    }

    // Also update tenant status if we have client_id
    if (sub?.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('tenant_id')
        .eq('id', sub.client_id)
        .single();

      if (clientData?.tenant_id) {
        await supabase
          .from('tenants')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('id', clientData.tenant_id);
        logger.warn('Tenant marked as past_due', { tenantId: clientData.tenant_id });
      }
    }
  }

  // Get failure reason from charge
  let failureReason: string | undefined;
  const chargeId = (invoice as any).charge;
  if (chargeId) {
    const charge = await stripe.charges.retrieve(chargeId as string);
    failureReason = charge.failure_code || undefined;
  }

  // Calculate retry date
  const failedNextPaymentAttempt = (invoice as any).next_payment_attempt;
  const retryDate = failedNextPaymentAttempt
    ? new Date(failedNextPaymentAttempt * 1000).toISOString()
    : undefined;

  // 📧 Send Payment Failed Email
  try {
    const updatePaymentUrl = `${process.env.NEXT_PUBLIC_URL || 'https://app.tistis.com'}/dashboard/settings/billing`;

    const emailResult = await emailService.sendPaymentFailed(customerEmail, {
      customerName: customerName,
      planName: planName,
      amount: (invoice.amount_due || 0) / 100,
      currency: (invoice.currency || 'MXN').toUpperCase(),
      failureReason: failureReason,
      retryDate: retryDate,
      updatePaymentUrl: updatePaymentUrl,
      supportUrl: 'mailto:facturacion@tistis.com',
    });

    if (emailResult.success) {
      logger.info('Payment failed notification email sent');
    } else {
      logger.error('Failed to send payment failed email', { error: emailResult.error });
    }
  } catch (emailError) {
    logger.error('Error sending payment failed email', {}, emailError as Error);
  }

  // Also notify internal team
  await supabase.from('notification_queue').insert({
    type: 'payment_failed',
    recipient_type: 'internal',
    recipient_id: 'team',
    payload: {
      customer_email: customerEmail,
      customer_name: customerName,
      plan: planName,
      amount: (invoice.amount_due || 0) / 100,
      failure_reason: failureReason,
    },
    priority: 'high'
  });
}

// ============================================
// VOICE OVERAGE PAYMENT HANDLER
// ============================================

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  logger.info('Invoice paid - checking for voice overage items', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
  });

  // Check if this invoice contains voice overage items
  const hasVoiceOverage = invoice.lines?.data.some(
    (line) => line.metadata?.type === 'voice_overage'
  );

  if (!hasVoiceOverage) {
    logger.debug('No voice overage items in invoice', { invoiceId: invoice.id });
    return;
  }

  // Process payment confirmation for voice overage
  try {
    const { voiceBillingService } = await import('@/src/features/voice-agent/services/voice-billing.service');
    await voiceBillingService.handlePaymentConfirmation(invoice.id);
    logger.info('Voice overage payment processed', { invoiceId: invoice.id });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to process voice overage payment', {
      invoiceId: invoice.id,
      error: errorMessage,
    });
    // Don't throw - this is non-critical and shouldn't fail the webhook
  }
}

// ============================================
// HELPER FUNCTIONS (using centralized config)
// ============================================

function getPlanDisplayName(plan: string): string {
  const config = getPlanConfig(plan);
  return config?.name || plan;
}

function getPlanPrice(plan: string): number {
  const config = getPlanConfig(plan);
  return config?.monthlyPricePesos || 4999;
}

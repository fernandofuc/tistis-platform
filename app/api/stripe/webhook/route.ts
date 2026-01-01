export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { emailService } from '@/src/lib/email';
import { provisionTenant } from '@/lib/provisioning';
import { getPlanConfig, PLAN_CONFIG } from '@/src/shared/config/plans';

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
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  // ============================================
  // FIX 3: STRIPE_WEBHOOK_SECRET obligatorio en producción
  // ============================================
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (isProduction && !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('🚨 CRITICAL: STRIPE_WEBHOOK_SECRET is required in production!');
    return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
  }

  try {
    // Verify webhook signature if secret is configured
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      // For LOCAL testing only - NOT production
      console.warn('⚠️ [Webhook] Running without signature verification (development only)');
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ============================================
  // FIX 6: Idempotency check - Skip only SUCCESSFULLY processed events
  // CRITICAL: Allow retry of FAILED events so provisioning can complete
  // ============================================
  if (await isEventProcessedSuccessfully(event.id)) {
    console.log(`⏭️ [Webhook] Event already processed successfully, skipping: ${event.id}`);
    return NextResponse.json({ received: true, skipped: true });
  }

  // Track retry attempts for previously failed events
  const retryCount = await incrementRetryCount(event.id);
  if (retryCount > 1) {
    console.log(`🔄 [Webhook] Retry attempt ${retryCount} for event: ${event.id}`);
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
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // ✅ Mark event as processed successfully
    await markEventProcessed(event.id, event.type, 'success');
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);

    // ❌ Mark event as failed (will be retried by Stripe)
    await markEventProcessed(event.id, event.type, 'failed', error.message);

    // Return 500 so Stripe retries the webhook
    return NextResponse.json(
      { error: error.message || 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('✅ Checkout completed:', session.id);
  const supabase = getSupabaseClient();

  const { plan, customerName, proposalId, branches, addons, client_id, tenant_id, previous_subscription_id } = session.metadata || {};
  // Normalize email to lowercase for consistent storage and comparison
  const rawEmail = session.customer_email || session.customer_details?.email;
  const customerEmail = rawEmail?.toLowerCase();

  // ============================================
  // PLAN CHANGE FLOW: Handle upgrade/downgrade from existing subscription
  // ============================================
  if (previous_subscription_id && client_id) {
    console.log('🔄 [Checkout] Plan change detected - updating existing subscription');
    console.log('   Previous subscription ID:', previous_subscription_id);
    console.log('   New plan:', plan);
    console.log('   Client ID:', client_id);

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
          console.log('✅ [Checkout] Got current_period_end from Stripe:', currentPeriodEnd);
        }
      } catch (err) {
        console.error('⚠️ [Checkout] Could not fetch Stripe subscription for period_end:', err);
      }

      // Update the existing subscription record with the new Stripe subscription
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          plan: validatedPlan,
          stripe_subscription_id: stripeSubscriptionId,
          status: 'active',
          updated_at: new Date().toISOString(),
          // Update max_branches based on new plan
          max_branches: getPlanConfig(validatedPlan)?.branchLimit || 5,
          // IMPORTANT: Update billing date
          current_period_end: currentPeriodEnd,
        })
        .eq('id', previous_subscription_id);

      if (updateError) {
        console.error('🚨 [Checkout] Error updating subscription:', updateError);
        throw new Error(`Failed to update subscription: ${updateError.message}`);
      }

      console.log('✅ [Checkout] Subscription updated to plan:', validatedPlan);

      // CRITICAL: Also update tenant.plan - this is what the dashboard reads
      // First, try to get tenant_id from metadata, then from client
      let tenantIdToUpdate = tenant_id;

      if (!tenantIdToUpdate && client_id) {
        console.log('🔍 [Checkout] tenant_id not in metadata, fetching from client:', client_id);
        const { data: clientData } = await supabase
          .from('clients')
          .select('tenant_id')
          .eq('id', client_id)
          .single();

        if (clientData?.tenant_id) {
          tenantIdToUpdate = clientData.tenant_id;
          console.log('✅ [Checkout] Found tenant_id from client:', tenantIdToUpdate);
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
          console.error('🚨 [Checkout] Error updating tenant plan:', tenantUpdateError);
          // Don't throw - subscription is already updated
        } else {
          console.log('✅ [Checkout] Tenant plan updated to:', validatedPlan);
        }
      } else {
        console.warn('⚠️ [Checkout] Could not find tenant_id to update plan');
      }

      // Log the plan change
      await supabase.from('subscription_changes').insert({
        subscription_id: previous_subscription_id,
        tenant_id: tenantIdToUpdate || null,
        client_id: client_id,
        change_type: 'plan_changed_via_checkout',
        new_value: { plan: validatedPlan, stripe_subscription_id: stripeSubscriptionId },
        metadata: {
          checkout_session_id: session.id,
        },
      });

      console.log('✅ [Checkout] Plan change completed successfully');
      return; // Exit early - no need to create new client/subscription
    }
  }

  // ============================================
  // FIX 1: Email obligatorio - BLOQUEAR si falta (Stripe reintentará)
  // ============================================
  if (!customerEmail) {
    console.error('🚨 [Checkout] CRITICAL: No customer email found in session:', session.id);
    throw new Error('Customer email is required for checkout completion');
  }

  // ============================================
  // FIX 4: Validar plan obligatorio y válido
  // ============================================
  if (!plan) {
    console.error('🚨 [Checkout] WARNING: No plan in metadata, defaulting to essentials');
  }

  const validatedPlan = isValidPlan(plan) ? plan : 'essentials';
  if (plan && !isValidPlan(plan)) {
    console.warn(`⚠️ [Checkout] Invalid plan "${plan}", using "essentials"`);
  }

  console.log('📋 Checkout metadata:', { plan: validatedPlan, customerName, branches, addons, proposalId });

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
        locations_count: branches ? parseInt(branches) : 1,
        // Store metadata for subscription handler (race condition prevention)
        metadata: {
          plan: validatedPlan,
          customerName,
          branches: branches ? parseInt(branches) : 1,
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('🚨 [Checkout] Error creating client:', error);
      throw new Error(`Failed to create client: ${error.message}`);
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
        console.log('📧 Welcome email sent successfully');
      } else {
        console.error('📧 Failed to send welcome email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('📧 Error sending welcome email:', emailError);
    }
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('🆕 Subscription created:', subscription.id);
  const stripe = getStripeClient();
  const supabase = getSupabaseClient();

  const { plan, customerName, customerPhone, branches, addons, vertical, proposalId } = subscription.metadata || {};
  const customerId = subscription.customer as string;

  // Log without exposing PII
  console.log('📋 Subscription metadata:', { plan, branches, addons, hasCustomerPhone: !!customerPhone });

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
      console.log('⏭️ [Subscription] This is a plan change subscription - skipping (handled by checkout.session.completed)');
      console.log('   Previous subscription ID:', checkoutSession.metadata.previous_subscription_id);
      console.log('   New Stripe subscription ID:', subscription.id);

      // The checkout.session.completed handler already:
      // 1. Updated the existing subscription with the new stripe_subscription_id
      // 2. Updated the tenant.plan
      // So we just need to exit here to prevent duplicate processing
      return;
    }
  } catch (sessionError) {
    // If we can't find the checkout session, continue with normal flow
    // This happens for subscriptions created directly (not via checkout)
    console.log('📋 [Subscription] No checkout session found, proceeding with normal flow');
  }

  // Get customer email from Stripe (normalize to lowercase)
  const customer = await stripe.customers.retrieve(customerId);
  const rawCustomerEmail = (customer as Stripe.Customer).email;
  const customerEmail = rawCustomerEmail?.toLowerCase();

  // ============================================
  // FIX 1: Email obligatorio - BLOQUEAR si falta
  // ============================================
  if (!customerEmail) {
    console.error('🚨 [Subscription] CRITICAL: No customer email found for subscription:', subscription.id);
    throw new Error('Customer email is required for subscription creation');
  }

  // ============================================
  // FIX 4: Validar plan obligatorio y válido
  // ============================================
  const validatedPlan = isValidPlan(plan) ? plan : 'essentials';
  if (!plan) {
    console.warn('⚠️ [Subscription] No plan in metadata, defaulting to essentials');
  } else if (!isValidPlan(plan)) {
    console.warn(`⚠️ [Subscription] Invalid plan "${plan}", using "essentials"`);
  }

  // ============================================
  // FIX 2: Crear cliente si no existe (race condition prevention)
  // ============================================
  let { data: client } = await supabase
    .from('clients')
    .select('id, metadata')
    .ilike('contact_email', customerEmail)
    .maybeSingle();

  if (!client) {
    console.warn('⚠️ [Subscription] Client not found, creating now (race condition fallback)');

    // Create client if checkout.session.completed hasn't created it yet
    const { data: newClient, error: createClientError } = await supabase
      .from('clients')
      .insert({
        contact_email: customerEmail,
        contact_name: customerName || (customer as Stripe.Customer).name || 'Cliente',
        business_name: customerName || (customer as Stripe.Customer).name || 'Negocio',
        status: 'active',
        locations_count: branches ? parseInt(branches) : 1,
        metadata: {
          plan: validatedPlan,
          created_by: 'subscription_webhook_fallback',
        },
      })
      .select('id, metadata')
      .single();

    if (createClientError || !newClient) {
      console.error('🚨 [Subscription] Failed to create client:', createClientError);
      throw new Error(`Failed to create client: ${createClientError?.message || 'Unknown error'}`);
    }

    client = newClient;
    console.log('✅ [Subscription] Client created via fallback:', client.id);
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
  const contractedBranches = branches ? parseInt(branches) : 1;

  // ============================================
  // FIX: Check if subscription already exists (prevents duplicates)
  // ============================================
  const { data: existingSubscription } = await supabase
    .from('subscriptions')
    .select('id, client_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (existingSubscription) {
    console.log('⏭️ [Subscription] Subscription already exists, updating instead:', subscription.id);

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
      console.error('🚨 [Subscription] Error updating existing subscription:', updateError);
    } else {
      console.log('✅ [Subscription] Existing subscription updated, skipping duplicate creation');
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
    console.error('🚨 [Subscription] Error creating subscription record:', error);
    throw new Error(`Failed to create subscription record: ${error.message}`);
  }

  console.log('✅ Subscription record created for client:', client.id);
  console.log('   Plan:', validatedPlan, '| Contracted Branches:', contractedBranches, '| Amount:', totalMonthlyAmount / 100, 'MXN');

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
  console.log('🏗️ [Webhook] Starting tenant provisioning...');

  const provisionResult = await provisionTenant({
    client_id: client.id,
    customer_email: customerEmail,
    customer_name: customerName || 'Nuevo Cliente',
    customer_phone: customerPhone || undefined,
    // Currently active verticals: dental, restaurant (more will be added later)
    vertical: (vertical as 'dental' | 'restaurant') || 'dental',
    plan: validatedPlan, // Use validated plan
    branches_count: branches ? parseInt(branches) : 1,
    subscription_id: newSubscription?.id,
  });

  if (provisionResult.success) {
    console.log('✅ [Webhook] Tenant provisioned successfully:', {
      tenant_id: provisionResult.tenant_id,
      tenant_slug: provisionResult.tenant_slug,
      branch_id: provisionResult.branch_id,
      user_id: provisionResult.user_id,
    });

    // ============================================
    // Update client with tenant_id for future reference
    // ============================================
    if (provisionResult.tenant_id) {
      await supabase
        .from('clients')
        .update({ tenant_id: provisionResult.tenant_id })
        .eq('id', client.id);
      console.log('✅ [Webhook] Client linked to tenant:', provisionResult.tenant_id);
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

        console.log('📧 [Webhook] Credentials email sent successfully');
      } catch (emailError) {
        console.error('📧 [Webhook] Error sending credentials email:', emailError);
      }
    } else {
      // Usuario existente - puede usar su misma cuenta de TIS TIS
      console.log('✅ [Webhook] User already has TIS TIS account - no credentials email needed');
    }
  } else {
    // ============================================
    // FIX 5: BLOQUEAR si provisioning falla
    // Esto hará que Stripe reintente el webhook
    // ============================================
    console.error('🚨 [Webhook] Tenant provisioning FAILED:', provisionResult.error);

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
    branches: branches ? parseInt(branches) : 1,
    proposal_id: proposalId
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('🔄 Subscription updated:', subscription.id);
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
      console.log('📅 [SubscriptionUpdated] Fetching fresh data from Stripe...');
      const freshSubscription = await stripe.subscriptions.retrieve(subscription.id);
      periodStart = (freshSubscription as any).current_period_start || periodStart;
      periodEnd = (freshSubscription as any).current_period_end || periodEnd;
      console.log('✅ [SubscriptionUpdated] Got fresh period dates:', {
        periodStart: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      });
    } catch (err) {
      console.error('⚠️ [SubscriptionUpdated] Could not fetch fresh data from Stripe:', err);
    }
  }

  const status = subscription.status === 'active' ? 'active' :
                 subscription.status === 'past_due' ? 'past_due' :
                 subscription.status === 'canceled' ? 'cancelled' : 'pending';

  // Get branches count from metadata (set by update-subscription endpoint)
  const metadataBranches = subscription.metadata?.branches;
  const branchesCount = metadataBranches ? parseInt(metadataBranches) : undefined;

  // Get plan from metadata if changed
  const metadataPlan = subscription.metadata?.plan;

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
    console.log(`📊 Branches count updated to: ${branchesCount}`);
  }

  // Update plan if changed
  if (metadataPlan && isValidPlan(metadataPlan)) {
    updateData.plan = metadataPlan;
    console.log(`📋 Plan updated to: ${metadataPlan}`);
  }

  // Update monthly amount if changed
  if (totalMonthlyAmount > 0) {
    updateData.monthly_amount = totalMonthlyAmount / 100;
    console.log(`💰 Monthly amount updated to: ${totalMonthlyAmount / 100} MXN`);
  }

  const { error } = await supabase
    .from('subscriptions')
    .update(updateData)
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('🚨 [SubscriptionUpdated] Error updating subscription:', error);
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  console.log('✅ Subscription record updated:', {
    status,
    periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  });

  // ============================================
  // Also update tenant plan if plan changed
  // ============================================
  if (metadataPlan && isValidPlan(metadataPlan)) {
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
          .update({ plan: metadataPlan, updated_at: new Date().toISOString() })
          .eq('id', clientData.tenant_id);
        console.log('✅ [SubscriptionUpdated] Tenant plan updated to:', metadataPlan);
      }
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('❌ Subscription deleted:', subscription.id);
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
  const customerEmail = (customer as Stripe.Customer).email;
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
        console.log('📧 Cancellation email sent successfully');
      } else {
        console.error('📧 Failed to send cancellation email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('📧 Error sending cancellation email:', emailError);
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

    // Note: Deployment is now handled entirely by Assembly Engine
    // No external workflow trigger needed

  } catch (error) {
    console.error('💥 [AssemblyTrigger] Unexpected error:', error);
  }
}

// ============================================
// INVOICE PAYMENT HANDLERS
// ============================================

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('💰 Payment succeeded for invoice:', invoice.id);
  const stripe = getStripeClient();
  const supabase = getSupabaseClient();

  // Skip if no customer
  if (!invoice.customer) {
    console.log('No customer on invoice, skipping');
    return;
  }

  // Get customer email
  const customer = await stripe.customers.retrieve(invoice.customer as string);
  const customerEmail = (customer as Stripe.Customer).email;
  const customerName = (customer as Stripe.Customer).name || 'Cliente';

  if (!customerEmail) {
    console.error('No customer email found for invoice:', invoice.id);
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

      console.log('📅 [Invoice] Syncing billing dates from Stripe subscription:', {
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
        console.error('🚨 [Invoice] Error updating subscription dates:', updateError);
      } else {
        console.log('✅ [Invoice] Subscription billing dates synced successfully');
        if (sub?.plan) {
          planName = getPlanDisplayName(sub.plan);
        }
      }

      // Set next billing date from the period end
      if (periodEnd) {
        nextBillingDate = new Date(periodEnd * 1000).toISOString();
      }
    } catch (err) {
      console.error('⚠️ [Invoice] Error fetching Stripe subscription:', err);

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
      console.log('📧 Payment confirmed email sent successfully');
    } else {
      console.error('📧 Failed to send payment email:', emailResult.error);
    }
  } catch (emailError) {
    console.error('📧 Error sending payment email:', emailError);
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('❌ Payment failed for invoice:', invoice.id);
  const stripe = getStripeClient();
  const supabase = getSupabaseClient();

  // Skip if no customer
  if (!invoice.customer) {
    console.log('No customer on invoice, skipping');
    return;
  }

  // Get customer email
  const customer = await stripe.customers.retrieve(invoice.customer as string);
  const customerEmail = (customer as Stripe.Customer).email;
  const customerName = (customer as Stripe.Customer).name || 'Cliente';

  if (!customerEmail) {
    console.error('No customer email found for invoice:', invoice.id);
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
      console.error('🚨 [PaymentFailed] Error updating subscription status:', updateError);
    } else {
      console.log('⚠️ [PaymentFailed] Subscription marked as past_due:', failedSubscriptionId);
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
        console.log('⚠️ [PaymentFailed] Tenant marked as past_due:', clientData.tenant_id);
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
      console.log('📧 Payment failed email sent successfully');
    } else {
      console.error('📧 Failed to send payment failed email:', emailResult.error);
    }
  } catch (emailError) {
    console.error('📧 Error sending payment failed email:', emailError);
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

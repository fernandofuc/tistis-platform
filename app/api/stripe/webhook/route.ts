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
// IDEMPOTENCY: Check if event was already processed
// ============================================
async function isEventProcessed(eventId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .single();
  return !!data;
}

async function markEventProcessed(eventId: string, eventType: string, status: 'success' | 'failed', errorMessage?: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from('webhook_events').upsert({
    event_id: eventId,
    event_type: eventType,
    status,
    error_message: errorMessage,
    processed_at: new Date().toISOString(),
  }, { onConflict: 'event_id' });
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
  // FIX 6: Idempotency check - Skip already processed events
  // ============================================
  if (await isEventProcessed(event.id)) {
    console.log(`⏭️ [Webhook] Event already processed, skipping: ${event.id}`);
    return NextResponse.json({ received: true, skipped: true });
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
  const customerEmail = session.customer_email || session.customer_details?.email;

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
        })
        .eq('id', previous_subscription_id);

      if (updateError) {
        console.error('🚨 [Checkout] Error updating subscription:', updateError);
        throw new Error(`Failed to update subscription: ${updateError.message}`);
      }

      console.log('✅ [Checkout] Subscription updated to plan:', validatedPlan);

      // Log the plan change
      await supabase.from('subscription_changes').insert({
        subscription_id: previous_subscription_id,
        tenant_id: tenant_id || null,
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
        console.log('📧 Welcome email sent to:', customerEmail);
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

  console.log('📋 Subscription metadata:', { plan, customerName, customerPhone, branches, addons });

  // Get customer email from Stripe
  const customer = await stripe.customers.retrieve(customerId);
  const customerEmail = (customer as Stripe.Customer).email;

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
    .eq('contact_email', customerEmail)
    .single();

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
    vertical: (vertical as 'dental' | 'restaurant' | 'pharmacy' | 'retail' | 'medical' | 'services' | 'other') || 'services',
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

        console.log('📧 [Webhook] Credentials email sent to:', customerEmail);
      } catch (emailError) {
        console.error('📧 [Webhook] Error sending credentials email:', emailError);
      }
    } else {
      // Usuario existente - puede usar su misma cuenta de TIS TIS
      console.log('✅ [Webhook] User already has TIS TIS account - no credentials email needed');
      console.log('   User can login with their existing account:', customerEmail);
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
  const supabase = getSupabaseClient();

  const status = subscription.status === 'active' ? 'active' :
                 subscription.status === 'past_due' ? 'past_due' :
                 subscription.status === 'canceled' ? 'cancelled' : 'pending';

  // Cast to any to access current_period_start/end which exist at runtime but have type issues
  const periodStart = (subscription as any).current_period_start;
  const periodEnd = (subscription as any).current_period_end;

  // Get branches count from metadata (set by update-subscription endpoint)
  const metadataBranches = subscription.metadata?.branches;
  const branchesCount = metadataBranches ? parseInt(metadataBranches) : undefined;

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

  // Update monthly amount if changed
  if (totalMonthlyAmount > 0) {
    updateData.monthly_amount = totalMonthlyAmount / 100;
    console.log(`💰 Monthly amount updated to: ${totalMonthlyAmount / 100} MXN`);
  }

  await supabase
    .from('subscriptions')
    .update(updateData)
    .eq('stripe_subscription_id', subscription.id);

  console.log('✅ Subscription record updated');
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
        console.log('📧 Cancellation email sent to:', customerEmail);
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

    // TODO: Trigger n8n Master Deployment workflow here
    // This will be implemented when n8n webhook is configured
    // await triggerN8nDeployment(result.data?.deployment_id);

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
  if (subscriptionId) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('stripe_subscription_id', subscriptionId as string)
      .single();

    if (sub?.plan) {
      planName = getPlanDisplayName(sub.plan);
    }
  }

  // Calculate next billing date
  const nextPaymentAttempt = (invoice as any).next_payment_attempt;
  const nextBillingDate = nextPaymentAttempt
    ? new Date(nextPaymentAttempt * 1000).toISOString()
    : undefined;

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
      console.log('📧 Payment confirmed email sent to:', customerEmail);
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
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('stripe_subscription_id', failedSubscriptionId as string)
      .single();

    if (sub?.plan) {
      planName = getPlanDisplayName(sub.plan);
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
      console.log('📧 Payment failed email sent to:', customerEmail);
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

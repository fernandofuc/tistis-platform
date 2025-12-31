// =====================================================
// API Route: POST /api/subscriptions/activate-trial-with-card
// Activates trial after card has been saved via Stripe Setup
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { activateFreeTrial } from '@/src/features/subscriptions/services/trial.service';
import { provisionTenant } from '@/lib/provisioning';
import { emailService } from '@/src/lib/email';

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// Use admin client because this endpoint is called without user auth
// (user just completed Stripe checkout and hasn't logged in yet)
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID es requerido' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const supabase = getSupabaseAdmin();

    // 1. Retrieve the Stripe Setup session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.mode !== 'setup') {
      return NextResponse.json(
        { error: 'Sesion de setup invalida' },
        { status: 400 }
      );
    }

    // 2. Extract metadata
    const {
      customerEmail,
      customerName,
      customerPhone,
      vertical,
    } = session.metadata || {};

    const stripeCustomerId = session.customer as string;

    if (!customerEmail || !stripeCustomerId) {
      return NextResponse.json(
        { error: 'Datos de cliente incompletos' },
        { status: 400 }
      );
    }

    // Normalize email to lowercase for consistent comparison
    const normalizedEmail = customerEmail.toLowerCase();

    console.log('[ActivateTrialWithCard] Processing setup session:', {
      sessionId,
      customerEmail: normalizedEmail,
      stripeCustomerId,
      vertical,
    });

    // 3. Check if client already exists (by contact_email - case-insensitive)
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, user_id, tenant_id, stripe_customer_id')
      .ilike('contact_email', normalizedEmail)
      .maybeSingle();

    let clientId: string;

    // Determine account state and appropriate action
    const isCompleteAccount = existingClient?.tenant_id && existingClient?.stripe_customer_id;
    const hasOnlyStripeId = existingClient?.stripe_customer_id && !existingClient?.tenant_id;

    if (isCompleteAccount) {
      // Fully provisioned account - this could be a duplicate request
      // Check if the stripe_customer_id matches (same session being retried)
      if (existingClient.stripe_customer_id === stripeCustomerId) {
        console.log('[ActivateTrialWithCard] Session already processed, returning existing data');
        // Return success with existing data - idempotent response
        return NextResponse.json({
          success: true,
          message: 'Cuenta ya configurada correctamente.',
          tenant_id: existingClient.tenant_id,
          already_processed: true,
        });
      }

      // Different Stripe customer - actual duplicate account attempt
      console.log('[ActivateTrialWithCard] Rejecting - complete account exists with different Stripe customer');
      return NextResponse.json(
        {
          error: 'Este email ya tiene una cuenta. Por favor inicia sesion.',
          code: 'EMAIL_ALREADY_EXISTS',
        },
        { status: 400 }
      );
    }

    if (hasOnlyStripeId) {
      // Client has stripe_customer_id but no tenant - previous provisioning failed
      // Verify it's the same Stripe customer before continuing
      if (existingClient.stripe_customer_id !== stripeCustomerId) {
        console.error('[ActivateTrialWithCard] Stripe customer ID mismatch:', {
          existing: existingClient.stripe_customer_id,
          new: stripeCustomerId,
        });
        return NextResponse.json(
          { error: 'Error de configuración. Por favor contacta soporte.' },
          { status: 400 }
        );
      }

      console.log('[ActivateTrialWithCard] Retrying provisioning for client with failed previous attempt:', existingClient.id);
      clientId = existingClient.id;
    } else if (existingClient) {
      // Client exists but incomplete (created by auth trigger) - update it
      console.log('[ActivateTrialWithCard] Updating incomplete client:', {
        id: existingClient.id,
        has_tenant_id: !!existingClient.tenant_id,
        has_stripe_customer_id: !!existingClient.stripe_customer_id,
      });

      const { error: updateError } = await supabase
        .from('clients')
        .update({
          contact_name: customerName || 'Cliente',
          contact_phone: customerPhone || null,
          business_name: customerName || 'Mi Negocio',
          vertical: vertical || 'dental',
          status: 'active',
          stripe_customer_id: stripeCustomerId,
        })
        .eq('id', existingClient.id);

      if (updateError) {
        console.error('[ActivateTrialWithCard] Error updating client:', updateError);
        return NextResponse.json(
          { error: 'Error al actualizar cliente' },
          { status: 500 }
        );
      }

      clientId = existingClient.id;
      console.log('[ActivateTrialWithCard] Client updated:', clientId);
    } else {
      // 4. Create new client with Stripe customer ID
      // This case is rare - usually auth trigger creates the client first
      console.log('[ActivateTrialWithCard] Creating new client (no existing record found)');

      const { data: newClient, error: createError } = await supabase
        .from('clients')
        .insert({
          contact_email: normalizedEmail,
          contact_name: customerName || 'Cliente',
          contact_phone: customerPhone || null,
          business_name: customerName || 'Mi Negocio',
          vertical: vertical || 'dental',
          status: 'active',
          stripe_customer_id: stripeCustomerId,
        })
        .select('id')
        .single();

      if (createError || !newClient) {
        console.error('[ActivateTrialWithCard] Error creating client:', createError);
        return NextResponse.json(
          { error: 'Error al crear cliente' },
          { status: 500 }
        );
      }

      clientId = newClient.id;
      console.log('[ActivateTrialWithCard] Client created:', clientId);
    }

    // 5. Activate trial
    const result = await activateFreeTrial(clientId, 'starter');

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al activar la prueba gratuita' },
        { status: 400 }
      );
    }

    // 6. Update subscription with Stripe customer ID
    if (result.subscription?.id) {
      await supabase
        .from('subscriptions')
        .update({
          stripe_customer_id: stripeCustomerId,
          // will_convert_to_paid is already true by default from activate_free_trial
        })
        .eq('id', result.subscription.id);

      console.log('[ActivateTrialWithCard] Subscription updated with Stripe customer:', {
        subscriptionId: result.subscription.id,
        stripeCustomerId,
      });
    }

    // 7. Provision tenant
    console.log('[ActivateTrialWithCard] Starting tenant provisioning...');

    const provisionResult = await provisionTenant({
      client_id: clientId,
      customer_email: normalizedEmail, // Use normalized email for user lookup
      customer_name: customerName || 'Cliente',
      customer_phone: customerPhone || undefined,
      vertical: (vertical as 'dental' | 'restaurant') || 'dental',
      plan: 'starter',
      branches_count: 1,
      subscription_id: result.subscription?.id,
    });

    if (!provisionResult.success) {
      console.error('[ActivateTrialWithCard] Tenant provisioning failed:', provisionResult.error);

      // ROLLBACK: Delete subscription so user can retry cleanly
      // Without this, the unique constraint prevents retry
      if (result.subscription?.id) {
        console.log('[ActivateTrialWithCard] Rolling back subscription:', result.subscription.id);
        await supabase
          .from('subscriptions')
          .delete()
          .eq('id', result.subscription.id);
      }

      // Also clear stripe_customer_id from client so they can retry with new session
      await supabase
        .from('clients')
        .update({ stripe_customer_id: null })
        .eq('id', clientId);

      console.log('[ActivateTrialWithCard] Rollback complete - user can retry');

      return NextResponse.json(
        {
          error: 'Error al configurar tu cuenta. Por favor intenta de nuevo.',
          details: provisionResult.error,
          can_retry: true,
        },
        { status: 500 }
      );
    }

    console.log('[ActivateTrialWithCard] Tenant provisioned:', {
      tenant_id: provisionResult.tenant_id,
      tenant_slug: provisionResult.tenant_slug,
    });

    // 8. Update client with tenant_id
    if (provisionResult.tenant_id) {
      await supabase
        .from('clients')
        .update({ tenant_id: provisionResult.tenant_id })
        .eq('id', clientId);
    }

    // 9. Send credentials email if new user was created (has temp_password)
    // Users with existing OAuth accounts don't need credentials
    if (provisionResult.temp_password) {
      try {
        const dashboardUrl = `${process.env.NEXT_PUBLIC_URL || 'https://app.tistis.com'}/dashboard`;

        await emailService.sendCredentials(normalizedEmail, {
          customerName: customerName || 'Cliente',
          dashboardUrl,
          email: normalizedEmail,
          tempPassword: provisionResult.temp_password,
          tenantSlug: provisionResult.tenant_slug || '',
        });

        console.log('[ActivateTrialWithCard] Credentials email sent successfully');
      } catch (emailError) {
        // Non-critical - log but don't fail the request
        console.error('[ActivateTrialWithCard] Error sending credentials email:', emailError);
      }
    } else {
      console.log('[ActivateTrialWithCard] User has existing account - no credentials email needed');
    }

    // 10. Return success
    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      daysRemaining: result.daysRemaining,
      tenant_id: provisionResult.tenant_id,
      tenant_slug: provisionResult.tenant_slug,
      vertical,
      message: `¡Prueba gratuita activada! Tienes ${result.daysRemaining} dias para probar TIS TIS. Tu tarjeta se cobrara automaticamente al finalizar.`,
    });
  } catch (error: unknown) {
    console.error('[ActivateTrialWithCard] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

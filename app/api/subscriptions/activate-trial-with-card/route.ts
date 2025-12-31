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
      .select('id, user_id')
      .ilike('contact_email', normalizedEmail)
      .maybeSingle();

    if (existingClient) {
      return NextResponse.json(
        {
          error: 'Este email ya tiene una cuenta. Por favor inicia sesion.',
          code: 'EMAIL_ALREADY_EXISTS',
        },
        { status: 400 }
      );
    }

    // 4. Create new client with Stripe customer ID
    // Using correct column names from clients table schema
    // IMPORTANT: Use normalized (lowercase) email for consistency
    const { data: newClient, error: createError } = await supabase
      .from('clients')
      .insert({
        contact_email: normalizedEmail,
        contact_name: customerName || 'Cliente',
        contact_phone: customerPhone || null,
        business_name: customerName || 'Mi Negocio', // Required field
        vertical: vertical || 'dental',
        status: 'active',
        stripe_customer_id: stripeCustomerId, // CRITICAL: Save Stripe customer ID for later billing
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

    const clientId = newClient.id;
    console.log('[ActivateTrialWithCard] Client created:', clientId);

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
      return NextResponse.json({
        success: true,
        subscription: result.subscription,
        daysRemaining: result.daysRemaining,
        warning: 'Trial activado pero hubo un error configurando tu cuenta. Contacta soporte.',
        provisioningError: provisionResult.error,
      });
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

    // 9. Return success
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

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  getClientIP,
  checkoutLimiter,
  rateLimitExceeded,
} from '@/src/shared/lib/rate-limit';

// =====================================================
// API Route: POST /api/stripe/setup-trial-card
// Creates a Stripe Checkout Session in "setup" mode
// to collect card details WITHOUT charging the user.
// The card will be charged automatically after trial ends.
// =====================================================

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Currently active verticals
const VALID_VERTICALS = ['dental', 'restaurant'];

export async function POST(req: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimitResult = checkRateLimit(clientIP, checkoutLimiter);

  if (!rateLimitResult.success) {
    return rateLimitExceeded(rateLimitResult);
  }

  try {
    const body = await req.json();
    const {
      customerEmail,
      customerName,
      customerPhone,
      vertical,
    } = body;

    // Validate required fields
    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Email es requerido' },
        { status: 400 }
      );
    }

    if (!customerName) {
      return NextResponse.json(
        { error: 'Nombre es requerido' },
        { status: 400 }
      );
    }

    // Validate vertical
    if (!vertical || !VALID_VERTICALS.includes(vertical)) {
      console.error('🚨 [SetupTrialCard] Invalid or missing vertical:', vertical);
      return NextResponse.json(
        { error: 'Vertical es requerido. Por favor vuelve a la pagina de precios.' },
        { status: 400 }
      );
    }

    // Normalize email for case-insensitive operations
    const normalizedEmail = customerEmail.toLowerCase();

    // Check if client already exists in our DB (case-insensitive)
    const supabase = getSupabaseAdmin();
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, tenant_id, stripe_customer_id')
      .ilike('contact_email', normalizedEmail)
      .maybeSingle();

    // Determine if this is a complete account that should be rejected
    // A complete account has BOTH tenant_id AND stripe_customer_id
    // - If only tenant_id exists: incomplete provisioning, allow retry
    // - If only stripe_customer_id exists: incomplete trial setup, allow retry
    // - If both exist: fully provisioned account, reject
    // - If neither exists: new account from auth trigger, allow
    const isCompleteAccount = existingClient?.tenant_id && existingClient?.stripe_customer_id;

    if (isCompleteAccount) {
      console.log('[SetupTrialCard] Rejecting - complete account exists:', existingClient.id);
      return NextResponse.json(
        {
          error: 'Este email ya tiene una cuenta. Por favor inicia sesion.',
          code: 'EMAIL_ALREADY_EXISTS',
        },
        { status: 400 }
      );
    }

    // Log the state of any existing client for debugging
    if (existingClient) {
      console.log('[SetupTrialCard] Found incomplete client, will reuse:', {
        id: existingClient.id,
        has_tenant_id: !!existingClient.tenant_id,
        has_stripe_customer_id: !!existingClient.stripe_customer_id,
      });
    }

    const stripe = getStripeClient();
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_URL;

    // Create or find Stripe customer (use normalized email)
    let customerId: string;
    const existingCustomers = await stripe.customers.list({
      email: normalizedEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
      console.log('[SetupTrialCard] Found existing customer:', customerId);

      // Check if customer already has payment methods
      // If so, clean up duplicates keeping only the most recent one
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      if (paymentMethods.data.length > 0) {
        console.log(`[SetupTrialCard] Customer has ${paymentMethods.data.length} existing payment method(s)`);

        // If there are duplicates (more than 1), clean them up
        if (paymentMethods.data.length > 1) {
          console.log('[SetupTrialCard] Cleaning up duplicate payment methods...');

          // Sort by created date, keep the most recent one
          const sortedMethods = [...paymentMethods.data].sort((a, b) => b.created - a.created);
          const methodToKeep = sortedMethods[0];
          const methodsToRemove = sortedMethods.slice(1);

          // Detach duplicate payment methods
          for (const method of methodsToRemove) {
            try {
              await stripe.paymentMethods.detach(method.id);
              console.log(`[SetupTrialCard] Detached duplicate payment method: ${method.id}`);
            } catch (detachError) {
              console.error(`[SetupTrialCard] Error detaching payment method ${method.id}:`, detachError);
            }
          }

          console.log(`[SetupTrialCard] Kept payment method: ${methodToKeep.id}`);
        }

        // Customer already has a valid card - no need for new setup
        // Return success without creating new session
        console.log('[SetupTrialCard] Customer already has a valid payment method, skipping setup');
        return NextResponse.json({
          hasExistingCard: true,
          customerId,
          message: 'Ya tienes un método de pago registrado.',
        });
      }
    } else {
      const customer = await stripe.customers.create({
        email: normalizedEmail,
        name: customerName,
        phone: customerPhone || undefined,
        metadata: {
          source: 'tistis_trial_setup',
          vertical,
        },
      });
      customerId = customer.id;
      console.log('[SetupTrialCard] Created new customer:', customerId);
    }

    // Create Stripe Checkout Session in SETUP mode
    // This collects card details without charging
    // IMPORTANT: Store normalized email in metadata for consistency
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'setup', // CRITICAL: Setup mode = no charge, just save card
      customer: customerId,
      success_url: `${origin}/trial-setup-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?plan=starter&cancelled=true`,
      metadata: {
        plan: 'starter',
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        customerEmail: normalizedEmail, // Store normalized email
        vertical,
        flow: 'trial_with_card',
      },
    });

    console.log('[SetupTrialCard] Created setup session:', session.id);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      customerId,
    });
  } catch (error: any) {
    console.error('[SetupTrialCard] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear sesión de configuración' },
      { status: 500 }
    );
  }
}

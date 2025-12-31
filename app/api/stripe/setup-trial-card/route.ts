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

    // Check if client already exists in our DB
    const supabase = getSupabaseAdmin();
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('contact_email', customerEmail)
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

    const stripe = getStripeClient();
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_URL;

    // Create or find Stripe customer
    let customerId: string;
    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
      console.log('[SetupTrialCard] Found existing customer:', customerId);
    } else {
      const customer = await stripe.customers.create({
        email: customerEmail,
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
        customerEmail,
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

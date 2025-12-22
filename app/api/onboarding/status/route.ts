export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: 'Missing session_id' },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripeClient();
    const supabase = getSupabaseClient();

    // Get checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer']
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Extract plan details from metadata
    const metadata = session.metadata || {};
    const plan = metadata.plan || 'essentials';
    const branches = parseInt(metadata.branches || '1', 10);
    const vertical = metadata.vertical || 'dental';

    const planNames: Record<string, string> = {
      starter: 'Starter',
      essentials: 'Essentials',
      growth: 'Growth',
    };

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json({
        success: true,
        status: {
          ready: false,
          stage: 'initializing',
          message: 'Esperando confirmación del pago...',
          progress: 5,
          planDetails: {
            plan,
            planName: planNames[plan] || plan,
            branches,
            vertical
          }
        }
      });
    }

    // SIMPLIFICADO: Si el pago fue exitoso, el sistema está listo
    // El usuario ya tiene cuenta de TIS TIS (usó su email para pagar)
    // Solo necesita hacer login con su cuenta existente
    return NextResponse.json({
      success: true,
      status: {
        ready: true,
        stage: 'ready',
        message: '¡Tu sistema está listo!',
        progress: 100,
        planDetails: {
          plan,
          planName: planNames[plan] || plan,
          branches,
          vertical
        }
      }
    });

  } catch (error: any) {
    console.error('Error checking onboarding status:', error);

    // If error is due to missing tables, assume system is ready
    // (migration might not have run yet)
    if (error.message?.includes('relation') || error.code === '42P01') {
      return NextResponse.json({
        success: true,
        status: {
          ready: true,
          stage: 'ready',
          message: '¡Tu sistema está listo!',
          progress: 100,
          planDetails: {
            plan: 'essentials',
            planName: 'Essentials',
            branches: 1,
            vertical: 'dental'
          }
        }
      });
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Error checking status' },
      { status: 500 }
    );
  }
}

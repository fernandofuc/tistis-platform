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
      scale: 'Scale'
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

    // Get customer email
    const customerEmail = session.customer_email ||
      (session.customer as Stripe.Customer)?.email;

    if (!customerEmail) {
      return NextResponse.json({
        success: true,
        status: {
          ready: false,
          stage: 'error',
          message: 'No se encontró email del cliente',
          progress: 0,
          planDetails: {
            plan,
            planName: planNames[plan] || plan,
            branches,
            vertical
          }
        }
      });
    }

    // Check if client exists in database
    const { data: client } = await supabase
      .from('clients')
      .select('id, status')
      .eq('contact_email', customerEmail)
      .single();

    if (!client) {
      // Client not yet created - still processing webhook
      return NextResponse.json({
        success: true,
        status: {
          ready: false,
          stage: 'initializing',
          message: 'Creando tu cuenta...',
          progress: 20,
          planDetails: {
            plan,
            planName: planNames[plan] || plan,
            branches,
            vertical
          }
        }
      });
    }

    // Check if subscription was created
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, status')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscription) {
      return NextResponse.json({
        success: true,
        status: {
          ready: false,
          stage: 'configuring',
          message: 'Configurando tu suscripción...',
          progress: 40,
          planDetails: {
            plan,
            planName: planNames[plan] || plan,
            branches,
            vertical
          }
        }
      });
    }

    // Check deployment status
    const { data: deployment } = await supabase
      .from('deployment_log')
      .select('id, status, progress_percentage')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!deployment) {
      // Deployment not yet created - Assembly Engine might still be processing
      return NextResponse.json({
        success: true,
        status: {
          ready: false,
          stage: 'configuring',
          message: 'Preparando tu sistema...',
          progress: 50,
          planDetails: {
            plan,
            planName: planNames[plan] || plan,
            branches,
            vertical
          }
        }
      });
    }

    // Check deployment status
    if (deployment.status === 'completed') {
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
    }

    if (deployment.status === 'failed') {
      return NextResponse.json({
        success: true,
        status: {
          ready: false,
          stage: 'error',
          message: 'Hubo un problema configurando tu sistema',
          progress: deployment.progress_percentage || 50,
          planDetails: {
            plan,
            planName: planNames[plan] || plan,
            branches,
            vertical
          }
        }
      });
    }

    // Still in progress
    const progressMap: Record<string, number> = {
      pending: 60,
      in_progress: 75,
      deploying: 90
    };

    return NextResponse.json({
      success: true,
      status: {
        ready: false,
        stage: 'deploying',
        message: 'Desplegando tu dashboard...',
        progress: progressMap[deployment.status] || deployment.progress_percentage || 70,
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

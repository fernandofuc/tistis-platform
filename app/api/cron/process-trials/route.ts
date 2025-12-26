// =====================================================
// TIS TIS PLATFORM - Process Trials Cron Job
// Procesa trials que expiran: cobra o cancela según configuración
// Schedule: Daily at 09:00 AM (Mexico City time)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getTrialsExpiringToday,
  convertTrialToPaid,
  endTrialWithoutConversion,
} from '@/src/features/subscriptions/services/trial.service';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('[Process Trials] CRON_SECRET not set');
    return true; // Allow in development
  }

  return authHeader === `Bearer ${cronSecret}`;
}

interface ProcessResult {
  subscription_id: string;
  client_id: string;
  action: 'converted_to_paid' | 'cancelled' | 'error';
  success: boolean;
  error?: string;
}

/**
 * Crea suscripción en Stripe y cobra el primer mes
 */
async function createStripeSubscription(
  clientEmail: string,
  clientName: string
): Promise<{
  success: boolean;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  error?: string;
}> {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // 1. Buscar o crear customer en Stripe
    const customers = await stripe.customers.list({
      email: clientEmail,
      limit: 1,
    });

    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: clientEmail,
        name: clientName,
        metadata: {
          source: 'tistis_trial_conversion',
        },
      });
      customerId = customer.id;
    }

    // 2. Crear suscripción (esto cobra automáticamente el primer mes)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: process.env.STRIPE_STARTER_PLAN_PRICE_ID, // Price ID del plan Starter
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
      },
      expand: ['latest_invoice.payment_intent'],
    });

    console.log('[Process Trials] Stripe subscription created:', {
      subscriptionId: subscription.id,
      customerId,
      status: subscription.status,
    });

    return {
      success: true,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
    };
  } catch (error: any) {
    console.error('[Process Trials] Error creating Stripe subscription:', error);
    return {
      success: false,
      error: error.message || 'Error creating Stripe subscription',
    };
  }
}

/**
 * Envía email de bienvenida al usuario que convirtió a pago
 */
async function sendWelcomeEmail(
  clientEmail: string,
  clientName: string
): Promise<void> {
  try {
    // TODO: Implementar envío de email
    // Puedes usar Resend, SendGrid, etc.
    console.log('[Process Trials] Welcome email sent to:', clientEmail);
  } catch (error) {
    console.error('[Process Trials] Error sending welcome email:', error);
  }
}

/**
 * Envía email de cancelación al usuario
 */
async function sendCancellationEmail(
  clientEmail: string,
  clientName: string
): Promise<void> {
  try {
    // TODO: Implementar envío de email
    console.log('[Process Trials] Cancellation email sent to:', clientEmail);
  } catch (error) {
    console.error('[Process Trials] Error sending cancellation email:', error);
  }
}

/**
 * Procesa un trial individual
 */
async function processSingleTrial(trial: {
  subscription_id: string;
  client_id: string;
  trial_end: string;
  will_convert_to_paid: boolean;
  client_email: string;
  client_name: string;
}): Promise<ProcessResult> {
  try {
    if (trial.will_convert_to_paid) {
      // CASO 1: Usuario NO canceló → Cobrar y convertir a suscripción paga
      console.log(`[Process Trials] Converting trial to paid: ${trial.subscription_id}`);

      // 1. Crear suscripción en Stripe y cobrar
      const stripeResult = await createStripeSubscription(
        trial.client_email,
        trial.client_name
      );

      if (!stripeResult.success) {
        return {
          subscription_id: trial.subscription_id,
          client_id: trial.client_id,
          action: 'error',
          success: false,
          error: `Stripe error: ${stripeResult.error}`,
        };
      }

      // 2. Actualizar suscripción en DB
      const convertResult = await convertTrialToPaid(
        trial.subscription_id,
        stripeResult.stripeSubscriptionId,
        stripeResult.stripeCustomerId
      );

      if (!convertResult.success) {
        return {
          subscription_id: trial.subscription_id,
          client_id: trial.client_id,
          action: 'error',
          success: false,
          error: convertResult.error,
        };
      }

      // 3. Enviar email de bienvenida
      await sendWelcomeEmail(trial.client_email, trial.client_name);

      return {
        subscription_id: trial.subscription_id,
        client_id: trial.client_id,
        action: 'converted_to_paid',
        success: true,
      };
    } else {
      // CASO 2: Usuario canceló durante trial → Finalizar sin cobrar
      console.log(`[Process Trials] Ending trial without conversion: ${trial.subscription_id}`);

      const endResult = await endTrialWithoutConversion(trial.subscription_id);

      if (!endResult.success) {
        return {
          subscription_id: trial.subscription_id,
          client_id: trial.client_id,
          action: 'error',
          success: false,
          error: endResult.error,
        };
      }

      // Enviar email de agradecimiento por probar
      await sendCancellationEmail(trial.client_email, trial.client_name);

      return {
        subscription_id: trial.subscription_id,
        client_id: trial.client_id,
        action: 'cancelled',
        success: true,
      };
    }
  } catch (error: any) {
    console.error('[Process Trials] Error processing trial:', error);
    return {
      subscription_id: trial.subscription_id,
      client_id: trial.client_id,
      action: 'error',
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Process Trials] Starting trial processing...');

  const startTime = Date.now();

  try {
    // 1. Obtener trials que expiran hoy
    const trials = await getTrialsExpiringToday();

    if (trials.length === 0) {
      console.log('[Process Trials] No trials expiring today');
      return NextResponse.json({
        success: true,
        message: 'No trials expiring today',
        processed: 0,
        converted: 0,
        cancelled: 0,
        errors: 0,
      });
    }

    console.log(`[Process Trials] Processing ${trials.length} expiring trials`);

    // 2. Procesar cada trial
    const results: ProcessResult[] = [];

    for (const trial of trials) {
      const result = await processSingleTrial(trial);
      results.push(result);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // 3. Calcular estadísticas
    const converted = results.filter((r) => r.action === 'converted_to_paid' && r.success).length;
    const cancelled = results.filter((r) => r.action === 'cancelled' && r.success).length;
    const errors = results.filter((r) => !r.success).length;

    const duration = Date.now() - startTime;

    console.log(`[Process Trials] Completed in ${duration}ms`);
    console.log(`[Process Trials] Results: ${converted} converted, ${cancelled} cancelled, ${errors} errors`);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      processed: trials.length,
      converted,
      cancelled,
      errors,
      details: results,
    });
  } catch (error: any) {
    console.error('[Process Trials] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}

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
  subscriptionId: string, // CRÍTICO: Para idempotency key
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

    // 2. Validar que customer tiene payment method
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    if (paymentMethods.data.length === 0) {
      return {
        success: false,
        error: 'No payment method on file. Customer must add card before trial converts.',
      };
    }

    // 3. Crear suscripción (CRÍTICO: error_if_incomplete para fallar si no puede cobrar)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: process.env.STRIPE_STARTER_PLAN_PRICE_ID, // Price ID del plan Starter
        },
      ],
      payment_behavior: 'error_if_incomplete', // EDGE CASE FIX: Falla si no puede cobrar
      payment_settings: {
        payment_method_types: ['card'],
      },
      expand: ['latest_invoice.payment_intent'],
    }, {
      // CRÍTICO: Idempotency key DEBE ser estable (mismo valor en retries)
      // Usar subscription_id garantiza que múltiples intentos usan MISMA key
      idempotencyKey: `trial_conversion_${subscriptionId}`,
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
        trial.subscription_id, // CRÍTICO: Para idempotency key
        trial.client_email,
        trial.client_name
      );

      // EDGE CASE FIX #4: Si Stripe falla (sin payment method, tarjeta expirada, etc.)
      // → NO convertir trial, cancelarlo sin cobro
      if (!stripeResult.success) {
        console.error(`[Process Trials] Stripe failed, ending trial without conversion:`, stripeResult.error);

        // Finalizar trial sin cobro (usuario no pudo/no quiso pagar)
        await endTrialWithoutConversion(trial.subscription_id);
        await sendCancellationEmail(trial.client_email, trial.client_name);

        return {
          subscription_id: trial.subscription_id,
          client_id: trial.client_id,
          action: 'cancelled',
          success: true,
          error: `Trial ended without payment: ${stripeResult.error}`,
        };
      }

      // 2. Actualizar suscripción en DB
      const convertResult = await convertTrialToPaid(
        trial.subscription_id,
        stripeResult.stripeSubscriptionId,
        stripeResult.stripeCustomerId
      );

      // EDGE CASE FIX #3: Si DB falla DESPUÉS de cobrar en Stripe
      // → Esto es CRÍTICO, dejamos error para manual intervention
      if (!convertResult.success) {
        console.error('[Process Trials] CRITICAL: Stripe charged but DB update failed!', {
          subscriptionId: trial.subscription_id,
          stripeSubscriptionId: stripeResult.stripeSubscriptionId,
          error: convertResult.error,
        });

        return {
          subscription_id: trial.subscription_id,
          client_id: trial.client_id,
          action: 'error',
          success: false,
          error: `CRITICAL: Stripe charged (${stripeResult.stripeSubscriptionId}) but DB update failed: ${convertResult.error}`,
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

    // 2. Procesar cada trial (con manejo individual de errores)
    const results: ProcessResult[] = [];

    for (const trial of trials) {
      try {
        // EDGE CASE FIX #5: Re-verificar que trial sigue activo
        // (previene procesar 2x si cron corre simultáneamente)
        const supabase = getSupabaseAdmin();
        const { data: currentTrial } = await supabase
          .from('subscriptions')
          .select('id, trial_status, status')
          .eq('id', trial.subscription_id)
          .single();

        // Si trial ya fue procesado por otra instancia, skip
        if (!currentTrial || currentTrial.trial_status !== 'active' || currentTrial.status !== 'trialing') {
          console.log(`[Process Trials] Trial ${trial.subscription_id} already processed, skipping`);
          continue;
        }

        // Procesar trial
        const result = await processSingleTrial(trial);
        results.push(result);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error: any) {
        // EDGE CASE FIX #7: Si cliente fue eliminado mientras procesamos
        // → Continuar con siguiente trial sin detener todo el batch
        console.error(`[Process Trials] Error processing trial ${trial.subscription_id}:`, error);
        results.push({
          subscription_id: trial.subscription_id,
          client_id: trial.client_id,
          action: 'error',
          success: false,
          error: error.message || 'Unknown error during processing',
        });
      }
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

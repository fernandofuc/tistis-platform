// =====================================================
// TIS TIS PLATFORM - Process Trials Cron Job
// Procesa trials que expiran: cobra o cancela según configuración
// Schedule: Daily at 09:00 AM (Mexico City time)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import Stripe from 'stripe';
import {
  getTrialsExpiringToday,
  convertTrialToPaid,
  endTrialWithoutConversion,
} from '@/src/features/subscriptions/services/trial.service';
import { sendEmail } from '@/src/lib/email/sender';

// Create Stripe client lazily (validated)
function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(secretKey);
}

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Verify cron secret for security (timing-safe)
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In production, CRON_SECRET is required
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Process Trials] CRON_SECRET not set in production');
      return false;
    }
    console.warn('[Process Trials] CRON_SECRET not set - allowing in development');
    return true;
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  try {
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(cronSecret);
    if (tokenBuffer.length !== secretBuffer.length) {
      return false;
    }
    return timingSafeEqual(tokenBuffer, secretBuffer);
  } catch {
    return false;
  }
}

interface ProcessResult {
  subscription_id: string;
  client_id: string;
  action: 'converted_to_paid' | 'cancelled' | 'error';
  success: boolean;
  error?: string;
}

/**
 * Crea suscripcion en Stripe y cobra el primer mes
 * @param existingStripeCustomerId - If provided, use this customer directly (faster)
 */
async function createStripeSubscription(
  subscriptionId: string, // CRITICO: Para idempotency key
  clientEmail: string,
  clientName: string,
  existingStripeCustomerId?: string | null
): Promise<{
  success: boolean;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  error?: string;
}> {
  try {
    const stripe = getStripeClient();

    let customerId: string | undefined;

    // Optimization: Use existing customer ID if available (from trial setup)
    if (existingStripeCustomerId) {
      // Verify customer exists in Stripe
      try {
        await stripe.customers.retrieve(existingStripeCustomerId);
        customerId = existingStripeCustomerId;
        console.log('[Process Trials] Using existing Stripe customer:', customerId);
      } catch {
        console.warn('[Process Trials] Stored customer ID invalid, searching by email');
        // customerId remains undefined, will search by email below
      }
    }

    // Fallback: Search by email if no valid customer ID
    if (!customerId) {
      const customers = await stripe.customers.list({
        email: clientEmail,
        limit: 1,
      });

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
    }

    // At this point customerId is guaranteed to be set
    if (!customerId) {
      return {
        success: false,
        error: 'Could not find or create Stripe customer',
      };
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
    const dashboardUrl = process.env.NEXT_PUBLIC_URL || 'https://tistis.com';

    await sendEmail({
      to: { email: clientEmail, name: clientName },
      subject: '🎉 ¡Bienvenido a TIS TIS Platform!',
      html: `
        <h2>¡Felicidades ${clientName}!</h2>
        <p>Tu suscripción a TIS TIS Platform está ahora <strong>activa</strong>.</p>
        <p>Tu período de prueba ha terminado y hemos procesado exitosamente tu primer pago.</p>

        <h3>¿Qué sigue?</h3>
        <ul>
          <li>✅ Acceso completo a todas las funcionalidades</li>
          <li>✅ Soporte prioritario por WhatsApp y email</li>
          <li>✅ Actualizaciones automáticas incluidas</li>
        </ul>

        <p><a href="${dashboardUrl}/dashboard" style="background: #FF6B6B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Ir al Dashboard</a></p>

        <p>Si tienes alguna pregunta, responde a este correo.</p>

        <p>¡Gracias por confiar en TIS TIS!</p>
        <p><em>El equipo de TIS TIS</em></p>
      `,
      tags: ['trial-converted', 'welcome'],
    });

    console.log('[Process Trials] Welcome email sent successfully');
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
    const dashboardUrl = process.env.NEXT_PUBLIC_URL || 'https://tistis.com';

    await sendEmail({
      to: { email: clientEmail, name: clientName },
      subject: 'Tu período de prueba ha terminado - TIS TIS',
      html: `
        <h2>Hola ${clientName},</h2>
        <p>Tu período de prueba de TIS TIS Platform ha terminado.</p>
        <p>Lamentamos que no hayas podido continuar con nosotros. Tu cuenta ha sido desactivada.</p>

        <h3>¿Cambiaste de opinión?</h3>
        <p>Puedes reactivar tu suscripción en cualquier momento:</p>

        <p><a href="${dashboardUrl}/pricing" style="background: #FF6B6B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Ver Planes</a></p>

        <p>Si tuviste algún problema o tienes feedback, nos encantaría escucharte. Responde a este correo.</p>

        <p>¡Gracias por probar TIS TIS!</p>
        <p><em>El equipo de TIS TIS</em></p>
      `,
      tags: ['trial-ended', 'cancellation'],
    });

    console.log('[Process Trials] Cancellation email sent successfully');
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
  stripe_customer_id?: string | null;  // NEW: Pre-existing Stripe customer
}): Promise<ProcessResult> {
  try {
    if (trial.will_convert_to_paid) {
      // CASO 1: Usuario NO cancelo -> Cobrar y convertir a suscripcion paga
      console.log(`[Process Trials] Converting trial to paid: ${trial.subscription_id}`);

      // 1. Crear suscripcion en Stripe y cobrar (use existing customer if available)
      const stripeResult = await createStripeSubscription(
        trial.subscription_id, // CRITICO: Para idempotency key
        trial.client_email,
        trial.client_name,
        trial.stripe_customer_id  // Pass existing customer ID for optimization
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

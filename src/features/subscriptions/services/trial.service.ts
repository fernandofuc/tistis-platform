// =====================================================
// TIS TIS PLATFORM - Trial Service
// Servicio para gestionar pruebas gratuitas de 10 días
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import {
  TrialSubscriptionSchema,
  TrialExpiringTodaySchema,
  safeValidateTrialSubscription,
  type TrialSubscription,
  type TrialActivationResult,
  type TrialCancellationResult,
  type TrialExpiringToday,
} from '../schemas/trial.schemas';
import { z } from 'zod';

// Re-exportar types para mantener compatibilidad
export type {
  TrialSubscription,
  TrialActivationResult,
  TrialCancellationResult,
  TrialExpiringToday,
}

// ======================
// SERVICE FUNCTIONS
// ======================

/**
 * Activa una prueba gratuita de 10 días para un cliente
 */
export async function activateFreeTrial(
  clientId: string,
  plan: string = 'starter'
): Promise<TrialActivationResult> {
  try {
    // Validar inputs con Zod
    const UUIDSchema = z.string().uuid('clientId debe ser un UUID válido');
    const PlanSchema = z.literal('starter', {
      errorMap: () => ({ message: 'Solo el plan Starter puede tener prueba gratuita' }),
    });

    const clientIdValidation = UUIDSchema.safeParse(clientId);
    if (!clientIdValidation.success) {
      return {
        success: false,
        error: 'clientId inválido: debe ser un UUID',
      };
    }

    const planValidation = PlanSchema.safeParse(plan);
    if (!planValidation.success) {
      return {
        success: false,
        error: 'Solo el plan Starter puede tener prueba gratuita',
      };
    }

    const supabase = createServerClient();

    // Llamar función de base de datos
    const { data, error } = await supabase
      .rpc('activate_free_trial', {
        p_client_id: clientId,
        p_plan: plan,
      })
      .single();

    if (error) {
      console.error('[TrialService] Error activating trial:', error);
      return {
        success: false,
        error: error.message || 'Error al activar la prueba gratuita',
      };
    }

    // Validar response de DB con Zod (protección contra datos corruptos)
    const validation = safeValidateTrialSubscription(data);

    if (!validation.success) {
      console.error('[TrialService] Invalid trial data from DB:', validation.error);
      return {
        success: false,
        error: 'Datos de suscripción inválidos recibidos de la base de datos',
      };
    }

    const subscription = validation.data;

    // Calcular días restantes (usar Math.floor para evitar reportar días extra)
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.floor((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    console.log('[TrialService] Trial activated:', {
      subscriptionId: subscription.id,
      clientId,
      daysRemaining,
      trialEnd: subscription.trial_end,
    });

    return {
      success: true,
      subscription,
      daysRemaining,
    };
  } catch (err) {
    // Manejo mejorado de errores (distinguir entre ZodError y otros)
    if (err instanceof z.ZodError) {
      console.error('[TrialService] Validation error:', err.errors);
      return {
        success: false,
        error: 'Error de validación en los datos',
      };
    }

    console.error('[TrialService] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error inesperado al activar la prueba gratuita',
    };
  }
}

/**
 * Cancela una prueba gratuita (mantiene acceso pero no cobra al finalizar)
 */
export async function cancelTrial(
  subscriptionId: string
): Promise<TrialCancellationResult> {
  try {
    // Validar input con Zod
    const UUIDSchema = z.string().uuid('subscriptionId debe ser un UUID válido');
    const inputValidation = UUIDSchema.safeParse(subscriptionId);

    if (!inputValidation.success) {
      return {
        success: false,
        error: 'subscriptionId inválido: debe ser un UUID',
      };
    }

    const supabase = createServerClient();

    // Llamar función de base de datos
    const { data, error } = await supabase
      .rpc('cancel_trial', {
        p_subscription_id: subscriptionId,
      })
      .single();

    if (error) {
      console.error('[TrialService] Error cancelling trial:', error);
      return {
        success: false,
        error: error.message || 'Error al cancelar la prueba gratuita',
      };
    }

    // Validar response de DB con Zod
    const responseValidation = safeValidateTrialSubscription(data);

    if (!responseValidation.success) {
      console.error('[TrialService] Invalid trial data from DB:', responseValidation.error);
      return {
        success: false,
        error: 'Datos de suscripción inválidos recibidos de la base de datos',
      };
    }

    const subscription = responseValidation.data;

    console.log('[TrialService] Trial cancelled:', {
      subscriptionId,
      willConvertToPaid: subscription.will_convert_to_paid,
      trialEnd: subscription.trial_end,
    });

    return {
      success: true,
      subscription,
      message:
        'Prueba gratuita cancelada. Puedes seguir usando TIS TIS hasta el final de tu período de prueba.',
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error('[TrialService] Validation error:', err.errors);
      return {
        success: false,
        error: 'Error de validación en los datos',
      };
    }

    console.error('[TrialService] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error inesperado al cancelar la prueba gratuita',
    };
  }
}

/**
 * Obtiene trials que expiran hoy (para cron job)
 */
export async function getTrialsExpiringToday(): Promise<
  TrialExpiringToday[]
> {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase.rpc('get_trials_expiring_today');

    if (error) {
      console.error('[TrialService] Error getting expiring trials:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    // Validar array de trials con Zod
    const validation = z.array(TrialExpiringTodaySchema).safeParse(data);

    if (!validation.success) {
      console.error('[TrialService] Invalid trials data from DB:', validation.error);
      return [];
    }

    return validation.data;
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error('[TrialService] Validation error:', err.errors);
      return [];
    }

    console.error('[TrialService] Unexpected error:', err);
    return [];
  }
}

/**
 * Convierte un trial a suscripción paga (después de cobrar con Stripe)
 */
export async function convertTrialToPaid(
  subscriptionId: string,
  stripeSubscriptionId?: string,
  stripeCustomerId?: string
): Promise<TrialActivationResult> {
  try {
    // Validar inputs con Zod
    const inputSchema = z.object({
      subscriptionId: z.string().uuid('subscriptionId debe ser un UUID válido'),
      stripeSubscriptionId: z.string().optional(),
      stripeCustomerId: z.string().optional(),
    });

    const inputValidation = inputSchema.safeParse({
      subscriptionId,
      stripeSubscriptionId,
      stripeCustomerId,
    });

    if (!inputValidation.success) {
      return {
        success: false,
        error: 'Parámetros inválidos: ' + inputValidation.error.errors[0].message,
      };
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .rpc('convert_trial_to_paid', {
        p_subscription_id: subscriptionId,
        p_stripe_subscription_id: stripeSubscriptionId,
        p_stripe_customer_id: stripeCustomerId,
      })
      .single();

    if (error) {
      console.error('[TrialService] Error converting trial to paid:', error);
      return {
        success: false,
        error: error.message || 'Error al convertir la prueba a suscripción paga',
      };
    }

    // Validar response de DB con Zod
    const responseValidation = safeValidateTrialSubscription(data);

    if (!responseValidation.success) {
      console.error('[TrialService] Invalid trial data from DB:', responseValidation.error);
      return {
        success: false,
        error: 'Datos de suscripción inválidos recibidos de la base de datos',
      };
    }

    const subscription = responseValidation.data;

    console.log('[TrialService] Trial converted to paid:', {
      subscriptionId,
      stripeSubscriptionId,
      newPeriodStart: subscription.current_period_start,
      newPeriodEnd: subscription.current_period_end,
    });

    return {
      success: true,
      subscription,
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error('[TrialService] Validation error:', err.errors);
      return {
        success: false,
        error: 'Error de validación en los datos',
      };
    }

    console.error('[TrialService] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error inesperado al convertir la prueba',
    };
  }
}

/**
 * Finaliza un trial sin convertir (cuando usuario canceló durante trial)
 */
export async function endTrialWithoutConversion(
  subscriptionId: string
): Promise<TrialCancellationResult> {
  try {
    // Validar input con Zod
    const UUIDSchema = z.string().uuid('subscriptionId debe ser un UUID válido');
    const inputValidation = UUIDSchema.safeParse(subscriptionId);

    if (!inputValidation.success) {
      return {
        success: false,
        error: 'subscriptionId inválido: debe ser un UUID',
      };
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .rpc('end_trial_without_conversion', {
        p_subscription_id: subscriptionId,
      })
      .single();

    if (error) {
      console.error('[TrialService] Error ending trial:', error);
      return {
        success: false,
        error: error.message || 'Error al finalizar la prueba gratuita',
      };
    }

    // Validar response de DB con Zod
    const responseValidation = safeValidateTrialSubscription(data);

    if (!responseValidation.success) {
      console.error('[TrialService] Invalid trial data from DB:', responseValidation.error);
      return {
        success: false,
        error: 'Datos de suscripción inválidos recibidos de la base de datos',
      };
    }

    const subscription = responseValidation.data;

    console.log('[TrialService] Trial ended without conversion:', {
      subscriptionId,
      cancelledAt: subscription.cancelled_at,
    });

    return {
      success: true,
      subscription,
      message: 'Prueba gratuita finalizada. Gracias por probar TIS TIS.',
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error('[TrialService] Validation error:', err.errors);
      return {
        success: false,
        error: 'Error de validación en los datos',
      };
    }

    console.error('[TrialService] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error inesperado al finalizar la prueba',
    };
  }
}

/**
 * Obtiene la suscripción de trial activa de un cliente
 * @throws Error si hay un error de DB (no si simplemente no existe trial)
 */
export async function getActiveTrialForClient(
  clientId: string
): Promise<TrialSubscription | null> {
  try {
    // Validar input con Zod
    const UUIDSchema = z.string().uuid('clientId debe ser un UUID válido');
    const inputValidation = UUIDSchema.safeParse(clientId);

    if (!inputValidation.success) {
      throw new Error('clientId inválido: debe ser un UUID');
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('client_id', clientId)
      .eq('trial_status', 'active')
      .eq('status', 'trialing')
      .single();

    if (error) {
      // PGRST116 = No rows found (es OK, no es un error)
      if (error.code === 'PGRST116') {
        return null;
      }

      // Cualquier otro error es CRÍTICO
      console.error('[TrialService] Database error getting active trial:', error);
      throw new Error(`Error al obtener trial activo: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    // Validar datos con Zod
    const responseValidation = safeValidateTrialSubscription(data);

    if (!responseValidation.success) {
      console.error('[TrialService] Invalid trial data from DB:', responseValidation.error);
      throw new Error('Datos de suscripción corruptos en la base de datos');
    }

    return responseValidation.data;
  } catch (err) {
    // Re-lanzar el error si ya es nuestro error custom
    if (err instanceof Error && err.message.startsWith('Error al obtener trial activo')) {
      throw err;
    }

    if (err instanceof Error && err.message.includes('corruptos')) {
      throw err;
    }

    console.error('[TrialService] Unexpected error:', err);
    throw new Error('Error inesperado al obtener trial activo');
  }
}

/**
 * Calcula días restantes de trial
 * Usa Math.floor para evitar reportar días extra (si faltan 2.9 días = 2 días, no 3)
 * @param trialEnd - Timestamp ISO 8601 de fin del trial
 * @returns Número de días completos restantes (mínimo 0)
 */
export function calculateDaysRemaining(trialEnd: string): number {
  // Validar que trialEnd es una fecha válida
  const end = new Date(trialEnd);
  if (isNaN(end.getTime())) {
    console.error('[TrialService] Invalid trialEnd date:', trialEnd);
    return 0;
  }

  const now = new Date();
  const diffMs = end.getTime() - now.getTime();

  // Si ya expiró, retornar 0
  if (diffMs <= 0) {
    return 0;
  }

  // Usar Math.floor para no reportar días extra
  // Ejemplo: Si faltan 0.9 días (21.6 horas) → 0 días restantes
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Verifica si un trial ha expirado
 */
export function isTrialExpired(trialEnd: string): boolean {
  return new Date(trialEnd) < new Date();
}

// ======================
// EXPORTS
// ======================

export const TrialService = {
  activateFreeTrial,
  cancelTrial,
  getTrialsExpiringToday,
  convertTrialToPaid,
  endTrialWithoutConversion,
  getActiveTrialForClient,
  calculateDaysRemaining,
  isTrialExpired,
};

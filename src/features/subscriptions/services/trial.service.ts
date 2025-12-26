// =====================================================
// TIS TIS PLATFORM - Trial Service
// Servicio para gestionar pruebas gratuitas de 10 días
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';

// ======================
// TYPES
// ======================

export interface TrialSubscription {
  id: string;
  client_id: string;
  plan: string;
  monthly_amount: number;
  currency: string;
  status: 'trialing' | 'active' | 'cancelled';
  trial_start: string;
  trial_end: string;
  trial_status: 'active' | 'ended' | 'converted' | 'cancelled';
  will_convert_to_paid: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrialActivationResult {
  success: boolean;
  subscription?: TrialSubscription;
  error?: string;
  daysRemaining?: number;
}

export interface TrialCancellationResult {
  success: boolean;
  subscription?: TrialSubscription;
  error?: string;
  message?: string;
}

export interface TrialExpiringToday {
  subscription_id: string;
  client_id: string;
  trial_end: string;
  will_convert_to_paid: boolean;
  client_email: string;
  client_name: string;
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
    const supabase = createServerClient();

    // Validar que solo plan starter puede tener trial
    if (plan !== 'starter') {
      return {
        success: false,
        error: 'Solo el plan Starter puede tener prueba gratuita',
      };
    }

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

    const subscription = data as TrialSubscription;

    // Calcular días restantes
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const daysRemaining = Math.ceil(
      (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    console.log('[TrialService] Trial activated:', {
      subscriptionId: subscription.id,
      clientId,
      daysRemaining,
    });

    return {
      success: true,
      subscription,
      daysRemaining,
    };
  } catch (err: any) {
    console.error('[TrialService] Unexpected error:', err);
    return {
      success: false,
      error: err.message || 'Error inesperado al activar la prueba gratuita',
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

    const subscription = data as TrialSubscription;

    console.log('[TrialService] Trial cancelled:', {
      subscriptionId,
      willConvertToPaid: subscription.will_convert_to_paid,
    });

    return {
      success: true,
      subscription,
      message:
        'Prueba gratuita cancelada. Puedes seguir usando TIS TIS hasta el final de tu período de prueba.',
    };
  } catch (err: any) {
    console.error('[TrialService] Unexpected error:', err);
    return {
      success: false,
      error: err.message || 'Error inesperado al cancelar la prueba gratuita',
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

    return data || [];
  } catch (err: any) {
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

    const subscription = data as TrialSubscription;

    console.log('[TrialService] Trial converted to paid:', {
      subscriptionId,
      stripeSubscriptionId,
    });

    return {
      success: true,
      subscription,
    };
  } catch (err: any) {
    console.error('[TrialService] Unexpected error:', err);
    return {
      success: false,
      error: err.message || 'Error inesperado al convertir la prueba',
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

    const subscription = data as TrialSubscription;

    console.log('[TrialService] Trial ended without conversion:', {
      subscriptionId,
    });

    return {
      success: true,
      subscription,
      message: 'Prueba gratuita finalizada. Gracias por probar TIS TIS.',
    };
  } catch (err: any) {
    console.error('[TrialService] Unexpected error:', err);
    return {
      success: false,
      error: err.message || 'Error inesperado al finalizar la prueba',
    };
  }
}

/**
 * Obtiene la suscripción de trial activa de un cliente
 */
export async function getActiveTrialForClient(
  clientId: string
): Promise<TrialSubscription | null> {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('client_id', clientId)
      .eq('trial_status', 'active')
      .eq('status', 'trialing')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('[TrialService] Error getting active trial:', error);
      return null;
    }

    return data as TrialSubscription;
  } catch (err: any) {
    console.error('[TrialService] Unexpected error:', err);
    return null;
  }
}

/**
 * Calcula días restantes de trial
 */
export function calculateDaysRemaining(trialEnd: string): number {
  const end = new Date(trialEnd);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
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

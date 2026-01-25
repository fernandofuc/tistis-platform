// =====================================================
// TIS TIS PLATFORM - Voice Minute Limit Service
// Servicio para gestión de límites de minutos
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  VoiceMinuteLimits,
  VoiceMinuteLimitsInput,
  CheckMinuteLimitResult,
  RecordMinuteUsageResult,
  MinuteUsageSummary,
  VoiceMinuteTransaction,
} from '../types';

// =====================================================
// SUPABASE CLIENT
// =====================================================

function createServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// =====================================================
// CONFIGURACIÓN DE LÍMITES
// =====================================================

/**
 * Obtener configuración de límites de un tenant
 */
export async function getMinuteLimits(tenantId: string): Promise<VoiceMinuteLimits | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('voice_minute_limits')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    console.error('[MinuteLimitService] Error getting limits:', error);
    return null;
  }

  return data as VoiceMinuteLimits | null;
}

/**
 * Crear configuración de límites para un tenant
 * Normalmente se crea automáticamente por el RPC check_minute_limit
 */
export async function createMinuteLimits(tenantId: string): Promise<VoiceMinuteLimits | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('voice_minute_limits')
    .insert({ tenant_id: tenantId })
    .select()
    .single();

  if (error) {
    console.error('[MinuteLimitService] Error creating limits:', error);
    return null;
  }

  return data as VoiceMinuteLimits;
}

/**
 * Actualizar configuración de límites
 */
export async function updateMinuteLimits(
  tenantId: string,
  updates: VoiceMinuteLimitsInput
): Promise<VoiceMinuteLimits | null> {
  const supabase = createServerClient();

  // Validar overage_policy
  if (updates.overage_policy && !['block', 'charge', 'notify_only'].includes(updates.overage_policy)) {
    console.error('[MinuteLimitService] Invalid overage_policy:', updates.overage_policy);
    return null;
  }

  // Validar included_minutes (debe ser positivo)
  if (updates.included_minutes !== undefined && updates.included_minutes < 0) {
    console.error('[MinuteLimitService] Invalid included_minutes:', updates.included_minutes);
    return null;
  }

  // Validar overage_price_centavos (debe ser no-negativo)
  if (updates.overage_price_centavos !== undefined && updates.overage_price_centavos < 0) {
    console.error('[MinuteLimitService] Invalid overage_price_centavos:', updates.overage_price_centavos);
    return null;
  }

  // Validar alert_thresholds
  if (updates.alert_thresholds) {
    const validThresholds = updates.alert_thresholds.every(
      (t) => typeof t === 'number' && t >= 0 && t <= 100
    );
    if (!validThresholds) {
      console.error('[MinuteLimitService] Invalid alert_thresholds:', updates.alert_thresholds);
      return null;
    }
  }

  // Validar max_overage_charge_centavos
  if (updates.max_overage_charge_centavos !== undefined && updates.max_overage_charge_centavos < 0) {
    console.error('[MinuteLimitService] Invalid max_overage_charge_centavos:', updates.max_overage_charge_centavos);
    return null;
  }

  const { data, error } = await supabase
    .from('voice_minute_limits')
    .update(updates)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    console.error('[MinuteLimitService] Error updating limits:', error);
    return null;
  }

  return data as VoiceMinuteLimits;
}

/**
 * Actualizar política de overage usando RPC
 * Esto también desbloquea períodos si cambia a charge/notify_only
 */
export async function updateOveragePolicy(
  tenantId: string,
  policy: 'block' | 'charge' | 'notify_only'
): Promise<{ success: boolean; error?: string; periods_unblocked?: number }> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('update_minute_limit_policy', {
    p_tenant_id: tenantId,
    p_overage_policy: policy,
  });

  if (error) {
    console.error('[MinuteLimitService] Error updating policy:', error);
    return { success: false, error: error.message };
  }

  return {
    success: data?.success ?? false,
    error: data?.error,
    periods_unblocked: data?.periods_unblocked,
  };
}

// =====================================================
// VALIDACIÓN DE LÍMITES
// =====================================================

/**
 * Verificar si un tenant puede realizar una llamada
 * CRÍTICO: Llamar ANTES de procesar cada llamada
 *
 * Este RPC:
 * - Verifica que el tenant tiene plan Growth
 * - Crea configuración de límites si no existe
 * - Crea registro de uso del período actual si no existe
 * - Retorna si puede proceder y detalles del uso
 */
export async function checkMinuteLimit(tenantId: string): Promise<CheckMinuteLimitResult> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('check_minute_limit', {
    p_tenant_id: tenantId,
  });

  if (error) {
    console.error('[MinuteLimitService] Error checking limit:', error);

    // Default: bloquear si hay error (fail-safe)
    // Usamos UUID "nil" para indicar que no hay registro válido
    const nilUUID = '00000000-0000-0000-0000-000000000000';
    const now = new Date().toISOString();

    return {
      can_proceed: false,
      policy: 'block',
      included_minutes: 0,
      included_used: 0,
      overage_used: 0,
      remaining_included: 0,
      total_used: 0,
      is_blocked: true,
      block_reason: 'Error al verificar límites. Por favor intenta de nuevo.',
      error: error.message,
      error_code: 'RPC_ERROR',
      overage_price_centavos: 0,
      current_overage_charges: 0,
      max_overage_charge: 0,
      usage_id: nilUUID,
      usage_percent: 0,
      billing_period_start: now,
      billing_period_end: now,
    };
  }

  return data as CheckMinuteLimitResult;
}

/**
 * Registrar uso de minutos después de una llamada
 * CRÍTICO: Llamar DESPUÉS de cada llamada completada
 *
 * Este RPC:
 * - Distribuye minutos entre incluidos y overage
 * - Calcula cargos según política
 * - Registra transacción detallada
 * - Dispara alertas si se alcanzan umbrales
 * - Bloquea si se excede max_overage_charge
 */
export async function recordMinuteUsage(
  tenantId: string,
  callId: string,
  secondsUsed: number,
  callMetadata?: Record<string, unknown>
): Promise<RecordMinuteUsageResult> {
  const supabase = createServerClient();

  // Validar input
  if (secondsUsed <= 0) {
    return {
      success: false,
      error: 'seconds_used must be greater than 0',
      error_code: 'INVALID_INPUT',
    };
  }

  const { data, error } = await supabase.rpc('record_minute_usage', {
    p_tenant_id: tenantId,
    p_call_id: callId,
    p_seconds_used: secondsUsed,
    p_call_metadata: callMetadata || {},
  });

  if (error) {
    console.error('[MinuteLimitService] Error recording usage:', error);
    return {
      success: false,
      error: error.message,
      error_code: 'RPC_ERROR',
    };
  }

  return data as RecordMinuteUsageResult;
}

// =====================================================
// RESUMEN DE USO
// =====================================================

/**
 * Obtener resumen de uso para dashboard
 *
 * Este RPC retorna toda la información necesaria para mostrar
 * el widget de uso de minutos en el dashboard
 */
export async function getUsageSummary(tenantId: string): Promise<MinuteUsageSummary | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('get_minute_usage_summary', {
    p_tenant_id: tenantId,
  });

  if (error) {
    console.error('[MinuteLimitService] Error getting summary:', error);
    return null;
  }

  // Verificar si hay error en la respuesta
  if (data?.error) {
    console.error('[MinuteLimitService] RPC returned error:', data.error);
    return null;
  }

  return data as MinuteUsageSummary;
}

/**
 * Obtener historial de transacciones
 */
export async function getUsageHistory(
  tenantId: string,
  limit: number = 50,
  offset: number = 0
): Promise<VoiceMinuteTransaction[]> {
  const supabase = createServerClient();

  // Validar y sanitizar parámetros
  const safeLimit = Math.max(1, Math.min(limit, 100)); // Entre 1 y 100
  const safeOffset = Math.max(0, offset);

  const { data, error } = await supabase
    .from('voice_minute_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('recorded_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error) {
    console.error('[MinuteLimitService] Error getting history:', error);
    return [];
  }

  return data as VoiceMinuteTransaction[];
}

/**
 * Obtener transacciones de un período específico
 */
export async function getUsageByPeriod(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<VoiceMinuteTransaction[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('voice_minute_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('recorded_at', periodStart.toISOString())
    .lte('recorded_at', periodEnd.toISOString())
    .order('recorded_at', { ascending: false });

  if (error) {
    console.error('[MinuteLimitService] Error getting period usage:', error);
    return [];
  }

  return data as VoiceMinuteTransaction[];
}

/**
 * Obtener transacciones de overage no facturadas
 */
export async function getUnbilledOverageTransactions(
  tenantId: string
): Promise<VoiceMinuteTransaction[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('voice_minute_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_overage', true)
    .is('stripe_invoice_item_id', null)
    .order('recorded_at', { ascending: true });

  if (error) {
    console.error('[MinuteLimitService] Error getting unbilled transactions:', error);
    return [];
  }

  return data as VoiceMinuteTransaction[];
}

// =====================================================
// UTILIDADES
// =====================================================

/**
 * Formatear minutos para display
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 1) {
    const seconds = Math.round(minutes * 60);
    return `${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }

  return `${mins} min`;
}

/**
 * Formatear precio en MXN
 */
export function formatPriceMXN(centavos: number): string {
  const pesos = centavos / 100;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(pesos);
}

/**
 * Calcular costo de overage (redondeo por minuto)
 */
export function calculateOverageCost(
  minutes: number,
  pricePerMinuteCentavos: number
): number {
  return Math.ceil(minutes) * pricePerMinuteCentavos;
}

/**
 * Calcular porcentaje de uso
 * Retorna valor con 1 decimal de precisión
 */
export function calculateUsagePercent(
  used: number,
  included: number
): number {
  if (included <= 0) return 0;
  // Usar multiplicación por 1000 primero para evitar problemas de precisión flotante
  return Math.round((used / included) * 1000) / 10;
}

/**
 * Determinar color de progreso basado en porcentaje
 */
export function getUsageProgressColor(percent: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (percent < 70) return 'green';
  if (percent < 85) return 'yellow';
  if (percent < 95) return 'orange';
  return 'red';
}

/**
 * Obtener mensaje según política de overage
 */
export function getOveragePolicyMessage(policy: string, pricePesos: number): string {
  switch (policy) {
    case 'block':
      return 'Las llamadas serán rechazadas al exceder el límite.';
    case 'charge':
      return `Se cobrará $${pricePesos.toFixed(2)} MXN por cada minuto adicional.`;
    case 'notify_only':
      return 'Las llamadas continuarán sin cargo adicional.';
    default:
      return 'Política no configurada.';
  }
}

// =====================================================
// EXPORTS
// =====================================================

export const MinuteLimitService = {
  // Config
  getMinuteLimits,
  createMinuteLimits,
  updateMinuteLimits,
  updateOveragePolicy,

  // Validation
  checkMinuteLimit,
  recordMinuteUsage,

  // Summary
  getUsageSummary,
  getUsageHistory,
  getUsageByPeriod,
  getUnbilledOverageTransactions,

  // Utils
  formatMinutes,
  formatPriceMXN,
  calculateOverageCost,
  calculateUsagePercent,
  getUsageProgressColor,
  getOveragePolicyMessage,
};

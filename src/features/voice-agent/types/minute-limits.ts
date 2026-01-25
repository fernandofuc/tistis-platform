// =====================================================
// TIS TIS PLATFORM - Voice Minute Limits Types
// Sistema de límites de minutos para Voice Agent
// =====================================================

// =====================================================
// CONFIGURACIÓN DE LÍMITES
// =====================================================

export type OveragePolicy = 'block' | 'charge' | 'notify_only';

export interface VoiceMinuteLimits {
  id: string;
  tenant_id: string;

  // Límites
  included_minutes: number;
  overage_price_centavos: number;
  overage_policy: OveragePolicy;
  max_overage_charge_centavos: number;

  // Alertas
  alert_thresholds: number[];
  email_alerts_enabled: boolean;
  push_alerts_enabled: boolean;
  webhook_alerts_enabled: boolean;
  webhook_url: string | null;

  // Stripe
  stripe_meter_id: string | null;
  stripe_price_id: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface VoiceMinuteLimitsInput {
  overage_policy?: OveragePolicy;
  max_overage_charge_centavos?: number;
  alert_thresholds?: number[];
  email_alerts_enabled?: boolean;
  push_alerts_enabled?: boolean;
  webhook_alerts_enabled?: boolean;
  webhook_url?: string;
}

// =====================================================
// TRACKING DE USO
// =====================================================

export interface VoiceMinuteUsage {
  id: string;
  tenant_id: string;

  // Período
  billing_period_start: string;
  billing_period_end: string;

  // Uso
  included_minutes_used: number;
  overage_minutes_used: number;
  overage_charges_centavos: number;

  // Alertas
  last_alert_threshold: number;
  last_alert_sent_at: string | null;

  // Estado
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_reason: string | null;

  // Stripe
  stripe_invoice_id: string | null;
  stripe_usage_record_id: string | null;

  // Stats
  total_calls: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// =====================================================
// TRANSACCIONES
// =====================================================

export interface VoiceMinuteTransaction {
  id: string;
  tenant_id: string;
  usage_id: string;
  call_id: string | null;

  minutes_used: number;
  seconds_used: number;
  is_overage: boolean;
  charge_centavos: number;

  call_metadata: Record<string, unknown>;
  stripe_invoice_item_id: string | null;

  recorded_at: string;
  created_at: string;
}

// =====================================================
// RESPUESTAS DE RPC
// =====================================================

export interface CheckMinuteLimitResult {
  can_proceed: boolean;
  policy: OveragePolicy;
  included_minutes: number;
  included_used: number;
  overage_used: number;
  remaining_included: number;
  total_used: number;
  is_blocked: boolean;
  /** Razón del bloqueo si is_blocked=true (del SQL: block_reason) */
  block_reason?: string;
  overage_price_centavos: number;
  current_overage_charges: number;
  max_overage_charge: number;
  usage_id: string;
  usage_percent: number;
  billing_period_start: string;
  billing_period_end: string;
  error?: string;
  error_code?: string;
}

export interface RecordMinuteUsageResult {
  success: boolean;
  error?: string;
  error_code?: string;
  transaction_id?: string;
  minutes_recorded?: number;
  seconds_recorded?: number;
  minutes_to_included?: number;
  minutes_to_overage?: number;
  is_overage?: boolean;
  charge_centavos?: number;
  charge_pesos?: number;
  total_included_used?: number;
  total_overage_used?: number;
  total_overage_charges_centavos?: number;
  total_overage_charges_pesos?: number;
  usage_percent?: number;
  remaining_included?: number;
  alert_threshold_triggered?: number | null;
  is_blocked?: boolean;
}

export interface MinuteUsageSummary {
  // Límites configurados
  included_minutes: number;
  overage_policy: OveragePolicy;
  overage_price_centavos: number;
  overage_price_pesos: number;
  max_overage_charge_centavos: number;
  max_overage_charge_pesos: number;
  alert_thresholds: number[];

  // Uso actual
  included_minutes_used: number;
  overage_minutes_used: number;
  total_minutes_used: number;
  remaining_included: number;

  // Porcentaje y estado
  usage_percent: number;
  is_at_limit: boolean;
  is_blocked: boolean;

  // Cargos
  overage_charges_centavos: number;
  overage_charges_pesos: number;

  // Período
  billing_period_start: string;
  billing_period_end: string;
  days_remaining: number;
  days_elapsed: number;
  days_total: number;

  // Stats
  total_calls: number;
  avg_call_duration: number;
  last_alert_threshold: number;

  // Config
  email_alerts_enabled: boolean;
  push_alerts_enabled: boolean;

  // Error handling
  error?: string;
  error_code?: string;
}

// =====================================================
// ALERTAS
// =====================================================

export type AlertThreshold = 70 | 85 | 95 | 100;

export interface MinuteAlert {
  threshold: AlertThreshold;
  tenant_id: string;
  tenant_name: string;
  email: string;
  current_usage: number;
  included_minutes: number;
  remaining_minutes: number;
  overage_policy: OveragePolicy;
  overage_price_pesos: number;
}

// =====================================================
// CONSTANTES
// =====================================================

export const DEFAULT_INCLUDED_MINUTES = 200;
export const DEFAULT_OVERAGE_PRICE_CENTAVOS = 350; // $3.50 MXN
export const DEFAULT_MAX_OVERAGE_CHARGE_CENTAVOS = 200000; // $2,000 MXN
export const DEFAULT_ALERT_THRESHOLDS: AlertThreshold[] = [70, 85, 95, 100];

export const ALERT_MESSAGES: Record<AlertThreshold, string> = {
  70: 'Has usado el 70% de tus minutos incluidos de Voice Agent.',
  85: 'Has usado el 85% de tus minutos incluidos. Considera revisar tu uso.',
  95: '¡Atención! Has usado el 95% de tus minutos. Estás cerca del límite.',
  100: 'Has alcanzado el límite de minutos incluidos en tu plan.',
};

export const ALERT_SUBJECTS: Record<AlertThreshold, string> = {
  70: '📊 Voice Agent: 70% de minutos utilizados',
  85: '⚠️ Voice Agent: 85% de minutos utilizados',
  95: '🚨 Voice Agent: ¡Solo 5% de minutos restantes!',
  100: '🔴 Voice Agent: Límite de minutos alcanzado',
};

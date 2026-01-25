// =====================================================
// TIS TIS PLATFORM - Secure Booking System Types
// Type definitions for the secure booking system
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/167_SECURE_BOOKING_SYSTEM.sql
// - RPC: create_booking_hold, check_customer_blocked, get_customer_trust_score,
//        record_customer_penalty, convert_hold_to_appointment, release_booking_hold,
//        cleanup_expired_holds, update_trust_score, unblock_expired_customers
// =====================================================

// ======================
// BOOKING HOLD TYPES
// ======================

export type HoldType = 'voice_call' | 'chat_session' | 'manual';

export type HoldStatus = 'active' | 'converted' | 'expired' | 'released';

export interface BookingHold {
  id: string;
  tenant_id: string;
  branch_id: string | null;

  // Slot info
  slot_datetime: string;
  duration_minutes: number;
  end_datetime: string; // Generated column

  // Hold metadata
  hold_type: HoldType;
  session_id: string;
  customer_phone: string | null;
  customer_name: string | null;

  // Optional associations
  lead_id: string | null;
  service_id: string | null;
  staff_id: string | null;

  // Status tracking
  status: HoldStatus;
  expires_at: string;
  converted_to_id: string | null;
  converted_at: string | null;
  released_at: string | null;
  release_reason: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface BookingHoldFormData {
  branch_id?: string | null;
  slot_datetime: string;
  duration_minutes: number;
  hold_type: HoldType;
  session_id: string;
  customer_phone?: string | null;
  customer_name?: string | null;
  lead_id?: string | null;
  service_id?: string | null;
  staff_id?: string | null;
  hold_minutes?: number; // Duration of the hold (default 15)
}

// ======================
// CUSTOMER TRUST TYPES
// ======================

export interface CustomerTrustScore {
  id: string;
  tenant_id: string;
  lead_id: string;

  // Score principal (0-100)
  trust_score: number;

  // Violation counters
  no_shows: number;
  no_pickups: number;
  late_cancellations: number;
  confirmed_no_response: number;

  // Positive counters
  total_bookings: number;
  completed_bookings: number;
  on_time_pickups: number;

  // VIP status
  is_vip: boolean;
  vip_reason: string | null;
  vip_set_at: string | null;
  vip_set_by: string | null;

  // Block status (cached from customer_blocks)
  is_blocked: boolean;
  block_reason: string | null;
  blocked_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface TrustScoreView {
  trust_score: number;
  is_blocked: boolean;
  is_vip: boolean;
  no_shows: number;
  no_pickups: number;
  total_bookings: number;
  completed_bookings: number;
  requires_confirmation: boolean;
  requires_deposit: boolean;
  error?: string;
}

// ======================
// CUSTOMER PENALTY TYPES
// ======================

export type ViolationType =
  | 'no_show'
  | 'no_pickup'
  | 'late_cancellation'
  | 'no_confirmation'
  | 'abuse'
  | 'fraud'
  | 'other';

export type ReferenceType = 'appointment' | 'order' | 'reservation';

export interface CustomerPenalty {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  phone_number: string | null;

  // Violation
  violation_type: ViolationType;
  reference_type: ReferenceType;
  reference_id: string;

  // Severity (1-5)
  severity: number;
  strike_count: number;
  description: string | null;

  // Resolution
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  expires_at: string | null;

  // Timestamps
  created_at: string;
}

export interface PenaltyFormData {
  lead_id?: string | null;
  phone_number: string;
  violation_type: ViolationType;
  reference_type: ReferenceType;
  reference_id: string;
  severity?: number;
  description?: string | null;
}

// ======================
// CUSTOMER BLOCK TYPES
// ======================

export type BlockReason =
  | 'auto_no_shows'
  | 'auto_no_pickups'
  | 'auto_late_cancellations'
  | 'auto_low_trust'
  | 'manual_abuse'
  | 'manual_fraud'
  | 'manual_other';

export type BlockedByType = 'system' | 'staff';

export interface CustomerBlock {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  phone_number: string;

  // Block reason
  block_reason: BlockReason;
  block_details: string | null;

  // Who blocked
  blocked_by_type: BlockedByType;
  blocked_by_user_id: string | null;

  // Status and expiration
  is_active: boolean;
  unblock_at: string | null;
  unblocked_at: string | null;
  unblocked_by: string | null;
  unblock_reason: string | null;

  // Audit
  created_at: string;
  updated_at: string;
}

export interface BlockFormData {
  lead_id?: string | null;
  phone_number: string;
  block_reason: BlockReason;
  block_details?: string | null;
  unblock_at?: string | null; // NULL = permanent
}

export interface BlockCheckResult {
  is_blocked: boolean;
  block_reason?: BlockReason;
  block_details?: string;
  blocked_at?: string;
  unblock_at?: string | null;
  error?: string;
}

// ======================
// BOOKING CONFIRMATION TYPES
// ======================

export type ConfirmationType =
  | 'voice_to_message'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'deposit_required'
  | 'custom';

export type ConfirmationChannel = 'whatsapp' | 'sms' | 'email';

export type ConfirmationStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'responded'
  | 'expired'
  | 'failed';

export type ConfirmationResponse = 'confirmed' | 'cancelled' | 'need_change' | 'other';

export type AutoActionOnExpire = 'cancel' | 'keep' | 'notify_staff';

export interface BookingConfirmation {
  id: string;
  tenant_id: string;

  // Reference (polymorphic)
  reference_type: ReferenceType;
  reference_id: string;

  // Confirmation type and channel
  confirmation_type: ConfirmationType;
  sent_via: ConfirmationChannel;

  // Status
  status: ConfirmationStatus;

  // Timestamps
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  responded_at: string | null;
  expires_at: string;

  // Response
  response: ConfirmationResponse | null;
  response_raw: string | null;

  // WhatsApp tracking
  whatsapp_message_id: string | null;
  whatsapp_template_name: string | null;
  conversation_id: string | null;

  // Auto-action
  auto_action_on_expire: AutoActionOnExpire;
  auto_action_executed: boolean;
  auto_action_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface ConfirmationFormData {
  reference_type: ReferenceType;
  reference_id: string;
  confirmation_type: ConfirmationType;
  sent_via: ConfirmationChannel;
  expires_at: string;
  auto_action_on_expire?: AutoActionOnExpire;
}

// ======================
// BOOKING POLICY TYPES
// ======================

export interface VerticalBookingPolicy {
  id: string;
  tenant_id: string;

  // Policy scope
  vertical: string;
  branch_id: string | null;

  // Trust score thresholds
  trust_threshold_confirmation: number;
  trust_threshold_deposit: number;
  trust_threshold_block: number;

  // Penalty scores
  penalty_no_show: number;
  penalty_no_pickup: number;
  penalty_late_cancel: number;
  penalty_no_confirmation: number;

  // Reward scores
  reward_completed: number;
  reward_on_time: number;

  // Auto-block rules
  auto_block_no_shows: number;
  auto_block_no_pickups: number;
  auto_block_duration_hours: number;

  // Hold configuration
  hold_duration_minutes: number;
  hold_buffer_minutes: number;

  // Confirmation requirements
  require_confirmation_below_trust: boolean;
  confirmation_timeout_hours: number;
  confirmation_reminder_hours: number;

  // Deposit configuration
  require_deposit_below_trust: boolean;
  deposit_amount_cents: number;
  deposit_percent_of_service: number | null;

  // Active/Default
  is_active: boolean;
  is_default: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface PolicyFormData {
  vertical: string;
  branch_id?: string | null;

  // Thresholds
  trust_threshold_confirmation?: number;
  trust_threshold_deposit?: number;
  trust_threshold_block?: number;

  // Penalties
  penalty_no_show?: number;
  penalty_no_pickup?: number;
  penalty_late_cancel?: number;
  penalty_no_confirmation?: number;

  // Rewards
  reward_completed?: number;
  reward_on_time?: number;

  // Auto-block
  auto_block_no_shows?: number;
  auto_block_no_pickups?: number;
  auto_block_duration_hours?: number;

  // Hold config
  hold_duration_minutes?: number;
  hold_buffer_minutes?: number;

  // Confirmation
  require_confirmation_below_trust?: boolean;
  confirmation_timeout_hours?: number;
  confirmation_reminder_hours?: number;

  // Deposit
  require_deposit_below_trust?: boolean;
  deposit_amount_cents?: number;
  deposit_percent_of_service?: number | null;

  // Active
  is_active?: boolean;
  is_default?: boolean;
}

// ======================
// BOOKING DEPOSIT TYPES
// ======================

export type DepositStatus =
  | 'pending'
  | 'paid'
  | 'refunded'
  | 'forfeited'
  | 'applied'
  | 'failed'
  | 'expired';

export type DepositCurrency = 'mxn' | 'usd' | 'eur';

export interface BookingDeposit {
  id: string;
  tenant_id: string;

  // Reference
  reference_type: ReferenceType;
  reference_id: string;
  lead_id: string | null;

  // Stripe info
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_charge_id: string | null;
  stripe_customer_id: string | null;
  stripe_refund_id: string | null;
  idempotency_key: string | null;
  webhook_event_id: string | null;

  // Amounts
  amount_cents: number;
  refund_amount_cents: number | null;
  currency: DepositCurrency;

  // Metadata
  stripe_metadata: Record<string, unknown>;

  // Status
  status: DepositStatus;

  // Payment link
  payment_link_url: string | null;
  payment_link_expires_at: string | null;

  // Timestamps
  created_at: string;
  paid_at: string | null;
  processed_at: string | null;
  updated_at: string;
}

export interface DepositFormData {
  reference_type: ReferenceType;
  reference_id: string;
  lead_id?: string | null;
  amount_cents: number;
  currency?: DepositCurrency;
  stripe_metadata?: Record<string, unknown>;
}

// ======================
// RPC RESPONSE TYPES
// ======================

export interface CreateHoldResult {
  success: boolean;
  hold_id?: string;
  expires_at?: string;
  error?: string;
  message?: string;
  existing_hold_id?: string;
  existing_appointment_id?: string;
}

export interface RecordPenaltyResult {
  success: boolean;
  penalty_id?: string | null;
  strike_count?: number;
  score_change?: number;
  new_score?: number;
  auto_blocked?: boolean;
  vip_bypass?: boolean;
  error?: string;
  message?: string;
}

// ======================
// API RESPONSE TYPES
// ======================

export interface HoldsResponse {
  success: boolean;
  data: BookingHold[];
  error?: string;
}

export interface HoldResponse {
  success: boolean;
  data: BookingHold;
  error?: string;
}

export interface TrustScoreResponse {
  success: boolean;
  data: TrustScoreView;
  error?: string;
}

export interface BlocksResponse {
  success: boolean;
  data: CustomerBlock[];
  error?: string;
}

export interface BlockResponse {
  success: boolean;
  data: CustomerBlock;
  error?: string;
}

export interface PenaltiesResponse {
  success: boolean;
  data: CustomerPenalty[];
  error?: string;
}

export interface PoliciesResponse {
  success: boolean;
  data: VerticalBookingPolicy[];
  error?: string;
}

export interface PolicyResponse {
  success: boolean;
  data: VerticalBookingPolicy;
  error?: string;
}

export interface ConfirmationsResponse {
  success: boolean;
  data: BookingConfirmation[];
  error?: string;
}

// ======================
// CONFIGURATION CONSTANTS
// ======================

export const HOLD_STATUS_CONFIG: Record<HoldStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Activo', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  converted: { label: 'Convertido', color: 'text-green-700', bgColor: 'bg-green-100' },
  expired: { label: 'Expirado', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  released: { label: 'Liberado', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
};

export const HOLD_TYPE_CONFIG: Record<HoldType, { label: string; icon: string }> = {
  voice_call: { label: 'Llamada de voz', icon: 'Phone' },
  chat_session: { label: 'Chat/WhatsApp', icon: 'MessageSquare' },
  manual: { label: 'Manual', icon: 'Hand' },
};

export const TRUST_SCORE_CONFIG = {
  high: { min: 80, label: 'Alto', color: 'text-green-700', bgColor: 'bg-green-100' },
  medium: { min: 50, label: 'Medio', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  low: { min: 30, label: 'Bajo', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  critical: { min: 0, label: 'Critico', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export const VIOLATION_TYPE_CONFIG: Record<ViolationType, { label: string; severity: number; icon: string }> = {
  no_show: { label: 'No se presento', severity: 4, icon: 'UserX' },
  no_pickup: { label: 'No recogio', severity: 5, icon: 'Package' },
  late_cancellation: { label: 'Cancelacion tardia', severity: 3, icon: 'Clock' },
  no_confirmation: { label: 'Sin confirmacion', severity: 2, icon: 'AlertCircle' },
  abuse: { label: 'Comportamiento abusivo', severity: 5, icon: 'AlertTriangle' },
  fraud: { label: 'Intento de fraude', severity: 5, icon: 'ShieldAlert' },
  other: { label: 'Otro', severity: 2, icon: 'MoreHorizontal' },
};

export const BLOCK_REASON_CONFIG: Record<BlockReason, { label: string; isAuto: boolean }> = {
  auto_no_shows: { label: 'Automatico: No-shows', isAuto: true },
  auto_no_pickups: { label: 'Automatico: No recogidos', isAuto: true },
  auto_late_cancellations: { label: 'Automatico: Cancelaciones tardias', isAuto: true },
  auto_low_trust: { label: 'Automatico: Trust score bajo', isAuto: true },
  manual_abuse: { label: 'Manual: Abuso', isAuto: false },
  manual_fraud: { label: 'Manual: Fraude', isAuto: false },
  manual_other: { label: 'Manual: Otro', isAuto: false },
};

export const CONFIRMATION_STATUS_CONFIG: Record<ConfirmationStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pendiente', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  sent: { label: 'Enviado', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  delivered: { label: 'Entregado', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  read: { label: 'Leido', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  responded: { label: 'Respondido', color: 'text-green-700', bgColor: 'bg-green-100' },
  expired: { label: 'Expirado', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  failed: { label: 'Fallido', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export const CONFIRMATION_RESPONSE_CONFIG: Record<ConfirmationResponse, { label: string; color: string }> = {
  confirmed: { label: 'Confirmado', color: 'text-green-700' },
  cancelled: { label: 'Cancelado', color: 'text-red-700' },
  need_change: { label: 'Necesita cambio', color: 'text-yellow-700' },
  other: { label: 'Otro', color: 'text-gray-700' },
};

export const DEPOSIT_STATUS_CONFIG: Record<DepositStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pendiente', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  paid: { label: 'Pagado', color: 'text-green-700', bgColor: 'bg-green-100' },
  refunded: { label: 'Reembolsado', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  forfeited: { label: 'Perdido', color: 'text-red-700', bgColor: 'bg-red-100' },
  applied: { label: 'Aplicado', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  failed: { label: 'Fallido', color: 'text-red-700', bgColor: 'bg-red-100' },
  expired: { label: 'Expirado', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Get trust score level based on value
 */
export function getTrustScoreLevel(score: number): keyof typeof TRUST_SCORE_CONFIG {
  if (score >= TRUST_SCORE_CONFIG.high.min) return 'high';
  if (score >= TRUST_SCORE_CONFIG.medium.min) return 'medium';
  if (score >= TRUST_SCORE_CONFIG.low.min) return 'low';
  return 'critical';
}

/**
 * Format trust score for display
 */
export function formatTrustScore(score: number): string {
  const level = getTrustScoreLevel(score);
  const config = TRUST_SCORE_CONFIG[level];
  return `${score}/100 (${config.label})`;
}

/**
 * Check if customer needs confirmation based on policy
 */
export function needsConfirmation(
  trustScore: number,
  policy: VerticalBookingPolicy,
  isVip: boolean
): boolean {
  if (isVip) return false;
  return policy.require_confirmation_below_trust &&
         trustScore < policy.trust_threshold_confirmation;
}

/**
 * Check if customer needs deposit based on policy
 */
export function needsDeposit(
  trustScore: number,
  policy: VerticalBookingPolicy,
  isVip: boolean
): boolean {
  if (isVip) return false;
  return policy.require_deposit_below_trust &&
         trustScore < policy.trust_threshold_deposit;
}

/**
 * Calculate deposit amount (either fixed or percentage)
 */
export function calculateDepositAmount(
  policy: VerticalBookingPolicy,
  serviceAmountCents?: number
): number {
  if (policy.deposit_percent_of_service && serviceAmountCents) {
    return Math.ceil(serviceAmountCents * (policy.deposit_percent_of_service / 100));
  }
  return policy.deposit_amount_cents;
}

/**
 * Format currency amount
 */
export function formatCurrency(amountCents: number, currency: DepositCurrency = 'mxn'): string {
  const amount = amountCents / 100;
  const symbols: Record<DepositCurrency, string> = {
    mxn: '$',
    usd: 'US$',
    eur: '€',
  };
  return `${symbols[currency]}${amount.toFixed(2)}`;
}

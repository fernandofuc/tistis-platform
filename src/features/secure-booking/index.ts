// =====================================================
// TIS TIS PLATFORM - Secure Booking Feature
// Public API for the secure booking system
// =====================================================
//
// FEATURE: Sistema de reservaciones seguro
// - Holds temporales con advisory locks
// - Trust scores de clientes
// - Penalizaciones y bloqueos automáticos
// - Confirmaciones bidireccionales
// - Políticas configurables por vertical
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/167_SECURE_BOOKING_SYSTEM.sql
// =====================================================

// ======================
// TYPES
// ======================
export * from './types';

// Re-export commonly used types for convenience
export type {
  // Holds
  BookingHold,
  BookingHoldFormData,
  HoldType,
  HoldStatus,
  CreateHoldResult,

  // Trust
  CustomerTrustScore,
  TrustScoreView,
  CustomerPenalty,
  PenaltyFormData,
  ViolationType,

  // Blocks
  CustomerBlock,
  BlockFormData,
  BlockCheckResult,
  BlockReason,
  RecordPenaltyResult,

  // Confirmations
  BookingConfirmation,
  ConfirmationFormData,
  ConfirmationType,
  ConfirmationStatus,
  ConfirmationResponse,

  // Policies
  VerticalBookingPolicy,
  PolicyFormData,

  // Deposits
  BookingDeposit,
  DepositFormData,
  DepositStatus,
} from './types';

// ======================
// SERVICES
// ======================
export * from './services';

// ======================
// CONFIGURATION CONSTANTS
// ======================
export {
  HOLD_STATUS_CONFIG,
  HOLD_TYPE_CONFIG,
  TRUST_SCORE_CONFIG,
  VIOLATION_TYPE_CONFIG,
  BLOCK_REASON_CONFIG,
  CONFIRMATION_STATUS_CONFIG,
  CONFIRMATION_RESPONSE_CONFIG,
  DEPOSIT_STATUS_CONFIG,
} from './types';

// ======================
// HELPER FUNCTIONS
// ======================
export {
  getTrustScoreLevel,
  formatTrustScore,
  needsConfirmation,
  needsDeposit,
  calculateDepositAmount,
  formatCurrency,
} from './types';

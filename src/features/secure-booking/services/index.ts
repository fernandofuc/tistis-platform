// =====================================================
// TIS TIS PLATFORM - Secure Booking Services
// Barrel export for all secure booking services
// =====================================================

// Booking Holds
export * as bookingHoldService from './booking-hold.service';
export {
  getActiveHolds,
  getHolds,
  getHold,
  getHoldBySession,
  checkSlotAvailability,
  createHold,
  convertToAppointment,
  releaseHold,
  extendHold,
  getHoldRemainingSeconds,
  isHoldActive,
  formatHoldExpiration,
} from './booking-hold.service';

// Customer Trust
export * as customerTrustService from './customer-trust.service';
export {
  getTrustScore,
  getFullTrustScore,
  updateTrustScore,
  setVipStatus,
  getCustomerHistory,
  checkCustomerBlocked,
  getActiveBlocks,
  getCustomerBlocks,
  blockCustomer,
  unblockCustomer,
  updateBlockExpiration,
  recordPenalty,
  getCustomerPenalties,
  resolvePenalty,
  getRecentPenalties,
  canCustomerBook,
  getStrikeCount,
  getDaysUntilUnblock,
} from './customer-trust.service';

// Booking Confirmations
export * as bookingConfirmationService from './booking-confirmation.service';
export {
  getConfirmations,
  getConfirmation,
  getPendingConfirmation,
  getPendingConfirmations,
  getConfirmationByMessageId,
  createConfirmation,
  sendConfirmation,
  createAndSendConfirmation,
  processResponse,
  markAsDelivered,
  markAsRead,
  markAsFailed,
  processExpiredConfirmations,
  resendConfirmation,
  isConfirmationActive,
  getTimeUntilExpiration,
  formatExpirationTime,
  detectResponseFromText,
} from './booking-confirmation.service';

// Booking Policies
export * as bookingPolicyService from './booking-policy.service';
export {
  getPolicies,
  getPolicy,
  getEffectivePolicy,
  getDefaultPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
  setAsDefault,
  createDefaultPolicy,
  evaluateBookingRequirements,
  shouldAutoBlock,
  getPenaltyScore,
  getRewardScore,
  getHoldDuration,
  getConfirmationTimeout,
  formatPolicyThresholds,
  formatDepositConfig,
  formatBlockDuration,
} from './booking-policy.service';

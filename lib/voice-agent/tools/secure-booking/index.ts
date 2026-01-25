/**
 * TIS TIS Platform - Voice Agent v2.2
 * Secure Booking Tools - Index
 *
 * Exports all secure booking tools for integration with
 * the voice agent and chat systems.
 *
 * These tools integrate with the Secure Booking System (Phase 2)
 * to provide trust-based booking with holds and confirmations.
 */

// Trust Verification
export { checkCustomerTrust } from './check-customer-trust';

// Hold Management
export { createSecureHold } from './create-secure-hold';
export { releaseSecureHold } from './release-secure-hold';
export { convertHoldToBooking } from './convert-hold-to-booking';

// Availability
export { checkSecureAvailability } from './check-secure-availability';

// Secure Booking Enhanced Tools
export { secureCreateAppointment } from './secure-create-appointment';
export { secureCreateReservation } from './secure-create-reservation';

// Re-export types for convenience
export type {
  // Trust types
  TrustLevel,
  TrustAction,
  CheckCustomerTrustParams,
  CustomerTrustResult,
  // Hold types
  HoldStatus,
  CreateSecureHoldParams,
  SecureHoldResult,
  ReleaseSecureHoldParams,
  ReleaseHoldResult,
  ConvertHoldToBookingParams,
  ConvertHoldResult,
  // Availability types
  CheckSecureAvailabilityParams,
  SecureAvailabilityResult,
  // Enhanced booking types
  SecureCreateAppointmentParams,
  SecureCreateReservationParams,
  SecureBookingResult,
} from '../types';

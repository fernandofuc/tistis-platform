// =====================================================
// TIS TIS PLATFORM - Payments Services Barrel Export
// =====================================================

// Service functions
export {
  checkStripeConnectHealth,
  clearStripeConnectHealthCache,
  getConnectErrorDetails,
} from './stripe-connect-health.service';

// Re-export types from the types file (single source of truth)
export type {
  StripeConnectHealthStatus,
  ConnectErrorDetails,
} from '../types';

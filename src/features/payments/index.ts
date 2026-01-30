// =====================================================
// TIS TIS PLATFORM - Payments Feature Barrel Export
// Stripe Connect integration and health checking
// =====================================================

// Services (includes StripeConnectHealthStatus, ConnectErrorDetails)
export * from './services';

// Types - only export types not already in services
export type {
  StripeConnectStatus,
  StripePaymentError,
  StripeHealthResponse,
  OnboardingLink,
} from './types';

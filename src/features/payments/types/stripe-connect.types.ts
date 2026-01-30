// =====================================================
// TIS TIS PLATFORM - Stripe Connect Types
// Shared types for Stripe Connect functionality
// =====================================================

/**
 * Stripe Connect account status from our database
 */
export interface StripeConnectStatus {
  status: 'not_connected' | 'pending' | 'connected' | 'restricted' | 'disabled';
  is_charges_enabled: boolean;
  is_payouts_enabled: boolean;
  is_details_submitted: boolean;
  business_name?: string;
  bank_last_four?: string;
  bank_name?: string;
  country?: string;
  default_currency?: string;
}

/**
 * Stripe Connect health check status
 * Used by the health service to determine if Connect is enabled
 */
export interface StripeConnectHealthStatus {
  isConfigured: boolean;
  isConnectEnabled: boolean;
  errorCode?: string;
  errorMessage?: string;
  capabilities?: {
    cardPayments: boolean;
    transfers: boolean;
  };
  lastChecked: string;
}

/**
 * User-friendly error details for UI display
 */
export interface ConnectErrorDetails {
  title: string;
  message: string;
  action: string;
  actionUrl?: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Structured error from API for better UI handling
 */
export interface StripePaymentError {
  message: string;
  code?: string;
  action?: string;
  actionUrl?: string;
  isConfigurationError?: boolean;
}

/**
 * Health check API response
 */
export interface StripeHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    stripe_api: {
      configured: boolean;
      status: 'healthy' | 'unhealthy';
    };
    stripe_connect: {
      enabled: boolean;
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      action_url?: string;
    };
    webhook: {
      configured: boolean;
      status: 'healthy' | 'degraded';
    };
  };
}

/**
 * Onboarding link response from Stripe
 */
export interface OnboardingLink {
  onboarding_url: string;
  expires_at: string;
}

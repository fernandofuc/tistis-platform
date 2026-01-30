// =====================================================
// TIS TIS PLATFORM - Payments Service
// API client for Stripe Connect and payments
// =====================================================

import { supabase } from '@/shared/lib/supabase';

// ======================
// TYPES
// ======================

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

export interface OnboardingLink {
  onboarding_url: string;
  expires_at: string;
}

export interface PaymentRecord {
  id: string;
  stripe_payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  created_at: string;
  leads?: {
    name: string;
    email: string;
  };
  loyalty_memberships?: {
    id: string;
    loyalty_membership_plans?: {
      plan_name: string;
    };
  };
}

export interface PayoutRecord {
  id: string;
  stripe_payout_id: string;
  amount: number;
  currency: string;
  status: string;
  bank_name?: string;
  destination_last_four?: string;
  arrival_date?: string;
  failure_message?: string;
  created_at: string;
}

export interface SubscriptionRecord {
  id: string;
  stripe_subscription_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  leads?: {
    name: string;
    email: string;
  };
  loyalty_membership_plans?: {
    plan_name: string;
    price_monthly: number;
    price_annual: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
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
 * Stripe health check response
 */
export interface StripeHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connectEnabled: boolean;
  message?: string;
  actionUrl?: string;
}

// ======================
// HELPER
// ======================

/**
 * Fetch with authentication - preserves structured errors from API
 */
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    // Preserve structured error information for UI handling
    // The error message contains JSON that can be parsed by the component
    const structuredError: StripePaymentError = {
      message: data.error || 'Error en la solicitud',
      code: data.code,
      action: data.action,
      actionUrl: data.actionUrl,
      isConfigurationError: data.isConfigurationError,
    };

    // Throw error with JSON string so component can parse it
    const error = new Error(JSON.stringify(structuredError));
    throw error;
  }

  return data;
}

// ======================
// STRIPE CONNECT
// ======================

/**
 * Get current Stripe Connect status for the tenant
 */
export async function getStripeConnectStatus(): Promise<StripeConnectStatus> {
  const result = await fetchWithAuth('/api/payments/connect');
  return result.data;
}

/**
 * Create Stripe Connect onboarding link
 * Redirects user to Stripe to complete account setup
 */
export async function createOnboardingLink(): Promise<OnboardingLink> {
  const result = await fetchWithAuth('/api/payments/connect', {
    method: 'POST',
  });
  return result.data;
}

/**
 * Disconnect Stripe account (soft disconnect)
 */
export async function disconnectStripeAccount(): Promise<void> {
  await fetchWithAuth('/api/payments/connect', {
    method: 'DELETE',
  });
}

// ======================
// PAYMENT HISTORY
// ======================

/**
 * Get payment history (payment intents)
 */
export async function getPaymentHistory(
  limit: number = 20,
  offset: number = 0
): Promise<PaginatedResponse<PaymentRecord>> {
  const result = await fetchWithAuth(
    `/api/payments/history?type=payments&limit=${limit}&offset=${offset}`
  );
  return {
    data: result.data,
    pagination: result.pagination,
  };
}

/**
 * Get payout history (payouts to tenant's bank)
 */
export async function getPayoutHistory(
  limit: number = 20,
  offset: number = 0
): Promise<PaginatedResponse<PayoutRecord>> {
  const result = await fetchWithAuth(
    `/api/payments/history?type=payouts&limit=${limit}&offset=${offset}`
  );
  return {
    data: result.data,
    pagination: result.pagination,
  };
}

/**
 * Get subscription history
 */
export async function getSubscriptionHistory(
  limit: number = 20,
  offset: number = 0
): Promise<PaginatedResponse<SubscriptionRecord>> {
  const result = await fetchWithAuth(
    `/api/payments/history?type=subscriptions&limit=${limit}&offset=${offset}`
  );
  return {
    data: result.data,
    pagination: result.pagination,
  };
}

// ======================
// HELPERS
// ======================

/**
 * Format currency amount (from cents to display)
 */
export function formatAmount(amountCents: number, currency: string = 'mxn'): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): 'green' | 'yellow' | 'red' | 'gray' {
  switch (status) {
    case 'succeeded':
    case 'paid':
    case 'active':
    case 'connected':
      return 'green';
    case 'pending':
    case 'in_transit':
    case 'incomplete':
    case 'past_due':
      return 'yellow';
    case 'failed':
    case 'canceled':
    case 'disabled':
    case 'restricted':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    // Payment statuses
    succeeded: 'Exitoso',
    pending: 'Pendiente',
    failed: 'Fallido',
    canceled: 'Cancelado',
    requires_payment_method: 'Requiere método de pago',
    requires_confirmation: 'Requiere confirmación',

    // Payout statuses
    paid: 'Pagado',
    in_transit: 'En tránsito',

    // Subscription statuses
    active: 'Activa',
    past_due: 'Vencida',
    unpaid: 'Sin pagar',
    incomplete: 'Incompleta',

    // Connect statuses
    connected: 'Conectada',
    not_connected: 'Sin conectar',
    restricted: 'Restringida',
    disabled: 'Deshabilitada',
  };

  return labels[status] || status;
}

// ======================
// STRIPE HEALTH CHECK
// ======================

/**
 * Check Stripe service health (Connect enabled, webhooks, etc.)
 * Used for proactive UI feedback before user attempts to connect
 */
export async function checkStripeHealth(): Promise<StripeHealthStatus> {
  try {
    const response = await fetch('/api/health/stripe');
    const data = await response.json();

    return {
      status: data.status,
      connectEnabled: data.services?.stripe_connect?.enabled ?? false,
      message: data.services?.stripe_connect?.message,
      actionUrl: data.services?.stripe_connect?.action_url,
    };
  } catch {
    return {
      status: 'unhealthy',
      connectEnabled: false,
      message: 'No se pudo verificar el estado de Stripe',
    };
  }
}

/**
 * Parse structured error from API response
 * Returns null if error is not a structured payment error
 */
export function parsePaymentError(error: unknown): StripePaymentError | null {
  if (!(error instanceof Error)) return null;

  try {
    const parsed = JSON.parse(error.message);
    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
      return parsed as StripePaymentError;
    }
  } catch {
    // Not JSON, return simple error
    return {
      message: error.message,
    };
  }

  return null;
}

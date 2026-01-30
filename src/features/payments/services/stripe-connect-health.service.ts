// =====================================================
// TIS TIS PLATFORM - Stripe Connect Health Service
// Detects Stripe Connect configuration status proactively
// =====================================================

import Stripe from 'stripe';

// ======================
// TYPES
// ======================

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

export interface ConnectErrorDetails {
  title: string;
  message: string;
  action: string;
  actionUrl?: string;
  severity: 'error' | 'warning' | 'info';
}

// ======================
// SINGLETON CLIENT
// ======================

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeClient;
}

// ======================
// CACHE
// ======================

// Cache for health status (5 minute TTL)
let cachedStatus: StripeConnectHealthStatus | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clear the cached status (useful for testing or force refresh)
 */
export function clearStripeConnectHealthCache(): void {
  cachedStatus = null;
  cacheExpiry = 0;
}

// ======================
// MAIN HEALTH CHECK
// ======================

/**
 * Check if Stripe Connect is properly configured and enabled
 * Uses caching to avoid hitting Stripe API on every request
 *
 * This function attempts to verify Stripe Connect status by checking
 * if the platform account has the necessary capabilities.
 */
export async function checkStripeConnectHealth(
  forceRefresh = false
): Promise<StripeConnectHealthStatus> {
  const now = Date.now();

  // Return cached result if valid
  if (!forceRefresh && cachedStatus && now < cacheExpiry) {
    console.log('[Stripe Health] Returning cached status');
    return cachedStatus;
  }

  // Check basic configuration
  if (!process.env.STRIPE_SECRET_KEY) {
    const status: StripeConnectHealthStatus = {
      isConfigured: false,
      isConnectEnabled: false,
      errorCode: 'STRIPE_NOT_CONFIGURED',
      errorMessage: 'STRIPE_SECRET_KEY no esta configurado en el servidor',
      lastChecked: new Date().toISOString(),
    };
    cachedStatus = status;
    cacheExpiry = now + CACHE_TTL_MS;
    return status;
  }

  try {
    const stripe = getStripeClient();

    // Method: Try to retrieve the account's capabilities
    // This is a lightweight check that doesn't create any resources
    // We check if we can access the Connect API at all
    const account = await stripe.accounts.retrieve();

    // If we can retrieve the account, Stripe API is working
    // Now check if we have the capability to create Connect accounts
    // by looking at the account's metadata or capabilities

    // The account object for the platform account will have different properties
    // than a connected account. We're checking the platform account here.

    console.log('[Stripe Health] Platform account retrieved:', account.id);

    // Try a more specific check - attempt to list connected accounts
    // This will fail if Connect is not enabled
    try {
      await stripe.accounts.list({ limit: 1 });

      // If we get here, Connect is enabled
      const status: StripeConnectHealthStatus = {
        isConfigured: true,
        isConnectEnabled: true,
        capabilities: {
          cardPayments: true,
          transfers: true,
        },
        lastChecked: new Date().toISOString(),
      };

      cachedStatus = status;
      cacheExpiry = now + CACHE_TTL_MS;
      console.log('[Stripe Health] Stripe Connect is enabled');
      return status;

    } catch (listError) {
      // If listing accounts fails, it might mean Connect is not enabled
      return handleStripeConnectError(listError, now);
    }

  } catch (error) {
    return handleStripeConnectError(error, now);
  }
}

// ======================
// ERROR HANDLING
// ======================

function handleStripeConnectError(error: unknown, now: number): StripeConnectHealthStatus {
  const timestamp = new Date().toISOString();

  if (error instanceof Stripe.errors.StripeError) {
    console.error('[Stripe Health] Stripe error:', {
      type: error.type,
      code: error.code,
      message: error.message,
    });

    // Specific error patterns for Connect not enabled
    const connectNotEnabledPatterns = [
      'connect',
      'platform',
      'not enabled',
      'not activated',
      'account_invalid',
    ];

    const errorMessageLower = error.message.toLowerCase();
    const isConnectError = connectNotEnabledPatterns.some(
      pattern => errorMessageLower.includes(pattern)
    );

    if (isConnectError || error.code === 'platform_api_key_expired' || error.code === 'account_invalid') {
      const status: StripeConnectHealthStatus = {
        isConfigured: true,
        isConnectEnabled: false,
        errorCode: 'STRIPE_CONNECT_NOT_ENABLED',
        errorMessage: 'Stripe Connect no esta habilitado. Activalo en el dashboard de Stripe.',
        lastChecked: timestamp,
      };
      cachedStatus = status;
      cacheExpiry = now + CACHE_TTL_MS;
      return status;
    }

    // Authentication errors
    if (error.type === 'StripeAuthenticationError') {
      const status: StripeConnectHealthStatus = {
        isConfigured: false,
        isConnectEnabled: false,
        errorCode: 'STRIPE_AUTH_ERROR',
        errorMessage: 'Error de autenticacion con Stripe. Verifica tu API key.',
        lastChecked: timestamp,
      };
      cachedStatus = status;
      cacheExpiry = now + CACHE_TTL_MS;
      return status;
    }

    // Permission errors - usually means Connect is not enabled
    if (error.type === 'StripePermissionError') {
      const status: StripeConnectHealthStatus = {
        isConfigured: true,
        isConnectEnabled: false,
        errorCode: 'STRIPE_CONNECT_NOT_ENABLED',
        errorMessage: 'Stripe Connect no esta habilitado. Activalo en dashboard.stripe.com/settings/connect',
        lastChecked: timestamp,
      };
      cachedStatus = status;
      cacheExpiry = now + CACHE_TTL_MS;
      return status;
    }

    // Generic Stripe error
    const status: StripeConnectHealthStatus = {
      isConfigured: true,
      isConnectEnabled: false,
      errorCode: error.code || 'STRIPE_ERROR',
      errorMessage: error.message,
      lastChecked: timestamp,
    };
    cachedStatus = status;
    cacheExpiry = now + CACHE_TTL_MS;
    return status;
  }

  // Generic unknown error
  console.error('[Stripe Health] Unknown error:', error);
  const status: StripeConnectHealthStatus = {
    isConfigured: true,
    isConnectEnabled: false,
    errorCode: 'UNKNOWN_ERROR',
    errorMessage: 'Error desconocido al verificar Stripe Connect',
    lastChecked: timestamp,
  };
  cachedStatus = status;
  cacheExpiry = now + CACHE_TTL_MS;
  return status;
}

// ======================
// USER-FRIENDLY MESSAGES
// ======================

/**
 * Get user-friendly error message and action for UI display
 */
export function getConnectErrorDetails(status: StripeConnectHealthStatus): ConnectErrorDetails {
  if (!status.isConfigured) {
    return {
      title: 'Stripe no configurado',
      message: 'El sistema de pagos no esta configurado correctamente en el servidor.',
      action: 'Contacta al equipo de soporte para resolver este problema.',
      severity: 'error',
    };
  }

  if (!status.isConnectEnabled) {
    return {
      title: 'Stripe Connect no habilitado',
      message: 'Para recibir pagos de membresias, necesitas activar Stripe Connect en tu cuenta de Stripe.',
      action: 'Activar Stripe Connect',
      actionUrl: 'https://dashboard.stripe.com/settings/connect',
      severity: 'warning',
    };
  }

  return {
    title: 'Stripe Connect activo',
    message: 'El sistema de pagos esta configurado correctamente.',
    action: '',
    severity: 'info',
  };
}

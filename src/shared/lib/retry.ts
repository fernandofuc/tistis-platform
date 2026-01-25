// =====================================================
// TIS TIS PLATFORM - Retry Utility
// Exponential backoff with jitter for API operations
// Follows Stripe and general API best practices
// =====================================================

import { createComponentLogger } from './logger-instance';

const logger = createComponentLogger('retry');

// =====================================================
// TYPES
// =====================================================

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add jitter to delays (default: true) */
  jitter?: boolean;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void;
  /** Operation name for logging */
  operationName?: string;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
}

// =====================================================
// DEFAULT CONFIGURATION
// =====================================================

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'isRetryable' | 'onRetry' | 'operationName'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

// =====================================================
// STRIPE-SPECIFIC ERROR DETECTION
// =====================================================

/**
 * Stripe error codes that are safe to retry
 */
const STRIPE_RETRYABLE_CODES = new Set([
  'rate_limit',
  'lock_timeout',
  'api_connection_error',
  'api_error', // 500-level errors
]);

/**
 * HTTP status codes that are safe to retry
 */
const RETRYABLE_STATUS_CODES = new Set([
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * Determines if a Stripe error is retryable
 */
export function isStripeErrorRetryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as Record<string, unknown>;

  // Stripe SDK errors have a 'type' property
  if (err.type && typeof err.type === 'string') {
    if (STRIPE_RETRYABLE_CODES.has(err.type)) {
      return true;
    }
  }

  // Check for Stripe error code
  if (err.code && typeof err.code === 'string') {
    if (STRIPE_RETRYABLE_CODES.has(err.code)) {
      return true;
    }
  }

  // Check HTTP status code
  if (err.statusCode && typeof err.statusCode === 'number') {
    if (RETRYABLE_STATUS_CODES.has(err.statusCode)) {
      return true;
    }
  }

  // Check for raw status (some APIs use this)
  if (err.status && typeof err.status === 'number') {
    if (RETRYABLE_STATUS_CODES.has(err.status)) {
      return true;
    }
  }

  // Network errors (connection refused, timeout, etc.)
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
    return true;
  }

  // Generic network error detection
  if (err.message && typeof err.message === 'string') {
    const message = err.message.toLowerCase();
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('socket hang up') ||
      message.includes('connection refused')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Default retryable error detector (covers most API scenarios)
 */
export function isDefaultRetryable(error: unknown): boolean {
  // Always retry Stripe-specific errors
  if (isStripeErrorRetryable(error)) {
    return true;
  }

  // Check for generic Error types
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network-related errors
    if (
      message.includes('fetch failed') ||
      message.includes('network request failed') ||
      message.includes('aborted') ||
      message.includes('timeout')
    ) {
      return true;
    }
  }

  return false;
}

// =====================================================
// DELAY CALCULATION
// =====================================================

/**
 * Calculates delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitter: boolean
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter (random value between 0 and delay)
  if (jitter) {
    const jitterAmount = Math.random() * cappedDelay * 0.5; // 0-50% jitter
    return Math.floor(cappedDelay + jitterAmount);
  }

  return Math.floor(cappedDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =====================================================
// MAIN RETRY FUNCTION
// =====================================================

/**
 * Executes an async operation with retry logic
 *
 * @example
 * // Basic usage
 * const result = await withRetry(
 *   async () => stripe.invoiceItems.create({ ... }),
 *   { operationName: 'createInvoiceItem' }
 * );
 *
 * @example
 * // With custom config
 * const result = await withRetry(
 *   async () => fetchExternalAPI(),
 *   {
 *     maxRetries: 5,
 *     initialDelayMs: 500,
 *     operationName: 'fetchExternalAPI',
 *     onRetry: (attempt, error) => console.log(`Retry ${attempt}`, error)
 *   }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = DEFAULT_CONFIG.maxRetries,
    initialDelayMs = DEFAULT_CONFIG.initialDelayMs,
    maxDelayMs = DEFAULT_CONFIG.maxDelayMs,
    backoffMultiplier = DEFAULT_CONFIG.backoffMultiplier,
    jitter = DEFAULT_CONFIG.jitter,
    isRetryable = isDefaultRetryable,
    onRetry,
    operationName = 'operation',
  } = config;

  const startTime = Date.now();
  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;

    try {
      const data = await operation();

      const totalTimeMs = Date.now() - startTime;

      if (attempt > 0) {
        logger.info(`${operationName} succeeded after ${attempt} retries`, {
          attempts,
          totalTimeMs,
        });
      }

      return {
        success: true,
        data,
        attempts,
        totalTimeMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry = attempt < maxRetries && isRetryable(error);

      if (!shouldRetry) {
        // Non-retryable error or max retries reached
        if (attempt >= maxRetries) {
          logger.error(`${operationName} failed after ${maxRetries} retries`, {
            error: lastError.message,
            attempts,
          });
        } else {
          logger.error(`${operationName} failed with non-retryable error`, {
            error: lastError.message,
            errorType: (error as Record<string, unknown>)?.type || 'unknown',
          });
        }
        break;
      }

      // Calculate delay for next attempt
      const delayMs = calculateDelay(
        attempt,
        initialDelayMs,
        maxDelayMs,
        backoffMultiplier,
        jitter
      );

      logger.warn(`${operationName} attempt ${attempt + 1} failed, retrying in ${delayMs}ms`, {
        error: lastError.message,
        attempt: attempt + 1,
        maxRetries,
        delayMs,
      });

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts,
    totalTimeMs: Date.now() - startTime,
  };
}

// =====================================================
// STRIPE-SPECIFIC RETRY WRAPPER
// =====================================================

/**
 * Stripe-optimized retry configuration
 */
export const STRIPE_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: isStripeErrorRetryable,
};

/**
 * Executes a Stripe operation with optimized retry logic
 *
 * @example
 * const result = await withStripeRetry(
 *   async () => stripe.invoiceItems.create({ ... }),
 *   'createInvoiceItem'
 * );
 *
 * if (result.success) {
 *   console.log('Created:', result.data);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 */
export async function withStripeRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  additionalConfig: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  return withRetry(operation, {
    ...STRIPE_RETRY_CONFIG,
    ...additionalConfig,
    operationName: `Stripe:${operationName}`,
  });
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Creates a retry wrapper with preset configuration
 * Useful for creating service-specific retry functions
 */
export function createRetryWrapper(defaultConfig: RetryConfig) {
  return async function <T>(
    operation: () => Promise<T>,
    operationConfig: Partial<RetryConfig> = {}
  ): Promise<RetryResult<T>> {
    return withRetry(operation, {
      ...defaultConfig,
      ...operationConfig,
    });
  };
}

/**
 * Simple retry that throws on failure instead of returning result object
 * Use when you want traditional error handling
 */
export async function retryOrThrow<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const result = await withRetry(operation, config);

  if (!result.success) {
    throw result.error;
  }

  return result.data as T;
}

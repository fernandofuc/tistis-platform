// =====================================================
// TIS TIS PLATFORM - Retry Helper with Exponential Backoff
// Provides retry logic for external API calls
// Includes circuit breaker pattern for cascading failure prevention
// =====================================================

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Add random jitter to delays (recommended) */
  jitter: boolean;
  /** Optional function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: (error) => {
    // By default, retry on rate limits and network errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('network') ||
        message.includes('503') ||
        message.includes('429')
      );
    }
    return false;
  },
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const boundedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  if (config.jitter) {
    // Add random jitter between 0% and 50% of the delay
    const jitter = boundedDelay * Math.random() * 0.5;
    return boundedDelay + jitter;
  }

  return boundedDelay;
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @example
 * const result = await withRetry(
 *   () => openai.embeddings.create({ model: 'text-embedding-3-small', input: text }),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= fullConfig.maxRetries + 1; attempt++) {
    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      console.warn(`[retry] Attempt ${attempt} failed:`, lastError.message);

      // Check if we should retry
      if (attempt <= fullConfig.maxRetries) {
        const shouldRetry = fullConfig.isRetryable?.(error) ?? true;

        if (shouldRetry) {
          const delay = calculateDelay(attempt, fullConfig);
          console.log(`[retry] Retrying in ${Math.round(delay)}ms...`);
          await sleep(delay);
          continue;
        }
      }

      // Don't retry - return failure
      break;
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: fullConfig.maxRetries + 1,
    totalTimeMs: Date.now() - startTime,
  };
}

// =====================================================
// CIRCUIT BREAKER
// Prevents cascading failures by "opening" the circuit
// when failures exceed a threshold
// =====================================================

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in milliseconds to wait before attempting recovery */
  resetTimeoutMs: number;
  /** Number of successes needed to close circuit */
  successThreshold: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeoutMs: config.resetTimeoutMs ?? 60000, // 1 minute
      successThreshold: config.successThreshold ?? 2,
    };
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit allows requests
   */
  isAvailable(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      // Check if reset timeout has passed
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = 'half-open';
        this.successes = 0;
        console.log('[circuit-breaker] Transitioning to half-open state');
        return true;
      }
      return false;
    }

    // half-open state - allow limited requests
    return true;
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.failures = 0;

    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'closed';
        console.log('[circuit-breaker] Circuit closed after successful recovery');
      }
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.state = 'open';
      console.warn('[circuit-breaker] Circuit re-opened after failure in half-open state');
      return;
    }

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      console.warn(`[circuit-breaker] Circuit opened after ${this.failures} failures`);
    }
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.isAvailable()) {
      throw new Error('Circuit breaker is open - service temporarily unavailable');
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Reset circuit breaker state
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
  }
}

// =====================================================
// EMBEDDING RETRY HELPER
// Specialized retry configuration for OpenAI API
// =====================================================

/** Pre-configured retry for OpenAI embedding calls */
export const embeddingRetryConfig: Partial<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: (error) => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Retry on rate limits, timeouts, and server errors
      return (
        message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('timeout') ||
        message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504') ||
        message.includes('econnreset') ||
        message.includes('econnrefused')
      );
    }
    return false;
  },
};

// Singleton circuit breaker for OpenAI embeddings
let embeddingCircuitBreaker: CircuitBreaker | null = null;

export function getEmbeddingCircuitBreaker(): CircuitBreaker {
  if (!embeddingCircuitBreaker) {
    embeddingCircuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60000, // 1 minute
      successThreshold: 2,
    });
  }
  return embeddingCircuitBreaker;
}

/**
 * Execute embedding generation with retry and circuit breaker
 */
export async function withEmbeddingRetry<T>(fn: () => Promise<T>): Promise<T> {
  const circuitBreaker = getEmbeddingCircuitBreaker();

  return circuitBreaker.execute(async () => {
    const result = await withRetry(fn, embeddingRetryConfig);

    if (!result.success) {
      throw result.error ?? new Error('Embedding generation failed');
    }

    return result.data!;
  });
}

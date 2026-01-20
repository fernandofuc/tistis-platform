/**
 * TIS TIS Platform - Voice Agent v2.0
 * Circuit Breaker Types and Interfaces
 *
 * Defines all types for the Circuit Breaker pattern implementation:
 * - State management (CLOSED, OPEN, HALF_OPEN)
 * - Configuration options
 * - Execution results
 * - Event types
 */

// =====================================================
// CIRCUIT BREAKER STATES
// =====================================================

/**
 * Circuit Breaker states following the standard pattern
 *
 * CLOSED: Normal operation, requests pass through
 * OPEN: Circuit is open, requests fail fast with fallback
 * HALF_OPEN: Testing if service has recovered
 */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * All possible circuit breaker states as const array
 */
export const CIRCUIT_BREAKER_STATES: readonly CircuitBreakerState[] = [
  'CLOSED',
  'OPEN',
  'HALF_OPEN',
] as const;

// =====================================================
// CONFIGURATION
// =====================================================

/**
 * Circuit Breaker configuration options
 */
export interface CircuitBreakerConfig {
  /**
   * Number of failures before opening the circuit
   * @default 5
   */
  failureThreshold: number;

  /**
   * Time in ms to wait before attempting recovery (OPEN -> HALF_OPEN)
   * @default 30000 (30 seconds)
   */
  recoveryTimeout: number;

  /**
   * Maximum time in ms to wait for an operation
   * @default 8000 (8 seconds)
   */
  timeout: number;

  /**
   * Minimum number of requests before circuit can open
   * Prevents opening on low traffic with few errors
   * @default 10
   */
  volumeThreshold: number;

  /**
   * Success threshold in HALF_OPEN state before closing
   * @default 1
   */
  successThreshold: number;

  /**
   * Sliding window size for failure rate calculation (in ms)
   * @default 60000 (1 minute)
   */
  slidingWindowSize: number;
}

/**
 * Default configuration for Voice Agent
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30_000, // 30 seconds
  timeout: 8_000, // 8 seconds - critical for voice
  volumeThreshold: 10,
  successThreshold: 1,
  slidingWindowSize: 60_000, // 1 minute
};

// =====================================================
// STORE STATE
// =====================================================

/**
 * State persisted in the store (Supabase)
 */
export interface CircuitBreakerStoreState {
  /** Current circuit state */
  state: CircuitBreakerState;

  /** Number of consecutive failures */
  failureCount: number;

  /** Number of consecutive successes (for HALF_OPEN) */
  successCount: number;

  /** Timestamp when circuit was opened */
  openedAt: string | null;

  /** Timestamp of last failure */
  lastFailureAt: string | null;

  /** Last error message (for debugging) */
  lastError: string | null;

  /** Total executions in current window */
  totalExecutions: number;

  /** Last state change timestamp */
  lastStateChange: string;
}

/**
 * Initial state for new circuit breakers
 */
export const INITIAL_CIRCUIT_BREAKER_STATE: CircuitBreakerStoreState = {
  state: 'CLOSED',
  failureCount: 0,
  successCount: 0,
  openedAt: null,
  lastFailureAt: null,
  lastError: null,
  totalExecutions: 0,
  lastStateChange: new Date().toISOString(),
};

// =====================================================
// EXECUTION RESULTS
// =====================================================

/**
 * Possible execution outcomes
 */
export type ExecutionOutcome =
  | 'success'
  | 'failure'
  | 'timeout'
  | 'circuit_open'
  | 'fallback';

/**
 * Result of circuit breaker execution
 */
export interface ExecutionResult<T> {
  /** Whether execution was successful */
  success: boolean;

  /** The result data (if successful) */
  data?: T;

  /** Error if failed */
  error?: Error;

  /** What happened during execution */
  outcome: ExecutionOutcome;

  /** Execution duration in ms */
  durationMs: number;

  /** Whether fallback was used */
  usedFallback: boolean;

  /** Current circuit state after execution */
  circuitState: CircuitBreakerState;
}

// =====================================================
// EVENTS
// =====================================================

/**
 * Circuit breaker event types
 */
export type CircuitBreakerEventType =
  | 'state_change'
  | 'execution_success'
  | 'execution_failure'
  | 'execution_timeout'
  | 'fallback_served'
  | 'half_open_test';

/**
 * State change event
 */
export interface StateChangeEvent {
  type: 'state_change';
  tenantId: string;
  previousState: CircuitBreakerState;
  newState: CircuitBreakerState;
  reason: string;
  timestamp: string;
}

/**
 * Execution event (success, failure, timeout)
 */
export interface ExecutionEvent {
  type: 'execution_success' | 'execution_failure' | 'execution_timeout';
  tenantId: string;
  durationMs: number;
  error?: string;
  timestamp: string;
}

/**
 * Fallback event
 */
export interface FallbackEvent {
  type: 'fallback_served';
  tenantId: string;
  reason: 'circuit_open' | 'timeout' | 'error';
  language: string;
  timestamp: string;
}

/**
 * Union type of all events
 */
export type CircuitBreakerEvent =
  | StateChangeEvent
  | ExecutionEvent
  | FallbackEvent;

/**
 * Event handler function type
 */
export type CircuitBreakerEventHandler = (event: CircuitBreakerEvent) => void;

// =====================================================
// METRICS
// =====================================================

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  /** Total number of executions */
  totalExecutions: number;

  /** Successful executions */
  successfulExecutions: number;

  /** Failed executions */
  failedExecutions: number;

  /** Timed out executions */
  timedOutExecutions: number;

  /** Fallbacks served */
  fallbacksServed: number;

  /** Current success rate (0-1) */
  successRate: number;

  /** Current failure rate (0-1) */
  failureRate: number;

  /** Current circuit state */
  currentState: CircuitBreakerState;

  /** Last state change timestamp */
  lastStateChange: string;

  /** Number of state changes */
  stateChangeCount: number;

  /** Average execution time in ms */
  averageExecutionTimeMs: number;
}

/**
 * Initial metrics
 */
export const INITIAL_METRICS: CircuitBreakerMetrics = {
  totalExecutions: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  timedOutExecutions: 0,
  fallbacksServed: 0,
  successRate: 1,
  failureRate: 0,
  currentState: 'CLOSED',
  lastStateChange: new Date().toISOString(),
  stateChangeCount: 0,
  averageExecutionTimeMs: 0,
};

// =====================================================
// FALLBACK TYPES
// =====================================================

/**
 * Fallback response types
 */
export type FallbackType =
  | 'systemError'
  | 'timeout'
  | 'circuitOpen'
  | 'serviceUnavailable';

/**
 * Supported languages for fallback responses
 */
export type SupportedLanguage = 'es-MX' | 'en-US';

/**
 * Fallback response structure
 */
export interface FallbackResponse {
  /** The spoken message */
  message: string;

  /** Type of fallback */
  type: FallbackType;

  /** Language code */
  language: SupportedLanguage;

  /** Whether to offer an alternative action */
  offerAlternative: boolean;

  /** Alternative action suggestion */
  alternativeAction?: string;
}

// =====================================================
// STORE INTERFACE
// =====================================================

/**
 * Interface for circuit breaker state persistence
 */
export interface CircuitBreakerStore {
  /**
   * Get current state for a business
   */
  getState(tenantId: string): Promise<CircuitBreakerStoreState>;

  /**
   * Set state for a business
   */
  setState(
    tenantId: string,
    state: CircuitBreakerStoreState
  ): Promise<void>;

  /**
   * Delete state for a business (for testing/reset)
   */
  deleteState(tenantId: string): Promise<void>;

  /**
   * Get all circuit breaker states (for monitoring)
   */
  getAllStates(): Promise<Map<string, CircuitBreakerStoreState>>;
}

// =====================================================
// ERROR TYPES
// =====================================================

/**
 * Circuit breaker specific error
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitBreakerState,
    public readonly tenantId: string
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly tenantId: string
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * TIS TIS Platform - Voice Agent v2.0
 * Circuit Breaker Implementation
 *
 * Implements the Circuit Breaker pattern to protect against
 * cascading failures in the Voice Agent system.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail fast
 * - HALF_OPEN: Testing if service has recovered
 *
 * Features:
 * - Configurable failure thresholds
 * - Timeout handling for slow operations
 * - Persistent state via Supabase store
 * - Event emission for monitoring
 * - Comprehensive metrics tracking
 */

import type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerStoreState,
  CircuitBreakerStore,
  CircuitBreakerEvent,
  CircuitBreakerEventHandler,
  CircuitBreakerMetrics,
  ExecutionResult,
  ExecutionOutcome,
  FallbackResponse,
} from './types';
import {
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  INITIAL_CIRCUIT_BREAKER_STATE,
  INITIAL_METRICS,
  CircuitBreakerError,
  TimeoutError,
} from './types';
import { getFallbackResponse } from './fallback-responses';

// =====================================================
// VOICE CIRCUIT BREAKER CLASS
// =====================================================

export class VoiceCircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private readonly store: CircuitBreakerStore;
  private readonly tenantId: string;
  private readonly eventHandlers: Set<CircuitBreakerEventHandler>;
  private metrics: CircuitBreakerMetrics;
  private currentState: CircuitBreakerStoreState;
  private stateLoaded: boolean;
  private executionTimes: number[];
  private readonly language: 'es-MX' | 'en-US';

  constructor(
    tenantId: string,
    store: CircuitBreakerStore,
    config?: Partial<CircuitBreakerConfig>,
    language: 'es-MX' | 'en-US' = 'es-MX'
  ) {
    this.tenantId = tenantId;
    this.store = store;
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.language = language;
    this.eventHandlers = new Set();
    this.metrics = { ...INITIAL_METRICS };
    this.currentState = { ...INITIAL_CIRCUIT_BREAKER_STATE };
    this.stateLoaded = false;
    this.executionTimes = [];
  }

  // =====================================================
  // MAIN EXECUTION METHOD
  // =====================================================

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn - The async function to execute
   * @param fallback - Optional custom fallback value
   * @returns ExecutionResult with success status, data, and metadata
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: T
  ): Promise<ExecutionResult<T>> {
    const startTime = Date.now();

    // Load state if not already loaded
    if (!this.stateLoaded) {
      await this.loadState();
    }

    // Check if circuit should transition from OPEN to HALF_OPEN
    await this.checkRecoveryTimeout();

    // Determine action based on current state
    const state = this.currentState.state;

    switch (state) {
      case 'OPEN':
        return this.handleOpenState<T>(startTime, fallback);

      case 'HALF_OPEN':
        return this.handleHalfOpenState<T>(fn, startTime, fallback);

      case 'CLOSED':
      default:
        return this.handleClosedState<T>(fn, startTime, fallback);
    }
  }

  // =====================================================
  // STATE HANDLERS
  // =====================================================

  /**
   * Handle execution when circuit is CLOSED (normal operation)
   */
  private async handleClosedState<T>(
    fn: () => Promise<T>,
    startTime: number,
    fallback?: T
  ): Promise<ExecutionResult<T>> {
    try {
      const result = await this.executeWithTimeout(fn);
      await this.recordSuccess(startTime);

      return {
        success: true,
        data: result,
        outcome: 'success',
        durationMs: Date.now() - startTime,
        usedFallback: false,
        circuitState: this.currentState.state,
      };
    } catch (error) {
      return this.handleExecutionError<T>(error, startTime, fallback);
    }
  }

  /**
   * Handle execution when circuit is OPEN
   */
  private async handleOpenState<T>(
    startTime: number,
    fallback?: T
  ): Promise<ExecutionResult<T>> {
    const durationMs = Date.now() - startTime;

    // Record metrics
    this.metrics.fallbacksServed++;
    this.updateMetrics();

    // Emit fallback event
    this.emitEvent({
      type: 'fallback_served',
      tenantId: this.tenantId,
      reason: 'circuit_open',
      language: this.language,
      timestamp: new Date().toISOString(),
    });

    // Get fallback response
    const fallbackResponse = getFallbackResponse('circuitOpen', this.language);

    return {
      success: false,
      data: fallback,
      error: new CircuitBreakerError(
        fallbackResponse.message,
        'OPEN',
        this.tenantId
      ),
      outcome: 'circuit_open',
      durationMs,
      usedFallback: true,
      circuitState: 'OPEN',
    };
  }

  /**
   * Handle execution when circuit is HALF_OPEN (testing recovery)
   */
  private async handleHalfOpenState<T>(
    fn: () => Promise<T>,
    startTime: number,
    fallback?: T
  ): Promise<ExecutionResult<T>> {
    // Emit half-open test event
    this.emitEvent({
      type: 'execution_success', // Reusing type, but it's a test
      tenantId: this.tenantId,
      durationMs: 0,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await this.executeWithTimeout(fn);
      await this.recordHalfOpenSuccess(startTime);

      return {
        success: true,
        data: result,
        outcome: 'success',
        durationMs: Date.now() - startTime,
        usedFallback: false,
        circuitState: this.currentState.state,
      };
    } catch (error) {
      // Failure in HALF_OPEN: back to OPEN
      await this.transitionToOpen(
        error instanceof Error ? error.message : 'Half-open test failed'
      );

      return this.handleExecutionError<T>(error, startTime, fallback);
    }
  }

  /**
   * Handle execution errors
   */
  private async handleExecutionError<T>(
    error: unknown,
    startTime: number,
    fallback?: T
  ): Promise<ExecutionResult<T>> {
    const err = error instanceof Error ? error : new Error(String(error));
    const durationMs = Date.now() - startTime;
    const isTimeout = err instanceof TimeoutError;

    // Record failure
    await this.recordFailure(err.message, isTimeout);

    // Determine outcome
    const outcome: ExecutionOutcome = isTimeout ? 'timeout' : 'failure';

    // Emit event
    this.emitEvent({
      type: isTimeout ? 'execution_timeout' : 'execution_failure',
      tenantId: this.tenantId,
      durationMs,
      error: err.message,
      timestamp: new Date().toISOString(),
    });

    // Get appropriate fallback
    const fallbackType = isTimeout ? 'timeout' : 'systemError';
    const fallbackResponse = getFallbackResponse(fallbackType, this.language);

    return {
      success: false,
      data: fallback,
      error: err,
      outcome,
      durationMs,
      usedFallback: fallback !== undefined,
      circuitState: this.currentState.state,
    };
  }

  // =====================================================
  // TIMEOUT HANDLING
  // =====================================================

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      let settled = false;

      // Create timeout promise
      timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(
            new TimeoutError(
              `Operation timed out after ${this.config.timeout}ms`,
              this.config.timeout,
              this.tenantId
            )
          );
        }
      }, this.config.timeout);

      // Execute the function
      fn()
        .then((result) => {
          if (!settled) {
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!settled) {
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            reject(error);
          }
        });
    });
  }

  // =====================================================
  // STATE MANAGEMENT
  // =====================================================

  /**
   * Load state from store
   */
  private async loadState(): Promise<void> {
    try {
      this.currentState = await this.store.getState(this.tenantId);
      this.stateLoaded = true;
      this.metrics.currentState = this.currentState.state;
      this.metrics.lastStateChange = this.currentState.lastStateChange;
    } catch (error) {
      // On error, use default state
      this.currentState = { ...INITIAL_CIRCUIT_BREAKER_STATE };
      this.stateLoaded = true;
      console.error('Failed to load circuit breaker state:', error);
    }
  }

  /**
   * Save current state to store
   */
  private async saveState(): Promise<void> {
    try {
      await this.store.setState(this.tenantId, this.currentState);
    } catch (error) {
      console.error('Failed to save circuit breaker state:', error);
    }
  }

  /**
   * Check if recovery timeout has passed and transition to HALF_OPEN
   */
  private async checkRecoveryTimeout(): Promise<void> {
    if (this.currentState.state !== 'OPEN') {
      return;
    }

    if (!this.currentState.openedAt) {
      return;
    }

    const openedAt = new Date(this.currentState.openedAt).getTime();
    const now = Date.now();
    const elapsed = now - openedAt;

    if (elapsed >= this.config.recoveryTimeout) {
      await this.transitionToHalfOpen();
    }
  }

  /**
   * Record a successful execution
   */
  private async recordSuccess(startTime: number): Promise<void> {
    const durationMs = Date.now() - startTime;
    this.recordExecutionTime(durationMs);

    this.currentState.successCount++;
    this.currentState.failureCount = 0; // Reset consecutive failures
    this.currentState.totalExecutions++;

    // Update metrics
    this.metrics.successfulExecutions++;
    this.metrics.totalExecutions++;
    this.updateMetrics();

    // Emit success event
    this.emitEvent({
      type: 'execution_success',
      tenantId: this.tenantId,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    await this.saveState();
  }

  /**
   * Record a successful execution in HALF_OPEN state
   */
  private async recordHalfOpenSuccess(startTime: number): Promise<void> {
    const durationMs = Date.now() - startTime;
    this.recordExecutionTime(durationMs);

    this.currentState.successCount++;
    this.currentState.totalExecutions++;

    // Check if we've reached success threshold to close circuit
    if (this.currentState.successCount >= this.config.successThreshold) {
      await this.transitionToClosed();
    } else {
      await this.saveState();
    }

    // Update metrics
    this.metrics.successfulExecutions++;
    this.metrics.totalExecutions++;
    this.updateMetrics();

    // Emit success event
    this.emitEvent({
      type: 'execution_success',
      tenantId: this.tenantId,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record a failed execution
   */
  private async recordFailure(
    errorMessage: string,
    isTimeout: boolean
  ): Promise<void> {
    this.currentState.failureCount++;
    this.currentState.totalExecutions++;
    this.currentState.lastFailureAt = new Date().toISOString();
    this.currentState.lastError = errorMessage;
    this.currentState.successCount = 0; // Reset consecutive successes

    // Update metrics
    this.metrics.failedExecutions++;
    this.metrics.totalExecutions++;
    if (isTimeout) {
      this.metrics.timedOutExecutions++;
    }
    this.updateMetrics();

    // Check if we should open the circuit
    if (
      this.currentState.state === 'CLOSED' &&
      this.currentState.failureCount >= this.config.failureThreshold &&
      this.currentState.totalExecutions >= this.config.volumeThreshold
    ) {
      await this.transitionToOpen(errorMessage);
    } else {
      await this.saveState();
    }
  }

  // =====================================================
  // STATE TRANSITIONS
  // =====================================================

  /**
   * Transition to OPEN state
   */
  private async transitionToOpen(reason: string): Promise<void> {
    const previousState = this.currentState.state;

    this.currentState.state = 'OPEN';
    this.currentState.openedAt = new Date().toISOString();
    this.currentState.lastStateChange = new Date().toISOString();
    this.currentState.successCount = 0;

    await this.saveState();

    // Update metrics
    this.metrics.currentState = 'OPEN';
    this.metrics.lastStateChange = this.currentState.lastStateChange;
    this.metrics.stateChangeCount++;

    // Emit state change event
    this.emitEvent({
      type: 'state_change',
      tenantId: this.tenantId,
      previousState,
      newState: 'OPEN',
      reason: `Failure threshold reached: ${reason}`,
      timestamp: new Date().toISOString(),
    });

    // Log warning
    console.warn(
      `[CircuitBreaker] Circuit OPENED for tenant ${this.tenantId}:`,
      {
        failureCount: this.currentState.failureCount,
        reason,
      }
    );
  }

  /**
   * Transition to HALF_OPEN state
   */
  private async transitionToHalfOpen(): Promise<void> {
    const previousState = this.currentState.state;

    this.currentState.state = 'HALF_OPEN';
    this.currentState.lastStateChange = new Date().toISOString();
    this.currentState.successCount = 0;
    this.currentState.failureCount = 0;

    await this.saveState();

    // Update metrics
    this.metrics.currentState = 'HALF_OPEN';
    this.metrics.lastStateChange = this.currentState.lastStateChange;
    this.metrics.stateChangeCount++;

    // Emit state change event
    this.emitEvent({
      type: 'state_change',
      tenantId: this.tenantId,
      previousState,
      newState: 'HALF_OPEN',
      reason: 'Recovery timeout elapsed',
      timestamp: new Date().toISOString(),
    });

    console.info(
      `[CircuitBreaker] Circuit HALF_OPEN for tenant ${this.tenantId}:`,
      'Testing recovery...'
    );
  }

  /**
   * Transition to CLOSED state
   */
  private async transitionToClosed(): Promise<void> {
    const previousState = this.currentState.state;

    this.currentState.state = 'CLOSED';
    this.currentState.openedAt = null;
    this.currentState.lastStateChange = new Date().toISOString();
    this.currentState.failureCount = 0;

    await this.saveState();

    // Update metrics
    this.metrics.currentState = 'CLOSED';
    this.metrics.lastStateChange = this.currentState.lastStateChange;
    this.metrics.stateChangeCount++;

    // Emit state change event
    this.emitEvent({
      type: 'state_change',
      tenantId: this.tenantId,
      previousState,
      newState: 'CLOSED',
      reason: 'Success threshold reached in HALF_OPEN',
      timestamp: new Date().toISOString(),
    });

    console.info(
      `[CircuitBreaker] Circuit CLOSED for tenant ${this.tenantId}:`,
      'Service recovered!'
    );
  }

  // =====================================================
  // METRICS
  // =====================================================

  /**
   * Record execution time for average calculation
   */
  private recordExecutionTime(durationMs: number): void {
    this.executionTimes.push(durationMs);

    // Keep only last 100 execution times
    if (this.executionTimes.length > 100) {
      this.executionTimes.shift();
    }
  }

  /**
   * Update metrics calculations
   */
  private updateMetrics(): void {
    const total = this.metrics.totalExecutions;
    if (total > 0) {
      this.metrics.successRate = this.metrics.successfulExecutions / total;
      this.metrics.failureRate = this.metrics.failedExecutions / total;
    }

    // Calculate average execution time
    if (this.executionTimes.length > 0) {
      const sum = this.executionTimes.reduce((a, b) => a + b, 0);
      this.metrics.averageExecutionTimeMs = sum / this.executionTimes.length;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = { ...INITIAL_METRICS };
    this.executionTimes = [];
  }

  // =====================================================
  // EVENTS
  // =====================================================

  /**
   * Subscribe to circuit breaker events
   */
  onEvent(handler: CircuitBreakerEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Emit an event to all handlers
   */
  private emitEvent(event: CircuitBreakerEvent): void {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in circuit breaker event handler:', error);
      }
    });
  }

  // =====================================================
  // PUBLIC GETTERS
  // =====================================================

  /**
   * Get current circuit state
   */
  getState(): CircuitBreakerState {
    return this.currentState.state;
  }

  /**
   * Get full state object
   */
  getFullState(): CircuitBreakerStoreState {
    return { ...this.currentState };
  }

  /**
   * Get configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.currentState.state === 'OPEN';
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.currentState.state === 'CLOSED';
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.currentState.state === 'HALF_OPEN';
  }

  // =====================================================
  // MANUAL CONTROLS
  // =====================================================

  /**
   * Force circuit to open (for testing/admin)
   */
  async forceOpen(reason: string = 'Manually opened'): Promise<void> {
    await this.transitionToOpen(reason);
  }

  /**
   * Force circuit to close (for testing/admin)
   */
  async forceClose(): Promise<void> {
    this.currentState.state = 'CLOSED';
    this.currentState.failureCount = 0;
    this.currentState.successCount = 0;
    this.currentState.openedAt = null;
    this.currentState.lastStateChange = new Date().toISOString();
    await this.saveState();
  }

  /**
   * Reset circuit breaker to initial state
   */
  async reset(): Promise<void> {
    this.currentState = { ...INITIAL_CIRCUIT_BREAKER_STATE };
    this.currentState.lastStateChange = new Date().toISOString();
    await this.saveState();
    this.resetMetrics();
  }
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create a voice circuit breaker instance
 */
export function createVoiceCircuitBreaker(
  tenantId: string,
  store: CircuitBreakerStore,
  config?: Partial<CircuitBreakerConfig>,
  language: 'es-MX' | 'en-US' = 'es-MX'
): VoiceCircuitBreaker {
  return new VoiceCircuitBreaker(tenantId, store, config, language);
}

/**
 * Create a circuit breaker with default configuration for voice
 */
export function createDefaultVoiceCircuitBreaker(
  tenantId: string,
  store: CircuitBreakerStore,
  language: 'es-MX' | 'en-US' = 'es-MX'
): VoiceCircuitBreaker {
  return new VoiceCircuitBreaker(
    tenantId,
    store,
    {
      // Voice-optimized defaults
      failureThreshold: 5,
      recoveryTimeout: 30_000, // 30 seconds
      timeout: 8_000, // 8 seconds - critical for voice
      volumeThreshold: 10,
      successThreshold: 1,
    },
    language
  );
}

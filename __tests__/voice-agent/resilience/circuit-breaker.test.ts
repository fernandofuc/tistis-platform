/**
 * TIS TIS Platform - Voice Agent v2.0
 * Circuit Breaker Tests
 *
 * Comprehensive tests for the Circuit Breaker pattern:
 * - State transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
 * - Timeout handling
 * - Failure counting
 * - Fallback responses
 * - Metrics tracking
 * - Event emission
 *
 * @jest-environment node
 */

import {
  VoiceCircuitBreaker,
  InMemoryCircuitBreakerStore,
  createVoiceCircuitBreaker,
  createDefaultVoiceCircuitBreaker,
  getFallbackResponse,
  getShortFallbackMessage,
  buildFallbackMessage,
  isLanguageSupported,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  INITIAL_CIRCUIT_BREAKER_STATE,
  CircuitBreakerError,
  TimeoutError,
} from '../../../lib/voice-agent/resilience';
import type {
  CircuitBreakerEvent,
  CircuitBreakerStoreState,
} from '../../../lib/voice-agent/resilience';

// =====================================================
// TEST HELPERS
// =====================================================

/**
 * Create a function that succeeds
 */
function createSuccessfulFn<T>(result: T, delayMs: number = 0): () => Promise<T> {
  return async () => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return result;
  };
}

/**
 * Create a function that fails
 */
function createFailingFn(errorMessage: string = 'Test error'): () => Promise<never> {
  return async () => {
    throw new Error(errorMessage);
  };
}

/**
 * Create a function that times out
 */
function createSlowFn<T>(result: T, delayMs: number): () => Promise<T> {
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return result;
  };
}

/**
 * Helper to wait for a duration
 */
async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =====================================================
// CIRCUIT BREAKER STATE TESTS
// =====================================================

describe('VoiceCircuitBreaker', () => {
  let store: InMemoryCircuitBreakerStore;
  let circuitBreaker: VoiceCircuitBreaker;
  const businessId = 'test-business-123';

  beforeEach(() => {
    store = new InMemoryCircuitBreakerStore();
    circuitBreaker = new VoiceCircuitBreaker(businessId, store, {
      failureThreshold: 3,
      recoveryTimeout: 1000, // 1 second for testing
      timeout: 500, // 500ms timeout for testing
      volumeThreshold: 3,
      successThreshold: 1,
    });
  });

  describe('CLOSED State', () => {
    it('should execute function normally when closed', async () => {
      const result = await circuitBreaker.execute(
        createSuccessfulFn({ data: 'success' })
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 'success' });
      expect(result.outcome).toBe('success');
      expect(result.circuitState).toBe('CLOSED');
      expect(result.usedFallback).toBe(false);
    });

    it('should increment failure count on error', async () => {
      await circuitBreaker.execute(createFailingFn());

      const state = circuitBreaker.getFullState();
      expect(state.failureCount).toBe(1);
    });

    it('should reset failure count on success', async () => {
      // Cause 2 failures
      await circuitBreaker.execute(createFailingFn());
      await circuitBreaker.execute(createFailingFn());

      let state = circuitBreaker.getFullState();
      expect(state.failureCount).toBe(2);

      // Then succeed
      await circuitBreaker.execute(createSuccessfulFn('ok'));

      state = circuitBreaker.getFullState();
      expect(state.failureCount).toBe(0);
    });

    it('should transition to OPEN after reaching failure threshold', async () => {
      // Need to reach volumeThreshold first (3 requests)
      // Then reach failureThreshold (3 failures)
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(createFailingFn());
      }

      expect(circuitBreaker.getState()).toBe('OPEN');
      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should not open if volume threshold not reached', async () => {
      // Create a circuit breaker with higher volume threshold
      const cb = new VoiceCircuitBreaker(businessId, store, {
        failureThreshold: 2,
        volumeThreshold: 10, // High volume threshold
        timeout: 500,
        recoveryTimeout: 1000,
        successThreshold: 1,
        slidingWindowSize: 60000,
      });

      // 2 failures but under volume threshold
      await cb.execute(createFailingFn());
      await cb.execute(createFailingFn());

      // Should still be closed because volume threshold not reached
      expect(cb.getState()).toBe('CLOSED');
    });
  });

  describe('OPEN State', () => {
    beforeEach(async () => {
      // Open the circuit by causing failures
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(createFailingFn());
      }
      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should not execute function when open', async () => {
      let executed = false;
      const result = await circuitBreaker.execute(async () => {
        executed = true;
        return 'should not see this';
      });

      expect(executed).toBe(false);
      expect(result.success).toBe(false);
      expect(result.outcome).toBe('circuit_open');
      expect(result.usedFallback).toBe(true);
    });

    it('should return fallback when open', async () => {
      const fallbackValue = 'fallback';
      const result = await circuitBreaker.execute(
        createSuccessfulFn('real value'),
        fallbackValue
      );

      expect(result.data).toBe(fallbackValue);
    });

    it('should have CircuitBreakerError when open', async () => {
      const result = await circuitBreaker.execute(createSuccessfulFn('x'));

      expect(result.error).toBeInstanceOf(CircuitBreakerError);
      expect((result.error as CircuitBreakerError).state).toBe('OPEN');
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Wait for recovery timeout
      await wait(1100);

      // Next execution should trigger transition check
      await circuitBreaker.execute(createSuccessfulFn('test'));

      expect(circuitBreaker.getState()).toBe('CLOSED'); // Successful, so closed
    });
  });

  describe('HALF_OPEN State', () => {
    beforeEach(async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(createFailingFn());
      }
      expect(circuitBreaker.isOpen()).toBe(true);

      // Wait for recovery timeout to transition to HALF_OPEN
      await wait(1100);
    });

    it('should allow one test request in half-open', async () => {
      let execCount = 0;
      const fn = async () => {
        execCount++;
        return 'success';
      };

      const result = await circuitBreaker.execute(fn);

      expect(execCount).toBe(1);
      expect(result.success).toBe(true);
    });

    it('should transition to CLOSED on success', async () => {
      await circuitBreaker.execute(createSuccessfulFn('test'));

      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.isClosed()).toBe(true);
    });

    it('should transition back to OPEN on failure', async () => {
      // Trigger check for half-open (first request)
      await circuitBreaker.execute(createFailingFn('half-open fail'));

      expect(circuitBreaker.getState()).toBe('OPEN');
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout slow operations', async () => {
      const result = await circuitBreaker.execute(
        createSlowFn('slow result', 1000) // 1s > 500ms timeout
      );

      expect(result.success).toBe(false);
      expect(result.outcome).toBe('timeout');
      expect(result.error).toBeInstanceOf(TimeoutError);
    });

    it('should complete fast operations before timeout', async () => {
      const result = await circuitBreaker.execute(
        createSlowFn('fast result', 100) // 100ms < 500ms timeout
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('fast result');
    });

    it('should count timeout as failure', async () => {
      await circuitBreaker.execute(createSlowFn('x', 1000));

      const state = circuitBreaker.getFullState();
      expect(state.failureCount).toBe(1);
    });

    it('should open circuit after multiple timeouts', async () => {
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(createSlowFn('x', 1000));
      }

      expect(circuitBreaker.isOpen()).toBe(true);
    });
  });

  describe('Metrics', () => {
    it('should track successful executions', async () => {
      await circuitBreaker.execute(createSuccessfulFn('a'));
      await circuitBreaker.execute(createSuccessfulFn('b'));
      await circuitBreaker.execute(createSuccessfulFn('c'));

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalExecutions).toBe(3);
      expect(metrics.successfulExecutions).toBe(3);
      expect(metrics.successRate).toBe(1);
    });

    it('should track failed executions', async () => {
      await circuitBreaker.execute(createSuccessfulFn('ok'));
      await circuitBreaker.execute(createFailingFn());
      await circuitBreaker.execute(createFailingFn());

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalExecutions).toBe(3);
      expect(metrics.failedExecutions).toBe(2);
      expect(metrics.failureRate).toBeCloseTo(2 / 3);
    });

    it('should track timeouts separately', async () => {
      await circuitBreaker.execute(createSlowFn('x', 1000));
      await circuitBreaker.execute(createFailingFn());

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.timedOutExecutions).toBe(1);
      expect(metrics.failedExecutions).toBe(2); // Timeout counts as failure too
    });

    it('should track state changes', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(createFailingFn());
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.stateChangeCount).toBe(1); // CLOSED -> OPEN
      expect(metrics.currentState).toBe('OPEN');
    });

    it('should reset metrics', async () => {
      await circuitBreaker.execute(createSuccessfulFn('x'));
      await circuitBreaker.execute(createFailingFn());

      circuitBreaker.resetMetrics();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.successfulExecutions).toBe(0);
    });
  });

  describe('Events', () => {
    it('should emit success events', async () => {
      const events: CircuitBreakerEvent[] = [];
      circuitBreaker.onEvent((event) => events.push(event));

      await circuitBreaker.execute(createSuccessfulFn('test'));

      expect(events.some((e) => e.type === 'execution_success')).toBe(true);
    });

    it('should emit failure events', async () => {
      const events: CircuitBreakerEvent[] = [];
      circuitBreaker.onEvent((event) => events.push(event));

      await circuitBreaker.execute(createFailingFn('oops'));

      const failEvent = events.find((e) => e.type === 'execution_failure');
      expect(failEvent).toBeDefined();
      expect((failEvent as any).error).toBe('oops');
    });

    it('should emit state change events', async () => {
      const events: CircuitBreakerEvent[] = [];
      circuitBreaker.onEvent((event) => events.push(event));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(createFailingFn());
      }

      const stateChange = events.find((e) => e.type === 'state_change');
      expect(stateChange).toBeDefined();
      expect((stateChange as any).previousState).toBe('CLOSED');
      expect((stateChange as any).newState).toBe('OPEN');
    });

    it('should emit fallback events when open', async () => {
      const events: CircuitBreakerEvent[] = [];
      circuitBreaker.onEvent((event) => events.push(event));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(createFailingFn());
      }

      // Try when open
      await circuitBreaker.execute(createSuccessfulFn('x'));

      expect(events.some((e) => e.type === 'fallback_served')).toBe(true);
    });

    it('should allow unsubscribing from events', async () => {
      const events: CircuitBreakerEvent[] = [];
      const unsubscribe = circuitBreaker.onEvent((event) => events.push(event));

      await circuitBreaker.execute(createSuccessfulFn('a'));
      expect(events.length).toBeGreaterThan(0);

      const countBefore = events.length;
      unsubscribe();

      await circuitBreaker.execute(createSuccessfulFn('b'));
      expect(events.length).toBe(countBefore); // No new events
    });
  });

  describe('Manual Controls', () => {
    it('should force open the circuit', async () => {
      await circuitBreaker.forceOpen('Manual test');

      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should force close the circuit', async () => {
      // Open first
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(createFailingFn());
      }
      expect(circuitBreaker.isOpen()).toBe(true);

      await circuitBreaker.forceClose();

      expect(circuitBreaker.isClosed()).toBe(true);
    });

    it('should reset the circuit breaker', async () => {
      // Cause some state changes
      await circuitBreaker.execute(createFailingFn());
      await circuitBreaker.execute(createSuccessfulFn('x'));

      await circuitBreaker.reset();

      const state = circuitBreaker.getFullState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
      expect(state.successCount).toBe(0);
    });
  });

  describe('Store Persistence', () => {
    it('should persist state to store', async () => {
      await circuitBreaker.execute(createFailingFn());
      await circuitBreaker.execute(createFailingFn());

      // Get state directly from store
      const storedState = await store.getState(businessId);
      expect(storedState.failureCount).toBe(2);
    });

    it('should load state from store on first execution', async () => {
      // Pre-populate store with state
      const preState: CircuitBreakerStoreState = {
        state: 'OPEN',
        failureCount: 5,
        successCount: 0,
        openedAt: new Date().toISOString(),
        lastFailureAt: new Date().toISOString(),
        lastError: 'Previous error',
        totalExecutions: 10,
        lastStateChange: new Date().toISOString(),
      };
      await store.setState(businessId, preState);

      // Create new circuit breaker with same businessId
      const cb2 = new VoiceCircuitBreaker(businessId, store, {
        failureThreshold: 3,
        recoveryTimeout: 100000, // Long timeout so it stays open
        timeout: 500,
        volumeThreshold: 3,
        successThreshold: 1,
        slidingWindowSize: 60000,
      });

      // Execute should fail fast due to OPEN state
      let executed = false;
      await cb2.execute(async () => {
        executed = true;
        return 'x';
      });

      expect(executed).toBe(false);
      expect(cb2.isOpen()).toBe(true);
    });
  });
});

// =====================================================
// FALLBACK RESPONSES TESTS
// =====================================================

describe('Fallback Responses', () => {
  describe('getFallbackResponse', () => {
    it('should return Spanish fallback by default', () => {
      const response = getFallbackResponse('systemError');

      expect(response.language).toBe('es-MX');
      expect(response.message).toContain('Lo siento');
    });

    it('should return English fallback when requested', () => {
      const response = getFallbackResponse('systemError', 'en-US');

      expect(response.language).toBe('en-US');
      expect(response.message).toContain('sorry');
    });

    it('should include alternative action', () => {
      const response = getFallbackResponse('circuitOpen', 'es-MX');

      expect(response.offerAlternative).toBe(true);
      expect(response.alternativeAction).toBeDefined();
    });

    it('should return correct type', () => {
      const response = getFallbackResponse('timeout', 'en-US');

      expect(response.type).toBe('timeout');
    });
  });

  describe('getShortFallbackMessage', () => {
    it('should return shorter messages', () => {
      const short = getShortFallbackMessage('systemError', 'es-MX');
      const full = getFallbackResponse('systemError', 'es-MX');

      expect(short.length).toBeLessThan(full.message.length);
    });
  });

  describe('buildFallbackMessage', () => {
    it('should include alternative when requested', () => {
      const message = buildFallbackMessage('circuitOpen', 'es-MX', true);

      expect(message).toContain('dificultades técnicas');
      expect(message).toContain('intenta'); // From alternative
    });

    it('should exclude alternative when not requested', () => {
      const withAlt = buildFallbackMessage('circuitOpen', 'es-MX', true);
      const withoutAlt = buildFallbackMessage('circuitOpen', 'es-MX', false);

      expect(withoutAlt.length).toBeLessThan(withAlt.length);
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(isLanguageSupported('es-MX')).toBe(true);
      expect(isLanguageSupported('en-US')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(isLanguageSupported('fr-FR')).toBe(false);
      expect(isLanguageSupported('de-DE')).toBe(false);
    });
  });
});

// =====================================================
// FACTORY FUNCTIONS TESTS
// =====================================================

describe('Factory Functions', () => {
  describe('createVoiceCircuitBreaker', () => {
    it('should create circuit breaker with custom config', () => {
      const store = new InMemoryCircuitBreakerStore();
      const cb = createVoiceCircuitBreaker('test', store, {
        failureThreshold: 10,
        timeout: 5000,
      });

      const config = cb.getConfig();
      expect(config.failureThreshold).toBe(10);
      expect(config.timeout).toBe(5000);
    });
  });

  describe('createDefaultVoiceCircuitBreaker', () => {
    it('should create circuit breaker with voice-optimized defaults', () => {
      const store = new InMemoryCircuitBreakerStore();
      const cb = createDefaultVoiceCircuitBreaker('test', store);

      const config = cb.getConfig();
      expect(config.timeout).toBe(8000); // Voice critical timeout
      expect(config.failureThreshold).toBe(5);
      expect(config.recoveryTimeout).toBe(30000);
    });

    it('should accept language parameter', () => {
      const store = new InMemoryCircuitBreakerStore();
      const cbSpanish = createDefaultVoiceCircuitBreaker('test', store, 'es-MX');
      const cbEnglish = createDefaultVoiceCircuitBreaker('test', store, 'en-US');

      // Both should be created successfully
      expect(cbSpanish).toBeInstanceOf(VoiceCircuitBreaker);
      expect(cbEnglish).toBeInstanceOf(VoiceCircuitBreaker);
    });
  });
});

// =====================================================
// IN-MEMORY STORE TESTS
// =====================================================

describe('InMemoryCircuitBreakerStore', () => {
  let store: InMemoryCircuitBreakerStore;

  beforeEach(() => {
    store = new InMemoryCircuitBreakerStore();
  });

  it('should return initial state for new business', async () => {
    const state = await store.getState('new-business');

    expect(state.state).toBe('CLOSED');
    expect(state.failureCount).toBe(0);
  });

  it('should persist state changes', async () => {
    const newState: CircuitBreakerStoreState = {
      state: 'OPEN',
      failureCount: 5,
      successCount: 0,
      openedAt: new Date().toISOString(),
      lastFailureAt: new Date().toISOString(),
      lastError: 'Test error',
      totalExecutions: 10,
      lastStateChange: new Date().toISOString(),
    };

    await store.setState('test', newState);
    const retrieved = await store.getState('test');

    expect(retrieved.state).toBe('OPEN');
    expect(retrieved.failureCount).toBe(5);
  });

  it('should delete state', async () => {
    await store.setState('test', {
      ...INITIAL_CIRCUIT_BREAKER_STATE,
      failureCount: 3,
    });

    await store.deleteState('test');
    const state = await store.getState('test');

    expect(state.failureCount).toBe(0); // Fresh state
  });

  it('should get all states', async () => {
    await store.setState('business-1', {
      ...INITIAL_CIRCUIT_BREAKER_STATE,
      failureCount: 1,
    });
    await store.setState('business-2', {
      ...INITIAL_CIRCUIT_BREAKER_STATE,
      failureCount: 2,
    });

    const allStates = await store.getAllStates();

    expect(allStates.size).toBe(2);
    expect(allStates.get('business-1')?.failureCount).toBe(1);
    expect(allStates.get('business-2')?.failureCount).toBe(2);
  });

  it('should clear all states', () => {
    store.clear();
    expect(store.size()).toBe(0);
  });
});

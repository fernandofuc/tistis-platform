/**
 * TIS TIS Platform - Voice Agent v2.0
 * Resilience Module Exports
 *
 * This module provides resilience patterns for the Voice Agent:
 * - Circuit Breaker: Protects against cascading failures
 * - Fallback Responses: User-friendly error messages
 * - Persistent State: State survives restarts via Supabase
 *
 * @example
 * ```typescript
 * import {
 *   VoiceCircuitBreaker,
 *   createCircuitBreakerStore,
 *   getFallbackResponse
 * } from '@/lib/voice-agent/resilience';
 *
 * // Create store and circuit breaker
 * const store = createCircuitBreakerStore({ serviceName: 'voice_agent' });
 * const circuitBreaker = new VoiceCircuitBreaker(tenantId, store);
 *
 * // Execute with protection
 * const result = await circuitBreaker.execute(async () => {
 *   return await someRiskyOperation();
 * });
 *
 * if (!result.success) {
 *   const fallback = getFallbackResponse('systemError', 'es-MX');
 *   console.log(fallback.message);
 * }
 * ```
 */

// =====================================================
// MAIN EXPORTS
// =====================================================

// Circuit Breaker
export {
  VoiceCircuitBreaker,
  createVoiceCircuitBreaker,
  createDefaultVoiceCircuitBreaker,
} from './circuit-breaker';

// Circuit Breaker Store
export {
  SupabaseCircuitBreakerStore,
  InMemoryCircuitBreakerStore,
  createCircuitBreakerStore,
} from './circuit-breaker-store';

// Fallback Responses
export {
  getFallbackResponse,
  getShortFallbackMessage,
  getContextualFallback,
  buildFallbackMessage,
  getSupportedLanguages,
  isLanguageSupported,
  getFallbackWithSSML,
  FALLBACK_RESPONSES,
  SHORT_FALLBACK_RESPONSES,
  CONTEXTUAL_FALLBACKS,
} from './fallback-responses';

// =====================================================
// TYPE EXPORTS
// =====================================================

export type {
  // States
  CircuitBreakerState,

  // Configuration
  CircuitBreakerConfig,

  // Store
  CircuitBreakerStore,
  CircuitBreakerStoreState,

  // Execution
  ExecutionResult,
  ExecutionOutcome,

  // Events
  CircuitBreakerEvent,
  CircuitBreakerEventType,
  CircuitBreakerEventHandler,
  StateChangeEvent,
  ExecutionEvent,
  FallbackEvent,

  // Metrics
  CircuitBreakerMetrics,

  // Fallback
  FallbackType,
  FallbackResponse,
  SupportedLanguage,
} from './types';

// Store config type
export type { CircuitBreakerStoreConfig } from './circuit-breaker-store';

// =====================================================
// CONSTANTS EXPORTS
// =====================================================

export {
  CIRCUIT_BREAKER_STATES,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  INITIAL_CIRCUIT_BREAKER_STATE,
  INITIAL_METRICS,
} from './types';

// =====================================================
// ERROR EXPORTS
// =====================================================

export {
  CircuitBreakerError,
  TimeoutError,
} from './types';

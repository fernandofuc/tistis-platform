/**
 * TIS TIS Platform - Voice Agent v2.0
 * Main Module Exports
 *
 * This is the main entry point for the Voice Agent module.
 * It re-exports all components from sub-modules for easy access.
 *
 * @example
 * ```typescript
 * import {
 *   // Security
 *   createSecurityGate,
 *   WebhookSecurityGate,
 *
 *   // Resilience
 *   VoiceCircuitBreaker,
 *   createCircuitBreakerStore,
 *   getFallbackResponse,
 * } from '@/lib/voice-agent';
 * ```
 */

// =====================================================
// SECURITY MODULE
// =====================================================

export {
  // Main classes
  WebhookSecurityGate,
  IPWhitelist,
  RateLimiter,
  MultiTierRateLimiter,
  SecurityLogger,

  // Factory functions
  createSecurityGate,
  createDevSecurityGate,
  createSecurityLogger,

  // Convenience functions
  logSecurityEvent,
  logValidationResult,
  validateVapiWebhook,

  // Utility functions
  parseCIDR,
  isIPInRange,
  isValidIPv4,
  isValidIPv6,

  // Constants
  DEFAULT_VAPI_IP_RANGES,
  DEFAULT_SECURITY_CONFIG,
  isVapiWebhookPayload,
  isValidVapiMessageType,
} from './security';

// Security types
export type {
  SecurityValidationResult,
  ValidationLayer,
  ValidationCheckResult,
  SecurityEvent,
  SecurityEventType,
  SecurityGateConfig,
  IPWhitelistConfig,
  RateLimiterConfig,
  TimestampConfig,
  HmacConfig,
  ContentValidationConfig,
  RateLimitEntry,
  RateLimitResult,
  VapiWebhookPayload,
  VapiMessageType,
  SecurityLoggerConfig,
  SecurityLogEntry,
  LogLevel,
} from './security';

// =====================================================
// RESILIENCE MODULE
// =====================================================

export {
  // Main classes
  VoiceCircuitBreaker,
  SupabaseCircuitBreakerStore,
  InMemoryCircuitBreakerStore,

  // Factory functions
  createVoiceCircuitBreaker,
  createDefaultVoiceCircuitBreaker,
  createCircuitBreakerStore,

  // Fallback functions
  getFallbackResponse,
  getShortFallbackMessage,
  getContextualFallback,
  buildFallbackMessage,
  getSupportedLanguages,
  isLanguageSupported,
  getFallbackWithSSML,

  // Fallback constants
  FALLBACK_RESPONSES,
  SHORT_FALLBACK_RESPONSES,
  CONTEXTUAL_FALLBACKS,

  // Config constants
  CIRCUIT_BREAKER_STATES,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  INITIAL_CIRCUIT_BREAKER_STATE,
  INITIAL_METRICS,

  // Errors
  CircuitBreakerError,
  TimeoutError,
} from './resilience';

// Resilience types
export type {
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerStore,
  CircuitBreakerStoreState,
  CircuitBreakerStoreConfig,
  ExecutionResult,
  ExecutionOutcome,
  CircuitBreakerEvent,
  CircuitBreakerEventType,
  CircuitBreakerEventHandler,
  StateChangeEvent,
  ExecutionEvent,
  FallbackEvent,
  CircuitBreakerMetrics,
  FallbackType,
  FallbackResponse,
  SupportedLanguage,
} from './resilience';

// =====================================================
// TYPES MODULE (Assistant Types)
// =====================================================

export {
  // Manager
  AssistantTypeManager,
  createAssistantTypeManager,
  createLocalAssistantTypeManager,
  createInitializedManager,

  // Predefined types
  REST_BASIC,
  REST_STANDARD,
  REST_COMPLETE,
  DENTAL_BASIC,
  DENTAL_STANDARD,
  DENTAL_COMPLETE,
  ASSISTANT_TYPES,
  ASSISTANT_TYPES_MAP,
  RESTAURANT_TYPES,
  DENTAL_TYPES,

  // Capability definitions
  RESTAURANT_CAPABILITIES,
  RESTAURANT_TOOLS,
  DENTAL_CAPABILITIES,
  DENTAL_TOOLS,
  CAPABILITY_DESCRIPTIONS,
  TOOL_DESCRIPTIONS,
  CAPABILITY_TOOLS,

  // Constants
  VERTICALS,
  ASSISTANT_TYPE_IDS,
  PERSONALITY_DESCRIPTIONS,
  LEVEL_DESCRIPTIONS,

  // Helper functions
  getAssistantTypeById,
  getTypesForVertical,
  getRecommendedType,
  getActiveTypes,
  getActiveTypesForVertical,
  typeExists,
  getTypeIdsForVertical,
  getCapabilitiesForLevel,
  getToolsForLevel,
  getCapabilitiesForTypeId,
  getToolsForTypeId,
  getVerticalFromTypeId,
  getLevelFromTypeId,
  isCapabilityValidForVertical,
  isToolValidForVertical,
  getToolsForCapability,
  getAddedCapabilities,
  getAddedTools,

  // Type guards
  isValidVertical,
  isValidAssistantTypeId,
  isValidCapability,
  isValidTool,
  isValidPersonalityType,
  isValidAssistantTypeLevel,
  rowToAssistantType,
  typeToDisplayInfo,

  // Validation arrays
  ALL_CAPABILITIES,
  ALL_TOOLS,
} from './types';

// Types module types
export type {
  Vertical,
  Capability,
  RestaurantCapability,
  DentalCapability,
  Tool,
  PersonalityType,
  AssistantTypeLevel,
  AssistantTypeId,
  AssistantType,
  AssistantTypeConfig,
  ResolvedAssistantConfig,
  AssistantTypeValidationResult,
  AssistantTypeValidationError,
  AssistantTypeErrorCode,
  AssistantTypeDisplayInfo,
  AssistantTypeComparison,
  AssistantTypeRow,
} from './types';

// =====================================================
// VOICE RAG MODULE
// =====================================================

export {
  // Core
  VoiceRAG,
  createVoiceRAG,
  getVoiceRAG,
  resetVoiceRAG,

  // Query Optimizer
  QueryOptimizer,
  createQueryOptimizer,
  getQueryOptimizer,
  resetQueryOptimizer,

  // Cache
  VoiceRAGCache,
  AutoCleanupCache,
  createCache,
  createAutoCleanupCache,
  getCache,
  resetCache,
  hashQuery,
  normalizeQueryForCache,

  // Response Formatter
  ResponseFormatter,
  createResponseFormatter,
  getResponseFormatter,
  resetResponseFormatter,
  formatMenuForVoice,
  formatHoursForVoice,
  formatLocationForVoice,
} from './rag';

// VoiceRAG types
export type {
  // Query types
  QueryIntent,
  QueryUrgency,
  OptimizedQuery,
  QueryOptimizerConfig,

  // Cache types
  CacheConfig,
  CacheEntry,
  CacheMetrics,

  // Retrieval types
  RetrievedDocument,
  RetrievalConfig,

  // Response types
  FormattedResponse,
  ResponseFormatterConfig,

  // VoiceRAG types
  RAGContext,
  VoiceRAGResult,
  VoiceRAGConfig,
  VoiceRAGMetrics,

  // Dictionary types
  SynonymDictionary,
  AbbreviationDictionary,

  // Locale type
  SupportedLocale,
} from './rag';

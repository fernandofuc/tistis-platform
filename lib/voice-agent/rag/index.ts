/**
 * TIS TIS Platform - Voice Agent v2.0
 * VoiceRAG Module Index
 *
 * Central export point for the voice-optimized RAG system.
 */

// =====================================================
// TYPE EXPORTS
// =====================================================

export * from './types';

// =====================================================
// CORE EXPORTS
// =====================================================

export {
  VoiceRAG,
  createVoiceRAG,
  getVoiceRAG,
  resetVoiceRAG,
} from './voice-rag';

// =====================================================
// QUERY OPTIMIZER EXPORTS
// =====================================================

export {
  QueryOptimizer,
  createQueryOptimizer,
  getQueryOptimizer,
  resetQueryOptimizer,
} from './query-optimizer';

// =====================================================
// CACHE EXPORTS
// =====================================================

export {
  VoiceRAGCache,
  AutoCleanupCache,
  createCache,
  createAutoCleanupCache,
  getCache,
  resetCache,
  hashQuery,
  normalizeQueryForCache,
} from './cache';

// =====================================================
// RESPONSE FORMATTER EXPORTS
// =====================================================

export {
  ResponseFormatter,
  createResponseFormatter,
  getResponseFormatter,
  resetResponseFormatter,
  formatMenuForVoice,
  formatHoursForVoice,
  formatLocationForVoice,
} from './response-formatter';

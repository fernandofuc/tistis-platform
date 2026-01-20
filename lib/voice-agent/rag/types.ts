/**
 * TIS TIS Platform - Voice Agent v2.0
 * VoiceRAG Types
 *
 * Type definitions for the voice-optimized RAG system.
 * Designed for low latency and natural voice responses.
 */

// =====================================================
// QUERY TYPES
// =====================================================

/**
 * Query intent detected by the optimizer
 */
export type QueryIntent =
  | 'menu'           // Questions about food/drinks
  | 'services'       // Questions about services offered
  | 'hours'          // Business hours questions
  | 'location'       // Address/directions questions
  | 'pricing'        // Cost/pricing questions
  | 'policies'       // Policies (cancellation, payment, etc.)
  | 'availability'   // General availability questions
  | 'contact'        // Contact information
  | 'promotions'     // Deals/promotions
  | 'general';       // General business info

/**
 * Query urgency level
 */
export type QueryUrgency = 'immediate' | 'normal' | 'low';

/**
 * Supported locales
 */
export type SupportedLocale = 'es' | 'en';

/**
 * Optimized query result
 */
export interface OptimizedQuery {
  /** Original user query */
  original: string;

  /** Optimized/reformulated query */
  optimized: string;

  /** Detected intent */
  intent: QueryIntent;

  /** Keywords extracted */
  keywords: string[];

  /** Synonyms added */
  synonyms: string[];

  /** Urgency level */
  urgency: QueryUrgency;

  /** Categories to search */
  targetCategories: string[];

  /** Whether query was modified */
  wasModified: boolean;
}

/**
 * Query optimizer configuration
 */
export interface QueryOptimizerConfig {
  /** Enable synonym expansion */
  expandSynonyms?: boolean;

  /** Enable abbreviation expansion */
  expandAbbreviations?: boolean;

  /** Enable intent detection */
  detectIntent?: boolean;

  /** Custom synonym dictionary */
  customSynonyms?: Record<string, string[]>;

  /** Language for processing */
  locale?: string;
}

// =====================================================
// CACHE TYPES
// =====================================================

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  /** Cached value */
  value: T;

  /** When entry was created */
  createdAt: number;

  /** When entry expires */
  expiresAt: number;

  /** Number of times accessed */
  hitCount: number;

  /** Cache key */
  key: string;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** TTL in milliseconds (default: 5 minutes) */
  ttl?: number;

  /** Maximum cache entries (default: 100) */
  maxEntries?: number;

  /** Enable tenant isolation (default: true) */
  isolateByTenant?: boolean;

  /** Enable metrics tracking (default: true) */
  trackMetrics?: boolean;
}

/**
 * Cache metrics
 */
export interface CacheMetrics {
  /** Total cache hits */
  hits: number;

  /** Total cache misses */
  misses: number;

  /** Hit rate (0-1) */
  hitRate: number;

  /** Current entries count */
  entries: number;

  /** Evictions due to max size */
  evictions: number;

  /** Expirations due to TTL */
  expirations: number;
}

// =====================================================
// RETRIEVAL TYPES
// =====================================================

/**
 * Retrieved document from vector store
 */
export interface RetrievedDocument {
  /** Document ID */
  id: string;

  /** Document content */
  content: string;

  /** Similarity score (0-1) */
  similarity: number;

  /** Document category */
  category?: string;

  /** Source type (faq, knowledge, policy, etc.) */
  sourceType?: string;

  /** Last update time */
  updatedAt?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Retrieval configuration
 */
export interface RetrievalConfig {
  /** Maximum documents to retrieve */
  maxResults?: number;

  /** Minimum similarity threshold */
  minSimilarity?: number;

  /** Whether to use hybrid search */
  hybridSearch?: boolean;

  /** Category filter */
  categories?: string[];

  /** Source type filter */
  sourceTypes?: string[];

  /** Whether to apply recency boost */
  recencyBoost?: boolean;

  /** Re-rank results before returning */
  rerank?: boolean;
}

// =====================================================
// RESPONSE FORMATTER TYPES
// =====================================================

/**
 * Formatted response for voice
 */
export interface FormattedResponse {
  /** Voice-optimized response text */
  text: string;

  /** Summary (1-2 sentences) */
  summary: string;

  /** Whether response was truncated */
  wasTruncated: boolean;

  /** Original length before formatting */
  originalLength: number;

  /** Sources used */
  sources: string[];

  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Response formatter configuration
 */
export interface ResponseFormatterConfig {
  /** Maximum response length in characters */
  maxLength?: number;

  /** Maximum number of sentences */
  maxSentences?: number;

  /** Language for formatting */
  locale?: string;

  /** Include source citations */
  includeSources?: boolean;

  /** Simplify technical terms */
  simplifyTerms?: boolean;

  /** Response style */
  style?: 'concise' | 'detailed' | 'conversational';
}

// =====================================================
// VOICE RAG TYPES
// =====================================================

/**
 * VoiceRAG query context
 */
export interface RAGContext {
  /** Tenant ID */
  tenantId: string;

  /** Branch ID (optional) */
  branchId?: string;

  /** User locale */
  locale: SupportedLocale | string;

  /** Assistant type (rest_basic, dental_standard, etc.) */
  assistantType: string;

  /** Call ID for tracking */
  callId?: string;

  /** Conversation history for context */
  conversationHistory?: string;

  /** Entities extracted from query */
  entities?: Record<string, unknown>;

  /** Sub-intent from router */
  subIntent?: string;
}

/**
 * VoiceRAG result
 */
export interface VoiceRAGResult {
  /** Whether query was successful */
  success: boolean;

  /** Voice-optimized response */
  response: string;

  /** Formatted response details */
  formatted: FormattedResponse;

  /** Retrieved documents */
  sources: Array<{
    id: string;
    text: string;
    score: number;
    category?: string;
  }>;

  /** Query optimization details */
  queryOptimization?: OptimizedQuery;

  /** Whether result was from cache */
  fromCache: boolean;

  /** Total latency in ms */
  latencyMs: number;

  /** Breakdown of latency by component */
  latencyBreakdown?: {
    queryOptimization: number;
    retrieval: number;
    formatting: number;
  };

  /** Error message if failed */
  error?: string;
}

/**
 * VoiceRAG configuration
 */
export interface VoiceRAGConfig {
  /** Query optimizer config */
  queryOptimizer?: QueryOptimizerConfig;

  /** Retrieval config */
  retrieval?: RetrievalConfig;

  /** Response formatter config */
  responseFormatter?: ResponseFormatterConfig;

  /** Cache config */
  cache?: CacheConfig;

  /** Enable query optimization */
  enableQueryOptimization?: boolean;

  /** Enable caching */
  enableCache?: boolean;

  /** Fallback message when no results found */
  noResultsFallback?: {
    es: string;
    en: string;
  };

  /** Custom Supabase client (for testing) */
  supabaseClient?: unknown;
}

// =====================================================
// METRICS TYPES
// =====================================================

/**
 * VoiceRAG metrics
 */
export interface VoiceRAGMetrics {
  /** Total queries processed */
  totalQueries: number;

  /** Successful queries */
  successfulQueries: number;

  /** Failed queries */
  failedQueries: number;

  /** Average latency in ms */
  avgLatencyMs: number;

  /** Cache metrics */
  cache: CacheMetrics;

  /** Queries by intent */
  queriesByIntent: Record<QueryIntent, number>;

  /** Average documents retrieved */
  avgDocsRetrieved: number;

  /** P95 latency (placeholder - requires latency histogram for accurate calculation) */
  p95LatencyMs: number;
}

// =====================================================
// SYNONYM DICTIONARY TYPE
// =====================================================

/**
 * Synonym dictionary structure
 */
export interface SynonymDictionary {
  /** Spanish synonyms */
  es: Record<string, string[]>;

  /** English synonyms */
  en: Record<string, string[]>;
}

/**
 * Abbreviation dictionary structure
 */
export interface AbbreviationDictionary {
  /** Spanish abbreviations */
  es: Record<string, string>;

  /** English abbreviations */
  en: Record<string, string>;
}

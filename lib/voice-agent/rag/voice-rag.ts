/**
 * TIS TIS Platform - Voice Agent v2.0
 * VoiceRAG Core
 *
 * Main VoiceRAG service that orchestrates:
 * - Query optimization
 * - Vector search/retrieval
 * - Response formatting
 * - Caching
 *
 * Optimized for low latency voice interactions.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  VoiceRAGConfig,
  VoiceRAGResult,
  RAGContext,
  RetrievedDocument,
  RetrievalConfig,
  VoiceRAGMetrics,
  QueryIntent,
} from './types';
import { QueryOptimizer, createQueryOptimizer } from './query-optimizer';
import { ResponseFormatter, createResponseFormatter } from './response-formatter';
import { VoiceRAGCache, createCache } from './cache';

// =====================================================
// CONSTANTS
// =====================================================

/** Default embedding model */
const EMBEDDING_MODEL = 'text-embedding-3-small';

/** Default minimum similarity */
const DEFAULT_MIN_SIMILARITY = 0.7;

/** Default max results */
const DEFAULT_MAX_RESULTS = 3;

/** Timeout for embedding request */
const EMBEDDING_TIMEOUT = 5000;

/** Timeout for vector search */
const SEARCH_TIMEOUT = 3000;

// =====================================================
// VOICE RAG CLASS
// =====================================================

/**
 * VoiceRAG - Voice-optimized RAG system
 */
export class VoiceRAG {
  private supabase: SupabaseClient;
  private queryOptimizer: QueryOptimizer;
  private responseFormatter: ResponseFormatter;
  private cache: VoiceRAGCache;
  private config: VoiceRAGConfig;
  private metrics: VoiceRAGMetrics;

  constructor(config?: VoiceRAGConfig) {
    this.config = config || {};

    // Initialize Supabase client
    this.supabase = (config?.supabaseClient as SupabaseClient) || this.createSupabaseClient();

    // Initialize components
    this.queryOptimizer = createQueryOptimizer(config?.queryOptimizer);
    this.responseFormatter = createResponseFormatter(config?.responseFormatter);
    this.cache = createCache(config?.cache);

    // Initialize metrics
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      avgLatencyMs: 0,
      cache: this.cache.getMetrics(),
      queriesByIntent: {} as Record<QueryIntent, number>,
      avgDocsRetrieved: 0,
      p95LatencyMs: 0,
    };
  }

  /**
   * Process a voice query
   */
  async query(input: string, context: RAGContext): Promise<VoiceRAGResult> {
    const startTime = Date.now();
    const latencyBreakdown = { queryOptimization: 0, retrieval: 0, formatting: 0 };

    // Validate input
    if (!input || input.trim().length === 0) {
      return this.createErrorResult('Empty query', startTime, latencyBreakdown);
    }

    if (!context.tenantId) {
      return this.createErrorResult('Missing tenantId', startTime, latencyBreakdown);
    }

    this.metrics.totalQueries++;

    try {
      // Check cache first
      if (this.config.enableCache !== false) {
        const cached = this.cache.get(input, context.tenantId);
        if (cached) {
          console.log(`[VoiceRAG] Cache hit for query: ${input.substring(0, 30)}...`);
          // Update metrics for cache hits
          this.metrics.successfulQueries++;
          return {
            ...cached,
            latencyMs: Date.now() - startTime,
          };
        }
      }

      // Step 1: Optimize query
      const optimizeStart = Date.now();
      const optimizedQuery = this.config.enableQueryOptimization !== false
        ? this.queryOptimizer.optimize(input)
        : {
            original: input,
            optimized: input,
            intent: 'general' as QueryIntent,
            keywords: [],
            synonyms: [],
            urgency: 'normal' as const,
            targetCategories: [],
            wasModified: false,
          };
      latencyBreakdown.queryOptimization = Date.now() - optimizeStart;

      // Track intent
      this.trackIntent(optimizedQuery.intent);

      // Step 2: Get embedding
      const embedding = await this.getQueryEmbedding(optimizedQuery.optimized);

      if (!embedding) {
        console.warn('[VoiceRAG] Failed to get embedding');
        this.metrics.failedQueries++;
        return this.createErrorResult('Failed to process query', startTime, latencyBreakdown);
      }

      // Step 3: Search vector store
      const retrievalStart = Date.now();
      const documents = await this.searchVectorStore(
        context.tenantId,
        embedding,
        optimizedQuery.targetCategories,
        this.config.retrieval
      );
      latencyBreakdown.retrieval = Date.now() - retrievalStart;

      // Step 4: Format response
      const formatStart = Date.now();
      const formatted = this.responseFormatter.format(documents, optimizedQuery.intent);
      latencyBreakdown.formatting = Date.now() - formatStart;

      const totalLatency = Date.now() - startTime;

      // Build result
      const result: VoiceRAGResult = {
        success: formatted.confidence !== 'low' || documents.length > 0,
        response: formatted.text,
        formatted,
        sources: documents.map(d => ({
          id: d.id,
          text: d.content.substring(0, 200),
          score: d.similarity,
          category: d.category,
        })),
        queryOptimization: optimizedQuery,
        fromCache: false,
        latencyMs: totalLatency,
        latencyBreakdown,
      };

      // Handle no results
      if (documents.length === 0) {
        result.response = this.getNoResultsFallback(context.locale);
        result.success = false;
      }

      // Cache successful results
      if (result.success && this.config.enableCache !== false) {
        this.cache.set(input, context.tenantId, result);
      }

      // Update metrics
      this.updateMetrics(result, documents.length, totalLatency);

      console.log(
        `[VoiceRAG] Query processed in ${totalLatency}ms`,
        { intent: optimizedQuery.intent, docs: documents.length, cached: false }
      );

      return result;

    } catch (error) {
      this.metrics.failedQueries++;
      console.error('[VoiceRAG] Error:', error);

      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error',
        startTime,
        latencyBreakdown
      );
    }
  }

  /**
   * Query with specific category filter
   * Uses internal search method directly to avoid creating new instances
   * and to share metrics/cache with parent instance
   */
  async queryByCategory(
    input: string,
    context: RAGContext,
    categories: string[]
  ): Promise<VoiceRAGResult> {
    const startTime = Date.now();
    const latencyBreakdown = { queryOptimization: 0, retrieval: 0, formatting: 0 };

    // Validate input
    if (!input || input.trim().length === 0) {
      return this.createErrorResult('Empty query', startTime, latencyBreakdown);
    }

    if (!context.tenantId) {
      return this.createErrorResult('Missing tenantId', startTime, latencyBreakdown);
    }

    this.metrics.totalQueries++;

    try {
      // Step 1: Optimize query
      const optimizeStart = Date.now();
      const optimizedQuery = this.config.enableQueryOptimization !== false
        ? this.queryOptimizer.optimize(input)
        : {
            original: input,
            optimized: input,
            intent: 'general' as QueryIntent,
            keywords: [],
            synonyms: [],
            urgency: 'normal' as const,
            targetCategories: categories,
            wasModified: false,
          };
      latencyBreakdown.queryOptimization = Date.now() - optimizeStart;

      // Track intent
      this.trackIntent(optimizedQuery.intent);

      // Step 2: Get embedding
      const embedding = await this.getQueryEmbedding(optimizedQuery.optimized);

      if (!embedding) {
        console.warn('[VoiceRAG] Failed to get embedding');
        this.metrics.failedQueries++;
        return this.createErrorResult('Failed to process query', startTime, latencyBreakdown);
      }

      // Step 3: Search vector store with category filter
      const retrievalStart = Date.now();
      const configWithCategories: RetrievalConfig = {
        ...this.config.retrieval,
        categories,
      };
      const documents = await this.searchVectorStore(
        context.tenantId,
        embedding,
        categories,
        configWithCategories
      );
      latencyBreakdown.retrieval = Date.now() - retrievalStart;

      // Step 4: Format response
      const formatStart = Date.now();
      const formatted = this.responseFormatter.format(documents, optimizedQuery.intent);
      latencyBreakdown.formatting = Date.now() - formatStart;

      const totalLatency = Date.now() - startTime;

      // Build result
      const result: VoiceRAGResult = {
        success: formatted.confidence !== 'low' || documents.length > 0,
        response: formatted.text,
        formatted,
        sources: documents.map(d => ({
          id: d.id,
          text: d.content.substring(0, 200),
          score: d.similarity,
          category: d.category,
        })),
        queryOptimization: optimizedQuery,
        fromCache: false,
        latencyMs: totalLatency,
        latencyBreakdown,
      };

      // Handle no results
      if (documents.length === 0) {
        result.response = this.getNoResultsFallback(context.locale);
        result.success = false;
      }

      // Update metrics
      this.updateMetrics(result, documents.length, totalLatency);

      console.log(
        `[VoiceRAG] Category query processed in ${totalLatency}ms`,
        { intent: optimizedQuery.intent, docs: documents.length, categories }
      );

      return result;

    } catch (error) {
      this.metrics.failedQueries++;
      console.error('[VoiceRAG] Error:', error);

      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error',
        startTime,
        latencyBreakdown
      );
    }
  }

  /**
   * Get specific business information
   */
  async getBusinessInfo(
    context: RAGContext,
    infoType: 'hours' | 'location' | 'menu' | 'services' | 'policies'
  ): Promise<VoiceRAGResult> {
    const queries: Record<string, { es: string; en: string }> = {
      hours: { es: '¿Cuál es el horario?', en: 'What are the hours?' },
      location: { es: '¿Cuál es la dirección?', en: "What's the address?" },
      menu: { es: '¿Qué tienen en el menú?', en: "What's on the menu?" },
      services: { es: '¿Qué servicios ofrecen?', en: 'What services do you offer?' },
      policies: { es: '¿Cuáles son las políticas?', en: 'What are the policies?' },
    };

    const locale = context.locale as 'es' | 'en';
    const query = queries[infoType]?.[locale] || queries[infoType]?.es;
    const categories = [infoType];

    return this.queryByCategory(query, context, categories);
  }

  /**
   * Invalidate cache for a tenant (call after data updates)
   */
  invalidateCache(tenantId: string): number {
    return this.cache.invalidateTenant(tenantId);
  }

  /**
   * Get metrics
   */
  getMetrics(): VoiceRAGMetrics {
    return {
      ...this.metrics,
      cache: this.cache.getMetrics(),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      avgLatencyMs: 0,
      cache: this.cache.getMetrics(),
      queriesByIntent: {} as Record<QueryIntent, number>,
      avgDocsRetrieved: 0,
      p95LatencyMs: 0,
    };
  }

  // =====================================================
  // PRIVATE METHODS
  // =====================================================

  /**
   * Create Supabase client
   */
  private createSupabaseClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }

    return createClient(url, key);
  }

  /**
   * Get embedding for query
   */
  private async getQueryEmbedding(query: string): Promise<number[] | null> {
    try {
      // Try Supabase Edge Function first
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT);

      try {
        const { data, error } = await this.supabase.functions.invoke('embed-text', {
          body: { text: query },
        });

        clearTimeout(timeout);

        if (!error && data?.embedding) {
          return data.embedding;
        }
      } catch {
        clearTimeout(timeout);
      }

      // Fallback to OpenAI directly
      return await this.getOpenAIEmbedding(query);

    } catch (error) {
      console.warn('[VoiceRAG] Embedding error:', error);
      return null;
    }
  }

  /**
   * Get embedding from OpenAI API
   */
  private async getOpenAIEmbedding(text: string): Promise<number[] | null> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn('[VoiceRAG] OPENAI_API_KEY not configured');
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT);

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[VoiceRAG] OpenAI API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data?.data?.[0]?.embedding || null;

    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[VoiceRAG] Embedding request timed out');
      }
      return null;
    }
  }

  /**
   * Search vector store for relevant documents
   */
  private async searchVectorStore(
    tenantId: string,
    embedding: number[],
    categories?: string[],
    config?: RetrievalConfig
  ): Promise<RetrievedDocument[]> {
    const maxResults = config?.maxResults ?? DEFAULT_MAX_RESULTS;
    const minSimilarity = config?.minSimilarity ?? DEFAULT_MIN_SIMILARITY;

    try {
      // Use RPC for vector search
      const { data, error } = await this.supabase.rpc('match_business_documents', {
        query_embedding: embedding,
        match_tenant_id: tenantId,
        match_threshold: minSimilarity,
        match_count: maxResults,
      });

      if (error) {
        console.warn('[VoiceRAG] Vector search error:', error);
        return await this.fallbackTextSearch(tenantId, categories, maxResults);
      }

      // Map results
      const documents: RetrievedDocument[] = (data || []).map(
        (doc: {
          id: string;
          content: string;
          similarity: number;
          category?: string;
          source_type?: string;
          updated_at?: string;
          metadata?: Record<string, unknown>;
        }) => ({
          id: doc.id,
          content: doc.content,
          similarity: doc.similarity,
          category: doc.category,
          sourceType: doc.source_type,
          updatedAt: doc.updated_at,
          metadata: doc.metadata,
        })
      );

      // Filter by categories if specified
      if (categories && categories.length > 0) {
        return documents.filter(
          d => !d.category || categories.includes(d.category)
        );
      }

      return documents;

    } catch (error) {
      console.warn('[VoiceRAG] Search error:', error);
      return await this.fallbackTextSearch(tenantId, categories, maxResults);
    }
  }

  /**
   * Fallback text search when vector search fails
   */
  private async fallbackTextSearch(
    tenantId: string,
    categories?: string[],
    maxResults: number = 3
  ): Promise<RetrievedDocument[]> {
    try {
      let query = this.supabase
        .from('business_knowledge')
        .select('id, content, category, updated_at')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .limit(maxResults);

      if (categories && categories.length > 0) {
        query = query.in('category', categories);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[VoiceRAG] Fallback search error:', error);
        return [];
      }

      return (data || []).map(doc => ({
        id: doc.id,
        content: doc.content,
        similarity: 0.5, // Unknown similarity for fallback
        category: doc.category,
        updatedAt: doc.updated_at,
      }));

    } catch {
      return [];
    }
  }

  /**
   * Get fallback message for no results
   */
  private getNoResultsFallback(locale: string): string {
    if (this.config.noResultsFallback) {
      return locale === 'en'
        ? this.config.noResultsFallback.en
        : this.config.noResultsFallback.es;
    }

    return locale === 'en'
      ? "I don't have specific information about that. Can I help you with something else?"
      : 'No tengo información específica sobre eso. ¿Puedo ayudarle con algo más?';
  }

  /**
   * Create error result
   */
  private createErrorResult(
    error: string,
    startTime: number,
    latencyBreakdown: { queryOptimization: number; retrieval: number; formatting: number }
  ): VoiceRAGResult {
    // Default error message in Spanish
    return {
      success: false,
      response: 'Tengo problemas para encontrar esa información. Por favor intente de nuevo.',
      formatted: {
        text: '',
        summary: '',
        wasTruncated: false,
        originalLength: 0,
        sources: [],
        confidence: 'low',
      },
      sources: [],
      fromCache: false,
      latencyMs: Date.now() - startTime,
      latencyBreakdown,
      error,
    };
  }

  /**
   * Track intent for metrics
   */
  private trackIntent(intent: QueryIntent): void {
    this.metrics.queriesByIntent[intent] = (this.metrics.queriesByIntent[intent] || 0) + 1;
  }

  /**
   * Update metrics after query
   */
  private updateMetrics(result: VoiceRAGResult, docsRetrieved: number, latency: number): void {
    if (result.success) {
      this.metrics.successfulQueries++;
    } else {
      this.metrics.failedQueries++;
    }

    // Update average latency
    const totalQueries = this.metrics.successfulQueries + this.metrics.failedQueries;
    this.metrics.avgLatencyMs = (
      (this.metrics.avgLatencyMs * (totalQueries - 1) + latency) / totalQueries
    );

    // Update average docs retrieved
    this.metrics.avgDocsRetrieved = (
      (this.metrics.avgDocsRetrieved * (totalQueries - 1) + docsRetrieved) / totalQueries
    );
  }
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create a VoiceRAG instance
 */
export function createVoiceRAG(config?: VoiceRAGConfig): VoiceRAG {
  return new VoiceRAG(config);
}

// =====================================================
// DEFAULT INSTANCE
// =====================================================

let defaultVoiceRAG: VoiceRAG | null = null;

/**
 * Get the default VoiceRAG instance
 */
export function getVoiceRAG(config?: VoiceRAGConfig): VoiceRAG {
  if (!defaultVoiceRAG) {
    defaultVoiceRAG = createVoiceRAG(config);
  }
  return defaultVoiceRAG;
}

/**
 * Reset the default instance (for testing)
 */
export function resetVoiceRAG(): void {
  defaultVoiceRAG = null;
}

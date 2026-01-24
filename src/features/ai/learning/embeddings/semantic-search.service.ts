// =====================================================
// TIS TIS PLATFORM - SEMANTIC SEARCH SERVICE
// Performs similarity searches using pgvector
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { PatternEmbedding } from '../types';
import { embeddingService } from './embedding.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type SourceType = PatternEmbedding['sourceType'];

interface SearchResult {
  id: string;
  contentText: string;
  similarity: number;
  sourceType: SourceType;
  sourceId?: string;
  intent?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface SearchOptions {
  tenantId: string;
  query: string;
  limit?: number;
  threshold?: number;
  sourceTypes?: SourceType[];
  intents?: string[];
  categories?: string[];
  tags?: string[];
  excludeIds?: string[];
}

interface MultiSearchOptions {
  tenantId: string;
  queries: string[];
  limit?: number;
  threshold?: number;
  aggregation?: 'union' | 'intersection' | 'weighted';
}

interface RankedResult extends SearchResult {
  rank: number;
  queryMatches: number[];
}

export class SemanticSearchService {
  private supabase;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Search for similar patterns using vector similarity
   *
   * NOTE: Uses the semantic_search SQL function with parameters:
   * - p_tenant_id: UUID
   * - p_query_embedding: vector(1536)
   * - p_limit: INTEGER
   * - p_similarity_threshold: DECIMAL
   * - p_source_type: VARCHAR (optional, single type filter)
   * - p_intent: VARCHAR (optional, single intent filter)
   */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    const {
      tenantId,
      query,
      limit = 10,
      threshold = 0.7,
      sourceTypes,
      intents,
      excludeIds,
    } = options;

    // Generate embedding for query
    const { embedding } = await embeddingService.embed(query);

    // SQL function only supports single source_type and intent filters
    // For multiple filters, we filter client-side
    const sourceType = sourceTypes && sourceTypes.length === 1 ? sourceTypes[0] : null;
    const intent = intents && intents.length === 1 ? intents[0] : null;

    // Use pgvector semantic_search function with correct parameter names
    const { data, error } = await this.supabase.rpc('semantic_search', {
      p_tenant_id: tenantId,
      p_query_embedding: `[${embedding.join(',')}]`,
      p_limit: Math.min(limit * 2, 100), // Fetch more for client-side filtering
      p_similarity_threshold: threshold,
      p_source_type: sourceType,
      p_intent: intent,
    });

    if (error) {
      console.error('[SemanticSearchService] Search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }

    let results: SearchResult[] = (data || []).map(this.mapResult);

    // Apply additional client-side filters that SQL doesn't support
    if (sourceTypes && sourceTypes.length > 1) {
      results = results.filter((r: SearchResult) => sourceTypes.includes(r.sourceType));
    }
    if (intents && intents.length > 1) {
      results = results.filter((r: SearchResult) => r.intent && intents.includes(r.intent));
    }
    if (excludeIds && excludeIds.length > 0) {
      results = results.filter((r: SearchResult) => !excludeIds.includes(r.id));
    }

    // Limit to requested count after filtering
    results = results.slice(0, limit);

    // Update search statistics
    if (results.length > 0) {
      await this.updateSearchStats(results.map((r: SearchResult) => r.id));
    }

    return results;
  }

  /**
   * Search with multiple queries and aggregate results
   */
  async multiSearch(options: MultiSearchOptions): Promise<RankedResult[]> {
    const {
      tenantId,
      queries,
      limit = 10,
      threshold = 0.7,
      aggregation = 'union',
    } = options;

    // Search for each query in parallel
    const searchPromises = queries.map((query) =>
      this.search({ tenantId, query, limit: limit * 2, threshold })
    );

    const allResults = await Promise.all(searchPromises);

    // Aggregate results based on strategy
    const aggregatedResults = this.aggregateResults(allResults, aggregation, limit);

    return aggregatedResults;
  }

  /**
   * Find similar patterns to a given pattern
   */
  async findSimilar(
    tenantId: string,
    patternId: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    // Get the pattern's embedding
    const { data: pattern } = await this.supabase
      .from('ai_pattern_embeddings')
      .select('embedding, content_text')
      .eq('id', patternId)
      .single();

    if (!pattern) {
      throw new Error('Pattern not found');
    }

    // Search using the same embedding with correct parameter names
    const { data, error } = await this.supabase.rpc('semantic_search', {
      p_tenant_id: tenantId,
      p_query_embedding: pattern.embedding, // Already in vector format from DB
      p_limit: limit + 1, // +1 to exclude self
      p_similarity_threshold: 0.5,
      p_source_type: null,
      p_intent: null,
    });

    // Filter out self after retrieval (SQL function doesn't support exclude_ids)
    const filteredData = (data || []).filter((r: { id: string }) => r.id !== patternId);

    if (error) {
      console.error('[SemanticSearchService] Find similar error:', error);
      throw new Error(`Find similar failed: ${error.message}`);
    }

    return filteredData.slice(0, limit).map(this.mapResult);
  }

  /**
   * Search with intent classification
   */
  async searchWithIntent(
    tenantId: string,
    query: string,
    expectedIntent?: string
  ): Promise<{
    results: SearchResult[];
    detectedIntent?: string;
    intentConfidence?: number;
  }> {
    // First, search without intent filter
    const results = await this.search({
      tenantId,
      query,
      limit: 20,
      threshold: 0.6,
    });

    if (results.length === 0) {
      return { results: [] };
    }

    // Analyze intent distribution in results
    const intentCounts: Record<string, { count: number; totalSim: number }> = {};
    for (const result of results) {
      if (result.intent) {
        if (!intentCounts[result.intent]) {
          intentCounts[result.intent] = { count: 0, totalSim: 0 };
        }
        intentCounts[result.intent].count++;
        intentCounts[result.intent].totalSim += result.similarity;
      }
    }

    // Find most likely intent
    let detectedIntent: string | undefined;
    let intentConfidence = 0;

    const intents = Object.entries(intentCounts);
    if (intents.length > 0) {
      const sorted = intents.sort(
        (a, b) => b[1].totalSim / b[1].count - a[1].totalSim / a[1].count
      );
      detectedIntent = sorted[0][0];
      intentConfidence = sorted[0][1].totalSim / sorted[0][1].count;
    }

    // Filter results if expectedIntent is provided
    let filteredResults = results;
    if (expectedIntent) {
      filteredResults = results.filter((r) => r.intent === expectedIntent);
    } else if (detectedIntent) {
      // Boost results matching detected intent
      filteredResults = results.sort((a, b) => {
        const aBoost = a.intent === detectedIntent ? 0.1 : 0;
        const bBoost = b.intent === detectedIntent ? 0.1 : 0;
        return b.similarity + bBoost - (a.similarity + aBoost);
      });
    }

    return {
      results: filteredResults.slice(0, 10),
      detectedIntent,
      intentConfidence,
    };
  }

  /**
   * Hybrid search: combines semantic and keyword matching
   */
  async hybridSearch(
    tenantId: string,
    query: string,
    options?: {
      limit?: number;
      semanticWeight?: number;
      keywordWeight?: number;
    }
  ): Promise<SearchResult[]> {
    const limit = options?.limit || 10;
    const semanticWeight = options?.semanticWeight || 0.7;
    const keywordWeight = options?.keywordWeight || 0.3;

    // Semantic search
    const semanticResults = await this.search({
      tenantId,
      query,
      limit: limit * 2,
      threshold: 0.5,
    });

    // Keyword search (using ILIKE for simplicity)
    const keywords = query.toLowerCase().split(/\s+/).filter((k) => k.length > 2);

    if (keywords.length === 0) {
      return semanticResults.slice(0, limit);
    }

    // Build keyword search query
    const keywordConditions = keywords.map((k) => `content_text ILIKE '%${k}%'`).join(' OR ');

    const { data: keywordResults } = await this.supabase
      .from('ai_pattern_embeddings')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(keywordConditions)
      .limit(limit * 2);

    // Merge and score results
    const resultMap = new Map<string, SearchResult & { hybridScore: number }>();

    // Add semantic results
    for (const result of semanticResults) {
      resultMap.set(result.id, {
        ...result,
        hybridScore: result.similarity * semanticWeight,
      });
    }

    // Add/merge keyword results
    for (const row of keywordResults || []) {
      const id = row.id;
      const keywordScore = this.calculateKeywordScore(row.content_text, keywords);

      if (resultMap.has(id)) {
        const existing = resultMap.get(id)!;
        existing.hybridScore += keywordScore * keywordWeight;
      } else {
        resultMap.set(id, {
          id: row.id,
          contentText: row.content_text,
          similarity: keywordScore,
          sourceType: row.source_type,
          sourceId: row.source_id,
          intent: row.intent,
          category: row.category,
          tags: row.tags,
          metadata: row.metadata,
          hybridScore: keywordScore * keywordWeight,
        });
      }
    }

    // Sort by hybrid score
    const sorted = Array.from(resultMap.values())
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, limit);

    // Update similarity to reflect hybrid score
    return sorted.map(({ hybridScore, ...result }) => ({
      ...result,
      similarity: hybridScore,
    }));
  }

  /**
   * Cluster similar patterns
   */
  async clusterPatterns(
    tenantId: string,
    options?: {
      minClusterSize?: number;
      similarityThreshold?: number;
    }
  ): Promise<Array<{ centroid: string; members: string[]; avgSimilarity: number }>> {
    const minClusterSize = options?.minClusterSize || 3;
    const similarityThreshold = options?.similarityThreshold || 0.85;

    // Get all patterns
    const { data: patterns } = await this.supabase
      .from('ai_pattern_embeddings')
      .select('id, content_text, embedding')
      .eq('tenant_id', tenantId);

    if (!patterns || patterns.length < minClusterSize) {
      return [];
    }

    // Simple greedy clustering
    const clusters: Array<{ centroid: string; members: string[]; similarities: number[] }> = [];
    const assigned = new Set<string>();

    for (const pattern of patterns) {
      if (assigned.has(pattern.id)) continue;

      // Find similar patterns
      const similar = await this.findSimilar(tenantId, pattern.id, patterns.length);
      const clusterMembers = [pattern.id];
      const similarities = [1.0];

      for (const result of similar) {
        if (!assigned.has(result.id) && result.similarity >= similarityThreshold) {
          clusterMembers.push(result.id);
          similarities.push(result.similarity);
          assigned.add(result.id);
        }
      }

      if (clusterMembers.length >= minClusterSize) {
        assigned.add(pattern.id);
        clusters.push({
          centroid: pattern.id,
          members: clusterMembers,
          similarities,
        });
      }
    }

    return clusters.map((c) => ({
      centroid: c.centroid,
      members: c.members,
      avgSimilarity: c.similarities.reduce((a, b) => a + b, 0) / c.similarities.length,
    }));
  }

  // Private helpers

  private aggregateResults(
    allResults: SearchResult[][],
    aggregation: 'union' | 'intersection' | 'weighted',
    limit: number
  ): RankedResult[] {
    const resultMap = new Map<string, RankedResult>();

    for (let queryIdx = 0; queryIdx < allResults.length; queryIdx++) {
      const results = allResults[queryIdx];

      for (let rank = 0; rank < results.length; rank++) {
        const result = results[rank];
        const existing = resultMap.get(result.id);

        if (existing) {
          existing.queryMatches.push(queryIdx);
          // Update similarity based on aggregation strategy
          if (aggregation === 'weighted') {
            existing.similarity = (existing.similarity + result.similarity) / 2;
          } else {
            existing.similarity = Math.max(existing.similarity, result.similarity);
          }
          existing.rank = Math.min(existing.rank, rank);
        } else {
          resultMap.set(result.id, {
            ...result,
            rank,
            queryMatches: [queryIdx],
          });
        }
      }
    }

    let results = Array.from(resultMap.values());

    // Apply aggregation filter
    if (aggregation === 'intersection') {
      results = results.filter((r) => r.queryMatches.length === allResults.length);
    }

    // Sort by matches count, then similarity
    results.sort((a, b) => {
      if (b.queryMatches.length !== a.queryMatches.length) {
        return b.queryMatches.length - a.queryMatches.length;
      }
      return b.similarity - a.similarity;
    });

    return results.slice(0, limit);
  }

  private calculateKeywordScore(text: string, keywords: string[]): number {
    const lowerText = text.toLowerCase();
    let matches = 0;

    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        matches++;
      }
    }

    return matches / keywords.length;
  }

  private async updateSearchStats(ids: string[]): Promise<void> {
    try {
      await this.supabase.rpc('update_search_stats', {
        pattern_ids: ids,
      });
    } catch {
      // Non-critical, just log
      console.warn('[SemanticSearchService] Failed to update search stats');
    }
  }

  private mapResult(row: Record<string, unknown>): SearchResult {
    return {
      id: row.id as string,
      contentText: row.content_text as string,
      similarity: row.similarity as number,
      sourceType: row.source_type as SourceType,
      sourceId: row.source_id as string | undefined,
      intent: row.intent as string | undefined,
      category: row.category as string | undefined,
      tags: row.tags as string[] | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
    };
  }
}

// Export singleton instance
export const semanticSearchService = new SemanticSearchService();

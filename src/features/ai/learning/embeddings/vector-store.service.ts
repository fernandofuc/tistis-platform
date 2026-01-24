// =====================================================
// TIS TIS PLATFORM - VECTOR STORE SERVICE
// Manages pattern embeddings in pgvector
// =====================================================

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { PatternEmbedding } from '../types';
import { embeddingService } from './embedding.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type SourceType = PatternEmbedding['sourceType'];

interface StoreEmbeddingParams {
  tenantId: string;
  sourceType: SourceType;
  sourceId?: string;
  contentText: string;
  intent?: string;
  category?: string;
  tags?: string[];
  language?: string;
  metadata?: Record<string, unknown>;
}

interface UpdateParams {
  intent?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export class VectorStoreService {
  private supabase;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Store a new pattern embedding
   */
  async store(params: StoreEmbeddingParams): Promise<string> {
    const contentHash = createHash('sha256').update(params.contentText).digest('hex');

    // Check if already exists
    const { data: existing } = await this.supabase
      .from('ai_pattern_embeddings')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .eq('content_hash', contentHash)
      .single();

    if (existing) {
      // Update existing
      await this.update(existing.id, {
        intent: params.intent,
        category: params.category,
        tags: params.tags,
        metadata: params.metadata,
      });
      return existing.id;
    }

    // Generate embedding
    const embeddingResult = await embeddingService.embed(params.contentText);

    // Store
    const { data, error } = await this.supabase
      .from('ai_pattern_embeddings')
      .insert({
        tenant_id: params.tenantId,
        source_type: params.sourceType,
        source_id: params.sourceId,
        content_text: params.contentText,
        content_hash: contentHash,
        embedding: `[${embeddingResult.embedding.join(',')}]`,
        model_used: embeddingResult.model,
        token_count: embeddingResult.tokenCount,
        intent: params.intent,
        category: params.category,
        tags: params.tags || [],
        language: params.language || 'es',
        metadata: params.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('[VectorStoreService] Error storing embedding:', error);
      throw new Error(`Failed to store embedding: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Store multiple embeddings in batch
   */
  async storeBatch(items: StoreEmbeddingParams[]): Promise<string[]> {
    // Generate embeddings for all
    const texts = items.map((i) => i.contentText);
    const { results: embeddingResults } = await embeddingService.embedBatch(texts);

    const records = items.map((item, index) => {
      const contentHash = createHash('sha256').update(item.contentText).digest('hex');
      return {
        tenant_id: item.tenantId,
        source_type: item.sourceType,
        source_id: item.sourceId,
        content_text: item.contentText,
        content_hash: contentHash,
        embedding: `[${embeddingResults[index].embedding.join(',')}]`,
        model_used: embeddingResults[index].model,
        token_count: embeddingResults[index].tokenCount,
        intent: item.intent,
        category: item.category,
        tags: item.tags || [],
        language: item.language || 'es',
        metadata: item.metadata || {},
      };
    });

    const { data, error } = await this.supabase
      .from('ai_pattern_embeddings')
      .upsert(records, {
        onConflict: 'tenant_id,content_hash',
      })
      .select('id');

    if (error) {
      console.error('[VectorStoreService] Error storing batch:', error);
      throw new Error(`Failed to store batch: ${error.message}`);
    }

    return (data || []).map((d) => d.id);
  }

  /**
   * Update an existing embedding
   */
  async update(id: string, params: UpdateParams): Promise<void> {
    const updateData: Record<string, unknown> = {};

    if (params.intent !== undefined) updateData.intent = params.intent;
    if (params.category !== undefined) updateData.category = params.category;
    if (params.tags !== undefined) updateData.tags = params.tags;
    if (params.metadata !== undefined) {
      updateData.metadata = params.metadata;
    }

    if (Object.keys(updateData).length === 0) return;

    const { error } = await this.supabase
      .from('ai_pattern_embeddings')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('[VectorStoreService] Error updating embedding:', error);
      throw new Error(`Failed to update embedding: ${error.message}`);
    }
  }

  /**
   * Delete an embedding
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_pattern_embeddings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[VectorStoreService] Error deleting embedding:', error);
      throw new Error(`Failed to delete embedding: ${error.message}`);
    }
  }

  /**
   * Delete embeddings by source
   */
  async deleteBySource(tenantId: string, sourceType: SourceType, sourceId: string): Promise<number> {
    // First count records to delete
    const { count: recordCount } = await this.supabase
      .from('ai_pattern_embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId);

    // Then delete
    const { error } = await this.supabase
      .from('ai_pattern_embeddings')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId);

    if (error) {
      console.error('[VectorStoreService] Error deleting by source:', error);
      throw new Error(`Failed to delete: ${error.message}`);
    }

    return recordCount || 0;
  }

  /**
   * Get embedding by ID
   */
  async get(id: string): Promise<PatternEmbedding | null> {
    const { data, error } = await this.supabase
      .from('ai_pattern_embeddings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapEmbedding(data);
  }

  /**
   * Get embeddings by tenant
   */
  async getByTenant(
    tenantId: string,
    options?: {
      sourceType?: SourceType;
      intent?: string;
      category?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ embeddings: PatternEmbedding[]; total: number }> {
    let query = this.supabase
      .from('ai_pattern_embeddings')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (options?.sourceType) {
      query = query.eq('source_type', options.sourceType);
    }
    if (options?.intent) {
      query = query.eq('intent', options.intent);
    }
    if (options?.category) {
      query = query.eq('category', options.category);
    }

    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

    const { data, count, error } = await query;

    if (error) {
      console.error('[VectorStoreService] Error getting embeddings:', error);
      throw new Error(`Failed to get embeddings: ${error.message}`);
    }

    return {
      embeddings: (data || []).map(this.mapEmbedding),
      total: count || 0,
    };
  }

  /**
   * Get distinct intents for a tenant
   */
  async getIntents(tenantId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('ai_pattern_embeddings')
      .select('intent')
      .eq('tenant_id', tenantId)
      .not('intent', 'is', null);

    if (error) {
      console.error('[VectorStoreService] Error getting intents:', error);
      return [];
    }

    const intents = new Set<string>();
    for (const row of data || []) {
      if (row.intent) intents.add(row.intent);
    }

    return Array.from(intents).sort();
  }

  /**
   * Get distinct categories for a tenant
   */
  async getCategories(tenantId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('ai_pattern_embeddings')
      .select('category')
      .eq('tenant_id', tenantId)
      .not('category', 'is', null);

    if (error) {
      console.error('[VectorStoreService] Error getting categories:', error);
      return [];
    }

    const categories = new Set<string>();
    for (const row of data || []) {
      if (row.category) categories.add(row.category);
    }

    return Array.from(categories).sort();
  }

  /**
   * Get statistics for a tenant
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    bySourceType: Record<string, number>;
    byIntent: Record<string, number>;
    mostSearched: Array<{ id: string; contentText: string; searchCount: number }>;
  }> {
    const { data, count } = await this.supabase
      .from('ai_pattern_embeddings')
      .select('source_type, intent, search_count, id, content_text', { count: 'exact' })
      .eq('tenant_id', tenantId);

    const bySourceType: Record<string, number> = {};
    const byIntent: Record<string, number> = {};
    const withSearchCount: Array<{ id: string; contentText: string; searchCount: number }> = [];

    for (const row of data || []) {
      bySourceType[row.source_type] = (bySourceType[row.source_type] || 0) + 1;
      if (row.intent) {
        byIntent[row.intent] = (byIntent[row.intent] || 0) + 1;
      }
      if (row.search_count > 0) {
        withSearchCount.push({
          id: row.id,
          contentText: row.content_text.substring(0, 100),
          searchCount: row.search_count,
        });
      }
    }

    // Sort by search count
    withSearchCount.sort((a, b) => b.searchCount - a.searchCount);

    return {
      total: count || 0,
      bySourceType,
      byIntent,
      mostSearched: withSearchCount.slice(0, 10),
    };
  }

  /**
   * Re-embed all patterns for a tenant (e.g., after model update)
   */
  async reembed(tenantId: string): Promise<{ processed: number; errors: number }> {
    const { embeddings } = await this.getByTenant(tenantId, { limit: 10000 });

    let processed = 0;
    let errors = 0;

    // Process in batches
    const batchSize = 50;
    for (let i = 0; i < embeddings.length; i += batchSize) {
      const batch = embeddings.slice(i, i + batchSize);
      const texts = batch.map((e) => e.contentText);

      try {
        const { results } = await embeddingService.embedBatch(texts);

        for (let j = 0; j < batch.length; j++) {
          try {
            await this.supabase
              .from('ai_pattern_embeddings')
              .update({
                embedding: `[${results[j].embedding.join(',')}]`,
                model_used: results[j].model,
                token_count: results[j].tokenCount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', batch[j].id);

            processed++;
          } catch {
            errors++;
          }
        }
      } catch (error) {
        console.error('[VectorStoreService] Batch reembed error:', error);
        errors += batch.length;
      }
    }

    return { processed, errors };
  }

  // Private helpers

  private mapEmbedding(row: Record<string, unknown>): PatternEmbedding {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      sourceType: row.source_type as SourceType,
      sourceId: row.source_id as string | undefined,
      contentText: row.content_text as string,
      contentHash: row.content_hash as string,
      embedding: row.embedding as number[],
      modelUsed: row.model_used as string,
      tokenCount: row.token_count as number | undefined,
      intent: row.intent as string | undefined,
      category: row.category as string | undefined,
      tags: row.tags as string[] | undefined,
      language: row.language as string | undefined,
      searchCount: row.search_count as number | undefined,
      lastSearchedAt: row.last_searched_at ? new Date(row.last_searched_at as string) : undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Export singleton instance
export const vectorStoreService = new VectorStoreService();

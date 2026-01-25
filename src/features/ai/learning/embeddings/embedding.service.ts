// =====================================================
// TIS TIS PLATFORM - EMBEDDING SERVICE
// Generates embeddings using OpenAI API
// =====================================================

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { EmbeddingConfig, EmbeddingResult } from '../types';
import { countTokensSync } from '@/src/shared/lib/token-counter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DEFAULT_CONFIG: EmbeddingConfig = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
  maxInputTokens: 8191,
  batchSize: 50,
  cacheEnabled: true,
  cacheTTLSeconds: 7 * 24 * 60 * 60, // 7 days
};

export class EmbeddingService {
  private openai: OpenAI;
  private supabase;
  private config: EmbeddingConfig;
  private memoryCache: Map<string, { embedding: number[]; expires: number }>;
  private memoryCacheMaxSize: number = 1000;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryCache = new Map();
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string, skipCache: boolean = false): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const processedText = this.preprocessText(text);
    const hash = this.hashText(processedText);

    // Check cache
    if (this.config.cacheEnabled && !skipCache) {
      const cached = await this.getFromCache(hash);
      if (cached) {
        return {
          text: processedText,
          embedding: cached,
          dimensions: this.config.dimensions,
          model: this.config.model,
          tokenCount: this.estimateTokens(processedText),
          cached: true,
          processingTimeMs: Date.now() - startTime,
        };
      }
    }

    // Generate embedding
    try {
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: processedText,
        dimensions: this.config.dimensions,
      });

      const embedding = response.data[0].embedding;

      // Store in cache
      if (this.config.cacheEnabled) {
        await this.storeInCache(hash, embedding, processedText);
      }

      return {
        text: processedText,
        embedding,
        dimensions: this.config.dimensions,
        model: this.config.model,
        tokenCount: response.usage?.total_tokens || this.estimateTokens(processedText),
        cached: false,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[EmbeddingService] Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<{
    results: EmbeddingResult[];
    totalTokens: number;
    cacheHits: number;
    apiCalls: number;
  }> {
    const startTime = Date.now();
    const processedTexts = texts.map((t) => this.preprocessText(t));
    const hashes = processedTexts.map((t) => this.hashText(t));

    // Check cache for all
    const cachedMap = new Map<string, number[] | null>();
    let cacheHits = 0;

    if (this.config.cacheEnabled) {
      for (let i = 0; i < hashes.length; i++) {
        const cached = await this.getFromCache(hashes[i]);
        cachedMap.set(processedTexts[i], cached);
        if (cached) cacheHits++;
      }
    }

    // Find uncached texts
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    for (let i = 0; i < processedTexts.length; i++) {
      if (!cachedMap.get(processedTexts[i])) {
        uncachedTexts.push(processedTexts[i]);
        uncachedIndices.push(i);
      }
    }

    // Generate embeddings for uncached in batches
    const uncachedEmbeddings: number[][] = [];
    let apiCalls = 0;
    let totalTokens = 0;

    for (let i = 0; i < uncachedTexts.length; i += this.config.batchSize) {
      const batch = uncachedTexts.slice(i, i + this.config.batchSize);

      try {
        const response = await this.openai.embeddings.create({
          model: this.config.model,
          input: batch,
          dimensions: this.config.dimensions,
        });

        apiCalls++;
        totalTokens += response.usage?.total_tokens || 0;

        for (const item of response.data) {
          uncachedEmbeddings.push(item.embedding);
        }

        // Store in cache
        if (this.config.cacheEnabled) {
          for (let j = 0; j < batch.length; j++) {
            const hash = this.hashText(batch[j]);
            await this.storeInCache(hash, response.data[j].embedding, batch[j]);
          }
        }
      } catch (error) {
        console.error('[EmbeddingService] Batch embedding error:', error);
        throw error;
      }
    }

    // Combine results
    const results: EmbeddingResult[] = [];
    let uncachedIndex = 0;
    const processingTimeMs = Date.now() - startTime;

    for (let i = 0; i < processedTexts.length; i++) {
      const cached = cachedMap.get(processedTexts[i]);
      if (cached) {
        results.push({
          text: processedTexts[i],
          embedding: cached,
          dimensions: this.config.dimensions,
          model: this.config.model,
          tokenCount: this.estimateTokens(processedTexts[i]),
          cached: true,
          processingTimeMs: processingTimeMs / texts.length,
        });
      } else {
        results.push({
          text: processedTexts[i],
          embedding: uncachedEmbeddings[uncachedIndex],
          dimensions: this.config.dimensions,
          model: this.config.model,
          tokenCount: this.estimateTokens(processedTexts[i]),
          cached: false,
          processingTimeMs: processingTimeMs / texts.length,
        });
        uncachedIndex++;
      }
    }

    return {
      results,
      totalTokens,
      cacheHits,
      apiCalls,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }

  /**
   * Cleanup expired cache entries
   */
  async cleanupCache(): Promise<number> {
    // Clean memory cache
    const now = Date.now();
    for (const [key, value] of this.memoryCache) {
      if (value.expires < now) {
        this.memoryCache.delete(key);
      }
    }

    // Clean database cache - first count, then delete
    const { count: recordCount } = await this.supabase
      .from('ai_embedding_cache')
      .select('*', { count: 'exact', head: true })
      .lt('expires_at', new Date().toISOString());

    await this.supabase
      .from('ai_embedding_cache')
      .delete()
      .lt('expires_at', new Date().toISOString());

    return recordCount || 0;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    memoryEntries: number;
    dbEntries: number;
    avgHitCount: number;
  }> {
    const { count, data } = await this.supabase
      .from('ai_embedding_cache')
      .select('hit_count', { count: 'exact' });

    const avgHitCount = data && data.length > 0
      ? data.reduce((sum, e) => sum + (e.hit_count || 0), 0) / data.length
      : 0;

    return {
      memoryEntries: this.memoryCache.size,
      dbEntries: count || 0,
      avgHitCount,
    };
  }

  // Private helpers

  private preprocessText(text: string): string {
    let processed = text;

    // Remove URLs
    processed = processed.replace(/https?:\/\/[^\s]+/g, '[URL]');

    // Remove emails
    processed = processed.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      '[EMAIL]'
    );

    // Normalize whitespace
    processed = processed.replace(/\s+/g, ' ').trim();

    // Truncate if too long (rough estimate: 4 chars per token)
    const maxChars = this.config.maxInputTokens * 4;
    if (processed.length > maxChars) {
      processed = processed.substring(0, maxChars);
      // Try to end at word boundary
      const lastSpace = processed.lastIndexOf(' ');
      if (lastSpace > maxChars * 0.8) {
        processed = processed.substring(0, lastSpace);
      }
    }

    return processed;
  }

  private hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex').substring(0, 32);
  }

  private estimateTokens(text: string): number {
    // Use centralized token counter for accurate estimation
    return countTokensSync(text);
  }

  private async getFromCache(hash: string): Promise<number[] | null> {
    // Check memory cache first
    const memoryCached = this.memoryCache.get(hash);
    if (memoryCached && memoryCached.expires > Date.now()) {
      return memoryCached.embedding;
    }

    // Check database cache
    try {
      const { data } = await this.supabase
        .from('ai_embedding_cache')
        .select('embedding, expires_at')
        .eq('text_hash', hash)
        .eq('model', this.config.model)
        .single();

      if (!data) return null;

      // Check expiry
      if (new Date(data.expires_at) < new Date()) {
        return null;
      }

      // Update hit count (fire and forget)
      this.supabase
        .from('ai_embedding_cache')
        .update({
          hit_count: this.supabase.rpc('increment'),
          last_hit_at: new Date().toISOString(),
        })
        .eq('text_hash', hash)
        .then(() => {});

      // Add to memory cache
      this.addToMemoryCache(hash, data.embedding);

      return data.embedding;
    } catch {
      return null;
    }
  }

  private async storeInCache(hash: string, embedding: number[], text: string): Promise<void> {
    // Add to memory cache
    this.addToMemoryCache(hash, embedding);

    // Store in database
    const expiresAt = new Date(Date.now() + this.config.cacheTTLSeconds * 1000);

    try {
      await this.supabase
        .from('ai_embedding_cache')
        .upsert({
          text_hash: hash,
          model: this.config.model,
          embedding: `[${embedding.join(',')}]`, // pgvector format
          text_preview: text.substring(0, 200),
          token_count: this.estimateTokens(text),
          created_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          hit_count: 0,
        }, {
          onConflict: 'text_hash,model',
        });
    } catch (error) {
      console.warn('[EmbeddingService] Cache store error:', error);
    }
  }

  private addToMemoryCache(hash: string, embedding: number[]): void {
    // Evict oldest if at capacity
    if (this.memoryCache.size >= this.memoryCacheMaxSize) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(hash, {
      embedding,
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
    });
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();

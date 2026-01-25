// =====================================================
// TIS TIS PLATFORM - Vision Analysis Cache Service
// Caches image analysis results to avoid redundant API calls
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { VisionAnalysis } from '../types';
import type { AnalysisContext } from './vision.service';

// =====================================================
// TYPES
// =====================================================

export interface CachedAnalysis {
  id: string;
  imageHash: string;
  context: AnalysisContext;
  analysis: VisionAnalysis;
  createdAt: string;
  expiresAt: string;
  hitCount: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  hitRate: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}

// =====================================================
// CONSTANTS
// =====================================================

/** Default cache TTL in milliseconds (24 hours) */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Maximum cache entries per tenant */
const MAX_ENTRIES_PER_TENANT = 100;

// =====================================================
// SUPABASE CLIENT
// =====================================================

function createServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate a hash for image content
 * Uses SHA-256 for uniqueness
 */
function hashImage(imageData: string): string {
  return createHash('sha256')
    .update(imageData)
    .digest('hex')
    .substring(0, 32); // Truncate for storage efficiency
}

/**
 * Generate cache key from image hash and context
 */
function generateCacheKey(imageHash: string, context: AnalysisContext): string {
  return `${imageHash}:${context}`;
}

// =====================================================
// VISION CACHE SERVICE CLASS
// =====================================================

export class VisionCacheService {
  private static instance: VisionCacheService;

  // In-memory LRU cache for hot data
  private memoryCache: Map<string, { analysis: VisionAnalysis; timestamp: number }>;
  private readonly memoryCacheMaxSize = 50;
  private readonly memoryCacheTTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.memoryCache = new Map();
  }

  static getInstance(): VisionCacheService {
    if (!VisionCacheService.instance) {
      VisionCacheService.instance = new VisionCacheService();
    }
    return VisionCacheService.instance;
  }

  /**
   * Get cached analysis for an image
   * Checks memory cache first, then database
   */
  async get(
    imageData: string,
    context: AnalysisContext,
    tenantId: string
  ): Promise<VisionAnalysis | null> {
    const imageHash = hashImage(imageData);
    const cacheKey = generateCacheKey(imageHash, context);

    // Check memory cache first
    const memoryResult = this.getFromMemoryCache(cacheKey);
    if (memoryResult) {
      console.log('[VisionCache] Memory cache hit', { context, hashPrefix: imageHash.substring(0, 8) });
      return memoryResult;
    }

    // Check database cache
    try {
      const supabase = createServerClient();

      const { data, error } = await supabase
        .from('vision_analysis_cache')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('image_hash', imageHash)
        .eq('context', context)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) {
        console.warn('[VisionCache] Error reading cache:', error.message);
        return null;
      }

      if (data) {
        console.log('[VisionCache] Database cache hit', { context, hashPrefix: imageHash.substring(0, 8) });

        // Update hit count (non-blocking)
        this.incrementHitCount(data.id).catch(() => {});

        // Store in memory cache for future hits
        const analysis = data.analysis as VisionAnalysis;
        this.setToMemoryCache(cacheKey, analysis);

        return analysis;
      }

      console.log('[VisionCache] Cache miss', { context, hashPrefix: imageHash.substring(0, 8) });
      return null;
    } catch (error) {
      console.warn('[VisionCache] Cache read error:', error);
      return null;
    }
  }

  /**
   * Store analysis result in cache
   */
  async set(
    imageData: string,
    context: AnalysisContext,
    tenantId: string,
    analysis: VisionAnalysis,
    ttlMs: number = DEFAULT_TTL_MS
  ): Promise<void> {
    const imageHash = hashImage(imageData);
    const cacheKey = generateCacheKey(imageHash, context);

    // Store in memory cache
    this.setToMemoryCache(cacheKey, analysis);

    // Store in database cache
    try {
      const supabase = createServerClient();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlMs);

      // Upsert to handle duplicate keys
      const { error } = await supabase
        .from('vision_analysis_cache')
        .upsert({
          tenant_id: tenantId,
          image_hash: imageHash,
          context,
          analysis,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          hit_count: 0,
        }, {
          onConflict: 'tenant_id,image_hash,context',
        });

      if (error) {
        console.warn('[VisionCache] Error writing cache:', error.message);
        return;
      }

      console.log('[VisionCache] Cached analysis', {
        context,
        hashPrefix: imageHash.substring(0, 8),
        ttlHours: Math.round(ttlMs / (60 * 60 * 1000)),
      });

      // Cleanup old entries (non-blocking)
      this.cleanupOldEntries(tenantId).catch(() => {});
    } catch (error) {
      console.warn('[VisionCache] Cache write error:', error);
    }
  }

  /**
   * Invalidate cache for a specific image
   */
  async invalidate(
    imageData: string,
    context: AnalysisContext,
    tenantId: string
  ): Promise<void> {
    const imageHash = hashImage(imageData);
    const cacheKey = generateCacheKey(imageHash, context);

    // Remove from memory cache
    this.memoryCache.delete(cacheKey);

    // Remove from database
    try {
      const supabase = createServerClient();

      await supabase
        .from('vision_analysis_cache')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('image_hash', imageHash)
        .eq('context', context);

      console.log('[VisionCache] Invalidated cache entry', { context, hashPrefix: imageHash.substring(0, 8) });
    } catch (error) {
      console.warn('[VisionCache] Error invalidating cache:', error);
    }
  }

  /**
   * Clear all cache for a tenant
   */
  async clearTenantCache(tenantId: string): Promise<number> {
    // Clear memory cache entries for this tenant
    // (Note: memory cache doesn't track tenant, so we clear all)
    this.memoryCache.clear();

    try {
      const supabase = createServerClient();

      const { data, error } = await supabase
        .from('vision_analysis_cache')
        .delete()
        .eq('tenant_id', tenantId)
        .select('id');

      if (error) {
        console.warn('[VisionCache] Error clearing tenant cache:', error.message);
        return 0;
      }

      const deletedCount = data?.length || 0;
      console.log('[VisionCache] Cleared tenant cache', { tenantId, deletedCount });
      return deletedCount;
    } catch (error) {
      console.warn('[VisionCache] Error clearing tenant cache:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics for a tenant
   */
  async getStats(tenantId: string): Promise<CacheStats> {
    try {
      const supabase = createServerClient();

      // Get total entries and hits
      const { data, error } = await supabase
        .from('vision_analysis_cache')
        .select('id, hit_count, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (error || !data) {
        return {
          totalEntries: 0,
          totalHits: 0,
          hitRate: 0,
          oldestEntry: null,
          newestEntry: null,
        };
      }

      const totalEntries = data.length;
      const totalHits = data.reduce((sum, entry) => sum + (entry.hit_count || 0), 0);
      const hitRate = totalEntries > 0 ? totalHits / totalEntries : 0;

      return {
        totalEntries,
        totalHits,
        hitRate,
        oldestEntry: data[0]?.created_at || null,
        newestEntry: data[data.length - 1]?.created_at || null,
      };
    } catch (error) {
      console.warn('[VisionCache] Error getting stats:', error);
      return {
        totalEntries: 0,
        totalHits: 0,
        hitRate: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  // =====================================================
  // PRIVATE METHODS
  // =====================================================

  private getFromMemoryCache(key: string): VisionAnalysis | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.memoryCacheTTL) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.analysis;
  }

  private setToMemoryCache(key: string, analysis: VisionAnalysis): void {
    // Enforce max size with LRU eviction
    if (this.memoryCache.size >= this.memoryCacheMaxSize) {
      // Delete oldest entry (first key in Map)
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(key, {
      analysis,
      timestamp: Date.now(),
    });
  }

  private async incrementHitCount(cacheId: string): Promise<void> {
    try {
      const supabase = createServerClient();

      await supabase.rpc('increment_vision_cache_hits', {
        cache_id: cacheId,
      });
    } catch {
      // Ignore hit count errors - non-critical
    }
  }

  private async cleanupOldEntries(tenantId: string): Promise<void> {
    try {
      const supabase = createServerClient();

      // Delete expired entries
      await supabase
        .from('vision_analysis_cache')
        .delete()
        .eq('tenant_id', tenantId)
        .lt('expires_at', new Date().toISOString());

      // Check if we have too many entries
      const { count } = await supabase
        .from('vision_analysis_cache')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      // Delete oldest entries if over limit
      if (count && count > MAX_ENTRIES_PER_TENANT) {
        const deleteCount = count - MAX_ENTRIES_PER_TENANT;

        // Get IDs of oldest entries
        const { data: oldEntries } = await supabase
          .from('vision_analysis_cache')
          .select('id')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: true })
          .limit(deleteCount);

        if (oldEntries && oldEntries.length > 0) {
          const idsToDelete = oldEntries.map(e => e.id);
          await supabase
            .from('vision_analysis_cache')
            .delete()
            .in('id', idsToDelete);

          console.log('[VisionCache] Cleaned up old entries', { tenantId, deletedCount: deleteCount });
        }
      }
    } catch {
      // Ignore cleanup errors - non-critical
    }
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const visionCacheService = VisionCacheService.getInstance();

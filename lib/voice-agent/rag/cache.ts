/**
 * TIS TIS Platform - Voice Agent v2.0
 * VoiceRAG Cache
 *
 * LRU cache for frequently accessed queries.
 * Features:
 * - TTL-based expiration (default 5 minutes)
 * - Tenant isolation
 * - LRU eviction
 * - Metrics tracking
 */

import type {
  CacheConfig,
  CacheEntry,
  CacheMetrics,
  VoiceRAGResult,
} from './types';

// =====================================================
// CONSTANTS
// =====================================================

/** Default TTL: 5 minutes */
const DEFAULT_TTL = 5 * 60 * 1000;

/** Default max entries */
const DEFAULT_MAX_ENTRIES = 100;

// =====================================================
// CACHE CLASS
// =====================================================

/**
 * LRU Cache for VoiceRAG results
 */
export class VoiceRAGCache {
  private cache: Map<string, CacheEntry<VoiceRAGResult>>;
  private config: Required<CacheConfig>;
  private metrics: CacheMetrics;

  constructor(config?: CacheConfig) {
    this.config = {
      ttl: config?.ttl ?? DEFAULT_TTL,
      maxEntries: config?.maxEntries ?? DEFAULT_MAX_ENTRIES,
      isolateByTenant: config?.isolateByTenant ?? true,
      trackMetrics: config?.trackMetrics ?? true,
    };

    this.cache = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      entries: 0,
      evictions: 0,
      expirations: 0,
    };
  }

  /**
   * Generate cache key
   */
  private generateKey(query: string, tenantId: string): string {
    // Normalize query for consistent caching (uses the exported utility)
    const normalizedQuery = normalizeQueryForCache(query);

    if (this.config.isolateByTenant) {
      return `${tenantId}:${normalizedQuery}`;
    }

    return normalizedQuery;
  }

  /**
   * Get cached result
   */
  get(query: string, tenantId: string): VoiceRAGResult | null {
    const key = this.generateKey(query, tenantId);
    const entry = this.cache.get(key);

    if (!entry) {
      this.recordMiss();
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.recordExpiration();
      this.recordMiss();
      return null;
    }

    // Update hit count and move to end (LRU)
    entry.hitCount++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.recordHit();

    // Return a copy with updated fromCache flag
    return {
      ...entry.value,
      fromCache: true,
    };
  }

  /**
   * Store result in cache
   */
  set(query: string, tenantId: string, result: VoiceRAGResult): void {
    const key = this.generateKey(query, tenantId);
    const now = Date.now();

    // Check capacity and evict if needed
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const entry: CacheEntry<VoiceRAGResult> = {
      value: result,
      createdAt: now,
      expiresAt: now + this.config.ttl,
      hitCount: 0,
      key,
    };

    this.cache.set(key, entry);
    this.updateMetrics();
  }

  /**
   * Check if query is cached
   */
  has(query: string, tenantId: string): boolean {
    const key = this.generateKey(query, tenantId);
    const entry = this.cache.get(key);

    if (!entry) return false;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.recordExpiration();
      return false;
    }

    return true;
  }

  /**
   * Invalidate cache for a tenant
   */
  invalidateTenant(tenantId: string): number {
    let count = 0;
    const prefix = `${tenantId}:`;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.updateMetrics();
    return count;
  }

  /**
   * Invalidate specific query
   */
  invalidate(query: string, tenantId: string): boolean {
    const key = this.generateKey(query, tenantId);
    const deleted = this.cache.delete(key);
    this.updateMetrics();
    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.updateMetrics();
  }

  /**
   * Evict oldest entry (LRU)
   */
  private evictOldest(): void {
    // Map maintains insertion order, so first is oldest (LRU)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      this.metrics.evictions++;
    }
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.metrics.expirations += removed;
      this.updateMetrics();
    }

    return removed;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // =====================================================
  // METRICS HELPERS
  // =====================================================

  private recordHit(): void {
    if (this.config.trackMetrics) {
      this.metrics.hits++;
      this.updateHitRate();
    }
  }

  private recordMiss(): void {
    if (this.config.trackMetrics) {
      this.metrics.misses++;
      this.updateHitRate();
    }
  }

  private recordExpiration(): void {
    if (this.config.trackMetrics) {
      this.metrics.expirations++;
    }
  }

  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }

  private updateMetrics(): void {
    this.metrics.entries = this.cache.size;
  }
}

// =====================================================
// CACHE WITH AUTO-CLEANUP
// =====================================================

/**
 * Cache with automatic cleanup interval
 */
export class AutoCleanupCache extends VoiceRAGCache {
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    config?: CacheConfig,
    cleanupIntervalMs: number = 60000 // 1 minute
  ) {
    super(config);

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  /**
   * Stop cleanup interval
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create a VoiceRAG cache instance
 */
export function createCache(config?: CacheConfig): VoiceRAGCache {
  return new VoiceRAGCache(config);
}

/**
 * Create a cache with auto-cleanup
 */
export function createAutoCleanupCache(
  config?: CacheConfig,
  cleanupIntervalMs?: number
): AutoCleanupCache {
  return new AutoCleanupCache(config, cleanupIntervalMs);
}

// =====================================================
// DEFAULT INSTANCE
// =====================================================

let defaultCache: VoiceRAGCache | null = null;

/**
 * Get the default cache instance
 */
export function getCache(config?: CacheConfig): VoiceRAGCache {
  if (!defaultCache) {
    defaultCache = createCache(config);
  }
  return defaultCache;
}

/**
 * Reset the default cache (for testing)
 */
export function resetCache(): void {
  if (defaultCache) {
    defaultCache.clear();
    defaultCache = null;
  }
}

// =====================================================
// CACHE KEY UTILITIES
// =====================================================

/**
 * Generate a hash for cache key (for longer queries)
 */
export function hashQuery(query: string): string {
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Normalize query for caching
 */
export function normalizeQueryForCache(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // Collapse whitespace
    .replace(/[¿?¡!.,;:'"]/g, ''); // Remove punctuation
}

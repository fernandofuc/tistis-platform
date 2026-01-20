/**
 * TIS TIS Platform - Voice Agent v2.0
 * VoiceRAG Cache Tests
 */

import {
  VoiceRAGCache,
  createCache,
  getCache,
  resetCache,
  hashQuery,
  normalizeQueryForCache,
} from '../../../lib/voice-agent/rag/cache';
import type { VoiceRAGResult } from '../../../lib/voice-agent/rag/types';

describe('VoiceRAGCache', () => {
  let cache: VoiceRAGCache;

  const mockResult: VoiceRAGResult = {
    success: true,
    response: 'Test response',
    formatted: {
      text: 'Test response',
      summary: 'Test',
      wasTruncated: false,
      originalLength: 13,
      sources: ['doc-1'],
      confidence: 'high',
    },
    sources: [{ id: 'doc-1', text: 'Test', score: 0.9 }],
    fromCache: false,
    latencyMs: 100,
  };

  beforeEach(() => {
    resetCache();
    cache = createCache({ ttl: 5000, maxEntries: 10 });
  });

  describe('constructor', () => {
    it('should create cache with default config', () => {
      const c = new VoiceRAGCache();
      expect(c.size()).toBe(0);
    });

    it('should accept custom config', () => {
      const c = new VoiceRAGCache({
        ttl: 10000,
        maxEntries: 50,
        isolateByTenant: false,
      });
      expect(c.size()).toBe(0);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve a result', () => {
      cache.set('test query', 'tenant-1', mockResult);

      const result = cache.get('test query', 'tenant-1');

      expect(result).not.toBeNull();
      expect(result?.response).toBe('Test response');
      expect(result?.fromCache).toBe(true);
    });

    it('should return null for non-existent key', () => {
      const result = cache.get('non-existent', 'tenant-1');

      expect(result).toBeNull();
    });

    it('should isolate by tenant', () => {
      cache.set('test query', 'tenant-1', mockResult);

      const result1 = cache.get('test query', 'tenant-1');
      const result2 = cache.get('test query', 'tenant-2');

      expect(result1).not.toBeNull();
      expect(result2).toBeNull();
    });

    it('should not isolate when disabled', () => {
      const noIsolation = createCache({ isolateByTenant: false });
      noIsolation.set('test query', 'tenant-1', mockResult);

      const result = noIsolation.get('test query', 'tenant-2');

      expect(result).not.toBeNull();
    });

    it('should normalize query for caching', () => {
      cache.set('Test Query', 'tenant-1', mockResult);
      cache.set('test query', 'tenant-1', { ...mockResult, response: 'Updated' });

      const result = cache.get('TEST QUERY', 'tenant-1');

      expect(result?.response).toBe('Updated');
    });
  });

  describe('has', () => {
    it('should return true for existing entry', () => {
      cache.set('test query', 'tenant-1', mockResult);

      expect(cache.has('test query', 'tenant-1')).toBe(true);
    });

    it('should return false for non-existent entry', () => {
      expect(cache.has('non-existent', 'tenant-1')).toBe(false);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortTtlCache = createCache({ ttl: 50 });
      shortTtlCache.set('test', 'tenant-1', mockResult);

      expect(shortTtlCache.get('test', 'tenant-1')).not.toBeNull();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(shortTtlCache.get('test', 'tenant-1')).toBeNull();
    });

    it('should track expirations in metrics', async () => {
      const shortTtlCache = createCache({ ttl: 50 });
      shortTtlCache.set('test', 'tenant-1', mockResult);

      await new Promise(resolve => setTimeout(resolve, 100));
      shortTtlCache.get('test', 'tenant-1');

      const metrics = shortTtlCache.getMetrics();
      expect(metrics.expirations).toBe(1);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when max reached', () => {
      const smallCache = createCache({ maxEntries: 3 });

      smallCache.set('query1', 'tenant-1', mockResult);
      smallCache.set('query2', 'tenant-1', mockResult);
      smallCache.set('query3', 'tenant-1', mockResult);
      smallCache.set('query4', 'tenant-1', mockResult);

      expect(smallCache.size()).toBe(3);
      expect(smallCache.has('query1', 'tenant-1')).toBe(false);
      expect(smallCache.has('query4', 'tenant-1')).toBe(true);
    });

    it('should track evictions in metrics', () => {
      const smallCache = createCache({ maxEntries: 2 });

      smallCache.set('query1', 'tenant-1', mockResult);
      smallCache.set('query2', 'tenant-1', mockResult);
      smallCache.set('query3', 'tenant-1', mockResult);

      const metrics = smallCache.getMetrics();
      expect(metrics.evictions).toBe(1);
    });

    it('should update LRU order on access', () => {
      const smallCache = createCache({ maxEntries: 3 });

      smallCache.set('query1', 'tenant-1', mockResult);
      smallCache.set('query2', 'tenant-1', mockResult);
      smallCache.set('query3', 'tenant-1', mockResult);

      // Access query1 to make it most recently used
      smallCache.get('query1', 'tenant-1');

      // Add new entry, should evict query2 (oldest now)
      smallCache.set('query4', 'tenant-1', mockResult);

      expect(smallCache.has('query1', 'tenant-1')).toBe(true);
      expect(smallCache.has('query2', 'tenant-1')).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('should invalidate specific query', () => {
      cache.set('query1', 'tenant-1', mockResult);
      cache.set('query2', 'tenant-1', mockResult);

      const deleted = cache.invalidate('query1', 'tenant-1');

      expect(deleted).toBe(true);
      expect(cache.has('query1', 'tenant-1')).toBe(false);
      expect(cache.has('query2', 'tenant-1')).toBe(true);
    });

    it('should return false for non-existent query', () => {
      const deleted = cache.invalidate('non-existent', 'tenant-1');

      expect(deleted).toBe(false);
    });
  });

  describe('invalidateTenant', () => {
    it('should invalidate all entries for a tenant', () => {
      cache.set('query1', 'tenant-1', mockResult);
      cache.set('query2', 'tenant-1', mockResult);
      cache.set('query1', 'tenant-2', mockResult);

      const count = cache.invalidateTenant('tenant-1');

      expect(count).toBe(2);
      expect(cache.has('query1', 'tenant-1')).toBe(false);
      expect(cache.has('query2', 'tenant-1')).toBe(false);
      expect(cache.has('query1', 'tenant-2')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('query1', 'tenant-1', mockResult);
      cache.set('query2', 'tenant-2', mockResult);

      cache.clear();

      expect(cache.size()).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      const shortTtlCache = createCache({ ttl: 50 });
      shortTtlCache.set('test1', 'tenant-1', mockResult);
      shortTtlCache.set('test2', 'tenant-1', mockResult);

      await new Promise(resolve => setTimeout(resolve, 100));

      const removed = shortTtlCache.cleanup();

      expect(removed).toBe(2);
      expect(shortTtlCache.size()).toBe(0);
    });
  });

  describe('metrics', () => {
    it('should track hits and misses', () => {
      cache.set('test', 'tenant-1', mockResult);

      cache.get('test', 'tenant-1'); // hit
      cache.get('test', 'tenant-1'); // hit
      cache.get('non-existent', 'tenant-1'); // miss

      const metrics = cache.getMetrics();

      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it('should track entries count', () => {
      cache.set('test1', 'tenant-1', mockResult);
      cache.set('test2', 'tenant-1', mockResult);

      const metrics = cache.getMetrics();

      expect(metrics.entries).toBe(2);
    });
  });

  describe('keys', () => {
    it('should return all cache keys', () => {
      cache.set('query1', 'tenant-1', mockResult);
      cache.set('query2', 'tenant-1', mockResult);

      const keys = cache.keys();

      expect(keys.length).toBe(2);
    });
  });

  describe('singleton', () => {
    it('should return same instance with getCache', () => {
      const cache1 = getCache();
      const cache2 = getCache();

      expect(cache1).toBe(cache2);
    });

    it('should reset with resetCache', () => {
      const cache1 = getCache();
      cache1.set('test', 'tenant-1', mockResult);

      resetCache();

      const cache2 = getCache();
      expect(cache2.size()).toBe(0);
    });
  });
});

describe('Cache utilities', () => {
  describe('hashQuery', () => {
    it('should generate consistent hash', () => {
      const hash1 = hashQuery('test query');
      const hash2 = hashQuery('test query');

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different queries', () => {
      const hash1 = hashQuery('query one');
      const hash2 = hashQuery('query two');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('normalizeQueryForCache', () => {
    it('should lowercase query', () => {
      const result = normalizeQueryForCache('TEST QUERY');

      expect(result).toBe('test query');
    });

    it('should trim whitespace', () => {
      const result = normalizeQueryForCache('  test query  ');

      expect(result).toBe('test query');
    });

    it('should collapse multiple spaces', () => {
      const result = normalizeQueryForCache('test    query');

      expect(result).toBe('test query');
    });

    it('should remove punctuation', () => {
      const result = normalizeQueryForCache('¿test query?');

      expect(result).toBe('test query');
    });
  });
});

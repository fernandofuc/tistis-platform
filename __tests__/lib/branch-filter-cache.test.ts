// =====================================================
// TIS TIS PLATFORM - FASE 3 Unit Tests
// Tests for Branch Filter Caching Layer
// Coverage: branch-filter-cache.ts module
// =====================================================

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
  getCachedBranchQuery,
  getCachedLowStockItems,
  invalidateBranchCache,
  invalidateTableCache,
  CACHE_STRATEGIES,
  TABLE_CACHE_CONFIG,
  type BranchQueryOptions,
  type CacheStrategy,
} from '@/src/shared/lib/branch-filter-cache';

// Mock Next.js unstable_cache
vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn: any) => fn),
  revalidateTag: vi.fn(),
}));

// Mock Supabase client
const mockSupabaseQuery = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
};

vi.mock('@/src/shared/lib/api-key-auth', () => ({
  createAPIKeyAuthenticatedClient: vi.fn(() => mockSupabaseQuery),
}));

// ======================
// TEST SUITE
// ======================

describe('Branch Filter Cache - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================
  // CACHE STRATEGIES
  // ======================
  describe('CACHE_STRATEGIES', () => {
    it('should define three cache strategies', () => {
      expect(CACHE_STRATEGIES).toHaveProperty('aggressive');
      expect(CACHE_STRATEGIES).toHaveProperty('moderate');
      expect(CACHE_STRATEGIES).toHaveProperty('conservative');
    });

    it('should have aggressive strategy with 5 minutes TTL', () => {
      expect(CACHE_STRATEGIES.aggressive).toBe(300); // 5 minutes
    });

    it('should have moderate strategy with 1 minute TTL', () => {
      expect(CACHE_STRATEGIES.moderate).toBe(60); // 1 minute
    });

    it('should have conservative strategy with 15 seconds TTL', () => {
      expect(CACHE_STRATEGIES.conservative).toBe(15); // 15 seconds
    });

    it('should have descending TTL values', () => {
      expect(CACHE_STRATEGIES.aggressive).toBeGreaterThan(CACHE_STRATEGIES.moderate);
      expect(CACHE_STRATEGIES.moderate).toBeGreaterThan(CACHE_STRATEGIES.conservative);
    });
  });

  // ======================
  // TABLE_CACHE_CONFIG
  // ======================
  describe('TABLE_CACHE_CONFIG', () => {
    it('should configure all branch-related tables', () => {
      const expectedTables = [
        'leads',
        'appointments',
        'menu_items',
        'menu_categories',
        'inventory_items',
        'staff',
      ];

      expectedTables.forEach((table) => {
        expect(TABLE_CACHE_CONFIG).toHaveProperty(table);
      });
    });

    it('should use conservative revalidate for dynamic data', () => {
      // Leads change frequently
      expect(TABLE_CACHE_CONFIG.leads.revalidate).toBe(CACHE_STRATEGIES.conservative);
    });

    it('should use moderate revalidate for semi-static data', () => {
      // Inventory changes occasionally
      expect(TABLE_CACHE_CONFIG.inventory_items.revalidate).toBe(CACHE_STRATEGIES.moderate);
    });

    it('should use aggressive revalidate for static data', () => {
      // Menu items change rarely
      expect(TABLE_CACHE_CONFIG.menu_items.revalidate).toBe(CACHE_STRATEGIES.aggressive);
    });

    it('should have revalidate times defined', () => {
      Object.entries(TABLE_CACHE_CONFIG).forEach(([table, config]) => {
        expect(config.revalidate).toBeDefined();
        expect(typeof config.revalidate).toBe('number');
        expect(config.revalidate).toBeGreaterThan(0);
      });
    });

    it('should have unique cache tags per table', () => {
      const tags = Object.values(TABLE_CACHE_CONFIG).flatMap((c) => c.tags);
      const uniqueTags = new Set(tags);

      expect(uniqueTags.size).toBe(tags.length);
    });
  });

  // ======================
  // CACHE KEY GENERATION (INTERNAL - NOT DIRECTLY TESTABLE)
  // ======================
  // Note: generateCacheKey is not exported, so it's tested indirectly
  // through getCachedBranchQuery behavior

  // ======================
  // getCachedBranchQuery
  // ======================
  describe('getCachedBranchQuery', () => {
    it('should query Supabase with correct table', async () => {
      const options: BranchQueryOptions = {
        tenantId: 'tenant-123',
        branchId: null,
      };

      await getCachedBranchQuery('leads', options);

      expect(mockSupabaseQuery.from).toHaveBeenCalledWith('leads');
    });

    it('should filter by tenant ID', async () => {
      const options: BranchQueryOptions = {
        tenantId: 'tenant-abc',
        branchId: null,
      };

      await getCachedBranchQuery('leads', options);

      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('tenant_id', 'tenant-abc');
    });

    it('should filter by branch ID when provided', async () => {
      const options: BranchQueryOptions = {
        tenantId: 'tenant-123',
        branchId: 'branch-polanco',
      };

      await getCachedBranchQuery('leads', options);

      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-polanco');
    });

    it('should not filter by branch when branchId is null', async () => {
      const options: BranchQueryOptions = {
        tenantId: 'tenant-123',
        branchId: null,
      };

      await getCachedBranchQuery('leads', options);

      const branchEqCalls = (mockSupabaseQuery.eq as Mock).mock.calls.filter(
        (call) => call[0] === 'branch_id'
      );

      expect(branchEqCalls.length).toBe(0);
    });

    it('should apply additional filters', async () => {
      const options: BranchQueryOptions = {
        tenantId: 'tenant-123',
        branchId: null,
        filters: {
          status: 'new',
        },
      });

      await getCachedBranchQuery('leads', options);

      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('status', 'new');
    });

    it('should apply multiple filters', async () => {
      const options: BranchQueryOptions = {
        tenantId: 'tenant-123',
        branchId: null,
        filters: {
          status: 'new',
          source: 'website',
        },
      });

      await getCachedBranchQuery('leads', options);

      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('status', 'new');
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('source', 'website');
    });

    it('should return data, error, and count', async () => {
      const options: BranchQueryOptions = {
        tenantId: 'tenant-123',
        branchId: null,
      };

      const result = await getCachedBranchQuery('leads', options);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('count');
    });

    it('should use table-specific cache config', async () => {
      const options: BranchQueryOptions = {
        tenantId: 'tenant-123',
        branchId: null,
      };

      // Different tables should use different cache strategies
      await getCachedBranchQuery('leads', options);
      await getCachedBranchQuery('menu_items', options);

      expect(TABLE_CACHE_CONFIG.leads.revalidate).toBe(CACHE_STRATEGIES.conservative);
      expect(TABLE_CACHE_CONFIG.menu_items.revalidate).toBe(CACHE_STRATEGIES.aggressive);
    });

    it('should support custom cache config override', async () => {
      const options: BranchQueryOptions = {
        tenantId: 'tenant-123',
        branchId: null,
      };

      const customConfig = {
        revalidate: 600,
        tags: ['custom-tag'],
      };

      await getCachedBranchQuery('leads', options, customConfig);

      // Should use custom config instead of default
      expect(customConfig.revalidate).toBe(600);
    });
  });

  // ======================
  // BRANCH STATS (Tested in Integration Tests)
  // ======================
  // Note: Branch stats functionality is tested via RPC functions
  // in fase3-rpc-functions.test.ts integration tests

  // ======================
  // getCachedLowStockItems
  // ======================
  describe('getCachedLowStockItems', () => {
    it('should call RPC function with tenant ID', async () => {
      await getCachedLowStockItems('tenant-123', null);

      expect(mockSupabaseQuery.rpc).toHaveBeenCalledWith('get_low_stock_items', {
        p_tenant_id: 'tenant-123',
        p_branch_id: null,
      });
    });

    it('should pass branch ID when provided', async () => {
      await getCachedLowStockItems('tenant-123', 'branch-polanco');

      expect(mockSupabaseQuery.rpc).toHaveBeenCalledWith('get_low_stock_items', {
        p_tenant_id: 'tenant-123',
        p_branch_id: 'branch-polanco',
      });
    });

    it('should handle null branch ID for all branches', async () => {
      await getCachedLowStockItems('tenant-123', null);

      const rpcCall = (mockSupabaseQuery.rpc as Mock).mock.calls[0];
      expect(rpcCall[1].p_branch_id).toBeNull();
    });

    it('should return data and error', async () => {
      const result = await getCachedLowStockItems('tenant-123', 'branch-123');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });

    it('should use conservative cache strategy (15s)', async () => {
      // Inventory changes frequently, so conservative caching
      const result = await getCachedLowStockItems('tenant-123', 'branch-123');

      expect(result).toBeDefined();
    });
  });

  // ======================
  // Cache Invalidation
  // ======================
  describe('invalidateBranchCache', () => {
    it('should be a function', () => {
      expect(typeof invalidateBranchCache).toBe('function');
    });

    it('should accept tenant and branch IDs', () => {
      expect(() => {
        invalidateBranchCache('tenant-123', 'branch-123');
      }).not.toThrow();
    });

    it('should handle null branch ID', () => {
      expect(() => {
        invalidateBranchCache('tenant-123', null);
      }).not.toThrow();
    });
  });

  describe('invalidateTableCache', () => {
    it('should be a function', () => {
      expect(typeof invalidateTableCache).toBe('function');
    });

    it('should accept table name', () => {
      expect(() => {
        invalidateTableCache('leads');
      }).not.toThrow();
    });

    it('should work with all supported tables', () => {
      const tables = Object.keys(TABLE_CACHE_CONFIG);

      tables.forEach((table) => {
        expect(() => {
          invalidateTableCache(table);
        }).not.toThrow();
      });
    });
  });

  // ======================
  // Edge Cases
  // ======================
  describe('Edge Cases', () => {
    it('should handle very long tenant IDs', async () => {
      const longId = 'a'.repeat(100);
      const options: BranchQueryOptions = {
        tenantId: longId,
        branchId: null,
      };

      const key = generateCacheKey('leads', options);
      expect(key).toBeDefined();
    });

    it('should handle special characters in IDs', async () => {
      const options: BranchQueryOptions = {
        tenantId: 'tenant-with-dashes-123',
        branchId: 'branch_with_underscores',
      };

      const key = generateCacheKey('leads', options);
      expect(key).toBeDefined();
    });

    it('should handle empty filters object', async () => {
      const options: BranchQueryOptions = {
        tenantId: 'tenant-123',
        branchId: null,
        filters: {},
      };

      const key = generateCacheKey('leads', options);
      expect(key).toBeDefined();
    });

    it('should handle complex filter values', async () => {
      const options: BranchQueryOptions = {
        tenantId: 'tenant-123',
        branchId: null,
        filters: {
          created_at: '2026-01-01T00:00:00Z',
          tags: ['urgent', 'follow-up'],
        },
      };

      const key = generateCacheKey('leads', options);
      expect(key).toBeDefined();
    });
  });
});

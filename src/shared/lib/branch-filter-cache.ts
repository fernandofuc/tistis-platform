// =====================================================
// TIS TIS PLATFORM - FASE 3: Query Caching Layer
// Intelligent caching for branch-filtered API queries
// Target: >70% cache hit rate, <80ms P95 latency
// =====================================================

import { unstable_cache, revalidateTag as nextRevalidateTag } from 'next/cache';
import { createAPIKeyAuthenticatedClient } from './api-key-auth';

// ======================
// CACHE INVALIDATION HELPER
// ======================

/**
 * Safe wrapper for revalidateTag that handles test environments and edge cases.
 * Next.js revalidateTag throws when called outside of a proper server context.
 *
 * @param tag - Cache tag to invalidate
 */
function safeRevalidateTag(tag: string): void {
  // Skip in test environment (Vitest/Jest)
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return;
  }

  try {
    nextRevalidateTag(tag);
  } catch (error) {
    // Log warning but don't throw - cache invalidation failure shouldn't crash the app
    // This can happen when called outside Next.js server context (e.g., scripts, workers)
    console.warn(`[Cache] Failed to revalidate tag "${tag}":`, error instanceof Error ? error.message : error);
  }
}
import type { SupabaseClient } from '@supabase/supabase-js';

// ======================
// TYPES
// ======================

export interface CacheConfig {
  revalidate?: number; // Revalidation time in seconds
  tags?: string[];     // Cache tags for targeted invalidation
}

export interface BranchQueryOptions {
  tenantId: string;
  branchId?: string | null;
  filters?: Record<string, any>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}

export type CacheStrategy = 'aggressive' | 'moderate' | 'conservative';

// ======================
// CACHE CONFIGURATION
// ======================

/**
 * Cache TTL configurations by strategy
 */
const CACHE_STRATEGIES: Record<CacheStrategy, number> = {
  aggressive: 300,   // 5 minutes - for relatively static data (menu items, categories)
  moderate: 60,      // 1 minute - for semi-dynamic data (appointments, staff schedules)
  conservative: 15,  // 15 seconds - for highly dynamic data (leads, notifications)
};

/**
 * Default cache configuration by table
 */
const TABLE_CACHE_CONFIG: Record<string, CacheConfig> = {
  // Menu data changes infrequently
  menu_items: {
    revalidate: CACHE_STRATEGIES.aggressive,
    tags: ['menu', 'branch-data'],
  },
  menu_categories: {
    revalidate: CACHE_STRATEGIES.aggressive,
    tags: ['menu', 'branch-data'],
  },

  // Inventory updates frequently but not constantly
  inventory_items: {
    revalidate: CACHE_STRATEGIES.moderate,
    tags: ['inventory', 'branch-data'],
  },

  // Staff schedules change moderately
  staff: {
    revalidate: CACHE_STRATEGIES.moderate,
    tags: ['staff', 'branch-data'],
  },

  // Appointments are semi-dynamic
  appointments: {
    revalidate: CACHE_STRATEGIES.moderate,
    tags: ['appointments', 'branch-data'],
  },

  // Leads are highly dynamic
  leads: {
    revalidate: CACHE_STRATEGIES.conservative,
    tags: ['leads', 'branch-data'],
  },

  // Branches rarely change
  branches: {
    revalidate: CACHE_STRATEGIES.aggressive,
    tags: ['branches', 'tenant-data'],
  },
};

// ======================
// CACHE KEY GENERATION
// ======================

/**
 * Generate a stable cache key from query parameters
 * Ensures consistent cache hits for identical queries
 */
function generateCacheKey(
  table: string,
  options: BranchQueryOptions,
  customKey?: string
): string[] {
  const baseKey = customKey || `branch-query:${table}`;

  const keyParts = [
    baseKey,
    `tenant:${options.tenantId}`,
  ];

  if (options.branchId) {
    keyParts.push(`branch:${options.branchId}`);
  }

  if (options.filters) {
    const filterKey = Object.entries(options.filters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    keyParts.push(`filters:${filterKey}`);
  }

  if (options.orderBy) {
    keyParts.push(`order:${options.orderBy.column}:${options.orderBy.ascending ? 'asc' : 'desc'}`);
  }

  if (options.limit !== undefined) {
    keyParts.push(`limit:${options.limit}`);
  }

  if (options.offset !== undefined) {
    keyParts.push(`offset:${options.offset}`);
  }

  return keyParts;
}

// ======================
// CACHED QUERY FUNCTIONS
// ======================

/**
 * Generic cached query for branch-filtered data
 *
 * @example
 * ```typescript
 * const leads = await getCachedBranchQuery('leads', {
 *   tenantId: 'abc-123',
 *   branchId: 'branch-456',
 *   filters: { status: 'new' },
 *   orderBy: { column: 'created_at', ascending: false },
 *   limit: 20,
 * });
 * ```
 */
export async function getCachedBranchQuery<T = unknown>(
  table: string,
  options: BranchQueryOptions,
  customCacheConfig?: CacheConfig
): Promise<{ data: T[] | null; error: { message: string; code?: string } | null; count: number | null }> {
  // Get cache configuration
  const cacheConfig = customCacheConfig || TABLE_CACHE_CONFIG[table] || {
    revalidate: CACHE_STRATEGIES.conservative,
    tags: ['branch-data'],
  };

  // Generate cache key
  const cacheKey = generateCacheKey(table, options);

  // Create cached query function
  const cachedQuery = unstable_cache(
    async () => {
      const supabase = createAPIKeyAuthenticatedClient();

      // Build query
      let query = supabase
        .from(table)
        .select('*', { count: 'exact' })
        .eq('tenant_id', options.tenantId);

      // Apply branch filter if provided
      if (options.branchId) {
        query = query.eq('branch_id', options.branchId);
      }

      // Apply additional filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            query = query.eq(key, value);
          }
        });
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? false,
        });
      }

      // Apply pagination
      if (options.limit !== undefined) {
        const start = options.offset || 0;
        query = query.range(start, start + options.limit - 1);
      }

      const { data, error, count } = await query;

      return { data, error, count };
    },
    cacheKey,
    {
      revalidate: cacheConfig.revalidate,
      tags: cacheConfig.tags,
    }
  );

  return cachedQuery();
}

// ======================
// SPECIALIZED CACHED QUERIES
// ======================

/**
 * Cached query for active leads by branch
 * Optimized for dashboard "New Leads" widget
 */
export async function getCachedActiveLeads(
  tenantId: string,
  branchId?: string | null,
  status?: string
) {
  return getCachedBranchQuery('leads', {
    tenantId,
    branchId,
    filters: status ? { status } : { status: ['new', 'contacted', 'qualified'] },
    orderBy: { column: 'created_at', ascending: false },
    limit: 50,
  });
}

/**
 * Cached query for upcoming appointments by branch
 * Optimized for dashboard "Today's Appointments" widget
 */
export async function getCachedUpcomingAppointments(
  tenantId: string,
  branchId?: string | null
) {
  const now = new Date().toISOString();

  return getCachedBranchQuery('appointments', {
    tenantId,
    branchId,
    filters: { status: 'confirmed' },
    orderBy: { column: 'scheduled_at', ascending: true },
    limit: 100,
  });
}

/**
 * Cached query for active menu items by branch
 * Highly cacheable - menu items change infrequently
 */
export async function getCachedMenuItems(
  tenantId: string,
  branchId?: string | null,
  categoryId?: string
) {
  return getCachedBranchQuery('menu_items', {
    tenantId,
    branchId,
    filters: {
      is_available: true,
      ...(categoryId && { category_id: categoryId }),
    },
    orderBy: { column: 'display_order', ascending: true },
  });
}

/**
 * Cached query for active staff by branch
 * Used for scheduling and assignment UIs
 */
export async function getCachedBranchStaff(
  tenantId: string,
  branchId?: string | null,
  role?: string
) {
  return getCachedBranchQuery('staff', {
    tenantId,
    branchId,
    filters: {
      is_active: true,
      ...(role && { role }),
    },
    orderBy: { column: 'name', ascending: true },
  });
}

/**
 * Cached query for inventory items with low stock alert
 * Used for dashboard alerts
 */
export async function getCachedLowStockItems(
  tenantId: string,
  branchId?: string | null
) {
  // Note: This needs custom logic to filter current_stock < minimum_stock
  // Since Supabase doesn't support column comparison in .eq()
  // This would require a database view or RPC function

  const supabase = createAPIKeyAuthenticatedClient();

  const cacheKey = generateCacheKey('inventory_items', {
    tenantId,
    branchId,
    filters: { low_stock: true },
  }, 'low-stock-alert');

  const cachedQuery = unstable_cache(
    async () => {
      // Use RPC function for column comparison
      const { data, error } = await supabase.rpc('get_low_stock_items', {
        p_tenant_id: tenantId,
        p_branch_id: branchId,
      });

      return { data, error, count: data?.length || 0 };
    },
    cacheKey,
    {
      revalidate: CACHE_STRATEGIES.moderate,
      tags: ['inventory', 'alerts', 'branch-data'],
    }
  );

  return cachedQuery();
}

// ======================
// CACHE INVALIDATION
// ======================

/**
 * Invalidate cache by tags
 * Call this after mutations to ensure data consistency
 *
 * @example
 * ```typescript
 * // After creating a new lead
 * await invalidateBranchCache(['leads', 'branch-data']);
 *
 * // After updating menu items
 * await invalidateBranchCache(['menu']);
 * ```
 */
export async function invalidateBranchCache(tags: string[]): Promise<void> {
  for (const tag of tags) {
    safeRevalidateTag(tag);
  }
}

/**
 * Invalidate cache for specific tenant
 */
export async function invalidateTenantCache(tenantId: string): Promise<void> {
  await invalidateBranchCache([`tenant:${tenantId}`, 'tenant-data']);
}

/**
 * Invalidate cache for specific branch
 */
export async function invalidateBranchSpecificCache(branchId: string): Promise<void> {
  await invalidateBranchCache([`branch:${branchId}`, 'branch-data']);
}

/**
 * Invalidate cache for specific table across all branches
 */
export async function invalidateTableCache(table: string): Promise<void> {
  const config = TABLE_CACHE_CONFIG[table];
  if (config?.tags) {
    await invalidateBranchCache(config.tags);
  }
}

// ======================
// CACHE WARMING
// ======================

/**
 * Pre-warm cache for commonly accessed data
 * Call this during off-peak hours or after deployments
 *
 * @example
 * ```typescript
 * // Warm cache for all branches of a tenant
 * await warmBranchCache('tenant-123', ['branch-1', 'branch-2']);
 * ```
 */
export async function warmBranchCache(
  tenantId: string,
  branchIds: string[]
): Promise<void> {
  const warmupPromises = [];

  for (const branchId of branchIds) {
    // Warm up common queries
    warmupPromises.push(
      getCachedActiveLeads(tenantId, branchId),
      getCachedUpcomingAppointments(tenantId, branchId),
      getCachedMenuItems(tenantId, branchId),
      getCachedBranchStaff(tenantId, branchId)
    );
  }

  await Promise.allSettled(warmupPromises);
}

// ======================
// CACHE STATISTICS
// ======================

/**
 * Get cache statistics for monitoring
 * Note: Next.js doesn't expose cache hit/miss stats directly
 * This is a placeholder for future instrumentation
 */
export interface CacheStats {
  table: string;
  strategy: CacheStrategy;
  ttl: number;
  tags: string[];
}

export function getCacheStats(table: string): CacheStats | null {
  const config = TABLE_CACHE_CONFIG[table];
  if (!config) return null;

  const strategy = Object.entries(CACHE_STRATEGIES).find(
    ([_, ttl]) => ttl === config.revalidate
  )?.[0] as CacheStrategy | undefined;

  return {
    table,
    strategy: strategy || 'conservative',
    ttl: config.revalidate || CACHE_STRATEGIES.conservative,
    tags: config.tags || [],
  };
}

/**
 * List all cached tables and their configurations
 */
export function listCachedTables(): CacheStats[] {
  return Object.keys(TABLE_CACHE_CONFIG)
    .map(getCacheStats)
    .filter((stat): stat is CacheStats => stat !== null);
}

// ======================
// EXPORT UTILITIES
// ======================

export {
  CACHE_STRATEGIES,
  TABLE_CACHE_CONFIG,
};

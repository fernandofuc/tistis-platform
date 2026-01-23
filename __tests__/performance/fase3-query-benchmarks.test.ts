// =====================================================
// TIS TIS PLATFORM - FASE 3 Performance Tests
// Database Query Latency Benchmarks
//
// NOTE: These are INTEGRATION tests that require a real Supabase connection.
// They are skipped when NEXT_PUBLIC_SUPABASE_URL is not available.
// =====================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Skip tests if Supabase is not configured (CI/local without .env)
const shouldRunIntegrationTests = Boolean(supabaseUrl && supabaseServiceKey);

// Performance targets from TESTING_PLAN.md
const TARGETS = {
  QUERY_FILTERED_P95: 100,      // < 100ms for filtered queries
  QUERY_UNFILTERED_P95: 150,    // < 150ms for unfiltered queries
  AUTH_OVERHEAD: 10,            // < 10ms auth overhead
  CACHE_HIT_RATE: 70,          // > 70% cache hit rate
};

describe.skipIf(!shouldRunIntegrationTests)('FASE 3 Performance Benchmarks', () => {
  let supabase: SupabaseClient;
  let testTenantId: string;
  let testBranchId: string;

  beforeAll(async () => {
    supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create test tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .insert({
        name: `Benchmark Tenant ${Date.now()}`,
        slug: `benchmark-${Date.now()}`,
        plan: 'professional',
      })
      .select()
      .single();

    testTenantId = tenant!.id;

    // Create test branch
    const { data: branch } = await supabase
      .from('branches')
      .insert({
        tenant_id: testTenantId,
        name: 'Benchmark Branch',
        is_headquarters: true,
        is_active: true,
      })
      .select()
      .single();

    testBranchId = branch!.id;

    // Create test data (500 leads for realistic benchmarking)
    const leads = Array.from({ length: 500 }, (_, i) => ({
      tenant_id: testTenantId,
      branch_id: testBranchId,
      phone: `555${String(i).padStart(7, '0')}`,
      name: `Benchmark Lead ${i}`,
      status: ['new', 'contacted', 'qualified', 'converted'][i % 4],
      source: ['website', 'referral', 'social', 'direct'][i % 4],
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    // Insert in batches of 100
    for (let i = 0; i < leads.length; i += 100) {
      await supabase.from('leads').insert(leads.slice(i, i + 100));
    }

    // Create test appointments
    const appointments = Array.from({ length: 200 }, (_, i) => ({
      tenant_id: testTenantId,
      branch_id: testBranchId,
      scheduled_at: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: ['confirmed', 'pending', 'completed', 'cancelled'][i % 4],
      duration_minutes: [30, 45, 60, 90][i % 4],
    }));

    for (let i = 0; i < appointments.length; i += 100) {
      await supabase.from('appointments').insert(appointments.slice(i, i + 100));
    }

    // Create inventory items
    const inventory = Array.from({ length: 100 }, (_, i) => ({
      tenant_id: testTenantId,
      branch_id: testBranchId,
      name: `Item ${i}`,
      sku: `SKU-${String(i).padStart(4, '0')}`,
      current_stock: Math.floor(Math.random() * 50),
      minimum_stock: 10,
      unit: 'units',
      category: ['Supplies', 'Equipment', 'Food', 'Other'][i % 4],
    }));

    await supabase.from('inventory_items').insert(inventory);
  });

  afterAll(async () => {
    if (testTenantId) {
      await supabase.from('tenants').delete().eq('id', testTenantId);
    }
  });

  // ======================
  // QUERY LATENCY BENCHMARKS
  // ======================

  describe('Query Latency (with FASE 3 indexes)', () => {
    it('should query leads with branch filter in < 100ms (p95)', async () => {
      const measurements: number[] = [];

      // Run 20 queries to get p95
      for (let i = 0; i < 20; i++) {
        const start = performance.now();

        await supabase
          .from('leads')
          .select('*')
          .eq('tenant_id', testTenantId)
          .eq('branch_id', testBranchId)
          .in('status', ['new', 'contacted', 'qualified'])
          .order('created_at', { ascending: false })
          .limit(20);

        const duration = performance.now() - start;
        measurements.push(duration);
      }

      const sorted = measurements.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      console.log(`  📊 Leads query - Avg: ${avg.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(TARGETS.QUERY_FILTERED_P95);
    });

    it('should query appointments efficiently in < 100ms (p95)', async () => {
      const measurements: number[] = [];

      for (let i = 0; i < 20; i++) {
        const start = performance.now();

        await supabase
          .from('appointments')
          .select('*')
          .eq('tenant_id', testTenantId)
          .eq('branch_id', testBranchId)
          .gte('scheduled_at', new Date().toISOString())
          .eq('status', 'confirmed')
          .order('scheduled_at', { ascending: true })
          .limit(20);

        const duration = performance.now() - start;
        measurements.push(duration);
      }

      const sorted = measurements.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      console.log(`  📊 Appointments query - Avg: ${avg.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(TARGETS.QUERY_FILTERED_P95);
    });

    it('should query inventory low stock items efficiently', async () => {
      const measurements: number[] = [];

      for (let i = 0; i < 20; i++) {
        const start = performance.now();

        await supabase.rpc('get_low_stock_items', {
          p_tenant_id: testTenantId,
          p_branch_id: testBranchId,
        });

        const duration = performance.now() - start;
        measurements.push(duration);
      }

      const sorted = measurements.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      console.log(`  📊 Low stock RPC - Avg: ${avg.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(TARGETS.QUERY_FILTERED_P95);
    });

    it('should handle complex multi-filter queries efficiently', async () => {
      const measurements: number[] = [];

      for (let i = 0; i < 20; i++) {
        const start = performance.now();

        await supabase
          .from('leads')
          .select('*')
          .eq('tenant_id', testTenantId)
          .eq('branch_id', testBranchId)
          .in('status', ['new', 'contacted', 'qualified'])
          .in('source', ['website', 'referral'])
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(50);

        const duration = performance.now() - start;
        measurements.push(duration);
      }

      const sorted = measurements.sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];

      console.log(`  📊 Complex query - P95: ${p95.toFixed(2)}ms`);

      expect(p95).toBeLessThan(TARGETS.QUERY_FILTERED_P95 + 50); // Slightly higher for complex
    });
  });

  // ======================
  // PARALLEL QUERY PERFORMANCE
  // ======================

  describe('Parallel Query Execution', () => {
    it('should execute 3 queries in parallel faster than sequential', async () => {
      // Sequential execution
      const sequentialStart = performance.now();

      await supabase.from('leads').select('*').eq('tenant_id', testTenantId).limit(20);
      await supabase.from('appointments').select('*').eq('tenant_id', testTenantId).limit(20);
      await supabase.from('inventory_items').select('*').eq('tenant_id', testTenantId).limit(20);

      const sequentialDuration = performance.now() - sequentialStart;

      // Parallel execution
      const parallelStart = performance.now();

      await Promise.all([
        supabase.from('leads').select('*').eq('tenant_id', testTenantId).limit(20),
        supabase.from('appointments').select('*').eq('tenant_id', testTenantId).limit(20),
        supabase.from('inventory_items').select('*').eq('tenant_id', testTenantId).limit(20),
      ]);

      const parallelDuration = performance.now() - parallelStart;

      console.log(`  🔀 Sequential: ${sequentialDuration.toFixed(2)}ms`);
      console.log(`  ⚡ Parallel: ${parallelDuration.toFixed(2)}ms`);
      console.log(`  📈 Speedup: ${(sequentialDuration / parallelDuration).toFixed(2)}x`);

      // Parallel should be at least 1.5x faster
      expect(parallelDuration).toBeLessThan(sequentialDuration * 0.66);
    });
  });

  // ======================
  // INDEX EFFECTIVENESS
  // ======================

  describe('Index Effectiveness', () => {
    it('should use partial index for common status filters', async () => {
      // Query with status filter (should use partial index)
      const start = performance.now();

      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('branch_id', testBranchId)
        .in('status', ['new', 'contacted', 'qualified'])
        .order('created_at', { ascending: false })
        .limit(50);

      const duration = performance.now() - start;

      console.log(`  📊 Status filter query: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(100);
      expect(data!.length).toBeGreaterThan(0);
    });

    it('should use covering index to avoid table lookup', async () => {
      // Select only indexed columns
      const start = performance.now();

      const { data } = await supabase
        .from('leads')
        .select('id, phone, name, status')
        .eq('branch_id', testBranchId)
        .order('created_at', { ascending: false })
        .limit(50);

      const duration = performance.now() - start;

      console.log(`  📊 Covering index query: ${duration.toFixed(2)}ms`);

      // Should be very fast with covering index
      expect(duration).toBeLessThan(50);
      expect(data!.length).toBeGreaterThan(0);
    });
  });

  // ======================
  // RPC FUNCTION PERFORMANCE
  // ======================

  describe('RPC Function Performance', () => {
    it('should execute get_branch_stats_summary in < 100ms', async () => {
      const measurements: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();

        await supabase.rpc('get_branch_stats_summary', {
          p_tenant_id: testTenantId,
          p_branch_id: testBranchId,
        });

        const duration = performance.now() - start;
        measurements.push(duration);
      }

      const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const max = Math.max(...measurements);

      console.log(`  📊 Branch stats RPC - Avg: ${avg.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);

      expect(avg).toBeLessThan(100);
      expect(max).toBeLessThan(200);
    });
  });

  // ======================
  // PAGINATION PERFORMANCE
  // ======================

  describe('Pagination Performance', () => {
    it('should maintain consistent performance across pages', async () => {
      const pageSizes = [20, 50, 100];
      const measurements: Record<number, number[]> = {
        20: [],
        50: [],
        100: [],
      };

      for (const pageSize of pageSizes) {
        for (let page = 0; page < 3; page++) {
          const start = performance.now();

          await supabase
            .from('leads')
            .select('*', { count: 'exact' })
            .eq('tenant_id', testTenantId)
            .eq('branch_id', testBranchId)
            .order('created_at', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          const duration = performance.now() - start;
          measurements[pageSize].push(duration);
        }
      }

      // Log results
      Object.entries(measurements).forEach(([size, times]) => {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        console.log(`  📄 Page size ${size} - Avg: ${avg.toFixed(2)}ms`);
      });

      // All page sizes should be under 150ms
      Object.values(measurements).forEach((times) => {
        times.forEach((time) => {
          expect(time).toBeLessThan(TARGETS.QUERY_UNFILTERED_P95);
        });
      });
    });
  });

  // ======================
  // AGGREGATE QUERY PERFORMANCE
  // ======================

  describe('Aggregate Queries', () => {
    it('should count records efficiently', async () => {
      const start = performance.now();

      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', testTenantId)
        .eq('branch_id', testBranchId);

      const duration = performance.now() - start;

      console.log(`  🔢 Count query: ${duration.toFixed(2)}ms (${count} records)`);

      expect(duration).toBeLessThan(50);
      expect(count).toBe(500);
    });

    it('should group by status efficiently', async () => {
      const start = performance.now();

      const { data } = await supabase
        .from('leads')
        .select('status')
        .eq('tenant_id', testTenantId)
        .eq('branch_id', testBranchId);

      // Group in application (Supabase doesn't support GROUP BY directly)
      const grouped = data!.reduce((acc: Record<string, number>, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {});

      const duration = performance.now() - start;

      console.log(`  📊 Group by query: ${duration.toFixed(2)}ms`);
      console.log(`  📊 Results:`, grouped);

      expect(duration).toBeLessThan(150);
    });
  });

  // ======================
  // COMPARATIVE BENCHMARKS
  // ======================

  describe('Before/After FASE 3 Comparison', () => {
    it('should demonstrate improvement with partial indexes', async () => {
      // Without index optimization (full table scan simulation)
      // We can't actually disable indexes, but we can compare filtered vs unfiltered

      const unfilteredStart = performance.now();
      await supabase.from('leads').select('*').eq('tenant_id', testTenantId).limit(500);
      const unfilteredDuration = performance.now() - unfilteredStart;

      const filteredStart = performance.now();
      await supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('branch_id', testBranchId)
        .limit(500);
      const filteredDuration = performance.now() - filteredStart;

      console.log(`  📊 Unfiltered query: ${unfilteredDuration.toFixed(2)}ms`);
      console.log(`  📊 Filtered query: ${filteredDuration.toFixed(2)}ms`);
      console.log(`  📈 Improvement: ${((unfilteredDuration - filteredDuration) / unfilteredDuration * 100).toFixed(2)}%`);

      // Filtered should be faster or equal
      expect(filteredDuration).toBeLessThanOrEqual(unfilteredDuration * 1.1);
    });
  });
});

// =====================================================
// TIS TIS PLATFORM - FASE 3 Integration Tests
// Tests for Migration 137: RPC Functions & Materialized Views
// =====================================================

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('FASE 3 Migration 137 - RPC Functions', () => {
  let supabase: SupabaseClient;
  let testTenantId: string;
  let testBranch1Id: string;
  let testBranch2Id: string;

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create test tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .insert({
        name: `Test Tenant FASE3 RPC ${Date.now()}`,
        slug: `test-fase3-rpc-${Date.now()}`,
        plan: 'professional',
      })
      .select()
      .single();

    testTenantId = tenant!.id;

    // Create two test branches
    const { data: branch1 } = await supabase
      .from('branches')
      .insert({
        tenant_id: testTenantId,
        name: 'Branch 1 - North',
        is_headquarters: true,
        is_active: true,
      })
      .select()
      .single();

    testBranch1Id = branch1!.id;

    const { data: branch2 } = await supabase
      .from('branches')
      .insert({
        tenant_id: testTenantId,
        name: 'Branch 2 - South',
        is_headquarters: false,
        is_active: true,
      })
      .select()
      .single();

    testBranch2Id = branch2!.id;

    // Create test inventory items (some low stock, some normal)
    await supabase.from('inventory_items').insert([
      // Branch 1 - Low stock items
      {
        tenant_id: testTenantId,
        branch_id: testBranch1Id,
        name: 'Low Stock Item 1',
        sku: 'LSI-001',
        current_stock: 3,
        minimum_stock: 10,
        unit: 'units',
        category: 'Supplies',
      },
      {
        tenant_id: testTenantId,
        branch_id: testBranch1Id,
        name: 'Low Stock Item 2',
        sku: 'LSI-002',
        current_stock: 0,
        minimum_stock: 5,
        unit: 'units',
        category: 'Supplies',
      },
      // Branch 1 - Normal stock
      {
        tenant_id: testTenantId,
        branch_id: testBranch1Id,
        name: 'Normal Stock Item',
        sku: 'NSI-001',
        current_stock: 20,
        minimum_stock: 10,
        unit: 'units',
        category: 'Supplies',
      },
      // Branch 2 - Low stock
      {
        tenant_id: testTenantId,
        branch_id: testBranch2Id,
        name: 'Low Stock Branch 2',
        sku: 'LSI-003',
        current_stock: 2,
        minimum_stock: 8,
        unit: 'units',
        category: 'Supplies',
      },
    ]);

    // Create test leads for stats
    await supabase.from('leads').insert([
      {
        tenant_id: testTenantId,
        branch_id: testBranch1Id,
        phone: '1111111111',
        name: 'Test Lead 1',
        status: 'new',
      },
      {
        tenant_id: testTenantId,
        branch_id: testBranch1Id,
        phone: '2222222222',
        name: 'Test Lead 2',
        status: 'contacted',
      },
      {
        tenant_id: testTenantId,
        branch_id: testBranch2Id,
        phone: '3333333333',
        name: 'Test Lead 3',
        status: 'qualified',
      },
    ]);

    // Create test appointments
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    await supabase.from('appointments').insert([
      {
        tenant_id: testTenantId,
        branch_id: testBranch1Id,
        scheduled_at: tomorrow,
        status: 'confirmed',
        duration_minutes: 60,
      },
      {
        tenant_id: testTenantId,
        branch_id: testBranch1Id,
        scheduled_at: new Date().toISOString(),
        status: 'completed',
        duration_minutes: 45,
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup
    if (testTenantId) {
      await supabase.from('tenants').delete().eq('id', testTenantId);
    }
  });

  // ======================
  // get_low_stock_items RPC
  // ======================
  describe('get_low_stock_items', () => {
    it('should return low stock items for specific branch', async () => {
      const { data, error } = await supabase.rpc('get_low_stock_items', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBe(2); // Two low stock items in Branch 1
    });

    it('should return all low stock items when branch_id is null', async () => {
      const { data, error } = await supabase.rpc('get_low_stock_items', {
        p_tenant_id: testTenantId,
        p_branch_id: null,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBe(3); // Total 3 low stock items across all branches
    });

    it('should include branch context in results', async () => {
      const { data } = await supabase.rpc('get_low_stock_items', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      const firstItem = data![0];
      expect(firstItem).toHaveProperty('branch_id');
      expect(firstItem).toHaveProperty('branch_name');
      expect(firstItem.branch_name).toBeTruthy();
    });

    it('should calculate stock deficit correctly', async () => {
      const { data } = await supabase.rpc('get_low_stock_items', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      data!.forEach((item: any) => {
        const expectedDeficit = item.minimum_stock - item.current_stock;
        expect(item.stock_deficit).toBe(expectedDeficit);
        expect(item.stock_deficit).toBeGreaterThan(0);
      });
    });

    it('should order by deficit DESC, then name ASC', async () => {
      const { data } = await supabase.rpc('get_low_stock_items', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      // First item should have highest deficit (0 current stock, 5 minimum = 5 deficit)
      expect(data![0].current_stock).toBe(0);
      expect(data![0].stock_deficit).toBe(5);
    });

    it('should include all required fields', async () => {
      const { data } = await supabase.rpc('get_low_stock_items', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      const requiredFields = [
        'id',
        'tenant_id',
        'branch_id',
        'branch_name',
        'name',
        'sku',
        'current_stock',
        'minimum_stock',
        'stock_deficit',
        'unit',
        'category',
        'last_updated_at',
      ];

      const firstItem = data![0];
      requiredFields.forEach((field) => {
        expect(firstItem).toHaveProperty(field);
      });
    });

    it('should not return items with sufficient stock', async () => {
      const { data } = await supabase.rpc('get_low_stock_items', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      data!.forEach((item: any) => {
        expect(item.current_stock).toBeLessThan(item.minimum_stock);
      });
    });

    it('should filter by tenant correctly', async () => {
      const { data } = await supabase.rpc('get_low_stock_items', {
        p_tenant_id: testTenantId,
        p_branch_id: null,
      });

      data!.forEach((item: any) => {
        expect(item.tenant_id).toBe(testTenantId);
      });
    });

    it('should handle branch with no low stock items', async () => {
      // Create a new branch with only normal stock
      const { data: branch3 } = await supabase
        .from('branches')
        .insert({
          tenant_id: testTenantId,
          name: 'Branch 3 - Full Stock',
          is_active: true,
        })
        .select()
        .single();

      await supabase.from('inventory_items').insert({
        tenant_id: testTenantId,
        branch_id: branch3!.id,
        name: 'Full Stock Item',
        sku: 'FSI-001',
        current_stock: 100,
        minimum_stock: 10,
        unit: 'units',
        category: 'Test',
      });

      const { data, error } = await supabase.rpc('get_low_stock_items', {
        p_tenant_id: testTenantId,
        p_branch_id: branch3!.id,
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  // ======================
  // get_branch_stats_summary RPC
  // ======================
  describe('get_branch_stats_summary', () => {
    it('should return JSONB stats for branch', async () => {
      const { data, error } = await supabase.rpc('get_branch_stats_summary', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    });

    it('should include branch_id in results', async () => {
      const { data } = await supabase.rpc('get_branch_stats_summary', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      expect(data.branch_id).toBe(testBranch1Id);
    });

    it('should include lead statistics', async () => {
      const { data } = await supabase.rpc('get_branch_stats_summary', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      expect(data).toHaveProperty('leads');
      expect(data.leads).toHaveProperty('total');
      expect(data.leads).toHaveProperty('new');
      expect(data.leads).toHaveProperty('contacted');
      expect(data.leads).toHaveProperty('qualified');
      expect(data.leads).toHaveProperty('converted');

      expect(data.leads.total).toBe(2); // Branch 1 has 2 leads
    });

    it('should include appointment statistics', async () => {
      const { data } = await supabase.rpc('get_branch_stats_summary', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      expect(data).toHaveProperty('appointments');
      expect(data.appointments).toHaveProperty('total');
      expect(data.appointments).toHaveProperty('today');
      expect(data.appointments).toHaveProperty('upcoming');
      expect(data.appointments).toHaveProperty('completed');

      expect(data.appointments.total).toBe(2); // Branch 1 has 2 appointments
    });

    it('should include inventory statistics', async () => {
      const { data } = await supabase.rpc('get_branch_stats_summary', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      expect(data).toHaveProperty('inventory');
      expect(data.inventory).toHaveProperty('total_items');
      expect(data.inventory).toHaveProperty('low_stock_items');
      expect(data.inventory).toHaveProperty('out_of_stock');

      expect(data.inventory.total_items).toBe(3); // Branch 1 has 3 items
      expect(data.inventory.low_stock_items).toBe(2); // 2 low stock
      expect(data.inventory.out_of_stock).toBe(1); // 1 at 0 stock
    });

    it('should include generated_at timestamp', async () => {
      const { data } = await supabase.rpc('get_branch_stats_summary', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      expect(data).toHaveProperty('generated_at');
      expect(data.generated_at).toBeTruthy();

      const generatedTime = new Date(data.generated_at).getTime();
      const now = Date.now();
      expect(Math.abs(now - generatedTime)).toBeLessThan(5000); // Within 5 seconds
    });

    it('should return different stats for different branches', async () => {
      const { data: stats1 } = await supabase.rpc('get_branch_stats_summary', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch1Id,
      });

      const { data: stats2 } = await supabase.rpc('get_branch_stats_summary', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranch2Id,
      });

      expect(stats1.branch_id).not.toBe(stats2.branch_id);
      expect(stats1.leads.total).not.toBe(stats2.leads.total);
    });
  });

  // ======================
  // Materialized View Tests
  // ======================
  describe('mv_branch_performance_metrics', () => {
    it('should have materialized view accessible', async () => {
      const { data, error } = await supabase
        .from('mv_branch_performance_metrics')
        .select('*')
        .eq('tenant_id', testTenantId)
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should include branch performance metrics', async () => {
      const { data } = await supabase
        .from('mv_branch_performance_metrics')
        .select('*')
        .eq('tenant_id', testTenantId)
        .single();

      expect(data).toHaveProperty('branch_id');
      expect(data).toHaveProperty('tenant_id');
      expect(data).toHaveProperty('branch_name');
      expect(data).toHaveProperty('leads_30d');
      expect(data).toHaveProperty('leads_7d');
      expect(data).toHaveProperty('appointments_30d');
      expect(data).toHaveProperty('total_inventory_items');
      expect(data).toHaveProperty('low_stock_items');
      expect(data).toHaveProperty('refreshed_at');
    });

    it('should have unique index on branch_id', async () => {
      // Unique index means querying by branch_id should be fast
      const { data } = await supabase
        .from('mv_branch_performance_metrics')
        .select('*')
        .eq('branch_id', testBranch1Id)
        .single();

      expect(data).toBeDefined();
      expect(data!.branch_id).toBe(testBranch1Id);
    });

    it('should have tenant_id index for filtering', async () => {
      const { data } = await supabase
        .from('mv_branch_performance_metrics')
        .select('*')
        .eq('tenant_id', testTenantId);

      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);

      data!.forEach((row: any) => {
        expect(row.tenant_id).toBe(testTenantId);
      });
    });
  });

  // ======================
  // refresh_branch_performance_metrics
  // ======================
  describe('refresh_branch_performance_metrics', () => {
    it('should have refresh function available', async () => {
      const { error } = await supabase.rpc('refresh_branch_performance_metrics');

      expect(error).toBeNull();
    });

    it('should update refreshed_at timestamp after refresh', async () => {
      // Get current timestamp
      const { data: before } = await supabase
        .from('mv_branch_performance_metrics')
        .select('refreshed_at')
        .eq('branch_id', testBranch1Id)
        .single();

      const beforeTime = new Date(before!.refreshed_at).getTime();

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Refresh
      await supabase.rpc('refresh_branch_performance_metrics');

      // Get new timestamp
      const { data: after } = await supabase
        .from('mv_branch_performance_metrics')
        .select('refreshed_at')
        .eq('branch_id', testBranch1Id)
        .single();

      const afterTime = new Date(after!.refreshed_at).getTime();

      expect(afterTime).toBeGreaterThan(beforeTime);
    });
  });

  // ======================
  // vw_cache_freshness View
  // ======================
  describe('vw_cache_freshness', () => {
    it('should have cache freshness view', async () => {
      const { data, error } = await supabase
        .from('vw_cache_freshness')
        .select('*')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should report view name and last refresh', async () => {
      const { data } = await supabase
        .from('vw_cache_freshness')
        .select('*')
        .single();

      expect(data!.view_name).toBe('mv_branch_performance_metrics');
      expect(data).toHaveProperty('last_refresh');
      expect(data).toHaveProperty('seconds_since_refresh');
      expect(data).toHaveProperty('freshness_status');
    });

    it('should calculate freshness status correctly', async () => {
      const { data } = await supabase
        .from('vw_cache_freshness')
        .select('*')
        .single();

      expect(['FRESH', 'STALE', 'VERY_STALE']).toContain(data!.freshness_status);
    });
  });
});

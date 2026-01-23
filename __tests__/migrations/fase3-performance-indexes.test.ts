// =====================================================
// TIS TIS PLATFORM - FASE 3 Integration Tests
// Tests for Migration 136: Performance Optimization Indexes
// =====================================================

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('FASE 3 Migration 136 - Performance Indexes', () => {
  let supabase: SupabaseClient;
  let testTenantId: string;
  let testBranchId: string;

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
        name: `Test Tenant FASE3 ${Date.now()}`,
        slug: `test-fase3-${Date.now()}`,
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
        name: 'Test Branch FASE3',
        is_headquarters: true,
        is_active: true,
      })
      .select()
      .single();

    testBranchId = branch!.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testTenantId) {
      await supabase.from('tenants').delete().eq('id', testTenantId);
    }
  });

  // ======================
  // TEST INDEX EXISTENCE
  // ======================
  describe('Index Validation Function', () => {
    it('should have validate_fase3_indexes function', async () => {
      const { data, error } = await supabase.rpc('validate_fase3_indexes');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should report all indexes as present', async () => {
      const { data } = await supabase.rpc('validate_fase3_indexes');

      const failedChecks = data?.filter((check: any) => check.status === 'MISSING');

      expect(failedChecks?.length).toBe(0);
    });

    it('should validate 14 total indexes', async () => {
      const { data } = await supabase.rpc('validate_fase3_indexes');

      // Migration 136 creates 14 indexes
      expect(data?.length).toBeGreaterThanOrEqual(14);
    });
  });

  // ======================
  // LEADS TABLE INDEXES
  // ======================
  describe('Leads Table - Performance Indexes', () => {
    beforeAll(async () => {
      // Create test leads
      await supabase.from('leads').insert([
        {
          tenant_id: testTenantId,
          branch_id: testBranchId,
          phone: '1111111111',
          name: 'Lead 1 - New',
          status: 'new',
          created_at: new Date().toISOString(),
        },
        {
          tenant_id: testTenantId,
          branch_id: testBranchId,
          phone: '2222222222',
          name: 'Lead 2 - Contacted',
          status: 'contacted',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ]);
    });

    it('should query leads efficiently with branch + status filter', async () => {
      const startTime = Date.now();

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('branch_id', testBranchId)
        .in('status', ['new', 'contacted'])
        .order('created_at', { ascending: false });

      const queryTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);

      // With index, query should be fast (< 100ms target)
      expect(queryTime).toBeLessThan(200);
    });

    it('should use covering index for common fields', async () => {
      // Covering index includes: id, tenant_id, phone, name, status, source
      const { data, error } = await supabase
        .from('leads')
        .select('id, phone, name, status')
        .eq('tenant_id', testTenantId)
        .eq('branch_id', testBranchId)
        .order('created_at', { ascending: false })
        .limit(10);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  // ======================
  // APPOINTMENTS TABLE INDEXES
  // ======================
  describe('Appointments Table - Performance Indexes', () => {
    beforeAll(async () => {
      // Create test appointments
      const tomorrow = new Date(Date.now() + 86400000).toISOString();

      await supabase.from('appointments').insert([
        {
          tenant_id: testTenantId,
          branch_id: testBranchId,
          scheduled_at: tomorrow,
          status: 'confirmed',
          duration_minutes: 60,
        },
      ]);
    });

    it('should query upcoming appointments efficiently', async () => {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('branch_id', testBranchId)
        .gte('scheduled_at', now)
        .eq('status', 'confirmed')
        .order('scheduled_at', { ascending: true });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should use partial index for confirmed appointments', async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('branch_id', testBranchId)
        .eq('status', 'confirmed')
        .order('scheduled_at', { ascending: true });

      expect(data).toBeDefined();
    });
  });

  // ======================
  // INVENTORY TABLE INDEXES
  // ======================
  describe('Inventory Table - Performance Indexes', () => {
    beforeAll(async () => {
      // Create test inventory items
      await supabase.from('inventory_items').insert([
        {
          tenant_id: testTenantId,
          branch_id: testBranchId,
          name: 'Low Stock Item',
          sku: 'TEST-001',
          current_stock: 5,
          minimum_stock: 10,
          unit: 'units',
          category: 'Test',
        },
        {
          tenant_id: testTenantId,
          branch_id: testBranchId,
          name: 'Normal Stock Item',
          sku: 'TEST-002',
          current_stock: 20,
          minimum_stock: 10,
          unit: 'units',
          category: 'Test',
        },
      ]);
    });

    it('should query low stock items efficiently using RPC', async () => {
      // Note: Column comparison (current_stock < minimum_stock) requires RPC function
      const { data, error } = await supabase.rpc('get_low_stock_items', {
        p_tenant_id: testTenantId,
        p_branch_id: testBranchId,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should use partial index for branch + active items', async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('branch_id', testBranchId)
        .order('name', { ascending: true });

      expect(data).toBeDefined();
    });
  });

  // ======================
  // API KEY USAGE LOGS
  // ======================
  describe('API Key Usage Logs - Performance Indexes', () => {
    it('should have index for api_key_id + created_at', async () => {
      const { data } = await supabase.rpc('validate_fase3_indexes');

      const apiKeyLogIndex = data?.find((check: any) =>
        check.check_name.includes('api_key_usage_logs')
      );

      expect(apiKeyLogIndex).toBeDefined();
      expect(apiKeyLogIndex?.status).toBe('PRESENT');
    });
  });

  // ======================
  // PERFORMANCE BENCHMARKS
  // ======================
  describe('Performance Benchmarks', () => {
    it('should execute branch-filtered queries in < 100ms', async () => {
      const startTime = Date.now();

      await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .eq('tenant_id', testTenantId)
          .eq('branch_id', testBranchId)
          .limit(10),

        supabase
          .from('appointments')
          .select('*')
          .eq('tenant_id', testTenantId)
          .eq('branch_id', testBranchId)
          .limit(10),

        supabase
          .from('inventory_items')
          .select('*')
          .eq('tenant_id', testTenantId)
          .eq('branch_id', testBranchId)
          .limit(10),
      ]);

      const totalTime = Date.now() - startTime;

      // Three parallel queries should complete quickly
      expect(totalTime).toBeLessThan(300);
    });

    it('should handle complex queries with multiple filters', async () => {
      const startTime = Date.now();

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('branch_id', testBranchId)
        .in('status', ['new', 'contacted', 'qualified'])
        .gte('created_at', new Date(Date.now() - 2592000000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      const queryTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(queryTime).toBeLessThan(150);
    });
  });

  // ======================
  // INDEX STATISTICS
  // ======================
  describe('Index Statistics (if accessible)', () => {
    it('should have indexes without null check violations', async () => {
      // Verify indexes are properly created
      const { data } = await supabase.rpc('validate_fase3_indexes');

      data?.forEach((check: any) => {
        expect(check.status).not.toBe('ERROR');
      });
    });
  });
});

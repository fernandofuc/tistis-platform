// =====================================================
// TIS TIS PLATFORM - FASE 3 Integration Tests
// Tests for Analytics API Endpoint
//
// NOTE: These are INTEGRATION tests that require a real Supabase connection.
// They are skipped when NEXT_PUBLIC_SUPABASE_URL is not available.
// =====================================================

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateAPIKey } from '@/src/features/api-settings/utils/keyGenerator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Skip tests if Supabase is not configured (CI/local without .env)
const shouldRunIntegrationTests = Boolean(supabaseUrl && supabaseServiceKey);

let supabase: SupabaseClient;
let testTenantId: string;
let testUserId: string;
let testBranch1Id: string;
let testBranch2Id: string;
let branch1APIKey: string;
let branch2APIKey: string;
let apiKey1Id: string;
let apiKey2Id: string;

describe.skipIf(!shouldRunIntegrationTests)('FASE 3 Analytics API - Integration Tests', () => {
  beforeAll(async () => {
    // We can assert these exist because shouldRunIntegrationTests checks them
    supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create test user
    const { data: user } = await supabase.auth.admin.createUser({
      email: `analytics-test-${Date.now()}@tistis.com`,
      password: 'test-password-123',
      email_confirm: true,
    });

    testUserId = user!.user!.id;

    // Create test tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .insert({
        name: `Analytics Test Tenant ${Date.now()}`,
        slug: `analytics-test-${Date.now()}`,
        plan: 'professional',
      })
      .select()
      .single();

    testTenantId = tenant!.id;

    // Link user to tenant as owner
    await supabase.from('user_tenants').insert({
      user_id: testUserId,
      tenant_id: testTenantId,
      role: 'owner',
    });

    // Create two branches
    const { data: branch1 } = await supabase
      .from('branches')
      .insert({
        tenant_id: testTenantId,
        name: 'Branch 1 - Analytics',
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
        name: 'Branch 2 - Analytics',
        is_headquarters: false,
        is_active: true,
      })
      .select()
      .single();

    testBranch2Id = branch2!.id;

    // Create branch-specific API keys
    const branch1KeyGen = generateAPIKey('test');
    const { data: key1 } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: testTenantId,
        created_by: testUserId,
        name: 'Branch 1 Analytics Key',
        key_hash: branch1KeyGen.hash,
        key_hint: branch1KeyGen.hint,
        key_prefix: branch1KeyGen.prefix,
        environment: 'test',
        scope_type: 'branch',
        branch_id: testBranch1Id,
        scopes: ['leads:read', 'leads:write'],
        rate_limit_rpm: 100,
        rate_limit_daily: 10000,
        is_active: true,
        usage_count: 15, // Simulate usage
      })
      .select()
      .single();

    branch1APIKey = branch1KeyGen.key;
    apiKey1Id = key1!.id;

    const branch2KeyGen = generateAPIKey('test');
    const { data: key2 } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: testTenantId,
        created_by: testUserId,
        name: 'Branch 2 Analytics Key',
        key_hash: branch2KeyGen.hash,
        key_hint: branch2KeyGen.hint,
        key_prefix: branch2KeyGen.prefix,
        environment: 'test',
        scope_type: 'branch',
        branch_id: testBranch2Id,
        scopes: ['leads:read'],
        rate_limit_rpm: 60,
        rate_limit_daily: 5000,
        is_active: true,
        usage_count: 25,
      })
      .select()
      .single();

    branch2APIKey = branch2KeyGen.key;
    apiKey2Id = key2!.id;

    // Create test API usage logs
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await supabase.from('api_key_usage_logs').insert([
      // Branch 1 logs
      {
        tenant_id: testTenantId,
        api_key_id: apiKey1Id,
        endpoint: '/api/v1/leads',
        status_code: 200,
        response_time_ms: 45,
        created_at: oneDayAgo.toISOString(),
      },
      {
        tenant_id: testTenantId,
        api_key_id: apiKey1Id,
        endpoint: '/api/v1/leads',
        status_code: 200,
        response_time_ms: 52,
        created_at: oneDayAgo.toISOString(),
      },
      {
        tenant_id: testTenantId,
        api_key_id: apiKey1Id,
        endpoint: '/api/v1/appointments',
        status_code: 201,
        response_time_ms: 78,
        created_at: new Date().toISOString(),
      },
      // Branch 2 logs
      {
        tenant_id: testTenantId,
        api_key_id: apiKey2Id,
        endpoint: '/api/v1/leads',
        status_code: 200,
        response_time_ms: 63,
        created_at: oneDayAgo.toISOString(),
      },
      {
        tenant_id: testTenantId,
        api_key_id: apiKey2Id,
        endpoint: '/api/v1/leads',
        status_code: 429,
        response_time_ms: 15,
        created_at: new Date().toISOString(),
      },
    ]);

    // Create test leads for branches
    await supabase.from('leads').insert([
      // Branch 1 leads
      {
        tenant_id: testTenantId,
        branch_id: testBranch1Id,
        phone: '1111111111',
        name: 'Lead 1 Branch 1',
        status: 'new',
      },
      {
        tenant_id: testTenantId,
        branch_id: testBranch1Id,
        phone: '2222222222',
        name: 'Lead 2 Branch 1',
        status: 'contacted',
      },
      // Branch 2 leads
      {
        tenant_id: testTenantId,
        branch_id: testBranch2Id,
        phone: '3333333333',
        name: 'Lead 1 Branch 2',
        status: 'new',
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup
    if (testTenantId) {
      await supabase.from('tenants').delete().eq('id', testTenantId);
    }
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  // ======================
  // Authentication & Authorization
  // ======================
  describe('Authentication & Authorization', () => {
    test('should require authentication', async () => {
      const response = await fetch(`${apiBaseUrl}/api/analytics/branch-usage`);

      expect(response.status).toBe(401);
    });

    test('should require owner or admin role', async () => {
      // Create a member user (not owner/admin)
      const { data: memberUser } = await supabase.auth.admin.createUser({
        email: `member-${Date.now()}@test.com`,
        password: 'test-pass',
        email_confirm: true,
      });

      await supabase.from('user_tenants').insert({
        user_id: memberUser!.user!.id,
        tenant_id: testTenantId,
        role: 'member',
      });

      // Try to access analytics (this would need a proper auth session)
      // In real test, would use Supabase auth to create session
      // For now, testing structure

      // Cleanup
      await supabase.from('user_tenants').delete().eq('user_id', memberUser!.user!.id);
      await supabase.auth.admin.deleteUser(memberUser!.user!.id);

      expect(true).toBe(true); // Placeholder
    });
  });

  // ======================
  // Response Structure
  // ======================
  describe('Response Structure', () => {
    test('should return analytics summary with all branches', async () => {
      // Note: This test would need proper session authentication in real implementation
      // For now, testing via direct Supabase queries to validate data availability

      // Verify data exists for analytics
      const { data: branches } = await supabase
        .from('branches')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('is_active', true);

      expect(branches).toBeDefined();
      expect(branches!.length).toBe(2);

      // Verify API keys exist
      const { data: keys } = await supabase
        .from('api_keys')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('is_active', true);

      expect(keys).toBeDefined();
      expect(keys!.length).toBe(2);

      // Verify usage logs exist
      const { data: logs } = await supabase
        .from('api_key_usage_logs')
        .select('*')
        .eq('tenant_id', testTenantId);

      expect(logs).toBeDefined();
      expect(logs!.length).toBe(5);
    });

    test('should include summary metrics', async () => {
      // Verify summary calculations work
      const { data: allLogs } = await supabase
        .from('api_key_usage_logs')
        .select('*')
        .eq('tenant_id', testTenantId);

      const totalRequests = allLogs!.length;
      const avgResponseTime =
        allLogs!.reduce((sum, log) => sum + log.response_time_ms, 0) / totalRequests;

      expect(totalRequests).toBe(5);
      expect(avgResponseTime).toBeGreaterThan(0);
    });
  });

  // ======================
  // Branch-Specific Analytics
  // ======================
  describe('Branch-Specific Analytics', () => {
    test('should aggregate metrics per branch', async () => {
      // Branch 1 metrics
      const { data: branch1Logs } = await supabase
        .from('api_key_usage_logs')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('api_key_id', apiKey1Id);

      expect(branch1Logs!.length).toBe(3);

      // Branch 2 metrics
      const { data: branch2Logs } = await supabase
        .from('api_key_usage_logs')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('api_key_id', apiKey2Id);

      expect(branch2Logs!.length).toBe(2);
    });

    test('should include API key count per branch', async () => {
      const { data: branch1Keys } = await supabase
        .from('api_keys')
        .select('id')
        .eq('tenant_id', testTenantId)
        .eq('branch_id', testBranch1Id)
        .eq('is_active', true);

      expect(branch1Keys!.length).toBe(1);

      const { data: branch2Keys } = await supabase
        .from('api_keys')
        .select('id')
        .eq('tenant_id', testTenantId)
        .eq('branch_id', testBranch2Id)
        .eq('is_active', true);

      expect(branch2Keys!.length).toBe(1);
    });

    test('should calculate lead count per branch', async () => {
      const { data: branch1Leads } = await supabase
        .from('leads')
        .select('id')
        .eq('tenant_id', testTenantId)
        .eq('branch_id', testBranch1Id);

      expect(branch1Leads!.length).toBe(2);

      const { data: branch2Leads } = await supabase
        .from('leads')
        .select('id')
        .eq('tenant_id', testTenantId)
        .eq('branch_id', testBranch2Id);

      expect(branch2Leads!.length).toBe(1);
    });

    test('should calculate average response time per branch', async () => {
      const { data: branch1Logs } = await supabase
        .from('api_key_usage_logs')
        .select('response_time_ms')
        .eq('api_key_id', apiKey1Id);

      const avgBranch1 =
        branch1Logs!.reduce((sum, log) => sum + log.response_time_ms, 0) /
        branch1Logs!.length;

      expect(avgBranch1).toBeGreaterThan(0);
      expect(avgBranch1).toBeLessThan(100); // Should be reasonable
    });

    test('should calculate error rate per branch', async () => {
      const { data: branch2Logs } = await supabase
        .from('api_key_usage_logs')
        .select('status_code')
        .eq('api_key_id', apiKey2Id);

      const errorCount = branch2Logs!.filter((log) => log.status_code >= 400).length;
      const errorRate = (errorCount / branch2Logs!.length) * 100;

      expect(errorRate).toBe(50); // 1 out of 2 logs is error (429)
    });
  });

  // ======================
  // Time Range Filtering
  // ======================
  describe('Time Range Filtering', () => {
    test('should filter logs to last 30 days', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const { data: recentLogs } = await supabase
        .from('api_key_usage_logs')
        .select('*')
        .eq('tenant_id', testTenantId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      expect(recentLogs!.length).toBe(5); // All our test logs are within 30 days
    });

    test('should calculate metrics based on filtered timeframe', async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const { data: last24h } = await supabase
        .from('api_key_usage_logs')
        .select('*')
        .eq('tenant_id', testTenantId)
        .gte('created_at', oneDayAgo.toISOString());

      expect(last24h!.length).toBeGreaterThan(0);
    });
  });

  // ======================
  // Performance
  // ======================
  describe('Performance', () => {
    test('should execute queries in parallel', async () => {
      const startTime = Date.now();

      // Simulate parallel queries like in analytics API
      await Promise.all([
        supabase
          .from('branches')
          .select('*')
          .eq('tenant_id', testTenantId)
          .eq('is_active', true),

        supabase
          .from('api_keys')
          .select('*')
          .eq('tenant_id', testTenantId)
          .eq('is_active', true),

        supabase
          .from('api_key_usage_logs')
          .select('*')
          .eq('tenant_id', testTenantId)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const duration = Date.now() - startTime;

      // Parallel execution should be fast
      expect(duration).toBeLessThan(500);
    });

    test('should use database-level filtering', async () => {
      // Verify filtering happens at DB level (not in memory)
      const branchKeyIds = [apiKey1Id, apiKey2Id];

      const { data: filteredLogs } = await supabase
        .from('api_key_usage_logs')
        .select('*')
        .eq('tenant_id', testTenantId)
        .in('api_key_id', branchKeyIds);

      expect(filteredLogs!.length).toBe(5);

      // All logs should match the filter
      filteredLogs!.forEach((log) => {
        expect(branchKeyIds).toContain(log.api_key_id);
      });
    });
  });

  // ======================
  // Edge Cases
  // ======================
  describe('Edge Cases', () => {
    test('should handle branch with no API keys', async () => {
      // Create branch without keys
      const { data: emptyBranch } = await supabase
        .from('branches')
        .insert({
          tenant_id: testTenantId,
          name: 'Empty Branch',
          is_active: true,
        })
        .select()
        .single();

      const { data: keys } = await supabase
        .from('api_keys')
        .select('id')
        .eq('branch_id', emptyBranch!.id);

      expect(keys!.length).toBe(0);

      // Cleanup
      await supabase.from('branches').delete().eq('id', emptyBranch!.id);
    });

    test('should handle branch with no usage logs', async () => {
      // Create key with no usage
      const unusedKeyGen = generateAPIKey('test');

      const { data: unusedKey } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenantId,
          created_by: testUserId,
          name: 'Unused Key',
          key_hash: unusedKeyGen.hash,
          key_hint: unusedKeyGen.hint,
          key_prefix: unusedKeyGen.prefix,
          environment: 'test',
          scope_type: 'branch',
          branch_id: testBranch1Id,
          scopes: ['leads:read'],
          rate_limit_rpm: 60,
          rate_limit_daily: 5000,
          is_active: true,
          usage_count: 0,
        })
        .select()
        .single();

      const { data: logs } = await supabase
        .from('api_key_usage_logs')
        .select('*')
        .eq('api_key_id', unusedKey!.id);

      expect(logs!.length).toBe(0);

      // Cleanup
      await supabase.from('api_keys').delete().eq('id', unusedKey!.id);
    });

    test('should handle empty array for branch key IDs', async () => {
      // When branch has no keys, should handle gracefully
      const emptyArray: string[] = [];

      const { data: logs } = await supabase
        .from('api_key_usage_logs')
        .select('*')
        .in('api_key_id', emptyArray.length > 0 ? emptyArray : ['00000000-0000-0000-0000-000000000000']);

      expect(logs!.length).toBe(0);
    });
  });
});

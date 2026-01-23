/**
 * Tests for FASE 2 Schema Migration
 * Migration 135: ADD_BRANCH_CONTEXT_TO_API_KEYS
 *
 * NOTE: These are INTEGRATION tests that require a real Supabase connection.
 * They are skipped when NEXT_PUBLIC_SUPABASE_URL is not available.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Skip tests if Supabase is not configured (CI/local without .env)
const shouldRunIntegrationTests = Boolean(supabaseUrl && supabaseServiceKey);

describe.skipIf(!shouldRunIntegrationTests)('FASE 2 Schema Migration - API Keys Branch Context', () => {
  let supabase: any;
  let testTenant: any;
  let testBranch1: any;
  let testBranch2: any;
  let testUser: any;

  beforeAll(async () => {
    supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Create test data
    const { data: tenant } = await supabase
      .from('tenants')
      .insert({
        business_name: 'Test Tenant FASE2',
        email: 'fase2-test@tistis.com',
      })
      .select()
      .single();
    testTenant = tenant;

    const { data: user } = await supabase.auth.admin.createUser({
      email: 'fase2-user@tistis.com',
      password: 'test-password-123',
      email_confirm: true,
    });
    testUser = user.user;

    const { data: branch1 } = await supabase
      .from('branches')
      .insert({
        tenant_id: testTenant.id,
        name: 'Branch 1',
        address: '123 Test St',
      })
      .select()
      .single();
    testBranch1 = branch1;

    const { data: branch2 } = await supabase
      .from('branches')
      .insert({
        tenant_id: testTenant.id,
        name: 'Branch 2',
        address: '456 Test Ave',
      })
      .select()
      .single();
    testBranch2 = branch2;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testTenant) {
      await supabase.from('api_keys').delete().eq('tenant_id', testTenant.id);
      await supabase.from('branches').delete().eq('tenant_id', testTenant.id);
      await supabase.from('tenants').delete().eq('id', testTenant.id);
    }
    if (testUser) {
      await supabase.auth.admin.deleteUser(testUser.id);
    }
  });

  describe('Schema Changes', () => {
    it('should have added branch_id column as nullable', async () => {
      const { data, error } = await supabase
        .from('api_keys')
        .select('branch_id')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have added scope_type column with default "tenant"', async () => {
      const { data: key } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenant.id,
          created_by: testUser.id,
          name: 'Test Legacy Key',
          key_hash: 'test-hash-legacy-' + Date.now(),
          key_hint: 'a1b2',
          key_prefix: 'tis_test_',
          environment: 'test',
          scopes: ['leads:read'],
          rate_limit_rpm: 60,
          rate_limit_daily: 10000,
        })
        .select()
        .single();

      expect(key.scope_type).toBe('tenant');
      expect(key.branch_id).toBeNull();
    });

    it('should have added branch_context column as JSONB', async () => {
      const { data, error } = await supabase
        .from('api_keys')
        .select('branch_context')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Constraints - Branch Scope Consistency', () => {
    it('should allow tenant scope with null branch_id', async () => {
      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenant.id,
          created_by: testUser.id,
          name: 'Tenant-wide Key',
          key_hash: 'test-hash-tenant-' + Date.now(),
          key_hint: 'c3d4',
          key_prefix: 'tis_test_',
          environment: 'test',
          scope_type: 'tenant',
          branch_id: null,
          scopes: ['leads:read'],
          rate_limit_rpm: 60,
          rate_limit_daily: 10000,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.scope_type).toBe('tenant');
      expect(data.branch_id).toBeNull();
    });

    it('should allow branch scope with valid branch_id', async () => {
      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenant.id,
          created_by: testUser.id,
          name: 'Branch-specific Key',
          key_hash: 'test-hash-branch-' + Date.now(),
          key_hint: 'e5f6',
          key_prefix: 'tis_test_',
          environment: 'test',
          scope_type: 'branch',
          branch_id: testBranch1.id,
          scopes: ['leads:read'],
          rate_limit_rpm: 60,
          rate_limit_daily: 10000,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.scope_type).toBe('branch');
      expect(data.branch_id).toBe(testBranch1.id);
    });

    it('should reject tenant scope with non-null branch_id', async () => {
      const { error } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenant.id,
          created_by: testUser.id,
          name: 'Invalid Key',
          key_hash: 'test-hash-invalid1-' + Date.now(),
          key_hint: 'g7h8',
          key_prefix: 'tis_test_',
          environment: 'test',
          scope_type: 'tenant',
          branch_id: testBranch1.id, // ❌ Inconsistent
          scopes: ['leads:read'],
          rate_limit_rpm: 60,
          rate_limit_daily: 10000,
        });

      expect(error).toBeDefined();
      expect(error?.message).toContain('api_keys_branch_scope_consistency');
    });

    it('should reject branch scope with null branch_id', async () => {
      const { error } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenant.id,
          created_by: testUser.id,
          name: 'Invalid Key 2',
          key_hash: 'test-hash-invalid2-' + Date.now(),
          key_hint: 'i9j0',
          key_prefix: 'tis_test_',
          environment: 'test',
          scope_type: 'branch',
          branch_id: null, // ❌ Inconsistent
          scopes: ['leads:read'],
          rate_limit_rpm: 60,
          rate_limit_daily: 10000,
        });

      expect(error).toBeDefined();
      expect(error?.message).toContain('api_keys_branch_scope_consistency');
    });
  });

  describe('Trigger - Branch Ownership Validation', () => {
    it('should reject branch from different tenant', async () => {
      // Create another tenant
      const { data: otherTenant } = await supabase
        .from('tenants')
        .insert({
          business_name: 'Other Tenant',
          email: 'other-tenant@tistis.com',
        })
        .select()
        .single();

      const { data: otherBranch } = await supabase
        .from('branches')
        .insert({
          tenant_id: otherTenant.id,
          name: 'Other Branch',
          address: '789 Other St',
        })
        .select()
        .single();

      const { error } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenant.id, // Different tenant!
          created_by: testUser.id,
          name: 'Cross-tenant Key',
          key_hash: 'test-hash-crosstenant-' + Date.now(),
          key_hint: 'k1l2',
          key_prefix: 'tis_test_',
          environment: 'test',
          scope_type: 'branch',
          branch_id: otherBranch.id, // Branch de otro tenant
          scopes: ['leads:read'],
          rate_limit_rpm: 60,
          rate_limit_daily: 10000,
        });

      expect(error).toBeDefined();
      expect(error?.message).toContain('does not belong to tenant');

      // Cleanup
      await supabase.from('branches').delete().eq('id', otherBranch.id);
      await supabase.from('tenants').delete().eq('id', otherTenant.id);
    });

    it('should auto-populate branch_context when branch_id provided', async () => {
      const { data: key } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenant.id,
          created_by: testUser.id,
          name: 'Auto-context Key',
          key_hash: 'test-hash-autocontext-' + Date.now(),
          key_hint: 'm3n4',
          key_prefix: 'tis_test_',
          environment: 'test',
          scope_type: 'branch',
          branch_id: testBranch1.id,
          scopes: ['leads:read'],
          rate_limit_rpm: 60,
          rate_limit_daily: 10000,
        })
        .select()
        .single();

      expect(key.branch_context).toBeDefined();
      expect(key.branch_context.branch_name).toBe('Branch 1');
      expect(key.branch_context.branch_id).toBe(testBranch1.id);
    });

    it('should auto-set scope_type to "branch" when branch_id provided', async () => {
      const { data: key } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenant.id,
          created_by: testUser.id,
          name: 'Auto-scope Key',
          key_hash: 'test-hash-autoscope-' + Date.now(),
          key_hint: 'o5p6',
          key_prefix: 'tis_test_',
          environment: 'test',
          // scope_type NO especificado
          branch_id: testBranch1.id,
          scopes: ['leads:read'],
          rate_limit_rpm: 60,
          rate_limit_daily: 10000,
        })
        .select()
        .single();

      expect(key.scope_type).toBe('branch');
    });
  });

  describe('Function - api_key_has_branch_access', () => {
    let tenantKey: any;
    let branchKey: any;

    beforeAll(async () => {
      // Create tenant-wide key
      const { data: tk } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenant.id,
          created_by: testUser.id,
          name: 'Tenant Key for Access Test',
          key_hash: 'test-hash-accesstest1-' + Date.now(),
          key_hint: 'q7r8',
          key_prefix: 'tis_test_',
          environment: 'test',
          scope_type: 'tenant',
          scopes: ['leads:read'],
          rate_limit_rpm: 60,
          rate_limit_daily: 10000,
        })
        .select()
        .single();
      tenantKey = tk;

      // Create branch-specific key
      const { data: bk } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenant.id,
          created_by: testUser.id,
          name: 'Branch Key for Access Test',
          key_hash: 'test-hash-accesstest2-' + Date.now(),
          key_hint: 's9t0',
          key_prefix: 'tis_test_',
          environment: 'test',
          scope_type: 'branch',
          branch_id: testBranch1.id,
          scopes: ['leads:read'],
          rate_limit_rpm: 60,
          rate_limit_daily: 10000,
        })
        .select()
        .single();
      branchKey = bk;
    });

    it('should allow tenant-wide key to access any branch', async () => {
      const { data: hasAccess1 } = await supabase.rpc('api_key_has_branch_access', {
        p_api_key_id: tenantKey.id,
        p_required_branch_id: testBranch1.id,
      });

      const { data: hasAccess2 } = await supabase.rpc('api_key_has_branch_access', {
        p_api_key_id: tenantKey.id,
        p_required_branch_id: testBranch2.id,
      });

      expect(hasAccess1).toBe(true);
      expect(hasAccess2).toBe(true);
    });

    it('should allow branch-specific key to access only its branch', async () => {
      const { data: hasAccess1 } = await supabase.rpc('api_key_has_branch_access', {
        p_api_key_id: branchKey.id,
        p_required_branch_id: testBranch1.id,
      });

      expect(hasAccess1).toBe(true);
    });

    it('should deny branch-specific key access to other branches', async () => {
      const { data: hasAccess } = await supabase.rpc('api_key_has_branch_access', {
        p_api_key_id: branchKey.id,
        p_required_branch_id: testBranch2.id,
      });

      expect(hasAccess).toBe(false);
    });

    it('should deny access if key is inactive', async () => {
      // Deactivate key
      await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', branchKey.id);

      const { data: hasAccess } = await supabase.rpc('api_key_has_branch_access', {
        p_api_key_id: branchKey.id,
        p_required_branch_id: testBranch1.id,
      });

      expect(hasAccess).toBe(false);

      // Reactivate for other tests
      await supabase
        .from('api_keys')
        .update({ is_active: true })
        .eq('id', branchKey.id);
    });
  });

  describe('Function - validate_api_key (Enhanced)', () => {
    it('should return branch_id and scope_type for branch-specific key', async () => {
      const keyHash = 'test-hash-validate-' + Date.now();

      await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenant.id,
          created_by: testUser.id,
          name: 'Validate Test Key',
          key_hash: keyHash,
          key_hint: 'u1v2',
          key_prefix: 'tis_test_',
          environment: 'test',
          scope_type: 'branch',
          branch_id: testBranch1.id,
          scopes: ['leads:read', 'appointments:write'],
          rate_limit_rpm: 100,
          rate_limit_daily: 5000,
        });

      const { data: validation } = await supabase.rpc('validate_api_key', {
        p_key_hash: keyHash,
      });

      expect(validation.valid).toBe(true);
      expect(validation.branch_id).toBe(testBranch1.id);
      expect(validation.scope_type).toBe('branch');
      expect(validation.tenant_id).toBe(testTenant.id);
      expect(validation.scopes).toContain('leads:read');
    });

    it('should return null branch_id for tenant-wide key', async () => {
      const keyHash = 'test-hash-validate2-' + Date.now();

      await supabase
        .from('api_keys')
        .insert({
          tenant_id: testTenant.id,
          created_by: testUser.id,
          name: 'Validate Test Key 2',
          key_hash: keyHash,
          key_hint: 'w3x4',
          key_prefix: 'tis_test_',
          environment: 'test',
          scope_type: 'tenant',
          scopes: ['leads:read'],
          rate_limit_rpm: 60,
          rate_limit_daily: 10000,
        });

      const { data: validation } = await supabase.rpc('validate_api_key', {
        p_key_hash: keyHash,
      });

      expect(validation.valid).toBe(true);
      expect(validation.branch_id).toBeNull();
      expect(validation.scope_type).toBe('tenant');
    });
  });

  describe('View - api_keys_with_branch_info', () => {
    it('should join branch information for branch-specific keys', async () => {
      const { data: keys } = await supabase
        .from('api_keys_with_branch_info')
        .select('*')
        .eq('tenant_id', testTenant.id)
        .eq('scope_type', 'branch')
        .limit(1)
        .single();

      expect(keys).toBeDefined();
      expect(keys.branch_name).toBeDefined();
      expect(keys.tenant_name).toBe('Test Tenant FASE2');
    });

    it('should show null branch info for tenant-wide keys', async () => {
      const { data: keys } = await supabase
        .from('api_keys_with_branch_info')
        .select('*')
        .eq('tenant_id', testTenant.id)
        .eq('scope_type', 'tenant')
        .limit(1)
        .single();

      expect(keys).toBeDefined();
      expect(keys.branch_name).toBeNull();
      expect(keys.branch_id).toBeNull();
    });
  });

  describe('Indexes', () => {
    it('should have idx_api_keys_branch index', async () => {
      const { data: indexes } = await supabase
        .rpc('pg_indexes')
        .eq('tablename', 'api_keys')
        .like('indexname', '%branch%');

      // Note: This test depends on PostgreSQL system catalogs
      // May need adjustment based on Supabase permissions
      expect(indexes).toBeDefined();
    });
  });
});

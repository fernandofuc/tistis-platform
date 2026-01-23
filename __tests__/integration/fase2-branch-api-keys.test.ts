// =====================================================
// TIS TIS PLATFORM - FASE 2 Integration Tests
// End-to-end tests for branch-specific API Keys
//
// NOTE: These are INTEGRATION tests that require a real Supabase connection.
// They are skipped when NEXT_PUBLIC_SUPABASE_URL is not available.
// =====================================================

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateAPIKey } from '@/src/features/api-settings/utils/keyGenerator';

// ======================
// SETUP
// ======================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Skip tests if Supabase is not configured (CI/local without .env)
const shouldRunIntegrationTests = Boolean(supabaseUrl && supabaseServiceKey);
const apiBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

let supabase: SupabaseClient;
let testTenantId: string;
let testBranch1Id: string;
let testBranch2Id: string;
let tenantWideKey: string;
let branch1Key: string;
let branch2Key: string;

// ======================
// TEST SUITE
// ======================

describe.skipIf(!shouldRunIntegrationTests)('FASE 2: Branch-Specific API Keys', () => {
  beforeAll(async () => {
    // Initialize Supabase client with service role
    // We can assert these exist because shouldRunIntegrationTests checks them
    supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create test tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: `Test Tenant FASE2 ${Date.now()}`,
        slug: `test-fase2-${Date.now()}`,
        plan: 'professional',
      })
      .select()
      .single();

    if (tenantError) throw new Error(`Failed to create test tenant: ${tenantError.message}`);
    testTenantId = tenant.id;

    // Create two test branches
    const { data: branch1, error: branch1Error } = await supabase
      .from('branches')
      .insert({
        tenant_id: testTenantId,
        name: 'Branch 1 - North',
        is_headquarters: true,
        is_active: true,
      })
      .select()
      .single();

    if (branch1Error) throw new Error(`Failed to create branch 1: ${branch1Error.message}`);
    testBranch1Id = branch1.id;

    const { data: branch2, error: branch2Error } = await supabase
      .from('branches')
      .insert({
        tenant_id: testTenantId,
        name: 'Branch 2 - South',
        is_headquarters: false,
        is_active: true,
      })
      .select()
      .single();

    if (branch2Error) throw new Error(`Failed to create branch 2: ${branch2Error.message}`);
    testBranch2Id = branch2.id;

    // Create API Keys:
    // 1. Tenant-wide key (scope_type = 'tenant', branch_id = null)
    const tenantKeyGen = generateAPIKey('test');
    const { error: tenantKeyError } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: testTenantId,
        name: 'Tenant-Wide Key',
        key_hash: tenantKeyGen.hash,
        key_hint: tenantKeyGen.hint,
        key_prefix: tenantKeyGen.prefix,
        environment: 'test',
        scope_type: 'tenant',
        branch_id: null,
        scopes: ['leads:read', 'leads:write'],
        rate_limit_rpm: 100,
        rate_limit_daily: 10000,
        is_active: true,
        usage_count: 0,
      });

    if (tenantKeyError) throw new Error(`Failed to create tenant-wide key: ${tenantKeyError.message}`);
    tenantWideKey = tenantKeyGen.key;

    // 2. Branch 1 specific key
    const branch1KeyGen = generateAPIKey('test');
    const { error: branch1KeyError } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: testTenantId,
        name: 'Branch 1 Key',
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
        usage_count: 0,
      });

    if (branch1KeyError) throw new Error(`Failed to create branch 1 key: ${branch1KeyError.message}`);
    branch1Key = branch1KeyGen.key;

    // 3. Branch 2 specific key
    const branch2KeyGen = generateAPIKey('test');
    const { error: branch2KeyError } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: testTenantId,
        name: 'Branch 2 Key',
        key_hash: branch2KeyGen.hash,
        key_hint: branch2KeyGen.hint,
        key_prefix: branch2KeyGen.prefix,
        environment: 'test',
        scope_type: 'branch',
        branch_id: testBranch2Id,
        scopes: ['leads:read', 'leads:write'],
        rate_limit_rpm: 100,
        rate_limit_daily: 10000,
        is_active: true,
        usage_count: 0,
      });

    if (branch2KeyError) throw new Error(`Failed to create branch 2 key: ${branch2KeyError.message}`);
    branch2Key = branch2KeyGen.key;

    // Create test leads in both branches
    await supabase.from('leads').insert([
      {
        tenant_id: testTenantId,
        branch_id: testBranch1Id,
        phone: '1234567890',
        name: 'Lead from Branch 1',
        status: 'new',
      },
      {
        tenant_id: testTenantId,
        branch_id: testBranch2Id,
        phone: '0987654321',
        name: 'Lead from Branch 2',
        status: 'new',
      },
      {
        tenant_id: testTenantId,
        branch_id: testBranch1Id,
        phone: '1111111111',
        name: 'Another Lead from Branch 1',
        status: 'new',
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup: Delete test tenant (cascades to branches, leads, api_keys)
    if (testTenantId) {
      await supabase.from('tenants').delete().eq('id', testTenantId);
    }
  });

  // ======================
  // TC-F2-001: Tenant-wide key returns all leads
  // ======================
  test('TC-F2-001: Tenant-wide API Key should return all leads from all branches', async () => {
    const response = await fetch(`${apiBaseUrl}/api/v1/leads`, {
      headers: {
        'Authorization': `Bearer ${tenantWideKey}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data).toBeInstanceOf(Array);
    expect(data.total).toBe(3); // Should see all 3 leads

    const branch1Leads = data.data.filter((l: any) => l.branch_id === testBranch1Id);
    const branch2Leads = data.data.filter((l: any) => l.branch_id === testBranch2Id);
    expect(branch1Leads.length).toBe(2);
    expect(branch2Leads.length).toBe(1);
  });

  // ======================
  // TC-F2-002: Branch-specific key returns only its branch
  // ======================
  test('TC-F2-002: Branch 1 API Key should only return leads from Branch 1', async () => {
    const response = await fetch(`${apiBaseUrl}/api/v1/leads`, {
      headers: {
        'Authorization': `Bearer ${branch1Key}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data).toBeInstanceOf(Array);
    expect(data.total).toBe(2); // Should see only 2 leads from Branch 1

    // All leads should belong to Branch 1
    data.data.forEach((lead: any) => {
      expect(lead.branch_id).toBe(testBranch1Id);
    });
  });

  test('TC-F2-003: Branch 2 API Key should only return leads from Branch 2', async () => {
    const response = await fetch(`${apiBaseUrl}/api/v1/leads`, {
      headers: {
        'Authorization': `Bearer ${branch2Key}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data).toBeInstanceOf(Array);
    expect(data.total).toBe(1); // Should see only 1 lead from Branch 2

    // All leads should belong to Branch 2
    data.data.forEach((lead: any) => {
      expect(lead.branch_id).toBe(testBranch2Id);
    });
  });

  // ======================
  // TC-F2-004: Query param with tenant-wide key (backward compat)
  // ======================
  test('TC-F2-004: Tenant-wide key with query param should filter by that branch', async () => {
    const response = await fetch(`${apiBaseUrl}/api/v1/leads?branch_id=${testBranch2Id}`, {
      headers: {
        'Authorization': `Bearer ${tenantWideKey}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.data).toBeInstanceOf(Array);
    expect(data.total).toBe(1); // Should see only Branch 2 lead

    data.data.forEach((lead: any) => {
      expect(lead.branch_id).toBe(testBranch2Id);
    });
  });

  // ======================
  // TC-F2-005: Query param does NOT override branch-specific key (SECURITY)
  // ======================
  test('TC-F2-005: Branch 1 key with branch 2 query param should IGNORE query param and return Branch 1', async () => {
    // SECURITY: Branch-specific keys cannot be bypassed with query parameters
    // Branch 1 key ALWAYS filters to Branch 1, regardless of query param
    const response = await fetch(`${apiBaseUrl}/api/v1/leads?branch_id=${testBranch2Id}`, {
      headers: {
        'Authorization': `Bearer ${branch1Key}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();

    // ✅ CORRECTED BEHAVIOR: Query param is IGNORED for branch-specific keys
    // Branch 1 key can ONLY access Branch 1 data (security enforcement)
    expect(data.total).toBe(2); // Should see only Branch 1 leads
    data.data.forEach((lead: any) => {
      expect(lead.branch_id).toBe(testBranch1Id); // All leads should be from Branch 1
    });
  });

  // ======================
  // TC-F2-006: POST with branch-specific key creates lead in correct branch
  // ======================
  test('TC-F2-006: Branch 1 key should create lead with branch_id set to Branch 1', async () => {
    const response = await fetch(`${apiBaseUrl}/api/v1/leads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${branch1Key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: '5555555555',
        name: 'New Lead via Branch 1 Key',
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.data.branch_id).toBe(testBranch1Id);
    expect(data.data.name).toBe('New Lead via Branch 1 Key');
  });

  // ======================
  // TC-F2-007: Tenant-wide key without query param sees all
  // ======================
  test('TC-F2-007: Tenant-wide key without any query param returns all leads', async () => {
    const response = await fetch(`${apiBaseUrl}/api/v1/leads`, {
      headers: {
        'Authorization': `Bearer ${tenantWideKey}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    // Should include the new lead created in TC-F2-006
    expect(data.total).toBeGreaterThanOrEqual(4);
  });

  // ======================
  // TC-F2-008: Branch key validation in database
  // ======================
  test('TC-F2-008: Database should enforce branch scope consistency', async () => {
    // Try to create an API key with scope_type='tenant' but branch_id set
    const invalidKeyGen = generateAPIKey('test');
    const { error } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: testTenantId,
        name: 'Invalid Key',
        key_hash: invalidKeyGen.hash,
        key_hint: invalidKeyGen.hint,
        key_prefix: invalidKeyGen.prefix,
        environment: 'test',
        scope_type: 'tenant',
        branch_id: testBranch1Id, // ❌ Inconsistent
        scopes: ['leads:read'],
        rate_limit_rpm: 100,
        rate_limit_daily: 10000,
        is_active: true,
        usage_count: 0,
      });

    expect(error).toBeDefined();
    expect(error?.message).toContain('api_keys_branch_scope_consistency');
  });

  // ======================
  // TC-F2-009: Branch key with branch_context populated
  // ======================
  test('TC-F2-009: Branch-specific keys should have branch_context populated', async () => {
    const { data: keyData, error } = await supabase
      .from('api_keys')
      .select('branch_context, branch_id, scope_type')
      .eq('tenant_id', testTenantId)
      .eq('scope_type', 'branch')
      .single();

    expect(error).toBeNull();
    expect(keyData).toBeDefined();
    expect(keyData?.scope_type).toBe('branch');
    expect(keyData?.branch_id).toBeTruthy();
    expect(keyData?.branch_context).toBeDefined();
    expect(keyData?.branch_context).toHaveProperty('branch_id');
    expect(keyData?.branch_context).toHaveProperty('branch_name');
  });

  // ======================
  // TC-F2-010: api_key_has_branch_access function
  // ======================
  test('TC-F2-010: RPC function should correctly validate branch access', async () => {
    // Get the key IDs
    const { data: branch1KeyData } = await supabase
      .from('api_keys')
      .select('id')
      .eq('tenant_id', testTenantId)
      .eq('name', 'Branch 1 Key')
      .single();

    const { data: tenantKeyData } = await supabase
      .from('api_keys')
      .select('id')
      .eq('tenant_id', testTenantId)
      .eq('name', 'Tenant-Wide Key')
      .single();

    // Test 1: Branch 1 key should have access to Branch 1
    const { data: access1 } = await supabase.rpc('api_key_has_branch_access', {
      p_api_key_id: branch1KeyData!.id,
      p_required_branch_id: testBranch1Id,
    });
    expect(access1).toBe(true);

    // Test 2: Branch 1 key should NOT have access to Branch 2
    const { data: access2 } = await supabase.rpc('api_key_has_branch_access', {
      p_api_key_id: branch1KeyData!.id,
      p_required_branch_id: testBranch2Id,
    });
    expect(access2).toBe(false);

    // Test 3: Tenant-wide key should have access to any branch
    const { data: access3 } = await supabase.rpc('api_key_has_branch_access', {
      p_api_key_id: tenantKeyData!.id,
      p_required_branch_id: testBranch1Id,
    });
    expect(access3).toBe(true);

    const { data: access4 } = await supabase.rpc('api_key_has_branch_access', {
      p_api_key_id: tenantKeyData!.id,
      p_required_branch_id: testBranch2Id,
    });
    expect(access4).toBe(true);
  });
});

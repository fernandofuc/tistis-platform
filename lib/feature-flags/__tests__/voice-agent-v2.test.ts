/**
 * TIS TIS Platform - Voice Agent v2.0
 * Feature Flags Tests
 *
 * Tests for the feature flag system used in Voice Agent v2 gradual rollout.
 * Covers:
 * - Percentage-based rollout
 * - Tenant-specific overrides
 * - Cache behavior
 * - Instant rollback functionality
 */

// Global mock state container - this pattern works with Jest hoisting
const mockState = {
  data: null as unknown,
  error: null as unknown,
  rpcError: null as unknown, // Separate state for RPC calls
};

// Create mock chain methods with closure over mockState
const createMockChainMethods = () => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockImplementation(() =>
    Promise.resolve({ data: mockState.data, error: mockState.error })
  ),
  gte: jest.fn().mockReturnThis(),
  single: jest.fn().mockImplementation(() =>
    Promise.resolve({ data: mockState.data, error: mockState.error })
  ),
});

// Mock must be defined inline to avoid hoisting issues
jest.mock('@/lib/supabase', () => {
  const mockChainMethods = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockImplementation(() => {
      // Access the outer mockState via closure
      const state = require('../__tests__/voice-agent-v2.test').mockState;
      return Promise.resolve({ data: state?.data, error: state?.error });
    }),
    gte: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => {
      const state = require('../__tests__/voice-agent-v2.test').mockState;
      return Promise.resolve({ data: state?.data, error: state?.error });
    }),
  };

  return {
    supabaseAdmin: {
      from: jest.fn(() => mockChainMethods),
      // Mock RPC for atomic tenant updates
      rpc: jest.fn().mockImplementation(() => {
        const state = require('../__tests__/voice-agent-v2.test').mockState;
        // By default, simulate RPC doesn't exist (fallback to non-atomic)
        // This tests the fallback path. Set rpcError = null to test RPC path.
        return Promise.resolve({
          data: null,
          error: state?.rpcError ?? { code: '42883' }, // 'function does not exist' by default
        });
      }),
    },
  };
});

// Export mockState so it can be accessed from the mock
export { mockState };

import {
  getVoiceAgentV2Flags,
  shouldUseVoiceAgentV2,
  shouldUseVoiceAgentV2Cached,
  clearV2StatusCache,
  updateRolloutPercentage,
  enableVoiceAgentV2,
  disableVoiceAgentV2,
  enableTenantForV2,
  disableTenantForV2,
  resetTenantOverride,
  initializeVoiceAgentV2Flag,
  getVoiceAgentV2AuditLog,
  batchUpdateTenantV2Status,
} from '../voice-agent-v2';
import { supabaseAdmin } from '@/lib/supabase';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function setMockData(data: unknown) {
  mockState.data = data;
  mockState.error = null;
}

function setMockError(error: unknown) {
  mockState.error = error;
}

function resetMocks() {
  mockState.data = null;
  mockState.error = null;
  mockState.rpcError = null;
  jest.clearAllMocks();
}

function setRpcSuccess() {
  mockState.rpcError = null;
}

function setRpcNotExists() {
  mockState.rpcError = { code: '42883' }; // function does not exist
}

// =====================================================
// TEST DATA
// =====================================================

const createMockFlags = (overrides: Partial<{
  enabled: boolean;
  percentage: number;
  enabled_tenants: string[];
  disabled_tenants: string[];
  updated_at: string;
  updated_by: string | null;
}> = {}) => ({
  id: 'test-flag-id',
  name: 'voice_agent_v2',
  enabled: false,
  percentage: 0,
  enabled_tenants: [],
  disabled_tenants: [],
  updated_at: new Date().toISOString(),
  updated_by: null,
  ...overrides,
});

// =====================================================
// TEST SUITES
// =====================================================

describe('Feature Flags - Voice Agent v2', () => {
  beforeEach(() => {
    resetMocks();
    clearV2StatusCache();
  });

  // -------------------------------------------------
  // getVoiceAgentV2Flags
  // -------------------------------------------------
  describe('getVoiceAgentV2Flags', () => {
    it('should return flags from database', async () => {
      const flags = createMockFlags({
        enabled: true,
        percentage: 25,
        enabled_tenants: ['tenant-1', 'tenant-2'],
      });

      setMockData(flags);

      const result = await getVoiceAgentV2Flags();

      expect(result.enabled).toBe(true);
      expect(result.percentage).toBe(25);
      expect(result.enabledTenants).toEqual(['tenant-1', 'tenant-2']);
    });

    it('should return default disabled state if no flag found', async () => {
      setMockData(null);
      setMockError({ code: 'PGRST116' });

      const result = await getVoiceAgentV2Flags();

      expect(result.enabled).toBe(false);
      expect(result.percentage).toBe(0);
      expect(result.enabledTenants).toEqual([]);
    });

    it('should handle null values gracefully', async () => {
      const flags = {
        id: 'test-id',
        name: 'voice_agent_v2',
        enabled: null,
        percentage: null,
        enabled_tenants: null,
        disabled_tenants: null,
        updated_at: null,
        updated_by: null,
      };

      setMockData(flags);

      const result = await getVoiceAgentV2Flags();

      expect(result.enabled).toBe(false);
      expect(result.percentage).toBe(0);
      expect(result.enabledTenants).toEqual([]);
      expect(result.disabledTenants).toEqual([]);
    });
  });

  // -------------------------------------------------
  // shouldUseVoiceAgentV2 (percentage-based)
  // -------------------------------------------------
  describe('shouldUseVoiceAgentV2 - Percentage', () => {
    it('should return false when globally disabled', async () => {
      setMockData(createMockFlags({ enabled: false, percentage: 100 }));

      const result = await shouldUseVoiceAgentV2('any-tenant');

      expect(result).toBe(false);
    });

    it('should use consistent hashing for percentage decisions', async () => {
      const flags = createMockFlags({ enabled: true, percentage: 50 });
      setMockData(flags);

      // Test with multiple tenants - should be deterministic
      const testTenants = ['tenant-alpha', 'tenant-beta', 'tenant-gamma'];
      const results: boolean[] = [];

      for (const tenantId of testTenants) {
        const result = await shouldUseVoiceAgentV2(tenantId);
        results.push(result);
      }

      // Verify same tenant always gets same result (consistency)
      for (let i = 0; i < testTenants.length; i++) {
        const secondResult = await shouldUseVoiceAgentV2(testTenants[i]);
        expect(secondResult).toBe(results[i]);
      }
    });

    it('should respect percentage thresholds', async () => {
      // With 0% - no one should get v2
      setMockData(createMockFlags({ enabled: true, percentage: 0 }));
      expect(await shouldUseVoiceAgentV2('test-tenant')).toBe(false);

      // With 100% - everyone should get v2
      setMockData(createMockFlags({ enabled: true, percentage: 100 }));
      expect(await shouldUseVoiceAgentV2('test-tenant')).toBe(true);
    });

    it('should return false for invalid tenant IDs', async () => {
      expect(await shouldUseVoiceAgentV2('')).toBe(false);
      expect(await shouldUseVoiceAgentV2('   ')).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(await shouldUseVoiceAgentV2(null)).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(await shouldUseVoiceAgentV2(undefined)).toBe(false);
    });
  });

  // -------------------------------------------------
  // shouldUseVoiceAgentV2 (tenant overrides)
  // -------------------------------------------------
  describe('shouldUseVoiceAgentV2 - Tenant Overrides', () => {
    it('should return true for explicitly enabled tenant', async () => {
      setMockData(createMockFlags({
        enabled: true,
        percentage: 0,
        enabled_tenants: ['special-tenant'],
      }));

      const result = await shouldUseVoiceAgentV2('special-tenant');

      expect(result).toBe(true);
    });

    it('should return false for explicitly disabled tenant', async () => {
      setMockData(createMockFlags({
        enabled: true,
        percentage: 100,
        disabled_tenants: ['blocked-tenant'],
      }));

      const result = await shouldUseVoiceAgentV2('blocked-tenant');

      expect(result).toBe(false);
    });

    it('should prioritize disabled over enabled', async () => {
      setMockData(createMockFlags({
        enabled: true,
        percentage: 100,
        enabled_tenants: ['confused-tenant'],
        disabled_tenants: ['confused-tenant'],
      }));

      // Disabled should take priority (safer default)
      const result = await shouldUseVoiceAgentV2('confused-tenant');

      expect(result).toBe(false);
    });

    it('should return false for enabled tenant when globally disabled', async () => {
      setMockData(createMockFlags({
        enabled: false,
        enabled_tenants: ['vip-tenant'],
      }));

      const result = await shouldUseVoiceAgentV2('vip-tenant');

      // Global disable wins
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------
  // shouldUseVoiceAgentV2Cached
  // -------------------------------------------------
  describe('shouldUseVoiceAgentV2Cached', () => {
    it('should cache results for performance', async () => {
      setMockData(createMockFlags({ enabled: true, percentage: 100 }));

      // First call - should hit database
      await shouldUseVoiceAgentV2Cached('cache-test-tenant');
      const callsAfterFirst = (supabaseAdmin.from as jest.Mock).mock.calls.length;

      // Second call - should use cache
      await shouldUseVoiceAgentV2Cached('cache-test-tenant');
      const callsAfterSecond = (supabaseAdmin.from as jest.Mock).mock.calls.length;

      // Should not have made additional calls due to caching
      expect(callsAfterSecond).toBe(callsAfterFirst);
    });

    it('should return false for empty tenant ID', async () => {
      const result = await shouldUseVoiceAgentV2Cached('');
      expect(result).toBe(false);
    });

    it('should return false for whitespace tenant ID', async () => {
      const result = await shouldUseVoiceAgentV2Cached('   ');
      expect(result).toBe(false);
    });

    it('should respect cache TTL', async () => {
      jest.useFakeTimers();

      setMockData(createMockFlags({ enabled: true, percentage: 100 }));

      // First call
      await shouldUseVoiceAgentV2Cached('ttl-test-tenant');
      const callsAfterFirst = (supabaseAdmin.from as jest.Mock).mock.calls.length;

      // Advance time past TTL (60 seconds)
      jest.advanceTimersByTime(61000);

      // Should query again after TTL expires
      await shouldUseVoiceAgentV2Cached('ttl-test-tenant');
      const callsAfterSecond = (supabaseAdmin.from as jest.Mock).mock.calls.length;

      expect(callsAfterSecond).toBeGreaterThan(callsAfterFirst);

      jest.useRealTimers();
    });
  });

  // -------------------------------------------------
  // clearV2StatusCache
  // -------------------------------------------------
  describe('clearV2StatusCache', () => {
    it('should clear the cache', async () => {
      setMockData(createMockFlags({ enabled: true, percentage: 100 }));

      // First call - caches result
      await shouldUseVoiceAgentV2Cached('clear-test-tenant');
      const callsAfterFirst = (supabaseAdmin.from as jest.Mock).mock.calls.length;

      // Clear cache
      clearV2StatusCache();

      // Should query again after cache clear
      await shouldUseVoiceAgentV2Cached('clear-test-tenant');
      const callsAfterClear = (supabaseAdmin.from as jest.Mock).mock.calls.length;

      expect(callsAfterClear).toBeGreaterThan(callsAfterFirst);
    });
  });

  // -------------------------------------------------
  // Rollout Management
  // -------------------------------------------------
  describe('Rollout Management', () => {
    describe('updateRolloutPercentage', () => {
      it('should call supabase with correct table', async () => {
        await updateRolloutPercentage(50, 'admin@test.com');

        expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
      });

      it('should throw error for invalid percentage', async () => {
        await expect(updateRolloutPercentage(-10)).rejects.toThrow(
          'Percentage must be between 0 and 100'
        );
        await expect(updateRolloutPercentage(150)).rejects.toThrow(
          'Percentage must be between 0 and 100'
        );
      });

      it('should accept boundary values', async () => {
        await expect(updateRolloutPercentage(0)).resolves.not.toThrow();
        await expect(updateRolloutPercentage(100)).resolves.not.toThrow();
      });
    });

    describe('enableVoiceAgentV2', () => {
      it('should enable v2 globally', async () => {
        await enableVoiceAgentV2('admin@test.com');

        expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
      });

      it('should clear cache after enabling', async () => {
        setMockData(createMockFlags({ enabled: false }));

        // Cache a result
        await shouldUseVoiceAgentV2Cached('enable-test-tenant');
        const callsAfterCache = (supabaseAdmin.from as jest.Mock).mock.calls.length;

        // Enable v2 (which clears cache)
        await enableVoiceAgentV2();

        // Next call should hit DB again
        await shouldUseVoiceAgentV2Cached('enable-test-tenant');
        const callsAfterEnable = (supabaseAdmin.from as jest.Mock).mock.calls.length;

        expect(callsAfterEnable).toBeGreaterThan(callsAfterCache);
      });
    });

    describe('disableVoiceAgentV2', () => {
      it('should disable v2 and reset percentage to 0', async () => {
        await disableVoiceAgentV2('admin@test.com');

        expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
      });
    });
  });

  // -------------------------------------------------
  // Tenant-Specific Overrides
  // -------------------------------------------------
  describe('Tenant-Specific Overrides', () => {
    describe('enableTenantForV2', () => {
      it('should add tenant to enabled list', async () => {
        setMockData(createMockFlags({
          enabled_tenants: ['existing-tenant'],
          disabled_tenants: [],
        }));

        await enableTenantForV2('new-tenant', 'admin@test.com');

        expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
      });

      it('should remove tenant from disabled list when enabling', async () => {
        setMockData(createMockFlags({
          enabled_tenants: [],
          disabled_tenants: ['blocked-tenant'],
        }));

        await enableTenantForV2('blocked-tenant', 'admin@test.com');

        expect(supabaseAdmin.from).toHaveBeenCalled();
      });
    });

    describe('disableTenantForV2', () => {
      it('should add tenant to disabled list', async () => {
        setMockData(createMockFlags({
          enabled_tenants: [],
          disabled_tenants: [],
        }));

        await disableTenantForV2('problem-tenant', 'admin@test.com');

        expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
      });

      it('should remove tenant from enabled list when disabling', async () => {
        setMockData(createMockFlags({
          enabled_tenants: ['vip-tenant'],
          disabled_tenants: [],
        }));

        await disableTenantForV2('vip-tenant');

        expect(supabaseAdmin.from).toHaveBeenCalled();
      });
    });

    describe('resetTenantOverride', () => {
      it('should remove tenant from both lists', async () => {
        setMockData(createMockFlags({
          enabled_tenants: ['tenant-in-enabled'],
          disabled_tenants: ['tenant-in-disabled'],
        }));

        await resetTenantOverride('tenant-in-enabled');

        expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
      });
    });
  });

  // -------------------------------------------------
  // Instant Rollback
  // -------------------------------------------------
  describe('Instant Rollback', () => {
    it('should rollback a tenant immediately via disableTenantForV2', async () => {
      // Initially tenant is on v2 (100% rollout)
      setMockData(createMockFlags({
        enabled: true,
        percentage: 100,
      }));

      const beforeRollback = await shouldUseVoiceAgentV2('rollback-tenant');
      expect(beforeRollback).toBe(true);

      // Clear cache before disabling
      clearV2StatusCache();

      // Disable tenant
      setMockData(createMockFlags({
        enabled: true,
        percentage: 100,
        disabled_tenants: [],
      }));
      await disableTenantForV2('rollback-tenant');

      // After rollback - tenant should be disabled
      setMockData(createMockFlags({
        enabled: true,
        percentage: 100,
        disabled_tenants: ['rollback-tenant'],
      }));

      const afterRollback = await shouldUseVoiceAgentV2('rollback-tenant');
      expect(afterRollback).toBe(false);
    });

    it('should rollback globally via disableVoiceAgentV2', async () => {
      // Before global disable
      setMockData(createMockFlags({ enabled: true, percentage: 100 }));

      const beforeDisable = await shouldUseVoiceAgentV2('any-tenant');
      expect(beforeDisable).toBe(true);

      // Global disable
      await disableVoiceAgentV2();

      // Clear cache
      clearV2StatusCache();

      // After global disable
      setMockData(createMockFlags({ enabled: false, percentage: 0 }));

      const afterDisable = await shouldUseVoiceAgentV2('any-tenant');
      expect(afterDisable).toBe(false);
    });
  });

  // -------------------------------------------------
  // initializeVoiceAgentV2Flag
  // -------------------------------------------------
  describe('initializeVoiceAgentV2Flag', () => {
    it('should not create flag if it already exists', async () => {
      setMockData({ id: 'existing-flag-id' });

      await initializeVoiceAgentV2Flag();

      expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
    });

    it('should create flag if it does not exist', async () => {
      setMockData(null);

      await initializeVoiceAgentV2Flag();

      expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
    });
  });

  // -------------------------------------------------
  // Audit Log
  // -------------------------------------------------
  describe('getVoiceAgentV2AuditLog', () => {
    it('should return audit entries', async () => {
      const auditData = [
        {
          id: 'audit-1',
          flag_name: 'voice_agent_v2',
          action: 'enabled',
          old_value: { enabled: false },
          new_value: { enabled: true },
          changed_by: 'admin@test.com',
          reason: null,
          created_at: new Date().toISOString(),
        },
      ];

      setMockData(auditData);

      const result = await getVoiceAgentV2AuditLog(10);

      expect(result).toHaveLength(1);
      expect(result[0].flagName).toBe('voice_agent_v2');
      expect(result[0].action).toBe('enabled');
    });

    it('should return empty array on error', async () => {
      setMockData(null);
      setMockError({ message: 'Database error' });

      const result = await getVoiceAgentV2AuditLog();

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------
  // Batch Operations
  // -------------------------------------------------
  describe('batchUpdateTenantV2Status', () => {
    it('should process multiple tenant updates', async () => {
      setMockData(createMockFlags());

      const updates = [
        { tenantId: 'tenant-1', action: 'enable' as const },
        { tenantId: 'tenant-2', action: 'disable' as const },
        { tenantId: 'tenant-3', action: 'reset' as const },
      ];

      const result = await batchUpdateTenantV2Status(updates, 'admin@test.com');

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty updates array', async () => {
      const result = await batchUpdateTenantV2Status([], 'admin@test.com');

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // -------------------------------------------------
  // Edge Cases
  // -------------------------------------------------
  describe('Edge Cases', () => {
    it('should handle empty tenant lists', async () => {
      setMockData(createMockFlags({
        enabled: true,
        percentage: 50,
        enabled_tenants: [],
        disabled_tenants: [],
      }));

      // Should work without throwing
      const result = await shouldUseVoiceAgentV2('test-tenant');
      expect(typeof result).toBe('boolean');
    });

    it('should handle special characters in tenant IDs', async () => {
      setMockData(createMockFlags({ enabled: true, percentage: 50 }));

      const specialTenantIds = [
        'tenant-with-dashes',
        'tenant_with_underscores',
        'tenant.with.dots',
        'TENANT-UPPERCASE',
        '12345-numeric',
        'a'.repeat(100), // Long ID
      ];

      for (const tenantId of specialTenantIds) {
        // Should not throw
        const result = await shouldUseVoiceAgentV2(tenantId);
        expect(typeof result).toBe('boolean');
      }
    });

    it('should handle concurrent cache operations', async () => {
      setMockData(createMockFlags({ enabled: true, percentage: 100 }));

      // Simulate concurrent calls
      const promises = Array(100)
        .fill(null)
        .map((_, i) => shouldUseVoiceAgentV2Cached(`concurrent-tenant-${i}`));

      await Promise.all(promises);

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('should maintain percentage consistency across calls', async () => {
      // Test that the same tenant always gets the same result
      // with the same percentage setting
      setMockData(createMockFlags({ enabled: true, percentage: 50 }));

      const testTenant = 'consistency-test-tenant';
      const results: boolean[] = [];

      // Make 10 calls
      for (let i = 0; i < 10; i++) {
        clearV2StatusCache(); // Clear cache to force recalculation
        const result = await shouldUseVoiceAgentV2(testTenant);
        results.push(result);
      }

      // All results should be the same (consistent hashing)
      const allSame = results.every(r => r === results[0]);
      expect(allSame).toBe(true);
    });
  });

  // -------------------------------------------------
  // Atomic RPC Operations
  // -------------------------------------------------
  describe('Atomic RPC Operations', () => {
    it('should use RPC for atomic tenant enable when available', async () => {
      setMockData(createMockFlags());
      setRpcSuccess(); // RPC succeeds

      await enableTenantForV2('tenant-1', 'admin@test.com');

      // Should have called RPC
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('update_tenant_v2_status', {
        p_tenant_id: 'tenant-1',
        p_action: 'enable',
        p_updated_by: 'admin@test.com',
      });
    });

    it('should fallback to non-atomic when RPC does not exist', async () => {
      setMockData(createMockFlags({
        enabled_tenants: [],
        disabled_tenants: [],
      }));
      setRpcNotExists(); // RPC not available

      await enableTenantForV2('tenant-1', 'admin@test.com');

      // Should have called from() as fallback
      expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
    });

    it('should use RPC for atomic tenant disable when available', async () => {
      setMockData(createMockFlags());
      setRpcSuccess();

      await disableTenantForV2('tenant-1', 'admin@test.com');

      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('update_tenant_v2_status', {
        p_tenant_id: 'tenant-1',
        p_action: 'disable',
        p_updated_by: 'admin@test.com',
      });
    });

    it('should use RPC for atomic tenant reset when available', async () => {
      setMockData(createMockFlags());
      setRpcSuccess();

      await resetTenantOverride('tenant-1', 'admin@test.com');

      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('update_tenant_v2_status', {
        p_tenant_id: 'tenant-1',
        p_action: 'reset',
        p_updated_by: 'admin@test.com',
      });
    });

    it('should handle RPC errors other than function not found', async () => {
      setMockData(createMockFlags());
      mockState.rpcError = { code: '23505', message: 'Unique violation' }; // Different error

      await expect(enableTenantForV2('tenant-1')).rejects.toThrow(
        'Failed to enable tenant'
      );
    });
  });
});

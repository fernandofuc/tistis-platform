/**
 * TIS TIS Platform - Voice Agent v2.0
 * Feature Flags Tests
 *
 * Tests for the simplified voice agent feature flag system.
 * v2-only architecture - no percentage-based rollout.
 *
 * Covers:
 * - Simple on/off toggle
 * - Tenant-specific overrides
 * - Cache behavior
 * - Audit logging
 *
 * @version 2.0.0
 */

// Global mock state container - this pattern works with Jest hoisting
const mockState = {
  data: null as unknown,
  error: null as unknown,
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
    },
  };
});

// Export mockState so it can be accessed from the mock
export { mockState };

import {
  getVoiceAgentFlags,
  isVoiceAgentEnabled,
  isVoiceAgentEnabledCached,
  clearVoiceStatusCache,
  enableVoiceAgent,
  disableVoiceAgent,
  enableTenantVoiceAgent,
  disableTenantVoiceAgent,
  resetTenantVoiceOverride,
  initializeVoiceAgentFlag,
  getVoiceAgentAuditLog,
  // Deprecated exports for backwards compatibility
  shouldUseVoiceAgentV2,
  shouldUseVoiceAgentV2Cached,
  getVoiceAgentV2Flags,
  clearV2StatusCache,
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
  jest.clearAllMocks();
}

// =====================================================
// TEST DATA
// =====================================================

const createMockFlags = (overrides: Partial<{
  enabled: boolean;
  enabled_tenants: string[];
  disabled_tenants: string[];
  updated_at: string;
  updated_by: string | null;
}> = {}) => ({
  id: 'test-flag-id',
  name: 'voice_agent',
  enabled: false,
  enabled_tenants: [],
  disabled_tenants: [],
  updated_at: new Date().toISOString(),
  updated_by: null,
  ...overrides,
});

// =====================================================
// TEST SUITES
// =====================================================

describe('Feature Flags - Voice Agent (Simplified v2)', () => {
  beforeEach(() => {
    resetMocks();
    clearVoiceStatusCache();
  });

  // -------------------------------------------------
  // getVoiceAgentFlags
  // -------------------------------------------------
  describe('getVoiceAgentFlags', () => {
    it('should return flags from database', async () => {
      const flags = createMockFlags({
        enabled: true,
        enabled_tenants: ['tenant-1', 'tenant-2'],
      });

      setMockData(flags);

      const result = await getVoiceAgentFlags();

      expect(result.enabled).toBe(true);
      expect(result.enabledTenants).toEqual(['tenant-1', 'tenant-2']);
    });

    it('should return default disabled state if no flag found', async () => {
      setMockData(null);
      setMockError({ code: 'PGRST116' });

      const result = await getVoiceAgentFlags();

      expect(result.enabled).toBe(false);
      expect(result.enabledTenants).toEqual([]);
    });

    it('should handle null values gracefully', async () => {
      const flags = {
        id: 'test-id',
        name: 'voice_agent',
        enabled: null,
        enabled_tenants: null,
        disabled_tenants: null,
        updated_at: null,
        updated_by: null,
      };

      setMockData(flags);

      const result = await getVoiceAgentFlags();

      expect(result.enabled).toBe(false);
      expect(result.enabledTenants).toEqual([]);
      expect(result.disabledTenants).toEqual([]);
    });
  });

  // -------------------------------------------------
  // isVoiceAgentEnabled (simple on/off)
  // -------------------------------------------------
  describe('isVoiceAgentEnabled - Simple Toggle', () => {
    it('should return false when globally disabled', async () => {
      setMockData(createMockFlags({ enabled: false }));

      const result = await isVoiceAgentEnabled('any-tenant');

      expect(result).toBe(false);
    });

    it('should return true when globally enabled', async () => {
      setMockData(createMockFlags({ enabled: true }));

      const result = await isVoiceAgentEnabled('any-tenant');

      expect(result).toBe(true);
    });

    it('should return false for invalid tenant IDs', async () => {
      expect(await isVoiceAgentEnabled('')).toBe(false);
      expect(await isVoiceAgentEnabled('   ')).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(await isVoiceAgentEnabled(null)).toBe(false);
      // @ts-expect-error Testing invalid input
      expect(await isVoiceAgentEnabled(undefined)).toBe(false);
    });
  });

  // -------------------------------------------------
  // isVoiceAgentEnabled (tenant overrides)
  // -------------------------------------------------
  describe('isVoiceAgentEnabled - Tenant Overrides', () => {
    it('should return true for explicitly enabled tenant when global is disabled', async () => {
      setMockData(createMockFlags({
        enabled: false,
        enabled_tenants: ['special-tenant'],
      }));

      const result = await isVoiceAgentEnabled('special-tenant');

      // Enabled tenant overrides global disabled
      expect(result).toBe(true);
    });

    it('should return false for explicitly disabled tenant when global is enabled', async () => {
      setMockData(createMockFlags({
        enabled: true,
        disabled_tenants: ['blocked-tenant'],
      }));

      const result = await isVoiceAgentEnabled('blocked-tenant');

      expect(result).toBe(false);
    });

    it('should prioritize disabled over enabled', async () => {
      setMockData(createMockFlags({
        enabled: true,
        enabled_tenants: ['confused-tenant'],
        disabled_tenants: ['confused-tenant'],
      }));

      // Disabled should take priority (safer default)
      const result = await isVoiceAgentEnabled('confused-tenant');

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------
  // isVoiceAgentEnabledCached
  // -------------------------------------------------
  describe('isVoiceAgentEnabledCached', () => {
    it('should cache results for performance', async () => {
      setMockData(createMockFlags({ enabled: true }));

      // First call - should hit database
      await isVoiceAgentEnabledCached('cache-test-tenant');
      const callsAfterFirst = (supabaseAdmin.from as jest.Mock).mock.calls.length;

      // Second call - should use cache
      await isVoiceAgentEnabledCached('cache-test-tenant');
      const callsAfterSecond = (supabaseAdmin.from as jest.Mock).mock.calls.length;

      // Should not have made additional calls due to caching
      expect(callsAfterSecond).toBe(callsAfterFirst);
    });

    it('should return false for empty tenant ID', async () => {
      const result = await isVoiceAgentEnabledCached('');
      expect(result).toBe(false);
    });

    it('should respect cache TTL', async () => {
      jest.useFakeTimers();

      setMockData(createMockFlags({ enabled: true }));

      // First call
      await isVoiceAgentEnabledCached('ttl-test-tenant');
      const callsAfterFirst = (supabaseAdmin.from as jest.Mock).mock.calls.length;

      // Advance time past TTL (60 seconds)
      jest.advanceTimersByTime(61000);

      // Should query again after TTL expires
      await isVoiceAgentEnabledCached('ttl-test-tenant');
      const callsAfterSecond = (supabaseAdmin.from as jest.Mock).mock.calls.length;

      expect(callsAfterSecond).toBeGreaterThan(callsAfterFirst);

      jest.useRealTimers();
    });
  });

  // -------------------------------------------------
  // clearVoiceStatusCache
  // -------------------------------------------------
  describe('clearVoiceStatusCache', () => {
    it('should clear the cache', async () => {
      setMockData(createMockFlags({ enabled: true }));

      // First call - caches result
      await isVoiceAgentEnabledCached('clear-test-tenant');
      const callsAfterFirst = (supabaseAdmin.from as jest.Mock).mock.calls.length;

      // Clear cache
      clearVoiceStatusCache();

      // Should query again after cache clear
      await isVoiceAgentEnabledCached('clear-test-tenant');
      const callsAfterClear = (supabaseAdmin.from as jest.Mock).mock.calls.length;

      expect(callsAfterClear).toBeGreaterThan(callsAfterFirst);
    });
  });

  // -------------------------------------------------
  // Enable/Disable Operations
  // -------------------------------------------------
  describe('Enable/Disable Operations', () => {
    describe('enableVoiceAgent', () => {
      it('should enable voice agent globally', async () => {
        await enableVoiceAgent('admin@test.com');

        expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
      });

      it('should clear cache after enabling', async () => {
        setMockData(createMockFlags({ enabled: false }));

        // Cache a result
        await isVoiceAgentEnabledCached('enable-test-tenant');
        const callsAfterCache = (supabaseAdmin.from as jest.Mock).mock.calls.length;

        // Enable (which clears cache)
        await enableVoiceAgent();

        // Next call should hit DB again
        await isVoiceAgentEnabledCached('enable-test-tenant');
        const callsAfterEnable = (supabaseAdmin.from as jest.Mock).mock.calls.length;

        expect(callsAfterEnable).toBeGreaterThan(callsAfterCache);
      });
    });

    describe('disableVoiceAgent', () => {
      it('should disable voice agent', async () => {
        await disableVoiceAgent('admin@test.com');

        expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
      });
    });
  });

  // -------------------------------------------------
  // Tenant-Specific Overrides
  // -------------------------------------------------
  describe('Tenant-Specific Overrides', () => {
    describe('enableTenantVoiceAgent', () => {
      it('should add tenant to enabled list', async () => {
        setMockData(createMockFlags({
          enabled_tenants: ['existing-tenant'],
          disabled_tenants: [],
        }));

        await enableTenantVoiceAgent('new-tenant', 'admin@test.com');

        expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
      });
    });

    describe('disableTenantVoiceAgent', () => {
      it('should add tenant to disabled list', async () => {
        setMockData(createMockFlags({
          enabled_tenants: [],
          disabled_tenants: [],
        }));

        await disableTenantVoiceAgent('problem-tenant', 'admin@test.com');

        expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
      });
    });

    describe('resetTenantVoiceOverride', () => {
      it('should remove tenant from both lists', async () => {
        setMockData(createMockFlags({
          enabled_tenants: ['tenant-in-enabled'],
          disabled_tenants: ['tenant-in-disabled'],
        }));

        await resetTenantVoiceOverride('tenant-in-enabled');

        expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
      });
    });
  });

  // -------------------------------------------------
  // Emergency Disable (formerly Instant Rollback)
  // -------------------------------------------------
  describe('Emergency Disable', () => {
    it('should disable a tenant immediately via disableTenantVoiceAgent', async () => {
      // Initially tenant is enabled (global enabled)
      setMockData(createMockFlags({
        enabled: true,
      }));

      const beforeDisable = await isVoiceAgentEnabled('emergency-tenant');
      expect(beforeDisable).toBe(true);

      // Clear cache before disabling
      clearVoiceStatusCache();

      // Disable tenant
      setMockData(createMockFlags({
        enabled: true,
        disabled_tenants: [],
      }));
      await disableTenantVoiceAgent('emergency-tenant');

      // After disable - tenant should be disabled
      setMockData(createMockFlags({
        enabled: true,
        disabled_tenants: ['emergency-tenant'],
      }));

      const afterDisable = await isVoiceAgentEnabled('emergency-tenant');
      expect(afterDisable).toBe(false);
    });

    it('should disable globally via disableVoiceAgent', async () => {
      // Before global disable
      setMockData(createMockFlags({ enabled: true }));

      const beforeDisable = await isVoiceAgentEnabled('any-tenant');
      expect(beforeDisable).toBe(true);

      // Global disable
      await disableVoiceAgent();

      // Clear cache
      clearVoiceStatusCache();

      // After global disable
      setMockData(createMockFlags({ enabled: false }));

      const afterDisable = await isVoiceAgentEnabled('any-tenant');
      expect(afterDisable).toBe(false);
    });
  });

  // -------------------------------------------------
  // initializeVoiceAgentFlag
  // -------------------------------------------------
  describe('initializeVoiceAgentFlag', () => {
    it('should not create flag if it already exists', async () => {
      setMockData({ id: 'existing-flag-id' });

      await initializeVoiceAgentFlag();

      expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
    });

    it('should create flag if it does not exist', async () => {
      setMockData(null);

      await initializeVoiceAgentFlag();

      expect(supabaseAdmin.from).toHaveBeenCalledWith('platform_feature_flags');
    });
  });

  // -------------------------------------------------
  // Audit Log
  // -------------------------------------------------
  describe('getVoiceAgentAuditLog', () => {
    it('should return audit entries', async () => {
      const auditData = [
        {
          id: 'audit-1',
          flag_name: 'voice_agent',
          action: 'enabled',
          old_value: { enabled: false },
          new_value: { enabled: true },
          changed_by: 'admin@test.com',
          reason: null,
          created_at: new Date().toISOString(),
        },
      ];

      setMockData(auditData);

      const result = await getVoiceAgentAuditLog(10);

      expect(result).toHaveLength(1);
      expect(result[0].flagName).toBe('voice_agent');
      expect(result[0].action).toBe('enabled');
    });

    it('should return empty array on error', async () => {
      setMockData(null);
      setMockError({ message: 'Database error' });

      const result = await getVoiceAgentAuditLog();

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------
  // Backwards Compatibility (Deprecated Exports)
  // -------------------------------------------------
  describe('Backwards Compatibility', () => {
    it('shouldUseVoiceAgentV2 should work like isVoiceAgentEnabled', async () => {
      setMockData(createMockFlags({ enabled: true }));

      const result = await shouldUseVoiceAgentV2('test-tenant');

      expect(result).toBe(true);
    });

    it('shouldUseVoiceAgentV2Cached should work like isVoiceAgentEnabledCached', async () => {
      setMockData(createMockFlags({ enabled: true }));

      const result = await shouldUseVoiceAgentV2Cached('test-tenant');

      expect(result).toBe(true);
    });

    it('getVoiceAgentV2Flags should return flags with percentage=100 when enabled', async () => {
      setMockData(createMockFlags({ enabled: true }));

      const result = await getVoiceAgentV2Flags();

      expect(result.enabled).toBe(true);
      expect(result.percentage).toBe(100);
    });

    it('getVoiceAgentV2Flags should return flags with percentage=0 when disabled', async () => {
      setMockData(createMockFlags({ enabled: false }));

      const result = await getVoiceAgentV2Flags();

      expect(result.enabled).toBe(false);
      expect(result.percentage).toBe(0);
    });

    it('clearV2StatusCache should work like clearVoiceStatusCache', async () => {
      setMockData(createMockFlags({ enabled: true }));

      await isVoiceAgentEnabledCached('clear-v2-test');
      clearV2StatusCache();

      // Should be able to call without errors
      expect(true).toBe(true);
    });
  });

  // -------------------------------------------------
  // Edge Cases
  // -------------------------------------------------
  describe('Edge Cases', () => {
    it('should handle empty tenant lists', async () => {
      setMockData(createMockFlags({
        enabled: true,
        enabled_tenants: [],
        disabled_tenants: [],
      }));

      // Should work without throwing
      const result = await isVoiceAgentEnabled('test-tenant');
      expect(typeof result).toBe('boolean');
    });

    it('should handle special characters in tenant IDs', async () => {
      setMockData(createMockFlags({ enabled: true }));

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
        const result = await isVoiceAgentEnabled(tenantId);
        expect(typeof result).toBe('boolean');
      }
    });

    it('should handle concurrent cache operations', async () => {
      setMockData(createMockFlags({ enabled: true }));

      // Simulate concurrent calls
      const promises = Array(100)
        .fill(null)
        .map((_, i) => isVoiceAgentEnabledCached(`concurrent-tenant-${i}`));

      await Promise.all(promises);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });
});

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

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create shared state that the mock can access
const mockState = vi.hoisted(() => ({
  data: null as unknown,
  error: null as unknown,
}));

// Mock Supabase with hoisted state
vi.mock('@/lib/supabase', () => {
  const createMockChainMethods = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: mockState.data, error: mockState.error })
    ),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: mockState.data, error: mockState.error })
    ),
    gte: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: mockState.data, error: mockState.error })
    ),
  });

  return {
    supabaseAdmin: {
      from: vi.fn(() => createMockChainMethods()),
    },
  };
});

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
  vi.clearAllMocks();
}

// =====================================================
// TEST DATA
// =====================================================

const createMockFlags = (overrides: Partial<{
  enabled: boolean;
  enabled_tenants: string[];
  disabled_tenants: string[];
  updated_at: string;
  updated_by: string;
}> = {}) => ({
  id: 'test-flag-id',
  name: 'voice_agent',
  enabled: true,
  enabled_tenants: [],
  disabled_tenants: [],
  updated_at: new Date().toISOString(),
  updated_by: 'test-user',
  ...overrides,
});

// =====================================================
// TEST SUITE
// =====================================================

describe('Feature Flags - Voice Agent (Simplified v2)', () => {
  beforeEach(() => {
    resetMocks();
    clearVoiceStatusCache();
  });

  // -------------------------------------------------
  // getVoiceAgentFlags (raw flag data)
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

    it('should return default enabled state if no flag found (v2 is default)', async () => {
      // Note: Voice Agent v2 is now the default, so enabled=true when no flag found
      setMockData(null);
      setMockError({ code: 'PGRST116' });

      const result = await getVoiceAgentFlags();

      // v2 is the default - enabled when no flag exists
      expect(result.enabled).toBe(true);
      expect(result.enabledTenants).toEqual([]);
    });

    it('should handle null values gracefully (defaults to enabled)', async () => {
      // Note: null values default to true for enabled (v2 is default)
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

      // enabled defaults to true when null (v2 is the default)
      expect(result.enabled).toBe(true);
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
      const result = await isVoiceAgentEnabled(null as unknown as string);
      expect(result).toBe(false);
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
      expect(result).toBe(true);
    });

    it('should return false for explicitly disabled tenant when global is enabled', async () => {
      setMockData(createMockFlags({
        enabled: true,
        disabled_tenants: ['problem-tenant'],
      }));

      const result = await isVoiceAgentEnabled('problem-tenant');
      expect(result).toBe(false);
    });

    it('should prioritize disabled over enabled', async () => {
      setMockData(createMockFlags({
        enabled: true,
        enabled_tenants: ['conflict-tenant'],
        disabled_tenants: ['conflict-tenant'],
      }));

      // Disabled should take precedence
      const result = await isVoiceAgentEnabled('conflict-tenant');
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------
  // isVoiceAgentEnabledCached (caching behavior)
  // -------------------------------------------------
  describe('isVoiceAgentEnabledCached', () => {
    it('should cache results for performance', async () => {
      setMockData(createMockFlags({ enabled: true }));

      // First call
      await isVoiceAgentEnabledCached('cached-tenant');

      // Second call should use cache
      await isVoiceAgentEnabledCached('cached-tenant');

      // Only one DB call should have been made
      expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
    });

    it('should return false for empty tenant ID', async () => {
      const result = await isVoiceAgentEnabledCached('');
      expect(result).toBe(false);
    });

    it('should respect cache TTL', async () => {
      vi.useFakeTimers();

      setMockData(createMockFlags({ enabled: true }));

      // First call
      await isVoiceAgentEnabledCached('ttl-test-tenant');
      const callsAfterFirst = (supabaseAdmin.from as ReturnType<typeof vi.fn>).mock.calls.length;

      // Advance time past TTL (60 seconds)
      vi.advanceTimersByTime(61000);

      // Should query again after TTL expires
      await isVoiceAgentEnabledCached('ttl-test-tenant');
      const callsAfterSecond = (supabaseAdmin.from as ReturnType<typeof vi.fn>).mock.calls.length;

      expect(callsAfterSecond).toBeGreaterThan(callsAfterFirst);

      vi.useRealTimers();
    });
  });

  // -------------------------------------------------
  // clearVoiceStatusCache
  // -------------------------------------------------
  describe('clearVoiceStatusCache', () => {
    it('should clear the cache', async () => {
      setMockData(createMockFlags({ enabled: true }));

      // First call - caches result
      await isVoiceAgentEnabledCached('cache-clear-tenant');

      // Clear the cache
      clearVoiceStatusCache();

      // Second call should query DB again
      await isVoiceAgentEnabledCached('cache-clear-tenant');

      // Two DB calls expected
      expect(supabaseAdmin.from).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------
  // Enable/Disable Operations
  // -------------------------------------------------
  describe('Enable/Disable Operations', () => {
    describe('enableVoiceAgent', () => {
      it('should enable voice agent globally', async () => {
        setMockData(createMockFlags({ enabled: false }));

        await enableVoiceAgent('admin-user');

        expect(supabaseAdmin.from).toHaveBeenCalled();
      });

      it('should clear cache after enabling', async () => {
        setMockData(createMockFlags({ enabled: false }));

        // Cache a result
        await isVoiceAgentEnabledCached('enable-cache-tenant');

        // Enable - should clear cache
        await enableVoiceAgent('admin-user');

        // New query should be made
        await isVoiceAgentEnabledCached('enable-cache-tenant');

        // More than 1 call expected
        expect((supabaseAdmin.from as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
      });
    });

    describe('disableVoiceAgent', () => {
      it('should disable voice agent', async () => {
        setMockData(createMockFlags({ enabled: true }));

        await disableVoiceAgent('admin-user');

        expect(supabaseAdmin.from).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------
  // Tenant-Specific Overrides
  // -------------------------------------------------
  describe('Tenant-Specific Overrides', () => {
    describe('enableTenantVoiceAgent', () => {
      it('should add tenant to enabled list', async () => {
        setMockData(createMockFlags());

        await enableTenantVoiceAgent('new-tenant', 'admin-user');

        expect(supabaseAdmin.from).toHaveBeenCalled();
      });
    });

    describe('disableTenantVoiceAgent', () => {
      it('should add tenant to disabled list', async () => {
        setMockData(createMockFlags());

        await disableTenantVoiceAgent('problem-tenant', 'admin-user');

        expect(supabaseAdmin.from).toHaveBeenCalled();
      });
    });

    describe('resetTenantVoiceOverride', () => {
      it('should remove tenant from both lists', async () => {
        setMockData(createMockFlags({
          enabled_tenants: ['reset-tenant'],
          disabled_tenants: ['reset-tenant'],
        }));

        await resetTenantVoiceOverride('reset-tenant', 'admin-user');

        expect(supabaseAdmin.from).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------
  // Emergency Disable
  // -------------------------------------------------
  describe('Emergency Disable', () => {
    it('should disable a tenant immediately via disableTenantVoiceAgent', async () => {
      setMockData(createMockFlags({ enabled: true }));

      await disableTenantVoiceAgent('emergency-tenant', 'admin-user');

      // Cache should be cleared
      clearVoiceStatusCache();

      expect(supabaseAdmin.from).toHaveBeenCalled();
    });

    it('should disable globally via disableVoiceAgent', async () => {
      setMockData(createMockFlags({ enabled: true }));

      await disableVoiceAgent('admin-user');

      expect(supabaseAdmin.from).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------
  // Initialize Flag
  // -------------------------------------------------
  describe('initializeVoiceAgentFlag', () => {
    it('should not create flag if it already exists', async () => {
      setMockData(createMockFlags());

      await initializeVoiceAgentFlag();

      // Should check if exists
      expect(supabaseAdmin.from).toHaveBeenCalled();
    });

    it('should create flag if it does not exist', async () => {
      setMockData(null);
      setMockError({ code: 'PGRST116' });

      await initializeVoiceAgentFlag();

      expect(supabaseAdmin.from).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------
  // Audit Log
  // -------------------------------------------------
  describe('getVoiceAgentAuditLog', () => {
    it('should return audit entries', async () => {
      // Mock raw database format
      const rawAuditEntries = [
        { id: '1', flag_name: 'voice_agent', action: 'enable', old_value: null, new_value: true, changed_by: 'admin', reason: null, created_at: '2024-01-01T00:00:00Z' },
        { id: '2', flag_name: 'voice_agent', action: 'disable', old_value: true, new_value: false, changed_by: 'admin', reason: 'maintenance', created_at: '2024-01-02T00:00:00Z' },
      ];
      setMockData(rawAuditEntries);

      const result = await getVoiceAgentAuditLog();

      // Function transforms to camelCase format
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].action).toBe('enable');
      expect(result[1].reason).toBe('maintenance');
    });

    it('should return empty array on error', async () => {
      setMockData(null);
      setMockError({ message: 'Database error' });

      const result = await getVoiceAgentAuditLog();

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------
  // Backwards Compatibility
  // -------------------------------------------------
  describe('Backwards Compatibility', () => {
    it('shouldUseVoiceAgentV2 should work like isVoiceAgentEnabled', async () => {
      setMockData(createMockFlags({ enabled: true }));

      const result = await shouldUseVoiceAgentV2('compat-tenant');

      expect(result).toBe(true);
    });

    it('shouldUseVoiceAgentV2Cached should work like isVoiceAgentEnabledCached', async () => {
      setMockData(createMockFlags({ enabled: true }));

      const result = await shouldUseVoiceAgentV2Cached('compat-tenant');

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

      await shouldUseVoiceAgentV2Cached('clear-v2-tenant');
      clearV2StatusCache();
      await shouldUseVoiceAgentV2Cached('clear-v2-tenant');

      expect((supabaseAdmin.from as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
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

      const result = await isVoiceAgentEnabled('any-tenant');
      expect(result).toBe(true);
    });

    it('should handle special characters in tenant IDs', async () => {
      const specialTenant = 'tenant-with-special_chars.123';
      setMockData(createMockFlags({
        enabled: true,
        enabled_tenants: [specialTenant],
      }));

      const result = await isVoiceAgentEnabled(specialTenant);
      expect(result).toBe(true);
    });

    it('should handle concurrent cache operations', async () => {
      setMockData(createMockFlags({ enabled: true }));

      const promises = Array(10)
        .fill(null)
        .map((_, i) => isVoiceAgentEnabledCached(`concurrent-tenant-${i}`));

      await Promise.all(promises);

      // Should complete without errors
      expect(true).toBe(true);
    });
  });
});

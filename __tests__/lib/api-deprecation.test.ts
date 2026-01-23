// =====================================================
// TIS TIS PLATFORM - FASE 3 Unit Tests
// Tests for API Deprecation Strategy
// Coverage: api-deprecation.ts module
// =====================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  isUsingDeprecatedFiltering,
  createDeprecationWarning,
  addDeprecationHeaders,
  checkSoftEnforcement,
  checkHardEnforcement,
  applyDeprecationChecks,
  getDeprecationConfig,
  getDaysUntilDeprecation,
  updateDeprecationPhase,
  initializeDeprecationConfig,
  type DeprecationPhase,
} from '@/src/shared/lib/api-deprecation';
import type { APIKeyAuthResult } from '@/src/shared/lib/api-key-auth';

// ======================
// MOCK DATA
// ======================

const mockTenantAuth: APIKeyAuthResult = {
  success: true,
  keyId: 'key-tenant-123',
  tenantId: 'tenant-123',
  branchId: null,
  scopeType: 'tenant',
  scopes: ['leads:read', 'leads:write'],
  rateLimits: { rpm: 100, daily: 10000 },
};

const mockBranchAuth: APIKeyAuthResult = {
  success: true,
  keyId: 'key-branch-456',
  tenantId: 'tenant-123',
  branchId: 'branch-polanco-uuid',
  scopeType: 'branch',
  scopes: ['leads:read'],
  rateLimits: { rpm: 60, daily: 5000 },
};

// ======================
// TEST SUITE
// ======================

describe('API Deprecation Strategy - Unit Tests', () => {
  beforeEach(() => {
    // Reset to warning phase before each test
    updateDeprecationPhase('warning');
  });

  // ======================
  // isUsingDeprecatedFiltering
  // ======================
  describe('isUsingDeprecatedFiltering', () => {
    it('should return true for tenant-wide key with query param', () => {
      const result = isUsingDeprecatedFiltering(mockTenantAuth, 'branch-123');
      expect(result).toBe(true);
    });

    it('should return false for tenant-wide key without query param', () => {
      const result = isUsingDeprecatedFiltering(mockTenantAuth, null);
      expect(result).toBe(false);
    });

    it('should return false for branch-specific key with query param', () => {
      // Branch keys don't trigger deprecation warnings
      const result = isUsingDeprecatedFiltering(mockBranchAuth, 'branch-123');
      expect(result).toBe(false);
    });

    it('should return false for branch-specific key without query param', () => {
      const result = isUsingDeprecatedFiltering(mockBranchAuth, null);
      expect(result).toBe(false);
    });

    it('should return false for undefined query param', () => {
      const result = isUsingDeprecatedFiltering(mockTenantAuth, undefined);
      expect(result).toBe(false);
    });

    it('should return false for empty string query param', () => {
      const result = isUsingDeprecatedFiltering(mockTenantAuth, '');
      expect(result).toBe(false);
    });
  });

  // ======================
  // createDeprecationWarning
  // ======================
  describe('createDeprecationWarning', () => {
    it('should create warning object with correct structure', () => {
      const warning = createDeprecationWarning();

      expect(warning).toHaveProperty('feature');
      expect(warning).toHaveProperty('message');
      expect(warning).toHaveProperty('deprecationDate');
      expect(warning).toHaveProperty('migrationGuide');
      expect(warning).toHaveProperty('phase');
    });

    it('should include feature name', () => {
      const warning = createDeprecationWarning();
      expect(warning.feature).toBe('query-parameter-branch-filtering');
    });

    it('should include migration message', () => {
      const warning = createDeprecationWarning();
      expect(warning.message).toContain('deprecated');
      expect(warning.message).toContain('branch-specific API Keys');
    });

    it('should include current phase', () => {
      updateDeprecationPhase('warning');
      const warning = createDeprecationWarning();
      expect(warning.phase).toBe('warning');

      updateDeprecationPhase('soft_enforcement');
      const warning2 = createDeprecationWarning();
      expect(warning2.phase).toBe('soft_enforcement');
    });

    it('should include deprecation date from config', () => {
      const warning = createDeprecationWarning();
      expect(warning.deprecationDate).toBeTruthy();
      expect(warning.deprecationDate).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should include migration guide URL', () => {
      const warning = createDeprecationWarning();
      expect(warning.migrationGuide).toContain('http');
    });
  });

  // ======================
  // addDeprecationHeaders
  // ======================
  describe('addDeprecationHeaders', () => {
    it('should not add headers if not using deprecated filtering', () => {
      const response = NextResponse.json({ data: [] });
      const result = addDeprecationHeaders(response, mockBranchAuth, null);

      expect(result.headers.get('Deprecation')).toBeNull();
      expect(result.headers.get('Sunset')).toBeNull();
    });

    it('should add standard deprecation headers', () => {
      const response = NextResponse.json({ data: [] });
      const result = addDeprecationHeaders(response, mockTenantAuth, 'branch-123');

      expect(result.headers.get('Deprecation')).toBe('true');
      expect(result.headers.get('Sunset')).toBeTruthy();
    });

    it('should add custom X-API headers', () => {
      const response = NextResponse.json({ data: [] });
      const result = addDeprecationHeaders(response, mockTenantAuth, 'branch-123');

      expect(result.headers.get('X-API-Deprecated-Feature')).toBe('query-parameter-filtering');
      expect(result.headers.get('X-API-Deprecation-Phase')).toBe('warning');
      expect(result.headers.get('X-API-Deprecation-Date')).toBeTruthy();
      expect(result.headers.get('X-API-Migration-Guide')).toContain('http');
    });

    it('should add RFC 7234 Warning header', () => {
      const response = NextResponse.json({ data: [] });
      const result = addDeprecationHeaders(response, mockTenantAuth, 'branch-123');

      const warning = result.headers.get('Warning');
      expect(warning).toBeTruthy();
      expect(warning).toContain('299');
      expect(warning).toContain('deprecated');
    });

    it('should preserve generic response type', () => {
      interface CustomResponse {
        data: string[];
        total: number;
      }

      const response = NextResponse.json<CustomResponse>({
        data: ['test'],
        total: 1,
      });

      const result = addDeprecationHeaders(response, mockTenantAuth, 'branch-123');

      // Type should be preserved (compile-time check)
      expect(result).toBeDefined();
    });

    it('should return same response object if not deprecated', () => {
      const response = NextResponse.json({ data: [] });
      const result = addDeprecationHeaders(response, mockBranchAuth, null);

      expect(result).toBe(response);
    });
  });

  // ======================
  // checkSoftEnforcement
  // ======================
  describe('checkSoftEnforcement', () => {
    beforeEach(() => {
      updateDeprecationPhase('soft_enforcement');
    });

    it('should return null if soft enforcement disabled', () => {
      updateDeprecationPhase('warning');

      const request = new NextRequest('http://localhost/api/v1/leads?branch_id=123');
      const result = checkSoftEnforcement(request, mockTenantAuth, 'branch-123');

      expect(result).toBeNull();
    });

    it('should return null if not using deprecated feature', () => {
      const request = new NextRequest('http://localhost/api/v1/leads');
      const result = checkSoftEnforcement(request, mockBranchAuth, null);

      expect(result).toBeNull();
    });

    it('should block request without opt-in header', () => {
      const request = new NextRequest('http://localhost/api/v1/leads?branch_id=123');
      const result = checkSoftEnforcement(request, mockTenantAuth, 'branch-123');

      expect(result).toBeInstanceOf(NextResponse);

      if (result) {
        expect(result.status).toBe(400);
      }
    });

    it('should allow request with X-Allow-Legacy-Filtering header', () => {
      const request = new NextRequest('http://localhost/api/v1/leads?branch_id=123', {
        headers: {
          'X-Allow-Legacy-Filtering': 'true',
        },
      });

      const result = checkSoftEnforcement(request, mockTenantAuth, 'branch-123');
      expect(result).toBeNull();
    });

    it('should return 400 error with deprecation details', async () => {
      const request = new NextRequest('http://localhost/api/v1/leads?branch_id=123');
      const result = checkSoftEnforcement(request, mockTenantAuth, 'branch-123');

      if (result) {
        const body = await result.json();
        expect(body.error).toBeTruthy();
        expect(body.code).toBe('DEPRECATED_FEATURE');
        expect(body.migration_guide).toBeTruthy();
        expect(body.temporary_override).toContain('X-Allow-Legacy-Filtering');
      }
    });

    it('should not block if header value is not "true"', () => {
      const request = new NextRequest('http://localhost/api/v1/leads?branch_id=123', {
        headers: {
          'X-Allow-Legacy-Filtering': 'false',
        },
      });

      const result = checkSoftEnforcement(request, mockTenantAuth, 'branch-123');
      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  // ======================
  // checkHardEnforcement
  // ======================
  describe('checkHardEnforcement', () => {
    beforeEach(() => {
      updateDeprecationPhase('hard_deprecation');
    });

    it('should return null if hard enforcement disabled', () => {
      updateDeprecationPhase('warning');

      const result = checkHardEnforcement(mockTenantAuth, 'branch-123');
      expect(result).toBeNull();
    });

    it('should return null if not using deprecated feature', () => {
      const result = checkHardEnforcement(mockBranchAuth, null);
      expect(result).toBeNull();
    });

    it('should block all deprecated usage', () => {
      const result = checkHardEnforcement(mockTenantAuth, 'branch-123');

      expect(result).toBeInstanceOf(NextResponse);
      if (result) {
        expect(result.status).toBe(410); // 410 Gone
      }
    });

    it('should return 410 Gone status', () => {
      const result = checkHardEnforcement(mockTenantAuth, 'branch-123');

      if (result) {
        expect(result.status).toBe(410);
      }
    });

    it('should return error with FEATURE_REMOVED code', async () => {
      const result = checkHardEnforcement(mockTenantAuth, 'branch-123');

      if (result) {
        const body = await result.json();
        expect(body.code).toBe('FEATURE_REMOVED');
        expect(body.error).toContain('removed');
      }
    });

    it('should not allow opt-in header bypass', () => {
      // Even with header, hard enforcement blocks
      const result = checkHardEnforcement(mockTenantAuth, 'branch-123');
      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  // ======================
  // applyDeprecationChecks (Integration)
  // ======================
  describe('applyDeprecationChecks', () => {
    it('should check hard enforcement first', () => {
      updateDeprecationPhase('hard_deprecation');

      const request = new NextRequest('http://localhost/api/v1/leads?branch_id=123', {
        headers: {
          'X-Allow-Legacy-Filtering': 'true',
        },
      });

      const result = applyDeprecationChecks(request, mockTenantAuth, 'branch-123');

      // Hard enforcement ignores opt-in header
      expect(result).toBeInstanceOf(NextResponse);
      if (result) {
        expect(result.status).toBe(410);
      }
    });

    it('should check soft enforcement if hard disabled', () => {
      updateDeprecationPhase('soft_enforcement');

      const request = new NextRequest('http://localhost/api/v1/leads?branch_id=123');
      const result = applyDeprecationChecks(request, mockTenantAuth, 'branch-123');

      expect(result).toBeInstanceOf(NextResponse);
      if (result) {
        expect(result.status).toBe(400);
      }
    });

    it('should return null in warning phase', () => {
      updateDeprecationPhase('warning');

      const request = new NextRequest('http://localhost/api/v1/leads?branch_id=123');
      const result = applyDeprecationChecks(request, mockTenantAuth, 'branch-123');

      expect(result).toBeNull();
    });

    it('should return null for non-deprecated usage', () => {
      updateDeprecationPhase('hard_deprecation');

      const request = new NextRequest('http://localhost/api/v1/leads');
      const result = applyDeprecationChecks(request, mockBranchAuth, null);

      expect(result).toBeNull();
    });

    it('should allow soft enforcement with opt-in header', () => {
      updateDeprecationPhase('soft_enforcement');

      const request = new NextRequest('http://localhost/api/v1/leads?branch_id=123', {
        headers: {
          'X-Allow-Legacy-Filtering': 'true',
        },
      });

      const result = applyDeprecationChecks(request, mockTenantAuth, 'branch-123');
      expect(result).toBeNull();
    });
  });

  // ======================
  // getDeprecationConfig
  // ======================
  describe('getDeprecationConfig', () => {
    it('should return current configuration', () => {
      const config = getDeprecationConfig();

      expect(config).toHaveProperty('phase');
      expect(config).toHaveProperty('deprecationDate');
      expect(config).toHaveProperty('migrationGuideUrl');
      expect(config).toHaveProperty('enableSoftEnforcement');
      expect(config).toHaveProperty('enableHardEnforcement');
    });

    it('should return copy of config (not reference)', () => {
      const config1 = getDeprecationConfig();
      const config2 = getDeprecationConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  // ======================
  // getDaysUntilDeprecation
  // ======================
  describe('getDaysUntilDeprecation', () => {
    it('should return positive number for future date', () => {
      const days = getDaysUntilDeprecation();
      expect(days).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for past dates', () => {
      // This test depends on deprecation date being in future
      // If date is past, should return 0
      const config = getDeprecationConfig();
      const deprecationDate = new Date(config.deprecationDate);
      const now = new Date();

      if (deprecationDate < now) {
        const days = getDaysUntilDeprecation();
        expect(days).toBe(0);
      }
    });

    it('should calculate days correctly', () => {
      const days = getDaysUntilDeprecation();
      expect(typeof days).toBe('number');
      expect(Number.isInteger(days)).toBe(true);
    });
  });

  // ======================
  // updateDeprecationPhase
  // ======================
  describe('updateDeprecationPhase', () => {
    it('should update phase to warning', () => {
      updateDeprecationPhase('warning');
      const config = getDeprecationConfig();

      expect(config.phase).toBe('warning');
      expect(config.enableSoftEnforcement).toBe(false);
      expect(config.enableHardEnforcement).toBe(false);
    });

    it('should update phase to soft_enforcement', () => {
      updateDeprecationPhase('soft_enforcement');
      const config = getDeprecationConfig();

      expect(config.phase).toBe('soft_enforcement');
      expect(config.enableSoftEnforcement).toBe(true);
      expect(config.enableHardEnforcement).toBe(false);
    });

    it('should update phase to hard_deprecation', () => {
      updateDeprecationPhase('hard_deprecation');
      const config = getDeprecationConfig();

      expect(config.phase).toBe('hard_deprecation');
      expect(config.enableSoftEnforcement).toBe(true);
      expect(config.enableHardEnforcement).toBe(true);
    });
  });

  // ======================
  // Environment Variables
  // ======================
  describe('initializeDeprecationConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should initialize from environment variables', () => {
      process.env.DEPRECATION_PHASE = 'soft_enforcement';
      process.env.DEPRECATION_DATE = '2027-01-01';
      process.env.DEPRECATION_GUIDE_URL = 'https://custom.url/guide';

      initializeDeprecationConfig();

      const config = getDeprecationConfig();
      expect(config.phase).toBe('soft_enforcement');
      expect(config.deprecationDate).toBe('2027-01-01');
      expect(config.migrationGuideUrl).toBe('https://custom.url/guide');
    });

    it('should ignore invalid phase values', () => {
      process.env.DEPRECATION_PHASE = 'invalid_phase' as any;

      initializeDeprecationConfig();

      const config = getDeprecationConfig();
      // Should keep existing phase, not crash
      expect(['warning', 'soft_enforcement', 'hard_deprecation']).toContain(config.phase);
    });

    it('should use defaults if env vars not set', () => {
      delete process.env.DEPRECATION_PHASE;
      delete process.env.DEPRECATION_DATE;
      delete process.env.DEPRECATION_GUIDE_URL;

      initializeDeprecationConfig();

      const config = getDeprecationConfig();
      expect(config.phase).toBeTruthy();
      expect(config.deprecationDate).toBeTruthy();
      expect(config.migrationGuideUrl).toBeTruthy();
    });
  });

  // ======================
  // Edge Cases
  // ======================
  describe('Edge Cases', () => {
    it('should handle null auth branchId gracefully', () => {
      const authWithNullBranch: APIKeyAuthResult = {
        ...mockBranchAuth,
        branchId: null,
      };

      const result = isUsingDeprecatedFiltering(authWithNullBranch, 'branch-123');
      expect(typeof result).toBe('boolean');
    });

    it('should handle missing scopeType gracefully', () => {
      const authWithoutScope: any = {
        success: true,
        keyId: 'test',
        tenantId: 'test',
      };

      const result = isUsingDeprecatedFiltering(authWithoutScope, 'branch-123');
      expect(typeof result).toBe('boolean');
    });

    it('should handle empty headers in request', () => {
      updateDeprecationPhase('soft_enforcement');

      const request = new NextRequest('http://localhost/api/v1/leads?branch_id=123');
      const result = checkSoftEnforcement(request, mockTenantAuth, 'branch-123');

      expect(result).toBeDefined();
    });
  });
});

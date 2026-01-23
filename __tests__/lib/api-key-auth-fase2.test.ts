/**
 * Tests for API Key Auth - FASE 2 Enhancements
 * Tests branch context support in authentication layer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBranchFilterContext,
  applyAutomaticBranchFilter,
  type APIKeyAuthResult,
  type BranchFilterContext,
} from '@/src/shared/lib/api-key-auth';

describe('API Key Auth - FASE 2 Branch Context', () => {
  describe('createBranchFilterContext', () => {
    it('should create context for tenant-wide API key', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        keyId: 'key-123',
        tenantId: 'tenant-123',
        branchId: null,
        scopeType: 'tenant',
        scopes: ['leads:read'],
        rateLimits: { rpm: 60, daily: 10000 },
      };

      const context = createBranchFilterContext(auth);

      expect(context.branchId).toBeNull();
      expect(context.scopeType).toBe('tenant');
      expect(context.hasBranchAccess).toBeDefined();
    });

    it('should create context for branch-specific API key', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        keyId: 'key-456',
        tenantId: 'tenant-123',
        branchId: 'branch-polanco',
        scopeType: 'branch',
        scopes: ['leads:read'],
        rateLimits: { rpm: 60, daily: 10000 },
      };

      const context = createBranchFilterContext(auth);

      expect(context.branchId).toBe('branch-polanco');
      expect(context.scopeType).toBe('branch');
    });

    it('should default to tenant scope when scope_type not provided', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        keyId: 'key-789',
        tenantId: 'tenant-123',
        scopes: ['leads:read'],
        rateLimits: { rpm: 60, daily: 10000 },
      };

      const context = createBranchFilterContext(auth);

      expect(context.scopeType).toBe('tenant');
      expect(context.branchId).toBeNull();
    });
  });

  describe('BranchFilterContext.hasBranchAccess', () => {
    it('should allow tenant-wide key to access any branch', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'tenant',
        branchId: null,
      } as APIKeyAuthResult;

      const context = createBranchFilterContext(auth);

      expect(context.hasBranchAccess('branch-polanco')).toBe(true);
      expect(context.hasBranchAccess('branch-satelite')).toBe(true);
      expect(context.hasBranchAccess('branch-condesa')).toBe(true);
    });

    it('should allow branch-specific key to access only its branch', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'branch',
        branchId: 'branch-polanco',
      } as APIKeyAuthResult;

      const context = createBranchFilterContext(auth);

      expect(context.hasBranchAccess('branch-polanco')).toBe(true);
    });

    it('should deny branch-specific key access to other branches', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'branch',
        branchId: 'branch-polanco',
      } as APIKeyAuthResult;

      const context = createBranchFilterContext(auth);

      expect(context.hasBranchAccess('branch-satelite')).toBe(false);
      expect(context.hasBranchAccess('branch-condesa')).toBe(false);
    });

    it('should allow access when branchId is null (legacy tenant-wide)', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'tenant',
        branchId: null,
      } as APIKeyAuthResult;

      const context = createBranchFilterContext(auth);

      expect(context.hasBranchAccess('any-branch-id')).toBe(true);
    });
  });

  describe('applyAutomaticBranchFilter', () => {
    let mockQuery: any;

    beforeEach(() => {
      mockQuery = {
        eq: vi.fn().mockReturnThis(),
      };
    });

    it('should enforce API Key branch for branch-scoped keys (security)', () => {
      // SEGURIDAD: Para API keys con scope branch, se ignora el query param
      // y se usa siempre el branch de la API key
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'branch',
        branchId: 'branch-polanco',
      } as APIKeyAuthResult;

      const queryBranchId = 'branch-satelite';

      applyAutomaticBranchFilter(mockQuery, auth, 'leads', queryBranchId);

      // Debe usar el branch de la API Key, ignorando el query param
      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-polanco');
    });

    it('should allow query param for tenant-scoped keys', () => {
      // Tenant-wide keys pueden usar query param para filtrar
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'tenant',
        branchId: null,
      } as APIKeyAuthResult;

      const queryBranchId = 'branch-satelite';

      applyAutomaticBranchFilter(mockQuery, auth, 'leads', queryBranchId);

      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-satelite');
    });

    it('should apply filter from API Key branch_id (Priority 2)', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'branch',
        branchId: 'branch-polanco',
      } as APIKeyAuthResult;

      applyAutomaticBranchFilter(mockQuery, auth, 'leads', null);

      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-polanco');
    });

    it('should not apply filter for tenant-wide key without query param', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'tenant',
        branchId: null,
      } as APIKeyAuthResult;

      const result = applyAutomaticBranchFilter(mockQuery, auth, 'leads', null);

      expect(mockQuery.eq).not.toHaveBeenCalled();
      expect(result).toBe(mockQuery);
    });

    it('should apply filter for tenant-wide key WITH query param', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'tenant',
        branchId: null,
      } as APIKeyAuthResult;

      applyAutomaticBranchFilter(mockQuery, auth, 'leads', 'branch-polanco');

      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-polanco');
    });

    it('should not filter unsupported tables', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'branch',
        branchId: 'branch-polanco',
      } as APIKeyAuthResult;

      const result = applyAutomaticBranchFilter(
        mockQuery,
        auth,
        'unsupported_table',
        null
      );

      expect(mockQuery.eq).not.toHaveBeenCalled();
      expect(result).toBe(mockQuery);
    });

    it('should filter all supported tables', () => {
      const supportedTables = [
        'leads',
        'appointments',
        'menu_items',
        'menu_categories',
        'inventory_items',
        'staff',
      ];

      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'branch',
        branchId: 'branch-polanco',
      } as APIKeyAuthResult;

      supportedTables.forEach((table) => {
        const query = { eq: vi.fn().mockReturnThis() };
        applyAutomaticBranchFilter(query, auth, table, null);
        expect(query.eq).toHaveBeenCalledWith('branch_id', 'branch-polanco');
      });
    });

    it('should handle empty query param correctly', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'branch',
        branchId: 'branch-polanco',
      } as APIKeyAuthResult;

      // Empty string should be treated as null
      applyAutomaticBranchFilter(mockQuery, auth, 'leads', '');

      // Should use API Key branch_id instead
      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-polanco');
    });
  });

  describe('Priority Logic - Query Param vs API Key', () => {
    let mockQuery: any;

    beforeEach(() => {
      mockQuery = {
        eq: vi.fn().mockReturnThis(),
      };
    });

    it('should enforce API Key branch over query param for branch-scoped keys (security)', () => {
      // SEGURIDAD: Una API Key con scope branch solo puede acceder a su branch
      // El query param se ignora para prevenir acceso no autorizado a otros branches
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'branch',
        branchId: 'branch-from-key',
      } as APIKeyAuthResult;

      const queryBranchId = 'branch-from-query';

      applyAutomaticBranchFilter(mockQuery, auth, 'leads', queryBranchId);

      // Debe usar el branch de la API key, ignorando el query param
      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-from-key');
      expect(mockQuery.eq).not.toHaveBeenCalledWith('branch_id', 'branch-from-query');
    });

    it('should allow query param for tenant-wide API keys (backward compat)', () => {
      // Backward compatibility: API keys con scope tenant pueden filtrar por branch
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'tenant',
        branchId: null,
      } as APIKeyAuthResult;

      const queryBranchId = 'branch-from-query';

      applyAutomaticBranchFilter(mockQuery, auth, 'leads', queryBranchId);

      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-from-query');
    });

    it('should use API Key branch when no query param provided', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'branch',
        branchId: 'branch-from-key',
      } as APIKeyAuthResult;

      applyAutomaticBranchFilter(mockQuery, auth, 'leads', null);

      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-from-key');
    });

    it('should apply no filter when both are null (tenant-wide access)', () => {
      const auth: APIKeyAuthResult = {
        success: true,
        scopeType: 'tenant',
        branchId: null,
      } as APIKeyAuthResult;

      const result = applyAutomaticBranchFilter(mockQuery, auth, 'leads', null);

      expect(mockQuery.eq).not.toHaveBeenCalled();
      expect(result).toBe(mockQuery);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with real-world tenant-wide scenario', () => {
      const mockQuery = { eq: vi.fn().mockReturnThis() };

      const auth: APIKeyAuthResult = {
        success: true,
        keyId: 'tis_live_abc123',
        tenantId: 'tenant-empresa-grande',
        branchId: null,
        scopeType: 'tenant',
        scopes: ['leads:read', 'leads:write', 'appointments:read'],
        rateLimits: { rpm: 500, daily: 100000 },
      };

      // Usuario NO especifica branch_id → debe retornar todos
      applyAutomaticBranchFilter(mockQuery, auth, 'leads', null);
      expect(mockQuery.eq).not.toHaveBeenCalled();

      // Usuario ESPECIFICA branch_id → debe filtrar
      const mockQuery2 = { eq: vi.fn().mockReturnThis() };
      applyAutomaticBranchFilter(mockQuery2, auth, 'leads', 'branch-specific');
      expect(mockQuery2.eq).toHaveBeenCalledWith('branch_id', 'branch-specific');
    });

    it('should work with real-world branch-specific scenario', () => {
      const mockQuery = { eq: vi.fn().mockReturnThis() };

      const auth: APIKeyAuthResult = {
        success: true,
        keyId: 'tis_live_xyz789',
        tenantId: 'tenant-cadena-restaurantes',
        branchId: 'branch-polanco-uuid',
        scopeType: 'branch',
        scopes: ['leads:read', 'menu:read'],
        rateLimits: { rpm: 100, daily: 10000 },
      };

      // Automáticamente filtra por el branch de la API Key
      applyAutomaticBranchFilter(mockQuery, auth, 'leads', null);
      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-polanco-uuid');

      // SEGURIDAD: Incluso si usuario intenta especificar otro branch,
      // la API Key branch-specific solo puede acceder a su branch asignado
      const mockQuery2 = { eq: vi.fn().mockReturnThis() };
      applyAutomaticBranchFilter(
        mockQuery2,
        auth,
        'leads',
        'branch-satelite-uuid' // Intento de acceder a otro branch
      );
      // Debe usar el branch de la API key, no el query param
      expect(mockQuery2.eq).toHaveBeenCalledWith('branch_id', 'branch-polanco-uuid');
    });
  });
});

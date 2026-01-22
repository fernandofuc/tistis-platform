/**
 * Tests for Branch Query Filter Helper
 * FASE 1: Query Parameter Approach
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  validateBranchOwnership,
  applyBranchFilter,
  addBranchFilterHeaders,
  tenantHasMultipleBranches,
} from '../../../src/lib/api/branch-query-filter';

describe('Branch Query Filter', () => {
  describe('validateBranchOwnership', () => {
    it('should return valid when branch belongs to tenant', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'branch-123', tenant_id: 'tenant-123' },
          error: null,
        }),
      } as any;

      const result = await validateBranchOwnership(mockSupabase, 'branch-123', 'tenant-123');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('branches');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'branch-123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
    });

    it('should return invalid when branch does not belong to tenant', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      } as any;

      const result = await validateBranchOwnership(mockSupabase, 'branch-123', 'tenant-456');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return invalid when branch does not exist', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as any;

      const result = await validateBranchOwnership(mockSupabase, 'nonexistent-branch', 'tenant-123');

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('applyBranchFilter', () => {
    it('should add branch filter to query for supported table', () => {
      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
      };

      const filtered = applyBranchFilter(mockQuery, 'branch-123', 'leads');

      expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-123');
    });

    it('should not filter when branchId is null', () => {
      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
      };

      const filtered = applyBranchFilter(mockQuery, null, 'leads');

      expect(mockQuery.eq).not.toHaveBeenCalled();
    });

    it('should not filter unsupported tables', () => {
      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
      };

      const filtered = applyBranchFilter(mockQuery, 'branch-123', 'unsupported_table');

      expect(mockQuery.eq).not.toHaveBeenCalled();
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

      supportedTables.forEach((table) => {
        const mockQuery = {
          eq: jest.fn().mockReturnThis(),
        };

        applyBranchFilter(mockQuery, 'branch-123', table);

        expect(mockQuery.eq).toHaveBeenCalledWith('branch_id', 'branch-123');
      });
    });

    it('should return original query when no filter applied', () => {
      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
      };

      const result1 = applyBranchFilter(mockQuery, null, 'leads');
      const result2 = applyBranchFilter(mockQuery, 'branch-123', 'unsupported_table');

      expect(result1).toBe(mockQuery);
      expect(result2).toBe(mockQuery);
    });
  });

  describe('addBranchFilterHeaders', () => {
    it('should add X-Filtered-Branch-ID header when branchId provided', () => {
      const headers = new Map();
      const mockHeaders = {
        set: (key: string, value: string) => headers.set(key, value),
        get: (key: string) => headers.get(key) || null,
      } as any;

      addBranchFilterHeaders(mockHeaders, 'branch-123', false);

      expect(headers.get('X-Filtered-Branch-ID')).toBe('branch-123');
      expect(headers.get('X-Branch-Filter-Warning')).toBeUndefined();
    });

    it('should add warning header for multi-branch tenant without filter', () => {
      const headers = new Map();
      const mockHeaders = {
        set: (key: string, value: string) => headers.set(key, value),
        get: (key: string) => headers.get(key) || null,
      } as any;

      addBranchFilterHeaders(mockHeaders, null, true);

      expect(headers.get('X-Filtered-Branch-ID')).toBeUndefined();
      expect(headers.get('X-Branch-Filter-Warning')).toBeTruthy();
      expect(headers.get('X-Branch-Filter-Warning')).toContain('multiple branches');
    });

    it('should not add any headers for single-branch tenant without filter', () => {
      const headers = new Map();
      const mockHeaders = {
        set: (key: string, value: string) => headers.set(key, value),
        get: (key: string) => headers.get(key) || null,
      } as any;

      addBranchFilterHeaders(mockHeaders, null, false);

      expect(headers.get('X-Filtered-Branch-ID')).toBeUndefined();
      expect(headers.get('X-Branch-Filter-Warning')).toBeUndefined();
    });

    it('should only add filtered header for multi-branch tenant with filter', () => {
      const headers = new Map();
      const mockHeaders = {
        set: (key: string, value: string) => headers.set(key, value),
        get: (key: string) => headers.get(key) || null,
      } as any;

      addBranchFilterHeaders(mockHeaders, 'branch-123', true);

      expect(headers.get('X-Filtered-Branch-ID')).toBe('branch-123');
      expect(headers.get('X-Branch-Filter-Warning')).toBeUndefined();
    });
  });

  describe('tenantHasMultipleBranches', () => {
    it('should return true when tenant has multiple branches', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: 3,
          error: null,
        }),
      } as any;

      const result = await tenantHasMultipleBranches(mockSupabase, 'tenant-123');

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('branches');
      expect(mockSupabase.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', 'tenant-123');
    });

    it('should return false when tenant has one branch', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: 1,
          error: null,
        }),
      } as any;

      const result = await tenantHasMultipleBranches(mockSupabase, 'tenant-123');

      expect(result).toBe(false);
    });

    it('should return false when tenant has zero branches', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: 0,
          error: null,
        }),
      } as any;

      const result = await tenantHasMultipleBranches(mockSupabase, 'tenant-123');

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: null,
          error: { message: 'Database error' },
        }),
      } as any;

      const result = await tenantHasMultipleBranches(mockSupabase, 'tenant-123');

      expect(result).toBe(false);
    });

    it('should handle null count gracefully', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: null,
          error: null,
        }),
      } as any;

      const result = await tenantHasMultipleBranches(mockSupabase, 'tenant-123');

      expect(result).toBe(false);
    });
  });
});

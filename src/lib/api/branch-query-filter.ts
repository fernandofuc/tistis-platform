// =====================================================
// TIS TIS PLATFORM - Branch Query Filter Helper
// FASE 1: Query Parameter Approach
// Provides utilities for branch-based filtering in API endpoints
// =====================================================

import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// ======================
// TYPES
// ======================

export interface BranchFilterResult {
  isValid: boolean;
  branchId: string | null;
  error?: string;
  warning?: string;
}

export interface BranchFilterOptions {
  required?: boolean; // If true, branch_id is mandatory
  validateOwnership?: boolean; // Verify that branch belongs to tenant
}

// ======================
// VALIDATION
// ======================

/**
 * Validates UUID v4 format
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Extracts and validates branch_id from query string
 *
 * @param request - Next.js request object
 * @param options - Configuration options for validation
 * @returns Validation result with branch_id or error
 *
 * @example
 * ```typescript
 * const result = extractBranchId(request);
 * if (!result.isValid) {
 *   return NextResponse.json({ error: result.error }, { status: 400 });
 * }
 * ```
 */
export function extractBranchId(
  request: NextRequest,
  options: BranchFilterOptions = {}
): BranchFilterResult {
  const url = new URL(request.url);
  const branchId = url.searchParams.get('branch_id');

  // If not provided
  if (!branchId) {
    if (options.required) {
      return {
        isValid: false,
        branchId: null,
        error: 'branch_id is required for multi-branch tenants',
      };
    }
    return {
      isValid: true,
      branchId: null,
      warning: 'branch_id not provided - returning data from all branches',
    };
  }

  // Prevent ReDoS: UUID should be exactly 36 characters (32 hex + 4 hyphens)
  if (branchId.length !== 36) {
    return {
      isValid: false,
      branchId: null,
      error: 'Invalid branch_id format - must be a valid UUID',
    };
  }

  // Validate UUID format
  if (!isValidUUID(branchId)) {
    return {
      isValid: false,
      branchId: null,
      error: 'Invalid branch_id format - must be a valid UUID',
    };
  }

  return {
    isValid: true,
    branchId,
  };
}

/**
 * Verifies that the branch belongs to the tenant
 *
 * @param supabase - Authenticated Supabase client
 * @param branchId - Branch UUID to verify
 * @param tenantId - Tenant UUID
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const ownership = await validateBranchOwnership(supabase, branchId, tenantId);
 * if (!ownership.isValid) {
 *   return NextResponse.json({ error: ownership.error }, { status: 403 });
 * }
 * ```
 */
export async function validateBranchOwnership(
  supabase: SupabaseClient,
  branchId: string,
  tenantId: string
): Promise<{ isValid: boolean; error?: string }> {
  const { data: branch, error } = await supabase
    .from('branches')
    .select('id, tenant_id')
    .eq('id', branchId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !branch) {
    return {
      isValid: false,
      error: 'Branch not found or does not belong to your organization',
    };
  }

  return { isValid: true };
}

// ======================
// APPLY FILTER TO QUERY
// ======================

/**
 * Applies branch filter to a Supabase query
 *
 * @param query - Supabase query builder
 * @param branchId - Branch UUID to filter by (null = no filter)
 * @param tableName - Name of the table being queried
 * @returns Modified query with branch filter applied
 *
 * @example
 * ```typescript
 * let query = supabase.from('leads').select('*');
 * query = applyBranchFilter(query, branchId, 'leads');
 * ```
 */
export function applyBranchFilter<T>(
  query: any, // SupabaseQueryBuilder
  branchId: string | null,
  tableName: string
): any {
  // List of tables that support branch filtering
  const BRANCH_FILTERABLE_TABLES = [
    'leads',
    'appointments',
    'menu_items',
    'menu_categories',
    'inventory_items',
    'staff',
  ];

  // If no branchId or table doesn't support filtering, return query unchanged
  if (!branchId || !BRANCH_FILTERABLE_TABLES.includes(tableName)) {
    return query;
  }

  // Apply filter
  return query.eq('branch_id', branchId);
}

// ======================
// HELPER: RESPONSE HEADERS
// ======================

/**
 * Adds informational headers about branch filtering
 *
 * @param headers - Response headers object
 * @param branchId - Branch UUID used for filtering (null = no filter)
 * @param tenantHasMultipleBranches - Whether tenant has multiple branches
 *
 * @example
 * ```typescript
 * const headers = new Headers();
 * addBranchFilterHeaders(headers, branchId, isMultiBranch);
 * return NextResponse.json(data, { headers });
 * ```
 */
export function addBranchFilterHeaders(
  headers: Headers,
  branchId: string | null,
  tenantHasMultipleBranches: boolean
): void {
  if (branchId) {
    headers.set('X-Filtered-Branch-ID', branchId);
  }

  if (!branchId && tenantHasMultipleBranches) {
    headers.set(
      'X-Branch-Filter-Warning',
      'This tenant has multiple branches but no branch_id was provided. ' +
        'Data from all branches is included. Consider adding ?branch_id=xxx to filter.'
    );
  }
}

// ======================
// HELPER: CHECK MULTI-BRANCH
// ======================

/**
 * Checks if a tenant has multiple branches
 *
 * @param supabase - Authenticated Supabase client
 * @param tenantId - Tenant UUID
 * @returns True if tenant has more than one branch
 *
 * @example
 * ```typescript
 * const isMultiBranch = await tenantHasMultipleBranches(supabase, tenantId);
 * if (isMultiBranch && !branchId) {
 *   // Add warning to response
 * }
 * ```
 */
export async function tenantHasMultipleBranches(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('branches')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (error) return false;

  return (count || 0) > 1;
}

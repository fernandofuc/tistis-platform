// =====================================================
// TIS TIS PLATFORM - API Auth Helper
// Centralized authentication helper for API routes
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ======================
// TYPES
// ======================

export interface UserRole {
  tenant_id: string;
  role: 'owner' | 'admin' | 'manager' | 'staff' | 'viewer';
}

export interface AuthResult {
  user: {
    id: string;
    email?: string;
  };
  userRole: UserRole;
  supabase: SupabaseClient;
}

export interface AuthError {
  error: string;
  status: number;
}

export type GetUserAndTenantResult = AuthResult | AuthError;

// ======================
// HELPERS
// ======================

/**
 * Validates UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Check if result is an error
 */
export function isAuthError(result: GetUserAndTenantResult): result is AuthError {
  return 'error' in result;
}

/**
 * Create error response
 */
export function errorResponse(error: string, status: number = 500) {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Create success response
 */
export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Create success response with message
 */
export function successMessage(message: string, status: number = 200) {
  return NextResponse.json({ success: true, message }, { status });
}

// ======================
// MAIN AUTH FUNCTION
// ======================

/**
 * Get authenticated user and their tenant info
 * Use this in API routes to validate auth and get tenant context
 */
export async function getUserAndTenant(request: NextRequest): Promise<GetUserAndTenantResult> {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'No autorizado', status: 401 };
    }

    const token = authHeader.substring(7);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return { error: 'Token inválido', status: 401 };
    }

    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (roleError || !userRole) {
      return { error: 'Sin tenant asociado', status: 403 };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      userRole: userRole as UserRole,
      supabase,
    };
  } catch (error) {
    console.error('Auth error:', error);
    return { error: 'Error de autenticación', status: 500 };
  }
}

// ======================
// PERMISSION HELPERS
// ======================

type RoleLevel = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer';

const ROLE_HIERARCHY: Record<RoleLevel, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  staff: 40,
  viewer: 20,
};

/**
 * Check if user has at least the required role level
 */
export function hasMinRole(userRole: RoleLevel, requiredRole: RoleLevel): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user can perform write operations (manager+)
 */
export function canWrite(userRole: RoleLevel): boolean {
  return hasMinRole(userRole, 'manager');
}

/**
 * Check if user can perform delete operations (admin+)
 */
export function canDelete(userRole: RoleLevel): boolean {
  return hasMinRole(userRole, 'admin');
}

/**
 * Check if user is owner
 */
export function isOwner(userRole: RoleLevel): boolean {
  return userRole === 'owner';
}

// ======================
// FEATURE FLAG HELPERS
// ======================

/**
 * Check if a feature is enabled for the tenant
 */
export async function isFeatureEnabled(
  supabase: SupabaseClient,
  tenantId: string,
  feature: 'tables_enabled' | 'menu_enabled' | 'kds_enabled' | 'inventory_enabled'
): Promise<boolean> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('feature_flags')
    .eq('id', tenantId)
    .single();

  if (!tenant?.feature_flags) return false;

  return tenant.feature_flags[feature] === true;
}

// ======================
// VALIDATION HELPERS
// ======================

/**
 * Validate required fields in request body
 */
export function validateRequired(body: Record<string, any>, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `El campo '${field}' es requerido`;
    }
  }
  return null;
}

/**
 * Validate UUID parameter
 */
export function validateUUID(id: string, fieldName: string = 'ID'): string | null {
  if (!isValidUUID(id)) {
    return `${fieldName} inválido`;
  }
  return null;
}

// ======================
// USAGE EXAMPLE
// ======================

/*
import { getUserAndTenant, isAuthError, errorResponse, successResponse, canWrite } from '@/lib/api/auth-helper';

export async function POST(request: NextRequest) {
  const auth = await getUserAndTenant(request);

  if (isAuthError(auth)) {
    return errorResponse(auth.error, auth.status);
  }

  const { user, userRole, supabase } = auth;

  if (!canWrite(userRole.role)) {
    return errorResponse('Sin permisos', 403);
  }

  // ... your logic here

  return successResponse(data, 201);
}
*/

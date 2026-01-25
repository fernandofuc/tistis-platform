// =====================================================
// TIS TIS PLATFORM - Authentication Helper
// Reusable authentication context for API routes
// Multi-tenant aware with fallback strategies
// Supports: Bearer tokens, Service calls (INTERNAL_API_KEY), API keys
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { withTimeout } from '@/src/features/auth/utils/networkHelpers';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Timeout for auth operations (10 seconds)
const AUTH_TIMEOUT = 10000;

export interface AuthenticatedContext {
  client: SupabaseClient;
  user: { id: string; email?: string };
  tenantId: string;
  role: string;
  isServiceCall?: boolean;
}

export interface ServiceCallContext {
  client: SupabaseClient;
  isServiceCall: true;
  tenantId?: string;
}

export interface AuthError {
  error: string;
  status: number;
}

export type AuthResult = AuthenticatedContext | AuthError;
export type ServiceAuthResult = AuthenticatedContext | ServiceCallContext | AuthError;

/**
 * Get authenticated context from request
 * Returns user, tenant, and role info if authenticated
 * Uses multiple fallback strategies to find tenant:
 * 1. user_roles table (primary)
 * 2. user_metadata.tenant_id (fallback)
 * 3. staff table by email (last resort)
 */
export async function getAuthenticatedContext(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Authentication required', status: 401 };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Add timeout to getUser call
    const { data: { user }, error: authError } = await withTimeout(
      supabase.auth.getUser(),
      AUTH_TIMEOUT
    );

    if (authError || !user) {
      return { error: 'Invalid or expired token', status: 401 };
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Strategy 1: Try user_roles table (primary method)
    const { data: userRole } = (await withTimeout(
      Promise.resolve(
        serviceClient
          .from('user_roles')
          .select('tenant_id, role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single()
      ),
      AUTH_TIMEOUT
    )) as any;

    if (userRole?.tenant_id) {
      return {
        client: serviceClient,
        user: { id: user.id, email: user.email },
        tenantId: userRole.tenant_id,
        role: userRole.role || 'user',
      };
    }

    // Strategy 2: Try user_metadata.tenant_id (fallback for OAuth/social login)
    const metadataTenantId = user.user_metadata?.tenant_id;
    if (metadataTenantId) {
      // Get role from staff table or default to 'user'
      const { data: staff } = (await withTimeout(
        Promise.resolve(
          serviceClient
            .from('staff')
            .select('role')
            .eq('user_id', user.id)
            .eq('tenant_id', metadataTenantId)
            .single()
        ),
        AUTH_TIMEOUT
      )) as any;

      return {
        client: serviceClient,
        user: { id: user.id, email: user.email },
        tenantId: metadataTenantId,
        role: staff?.role || user.user_metadata?.role || 'user',
      };
    }

    // Strategy 3: Find tenant via staff table by email (last resort)
    if (user.email) {
      const { data: staffByEmail } = (await withTimeout(
        Promise.resolve(
          serviceClient
            .from('staff')
            .select('tenant_id, role')
            .eq('email', user.email)
            .eq('is_active', true)
            .limit(1)
            .single()
        ),
        AUTH_TIMEOUT
      )) as any;

      if (staffByEmail?.tenant_id) {
        return {
          client: serviceClient,
          user: { id: user.id, email: user.email },
          tenantId: staffByEmail.tenant_id,
          role: staffByEmail.role || 'user',
        };
      }
    }

    // No tenant found - user not properly provisioned
    console.error('[auth-helper] No tenant found for user:', user.id, user.email);
    return { error: 'User has no assigned tenant. Please contact support.', status: 403 };
  } catch (error) {
    // Catch timeout or other errors
    console.error('[auth-helper] Exception during authentication:', error);
    return { error: 'Authentication failed. Please try again.', status: 500 };
  }
}

/**
 * Check if result is an error
 */
export function isAuthError(result: AuthResult | ServiceAuthResult): result is AuthError {
  return 'error' in result;
}

/**
 * Check if result is a service call
 */
export function isServiceCall(result: ServiceAuthResult): result is ServiceCallContext {
  return 'isServiceCall' in result && result.isServiceCall === true;
}

/**
 * Create error response from auth error
 */
export function createAuthErrorResponse(error: AuthError): NextResponse {
  return NextResponse.json({ error: error.error }, { status: error.status });
}

/**
 * Timing-safe comparison of two strings
 * Prevents timing attacks on secret comparison
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare with a known string to prevent timing attacks on length
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Check for internal service call (INTERNAL_API_KEY)
 * Uses timing-safe comparison to prevent timing attacks
 */
export function getServiceCallContext(request: NextRequest): ServiceCallContext | null {
  const internalApiKey = request.headers.get('x-internal-api-key');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!internalApiKey) {
    return null;
  }

  if (!expectedKey) {
    // In development, allow if INTERNAL_API_KEY not configured
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth-helper] INTERNAL_API_KEY not configured, allowing service call in development');
      return {
        client: createClient(supabaseUrl, supabaseServiceKey),
        isServiceCall: true,
      };
    }
    return null;
  }

  if (!timingSafeCompare(internalApiKey, expectedKey)) {
    return null;
  }

  return {
    client: createClient(supabaseUrl, supabaseServiceKey),
    isServiceCall: true,
  };
}

/**
 * Get authenticated context with service call support
 * This is the RECOMMENDED function for API routes
 * Handles both user auth and internal service calls
 */
export async function getAuthenticatedContextWithServiceSupport(
  request: NextRequest
): Promise<ServiceAuthResult> {
  // First check for service call
  const serviceContext = getServiceCallContext(request);
  if (serviceContext) {
    return serviceContext;
  }

  // Fall back to user authentication
  return getAuthenticatedContext(request);
}

/**
 * Validate UUID format
 * Prevents SQL injection via malformed UUIDs
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Create a standardized error response for common scenarios
 */
export function createErrorResponse(
  error: string,
  status: number = 400,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    { error, ...(details && { details }) },
    { status }
  );
}

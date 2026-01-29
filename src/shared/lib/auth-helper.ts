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

// Fixed length for timing-safe API key comparison (prevents length-based attacks)
const API_KEY_FIXED_LENGTH = 64;

/**
 * Mask email for logging (PII protection)
 * john.doe@example.com -> j***e@e***e.com
 */
function maskEmail(email: string | undefined): string {
  if (!email) return '[no-email]';
  const [local, domain] = email.split('@');
  if (!domain) return '[invalid-email]';
  const maskedLocal = local.length > 2
    ? `${local[0]}***${local[local.length - 1]}`
    : '***';
  const domainParts = domain.split('.');
  const maskedDomain = domainParts.map(part =>
    part.length > 2 ? `${part[0]}***${part[part.length - 1]}` : part
  ).join('.');
  return `${maskedLocal}@${maskedDomain}`;
}

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
 * Validate UUID format
 * Prevents SQL injection via malformed UUIDs
 */
export function isValidUUID(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Timing-safe comparison of two strings
 * Prevents timing attacks on secret comparison
 * Uses fixed-length padding to prevent length-based timing attacks
 */
export function timingSafeCompare(a: string, b: string): boolean {
  // Pad both strings to fixed length to prevent length-based timing attacks
  const paddedA = a.padEnd(API_KEY_FIXED_LENGTH, '\0').slice(0, API_KEY_FIXED_LENGTH);
  const paddedB = b.padEnd(API_KEY_FIXED_LENGTH, '\0').slice(0, API_KEY_FIXED_LENGTH);

  try {
    const bufferA = Buffer.from(paddedA, 'utf-8');
    const bufferB = Buffer.from(paddedB, 'utf-8');
    return crypto.timingSafeEqual(bufferA, bufferB);
  } catch {
    return false;
  }
}

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

    // Validate user ID is a valid UUID
    if (!isValidUUID(user.id)) {
      console.error('[auth-helper] Invalid user ID format:', user.id);
      return { error: 'Invalid user identification', status: 400 };
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Strategy 1: Try user_roles table (primary method)
    const userRoleResult = await withTimeout(
      Promise.resolve(
        serviceClient
          .from('user_roles')
          .select('tenant_id, role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single()
      ),
      AUTH_TIMEOUT
    );
    const userRole = userRoleResult?.data as { tenant_id: string; role: string } | null;

    if (userRole?.tenant_id) {
      // Validate tenant_id is a valid UUID before using it
      if (!isValidUUID(userRole.tenant_id)) {
        console.error('[auth-helper] Invalid tenant_id in user_roles:', userRole.tenant_id);
        return { error: 'Invalid tenant configuration. Please contact support.', status: 500 };
      }

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
      // Validate tenant_id from metadata
      if (!isValidUUID(metadataTenantId)) {
        console.error('[auth-helper] Invalid tenant_id in user_metadata:', metadataTenantId);
        return { error: 'Invalid tenant configuration. Please contact support.', status: 500 };
      }

      // Get role from staff table or default to 'user'
      const staffResult = await withTimeout(
        Promise.resolve(
          serviceClient
            .from('staff')
            .select('role')
            .eq('user_id', user.id)
            .eq('tenant_id', metadataTenantId)
            .single()
        ),
        AUTH_TIMEOUT
      );
      const staff = staffResult?.data as { role: string } | null;

      return {
        client: serviceClient,
        user: { id: user.id, email: user.email },
        tenantId: metadataTenantId,
        role: staff?.role || user.user_metadata?.role || 'user',
      };
    }

    // Strategy 3: Find tenant via staff table by email (last resort)
    if (user.email) {
      const staffByEmailResult = await withTimeout(
        Promise.resolve(
          serviceClient
            .from('staff')
            .select('tenant_id, role')
            .eq('email', user.email.toLowerCase()) // Normalize email
            .eq('is_active', true)
            .limit(1)
            .single()
        ),
        AUTH_TIMEOUT
      );
      const staffByEmail = staffByEmailResult?.data as { tenant_id: string; role: string } | null;

      if (staffByEmail?.tenant_id) {
        // Validate tenant_id from staff lookup
        if (!isValidUUID(staffByEmail.tenant_id)) {
          console.error('[auth-helper] Invalid tenant_id in staff:', staffByEmail.tenant_id);
          return { error: 'Invalid tenant configuration. Please contact support.', status: 500 };
        }

        return {
          client: serviceClient,
          user: { id: user.id, email: user.email },
          tenantId: staffByEmail.tenant_id,
          role: staffByEmail.role || 'user',
        };
      }
    }

    // No tenant found - user not properly provisioned
    // Use masked email to protect PII in logs
    console.error('[auth-helper] No tenant found for user:', user.id, maskEmail(user.email));
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

  // Use timing-safe comparison with fixed-length padding
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

/**
 * Validate and sanitize tenant ID from request
 * Returns null if invalid
 */
export function validateTenantId(tenantId: unknown): string | null {
  if (!tenantId || typeof tenantId !== 'string') {
    return null;
  }
  return isValidUUID(tenantId) ? tenantId : null;
}

/**
 * Validate request body has required tenant ID
 * Returns error response if invalid, null if valid
 */
export function validateRequiredTenantId(
  tenantId: unknown,
  fieldName: string = 'tenant_id'
): { tenantId: string } | { error: NextResponse } {
  const validatedId = validateTenantId(tenantId);
  if (!validatedId) {
    return {
      error: createErrorResponse(
        `Invalid or missing ${fieldName}`,
        400,
        { field: fieldName }
      ),
    };
  }
  return { tenantId: validatedId };
}

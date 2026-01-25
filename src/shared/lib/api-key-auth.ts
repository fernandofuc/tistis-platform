// =====================================================
// TIS TIS PLATFORM - API Key Authentication
// Middleware for authenticating requests via API Keys
// FASE 2: Enhanced with branch context support
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  hashAPIKey,
  validateAPIKeyFormat,
  extractEnvironment,
} from '@/src/features/api-settings/utils/keyGenerator';
import type { APIKeyEnvironment, APIScope } from '@/src/features/api-settings/types';

// ======================
// CONSTANTS
// ======================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ======================
// TYPES
// ======================

/**
 * Result of API Key authentication
 * FASE 2: Enhanced with branch context
 */
export interface APIKeyAuthResult {
  success: boolean;
  keyId?: string;
  tenantId?: string;
  branchId?: string | null;          // ✅ NUEVO - FASE 2
  scopeType?: 'tenant' | 'branch';   // ✅ NUEVO - FASE 2
  environment?: APIKeyEnvironment;
  scopes?: APIScope[];
  rateLimits?: {
    rpm: number;
    daily: number;
  };
  error?: string;
  errorCode?: APIKeyErrorCode;
  statusCode?: number;
}

/**
 * Error codes for API Key validation failures
 */
export type APIKeyErrorCode =
  | 'MISSING_AUTH_HEADER'
  | 'INVALID_AUTH_FORMAT'
  | 'INVALID_KEY_FORMAT'
  | 'KEY_NOT_FOUND'
  | 'KEY_REVOKED'
  | 'KEY_EXPIRED'
  | 'IP_NOT_ALLOWED'
  | 'SCOPE_REQUIRED'
  | 'INTERNAL_ERROR';

/**
 * Context passed to authenticated API routes
 * FASE 2: Enhanced with branch context
 */
export interface APIKeyContext {
  client: SupabaseClient;
  keyId: string;
  tenantId: string;
  branchId: string | null;           // ✅ NUEVO - FASE 2
  scopeType: 'tenant' | 'branch';    // ✅ NUEVO - FASE 2
  environment: APIKeyEnvironment;
  scopes: APIScope[];
  rateLimits: {
    rpm: number;
    daily: number;
  };
}

/**
 * Branch filter context helper
 * FASE 2: NEW
 */
export interface BranchFilterContext {
  branchId: string | null;
  scopeType: 'tenant' | 'branch';
  hasBranchAccess: (targetBranchId: string) => boolean;
}

// ======================
// MAIN AUTHENTICATION FUNCTION
// ======================

/**
 * Authenticate a request using an API Key
 *
 * @param request - The incoming NextRequest
 * @param options - Optional configuration
 * @returns APIKeyAuthResult with success status and context data
 *
 * @example
 * ```typescript
 * const auth = await authenticateAPIKey(request, { requiredScope: 'leads:read' });
 * if (!auth.success) {
 *   return createAPIKeyErrorResponse(auth);
 * }
 * // auth.tenantId, auth.scopes are available
 * ```
 */
export async function authenticateAPIKey(
  request: NextRequest,
  options?: {
    requiredScope?: APIScope;
    requiredScopes?: APIScope[];
    allowTestKeys?: boolean;
  }
): Promise<APIKeyAuthResult> {
  try {
    // 1. Extract API Key from Authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return {
        success: false,
        error: 'Missing Authorization header',
        errorCode: 'MISSING_AUTH_HEADER',
        statusCode: 401,
      };
    }

    if (!authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Invalid Authorization header format. Use: Bearer <api_key>',
        errorCode: 'INVALID_AUTH_FORMAT',
        statusCode: 401,
      };
    }

    const apiKey = authHeader.slice(7).trim();

    if (!apiKey) {
      return {
        success: false,
        error: 'API key is empty',
        errorCode: 'INVALID_KEY_FORMAT',
        statusCode: 401,
      };
    }

    // 2. Validate API Key format
    if (!validateAPIKeyFormat(apiKey)) {
      return {
        success: false,
        error: 'Invalid API key format',
        errorCode: 'INVALID_KEY_FORMAT',
        statusCode: 401,
      };
    }

    // 3. Check if test keys are allowed (production endpoints should reject test keys)
    const environment = extractEnvironment(apiKey);
    if (environment === 'test' && options?.allowTestKeys === false) {
      return {
        success: false,
        error: 'Test API keys are not allowed for this endpoint',
        errorCode: 'KEY_NOT_FOUND',
        statusCode: 401,
      };
    }

    // 4. Hash the key and look it up in the database
    const keyHash = hashAPIKey(apiKey);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: keyRecord, error: dbError } = await supabase
      .from('api_keys')
      .select(`
        id,
        tenant_id,
        branch_id,
        scope_type,
        environment,
        scopes,
        rate_limit_rpm,
        rate_limit_daily,
        ip_whitelist,
        expires_at,
        is_active,
        usage_count
      `)
      .eq('key_hash', keyHash)
      .single();

    if (dbError || !keyRecord) {
      return {
        success: false,
        error: 'Invalid API key',
        errorCode: 'KEY_NOT_FOUND',
        statusCode: 401,
      };
    }

    // 5. Check if key is active
    if (!keyRecord.is_active) {
      return {
        success: false,
        error: 'API key has been revoked',
        errorCode: 'KEY_REVOKED',
        statusCode: 401,
      };
    }

    // 6. Check expiration
    if (keyRecord.expires_at) {
      const expiresAt = new Date(keyRecord.expires_at);
      if (expiresAt < new Date()) {
        return {
          success: false,
          error: 'API key has expired',
          errorCode: 'KEY_EXPIRED',
          statusCode: 401,
        };
      }
    }

    // 7. Check IP whitelist if configured
    if (keyRecord.ip_whitelist && keyRecord.ip_whitelist.length > 0) {
      const clientIP = getClientIP(request);

      if (clientIP && !isIPAllowed(clientIP, keyRecord.ip_whitelist)) {
        return {
          success: false,
          error: 'IP address not allowed',
          errorCode: 'IP_NOT_ALLOWED',
          statusCode: 403,
        };
      }
    }

    // 8. Check required scope(s)
    const keyScopes = (keyRecord.scopes || []) as APIScope[];

    if (options?.requiredScope) {
      if (!keyScopes.includes(options.requiredScope)) {
        return {
          success: false,
          error: `Missing required scope: ${options.requiredScope}`,
          errorCode: 'SCOPE_REQUIRED',
          statusCode: 403,
        };
      }
    }

    if (options?.requiredScopes && options.requiredScopes.length > 0) {
      const missingScopes = options.requiredScopes.filter(
        (scope) => !keyScopes.includes(scope)
      );
      if (missingScopes.length > 0) {
        return {
          success: false,
          error: `Missing required scopes: ${missingScopes.join(', ')}`,
          errorCode: 'SCOPE_REQUIRED',
          statusCode: 403,
        };
      }
    }

    // 9. Update last_used_at and usage_count (non-blocking)
    updateKeyUsage(supabase, keyRecord.id, request).catch((err) => {
      console.error('[API Key Auth] Failed to update usage:', err);
    });

    // 10. Return success with context (✅ FASE 2: includes branch context)
    return {
      success: true,
      keyId: keyRecord.id,
      tenantId: keyRecord.tenant_id,
      branchId: keyRecord.branch_id || null,          // ✅ NUEVO - FASE 2
      scopeType: keyRecord.scope_type || 'tenant',    // ✅ NUEVO - FASE 2
      environment: keyRecord.environment as APIKeyEnvironment,
      scopes: keyScopes,
      rateLimits: {
        rpm: keyRecord.rate_limit_rpm,
        daily: keyRecord.rate_limit_daily,
      },
    };
  } catch (error) {
    console.error('[API Key Auth] Unexpected error:', error);
    return {
      success: false,
      error: 'Internal authentication error',
      errorCode: 'INTERNAL_ERROR',
      statusCode: 500,
    };
  }
}

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Get client IP from request headers
 */
function getClientIP(request: NextRequest): string | null {
  // Try various headers (in order of reliability)
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIP = request.headers.get('x-real-ip');
  if (xRealIP) {
    return xRealIP.trim();
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  return null;
}

/**
 * Check if an IP is in the whitelist
 * Supports both exact matches and CIDR notation
 */
function isIPAllowed(clientIP: string, whitelist: string[]): boolean {
  for (const allowed of whitelist) {
    // Exact match
    if (clientIP === allowed) {
      return true;
    }

    // CIDR notation check (simplified - for full support use a library)
    if (allowed.includes('/')) {
      if (isIPInCIDR(clientIP, allowed)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Simple CIDR check for IPv4
 * For production use, consider using a library like 'ip-cidr'
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    if (ipNum === null || rangeNum === null) {
      return false;
    }

    return (ipNum & mask) === (rangeNum & mask);
  } catch {
    return false;
  }
}

/**
 * Convert IPv4 address to number
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }

  let num = 0;
  for (const part of parts) {
    const octet = parseInt(part, 10);
    if (isNaN(octet) || octet < 0 || octet > 255) {
      return null;
    }
    num = (num << 8) + octet;
  }

  return num >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Update key usage statistics (non-blocking)
 * Uses atomic SQL update to avoid race conditions
 */
async function updateKeyUsage(
  supabase: SupabaseClient,
  keyId: string,
  request: NextRequest
): Promise<void> {
  const clientIP = getClientIP(request);
  const endpoint = new URL(request.url).pathname;

  // Use atomic update with SQL expressions to avoid race conditions
  // The trigger `reset_api_key_daily_usage` handles daily counter reset
  const { error } = await supabase.rpc('increment_api_key_usage', {
    p_key_id: keyId,
    p_ip: clientIP,
    p_endpoint: endpoint,
  });

  // Fallback to direct update if RPC doesn't exist
  if (error?.code === 'PGRST202') {
    // RPC not found, use direct atomic update
    await supabase
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        last_used_ip: clientIP,
        last_used_endpoint: endpoint,
        // usage_count increment is handled by trigger or we accept slight inaccuracy
      })
      .eq('id', keyId);
  }
}

// ======================
// RESPONSE HELPERS
// ======================

/**
 * Create a standardized error response for API Key authentication failures
 */
export function createAPIKeyErrorResponse(result: APIKeyAuthResult): NextResponse {
  const status = result.statusCode || 500;

  const body: Record<string, unknown> = {
    error: result.error || 'Authentication failed',
  };

  if (result.errorCode) {
    body.code = result.errorCode;
  }

  const headers: Record<string, string> = {};

  // Add WWW-Authenticate header for 401 responses
  if (status === 401) {
    headers['WWW-Authenticate'] = 'Bearer realm="TIS TIS API"';
  }

  return NextResponse.json(body, { status, headers });
}

/**
 * Check if authentication result is an error
 */
export function isAPIKeyAuthError(result: APIKeyAuthResult): boolean {
  return !result.success;
}

/**
 * Create an API Key authenticated Supabase client
 * Use this in your API routes after successful authentication
 */
export function createAPIKeyAuthenticatedClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ======================
// SCOPE CHECKING UTILITIES
// ======================

/**
 * Check if a set of scopes includes a specific scope
 */
export function hasScope(scopes: APIScope[], required: APIScope): boolean {
  return scopes.includes(required);
}

/**
 * Check if a set of scopes includes any of the required scopes
 */
export function hasAnyScope(scopes: APIScope[], required: APIScope[]): boolean {
  return required.some((scope) => scopes.includes(scope));
}

/**
 * Check if a set of scopes includes all of the required scopes
 */
export function hasAllScopes(scopes: APIScope[], required: APIScope[]): boolean {
  return required.every((scope) => scopes.includes(scope));
}

// ======================
// FASE 2: BRANCH FILTER UTILITIES
// ======================

/**
 * Create a branch filter context helper from auth result
 * FASE 2: NEW
 *
 * @param auth - API Key authentication result
 * @returns Branch filter context with helper function
 *
 * @example
 * ```typescript
 * const context = createBranchFilterContext(auth);
 * if (!context.hasBranchAccess(requestedBranchId)) {
 *   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
 * }
 * ```
 */
export function createBranchFilterContext(auth: APIKeyAuthResult): BranchFilterContext {
  return {
    branchId: auth.branchId || null,
    scopeType: auth.scopeType || 'tenant',

    // Helper function: verifica si key tiene acceso a un branch específico
    hasBranchAccess: (targetBranchId: string): boolean => {
      // Caso 1: Key tenant-wide (legacy) → acceso a todos los branches
      if (auth.scopeType === 'tenant' || !auth.branchId) {
        return true;
      }

      // Caso 2: Key branch-specific → solo su branch
      return auth.branchId === targetBranchId;
    },
  };
}

/**
 * Apply automatic branch filtering to a Supabase query
 * FASE 2: NEW - Middleware automático con validación de seguridad
 *
 * IMPORTANTE - Lógica de filtrado con validación de seguridad:
 *
 * 1. Si API Key es BRANCH-SPECIFIC:
 *    - Query parameter se IGNORA (seguridad)
 *    - Siempre filtra por el branch de la API Key
 *    - Previene acceso cross-branch
 *
 * 2. Si API Key es TENANT-WIDE:
 *    - Query parameter tiene prioridad (backward compat FASE 1)
 *    - Sin query param = sin filtro (acceso a todos los branches)
 *
 * @param query - Supabase query builder
 * @param auth - API Key authentication result
 * @param tableName - Name of the table being queried
 * @param queryParamBranchId - Optional branch_id from query parameter (FASE 1)
 * @returns Modified query with branch filter applied
 *
 * @example
 * ```typescript
 * let query = supabase.from('leads').select('*');
 * query = applyAutomaticBranchFilter(query, auth, 'leads', queryBranchId);
 * ```
 */
export function applyAutomaticBranchFilter<Q extends { eq: (column: string, value: unknown) => Q }>(
  query: Q,
  auth: APIKeyAuthResult,
  tableName: string,
  queryParamBranchId?: string | null
): Q {
  // Lista de tablas con soporte de branch filtering
  const BRANCH_FILTERABLE_TABLES = [
    'leads',
    'appointments',
    'menu_items',
    'menu_categories',
    'inventory_items',
    'staff',
  ];

  // Si tabla no soporta branch filtering, retornar sin cambios
  if (!BRANCH_FILTERABLE_TABLES.includes(tableName)) {
    return query;
  }

  // Determinar qué branch_id usar con validación de seguridad
  let effectiveBranchId: string | null = null;

  // ✅ CASO 1: API Key es BRANCH-SPECIFIC
  // Query parameter se IGNORA por seguridad - la key solo puede acceder a su branch
  if (auth.scopeType === 'branch' && auth.branchId) {
    effectiveBranchId = auth.branchId;
  }
  // ✅ CASO 2: API Key es TENANT-WIDE
  // Query parameter tiene prioridad (backward compat FASE 1)
  else if (auth.scopeType === 'tenant' || !auth.branchId) {
    // Prioridad al query parameter si existe
    if (queryParamBranchId) {
      effectiveBranchId = queryParamBranchId;
    }
    // Sin query param = sin filtro (tenant-wide access)
  }

  // Si hay branch_id efectivo, aplicar filtro
  if (effectiveBranchId) {
    return query.eq('branch_id', effectiveBranchId);
  }

  // Sin filtro (tenant-wide access)
  return query;
}

// ======================
// MIDDLEWARE WRAPPER
// ======================

/**
 * Higher-order function to wrap API routes with API Key authentication
 *
 * @example
 * ```typescript
 * export const GET = withAPIKeyAuth(
 *   async (request, context) => {
 *     // context.keyId, context.tenantId, etc. available
 *     return NextResponse.json({ data: 'protected' });
 *   },
 *   { requiredScope: 'leads:read' }
 * );
 * ```
 */
export function withAPIKeyAuth(
  handler: (
    request: NextRequest,
    context: APIKeyContext,
    params?: Record<string, string>
  ) => Promise<NextResponse>,
  options?: {
    requiredScope?: APIScope;
    requiredScopes?: APIScope[];
    allowTestKeys?: boolean;
  }
) {
  return async (
    request: NextRequest,
    { params }: { params?: Promise<Record<string, string>> } = {}
  ): Promise<NextResponse> => {
    const auth = await authenticateAPIKey(request, options);

    if (!auth.success) {
      return createAPIKeyErrorResponse(auth);
    }

    const context: APIKeyContext = {
      client: createAPIKeyAuthenticatedClient(),
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      branchId: auth.branchId || null,          // ✅ NUEVO - FASE 2
      scopeType: auth.scopeType || 'tenant',    // ✅ NUEVO - FASE 2
      environment: auth.environment!,
      scopes: auth.scopes!,
      rateLimits: auth.rateLimits!,
    };

    const resolvedParams = params ? await params : undefined;
    return handler(request, context, resolvedParams);
  };
}

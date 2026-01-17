// =====================================================
// TIS TIS PLATFORM - API Key Authentication Service
// Middleware-like service for authenticating API requests
// =====================================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { hashAPIKey, validateAPIKeyFormat } from '../utils/keyGenerator';
import { hasScope, getScopeForEndpoint } from '../utils/scopeValidator';
import { buildRateLimitHeaders, RATE_LIMIT_ERRORS } from '../constants/rateLimits';
import type {
  APIKeyValidationResult,
  APIKeyEnvironment,
  APIScope,
} from '../types';

// ======================
// TYPES
// ======================

export interface APIKeyAuthResult {
  success: boolean;
  keyId?: string;
  tenantId?: string;
  environment?: APIKeyEnvironment;
  scopes?: string[];
  rateLimitHeaders?: Record<string, string>;
  error?: {
    status: number;
    code: string;
    message: string;
  };
}

export interface APIKeyContext {
  keyId: string;
  tenantId: string;
  environment: APIKeyEnvironment;
  scopes: string[];
  supabase: ReturnType<typeof createClient>;
}

// ======================
// CONSTANTS
// ======================

const AUTHORIZATION_HEADER = 'Authorization';
const API_KEY_HEADER = 'X-API-Key'; // Alternative header
const BEARER_PREFIX = 'Bearer ';

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Extract API key from request headers
 * Supports:
 * - Authorization: Bearer tis_...
 * - X-API-Key: tis_...
 */
function extractAPIKey(request: NextRequest): string | null {
  // Try X-API-Key header first (preferred for API keys)
  const xApiKey = request.headers.get(API_KEY_HEADER);
  if (xApiKey && xApiKey.startsWith('tis_')) {
    return xApiKey;
  }

  // Try Authorization header
  const authHeader = request.headers.get(AUTHORIZATION_HEADER);
  if (!authHeader) {
    return null;
  }

  // Support "Bearer tis_..."
  if (authHeader.startsWith(BEARER_PREFIX)) {
    const token = authHeader.slice(BEARER_PREFIX.length);
    if (token.startsWith('tis_')) {
      return token;
    }
  }

  // Support direct key in Authorization header
  if (authHeader.startsWith('tis_')) {
    return authHeader;
  }

  return null;
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string | null {
  // Check X-Forwarded-For header first (for proxied requests)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to connection IP (may not be available in all environments)
  return null;
}

/**
 * Check if IP is in whitelist (supports CIDR notation)
 */
function isIPAllowed(clientIP: string | null, whitelist: string[] | null): boolean {
  // If no whitelist, allow all
  if (!whitelist || whitelist.length === 0) {
    return true;
  }

  // If no client IP detected, deny
  if (!clientIP) {
    return false;
  }

  // Simple check - exact match or CIDR range check
  // For production, use a proper IP library for CIDR matching
  return whitelist.some((allowed) => {
    // Exact match
    if (allowed === clientIP) {
      return true;
    }

    // Simple CIDR check (basic implementation)
    // For production, use a library like ip-address or ipaddr.js
    if (allowed.includes('/')) {
      // Basic check - just compare the network portion
      const [network] = allowed.split('/');
      return clientIP.startsWith(network.split('.').slice(0, 3).join('.'));
    }

    return false;
  });
}

// ======================
// MAIN AUTHENTICATION
// ======================

/**
 * Authenticate an API request using API Key
 *
 * Usage in route handlers:
 * ```ts
 * const auth = await authenticateAPIKey(request);
 * if (!auth.success) {
 *   return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status });
 * }
 * // Use auth.tenantId, auth.keyId, etc.
 * ```
 */
export async function authenticateAPIKey(
  request: NextRequest,
  options?: {
    requiredScope?: APIScope;
    checkRateLimit?: boolean;
  }
): Promise<APIKeyAuthResult> {
  const { requiredScope, checkRateLimit = true } = options || {};

  // 1. Extract API key from header
  const apiKey = extractAPIKey(request);

  if (!apiKey) {
    return {
      success: false,
      error: {
        status: 401,
        code: 'MISSING_API_KEY',
        message: 'API key is required. Use X-API-Key: tis_... or Authorization: Bearer tis_...',
      },
    };
  }

  // 2. Validate key format
  if (!validateAPIKeyFormat(apiKey)) {
    return {
      success: false,
      error: {
        status: 401,
        code: 'INVALID_API_KEY_FORMAT',
        message: 'Invalid API key format',
      },
    };
  }

  // 3. Create admin Supabase client for validation
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[API Key Auth] Missing Supabase credentials');
    return {
      success: false,
      error: {
        status: 500,
        code: 'SERVER_ERROR',
        message: 'Server configuration error',
      },
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 4. Hash the key and look it up
  const keyHash = hashAPIKey(apiKey);

  const { data: validationResult, error: validationError } = await supabase.rpc(
    'validate_api_key',
    { p_key_hash: keyHash }
  );

  if (validationError) {
    console.error('[API Key Auth] Validation error:', validationError);
    return {
      success: false,
      error: {
        status: 500,
        code: 'VALIDATION_ERROR',
        message: 'Error validating API key',
      },
    };
  }

  // 5. Check validation result
  const result = validationResult as APIKeyValidationResult & {
    valid: boolean;
    error?: string;
    key_id?: string;
    tenant_id?: string;
    scopes?: string[];
    ip_whitelist?: string[];
    rate_limit_rpm?: number;
    rate_limit_daily?: number;
    usage_today?: number;
  };

  if (!result.valid) {
    const errorMap: Record<string, { status: number; code: string; message: string }> = {
      invalid_key: { status: 401, code: 'KEY_NOT_FOUND', message: 'Invalid API key' },
      key_revoked: { status: 401, code: 'KEY_REVOKED', message: 'API key has been revoked' },
      key_expired: { status: 401, code: 'KEY_EXPIRED', message: 'API key has expired' },
    };

    const errorInfo = errorMap[result.error || 'invalid_key'] || errorMap.invalid_key;
    return {
      success: false,
      error: errorInfo,
    };
  }

  // 6. Check IP whitelist
  const clientIP = getClientIP(request);
  if (!isIPAllowed(clientIP, result.ip_whitelist || null)) {
    return {
      success: false,
      error: {
        status: 403,
        code: 'IP_NOT_ALLOWED',
        message: 'Your IP address is not allowed to use this API key',
      },
    };
  }

  // 7. Check rate limits if enabled
  let rateLimitHeaders: Record<string, string> | undefined;

  if (checkRateLimit && result.key_id) {
    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
      'check_api_key_rate_limit',
      { p_api_key_id: result.key_id }
    );

    if (rateLimitError) {
      console.error('[API Key Auth] Rate limit check error:', rateLimitError);
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      const isMinuteLimit = rateLimitResult.reason === 'rate_limit_minute';
      const retryAfter = rateLimitResult.retry_after_seconds || 60;

      return {
        success: false,
        rateLimitHeaders: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': '0',
        },
        error: {
          status: 429,
          code: isMinuteLimit ? 'RATE_LIMIT_MINUTE' : 'RATE_LIMIT_DAILY',
          message: isMinuteLimit
            ? RATE_LIMIT_ERRORS.MINUTE_EXCEEDED(rateLimitResult.limit, retryAfter)
            : RATE_LIMIT_ERRORS.DAILY_EXCEEDED(rateLimitResult.limit),
        },
      };
    } else if (rateLimitResult) {
      // Build rate limit headers for successful requests
      rateLimitHeaders = buildRateLimitHeaders(
        rateLimitResult.limit_rpm,
        rateLimitResult.remaining_minute,
        Date.now() + 60000 // Reset in 1 minute
      );
    }
  }

  // 8. Check required scope if specified
  if (requiredScope && result.scopes) {
    if (!hasScope(result.scopes, requiredScope)) {
      return {
        success: false,
        error: {
          status: 403,
          code: 'INSUFFICIENT_SCOPE',
          message: `Missing required scope: ${requiredScope}`,
        },
      };
    }
  }

  // 9. Auto-detect scope from endpoint if no explicit scope
  if (!requiredScope) {
    const endpoint = new URL(request.url).pathname;
    const method = request.method;
    const autoScope = getScopeForEndpoint(endpoint, method);

    if (autoScope && result.scopes && !hasScope(result.scopes, autoScope)) {
      return {
        success: false,
        error: {
          status: 403,
          code: 'INSUFFICIENT_SCOPE',
          message: `Missing required scope: ${autoScope}`,
        },
      };
    }
  }

  // 10. Success!
  return {
    success: true,
    keyId: result.key_id,
    tenantId: result.tenant_id,
    environment: apiKey.startsWith('tis_test_') ? 'test' : 'live',
    scopes: result.scopes,
    rateLimitHeaders,
  };
}

/**
 * Log API key usage (call after processing request)
 */
export async function logAPIKeyUsage(
  keyId: string,
  tenantId: string,
  request: NextRequest,
  response: {
    statusCode: number;
    responseTimeMs: number;
    errorMessage?: string;
  },
  scopeUsed?: string
): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const clientIP = getClientIP(request);
    const endpoint = new URL(request.url).pathname;

    await supabase.rpc('log_api_key_usage', {
      p_api_key_id: keyId,
      p_tenant_id: tenantId,
      p_endpoint: endpoint,
      p_method: request.method,
      p_scope_used: scopeUsed || null,
      p_status_code: response.statusCode,
      p_response_time_ms: response.responseTimeMs,
      p_ip_address: clientIP,
      p_user_agent: request.headers.get('user-agent') || null,
      p_error_message: response.errorMessage || null,
      p_request_path: request.url,
    });
  } catch (error) {
    console.error('[API Key Auth] Error logging usage:', error);
  }
}

/**
 * Create error response with proper headers
 */
export function createAPIKeyErrorResponse(
  result: APIKeyAuthResult
): NextResponse {
  const body = {
    error: {
      code: result.error?.code || 'UNKNOWN_ERROR',
      message: result.error?.message || 'An error occurred',
    },
  };

  const response = NextResponse.json(body, {
    status: result.error?.status || 500,
  });

  // Add rate limit headers if present
  if (result.rateLimitHeaders) {
    Object.entries(result.rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

/**
 * Add rate limit headers to successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  headers?: Record<string, string>
): NextResponse {
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  return response;
}

// =====================================================
// TIS TIS PLATFORM - Admin Authentication Utility
// Secure admin endpoint protection with timing-safe comparison
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { checkRateLimit, getClientIP, strictLimiter, rateLimitExceeded } from './rate-limit';

// ======================
// TYPES
// ======================
export interface AdminAuthResult {
  authorized: boolean;
  response?: NextResponse;
  reason?: string;
}

export interface AdminAuthConfig {
  /** Require ADMIN_API_KEY even in development (default: true for safety) */
  requireInDev?: boolean;
  /** Apply rate limiting to admin endpoints (default: true) */
  rateLimit?: boolean;
  /** Custom rate limit config */
  rateLimitConfig?: {
    limit: number;
    windowSeconds: number;
    identifier: string;
  };
}

// ======================
// MAIN FUNCTION
// ======================

/**
 * Verify admin API key with timing-safe comparison
 *
 * SECURITY IMPROVEMENTS over previous implementation:
 * 1. Requires ADMIN_API_KEY in development by default (can be overridden)
 * 2. Includes rate limiting to prevent brute force
 * 3. Logs failed attempts for security monitoring
 * 4. Returns detailed response for proper error handling
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const auth = verifyAdminAuth(request);
 *   if (!auth.authorized) return auth.response;
 *
 *   // Your admin logic here...
 * }
 */
export function verifyAdminAuth(
  request: NextRequest,
  config: AdminAuthConfig = {}
): AdminAuthResult {
  const { requireInDev = true, rateLimit: applyRateLimit = true } = config;

  const clientIP = getClientIP(request);
  const path = request.nextUrl.pathname;

  // Apply rate limiting first to prevent brute force
  if (applyRateLimit) {
    const rateLimitConfig = config.rateLimitConfig || {
      ...strictLimiter,
      identifier: 'admin-auth',
    };

    const rateLimitResult = checkRateLimit(clientIP, rateLimitConfig);

    if (!rateLimitResult.success) {
      console.warn(`[AdminAuth] Rate limit exceeded for IP: ${clientIP} on ${path}`);
      return {
        authorized: false,
        response: rateLimitExceeded(rateLimitResult),
        reason: 'rate_limit_exceeded',
      };
    }
  }

  const adminKey = request.headers.get('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;

  // SECURITY: Check if ADMIN_API_KEY is configured
  if (!expectedKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[AdminAuth] CRITICAL: ADMIN_API_KEY not configured in production');
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        ),
        reason: 'missing_config',
      };
    }

    // In development, only allow if explicitly configured to skip
    if (requireInDev) {
      console.warn('[AdminAuth] ADMIN_API_KEY not set. Set requireInDev=false to skip in dev.');
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Admin API key required. Set ADMIN_API_KEY in .env.local' },
          { status: 401 }
        ),
        reason: 'missing_key_dev',
      };
    }

    // Allow in development when explicitly configured
    console.debug('[AdminAuth] Allowing dev access without key (requireInDev=false)');
    return { authorized: true };
  }

  // Check if key was provided
  if (!adminKey) {
    console.warn(`[AdminAuth] Missing x-admin-key header from ${clientIP} on ${path}`);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
      reason: 'no_key_provided',
    };
  }

  // Timing-safe comparison to prevent timing attacks
  try {
    const keyBuffer = Buffer.from(adminKey);
    const expectedBuffer = Buffer.from(expectedKey);

    // Check length first (this comparison is not timing-safe but necessary)
    if (keyBuffer.length !== expectedBuffer.length) {
      console.warn(`[AdminAuth] Invalid key length from ${clientIP} on ${path}`);
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        ),
        reason: 'invalid_key',
      };
    }

    if (!timingSafeEqual(keyBuffer, expectedBuffer)) {
      console.warn(`[AdminAuth] Invalid admin key from ${clientIP} on ${path}`);
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        ),
        reason: 'invalid_key',
      };
    }

    // Success
    return { authorized: true };
  } catch (error) {
    console.error('[AdminAuth] Error during key verification:', error);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      ),
      reason: 'verification_error',
    };
  }
}

/**
 * Quick check if admin key is valid (for conditional logic)
 * Does NOT include rate limiting - use verifyAdminAuth for full protection
 */
export function isValidAdminKey(request: NextRequest): boolean {
  const result = verifyAdminAuth(request, { rateLimit: false });
  return result.authorized;
}

export default verifyAdminAuth;

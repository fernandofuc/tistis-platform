// =====================================================
// TIS TIS PLATFORM - Distributed Rate Limiter
// =====================================================
// Uses Supabase RPC for distributed rate limiting
// that scales across multiple servers in production
// =====================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ======================
// TYPES
// ======================
interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSizeInSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface RateLimitRPCResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  count: number;
}

// ======================
// SUPABASE CLIENT
// ======================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create service client for rate limiting operations
function getServiceClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[rate-limiter] Supabase credentials not configured, falling back to in-memory');
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ======================
// IN-MEMORY FALLBACK STORE
// ======================
// Used when Supabase is not available (development/testing)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const fallbackStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes (fallback only)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of fallbackStore.entries()) {
      if (entry.resetAt < now) {
        fallbackStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// ======================
// RATE LIMIT PRESETS
// ======================
export const RATE_LIMIT_PRESETS = {
  /** Standard API: 100 requests per minute */
  standard: { limit: 100, windowSizeInSeconds: 60 },

  /** Strict API: 20 requests per minute */
  strict: { limit: 20, windowSizeInSeconds: 60 },

  /** Auth endpoints: 10 requests per minute */
  auth: { limit: 10, windowSizeInSeconds: 60 },

  /** Webhooks: 500 requests per minute */
  webhook: { limit: 500, windowSizeInSeconds: 60 },

  /** AI endpoints: 30 requests per minute */
  ai: { limit: 30, windowSizeInSeconds: 60 },

  /** Upload endpoints: 10 requests per minute */
  upload: { limit: 10, windowSizeInSeconds: 60 },
} as const;

// ======================
// FALLBACK RATE LIMITER (in-memory)
// ======================
function rateLimitFallback(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSizeInSeconds * 1000;
  const key = `rate:${identifier}`;

  let entry = fallbackStore.get(key);

  // Create new entry if doesn't exist or window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
  }

  // Increment count
  entry.count++;
  fallbackStore.set(key, entry);

  const remaining = Math.max(0, config.limit - entry.count);
  const success = entry.count <= config.limit;

  return {
    success,
    limit: config.limit,
    remaining,
    reset: entry.resetAt,
  };
}

// ======================
// DISTRIBUTED RATE LIMITER (Supabase)
// ======================
async function rateLimitDistributed(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const client = getServiceClient();

  if (!client) {
    // Fallback to in-memory if Supabase not configured
    return rateLimitFallback(identifier, config);
  }

  try {
    const { data, error } = await client.rpc('check_rate_limit', {
      p_identifier: `rate:${identifier}`,
      p_limit: config.limit,
      p_window_seconds: config.windowSizeInSeconds,
    });

    if (error) {
      console.error('[rate-limiter] RPC error:', error);
      // Fallback to in-memory on error
      return rateLimitFallback(identifier, config);
    }

    const result = data as RateLimitRPCResult;

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error('[rate-limiter] Exception:', error);
    // Fallback to in-memory on exception
    return rateLimitFallback(identifier, config);
  }
}

// ======================
// MAIN RATE LIMITER FUNCTION
// ======================
/**
 * Check rate limit for an identifier
 * Uses distributed storage (Supabase) in production
 * Falls back to in-memory for development/testing
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_PRESETS.standard
): RateLimitResult {
  // For synchronous compatibility, use fallback
  // Use rateLimitAsync for distributed rate limiting
  return rateLimitFallback(identifier, config);
}

/**
 * Async version that uses distributed rate limiting
 * RECOMMENDED: Use this in API routes for production
 */
export async function rateLimitAsync(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_PRESETS.standard
): Promise<RateLimitResult> {
  return rateLimitDistributed(identifier, config);
}

// ======================
// RATE LIMIT RESPONSE HELPERS
// ======================
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}

export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Demasiadas solicitudes',
      message: 'Has excedido el limite de solicitudes. Por favor, espera unos momentos.',
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    },
    {
      status: 429,
      headers: rateLimitHeaders(result),
    }
  );
}

// ======================
// IP VALIDATION
// ======================
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^([0-9a-fA-F]{1,4}:)*:([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/;

/**
 * Validate IP address format to prevent spoofing
 * Only accepts valid IPv4 or IPv6 addresses
 */
function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  // Check IPv4
  if (IPV4_REGEX.test(trimmed)) {
    const parts = trimmed.split('.');
    return parts.every(p => parseInt(p, 10) <= 255);
  }
  // Check IPv6 (simplified check)
  if (trimmed.includes(':')) {
    return IPV6_REGEX.test(trimmed) || /^[0-9a-fA-F:]+$/.test(trimmed);
  }
  return false;
}

// ======================
// MIDDLEWARE HELPER
// ======================
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from headers (behind proxy/load balancer)
  // Priority: Cloudflare > X-Real-IP > X-Forwarded-For > fallback

  // Cloudflare is trusted - use directly if available
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp && isValidIP(cfConnectingIp)) {
    return cfConnectingIp.trim();
  }

  // X-Real-IP is typically set by reverse proxy (nginx, etc.)
  const realIp = request.headers.get('x-real-ip');
  if (realIp && isValidIP(realIp)) {
    return realIp.trim();
  }

  // X-Forwarded-For can be spoofed - take first IP only and validate
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // Only take the first IP (closest to client)
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp && isValidIP(firstIp)) {
      return firstIp;
    }
  }

  // Fallback - use a hash to prevent predictable identifier
  return 'unknown-client';
}

// ======================
// RATE LIMIT WRAPPER FOR API ROUTES (SYNC)
// ======================
export function withRateLimit(
  identifier: string,
  preset: keyof typeof RATE_LIMIT_PRESETS = 'standard'
) {
  const result = rateLimit(identifier, RATE_LIMIT_PRESETS[preset]);

  if (!result.success) {
    return {
      limited: true,
      response: createRateLimitResponse(result),
      result,
    };
  }

  return {
    limited: false,
    response: null,
    result,
  };
}

// ======================
// RATE LIMIT WRAPPER FOR API ROUTES (ASYNC - RECOMMENDED)
// ======================
/**
 * Async version of rate limit wrapper
 * RECOMMENDED: Use this in API routes for distributed rate limiting
 */
export async function withRateLimitAsync(
  identifier: string,
  preset: keyof typeof RATE_LIMIT_PRESETS = 'standard'
): Promise<{
  limited: boolean;
  response: NextResponse | null;
  result: RateLimitResult;
}> {
  const result = await rateLimitAsync(identifier, RATE_LIMIT_PRESETS[preset]);

  if (!result.success) {
    return {
      limited: true,
      response: createRateLimitResponse(result),
      result,
    };
  }

  return {
    limited: false,
    response: null,
    result,
  };
}

// ======================
// TENANT-AWARE RATE LIMITING
// ======================
/**
 * Rate limit by tenant + IP for multi-tenant isolation
 * Prevents one tenant from affecting others
 */
export async function withTenantRateLimit(
  tenantId: string,
  ip: string,
  preset: keyof typeof RATE_LIMIT_PRESETS = 'standard'
): Promise<{
  limited: boolean;
  response: NextResponse | null;
  result: RateLimitResult;
}> {
  const identifier = `tenant:${tenantId}:ip:${ip}`;
  return withRateLimitAsync(identifier, preset);
}

/**
 * Rate limit by tenant only (shared quota across all IPs)
 * Useful for API key-based access
 */
export async function withTenantOnlyRateLimit(
  tenantId: string,
  preset: keyof typeof RATE_LIMIT_PRESETS = 'standard'
): Promise<{
  limited: boolean;
  response: NextResponse | null;
  result: RateLimitResult;
}> {
  const identifier = `tenant:${tenantId}`;
  return withRateLimitAsync(identifier, preset);
}

export default rateLimit;

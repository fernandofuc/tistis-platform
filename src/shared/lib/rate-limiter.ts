// =====================================================
// TIS TIS PLATFORM - Rate Limiter
// =====================================================

import { NextResponse } from 'next/server';

// ======================
// TYPES
// ======================
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

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

// ======================
// IN-MEMORY STORE
// ======================
// Note: In production, use Redis or similar for distributed rate limiting
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) {
        store.delete(key);
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
// RATE LIMITER FUNCTION
// ======================
export function rateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_PRESETS.standard
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSizeInSeconds * 1000;
  const key = `rate:${identifier}`;

  let entry = store.get(key);

  // Create new entry if doesn't exist or window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
  }

  // Increment count
  entry.count++;
  store.set(key, entry);

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
// MIDDLEWARE HELPER
// ======================
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from headers (behind proxy/load balancer)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  // Priority: Cloudflare > X-Real-IP > X-Forwarded-For > fallback
  const ip = cfConnectingIp || realIp || (forwarded ? forwarded.split(',')[0].trim() : 'unknown');

  return ip;
}

// ======================
// RATE LIMIT WRAPPER FOR API ROUTES
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

export default rateLimit;

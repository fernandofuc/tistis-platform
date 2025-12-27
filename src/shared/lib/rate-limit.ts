// =====================================================
// TIS TIS PLATFORM - Rate Limiting Utility
// In-memory rate limiting for API protection
// =====================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting
// Note: In production with multiple instances, use Redis instead
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);

  // Don't prevent process from exiting
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Unique identifier prefix for this limiter */
  identifier: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key
 * @param key - Unique identifier (usually IP or user ID)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  startCleanup();

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const storeKey = `${config.identifier}:${key}`;

  const entry = rateLimitStore.get(storeKey);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(storeKey, newEntry);

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Increment count
  entry.count++;

  // Check if over limit
  if (entry.count > config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get client IP from request headers
 * Works with Vercel, Cloudflare, and direct connections
 */
export function getClientIP(request: Request): string {
  // Try various headers in order of preference
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to a generic identifier
  return 'unknown';
}

// ======================
// Pre-configured Rate Limiters
// ======================

/** Rate limit for public API endpoints (webhooks, etc) */
export const publicAPILimiter: RateLimitConfig = {
  limit: 100,
  windowSeconds: 60,
  identifier: 'public-api',
};

/** Rate limit for AI/LLM endpoints (expensive operations) */
export const aiLimiter: RateLimitConfig = {
  limit: 20,
  windowSeconds: 60,
  identifier: 'ai-endpoint',
};

/** Rate limit for authentication endpoints */
export const authLimiter: RateLimitConfig = {
  limit: 10,
  windowSeconds: 60,
  identifier: 'auth',
};

/** Rate limit for contact forms and similar */
export const contactLimiter: RateLimitConfig = {
  limit: 5,
  windowSeconds: 300, // 5 minutes
  identifier: 'contact',
};

/** Strict rate limit for sensitive operations */
export const strictLimiter: RateLimitConfig = {
  limit: 3,
  windowSeconds: 60,
  identifier: 'strict',
};

/** Rate limit for checkout/payment sessions (prevent abuse) */
export const checkoutLimiter: RateLimitConfig = {
  limit: 10,
  windowSeconds: 3600, // 1 hour
  identifier: 'checkout',
};

// ======================
// Helper for NextResponse
// ======================

import { NextResponse } from 'next/server';

/**
 * Create a rate limit exceeded response
 */
export function rateLimitExceeded(result: RateLimitResult): NextResponse {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

  return NextResponse.json(
    {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.resetAt.toString(),
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetAt.toString());
  return response;
}

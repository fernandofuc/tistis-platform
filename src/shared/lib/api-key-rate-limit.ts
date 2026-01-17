// =====================================================
// TIS TIS PLATFORM - API Key Rate Limiting
// Rate limiting implementation for API Key authenticated requests
// =====================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ======================
// CONSTANTS
// ======================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ======================
// TYPES
// ======================

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Seconds until reset
  retryAfter?: number; // Seconds until retry is allowed (for 429 responses)
  reason?: 'rate_limit_minute' | 'rate_limit_daily' | 'key_not_found';
}

/**
 * Rate limit headers to include in responses
 */
export type RateLimitHeaders = Record<string, string>;

// ======================
// IN-MEMORY CACHE (for performance)
// ======================

interface CacheEntry {
  minuteCount: number;
  dailyCount: number;
  minuteResetAt: number;
  dailyResetAt: number;
}

// Simple in-memory cache for rate limiting (per-instance)
// Note: For multi-instance deployments, use Redis or database-based rate limiting
const rateLimitCache = new Map<string, CacheEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitCache.entries()) {
    // Remove entries that haven't been accessed in over 10 minutes
    if (entry.dailyResetAt < now - 600000) {
      rateLimitCache.delete(key);
    }
  }
}, 300000);

// ======================
// MAIN RATE LIMIT FUNCTION
// ======================

/**
 * Check if a request is within rate limits
 *
 * @param keyId - The API Key ID
 * @param limits - The rate limits for this key
 * @returns RateLimitResult with allowed status and remaining counts
 *
 * @example
 * ```typescript
 * const rateLimit = await checkRateLimit(auth.keyId!, auth.rateLimits!);
 * if (!rateLimit.allowed) {
 *   return createRateLimitExceededResponse(rateLimit);
 * }
 * ```
 */
export async function checkRateLimit(
  keyId: string,
  limits: { rpm: number; daily: number }
): Promise<RateLimitResult> {
  const now = Date.now();
  const currentMinute = Math.floor(now / 60000);
  const currentDay = Math.floor(now / 86400000);

  // Get or initialize cache entry
  let entry = rateLimitCache.get(keyId);

  if (!entry) {
    // First request - initialize cache
    entry = {
      minuteCount: 0,
      dailyCount: 0,
      minuteResetAt: (currentMinute + 1) * 60000,
      dailyResetAt: (currentDay + 1) * 86400000,
    };
    rateLimitCache.set(keyId, entry);
  } else {
    // Check if we need to reset counters
    if (now >= entry.minuteResetAt) {
      entry.minuteCount = 0;
      entry.minuteResetAt = (currentMinute + 1) * 60000;
    }
    if (now >= entry.dailyResetAt) {
      entry.dailyCount = 0;
      entry.dailyResetAt = (currentDay + 1) * 86400000;
    }
  }

  // Check minute limit
  if (entry.minuteCount >= limits.rpm) {
    const secondsUntilReset = Math.ceil((entry.minuteResetAt - now) / 1000);
    return {
      allowed: false,
      limit: limits.rpm,
      remaining: 0,
      reset: secondsUntilReset,
      retryAfter: secondsUntilReset,
      reason: 'rate_limit_minute',
    };
  }

  // Check daily limit
  if (entry.dailyCount >= limits.daily) {
    const secondsUntilReset = Math.ceil((entry.dailyResetAt - now) / 1000);
    return {
      allowed: false,
      limit: limits.daily,
      remaining: 0,
      reset: secondsUntilReset,
      retryAfter: secondsUntilReset,
      reason: 'rate_limit_daily',
    };
  }

  // Increment counters
  entry.minuteCount++;
  entry.dailyCount++;

  // Return success with remaining counts (use the more restrictive limit)
  const minuteRemaining = limits.rpm - entry.minuteCount;
  const secondsUntilMinuteReset = Math.ceil((entry.minuteResetAt - now) / 1000);

  return {
    allowed: true,
    limit: limits.rpm,
    remaining: minuteRemaining,
    reset: secondsUntilMinuteReset,
  };
}

/**
 * Check rate limit using the database (more accurate for distributed systems)
 * This is slower but works across multiple server instances
 */
export async function checkRateLimitFromDB(keyId: string): Promise<RateLimitResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase.rpc('check_api_key_rate_limit', {
      p_api_key_id: keyId,
    });

    if (error) {
      console.error('[Rate Limit] Database error:', error);
      // On error, allow the request but log it
      return {
        allowed: true,
        limit: 60,
        remaining: 59,
        reset: 60,
      };
    }

    if (!data) {
      return {
        allowed: false,
        limit: 0,
        remaining: 0,
        reset: 0,
        reason: 'key_not_found',
      };
    }

    if (!data.allowed) {
      return {
        allowed: false,
        limit: data.limit || 60,
        remaining: 0,
        reset: data.retry_after_seconds || 60,
        retryAfter: data.retry_after_seconds || 60,
        reason: data.reason as RateLimitResult['reason'],
      };
    }

    return {
      allowed: true,
      limit: data.limit || 60,
      remaining: data.remaining_minute || 0,
      reset: 60, // Default to 1 minute
    };
  } catch (error) {
    console.error('[Rate Limit] Unexpected error:', error);
    // On error, allow the request
    return {
      allowed: true,
      limit: 60,
      remaining: 59,
      reset: 60,
    };
  }
}

// ======================
// RESPONSE HELPERS
// ======================

/**
 * Get rate limit headers to add to responses
 */
export function getRateLimitHeaders(result: RateLimitResult): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Add rate limit headers to an existing response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  const headers = getRateLimitHeaders(result);

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitExceededResponse(result: RateLimitResult): NextResponse {
  const message =
    result.reason === 'rate_limit_daily'
      ? 'Daily rate limit exceeded. Please try again tomorrow.'
      : 'Rate limit exceeded. Please try again later.';

  return NextResponse.json(
    {
      error: message,
      code: 'RATE_LIMIT_EXCEEDED',
      retry_after: result.retryAfter,
    },
    {
      status: 429,
      headers: getRateLimitHeaders(result),
    }
  );
}

// ======================
// MIDDLEWARE INTEGRATION
// ======================

/**
 * Apply rate limiting to a request
 * Returns the rate limit result and can be used with the auth context
 *
 * @example
 * ```typescript
 * const auth = await authenticateAPIKey(request);
 * if (!auth.success) return createAPIKeyErrorResponse(auth);
 *
 * const rateLimit = await applyRateLimit(auth.keyId!, auth.rateLimits!);
 * if (!rateLimit.allowed) return createRateLimitExceededResponse(rateLimit);
 *
 * // Process request...
 * const response = NextResponse.json({ data });
 * return addRateLimitHeaders(response, rateLimit);
 * ```
 */
export async function applyRateLimit(
  keyId: string,
  limits: { rpm: number; daily: number },
  options?: { useDatabase?: boolean }
): Promise<RateLimitResult> {
  if (options?.useDatabase) {
    return checkRateLimitFromDB(keyId);
  }
  return checkRateLimit(keyId, limits);
}

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Reset rate limit cache for a specific key (useful for testing)
 */
export function resetRateLimitCache(keyId: string): void {
  rateLimitCache.delete(keyId);
}

/**
 * Clear all rate limit cache entries (useful for testing)
 */
export function clearRateLimitCache(): void {
  rateLimitCache.clear();
}

/**
 * Get current rate limit status without incrementing counters
 * Useful for displaying current usage to users
 */
export function getRateLimitStatus(keyId: string): {
  minuteCount: number;
  dailyCount: number;
  minuteResetIn: number;
  dailyResetIn: number;
} | null {
  const entry = rateLimitCache.get(keyId);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  return {
    minuteCount: entry.minuteCount,
    dailyCount: entry.dailyCount,
    minuteResetIn: Math.max(0, Math.ceil((entry.minuteResetAt - now) / 1000)),
    dailyResetIn: Math.max(0, Math.ceil((entry.dailyResetAt - now) / 1000)),
  };
}

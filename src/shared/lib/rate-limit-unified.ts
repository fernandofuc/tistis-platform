// =====================================================
// TIS TIS PLATFORM - Unified Rate Limiter
// Automatically uses Redis when available, falls back to in-memory
// =====================================================

import { NextRequest, NextResponse } from 'next/server';

// ============================================
// TYPES
// ============================================

export interface UnifiedRateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Unique identifier prefix for this limiter */
  identifier: string;
  /** Duration of block after exceeding limit (optional) */
  blockDurationSeconds?: number;
}

export interface UnifiedRateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  blocked: boolean;
  source: 'redis' | 'memory';
}

// ============================================
// IN-MEMORY FALLBACK (from rate-limit.ts)
// ============================================

interface MemoryRateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryRateLimitEntry>();
let cleanupTimer: NodeJS.Timeout | null = null;
let isCleanupScheduled = false;

function startMemoryCleanup() {
  // Use flag to prevent multiple timers even across hot reloads
  if (isCleanupScheduled || cleanupTimer) return;
  isCleanupScheduled = true;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt < now) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

// Cleanup function for tests and hot reload
export function _resetMemoryStore(): void {
  memoryStore.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  isCleanupScheduled = false;
}

function checkMemoryRateLimit(
  key: string,
  config: UnifiedRateLimitConfig
): UnifiedRateLimitResult {
  startMemoryCleanup();

  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const storeKey = `${config.identifier}:${key}`;

  const entry = memoryStore.get(storeKey);

  if (!entry || entry.resetAt < now) {
    const newEntry: MemoryRateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    memoryStore.set(storeKey, newEntry);

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetAt: newEntry.resetAt,
      blocked: false,
      source: 'memory',
    };
  }

  entry.count++;

  if (entry.count > config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetAt: entry.resetAt,
      blocked: true,
      source: 'memory',
    };
  }

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
    blocked: false,
    source: 'memory',
  };
}

// ============================================
// REDIS IMPLEMENTATION
// ============================================

interface RedisClientInterface {
  eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown>;
  quit(): Promise<void>;
  on(event: string, callback: (arg?: unknown) => void): void;
}

let redisClient: RedisClientInterface | null = null;
let redisConnectionAttempted = false;
let redisAvailable = false;
let redisConnectionPromise: Promise<boolean> | null = null;

const luaScript = `
  local key = KEYS[1]
  local blockKey = KEYS[2]
  local now = tonumber(ARGV[1])
  local windowMs = tonumber(ARGV[2])
  local maxRequests = tonumber(ARGV[3])
  local blockDurationMs = tonumber(ARGV[4])

  -- Check if blocked
  local blockedUntil = redis.call('GET', blockKey)
  if blockedUntil and tonumber(blockedUntil) > now then
    return {0, 0, tonumber(blockedUntil), 1}
  end

  -- Clean old entries
  local windowStart = now - windowMs
  redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

  -- Count requests in current window
  local count = redis.call('ZCARD', key)

  if count >= maxRequests then
    if blockDurationMs > 0 then
      local blockUntil = now + blockDurationMs
      redis.call('SET', blockKey, blockUntil, 'PX', blockDurationMs)
      return {0, 0, blockUntil, 1}
    end
    return {0, 0, now + windowMs, 1}
  end

  -- Add current request
  redis.call('ZADD', key, now, now .. ':' .. math.random())
  redis.call('PEXPIRE', key, windowMs)

  local remaining = maxRequests - count - 1
  local resetAt = now + windowMs

  return {1, remaining, resetAt, 0}
`;

async function initRedis(): Promise<boolean> {
  // Return cached result if already attempted
  if (redisConnectionAttempted) return redisAvailable;

  // Prevent concurrent connection attempts - return existing promise
  if (redisConnectionPromise) return redisConnectionPromise;

  redisConnectionPromise = doInitRedis();
  return redisConnectionPromise;
}

async function doInitRedis(): Promise<boolean> {
  redisConnectionAttempted = true;
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log('[UnifiedRateLimiter] REDIS_URL not configured, using in-memory rate limiting');
    return false;
  }

  try {
    const ioredisModule = await import('ioredis').catch(() => null);

    if (!ioredisModule?.default) {
      console.warn('[UnifiedRateLimiter] ioredis not available, using in-memory');
      return false;
    }

    const Redis = ioredisModule.default;

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      enableReadyCheck: true,
      lazyConnect: false,
      connectTimeout: 5000,
    }) as unknown as RedisClientInterface;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 5000);

      redisClient!.on('ready', () => {
        clearTimeout(timeout);
        console.log('[UnifiedRateLimiter] Redis connected successfully');
        redisAvailable = true;
        resolve();
      });

      redisClient!.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[UnifiedRateLimiter] Redis connection error:', err);
        reject(err);
      });
    });

    return true;
  } catch (error) {
    console.warn('[UnifiedRateLimiter] Redis init failed, using in-memory:', error);
    redisClient = null;
    redisConnectionPromise = null;
    return false;
  }
}

async function checkRedisRateLimit(
  key: string,
  config: UnifiedRateLimitConfig
): Promise<UnifiedRateLimitResult> {
  const storeKey = `rl:${config.identifier}:${key}`;
  const blockKey = `rl:${config.identifier}:block:${key}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const blockDurationMs = (config.blockDurationSeconds || 0) * 1000;

  try {
    const result = await redisClient!.eval(
      luaScript,
      2,
      storeKey,
      blockKey,
      now.toString(),
      windowMs.toString(),
      config.limit.toString(),
      blockDurationMs.toString()
    ) as [number, number, number, number];

    const [allowed, remaining, resetAt, blocked] = result;

    return {
      success: allowed === 1,
      limit: config.limit,
      remaining: Math.max(0, remaining),
      resetAt,
      blocked: blocked === 1,
      source: 'redis',
    };
  } catch (error) {
    console.error('[UnifiedRateLimiter] Redis error, falling back to memory:', error);
    redisAvailable = false;
    return checkMemoryRateLimit(key, config);
  }
}

// ============================================
// MAIN UNIFIED FUNCTION
// ============================================

/**
 * Check rate limit using Redis if available, otherwise in-memory
 * @param key Unique identifier (usually IP or user ID)
 * @param config Rate limit configuration
 */
export async function checkUnifiedRateLimit(
  key: string,
  config: UnifiedRateLimitConfig
): Promise<UnifiedRateLimitResult> {
  const isRedisReady = await initRedis();

  if (isRedisReady && redisClient) {
    return checkRedisRateLimit(key, config);
  }

  return checkMemoryRateLimit(key, config);
}

// ============================================
// PRESET CONFIGURATIONS
// ============================================

export const UNIFIED_RATE_LIMITS = {
  /** Standard API: 100 requests per minute */
  standard: {
    limit: 100,
    windowSeconds: 60,
    identifier: 'standard',
  },

  /** Strict API: 20 requests per minute */
  strict: {
    limit: 20,
    windowSeconds: 60,
    identifier: 'strict',
  },

  /** Auth endpoints: 10 requests per minute with 5 min block */
  auth: {
    limit: 10,
    windowSeconds: 60,
    identifier: 'auth',
    blockDurationSeconds: 300,
  },

  /** Webhooks: 500 requests per minute */
  webhook: {
    limit: 500,
    windowSeconds: 60,
    identifier: 'webhook',
  },

  /** AI endpoints: 30 requests per minute */
  ai: {
    limit: 30,
    windowSeconds: 60,
    identifier: 'ai',
  },

  /** Upload endpoints: 10 requests per minute */
  upload: {
    limit: 10,
    windowSeconds: 60,
    identifier: 'upload',
  },

  /** Checkout/Payment: 10 requests per hour */
  checkout: {
    limit: 10,
    windowSeconds: 3600,
    identifier: 'checkout',
  },

  /** Contact forms: 5 requests per 5 minutes */
  contact: {
    limit: 5,
    windowSeconds: 300,
    identifier: 'contact',
  },

  /** Message sending: 60 per minute */
  messaging: {
    limit: 60,
    windowSeconds: 60,
    identifier: 'messaging',
  },
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
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

  return 'unknown';
}

/**
 * Create rate limit exceeded response with proper headers
 */
export function createRateLimitResponse(result: UnifiedRateLimitResult): NextResponse {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

  return NextResponse.json(
    {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter,
      // Note: Removed 'source' from response to avoid leaking infrastructure details
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
 * Add rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: UnifiedRateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetAt.toString());
  // Note: Removed X-RateLimit-Source header to avoid leaking infrastructure details
  return response;
}

// ============================================
// CONVENIENCE WRAPPER
// ============================================

/**
 * Quick rate limit check for API routes
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const rateLimit = await applyRateLimit(request, 'auth');
 *   if (!rateLimit.success) return rateLimit.response!;
 *
 *   // Your logic here...
 * }
 */
export async function applyRateLimit(
  request: NextRequest,
  preset: keyof typeof UNIFIED_RATE_LIMITS
): Promise<{
  success: boolean;
  response: NextResponse | null;
  result: UnifiedRateLimitResult;
}> {
  const clientIP = getClientIP(request);
  const config = UNIFIED_RATE_LIMITS[preset];
  const result = await checkUnifiedRateLimit(clientIP, config);

  if (!result.success) {
    return {
      success: false,
      response: createRateLimitResponse(result),
      result,
    };
  }

  return {
    success: true,
    response: null,
    result,
  };
}

/**
 * Rate limit by user ID (for authenticated routes)
 */
export async function applyRateLimitByUser(
  userId: string,
  preset: keyof typeof UNIFIED_RATE_LIMITS
): Promise<{
  success: boolean;
  response: NextResponse | null;
  result: UnifiedRateLimitResult;
}> {
  const config = UNIFIED_RATE_LIMITS[preset];
  const result = await checkUnifiedRateLimit(`user:${userId}`, config);

  if (!result.success) {
    return {
      success: false,
      response: createRateLimitResponse(result),
      result,
    };
  }

  return {
    success: true,
    response: null,
    result,
  };
}

/**
 * Rate limit by tenant ID (for multi-tenant routes)
 */
export async function applyRateLimitByTenant(
  tenantId: string,
  preset: keyof typeof UNIFIED_RATE_LIMITS
): Promise<{
  success: boolean;
  response: NextResponse | null;
  result: UnifiedRateLimitResult;
}> {
  const config = UNIFIED_RATE_LIMITS[preset];
  const result = await checkUnifiedRateLimit(`tenant:${tenantId}`, config);

  if (!result.success) {
    return {
      success: false,
      response: createRateLimitResponse(result),
      result,
    };
  }

  return {
    success: true,
    response: null,
    result,
  };
}

export default checkUnifiedRateLimit;

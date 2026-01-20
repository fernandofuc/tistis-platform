/**
 * TIS TIS Platform - Voice Agent v2.0
 * Rate Limiter Security Layer
 *
 * Implements sliding window rate limiting to protect
 * against abuse and DoS attacks.
 *
 * Features:
 * - Sliding window algorithm for smooth rate limiting
 * - In-memory storage with automatic cleanup
 * - Support for IP-based and tenant-based limiting
 * - Configurable limits and windows
 */

import type {
  RateLimiterConfig,
  RateLimitEntry,
  RateLimitResult,
  ValidationCheckResult,
} from './types';

// =====================================================
// RATE LIMITER CLASS
// =====================================================

export class RateLimiter {
  private readonly config: RateLimiterConfig;
  private readonly store: Map<string, RateLimitEntry>;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = {
      maxRequests: 100,
      windowMs: 60_000, // 1 minute
      cleanupIntervalMs: 300_000, // 5 minutes
      maxEntries: 100_000, // Prevent memory exhaustion
      ...config,
    };

    this.store = new Map();

    // Start automatic cleanup
    this.startCleanup();
  }

  /**
   * Check if a request is allowed under rate limits
   */
  checkLimit(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get or create entry
    let entry = this.store.get(key);

    if (!entry) {
      // Check if we've reached max entries (prevent memory exhaustion)
      const maxEntries = this.config.maxEntries ?? 100_000;
      if (this.store.size >= maxEntries) {
        // Clean up expired entries first
        this.cleanup();

        // If still at limit, reject as rate limited
        if (this.store.size >= maxEntries) {
          return {
            allowed: false,
            remaining: 0,
            resetInMs: this.config.windowMs,
            limit: this.config.maxRequests,
          };
        }
      }

      entry = {
        timestamps: [],
        firstRequest: now,
        count: 0,
      };
      this.store.set(key, entry);
    }

    // Filter out timestamps outside the current window (sliding window)
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
    entry.count = entry.timestamps.length;

    // Check if under limit
    if (entry.count >= this.config.maxRequests) {
      // Calculate when the oldest request will expire
      const oldestTimestamp = entry.timestamps[0];
      const resetInMs = oldestTimestamp
        ? oldestTimestamp + this.config.windowMs - now
        : this.config.windowMs;

      return {
        allowed: false,
        remaining: 0,
        resetInMs: Math.max(0, resetInMs),
        limit: this.config.maxRequests,
      };
    }

    // Add current request timestamp
    entry.timestamps.push(now);
    entry.count = entry.timestamps.length;

    // Calculate remaining requests
    const remaining = this.config.maxRequests - entry.count;

    // Calculate reset time (when the oldest request in window expires)
    const oldestInWindow = entry.timestamps[0];
    const resetInMs = oldestInWindow
      ? oldestInWindow + this.config.windowMs - now
      : this.config.windowMs;

    return {
      allowed: true,
      remaining,
      resetInMs: Math.max(0, resetInMs),
      limit: this.config.maxRequests,
    };
  }

  /**
   * Validate rate limit with full result
   */
  validate(key: string): ValidationCheckResult {
    const result = this.checkLimit(key);

    if (!result.allowed) {
      return {
        passed: false,
        reason: `Rate limit exceeded. Try again in ${Math.ceil(result.resetInMs / 1000)} seconds.`,
        metadata: {
          key,
          remaining: result.remaining,
          limit: result.limit,
          resetInMs: result.resetInMs,
        },
      };
    }

    return {
      passed: true,
      metadata: {
        key,
        remaining: result.remaining,
        limit: result.limit,
      },
    };
  }

  /**
   * Get current request count for a key
   */
  getCount(key: string): number {
    const entry = this.store.get(key);
    if (!entry) {
      return 0;
    }

    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Count only timestamps in current window
    return entry.timestamps.filter((ts) => ts > windowStart).length;
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.store.clear();
  }

  /**
   * Get stats about current rate limiter state
   */
  getStats(): {
    totalKeys: number;
    oldestEntry: number | null;
    memoryEstimate: number;
  } {
    const now = Date.now();
    let oldestEntry: number | null = null;
    let totalTimestamps = 0;

    Array.from(this.store.values()).forEach((entry) => {
      totalTimestamps += entry.timestamps.length;
      if (oldestEntry === null || entry.firstRequest < oldestEntry) {
        oldestEntry = entry.firstRequest;
      }
    });

    // Rough memory estimate (key ~50 bytes, each timestamp 8 bytes)
    const memoryEstimate = this.store.size * 50 + totalTimestamps * 8;

    return {
      totalKeys: this.store.size,
      oldestEntry,
      memoryEstimate,
    };
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }

    const cleanupInterval = this.config.cleanupIntervalMs ?? 300_000;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, cleanupInterval);

    // Don't prevent Node.js from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Clean up expired entries from the store
   */
  cleanup(): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    let removed = 0;

    Array.from(this.store.entries()).forEach(([key, entry]) => {
      // Remove entries with no timestamps in current window
      const validTimestamps = entry.timestamps.filter((ts) => ts > windowStart);

      if (validTimestamps.length === 0) {
        this.store.delete(key);
        removed++;
      } else {
        // Update entry with filtered timestamps
        entry.timestamps = validTimestamps;
        entry.count = validTimestamps.length;
      }
    });

    return removed;
  }

  /**
   * Stop the rate limiter (cleanup timer)
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Generate a rate limit key from request
   */
  static generateKey(
    type: 'ip' | 'tenant' | 'combined',
    ip?: string,
    tenantId?: string
  ): string {
    switch (type) {
      case 'ip':
        return `ip:${ip ?? 'unknown'}`;
      case 'tenant':
        return `tenant:${tenantId ?? 'unknown'}`;
      case 'combined':
        return `combined:${ip ?? 'unknown'}:${tenantId ?? 'unknown'}`;
      default:
        return `ip:${ip ?? 'unknown'}`;
    }
  }
}

// =====================================================
// MULTI-TIER RATE LIMITER
// =====================================================

/**
 * Configuration for multi-tier rate limiting
 */
export interface MultiTierConfig {
  /** Rate limit per IP */
  perIp: RateLimiterConfig;

  /** Rate limit per tenant */
  perTenant: RateLimiterConfig;

  /** Global rate limit (optional) */
  global?: RateLimiterConfig;
}

/**
 * Multi-tier rate limiter that applies limits at IP, tenant, and global levels
 */
export class MultiTierRateLimiter {
  private readonly ipLimiter: RateLimiter;
  private readonly tenantLimiter: RateLimiter;
  private readonly globalLimiter: RateLimiter | null;

  constructor(config?: Partial<MultiTierConfig>) {
    // Default configurations
    const defaultConfig: MultiTierConfig = {
      perIp: {
        maxRequests: 100,
        windowMs: 60_000, // 100 req/min per IP
      },
      perTenant: {
        maxRequests: 1000,
        windowMs: 60_000, // 1000 req/min per tenant
      },
      global: {
        maxRequests: 10000,
        windowMs: 60_000, // 10000 req/min global
      },
    };

    const mergedConfig = {
      ...defaultConfig,
      ...config,
    };

    this.ipLimiter = new RateLimiter(mergedConfig.perIp);
    this.tenantLimiter = new RateLimiter(mergedConfig.perTenant);
    this.globalLimiter = mergedConfig.global
      ? new RateLimiter(mergedConfig.global)
      : null;
  }

  /**
   * Check all rate limits
   */
  checkLimits(
    ip: string,
    tenantId?: string
  ): {
    allowed: boolean;
    failedAt?: 'ip' | 'tenant' | 'global';
    results: {
      ip: RateLimitResult;
      tenant?: RateLimitResult;
      global?: RateLimitResult;
    };
  } {
    // Check IP limit first
    const ipResult = this.ipLimiter.checkLimit(
      RateLimiter.generateKey('ip', ip)
    );

    if (!ipResult.allowed) {
      return {
        allowed: false,
        failedAt: 'ip',
        results: { ip: ipResult },
      };
    }

    // Check tenant limit if tenantId provided
    let tenantResult: RateLimitResult | undefined;
    if (tenantId) {
      tenantResult = this.tenantLimiter.checkLimit(
        RateLimiter.generateKey('tenant', undefined, tenantId)
      );

      if (!tenantResult.allowed) {
        return {
          allowed: false,
          failedAt: 'tenant',
          results: { ip: ipResult, tenant: tenantResult },
        };
      }
    }

    // Check global limit if configured
    let globalResult: RateLimitResult | undefined;
    if (this.globalLimiter) {
      globalResult = this.globalLimiter.checkLimit('global');

      if (!globalResult.allowed) {
        return {
          allowed: false,
          failedAt: 'global',
          results: {
            ip: ipResult,
            tenant: tenantResult,
            global: globalResult,
          },
        };
      }
    }

    return {
      allowed: true,
      results: {
        ip: ipResult,
        tenant: tenantResult,
        global: globalResult,
      },
    };
  }

  /**
   * Validate with full result
   */
  validate(ip: string, tenantId?: string): ValidationCheckResult {
    const result = this.checkLimits(ip, tenantId);

    if (!result.allowed) {
      const failedResult =
        result.results[result.failedAt as keyof typeof result.results];

      return {
        passed: false,
        reason: `Rate limit exceeded at ${result.failedAt} level. Try again in ${Math.ceil((failedResult?.resetInMs ?? 60000) / 1000)} seconds.`,
        metadata: {
          failedAt: result.failedAt,
          ip,
          tenantId,
          results: result.results,
        },
      };
    }

    return {
      passed: true,
      metadata: {
        ip,
        tenantId,
        ipRemaining: result.results.ip.remaining,
        tenantRemaining: result.results.tenant?.remaining,
      },
    };
  }

  /**
   * Stop all limiters
   */
  stop(): void {
    this.ipLimiter.stop();
    this.tenantLimiter.stop();
    this.globalLimiter?.stop();
  }

  /**
   * Get combined stats
   */
  getStats(): {
    ip: ReturnType<RateLimiter['getStats']>;
    tenant: ReturnType<RateLimiter['getStats']>;
    global?: ReturnType<RateLimiter['getStats']>;
  } {
    return {
      ip: this.ipLimiter.getStats(),
      tenant: this.tenantLimiter.getStats(),
      global: this.globalLimiter?.getStats(),
    };
  }
}

// =====================================================
// EXPORTS
// =====================================================

export type { RateLimiterConfig, RateLimitResult, RateLimitEntry };

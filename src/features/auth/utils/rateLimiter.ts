// =====================================================
// TIS TIS PLATFORM - Client-Side Rate Limiter
// =====================================================

/**
 * Simple client-side rate limiter to prevent abuse
 * This is NOT a replacement for server-side rate limiting
 * but provides good UX and reduces unnecessary API calls
 */

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number; // Time window in milliseconds
  blockDurationMs: number; // How long to block after max attempts
}

interface RateLimitEntry {
  attempts: number;
  firstAttemptTime: number;
  blockedUntil: number | null;
}

class RateLimiter {
  private storage: Map<string, RateLimitEntry> = new Map();
  private useLocalStorage: boolean;

  constructor(useLocalStorage = true) {
    this.useLocalStorage = useLocalStorage && typeof window !== 'undefined';

    if (this.useLocalStorage) {
      this.loadFromLocalStorage();
    }
  }

  /**
   * Check if an action is allowed
   */
  check(key: string, config: RateLimitConfig): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = this.storage.get(key);

    // No previous attempts
    if (!entry) {
      this.recordAttempt(key, now);
      return { allowed: true };
    }

    // Currently blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      return { allowed: false, retryAfter };
    }

    // Time window expired - reset
    if (now - entry.firstAttemptTime > config.windowMs) {
      this.recordAttempt(key, now);
      return { allowed: true };
    }

    // Within window - check attempts
    if (entry.attempts >= config.maxAttempts) {
      const blockedUntil = now + config.blockDurationMs;
      this.blockKey(key, blockedUntil);
      const retryAfter = Math.ceil(config.blockDurationMs / 1000);
      return { allowed: false, retryAfter };
    }

    // Increment attempts
    this.incrementAttempts(key);
    return { allowed: true };
  }

  /**
   * Record a successful action (reset counter)
   */
  success(key: string): void {
    this.storage.delete(key);
    this.saveToLocalStorage();
  }

  /**
   * Record a failed action attempt
   */
  private recordAttempt(key: string, timestamp: number): void {
    this.storage.set(key, {
      attempts: 1,
      firstAttemptTime: timestamp,
      blockedUntil: null,
    });
    this.saveToLocalStorage();
  }

  /**
   * Increment attempt counter
   */
  private incrementAttempts(key: string): void {
    const entry = this.storage.get(key);
    if (entry) {
      entry.attempts++;
      this.saveToLocalStorage();
    }
  }

  /**
   * Block a key until specified time
   */
  private blockKey(key: string, blockedUntil: number): void {
    const entry = this.storage.get(key);
    if (entry) {
      entry.blockedUntil = blockedUntil;
      this.saveToLocalStorage();
    }
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.storage.clear();
    if (this.useLocalStorage) {
      localStorage.removeItem('rate_limit_data');
    }
  }

  /**
   * Load data from localStorage
   */
  private loadFromLocalStorage(): void {
    if (!this.useLocalStorage) return;

    try {
      const data = localStorage.getItem('rate_limit_data');
      if (data) {
        const parsed = JSON.parse(data);
        this.storage = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.warn('[RateLimiter] Failed to load from localStorage:', error);
    }
  }

  /**
   * Save data to localStorage
   */
  private saveToLocalStorage(): void {
    if (!this.useLocalStorage) return;

    try {
      const data = Object.fromEntries(this.storage);
      localStorage.setItem('rate_limit_data', JSON.stringify(data));
    } catch (error) {
      console.warn('[RateLimiter] Failed to save to localStorage:', error);
    }
  }
}

// ======================
// SINGLETON INSTANCE
// ======================
export const rateLimiter = new RateLimiter();

// ======================
// PRESET CONFIGURATIONS
// ======================

/**
 * Login attempts rate limit
 * Max 5 attempts per 15 minutes, block for 15 minutes after
 */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 15 * 60 * 1000, // 15 minutes
};

/**
 * OAuth attempts rate limit
 * Max 10 attempts per 5 minutes (higher because OAuth can fail for various reasons)
 */
export const OAUTH_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 10,
  windowMs: 5 * 60 * 1000, // 5 minutes
  blockDurationMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * Password reset rate limit
 * Max 3 attempts per hour
 */
export const RESET_PASSWORD_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  blockDurationMs: 60 * 60 * 1000, // 1 hour
};

/**
 * Sign up rate limit
 * Max 3 attempts per hour
 */
export const SIGNUP_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  blockDurationMs: 60 * 60 * 1000, // 1 hour
};

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Format retry time in human-readable format
 */
export function formatRetryTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
}

/**
 * Get user identifier for rate limiting
 */
export function getUserIdentifier(email?: string): string {
  if (email) {
    return `user:${email.toLowerCase()}`;
  }

  // Fallback to browser fingerprint (basic)
  if (typeof window !== 'undefined') {
    return `browser:${window.navigator.userAgent.slice(0, 50)}`;
  }

  return 'unknown';
}

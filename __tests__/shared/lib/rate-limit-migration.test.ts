/**
 * Tests for Rate Limit Migration Wrapper
 * Tests the gradual migration from rate-limit.ts to rate-limit-unified.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock environment variables before importing
const mockEnv = {
  USE_UNIFIED_RATE_LIMIT: 'false',
  RATE_LIMIT_SHADOW_MODE: 'false',
  RATE_LIMIT_LOG_COMPARISONS: 'false',
};

// Store original env
const originalEnv = { ...process.env };

// Mock the logger
vi.mock('../../../src/shared/lib/structured-logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('Rate Limit Migration Wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset env for each test
    process.env = { ...originalEnv, ...mockEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('Default mode (old rate limiter)', () => {
    it('should use old rate limiter by default', async () => {
      process.env.USE_UNIFIED_RATE_LIMIT = 'false';
      process.env.RATE_LIMIT_SHADOW_MODE = 'false';

      const { checkRateLimitMigration } = await import(
        '../../../src/shared/lib/rate-limit-migration'
      );

      const config = {
        limit: 5,
        windowSeconds: 60,
        identifier: 'test-default',
      };

      const key = `test-default-${Date.now()}`;
      const result = await checkRateLimitMigration(key, config);

      expect(result.success).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(4);
      // Old rate limiter doesn't have 'source' field
      expect(result).not.toHaveProperty('source');
    });

    it('should block after limit exceeded', async () => {
      process.env.USE_UNIFIED_RATE_LIMIT = 'false';
      process.env.RATE_LIMIT_SHADOW_MODE = 'false';

      const { checkRateLimitMigration } = await import(
        '../../../src/shared/lib/rate-limit-migration'
      );

      const config = {
        limit: 3,
        windowSeconds: 60,
        identifier: 'test-block',
      };

      const key = `test-block-${Date.now()}`;

      // Use up limit
      for (let i = 0; i < 3; i++) {
        await checkRateLimitMigration(key, config);
      }

      // Next should be blocked
      const result = await checkRateLimitMigration(key, config);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('compareRateLimiters helper', () => {
    it('should return results from both rate limiters', async () => {
      const { compareRateLimiters } = await import(
        '../../../src/shared/lib/rate-limit-migration'
      );

      const config = {
        limit: 10,
        windowSeconds: 60,
        identifier: 'test-compare',
      };

      const key = `test-compare-${Date.now()}`;
      const comparison = await compareRateLimiters(key, config);

      expect(comparison).toHaveProperty('old');
      expect(comparison).toHaveProperty('new');
      expect(comparison).toHaveProperty('match');
      expect(typeof comparison.match).toBe('boolean');

      // Both should allow first request
      expect(comparison.old.success).toBe(true);
      expect(comparison.new.success).toBe(true);
      expect(comparison.match).toBe(true);
    });

    it('should track match correctly when both agree', async () => {
      const { compareRateLimiters } = await import(
        '../../../src/shared/lib/rate-limit-migration'
      );

      const config = {
        limit: 2,
        windowSeconds: 60,
        identifier: 'test-match',
      };

      const key = `test-match-${Date.now()}`;

      // First call - both should allow
      const first = await compareRateLimiters(key, config);
      expect(first.match).toBe(true);
      expect(first.old.success).toBe(true);
      expect(first.new.success).toBe(true);
    });
  });

  describe('Type exports', () => {
    it('should export RateLimitConfig type', async () => {
      const module = await import(
        '../../../src/shared/lib/rate-limit-migration'
      );

      // Type exports can't be checked at runtime, but we can verify the module loads
      expect(module).toHaveProperty('checkRateLimitMigration');
      expect(module).toHaveProperty('compareRateLimiters');
    });
  });

  describe('Result format compatibility', () => {
    it('should return result compatible with old format', async () => {
      process.env.USE_UNIFIED_RATE_LIMIT = 'false';

      const { checkRateLimitMigration } = await import(
        '../../../src/shared/lib/rate-limit-migration'
      );

      const config = {
        limit: 10,
        windowSeconds: 60,
        identifier: 'test-format',
      };

      const key = `test-format-${Date.now()}`;
      const result = await checkRateLimitMigration(key, config);

      // Verify all expected fields are present
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('resetAt');

      // Verify types
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.limit).toBe('number');
      expect(typeof result.remaining).toBe('number');
      expect(typeof result.resetAt).toBe('number');
    });
  });

  describe('New rate limiter mode (USE_UNIFIED_RATE_LIMIT=true)', () => {
    it('should use new rate limiter when enabled', async () => {
      process.env.USE_UNIFIED_RATE_LIMIT = 'true';
      process.env.RATE_LIMIT_SHADOW_MODE = 'false';

      const { checkRateLimitMigration } = await import(
        '../../../src/shared/lib/rate-limit-migration'
      );

      const config = {
        limit: 5,
        windowSeconds: 60,
        identifier: 'test-new-mode',
      };

      const key = `test-new-mode-${Date.now()}`;
      const result = await checkRateLimitMigration(key, config);

      expect(result.success).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(4);
      // Result should be converted to old format (no 'source' field)
      expect(result).not.toHaveProperty('source');
    });

    it('should block after limit exceeded in new mode', async () => {
      process.env.USE_UNIFIED_RATE_LIMIT = 'true';
      process.env.RATE_LIMIT_SHADOW_MODE = 'false';

      const { checkRateLimitMigration } = await import(
        '../../../src/shared/lib/rate-limit-migration'
      );

      const config = {
        limit: 2,
        windowSeconds: 60,
        identifier: 'test-new-block',
      };

      const key = `test-new-block-${Date.now()}`;

      // Use up limit
      await checkRateLimitMigration(key, config);
      await checkRateLimitMigration(key, config);

      // Next should be blocked
      const result = await checkRateLimitMigration(key, config);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('Shadow mode (RATE_LIMIT_SHADOW_MODE=true)', () => {
    it('should use old rate limiter result in shadow mode', async () => {
      process.env.USE_UNIFIED_RATE_LIMIT = 'false';
      process.env.RATE_LIMIT_SHADOW_MODE = 'true';

      const { checkRateLimitMigration } = await import(
        '../../../src/shared/lib/rate-limit-migration'
      );

      const config = {
        limit: 5,
        windowSeconds: 60,
        identifier: 'test-shadow',
      };

      const key = `test-shadow-${Date.now()}`;
      const result = await checkRateLimitMigration(key, config);

      // Should return old format result
      expect(result.success).toBe(true);
      expect(result).not.toHaveProperty('source');
    });

    it('shadow mode should take precedence over USE_UNIFIED', async () => {
      // When both are true, shadow mode should run comparison but use old result
      process.env.USE_UNIFIED_RATE_LIMIT = 'true';
      process.env.RATE_LIMIT_SHADOW_MODE = 'true';

      const { checkRateLimitMigration } = await import(
        '../../../src/shared/lib/rate-limit-migration'
      );

      const config = {
        limit: 5,
        windowSeconds: 60,
        identifier: 'test-shadow-precedence',
      };

      const key = `test-shadow-precedence-${Date.now()}`;
      const result = await checkRateLimitMigration(key, config);

      // Shadow mode uses old rate limiter's result
      expect(result.success).toBe(true);
      expect(result).not.toHaveProperty('source');
    });
  });
});

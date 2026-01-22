/**
 * Tests for Unified Rate Limiter
 * Tests both in-memory fallback and mock Redis integration
 */

import {
  checkUnifiedRateLimit,
  UNIFIED_RATE_LIMITS,
  getClientIP,
  createRateLimitResponse,
  type UnifiedRateLimitConfig,
} from '../../../src/shared/lib/rate-limit-unified';

// Mock NextResponse for testing
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, options) => ({
      body,
      status: options?.status || 200,
      headers: new Map(Object.entries(options?.headers || {})),
    })),
  },
}));

describe('Unified Rate Limiter', () => {
  // Reset module state between tests
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkUnifiedRateLimit (in-memory fallback)', () => {
    const testConfig: UnifiedRateLimitConfig = {
      limit: 5,
      windowSeconds: 60,
      identifier: 'test',
    };

    it('should allow requests within limit', async () => {
      const key = `test-key-${Date.now()}`;

      for (let i = 0; i < 5; i++) {
        const result = await checkUnifiedRateLimit(key, testConfig);
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(4 - i);
        expect(result.source).toBe('memory');
      }
    });

    it('should block requests over limit', async () => {
      const key = `test-key-block-${Date.now()}`;

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        await checkUnifiedRateLimit(key, testConfig);
      }

      // Next request should be blocked
      const result = await checkUnifiedRateLimit(key, testConfig);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.blocked).toBe(true);
    });

    it('should track different keys independently', async () => {
      const key1 = `test-key-1-${Date.now()}`;
      const key2 = `test-key-2-${Date.now()}`;

      // Use up key1's limit
      for (let i = 0; i < 5; i++) {
        await checkUnifiedRateLimit(key1, testConfig);
      }

      // key2 should still have full quota
      const result = await checkUnifiedRateLimit(key2, testConfig);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should include correct metadata in result', async () => {
      const key = `test-key-meta-${Date.now()}`;
      const result = await checkUnifiedRateLimit(key, testConfig);

      expect(result.limit).toBe(testConfig.limit);
      expect(result.resetAt).toBeGreaterThan(Date.now());
      expect(result.source).toBe('memory');
    });
  });

  describe('UNIFIED_RATE_LIMITS presets', () => {
    it('should have all required presets', () => {
      expect(UNIFIED_RATE_LIMITS).toHaveProperty('standard');
      expect(UNIFIED_RATE_LIMITS).toHaveProperty('strict');
      expect(UNIFIED_RATE_LIMITS).toHaveProperty('auth');
      expect(UNIFIED_RATE_LIMITS).toHaveProperty('webhook');
      expect(UNIFIED_RATE_LIMITS).toHaveProperty('ai');
      expect(UNIFIED_RATE_LIMITS).toHaveProperty('upload');
      expect(UNIFIED_RATE_LIMITS).toHaveProperty('checkout');
      expect(UNIFIED_RATE_LIMITS).toHaveProperty('contact');
      expect(UNIFIED_RATE_LIMITS).toHaveProperty('messaging');
    });

    it('should have valid configuration values', () => {
      for (const [name, config] of Object.entries(UNIFIED_RATE_LIMITS)) {
        expect(config.limit).toBeGreaterThan(0);
        expect(config.windowSeconds).toBeGreaterThan(0);
        expect(config.identifier).toBe(name);
      }
    });

    it('auth preset should have block duration', () => {
      expect(UNIFIED_RATE_LIMITS.auth.blockDurationSeconds).toBe(300);
    });
  });

  describe('getClientIP', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1';
            return null;
          },
        },
      } as unknown as Request;

      expect(getClientIP(mockRequest)).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'x-real-ip') return '192.168.1.2';
            return null;
          },
        },
      } as unknown as Request;

      expect(getClientIP(mockRequest)).toBe('192.168.1.2');
    });

    it('should extract IP from cf-connecting-ip header', () => {
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'cf-connecting-ip') return '192.168.1.3';
            return null;
          },
        },
      } as unknown as Request;

      expect(getClientIP(mockRequest)).toBe('192.168.1.3');
    });

    it('should return "unknown" when no IP header present', () => {
      const mockRequest = {
        headers: {
          get: () => null,
        },
      } as unknown as Request;

      expect(getClientIP(mockRequest)).toBe('unknown');
    });
  });

  describe('createRateLimitResponse', () => {
    it('should create 429 response with correct headers', () => {
      const result = {
        success: false,
        limit: 10,
        remaining: 0,
        resetAt: Date.now() + 60000,
        blocked: true,
        source: 'memory' as const,
      };

      const response = createRateLimitResponse(result);

      expect(response.status).toBe(429);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((response as any).body.error).toBe('Too many requests');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });
  });
});

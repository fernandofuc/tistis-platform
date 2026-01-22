/**
 * Tests for Admin Authentication Utility
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  verifyAdminAuth,
  isValidAdminKey,
  type AdminAuthConfig,
} from '../../../src/shared/lib/admin-auth';

// Mock environment
const originalEnv = process.env;

// Helper to set NODE_ENV in tests (TypeScript declares it as readonly)
function setNodeEnv(env: 'development' | 'production' | 'test') {
  (process.env as { NODE_ENV: string }).NODE_ENV = env;
}

// Create mock functions with vi.hoisted so they're available in vi.mock
const mockRateLimitFns = vi.hoisted(() => ({
  checkRateLimit: vi.fn(() => ({
    success: true,
    limit: 3,
    remaining: 2,
    resetAt: Date.now() + 60000,
  })),
  getClientIP: vi.fn(() => '127.0.0.1'),
  strictLimiter: {
    limit: 3,
    windowSeconds: 60,
    identifier: 'strict',
  },
  rateLimitExceeded: vi.fn(() => ({
    status: 429,
    json: () => ({ error: 'Rate limit exceeded' }),
  })),
}));

// Mock rate limiting
vi.mock('../../../src/shared/lib/rate-limit', () => mockRateLimitFns);

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, options) => ({
      body,
      status: options?.status || 200,
    })),
  },
}));

describe('Admin Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function createMockRequest(adminKey?: string): NextRequest {
    const mockHeaders: Record<string, string> = {};
    if (adminKey) {
      mockHeaders['x-admin-key'] = adminKey;
    }

    return {
      headers: {
        get: (name: string) => mockHeaders[name.toLowerCase()] || null,
      },
      nextUrl: {
        pathname: '/api/admin/test',
      },
    } as unknown as NextRequest;
  }

  describe('verifyAdminAuth', () => {
    describe('when ADMIN_API_KEY is not configured', () => {
      beforeEach(() => {
        delete process.env.ADMIN_API_KEY;
      });

      it('should return error in production', () => {
        setNodeEnv('production');
        const request = createMockRequest('any-key');

        const result = verifyAdminAuth(request);

        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('missing_config');
        expect(result.response?.status).toBe(500);
      });

      it('should return error in development when requireInDev is true (default)', () => {
        setNodeEnv('development');
        const request = createMockRequest('any-key');

        const result = verifyAdminAuth(request);

        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('missing_key_dev');
      });

      it('should allow access in development when requireInDev is false', () => {
        setNodeEnv('development');
        const request = createMockRequest();
        const config: AdminAuthConfig = { requireInDev: false };

        const result = verifyAdminAuth(request, config);

        expect(result.authorized).toBe(true);
      });
    });

    describe('when ADMIN_API_KEY is configured', () => {
      const validKey = 'super-secret-admin-key-12345678901234567890';

      beforeEach(() => {
        process.env.ADMIN_API_KEY = validKey;
        setNodeEnv('production');
      });

      it('should return error when no key provided', () => {
        const request = createMockRequest();

        const result = verifyAdminAuth(request);

        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('no_key_provided');
        expect(result.response?.status).toBe(401);
      });

      it('should return error when key is invalid', () => {
        const request = createMockRequest('wrong-key');

        const result = verifyAdminAuth(request);

        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('invalid_key');
        expect(result.response?.status).toBe(401);
      });

      it('should return error when key has different length', () => {
        const request = createMockRequest('short');

        const result = verifyAdminAuth(request);

        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('invalid_key');
      });

      it('should authorize when key is valid', () => {
        const request = createMockRequest(validKey);

        const result = verifyAdminAuth(request);

        expect(result.authorized).toBe(true);
        expect(result.response).toBeUndefined();
      });
    });

    describe('rate limiting', () => {
      const validKey = 'super-secret-admin-key-12345678901234567890';

      beforeEach(() => {
        process.env.ADMIN_API_KEY = validKey;
        setNodeEnv('production');
      });

      it('should apply rate limiting by default', () => {
        const request = createMockRequest(validKey);

        verifyAdminAuth(request);

        expect(mockRateLimitFns.checkRateLimit).toHaveBeenCalled();
      });

      it('should skip rate limiting when disabled', () => {
        const request = createMockRequest(validKey);

        verifyAdminAuth(request, { rateLimit: false });

        expect(mockRateLimitFns.checkRateLimit).not.toHaveBeenCalled();
      });

      it('should return rate limit response when exceeded', () => {
        mockRateLimitFns.checkRateLimit.mockReturnValueOnce({
          success: false,
          limit: 3,
          remaining: 0,
          resetAt: Date.now() + 60000,
        });

        const request = createMockRequest(validKey);
        const result = verifyAdminAuth(request);

        expect(result.authorized).toBe(false);
        expect(result.reason).toBe('rate_limit_exceeded');
        expect(mockRateLimitFns.rateLimitExceeded).toHaveBeenCalled();
      });
    });
  });

  describe('isValidAdminKey', () => {
    const validKey = 'super-secret-admin-key-12345678901234567890';

    beforeEach(() => {
      process.env.ADMIN_API_KEY = validKey;
      setNodeEnv('production');
    });

    it('should return true for valid key', () => {
      const request = createMockRequest(validKey);

      expect(isValidAdminKey(request)).toBe(true);
    });

    it('should return false for invalid key', () => {
      const request = createMockRequest('invalid');

      expect(isValidAdminKey(request)).toBe(false);
    });

    it('should not apply rate limiting', () => {
      mockRateLimitFns.checkRateLimit.mockClear();

      const request = createMockRequest(validKey);
      isValidAdminKey(request);

      expect(mockRateLimitFns.checkRateLimit).not.toHaveBeenCalled();
    });
  });
});

describe('Timing-safe comparison', () => {
  const validKey = 'super-secret-admin-key-12345678901234567890';

  beforeEach(() => {
    process.env.ADMIN_API_KEY = validKey;
    setNodeEnv('production');
  });

  it('should reject keys with same prefix but different content', () => {
    const request = {
      headers: {
        get: (name: string) => {
          if (name === 'x-admin-key') return validKey.slice(0, -1) + 'X';
          return null;
        },
      },
      nextUrl: { pathname: '/test' },
    } as unknown as NextRequest;

    const result = verifyAdminAuth(request, { rateLimit: false });

    expect(result.authorized).toBe(false);
  });

  it('should accept exact matching keys', () => {
    const request = {
      headers: {
        get: (name: string) => {
          if (name === 'x-admin-key') return validKey;
          return null;
        },
      },
      nextUrl: { pathname: '/test' },
    } as unknown as NextRequest;

    const result = verifyAdminAuth(request, { rateLimit: false });

    expect(result.authorized).toBe(true);
  });
});

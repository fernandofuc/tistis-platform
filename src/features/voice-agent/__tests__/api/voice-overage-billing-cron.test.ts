/**
 * Tests for Voice Overage Billing Cron
 * /api/cron/voice-overage-billing
 * FASE 6.3: Integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ======================
// MOCKS
// ======================

// Mock voiceBillingService
const mockResetMonthlyUsage = vi.fn();
const mockProcessMonthlyBilling = vi.fn();

vi.mock('@/src/features/voice-agent/services/voice-billing.service', () => ({
  voiceBillingService: {
    resetMonthlyUsage: (...args: unknown[]) => mockResetMonthlyUsage(...args),
    processMonthlyBilling: (...args: unknown[]) => mockProcessMonthlyBilling(...args),
  },
}));

// Mock logger
vi.mock('@/src/shared/lib', () => ({
  createComponentLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ======================
// HELPERS
// ======================

function createMockRequest(url: string, headers?: Record<string, string>): NextRequest {
  const request = new NextRequest(new URL(url, 'http://localhost:3000'));
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      request.headers.set(key, value);
    });
  }
  return request;
}

// Custom request creator that allows setting headers properly
function createRequestWithAuth(url: string, authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader) {
    headers.set('authorization', authHeader);
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), { headers });
}

// ======================
// TESTS
// ======================

describe('Voice Overage Billing Cron - /api/cron/voice-overage-billing', () => {
  let GET: typeof import('@/app/api/cron/voice-overage-billing/route').GET;
  let POST: typeof import('@/app/api/cron/voice-overage-billing/route').POST;
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset env using vitest stubEnv for type-safe environment manipulation
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');
    vi.stubEnv('NODE_ENV', 'production');

    // Default mock responses
    mockResetMonthlyUsage.mockResolvedValue({ tenantsProcessed: 0 });
    mockProcessMonthlyBilling.mockResolvedValue({
      processedAt: new Date().toISOString(),
      tenantsProcessed: 5,
      tenantsWithOverage: 2,
      totalOverageMinutes: 100,
      totalOverageAmount: 30000,
      results: [
        { tenantId: 't1', success: true },
        { tenantId: 't2', success: true },
      ],
      errors: [],
    });

    // Import route handlers
    const cronModule = await import('@/app/api/cron/voice-overage-billing/route');
    GET = cronModule.GET;
    POST = cronModule.POST;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  describe('Authentication - Cron Secret Validation', () => {
    it('should return 401 when no authorization header provided', async () => {
      const request = createRequestWithAuth('/api/cron/voice-overage-billing');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when wrong cron secret provided', async () => {
      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer wrong-secret'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should proceed when correct cron secret provided', async () => {
      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 401 when CRON_SECRET not configured in production', async () => {
      vi.resetModules();
      vi.stubEnv('CRON_SECRET', '');
      vi.stubEnv('NODE_ENV', 'production');

      const cronModule = await import('@/app/api/cron/voice-overage-billing/route');
      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer any-secret'
      );
      const response = await cronModule.GET(request);

      expect(response.status).toBe(401);
    });

    it('should allow request without secret in development when CRON_SECRET not set', async () => {
      vi.resetModules();
      vi.unstubAllEnvs();
      vi.stubEnv('NODE_ENV', 'development');

      const cronModule = await import('@/app/api/cron/voice-overage-billing/route');
      const request = createRequestWithAuth('/api/cron/voice-overage-billing');
      const response = await cronModule.GET(request);

      // Should proceed despite no auth (development mode without secret)
      expect(response.status).toBe(200);
    });
  });

  describe('Timing-Safe Comparison Security', () => {
    it('should reject when authorization header has different length', async () => {
      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer short'
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should reject when authorization header is malformed', async () => {
      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'NotBearer test-cron-secret'
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Monthly Usage Reset', () => {
    it('should call resetMonthlyUsage', async () => {
      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      await GET(request);

      expect(mockResetMonthlyUsage).toHaveBeenCalled();
    });

    it('should include reset count in report', async () => {
      mockResetMonthlyUsage.mockResolvedValue({ tenantsProcessed: 3 });

      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.report.resetTenantsProcessed).toBe(3);
    });

    it('should continue billing even if reset returns 0', async () => {
      mockResetMonthlyUsage.mockResolvedValue({ tenantsProcessed: 0 });

      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockProcessMonthlyBilling).toHaveBeenCalled();
      expect(data.report.resetTenantsProcessed).toBe(0);
    });
  });

  describe('Monthly Billing Processing', () => {
    it('should call processMonthlyBilling', async () => {
      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      await GET(request);

      expect(mockProcessMonthlyBilling).toHaveBeenCalled();
    });

    it('should return complete billing report', async () => {
      const mockReport = {
        processedAt: '2025-01-25T06:00:00.000Z',
        tenantsProcessed: 10,
        tenantsWithOverage: 4,
        totalOverageMinutes: 500,
        totalOverageAmount: 150000,
        results: [
          { tenantId: 't1', success: true },
          { tenantId: 't2', success: true },
          { tenantId: 't3', success: true },
          { tenantId: 't4', success: true },
        ],
        errors: [],
      };

      mockProcessMonthlyBilling.mockResolvedValue(mockReport);

      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.report).toMatchObject({
        processedAt: mockReport.processedAt,
        tenantsProcessed: 10,
        tenantsWithOverage: 4,
        totalOverageMinutes: 500,
        totalOverageAmount: 150000,
        successCount: 4,
        errorCount: 0,
      });
    });

    it('should include error count when there are failures', async () => {
      const mockReport = {
        processedAt: '2025-01-25T06:00:00.000Z',
        tenantsProcessed: 5,
        tenantsWithOverage: 3,
        totalOverageMinutes: 200,
        totalOverageAmount: 60000,
        results: [
          { tenantId: 't1', success: true },
          { tenantId: 't2', success: false, error: 'Stripe error' },
          { tenantId: 't3', success: true },
        ],
        errors: ['Error processing tenant t2: Stripe error'],
      };

      mockProcessMonthlyBilling.mockResolvedValue(mockReport);

      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.report.successCount).toBe(2);
      expect(data.report.errorCount).toBe(1);
    });
  });

  describe('Duration Tracking', () => {
    it('should include duration in response', async () => {
      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.durationMs).toBeDefined();
      expect(typeof data.durationMs).toBe('number');
      expect(data.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when resetMonthlyUsage throws', async () => {
      mockResetMonthlyUsage.mockRejectedValue(new Error('Reset failed'));

      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Reset failed');
    });

    it('should return 500 when processMonthlyBilling throws', async () => {
      mockProcessMonthlyBilling.mockRejectedValue(new Error('Billing process failed'));

      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Billing process failed');
    });

    it('should handle unknown error types', async () => {
      mockProcessMonthlyBilling.mockRejectedValue('Non-Error object');

      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unknown error');
    });
  });

  describe('POST Method (Development Testing)', () => {
    it('should return 405 in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.resetModules();

      const cronModule = await import('@/app/api/cron/voice-overage-billing/route');
      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      const response = await cronModule.POST(request);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('POST method only available in development');
    });

    it('should execute GET logic in development', async () => {
      vi.resetModules();
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('CRON_SECRET', 'test-cron-secret');

      const cronModule = await import('@/app/api/cron/voice-overage-billing/route');
      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      const response = await cronModule.POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Route Configuration', () => {
    it('should have force-dynamic export', async () => {
      const cronModule = await import('@/app/api/cron/voice-overage-billing/route');
      expect(cronModule.dynamic).toBe('force-dynamic');
    });

    it('should have maxDuration of 300 seconds', async () => {
      const cronModule = await import('@/app/api/cron/voice-overage-billing/route');
      expect(cronModule.maxDuration).toBe(300);
    });
  });

  describe('Integration Flow', () => {
    it('should execute reset before billing', async () => {
      const callOrder: string[] = [];

      mockResetMonthlyUsage.mockImplementation(async () => {
        callOrder.push('reset');
        return { tenantsProcessed: 2 };
      });

      mockProcessMonthlyBilling.mockImplementation(async () => {
        callOrder.push('billing');
        return {
          processedAt: new Date().toISOString(),
          tenantsProcessed: 5,
          tenantsWithOverage: 2,
          totalOverageMinutes: 100,
          totalOverageAmount: 30000,
          results: [],
          errors: [],
        };
      });

      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      await GET(request);

      expect(callOrder).toEqual(['reset', 'billing']);
    });

    it('should handle empty tenant processing', async () => {
      mockResetMonthlyUsage.mockResolvedValue({ tenantsProcessed: 0 });
      mockProcessMonthlyBilling.mockResolvedValue({
        processedAt: new Date().toISOString(),
        tenantsProcessed: 0,
        tenantsWithOverage: 0,
        totalOverageMinutes: 0,
        totalOverageAmount: 0,
        results: [],
        errors: [],
      });

      const request = createRequestWithAuth(
        '/api/cron/voice-overage-billing',
        'Bearer test-cron-secret'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.report.tenantsProcessed).toBe(0);
    });
  });
});

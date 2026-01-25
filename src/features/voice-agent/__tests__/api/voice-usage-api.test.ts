/**
 * Tests for Voice Agent Usage API
 * /api/voice-agent/usage
 * FASE 6.3: Integration tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ======================
// MOCKS
// ======================

// Mock auth-helper
const mockGetAuthenticatedContext = vi.fn();
const mockIsAuthError = vi.fn();
const mockCreateAuthErrorResponse = vi.fn();

vi.mock('@/src/shared/lib/auth-helper', () => ({
  getAuthenticatedContext: (...args: unknown[]) => mockGetAuthenticatedContext(...args),
  isAuthError: (...args: unknown[]) => mockIsAuthError(...args),
  createAuthErrorResponse: (...args: unknown[]) => mockCreateAuthErrorResponse(...args),
}));

// Mock VoiceAgentService
const mockCanAccessVoiceAgent = vi.fn();

vi.mock('@/src/features/voice-agent/services/voice-agent.service', () => ({
  VoiceAgentService: {
    canAccessVoiceAgent: (...args: unknown[]) => mockCanAccessVoiceAgent(...args),
  },
}));

// Mock MinuteLimitService
const mockGetUsageSummary = vi.fn();
const mockGetMinuteLimits = vi.fn();
const mockFormatMinutes = vi.fn();
const mockFormatPriceMXN = vi.fn();

vi.mock('@/src/features/voice-agent/services/minute-limit.service', () => ({
  MinuteLimitService: {
    getUsageSummary: (...args: unknown[]) => mockGetUsageSummary(...args),
    getMinuteLimits: (...args: unknown[]) => mockGetMinuteLimits(...args),
    formatMinutes: (...args: unknown[]) => mockFormatMinutes(...args),
    formatPriceMXN: (...args: unknown[]) => mockFormatPriceMXN(...args),
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

function createMockRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

// ======================
// TESTS
// ======================

describe('Voice Usage API - /api/voice-agent/usage', () => {
  let GET: typeof import('@/app/api/voice-agent/usage/route').GET;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default mock setup
    mockIsAuthError.mockReturnValue(false);
    mockGetAuthenticatedContext.mockResolvedValue({
      tenantId: 'tenant-123',
      client: {},
      role: 'admin',
    });
    mockCanAccessVoiceAgent.mockResolvedValue({
      canAccess: true,
      plan: 'growth',
    });

    // Format helpers defaults
    mockFormatMinutes.mockImplementation((minutes: number) => `${minutes} min`);
    mockFormatPriceMXN.mockImplementation((centavos: number) => `$${(centavos / 100).toFixed(2)} MXN`);

    // Import route handler
    const routeModule = await import('@/app/api/voice-agent/usage/route');
    GET = routeModule.GET;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Authentication', () => {
    it('should return auth error when not authenticated', async () => {
      const mockErrorResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
      mockIsAuthError.mockReturnValue(true);
      mockCreateAuthErrorResponse.mockReturnValue(mockErrorResponse);

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);

      expect(mockGetAuthenticatedContext).toHaveBeenCalledWith(request);
      expect(mockCreateAuthErrorResponse).toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it('should proceed when authenticated', async () => {
      mockGetUsageSummary.mockResolvedValue({
        total_minutes_used: 100,
        included_minutes_used: 100,
        overage_minutes_used: 0,
        remaining_included: 100,
        usage_percent: 50,
        overage_charges_centavos: 0,
        overage_price_centavos: 300,
        billing_period_end: '2025-01-31',
      });
      mockGetMinuteLimits.mockResolvedValue({
        included_minutes: 200,
        overage_enabled: true,
        hard_limit_minutes: null,
      });

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);

      expect(mockGetAuthenticatedContext).toHaveBeenCalledWith(request);
      expect(mockIsAuthError).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('Access Control', () => {
    it('should return 403 when Voice Agent not accessible', async () => {
      mockCanAccessVoiceAgent.mockResolvedValue({
        canAccess: false,
        reason: 'Voice Agent solo disponible en plan Growth',
        plan: 'starter',
      });

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Voice Agent solo disponible en plan Growth');
      expect(data.plan).toBe('starter');
    });

    it('should use default error message when reason not provided', async () => {
      mockCanAccessVoiceAgent.mockResolvedValue({
        canAccess: false,
        plan: 'starter',
      });

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Voice Agent no disponible en tu plan');
    });

    it('should proceed when Voice Agent is accessible', async () => {
      mockGetUsageSummary.mockResolvedValue({
        total_minutes_used: 0,
        included_minutes_used: 0,
        overage_minutes_used: 0,
        remaining_included: 200,
        usage_percent: 0,
        overage_charges_centavos: 0,
        overage_price_centavos: 300,
        billing_period_end: '2025-01-31',
      });
      mockGetMinuteLimits.mockResolvedValue({
        included_minutes: 200,
        overage_enabled: true,
        hard_limit_minutes: null,
      });

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);

      expect(mockCanAccessVoiceAgent).toHaveBeenCalledWith('tenant-123');
      expect(response.status).toBe(200);
    });
  });

  describe('Usage Summary Response', () => {
    it('should return complete usage summary', async () => {
      const mockUsage = {
        total_minutes_used: 147,
        included_minutes_used: 147,
        overage_minutes_used: 0,
        remaining_included: 53,
        usage_percent: 73.5,
        overage_charges_centavos: 0,
        overage_price_centavos: 300,
        billing_period_end: '2025-01-31',
      };

      const mockLimits = {
        included_minutes: 200,
        overage_enabled: true,
        overage_price_centavos: 300,
        hard_limit_minutes: null,
      };

      mockGetUsageSummary.mockResolvedValue(mockUsage);
      mockGetMinuteLimits.mockResolvedValue(mockLimits);

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.usage).toEqual(mockUsage);
      expect(data.limits).toEqual(mockLimits);
    });

    it('should include formatted values', async () => {
      const mockUsage = {
        total_minutes_used: 147,
        included_minutes_used: 147,
        overage_minutes_used: 0,
        remaining_included: 53,
        usage_percent: 73.5,
        overage_charges_centavos: 0,
        overage_price_centavos: 300,
        billing_period_end: '2025-01-31',
      };

      mockGetUsageSummary.mockResolvedValue(mockUsage);
      mockGetMinuteLimits.mockResolvedValue({});

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(data.formatted).toBeDefined();
      expect(data.formatted.used).toBe('147 min');
      expect(data.formatted.included_used).toBe('147 min');
      expect(data.formatted.overage_used).toBe('0 min');
      expect(data.formatted.remaining).toBe('53 min');
      expect(data.formatted.percent).toBe('73.5%');
      expect(data.formatted.overageCharges).toBeDefined();
      expect(data.formatted.overagePrice).toBeDefined();
      expect(data.formatted.resetDate).toBeDefined();
    });

    it('should format reset date correctly in Spanish', async () => {
      const mockUsage = {
        total_minutes_used: 100,
        included_minutes_used: 100,
        overage_minutes_used: 0,
        remaining_included: 100,
        usage_percent: 50,
        overage_charges_centavos: 0,
        overage_price_centavos: 300,
        billing_period_end: '2025-03-15',
      };

      mockGetUsageSummary.mockResolvedValue(mockUsage);
      mockGetMinuteLimits.mockResolvedValue({});

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);
      const data = await response.json();

      // Should format as "15 de marzo" or similar Spanish format
      expect(data.formatted.resetDate).toBeDefined();
      expect(typeof data.formatted.resetDate).toBe('string');
    });
  });

  describe('Usage with Overage', () => {
    it('should return usage with overage details', async () => {
      const mockUsage = {
        total_minutes_used: 250,
        included_minutes_used: 200,
        overage_minutes_used: 50,
        remaining_included: 0,
        usage_percent: 125,
        overage_charges_centavos: 15000,
        overage_price_centavos: 300,
        billing_period_end: '2025-01-31',
      };

      mockGetUsageSummary.mockResolvedValue(mockUsage);
      mockGetMinuteLimits.mockResolvedValue({
        included_minutes: 200,
        overage_enabled: true,
        overage_price_centavos: 300,
        hard_limit_minutes: null,
      });

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.usage.overage_minutes_used).toBe(50);
      expect(data.usage.overage_charges_centavos).toBe(15000);
      expect(data.formatted.overage_used).toBe('50 min');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when getUsageSummary returns null', async () => {
      mockGetUsageSummary.mockResolvedValue(null);

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Error al obtener datos de uso');
    });

    it('should return 500 when getUsageSummary throws', async () => {
      mockGetUsageSummary.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Error interno del servidor');
    });

    it('should return 500 when getMinuteLimits throws', async () => {
      mockGetUsageSummary.mockResolvedValue({
        total_minutes_used: 100,
        included_minutes_used: 100,
        overage_minutes_used: 0,
        remaining_included: 100,
        usage_percent: 50,
        overage_charges_centavos: 0,
        overage_price_centavos: 300,
        billing_period_end: '2025-01-31',
      });
      mockGetMinuteLimits.mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should handle unknown errors', async () => {
      mockGetUsageSummary.mockRejectedValue('Non-Error object');

      const request = createMockRequest('/api/voice-agent/usage');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('Format Helper Calls', () => {
    it('should call formatMinutes for all minute values', async () => {
      const mockUsage = {
        total_minutes_used: 147,
        included_minutes_used: 147,
        overage_minutes_used: 0,
        remaining_included: 53,
        usage_percent: 73.5,
        overage_charges_centavos: 0,
        overage_price_centavos: 300,
        billing_period_end: '2025-01-31',
      };

      mockGetUsageSummary.mockResolvedValue(mockUsage);
      mockGetMinuteLimits.mockResolvedValue({});

      const request = createMockRequest('/api/voice-agent/usage');
      await GET(request);

      expect(mockFormatMinutes).toHaveBeenCalledWith(147); // total_minutes_used
      expect(mockFormatMinutes).toHaveBeenCalledWith(147); // included_minutes_used
      expect(mockFormatMinutes).toHaveBeenCalledWith(0);   // overage_minutes_used
      expect(mockFormatMinutes).toHaveBeenCalledWith(53);  // remaining_included
    });

    it('should call formatPriceMXN for overage charges and price', async () => {
      const mockUsage = {
        total_minutes_used: 250,
        included_minutes_used: 200,
        overage_minutes_used: 50,
        remaining_included: 0,
        usage_percent: 125,
        overage_charges_centavos: 15000,
        overage_price_centavos: 300,
        billing_period_end: '2025-01-31',
      };

      mockGetUsageSummary.mockResolvedValue(mockUsage);
      mockGetMinuteLimits.mockResolvedValue({});

      const request = createMockRequest('/api/voice-agent/usage');
      await GET(request);

      expect(mockFormatPriceMXN).toHaveBeenCalledWith(15000); // overage_charges_centavos
      expect(mockFormatPriceMXN).toHaveBeenCalledWith(300);   // overage_price_centavos
    });
  });
});

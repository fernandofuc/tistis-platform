/**
 * Tests for Voice Agent Billing API
 * /api/voice-agent/billing
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

// Mock voiceBillingService
const mockGetBillingHistory = vi.fn();
const mockPreviewUpcomingCharges = vi.fn();

vi.mock('@/src/features/voice-agent/services/voice-billing.service', () => ({
  voiceBillingService: {
    getBillingHistory: (...args: unknown[]) => mockGetBillingHistory(...args),
    previewUpcomingCharges: (...args: unknown[]) => mockPreviewUpcomingCharges(...args),
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

describe('Voice Billing API - /api/voice-agent/billing', () => {
  let GET: typeof import('@/app/api/voice-agent/billing/route').GET;

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

    // Import route handler
    const routeModule = await import('@/app/api/voice-agent/billing/route');
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

      const request = createMockRequest('/api/voice-agent/billing');
      const response = await GET(request);

      expect(mockGetAuthenticatedContext).toHaveBeenCalledWith(request);
      expect(mockCreateAuthErrorResponse).toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it('should proceed when authenticated', async () => {
      mockGetBillingHistory.mockResolvedValue({ items: [], total: 0 });

      const request = createMockRequest('/api/voice-agent/billing');
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

      const request = createMockRequest('/api/voice-agent/billing');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Voice Agent solo disponible en plan Growth');
      expect(data.plan).toBe('starter');
    });

    it('should proceed when Voice Agent is accessible', async () => {
      mockGetBillingHistory.mockResolvedValue({ items: [], total: 0 });

      const request = createMockRequest('/api/voice-agent/billing');
      const response = await GET(request);
      const data = await response.json();

      expect(mockCanAccessVoiceAgent).toHaveBeenCalledWith('tenant-123');
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Query Parameters', () => {
    beforeEach(() => {
      mockGetBillingHistory.mockResolvedValue({ items: [], total: 0 });
    });

    it('should use default limit and offset', async () => {
      const request = createMockRequest('/api/voice-agent/billing');
      await GET(request);

      expect(mockGetBillingHistory).toHaveBeenCalledWith('tenant-123', {
        limit: 12,
        offset: 0,
      });
    });

    it('should parse custom limit and offset', async () => {
      const request = createMockRequest('/api/voice-agent/billing?limit=20&offset=10');
      await GET(request);

      expect(mockGetBillingHistory).toHaveBeenCalledWith('tenant-123', {
        limit: 20,
        offset: 10,
      });
    });

    it('should clamp limit to maximum of 50', async () => {
      const request = createMockRequest('/api/voice-agent/billing?limit=100');
      await GET(request);

      expect(mockGetBillingHistory).toHaveBeenCalledWith('tenant-123', {
        limit: 50,
        offset: 0,
      });
    });

    it('should clamp limit to minimum of 1', async () => {
      const request = createMockRequest('/api/voice-agent/billing?limit=0');
      await GET(request);

      expect(mockGetBillingHistory).toHaveBeenCalledWith('tenant-123', {
        limit: 1,
        offset: 0,
      });
    });

    it('should clamp offset to minimum of 0', async () => {
      const request = createMockRequest('/api/voice-agent/billing?offset=-10');
      await GET(request);

      expect(mockGetBillingHistory).toHaveBeenCalledWith('tenant-123', {
        limit: 12,
        offset: 0,
      });
    });

    it('should handle NaN values for limit gracefully', async () => {
      const request = createMockRequest('/api/voice-agent/billing?limit=abc');
      await GET(request);

      expect(mockGetBillingHistory).toHaveBeenCalledWith('tenant-123', {
        limit: 12,
        offset: 0,
      });
    });

    it('should handle NaN values for offset gracefully', async () => {
      const request = createMockRequest('/api/voice-agent/billing?offset=xyz');
      await GET(request);

      expect(mockGetBillingHistory).toHaveBeenCalledWith('tenant-123', {
        limit: 12,
        offset: 0,
      });
    });
  });

  describe('Billing History', () => {
    it('should return formatted billing history', async () => {
      const mockHistoryItems = [
        {
          usageId: 'usage-1',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-31'),
          includedMinutesUsed: 180,
          overageMinutesUsed: 20,
          totalMinutesUsed: 200,
          overageChargesCentavos: 6000,
          overageChargesPesos: 60,
          totalCalls: 50,
          isBilled: true,
          stripeInvoiceId: 'inv_123',
        },
      ];

      mockGetBillingHistory.mockResolvedValue({
        items: mockHistoryItems,
        total: 1,
      });

      const request = createMockRequest('/api/voice-agent/billing?include_preview=false');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.history.items).toHaveLength(1);
      expect(data.history.total).toBe(1);

      const item = data.history.items[0];
      expect(item.usageId).toBe('usage-1');
      expect(item.includedMinutesUsed).toBe(180);
      expect(item.overageMinutesUsed).toBe(20);
      expect(item.totalMinutesUsed).toBe(200);
      expect(item.isBilled).toBe(true);
      expect(item.stripeInvoiceId).toBe('inv_123');
      // Check formatted fields exist
      expect(item.periodStart).toBeDefined();
      expect(item.periodEnd).toBeDefined();
      expect(item.overageChargesFormatted).toBeDefined();
      expect(item.periodLabel).toBeDefined();
    });

    it('should return empty history when no records', async () => {
      mockGetBillingHistory.mockResolvedValue({ items: [], total: 0 });

      const request = createMockRequest('/api/voice-agent/billing?include_preview=false');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.history.items).toHaveLength(0);
      expect(data.history.total).toBe(0);
    });
  });

  describe('Preview (Upcoming Charges)', () => {
    beforeEach(() => {
      mockGetBillingHistory.mockResolvedValue({ items: [], total: 0 });
    });

    it('should include preview by default', async () => {
      mockPreviewUpcomingCharges.mockResolvedValue({
        currentOverageMinutes: 15,
        currentOverageAmount: 45,
        projectedEndOfMonth: 30,
        projectedAmount: 90,
        daysElapsed: 15,
        daysTotal: 30,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
      });

      const request = createMockRequest('/api/voice-agent/billing');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preview).toBeDefined();
      expect(data.preview.currentOverageMinutes).toBe(15);
      expect(data.preview.projectedEndOfMonth).toBe(30);
      expect(data.preview.daysRemaining).toBe(15);
      expect(data.preview.currentOverageFormatted).toBeDefined();
      expect(data.preview.projectedFormatted).toBeDefined();
    });

    it('should exclude preview when include_preview=false', async () => {
      const request = createMockRequest('/api/voice-agent/billing?include_preview=false');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preview).toBeUndefined();
      expect(mockPreviewUpcomingCharges).not.toHaveBeenCalled();
    });

    it('should not fail when preview throws an error', async () => {
      mockPreviewUpcomingCharges.mockRejectedValue(new Error('Preview failed'));

      const request = createMockRequest('/api/voice-agent/billing');
      const response = await GET(request);
      const data = await response.json();

      // Should still return success with history, just without preview
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.history).toBeDefined();
      expect(data.preview).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when getBillingHistory throws', async () => {
      mockGetBillingHistory.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest('/api/voice-agent/billing');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Error al obtener datos de facturación');
    });

    it('should handle unknown errors', async () => {
      mockGetBillingHistory.mockRejectedValue('Non-Error object');

      const request = createMockRequest('/api/voice-agent/billing');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('Currency Formatting', () => {
    it('should format overage charges in MXN', async () => {
      mockGetBillingHistory.mockResolvedValue({
        items: [
          {
            usageId: 'usage-1',
            periodStart: new Date('2025-01-01'),
            periodEnd: new Date('2025-01-31'),
            includedMinutesUsed: 180,
            overageMinutesUsed: 50,
            totalMinutesUsed: 230,
            overageChargesCentavos: 15000,
            overageChargesPesos: 150,
            totalCalls: 75,
            isBilled: true,
            stripeInvoiceId: null,
          },
        ],
        total: 1,
      });

      const request = createMockRequest('/api/voice-agent/billing?include_preview=false');
      const response = await GET(request);
      const data = await response.json();

      const item = data.history.items[0];
      // Check that it contains MXN currency format
      expect(item.overageChargesFormatted).toMatch(/\$.*150/);
    });
  });
});

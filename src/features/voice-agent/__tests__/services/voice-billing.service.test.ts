// =====================================================
// TIS TIS PLATFORM - Voice Billing Service Tests
// FASE 6: Testing - Voice Minute Limits
// =====================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

// ======================
// MOCKS
// ======================

// Mock Stripe
const mockStripeInvoiceItemsCreate = vi.fn();
const mockStripeCustomersRetrieve = vi.fn();
const mockStripeInvoicesRetrieve = vi.fn();

// Create a mock Stripe class that works as constructor
class MockStripe {
  invoiceItems = {
    create: mockStripeInvoiceItemsCreate,
  };
  customers = {
    retrieve: mockStripeCustomersRetrieve,
  };
  invoices = {
    retrieve: mockStripeInvoicesRetrieve,
  };
}

vi.mock('stripe', () => {
  return {
    default: MockStripe,
  };
});

// Mock Supabase
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

// Mock logger
vi.mock('@/src/shared/lib', () => ({
  createComponentLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ======================
// TEST DATA
// ======================

const mockTenantBillingData = {
  tenant_id: '550e8400-e29b-41d4-a716-446655440000',
  tenant_name: 'Test Restaurant',
  stripe_customer_id: 'cus_test123',
  stripe_subscription_id: 'sub_test123',
  overage_minutes: 25.5,
  overage_charges_centavos: 8925, // 25.5 * 350
  period_start: '2025-01-01T00:00:00Z',
  period_end: '2025-02-01T00:00:00Z',
};

const mockBillingHistoryData = [
  {
    usage_id: '660e8400-e29b-41d4-a716-446655440001',
    period_start: '2025-01-01T00:00:00Z',
    period_end: '2025-02-01T00:00:00Z',
    included_minutes_used: 200,
    overage_minutes_used: 25.5,
    total_minutes_used: 225.5,
    overage_charges_centavos: 8925,
    overage_charges_pesos: 89.25,
    total_calls: 150,
    is_billed: false,
    stripe_invoice_id: null,
    created_at: '2025-01-01T00:00:00Z',
  },
];

const mockOveragePreviewData = {
  overage_minutes: 15.0,
  overage_charges_centavos: 5250,
  days_elapsed: 15,
  days_total: 31,
  period_start: '2025-01-01T00:00:00Z',
  period_end: '2025-02-01T00:00:00Z',
  overage_price_centavos: 350,
};

// ======================
// IMPORT SERVICE (after mocks)
// ======================

// Dynamic import to ensure mocks are in place
const getService = async () => {
  // Clear module cache to ensure fresh import with mocks
  vi.resetModules();

  // Set required env vars
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

  const serviceModule = await import('../../services/voice-billing.service');
  return serviceModule;
};

// ======================
// TEST SUITES
// ======================

describe('VoiceBillingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock chain for Supabase from().select().eq()
    mockEq.mockReturnValue({ count: 5, error: null });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ======================
  // Singleton Tests
  // ======================

  describe('Singleton Pattern', () => {
    it('should return the same instance', async () => {
      const { VoiceBillingService } = await getService();

      const instance1 = VoiceBillingService.getInstance();
      const instance2 = VoiceBillingService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should export voiceBillingService as singleton', async () => {
      const { VoiceBillingService, voiceBillingService } = await getService();

      expect(voiceBillingService).toBe(VoiceBillingService.getInstance());
    });
  });

  // ======================
  // getTenantsWithPendingOverage Tests
  // ======================

  describe('getTenantsWithPendingOverage', () => {
    it('should return tenants with pending overage', async () => {
      mockRpc.mockResolvedValue({
        data: [mockTenantBillingData],
        error: null,
      });

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.getTenantsWithPendingOverage();

      expect(mockRpc).toHaveBeenCalledWith('get_tenants_pending_overage_billing', {
        p_check_date: expect.any(String),
      });
      expect(result).toHaveLength(1);
      expect(result[0].tenantId).toBe(mockTenantBillingData.tenant_id);
      expect(result[0].tenantName).toBe(mockTenantBillingData.tenant_name);
      expect(result[0].overageMinutes).toBe(25.5);
      // overageAmount should come from DB (centavos / 100)
      expect(result[0].overageAmount).toBe(89.25);
    });

    it('should return empty array when no tenants have overage', async () => {
      mockRpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.getTenantsWithPendingOverage();

      expect(result).toEqual([]);
    });

    it('should handle null tenant_name with fallback', async () => {
      mockRpc.mockResolvedValue({
        data: [{ ...mockTenantBillingData, tenant_name: null }],
        error: null,
      });

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.getTenantsWithPendingOverage();

      expect(result[0].tenantName).toBe('Tenant');
    });

    it('should throw error when RPC fails', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const { voiceBillingService } = await getService();

      await expect(voiceBillingService.getTenantsWithPendingOverage())
        .rejects.toThrow('Failed to fetch overage data');
    });

    it('should accept custom period end date', async () => {
      mockRpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const customDate = new Date('2025-01-15T00:00:00Z');
      const { voiceBillingService } = await getService();
      await voiceBillingService.getTenantsWithPendingOverage(customDate);

      expect(mockRpc).toHaveBeenCalledWith('get_tenants_pending_overage_billing', {
        p_check_date: customDate.toISOString(),
      });
    });
  });

  // ======================
  // createOverageInvoiceItem Tests
  // ======================

  describe('createOverageInvoiceItem', () => {
    const mockBillingInfo = {
      tenantId: '550e8400-e29b-41d4-a716-446655440000',
      tenantName: 'Test Restaurant',
      stripeCustomerId: 'cus_test123',
      stripeSubscriptionId: 'sub_test123',
      overageMinutes: 25.5,
      overageChargesCentavos: 8925,
      overageAmount: 89.25,
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-02-01'),
    };

    it('should create invoice item successfully', async () => {
      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_test123' });
      mockStripeInvoiceItemsCreate.mockResolvedValue({ id: 'ii_test123' });
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.createOverageInvoiceItem(mockBillingInfo);

      expect(result.success).toBe(true);
      expect(result.invoiceItemId).toBe('ii_test123');
      expect(result.amount).toBe(89.25);
    });

    it('should use overageChargesCentavos from billing info', async () => {
      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_test123' });
      mockStripeInvoiceItemsCreate.mockResolvedValue({ id: 'ii_test123' });
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      const { voiceBillingService } = await getService();
      await voiceBillingService.createOverageInvoiceItem(mockBillingInfo);

      expect(mockStripeInvoiceItemsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 8925, // Should use the centavos value directly
          currency: 'mxn',
        })
      );
    });

    it('should include correct metadata in invoice item', async () => {
      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_test123' });
      mockStripeInvoiceItemsCreate.mockResolvedValue({ id: 'ii_test123' });
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      const { voiceBillingService } = await getService();
      await voiceBillingService.createOverageInvoiceItem(mockBillingInfo);

      expect(mockStripeInvoiceItemsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tenant_id: mockBillingInfo.tenantId,
            type: 'voice_overage',
          }),
        })
      );
    });

    it('should handle deleted Stripe customer', async () => {
      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_test123', deleted: true });

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.createOverageInvoiceItem(mockBillingInfo);

      expect(result.success).toBe(false);
      expect(result.error).toContain('deleted');
    });

    it('should mark overage as billed after creating invoice item', async () => {
      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_test123' });
      mockStripeInvoiceItemsCreate.mockResolvedValue({ id: 'ii_test123' });
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      const { voiceBillingService } = await getService();
      await voiceBillingService.createOverageInvoiceItem(mockBillingInfo);

      expect(mockRpc).toHaveBeenCalledWith('mark_overage_as_billed', {
        p_tenant_id: mockBillingInfo.tenantId,
        p_period_start: mockBillingInfo.periodStart.toISOString(),
        p_stripe_invoice_item_id: 'ii_test123',
      });
    });

    it('should handle Stripe API error gracefully', async () => {
      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_test123' });
      mockStripeInvoiceItemsCreate.mockRejectedValue(new Error('Stripe API error'));

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.createOverageInvoiceItem(mockBillingInfo);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stripe API error');
    });

    it('should recalculate amount when overageChargesCentavos is 0', async () => {
      const billingWithZeroCentavos = {
        ...mockBillingInfo,
        overageChargesCentavos: 0,
        overageMinutes: 10,
      };

      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_test123' });
      mockStripeInvoiceItemsCreate.mockResolvedValue({ id: 'ii_test123' });
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      const { voiceBillingService } = await getService();
      await voiceBillingService.createOverageInvoiceItem(billingWithZeroCentavos);

      // Should recalculate: 10 minutes * 350 centavos = 3500
      expect(mockStripeInvoiceItemsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 3500,
        })
      );
    });

    it('should succeed even when mark_overage_as_billed RPC fails (warning only)', async () => {
      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_test123' });
      mockStripeInvoiceItemsCreate.mockResolvedValue({ id: 'ii_test123' });
      // Simulate mark_overage_as_billed RPC error
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } });

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.createOverageInvoiceItem(mockBillingInfo);

      // Should still succeed because invoice item was created
      expect(result.success).toBe(true);
      expect(result.invoiceItemId).toBe('ii_test123');
    });
  });

  // ======================
  // processMonthlyBilling Tests
  // ======================

  describe('processMonthlyBilling', () => {
    it('should process all tenants with overage', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [mockTenantBillingData], error: null }) // getTenantsWithPendingOverage
        .mockResolvedValue({ data: { success: true }, error: null }); // mark_overage_as_billed

      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_test123' });
      mockStripeInvoiceItemsCreate.mockResolvedValue({ id: 'ii_test123' });

      const { voiceBillingService } = await getService();
      const report = await voiceBillingService.processMonthlyBilling();

      expect(report.tenantsProcessed).toBe(1);
      expect(report.tenantsWithOverage).toBe(1);
      expect(report.results).toHaveLength(1);
      expect(report.results[0].success).toBe(true);
    });

    it('should return empty report when no tenants have overage', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const { voiceBillingService } = await getService();
      const report = await voiceBillingService.processMonthlyBilling();

      expect(report.tenantsProcessed).toBe(0);
      expect(report.tenantsWithOverage).toBe(0);
      expect(report.results).toEqual([]);
    });

    it('should track errors in report', async () => {
      mockRpc.mockResolvedValueOnce({ data: [mockTenantBillingData], error: null });
      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_test123', deleted: true });

      const { voiceBillingService } = await getService();
      const report = await voiceBillingService.processMonthlyBilling();

      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.results[0].success).toBe(false);
    });

    it('should calculate total overage amount', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: [mockTenantBillingData], error: null })
        .mockResolvedValue({ data: { success: true }, error: null });

      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_test123' });
      mockStripeInvoiceItemsCreate.mockResolvedValue({ id: 'ii_test123' });

      const { voiceBillingService } = await getService();
      const report = await voiceBillingService.processMonthlyBilling();

      expect(report.totalOverageMinutes).toBe(25.5);
      expect(report.totalOverageAmount).toBe(89.25);
    });

    it('should return report with error when getTenantsWithPendingOverage throws', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB connection failed' } });

      const { voiceBillingService } = await getService();
      const report = await voiceBillingService.processMonthlyBilling();

      // Should return a report with the error, not throw
      expect(report.tenantsProcessed).toBe(0);
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.errors[0]).toContain('Process error');
    });

    it('should process multiple tenants and continue on individual failures', async () => {
      const tenant1 = { ...mockTenantBillingData, tenant_id: 'tenant-1' };
      const tenant2 = { ...mockTenantBillingData, tenant_id: 'tenant-2', stripe_customer_id: 'cus_456' };

      mockRpc
        .mockResolvedValueOnce({ data: [tenant1, tenant2], error: null })
        .mockResolvedValue({ data: { success: true }, error: null });

      // First tenant succeeds, second tenant's customer is deleted
      mockStripeCustomersRetrieve
        .mockResolvedValueOnce({ id: 'cus_test123' })
        .mockResolvedValueOnce({ id: 'cus_456', deleted: true });
      mockStripeInvoiceItemsCreate.mockResolvedValue({ id: 'ii_test123' });

      const { voiceBillingService } = await getService();
      const report = await voiceBillingService.processMonthlyBilling();

      expect(report.tenantsProcessed).toBe(2);
      expect(report.results).toHaveLength(2);
      expect(report.results[0].success).toBe(true);
      expect(report.results[1].success).toBe(false);
      expect(report.errors.length).toBe(1);
    });
  });

  // ======================
  // getBillingHistory Tests
  // ======================

  describe('getBillingHistory', () => {
    it('should return billing history for tenant', async () => {
      mockRpc.mockResolvedValue({ data: mockBillingHistoryData, error: null });
      mockEq.mockReturnValue({ count: 1, error: null });

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.getBillingHistory(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].usageId).toBe(mockBillingHistoryData[0].usage_id);
      expect(result.items[0].includedMinutesUsed).toBe(200);
      expect(result.items[0].overageMinutesUsed).toBe(25.5);
    });

    it('should validate UUID format', async () => {
      const { voiceBillingService } = await getService();

      await expect(voiceBillingService.getBillingHistory('invalid-uuid'))
        .rejects.toThrow('Invalid tenant ID format');
    });

    it('should use default limit and offset', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });
      mockEq.mockReturnValue({ count: 0, error: null });

      const { voiceBillingService } = await getService();
      await voiceBillingService.getBillingHistory('550e8400-e29b-41d4-a716-446655440000');

      expect(mockRpc).toHaveBeenCalledWith('get_voice_billing_history', {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        p_limit: 12,
        p_offset: 0,
      });
    });

    it('should accept custom limit and offset', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });
      mockEq.mockReturnValue({ count: 0, error: null });

      const { voiceBillingService } = await getService();
      await voiceBillingService.getBillingHistory(
        '550e8400-e29b-41d4-a716-446655440000',
        { limit: 5, offset: 10 }
      );

      expect(mockRpc).toHaveBeenCalledWith('get_voice_billing_history', {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440000',
        p_limit: 5,
        p_offset: 10,
      });
    });

    it('should return total count for pagination', async () => {
      mockRpc.mockResolvedValue({ data: mockBillingHistoryData, error: null });
      mockEq.mockReturnValue({ count: 25, error: null });

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.getBillingHistory(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(result.total).toBe(25);
    });

    it('should fall back to items.length when count query fails', async () => {
      mockRpc.mockResolvedValue({ data: mockBillingHistoryData, error: null });
      // Count query fails
      mockEq.mockReturnValue({ count: null, error: { message: 'Count failed' } });

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.getBillingHistory(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      // Should fallback to items.length
      expect(result.total).toBe(mockBillingHistoryData.length);
    });

    it('should throw error when RPC fails', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Database error' } });

      const { voiceBillingService } = await getService();

      await expect(voiceBillingService.getBillingHistory(
        '550e8400-e29b-41d4-a716-446655440000'
      )).rejects.toThrow('Failed to fetch billing history');
    });
  });

  // ======================
  // handlePaymentConfirmation Tests
  // ======================

  describe('handlePaymentConfirmation', () => {
    it('should update payment status for voice overage items', async () => {
      const mockInvoice = {
        id: 'in_test123',
        lines: {
          data: [
            {
              id: 'ii_test123',
              metadata: { type: 'voice_overage', tenant_id: 'tenant-123' },
            },
          ],
        },
      };

      mockStripeInvoicesRetrieve.mockResolvedValue(mockInvoice);
      mockRpc.mockResolvedValue({ error: null });

      const { voiceBillingService } = await getService();
      await voiceBillingService.handlePaymentConfirmation('in_test123');

      expect(mockRpc).toHaveBeenCalledWith('update_overage_payment_status', {
        p_stripe_invoice_item_id: 'ii_test123',
        p_stripe_invoice_id: 'in_test123',
        p_paid_at: expect.any(String),
      });
    });

    it('should skip invoices without voice overage items', async () => {
      const mockInvoice = {
        id: 'in_test123',
        lines: {
          data: [
            {
              id: 'ii_test123',
              metadata: { type: 'subscription' },
            },
          ],
        },
      };

      mockStripeInvoicesRetrieve.mockResolvedValue(mockInvoice);

      const { voiceBillingService } = await getService();
      await voiceBillingService.handlePaymentConfirmation('in_test123');

      // Should not call update RPC
      expect(mockRpc).not.toHaveBeenCalledWith(
        'update_overage_payment_status',
        expect.any(Object)
      );
    });

    it('should handle Stripe API errors', async () => {
      mockStripeInvoicesRetrieve.mockRejectedValue(new Error('Invoice not found'));

      const { voiceBillingService } = await getService();

      await expect(voiceBillingService.handlePaymentConfirmation('in_invalid'))
        .rejects.toThrow('Invoice not found');
    });

    it('should skip items without id', async () => {
      const mockInvoice = {
        id: 'in_test123',
        lines: {
          data: [
            {
              // No id field
              metadata: { type: 'voice_overage', tenant_id: 'tenant-123' },
            },
            {
              id: 'ii_test456',
              metadata: { type: 'voice_overage', tenant_id: 'tenant-456' },
            },
          ],
        },
      };

      mockStripeInvoicesRetrieve.mockResolvedValue(mockInvoice);
      mockRpc.mockResolvedValue({ error: null });

      const { voiceBillingService } = await getService();
      await voiceBillingService.handlePaymentConfirmation('in_test123');

      // Should only call RPC for item with id
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('update_overage_payment_status', {
        p_stripe_invoice_item_id: 'ii_test456',
        p_stripe_invoice_id: 'in_test123',
        p_paid_at: expect.any(String),
      });
    });

    it('should continue processing when update_overage_payment_status RPC fails (warning only)', async () => {
      const mockInvoice = {
        id: 'in_test123',
        lines: {
          data: [
            {
              id: 'ii_test123',
              metadata: { type: 'voice_overage', tenant_id: 'tenant-123' },
            },
            {
              id: 'ii_test456',
              metadata: { type: 'voice_overage', tenant_id: 'tenant-456' },
            },
          ],
        },
      };

      mockStripeInvoicesRetrieve.mockResolvedValue(mockInvoice);
      // First call fails, second succeeds
      mockRpc
        .mockResolvedValueOnce({ error: { message: 'RPC error' } })
        .mockResolvedValueOnce({ error: null });

      const { voiceBillingService } = await getService();

      // Should not throw even though first RPC failed
      await expect(voiceBillingService.handlePaymentConfirmation('in_test123'))
        .resolves.not.toThrow();

      // Both items should be processed
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });
  });

  // ======================
  // previewUpcomingCharges Tests
  // ======================

  describe('previewUpcomingCharges', () => {
    it('should return current overage preview', async () => {
      mockRpc.mockResolvedValue({ data: [mockOveragePreviewData], error: null });

      const { voiceBillingService } = await getService();
      const preview = await voiceBillingService.previewUpcomingCharges(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(preview.currentOverageMinutes).toBe(15.0);
      expect(preview.currentOverageChargesCentavos).toBe(5250);
      expect(preview.currentOverageAmount).toBe(52.50);
      expect(preview.daysElapsed).toBe(15);
      expect(preview.daysTotal).toBe(31);
    });

    it('should validate UUID format', async () => {
      const { voiceBillingService } = await getService();

      await expect(voiceBillingService.previewUpcomingCharges('not-a-uuid'))
        .rejects.toThrow('Invalid tenant ID format');
    });

    it('should calculate projected end of month charges', async () => {
      mockRpc.mockResolvedValue({ data: [mockOveragePreviewData], error: null });

      const { voiceBillingService } = await getService();
      const preview = await voiceBillingService.previewUpcomingCharges(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      // Daily rate = 15 / 15 = 1 min/day
      // Projected = 1 * 31 = 31 minutes
      // Amount = 31 * 3.50 = 108.50 (using tenant price from DB)
      expect(preview.projectedEndOfMonth).toBe(31);
      expect(preview.projectedAmount).toBe(108.5);
    });

    it('should use tenant-specific overage price', async () => {
      const customPriceData = {
        ...mockOveragePreviewData,
        overage_price_centavos: 500, // $5.00 MXN per minute
      };
      mockRpc.mockResolvedValue({ data: [customPriceData], error: null });

      const { voiceBillingService } = await getService();
      const preview = await voiceBillingService.previewUpcomingCharges(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      // Daily rate = 15 / 15 = 1 min/day
      // Projected = 1 * 31 = 31 minutes
      // Amount = 31 * 5.00 = 155.00 (using custom tenant price)
      expect(preview.projectedAmount).toBe(155);
    });

    it('should return defaults when no data exists', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const { voiceBillingService } = await getService();
      const preview = await voiceBillingService.previewUpcomingCharges(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(preview.currentOverageMinutes).toBe(0);
      expect(preview.currentOverageAmount).toBe(0);
      expect(preview.projectedEndOfMonth).toBe(0);
    });

    it('should handle zero days elapsed (dailyRate = 0)', async () => {
      const zeroDaysData = {
        ...mockOveragePreviewData,
        days_elapsed: 0,
        overage_minutes: 5,
      };
      mockRpc.mockResolvedValue({ data: [zeroDaysData], error: null });

      const { voiceBillingService } = await getService();
      const preview = await voiceBillingService.previewUpcomingCharges(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      // When daysElapsed is 0, dailyRate should be 0, so projected should be 0
      expect(preview.daysElapsed).toBe(0);
      expect(preview.projectedEndOfMonth).toBe(0);
      expect(preview.projectedAmount).toBe(0);
    });

    it('should throw error when RPC fails', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Preview failed' } });

      const { voiceBillingService } = await getService();

      await expect(voiceBillingService.previewUpcomingCharges(
        '550e8400-e29b-41d4-a716-446655440000'
      )).rejects.toThrow('Failed to get overage preview');
    });
  });

  // ======================
  // resetMonthlyUsage Tests
  // ======================

  describe('resetMonthlyUsage', () => {
    it('should reset monthly usage successfully', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, tenants_processed: 5 },
        error: null,
      });

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.resetMonthlyUsage();

      expect(mockRpc).toHaveBeenCalledWith('reset_monthly_voice_usage');
      expect(result.success).toBe(true);
      expect(result.tenantsProcessed).toBe(5);
    });

    it('should handle RPC errors', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Reset failed' },
      });

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.resetMonthlyUsage();

      expect(result.success).toBe(false);
      expect(result.tenantsProcessed).toBe(0);
    });

    it('should handle null response gracefully', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const { voiceBillingService } = await getService();
      const result = await voiceBillingService.resetMonthlyUsage();

      expect(result.success).toBe(true);
      expect(result.tenantsProcessed).toBe(0);
    });
  });
});

// ======================
// UUID Validation Tests
// ======================

describe('UUID Validation', () => {
  it('should accept valid UUID formats', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockEq.mockReturnValue({ count: 0, error: null });

    const { voiceBillingService } = await getService();

    // Should not throw for valid UUIDs
    await expect(
      voiceBillingService.getBillingHistory('550e8400-e29b-41d4-a716-446655440000')
    ).resolves.not.toThrow();

    await expect(
      voiceBillingService.getBillingHistory('123e4567-e89b-12d3-a456-426614174000')
    ).resolves.not.toThrow();
  });

  it('should reject invalid UUID formats', async () => {
    const { voiceBillingService } = await getService();

    const invalidUUIDs = [
      'not-a-uuid',
      '123',
      '550e8400-e29b-41d4-a716', // Too short
      '550e8400-e29b-41d4-a716-446655440000-extra', // Too long
      '550e8400e29b41d4a716446655440000', // No dashes
      'gggggggg-gggg-gggg-gggg-gggggggggggg', // Invalid chars
    ];

    for (const uuid of invalidUUIDs) {
      await expect(voiceBillingService.getBillingHistory(uuid))
        .rejects.toThrow('Invalid tenant ID format');
    }
  });
});

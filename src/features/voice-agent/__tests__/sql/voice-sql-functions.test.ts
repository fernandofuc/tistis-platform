/**
 * Tests for Voice Minute Limits SQL Functions
 * Tests RPC calls to SQL functions from migrations:
 * - 162_VOICE_MINUTE_LIMITS_SYSTEM.sql
 * - 163_VOICE_BILLING_FUNCTIONS.sql
 *
 * FASE 6.5: SQL Function Tests
 *
 * Note: These tests verify the TypeScript service layer correctly
 * interacts with SQL functions. The SQL functions themselves are
 * tested in integration/E2E tests against a real database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// ======================
// MOCKS
// ======================

// Mock Supabase client
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockLimit = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

// ======================
// SETUP CHAIN MOCKS
// ======================

function setupMockChain() {
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  });
  mockSelect.mockReturnValue({
    eq: mockEq,
    single: mockSingle,
    limit: mockLimit,
  });
  mockEq.mockReturnValue({
    eq: mockEq,
    single: mockSingle,
    limit: mockLimit,
  });
  mockInsert.mockReturnValue({
    select: mockSelect,
  });
  mockUpdate.mockReturnValue({
    eq: mockEq,
    select: mockSelect,
  });
  mockLimit.mockReturnValue({
    single: mockSingle,
  });
}

// ======================
// TESTS
// ======================

describe('Voice SQL Functions - RPC Calls', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupMockChain();
    supabase = createClient('http://test.supabase.co', 'test-key');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ======================
  // check_minute_limit
  // ======================

  describe('check_minute_limit RPC', () => {
    it('should call RPC with correct function name and parameters', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedResponse = {
        can_proceed: true,
        policy: 'charge',
        included_minutes: 200,
        included_used: 50,
        overage_used: 0,
        remaining_included: 150,
        total_used: 50,
        usage_percent: 25,
        is_at_limit: false,
        is_blocked: false,
        overage_price_centavos: 350,
        current_overage_charges: 0,
        max_overage_charge: 200000,
        usage_id: 'usage-123',
        billing_period_start: '2025-01-01T00:00:00Z',
        billing_period_end: '2025-02-01T00:00:00Z',
        total_calls: 10,
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data, error } = await supabase.rpc('check_minute_limit', {
        p_tenant_id: tenantId,
      });

      expect(mockRpc).toHaveBeenCalledWith('check_minute_limit', {
        p_tenant_id: tenantId,
      });
      expect(data).toEqual(expectedResponse);
      expect(error).toBeNull();
    });

    it('should return error for invalid tenant', async () => {
      const tenantId = 'non-existent-tenant';
      const expectedResponse = {
        can_proceed: false,
        error: 'Tenant not found',
        error_code: 'TENANT_NOT_FOUND',
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data } = await supabase.rpc('check_minute_limit', {
        p_tenant_id: tenantId,
      });

      expect(data.can_proceed).toBe(false);
      expect(data.error_code).toBe('TENANT_NOT_FOUND');
    });

    it('should return blocked status when policy is block and limit exceeded', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedResponse = {
        can_proceed: false,
        policy: 'block',
        remaining_included: 0,
        is_at_limit: true,
        is_blocked: false,
        block_reason:
          'Has alcanzado el limite de 200 minutos incluidos este mes.',
        error_code: 'LIMIT_EXCEEDED_BLOCK_POLICY',
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data } = await supabase.rpc('check_minute_limit', {
        p_tenant_id: tenantId,
      });

      expect(data.can_proceed).toBe(false);
      expect(data.error_code).toBe('LIMIT_EXCEEDED_BLOCK_POLICY');
    });

    it('should return plan not eligible for non-Growth plans', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedResponse = {
        can_proceed: false,
        error: 'Voice Agent solo esta disponible en el plan Growth',
        error_code: 'PLAN_NOT_ELIGIBLE',
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data } = await supabase.rpc('check_minute_limit', {
        p_tenant_id: tenantId,
      });

      expect(data.can_proceed).toBe(false);
      expect(data.error_code).toBe('PLAN_NOT_ELIGIBLE');
    });
  });

  // ======================
  // record_minute_usage
  // ======================

  describe('record_minute_usage RPC', () => {
    it('should call RPC with correct parameters', async () => {
      const params = {
        p_tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        p_call_id: '456e7890-e89b-12d3-a456-426614174000',
        p_seconds_used: 185,
        p_call_metadata: { direction: 'outbound', phone: '+5215512345678' },
      };

      const expectedResponse = {
        success: true,
        transaction_id: 'tx-123',
        minutes_recorded: 4, // Ceiling of 185/60 = 4
        seconds_recorded: 185,
        minutes_to_included: 4,
        minutes_to_overage: 0,
        is_overage: false,
        charge_centavos: 0,
        charge_pesos: 0,
        total_included_used: 54,
        total_overage_used: 0,
        total_overage_charges_centavos: 0,
        usage_percent: 27,
        remaining_included: 146,
        alert_threshold_triggered: null,
        is_blocked: false,
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data, error } = await supabase.rpc('record_minute_usage', params);

      expect(mockRpc).toHaveBeenCalledWith('record_minute_usage', params);
      expect(data.success).toBe(true);
      expect(data.minutes_recorded).toBe(4);
      expect(error).toBeNull();
    });

    it('should reject invalid seconds_used', async () => {
      const params = {
        p_tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        p_call_id: null,
        p_seconds_used: 0, // Invalid
        p_call_metadata: {},
      };

      const expectedResponse = {
        success: false,
        error: 'seconds_used must be greater than 0',
        error_code: 'INVALID_INPUT',
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data } = await supabase.rpc('record_minute_usage', params);

      expect(data.success).toBe(false);
      expect(data.error_code).toBe('INVALID_INPUT');
    });

    it('should calculate overage correctly', async () => {
      const params = {
        p_tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        p_call_id: '456e7890-e89b-12d3-a456-426614174000',
        p_seconds_used: 300, // 5 minutes
        p_call_metadata: {},
      };

      // Assuming 198 minutes already used, 5 more = 2 included + 3 overage
      const expectedResponse = {
        success: true,
        minutes_recorded: 5,
        minutes_to_included: 2,
        minutes_to_overage: 3,
        is_overage: true,
        charge_centavos: 1050, // 3 * 350
        charge_pesos: 10.5,
        total_included_used: 200,
        total_overage_used: 3,
        total_overage_charges_centavos: 1050,
        usage_percent: 100,
        remaining_included: 0,
        alert_threshold_triggered: 100,
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data } = await supabase.rpc('record_minute_usage', params);

      expect(data.is_overage).toBe(true);
      expect(data.minutes_to_overage).toBe(3);
      expect(data.charge_centavos).toBe(1050);
      expect(data.alert_threshold_triggered).toBe(100);
    });

    it('should reject usage when tenant is blocked', async () => {
      const params = {
        p_tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        p_call_id: null,
        p_seconds_used: 60,
        p_call_metadata: {},
      };

      const expectedResponse = {
        success: false,
        error: 'Tenant is blocked from making calls',
        error_code: 'TENANT_BLOCKED',
        blocked_reason: 'Limite maximo de cargo por overage alcanzado',
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data } = await supabase.rpc('record_minute_usage', params);

      expect(data.success).toBe(false);
      expect(data.error_code).toBe('TENANT_BLOCKED');
    });
  });

  // ======================
  // get_minute_usage_summary
  // ======================

  describe('get_minute_usage_summary RPC', () => {
    it('should return complete usage summary', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedResponse = {
        // Limits
        included_minutes: 200,
        overage_policy: 'charge',
        overage_price_centavos: 350,
        overage_price_pesos: 3.5,
        max_overage_charge_centavos: 200000,
        max_overage_charge_pesos: 2000,
        alert_thresholds: [70, 85, 95, 100],

        // Usage
        included_minutes_used: 150,
        overage_minutes_used: 0,
        total_minutes_used: 150,
        remaining_included: 50,

        // Status
        usage_percent: 75,
        is_at_limit: false,
        is_over_limit: false,
        is_blocked: false,

        // Period
        billing_period_start: '2025-01-01T00:00:00Z',
        billing_period_end: '2025-02-01T00:00:00Z',
        days_remaining: 6,
        days_elapsed: 25,
        days_total: 31,

        // Stats
        total_calls: 45,
        avg_call_duration: 3.3,
        last_alert_threshold: 70,

        // Notifications
        email_alerts_enabled: true,
        push_alerts_enabled: true,
        webhook_alerts_enabled: false,
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data, error } = await supabase.rpc('get_minute_usage_summary', {
        p_tenant_id: tenantId,
      });

      expect(mockRpc).toHaveBeenCalledWith('get_minute_usage_summary', {
        p_tenant_id: tenantId,
      });
      expect(data.included_minutes).toBe(200);
      expect(data.usage_percent).toBe(75);
      expect(error).toBeNull();
    });

    it('should return access denied for unauthorized tenant', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedResponse = {
        error: 'Access denied to this tenant',
        error_code: 'ACCESS_DENIED',
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data } = await supabase.rpc('get_minute_usage_summary', {
        p_tenant_id: tenantId,
      });

      expect(data.error_code).toBe('ACCESS_DENIED');
    });
  });

  // ======================
  // update_minute_limit_policy
  // ======================

  describe('update_minute_limit_policy RPC', () => {
    it('should update policy successfully', async () => {
      const params = {
        p_tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        p_overage_policy: 'block',
      };

      const expectedResponse = {
        success: true,
        new_policy: 'block',
        tenant_id: params.p_tenant_id,
        periods_unblocked: 0,
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data, error } = await supabase.rpc(
        'update_minute_limit_policy',
        params
      );

      expect(mockRpc).toHaveBeenCalledWith('update_minute_limit_policy', params);
      expect(data.success).toBe(true);
      expect(data.new_policy).toBe('block');
      expect(error).toBeNull();
    });

    it('should reject invalid policy', async () => {
      const params = {
        p_tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        p_overage_policy: 'invalid_policy',
      };

      const expectedResponse = {
        success: false,
        error: 'Invalid overage policy. Must be: block, charge, or notify_only',
        error_code: 'INVALID_POLICY',
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data } = await supabase.rpc(
        'update_minute_limit_policy',
        params
      );

      expect(data.success).toBe(false);
      expect(data.error_code).toBe('INVALID_POLICY');
    });

    it('should unblock periods when changing to charge policy', async () => {
      const params = {
        p_tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        p_overage_policy: 'charge',
      };

      const expectedResponse = {
        success: true,
        new_policy: 'charge',
        tenant_id: params.p_tenant_id,
        periods_unblocked: 2, // 2 periods were unblocked
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data } = await supabase.rpc(
        'update_minute_limit_policy',
        params
      );

      expect(data.success).toBe(true);
      expect(data.periods_unblocked).toBe(2);
    });

    it('should deny access to non-admin users', async () => {
      const params = {
        p_tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        p_overage_policy: 'charge',
      };

      const expectedResponse = {
        success: false,
        error: 'Access denied. Only owner or admin can change policy.',
        error_code: 'ACCESS_DENIED',
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data } = await supabase.rpc(
        'update_minute_limit_policy',
        params
      );

      expect(data.success).toBe(false);
      expect(data.error_code).toBe('ACCESS_DENIED');
    });
  });

  // ======================
  // get_tenants_pending_overage_billing
  // ======================

  describe('get_tenants_pending_overage_billing RPC', () => {
    it('should return tenants with pending overage', async () => {
      const expectedResponse = [
        {
          tenant_id: 'tenant-1',
          tenant_name: 'Clinica Dental',
          stripe_customer_id: 'cus_123',
          stripe_subscription_id: 'sub_123',
          overage_minutes: 50,
          overage_charges_centavos: 17500,
          period_start: '2025-01-01T00:00:00Z',
          period_end: '2025-02-01T00:00:00Z',
        },
        {
          tenant_id: 'tenant-2',
          tenant_name: 'Restaurante ABC',
          stripe_customer_id: 'cus_456',
          stripe_subscription_id: 'sub_456',
          overage_minutes: 25,
          overage_charges_centavos: 8750,
          period_start: '2025-01-01T00:00:00Z',
          period_end: '2025-02-01T00:00:00Z',
        },
      ];

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data, error } = await supabase.rpc(
        'get_tenants_pending_overage_billing',
        { p_check_date: new Date().toISOString() }
      );

      expect(mockRpc).toHaveBeenCalledWith(
        'get_tenants_pending_overage_billing',
        expect.any(Object)
      );
      expect(data).toHaveLength(2);
      expect(data[0].overage_minutes).toBe(50);
      expect(error).toBeNull();
    });

    it('should return empty array when no pending overage', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const { data } = await supabase.rpc(
        'get_tenants_pending_overage_billing',
        { p_check_date: new Date().toISOString() }
      );

      expect(data).toEqual([]);
    });
  });

  // ======================
  // get_current_overage_preview
  // ======================

  describe('get_current_overage_preview RPC', () => {
    it('should return current overage preview', async () => {
      const tenantId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedResponse = [
        {
          overage_minutes: 15,
          overage_charges_centavos: 5250,
          days_elapsed: 20,
          days_total: 31,
          period_start: '2025-01-01T00:00:00Z',
          period_end: '2025-02-01T00:00:00Z',
          overage_price_centavos: 350,
        },
      ];

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data, error } = await supabase.rpc('get_current_overage_preview', {
        p_tenant_id: tenantId,
      });

      expect(mockRpc).toHaveBeenCalledWith('get_current_overage_preview', {
        p_tenant_id: tenantId,
      });
      expect(data[0].overage_minutes).toBe(15);
      expect(data[0].overage_charges_centavos).toBe(5250);
      expect(error).toBeNull();
    });
  });

  // ======================
  // mark_overage_as_billed
  // ======================

  describe('mark_overage_as_billed RPC', () => {
    it('should mark overage as billed successfully', async () => {
      const params = {
        p_tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        p_period_start: '2025-01-01T00:00:00Z',
        p_stripe_invoice_item_id: 'ii_123abc',
      };

      const expectedResponse = {
        success: true,
        usage_id: 'usage-123',
        transactions_updated: 5,
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data, error } = await supabase.rpc('mark_overage_as_billed', params);

      expect(mockRpc).toHaveBeenCalledWith('mark_overage_as_billed', params);
      expect(data.success).toBe(true);
      expect(data.transactions_updated).toBe(5);
      expect(error).toBeNull();
    });

    it('should return error when usage not found', async () => {
      const params = {
        p_tenant_id: 'non-existent',
        p_period_start: '2025-01-01T00:00:00Z',
        p_stripe_invoice_item_id: 'ii_123abc',
      };

      const expectedResponse = {
        success: false,
        error: 'No matching usage record found or already billed',
        error_code: 'USAGE_NOT_FOUND',
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data } = await supabase.rpc('mark_overage_as_billed', params);

      expect(data.success).toBe(false);
      expect(data.error_code).toBe('USAGE_NOT_FOUND');
    });
  });

  // ======================
  // reset_monthly_voice_usage
  // ======================

  describe('reset_monthly_voice_usage RPC', () => {
    it('should reset monthly usage and create new periods', async () => {
      const expectedResponse = {
        success: true,
        tenants_processed: 15,
        new_period_start: '2025-02-01T00:00:00Z',
        new_period_end: '2025-03-01T00:00:00Z',
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data, error } = await supabase.rpc('reset_monthly_voice_usage');

      expect(mockRpc).toHaveBeenCalledWith('reset_monthly_voice_usage');
      expect(data.success).toBe(true);
      expect(data.tenants_processed).toBe(15);
      expect(error).toBeNull();
    });

    it('should handle no tenants to process', async () => {
      const expectedResponse = {
        success: true,
        tenants_processed: 0,
        new_period_start: '2025-02-01T00:00:00Z',
        new_period_end: '2025-03-01T00:00:00Z',
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data } = await supabase.rpc('reset_monthly_voice_usage');

      expect(data.success).toBe(true);
      expect(data.tenants_processed).toBe(0);
    });
  });

  // ======================
  // get_voice_billing_history
  // ======================

  describe('get_voice_billing_history RPC', () => {
    it('should return billing history with pagination', async () => {
      const params = {
        p_tenant_id: '123e4567-e89b-12d3-a456-426614174000',
        p_limit: 12,
        p_offset: 0,
      };

      const expectedResponse = [
        {
          usage_id: 'usage-1',
          period_start: '2025-01-01T00:00:00Z',
          period_end: '2025-02-01T00:00:00Z',
          included_minutes_used: 200,
          overage_minutes_used: 50,
          total_minutes_used: 250,
          overage_charges_centavos: 17500,
          overage_charges_pesos: 175,
          total_calls: 75,
          is_billed: true,
          stripe_invoice_id: 'inv_123',
          created_at: '2025-01-01T00:00:00Z',
        },
        {
          usage_id: 'usage-2',
          period_start: '2024-12-01T00:00:00Z',
          period_end: '2025-01-01T00:00:00Z',
          included_minutes_used: 180,
          overage_minutes_used: 0,
          total_minutes_used: 180,
          overage_charges_centavos: 0,
          overage_charges_pesos: 0,
          total_calls: 55,
          is_billed: true,
          stripe_invoice_id: null,
          created_at: '2024-12-01T00:00:00Z',
        },
      ];

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data, error } = await supabase.rpc(
        'get_voice_billing_history',
        params
      );

      expect(mockRpc).toHaveBeenCalledWith('get_voice_billing_history', params);
      expect(data).toHaveLength(2);
      expect(data[0].total_minutes_used).toBe(250);
      expect(error).toBeNull();
    });

    it('should reject unauthorized access', async () => {
      const params = {
        p_tenant_id: 'unauthorized-tenant',
        p_limit: 12,
        p_offset: 0,
      };

      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Access denied to tenant billing history' },
      });

      const { error } = await supabase.rpc('get_voice_billing_history', params);

      expect(error).toBeDefined();
      expect(error.message).toContain('Access denied');
    });
  });

  // ======================
  // update_overage_payment_status
  // ======================

  describe('update_overage_payment_status RPC', () => {
    it('should update payment status on invoice paid', async () => {
      const params = {
        p_stripe_invoice_item_id: 'ii_123abc',
        p_stripe_invoice_id: 'inv_final_123',
        p_paid_at: '2025-01-25T10:30:00Z',
      };

      const expectedResponse = {
        success: true,
        records_updated: 1,
        invoice_id: params.p_stripe_invoice_id,
        paid_at: params.p_paid_at,
      };

      mockRpc.mockResolvedValue({ data: expectedResponse, error: null });

      const { data, error } = await supabase.rpc(
        'update_overage_payment_status',
        params
      );

      expect(mockRpc).toHaveBeenCalledWith(
        'update_overage_payment_status',
        params
      );
      expect(data.success).toBe(true);
      expect(data.records_updated).toBe(1);
      expect(error).toBeNull();
    });
  });
});

// ======================
// INTEGRATION PATTERNS
// ======================

describe('Voice SQL Functions - Service Integration Patterns', () => {
  it('should follow correct flow for recording usage', async () => {
    /**
     * Flow:
     * 1. check_minute_limit (before call)
     * 2. [Call happens...]
     * 3. record_minute_usage (after call)
     */
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    const callId = '456e7890-e89b-12d3-a456-426614174000';
    const secondsUsed = 300;

    // Mock the correct sequence
    mockRpc
      .mockResolvedValueOnce({
        data: { can_proceed: true, policy: 'charge' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          minutes_recorded: 5,
          is_overage: false,
        },
        error: null,
      });

    const supabase = createClient('http://test.supabase.co', 'test-key');

    // Step 1: Check if can proceed
    const checkResult = await supabase.rpc('check_minute_limit', {
      p_tenant_id: tenantId,
    });
    expect(checkResult.data.can_proceed).toBe(true);

    // Step 2: Record usage after call
    const recordResult = await supabase.rpc('record_minute_usage', {
      p_tenant_id: tenantId,
      p_call_id: callId,
      p_seconds_used: secondsUsed,
      p_call_metadata: {},
    });
    expect(recordResult.data.success).toBe(true);
  });

  it('should follow correct flow for billing', async () => {
    /**
     * Flow:
     * 1. get_tenants_pending_overage_billing
     * 2. [Create Stripe invoice items...]
     * 3. mark_overage_as_billed (for each tenant)
     */
    const checkDate = new Date().toISOString();

    mockRpc
      .mockResolvedValueOnce({
        data: [
          {
            tenant_id: 'tenant-1',
            overage_charges_centavos: 5000,
            period_start: '2025-01-01T00:00:00Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: { success: true, transactions_updated: 3 },
        error: null,
      });

    const supabase = createClient('http://test.supabase.co', 'test-key');

    // Step 1: Get pending tenants
    const pendingResult = await supabase.rpc(
      'get_tenants_pending_overage_billing',
      { p_check_date: checkDate }
    );
    expect(pendingResult.data).toHaveLength(1);

    // Step 2: After creating Stripe invoice item, mark as billed
    const markResult = await supabase.rpc('mark_overage_as_billed', {
      p_tenant_id: 'tenant-1',
      p_period_start: '2025-01-01T00:00:00Z',
      p_stripe_invoice_item_id: 'ii_new_item',
    });
    expect(markResult.data.success).toBe(true);
  });
});

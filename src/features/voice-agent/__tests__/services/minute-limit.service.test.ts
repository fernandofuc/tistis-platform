// =====================================================
// TIS TIS PLATFORM - Minute Limit Service Tests
// FASE 6: Testing - Voice Minute Limits
// =====================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ======================
// MOCKS
// ======================

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockIs = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

// ======================
// TEST DATA
// ======================

const mockMinuteLimits = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  tenant_id: '660e8400-e29b-41d4-a716-446655440001',
  included_minutes: 200,
  overage_price_centavos: 350,
  overage_policy: 'charge' as const,
  alert_thresholds: [70, 90, 100],
  max_overage_charge_centavos: 50000,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockCheckLimitResult = {
  can_proceed: true,
  policy: 'charge',
  included_minutes: 200,
  included_used: 150,
  overage_used: 0,
  remaining_included: 50,
  total_used: 150,
  is_blocked: false,
  block_reason: null,
  overage_price_centavos: 350,
  current_overage_charges: 0,
  max_overage_charge: 50000,
  usage_id: '770e8400-e29b-41d4-a716-446655440002',
  usage_percent: 75,
  billing_period_start: '2025-01-01T00:00:00Z',
  billing_period_end: '2025-02-01T00:00:00Z',
};

const mockUsageSummary = {
  tenant_id: '660e8400-e29b-41d4-a716-446655440001',
  included_minutes: 200,
  included_minutes_used: 150,
  overage_minutes_used: 25,
  total_minutes_used: 175,
  remaining_included: 50,
  overage_policy: 'charge',
  overage_price_centavos: 350,
  overage_charges_centavos: 8750,
  usage_percent: 87.5,
  is_blocked: false,
  billing_period_start: '2025-01-01T00:00:00Z',
  billing_period_end: '2025-02-01T00:00:00Z',
};

const mockTransactions = [
  {
    id: '880e8400-e29b-41d4-a716-446655440003',
    tenant_id: '660e8400-e29b-41d4-a716-446655440001',
    call_id: 'call-123',
    seconds_used: 180,
    minutes_used: 3.0,
    included_minutes_used: 3.0,
    overage_minutes_used: 0,
    overage_charge_centavos: 0,
    is_overage: false,
    recorded_at: '2025-01-15T10:00:00Z',
  },
];

// ======================
// SERVICE IMPORT HELPER
// ======================

const getService = async () => {
  vi.resetModules();

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

  const serviceModule = await import('../../services/minute-limit.service');
  return serviceModule;
};

// ======================
// TEST SUITES
// ======================

describe('MinuteLimitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock chain for complex queries
    mockSingle.mockReturnValue({ data: mockMinuteLimits, error: null });
    mockMaybeSingle.mockReturnValue({ data: mockMinuteLimits, error: null });
    mockRange.mockReturnValue({ data: mockTransactions, error: null });
    mockOrder.mockReturnValue({ range: mockRange, data: mockTransactions, error: null });
    mockIs.mockReturnValue({ order: mockOrder });
    mockLte.mockReturnValue({ order: mockOrder });
    mockGte.mockReturnValue({ lte: mockLte });
    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
      order: mockOrder,
      gte: mockGte,
      is: mockIs,
      eq: mockEq,
      select: () => ({ single: mockSingle }), // For update().eq().select().single() chain
    });
    mockUpdate.mockReturnValue({ eq: mockEq, select: () => ({ single: mockSingle }) });
    mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ======================
  // getMinuteLimits Tests
  // ======================

  describe('getMinuteLimits', () => {
    it('should return minute limits for tenant', async () => {
      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.getMinuteLimits('660e8400-e29b-41d4-a716-446655440001');

      expect(mockFrom).toHaveBeenCalledWith('voice_minute_limits');
      expect(result).toEqual(mockMinuteLimits);
    });

    it('should return null when no limits exist', async () => {
      mockMaybeSingle.mockReturnValue({ data: null, error: null });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.getMinuteLimits('nonexistent-tenant');

      expect(result).toBeNull();
    });

    it('should return null on database error', async () => {
      mockMaybeSingle.mockReturnValue({ data: null, error: { message: 'DB error' } });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.getMinuteLimits('660e8400-e29b-41d4-a716-446655440001');

      expect(result).toBeNull();
    });
  });

  // ======================
  // createMinuteLimits Tests
  // ======================

  describe('createMinuteLimits', () => {
    it('should create minute limits for tenant', async () => {
      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.createMinuteLimits('660e8400-e29b-41d4-a716-446655440001');

      expect(mockFrom).toHaveBeenCalledWith('voice_minute_limits');
      expect(result).toEqual(mockMinuteLimits);
    });

    it('should return null on error', async () => {
      mockSingle.mockReturnValue({ data: null, error: { message: 'Insert failed' } });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.createMinuteLimits('660e8400-e29b-41d4-a716-446655440001');

      expect(result).toBeNull();
    });
  });

  // ======================
  // updateMinuteLimits Tests
  // ======================

  describe('updateMinuteLimits', () => {
    it('should update minute limits', async () => {
      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.updateMinuteLimits(
        '660e8400-e29b-41d4-a716-446655440001',
        { included_minutes: 300 }
      );

      expect(result).toEqual(mockMinuteLimits);
    });

    it('should validate overage_policy', async () => {
      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.updateMinuteLimits(
        '660e8400-e29b-41d4-a716-446655440001',
        { overage_policy: 'invalid' as 'block' }
      );

      expect(result).toBeNull();
    });

    it('should validate alert_thresholds range (0-100)', async () => {
      const { MinuteLimitService } = await getService();

      // Invalid threshold > 100
      const result1 = await MinuteLimitService.updateMinuteLimits(
        '660e8400-e29b-41d4-a716-446655440001',
        { alert_thresholds: [70, 150] }
      );
      expect(result1).toBeNull();

      // Invalid threshold < 0
      const result2 = await MinuteLimitService.updateMinuteLimits(
        '660e8400-e29b-41d4-a716-446655440001',
        { alert_thresholds: [-10, 90] }
      );
      expect(result2).toBeNull();
    });

    it('should validate max_overage_charge_centavos non-negative', async () => {
      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.updateMinuteLimits(
        '660e8400-e29b-41d4-a716-446655440001',
        { max_overage_charge_centavos: -100 }
      );

      expect(result).toBeNull();
    });

    it('should accept valid overage policies', async () => {
      const { MinuteLimitService } = await getService();

      for (const policy of ['block', 'charge', 'notify_only'] as const) {
        const result = await MinuteLimitService.updateMinuteLimits(
          '660e8400-e29b-41d4-a716-446655440001',
          { overage_policy: policy }
        );
        expect(result).not.toBeNull();
      }
    });

    it('should return null when update query fails', async () => {
      mockSingle.mockReturnValue({ data: null, error: { message: 'Update failed' } });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.updateMinuteLimits(
        '660e8400-e29b-41d4-a716-446655440001',
        { included_minutes: 300 }
      );

      expect(result).toBeNull();
    });
  });

  // ======================
  // updateOveragePolicy Tests
  // ======================

  describe('updateOveragePolicy', () => {
    it('should update overage policy via RPC', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, periods_unblocked: 0 },
        error: null,
      });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.updateOveragePolicy(
        '660e8400-e29b-41d4-a716-446655440001',
        'charge'
      );

      expect(mockRpc).toHaveBeenCalledWith('update_minute_limit_policy', {
        p_tenant_id: '660e8400-e29b-41d4-a716-446655440001',
        p_overage_policy: 'charge',
      });
      expect(result.success).toBe(true);
    });

    it('should return periods_unblocked when changing from block', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, periods_unblocked: 2 },
        error: null,
      });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.updateOveragePolicy(
        '660e8400-e29b-41d4-a716-446655440001',
        'notify_only'
      );

      expect(result.periods_unblocked).toBe(2);
    });

    it('should handle RPC errors', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.updateOveragePolicy(
        '660e8400-e29b-41d4-a716-446655440001',
        'block'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('RPC failed');
    });
  });

  // ======================
  // checkMinuteLimit Tests
  // ======================

  describe('checkMinuteLimit', () => {
    it('should return check result when can proceed', async () => {
      mockRpc.mockResolvedValue({
        data: mockCheckLimitResult,
        error: null,
      });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.checkMinuteLimit('660e8400-e29b-41d4-a716-446655440001');

      expect(mockRpc).toHaveBeenCalledWith('check_minute_limit', {
        p_tenant_id: '660e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.can_proceed).toBe(true);
      expect(result.policy).toBe('charge');
      expect(result.remaining_included).toBe(50);
    });

    it('should return blocked result when limit exceeded', async () => {
      mockRpc.mockResolvedValue({
        data: {
          ...mockCheckLimitResult,
          can_proceed: false,
          is_blocked: true,
          block_reason: 'Límite de minutos excedido',
        },
        error: null,
      });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.checkMinuteLimit('660e8400-e29b-41d4-a716-446655440001');

      expect(result.can_proceed).toBe(false);
      expect(result.is_blocked).toBe(true);
      expect(result.block_reason).toContain('excedido');
    });

    it('should return fail-safe blocked result on RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.checkMinuteLimit('660e8400-e29b-41d4-a716-446655440001');

      expect(result.can_proceed).toBe(false);
      expect(result.is_blocked).toBe(true);
      expect(result.error_code).toBe('RPC_ERROR');
      expect(result.policy).toBe('block');
    });
  });

  // ======================
  // recordMinuteUsage Tests
  // ======================

  describe('recordMinuteUsage', () => {
    it('should record minute usage successfully', async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          transaction_id: '990e8400-e29b-41d4-a716-446655440004',
          minutes_recorded: 3.0,
          is_overage: false,
          charge_centavos: 0,
        },
        error: null,
      });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.recordMinuteUsage(
        '660e8400-e29b-41d4-a716-446655440001',
        'call-123',
        180 // 3 minutes in seconds
      );

      expect(mockRpc).toHaveBeenCalledWith('record_minute_usage', {
        p_tenant_id: '660e8400-e29b-41d4-a716-446655440001',
        p_call_id: 'call-123',
        p_seconds_used: 180,
        p_call_metadata: {},
      });
      expect(result.success).toBe(true);
    });

    it('should validate seconds_used is positive', async () => {
      const { MinuteLimitService } = await getService();

      const result1 = await MinuteLimitService.recordMinuteUsage(
        '660e8400-e29b-41d4-a716-446655440001',
        'call-123',
        0
      );
      expect(result1.success).toBe(false);
      expect(result1.error_code).toBe('INVALID_INPUT');

      const result2 = await MinuteLimitService.recordMinuteUsage(
        '660e8400-e29b-41d4-a716-446655440001',
        'call-123',
        -60
      );
      expect(result2.success).toBe(false);
    });

    it('should pass call metadata', async () => {
      mockRpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const { MinuteLimitService } = await getService();
      await MinuteLimitService.recordMinuteUsage(
        '660e8400-e29b-41d4-a716-446655440001',
        'call-123',
        180,
        { source: 'vapi', assistant_type: 'restaurant' }
      );

      expect(mockRpc).toHaveBeenCalledWith('record_minute_usage', expect.objectContaining({
        p_call_metadata: { source: 'vapi', assistant_type: 'restaurant' },
      }));
    });

    it('should handle RPC errors', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Usage recording failed' },
      });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.recordMinuteUsage(
        '660e8400-e29b-41d4-a716-446655440001',
        'call-123',
        180
      );

      expect(result.success).toBe(false);
      expect(result.error_code).toBe('RPC_ERROR');
    });
  });

  // ======================
  // getUsageSummary Tests
  // ======================

  describe('getUsageSummary', () => {
    it('should return usage summary', async () => {
      mockRpc.mockResolvedValue({
        data: mockUsageSummary,
        error: null,
      });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.getUsageSummary('660e8400-e29b-41d4-a716-446655440001');

      expect(mockRpc).toHaveBeenCalledWith('get_minute_usage_summary', {
        p_tenant_id: '660e8400-e29b-41d4-a716-446655440001',
      });
      expect(result).toEqual(mockUsageSummary);
    });

    it('should return null on error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Summary failed' },
      });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.getUsageSummary('660e8400-e29b-41d4-a716-446655440001');

      expect(result).toBeNull();
    });

    it('should return null when RPC returns error in data', async () => {
      mockRpc.mockResolvedValue({
        data: { error: 'Tenant not found' },
        error: null,
      });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.getUsageSummary('660e8400-e29b-41d4-a716-446655440001');

      expect(result).toBeNull();
    });
  });

  // ======================
  // getUsageHistory Tests
  // ======================

  describe('getUsageHistory', () => {
    it('should return usage history with default pagination', async () => {
      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.getUsageHistory('660e8400-e29b-41d4-a716-446655440001');

      expect(result).toEqual(mockTransactions);
    });

    it('should sanitize limit to max 100', async () => {
      const { MinuteLimitService } = await getService();
      await MinuteLimitService.getUsageHistory('660e8400-e29b-41d4-a716-446655440001', 500);

      // Should use max 100, not 500
      expect(mockRange).toHaveBeenCalledWith(0, 99); // 0 to 99 = 100 items
    });

    it('should sanitize limit to min 1', async () => {
      const { MinuteLimitService } = await getService();
      await MinuteLimitService.getUsageHistory('660e8400-e29b-41d4-a716-446655440001', -5);

      // Should use min 1, not -5
      expect(mockRange).toHaveBeenCalledWith(0, 0); // 0 to 0 = 1 item
    });

    it('should sanitize offset to min 0', async () => {
      const { MinuteLimitService } = await getService();
      await MinuteLimitService.getUsageHistory('660e8400-e29b-41d4-a716-446655440001', 10, -5);

      // Should use 0, not -5
      expect(mockRange).toHaveBeenCalledWith(0, 9);
    });

    it('should return empty array on error', async () => {
      mockRange.mockReturnValue({ data: null, error: { message: 'Query failed' } });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.getUsageHistory('660e8400-e29b-41d4-a716-446655440001');

      expect(result).toEqual([]);
    });
  });

  // ======================
  // getUnbilledOverageTransactions Tests
  // ======================

  describe('getUnbilledOverageTransactions', () => {
    it('should return unbilled overage transactions', async () => {
      const overageTransactions = [
        { ...mockTransactions[0], is_overage: true, stripe_invoice_item_id: null },
      ];
      mockOrder.mockReturnValue({ data: overageTransactions, error: null });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.getUnbilledOverageTransactions(
        '660e8400-e29b-41d4-a716-446655440001'
      );

      expect(result).toEqual(overageTransactions);
    });

    it('should return empty array on error', async () => {
      mockOrder.mockReturnValue({ data: null, error: { message: 'Query failed' } });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.getUnbilledOverageTransactions(
        '660e8400-e29b-41d4-a716-446655440001'
      );

      expect(result).toEqual([]);
    });
  });

  // ======================
  // getUsageByPeriod Tests
  // ======================

  describe('getUsageByPeriod', () => {
    it('should return transactions within the period', async () => {
      mockOrder.mockReturnValue({ data: mockTransactions, error: null });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.getUsageByPeriod(
        '660e8400-e29b-41d4-a716-446655440001',
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(result).toEqual(mockTransactions);
      expect(mockFrom).toHaveBeenCalledWith('voice_minute_transactions');
    });

    it('should return empty array on error', async () => {
      mockOrder.mockReturnValue({ data: null, error: { message: 'Query failed' } });

      const { MinuteLimitService } = await getService();
      const result = await MinuteLimitService.getUsageByPeriod(
        '660e8400-e29b-41d4-a716-446655440001',
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(result).toEqual([]);
    });
  });
});

// ======================
// Utility Functions Tests
// ======================

describe('MinuteLimitService Utilities', () => {
  describe('formatMinutes', () => {
    it('should format seconds for sub-minute values', async () => {
      const { MinuteLimitService } = await getService();

      expect(MinuteLimitService.formatMinutes(0.5)).toBe('30s');
      expect(MinuteLimitService.formatMinutes(0.25)).toBe('15s');
    });

    it('should format minutes for values >= 1', async () => {
      const { MinuteLimitService } = await getService();

      expect(MinuteLimitService.formatMinutes(5)).toBe('5 min');
      expect(MinuteLimitService.formatMinutes(45)).toBe('45 min');
    });

    it('should format hours and minutes for values >= 60', async () => {
      const { MinuteLimitService } = await getService();

      expect(MinuteLimitService.formatMinutes(90)).toBe('1h 30m');
      expect(MinuteLimitService.formatMinutes(150)).toBe('2h 30m');
    });
  });

  describe('formatPriceMXN', () => {
    it('should format centavos as MXN currency', async () => {
      const { MinuteLimitService } = await getService();

      const result = MinuteLimitService.formatPriceMXN(8925);

      expect(result).toContain('89');
      expect(result).toContain('25');
    });

    it('should handle zero', async () => {
      const { MinuteLimitService } = await getService();

      const result = MinuteLimitService.formatPriceMXN(0);

      expect(result).toContain('0');
    });
  });

  describe('calculateOverageCost', () => {
    it('should calculate overage cost with ceiling', async () => {
      const { MinuteLimitService } = await getService();

      // 2.3 minutes at 350 centavos = ceil(2.3) * 350 = 3 * 350 = 1050
      expect(MinuteLimitService.calculateOverageCost(2.3, 350)).toBe(1050);

      // 5 minutes at 350 centavos = 5 * 350 = 1750
      expect(MinuteLimitService.calculateOverageCost(5, 350)).toBe(1750);
    });
  });

  describe('calculateUsagePercent', () => {
    it('should calculate percentage correctly', async () => {
      const { MinuteLimitService } = await getService();

      expect(MinuteLimitService.calculateUsagePercent(75, 100)).toBe(75);
      expect(MinuteLimitService.calculateUsagePercent(150, 200)).toBe(75);
    });

    it('should return 0 for zero included', async () => {
      const { MinuteLimitService } = await getService();

      expect(MinuteLimitService.calculateUsagePercent(50, 0)).toBe(0);
    });

    it('should round to 1 decimal place', async () => {
      const { MinuteLimitService } = await getService();

      expect(MinuteLimitService.calculateUsagePercent(1, 3)).toBe(33.3);
    });
  });

  describe('getUsageProgressColor', () => {
    it('should return correct colors based on percentage', async () => {
      const { MinuteLimitService } = await getService();

      expect(MinuteLimitService.getUsageProgressColor(50)).toBe('green');
      expect(MinuteLimitService.getUsageProgressColor(69)).toBe('green');
      expect(MinuteLimitService.getUsageProgressColor(70)).toBe('yellow');
      expect(MinuteLimitService.getUsageProgressColor(84)).toBe('yellow');
      expect(MinuteLimitService.getUsageProgressColor(85)).toBe('orange');
      expect(MinuteLimitService.getUsageProgressColor(94)).toBe('orange');
      expect(MinuteLimitService.getUsageProgressColor(95)).toBe('red');
      expect(MinuteLimitService.getUsageProgressColor(100)).toBe('red');
    });
  });

  describe('getOveragePolicyMessage', () => {
    it('should return correct messages for each policy', async () => {
      const { MinuteLimitService } = await getService();

      expect(MinuteLimitService.getOveragePolicyMessage('block', 3.5))
        .toContain('rechazadas');

      expect(MinuteLimitService.getOveragePolicyMessage('charge', 3.5))
        .toContain('3.50');

      expect(MinuteLimitService.getOveragePolicyMessage('notify_only', 3.5))
        .toContain('sin cargo');

      expect(MinuteLimitService.getOveragePolicyMessage('unknown', 3.5))
        .toContain('no configurada');
    });
  });
});

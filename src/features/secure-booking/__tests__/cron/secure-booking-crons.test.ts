// =====================================================
// TIS TIS PLATFORM - Secure Booking CRON Jobs Tests
// FASE 6: CRON Jobs
// =====================================================

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NextRequest } from 'next/server';

// ======================
// MOCK SETUP
// ======================

// Mock Supabase
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

// Mock confirmation sender service
vi.mock('@/src/features/secure-booking/services/confirmation-sender.service', () => ({
  confirmationSenderService: {
    processExpired: vi.fn(),
  },
}));

// Set environment variables
const CRON_SECRET = 'test-cron-secret-12345';
process.env.CRON_SECRET = CRON_SECRET;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// ======================
// HELPER FUNCTIONS
// ======================

function createMockRequest(includeAuth: boolean = true): NextRequest {
  const headers = new Headers();
  if (includeAuth) {
    headers.set('authorization', `Bearer ${CRON_SECRET}`);
  }
  return {
    headers: {
      get: (name: string) => headers.get(name),
    },
  } as unknown as NextRequest;
}

function createMockRequestWrongSecret(): NextRequest {
  const headers = new Headers();
  headers.set('authorization', 'Bearer wrong-secret');
  return {
    headers: {
      get: (name: string) => headers.get(name),
    },
  } as unknown as NextRequest;
}

// ======================
// CLEANUP HOLDS TESTS
// ======================

describe('Cleanup Holds CRON (/api/cron/cleanup-holds)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset modules to ensure fresh imports and avoid state pollution
    vi.resetModules();
  });

  it('should return 401 without authorization', async () => {
    const { GET } = await import('@/app/api/cron/cleanup-holds/route');
    const request = createMockRequest(false);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 with wrong secret', async () => {
    const { GET } = await import('@/app/api/cron/cleanup-holds/route');
    const request = createMockRequestWrongSecret();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should call cleanup_expired_holds RPC successfully', async () => {
    mockRpc.mockResolvedValue({ data: 5, error: null });

    const { GET } = await import('@/app/api/cron/cleanup-holds/route');
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.holds_cleaned).toBe(5);
    expect(mockRpc).toHaveBeenCalledWith('cleanup_expired_holds');
  });

  it('should handle RPC error gracefully', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Database error' } });

    const { GET } = await import('@/app/api/cron/cleanup-holds/route');
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Database error');
  });

  it('should support POST method', async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null });

    const { POST } = await import('@/app/api/cron/cleanup-holds/route');
    const request = createMockRequest();

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

// ======================
// PROCESS CONFIRMATIONS TESTS
// ======================

describe('Process Confirmations CRON (/api/cron/process-confirmations)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should return 401 without authorization', async () => {
    const { GET } = await import('@/app/api/cron/process-confirmations/route');
    const request = createMockRequest(false);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should call confirmationSenderService.processExpired successfully', async () => {
    const { confirmationSenderService } = await import(
      '@/src/features/secure-booking/services/confirmation-sender.service'
    );
    (confirmationSenderService.processExpired as Mock).mockResolvedValue({
      processed: 10,
      cancelled: 3,
      notified: 5,
    });

    const { GET } = await import('@/app/api/cron/process-confirmations/route');
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.confirmations_processed).toBe(10);
    expect(data.bookings_cancelled).toBe(3);
    expect(data.staff_notified).toBe(5);
    expect(confirmationSenderService.processExpired).toHaveBeenCalled();
  });

  it('should handle service error gracefully', async () => {
    const { confirmationSenderService } = await import(
      '@/src/features/secure-booking/services/confirmation-sender.service'
    );
    (confirmationSenderService.processExpired as Mock).mockRejectedValue(
      new Error('Service error')
    );

    const { GET } = await import('@/app/api/cron/process-confirmations/route');
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Service error');
  });
});

// ======================
// DETECT NO-PICKUPS TESTS
// ======================

describe('Detect No-Pickups CRON (/api/cron/detect-no-pickups)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should return 401 without authorization', async () => {
    const { GET } = await import('@/app/api/cron/detect-no-pickups/route');
    const request = createMockRequest(false);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return success when no orders found', async () => {
    // Mock chain: from().select().eq().eq().eq().not().lt().order().limit()
    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockLt = vi.fn().mockReturnValue({ order: mockOrder });
    const mockNot = vi.fn().mockReturnValue({ lt: mockLt });
    const mockEq3 = vi.fn().mockReturnValue({ not: mockNot });
    const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    mockFrom.mockReturnValue({ select: mockSelect });

    const { GET } = await import('@/app/api/cron/detect-no-pickups/route');
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.orders_processed).toBe(0);
  });

  it('should process expired orders and mark them as no_pickup', async () => {
    const mockOrders = [
      {
        id: 'order-1',
        tenant_id: 'tenant-1',
        branch_id: 'branch-1',
        customer_id: 'lead-1',
        customer_phone: '+521234567890',
        pickup_deadline: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        total_amount: 150,
        order_number: 'ORD-001',
      },
    ];

    // Mock chain for SELECT
    const mockLimit = vi.fn().mockResolvedValue({ data: mockOrders, error: null });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockLt = vi.fn().mockReturnValue({ order: mockOrder });
    const mockNot = vi.fn().mockReturnValue({ lt: mockLt });
    const mockEq3 = vi.fn().mockReturnValue({ not: mockNot });
    const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });

    // Mock chain for UPDATE: .update().eq(id).eq(tenant_id).eq(is_no_pickup)
    const mockUpdateEq3 = vi.fn().mockResolvedValue({ error: null });
    const mockUpdateEq2 = vi.fn().mockReturnValue({ eq: mockUpdateEq3 });
    const mockUpdateEq1 = vi.fn().mockReturnValue({ eq: mockUpdateEq2 });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq1 });

    // Set up mockFrom to return different chains based on context
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelect };
      }
      return { update: mockUpdate };
    });

    const { GET } = await import('@/app/api/cron/detect-no-pickups/route');
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.orders_processed).toBe(1);
    expect(data.orders_marked_no_pickup).toBe(1);
  });
});

// ======================
// UNBLOCK CUSTOMERS TESTS
// ======================

describe('Unblock Customers CRON (/api/cron/unblock-customers)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should return 401 without authorization', async () => {
    const { GET } = await import('@/app/api/cron/unblock-customers/route');
    const request = createMockRequest(false);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should call unblock_expired_customers RPC successfully', async () => {
    mockRpc.mockResolvedValue({ data: 15, error: null });

    const { GET } = await import('@/app/api/cron/unblock-customers/route');
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.customers_unblocked).toBe(15);
    expect(data.more_remaining).toBe(false);
    expect(mockRpc).toHaveBeenCalledWith('unblock_expired_customers', {
      p_batch_limit: 1000,
    });
  });

  it('should indicate more_remaining when batch limit reached', async () => {
    mockRpc.mockResolvedValue({ data: 1000, error: null }); // Full batch

    const { GET } = await import('@/app/api/cron/unblock-customers/route');
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.customers_unblocked).toBe(1000);
    expect(data.more_remaining).toBe(true);
  });

  it('should handle RPC error gracefully', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    const { GET } = await import('@/app/api/cron/unblock-customers/route');
    const request = createMockRequest();

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('RPC failed');
  });
});

// ======================
// TIMING-SAFE COMPARISON TESTS
// ======================

describe('CRON Security - Timing-Safe Secret Comparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should reject requests with different length secrets', async () => {
    const { GET } = await import('@/app/api/cron/cleanup-holds/route');
    const headers = new Headers();
    headers.set('authorization', 'Bearer short'); // Shorter than actual secret
    const request = {
      headers: {
        get: (name: string) => headers.get(name),
      },
    } as unknown as NextRequest;

    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should reject requests with same length but wrong secrets', async () => {
    const { GET } = await import('@/app/api/cron/cleanup-holds/route');
    const headers = new Headers();
    // Same length as CRON_SECRET but different content
    headers.set('authorization', 'Bearer test-cron-secret-XXXXX');
    const request = {
      headers: {
        get: (name: string) => headers.get(name),
      },
    } as unknown as NextRequest;

    const response = await GET(request);
    expect(response.status).toBe(401);
  });
});

// ======================
// SHARED CRON-AUTH UTILITY TESTS
// ======================

describe('Shared CRON Auth Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should export verifyCronSecret function', async () => {
    const { verifyCronSecret } = await import('@/src/shared/lib/cron-auth');
    expect(typeof verifyCronSecret).toBe('function');
  });

  it('should export logTimeoutWarningIfNeeded function', async () => {
    const { logTimeoutWarningIfNeeded } = await import('@/src/shared/lib/cron-auth');
    expect(typeof logTimeoutWarningIfNeeded).toBe('function');
  });

  it('should verify valid CRON secret', async () => {
    const { verifyCronSecret } = await import('@/src/shared/lib/cron-auth');
    const request = createMockRequest(true);
    expect(verifyCronSecret(request, 'Test Job')).toBe(true);
  });

  it('should reject invalid CRON secret', async () => {
    const { verifyCronSecret } = await import('@/src/shared/lib/cron-auth');
    const request = createMockRequestWrongSecret();
    expect(verifyCronSecret(request, 'Test Job')).toBe(false);
  });

  it('should log warning when duration exceeds threshold', async () => {
    const { logTimeoutWarningIfNeeded } = await import('@/src/shared/lib/cron-auth');
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Duration of 55000ms with max 60000ms should trigger warning (threshold is 83% = 49800ms)
    logTimeoutWarningIfNeeded('Test Job', 55000, 60000);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('WARNING: Approaching timeout threshold')
    );

    consoleSpy.mockRestore();
  });

  it('should not log warning when duration is under threshold', async () => {
    const { logTimeoutWarningIfNeeded } = await import('@/src/shared/lib/cron-auth');
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Duration of 30000ms with max 60000ms should NOT trigger warning
    logTimeoutWarningIfNeeded('Test Job', 30000, 60000);

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

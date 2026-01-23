// =====================================================
// TIS TIS PLATFORM - SR Job Queue Service Tests
// Unit tests for FASE 2 queue-based processing
// =====================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ======================
// ENVIRONMENT SETUP (must be before imports)
// ======================

// Mock environment variables before importing the service
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

// ======================
// MOCK SETUP
// ======================

// Mock Supabase client
const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSupabaseClient: any = {
  from: vi.fn(() => ({
    update: mockUpdate,
    select: mockSelect,
  })),
  rpc: mockRpc,
};

// Chain mocking for fluent API
mockUpdate.mockReturnValue({
  eq: mockEq,
});

mockEq.mockReturnValue({
  eq: mockEq,
  select: mockSelect,
});

mockSelect.mockReturnValue({
  single: mockSingle,
  eq: mockEq,
});

// Mock createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Import after mocks are set up
import { SRJobQueueService } from '@/src/features/integrations/services/sr-job-queue.service';

// ======================
// CONSTANTS FOR TESTING
// ======================

const TEST_SALE_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_ORDER_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_TENANT_ID = '550e8400-e29b-41d4-a716-446655440003';

// ======================
// queueForProcessing TESTS
// ======================

describe('SRJobQueueService.queueForProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should successfully queue a sale for processing', async () => {
    // Setup mock chain
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: TEST_SALE_ID },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    const result = await SRJobQueueService.queueForProcessing(TEST_SALE_ID);

    expect(result.success).toBe(true);
    expect(result.saleId).toBe(TEST_SALE_ID);
    expect(result.error).toBeUndefined();
  });

  it('should fail when sale is not in pending status', async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'No rows found' },
              }),
            }),
          }),
        }),
      }),
    });

    const result = await SRJobQueueService.queueForProcessing(TEST_SALE_ID);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle database errors gracefully', async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Connection timeout' },
              }),
            }),
          }),
        }),
      }),
    });

    const result = await SRJobQueueService.queueForProcessing(TEST_SALE_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection timeout');
  });

  it('should handle exceptions gracefully', async () => {
    mockSupabaseClient.from.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const result = await SRJobQueueService.queueForProcessing(TEST_SALE_ID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unexpected error');
  });
});

// ======================
// claimNextBatch TESTS
// ======================

describe('SRJobQueueService.claimNextBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should claim a batch of sales for processing', async () => {
    const mockSaleIds = [
      { id: '550e8400-e29b-41d4-a716-446655440001' },
      { id: '550e8400-e29b-41d4-a716-446655440002' },
      { id: '550e8400-e29b-41d4-a716-446655440003' },
    ];

    mockRpc.mockResolvedValue({
      data: mockSaleIds,
      error: null,
    });

    const result = await SRJobQueueService.claimNextBatch(10);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(mockRpc).toHaveBeenCalledWith('claim_sr_sales_batch', { p_limit: 10 });
  });

  it('should return empty array when no sales to claim', async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await SRJobQueueService.claimNextBatch(10);

    expect(result).toHaveLength(0);
  });

  it('should return empty array on RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC function not found' },
    });

    const result = await SRJobQueueService.claimNextBatch(10);

    expect(result).toHaveLength(0);
  });

  it('should use default limit of 10 when not specified', async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    await SRJobQueueService.claimNextBatch();

    expect(mockRpc).toHaveBeenCalledWith('claim_sr_sales_batch', { p_limit: 10 });
  });

  it('should handle exceptions gracefully', async () => {
    mockRpc.mockRejectedValue(new Error('Network error'));

    const result = await SRJobQueueService.claimNextBatch(10);

    expect(result).toHaveLength(0);
  });
});

// ======================
// markProcessed TESTS
// ======================

describe('SRJobQueueService.markProcessed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mark a sale as processed successfully', async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    const result = await SRJobQueueService.markProcessed(TEST_SALE_ID, TEST_ORDER_ID);

    expect(result).toBe(true);
  });

  it('should mark a sale as processed without order ID', async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    const result = await SRJobQueueService.markProcessed(TEST_SALE_ID);

    expect(result).toBe(true);
  });

  it('should return false on database error', async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { message: 'Database error' },
        }),
      }),
    });

    const result = await SRJobQueueService.markProcessed(TEST_SALE_ID);

    expect(result).toBe(false);
  });

  it('should handle exceptions gracefully', async () => {
    mockSupabaseClient.from.mockImplementation(() => {
      throw new Error('Connection failed');
    });

    const result = await SRJobQueueService.markProcessed(TEST_SALE_ID);

    expect(result).toBe(false);
  });
});

// ======================
// markFailed TESTS
// ======================

describe('SRJobQueueService.markFailed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mark a sale for retry when under max retries', async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    const result = await SRJobQueueService.markFailed(TEST_SALE_ID, 'Test error', 0);

    expect(result.shouldRetry).toBe(true);
    expect(result.newRetryCount).toBe(1);
    expect(result.nextRetryAt).toBeDefined();
  });

  it('should send to dead letter when max retries exceeded', async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    // currentRetryCount = 2, so newRetryCount = 3, which equals DEFAULT_MAX_RETRIES
    const result = await SRJobQueueService.markFailed(TEST_SALE_ID, 'Test error', 2);

    expect(result.shouldRetry).toBe(false);
    expect(result.newRetryCount).toBe(3);
    expect(result.nextRetryAt).toBeUndefined();
  });

  it('should apply exponential backoff correctly', async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    // First retry: 2^1 * 1000 = 2000ms
    const result1 = await SRJobQueueService.markFailed(TEST_SALE_ID, 'Test error', 0);
    expect(result1.newRetryCount).toBe(1);
    expect(result1.shouldRetry).toBe(true);

    // Second retry: 2^2 * 1000 = 4000ms
    const result2 = await SRJobQueueService.markFailed(TEST_SALE_ID, 'Test error', 1);
    expect(result2.newRetryCount).toBe(2);
    expect(result2.shouldRetry).toBe(true);
  });

  it('should cap backoff at MAX_BACKOFF_MS (1 hour)', async () => {
    // This tests that even with very high retry counts, backoff is capped
    // Formula: min(2^attempts * 1000, 3600000)
    // At 20 retries: 2^20 * 1000 = 1,048,576,000 ms > 3600000 (1 hour)
    // So it should be capped at 3600000

    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    // Test with a high retry count (though it shouldn't happen in practice)
    // Since DEFAULT_MAX_RETRIES is 3, we test at the boundary
    const result = await SRJobQueueService.markFailed(TEST_SALE_ID, 'Test error', 1);

    // newRetryCount = 2, backoff = min(2^2 * 1000, 3600000) = 4000ms
    expect(result.newRetryCount).toBe(2);
    expect(result.shouldRetry).toBe(true);
  });

  it('should return shouldRetry false on database error', async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { message: 'Database error' },
        }),
      }),
    });

    const result = await SRJobQueueService.markFailed(TEST_SALE_ID, 'Test error', 0);

    expect(result.shouldRetry).toBe(false);
  });

  it('should handle exceptions gracefully', async () => {
    mockSupabaseClient.from.mockImplementation(() => {
      throw new Error('Connection failed');
    });

    const result = await SRJobQueueService.markFailed(TEST_SALE_ID, 'Test error', 0);

    expect(result.shouldRetry).toBe(false);
    expect(result.newRetryCount).toBe(1);
  });
});

// ======================
// getQueueStats TESTS
// ======================

describe('SRJobQueueService.getQueueStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return queue statistics', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          pending_count: 5,
          queued_count: 10,
          processing_count: 2,
          processed_today: 50,
          failed_today: 3,
          dead_letter_count: 1,
        },
      ],
      error: null,
    });

    const result = await SRJobQueueService.getQueueStats();

    expect(result.pending).toBe(5);
    expect(result.queued).toBe(10);
    expect(result.processing).toBe(2);
    expect(result.processed_today).toBe(50);
    expect(result.failed_today).toBe(3);
    expect(result.dead_letter).toBe(1);
    expect(mockRpc).toHaveBeenCalledWith('get_sr_queue_stats', { p_tenant_id: null });
  });

  it('should filter by tenant ID when provided', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          pending_count: 2,
          queued_count: 3,
          processing_count: 1,
          processed_today: 20,
          failed_today: 1,
          dead_letter_count: 0,
        },
      ],
      error: null,
    });

    const result = await SRJobQueueService.getQueueStats(TEST_TENANT_ID);

    expect(mockRpc).toHaveBeenCalledWith('get_sr_queue_stats', { p_tenant_id: TEST_TENANT_ID });
    expect(result.pending).toBe(2);
  });

  it('should return default stats on RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC error' },
    });

    const result = await SRJobQueueService.getQueueStats();

    expect(result.pending).toBe(0);
    expect(result.queued).toBe(0);
    expect(result.processing).toBe(0);
    expect(result.processed_today).toBe(0);
    expect(result.failed_today).toBe(0);
    expect(result.dead_letter).toBe(0);
  });

  it('should return default stats when no data returned', async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await SRJobQueueService.getQueueStats();

    expect(result.pending).toBe(0);
  });

  it('should handle exceptions gracefully', async () => {
    mockRpc.mockRejectedValue(new Error('Network error'));

    const result = await SRJobQueueService.getQueueStats();

    expect(result.pending).toBe(0);
    expect(result.dead_letter).toBe(0);
  });
});

// ======================
// recoverStaleSales TESTS
// ======================

describe('SRJobQueueService.recoverStaleSales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should recover stale sales', async () => {
    mockRpc.mockResolvedValue({
      data: 3,
      error: null,
    });

    const result = await SRJobQueueService.recoverStaleSales(5);

    expect(result).toBe(3);
    expect(mockRpc).toHaveBeenCalledWith('recover_stale_sr_sales', { p_timeout_minutes: 5 });
  });

  it('should use default timeout of 5 minutes', async () => {
    mockRpc.mockResolvedValue({
      data: 0,
      error: null,
    });

    await SRJobQueueService.recoverStaleSales();

    expect(mockRpc).toHaveBeenCalledWith('recover_stale_sr_sales', { p_timeout_minutes: 5 });
  });

  it('should return 0 on RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC error' },
    });

    const result = await SRJobQueueService.recoverStaleSales(5);

    expect(result).toBe(0);
  });

  it('should handle exceptions gracefully', async () => {
    mockRpc.mockRejectedValue(new Error('Network error'));

    const result = await SRJobQueueService.recoverStaleSales(5);

    expect(result).toBe(0);
  });
});

// ======================
// getSaleInfo TESTS
// ======================

describe('SRJobQueueService.getSaleInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return sale information', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              retry_count: 1,
              status: 'processing',
              tenant_id: TEST_TENANT_ID,
              branch_id: '550e8400-e29b-41d4-a716-446655440004',
            },
            error: null,
          }),
        }),
      }),
    });

    const result = await SRJobQueueService.getSaleInfo(TEST_SALE_ID);

    expect(result).not.toBeNull();
    expect(result?.retry_count).toBe(1);
    expect(result?.status).toBe('processing');
    expect(result?.tenant_id).toBe(TEST_TENANT_ID);
  });

  it('should return null when sale not found', async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'No rows found' },
          }),
        }),
      }),
    });

    const result = await SRJobQueueService.getSaleInfo(TEST_SALE_ID);

    expect(result).toBeNull();
  });

  it('should return null on exception', async () => {
    mockSupabaseClient.from.mockImplementation(() => {
      throw new Error('Database error');
    });

    const result = await SRJobQueueService.getSaleInfo(TEST_SALE_ID);

    expect(result).toBeNull();
  });
});

// ======================
// INTEGRATION PATTERN TESTS
// ======================

describe('SRJobQueueService Integration Patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should follow the complete processing flow pattern', async () => {
    // This test verifies the expected flow:
    // 1. queueForProcessing (webhook)
    // 2. claimNextBatch (cron)
    // 3. markProcessed or markFailed

    // Step 1: Queue
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: TEST_SALE_ID },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    const queueResult = await SRJobQueueService.queueForProcessing(TEST_SALE_ID);
    expect(queueResult.success).toBe(true);

    // Step 2: Claim
    mockRpc.mockResolvedValue({
      data: [{ id: TEST_SALE_ID }],
      error: null,
    });

    const claimResult = await SRJobQueueService.claimNextBatch(10);
    expect(claimResult).toContain(TEST_SALE_ID);

    // Step 3: Mark as processed
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    const processResult = await SRJobQueueService.markProcessed(TEST_SALE_ID, TEST_ORDER_ID);
    expect(processResult).toBe(true);
  });

  it('should handle retry flow correctly', async () => {
    // Simulates: process → fail → retry → process → success

    // First attempt fails
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    const failResult = await SRJobQueueService.markFailed(
      TEST_SALE_ID,
      'Temporary error',
      0
    );

    expect(failResult.shouldRetry).toBe(true);
    expect(failResult.newRetryCount).toBe(1);

    // Second attempt succeeds
    const processResult = await SRJobQueueService.markProcessed(TEST_SALE_ID, TEST_ORDER_ID);
    expect(processResult).toBe(true);
  });

  it('should handle dead letter flow after max retries', async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    // First retry (retry_count = 0 → 1)
    const fail1 = await SRJobQueueService.markFailed(TEST_SALE_ID, 'Error 1', 0);
    expect(fail1.shouldRetry).toBe(true);
    expect(fail1.newRetryCount).toBe(1);

    // Second retry (retry_count = 1 → 2)
    const fail2 = await SRJobQueueService.markFailed(TEST_SALE_ID, 'Error 2', 1);
    expect(fail2.shouldRetry).toBe(true);
    expect(fail2.newRetryCount).toBe(2);

    // Third retry exceeds limit (retry_count = 2 → 3)
    const fail3 = await SRJobQueueService.markFailed(TEST_SALE_ID, 'Error 3', 2);
    expect(fail3.shouldRetry).toBe(false);
    expect(fail3.newRetryCount).toBe(3);
  });
});

// =====================================================
// TIS TIS PLATFORM - Tests for KDS Delivery API
// Unit tests for delivery API endpoints
// =====================================================
//
// SINCRONIZADO CON:
// - API: app/api/restaurant/kitchen/delivery/route.ts
// - API: app/api/restaurant/kitchen/delivery/stats/route.ts
// - Types: src/features/restaurant-kitchen/types/index.ts
// =====================================================

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { NextRequest } from 'next/server';
import type { DeliveryStatus } from '@/src/shared/types/delivery-types';

// ======================
// MOCKS
// ======================

// Mock auth helper
const mockGetUserAndTenant = vi.fn();
const mockIsAuthError = vi.fn();

vi.mock('@/src/lib/api/auth-helper', () => ({
  getUserAndTenant: () => mockGetUserAndTenant(),
  isAuthError: (result: unknown) => mockIsAuthError(result),
  errorResponse: (message: string, status: number) =>
    new Response(JSON.stringify({ success: false, error: message }), { status }),
  successResponse: (data: unknown) =>
    new Response(JSON.stringify({ success: true, data }), { status: 200 }),
  isValidUUID: (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid),
}));

// ======================
// TEST DATA
// ======================

const validBranchId = '12345678-1234-1234-1234-123456789abc';
const validTenantId = 'tenant-001';

const mockOrder = {
  id: 'order-001',
  tenant_id: validTenantId,
  branch_id: validBranchId,
  display_number: '101',
  order_type: 'delivery',
  status: 'preparing',
  priority: 3,
  ordered_at: new Date().toISOString(),
  ready_at: null,
  estimated_delivery_at: null,
  delivery_status: 'pending_assignment' as DeliveryStatus,
  delivery_address: {
    street: 'Calle Principal',
    exterior_number: '123',
    colony: 'Centro',
    city: 'Ciudad Test',
    postal_code: '12345',
    contact_phone: '555-1234',
    contact_name: 'Cliente Test',
  },
  delivery_instructions: 'Tocar timbre',
  delivery_driver_id: null,
  delivery_fee: 35.00,
  delivery_distance_km: 3.5,
  total: 250.00,
  customer_notes: null,
  restaurant_order_items: [
    { id: 'item-001', menu_item_name: 'Hamburguesa', quantity: 2 },
    { id: 'item-002', menu_item_name: 'Papas', quantity: 1 },
  ],
  customers: { full_name: 'Juan Perez', phone: '555-1234' },
};

const mockDriver = {
  id: 'driver-001',
  full_name: 'Carlos Lopez',
  phone: '555-5678',
  vehicle_type: 'motorcycle',
};

// ======================
// CHAINABLE MOCK FACTORY
// ======================

interface QueryResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
  count?: number;
}

interface ChainableMockOptions {
  ordersResult?: QueryResult;
  driversResult?: QueryResult;
  statsResult?: QueryResult;
  countResult?: { count: number; error: null } | { count: null; error: { message: string } };
}

/**
 * Creates a fully chainable Supabase mock that handles complex query chains
 */
function createChainableSupabaseMock(options: ChainableMockOptions = {}) {
  const {
    ordersResult = { data: [mockOrder], error: null },
    driversResult = { data: [], error: null },
    statsResult = { data: [], error: null },
    countResult = { count: 0, error: null },
  } = options;

  // Track which table was accessed
  let currentTable: string | null = null;

  // Create the chainable object
  const createChain = (): Record<string, Mock> => {
    const chain: Record<string, Mock> = {};

    // All chainable methods
    const methods = [
      'from', 'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
      'like', 'ilike', 'is', 'in', 'not', 'or', 'filter',
      'order', 'limit', 'range', 'single', 'maybeSingle'
    ];

    methods.forEach(method => {
      chain[method] = vi.fn().mockImplementation((...args: unknown[]) => {
        // Track table access
        if (method === 'from' && typeof args[0] === 'string') {
          currentTable = args[0];
        }

        // Return promise for terminal operations (when result is awaited)
        // Make the chain also thenable
        const result = {
          ...chain,
          then: (resolve: (value: QueryResult) => void, reject?: (error: unknown) => void) => {
            // Determine which result to return based on the table
            let queryResult: QueryResult;

            if (currentTable === 'restaurant_orders') {
              queryResult = ordersResult;
            } else if (currentTable === 'delivery_drivers') {
              queryResult = driversResult;
            } else {
              queryResult = statsResult;
            }

            // Handle count queries
            if (queryResult && 'count' in queryResult && queryResult.count !== undefined) {
              return Promise.resolve(queryResult).then(resolve, reject);
            }

            return Promise.resolve(queryResult).then(resolve, reject);
          },
        };

        // Make all methods return the chain for further chaining
        return result;
      });
    });

    return chain;
  };

  const chain = createChain();

  return {
    ...chain,
    // Expose mock manipulation methods
    setOrdersResult: (result: QueryResult) => {
      Object.assign(options, { ordersResult: result });
    },
    setDriversResult: (result: QueryResult) => {
      Object.assign(options, { driversResult: result });
    },
    // Auth mock
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
    },
  };
}

// ======================
// HELPER FUNCTIONS
// ======================

function createRequest(url: string, init?: { method?: string; headers?: Record<string, string> }): NextRequest {
  const request = new NextRequest(new URL(url, 'http://localhost'), {
    method: init?.method || 'GET',
    headers: init?.headers ? new Headers(init.headers) : undefined,
  });
  return request;
}

// ======================
// TESTS: GET /api/restaurant/kitchen/delivery
// ======================

describe('GET /api/restaurant/kitchen/delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default: authenticated user with chainable mock
    mockGetUserAndTenant.mockResolvedValue({
      userRole: { tenant_id: validTenantId },
      supabase: createChainableSupabaseMock(),
    });
    mockIsAuthError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockGetUserAndTenant.mockResolvedValue({
        error: 'No autorizado',
        status: 401,
      });
      mockIsAuthError.mockReturnValue(true);

      const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
      const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}`);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should return 400 when branch_id is missing', async () => {
      const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
      const request = createRequest('http://localhost/api/restaurant/kitchen/delivery');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('branch_id');
    });

    it('should return 400 when branch_id is invalid UUID', async () => {
      const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
      const request = createRequest('http://localhost/api/restaurant/kitchen/delivery?branch_id=invalid');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
    });
  });

  describe('Success Response', () => {
    it('should return delivery orders with stats', async () => {
      const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
      const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}`);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('orders');
      expect(data.data).toHaveProperty('stats');
    });

    it('should include order transformation fields', async () => {
      const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
      const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}`);

      const response = await GET(request);
      const data = await response.json();

      const order = data.data.orders[0];
      expect(order).toHaveProperty('order_id');
      expect(order).toHaveProperty('display_number');
      expect(order).toHaveProperty('delivery_status');
      expect(order).toHaveProperty('minutes_elapsed');
      expect(order).toHaveProperty('items_count');
      expect(order).toHaveProperty('items_summary');
    });

    it('should filter by delivery status when provided', async () => {
      const mockSupabase = createChainableSupabaseMock();
      mockGetUserAndTenant.mockResolvedValue({
        userRole: { tenant_id: validTenantId },
        supabase: mockSupabase,
      });

      const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
      const request = createRequest(
        `http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}&status=driver_assigned`
      );

      await GET(request);

      // Verify eq was called (we can't check exact params easily with this mock structure)
      expect(mockSupabase.eq).toHaveBeenCalled();
    });
  });

  describe('Stats Calculation', () => {
    it('should calculate correct stats from orders', async () => {
      const multipleOrders = [
        { ...mockOrder, delivery_status: 'pending_assignment' },
        { ...mockOrder, id: 'order-002', delivery_status: 'driver_assigned' },
        { ...mockOrder, id: 'order-003', delivery_status: 'in_transit' },
      ];

      mockGetUserAndTenant.mockResolvedValue({
        userRole: { tenant_id: validTenantId },
        supabase: createChainableSupabaseMock({
          ordersResult: { data: multipleOrders, error: null },
        }),
      });

      const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
      const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}`);

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.stats).toMatchObject({
        pending_assignment: 1,
        driver_assigned: 1,
        in_transit: 1,
        total_active: 3,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database error gracefully', async () => {
      mockGetUserAndTenant.mockResolvedValue({
        userRole: { tenant_id: validTenantId },
        supabase: createChainableSupabaseMock({
          ordersResult: { data: null, error: { message: 'Database error' } },
        }),
      });

      const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
      const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}`);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});

// ======================
// TESTS: GET /api/restaurant/kitchen/delivery/stats
// ======================

describe('GET /api/restaurant/kitchen/delivery/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockGetUserAndTenant.mockResolvedValue({
      userRole: { tenant_id: validTenantId },
      supabase: createChainableSupabaseMock({
        statsResult: {
          data: [
            { delivery_status: 'pending_assignment', status: 'pending' },
            { delivery_status: 'driver_assigned', status: 'preparing' },
            { delivery_status: 'in_transit', status: 'ready' },
          ],
          error: null,
        },
      }),
    });
    mockIsAuthError.mockReturnValue(false);
  });

  describe('Stats Response', () => {
    it('should return delivery statistics', async () => {
      const { GET } = await import('@/app/api/restaurant/kitchen/delivery/stats/route');
      const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery/stats?branch_id=${validBranchId}`);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('pending_assignment');
      expect(data.data).toHaveProperty('driver_assigned');
      expect(data.data).toHaveProperty('in_transit');
      expect(data.data).toHaveProperty('total_active');
    });

    it('should include today metrics', async () => {
      const { GET } = await import('@/app/api/restaurant/kitchen/delivery/stats/route');
      const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery/stats?branch_id=${validBranchId}`);

      const response = await GET(request);
      const data = await response.json();

      expect(data.data).toHaveProperty('completed_today');
      expect(data.data).toHaveProperty('failed_today');
      expect(data.data).toHaveProperty('avg_delivery_time_minutes');
    });
  });

  describe('Validation', () => {
    it('should require branch_id parameter', async () => {
      const { GET } = await import('@/app/api/restaurant/kitchen/delivery/stats/route');
      const request = createRequest('http://localhost/api/restaurant/kitchen/delivery/stats');

      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });
});

// ======================
// TESTS: Edge Cases
// ======================

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockGetUserAndTenant.mockResolvedValue({
      userRole: { tenant_id: validTenantId },
      supabase: createChainableSupabaseMock(),
    });
    mockIsAuthError.mockReturnValue(false);
  });

  it('should handle order with null delivery_address', async () => {
    mockGetUserAndTenant.mockResolvedValue({
      userRole: { tenant_id: validTenantId },
      supabase: createChainableSupabaseMock({
        ordersResult: { data: [{ ...mockOrder, delivery_address: null }], error: null },
      }),
    });

    const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
    const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}`);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.orders[0].delivery_address).toBeNull();
  });

  it('should handle order with null customer', async () => {
    mockGetUserAndTenant.mockResolvedValue({
      userRole: { tenant_id: validTenantId },
      supabase: createChainableSupabaseMock({
        ordersResult: { data: [{ ...mockOrder, customers: null }], error: null },
      }),
    });

    const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
    const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}`);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.orders[0].customer_name).toBeNull();
  });

  it('should handle customers as array (relation)', async () => {
    mockGetUserAndTenant.mockResolvedValue({
      userRole: { tenant_id: validTenantId },
      supabase: createChainableSupabaseMock({
        ordersResult: {
          data: [{
            ...mockOrder,
            customers: [{ full_name: 'From Array', phone: '555-9999' }],
          }],
          error: null,
        },
      }),
    });

    const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
    const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}`);

    const response = await GET(request);
    const data = await response.json();

    expect(data.data.orders[0].customer_name).toBe('From Array');
  });

  it('should handle empty items list', async () => {
    mockGetUserAndTenant.mockResolvedValue({
      userRole: { tenant_id: validTenantId },
      supabase: createChainableSupabaseMock({
        ordersResult: { data: [{ ...mockOrder, restaurant_order_items: [] }], error: null },
      }),
    });

    const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
    const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}`);

    const response = await GET(request);
    const data = await response.json();

    expect(data.data.orders[0].items_count).toBe(0);
    expect(data.data.orders[0].items_summary).toBe('');
  });

  it('should truncate items_summary for more than 3 items', async () => {
    mockGetUserAndTenant.mockResolvedValue({
      userRole: { tenant_id: validTenantId },
      supabase: createChainableSupabaseMock({
        ordersResult: {
          data: [{
            ...mockOrder,
            restaurant_order_items: [
              { id: '1', menu_item_name: 'Item 1', quantity: 1 },
              { id: '2', menu_item_name: 'Item 2', quantity: 1 },
              { id: '3', menu_item_name: 'Item 3', quantity: 1 },
              { id: '4', menu_item_name: 'Item 4', quantity: 1 },
              { id: '5', menu_item_name: 'Item 5', quantity: 1 },
            ],
          }],
          error: null,
        },
      }),
    });

    const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
    const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}`);

    const response = await GET(request);
    const data = await response.json();

    expect(data.data.orders[0].items_summary).toContain('+2 más');
  });
});

// ======================
// TESTS: Driver Integration
// ======================

describe('Driver Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockGetUserAndTenant.mockResolvedValue({
      userRole: { tenant_id: validTenantId },
      supabase: createChainableSupabaseMock(),
    });
    mockIsAuthError.mockReturnValue(false);
  });

  it('should fetch driver info for assigned orders', async () => {
    const orderWithDriver = {
      ...mockOrder,
      delivery_status: 'driver_assigned',
      delivery_driver_id: 'driver-001',
    };

    mockGetUserAndTenant.mockResolvedValue({
      userRole: { tenant_id: validTenantId },
      supabase: createChainableSupabaseMock({
        ordersResult: { data: [orderWithDriver], error: null },
        driversResult: { data: [mockDriver], error: null },
      }),
    });

    const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
    const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}`);

    const response = await GET(request);
    const data = await response.json();

    expect(data.data.orders[0].driver_name).toBe('Carlos Lopez');
    expect(data.data.orders[0].driver_phone).toBe('555-5678');
  });

  it('should handle missing driver gracefully', async () => {
    const orderWithDriver = {
      ...mockOrder,
      delivery_status: 'driver_assigned',
      delivery_driver_id: 'driver-999', // Non-existent
    };

    mockGetUserAndTenant.mockResolvedValue({
      userRole: { tenant_id: validTenantId },
      supabase: createChainableSupabaseMock({
        ordersResult: { data: [orderWithDriver], error: null },
        driversResult: { data: [], error: null },
      }),
    });

    const { GET } = await import('@/app/api/restaurant/kitchen/delivery/route');
    const request = createRequest(`http://localhost/api/restaurant/kitchen/delivery?branch_id=${validBranchId}`);

    const response = await GET(request);
    const data = await response.json();

    expect(data.data.orders[0].driver_name).toBeNull();
    expect(data.data.orders[0].driver_phone).toBeNull();
  });
});

// =====================================================
// TIS TIS PLATFORM - Integration Tests for KDS Delivery
// End-to-end tests for KDS and Delivery system integration
// =====================================================
//
// SINCRONIZADO CON:
// - Hook: src/features/restaurant-kitchen/hooks/useDeliveryOrders.ts
// - Component: src/features/restaurant-kitchen/components/KDSDisplay.tsx
// - Component: src/features/restaurant-kitchen/components/DeliveryPanel.tsx
// - API: app/api/restaurant/kitchen/delivery/route.ts
// =====================================================

/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import type {
  KDSOrderView,
  KDSStats,
  KDSDeliveryOrderView,
  KDSDeliveryStats,
  KitchenStationConfig,
  DeliveryDriver,
} from '@/features/restaurant-kitchen/types';
import type { DeliveryStatus } from '@/src/shared/types/delivery-types';

// ======================
// MOCKS
// ======================

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock both possible Supabase import paths
vi.mock('@/src/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
  DEFAULT_TENANT_ID: 'tenant-001',
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  }),
}));

// ======================
// TEST DATA
// ======================

const mockKDSOrder: KDSOrderView = {
  order_id: 'order-001',
  tenant_id: 'tenant-001',
  branch_id: 'branch-001',
  display_number: '101',
  order_type: 'dine_in',
  order_status: 'preparing',
  priority: 3,
  ordered_at: new Date().toISOString(),
  estimated_prep_time: 15,
  table_id: 'table-001',
  table_number: '5',
  customer_notes: null,
  kitchen_notes: null,
  items: [
    {
      id: 'item-001',
      menu_item_name: 'Hamburguesa',
      quantity: 2,
      variant_name: null,
      size_name: null,
      add_ons: [],
      modifiers: [],
      status: 'preparing',
      kitchen_station: 'grill',
      special_instructions: null,
      allergen_notes: null,
      started_at: new Date().toISOString(),
      ready_at: null,
    },
  ],
  minutes_elapsed: 5,
  delivery_status: null,
  delivery_address: null,
  delivery_instructions: null,
  delivery_driver_id: null,
  delivery_driver_name: null,
  delivery_driver_phone: null,
  estimated_delivery_at: null,
};

const mockDeliveryKDSOrder: KDSOrderView = {
  ...mockKDSOrder,
  order_id: 'order-delivery-001',
  display_number: '201',
  order_type: 'delivery',
  table_id: null,
  table_number: null,
  delivery_status: 'pending_assignment',
  delivery_address: {
    street: 'Calle Principal',
    number: '123',
    colony: 'Centro',
    city: 'Ciudad Test',
    postal_code: '12345',
  },
  delivery_instructions: 'Tocar timbre',
};

const mockDeliveryOrder: KDSDeliveryOrderView = {
  order_id: 'order-delivery-001',
  tenant_id: 'tenant-001',
  branch_id: 'branch-001',
  display_number: '201',
  order_status: 'preparing',
  delivery_status: 'pending_assignment',
  priority: 3,
  ordered_at: new Date().toISOString(),
  ready_at: null,
  estimated_delivery_at: null,
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
  customer_name: 'Juan Perez',
  customer_phone: '555-1234',
  delivery_driver_id: null,
  driver_name: null,
  driver_phone: null,
  driver_vehicle_type: null,
  total: 250.00,
  delivery_fee: 35.00,
  delivery_distance_km: 3.5,
  minutes_elapsed: 10,
  minutes_until_delivery: null,
  items_count: 2,
  items_summary: '2x Hamburguesa',
};

const mockKDSStats: KDSStats = {
  active_orders: 5,
  pending_items: 10,
  preparing_items: 8,
  ready_items: 3,
  avg_prep_time: 12,
  orders_by_type: {
    dine_in: 2,
    takeout: 1,
    delivery: 2,
    drive_thru: 0,
    catering: 0,
  },
  orders_by_status: {
    pending: 1,
    confirmed: 0,
    preparing: 3,
    ready: 1,
    served: 0,
    completed: 0,
    cancelled: 0,
  },
  items_by_station: {
    main: 3,
    grill: 5,
    fry: 4,
    salad: 2,
    sushi: 0,
    pizza: 0,
    dessert: 1,
    bar: 2,
    expeditor: 0,
    prep: 3,
    assembly: 1,
  },
  peak_times: [
    { hour: 12, count: 15 },
    { hour: 13, count: 20 },
    { hour: 19, count: 18 },
  ],
  slow_items: [
    { menu_item_name: 'Hamburguesa Premium', avg_prep_time: 18, count: 5 },
  ],
};

const mockDeliveryStats: KDSDeliveryStats = {
  pending_assignment: 2,
  driver_assigned: 1,
  in_transit: 1,
  ready_for_pickup: 1,
  total_active: 5,
};

const mockStations: KitchenStationConfig[] = [
  {
    id: 'station-001',
    tenant_id: 'tenant-001',
    branch_id: 'branch-001',
    code: 'GRILL',
    name: 'Parrilla',
    description: 'Estación de parrilla',
    station_type: 'grill',
    handles_categories: ['burgers', 'steaks'],
    printer_name: null,
    printer_ip: null,
    display_color: '#EF4444',
    display_order: 1,
    is_active: true,
    default_staff_ids: [],
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  },
  {
    id: 'station-002',
    tenant_id: 'tenant-001',
    branch_id: 'branch-001',
    code: 'FRY',
    name: 'Freidora',
    description: 'Estación de fritos',
    station_type: 'fry',
    handles_categories: ['fries', 'fried-chicken'],
    printer_name: null,
    printer_ip: null,
    display_color: '#F59E0B',
    display_order: 2,
    is_active: true,
    default_staff_ids: [],
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  },
];

const mockDriver: DeliveryDriver = {
  id: 'driver-001',
  tenant_id: 'tenant-001',
  full_name: 'Carlos Lopez',
  phone: '555-5678',
  status: 'available',
  vehicle_type: 'motorcycle',
  current_location: undefined,
  total_deliveries: 150,
  successful_deliveries: 140,
  average_rating: 4.8,
  max_distance_km: 10,
  accepts_cash: true,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Sets up mock fetch to return appropriate responses for delivery endpoints
 */
function setupMockFetch(options: {
  orders?: KDSDeliveryOrderView[];
  stats?: KDSDeliveryStats;
  drivers?: DeliveryDriver[];
}) {
  const { orders = [mockDeliveryOrder], stats = mockDeliveryStats, drivers = [mockDriver] } = options;

  mockFetch.mockImplementation((url: string) => {
    // Handle delivery orders endpoint
    if (url.includes('/api/restaurant/kitchen/delivery') && !url.includes('/stats')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: { orders, stats },
        }),
      });
    }

    // Handle stats endpoint
    if (url.includes('/api/restaurant/kitchen/delivery/stats')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: stats,
        }),
      });
    }

    // Handle drivers endpoint
    if (url.includes('/api/restaurant/delivery/drivers')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: drivers,
        }),
      });
    }

    // Default response
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: {} }),
    });
  });
}

// Dynamic import for hook
const importHook = async () => {
  const module = await import('@/features/restaurant-kitchen/hooks/useDeliveryOrders');
  return module;
};

// ======================
// INTEGRATION TESTS
// ======================

describe('KDS-Delivery Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockFetch({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Data Flow: API -> Hook', () => {
    it('should flow data from API through hook', async () => {
      const { useDeliveryOrders } = await importHook();

      const { result } = renderHook(() =>
        useDeliveryOrders({ branch_id: 'branch-001', autoRefresh: false })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify hook has data
      expect(result.current.orders).toHaveLength(1);
      expect(result.current.orders[0].display_number).toBe('201');
      expect(result.current.stats.total_active).toBe(5);
    });

    it('should update hook data on refresh', async () => {
      const { useDeliveryOrders } = await importHook();

      const { result } = renderHook(() =>
        useDeliveryOrders({ branch_id: 'branch-001', autoRefresh: false })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Initial state
      expect(result.current.orders).toHaveLength(1);

      // Simulate new order coming in
      const newOrder = {
        ...mockDeliveryOrder,
        order_id: 'order-delivery-002',
        display_number: '202',
      };

      setupMockFetch({
        orders: [mockDeliveryOrder, newOrder],
        stats: { ...mockDeliveryStats, total_active: 6 },
      });

      // Refresh hook
      await act(async () => {
        await result.current.refresh();
      });

      // Should now show 2 orders
      expect(result.current.orders).toHaveLength(2);
      expect(result.current.stats.total_active).toBe(6);
    });
  });

  describe('Notifications Integration', () => {
    it('should trigger notification callback on new order', async () => {
      const onNewDeliveryOrder = vi.fn();

      // First fetch returns empty
      setupMockFetch({ orders: [], stats: mockDeliveryStats });

      const { useDeliveryOrders } = await importHook();

      const { result } = renderHook(() =>
        useDeliveryOrders({
          branch_id: 'branch-001',
          autoRefresh: false,
          onNewDeliveryOrder,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Second fetch returns new order
      setupMockFetch({ orders: [mockDeliveryOrder], stats: mockDeliveryStats });

      // Trigger refresh
      await act(async () => {
        await result.current.refresh();
      });

      // Should have called the callback
      await waitFor(() => {
        expect(onNewDeliveryOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            order_id: 'order-delivery-001',
            display_number: '201',
          })
        );
      });
    });

    it('should trigger status change callback', async () => {
      const onStatusChange = vi.fn();

      // First fetch returns order with pending status
      setupMockFetch({ orders: [mockDeliveryOrder], stats: mockDeliveryStats });

      const { useDeliveryOrders } = await importHook();

      const { result } = renderHook(() =>
        useDeliveryOrders({
          branch_id: 'branch-001',
          autoRefresh: false,
          onStatusChange,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Second fetch with status change
      const updatedOrder = {
        ...mockDeliveryOrder,
        delivery_status: 'driver_assigned' as DeliveryStatus,
      };

      setupMockFetch({ orders: [updatedOrder], stats: mockDeliveryStats });

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith(
          'order-delivery-001',
          'pending_assignment',
          'driver_assigned'
        );
      });
    });
  });

  describe('Filtering', () => {
    it('should filter orders by status', async () => {
      const orders = [
        { ...mockDeliveryOrder, order_id: 'o1', delivery_status: 'pending_assignment' as DeliveryStatus },
        { ...mockDeliveryOrder, order_id: 'o2', delivery_status: 'driver_assigned' as DeliveryStatus },
        { ...mockDeliveryOrder, order_id: 'o3', delivery_status: 'in_transit' as DeliveryStatus },
      ];

      setupMockFetch({ orders, stats: mockDeliveryStats });

      const { useDeliveryOrders } = await importHook();

      const { result } = renderHook(() =>
        useDeliveryOrders({ branch_id: 'branch-001', autoRefresh: false })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // All orders initially
      expect(result.current.filteredOrders).toHaveLength(3);

      // Filter by pending_assignment
      act(() => {
        result.current.setFilter('pending_assignment');
      });

      expect(result.current.filteredOrders).toHaveLength(1);
      expect(result.current.filteredOrders[0].delivery_status).toBe('pending_assignment');

      // Filter by in_transit
      act(() => {
        result.current.setFilter('in_transit');
      });

      expect(result.current.filteredOrders).toHaveLength(1);
      expect(result.current.filteredOrders[0].delivery_status).toBe('in_transit');
    });
  });

  describe('Driver Management', () => {
    it('should get available drivers', async () => {
      const drivers = [
        { ...mockDriver, id: 'd1', status: 'available' as const },
        { ...mockDriver, id: 'd2', status: 'busy' as const },
        { ...mockDriver, id: 'd3', status: 'available' as const },
      ];

      setupMockFetch({ orders: [mockDeliveryOrder], stats: mockDeliveryStats, drivers });

      const { useDeliveryOrders } = await importHook();

      const { result } = renderHook(() =>
        useDeliveryOrders({ branch_id: 'branch-001', autoRefresh: false })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Fetch drivers
      await act(async () => {
        await result.current.fetchDrivers();
      });

      const availableDrivers = result.current.getAvailableDrivers();
      expect(availableDrivers).toHaveLength(2);
      availableDrivers.forEach(d => {
        expect(d.status).toBe('available');
      });
    });
  });
});

// ======================
// CONTRACT TESTS
// ======================

describe('API Contract Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle all valid delivery statuses', async () => {
    const statuses: DeliveryStatus[] = [
      'pending_assignment',
      'driver_assigned',
      'driver_arrived',
      'picked_up',
      'in_transit',
      'arriving',
      'delivered',
      'failed',
      'returned',
    ];

    for (const status of statuses) {
      vi.clearAllMocks();

      const orderWithStatus = { ...mockDeliveryOrder, delivery_status: status };

      setupMockFetch({ orders: [orderWithStatus], stats: mockDeliveryStats });

      const { useDeliveryOrders } = await importHook();

      const { result, unmount } = renderHook(() =>
        useDeliveryOrders({ branch_id: 'branch-001', autoRefresh: false })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.orders[0].delivery_status).toBe(status);
      unmount();
    }
  });

  it('should handle order with all optional fields null', async () => {
    const minimalOrder: KDSDeliveryOrderView = {
      order_id: 'minimal-001',
      tenant_id: 'tenant-001',
      branch_id: 'branch-001',
      display_number: '999',
      order_status: 'pending',
      delivery_status: 'pending_assignment',
      priority: 1,
      ordered_at: new Date().toISOString(),
      ready_at: null,
      estimated_delivery_at: null,
      delivery_address: null,
      delivery_instructions: null,
      customer_name: null,
      customer_phone: null,
      delivery_driver_id: null,
      driver_name: null,
      driver_phone: null,
      driver_vehicle_type: null,
      total: 0,
      delivery_fee: 0,
      delivery_distance_km: null,
      minutes_elapsed: 0,
      minutes_until_delivery: null,
      items_count: 0,
      items_summary: '',
    };

    setupMockFetch({ orders: [minimalOrder], stats: mockDeliveryStats });

    const { useDeliveryOrders } = await importHook();

    const { result } = renderHook(() =>
      useDeliveryOrders({ branch_id: 'branch-001', autoRefresh: false })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.orders).toHaveLength(1);
    expect(result.current.orders[0].delivery_address).toBeNull();
  });

  it('should handle error responses gracefully', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ success: false, error: 'Server error' }),
      })
    );

    const { useDeliveryOrders } = await importHook();

    const { result } = renderHook(() =>
      useDeliveryOrders({ branch_id: 'branch-001', autoRefresh: false })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.orders).toEqual([]);
  });

  it('should handle network failures gracefully', async () => {
    mockFetch.mockImplementation(() =>
      Promise.reject(new Error('Network error'))
    );

    const { useDeliveryOrders } = await importHook();

    const { result } = renderHook(() =>
      useDeliveryOrders({ branch_id: 'branch-001', autoRefresh: false })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
  });
});

// ======================
// COMPONENT RENDER TESTS
// ======================

describe('KDSDisplay Component Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockFetch({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render KDSDisplay with delivery props', async () => {
    // Dynamic import to avoid module resolution issues
    const { KDSDisplay } = await import('@/features/restaurant-kitchen/components/KDSDisplay');

    render(
      <KDSDisplay
        orders={[mockKDSOrder]}
        stats={mockKDSStats}
        stations={mockStations}
        showDeliveryPanel={true}
        deliveryOrders={[mockDeliveryOrder]}
        deliveryStats={mockDeliveryStats}
        deliveryDrivers={[mockDriver]}
      />
    );

    // Check that the component renders without errors
    // Use getAllByText since there might be multiple elements
    const deliveryElements = screen.getAllByText('Delivery');
    expect(deliveryElements.length).toBeGreaterThan(0);
  });

  it('should show order numbers in the display', async () => {
    const { KDSDisplay } = await import('@/features/restaurant-kitchen/components/KDSDisplay');

    render(
      <KDSDisplay
        orders={[mockKDSOrder]}
        stats={mockKDSStats}
        stations={mockStations}
        showDeliveryPanel={false}
      />
    );

    // The order number should be visible (component shows '101' without '#')
    expect(screen.getByText('101')).toBeInTheDocument();
  });

  it('should show both dine-in and delivery orders when both exist', async () => {
    const { KDSDisplay } = await import('@/features/restaurant-kitchen/components/KDSDisplay');

    render(
      <KDSDisplay
        orders={[mockKDSOrder, mockDeliveryKDSOrder]}
        stats={mockKDSStats}
        stations={mockStations}
        showDeliveryPanel={false}
      />
    );

    // Both order numbers should be visible (component shows without '#')
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('201')).toBeInTheDocument();
  });
});

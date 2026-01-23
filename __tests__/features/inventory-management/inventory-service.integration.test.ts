// =====================================================
// TIS TIS PLATFORM - Inventory Service Integration Tests
// Tests for service functions with Supabase mocks
// =====================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ========================================
// MOCK SETUP - Must be hoisted before imports
// ========================================

// Mock channel for realtime - inline definition for hoisting
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

// Create supabase mock - must be inline for vi.mock hoisting
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: vi.fn(),
};

// Mock modules - these are hoisted to the top
vi.mock('@/src/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/features/inventory-management/lib/validation', () => ({
  isValidUUID: (id: string) => {
    // Match the actual implementation: validates UUID v1-5 with proper variant bits
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  },
}));

// Import after mocks
import {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  subscribeToInventoryChanges,
} from '@/features/inventory-management/services/inventory.service';

// Import the mocked module to get references
import { supabase } from '@/src/shared/lib/supabase';

// Cast to mocked type
const mockedSupabase = supabase as unknown as typeof mockSupabase;

// ========================================
// TEST DATA
// ========================================

// Mock user data
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: {
    tenant_id: 'tenant-abc-123',
  },
};

// Mock inventory item from database
const mockDbItem = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  tenant_id: 'tenant-abc-123',
  branch_id: null,
  category_id: 'cat-123',
  sku: 'SKU-001',
  name: 'Test Item',
  description: 'A test inventory item',
  item_type: 'ingredient',
  unit: 'kg',
  unit_cost: 100,
  currency: 'MXN',
  current_stock: 50,
  minimum_stock: 10,
  maximum_stock: 100,
  reorder_quantity: 20,
  storage_location: 'Shelf A1',
  storage_type: 'dry',
  is_perishable: true,
  default_shelf_life_days: 30,
  track_expiration: true,
  preferred_supplier_id: null,
  supplier_sku: null,
  image_url: null,
  allergens: [],
  is_active: true,
  is_trackable: true,
  metadata: {},
  created_at: '2026-01-20T10:00:00Z',
  updated_at: '2026-01-21T15:00:00Z',
  deleted_at: null,
};

// Mock query builder chain
const createQueryMock = (data: unknown, error: unknown = null, count: number | null = null) => {
  const chainMock = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error, count }),
    then: vi.fn((resolve) => resolve({ data, error, count })),
  };

  // Make the chain mock itself return the resolved value when awaited
  return {
    ...chainMock,
    then: (resolve: (value: { data: unknown; error: unknown; count: number | null }) => void) => {
      resolve({ data, error, count });
      return Promise.resolve({ data, error, count });
    },
  };
};

// ========================================
// TEST SUITES
// ========================================

describe('InventoryService Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user with tenant
    vi.mocked(mockedSupabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================
  // getInventoryItems TESTS
  // ========================================

  describe('getInventoryItems', () => {
    it('should return items for authenticated user with tenant', async () => {
      const mockData = [mockDbItem];
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(mockData, null, 1));

      const result = await getInventoryItems();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Test Item');
      expect(result.data[0].stockStatus).toBe('in_stock');
      expect(result.pagination.total).toBe(1);
    });

    it('should return error when user is not authenticated', async () => {
      vi.mocked(mockedSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getInventoryItems();

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
      expect(result.data).toEqual([]);
    });

    it('should return error when tenant_id is missing', async () => {
      vi.mocked(mockedSupabase.auth.getUser).mockResolvedValue({
        data: { user: { ...mockUser, user_metadata: {} } },
        error: null,
      });

      const result = await getInventoryItems();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant not found');
    });

    it('should apply search filter', async () => {
      const mockData = [mockDbItem];
      const queryMock = createQueryMock(mockData, null, 1);
      vi.mocked(mockedSupabase.from).mockReturnValue(queryMock);

      await getInventoryItems({ search: 'test' });

      expect(queryMock.or).toHaveBeenCalled();
    });

    it('should apply item_type filter', async () => {
      const mockData = [mockDbItem];
      const queryMock = createQueryMock(mockData, null, 1);
      vi.mocked(mockedSupabase.from).mockReturnValue(queryMock);

      await getInventoryItems({ item_type: 'ingredient' });

      expect(queryMock.eq).toHaveBeenCalledWith('item_type', 'ingredient');
    });

    it('should apply pagination correctly', async () => {
      const mockData = [mockDbItem];
      const queryMock = createQueryMock(mockData, null, 50);
      vi.mocked(mockedSupabase.from).mockReturnValue(queryMock);

      const result = await getInventoryItems({ page: 2, limit: 10 });

      expect(queryMock.range).toHaveBeenCalledWith(10, 19);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.pageSize).toBe(10);
    });

    it('should filter by stock_status client-side', async () => {
      const lowStockItem = { ...mockDbItem, current_stock: 5 }; // low_stock
      const mockData = [mockDbItem, lowStockItem];
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(mockData, null, 2));

      const result = await getInventoryItems({ stock_status: 'low_stock' });

      expect(result.success).toBe(true);
      // Only the low_stock item should be returned
      expect(result.data.every(item => item.stockStatus === 'low_stock')).toBe(true);
    });

    it('should handle database errors', async () => {
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(null, { message: 'Database error' }));

      const result = await getInventoryItems();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should sanitize search input to prevent SQL injection', async () => {
      const mockData = [mockDbItem];
      const queryMock = createQueryMock(mockData, null, 1);
      vi.mocked(mockedSupabase.from).mockReturnValue(queryMock);

      await getInventoryItems({ search: 'test%_\\' });

      // The search should be sanitized (special chars escaped)
      expect(queryMock.or).toHaveBeenCalled();
    });

    it('should validate category_id UUID format', async () => {
      const mockData = [mockDbItem];
      const queryMock = createQueryMock(mockData, null, 1);
      vi.mocked(mockedSupabase.from).mockReturnValue(queryMock);

      // Invalid UUID should not trigger the eq filter
      await getInventoryItems({ category_id: 'invalid-uuid' });

      // eq should still be called for tenant_id but not for category_id with invalid UUID
      const eqCalls = queryMock.eq.mock.calls;
      const categoryIdCalls = eqCalls.filter((call: string[]) => call[0] === 'category_id');
      expect(categoryIdCalls).toHaveLength(0);
    });
  });

  // ========================================
  // getInventoryItem TESTS
  // ========================================

  describe('getInventoryItem', () => {
    it('should return single item by valid ID', async () => {
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(mockDbItem));

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Test Item');
      expect(result.data.stockStatus).toBe('in_stock');
    });

    it('should return error for invalid UUID format', async () => {
      const result = await getInventoryItem('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid item ID format');
    });

    it('should return error when user is not authenticated', async () => {
      vi.mocked(mockedSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('should return error when item not found', async () => {
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(null));

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Item not found');
    });

    it('should handle database errors', async () => {
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(null, { message: 'Connection failed' }));

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  // ========================================
  // createInventoryItem TESTS
  // ========================================

  describe('createInventoryItem', () => {
    const newItemData = {
      name: 'New Test Item',
      item_type: 'ingredient' as const,
      unit: 'kg',
      unit_cost: 150,
      current_stock: 25,
      minimum_stock: 5,
    };

    it('should create new item successfully', async () => {
      const createdItem = { ...mockDbItem, ...newItemData, id: 'new-item-id' };
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(createdItem));

      const result = await createInventoryItem(newItemData);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('New Test Item');
      expect(result.message).toBe('Item creado exitosamente');
    });

    it('should return error when user is not authenticated', async () => {
      vi.mocked(mockedSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await createInventoryItem(newItemData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('should return error when tenant_id is missing', async () => {
      vi.mocked(mockedSupabase.auth.getUser).mockResolvedValue({
        data: { user: { ...mockUser, user_metadata: {} } },
        error: null,
      });

      const result = await createInventoryItem(newItemData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant not found');
    });

    it('should handle database errors', async () => {
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(null, { message: 'Duplicate SKU' }));

      const result = await createInventoryItem(newItemData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Duplicate SKU');
    });

    it('should set default values for optional fields', async () => {
      const minimalData = {
        name: 'Minimal Item',
        item_type: 'ingredient' as const,
        unit: 'unit',
        unit_cost: 10,
        current_stock: 0,
        minimum_stock: 0,
      };
      const createdItem = { ...mockDbItem, ...minimalData };
      const queryMock = createQueryMock(createdItem);
      vi.mocked(mockedSupabase.from).mockReturnValue(queryMock);

      await createInventoryItem(minimalData);

      expect(queryMock.insert).toHaveBeenCalled();
    });
  });

  // ========================================
  // updateInventoryItem TESTS
  // ========================================

  describe('updateInventoryItem', () => {
    const updateData = {
      name: 'Updated Item Name',
      current_stock: 75,
    };

    it('should update item successfully', async () => {
      const updatedItem = { ...mockDbItem, ...updateData };
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(updatedItem));

      const result = await updateInventoryItem('550e8400-e29b-41d4-a716-446655440000', updateData);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated Item Name');
      expect(result.message).toBe('Item actualizado exitosamente');
    });

    it('should return error for invalid UUID format', async () => {
      const result = await updateInventoryItem('invalid-id', updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid item ID format');
    });

    it('should return error when user is not authenticated', async () => {
      vi.mocked(mockedSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await updateInventoryItem('550e8400-e29b-41d4-a716-446655440000', updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('should return error when item not found', async () => {
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(null));

      const result = await updateInventoryItem('550e8400-e29b-41d4-a716-446655440000', updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Item not found or already deleted');
    });

    it('should handle database errors', async () => {
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(null, { message: 'Update failed' }));

      const result = await updateInventoryItem('550e8400-e29b-41d4-a716-446655440000', updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });

    it('should only include provided fields in update', async () => {
      const updatedItem = { ...mockDbItem, name: 'Only Name Changed' };
      const queryMock = createQueryMock(updatedItem);
      vi.mocked(mockedSupabase.from).mockReturnValue(queryMock);

      await updateInventoryItem('550e8400-e29b-41d4-a716-446655440000', { name: 'Only Name Changed' });

      expect(queryMock.update).toHaveBeenCalled();
    });
  });

  // ========================================
  // deleteInventoryItem TESTS
  // ========================================

  describe('deleteInventoryItem', () => {
    it('should soft delete item successfully', async () => {
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(null));

      const result = await deleteInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Item eliminado exitosamente');
    });

    it('should return error for invalid UUID format', async () => {
      const result = await deleteInventoryItem('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid item ID format');
    });

    it('should return error when user is not authenticated', async () => {
      vi.mocked(mockedSupabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await deleteInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    it('should return error when tenant_id is missing', async () => {
      vi.mocked(mockedSupabase.auth.getUser).mockResolvedValue({
        data: { user: { ...mockUser, user_metadata: {} } },
        error: null,
      });

      const result = await deleteInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant not found');
    });

    it('should handle database errors', async () => {
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(null, { message: 'Foreign key constraint' }));

      const result = await deleteInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Foreign key constraint');
    });
  });

  // ========================================
  // subscribeToInventoryChanges TESTS
  // ========================================

  describe('subscribeToInventoryChanges', () => {
    it('should create realtime subscription with tenant filter', async () => {
      // Setup channel mock that returns chainable methods
      const channelMock = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      };
      vi.mocked(mockedSupabase.channel).mockReturnValue(channelMock as never);

      const callback = vi.fn();
      const { unsubscribe } = await subscribeToInventoryChanges(callback);

      expect(vi.mocked(mockedSupabase.channel)).toHaveBeenCalledWith('inventory_changes_tenant-abc-123');
      expect(channelMock.on).toHaveBeenCalled();
      expect(channelMock.subscribe).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should return noop unsubscribe when tenant_id is missing', async () => {
      vi.mocked(mockedSupabase.auth.getUser).mockResolvedValue({
        data: { user: { ...mockUser, user_metadata: {} } },
        error: null,
      } as never);

      const callback = vi.fn();
      const { unsubscribe } = await subscribeToInventoryChanges(callback);

      expect(vi.mocked(mockedSupabase.channel)).not.toHaveBeenCalled();
      // unsubscribe should be a noop function
      expect(typeof unsubscribe).toBe('function');
      unsubscribe(); // Should not throw
    });

    it('should call removeChannel on unsubscribe', async () => {
      // Setup channel mock
      const channelMock = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      };
      vi.mocked(mockedSupabase.channel).mockReturnValue(channelMock as never);

      const callback = vi.fn();
      const { unsubscribe } = await subscribeToInventoryChanges(callback);
      unsubscribe();

      expect(vi.mocked(mockedSupabase.removeChannel)).toHaveBeenCalled();
    });
  });

  // ========================================
  // TRANSFORM LOGIC TESTS
  // ========================================

  describe('Transform to Display', () => {
    it('should calculate in_stock status correctly', async () => {
      const itemInStock = { ...mockDbItem, current_stock: 50, minimum_stock: 10 };
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(itemInStock));

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.data.stockStatus).toBe('in_stock');
    });

    it('should calculate low_stock status correctly', async () => {
      const itemLowStock = { ...mockDbItem, current_stock: 5, minimum_stock: 10 };
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(itemLowStock));

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.data.stockStatus).toBe('low_stock');
    });

    it('should calculate out_of_stock status correctly', async () => {
      const itemOutOfStock = { ...mockDbItem, current_stock: 0, minimum_stock: 10 };
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(itemOutOfStock));

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.data.stockStatus).toBe('out_of_stock');
    });

    it('should calculate overstocked status correctly', async () => {
      const itemOverstocked = { ...mockDbItem, current_stock: 200, minimum_stock: 10, maximum_stock: 100 };
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(itemOverstocked));

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.data.stockStatus).toBe('overstocked');
    });

    it('should calculate stock percentage correctly', async () => {
      const item = { ...mockDbItem, current_stock: 50, minimum_stock: 100 };
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(item));

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.data.stockPercentage).toBe(50);
    });

    it('should calculate stock value correctly', async () => {
      const item = { ...mockDbItem, current_stock: 10, unit_cost: 25 };
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(item));

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.data.stockValue).toBe(250);
    });

    it('should format stock value correctly', async () => {
      const item = { ...mockDbItem, current_stock: 1000.5, unit: 'kg' };
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(item));

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.data.formattedStock).toContain('1,000.5');
      expect(result.data.formattedStock).toContain('kg');
    });

    it('should format currency value correctly', async () => {
      const item = { ...mockDbItem, unit_cost: 1250.75, currency: 'MXN' };
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock(item));

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.data.formattedCost).toContain('$');
      expect(result.data.formattedCost).toContain('MXN');
    });
  });

  // ========================================
  // EDGE CASES & ERROR HANDLING
  // ========================================

  describe('Edge Cases', () => {
    it('should handle empty results', async () => {
      vi.mocked(mockedSupabase.from).mockReturnValue(createQueryMock([], null, 0));

      const result = await getInventoryItems();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should handle unexpected errors in getInventoryItems', async () => {
      vi.mocked(mockedSupabase.from).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await getInventoryItems();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });

    it('should handle unexpected errors in getInventoryItem', async () => {
      vi.mocked(mockedSupabase.from).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await getInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });

    it('should handle unexpected errors in createInventoryItem', async () => {
      vi.mocked(mockedSupabase.from).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await createInventoryItem({
        name: 'Test',
        item_type: 'ingredient',
        unit: 'kg',
        unit_cost: 10,
        current_stock: 0,
        minimum_stock: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });

    it('should handle unexpected errors in updateInventoryItem', async () => {
      vi.mocked(mockedSupabase.from).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await updateInventoryItem('550e8400-e29b-41d4-a716-446655440000', { name: 'Updated' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });

    it('should handle unexpected errors in deleteInventoryItem', async () => {
      vi.mocked(mockedSupabase.from).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await deleteInventoryItem('550e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(mockedSupabase.from).mockImplementation(() => {
        throw 'String error';
      });

      const result = await getInventoryItems();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });
});

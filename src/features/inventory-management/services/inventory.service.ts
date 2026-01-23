// =====================================================
// TIS TIS PLATFORM - Inventory Service
// API client for Inventory Management operations
// =====================================================

import { supabase } from '@/src/shared/lib/supabase';
import type {
  InventoryItem,
  InventoryItemDisplay,
  InventoryItemFormData,
  InventoryFilters,
  ApiResponse,
  PaginatedResponse,
  StockStatus,
} from '../types';
import { isValidUUID } from '../lib/validation';

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Calculate stock status based on current vs minimum stock
 */
function calculateStockStatus(
  current: number,
  minimum: number,
  maximum: number | null
): StockStatus {
  if (current <= 0) return 'out_of_stock';
  if (current <= minimum) return 'low_stock';
  if (maximum && current > maximum * 1.5) return 'overstocked';
  return 'in_stock';
}

/**
 * Calculate stock percentage
 */
function calculateStockPercentage(current: number, minimum: number): number {
  if (minimum <= 0) return 100;
  return Math.round((current / minimum) * 100);
}

/**
 * Format stock value for display
 */
function formatStock(value: number, unit: string): string {
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 2 })} ${unit}`;
}

/**
 * Format currency value
 */
function formatCurrency(value: number, currency: string = 'MXN'): string {
  return `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Format relative time (tiempo relativo)
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'ahora mismo';
  if (diffMins < 60) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  const weeks = Math.floor(diffDays / 7);
  if (diffDays < 30 && weeks > 0) return `hace ${weeks} semana${weeks > 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Transform InventoryItem to InventoryItemDisplay
 */
function transformToDisplay(item: InventoryItem): InventoryItemDisplay {
  const stockStatus = calculateStockStatus(
    item.current_stock,
    item.minimum_stock,
    item.maximum_stock
  );
  const stockPercentage = calculateStockPercentage(item.current_stock, item.minimum_stock);
  const stockValue = item.current_stock * item.unit_cost;

  return {
    ...item,
    stockStatus,
    stockPercentage,
    stockValue,
    daysUntilReorder: null, // TODO: Calculate based on consumption rate

    // Formatted fields
    formattedStock: formatStock(item.current_stock, item.unit),
    formattedCost: formatCurrency(item.unit_cost, item.currency),
    formattedValue: formatCurrency(stockValue, item.currency),
    formattedLastUpdated: item.updated_at ? formatTimeAgo(item.updated_at) : 'Desconocido',
  };
}

// ========================================
// SERVICE FUNCTIONS
// ========================================

/**
 * Get all inventory items with filters and pagination
 */
export async function getInventoryItems(
  filters?: InventoryFilters
): Promise<PaginatedResponse<InventoryItemDisplay>> {
  try {
    // Get current user's tenant_id for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        data: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
          hasMore: false,
        },
        error: 'User not authenticated',
      };
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return {
        success: false,
        data: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
          hasMore: false,
        },
        error: 'Tenant not found',
      };
    }

    // Build query with tenant isolation
    let query = supabase
      .from('inventory_items')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    // Apply filters
    if (filters?.search) {
      // Sanitize search input - escape special characters for ILIKE
      const sanitizedSearch = filters.search.replace(/[%_\\]/g, '\\$&');
      query = query.or(`name.ilike.%${sanitizedSearch}%,sku.ilike.%${sanitizedSearch}%`);
    }

    if (filters?.item_type) {
      query = query.eq('item_type', filters.item_type);
    }

    if (filters?.category_id) {
      // Validate UUID format before using in query
      if (isValidUUID(filters.category_id)) {
        query = query.eq('category_id', filters.category_id);
      }
    }

    if (filters?.storage_type) {
      query = query.eq('storage_type', filters.storage_type);
    }

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters?.is_trackable !== undefined) {
      query = query.eq('is_trackable', filters.is_trackable);
    }

    if (filters?.branch_id) {
      // Validate UUID format before using in query
      if (isValidUUID(filters.branch_id)) {
        query = query.or(`branch_id.eq.${filters.branch_id},branch_id.is.null`);
      }
    }

    // Apply sorting
    const sortBy = filters?.sort_by || 'name';
    const sortOrder = filters?.sort_order === 'desc' ? false : true;
    query = query.order(sortBy, { ascending: sortOrder });

    // Apply pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('[InventoryService] Error fetching items:', error);
      return {
        success: false,
        data: [],
        pagination: {
          total: 0,
          page,
          pageSize: limit,
          totalPages: 0,
          hasMore: false,
        },
        error: error.message,
      };
    }

    const items = (data || []) as InventoryItem[];
    const displayItems = items.map(transformToDisplay);

    // Filter by stock_status (client-side since it's computed)
    // NOTE: This filter is applied AFTER pagination, which means the returned count
    // may be less than the requested page size. For accurate pagination with stock_status
    // filter, consider implementing a database view or fetching all items and paginating client-side.
    // TODO: Implement server-side stock_status filtering via SQL computed column or view
    let filteredItems = displayItems;
    if (filters?.stock_status) {
      filteredItems = displayItems.filter(item => item.stockStatus === filters.stock_status);
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      data: filteredItems,
      pagination: {
        total: totalCount,
        page,
        pageSize: limit,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  } catch (error) {
    console.error('[InventoryService] Unexpected error:', error);
    return {
      success: false,
      data: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasMore: false,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get single inventory item by ID
 */
export async function getInventoryItem(id: string): Promise<ApiResponse<InventoryItemDisplay>> {
  try {
    // Validate ID format
    if (!isValidUUID(id)) {
      return {
        success: false,
        data: null as never,
        error: 'Invalid item ID format',
      };
    }

    // Get current user's tenant_id for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        data: null as never,
        error: 'User not authenticated',
      };
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return {
        success: false,
        data: null as never,
        error: 'Tenant not found',
      };
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error) {
      return {
        success: false,
        data: null as never,
        error: error.message,
      };
    }

    if (!data) {
      return {
        success: false,
        data: null as never,
        error: 'Item not found',
      };
    }

    const item = data as InventoryItem;
    const displayItem = transformToDisplay(item);

    return {
      success: true,
      data: displayItem,
    };
  } catch (error) {
    console.error('[InventoryService] Error fetching item:', error);
    return {
      success: false,
      data: null as never,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create new inventory item
 */
export async function createInventoryItem(
  data: InventoryItemFormData
): Promise<ApiResponse<InventoryItemDisplay>> {
  try {
    // Get current user/tenant context
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        data: null as never,
        error: 'User not authenticated',
      };
    }

    // TODO: Get tenant_id from user metadata or session
    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return {
        success: false,
        data: null as never,
        error: 'Tenant not found',
      };
    }

    const itemData = {
      tenant_id: tenantId,
      branch_id: null, // TODO: Get from context
      category_id: data.category_id || null,
      sku: data.sku || null,
      name: data.name,
      description: data.description || null,
      item_type: data.item_type,
      unit: data.unit,
      unit_cost: data.unit_cost,
      currency: 'MXN',
      current_stock: data.current_stock,
      minimum_stock: data.minimum_stock,
      maximum_stock: data.maximum_stock || null,
      reorder_quantity: data.reorder_quantity || null,
      storage_location: data.storage_location || null,
      storage_type: data.storage_type || 'dry',
      is_perishable: data.is_perishable ?? true,
      default_shelf_life_days: data.default_shelf_life_days || null,
      track_expiration: data.track_expiration ?? true,
      preferred_supplier_id: data.preferred_supplier_id || null,
      supplier_sku: data.supplier_sku || null,
      image_url: data.image_url || null,
      allergens: data.allergens || [],
      is_active: data.is_active ?? true,
      is_trackable: data.is_trackable ?? true,
      metadata: {},
    };

    const { data: newItem, error } = await supabase
      .from('inventory_items')
      .insert(itemData)
      .select()
      .single();

    if (error) {
      console.error('[InventoryService] Error creating item:', error);
      return {
        success: false,
        data: null as never,
        error: error.message,
      };
    }

    const item = newItem as InventoryItem;
    const displayItem = transformToDisplay(item);

    return {
      success: true,
      data: displayItem,
      message: 'Item creado exitosamente',
    };
  } catch (error) {
    console.error('[InventoryService] Unexpected error creating item:', error);
    return {
      success: false,
      data: null as never,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update inventory item
 */
export async function updateInventoryItem(
  id: string,
  data: Partial<InventoryItemFormData>
): Promise<ApiResponse<InventoryItemDisplay>> {
  try {
    // Validate ID format
    if (!isValidUUID(id)) {
      return {
        success: false,
        data: null as never,
        error: 'Invalid item ID format',
      };
    }

    // Get current user's tenant_id for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        data: null as never,
        error: 'User not authenticated',
      };
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return {
        success: false,
        data: null as never,
        error: 'Tenant not found',
      };
    }

    const updateData: Partial<InventoryItem> & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    };

    // Only include fields that are provided
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.item_type !== undefined) updateData.item_type = data.item_type;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.unit_cost !== undefined) updateData.unit_cost = data.unit_cost;
    if (data.current_stock !== undefined) updateData.current_stock = data.current_stock;
    if (data.minimum_stock !== undefined) updateData.minimum_stock = data.minimum_stock;
    if (data.maximum_stock !== undefined) updateData.maximum_stock = data.maximum_stock;
    if (data.reorder_quantity !== undefined) updateData.reorder_quantity = data.reorder_quantity;
    if (data.storage_location !== undefined) updateData.storage_location = data.storage_location;
    if (data.storage_type !== undefined) updateData.storage_type = data.storage_type;
    if (data.is_perishable !== undefined) updateData.is_perishable = data.is_perishable;
    if (data.default_shelf_life_days !== undefined) updateData.default_shelf_life_days = data.default_shelf_life_days;
    if (data.track_expiration !== undefined) updateData.track_expiration = data.track_expiration;
    if (data.preferred_supplier_id !== undefined) updateData.preferred_supplier_id = data.preferred_supplier_id;
    if (data.supplier_sku !== undefined) updateData.supplier_sku = data.supplier_sku;
    if (data.image_url !== undefined) updateData.image_url = data.image_url;
    if (data.allergens !== undefined) updateData.allergens = data.allergens;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.is_trackable !== undefined) updateData.is_trackable = data.is_trackable;

    const { data: updatedItem, error } = await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('[InventoryService] Error updating item:', error);
      return {
        success: false,
        data: null as never,
        error: error.message,
      };
    }

    if (!updatedItem) {
      return {
        success: false,
        data: null as never,
        error: 'Item not found or already deleted',
      };
    }

    const item = updatedItem as InventoryItem;
    const displayItem = transformToDisplay(item);

    return {
      success: true,
      data: displayItem,
      message: 'Item actualizado exitosamente',
    };
  } catch (error) {
    console.error('[InventoryService] Unexpected error updating item:', error);
    return {
      success: false,
      data: null as never,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete inventory item (soft delete)
 */
export async function deleteInventoryItem(id: string): Promise<ApiResponse<null>> {
  try {
    // Validate ID format
    if (!isValidUUID(id)) {
      return {
        success: false,
        data: null,
        error: 'Invalid item ID format',
      };
    }

    // Get current user's tenant_id for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        data: null,
        error: 'User not authenticated',
      };
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return {
        success: false,
        data: null,
        error: 'Tenant not found',
      };
    }

    const { error } = await supabase
      .from('inventory_items')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (error) {
      console.error('[InventoryService] Error deleting item:', error);
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }

    return {
      success: true,
      data: null,
      message: 'Item eliminado exitosamente',
    };
  } catch (error) {
    console.error('[InventoryService] Unexpected error deleting item:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Realtime payload type for inventory changes
 */
export interface InventoryRealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: InventoryItemDisplay;
  old: InventoryItemDisplay;
}

/**
 * Supabase realtime payload type (from postgres_changes)
 */
interface SupabaseRealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

/**
 * Subscribe to inventory changes (realtime)
 * IMPORTANT: Requires tenant_id for security - only receives updates for own tenant
 */
export async function subscribeToInventoryChanges(
  callback: (payload: InventoryRealtimePayload) => void
): Promise<{ unsubscribe: () => void }> {
  // Get current user's tenant_id for security filtering
  const { data: { user } } = await supabase.auth.getUser();
  const tenantId = user?.user_metadata?.tenant_id;

  if (!tenantId) {
    console.error('[InventoryService] Cannot subscribe without tenant_id');
    return { unsubscribe: () => {} };
  }

  const channel = supabase
    .channel(`inventory_changes_${tenantId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'inventory_items',
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload: SupabaseRealtimePayload) => {
        // Transform Supabase payload to our type
        // Supabase sends raw records, we need to cast them to InventoryItem
        const transformedPayload: InventoryRealtimePayload = {
          eventType: payload.eventType,
          new: payload.new && Object.keys(payload.new).length > 0
            ? transformToDisplay(payload.new as unknown as InventoryItem)
            : (null as never),
          old: payload.old && Object.keys(payload.old).length > 0
            ? transformToDisplay(payload.old as unknown as InventoryItem)
            : (null as never),
        };
        callback(transformedPayload);
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

// =====================================================
// TIS TIS PLATFORM - Restaurant Inventory Service
// API service for Inventory Management operations
// =====================================================

import { supabase } from '@/src/shared/lib/supabase';
import type {
  InventoryItem,
  InventoryCategory,
  InventoryBatch,
  InventoryMovement,
  InventorySupplier,
  InventoryStats,
  ItemFormData,
  CategoryFormData,
  BatchFormData,
  MovementFormData,
  SupplierFormData,
  MovementType,
} from '../types';

const API_BASE = '/api/restaurant/inventory';

// ======================
// HELPERS
// ======================

/**
 * Get auth headers using the shared Supabase client
 * This prevents multiple GoTrueClient instances
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    console.warn('[inventory.service] No session found - requests may fail with 401');
  }

  return {
    'Content-Type': 'application/json',
    ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Error en la solicitud');
  }
  return data.data;
}

// ======================
// ITEMS
// ======================

export async function getItems(params: {
  branch_id: string;
  category_id?: string;
  search?: string;
  item_type?: string;
  low_stock_only?: boolean;
  limit?: number;
}): Promise<InventoryItem[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();

  searchParams.set('branch_id', params.branch_id);
  if (params.category_id) searchParams.set('category_id', params.category_id);
  if (params.search) searchParams.set('search', params.search);
  if (params.item_type) searchParams.set('item_type', params.item_type);
  if (params.low_stock_only) searchParams.set('low_stock_only', 'true');
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`${API_BASE}/items?${searchParams}`, { headers });
  return handleResponse<InventoryItem[]>(response);
}

export async function getItem(itemId: string): Promise<InventoryItem> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/items/${itemId}`, { headers });
  return handleResponse<InventoryItem>(response);
}

export async function createItem(data: ItemFormData, branchId: string): Promise<InventoryItem> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...data, branch_id: branchId }),
  });
  return handleResponse<InventoryItem>(response);
}

export async function updateItem(itemId: string, data: Partial<ItemFormData>): Promise<InventoryItem> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/items/${itemId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<InventoryItem>(response);
}

export async function deleteItem(itemId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/items/${itemId}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error al eliminar item');
  }
}

// ======================
// CATEGORIES
// ======================

export async function getCategories(branchId: string): Promise<InventoryCategory[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/categories?branch_id=${branchId}`, { headers });
  return handleResponse<InventoryCategory[]>(response);
}

export async function createCategory(data: CategoryFormData, branchId: string): Promise<InventoryCategory> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/categories`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...data, branch_id: branchId }),
  });
  return handleResponse<InventoryCategory>(response);
}

export async function updateCategory(categoryId: string, data: Partial<CategoryFormData>): Promise<InventoryCategory> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/categories/${categoryId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<InventoryCategory>(response);
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/categories/${categoryId}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error al eliminar categoría');
  }
}

// ======================
// BATCHES
// ======================

export async function getBatches(itemId: string): Promise<InventoryBatch[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/items/${itemId}/batches`, { headers });
  return handleResponse<InventoryBatch[]>(response);
}

export async function createBatch(data: BatchFormData, branchId: string): Promise<InventoryBatch> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/batches`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...data, branch_id: branchId }),
  });
  return handleResponse<InventoryBatch>(response);
}

export async function updateBatch(batchId: string, data: Partial<BatchFormData>): Promise<InventoryBatch> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/batches/${batchId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<InventoryBatch>(response);
}

// ======================
// MOVEMENTS
// ======================

export async function getMovements(params: {
  branch_id: string;
  item_id?: string;
  movement_type?: MovementType;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<InventoryMovement[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();

  searchParams.set('branch_id', params.branch_id);
  if (params.item_id) searchParams.set('item_id', params.item_id);
  if (params.movement_type) searchParams.set('movement_type', params.movement_type);
  if (params.date_from) searchParams.set('date_from', params.date_from);
  if (params.date_to) searchParams.set('date_to', params.date_to);
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`${API_BASE}/movements?${searchParams}`, { headers });
  return handleResponse<InventoryMovement[]>(response);
}

export async function createMovement(data: MovementFormData, branchId: string): Promise<InventoryMovement> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/movements`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...data, branch_id: branchId }),
  });
  return handleResponse<InventoryMovement>(response);
}

// ======================
// SUPPLIERS
// ======================

export async function getSuppliers(): Promise<InventorySupplier[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/suppliers`, { headers });
  return handleResponse<InventorySupplier[]>(response);
}

export async function createSupplier(data: SupplierFormData): Promise<InventorySupplier> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/suppliers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<InventorySupplier>(response);
}

export async function updateSupplier(supplierId: string, data: Partial<SupplierFormData>): Promise<InventorySupplier> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/suppliers/${supplierId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<InventorySupplier>(response);
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/suppliers/${supplierId}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error al eliminar proveedor');
  }
}

// ======================
// STATS
// ======================

export async function getStats(branchId: string): Promise<InventoryStats> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/stats?branch_id=${branchId}`, { headers });
  return handleResponse<InventoryStats>(response);
}

// ======================
// QUICK ACTIONS
// ======================

export async function adjustStock(
  itemId: string,
  quantity: number,
  reason: string,
  branchId: string
): Promise<InventoryMovement> {
  return createMovement(
    {
      item_id: itemId,
      movement_type: 'adjustment',
      quantity,
      reason,
    },
    branchId
  );
}

export async function recordWaste(
  itemId: string,
  quantity: number,
  reason: string,
  branchId: string
): Promise<InventoryMovement> {
  return createMovement(
    {
      item_id: itemId,
      movement_type: 'waste',
      quantity: -Math.abs(quantity), // Always negative for waste
      reason,
    },
    branchId
  );
}

export async function recordPurchase(
  itemId: string,
  quantity: number,
  unitCost: number,
  branchId: string,
  notes?: string
): Promise<InventoryMovement> {
  return createMovement(
    {
      item_id: itemId,
      movement_type: 'purchase',
      quantity: Math.abs(quantity), // Always positive for purchase
      unit_cost: unitCost,
      notes,
    },
    branchId
  );
}

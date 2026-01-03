// =====================================================
// TIS TIS PLATFORM - Restaurant Kitchen Service
// API service for Kitchen Display System operations
// =====================================================

import type {
  RestaurantOrder,
  RestaurantOrderItem,
  KitchenStationConfig,
  KDSOrderView,
  KDSStats,
  OrderFormData,
  OrderItemFormData,
  StationFormData,
  OrderStatus,
  OrderItemStatus,
  KitchenStation,
} from '../types';

const API_BASE = '/api/restaurant/kitchen';

// ======================
// HELPERS
// ======================

async function getAuthHeaders(): Promise<HeadersInit> {
  const { createBrowserClient } = await import('@supabase/ssr');
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { session } } = await supabase.auth.getSession();

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
// ORDERS
// ======================

export async function getOrders(params: {
  branch_id: string;
  status?: OrderStatus[];
  order_type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<RestaurantOrder[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();

  searchParams.set('branch_id', params.branch_id);
  if (params.status?.length) searchParams.set('status', params.status.join(','));
  if (params.order_type) searchParams.set('order_type', params.order_type);
  if (params.date_from) searchParams.set('date_from', params.date_from);
  if (params.date_to) searchParams.set('date_to', params.date_to);
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`${API_BASE}/orders?${searchParams}`, { headers });
  return handleResponse<RestaurantOrder[]>(response);
}

export async function getOrder(orderId: string): Promise<RestaurantOrder> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/orders/${orderId}`, { headers });
  return handleResponse<RestaurantOrder>(response);
}

export async function createOrder(
  data: OrderFormData,
  branchId: string,
  items: OrderItemFormData[]
): Promise<RestaurantOrder> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...data, branch_id: branchId, items }),
  });
  return handleResponse<RestaurantOrder>(response);
}

export async function updateOrder(
  orderId: string,
  data: Partial<OrderFormData>
): Promise<RestaurantOrder> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/orders/${orderId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<RestaurantOrder>(response);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<RestaurantOrder> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/orders/${orderId}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status }),
  });
  return handleResponse<RestaurantOrder>(response);
}

export async function cancelOrder(
  orderId: string,
  reason: string
): Promise<RestaurantOrder> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  return handleResponse<RestaurantOrder>(response);
}

// ======================
// ORDER ITEMS
// ======================

export async function addOrderItem(
  orderId: string,
  item: OrderItemFormData
): Promise<RestaurantOrderItem> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/orders/${orderId}/items`, {
    method: 'POST',
    headers,
    body: JSON.stringify(item),
  });
  return handleResponse<RestaurantOrderItem>(response);
}

export async function updateOrderItem(
  itemId: string,
  data: Partial<OrderItemFormData>
): Promise<RestaurantOrderItem> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/items/${itemId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<RestaurantOrderItem>(response);
}

export async function updateItemStatus(
  itemId: string,
  status: OrderItemStatus
): Promise<RestaurantOrderItem> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/items/${itemId}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status }),
  });
  return handleResponse<RestaurantOrderItem>(response);
}

export async function bumpItem(itemId: string): Promise<RestaurantOrderItem> {
  return updateItemStatus(itemId, 'ready');
}

export async function startItem(itemId: string): Promise<RestaurantOrderItem> {
  return updateItemStatus(itemId, 'preparing');
}

export async function cancelItem(itemId: string): Promise<RestaurantOrderItem> {
  return updateItemStatus(itemId, 'cancelled');
}

export async function assignItemToStation(
  itemId: string,
  station: KitchenStation
): Promise<RestaurantOrderItem> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/items/${itemId}/station`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ kitchen_station: station }),
  });
  return handleResponse<RestaurantOrderItem>(response);
}

// ======================
// KDS VIEWS
// ======================

export async function getKDSOrders(branchId: string): Promise<KDSOrderView[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kds?branch_id=${branchId}`, { headers });
  return handleResponse<KDSOrderView[]>(response);
}

export async function getKDSOrdersByStation(
  branchId: string,
  station: KitchenStation
): Promise<KDSOrderView[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE}/kds?branch_id=${branchId}&station=${station}`,
    { headers }
  );
  return handleResponse<KDSOrderView[]>(response);
}

export async function getKDSStats(branchId: string): Promise<KDSStats> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/stats?branch_id=${branchId}`, { headers });
  return handleResponse<KDSStats>(response);
}

// ======================
// KITCHEN STATIONS
// ======================

export async function getStations(branchId: string): Promise<KitchenStationConfig[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/stations?branch_id=${branchId}`, { headers });
  return handleResponse<KitchenStationConfig[]>(response);
}

export async function createStation(
  data: StationFormData,
  branchId: string
): Promise<KitchenStationConfig> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/stations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...data, branch_id: branchId }),
  });
  return handleResponse<KitchenStationConfig>(response);
}

export async function updateStation(
  stationId: string,
  data: Partial<StationFormData>
): Promise<KitchenStationConfig> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/stations/${stationId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<KitchenStationConfig>(response);
}

export async function deleteStation(stationId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/stations/${stationId}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error al eliminar estación');
  }
}

// ======================
// BULK ACTIONS
// ======================

export async function bumpOrder(orderId: string): Promise<RestaurantOrder> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/orders/${orderId}/bump`, {
    method: 'POST',
    headers,
  });
  return handleResponse<RestaurantOrder>(response);
}

export async function recallOrder(orderId: string): Promise<RestaurantOrder> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/orders/${orderId}/recall`, {
    method: 'POST',
    headers,
  });
  return handleResponse<RestaurantOrder>(response);
}

export async function setPriority(
  orderId: string,
  priority: number
): Promise<RestaurantOrder> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/orders/${orderId}/priority`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ priority }),
  });
  return handleResponse<RestaurantOrder>(response);
}

// =====================================================
// TIS TIS PLATFORM - Restock Orders Service
// API service for Restock Management operations
// =====================================================

import type {
  RestockOrder,
  RestockOrderFormData,
  LowStockAlert,
  LowStockAlertFormData,
  RestockNotificationPreferences,
  RestockPreferencesFormData,
  RestockOrderStatus,
  LowStockAlertStatus,
} from '../types';

const API_BASE = '/api/restaurant/inventory';

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
// RESTOCK ORDERS
// ======================

export async function getRestockOrders(params: {
  branch_id?: string;
  status?: RestockOrderStatus;
  supplier_id?: string;
  trigger_source?: 'auto' | 'manual' | 'alert';
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<RestockOrder[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();

  if (params.branch_id) searchParams.set('branch_id', params.branch_id);
  if (params.status) searchParams.set('status', params.status);
  if (params.supplier_id) searchParams.set('supplier_id', params.supplier_id);
  if (params.trigger_source) searchParams.set('trigger_source', params.trigger_source);
  if (params.date_from) searchParams.set('date_from', params.date_from);
  if (params.date_to) searchParams.set('date_to', params.date_to);
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`${API_BASE}/restock-orders?${searchParams}`, { headers });
  return handleResponse<RestockOrder[]>(response);
}

export async function getRestockOrder(orderId: string): Promise<RestockOrder> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/restock-orders/${orderId}`, { headers });
  return handleResponse<RestockOrder>(response);
}

export async function createRestockOrder(data: RestockOrderFormData): Promise<RestockOrder> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/restock-orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<RestockOrder>(response);
}

export async function updateRestockOrder(
  orderId: string,
  data: Partial<RestockOrderFormData> & { action?: string }
): Promise<RestockOrder> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/restock-orders/${orderId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<RestockOrder>(response);
}

export async function deleteRestockOrder(orderId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/restock-orders/${orderId}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error al eliminar orden');
  }
}

// Order Actions
export async function authorizeOrder(orderId: string): Promise<RestockOrder> {
  return updateRestockOrder(orderId, { action: 'authorize' });
}

export async function placeOrder(orderId: string): Promise<RestockOrder> {
  return updateRestockOrder(orderId, { action: 'place' });
}

export async function markWhatsAppSent(orderId: string, messageId?: string): Promise<RestockOrder> {
  return updateRestockOrder(orderId, {
    action: 'mark_whatsapp_sent',
    whatsapp_message_id: messageId,
  } as Partial<RestockOrderFormData> & { action: string; whatsapp_message_id?: string });
}

export async function receiveOrder(orderId: string): Promise<RestockOrder> {
  return updateRestockOrder(orderId, { action: 'receive' });
}

export async function partialReceiveOrder(orderId: string): Promise<RestockOrder> {
  return updateRestockOrder(orderId, { action: 'partial_receive' });
}

export async function cancelOrder(orderId: string): Promise<RestockOrder> {
  return updateRestockOrder(orderId, { action: 'cancel' });
}

// ======================
// LOW STOCK ALERTS
// ======================

export async function getLowStockAlerts(params: {
  branch_id?: string;
  status?: LowStockAlertStatus;
  alert_type?: 'warning' | 'critical';
  include_resolved?: boolean;
  limit?: number;
}): Promise<LowStockAlert[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();

  if (params.branch_id) searchParams.set('branch_id', params.branch_id);
  if (params.status) searchParams.set('status', params.status);
  if (params.alert_type) searchParams.set('alert_type', params.alert_type);
  if (params.include_resolved) searchParams.set('include_resolved', 'true');
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`${API_BASE}/alerts?${searchParams}`, { headers });
  return handleResponse<LowStockAlert[]>(response);
}

export async function getAlert(alertId: string): Promise<LowStockAlert> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/alerts/${alertId}`, { headers });
  return handleResponse<LowStockAlert>(response);
}

export async function createAlert(data: LowStockAlertFormData): Promise<LowStockAlert> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/alerts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<LowStockAlert>(response);
}

export async function scanInventoryForAlerts(branchId: string): Promise<{
  scanned_items: number;
  items_below_minimum: number;
  new_alerts_created: number;
  existing_alerts: number;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/alerts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'scan', branch_id: branchId }),
  });
  return handleResponse(response);
}

export async function updateAlert(
  alertId: string,
  data: { action?: string; associated_order_id?: string }
): Promise<LowStockAlert> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/alerts/${alertId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<LowStockAlert>(response);
}

export async function acknowledgeAlert(alertId: string): Promise<LowStockAlert> {
  return updateAlert(alertId, { action: 'acknowledge' });
}

export async function resolveAlert(alertId: string): Promise<LowStockAlert> {
  return updateAlert(alertId, { action: 'resolve' });
}

export async function dismissAlert(alertId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/alerts/${alertId}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error al descartar alerta');
  }
}

// ======================
// NOTIFICATION PREFERENCES
// ======================

export async function getRestockPreferences(branchId?: string): Promise<RestockNotificationPreferences> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();
  if (branchId) searchParams.set('branch_id', branchId);

  const response = await fetch(`${API_BASE}/restock-preferences?${searchParams}`, { headers });
  return handleResponse<RestockNotificationPreferences>(response);
}

export async function saveRestockPreferences(
  data: RestockPreferencesFormData
): Promise<RestockNotificationPreferences> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/restock-preferences`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<RestockNotificationPreferences>(response);
}

// ======================
// HELPER FUNCTIONS
// ======================

export async function createOrderFromAlerts(
  branchId: string,
  supplierId: string,
  alertIds: string[],
  items: Array<{
    inventory_item_id: string;
    quantity_requested: number;
    unit: string;
    unit_cost?: number;
  }>
): Promise<RestockOrder> {
  return createRestockOrder({
    branch_id: branchId,
    supplier_id: supplierId,
    trigger_source: 'alert',
    triggered_by_alert_ids: alertIds,
    items: items.map(item => ({
      ...item,
      unit_cost: item.unit_cost ?? 0,
    })),
  });
}

// Generar mensaje de WhatsApp para orden
export function generateWhatsAppMessage(order: RestockOrder): string {
  const items = order.items || [];
  const supplierName = order.supplier?.name || 'Proveedor';

  let message = `🛒 *Orden de Reabastecimiento*\n`;
  message += `📋 Orden: ${order.order_number}\n`;
  message += `📅 Fecha: ${new Date().toLocaleDateString('es-MX')}\n\n`;
  message += `Hola ${order.supplier?.contact_name || supplierName},\n\n`;
  message += `Necesitamos los siguientes artículos:\n\n`;

  items.forEach((item, index) => {
    const itemName = item.inventory_item?.name || `Artículo ${item.inventory_item_id}`;
    message += `${index + 1}. ${itemName}\n`;
    message += `   Cantidad: ${item.quantity_requested} ${item.unit}\n`;
    if (item.unit_cost && item.unit_cost > 0) {
      message += `   Precio unitario: $${item.unit_cost.toFixed(2)}\n`;
    }
    message += `\n`;
  });

  if (order.total_amount && order.total_amount > 0) {
    message += `💰 *Total estimado: $${order.total_amount.toFixed(2)} ${order.currency || 'MXN'}*\n\n`;
  }

  if (order.expected_delivery_date) {
    message += `📦 Fecha de entrega esperada: ${new Date(order.expected_delivery_date).toLocaleDateString('es-MX')}\n\n`;
  }

  if (order.supplier_notes) {
    message += `📝 Notas: ${order.supplier_notes}\n\n`;
  }

  message += `Por favor confirme disponibilidad y fecha de entrega.\n`;
  message += `\n¡Gracias!`;

  return message;
}

// Generar URL de WhatsApp
export function getWhatsAppUrl(phone: string, message: string): string {
  // Limpiar número de teléfono
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

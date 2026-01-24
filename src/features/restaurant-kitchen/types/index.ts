// =====================================================
// TIS TIS PLATFORM - Restaurant Kitchen/KDS Types
// Type definitions for the Kitchen Display System
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/089_RESTAURANT_ORDERS_KDS.sql
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql (delivery extensions)
// - Types: src/shared/types/delivery-types.ts
// =====================================================

// Re-export delivery types para uso conveniente
export {
  type DeliveryStatus,
  type DeliveryAddress as DeliveryAddressExtended,
  type DeliveryDriver,
  type DeliveryZone,
  type DeliveryTrackingEvent,
  type DeliveryCalculationResult,
  type DriverAssignmentResult,
  DELIVERY_STATUSES,
  DELIVERY_STATUS_INFO,
  DELIVERY_STATUS_TRANSITIONS,
  isValidDeliveryStatus,
  isValidStatusTransition,
  formatDeliveryAddress,
  formatShortAddress,
} from '@/src/shared/types/delivery-types';

// Import para uso interno
import type { DeliveryAddress as DeliveryAddressExtendedInternal } from '@/src/shared/types/delivery-types';

// ======================
// ORDER TYPES
// ======================
export type OrderType = 'dine_in' | 'takeout' | 'delivery' | 'drive_thru' | 'catering';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';

export type KitchenStation =
  | 'main'
  | 'grill'
  | 'fry'
  | 'salad'
  | 'sushi'
  | 'pizza'
  | 'dessert'
  | 'bar'
  | 'expeditor'
  | 'prep'
  | 'assembly';

// ======================
// ORDER ITEM
// ======================
export interface OrderItemAddOn {
  name: string;
  price: number;
  quantity?: number;
}

export interface OrderItemModifier {
  type: 'remove' | 'extra' | 'substitute';
  item: string;
  notes?: string;
}

export interface RestaurantOrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  menu_item_id: string | null;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  variant_name: string | null;
  variant_price: number;
  size_name: string | null;
  size_price: number;
  add_ons: OrderItemAddOn[];
  modifiers: OrderItemModifier[];
  status: OrderItemStatus;
  kitchen_station: KitchenStation;
  started_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  prepared_by: string | null;
  special_instructions: string | null;
  allergen_notes: string | null;
  display_order: number;
  is_complimentary: boolean;
  complimentary_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ======================
// ORDER
// ======================

// Import tipo extendido de delivery
import type { DeliveryStatus } from '@/src/shared/types/delivery-types';

/**
 * Direccion de delivery simplificada (compatible con estructura anterior)
 * Para direccion completa, usar DeliveryAddressExtended de delivery-types.ts
 */
export interface DeliveryAddress {
  street: string;
  number: string;
  apartment?: string;
  city: string;
  postal_code: string;
  colony?: string;
  reference?: string;
  contact_phone?: string;
  contact_name?: string;
  lat?: number;
  lng?: number;
}

export interface RestaurantOrder {
  id: string;
  tenant_id: string;
  branch_id: string;
  order_number: number;
  display_number: string;
  order_type: OrderType;
  table_id: string | null;
  server_id: string | null;
  customer_id: string | null;
  appointment_id: string | null;
  status: OrderStatus;
  priority: number;
  ordered_at: string;
  confirmed_at: string | null;
  started_preparing_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  estimated_prep_time: number | null;
  actual_prep_time: number | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  discount_reason: string | null;
  tip_amount: number;
  total: number;
  currency: string;
  payment_status: PaymentStatus;
  payment_method: string | null;
  paid_at: string | null;
  // Campos de delivery
  delivery_address: DeliveryAddress | null;
  delivery_instructions: string | null;
  delivery_fee: number | null;
  driver_id: string | null; // Staff que tomo el pedido en mostrador (legacy)
  // Campos adicionales de delivery (migracion 156)
  delivery_driver_id: string | null; // Repartidor asignado para delivery
  delivery_status: DeliveryStatus | null;
  delivery_distance_km: number | null;
  estimated_delivery_at: string | null;
  actual_delivery_at: string | null;
  delivery_failure_reason: string | null;
  customer_notes: string | null;
  kitchen_notes: string | null;
  internal_notes: string | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Relations
  items?: RestaurantOrderItem[];
  table?: { table_number: string; zone: string };
  server?: { id: string; full_name: string };
  customer?: { id: string; full_name: string; phone: string };
}

// ======================
// KITCHEN STATION
// ======================
export interface KitchenStationConfig {
  id: string;
  tenant_id: string;
  branch_id: string;
  code: string;
  name: string;
  description: string | null;
  station_type: KitchenStation;
  handles_categories: string[];
  printer_name: string | null;
  printer_ip: string | null;
  display_color: string;
  display_order: number;
  is_active: boolean;
  default_staff_ids: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ======================
// KDS ACTIVITY LOG
// ======================
export type KDSAction =
  | 'order_received'
  | 'item_started'
  | 'item_ready'
  | 'item_served'
  | 'item_cancelled'
  | 'order_bumped'
  | 'order_recalled'
  | 'priority_changed'
  | 'station_assigned'
  | 'note_added';

export interface KDSActivityLog {
  id: string;
  tenant_id: string;
  branch_id: string;
  order_id: string | null;
  order_item_id: string | null;
  station_id: string | null;
  action: KDSAction;
  performed_by: string | null;
  staff_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  notes: string | null;
  performed_at: string;
}

// ======================
// KDS VIEW TYPES
// ======================
export interface KDSOrderView {
  order_id: string;
  tenant_id: string;
  branch_id: string;
  display_number: string;
  order_type: OrderType;
  order_status: OrderStatus;
  priority: number;
  ordered_at: string;
  estimated_prep_time: number | null;
  table_id: string | null;
  table_number: string | null;
  customer_notes: string | null;
  kitchen_notes: string | null;
  items: KDSOrderItemView[];
  minutes_elapsed: number;
  // Campos de delivery para KDS (sincronizado con migracion 156)
  delivery_status?: DeliveryStatus | null;
  delivery_address?: DeliveryAddress | null;
  delivery_instructions?: string | null;
  delivery_driver_id?: string | null;
  delivery_driver_name?: string | null;
  delivery_driver_phone?: string | null;
  estimated_delivery_at?: string | null;
}

export interface KDSOrderItemView {
  id: string;
  menu_item_name: string;
  quantity: number;
  variant_name: string | null;
  size_name: string | null;
  add_ons: OrderItemAddOn[];
  modifiers: OrderItemModifier[];
  status: OrderItemStatus;
  kitchen_station: KitchenStation;
  special_instructions: string | null;
  allergen_notes: string | null;
  started_at: string | null;
  ready_at: string | null;
}

export interface KDSItemByStation {
  item_id: string;
  tenant_id: string;
  order_id: string;
  branch_id: string;
  order_number: string;
  order_type: OrderType;
  order_priority: number;
  menu_item_name: string;
  quantity: number;
  variant_name: string | null;
  size_name: string | null;
  add_ons: OrderItemAddOn[];
  modifiers: OrderItemModifier[];
  item_status: OrderItemStatus;
  kitchen_station: KitchenStation;
  special_instructions: string | null;
  allergen_notes: string | null;
  started_at: string | null;
  ready_at: string | null;
  ordered_at: string;
  table_number: string | null;
  minutes_waiting: number;
}

// ======================
// FORM DATA
// ======================
export interface OrderFormData {
  order_type: OrderType;
  table_id?: string | null;
  customer_id?: string | null;
  server_id?: string | null;
  priority?: number;
  estimated_prep_time?: number;
  customer_notes?: string;
  kitchen_notes?: string;
  internal_notes?: string;
  delivery_address?: DeliveryAddress;
  delivery_instructions?: string;
  delivery_fee?: number;
}

export interface OrderItemFormData {
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  variant_name?: string;
  variant_price?: number;
  size_name?: string;
  size_price?: number;
  add_ons?: OrderItemAddOn[];
  modifiers?: OrderItemModifier[];
  kitchen_station?: KitchenStation;
  special_instructions?: string;
  allergen_notes?: string;
  is_complimentary?: boolean;
  complimentary_reason?: string;
}

export interface StationFormData {
  code: string;
  name: string;
  description?: string;
  station_type: KitchenStation;
  handles_categories?: string[];
  printer_name?: string;
  printer_ip?: string;
  display_color?: string;
  is_active?: boolean;
  default_staff_ids?: string[];
}

// ======================
// STATS
// ======================
export interface KDSStats {
  active_orders: number;
  pending_items: number;
  preparing_items: number;
  ready_items: number;
  avg_prep_time: number;
  orders_by_type: Record<OrderType, number>;
  orders_by_status: Record<OrderStatus, number>;
  items_by_station: Record<KitchenStation, number>;
  peak_times: Array<{ hour: number; count: number }>;
  slow_items: Array<{
    menu_item_name: string;
    avg_prep_time: number;
    count: number;
  }>;
  // Estadisticas de delivery (sincronizado con migracion 156)
  delivery_stats?: KDSDeliveryStats;
}

// ======================
// DELIVERY KDS TYPES (FASE 3 - Integracion)
// ======================

/**
 * Estadisticas de delivery para el KDS
 */
export interface KDSDeliveryStats {
  pending_assignment: number;
  driver_assigned: number;
  in_transit: number;
  ready_for_pickup: number;
  total_active: number;
}

/**
 * Vista de orden de delivery para el panel de KDS
 * Usa DeliveryAddressExtendedInternal que tiene exterior_number (de delivery-types.ts)
 * La direccion puede ser null si la orden no tiene direccion configurada
 */
export interface KDSDeliveryOrderView {
  order_id: string;
  tenant_id: string;
  branch_id: string;
  display_number: string;
  order_status: OrderStatus;
  delivery_status: DeliveryStatus;
  priority: number;
  ordered_at: string;
  ready_at: string | null;
  estimated_delivery_at: string | null;
  // Direccion (usa tipo extendido con exterior_number, puede ser null)
  delivery_address: DeliveryAddressExtendedInternal | null;
  delivery_instructions: string | null;
  // Cliente
  customer_name: string | null;
  customer_phone: string | null;
  // Repartidor
  delivery_driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_vehicle_type: string | null;
  // Financiero
  total: number;
  delivery_fee: number;
  delivery_distance_km: number | null;
  // Tiempo
  minutes_elapsed: number;
  minutes_until_delivery: number | null;
  // Items resumidos
  items_count: number;
  items_summary: string;
}

/**
 * Filtro para ordenes de delivery en KDS
 */
export type KDSDeliveryFilter = 'all' | 'pending_assignment' | 'ready_for_pickup' | 'driver_assigned' | 'in_transit';

/**
 * Configuracion del panel de delivery
 */
export interface KDSDeliveryPanelConfig {
  position: 'left' | 'right' | 'bottom';
  width: number;
  autoRefreshInterval: number;
  soundEnabled: boolean;
  showDriverLocation: boolean;
}

// ======================
// API RESPONSES
// ======================
export interface OrdersResponse {
  success: boolean;
  data: RestaurantOrder[];
  error?: string;
}

export interface OrderResponse {
  success: boolean;
  data: RestaurantOrder;
  error?: string;
}

export interface KDSOrdersResponse {
  success: boolean;
  data: KDSOrderView[];
  error?: string;
}

export interface StationsResponse {
  success: boolean;
  data: KitchenStationConfig[];
  error?: string;
}

export interface KDSStatsResponse {
  success: boolean;
  data: KDSStats;
  error?: string;
}

// ======================
// CONFIGURATION
// ======================
export const ORDER_TYPE_CONFIG: Record<OrderType, { label: string; icon: string; color: string }> = {
  dine_in: { label: 'Mesa', icon: 'UtensilsCrossed', color: 'bg-blue-500' },
  takeout: { label: 'Para llevar', icon: 'ShoppingBag', color: 'bg-green-500' },
  delivery: { label: 'Delivery', icon: 'Truck', color: 'bg-purple-500' },
  drive_thru: { label: 'Drive-thru', icon: 'Car', color: 'bg-orange-500' },
  catering: { label: 'Catering', icon: 'ChefHat', color: 'bg-pink-500' },
};

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pendiente', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  confirmed: { label: 'Confirmado', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  preparing: { label: 'Preparando', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  ready: { label: 'Listo', color: 'text-green-700', bgColor: 'bg-green-100' },
  served: { label: 'Servido', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  completed: { label: 'Completado', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  cancelled: { label: 'Cancelado', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export const ITEM_STATUS_CONFIG: Record<OrderItemStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'En cola', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  preparing: { label: 'Preparando', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  ready: { label: 'Listo', color: 'text-green-700', bgColor: 'bg-green-100' },
  served: { label: 'Servido', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  cancelled: { label: 'Cancelado', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export const STATION_CONFIG: Record<KitchenStation, { label: string; icon: string; color: string }> = {
  main: { label: 'Principal', icon: 'ChefHat', color: '#3B82F6' },
  grill: { label: 'Parrilla', icon: 'Flame', color: '#EF4444' },
  fry: { label: 'Freidora', icon: 'Droplets', color: '#F59E0B' },
  salad: { label: 'Ensaladas', icon: 'Salad', color: '#22C55E' },
  sushi: { label: 'Sushi', icon: 'Fish', color: '#06B6D4' },
  pizza: { label: 'Pizza', icon: 'Pizza', color: '#F97316' },
  dessert: { label: 'Postres', icon: 'IceCream', color: '#EC4899' },
  bar: { label: 'Bebidas', icon: 'Wine', color: '#8B5CF6' },
  expeditor: { label: 'Expedidor', icon: 'ClipboardList', color: '#64748B' },
  prep: { label: 'Preparación', icon: 'Scissors', color: '#0EA5E9' },
  assembly: { label: 'Ensamblaje', icon: 'Layers', color: '#10B981' },
};

export const PRIORITY_CONFIG = [
  { value: 1, label: 'Baja', color: 'bg-slate-400' },
  { value: 2, label: 'Normal-Baja', color: 'bg-blue-400' },
  { value: 3, label: 'Normal', color: 'bg-green-400' },
  { value: 4, label: 'Alta', color: 'bg-orange-400' },
  { value: 5, label: 'Urgente', color: 'bg-red-500' },
];

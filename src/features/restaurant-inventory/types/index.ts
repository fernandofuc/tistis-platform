// =====================================================
// TIS TIS PLATFORM - Restaurant Inventory Types
// Type definitions for the Inventory Management System
// =====================================================

// ======================
// ENUMS
// ======================
export type ItemType = 'ingredient' | 'supply' | 'equipment' | 'packaging';
export type StorageType = 'dry' | 'refrigerated' | 'frozen' | 'ambient';
export type BatchStatus = 'available' | 'reserved' | 'expired' | 'damaged' | 'consumed';
export type MovementType =
  | 'purchase'
  | 'sale'
  | 'consumption'
  | 'waste'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'return'
  | 'production';
export type CountType = 'full' | 'partial' | 'cycle' | 'spot';
export type CountStatus = 'draft' | 'in_progress' | 'completed' | 'approved' | 'cancelled';

// ======================
// INVENTORY CATEGORY
// ======================
export interface InventoryCategory {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  icon: string | null;
  color: string;
  display_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Relations
  parent?: InventoryCategory | null;
  children?: InventoryCategory[];
  items_count?: number;
}

// ======================
// INVENTORY ITEM
// ======================
export interface InventoryItem {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  category_id: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  item_type: ItemType;
  unit: string;
  unit_cost: number;
  currency: string;
  current_stock: number;
  minimum_stock: number;
  maximum_stock: number | null;
  reorder_quantity: number | null;
  storage_location: string | null;
  storage_type: StorageType;
  is_perishable: boolean;
  default_shelf_life_days: number | null;
  track_expiration: boolean;
  preferred_supplier_id: string | null;
  supplier_sku: string | null;
  image_url: string | null;
  allergens: string[];
  is_active: boolean;
  is_trackable: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Relations
  category?: InventoryCategory;
  batches?: InventoryBatch[];
  preferred_supplier?: InventorySupplier;
}

// ======================
// INVENTORY BATCH
// ======================
export interface InventoryBatch {
  id: string;
  tenant_id: string;
  branch_id: string;
  item_id: string;
  batch_number: string | null;
  lot_number: string | null;
  initial_quantity: number;
  current_quantity: number;
  reserved_quantity: number;
  unit_cost: number;
  total_cost: number;
  received_at: string;
  expiration_date: string | null;
  manufactured_date: string | null;
  supplier_id: string | null;
  purchase_order_id: string | null;
  invoice_number: string | null;
  status: BatchStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Relations
  item?: InventoryItem;
  supplier?: InventorySupplier;
}

// ======================
// INVENTORY MOVEMENT
// ======================
export interface InventoryMovement {
  id: string;
  tenant_id: string;
  branch_id: string;
  item_id: string;
  batch_id: string | null;
  movement_type: MovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  unit_cost: number | null;
  total_cost: number | null;
  reference_type: string | null;
  reference_id: string | null;
  performed_by: string | null;
  staff_id: string | null;
  reason: string | null;
  notes: string | null;
  performed_at: string;
  metadata: Record<string, unknown>;
  // Relations
  item?: InventoryItem;
  batch?: InventoryBatch;
}

// ======================
// SUPPLIER
// ======================
export interface InventorySupplier {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  tax_id: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  whatsapp: string | null; // WhatsApp number for notifications (critical)
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  payment_terms: string | null;
  credit_limit: number | null;
  currency: string;
  categories: string[];
  supplied_item_ids: string[]; // IDs of inventory items this supplier provides
  delivery_branch_ids: string[]; // IDs of branches this supplier delivers to
  rating: number | null;
  notes: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Relations (populated when needed)
  supplied_items?: InventoryItem[];
  delivery_branches?: { id: string; name: string }[];
}

// ======================
// RECIPE
// ======================
export interface MenuItemRecipe {
  id: string;
  tenant_id: string;
  menu_item_id: string;
  yield_quantity: number;
  yield_unit: string;
  total_cost: number;
  cost_per_portion: number;
  is_active: boolean;
  preparation_notes: string | null;
  storage_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Relations
  ingredients?: RecipeIngredient[];
  menu_item?: { id: string; name: string; price: number };
}

export interface RecipeIngredient {
  id: string;
  tenant_id: string;
  recipe_id: string;
  inventory_item_id: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  preparation_notes: string | null;
  is_optional: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  // Relations
  inventory_item?: InventoryItem;
}

// ======================
// INVENTORY COUNT
// ======================
export interface InventoryCount {
  id: string;
  tenant_id: string;
  branch_id: string;
  count_number: string | null;
  count_date: string;
  count_type: CountType;
  categories: string[];
  status: CountStatus;
  counted_by: string | null;
  approved_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  approved_at: string | null;
  total_items: number;
  items_with_variance: number;
  total_variance_value: number;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Relations
  count_items?: InventoryCountItem[];
}

export interface InventoryCountItem {
  id: string;
  tenant_id: string;
  count_id: string;
  item_id: string;
  expected_quantity: number;
  counted_quantity: number | null;
  variance: number | null;
  unit_cost: number | null;
  variance_value: number | null;
  notes: string | null;
  counted_at: string | null;
  metadata: Record<string, unknown>;
  // Relations
  item?: InventoryItem;
}

// ======================
// FORM DATA
// ======================
export interface CategoryFormData {
  name: string;
  slug?: string;
  description?: string;
  parent_id?: string | null;
  icon?: string;
  color?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface ItemFormData {
  sku?: string;
  name: string;
  description?: string;
  category_id?: string;
  item_type?: ItemType;
  unit: string;
  unit_cost?: number;
  minimum_stock?: number;
  maximum_stock?: number;
  reorder_quantity?: number;
  storage_location?: string;
  storage_type?: StorageType;
  is_perishable?: boolean;
  default_shelf_life_days?: number;
  track_expiration?: boolean;
  preferred_supplier_id?: string;
  image_url?: string;
  allergens?: string[];
  is_active?: boolean;
}

export interface BatchFormData {
  item_id: string;
  batch_number?: string;
  lot_number?: string;
  initial_quantity: number;
  unit_cost: number;
  expiration_date?: string;
  manufactured_date?: string;
  supplier_id?: string;
  invoice_number?: string;
  notes?: string;
}

export interface MovementFormData {
  item_id: string;
  batch_id?: string;
  movement_type: MovementType;
  quantity: number;
  unit_cost?: number;
  reference_type?: string;
  reference_id?: string;
  reason?: string;
  notes?: string;
}

export interface SupplierFormData {
  name: string;
  code?: string;
  tax_id?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  whatsapp?: string; // WhatsApp number for notifications (critical)
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  payment_terms?: string;
  credit_limit?: number;
  currency?: string;
  categories?: string[];
  supplied_item_ids?: string[]; // IDs of inventory items this supplier provides
  delivery_branch_ids?: string[]; // IDs of branches this supplier delivers to
  rating?: number;
  notes?: string;
  is_active?: boolean;
}

// ======================
// STATS
// ======================
export interface InventoryStats {
  total_items: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  expiring_soon_count: number;
  categories_count: number;
  suppliers_count: number;
  movements_today: number;
  value_by_category: Array<{
    category_id: string;
    category_name: string;
    value: number;
    items_count: number;
  }>;
  low_stock_items: Array<{
    id: string;
    name: string;
    current_stock: number;
    minimum_stock: number;
    unit: string;
  }>;
  expiring_batches: Array<{
    batch_id: string;
    item_name: string;
    expiration_date: string;
    days_until_expiration: number;
    quantity: number;
  }>;
}

// ======================
// API RESPONSES
// ======================
export interface ItemsResponse {
  success: boolean;
  data: InventoryItem[];
  error?: string;
}

export interface ItemResponse {
  success: boolean;
  data: InventoryItem;
  error?: string;
}

export interface CategoriesResponse {
  success: boolean;
  data: InventoryCategory[];
  error?: string;
}

export interface SuppliersResponse {
  success: boolean;
  data: InventorySupplier[];
  error?: string;
}

export interface StatsResponse {
  success: boolean;
  data: InventoryStats;
  error?: string;
}

// ======================
// CONFIGURATION
// ======================
export const ITEM_TYPE_CONFIG: Record<ItemType, { label: string; icon: string; color: string }> = {
  ingredient: { label: 'Ingrediente', icon: 'Carrot', color: 'bg-green-500' },
  supply: { label: 'Suministro', icon: 'Package', color: 'bg-blue-500' },
  equipment: { label: 'Equipo', icon: 'Wrench', color: 'bg-slate-500' },
  packaging: { label: 'Empaque', icon: 'Box', color: 'bg-amber-500' },
};

export const STORAGE_TYPE_CONFIG: Record<StorageType, { label: string; icon: string; color: string }> = {
  dry: { label: 'Almacén seco', icon: 'Warehouse', color: 'bg-amber-100 text-amber-700' },
  refrigerated: { label: 'Refrigerado', icon: 'Thermometer', color: 'bg-blue-100 text-blue-700' },
  frozen: { label: 'Congelado', icon: 'Snowflake', color: 'bg-cyan-100 text-cyan-700' },
  ambient: { label: 'Ambiente', icon: 'Sun', color: 'bg-slate-100 text-slate-700' },
};

export const MOVEMENT_TYPE_CONFIG: Record<MovementType, { label: string; icon: string; isPositive: boolean }> = {
  purchase: { label: 'Compra', icon: 'ShoppingCart', isPositive: true },
  sale: { label: 'Venta', icon: 'DollarSign', isPositive: false },
  consumption: { label: 'Consumo', icon: 'Utensils', isPositive: false },
  waste: { label: 'Merma', icon: 'Trash', isPositive: false },
  adjustment: { label: 'Ajuste', icon: 'Edit', isPositive: true },
  transfer_in: { label: 'Entrada', icon: 'ArrowDownCircle', isPositive: true },
  transfer_out: { label: 'Salida', icon: 'ArrowUpCircle', isPositive: false },
  return: { label: 'Devolución', icon: 'RotateCcw', isPositive: true },
  production: { label: 'Producción', icon: 'ChefHat', isPositive: false },
};

export const COUNT_STATUS_CONFIG: Record<CountStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Borrador', color: 'text-slate-700', bgColor: 'bg-slate-100' },
  in_progress: { label: 'En progreso', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  completed: { label: 'Completado', color: 'text-green-700', bgColor: 'bg-green-100' },
  approved: { label: 'Aprobado', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  cancelled: { label: 'Cancelado', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export const UNIT_OPTIONS = [
  { value: 'unit', label: 'Unidad' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'g', label: 'Gramo' },
  { value: 'l', label: 'Litro' },
  { value: 'ml', label: 'Mililitro' },
  { value: 'box', label: 'Caja' },
  { value: 'pack', label: 'Paquete' },
  { value: 'bag', label: 'Bolsa' },
  { value: 'bottle', label: 'Botella' },
  { value: 'can', label: 'Lata' },
  { value: 'dozen', label: 'Docena' },
];

// ======================
// RESTOCK ORDERS - ENUMS
// ======================
export type RestockOrderStatus =
  | 'draft'
  | 'pending'
  | 'authorized'
  | 'placed'
  | 'partial'
  | 'received'
  | 'cancelled';

export type LowStockAlertType = 'warning' | 'critical';

export type LowStockAlertStatus = 'open' | 'acknowledged' | 'ordered' | 'resolved';

// ======================
// RESTOCK ORDER
// ======================
export interface RestockOrder {
  id: string;
  tenant_id: string;
  branch_id: string;
  supplier_id: string;
  order_number: string;
  status: RestockOrderStatus;
  trigger_source: 'auto' | 'manual' | 'alert';
  triggered_by_alert_ids: string[];
  created_by: string | null;
  authorized_by: string | null;
  authorized_at: string | null;
  whatsapp_sent: boolean;
  whatsapp_sent_at: string | null;
  whatsapp_message_id: string | null;
  supplier_confirmation: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  received_by: string | null;
  received_at: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  internal_notes: string | null;
  supplier_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Relations
  supplier?: InventorySupplier;
  branch?: { id: string; name: string };
  items?: RestockOrderItem[];
  created_by_user?: { id: string; email: string };
  authorized_by_user?: { id: string; email: string };
}

// ======================
// RESTOCK ORDER ITEM
// ======================
export interface RestockOrderItem {
  id: string;
  tenant_id: string;
  restock_order_id: string;
  inventory_item_id: string;
  quantity_requested: number;
  quantity_received: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  status: 'pending' | 'partial' | 'received' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  inventory_item?: InventoryItem;
}

// ======================
// LOW STOCK ALERT
// ======================
export interface LowStockAlert {
  id: string;
  tenant_id: string;
  branch_id: string;
  item_id: string;
  alert_type: LowStockAlertType;
  status: LowStockAlertStatus;
  current_stock: number;
  minimum_stock: number;
  deficit_quantity: number;
  suggested_supplier_id: string | null;
  suggested_quantity: number | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  associated_order_id: string | null;
  auto_created_order: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Relations
  item?: InventoryItem;
  branch?: { id: string; name: string };
  suggested_supplier?: InventorySupplier;
  associated_order?: RestockOrder;
}

// ======================
// RESTOCK NOTIFICATION PREFERENCES
// ======================
export interface RestockNotificationPreferences {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  warning_threshold_percent: number;
  critical_threshold_percent: number;
  notify_via_app: boolean;
  notify_via_email: boolean;
  notify_via_whatsapp: boolean;
  manager_emails: string[];
  auto_create_alerts: boolean;
  auto_create_orders: boolean;
  auto_send_to_supplier: boolean;
  check_frequency_hours: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ======================
// RESTOCK FORM DATA
// ======================
export interface RestockOrderFormData {
  supplier_id: string;
  branch_id: string;
  trigger_source?: 'auto' | 'manual' | 'alert';
  triggered_by_alert_ids?: string[];
  expected_delivery_date?: string;
  internal_notes?: string;
  supplier_notes?: string;
  items: Array<{
    inventory_item_id: string;
    quantity_requested: number;
    unit: string;
    unit_cost: number;
    notes?: string;
  }>;
}

export interface LowStockAlertFormData {
  item_id: string;
  branch_id: string;
  alert_type?: LowStockAlertType;
  suggested_supplier_id?: string;
  suggested_quantity?: number;
}

export interface RestockPreferencesFormData {
  branch_id?: string;
  warning_threshold_percent?: number;
  critical_threshold_percent?: number;
  notify_via_app?: boolean;
  notify_via_email?: boolean;
  notify_via_whatsapp?: boolean;
  manager_emails?: string[];
  auto_create_alerts?: boolean;
  auto_create_orders?: boolean;
  auto_send_to_supplier?: boolean;
  check_frequency_hours?: number;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

// ======================
// RESTOCK API RESPONSES
// ======================
export interface RestockOrdersResponse {
  success: boolean;
  data: RestockOrder[];
  error?: string;
}

export interface RestockOrderResponse {
  success: boolean;
  data: RestockOrder;
  error?: string;
}

export interface LowStockAlertsResponse {
  success: boolean;
  data: LowStockAlert[];
  error?: string;
}

export interface LowStockAlertResponse {
  success: boolean;
  data: LowStockAlert;
  error?: string;
}

export interface RestockPreferencesResponse {
  success: boolean;
  data: RestockNotificationPreferences;
  error?: string;
}

// ======================
// RESTOCK DASHBOARD STATS
// ======================
export interface RestockDashboardStats {
  open_alerts_count: number;
  pending_orders_count: number;
  orders_this_month: number;
  total_spent_this_month: number;
  critical_items: Array<{
    item_id: string;
    item_name: string;
    current_stock: number;
    minimum_stock: number;
    unit: string;
  }>;
}

// ======================
// RESTOCK STATUS CONFIG
// ======================
export const RESTOCK_ORDER_STATUS_CONFIG: Record<RestockOrderStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  draft: { label: 'Borrador', color: 'text-slate-600', bgColor: 'bg-slate-100', icon: 'FileEdit' },
  pending: { label: 'Pendiente', color: 'text-amber-600', bgColor: 'bg-amber-100', icon: 'Clock' },
  authorized: { label: 'Autorizado', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: 'CheckCircle' },
  placed: { label: 'Enviado', color: 'text-purple-600', bgColor: 'bg-purple-100', icon: 'Send' },
  partial: { label: 'Parcial', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: 'PackageCheck' },
  received: { label: 'Recibido', color: 'text-emerald-600', bgColor: 'bg-emerald-100', icon: 'CheckCheck' },
  cancelled: { label: 'Cancelado', color: 'text-red-600', bgColor: 'bg-red-100', icon: 'XCircle' },
};

export const LOW_STOCK_ALERT_TYPE_CONFIG: Record<LowStockAlertType, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  warning: { label: 'Advertencia', color: 'text-amber-600', bgColor: 'bg-amber-100', icon: 'AlertTriangle' },
  critical: { label: 'Critico', color: 'text-red-600', bgColor: 'bg-red-100', icon: 'AlertOctagon' },
};

export const LOW_STOCK_ALERT_STATUS_CONFIG: Record<LowStockAlertStatus, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  open: { label: 'Abierta', color: 'text-red-600', bgColor: 'bg-red-100' },
  acknowledged: { label: 'Vista', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  ordered: { label: 'Ordenado', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  resolved: { label: 'Resuelta', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
};

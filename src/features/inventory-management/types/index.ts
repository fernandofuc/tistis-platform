// =====================================================
// TIS TIS PLATFORM - Inventory Management Types
// Frontend type definitions for Inventory Management System
// =====================================================

// ========================================
// BACKEND ENTITY TYPES (from FASE 3)
// ========================================

/**
 * Inventory Item entity (maps to inventory_items table)
 */
export interface InventoryItem {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  category_id: string | null;

  // Identification
  sku: string | null;
  name: string;
  description: string | null;

  // Type
  item_type: 'ingredient' | 'supply' | 'equipment' | 'packaging';

  // Units
  unit: string; // kg, g, l, ml, unit, box, etc
  unit_cost: number;
  currency: string;

  // Stock
  current_stock: number;
  minimum_stock: number;
  maximum_stock: number | null;
  reorder_quantity: number | null;

  // Storage
  storage_location: string | null;
  storage_type: 'dry' | 'refrigerated' | 'frozen' | 'ambient';

  // Expiration
  is_perishable: boolean;
  default_shelf_life_days: number | null;
  track_expiration: boolean;

  // Supplier
  preferred_supplier_id: string | null;
  supplier_sku: string | null;

  // Images
  image_url: string | null;

  // Allergens
  allergens: string[];

  // Status
  is_active: boolean;
  is_trackable: boolean;

  // Metadata
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Menu Item Recipe entity (maps to menu_item_recipes table)
 */
export interface MenuItemRecipe {
  id: string;
  tenant_id: string;
  menu_item_id: string;

  // Yield
  yield_quantity: number;
  yield_unit: string;

  // Cost
  total_cost: number;
  cost_per_portion: number;

  // Status
  is_active: boolean;

  // Notes
  preparation_notes: string | null;
  storage_notes: string | null;

  // Metadata
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Recipe Ingredient entity (maps to recipe_ingredients table)
 */
export interface RecipeIngredient {
  id: string;
  tenant_id: string;
  recipe_id: string;
  inventory_item_id: string;

  // Quantity
  quantity: number;
  unit: string;

  // Cost
  unit_cost: number;
  total_cost: number;

  // Notes
  preparation_notes: string | null;
  is_optional: boolean;

  // Display
  display_order: number;

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Inventory Movement entity (maps to inventory_movements table)
 */
export interface InventoryMovement {
  id: string;
  tenant_id: string;
  branch_id: string;
  item_id: string;
  batch_id: string | null;

  // Movement type
  movement_type: MovementType;

  // Quantities
  quantity: number; // Positive = entrada, Negative = salida
  previous_stock: number;
  new_stock: number;

  // Cost
  unit_cost: number | null;
  total_cost: number | null;

  // References
  reference_type: string | null;
  reference_id: string | null;

  // Responsible
  performed_by: string | null;
  staff_id: string | null;

  // Notes
  reason: string | null;
  notes: string | null;

  // Timestamp
  performed_at: string;

  // Metadata
  metadata: Record<string, unknown>;
}

/**
 * Movement types
 */
export type MovementType =
  | 'purchase'      // Compra/Recepción
  | 'sale'          // Venta
  | 'consumption'   // Consumo en producción (recipe deduction)
  | 'waste'         // Merma/Desperdicio
  | 'adjustment'    // Ajuste de inventario
  | 'transfer_in'   // Transferencia entrante
  | 'transfer_out'  // Transferencia saliente
  | 'return'        // Devolución
  | 'production';   // Producción

// ========================================
// FRONTEND DISPLAY TYPES
// ========================================

/**
 * Stock status (computed from current_stock vs minimum_stock)
 */
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstocked';

/**
 * Alert severity (from low stock alert system)
 */
export type AlertSeverity = 'critical' | 'warning' | 'low';

/**
 * Inventory Item with computed display fields
 */
export interface InventoryItemDisplay extends InventoryItem {
  // Computed fields
  stockStatus: StockStatus;
  stockPercentage: number; // (current / minimum) * 100
  stockValue: number; // current_stock * unit_cost
  daysUntilReorder: number | null; // Estimated based on consumption rate

  // Formatted fields for display
  formattedStock: string; // "10.5 kg"
  formattedCost: string; // "$150.00 MXN"
  formattedValue: string; // "$1,575.00 MXN"
  formattedLastUpdated: string; // "hace 2 horas"

  // UI state
  isSelected?: boolean;
  isExpanded?: boolean;
  isEditing?: boolean;

  // Relations (optional, loaded on demand)
  category?: InventoryCategory;
  supplier?: Supplier;
  recentMovements?: InventoryMovement[];
}

/**
 * Recipe with computed fields
 */
export interface RecipeDisplay extends MenuItemRecipe {
  // Computed fields
  ingredientCount: number;
  totalIngredientCost: number;
  profitMargin: number; // Percentage

  // Formatted fields
  formattedYield: string; // "4 porciones"
  formattedTotalCost: string; // "$50.00 MXN"
  formattedCostPerPortion: string; // "$12.50 MXN"

  // Relations
  menuItemName?: string;
  ingredients?: RecipeIngredientDisplay[];

  // UI state
  isExpanded?: boolean;
  isEditing?: boolean;
}

/**
 * Recipe Ingredient with display fields
 */
export interface RecipeIngredientDisplay extends RecipeIngredient {
  // Related data
  itemName: string;
  itemUnit: string;
  currentStock: number;
  minimumStock: number;

  // Computed fields
  isInStock: boolean;
  canFulfill: boolean; // currentStock >= quantity

  // Formatted fields
  formattedQuantity: string; // "2.5 kg"
  formattedCost: string; // "$25.00 MXN"

  // UI state
  isSelected?: boolean;
}

/**
 * Movement with display fields
 */
export interface MovementDisplay extends InventoryMovement {
  // Related data
  itemName: string;
  itemUnit: string;
  performedByName: string | null;

  // Computed fields
  isInbound: boolean; // quantity > 0
  impactAmount: number; // Math.abs(quantity)

  // Formatted fields
  formattedQuantity: string; // "+10.5 kg" or "-5.0 kg"
  formattedCost: string; // "$150.00 MXN"
  formattedDate: string; // "22 Ene 2026, 3:45 PM"
  formattedTimeAgo: string; // "hace 2 horas"

  // UI state
  isHighlighted?: boolean;
}

/**
 * Recipe Deduction Preview (for previewDeduction method)
 */
export interface RecipeDeductionPreview {
  recipeId: string;
  menuItemName: string;
  quantitySold: number;
  deductions: Array<{
    inventoryItemId: string;
    itemName: string;
    requiredQuantity: number;
    currentStock: number;
    newStock: number;
    unit: string;
    canFulfill: boolean;
    shortfall: number;
  }>;
  canFulfillAll: boolean;
  totalCost: number;
  formattedTotalCost: string;
}

/**
 * Low Stock Alert
 */
export interface LowStockAlert {
  id: string;
  tenant_id: string;
  branch_id: string;
  item_id: string;
  item_name: string;
  sku: string | null;
  current_stock: number;
  minimum_stock: number;
  reorder_quantity: number | null;
  unit: string;
  percentageRemaining: number;
  severity: AlertSeverity;
  status: 'active' | 'resolved';
  created_at: string;
  resolved_at: string | null;

  // Formatted fields
  formattedStock: string; // "5 kg / 20 kg mínimo"
  formattedTimeActive: string; // "2 horas"

  // UI state
  isDismissed?: boolean;
}

// ========================================
// CATEGORY & SUPPLIER TYPES
// ========================================

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
}

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  payment_terms: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ========================================
// FORM DATA TYPES
// ========================================

export interface InventoryItemFormData {
  // Required
  name: string;
  item_type: 'ingredient' | 'supply' | 'equipment' | 'packaging';
  unit: string;
  unit_cost: number;
  current_stock: number;
  minimum_stock: number;

  // Optional
  sku?: string;
  description?: string;
  category_id?: string;
  maximum_stock?: number;
  reorder_quantity?: number;
  storage_location?: string;
  storage_type?: 'dry' | 'refrigerated' | 'frozen' | 'ambient';
  is_perishable?: boolean;
  default_shelf_life_days?: number;
  track_expiration?: boolean;
  preferred_supplier_id?: string;
  supplier_sku?: string;
  image_url?: string;
  allergens?: string[];
  is_active?: boolean;
  is_trackable?: boolean;
}

export interface RecipeFormData {
  menu_item_id: string;
  yield_quantity: number;
  yield_unit: string;
  preparation_notes?: string;
  storage_notes?: string;
  is_active?: boolean;
  ingredients: RecipeIngredientFormData[];
}

export interface RecipeIngredientFormData {
  inventory_item_id: string;
  quantity: number;
  unit: string;
  preparation_notes?: string;
  is_optional?: boolean;
  display_order: number;
}

export interface MovementFormData {
  item_id: string;
  movement_type: MovementType;
  quantity: number;
  unit_cost?: number;
  reason?: string;
  notes?: string;
  performed_by?: string;
}

export interface BulkAdjustmentFormData {
  items: Array<{
    item_id: string;
    quantity: number;
    reason: string;
  }>;
  performed_by: string;
  notes?: string;
}

// ========================================
// QUERY & FILTER TYPES
// ========================================

export interface InventoryFilters {
  search?: string;
  item_type?: 'ingredient' | 'supply' | 'equipment' | 'packaging';
  category_id?: string;
  stock_status?: StockStatus;
  storage_type?: 'dry' | 'refrigerated' | 'frozen' | 'ambient';
  is_active?: boolean;
  is_trackable?: boolean;
  branch_id?: string;
  sort_by?: 'name' | 'current_stock' | 'unit_cost' | 'updated_at';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface MovementFilters {
  item_id?: string;
  movement_type?: MovementType;
  start_date?: string;
  end_date?: string;
  performed_by?: string;
  branch_id?: string;
  page?: number;
  limit?: number;
}

export interface RecipeFilters {
  menu_item_id?: string;
  search?: string;
  is_active?: boolean;
  has_low_stock_ingredients?: boolean;
  min_cost?: number;
  max_cost?: number;
  page?: number;
  limit?: number;
}

export interface AlertFilters {
  severity?: AlertSeverity;
  status?: 'active' | 'resolved';
  item_type?: 'ingredient' | 'supply' | 'equipment' | 'packaging';
  branch_id?: string;
  category_id?: string;
}

// ========================================
// API RESPONSE TYPES
// ========================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };
  error?: string;
}

export interface InventoryItemsResponse extends PaginatedResponse<InventoryItemDisplay> {}
export interface RecipesResponse extends PaginatedResponse<RecipeDisplay> {}
export interface MovementsResponse extends PaginatedResponse<MovementDisplay> {}
export interface AlertsResponse extends ApiResponse<LowStockAlert[]> {}

// ========================================
// STATS & ANALYTICS TYPES
// ========================================

export interface InventoryStats {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  criticalAlerts: number;
  averageStockLevel: number;

  // By type
  byItemType: Record<'ingredient' | 'supply' | 'equipment' | 'packaging', {
    count: number;
    value: number;
  }>;

  // By storage
  byStorageType: Record<'dry' | 'refrigerated' | 'frozen' | 'ambient', {
    count: number;
    value: number;
  }>;

  // Trends
  consumption: {
    daily: number;
    weekly: number;
    monthly: number;
  };

  // Top items
  topByValue: Array<{
    id: string;
    name: string;
    value: number;
  }>;

  topByMovement: Array<{
    id: string;
    name: string;
    movementCount: number;
  }>;
}

export interface MovementStats {
  totalMovements: number;
  totalInbound: number;
  totalOutbound: number;
  netChange: number;

  // By type
  byType: Record<MovementType, {
    count: number;
    totalQuantity: number;
    totalCost: number;
  }>;

  // By day
  byDay: Array<{
    date: string;
    inbound: number;
    outbound: number;
    net: number;
  }>;
}

// ========================================
// HOOK RETURN TYPES
// ========================================

export interface UseInventoryReturn {
  // State
  items: InventoryItemDisplay[];
  selectedItem: InventoryItemDisplay | null;
  loading: boolean;
  error: string | null;
  stats: {
    total: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
    overstocked: number;
    totalValue: number;
  };
  filters: InventoryFilters;

  // Queries
  fetchItems: (filters?: InventoryFilters) => Promise<void>;
  getItem: (id: string) => Promise<InventoryItemDisplay | null>;
  refreshItem: (id: string) => Promise<void>;

  // Mutations
  createItem: (data: InventoryItemFormData) => Promise<InventoryItemDisplay>;
  updateItem: (id: string, data: Partial<InventoryItemFormData>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;

  // Selection
  selectItem: (id: string | null) => void;

  // Filters
  updateFilters: (newFilters: Partial<InventoryFilters>) => void;
  clearFilters: () => void;
}

export interface UseRecipesReturn {
  recipes: RecipeDisplay[];
  selectedRecipe: RecipeDisplay | null;
  loading: boolean;
  error: string | null;

  fetchRecipes: (filters?: RecipeFilters) => Promise<void>;
  getRecipe: (id: string) => Promise<RecipeDisplay | null>;
  createRecipe: (data: RecipeFormData) => Promise<RecipeDisplay>;
  updateRecipe: (id: string, data: Partial<RecipeFormData>) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  selectRecipe: (id: string | null) => void;
  previewDeduction: (recipeId: string, quantitySold: number) => Promise<RecipeDeductionPreview>;
}

export interface UseMovementsReturn {
  movements: MovementDisplay[];
  stats: MovementStats | null;
  loading: boolean;
  error: string | null;

  fetchMovements: (filters?: MovementFilters) => Promise<void>;
  fetchStats: (filters?: MovementFilters) => Promise<void>;
  recordMovement: (data: MovementFormData) => Promise<void>;
  bulkAdjustment: (data: BulkAdjustmentFormData) => Promise<void>;
}

export interface UseLowStockAlertsReturn {
  alerts: LowStockAlert[];
  criticalCount: number;
  warningCount: number;
  lowCount: number;
  loading: boolean;
  error: string | null;

  fetchAlerts: (filters?: AlertFilters) => Promise<void>;
  dismissAlert: (id: string) => Promise<void>;
  resolveAlert: (id: string) => Promise<void>;
  refreshAlerts: () => Promise<void>;
}

export interface UseInventoryStatsReturn {
  stats: InventoryStats | null;
  loading: boolean;
  error: string | null;

  fetchStats: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

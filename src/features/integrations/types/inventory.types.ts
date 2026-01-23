// =====================================================
// TIS TIS PLATFORM - Inventory & Recipe Types
// Type definitions for inventory management and recipe deduction
// =====================================================

import type { SupabaseClient } from '@supabase/supabase-js';

// ========================================
// DATABASE ENTITY TYPES
// ========================================

/**
 * Inventory Item entity (maps to inventory_items table)
 */
export interface InventoryItemEntity {
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
export interface MenuItemRecipeEntity {
  id: string;
  tenant_id: string;
  menu_item_id: string;

  // Yield
  yield_quantity: number; // How many portions this recipe produces
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
export interface RecipeIngredientEntity {
  id: string;
  tenant_id: string;
  recipe_id: string;
  inventory_item_id: string;

  // Quantity
  quantity: number; // Per portion
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
export interface InventoryMovementEntity {
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
  reference_type: string | null; // sr_sale, restaurant_order, etc
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
// RECIPE DEDUCTION TYPES
// ========================================

/**
 * Recipe with ingredients (expanded from DB)
 */
export interface RecipeWithIngredients {
  recipe: MenuItemRecipeEntity;
  ingredients: RecipeIngredientWithStock[];
}

/**
 * Recipe ingredient with current stock info
 */
export interface RecipeIngredientWithStock extends RecipeIngredientEntity {
  ingredient_name: string;
  current_stock: number;
  minimum_stock: number;
  unit: string;
}

/**
 * Parameters for deducing a single menu item
 */
export interface DeduceMenuItemParams {
  supabase: SupabaseClient;
  tenantId: string;
  branchId: string;
  menuItemId: string;
  quantitySold: number;
  saleId: string;
  allowNegativeStock?: boolean;
}

/**
 * Parameters for deducing entire sale
 */
export interface DeduceSaleParams {
  supabase: SupabaseClient;
  saleId: string;
  allowNegativeStock?: boolean;
}

/**
 * Parameters for deduction preview (dry run)
 */
export interface DeductionPreviewParams {
  supabase: SupabaseClient;
  tenantId: string;
  branchId: string;
  menuItemId: string;
  quantitySold: number;
}

/**
 * Result of deducing a single menu item
 */
export interface DeductionResult {
  success: boolean;
  menuItemId: string;
  menuItemName: string;
  ingredientsProcessed: number;
  ingredientsDeducted: number;
  totalCostDeducted: number;
  movements: InventoryMovementEntity[];
  errors: string[];
  warnings: string[];
}

/**
 * Result of deducing entire sale
 */
export interface SaleDeductionResult {
  success: boolean;
  saleId: string;
  itemsProcessed: number;
  itemsDeducted: number;
  totalIngredientsDeducted: number;
  totalCostDeducted: number;
  movements: InventoryMovementEntity[];
  errors: string[];
  warnings: string[];
  itemResults: DeductionResult[];
}

/**
 * Preview of what would be deducted (without applying changes)
 */
export interface DeductionPreview {
  menuItemId: string;
  menuItemName: string;
  recipeId: string;
  recipeName: string;
  yieldQuantity: number;
  scaleFactor: number;
  ingredients: Array<{
    ingredientId: string;
    ingredientName: string;
    quantityRequired: number;
    unit: string;
    currentStock: number;
    newStock: number;
    unitCost: number;
    totalCost: number;
    isLowStock: boolean;
    willBeNegative: boolean;
    wastePercentage: number;
  }>;
  totalCost: number;
  hasErrors: boolean;
  errors: string[];
  warnings: string[];
}

// ========================================
// INVENTORY MOVEMENT SERVICE TYPES
// ========================================

/**
 * Parameters for recording a deduction movement
 */
export interface RecordDeductionParams {
  supabase: SupabaseClient;
  tenantId: string;
  branchId: string;
  itemId: string;
  quantity: number; // Will be made negative
  previousStock: number;
  newStock: number;
  unitCost: number;
  referenceType: 'sr_sale' | 'restaurant_order';
  referenceId: string;
  notes?: string;
  performedBy?: string;
}

/**
 * Parameters for recording an adjustment movement
 */
export interface RecordAdjustmentParams {
  supabase: SupabaseClient;
  tenantId: string;
  branchId: string;
  itemId: string;
  quantity: number;
  reason: string;
  notes?: string;
  performedBy: string;
}

/**
 * Parameters for querying movement history
 */
export interface GetMovementHistoryParams {
  supabase: SupabaseClient;
  tenantId: string;
  branchId?: string;
  itemId?: string;
  startDate?: string;
  endDate?: string;
  movementType?: MovementType;
  limit?: number;
  offset?: number;
}

/**
 * Movement history result
 */
export interface MovementHistoryResult {
  movements: InventoryMovementEntity[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ========================================
// LOW STOCK ALERT TYPES
// ========================================

/**
 * Low stock item info
 */
export interface LowStockItem {
  itemId: string;
  itemName: string;
  sku: string | null;
  currentStock: number;
  minimumStock: number;
  reorderQuantity: number | null;
  unit: string;
  percentageRemaining: number; // (current / minimum) * 100
  severity: 'critical' | 'warning' | 'low'; // <50% critical, <75% warning, <100% low
}

/**
 * Parameters for checking low stock after deduction
 */
export interface CheckAfterDeductionParams {
  supabase: SupabaseClient;
  tenantId: string;
  branchId: string;
  itemIds: string[];
}

/**
 * Parameters for checking all inventory
 */
export interface CheckAllInventoryParams {
  supabase: SupabaseClient;
  tenantId: string;
  branchId: string;
}

/**
 * Parameters for creating low stock alert
 */
export interface CreateLowStockAlertParams {
  supabase: SupabaseClient;
  tenantId: string;
  branchId: string;
  itemId: string;
  currentStock: number;
  minimumStock: number;
}

/**
 * Parameters for getting active alerts
 */
export interface GetActiveAlertsParams {
  supabase: SupabaseClient;
  tenantId: string;
  branchId?: string;
}

/**
 * Low stock check result
 */
export interface LowStockCheckResult {
  itemsChecked: number;
  lowStockItems: LowStockItem[];
  alertsCreated: number;
  criticalCount: number;
  warningCount: number;
  lowCount: number;
}

/**
 * Low stock alert (for notifications table or logs)
 */
export interface LowStockAlert {
  id: string;
  tenant_id: string;
  branch_id: string;
  item_id: string;
  item_name: string;
  current_stock: number;
  minimum_stock: number;
  severity: 'critical' | 'warning' | 'low';
  status: 'active' | 'resolved';
  created_at: string;
  resolved_at: string | null;
}

// ========================================
// HELPER TYPES
// ========================================

/**
 * Stock validation result
 */
export interface StockValidation {
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Ingredient deduction calculation
 */
export interface IngredientDeduction {
  ingredientId: string;
  ingredientName: string;
  baseQuantity: number;
  wasteMultiplier: number;
  actualQuantity: number;
  currentStock: number;
  newStock: number;
  unitCost: number;
  totalCost: number;
  isLowStock: boolean;
  willBeNegative: boolean;
}

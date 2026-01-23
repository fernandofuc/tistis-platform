// =====================================================
// TIS TIS PLATFORM - SoftRestaurant Integration Types
// Type definitions for SR webhook processing and data transformation
// =====================================================

import type { SRWebhookSale, SRWebhookSaleItem, SRWebhookPayment } from './integration.types';

// ========================================
// DATABASE ENTITY TYPES (TIS TIS Database)
// ========================================

/**
 * SR Sale entity (maps to sr_sales table)
 */
export interface SRSaleEntity {
  id?: string;
  tenant_id: string;
  branch_id: string;
  integration_id: string;

  // SR identifiers
  folio_venta: string;
  store_code: string | null;
  customer_code: string | null;

  // Table and server
  table_number: string | null;
  user_code: string | null;

  // Timing
  opened_at: string;
  closed_at: string | null;

  // Totals
  subtotal_without_tax: number;
  total_tax: number;
  total_discounts: number;
  total_tips: number;
  total: number;
  currency: string;

  // Guest info
  guest_count: number | null;

  // Sale type
  sale_type: string | null;

  // Notes
  notes: string | null;

  // Processing status
  status: 'pending' | 'processed' | 'failed' | 'duplicate';
  processed_at: string | null;
  restaurant_order_id: string | null;

  // Error tracking
  error_message: string | null;
  retry_count: number;

  // Metadata
  raw_payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

/**
 * SR Sale Item entity (maps to sr_sale_items table)
 */
export interface SRSaleItemEntity {
  id?: string;
  sale_id: string;
  tenant_id: string;
  branch_id: string;

  // Product identification
  product_code: string;
  product_name: string;

  // Quantities and pricing
  quantity: number;
  unit_price: number;
  subtotal_without_tax: number;
  discount_amount: number;
  tax_amount: number;
  // total_amount is GENERATED COLUMN

  // Tax details (JSONB)
  tax_details: {
    Impuestos?: Array<{
      CodigoImpuesto: string;
      NombreImpuesto: string;
      Tasa: number;
      Importe: number;
    }>;
  } | null;

  // Modifications
  modifiers: string[] | null;
  notes: string | null;

  // Server tracking
  user_code: string | null;

  // Timing
  item_timestamp: string | null;

  // Mapping to TIS TIS
  mapped_menu_item_id: string | null;
}

/**
 * SR Payment entity (maps to sr_payments table)
 */
export interface SRPaymentEntity {
  id?: string;
  sale_id: string;
  tenant_id: string;
  branch_id: string;

  // Payment details
  payment_method: string;
  amount: number;
  currency: string;

  // References
  payment_reference: string | null;
  card_last_four: string | null;

  // Tips
  tip_amount: number;

  // Timing
  payment_timestamp: string | null;
}

/**
 * SR Product Mapping entity (maps to sr_product_mappings table)
 */
export interface SRProductMappingEntity {
  id?: string;
  tenant_id: string;
  branch_id: string;
  integration_id: string;

  // SR Product
  sr_product_code: string;
  sr_product_name: string;

  // TIS TIS Menu Item (nullable for unmapped products)
  menu_item_id: string | null;

  // Mapping status
  mapping_confidence: 'high' | 'medium' | 'low' | 'manual';
  is_active: boolean;

  // Stats
  times_sold: number;
  last_sold_at: string | null;

  // Metadata
  notes: string | null;
  metadata: Record<string, unknown>;
}

// ========================================
// PROCESSING RESULT TYPES
// ========================================

/**
 * Result of validating SR webhook payload
 */
export interface SRValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Result of registering SR sale (Phase 1)
 */
export interface SRRegistrationResult {
  success: boolean;
  saleId?: string;
  isDuplicate: boolean;
  error?: string;
  details?: {
    itemsRegistered: number;
    paymentsRegistered: number;
  };
}

/**
 * Result of processing SR sale (Phase 2)
 */
export interface SRProcessingResult {
  success: boolean;
  saleId: string;
  restaurantOrderId?: string;
  inventoryDeducted: boolean;
  error?: string;
  details?: {
    itemsMapped: number;
    itemsUnmapped: number;
    inventoryMovements: number;
  };
}

/**
 * Complete webhook processing result
 */
export interface SRWebhookProcessingResult {
  success: boolean;
  saleId?: string;
  restaurantOrderId?: string;
  phase: 'registration' | 'processing' | 'failed';
  error?: string;
  validationErrors?: string[];
  details?: {
    itemsRegistered: number;
    paymentsRegistered: number;
    itemsMapped: number;
    inventoryDeducted: boolean;
  };
}

// ========================================
// PRODUCT MAPPING TYPES
// ========================================

/**
 * Product mapping suggestion
 */
export interface SRProductMappingSuggestion {
  srProductCode: string;
  srProductName: string;
  suggestedMenuItemId: string;
  suggestedMenuItemName: string;
  confidence: 'high' | 'medium' | 'low';
  matchReason: 'exact_name' | 'fuzzy_name' | 'sku_match' | 'manual';
  similarityScore: number;
}

/**
 * Unmapped product (needs manual mapping)
 */
export interface SRUnmappedProduct {
  productCode: string;
  productName: string;
  timesSold: number;
  lastSoldAt: string;
  totalRevenue: number;
}

// ========================================
// INVENTORY DEDUCTION TYPES
// ========================================

/**
 * Inventory item to deduct
 */
export interface SRInventoryDeduction {
  inventoryItemId: string;
  inventoryItemName: string;
  quantityToDeduct: number;
  unit: string;
  currentStock: number;
  newStock: number;
  isLowStock: boolean;
  recipeQuantity: number;
  portionsSold: number;
}

/**
 * Recipe explosion result (explosión de insumos)
 */
export interface SRRecipeExplosion {
  menuItemId: string;
  menuItemName: string;
  quantitySold: number;
  deductions: SRInventoryDeduction[];
  totalIngredients: number;
  deductionsSuccessful: number;
  deductionsFailed: number;
  errors: string[];
}

// ========================================
// SYNC LOG TYPES
// ========================================

/**
 * SR Sync Log entry (maps to sr_sync_logs table)
 */
export interface SRSyncLogEntity {
  id?: string;
  tenant_id: string;
  branch_id: string;
  integration_id: string;

  // Sync details
  sync_type: 'webhook_sale' | 'manual_sync' | 'scheduled_sync';
  direction: 'sr_to_tistis';
  status: 'success' | 'partial' | 'failed';

  // Results
  records_received: number;
  records_registered: number;
  records_processed: number;
  records_failed: number;

  // Timing
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;

  // Errors
  error_message: string | null;
  error_details: Record<string, unknown> | null;

  // Reference
  sale_id: string | null;

  // Metadata
  metadata: Record<string, unknown>;
}

// ========================================
// CONFIGURATION TYPES
// ========================================

/**
 * SR Integration Configuration
 */
export interface SRIntegrationConfig {
  // Auto-processing
  autoProcessSales: boolean;
  autoDeductInventory: boolean;
  autoCreateRestaurantOrders: boolean;

  // Product mapping
  autoMapProducts: boolean;
  requireManualMappingApproval: boolean;
  fuzzyMatchThreshold: number; // 0.0 - 1.0

  // Inventory
  allowNegativeStock: boolean;
  lowStockAlertThreshold: number;

  // Validation
  requireCustomerInfo: boolean;
  requireTableNumber: boolean;
  validatePricing: boolean;

  // Deduplication
  duplicateDetectionWindow: number; // minutes

  // Notifications
  notifyOnLowStock: boolean;
  notifyOnUnmappedProducts: boolean;
  notifyOnProcessingErrors: boolean;
}

// ========================================
// HELPER TYPES
// ========================================

/**
 * SR Sale with related entities (for display/reporting)
 */
export interface SRSaleWithDetails {
  sale: SRSaleEntity;
  items: SRSaleItemEntity[];
  payments: SRPaymentEntity[];
  restaurantOrder?: {
    id: string;
    order_number: string;
    status: string;
  };
}

/**
 * SR Analytics Summary
 */
export interface SRAnalyticsSummary {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  totalGuests: number;
  averageGuestsPerSale: number;
  salesByType: Record<string, number>;
  salesByPaymentMethod: Record<string, number>;
  topProducts: Array<{
    productCode: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  unmappedProductsCount: number;
  processingSuccessRate: number;
}

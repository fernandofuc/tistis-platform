// =====================================================
// TIS TIS PLATFORM - SoftRestaurant Sale Processor
// PHASE 2: Process registered SR sales
// - Product mapping
// - Inventory deduction (recipe explosion)
// - Restaurant order creation
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  SRProcessingResult,
  SRSaleItemEntity,
  SRProductMappingEntity,
} from '../types/soft-restaurant.types';
import { RecipeDeductionService } from './recipe-deduction.service';
import { LowStockAlertService } from './low-stock-alert.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ========================================
// PRODUCT MAPPING SERVICE
// ========================================

class ProductMappingService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Find or create product mapping for SR product
   * Returns menu_item_id if mapped, null if unmapped
   */
  async findOrCreateMapping(
    tenantId: string,
    branchId: string,
    integrationId: string,
    productCode: string,
    productName: string
  ): Promise<string | null> {
    // Check if mapping exists
    const { data: existingMapping } = await this.supabase
      .from('sr_product_mappings')
      .select('menu_item_id, is_active')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('integration_id', integrationId)
      .eq('sr_product_code', productCode)
      .eq('is_active', true)
      .maybeSingle();

    if (existingMapping) {
      // Update stats
      await this.updateMappingStats(
        tenantId,
        branchId,
        integrationId,
        productCode
      );
      return existingMapping.menu_item_id;
    }

    // Try fuzzy matching by name
    const fuzzyMatch = await this.fuzzyMatchProduct(
      tenantId,
      branchId,
      productName
    );

    if (fuzzyMatch) {
      // Create mapping with high confidence
      await this.createMapping(
        tenantId,
        branchId,
        integrationId,
        productCode,
        productName,
        fuzzyMatch.id,
        'high'
      );
      return fuzzyMatch.id;
    }

    // No mapping found - create unmapped entry for manual review
    await this.createUnmappedEntry(
      tenantId,
      branchId,
      integrationId,
      productCode,
      productName
    );

    return null;
  }

  /**
   * Fuzzy match SR product name to menu item
   */
  private async fuzzyMatchProduct(
    tenantId: string,
    branchId: string,
    productName: string
  ): Promise<{ id: string; name: string } | null> {
    // Try exact match first
    const { data: exactMatch } = await this.supabase
      .from('restaurant_menu_items')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .ilike('name', productName)
      .eq('is_active', true)
      .maybeSingle();

    if (exactMatch) {
      return exactMatch;
    }

    // Try partial match (contains)
    const cleanName = productName.trim().toLowerCase();
    const { data: partialMatches } = await this.supabase
      .from('restaurant_menu_items')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .ilike('name', `%${cleanName}%`)
      .eq('is_active', true)
      .limit(1);

    if (partialMatches && partialMatches.length > 0) {
      return partialMatches[0];
    }

    return null;
  }

  /**
   * Create product mapping
   */
  private async createMapping(
    tenantId: string,
    branchId: string,
    integrationId: string,
    srProductCode: string,
    srProductName: string,
    menuItemId: string,
    confidence: 'high' | 'medium' | 'low' | 'manual'
  ) {
    const mapping: Omit<SRProductMappingEntity, 'id'> = {
      tenant_id: tenantId,
      branch_id: branchId,
      integration_id: integrationId,
      sr_product_code: srProductCode,
      sr_product_name: srProductName,
      menu_item_id: menuItemId,
      mapping_confidence: confidence,
      is_active: true,
      times_sold: 1,
      last_sold_at: new Date().toISOString(),
      notes: null,
      metadata: {},
    };

    await this.supabase.from('sr_product_mappings').insert(mapping);
  }

  /**
   * Create unmapped product entry
   */
  private async createUnmappedEntry(
    tenantId: string,
    branchId: string,
    integrationId: string,
    productCode: string,
    productName: string
  ) {
    // Check if already exists
    const { data: existing } = await this.supabase
      .from('sr_product_mappings')
      .select('id, times_sold')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('sr_product_code', productCode)
      .is('menu_item_id', null)
      .maybeSingle();

    if (existing) {
      // Update times_sold and last_sold_at
      await this.supabase
        .from('sr_product_mappings')
        .update({
          times_sold: existing.times_sold + 1,
          last_sold_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Create new unmapped entry
      const unmapped: Omit<SRProductMappingEntity, 'id'> = {
        tenant_id: tenantId,
        branch_id: branchId,
        integration_id: integrationId,
        sr_product_code: productCode,
        sr_product_name: productName,
        menu_item_id: null, // Unmapped - awaiting manual mapping
        mapping_confidence: 'low',
        is_active: false,
        times_sold: 1,
        last_sold_at: new Date().toISOString(),
        notes: 'Awaiting manual mapping',
        metadata: {},
      };

      await this.supabase.from('sr_product_mappings').insert(unmapped);
    }
  }

  /**
   * Update mapping statistics
   */
  private async updateMappingStats(
    tenantId: string,
    branchId: string,
    integrationId: string,
    productCode: string
  ) {
    // Use RPC function for atomic increment
    const { error } = await this.supabase.rpc('increment_sr_product_mapping_stats', {
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_integration_id: integrationId,
      p_product_code: productCode,
    });

    if (error) {
      console.error('[Product Mapping] Failed to update stats:', error);
    }
  }

  /**
   * Map all items in a sale
   */
  async mapSaleItems(
    tenantId: string,
    branchId: string,
    integrationId: string,
    items: SRSaleItemEntity[]
  ): Promise<{ mapped: number; unmapped: number }> {
    let mapped = 0;
    let unmapped = 0;

    for (const item of items) {
      const menuItemId = await this.findOrCreateMapping(
        tenantId,
        branchId,
        integrationId,
        item.product_code,
        item.product_name
      );

      if (menuItemId) {
        // Update sale item with mapping
        await this.supabase
          .from('sr_sale_items')
          .update({ mapped_menu_item_id: menuItemId })
          .eq('id', item.id);
        mapped++;
      } else {
        unmapped++;
      }
    }

    return { mapped, unmapped };
  }
}

// ========================================
// RESTAURANT ORDER SERVICE
// ========================================

/**
 * Maps Soft Restaurant sale types to TIS TIS order types.
 * SR uses different terminology than TIS TIS.
 */
function mapSRSaleTypeToOrderType(
  srSaleType: string | null | undefined
): 'dine_in' | 'takeout' | 'delivery' | 'drive_thru' | 'catering' {
  if (!srSaleType) return 'dine_in';

  const normalized = srSaleType.toLowerCase().trim();

  // Map common SR sale types
  const typeMap: Record<string, 'dine_in' | 'takeout' | 'delivery' | 'drive_thru' | 'catering'> = {
    // Dine in variations
    'mesa': 'dine_in',
    'comedor': 'dine_in',
    'restaurante': 'dine_in',
    'dine_in': 'dine_in',
    'local': 'dine_in',
    '1': 'dine_in', // SR often uses numeric codes
    // Takeout variations
    'llevar': 'takeout',
    'para llevar': 'takeout',
    'takeout': 'takeout',
    'take_out': 'takeout',
    'pll': 'takeout',
    '2': 'takeout',
    // Delivery variations
    'domicilio': 'delivery',
    'delivery': 'delivery',
    'envio': 'delivery',
    'reparto': 'delivery',
    '3': 'delivery',
    // Drive thru
    'autoservicio': 'drive_thru',
    'drive': 'drive_thru',
    'drive_thru': 'drive_thru',
    '4': 'drive_thru',
    // Catering
    'catering': 'catering',
    'evento': 'catering',
    'banquete': 'catering',
    '5': 'catering',
  };

  return typeMap[normalized] || 'dine_in';
}

class RestaurantOrderService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Find table_id by table_number for a branch.
   * Returns null if not found (table lookup is optional).
   */
  private async findTableIdByNumber(
    tenantId: string,
    branchId: string,
    tableNumber: string | null | undefined
  ): Promise<string | null> {
    if (!tableNumber) return null;

    const { data: table } = await this.supabase
      .from('restaurant_tables')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('table_number', tableNumber.trim())
      .is('deleted_at', null)
      .maybeSingle();

    return table?.id || null;
  }

  /**
   * Get primary payment method from sr_payments.
   * Returns the payment method with highest amount.
   */
  private async getPrimaryPaymentMethod(saleId: string): Promise<string | null> {
    const { data: payments } = await this.supabase
      .from('sr_payments')
      .select('payment_method, amount')
      .eq('sale_id', saleId)
      .order('amount', { ascending: false })
      .limit(1);

    if (payments && payments.length > 0) {
      return payments[0].payment_method;
    }
    return null;
  }

  /**
   * Create restaurant order from SR sale.
   * Maps SR sale data to TIS TIS restaurant_orders schema.
   *
   * IMPORTANT: This function creates a restaurant_order that the UI can display.
   * The schema uses:
   * - table_id (UUID) not table_number (looked up from restaurant_tables)
   * - tax_amount, discount_amount, tip_amount (not tax, discount, tip)
   * - display_number is auto-generated by trigger based on order_type
   * - order_number is SERIAL (auto-increment)
   * - All SR-specific data goes in metadata
   */
  async createOrderFromSale(
    tenantId: string,
    branchId: string,
    saleId: string,
    items: SRSaleItemEntity[]
  ): Promise<string | null> {
    try {
      // Get sale details
      const { data: sale, error: saleError } = await this.supabase
        .from('sr_sales')
        .select('*')
        .eq('id', saleId)
        .single();

      if (saleError || !sale) {
        console.error('[Order] Sale not found:', saleId, saleError?.message);
        return null;
      }

      // Look up table_id from table_number
      const tableId = await this.findTableIdByNumber(tenantId, branchId, sale.table_number);

      // Get primary payment method
      const paymentMethod = await this.getPrimaryPaymentMethod(saleId);

      // Map SR sale type to TIS TIS order type
      const orderType = mapSRSaleTypeToOrderType(sale.sale_type);

      // Build metadata with all SR-specific information
      const metadata = {
        source: 'softrestaurant',
        sr_sale_id: saleId,
        sr_folio: sale.folio_venta,
        sr_store_code: sale.store_code,
        sr_customer_code: sale.customer_code,
        sr_user_code: sale.user_code,
        sr_table_number: sale.table_number, // Keep original for reference
        sr_guest_count: sale.guest_count,
        sr_opened_at: sale.opened_at,
        sr_closed_at: sale.closed_at,
        sr_sale_type: sale.sale_type,
        items_mapped: items.filter(i => i.mapped_menu_item_id).length,
        items_unmapped: items.filter(i => !i.mapped_menu_item_id).length,
        total_items: items.length,
      };

      // Create restaurant order with correct schema columns
      // NOTE: order_number (SERIAL) and display_number are auto-generated
      const { data: order, error: orderError } = await this.supabase
        .from('restaurant_orders')
        .insert({
          tenant_id: tenantId,
          branch_id: branchId,
          order_type: orderType,
          table_id: tableId, // UUID or null (not table_number string)
          status: 'completed', // SR sales are already completed
          priority: 3, // Default priority
          ordered_at: sale.opened_at || new Date().toISOString(),
          completed_at: sale.closed_at || new Date().toISOString(),
          subtotal: Number(sale.subtotal_without_tax) || 0,
          tax_amount: Number(sale.total_tax) || 0,
          discount_amount: Number(sale.total_discounts) || 0,
          tip_amount: Number(sale.total_tips) || 0,
          total: Number(sale.total) || 0,
          currency: sale.currency || 'MXN',
          payment_status: 'paid', // SR sales are already paid
          payment_method: paymentMethod,
          customer_notes: sale.notes,
          internal_notes: `Importado de Soft Restaurant - Folio: ${sale.folio_venta}`,
          metadata,
        })
        .select('id, display_number')
        .single();

      if (orderError) {
        console.error('[Order] Failed to create order:', orderError.message);
        return null;
      }

      const orderId = order.id;
      console.log(`[Order] Created restaurant order ${order.display_number} from SR sale ${sale.folio_venta}`);

      // Create order items (only mapped items can be fully created)
      const orderItems = items
        .filter((item) => item.mapped_menu_item_id) // Only items with menu mapping
        .map((item, index) => ({
          tenant_id: tenantId,
          order_id: orderId,
          menu_item_id: item.mapped_menu_item_id,
          menu_item_name: item.product_name, // Snapshot of name at order time
          quantity: Math.round(Number(item.quantity) || 1), // Must be integer
          unit_price: Number(item.unit_price) || 0,
          subtotal: Number(item.subtotal_without_tax) || 0,
          // Note: restaurant_order_items doesn't have tax_amount/discount_amount columns
          // Those are aggregated at order level
          status: 'served', // All items are already served for completed orders
          kitchen_station: 'main', // Default station
          special_instructions: item.notes,
          display_order: index,
          metadata: {
            sr_product_code: item.product_code,
            sr_product_name: item.product_name,
            sr_unit_price: item.unit_price,
            sr_quantity: item.quantity,
            sr_tax_amount: item.tax_amount,
            sr_discount_amount: item.discount_amount,
            sr_user_code: item.user_code,
          },
        }));

      if (orderItems.length > 0) {
        const { error: itemsError } = await this.supabase
          .from('restaurant_order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('[Order] Failed to create order items:', itemsError.message);
          // Don't fail the whole operation - order was created
        } else {
          console.log(`[Order] Created ${orderItems.length} order items for order ${order.display_number}`);
        }
      }

      // Also create entries for unmapped items (without menu_item_id)
      // These will appear in the order but won't link to the menu
      const unmappedItems = items
        .filter((item) => !item.mapped_menu_item_id)
        .map((item, index) => ({
          tenant_id: tenantId,
          order_id: orderId,
          menu_item_id: null, // No mapping
          menu_item_name: `[SR] ${item.product_name}`, // Mark as SR product
          quantity: Math.round(Number(item.quantity) || 1),
          unit_price: Number(item.unit_price) || 0,
          subtotal: Number(item.subtotal_without_tax) || 0,
          status: 'served',
          kitchen_station: 'main',
          special_instructions: `Producto SR sin mapear: ${item.product_code}`,
          display_order: orderItems.length + index,
          metadata: {
            sr_unmapped: true,
            sr_product_code: item.product_code,
            sr_product_name: item.product_name,
            sr_unit_price: item.unit_price,
            sr_quantity: item.quantity,
            sr_tax_amount: item.tax_amount,
            sr_discount_amount: item.discount_amount,
          },
        }));

      if (unmappedItems.length > 0) {
        const { error: unmappedError } = await this.supabase
          .from('restaurant_order_items')
          .insert(unmappedItems);

        if (unmappedError) {
          console.error('[Order] Failed to create unmapped items:', unmappedError.message);
        } else {
          console.log(`[Order] Created ${unmappedItems.length} unmapped items for order ${order.display_number}`);
        }
      }

      return orderId;
    } catch (error) {
      console.error('[Order] Unexpected error creating order:', error);
      return null;
    }
  }
}

// ========================================
// MAIN PROCESSOR
// ========================================

export class SoftRestaurantProcessor {
  private productMapper: ProductMappingService;
  private orderService: RestaurantOrderService;
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.productMapper = new ProductMappingService(this.supabase);
    this.orderService = new RestaurantOrderService(this.supabase);
  }

  /**
   * Process a registered SR sale (PHASE 2)
   */
  async processSale(saleId: string): Promise<SRProcessingResult> {
    try {
      // Get sale
      const { data: sale, error: saleError } = await this.supabase
        .from('sr_sales')
        .select('*')
        .eq('id', saleId)
        .single();

      if (saleError || !sale) {
        return {
          success: false,
          saleId,
          inventoryDeducted: false,
          error: 'Sale not found',
        };
      }

      const { tenant_id: tenantId, branch_id: branchId, integration_id: integrationId } = sale;

      // Get sale items
      const { data: items, error: itemsError } = await this.supabase
        .from('sr_sale_items')
        .select('*')
        .eq('sale_id', saleId);

      if (itemsError || !items || items.length === 0) {
        return {
          success: false,
          saleId,
          inventoryDeducted: false,
          error: 'No sale items found',
        };
      }

      // STEP 1: Map products
      const mappingResult = await this.productMapper.mapSaleItems(
        tenantId,
        branchId,
        integrationId,
        items
      );

      // STEP 2: Deduce inventory using RecipeDeductionService (FASE 3)
      console.log('[SR Processor] Starting inventory deduction (FASE 3)...');

      const deductionResult = await RecipeDeductionService.deduceForSale({
        supabase: this.supabase,
        saleId,
        allowNegativeStock: false, // TODO: Make configurable per integration
      });

      if (!deductionResult.success) {
        console.error('[SR Processor] Inventory deduction failed:', deductionResult.errors);
        // Log errors but don't fail the sale
        // (Sale was already registered, inventory can be manually adjusted)
      }

      console.log(
        '[SR Processor] Inventory deduction complete:',
        {
          itemsDeducted: deductionResult.itemsDeducted,
          ingredientsDeducted: deductionResult.totalIngredientsDeducted,
          costDeducted: deductionResult.totalCostDeducted,
          warnings: deductionResult.warnings.length,
          errors: deductionResult.errors.length,
        }
      );

      const inventoryMovements = deductionResult.movements.length;

      // STEP 2.5: Check for low stock alerts (FASE 3)
      if (deductionResult.movements.length > 0) {
        console.log('[SR Processor] Checking for low stock alerts...');

        const itemIds = [...new Set(deductionResult.movements.map(m => m.item_id))];

        try {
          const alertResult = await LowStockAlertService.checkAfterDeduction({
            supabase: this.supabase,
            tenantId,
            branchId,
            itemIds,
          });

          console.log(
            '[SR Processor] Low stock check complete:',
            {
              itemsChecked: alertResult.itemsChecked,
              lowStockItems: alertResult.lowStockItems.length,
              critical: alertResult.criticalCount,
              warnings: alertResult.warningCount,
            }
          );
        } catch (alertError) {
          // Don't fail sale processing if alert check fails
          console.error('[SR Processor] Low stock alert check failed:', alertError);
        }
      }

      // STEP 3: Create restaurant order
      const restaurantOrderId = await this.orderService.createOrderFromSale(
        tenantId,
        branchId,
        saleId,
        items
      );

      // Update sale status
      await this.supabase
        .from('sr_sales')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          restaurant_order_id: restaurantOrderId,
        })
        .eq('id', saleId);

      return {
        success: true,
        saleId,
        restaurantOrderId: restaurantOrderId || undefined,
        inventoryDeducted: inventoryMovements > 0,
        details: {
          itemsMapped: mappingResult.mapped,
          itemsUnmapped: mappingResult.unmapped,
          inventoryMovements,
        },
      };
    } catch (error) {
      console.error('[SR Processor] Error processing sale:', error);

      // Get current retry count and increment
      const { data: currentSale } = await this.supabase
        .from('sr_sales')
        .select('retry_count')
        .eq('id', saleId)
        .single();

      // Update sale with error
      await this.supabase
        .from('sr_sales')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          retry_count: (currentSale?.retry_count || 0) + 1,
        })
        .eq('id', saleId);

      return {
        success: false,
        saleId,
        inventoryDeducted: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

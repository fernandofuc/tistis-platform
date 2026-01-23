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
  SRRecipeExplosion,
  SRInventoryDeduction,
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
// INVENTORY DEDUCTION SERVICE
// ========================================

class InventoryDeductionService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Perform recipe explosion for menu item
   * Returns deductions to be applied
   */
  async explodeRecipe(
    tenantId: string,
    branchId: string,
    menuItemId: string,
    quantity: number
  ): Promise<SRRecipeExplosion> {
    const explosion: SRRecipeExplosion = {
      menuItemId,
      menuItemName: '',
      quantitySold: quantity,
      deductions: [],
      totalIngredients: 0,
      deductionsSuccessful: 0,
      deductionsFailed: 0,
      errors: [],
    };

    // Get menu item
    const { data: menuItem } = await this.supabase
      .from('restaurant_menu_items')
      .select('name')
      .eq('id', menuItemId)
      .single();

    if (!menuItem) {
      explosion.errors.push(`Menu item ${menuItemId} not found`);
      return explosion;
    }

    explosion.menuItemName = menuItem.name;

    // Get recipe
    const { data: recipe } = await this.supabase
      .from('menu_item_recipes')
      .select('id, yield_quantity, yield_unit')
      .eq('menu_item_id', menuItemId)
      .eq('is_active', true)
      .maybeSingle();

    if (!recipe) {
      explosion.errors.push(`No active recipe found for ${menuItem.name}`);
      return explosion;
    }

    // Get recipe ingredients
    const { data: ingredients } = await this.supabase
      .from('recipe_ingredients')
      .select(`
        id,
        inventory_item_id,
        quantity_needed,
        unit,
        inventory_items (
          id,
          name,
          current_stock,
          unit,
          minimum_stock,
          is_active
        )
      `)
      .eq('recipe_id', recipe.id)
      .eq('is_active', true);

    if (!ingredients || ingredients.length === 0) {
      explosion.errors.push(`Recipe for ${menuItem.name} has no ingredients`);
      return explosion;
    }

    explosion.totalIngredients = ingredients.length;

    // Calculate deductions
    for (const ingredient of ingredients) {
      const item = ingredient.inventory_items as any;

      if (!item || !item.is_active) {
        explosion.errors.push(
          `Inventory item ${ingredient.inventory_item_id} not found or inactive`
        );
        explosion.deductionsFailed++;
        continue;
      }

      const quantityPerPortion = ingredient.quantity_needed;
      const totalDeduction = quantityPerPortion * quantity;

      const deduction: SRInventoryDeduction = {
        inventoryItemId: item.id,
        inventoryItemName: item.name,
        quantityToDeduct: totalDeduction,
        unit: ingredient.unit,
        currentStock: item.current_stock,
        newStock: item.current_stock - totalDeduction,
        isLowStock: item.current_stock - totalDeduction <= item.minimum_stock,
        recipeQuantity: quantityPerPortion,
        portionsSold: quantity,
      };

      explosion.deductions.push(deduction);
    }

    return explosion;
  }

  /**
   * Apply inventory deductions from recipe explosion
   */
  async applyDeductions(
    tenantId: string,
    branchId: string,
    saleId: string,
    explosions: SRRecipeExplosion[]
  ): Promise<number> {
    let totalMovements = 0;

    for (const explosion of explosions) {
      for (const deduction of explosion.deductions) {
        // Check if stock is sufficient
        if (deduction.newStock < 0) {
          console.warn(
            `[Inventory] Negative stock for ${deduction.inventoryItemName}: ${deduction.newStock}`
          );
          // Continue anyway - allow negative stock (configurable in future)
        }

        // Update inventory item stock
        const { error: updateError } = await this.supabase
          .from('inventory_items')
          .update({
            current_stock: deduction.newStock,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deduction.inventoryItemId)
          .eq('tenant_id', tenantId)
          .eq('branch_id', branchId);

        if (updateError) {
          console.error(
            `[Inventory] Failed to update stock for ${deduction.inventoryItemName}:`,
            updateError
          );
          explosion.deductionsFailed++;
          continue;
        }

        // Create inventory movement record
        const { error: movementError } = await this.supabase
          .from('inventory_movements')
          .insert({
            tenant_id: tenantId,
            branch_id: branchId,
            inventory_item_id: deduction.inventoryItemId,
            movement_type: 'sale', // or 'sr_sale'
            quantity: -deduction.quantityToDeduct, // Negative for deduction
            unit: deduction.unit,
            reference_type: 'sr_sale',
            reference_id: saleId,
            performed_at: new Date().toISOString(),
            notes: `Venta SR - ${explosion.menuItemName} (${deduction.portionsSold} porciones)`,
            performed_by: null, // System
            metadata: {
              sr_sale_id: saleId,
              menu_item_id: explosion.menuItemId,
              recipe_quantity: deduction.recipeQuantity,
              portions_sold: deduction.portionsSold,
            },
          });

        if (movementError) {
          console.error(
            `[Inventory] Failed to create movement for ${deduction.inventoryItemName}:`,
            movementError
          );
          explosion.deductionsFailed++;
          continue;
        }

        explosion.deductionsSuccessful++;
        totalMovements++;
      }
    }

    return totalMovements;
  }
}

// ========================================
// RESTAURANT ORDER SERVICE
// ========================================

class RestaurantOrderService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create restaurant order from SR sale
   */
  async createOrderFromSale(
    tenantId: string,
    branchId: string,
    saleId: string,
    items: SRSaleItemEntity[]
  ): Promise<string | null> {
    // Get sale details
    const { data: sale } = await this.supabase
      .from('sr_sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (!sale) {
      console.error('[Order] Sale not found:', saleId);
      return null;
    }

    // Generate order number
    const orderNumber = await this.generateOrderNumber(tenantId, branchId);

    // Create restaurant order
    const { data: order, error: orderError } = await this.supabase
      .from('restaurant_orders')
      .insert({
        tenant_id: tenantId,
        branch_id: branchId,
        order_number: orderNumber,
        sr_sale_id: saleId, // Link to SR sale
        order_type: sale.sale_type || 'dine_in',
        status: 'completed', // SR sales are already completed
        table_number: sale.table_number,
        guest_count: sale.guest_count || 1,
        subtotal: sale.subtotal_without_tax,
        tax: sale.total_tax,
        discount: sale.total_discounts,
        tip: sale.total_tips,
        total: sale.total,
        currency: sale.currency,
        payment_status: 'paid', // SR sales are already paid
        payment_method: 'unknown', // Can be enriched from sr_payments
        notes: sale.notes,
        source: 'softrestaurant',
        created_at: sale.opened_at,
        updated_at: sale.closed_at || new Date().toISOString(),
        metadata: {
          sr_folio: sale.folio_venta,
          sr_customer_code: sale.customer_code,
          sr_user_code: sale.user_code,
        },
      })
      .select('id')
      .single();

    if (orderError) {
      console.error('[Order] Failed to create order:', orderError);
      return null;
    }

    const orderId = order.id;

    // Create order items
    const orderItems = items
      .filter((item) => item.mapped_menu_item_id) // Only mapped items
      .map((item) => ({
        tenant_id: tenantId,
        branch_id: branchId,
        order_id: orderId,
        menu_item_id: item.mapped_menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal_without_tax,
        tax: item.tax_amount,
        discount: item.discount_amount,
        total: item.subtotal_without_tax + item.tax_amount - item.discount_amount,
        modifiers: item.modifiers || [],
        special_instructions: item.notes,
        status: 'completed',
        metadata: {
          sr_product_code: item.product_code,
          sr_product_name: item.product_name,
        },
      }));

    if (orderItems.length > 0) {
      const { error: itemsError } = await this.supabase
        .from('restaurant_order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('[Order] Failed to create order items:', itemsError);
      }
    }

    return orderId;
  }

  /**
   * Generate sequential order number
   */
  private async generateOrderNumber(
    tenantId: string,
    branchId: string
  ): Promise<string> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // Get latest order number for today
    const { data: latestOrder } = await this.supabase
      .from('restaurant_orders')
      .select('order_number')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .like('order_number', `SR-${today}-%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let sequence = 1;
    if (latestOrder) {
      const parts = latestOrder.order_number.split('-');
      if (parts.length === 3) {
        sequence = parseInt(parts[2], 10) + 1;
      }
    }

    return `SR-${today}-${sequence.toString().padStart(4, '0')}`;
  }
}

// ========================================
// MAIN PROCESSOR
// ========================================

export class SoftRestaurantProcessor {
  private productMapper: ProductMappingService;
  private inventoryDeductor: InventoryDeductionService;
  private orderService: RestaurantOrderService;
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.productMapper = new ProductMappingService(this.supabase);
    this.inventoryDeductor = new InventoryDeductionService(this.supabase);
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

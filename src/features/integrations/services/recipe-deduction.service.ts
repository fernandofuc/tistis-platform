// =====================================================
// TIS TIS PLATFORM - Recipe Deduction Service
// Explosión de insumos automática para Soft Restaurant
// Deduce ingredientes de inventario al vender platillos
// =====================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DeduceMenuItemParams,
  DeduceSaleParams,
  DeductionPreviewParams,
  DeductionResult,
  SaleDeductionResult,
  DeductionPreview,
  MenuItemRecipeEntity,
  RecipeIngredientEntity,
  InventoryItemEntity,
  InventoryMovementEntity,
  IngredientDeduction,
} from '../types/inventory.types';
import { InventoryMovementService } from './inventory-movement.service';

// =====================================================
// SERVICE CLASS
// =====================================================

export class RecipeDeductionService {
  /**
   * Deduce ingredients from inventory for a single menu item
   * This is the core "explosión de insumos" logic
   *
   * @param params - Deduction parameters
   * @returns DeductionResult with success status and details
   */
  static async deduceForMenuItem(
    params: DeduceMenuItemParams
  ): Promise<DeductionResult> {
    const {
      supabase,
      tenantId,
      branchId,
      menuItemId,
      quantitySold,
      saleId,
      allowNegativeStock = false,
    } = params;

    const result: DeductionResult = {
      success: true,
      menuItemId,
      menuItemName: '',
      ingredientsProcessed: 0,
      ingredientsDeducted: 0,
      totalCostDeducted: 0,
      movements: [],
      errors: [],
      warnings: [],
    };

    console.log(
      `[RecipeDeduction] Processing menu item ${menuItemId} x${quantitySold}`
    );

    try {
      // 1. Validate quantitySold parameter
      if (!quantitySold || quantitySold <= 0 || !Number.isFinite(quantitySold)) {
        result.errors.push(
          `Invalid quantity sold: ${quantitySold}. Must be a positive number.`
        );
        result.success = false;
        return result;
      }

      // 2. Get menu item name
      const { data: menuItem, error: menuItemError } = await supabase
        .from('restaurant_menu_items')
        .select('name')
        .eq('id', menuItemId)
        .single();

      if (menuItemError || !menuItem) {
        result.errors.push(
          `Menu item not found: ${menuItemId}`
        );
        result.success = false;
        return result;
      }

      result.menuItemName = menuItem.name;

      // 3. Get recipe for this menu item
      const { data: recipe, error: recipeError } = await supabase
        .from('menu_item_recipes')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('menu_item_id', menuItemId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single();

      if (recipeError || !recipe) {
        result.warnings.push(
          `No active recipe found for menu item: ${menuItem.name}`
        );
        console.log(
          `[RecipeDeduction] Skipping ${menuItem.name} - no recipe`
        );
        // Not an error - just skip
        return result;
      }

      const typedRecipe = recipe as MenuItemRecipeEntity;

      // 4. Get recipe ingredients
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', typedRecipe.id)
        .order('display_order', { ascending: true });

      if (ingredientsError) {
        result.errors.push(
          `Failed to fetch ingredients: ${ingredientsError.message}`
        );
        result.success = false;
        return result;
      }

      const typedIngredients = (ingredients || []) as RecipeIngredientEntity[];

      if (typedIngredients.length === 0) {
        result.warnings.push(
          `Recipe for ${menuItem.name} has no ingredients defined`
        );
        console.log(
          `[RecipeDeduction] Skipping ${menuItem.name} - empty recipe`
        );
        return result;
      }

      console.log(
        `[RecipeDeduction] Found ${typedIngredients.length} ingredients for ${menuItem.name}`
      );

      result.ingredientsProcessed = typedIngredients.length;

      // 5. Validate recipe yield_quantity
      if (!typedRecipe.yield_quantity || typedRecipe.yield_quantity <= 0) {
        result.errors.push(
          `Invalid recipe yield quantity: ${typedRecipe.yield_quantity} for ${menuItem.name}`
        );
        result.success = false;
        return result;
      }

      // 6. Calculate scaling factor
      // If recipe yields 1 portion and we sold 2, scale factor = 2
      const scaleFactor = quantitySold / typedRecipe.yield_quantity;
      console.log(
        `[RecipeDeduction] Scale factor: ${scaleFactor} (sold: ${quantitySold}, yield: ${typedRecipe.yield_quantity})`
      );

      // 7. Process each ingredient
      for (const ingredient of typedIngredients) {
        try {
          // Calculate deduction
          const deduction = await this.calculateIngredientDeduction(
            supabase,
            tenantId,
            branchId,
            ingredient,
            scaleFactor
          );

          if (!deduction) {
            result.errors.push(
              `Failed to calculate deduction for ingredient ${ingredient.inventory_item_id}`
            );
            continue;
          }

          // Check if will go negative
          if (deduction.willBeNegative && !allowNegativeStock) {
            result.errors.push(
              `Insufficient stock for ${deduction.ingredientName}: ` +
                `need ${deduction.actualQuantity}, have ${deduction.currentStock}`
            );
            result.success = false;
            continue;
          }

          if (deduction.willBeNegative && allowNegativeStock) {
            result.warnings.push(
              `${deduction.ingredientName} will go negative: ${deduction.newStock}`
            );
          }

          // Update inventory stock with optimistic locking
          // We validate current_stock hasn't changed to prevent race conditions
          const { data: updateData, error: updateError } = await supabase
            .from('inventory_items')
            .update({
              current_stock: deduction.newStock,
              updated_at: new Date().toISOString(),
            })
            .eq('id', deduction.ingredientId)
            .eq('tenant_id', tenantId)
            .eq('current_stock', deduction.currentStock) // Optimistic locking
            .select();

          if (updateError) {
            result.errors.push(
              `Failed to update stock for ${deduction.ingredientName}: ${updateError.message}`
            );
            result.success = false;
            continue;
          }

          // Validate that the update affected exactly 1 row
          if (!updateData || updateData.length === 0) {
            result.errors.push(
              `Stock update failed for ${deduction.ingredientName}: ` +
                `current stock may have changed or item was deleted`
            );
            result.success = false;
            continue;
          }

          // Record movement in kardex
          try {
            const movement = await InventoryMovementService.recordDeduction({
              supabase,
              tenantId,
              branchId,
              itemId: deduction.ingredientId,
              quantity: deduction.actualQuantity, // Service will make it negative
              previousStock: deduction.currentStock,
              newStock: deduction.newStock,
              unitCost: deduction.unitCost,
              referenceType: 'sr_sale',
              referenceId: saleId,
              notes: `Deducted for ${menuItem.name} x${quantitySold}`,
            });

            result.movements.push(movement);
            result.ingredientsDeducted++;
            result.totalCostDeducted += deduction.totalCost;

            console.log(
              `[RecipeDeduction] Deducted ${deduction.actualQuantity} ${ingredient.unit} ` +
                `of ${deduction.ingredientName} (${deduction.currentStock} → ${deduction.newStock})`
            );
          } catch (movementError) {
            // CRITICAL: Movement recording failed after stock update
            // Attempt to rollback stock to previous value
            console.error(
              `[RecipeDeduction] CRITICAL: Movement recording failed, rolling back stock for ${deduction.ingredientName}`,
              movementError
            );

            const { error: rollbackError } = await supabase
              .from('inventory_items')
              .update({
                current_stock: deduction.currentStock, // Rollback to original
                updated_at: new Date().toISOString(),
              })
              .eq('id', deduction.ingredientId)
              .eq('tenant_id', tenantId);

            if (rollbackError) {
              console.error(
                `[RecipeDeduction] CRITICAL: Rollback failed for ${deduction.ingredientName}`,
                rollbackError
              );
              result.errors.push(
                `CRITICAL: Stock updated but movement failed AND rollback failed for ${deduction.ingredientName}. Manual intervention required.`
              );
            } else {
              result.errors.push(
                `Movement recording failed for ${deduction.ingredientName}, stock rolled back successfully`
              );
            }

            result.success = false;
            continue;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(
            `Error processing ingredient ${ingredient.inventory_item_id}: ${errorMessage}`
          );
          result.success = false;
        }
      }

      // 8. Final validation
      if (result.errors.length > 0 && !allowNegativeStock) {
        result.success = false;
      }

      console.log(
        `[RecipeDeduction] Completed for ${menuItem.name}: ` +
          `${result.ingredientsDeducted}/${result.ingredientsProcessed} ingredients deducted, ` +
          `cost: $${result.totalCostDeducted.toFixed(2)}`
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Unexpected error: ${errorMessage}`);
      result.success = false;
      console.error('[RecipeDeduction] Error:', error);
      return result;
    }
  }

  /**
   * Deduce ingredients for all items in a sale
   *
   * @param params - Sale deduction parameters
   * @returns SaleDeductionResult with aggregated details
   */
  static async deduceForSale(
    params: DeduceSaleParams
  ): Promise<SaleDeductionResult> {
    const { supabase, saleId, allowNegativeStock = false } = params;

    const result: SaleDeductionResult = {
      success: true,
      saleId,
      itemsProcessed: 0,
      itemsDeducted: 0,
      totalIngredientsDeducted: 0,
      totalCostDeducted: 0,
      movements: [],
      errors: [],
      warnings: [],
      itemResults: [],
    };

    console.log(`[RecipeDeduction] Processing sale ${saleId}`);

    try {
      // 1. Get sale details
      const { data: sale, error: saleError } = await supabase
        .from('sr_sales')
        .select('tenant_id, branch_id')
        .eq('id', saleId)
        .single();

      if (saleError || !sale) {
        result.errors.push(`Sale not found: ${saleId}`);
        result.success = false;
        return result;
      }

      // 2. Get sale items with product mapping
      const { data: saleItems, error: itemsError } = await supabase
        .from('sr_sale_items')
        .select('id, product_code, product_name, quantity, mapped_menu_item_id')
        .eq('sale_id', saleId);

      if (itemsError) {
        result.errors.push(`Failed to fetch sale items: ${itemsError.message}`);
        result.success = false;
        return result;
      }

      if (!saleItems || saleItems.length === 0) {
        result.warnings.push('Sale has no items');
        return result;
      }

      result.itemsProcessed = saleItems.length;
      console.log(
        `[RecipeDeduction] Found ${saleItems.length} items in sale`
      );

      // 3. Process each sale item
      for (const item of saleItems) {
        // Skip items without mapping
        if (!item.mapped_menu_item_id) {
          result.warnings.push(
            `Product ${item.product_name} (${item.product_code}) is not mapped to menu item`
          );
          continue;
        }

        // Deduce for this menu item
        const itemResult = await this.deduceForMenuItem({
          supabase,
          tenantId: sale.tenant_id,
          branchId: sale.branch_id,
          menuItemId: item.mapped_menu_item_id,
          quantitySold: item.quantity,
          saleId,
          allowNegativeStock,
        });

        result.itemResults.push(itemResult);

        // Aggregate results
        if (itemResult.ingredientsDeducted > 0) {
          result.itemsDeducted++;
        }

        result.totalIngredientsDeducted += itemResult.ingredientsDeducted;
        result.totalCostDeducted += itemResult.totalCostDeducted;
        result.movements.push(...itemResult.movements);
        result.errors.push(...itemResult.errors);
        result.warnings.push(...itemResult.warnings);

        if (!itemResult.success) {
          result.success = false;
        }
      }

      console.log(
        `[RecipeDeduction] Sale ${saleId} complete: ` +
          `${result.itemsDeducted}/${result.itemsProcessed} items deducted, ` +
          `${result.totalIngredientsDeducted} ingredients, ` +
          `cost: $${result.totalCostDeducted.toFixed(2)}`
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Unexpected error: ${errorMessage}`);
      result.success = false;
      console.error('[RecipeDeduction] Error:', error);
      return result;
    }
  }

  /**
   * Preview what would be deducted without applying changes (dry run)
   *
   * @param params - Preview parameters
   * @returns DeductionPreview with detailed breakdown
   */
  static async previewDeduction(
    params: DeductionPreviewParams
  ): Promise<DeductionPreview> {
    const { supabase, tenantId, branchId, menuItemId, quantitySold } = params;

    // Validate quantitySold parameter
    if (!quantitySold || quantitySold <= 0 || !Number.isFinite(quantitySold)) {
      return {
        menuItemId,
        menuItemName: '',
        recipeId: '',
        recipeName: '',
        yieldQuantity: 0,
        scaleFactor: 0,
        ingredients: [],
        totalCost: 0,
        hasErrors: true,
        errors: [`Invalid quantity sold: ${quantitySold}. Must be a positive number.`],
        warnings: [],
      };
    }

    const preview: DeductionPreview = {
      menuItemId,
      menuItemName: '',
      recipeId: '',
      recipeName: '',
      yieldQuantity: 1,
      scaleFactor: 1,
      ingredients: [],
      totalCost: 0,
      hasErrors: false,
      errors: [],
      warnings: [],
    };

    try {
      // 1. Get menu item
      const { data: menuItem, error: menuItemError } = await supabase
        .from('restaurant_menu_items')
        .select('name')
        .eq('id', menuItemId)
        .single();

      if (menuItemError || !menuItem) {
        preview.errors.push(`Menu item not found: ${menuItemId}`);
        preview.hasErrors = true;
        return preview;
      }

      preview.menuItemName = menuItem.name;

      // 2. Get recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('menu_item_recipes')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('menu_item_id', menuItemId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single();

      if (recipeError || !recipe) {
        preview.warnings.push(`No active recipe found for ${menuItem.name}`);
        return preview;
      }

      const typedRecipe = recipe as MenuItemRecipeEntity;
      preview.recipeId = typedRecipe.id;
      preview.recipeName = `Recipe for ${menuItem.name}`;
      preview.yieldQuantity = typedRecipe.yield_quantity;

      // Validate yield quantity
      if (!typedRecipe.yield_quantity || typedRecipe.yield_quantity <= 0) {
        preview.errors.push(
          `Invalid recipe yield quantity: ${typedRecipe.yield_quantity}`
        );
        preview.hasErrors = true;
        return preview;
      }

      preview.scaleFactor = quantitySold / typedRecipe.yield_quantity;

      // 3. Get ingredients
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', typedRecipe.id)
        .order('display_order', { ascending: true});

      if (ingredientsError) {
        preview.errors.push(`Failed to fetch ingredients: ${ingredientsError.message}`);
        preview.hasErrors = true;
        return preview;
      }

      const typedIngredients = (ingredients || []) as RecipeIngredientEntity[];

      if (typedIngredients.length === 0) {
        preview.warnings.push('Recipe has no ingredients');
        return preview;
      }

      // 4. Calculate for each ingredient (dry run)
      for (const ingredient of typedIngredients) {
        const deduction = await this.calculateIngredientDeduction(
          supabase,
          tenantId,
          branchId,
          ingredient,
          preview.scaleFactor
        );

        if (!deduction) {
          preview.errors.push(
            `Failed to calculate for ingredient ${ingredient.inventory_item_id}`
          );
          preview.hasErrors = true;
          continue;
        }

        preview.ingredients.push({
          ingredientId: deduction.ingredientId,
          ingredientName: deduction.ingredientName,
          quantityRequired: deduction.actualQuantity,
          unit: ingredient.unit,
          currentStock: deduction.currentStock,
          newStock: deduction.newStock,
          unitCost: deduction.unitCost,
          totalCost: deduction.totalCost,
          isLowStock: deduction.isLowStock,
          willBeNegative: deduction.willBeNegative,
          wastePercentage: (deduction.wasteMultiplier - 1) * 100,
        });

        preview.totalCost += deduction.totalCost;

        if (deduction.willBeNegative) {
          preview.warnings.push(
            `${deduction.ingredientName} will go negative: ${deduction.newStock}`
          );
        }
      }

      return preview;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      preview.errors.push(`Unexpected error: ${errorMessage}`);
      preview.hasErrors = true;
      return preview;
    }
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  /**
   * Calculate ingredient deduction with scaling and waste
   *
   * @private
   */
  private static async calculateIngredientDeduction(
    supabase: SupabaseClient,
    tenantId: string,
    branchId: string,
    ingredient: RecipeIngredientEntity,
    scaleFactor: number
  ): Promise<IngredientDeduction | null> {
    try {
      // Get current inventory item stock
      const { data: inventoryItem, error } = await supabase
        .from('inventory_items')
        .select('id, name, current_stock, minimum_stock, unit_cost')
        .eq('id', ingredient.inventory_item_id)
        .eq('tenant_id', tenantId)
        .or(`branch_id.eq.${branchId},branch_id.is.null`) // Item can be branch-specific or global
        .eq('is_active', true)
        .is('deleted_at', null)
        .single();

      if (error || !inventoryItem) {
        console.error(
          `[RecipeDeduction] Ingredient ${ingredient.inventory_item_id} not found in inventory`
        );
        return null;
      }

      const typedItem = inventoryItem as InventoryItemEntity;

      // Calculate quantities
      const baseQuantity = ingredient.quantity * scaleFactor;
      // Note: waste_percentage is not in recipe_ingredients table from migration 090
      // Using 0% waste for now (can be added later if needed)
      const wasteMultiplier = 1.0;
      const actualQuantity = baseQuantity * wasteMultiplier;
      const newStock = typedItem.current_stock - actualQuantity;

      return {
        ingredientId: typedItem.id,
        ingredientName: typedItem.name,
        baseQuantity,
        wasteMultiplier,
        actualQuantity,
        currentStock: typedItem.current_stock,
        newStock,
        unitCost: typedItem.unit_cost,
        totalCost: actualQuantity * typedItem.unit_cost,
        isLowStock: newStock <= typedItem.minimum_stock,
        willBeNegative: newStock < 0,
      };
    } catch (error) {
      console.error(
        '[RecipeDeduction] Error calculating ingredient deduction:',
        error
      );
      return null;
    }
  }
}

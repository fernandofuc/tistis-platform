// =====================================================
// TIS TIS PLATFORM - Inventory Movement Service
// Kardex management - registrar movimientos de inventario
// =====================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  RecordDeductionParams,
  RecordAdjustmentParams,
  GetMovementHistoryParams,
  MovementHistoryResult,
  InventoryMovementEntity,
  MovementType,
} from '../types/inventory.types';

// =====================================================
// SERVICE CLASS
// =====================================================

export class InventoryMovementService {
  /**
   * Record a deduction movement (consumption from sale)
   * Creates an inventory_movements record with negative quantity
   *
   * @param params - Deduction recording parameters
   * @returns InventoryMovementEntity - The created movement record
   */
  static async recordDeduction(
    params: RecordDeductionParams
  ): Promise<InventoryMovementEntity> {
    const {
      supabase,
      tenantId,
      branchId,
      itemId,
      quantity,
      previousStock,
      newStock,
      unitCost,
      referenceType,
      referenceId,
      notes,
      performedBy,
    } = params;

    console.log(
      `[InventoryMovement] Recording deduction for item ${itemId}: ${quantity} units`
    );

    try {
      // Ensure quantity is negative (deduction = salida)
      const deductionQuantity = quantity > 0 ? -quantity : quantity;

      const movementData = {
        tenant_id: tenantId,
        branch_id: branchId,
        item_id: itemId,
        movement_type: 'consumption' as MovementType,
        quantity: deductionQuantity,
        previous_stock: previousStock,
        new_stock: newStock,
        unit_cost: unitCost,
        total_cost: Math.abs(deductionQuantity) * unitCost,
        reference_type: referenceType,
        reference_id: referenceId,
        performed_by: performedBy || null,
        reason: 'Recipe ingredient deduction',
        notes: notes || null,
        performed_at: new Date().toISOString(),
        metadata: {},
      };

      const { data: movement, error } = await supabase
        .from('inventory_movements')
        .insert(movementData)
        .select()
        .single();

      if (error) {
        console.error('[InventoryMovement] Error recording deduction:', error);
        throw new Error(`Failed to record deduction: ${error.message}`);
      }

      console.log(
        `[InventoryMovement] Deduction recorded: ${movement.id} (${previousStock} → ${newStock})`
      );

      return movement as InventoryMovementEntity;
    } catch (error) {
      console.error('[InventoryMovement] Error:', error);
      throw error;
    }
  }

  /**
   * Record an adjustment movement (manual inventory correction)
   *
   * @param params - Adjustment recording parameters
   * @returns InventoryMovementEntity - The created movement record
   */
  static async recordAdjustment(
    params: RecordAdjustmentParams
  ): Promise<InventoryMovementEntity> {
    const {
      supabase,
      tenantId,
      branchId,
      itemId,
      quantity,
      reason,
      notes,
      performedBy,
    } = params;

    console.log(
      `[InventoryMovement] Recording adjustment for item ${itemId}: ${quantity} units`
    );

    try {
      // Get current stock with full validation
      const { data: item, error: itemError } = await supabase
        .from('inventory_items')
        .select('current_stock, branch_id, is_active, deleted_at')
        .eq('id', itemId)
        .eq('tenant_id', tenantId)
        .single();

      if (itemError || !item) {
        throw new Error(`Item not found: ${itemId}`);
      }

      // Validate item is active and not deleted
      if (!item.is_active || item.deleted_at) {
        throw new Error(`Item ${itemId} is not active or has been deleted`);
      }

      // Validate branch_id matches (if item is branch-specific)
      if (item.branch_id && item.branch_id !== branchId) {
        throw new Error(`Item ${itemId} belongs to different branch`);
      }

      const previousStock = item.current_stock;
      const newStock = previousStock + quantity;

      // Update inventory stock with optimistic locking
      const { data: updateData, error: updateError } = await supabase
        .from('inventory_items')
        .update({
          current_stock: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('tenant_id', tenantId)
        .eq('current_stock', previousStock) // Optimistic locking
        .select();

      if (updateError) {
        throw new Error(`Failed to update stock: ${updateError.message}`);
      }

      // Validate update affected exactly 1 row
      if (!updateData || updateData.length === 0) {
        throw new Error(`Stock update failed: current stock may have changed`);
      }

      // Record movement
      const movementData = {
        tenant_id: tenantId,
        branch_id: branchId,
        item_id: itemId,
        movement_type: 'adjustment' as MovementType,
        quantity: quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        unit_cost: null,
        total_cost: null,
        reference_type: 'manual_adjustment',
        reference_id: null,
        performed_by: performedBy,
        reason: reason,
        notes: notes || null,
        performed_at: new Date().toISOString(),
        metadata: {},
      };

      const { data: movement, error: movementError } = await supabase
        .from('inventory_movements')
        .insert(movementData)
        .select()
        .single();

      if (movementError) {
        console.error('[InventoryMovement] Error recording adjustment:', movementError);
        throw new Error(`Failed to record adjustment: ${movementError.message}`);
      }

      console.log(
        `[InventoryMovement] Adjustment recorded: ${movement.id} (${previousStock} → ${newStock})`
      );

      return movement as InventoryMovementEntity;
    } catch (error) {
      console.error('[InventoryMovement] Error:', error);
      throw error;
    }
  }

  /**
   * Get movement history with filtering and pagination
   *
   * @param params - Query parameters
   * @returns MovementHistoryResult with movements and pagination info
   */
  static async getMovementHistory(
    params: GetMovementHistoryParams
  ): Promise<MovementHistoryResult> {
    const {
      supabase,
      tenantId,
      branchId,
      itemId,
      startDate,
      endDate,
      movementType,
      limit = 50,
      offset = 0,
    } = params;

    console.log('[InventoryMovement] Fetching movement history:', {
      tenantId,
      branchId,
      itemId,
      movementType,
    });

    try {
      // Build query
      let query = supabase
        .from('inventory_movements')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId);

      // Apply filters
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      if (itemId) {
        query = query.eq('item_id', itemId);
      }

      if (startDate) {
        query = query.gte('performed_at', startDate);
      }

      if (endDate) {
        query = query.lte('performed_at', endDate);
      }

      if (movementType) {
        query = query.eq('movement_type', movementType);
      }

      // Apply pagination and ordering
      query = query
        .order('performed_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Execute query
      const { data: movements, error, count } = await query;

      if (error) {
        console.error('[InventoryMovement] Error fetching history:', error);
        throw new Error(`Failed to fetch movement history: ${error.message}`);
      }

      const totalCount = count || 0;
      const page = Math.floor(offset / limit) + 1;

      console.log(
        `[InventoryMovement] Fetched ${movements?.length || 0}/${totalCount} movements (page ${page})`
      );

      return {
        movements: (movements || []) as InventoryMovementEntity[],
        totalCount,
        page,
        pageSize: limit,
      };
    } catch (error) {
      console.error('[InventoryMovement] Error:', error);
      throw error;
    }
  }

  /**
   * Get movements for a specific reference (e.g., all movements from a sale)
   *
   * @param supabase - Supabase client
   * @param referenceType - Type of reference (sr_sale, restaurant_order, etc)
   * @param referenceId - ID of the referenced entity
   * @returns Array of InventoryMovementEntity
   */
  static async getMovementsByReference(
    supabase: SupabaseClient,
    referenceType: string,
    referenceId: string
  ): Promise<InventoryMovementEntity[]> {
    console.log(
      `[InventoryMovement] Fetching movements for ${referenceType}:${referenceId}`
    );

    try {
      const { data: movements, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('reference_type', referenceType)
        .eq('reference_id', referenceId)
        .order('performed_at', { ascending: true });

      if (error) {
        console.error('[InventoryMovement] Error fetching by reference:', error);
        throw new Error(`Failed to fetch movements: ${error.message}`);
      }

      console.log(
        `[InventoryMovement] Found ${movements?.length || 0} movements for ${referenceType}:${referenceId}`
      );

      return (movements || []) as InventoryMovementEntity[];
    } catch (error) {
      console.error('[InventoryMovement] Error:', error);
      throw error;
    }
  }

  /**
   * Get total quantity moved for an item in a date range
   * Useful for analytics and reporting
   *
   * @param supabase - Supabase client
   * @param tenantId - Tenant ID
   * @param itemId - Inventory item ID
   * @param startDate - Start date (ISO string)
   * @param endDate - End date (ISO string)
   * @param movementType - Optional: filter by movement type
   * @returns Object with total in/out quantities
   */
  static async getTotalMovementQuantity(
    supabase: SupabaseClient,
    tenantId: string,
    itemId: string,
    startDate: string,
    endDate: string,
    movementType?: MovementType
  ): Promise<{ totalIn: number; totalOut: number; net: number }> {
    console.log(
      `[InventoryMovement] Calculating total movement for item ${itemId}`
    );

    try {
      let query = supabase
        .from('inventory_movements')
        .select('quantity')
        .eq('tenant_id', tenantId)
        .eq('item_id', itemId)
        .gte('performed_at', startDate)
        .lte('performed_at', endDate);

      if (movementType) {
        query = query.eq('movement_type', movementType);
      }

      const { data: movements, error } = await query;

      if (error) {
        throw new Error(`Failed to calculate totals: ${error.message}`);
      }

      let totalIn = 0;
      let totalOut = 0;

      for (const movement of movements || []) {
        if (movement.quantity > 0) {
          totalIn += movement.quantity;
        } else {
          totalOut += Math.abs(movement.quantity);
        }
      }

      const net = totalIn - totalOut;

      console.log(
        `[InventoryMovement] Totals for item ${itemId}: In=${totalIn}, Out=${totalOut}, Net=${net}`
      );

      return { totalIn, totalOut, net };
    } catch (error) {
      console.error('[InventoryMovement] Error calculating totals:', error);
      throw error;
    }
  }
}

// =====================================================
// TIS TIS PLATFORM - Low Stock Alert Service
// Detectar y alertar sobre inventario bajo
// =====================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CheckAfterDeductionParams,
  CheckAllInventoryParams,
  CreateLowStockAlertParams,
  GetActiveAlertsParams,
  LowStockCheckResult,
  LowStockAlert,
  LowStockItem,
  InventoryItemEntity,
} from '../types/inventory.types';

// =====================================================
// SERVICE CLASS
// =====================================================

export class LowStockAlertService {
  /**
   * Check for low stock after inventory deduction
   * Only checks specific items that were deducted
   *
   * @param params - Check parameters
   * @returns LowStockCheckResult with low stock items detected
   */
  static async checkAfterDeduction(
    params: CheckAfterDeductionParams
  ): Promise<LowStockCheckResult> {
    const { supabase, tenantId, branchId, itemIds } = params;

    console.log(
      `[LowStockAlert] Checking ${itemIds.length} items after deduction`
    );

    const result: LowStockCheckResult = {
      itemsChecked: itemIds.length,
      lowStockItems: [],
      alertsCreated: 0,
      criticalCount: 0,
      warningCount: 0,
      lowCount: 0,
    };

    try {
      if (itemIds.length === 0) {
        return result;
      }

      // Get inventory items
      const { data: items, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku, current_stock, minimum_stock, reorder_quantity, unit')
        .in('id', itemIds)
        .eq('tenant_id', tenantId)
        .or(`branch_id.eq.${branchId},branch_id.is.null`)
        .eq('is_active', true)
        .eq('is_trackable', true)
        .is('deleted_at', null);

      if (error) {
        console.error('[LowStockAlert] Error fetching items:', error);
        throw new Error(`Failed to check stock: ${error.message}`);
      }

      const typedItems = (items || []) as InventoryItemEntity[];

      // Check each item
      for (const item of typedItems) {
        if (item.current_stock <= item.minimum_stock) {
          const lowStockItem = this.createLowStockItem(item);
          result.lowStockItems.push(lowStockItem);

          // Count by severity
          if (lowStockItem.severity === 'critical') {
            result.criticalCount++;
          } else if (lowStockItem.severity === 'warning') {
            result.warningCount++;
          } else {
            result.lowCount++;
          }

          // Create alert/notification (simplified - just log for now)
          // In production, this would create a notification in a notifications table
          await this.logLowStockAlert(
            supabase,
            tenantId,
            branchId,
            lowStockItem
          );
          result.alertsCreated++;

          console.log(
            `[LowStockAlert] ${lowStockItem.severity.toUpperCase()}: ` +
              `${item.name} - ${item.current_stock} ${item.unit} ` +
              `(minimum: ${item.minimum_stock})`
          );
        }
      }

      console.log(
        `[LowStockAlert] Check complete: ${result.lowStockItems.length} low stock items ` +
          `(Critical: ${result.criticalCount}, Warning: ${result.warningCount}, Low: ${result.lowCount})`
      );

      return result;
    } catch (error) {
      console.error('[LowStockAlert] Error:', error);
      throw error;
    }
  }

  /**
   * Check all inventory in a branch for low stock
   * More comprehensive than checkAfterDeduction
   *
   * @param params - Check parameters
   * @returns LowStockCheckResult with all low stock items
   */
  static async checkAllInventory(
    params: CheckAllInventoryParams
  ): Promise<LowStockCheckResult> {
    const { supabase, tenantId, branchId } = params;

    console.log(
      `[LowStockAlert] Checking all inventory for tenant ${tenantId}, branch ${branchId}`
    );

    const result: LowStockCheckResult = {
      itemsChecked: 0,
      lowStockItems: [],
      alertsCreated: 0,
      criticalCount: 0,
      warningCount: 0,
      lowCount: 0,
    };

    try {
      // Get all trackable inventory items
      const { data: items, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku, current_stock, minimum_stock, reorder_quantity, unit')
        .eq('tenant_id', tenantId)
        .or(`branch_id.eq.${branchId},branch_id.is.null`)
        .eq('is_active', true)
        .eq('is_trackable', true)
        .is('deleted_at', null);

      if (error) {
        console.error('[LowStockAlert] Error fetching items:', error);
        throw new Error(`Failed to check inventory: ${error.message}`);
      }

      const typedItems = (items || []) as InventoryItemEntity[];
      result.itemsChecked = typedItems.length;

      // Check each item
      for (const item of typedItems) {
        if (item.current_stock <= item.minimum_stock) {
          const lowStockItem = this.createLowStockItem(item);
          result.lowStockItems.push(lowStockItem);

          // Count by severity
          if (lowStockItem.severity === 'critical') {
            result.criticalCount++;
          } else if (lowStockItem.severity === 'warning') {
            result.warningCount++;
          } else {
            result.lowCount++;
          }
        }
      }

      console.log(
        `[LowStockAlert] Checked ${result.itemsChecked} items, ` +
          `found ${result.lowStockItems.length} low stock ` +
          `(Critical: ${result.criticalCount}, Warning: ${result.warningCount}, Low: ${result.lowCount})`
      );

      return result;
    } catch (error) {
      console.error('[LowStockAlert] Error:', error);
      throw error;
    }
  }

  /**
   * Create a low stock alert/notification
   * In production, this would insert into a notifications table
   *
   * @param params - Alert creation parameters
   * @returns LowStockAlert (simplified version)
   */
  static async createAlert(
    params: CreateLowStockAlertParams
  ): Promise<LowStockAlert> {
    const { supabase, tenantId, branchId, itemId, currentStock, minimumStock } =
      params;

    console.log(`[LowStockAlert] Creating alert for item ${itemId}`);

    try {
      // Get item details
      const { data: item, error } = await supabase
        .from('inventory_items')
        .select('name')
        .eq('id', itemId)
        .single();

      if (error || !item) {
        throw new Error(`Item not found: ${itemId}`);
      }

      // Calculate severity (guard against division by zero)
      let severity: 'critical' | 'warning' | 'low' = 'low';
      if (minimumStock <= 0) {
        // Invalid minimum stock - always critical
        severity = 'critical';
      } else {
        const percentageRemaining = (currentStock / minimumStock) * 100;
        if (percentageRemaining < 50) {
          severity = 'critical';
        } else if (percentageRemaining < 75) {
          severity = 'warning';
        }
      }

      // In production, this would insert into notifications or alerts table
      // For now, just return the alert object
      const alert: LowStockAlert = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        branch_id: branchId,
        item_id: itemId,
        item_name: item.name,
        current_stock: currentStock,
        minimum_stock: minimumStock,
        severity,
        status: 'active',
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      console.log(
        `[LowStockAlert] Alert created: ${alert.item_name} (${severity})`
      );

      return alert;
    } catch (error) {
      console.error('[LowStockAlert] Error creating alert:', error);
      throw error;
    }
  }

  /**
   * Get active low stock alerts for a tenant/branch
   * In production, this would query a notifications table
   *
   * @param params - Query parameters
   * @returns Array of LowStockAlert
   */
  static async getActiveAlerts(
    params: GetActiveAlertsParams
  ): Promise<LowStockAlert[]> {
    const { supabase, tenantId, branchId } = params;

    console.log(
      `[LowStockAlert] Fetching active alerts for tenant ${tenantId}`
    );

    try {
      // Get all low stock items (active alerts)
      let query = supabase
        .from('inventory_items')
        .select('id, name, current_stock, minimum_stock')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('is_trackable', true)
        .is('deleted_at', null);

      if (branchId) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }

      const { data: items, error } = await query;

      if (error) {
        console.error('[LowStockAlert] Error fetching alerts:', error);
        throw new Error(`Failed to fetch alerts: ${error.message}`);
      }

      const typedItems = (items || []) as InventoryItemEntity[];

      // Filter to only low stock items and convert to alerts
      const alerts: LowStockAlert[] = [];

      for (const item of typedItems) {
        if (item.current_stock <= item.minimum_stock) {
          // Calculate severity (guard against division by zero)
          let severity: 'critical' | 'warning' | 'low' = 'low';
          if (item.minimum_stock <= 0) {
            // Invalid minimum stock - always critical
            severity = 'critical';
          } else {
            const percentageRemaining = (item.current_stock / item.minimum_stock) * 100;
            if (percentageRemaining < 50) {
              severity = 'critical';
            } else if (percentageRemaining < 75) {
              severity = 'warning';
            }
          }

          alerts.push({
            id: item.id,
            tenant_id: tenantId,
            branch_id: branchId || '',
            item_id: item.id,
            item_name: item.name,
            current_stock: item.current_stock,
            minimum_stock: item.minimum_stock,
            severity,
            status: 'active',
            created_at: new Date().toISOString(),
            resolved_at: null,
          });
        }
      }

      console.log(
        `[LowStockAlert] Found ${alerts.length} active alerts`
      );

      return alerts;
    } catch (error) {
      console.error('[LowStockAlert] Error:', error);
      throw error;
    }
  }

  // =====================================================
  // PRIVATE HELPER METHODS
  // =====================================================

  /**
   * Create LowStockItem from InventoryItemEntity
   *
   * @private
   */
  private static createLowStockItem(item: InventoryItemEntity): LowStockItem {
    // Guard against division by zero
    if (item.minimum_stock <= 0) {
      // If minimum_stock is 0 or negative, always critical
      return {
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        currentStock: item.current_stock,
        minimumStock: item.minimum_stock,
        reorderQuantity: item.reorder_quantity,
        unit: item.unit,
        percentageRemaining: 0,
        severity: 'critical',
      };
    }

    const percentageRemaining = (item.current_stock / item.minimum_stock) * 100;

    let severity: 'critical' | 'warning' | 'low' = 'low';
    if (percentageRemaining < 50) {
      severity = 'critical'; // Less than 50% of minimum stock
    } else if (percentageRemaining < 75) {
      severity = 'warning'; // Between 50-75% of minimum stock
    }
    // else: 'low' (75-100% of minimum stock)

    return {
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      currentStock: item.current_stock,
      minimumStock: item.minimum_stock,
      reorderQuantity: item.reorder_quantity,
      unit: item.unit,
      percentageRemaining: Math.round(percentageRemaining),
      severity,
    };
  }

  /**
   * Log low stock alert (simplified - just console for now)
   * In production, this would:
   * - Insert into notifications table
   * - Send email/SMS/push notification
   * - Create task for purchasing team
   *
   * @private
   */
  private static async logLowStockAlert(
    supabase: SupabaseClient,
    tenantId: string,
    branchId: string,
    item: LowStockItem
  ): Promise<void> {
    // In production, insert into notifications table here
    // For now, just log to console

    console.log(`[LowStockAlert] 🔔 ALERT: Low stock detected`, {
      tenant: tenantId,
      branch: branchId,
      item: item.itemName,
      sku: item.sku,
      current: `${item.currentStock} ${item.unit}`,
      minimum: `${item.minimumStock} ${item.unit}`,
      severity: item.severity,
      reorderQty: item.reorderQuantity,
    });

    // TODO: In FASE 4, implement actual notification system
    // - Insert into notifications table
    // - Trigger email/SMS via queue
    // - Create purchase order suggestion
  }
}

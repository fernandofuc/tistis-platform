// =====================================================
// TIS TIS PLATFORM - Low Stock Alerts API
// GET: List alerts, POST: Create alert (manual/auto)
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
} from '@/src/lib/api/auth-helper';

// ======================
// GET - List Low Stock Alerts
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get('branch_id');
    const status = searchParams.get('status');
    const alertType = searchParams.get('alert_type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeResolved = searchParams.get('include_resolved') === 'true';

    // Validate optional UUID params
    if (branchId && !isValidUUID(branchId)) {
      return errorResponse('ID de sucursal inválido', 400);
    }

    let query = supabase
      .from('low_stock_alerts')
      .select(`
        *,
        item:inventory_items(
          id,
          name,
          sku,
          unit,
          current_stock,
          minimum_stock,
          preferred_supplier_id,
          reorder_quantity,
          category:inventory_categories(id, name)
        ),
        suggested_supplier:inventory_suppliers(id, name, whatsapp, phone),
        associated_order:restock_orders(id, order_number, status)
      `)
      .eq('tenant_id', userRole.tenant_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (status) {
      query = query.eq('status', status);
    } else if (!includeResolved) {
      // Por defecto excluir resueltas
      query = query.in('status', ['open', 'acknowledged', 'ordered']);
    }

    if (alertType) {
      query = query.eq('alert_type', alertType);
    }

    const { data: alerts, error } = await query;

    if (error) {
      console.error('Error fetching alerts:', error);
      return errorResponse('Error al obtener alertas', 500);
    }

    return successResponse(alerts);

  } catch (error) {
    console.error('Get alerts error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Alert or Scan for Low Stock
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    const body = await request.json();
    const { action, branch_id } = body;

    // Validate branch_id
    if (branch_id && !isValidUUID(branch_id)) {
      return errorResponse('ID de sucursal inválido', 400);
    }

    // Acción especial: escanear inventario y crear alertas automáticamente
    if (action === 'scan') {
      if (!branch_id) {
        return errorResponse('branch_id es requerido para escanear', 400);
      }

      // Obtener items con stock bajo
      const { data: lowStockItems, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, name, current_stock, minimum_stock, preferred_supplier_id, reorder_quantity')
        .eq('tenant_id', userRole.tenant_id)
        .eq('branch_id', branch_id)
        .eq('is_active', true)
        .is('deleted_at', null);

      if (itemsError) {
        console.error('Error scanning items:', itemsError);
        return errorResponse('Error al escanear inventario', 500);
      }

      // Filtrar items con stock bajo
      const itemsBelowMinimum = (lowStockItems || []).filter(
        item => item.current_stock !== null &&
                item.minimum_stock !== null &&
                item.current_stock <= item.minimum_stock
      );

      // Obtener alertas existentes abiertas para estos items
      const existingAlertsQuery = await supabase
        .from('low_stock_alerts')
        .select('item_id')
        .eq('tenant_id', userRole.tenant_id)
        .eq('branch_id', branch_id)
        .in('status', ['open', 'acknowledged', 'ordered']);

      const existingAlertItemIds = new Set(
        (existingAlertsQuery.data || []).map(a => a.item_id)
      );

      // Crear alertas solo para items sin alerta existente
      const newAlerts = [];
      for (const item of itemsBelowMinimum) {
        if (!existingAlertItemIds.has(item.id)) {
          const alertType = item.current_stock <= (item.minimum_stock * 0.25) ? 'critical' : 'warning';
          const suggestedQuantity = item.reorder_quantity ||
            (item.minimum_stock - item.current_stock + (item.minimum_stock * 0.5));

          newAlerts.push({
            tenant_id: userRole.tenant_id,
            branch_id,
            item_id: item.id,
            alert_type: alertType,
            status: 'open',
            current_stock: item.current_stock,
            minimum_stock: item.minimum_stock,
            suggested_supplier_id: item.preferred_supplier_id,
            suggested_quantity: suggestedQuantity,
          });
        }
      }

      if (newAlerts.length > 0) {
        const { error: insertError } = await supabase
          .from('low_stock_alerts')
          .insert(newAlerts);

        if (insertError) {
          console.error('Error creating alerts:', insertError);
          return errorResponse('Error al crear alertas', 500);
        }
      }

      return successResponse({
        scanned_items: lowStockItems?.length || 0,
        items_below_minimum: itemsBelowMinimum.length,
        new_alerts_created: newAlerts.length,
        existing_alerts: existingAlertItemIds.size,
      });
    }

    // Crear alerta manual
    const {
      item_id,
      current_stock,
      minimum_stock,
      alert_type = 'warning',
      suggested_supplier_id,
      suggested_quantity,
    } = body;

    // Validate required fields
    if (!branch_id) {
      return errorResponse('ID de sucursal es requerido', 400);
    }
    if (!item_id || !isValidUUID(item_id)) {
      return errorResponse('ID de artículo inválido', 400);
    }
    if (current_stock === undefined || typeof current_stock !== 'number') {
      return errorResponse('Stock actual es requerido', 400);
    }
    if (minimum_stock === undefined || typeof minimum_stock !== 'number') {
      return errorResponse('Stock mínimo es requerido', 400);
    }
    if (!['warning', 'critical'].includes(alert_type)) {
      return errorResponse('Tipo de alerta inválido', 400);
    }

    const { data: alert, error } = await supabase
      .from('low_stock_alerts')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        item_id,
        alert_type,
        status: 'open',
        current_stock,
        minimum_stock,
        suggested_supplier_id,
        suggested_quantity,
      })
      .select(`
        *,
        item:inventory_items(id, name, sku, unit)
      `)
      .single();

    if (error) {
      console.error('Error creating alert:', error);
      return errorResponse('Error al crear alerta', 500);
    }

    return successResponse(alert, 201);

  } catch (error) {
    console.error('Create alert error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// =====================================================
// TIS TIS PLATFORM - Restock Orders API
// GET: List restock orders, POST: Create restock order
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
  canWrite,
} from '@/src/lib/api/auth-helper';

// ======================
// GET - List Restock Orders
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
    const supplierId = searchParams.get('supplier_id');
    const triggerSource = searchParams.get('trigger_source');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('restock_orders')
      .select(`
        *,
        supplier:inventory_suppliers(id, name, whatsapp, contact_name, phone),
        items:restock_order_items(
          id,
          inventory_item_id,
          quantity_requested,
          quantity_received,
          unit,
          unit_cost,
          total_cost,
          status,
          item:inventory_items(id, name, sku, unit)
        ),
        created_by_user:auth.users!restock_orders_created_by_fkey(email),
        authorized_by_user:auth.users!restock_orders_authorized_by_fkey(email)
      `)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    if (triggerSource) {
      query = query.eq('trigger_source', triggerSource);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching restock orders:', error);
      return errorResponse('Error al obtener órdenes de reabastecimiento', 500);
    }

    return successResponse(orders);

  } catch (error) {
    console.error('Get restock orders error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Restock Order
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { user, userRole, supabase } = auth;

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para crear órdenes de reabastecimiento', 403);
    }

    const body = await request.json();
    const {
      branch_id,
      supplier_id,
      trigger_source = 'manual',
      triggered_by_alert_ids = [],
      expected_delivery_date,
      internal_notes,
      supplier_notes,
      items = [],
    } = body;

    // Validaciones robustas
    if (!branch_id || !isValidUUID(branch_id)) {
      return errorResponse('ID de sucursal inválido', 400);
    }

    if (!supplier_id || !isValidUUID(supplier_id)) {
      return errorResponse('ID de proveedor inválido', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('Se requiere al menos un artículo', 400);
    }

    // Validar cada item
    for (const item of items) {
      if (!item.inventory_item_id || !isValidUUID(item.inventory_item_id)) {
        return errorResponse('ID de artículo inválido en la lista', 400);
      }
      if (typeof item.quantity_requested !== 'number' || item.quantity_requested <= 0) {
        return errorResponse('Cantidad solicitada debe ser un número positivo', 400);
      }
    }

    // Validar trigger_source
    if (!['auto', 'manual', 'alert'].includes(trigger_source)) {
      return errorResponse('Fuente de orden inválida', 400);
    }

    // Crear la orden (order_number se genera automáticamente via trigger)
    const { data: order, error: orderError } = await supabase
      .from('restock_orders')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        supplier_id,
        status: 'draft',
        trigger_source,
        triggered_by_alert_ids,
        created_by: user.id,
        expected_delivery_date,
        internal_notes,
        supplier_notes,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Error creating restock order:', orderError);
      return errorResponse('Error al crear orden de reabastecimiento', 500);
    }

    // Insertar los items de la orden
    const orderItems = items.map((item: {
      inventory_item_id: string;
      quantity_requested: number;
      unit: string;
      unit_cost?: number;
      notes?: string;
    }) => ({
      tenant_id: userRole.tenant_id,
      restock_order_id: order.id,
      inventory_item_id: item.inventory_item_id,
      quantity_requested: item.quantity_requested,
      unit: item.unit,
      unit_cost: item.unit_cost || 0,
      notes: item.notes,
    }));

    const { error: itemsError } = await supabase
      .from('restock_order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Intentar eliminar la orden creada
      await supabase.from('restock_orders').delete().eq('id', order.id);
      return errorResponse('Error al crear artículos de la orden', 500);
    }

    // Si vino de alertas, actualizar el estado de las alertas
    if (triggered_by_alert_ids && triggered_by_alert_ids.length > 0) {
      await supabase
        .from('low_stock_alerts')
        .update({
          status: 'ordered',
          associated_order_id: order.id,
          updated_at: new Date().toISOString(),
        })
        .in('id', triggered_by_alert_ids);
    }

    // Obtener la orden completa con relaciones
    const { data: fullOrder, error: fetchError } = await supabase
      .from('restock_orders')
      .select(`
        *,
        supplier:inventory_suppliers(id, name, whatsapp, contact_name, phone),
        items:restock_order_items(
          id,
          inventory_item_id,
          quantity_requested,
          quantity_received,
          unit,
          unit_cost,
          total_cost,
          status,
          item:inventory_items(id, name, sku, unit)
        )
      `)
      .eq('id', order.id)
      .single();

    if (fetchError) {
      console.error('Error fetching created order:', fetchError);
      // La orden se creó, devolver lo que tenemos
      return successResponse(order, 201);
    }

    return successResponse(fullOrder, 201);

  } catch (error) {
    console.error('Create restock order error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

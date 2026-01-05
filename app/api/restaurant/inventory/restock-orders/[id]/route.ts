// =====================================================
// TIS TIS PLATFORM - Restock Order Detail API
// GET: Get order, PUT: Update order, DELETE: Cancel order
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  successMessage,
  isValidUUID,
  canWrite,
  canDelete,
  hasMinRole,
} from '@/src/lib/api/auth-helper';

// ======================
// GET - Get Restock Order
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de orden inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    const { data: order, error } = await supabase
      .from('restock_orders')
      .select(`
        *,
        supplier:inventory_suppliers(id, name, whatsapp, contact_name, phone, email),
        items:restock_order_items(
          id,
          inventory_item_id,
          quantity_requested,
          quantity_received,
          unit,
          unit_cost,
          total_cost,
          status,
          notes,
          item:inventory_items(id, name, sku, unit, current_stock)
        ),
        branch:branches(id, name)
      `)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (error || !order) {
      return errorResponse('Orden no encontrada', 404);
    }

    return successResponse(order);

  } catch (error) {
    console.error('Get restock order error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// PUT - Update Restock Order
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de orden inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { user, userRole, supabase } = auth;

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para actualizar órdenes', 403);
    }

    const body = await request.json();
    const { action, ...updateData } = body;

    // Obtener la orden actual
    const { data: currentOrder, error: fetchError } = await supabase
      .from('restock_orders')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !currentOrder) {
      return errorResponse('Orden no encontrada', 404);
    }

    // Manejar acciones específicas
    if (action) {
      switch (action) {
        case 'authorize':
          if (!hasMinRole(userRole.role, 'admin')) {
            return errorResponse('Sin permisos para autorizar órdenes', 403);
          }
          updateData.status = 'authorized';
          updateData.authorized_by = user.id;
          updateData.authorized_at = new Date().toISOString();
          break;

        case 'place':
          if (currentOrder.status !== 'authorized') {
            return errorResponse('La orden debe estar autorizada para enviarla', 400);
          }
          updateData.status = 'placed';
          break;

        case 'mark_whatsapp_sent':
          updateData.whatsapp_sent = true;
          updateData.whatsapp_sent_at = new Date().toISOString();
          if (body.whatsapp_message_id) {
            updateData.whatsapp_message_id = body.whatsapp_message_id;
          }
          break;

        case 'receive':
          updateData.status = 'received';
          updateData.received_by = user.id;
          updateData.received_at = new Date().toISOString();
          updateData.actual_delivery_date = new Date().toISOString().split('T')[0];
          break;

        case 'partial_receive':
          updateData.status = 'partial';
          break;

        case 'cancel':
          if (!['draft', 'pending', 'authorized'].includes(currentOrder.status)) {
            return errorResponse('No se puede cancelar una orden ya enviada', 400);
          }
          updateData.status = 'cancelled';
          break;

        default:
          return errorResponse('Acción no válida', 400);
      }
    }

    // Actualizar la orden
    const { data: order, error } = await supabase
      .from('restock_orders')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
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
      .single();

    if (error || !order) {
      console.error('Error updating restock order:', error);
      return errorResponse('Error al actualizar orden', 500);
    }

    // Si se recibió la orden, actualizar el inventario usando RPC transaccional
    if (action === 'receive') {
      const { data: items } = await supabase
        .from('restock_order_items')
        .select('inventory_item_id, quantity_requested, unit_cost')
        .eq('restock_order_id', id);

      if (items && items.length > 0) {
        // Usar RPC para procesar la recepción de forma transaccional
        const { error: receiveError } = await supabase.rpc('process_restock_order_receipt', {
          p_order_id: id,
          p_tenant_id: userRole.tenant_id,
          p_branch_id: currentOrder.branch_id,
          p_user_id: user.id,
          p_alert_ids: currentOrder.triggered_by_alert_ids || [],
        });

        if (receiveError) {
          console.error('Error processing order receipt:', receiveError);
          // Revertir el estado de la orden si falla
          await supabase
            .from('restock_orders')
            .update({ status: currentOrder.status })
            .eq('id', id);
          return errorResponse('Error al procesar recepción de inventario', 500);
        }
      }
    }

    return successResponse(order);

  } catch (error) {
    console.error('Update restock order error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// DELETE - Soft Delete Restock Order
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de orden inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canDelete(userRole.role)) {
      return errorResponse('Sin permisos para eliminar órdenes', 403);
    }

    // Verificar que la orden existe y está en estado eliminable
    const { data: currentOrder, error: fetchError } = await supabase
      .from('restock_orders')
      .select('status')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !currentOrder) {
      return errorResponse('Orden no encontrada', 404);
    }

    if (!['draft', 'cancelled'].includes(currentOrder.status)) {
      return errorResponse('Solo se pueden eliminar órdenes en borrador o canceladas', 400);
    }

    const { error } = await supabase
      .from('restock_orders')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('Error deleting restock order:', error);
      return errorResponse('Error al eliminar orden', 500);
    }

    return successMessage('Orden eliminada');

  } catch (error) {
    console.error('Delete restock order error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

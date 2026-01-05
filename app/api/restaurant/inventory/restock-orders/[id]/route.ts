// =====================================================
// TIS TIS PLATFORM - Restock Order Detail API
// GET: Get order, PUT: Update order, DELETE: Cancel order
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getUserAndTenant(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', status: 401 };
  }
  const token = authHeader.substring(7);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { error: 'Token inválido', status: 401 };
  }

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!userRole) {
    return { error: 'Sin tenant asociado', status: 403 };
  }

  return { user, userRole, supabase };
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

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
      return NextResponse.json({ success: false, error: 'ID de orden inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

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
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: order });

  } catch (error) {
    console.error('Get restock order error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
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
      return NextResponse.json({ success: false, error: 'ID de orden inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { user, userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para actualizar órdenes' }, { status: 403 });
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
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
    }

    // Manejar acciones específicas
    if (action) {
      switch (action) {
        case 'authorize':
          if (!['owner', 'admin'].includes(userRole.role)) {
            return NextResponse.json({ success: false, error: 'Sin permisos para autorizar órdenes' }, { status: 403 });
          }
          updateData.status = 'authorized';
          updateData.authorized_by = user.id;
          updateData.authorized_at = new Date().toISOString();
          break;

        case 'place':
          if (currentOrder.status !== 'authorized') {
            return NextResponse.json({ success: false, error: 'La orden debe estar autorizada para enviarla' }, { status: 400 });
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
            return NextResponse.json({ success: false, error: 'No se puede cancelar una orden ya enviada' }, { status: 400 });
          }
          updateData.status = 'cancelled';
          break;

        default:
          return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
      }
    }

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
      return NextResponse.json({ success: false, error: 'Error al actualizar orden' }, { status: 500 });
    }

    // Si se recibió la orden, actualizar el inventario
    if (action === 'receive') {
      const { data: items } = await supabase
        .from('restock_order_items')
        .select('inventory_item_id, quantity_requested, unit_cost')
        .eq('restock_order_id', id);

      if (items && items.length > 0) {
        for (const item of items) {
          // Crear movimiento de inventario por cada item
          await supabase.from('inventory_movements').insert({
            tenant_id: userRole.tenant_id,
            branch_id: currentOrder.branch_id,
            item_id: item.inventory_item_id,
            movement_type: 'purchase',
            quantity: item.quantity_requested,
            unit_cost: item.unit_cost,
            reference_type: 'restock_order',
            reference_id: id,
            performed_by: user.id,
          });

          // Actualizar stock del item
          await supabase.rpc('update_inventory_stock', {
            p_item_id: item.inventory_item_id,
            p_quantity_change: item.quantity_requested,
          });
        }
      }

      // Resolver alertas asociadas
      if (currentOrder.triggered_by_alert_ids && currentOrder.triggered_by_alert_ids.length > 0) {
        await supabase
          .from('low_stock_alerts')
          .update({
            status: 'resolved',
            resolved_by: user.id,
            resolved_at: new Date().toISOString(),
          })
          .in('id', currentOrder.triggered_by_alert_ids);
      }
    }

    return NextResponse.json({ success: true, data: order });

  } catch (error) {
    console.error('Update restock order error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
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
      return NextResponse.json({ success: false, error: 'ID de orden inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para eliminar órdenes' }, { status: 403 });
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
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
    }

    if (!['draft', 'cancelled'].includes(currentOrder.status)) {
      return NextResponse.json({ success: false, error: 'Solo se pueden eliminar órdenes en borrador o canceladas' }, { status: 400 });
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
      return NextResponse.json({ success: false, error: 'Error al eliminar orden' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Orden eliminada' });

  } catch (error) {
    console.error('Delete restock order error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

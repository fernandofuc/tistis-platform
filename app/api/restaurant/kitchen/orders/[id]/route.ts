// =====================================================
// TIS TIS PLATFORM - Restaurant Kitchen Single Order API
// GET: Get order, PUT: Update, PATCH: Status/Actions
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get user and verify order
async function getUserAndVerifyOrder(request: NextRequest, orderId: string) {
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

  // Verify order belongs to tenant
  const { data: order } = await supabase
    .from('restaurant_orders')
    .select(`
      *,
      table:restaurant_tables(table_number, zone),
      items:restaurant_order_items(*)
    `)
    .eq('id', orderId)
    .eq('tenant_id', userRole.tenant_id)
    .is('deleted_at', null)
    .single();

  if (!order) {
    return { error: 'Orden no encontrada', status: 404 };
  }

  return { user, userRole, order, supabase };
}

// ======================
// GET - Get Single Order
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerifyOrder(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.order });

  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PUT - Update Order
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerifyOrder(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { order, supabase } = result;
    const body = await request.json();

    const allowedFields = [
      'table_id',
      'customer_id',
      'server_id',
      'priority',
      'estimated_prep_time',
      'customer_notes',
      'kitchen_notes',
      'internal_notes',
      'delivery_address',
      'delivery_instructions',
      'delivery_fee',
      'driver_id',
      'discount_amount',
      'discount_reason',
      'tip_amount',
    ];

    const updateData: Record<string, unknown> = {};
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    const { data: updatedOrder, error } = await supabase
      .from('restaurant_orders')
      .update(updateData)
      .eq('id', order.id)
      .select(`
        *,
        table:restaurant_tables(table_number, zone),
        items:restaurant_order_items(*)
      `)
      .single();

    if (error) {
      console.error('Error updating order:', error);
      return NextResponse.json({ success: false, error: 'Error al actualizar orden' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updatedOrder });

  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PATCH - Order Actions
// ======================
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerifyOrder(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { order, supabase, userRole } = result;
    const body = await request.json();
    const { action, status, priority, reason } = body;

    let updateData: Record<string, unknown> = {};

    // Handle different actions
    if (action === 'bump') {
      // Mark all ready items as served and order as served
      await supabase
        .from('restaurant_order_items')
        .update({ status: 'served', served_at: new Date().toISOString() })
        .eq('order_id', order.id)
        .eq('status', 'ready');

      updateData = { status: 'served' };
    } else if (action === 'recall') {
      // Recall served order back to ready
      if (order.status !== 'served') {
        return NextResponse.json({ success: false, error: 'Solo se pueden recuperar órdenes servidas' }, { status: 400 });
      }
      updateData = { status: 'ready' };
    } else if (action === 'cancel') {
      if (!reason) {
        return NextResponse.json({ success: false, error: 'Se requiere una razón para cancelar' }, { status: 400 });
      }
      // Cancel all items
      await supabase
        .from('restaurant_order_items')
        .update({ status: 'cancelled' })
        .eq('order_id', order.id);

      updateData = {
        status: 'cancelled',
        cancel_reason: reason,
        cancelled_by: result.user.id,
      };
    } else if (status) {
      // Direct status update
      const validTransitions: Record<string, string[]> = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['preparing', 'cancelled'],
        preparing: ['ready', 'cancelled'],
        ready: ['served', 'preparing'],
        served: ['completed'],
      };

      if (!validTransitions[order.status]?.includes(status)) {
        return NextResponse.json({
          success: false,
          error: `No se puede cambiar de ${order.status} a ${status}`,
        }, { status: 400 });
      }

      updateData = { status };

      // If moving to preparing, also start pending items
      if (status === 'preparing') {
        await supabase
          .from('restaurant_order_items')
          .update({ status: 'preparing', started_at: new Date().toISOString() })
          .eq('order_id', order.id)
          .eq('status', 'pending');
      }
    } else if (priority !== undefined) {
      if (priority < 1 || priority > 5) {
        return NextResponse.json({ success: false, error: 'Prioridad debe ser entre 1 y 5' }, { status: 400 });
      }
      updateData = { priority };
    } else {
      return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
    }

    const { data: updatedOrder, error } = await supabase
      .from('restaurant_orders')
      .update(updateData)
      .eq('id', order.id)
      .select(`
        *,
        table:restaurant_tables(table_number, zone),
        items:restaurant_order_items(*)
      `)
      .single();

    if (error) {
      console.error('Error updating order:', error);
      return NextResponse.json({ success: false, error: 'Error al actualizar orden' }, { status: 500 });
    }

    // Log activity
    await supabase.from('kds_activity_log').insert({
      tenant_id: userRole.tenant_id,
      branch_id: order.branch_id,
      order_id: order.id,
      action: action || 'status_changed',
      performed_by: result.user.id,
      previous_status: order.status,
      new_status: updatedOrder.status,
      notes: reason,
    });

    return NextResponse.json({ success: true, data: updatedOrder });

  } catch (error) {
    console.error('Patch order error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// DELETE - Cancel/Delete Order
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerifyOrder(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { order, supabase, userRole } = result;

    // Only allow deleting pending/cancelled orders
    if (!['pending', 'cancelled'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden eliminar órdenes pendientes o canceladas',
      }, { status: 400 });
    }

    // Soft delete
    const { error } = await supabase
      .from('restaurant_orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', order.id);

    if (error) {
      console.error('Error deleting order:', error);
      return NextResponse.json({ success: false, error: 'Error al eliminar orden' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete order error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

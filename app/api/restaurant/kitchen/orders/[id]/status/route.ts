// =====================================================
// TIS TIS PLATFORM - Kitchen Order Status API
// PATCH: Update order status directly
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Valid order statuses
const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'];

// Status transition rules
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'preparing', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'completed', 'preparing'],
  served: ['completed'],
};

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

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

// ======================
// PATCH - Update Status
// ======================
export async function PATCH(
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

    const body = await request.json();
    const { status, reason } = body;

    // Validate status value
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({
        success: false,
        error: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}`
      }, { status: 400 });
    }

    // Get current order
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .select('id, status, branch_id')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
    }

    // Validate transition
    if (!VALID_TRANSITIONS[order.status]?.includes(status)) {
      return NextResponse.json({
        success: false,
        error: `No se puede cambiar de "${order.status}" a "${status}"`
      }, { status: 400 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = { status };

    // Handle cancellation
    if (status === 'cancelled') {
      if (!reason) {
        return NextResponse.json({
          success: false,
          error: 'Se requiere una razón para cancelar'
        }, { status: 400 });
      }
      updateData.cancel_reason = reason;
      updateData.cancelled_by = user.id;

      // Cancel all items
      await supabase
        .from('restaurant_order_items')
        .update({ status: 'cancelled' })
        .eq('order_id', id);
    }

    // If moving to preparing, start pending items
    if (status === 'preparing') {
      await supabase
        .from('restaurant_order_items')
        .update({ status: 'preparing', started_at: new Date().toISOString() })
        .eq('order_id', id)
        .eq('status', 'pending');
    }

    // If completing from ready, mark items as served
    if (status === 'completed' && order.status === 'ready') {
      await supabase
        .from('restaurant_order_items')
        .update({ status: 'served', served_at: new Date().toISOString() })
        .eq('order_id', id)
        .in('status', ['ready', 'preparing']);
    }

    // Update order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('restaurant_orders')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        items:restaurant_order_items(*)
      `)
      .single();

    if (updateError) {
      console.error('Error updating status:', updateError);
      return NextResponse.json({ success: false, error: 'Error al actualizar estado' }, { status: 500 });
    }

    // Log the activity
    await supabase.from('kds_activity_log').insert({
      tenant_id: userRole.tenant_id,
      branch_id: order.branch_id,
      order_id: id,
      action: 'status_changed',
      previous_status: order.status,
      new_status: status,
      performed_by: user.id,
      notes: reason,
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: `Estado actualizado a: ${status}`
    });

  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// =====================================================
// TIS TIS PLATFORM - Kitchen Item Status API
// PATCH: Update item status
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  getUserAndTenant,
  isAuthError,
  isValidUUID,
} from '@/src/lib/api/auth-helper';
import { VALID_ITEM_STATUSES, type ItemStatus } from '@/src/lib/api/sanitization-helper';

// Valid status transitions
const VALID_TRANSITIONS: Record<string, ItemStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'pending', 'cancelled'],
  ready: ['served', 'preparing'],
  served: ['ready'], // Can recall
  cancelled: [], // Terminal state
};

// ======================
// PATCH - Update Item Status
// ======================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de item inválido' }, { status: 400 });
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { user, userRole, supabase } = auth;

    const body = await request.json();
    const { status } = body;

    // Validate status value
    if (!status || !VALID_ITEM_STATUSES.includes(status)) {
      return NextResponse.json({
        success: false,
        error: `Estado inválido. Valores permitidos: ${VALID_ITEM_STATUSES.join(', ')}`
      }, { status: 400 });
    }

    // Get current item with order info
    const { data: item, error: itemError } = await supabase
      .from('restaurant_order_items')
      .select(`
        *,
        order:restaurant_orders!inner(id, branch_id, tenant_id, status)
      `)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ success: false, error: 'Item no encontrado' }, { status: 404 });
    }

    // Validate status transition
    const allowedTransitions = VALID_TRANSITIONS[item.status] || [];
    if (!allowedTransitions.includes(status as ItemStatus)) {
      return NextResponse.json({
        success: false,
        error: `No se puede cambiar de '${item.status}' a '${status}'`
      }, { status: 400 });
    }

    // Prepare update data with timestamps
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Set timestamps based on status
    if (status === 'preparing' && !item.started_at) {
      updateData.started_at = new Date().toISOString();
    } else if (status === 'ready') {
      updateData.ready_at = new Date().toISOString();
    } else if (status === 'served') {
      updateData.served_at = new Date().toISOString();
    }

    // Update item
    const { data: updatedItem, error: updateError } = await supabase
      .from('restaurant_order_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating item status:', updateError);
      return NextResponse.json({ success: false, error: 'Error al actualizar estado' }, { status: 500 });
    }

    // Log activity
    const actionMap: Record<string, string> = {
      preparing: 'item_started',
      ready: 'item_ready',
      served: 'item_served',
      cancelled: 'item_cancelled',
      pending: 'status_changed',
    };

    await supabase.from('kds_activity_log').insert({
      tenant_id: userRole.tenant_id,
      branch_id: item.order.branch_id,
      order_id: item.order_id,
      order_item_id: id,
      action: actionMap[status] || 'status_changed',
      performed_by: user.id,
      previous_status: item.status,
      new_status: status,
    });

    // Update order status based on items
    await updateOrderStatusFromItems(supabase, item.order_id, item.order.status);

    return NextResponse.json({
      success: true,
      data: updatedItem,
      message: `Estado actualizado a: ${status}`
    });

  } catch (error) {
    console.error('Update item status error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Helper to sync order status with items
async function updateOrderStatusFromItems(
  supabase: SupabaseClient,
  orderId: string,
  currentOrderStatus: string
) {
  const { data: items } = await supabase
    .from('restaurant_order_items')
    .select('status')
    .eq('order_id', orderId)
    .neq('status', 'cancelled');

  if (!items?.length) return;

  const allReady = items.every(i => i.status === 'ready' || i.status === 'served');
  const allServed = items.every(i => i.status === 'served');
  const anyPreparing = items.some(i => i.status === 'preparing');

  let newOrderStatus: string | null = null;

  if (allServed && currentOrderStatus !== 'completed' && currentOrderStatus !== 'served') {
    newOrderStatus = 'served';
  } else if (allReady && !allServed && currentOrderStatus === 'preparing') {
    newOrderStatus = 'ready';
  } else if (anyPreparing && (currentOrderStatus === 'pending' || currentOrderStatus === 'confirmed')) {
    newOrderStatus = 'preparing';
  }

  if (newOrderStatus) {
    await supabase
      .from('restaurant_orders')
      .update({ status: newOrderStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);
  }
}

// =====================================================
// TIS TIS PLATFORM - Kitchen Order Cancel API
// POST: Cancel an order with reason
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  isValidUUID,
} from '@/src/lib/api/auth-helper';
import { sanitizeText, LIMITS } from '@/src/lib/api/sanitization-helper';

// Statuses that can be cancelled
const CANCELLABLE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'];

// ======================
// POST - Cancel Order
// ======================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de orden inválido' }, { status: 400 });
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { user, userRole, supabase } = auth;

    const body = await request.json();

    // Sanitize and validate reason
    const sanitizedReason = sanitizeText(body.reason, LIMITS.MAX_TEXT_LONG);
    if (!sanitizedReason) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere una razón para cancelar la orden'
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

    // Check if order can be cancelled
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: `No se puede cancelar una orden con estado "${order.status}". Solo órdenes en estado: ${CANCELLABLE_STATUSES.join(', ')}`
      }, { status: 400 });
    }

    // Cancel all items first
    await supabase
      .from('restaurant_order_items')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('order_id', id)
      .neq('status', 'cancelled');

    // Cancel the order with proper timestamp
    const { data: updatedOrder, error: updateError } = await supabase
      .from('restaurant_orders')
      .update({
        status: 'cancelled',
        cancel_reason: sanitizedReason.slice(0, 255), // DB column limit
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        items:restaurant_order_items(*)
      `)
      .single();

    if (updateError) {
      console.error('Error cancelling order:', updateError);
      return NextResponse.json({ success: false, error: 'Error al cancelar orden' }, { status: 500 });
    }

    // Log the activity
    await supabase.from('kds_activity_log').insert({
      tenant_id: userRole.tenant_id,
      branch_id: order.branch_id,
      order_id: id,
      action: 'order_cancelled',
      previous_status: order.status,
      new_status: 'cancelled',
      performed_by: user.id,
      notes: sanitizedReason,
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: 'Orden cancelada exitosamente'
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

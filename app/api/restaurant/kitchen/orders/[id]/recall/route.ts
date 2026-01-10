// =====================================================
// TIS TIS PLATFORM - Kitchen Order Recall API
// POST: Recall order to previous status
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  isValidUUID,
  hasMinRole,
} from '@/src/lib/api/auth-helper';
import { sanitizeText } from '@/src/lib/api/sanitization-helper';

// Status regression for orders
const STATUS_REVERT: Record<string, string> = {
  preparing: 'pending',
  ready: 'preparing',
  served: 'ready',
};

// ======================
// POST - Recall Order
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

    // Only managers+ can recall orders (using centralized permission check)
    if (!hasMinRole(userRole.role, 'manager')) {
      return NextResponse.json({ success: false, error: 'Sin permisos para retroceder órdenes' }, { status: 403 });
    }

    // Get current order
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .select('id, status, branch_id')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
    }

    const currentStatus = order.status;
    const previousStatus = STATUS_REVERT[currentStatus];

    if (!previousStatus) {
      return NextResponse.json({
        success: false,
        error: `No se puede retroceder desde el estado "${currentStatus}"`
      }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    // Sanitize reason to prevent XSS
    const reason = sanitizeText(body.reason, 500) || 'Orden retrocedida';

    // Prepare update data
    const updateData: Record<string, unknown> = {
      status: previousStatus,
      updated_at: new Date().toISOString(),
    };

    // Clear timestamps based on reverted status
    if (previousStatus === 'pending') {
      updateData.started_preparing_at = null;
    } else if (previousStatus === 'preparing') {
      updateData.ready_at = null;
    } else if (previousStatus === 'ready') {
      updateData.served_at = null;
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
      console.error('Error recalling order:', updateError);
      return NextResponse.json({ success: false, error: 'Error al retroceder orden' }, { status: 500 });
    }

    // Log the activity
    await supabase.from('kds_activity_log').insert({
      tenant_id: userRole.tenant_id,
      branch_id: order.branch_id,
      order_id: id,
      action: 'recall',
      previous_status: currentStatus,
      new_status: previousStatus,
      performed_by: user.id,
      notes: reason,
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: `Orden retrocedida a: ${previousStatus}`
    });

  } catch (error) {
    console.error('Recall order error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// =====================================================
// TIS TIS PLATFORM - Kitchen Order Bump API
// POST: Bump order to next status
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Status progression for orders
const STATUS_FLOW: Record<string, string> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served',
};

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
// POST - Bump Order
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

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { user, userRole, supabase } = result;

    // Get current order
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .select('id, status, kitchen_status, branch_id')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
    }

    const currentStatus = order.kitchen_status || order.status;
    const nextStatus = STATUS_FLOW[currentStatus];

    if (!nextStatus) {
      return NextResponse.json({
        success: false,
        error: `No se puede avanzar desde el estado "${currentStatus}"`
      }, { status: 400 });
    }

    // Prepare update data
    const updateData: Record<string, any> = {
      kitchen_status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    // Set timestamps based on status
    if (nextStatus === 'preparing') {
      updateData.started_at = new Date().toISOString();
    } else if (nextStatus === 'ready') {
      updateData.completed_at = new Date().toISOString();
    } else if (nextStatus === 'served') {
      updateData.served_at = new Date().toISOString();
      updateData.status = 'completed';
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
      console.error('Error bumping order:', updateError);
      return NextResponse.json({ success: false, error: 'Error al actualizar orden' }, { status: 500 });
    }

    // Log the activity
    await supabase.from('kds_activity_log').insert({
      tenant_id: userRole.tenant_id,
      branch_id: order.branch_id,
      order_id: id,
      action: 'bump',
      previous_status: currentStatus,
      new_status: nextStatus,
      performed_by: user.id,
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: `Orden avanzada a: ${nextStatus}`
    });

  } catch (error) {
    console.error('Bump order error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// =====================================================
// TIS TIS PLATFORM - Kitchen Order Priority API
// PATCH: Update order priority
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const VALID_PRIORITIES = ['normal', 'high', 'rush'];

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
// PATCH - Update Priority
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
    const { priority } = body;

    if (!priority || !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json({
        success: false,
        error: `Prioridad inválida. Valores permitidos: ${VALID_PRIORITIES.join(', ')}`
      }, { status: 400 });
    }

    // Get current order
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .select('id, priority, branch_id')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
    }

    const previousPriority = order.priority || 'normal';

    if (previousPriority === priority) {
      return NextResponse.json({
        success: true,
        data: order,
        message: 'La prioridad ya está configurada'
      });
    }

    // Update order priority
    const { data: updatedOrder, error: updateError } = await supabase
      .from('restaurant_orders')
      .update({
        priority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        items:restaurant_order_items(*)
      `)
      .single();

    if (updateError) {
      console.error('Error updating priority:', updateError);
      return NextResponse.json({ success: false, error: 'Error al actualizar prioridad' }, { status: 500 });
    }

    // Log the activity
    await supabase.from('kds_activity_log').insert({
      tenant_id: userRole.tenant_id,
      branch_id: order.branch_id,
      order_id: id,
      action: 'priority_change',
      previous_status: previousPriority,
      new_status: priority,
      performed_by: user.id,
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: `Prioridad actualizada a: ${priority}`
    });

  } catch (error) {
    console.error('Update priority error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

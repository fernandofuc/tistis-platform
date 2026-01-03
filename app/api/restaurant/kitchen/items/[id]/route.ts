// =====================================================
// TIS TIS PLATFORM - Restaurant Kitchen Items API
// PUT: Update item, PATCH: Status/Station actions
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get user and verify item
async function getUserAndVerifyItem(request: NextRequest, itemId: string) {
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

  // Verify item belongs to tenant
  const { data: item } = await supabase
    .from('restaurant_order_items')
    .select(`
      *,
      order:restaurant_orders!inner(id, branch_id, tenant_id, status)
    `)
    .eq('id', itemId)
    .eq('tenant_id', userRole.tenant_id)
    .single();

  if (!item) {
    return { error: 'Item no encontrado', status: 404 };
  }

  return { user, userRole, item, supabase };
}

// ======================
// PUT - Update Item
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerifyItem(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { item, supabase } = result;
    const body = await request.json();

    const allowedFields = [
      'quantity',
      'special_instructions',
      'allergen_notes',
      'kitchen_station',
      'is_complimentary',
      'complimentary_reason',
    ];

    const updateData: Record<string, unknown> = {};
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // Recalculate subtotal if quantity changed
    if (body.quantity) {
      updateData.subtotal = body.quantity * item.unit_price + item.variant_price + item.size_price;
    }

    const { data: updatedItem, error } = await supabase
      .from('restaurant_order_items')
      .update(updateData)
      .eq('id', item.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating item:', error);
      return NextResponse.json({ success: false, error: 'Error al actualizar item' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updatedItem });

  } catch (error) {
    console.error('Update item error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PATCH - Item Actions
// ======================
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerifyItem(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { item, supabase, userRole, user } = result;
    const body = await request.json();
    const { status, kitchen_station } = body;

    let updateData: Record<string, unknown> = {};

    if (status) {
      // Validate status transition
      const validTransitions: Record<string, string[]> = {
        pending: ['preparing', 'cancelled'],
        preparing: ['ready', 'pending', 'cancelled'],
        ready: ['served', 'preparing'],
        served: ['ready'], // Can recall
      };

      if (!validTransitions[item.status]?.includes(status)) {
        return NextResponse.json({
          success: false,
          error: `No se puede cambiar de ${item.status} a ${status}`,
        }, { status: 400 });
      }

      updateData.status = status;

      // Set timestamps based on status
      if (status === 'preparing') {
        updateData.started_at = new Date().toISOString();
      } else if (status === 'ready') {
        updateData.ready_at = new Date().toISOString();
      } else if (status === 'served') {
        updateData.served_at = new Date().toISOString();
      }
    }

    if (kitchen_station) {
      updateData.kitchen_station = kitchen_station;
    }

    const { data: updatedItem, error } = await supabase
      .from('restaurant_order_items')
      .update(updateData)
      .eq('id', item.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating item:', error);
      return NextResponse.json({ success: false, error: 'Error al actualizar item' }, { status: 500 });
    }

    // Log activity
    await supabase.from('kds_activity_log').insert({
      tenant_id: userRole.tenant_id,
      branch_id: item.order.branch_id,
      order_id: item.order_id,
      order_item_id: item.id,
      action: status ? (status === 'preparing' ? 'item_started' : status === 'ready' ? 'item_ready' : status === 'served' ? 'item_served' : status === 'cancelled' ? 'item_cancelled' : 'status_changed') : 'station_assigned',
      performed_by: user.id,
      previous_status: item.status,
      new_status: status || item.status,
    });

    // Check if all items are ready/served to update order status
    if (status === 'ready' || status === 'served') {
      const { data: orderItems } = await supabase
        .from('restaurant_order_items')
        .select('status')
        .eq('order_id', item.order_id)
        .neq('status', 'cancelled');

      const allReady = orderItems?.every(i => i.status === 'ready' || i.status === 'served');
      if (allReady && item.order.status === 'preparing') {
        await supabase
          .from('restaurant_orders')
          .update({ status: 'ready' })
          .eq('id', item.order_id);
      }
    }

    // If any item is preparing, order should be preparing
    if (status === 'preparing' && item.order.status === 'confirmed') {
      await supabase
        .from('restaurant_orders')
        .update({ status: 'preparing' })
        .eq('id', item.order_id);
    }

    return NextResponse.json({ success: true, data: updatedItem });

  } catch (error) {
    console.error('Patch item error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

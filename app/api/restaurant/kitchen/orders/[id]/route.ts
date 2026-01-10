// =====================================================
// TIS TIS PLATFORM - Restaurant Kitchen Single Order API
// GET: Get order, PUT: Update, PATCH: Status/Actions
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// UUID validation helper
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Sanitize text to prevent XSS
function sanitizeText(text: unknown, maxLength = 500): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') return null;
  const sanitized = text.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
  return sanitized.slice(0, maxLength) || null;
}

// Validate positive price
function sanitizePrice(value: unknown, maxValue = 999999.99): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.max(0, Math.min(maxValue, Math.round(num * 100) / 100));
}

// Validate number in range
function sanitizeNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

// Sanitize delivery address
function sanitizeDeliveryAddress(address: unknown): Record<string, unknown> | null {
  if (!address || typeof address !== 'object') return null;
  const addr = address as Record<string, unknown>;
  return {
    street: sanitizeText(addr.street, 255) || '',
    number: sanitizeText(addr.number, 50) || '',
    apartment: sanitizeText(addr.apartment, 50) || null,
    city: sanitizeText(addr.city, 100) || '',
    postal_code: sanitizeText(addr.postal_code, 20) || '',
    lat: typeof addr.lat === 'number' && isFinite(addr.lat) ? Math.max(-90, Math.min(90, addr.lat)) : null,
    lng: typeof addr.lng === 'number' && isFinite(addr.lng) ? Math.max(-180, Math.min(180, addr.lng)) : null,
  };
}

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de orden inválido' }, { status: 400 });
    }

    const result = await getUserAndVerifyOrder(request, id);
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de orden inválido' }, { status: 400 });
    }

    const result = await getUserAndVerifyOrder(request, id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { order, supabase } = result;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    // Sanitize each field individually
    if (body.table_id !== undefined) {
      updateData.table_id = body.table_id && isValidUUID(body.table_id) ? body.table_id : null;
    }
    if (body.customer_id !== undefined) {
      updateData.customer_id = body.customer_id && isValidUUID(body.customer_id) ? body.customer_id : null;
    }
    if (body.server_id !== undefined) {
      updateData.server_id = body.server_id && isValidUUID(body.server_id) ? body.server_id : null;
    }
    if (body.driver_id !== undefined) {
      updateData.driver_id = body.driver_id && isValidUUID(body.driver_id) ? body.driver_id : null;
    }
    if (body.priority !== undefined) {
      updateData.priority = sanitizeNumber(body.priority, 1, 5, order.priority);
    }
    if (body.estimated_prep_time !== undefined) {
      updateData.estimated_prep_time = body.estimated_prep_time ? sanitizeNumber(body.estimated_prep_time, 1, 480, 30) : null;
    }
    if (body.customer_notes !== undefined) {
      updateData.customer_notes = sanitizeText(body.customer_notes, 500);
    }
    if (body.kitchen_notes !== undefined) {
      updateData.kitchen_notes = sanitizeText(body.kitchen_notes, 500);
    }
    if (body.internal_notes !== undefined) {
      updateData.internal_notes = sanitizeText(body.internal_notes, 1000);
    }
    if (body.delivery_address !== undefined) {
      updateData.delivery_address = sanitizeDeliveryAddress(body.delivery_address);
    }
    if (body.delivery_instructions !== undefined) {
      updateData.delivery_instructions = sanitizeText(body.delivery_instructions, 500);
    }
    if (body.delivery_fee !== undefined) {
      updateData.delivery_fee = sanitizePrice(body.delivery_fee);
    }
    if (body.discount_amount !== undefined) {
      updateData.discount_amount = sanitizePrice(body.discount_amount);
    }
    if (body.discount_reason !== undefined) {
      updateData.discount_reason = sanitizeText(body.discount_reason, 255);
    }
    if (body.tip_amount !== undefined) {
      updateData.tip_amount = sanitizePrice(body.tip_amount);
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de orden inválido' }, { status: 400 });
    }

    const result = await getUserAndVerifyOrder(request, id);
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
      // Direct status update with comprehensive transition rules
      // FIX: Added ready → completed transition for quick completion scenarios
      const validTransitions: Record<string, string[]> = {
        pending: ['confirmed', 'preparing', 'cancelled'], // Can skip to preparing for rush orders
        confirmed: ['preparing', 'cancelled'],
        preparing: ['ready', 'cancelled'],
        ready: ['served', 'completed', 'preparing'], // Can complete directly or go back to preparing
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

      // If completing from ready (takeout/delivery paid beforehand), mark items as served
      if (status === 'completed' && order.status === 'ready') {
        await supabase
          .from('restaurant_order_items')
          .update({ status: 'served', served_at: new Date().toISOString() })
          .eq('order_id', order.id)
          .in('status', ['ready', 'preparing']);
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de orden inválido' }, { status: 400 });
    }

    const result = await getUserAndVerifyOrder(request, id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { order, supabase } = result;

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

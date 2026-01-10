// =====================================================
// TIS TIS PLATFORM - Restaurant Kitchen Items API
// PUT: Update item, PATCH: Status/Station actions
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

// Validate positive number
function sanitizeNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

// Valid kitchen stations
const VALID_STATIONS = ['main', 'grill', 'fry', 'salad', 'sushi', 'pizza', 'dessert', 'bar', 'expeditor', 'prep', 'assembly'] as const;

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de item inválido' }, { status: 400 });
    }

    const result = await getUserAndVerifyItem(request, id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { item, supabase } = result;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    // Sanitize and validate each field
    if (body.quantity !== undefined) {
      updateData.quantity = sanitizeNumber(body.quantity, 1, 100, item.quantity);
    }

    if (body.special_instructions !== undefined) {
      updateData.special_instructions = sanitizeText(body.special_instructions, 500);
    }

    if (body.allergen_notes !== undefined) {
      updateData.allergen_notes = sanitizeText(body.allergen_notes, 255);
    }

    if (body.kitchen_station !== undefined) {
      if (VALID_STATIONS.includes(body.kitchen_station)) {
        updateData.kitchen_station = body.kitchen_station;
      }
    }

    if (body.is_complimentary !== undefined) {
      updateData.is_complimentary = Boolean(body.is_complimentary);
    }

    if (body.complimentary_reason !== undefined) {
      updateData.complimentary_reason = sanitizeText(body.complimentary_reason, 255);
    }

    // Recalculate subtotal if quantity changed (with overflow protection)
    if (updateData.quantity) {
      const qty = updateData.quantity as number;
      const subtotal = qty * item.unit_price + (item.variant_price || 0) + (item.size_price || 0);
      updateData.subtotal = Math.max(0, Math.min(999999.99, Math.round(subtotal * 100) / 100));
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de item inválido' }, { status: 400 });
    }

    const result = await getUserAndVerifyItem(request, id);
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

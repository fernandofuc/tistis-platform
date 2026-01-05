// =====================================================
// TIS TIS PLATFORM - Restock Order Items API
// GET: List order items, POST: Add item to order
// PUT: Update received quantities
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
// GET - List Order Items
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

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    // Verificar que la orden pertenece al tenant
    const { data: order, error: orderError } = await supabase
      .from('restock_orders')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
    }

    const { data: items, error } = await supabase
      .from('restock_order_items')
      .select(`
        *,
        item:inventory_items(id, name, sku, unit, current_stock, minimum_stock)
      `)
      .eq('restock_order_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching order items:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener artículos' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: items });

  } catch (error) {
    console.error('Get order items error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Add Item to Order
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

    const { userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para modificar órdenes' }, { status: 403 });
    }

    // Verificar que la orden existe y está en estado editable
    const { data: order, error: orderError } = await supabase
      .from('restock_orders')
      .select('id, status')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
    }

    if (!['draft', 'pending'].includes(order.status)) {
      return NextResponse.json({ success: false, error: 'No se pueden agregar artículos a una orden ya procesada' }, { status: 400 });
    }

    const body = await request.json();
    const {
      inventory_item_id,
      quantity_requested,
      unit,
      unit_cost = 0,
      notes,
    } = body;

    if (!inventory_item_id || !quantity_requested || !unit) {
      return NextResponse.json({ success: false, error: 'Datos incompletos' }, { status: 400 });
    }

    const { data: item, error } = await supabase
      .from('restock_order_items')
      .insert({
        tenant_id: userRole.tenant_id,
        restock_order_id: id,
        inventory_item_id,
        quantity_requested,
        unit,
        unit_cost,
        notes,
      })
      .select(`
        *,
        item:inventory_items(id, name, sku, unit)
      `)
      .single();

    if (error) {
      console.error('Error adding order item:', error);
      return NextResponse.json({ success: false, error: 'Error al agregar artículo' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: item }, { status: 201 });

  } catch (error) {
    console.error('Add order item error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PUT - Update Received Quantities (Bulk)
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

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para actualizar recepción' }, { status: 403 });
    }

    // Verificar que la orden existe
    const { data: order, error: orderError } = await supabase
      .from('restock_orders')
      .select('id, status')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 });
    }

    if (!['placed', 'partial'].includes(order.status)) {
      return NextResponse.json({ success: false, error: 'Solo se puede registrar recepción en órdenes enviadas' }, { status: 400 });
    }

    const body = await request.json();
    const { items } = body; // Array de { item_id, quantity_received }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'Se requiere un array de artículos' }, { status: 400 });
    }

    // Actualizar cada item
    for (const item of items) {
      const status = item.quantity_received >= item.quantity_requested ? 'received' : 'partial';

      await supabase
        .from('restock_order_items')
        .update({
          quantity_received: item.quantity_received,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.item_id)
        .eq('restock_order_id', id);
    }

    // Obtener items actualizados
    const { data: updatedItems, error } = await supabase
      .from('restock_order_items')
      .select(`
        *,
        item:inventory_items(id, name, sku, unit)
      `)
      .eq('restock_order_id', id);

    if (error) {
      console.error('Error fetching updated items:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener artículos actualizados' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updatedItems });

  } catch (error) {
    console.error('Update received quantities error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

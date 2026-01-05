// =====================================================
// TIS TIS PLATFORM - Restock Orders API
// GET: List restock orders, POST: Create restock order
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

// ======================
// GET - List Restock Orders
// ======================
export async function GET(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get('branch_id');
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplier_id');
    const triggerSource = searchParams.get('trigger_source');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('restock_orders')
      .select(`
        *,
        supplier:inventory_suppliers(id, name, whatsapp, contact_name, phone),
        items:restock_order_items(
          id,
          inventory_item_id,
          quantity_requested,
          quantity_received,
          unit,
          unit_cost,
          total_cost,
          status,
          item:inventory_items(id, name, sku, unit)
        ),
        created_by_user:auth.users!restock_orders_created_by_fkey(email),
        authorized_by_user:auth.users!restock_orders_authorized_by_fkey(email)
      `)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    if (triggerSource) {
      query = query.eq('trigger_source', triggerSource);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching restock orders:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener órdenes de reabastecimiento' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: orders });

  } catch (error) {
    console.error('Get restock orders error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create Restock Order
// ======================
export async function POST(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { user, userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para crear órdenes de reabastecimiento' }, { status: 403 });
    }

    const body = await request.json();
    const {
      branch_id,
      supplier_id,
      trigger_source = 'manual',
      triggered_by_alert_ids = [],
      expected_delivery_date,
      internal_notes,
      supplier_notes,
      items = [],
    } = body;

    // Validaciones
    if (!branch_id) {
      return NextResponse.json({ success: false, error: 'La sucursal es requerida' }, { status: 400 });
    }

    if (!supplier_id) {
      return NextResponse.json({ success: false, error: 'El proveedor es requerido' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Se requiere al menos un artículo' }, { status: 400 });
    }

    // Crear la orden (order_number se genera automáticamente via trigger)
    const { data: order, error: orderError } = await supabase
      .from('restock_orders')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        supplier_id,
        status: 'draft',
        trigger_source,
        triggered_by_alert_ids,
        created_by: user.id,
        expected_delivery_date,
        internal_notes,
        supplier_notes,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Error creating restock order:', orderError);
      return NextResponse.json({ success: false, error: 'Error al crear orden de reabastecimiento' }, { status: 500 });
    }

    // Insertar los items de la orden
    const orderItems = items.map((item: {
      inventory_item_id: string;
      quantity_requested: number;
      unit: string;
      unit_cost?: number;
      notes?: string;
    }) => ({
      tenant_id: userRole.tenant_id,
      restock_order_id: order.id,
      inventory_item_id: item.inventory_item_id,
      quantity_requested: item.quantity_requested,
      unit: item.unit,
      unit_cost: item.unit_cost || 0,
      notes: item.notes,
    }));

    const { error: itemsError } = await supabase
      .from('restock_order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Intentar eliminar la orden creada
      await supabase.from('restock_orders').delete().eq('id', order.id);
      return NextResponse.json({ success: false, error: 'Error al crear artículos de la orden' }, { status: 500 });
    }

    // Si vino de alertas, actualizar el estado de las alertas
    if (triggered_by_alert_ids && triggered_by_alert_ids.length > 0) {
      await supabase
        .from('low_stock_alerts')
        .update({
          status: 'ordered',
          associated_order_id: order.id,
          updated_at: new Date().toISOString(),
        })
        .in('id', triggered_by_alert_ids);
    }

    // Obtener la orden completa con relaciones
    const { data: fullOrder, error: fetchError } = await supabase
      .from('restock_orders')
      .select(`
        *,
        supplier:inventory_suppliers(id, name, whatsapp, contact_name, phone),
        items:restock_order_items(
          id,
          inventory_item_id,
          quantity_requested,
          quantity_received,
          unit,
          unit_cost,
          total_cost,
          status,
          item:inventory_items(id, name, sku, unit)
        )
      `)
      .eq('id', order.id)
      .single();

    if (fetchError) {
      console.error('Error fetching created order:', fetchError);
      // La orden se creó, devolver lo que tenemos
      return NextResponse.json({ success: true, data: order }, { status: 201 });
    }

    return NextResponse.json({ success: true, data: fullOrder }, { status: 201 });

  } catch (error) {
    console.error('Create restock order error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

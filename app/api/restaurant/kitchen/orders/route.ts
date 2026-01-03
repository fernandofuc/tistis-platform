// =====================================================
// TIS TIS PLATFORM - Restaurant Kitchen Orders API
// GET: List orders, POST: Create order
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get user and tenant
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
// GET - List Orders
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
    const status = searchParams.get('status')?.split(',');
    const orderType = searchParams.get('order_type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'branch_id requerido' }, { status: 400 });
    }

    let query = supabase
      .from('restaurant_orders')
      .select(`
        *,
        table:restaurant_tables(table_number, zone),
        items:restaurant_order_items(*)
      `)
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('ordered_at', { ascending: false })
      .limit(limit);

    if (status?.length) {
      query = query.in('status', status);
    }

    if (orderType) {
      query = query.eq('order_type', orderType);
    }

    if (dateFrom) {
      query = query.gte('ordered_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('ordered_at', dateTo);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener órdenes' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: orders });

  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create Order
// ======================
export async function POST(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;
    const body = await request.json();

    const {
      branch_id,
      order_type,
      table_id,
      customer_id,
      server_id,
      priority,
      estimated_prep_time,
      customer_notes,
      kitchen_notes,
      internal_notes,
      delivery_address,
      delivery_instructions,
      delivery_fee,
      items,
    } = body;

    if (!branch_id) {
      return NextResponse.json({ success: false, error: 'branch_id requerido' }, { status: 400 });
    }

    if (!items?.length) {
      return NextResponse.json({ success: false, error: 'Debe incluir al menos un item' }, { status: 400 });
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        order_type: order_type || 'dine_in',
        table_id,
        customer_id,
        server_id,
        priority: priority || 3,
        estimated_prep_time,
        customer_notes,
        kitchen_notes,
        internal_notes,
        delivery_address,
        delivery_instructions,
        delivery_fee,
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return NextResponse.json({ success: false, error: 'Error al crear orden' }, { status: 500 });
    }

    // Create order items
    const orderItems = items.map((item: any, index: number) => ({
      tenant_id: userRole.tenant_id,
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      menu_item_name: item.menu_item_name,
      quantity: item.quantity || 1,
      unit_price: item.unit_price,
      subtotal: (item.quantity || 1) * item.unit_price + (item.variant_price || 0) + (item.size_price || 0),
      variant_name: item.variant_name,
      variant_price: item.variant_price || 0,
      size_name: item.size_name,
      size_price: item.size_price || 0,
      add_ons: item.add_ons || [],
      modifiers: item.modifiers || [],
      kitchen_station: item.kitchen_station || 'main',
      special_instructions: item.special_instructions,
      allergen_notes: item.allergen_notes,
      is_complimentary: item.is_complimentary || false,
      complimentary_reason: item.complimentary_reason,
      display_order: item.display_order || index,
      status: 'pending',
    }));

    const { error: itemsError } = await supabase
      .from('restaurant_order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Rollback order
      await supabase.from('restaurant_orders').delete().eq('id', order.id);
      return NextResponse.json({ success: false, error: 'Error al crear items de orden' }, { status: 500 });
    }

    // Fetch complete order with items
    const { data: completeOrder } = await supabase
      .from('restaurant_orders')
      .select(`
        *,
        table:restaurant_tables(table_number, zone),
        items:restaurant_order_items(*)
      `)
      .eq('id', order.id)
      .single();

    return NextResponse.json({ success: true, data: completeOrder }, { status: 201 });

  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

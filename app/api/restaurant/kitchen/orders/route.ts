// =====================================================
// TIS TIS PLATFORM - Restaurant Kitchen Orders API
// GET: List orders, POST: Create order
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
} from '@/src/lib/api/auth-helper';

// ======================
// GET - List Orders
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get('branch_id');
    const status = searchParams.get('status')?.split(',');
    const orderType = searchParams.get('order_type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!branchId || !isValidUUID(branchId)) {
      return errorResponse('branch_id requerido', 400);
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
      return errorResponse('Error al obtener órdenes', 500);
    }

    return successResponse(orders);

  } catch (error) {
    console.error('Get orders error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Order
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
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

    if (!branch_id || !isValidUUID(branch_id)) {
      return errorResponse('branch_id inválido', 400);
    }

    if (!items?.length) {
      return errorResponse('Debe incluir al menos un item', 400);
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
      return errorResponse('Error al crear orden', 500);
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
      return errorResponse('Error al crear items de orden', 500);
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

    return successResponse(completeOrder, 201);

  } catch (error) {
    console.error('Create order error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

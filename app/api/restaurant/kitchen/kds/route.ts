// =====================================================
// TIS TIS PLATFORM - KDS Display API
// GET: Get active orders formatted for KDS display
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.substring(7);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userRole) {
      return NextResponse.json({ success: false, error: 'Sin tenant asociado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const station = searchParams.get('station');

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'branch_id requerido' }, { status: 400 });
    }

    // Get active orders with items
    let query = supabase
      .from('restaurant_orders')
      .select(`
        id,
        tenant_id,
        branch_id,
        display_number,
        order_type,
        status,
        priority,
        ordered_at,
        estimated_prep_time,
        table_id,
        customer_notes,
        kitchen_notes,
        restaurant_tables(table_number),
        restaurant_order_items(
          id,
          menu_item_name,
          quantity,
          variant_name,
          size_name,
          add_ons,
          modifiers,
          status,
          kitchen_station,
          special_instructions,
          allergen_notes,
          started_at,
          ready_at
        )
      `)
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .is('deleted_at', null)
      .order('priority', { ascending: false })
      .order('ordered_at', { ascending: true });

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching KDS orders:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener órdenes' }, { status: 500 });
    }

    // Transform to KDS view format
    const kdsOrders = orders?.map(order => {
      const items = order.restaurant_order_items || [];
      const now = new Date();
      const orderedAt = new Date(order.ordered_at);
      const minutesElapsed = (now.getTime() - orderedAt.getTime()) / 60000;

      // Filter by station if specified
      let filteredItems = items;
      if (station && station !== 'all') {
        filteredItems = items.filter((item: any) => item.kitchen_station === station);
      }

      // Skip orders with no matching items after filter
      if (station && station !== 'all' && filteredItems.length === 0) {
        return null;
      }

      return {
        order_id: order.id,
        tenant_id: order.tenant_id,
        branch_id: order.branch_id,
        display_number: order.display_number,
        order_type: order.order_type,
        order_status: order.status,
        priority: order.priority,
        ordered_at: order.ordered_at,
        estimated_prep_time: order.estimated_prep_time,
        table_id: order.table_id,
        table_number: (order.restaurant_tables as any)?.table_number || null,
        customer_notes: order.customer_notes,
        kitchen_notes: order.kitchen_notes,
        items: filteredItems.map((item: any) => ({
          id: item.id,
          menu_item_name: item.menu_item_name,
          quantity: item.quantity,
          variant_name: item.variant_name,
          size_name: item.size_name,
          add_ons: item.add_ons,
          modifiers: item.modifiers,
          status: item.status,
          kitchen_station: item.kitchen_station,
          special_instructions: item.special_instructions,
          allergen_notes: item.allergen_notes,
          started_at: item.started_at,
          ready_at: item.ready_at,
        })),
        minutes_elapsed: Math.floor(minutesElapsed),
      };
    }).filter(Boolean);

    return NextResponse.json({ success: true, data: kdsOrders });

  } catch (error) {
    console.error('KDS API error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

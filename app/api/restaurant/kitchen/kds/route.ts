// =====================================================
// TIS TIS PLATFORM - KDS Display API
// GET: Get active orders formatted for KDS display
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

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const station = searchParams.get('station');

    if (!branchId || !isValidUUID(branchId)) {
      return errorResponse('branch_id requerido', 400);
    }

    // Get active orders with items
    const query = supabase
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
      return errorResponse('Error al obtener órdenes', 500);
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

    return successResponse(kdsOrders);

  } catch (error) {
    console.error('KDS API error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

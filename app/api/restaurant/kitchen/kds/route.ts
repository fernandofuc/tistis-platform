// =====================================================
// TIS TIS PLATFORM - KDS Display API
// GET: Get active orders formatted for KDS display
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql (delivery extensions)
// - Types: src/features/restaurant-kitchen/types/index.ts
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
import type { DeliveryAddress } from '@/src/shared/types/delivery-types';

// Valid kitchen stations
const VALID_STATIONS = ['main', 'grill', 'fry', 'salad', 'sushi', 'pizza', 'dessert', 'bar', 'expeditor', 'prep', 'assembly', 'all'] as const;

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

    // Validate station parameter if provided
    if (station && !VALID_STATIONS.includes(station as typeof VALID_STATIONS[number])) {
      return errorResponse(`Estación inválida. Valores permitidos: ${VALID_STATIONS.join(', ')}`, 400);
    }

    // Get active orders with items (including delivery fields)
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
        delivery_status,
        delivery_address,
        delivery_instructions,
        delivery_driver_id,
        estimated_delivery_at,
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

    // Get driver info for delivery orders
    const deliveryDriverIds = orders
      ?.filter(o => o.delivery_driver_id)
      .map(o => o.delivery_driver_id)
      .filter((id, index, arr) => arr.indexOf(id) === index) || [];

    let driversMap: Record<string, { full_name: string; phone: string }> = {};

    if (deliveryDriverIds.length > 0) {
      const { data: drivers } = await supabase
        .from('delivery_drivers')
        .select('id, full_name, phone')
        .in('id', deliveryDriverIds);

      if (drivers) {
        driversMap = Object.fromEntries(
          drivers.map(d => [d.id, { full_name: d.full_name, phone: d.phone }])
        );
      }
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

      // Get driver info for delivery orders
      const driver = order.delivery_driver_id ? driversMap[order.delivery_driver_id] : null;

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
        // Delivery fields (sincronizado con migracion 156)
        delivery_status: order.delivery_status || null,
        delivery_address: order.delivery_address as DeliveryAddress | null,
        delivery_instructions: order.delivery_instructions || null,
        delivery_driver_id: order.delivery_driver_id || null,
        delivery_driver_name: driver?.full_name || null,
        delivery_driver_phone: driver?.phone || null,
        estimated_delivery_at: order.estimated_delivery_at || null,
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

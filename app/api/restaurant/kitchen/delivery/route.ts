// =====================================================
// TIS TIS PLATFORM - KDS Delivery Orders API
// GET: Get delivery orders formatted for KDS display
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - Types: src/features/restaurant-kitchen/types/index.ts
// - Types: src/shared/types/delivery-types.ts
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
import type { DeliveryStatus } from '@/src/shared/types/delivery-types';

// Valid delivery statuses for KDS filtering
const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = [
  'pending_assignment',
  'driver_assigned',
  'driver_arrived',
  'picked_up',
  'in_transit',
  'arriving',
];

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const statusFilter = searchParams.get('status'); // Optional: specific delivery status

    if (!branchId || !isValidUUID(branchId)) {
      return errorResponse('branch_id requerido', 400);
    }

    // Build the main orders query
    let ordersQuery = supabase
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
        ready_at,
        estimated_delivery_at,
        delivery_status,
        delivery_address,
        delivery_instructions,
        delivery_driver_id,
        delivery_fee,
        delivery_distance_km,
        total,
        customer_notes,
        restaurant_order_items(
          id,
          menu_item_name,
          quantity
        ),
        customers(
          full_name,
          phone
        )
      `)
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .eq('order_type', 'delivery')
      .is('deleted_at', null)
      .order('priority', { ascending: false })
      .order('ordered_at', { ascending: true });

    // Filter by delivery status
    if (statusFilter && ACTIVE_DELIVERY_STATUSES.includes(statusFilter as DeliveryStatus)) {
      ordersQuery = ordersQuery.eq('delivery_status', statusFilter);
    } else {
      // Default: get active delivery orders
      ordersQuery = ordersQuery.in('delivery_status', ACTIVE_DELIVERY_STATUSES);
    }

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error('[KDS Delivery API] Error fetching orders:', ordersError);
      return errorResponse('Error al obtener órdenes de delivery', 500);
    }

    // Get driver information for assigned orders
    const driverIds = orders
      ?.filter(o => o.delivery_driver_id)
      .map(o => o.delivery_driver_id)
      .filter((id, index, arr) => arr.indexOf(id) === index) || [];

    let driversMap: Record<string, { full_name: string; phone: string; vehicle_type: string }> = {};

    if (driverIds.length > 0) {
      const { data: drivers } = await supabase
        .from('delivery_drivers')
        .select('id, full_name, phone, vehicle_type')
        .in('id', driverIds);

      if (drivers) {
        driversMap = Object.fromEntries(
          drivers.map(d => [d.id, { full_name: d.full_name, phone: d.phone, vehicle_type: d.vehicle_type }])
        );
      }
    }

    // Transform to KDS Delivery View format
    const now = new Date();
    const kdsDeliveryOrders = orders?.map(order => {
      const orderedAt = new Date(order.ordered_at);
      const minutesElapsed = Math.floor((now.getTime() - orderedAt.getTime()) / 60000);

      // Calculate minutes until estimated delivery
      let minutesUntilDelivery: number | null = null;
      if (order.estimated_delivery_at) {
        const estimatedAt = new Date(order.estimated_delivery_at);
        minutesUntilDelivery = Math.floor((estimatedAt.getTime() - now.getTime()) / 60000);
      }

      // Get driver info
      const driver = order.delivery_driver_id ? driversMap[order.delivery_driver_id] : null;

      // Build items summary
      const items = order.restaurant_order_items || [];
      const itemsCount = items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
      const itemsSummary = items
        .slice(0, 3)
        .map((item: { quantity: number; menu_item_name: string }) => `${item.quantity}x ${item.menu_item_name}`)
        .join(', ') + (items.length > 3 ? ` +${items.length - 3} más` : '');

      // Get customer info - can be object or array (depending on relation)
      const customerData = order.customers;
      const customer = Array.isArray(customerData)
        ? customerData[0] as { full_name: string; phone: string } | undefined
        : customerData as { full_name: string; phone: string } | null;

      return {
        order_id: order.id,
        tenant_id: order.tenant_id,
        branch_id: order.branch_id,
        display_number: order.display_number,
        order_status: order.status,
        delivery_status: order.delivery_status as DeliveryStatus,
        priority: order.priority,
        ordered_at: order.ordered_at,
        ready_at: order.ready_at,
        estimated_delivery_at: order.estimated_delivery_at,
        // Address
        delivery_address: order.delivery_address,
        delivery_instructions: order.delivery_instructions,
        // Customer
        customer_name: customer?.full_name || null,
        customer_phone: customer?.phone || order.delivery_address?.contact_phone || null,
        // Driver
        delivery_driver_id: order.delivery_driver_id,
        driver_name: driver?.full_name || null,
        driver_phone: driver?.phone || null,
        driver_vehicle_type: driver?.vehicle_type || null,
        // Financial
        total: order.total,
        delivery_fee: order.delivery_fee || 0,
        delivery_distance_km: order.delivery_distance_km,
        // Time
        minutes_elapsed: minutesElapsed,
        minutes_until_delivery: minutesUntilDelivery,
        // Items
        items_count: itemsCount,
        items_summary: itemsSummary,
      };
    }) || [];

    // Calculate stats
    const stats = {
      pending_assignment: kdsDeliveryOrders.filter(o => o.delivery_status === 'pending_assignment').length,
      driver_assigned: kdsDeliveryOrders.filter(o => ['driver_assigned', 'driver_arrived'].includes(o.delivery_status)).length,
      in_transit: kdsDeliveryOrders.filter(o => ['picked_up', 'in_transit', 'arriving'].includes(o.delivery_status)).length,
      ready_for_pickup: kdsDeliveryOrders.filter(o =>
        o.order_status === 'ready' &&
        ['pending_assignment', 'driver_assigned', 'driver_arrived'].includes(o.delivery_status)
      ).length,
      total_active: kdsDeliveryOrders.length,
    };

    return successResponse({
      orders: kdsDeliveryOrders,
      stats,
    });

  } catch (error) {
    console.error('[KDS Delivery API] Error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// =====================================================
// TIS TIS PLATFORM - KDS Delivery Stats API
// GET: Get delivery statistics for KDS dashboard
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
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
import type { DeliveryStatus } from '@/src/shared/types/delivery-types';

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    if (!branchId || !isValidUUID(branchId)) {
      return errorResponse('branch_id requerido', 400);
    }

    // Get counts by delivery status
    const { data: statusCounts, error: countError } = await supabase
      .from('restaurant_orders')
      .select('delivery_status, status')
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .eq('order_type', 'delivery')
      .in('delivery_status', [
        'pending_assignment',
        'driver_assigned',
        'driver_arrived',
        'picked_up',
        'in_transit',
        'arriving',
      ])
      .is('deleted_at', null);

    if (countError) {
      console.error('[KDS Delivery Stats API] Error fetching counts:', countError);
      return errorResponse('Error al obtener estadísticas', 500);
    }

    // Calculate stats
    const stats = {
      pending_assignment: statusCounts?.filter(o => o.delivery_status === 'pending_assignment').length || 0,
      driver_assigned: statusCounts?.filter(o =>
        ['driver_assigned', 'driver_arrived'].includes(o.delivery_status as string)
      ).length || 0,
      in_transit: statusCounts?.filter(o =>
        ['picked_up', 'in_transit', 'arriving'].includes(o.delivery_status as string)
      ).length || 0,
      ready_for_pickup: statusCounts?.filter(o =>
        o.status === 'ready' &&
        ['pending_assignment', 'driver_assigned', 'driver_arrived'].includes(o.delivery_status as string)
      ).length || 0,
      total_active: statusCounts?.length || 0,
    };

    // Get today's completed deliveries count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: completedToday } = await supabase
      .from('restaurant_orders')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .eq('order_type', 'delivery')
      .eq('delivery_status', 'delivered')
      .gte('actual_delivery_at', today.toISOString());

    // Get average delivery time for today (in minutes)
    const { data: deliveredOrders } = await supabase
      .from('restaurant_orders')
      .select('ordered_at, actual_delivery_at')
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .eq('order_type', 'delivery')
      .eq('delivery_status', 'delivered')
      .gte('actual_delivery_at', today.toISOString())
      .not('actual_delivery_at', 'is', null);

    let avgDeliveryTimeMinutes = 0;
    if (deliveredOrders && deliveredOrders.length > 0) {
      const totalMinutes = deliveredOrders.reduce((sum, order) => {
        const orderedAt = new Date(order.ordered_at);
        const deliveredAt = new Date(order.actual_delivery_at);
        return sum + Math.floor((deliveredAt.getTime() - orderedAt.getTime()) / 60000);
      }, 0);
      avgDeliveryTimeMinutes = Math.round(totalMinutes / deliveredOrders.length);
    }

    // Get failed deliveries count for today
    const { count: failedToday } = await supabase
      .from('restaurant_orders')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .eq('order_type', 'delivery')
      .in('delivery_status', ['failed', 'returned'])
      .gte('updated_at', today.toISOString());

    return successResponse({
      ...stats,
      completed_today: completedToday || 0,
      failed_today: failedToday || 0,
      avg_delivery_time_minutes: avgDeliveryTimeMinutes,
    });

  } catch (error) {
    console.error('[KDS Delivery Stats API] Error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

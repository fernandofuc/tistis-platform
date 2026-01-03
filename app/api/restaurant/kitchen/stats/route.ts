// =====================================================
// TIS TIS PLATFORM - KDS Stats API
// GET: Get kitchen statistics
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

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'branch_id requerido' }, { status: 400 });
    }

    // Get active orders count
    const { data: activeOrders } = await supabase
      .from('restaurant_orders')
      .select('id, status, order_type')
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .is('deleted_at', null);

    // Get items by status
    const { data: items } = await supabase
      .from('restaurant_order_items')
      .select(`
        id,
        status,
        kitchen_station,
        order:restaurant_orders!inner(id, branch_id, status, deleted_at)
      `)
      .eq('order.branch_id', branchId)
      .is('order.deleted_at', null)
      .in('status', ['pending', 'preparing', 'ready']);

    // Get average prep time from completed orders today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: completedOrders } = await supabase
      .from('restaurant_orders')
      .select('actual_prep_time')
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .eq('status', 'completed')
      .gte('completed_at', today.toISOString())
      .not('actual_prep_time', 'is', null);

    // Calculate stats
    const ordersByType: Record<string, number> = {};
    const ordersByStatus: Record<string, number> = {};

    activeOrders?.forEach(order => {
      ordersByType[order.order_type] = (ordersByType[order.order_type] || 0) + 1;
      ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
    });

    const itemsByStation: Record<string, number> = {};
    let pendingItems = 0;
    let preparingItems = 0;
    let readyItems = 0;

    items?.forEach(item => {
      itemsByStation[item.kitchen_station] = (itemsByStation[item.kitchen_station] || 0) + 1;
      if (item.status === 'pending') pendingItems++;
      if (item.status === 'preparing') preparingItems++;
      if (item.status === 'ready') readyItems++;
    });

    const avgPrepTime = completedOrders?.length
      ? Math.round(
          completedOrders.reduce((sum, o) => sum + (o.actual_prep_time || 0), 0) /
          completedOrders.length
        )
      : 0;

    const stats = {
      active_orders: activeOrders?.length || 0,
      pending_items: pendingItems,
      preparing_items: preparingItems,
      ready_items: readyItems,
      avg_prep_time: avgPrepTime,
      orders_by_type: ordersByType,
      orders_by_status: ordersByStatus,
      items_by_station: itemsByStation,
      peak_times: [],
      slow_items: [],
    };

    return NextResponse.json({ success: true, data: stats });

  } catch (error) {
    console.error('KDS Stats error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

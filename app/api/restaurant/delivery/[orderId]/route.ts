// =====================================================
// TIS TIS PLATFORM - Delivery Order API
// Operations on specific delivery orders
// =====================================================
//
// GET    /api/restaurant/delivery/[orderId] - Get delivery details
// PATCH  /api/restaurant/delivery/[orderId] - Update delivery status
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - Function: update_delivery_status()
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  type DeliveryStatus,
  DELIVERY_STATUSES,
  isValidStatusTransition,
} from '@/src/shared/types/delivery-types';

// ======================
// SUPABASE CLIENT
// ======================

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// ======================
// VALIDATION
// ======================

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function sanitizeText(text: string | null | undefined, maxLength: number = 500): string | null {
  if (!text) return null;
  return text.replace(/<[^>]*>/g, '').slice(0, maxLength);
}

// ======================
// AUTH HELPER
// ======================

async function getUserAndTenant(request: NextRequest) {
  const supabase = createServerClient();

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, tenant_id: null, error: 'Unauthorized' };
  }

  const token = authHeader.split(' ')[1];

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { user: null, tenant_id: null, error: 'Invalid token' };
  }

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (!userRole?.tenant_id) {
    return { user, tenant_id: null, error: 'No tenant assigned' };
  }

  return { user, tenant_id: userRole.tenant_id, error: null };
}

// ======================
// GET - Get Delivery Details
// ======================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const { user, tenant_id, error: authError } = await getUserAndTenant(request);
    if (authError || !tenant_id) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isValidUUID(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get order with delivery details
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .select(`
        id,
        tenant_id,
        branch_id,
        display_number,
        order_type,
        status,
        delivery_status,
        delivery_address,
        delivery_fee,
        delivery_distance_km,
        delivery_instructions,
        delivery_failure_reason,
        estimated_delivery_at,
        actual_delivery_at,
        delivery_driver_id,
        total,
        customer_notes,
        created_at,
        ordered_at
      `)
      .eq('id', orderId)
      .eq('tenant_id', tenant_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.order_type !== 'delivery') {
      return NextResponse.json(
        { success: false, error: 'This order is not a delivery order' },
        { status: 400 }
      );
    }

    // Get driver info if assigned
    let driver = null;
    if (order.delivery_driver_id) {
      const { data: driverData } = await supabase
        .from('delivery_drivers')
        .select('id, full_name, phone, vehicle_type, current_location')
        .eq('id', order.delivery_driver_id)
        .single();
      driver = driverData;
    }

    // Get tracking history
    const { data: tracking } = await supabase
      .from('delivery_tracking')
      .select('id, status, driver_location, notes, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      success: true,
      data: {
        order,
        driver,
        tracking: tracking || [],
      },
    });
  } catch (error) {
    console.error('[Delivery API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Update Delivery Status
// ======================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const { user, tenant_id, error: authError } = await getUserAndTenant(request);
    if (authError || !tenant_id) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isValidUUID(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, driver_location, notes, failure_reason } = body;

    // Validate status
    if (!status || !DELIVERY_STATUSES.includes(status as DeliveryStatus)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Valid values: ${DELIVERY_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate failure_reason is required for failed/returned
    if ((status === 'failed' || status === 'returned') && !failure_reason) {
      return NextResponse.json(
        { success: false, error: 'failure_reason is required for failed/returned status' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Call the update_delivery_status function
    const { data, error } = await supabase.rpc('update_delivery_status', {
      p_order_id: orderId,
      p_status: status,
      p_driver_location: driver_location || null,
      p_notes: sanitizeText(notes, 500) || null,
      p_failure_reason: sanitizeText(failure_reason, 255) || null,
    });

    if (error) {
      console.error('[Delivery API] RPC error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update delivery status' },
        { status: 500 }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.success) {
      return NextResponse.json(
        { success: false, error: result?.message || 'Update failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        order_id: result.order_id,
        new_status: result.new_status,
      },
    });
  } catch (error) {
    console.error('[Delivery API] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// TIS TIS PLATFORM - Delivery Driver Assignment API
// Assign driver to delivery order
// =====================================================
//
// POST /api/restaurant/delivery/[orderId]/assign
// Body: { driver_id?: string } - Optional, auto-assigns if not provided
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - Function: assign_delivery_driver()
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { DriverAssignmentResult } from '@/src/shared/types/delivery-types';

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
// POST - Assign Driver
// ======================

export async function POST(
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

    const body = await request.json().catch(() => ({}));
    const { driver_id } = body;

    // Validate driver_id if provided
    if (driver_id && !isValidUUID(driver_id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid driver ID' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify order belongs to tenant
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .select('id, tenant_id, order_type')
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

    // Call the assign_delivery_driver function
    const { data, error } = await supabase.rpc('assign_delivery_driver', {
      p_order_id: orderId,
      p_driver_id: driver_id || null,
    });

    if (error) {
      console.error('[Delivery Assign] RPC error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to assign driver' },
        { status: 500 }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.success) {
      return NextResponse.json(
        { success: false, error: result?.message || 'Assignment failed' },
        { status: 400 }
      );
    }

    const assignmentResult: DriverAssignmentResult = {
      success: true,
      driver_id: result.driver_id,
      driver_name: result.driver_name,
      driver_phone: result.driver_phone,
      estimated_arrival_minutes: result.estimated_arrival_minutes,
    };

    return NextResponse.json({
      success: true,
      data: assignmentResult,
    });
  } catch (error) {
    console.error('[Delivery Assign] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// TIS TIS PLATFORM - Delivery Driver API
// Operations on specific driver
// =====================================================
//
// GET    /api/restaurant/delivery/drivers/[driverId] - Get driver details
// PUT    /api/restaurant/delivery/drivers/[driverId] - Update driver
// PATCH  /api/restaurant/delivery/drivers/[driverId] - Update driver status/location
// DELETE /api/restaurant/delivery/drivers/[driverId] - Deactivate driver
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - Types: src/shared/types/delivery-types.ts
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  type VehicleType,
  type DriverStatus,
  VEHICLE_TYPES,
  DRIVER_STATUSES,
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

function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+\s-]/g, '').slice(0, 20);
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
// GET - Get Driver
// ======================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    const { driverId } = await params;
    const { user, tenant_id, error: authError } = await getUserAndTenant(request);
    if (authError || !tenant_id) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isValidUUID(driverId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid driver ID' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data: driver, error } = await supabase
      .from('delivery_drivers')
      .select('*')
      .eq('id', driverId)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !driver) {
      return NextResponse.json(
        { success: false, error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Get active deliveries count
    const { count: activeDeliveries } = await supabase
      .from('restaurant_orders')
      .select('id', { count: 'exact', head: true })
      .eq('delivery_driver_id', driverId)
      .in('delivery_status', ['driver_assigned', 'picked_up', 'in_transit', 'arriving']);

    return NextResponse.json({
      success: true,
      data: {
        ...driver,
        active_deliveries: activeDeliveries || 0,
      },
    });
  } catch (error) {
    console.error('[Driver API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// PUT - Update Driver
// ======================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    const { driverId } = await params;
    const { user, tenant_id, error: authError } = await getUserAndTenant(request);
    if (authError || !tenant_id) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isValidUUID(driverId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid driver ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = createServerClient();

    // Verify driver exists and belongs to tenant
    const { data: existing, error: existError } = await supabase
      .from('delivery_drivers')
      .select('id')
      .eq('id', driverId)
      .eq('tenant_id', tenant_id)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.full_name !== undefined) {
      updateData.full_name = sanitizeText(body.full_name, 150);
    }
    if (body.phone !== undefined) {
      updateData.phone = sanitizePhone(body.phone);
    }
    if (body.email !== undefined) {
      updateData.email = sanitizeText(body.email, 255);
    }
    if (body.vehicle_type !== undefined && VEHICLE_TYPES.includes(body.vehicle_type)) {
      updateData.vehicle_type = body.vehicle_type;
    }
    if (body.vehicle_plate !== undefined) {
      updateData.vehicle_plate = sanitizeText(body.vehicle_plate, 20);
    }
    if (body.vehicle_description !== undefined) {
      updateData.vehicle_description = sanitizeText(body.vehicle_description, 100);
    }
    if (body.max_distance_km !== undefined) {
      updateData.max_distance_km = Math.min(Math.max(body.max_distance_km, 1), 50);
    }
    if (body.accepts_cash !== undefined) {
      updateData.accepts_cash = Boolean(body.accepts_cash);
    }
    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update driver
    const { data: driver, error } = await supabase
      .from('delivery_drivers')
      .update(updateData)
      .eq('id', driverId)
      .select()
      .single();

    if (error) {
      console.error('[Driver API] Update error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update driver' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: driver,
    });
  } catch (error) {
    console.error('[Driver API] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Update Status/Location
// ======================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    const { driverId } = await params;
    const { user, tenant_id, error: authError } = await getUserAndTenant(request);
    if (authError || !tenant_id) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isValidUUID(driverId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid driver ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const supabase = createServerClient();

    // Verify driver exists
    const { data: existing, error: existError } = await supabase
      .from('delivery_drivers')
      .select('id, status')
      .eq('id', driverId)
      .eq('tenant_id', tenant_id)
      .single();

    if (existError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Driver not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // Update status
    if (body.status !== undefined && DRIVER_STATUSES.includes(body.status)) {
      // Don't allow changing from 'busy' to 'available' if has active deliveries
      if (existing.status === 'busy' && body.status === 'available') {
        const { count: activeDeliveries } = await supabase
          .from('restaurant_orders')
          .select('id', { count: 'exact', head: true })
          .eq('delivery_driver_id', driverId)
          .in('delivery_status', ['driver_assigned', 'picked_up', 'in_transit', 'arriving']);

        if (activeDeliveries && activeDeliveries > 0) {
          return NextResponse.json(
            { success: false, error: 'Cannot set to available while having active deliveries' },
            { status: 400 }
          );
        }
      }
      updateData.status = body.status;
    }

    // Update location
    if (body.current_location !== undefined) {
      const loc = body.current_location;
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        updateData.current_location = {
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy || null,
          updated_at: new Date().toISOString(),
        };
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update driver
    const { data: driver, error } = await supabase
      .from('delivery_drivers')
      .update(updateData)
      .eq('id', driverId)
      .select()
      .single();

    if (error) {
      console.error('[Driver API] Patch error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update driver' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: driver,
    });
  } catch (error) {
    console.error('[Driver API] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Deactivate Driver
// ======================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    const { driverId } = await params;
    const { user, tenant_id, error: authError } = await getUserAndTenant(request);
    if (authError || !tenant_id) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isValidUUID(driverId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid driver ID' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Check for active deliveries
    const { count: activeDeliveries } = await supabase
      .from('restaurant_orders')
      .select('id', { count: 'exact', head: true })
      .eq('delivery_driver_id', driverId)
      .in('delivery_status', ['driver_assigned', 'picked_up', 'in_transit', 'arriving']);

    if (activeDeliveries && activeDeliveries > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot deactivate driver with active deliveries' },
        { status: 400 }
      );
    }

    // Soft delete (deactivate)
    const { error } = await supabase
      .from('delivery_drivers')
      .update({
        is_active: false,
        status: 'offline',
      })
      .eq('id', driverId)
      .eq('tenant_id', tenant_id);

    if (error) {
      console.error('[Driver API] Delete error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to deactivate driver' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Driver deactivated successfully',
    });
  } catch (error) {
    console.error('[Driver API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

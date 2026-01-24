// =====================================================
// TIS TIS PLATFORM - Delivery Drivers API
// CRUD operations for delivery drivers
// =====================================================
//
// GET  /api/restaurant/delivery/drivers - List drivers
// POST /api/restaurant/delivery/drivers - Create driver
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
  type DeliveryDriverInput,
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
  // Keep only digits, +, and spaces
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
// GET - List Drivers
// ======================

export async function GET(request: NextRequest) {
  try {
    const { user, tenant_id, error: authError } = await getUserAndTenant(request);
    if (authError || !tenant_id) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    // Parse query params
    const status = searchParams.get('status');
    const available_only = searchParams.get('available_only') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('delivery_drivers')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status && DRIVER_STATUSES.includes(status as DriverStatus)) {
      query = query.eq('status', status);
    }

    if (available_only) {
      query = query.eq('status', 'available');
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[Drivers API] Error fetching drivers:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch drivers' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('[Drivers API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create Driver
// ======================

export async function POST(request: NextRequest) {
  try {
    const { user, tenant_id, error: authError } = await getUserAndTenant(request);
    if (authError || !tenant_id) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    const { full_name, phone, vehicle_type } = body;

    if (!full_name || typeof full_name !== 'string' || full_name.length < 2) {
      return NextResponse.json(
        { success: false, error: 'full_name is required (min 2 characters)' },
        { status: 400 }
      );
    }

    if (!phone || typeof phone !== 'string' || phone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'phone is required (min 10 characters)' },
        { status: 400 }
      );
    }

    if (!vehicle_type || !VEHICLE_TYPES.includes(vehicle_type as VehicleType)) {
      return NextResponse.json(
        { success: false, error: `vehicle_type is required. Valid values: ${VEHICLE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate optional staff_id if provided
    if (body.staff_id && !isValidUUID(body.staff_id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid staff_id' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Prepare data
    const driverData = {
      tenant_id,
      staff_id: body.staff_id || null,
      full_name: sanitizeText(full_name, 150),
      phone: sanitizePhone(phone),
      email: sanitizeText(body.email, 255) || null,
      vehicle_type: vehicle_type as VehicleType,
      vehicle_plate: sanitizeText(body.vehicle_plate, 20) || null,
      vehicle_description: sanitizeText(body.vehicle_description, 100) || null,
      max_distance_km: Math.min(Math.max(body.max_distance_km || 10, 1), 50),
      accepts_cash: body.accepts_cash !== false,
      is_active: body.is_active !== false,
      status: 'available' as DriverStatus,
    };

    // Insert driver
    const { data: driver, error } = await supabase
      .from('delivery_drivers')
      .insert(driverData)
      .select()
      .single();

    if (error) {
      console.error('[Drivers API] Insert error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create driver' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: driver,
    }, { status: 201 });
  } catch (error) {
    console.error('[Drivers API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

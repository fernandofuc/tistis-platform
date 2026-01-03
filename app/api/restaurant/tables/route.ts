// =====================================================
// TIS TIS PLATFORM - Restaurant Tables API
// GET: List tables, POST: Create table
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ======================
// GET - List Tables
// ======================
export async function GET(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.substring(7);

    // Create Supabase client with user token
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Get user and their tenant
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    // Get user's tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userRole) {
      return NextResponse.json({ success: false, error: 'Sin tenant asociado' }, { status: 403 });
    }

    const tenantId = userRole.tenant_id;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branch_id');
    const zone = searchParams.get('zone');
    const status = searchParams.get('status');
    const minCapacity = searchParams.get('min_capacity');
    const isOutdoor = searchParams.get('is_outdoor');
    const isAccessible = searchParams.get('is_accessible');
    const search = searchParams.get('search');

    // Build query
    let query = supabase
      .from('restaurant_tables')
      .select(`
        *,
        branch:branches(id, name)
      `)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('table_number', { ascending: true });

    // Apply filters
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    if (zone) {
      query = query.eq('zone', zone);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (minCapacity) {
      query = query.gte('max_capacity', parseInt(minCapacity));
    }
    if (isOutdoor === 'true') {
      query = query.eq('is_outdoor', true);
    }
    if (isAccessible === 'true') {
      query = query.eq('is_accessible', true);
    }
    if (search) {
      query = query.or(`table_number.ilike.%${search}%,name.ilike.%${search}%`);
    }

    const { data: tables, error: tablesError } = await query;

    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      return NextResponse.json({ success: false, error: 'Error al cargar mesas' }, { status: 500 });
    }

    // Calculate stats
    const allTables = tables || [];
    const stats = {
      total: allTables.filter(t => t.is_active).length,
      available: allTables.filter(t => t.status === 'available' && t.is_active).length,
      occupied: allTables.filter(t => t.status === 'occupied' && t.is_active).length,
      reserved: allTables.filter(t => t.status === 'reserved' && t.is_active).length,
      unavailable: allTables.filter(t => t.status === 'unavailable' && t.is_active).length,
      maintenance: allTables.filter(t => t.status === 'maintenance' && t.is_active).length,
      total_capacity: allTables.filter(t => t.is_active).reduce((sum, t) => sum + t.max_capacity, 0),
      occupancy_rate: 0,
      zones: {} as Record<string, number>,
    };

    // Calculate occupancy rate
    const activeOccupied = stats.occupied + stats.reserved;
    stats.occupancy_rate = stats.total > 0 ? Math.round((activeOccupied / stats.total) * 100) : 0;

    // Group by zone
    allTables.forEach(t => {
      if (t.is_active) {
        stats.zones[t.zone] = (stats.zones[t.zone] || 0) + 1;
      }
    });

    // Get current reservations for each table
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const tablesWithReservations = await Promise.all(
      allTables.map(async (table) => {
        // Get current/next reservation for this table
        const { data: reservations } = await supabase
          .from('appointments')
          .select(`
            id,
            scheduled_at,
            duration_minutes,
            status,
            lead:leads(full_name),
            restaurant_details:appointment_restaurant_details(
              party_size,
              arrival_status,
              occasion_type,
              special_requests
            )
          `)
          .eq('tenant_id', tenantId)
          .gte('scheduled_at', `${today}T00:00:00`)
          .lte('scheduled_at', `${today}T23:59:59`)
          .not('status', 'in', '("cancelled","no_show")')
          .order('scheduled_at', { ascending: true })
          .limit(1);

        // Find if any reservation is for this table
        const currentReservation = reservations?.find(r => {
          const details = r.restaurant_details as any;
          return details?.table_id === table.id;
        });

        let current_reservation = null;
        if (currentReservation) {
          const details = currentReservation.restaurant_details as any;
          const lead = currentReservation.lead as any;
          current_reservation = {
            id: currentReservation.id,
            guest_name: lead?.full_name || 'Sin nombre',
            party_size: details?.party_size || 0,
            scheduled_at: currentReservation.scheduled_at,
            arrival_status: details?.arrival_status || 'pending',
            occasion_type: details?.occasion_type,
            special_requests: details?.special_requests,
          };
        }

        return {
          ...table,
          current_reservation,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        tables: tablesWithReservations,
        stats,
      },
    });

  } catch (error) {
    console.error('Tables API error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create Table
// ======================
export async function POST(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.substring(7);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Get user and their tenant
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    // Get user's tenant and role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userRole) {
      return NextResponse.json({ success: false, error: 'Sin tenant asociado' }, { status: 403 });
    }

    // Check permissions
    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para crear mesas' }, { status: 403 });
    }

    const tenantId = userRole.tenant_id;

    // Parse body
    const body = await request.json();
    const {
      branch_id,
      table_number,
      name,
      min_capacity = 1,
      max_capacity = 4,
      zone = 'main',
      floor = 1,
      position_x,
      position_y,
      is_outdoor = false,
      is_accessible = true,
      is_high_top = false,
      has_power_outlet = false,
      features = [],
      can_combine = true,
      combinable_with,
      priority = 0,
      is_active = true,
    } = body;

    // Validate required fields
    if (!branch_id || !table_number) {
      return NextResponse.json({
        success: false,
        error: 'branch_id y table_number son requeridos',
      }, { status: 400 });
    }

    // Verify branch belongs to tenant
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branch_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!branch) {
      return NextResponse.json({ success: false, error: 'Sucursal no encontrada' }, { status: 404 });
    }

    // Check if table_number already exists in this branch
    const { data: existingTable } = await supabase
      .from('restaurant_tables')
      .select('id')
      .eq('branch_id', branch_id)
      .eq('table_number', table_number)
      .is('deleted_at', null)
      .single();

    if (existingTable) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe una mesa con ese número en esta sucursal',
      }, { status: 400 });
    }

    // Get max display_order
    const { data: maxOrderResult } = await supabase
      .from('restaurant_tables')
      .select('display_order')
      .eq('branch_id', branch_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderResult?.display_order || 0) + 1;

    // Insert table
    const { data: newTable, error: insertError } = await supabase
      .from('restaurant_tables')
      .insert({
        tenant_id: tenantId,
        branch_id,
        table_number,
        name: name || null,
        min_capacity,
        max_capacity,
        zone,
        floor,
        position_x: position_x || null,
        position_y: position_y || null,
        is_outdoor,
        is_accessible,
        is_high_top,
        has_power_outlet,
        features,
        can_combine,
        combinable_with: combinable_with || null,
        status: 'available',
        priority,
        is_active,
        display_order: nextOrder,
      })
      .select(`
        *,
        branch:branches(id, name)
      `)
      .single();

    if (insertError) {
      console.error('Error creating table:', insertError);
      return NextResponse.json({ success: false, error: 'Error al crear mesa' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: newTable,
    });

  } catch (error) {
    console.error('Create table error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

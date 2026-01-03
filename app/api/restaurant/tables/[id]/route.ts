// =====================================================
// TIS TIS PLATFORM - Restaurant Tables API - Single Table
// GET: Get table, PUT: Update table, DELETE: Delete table
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get user and verify permissions
async function getUserAndVerify(request: NextRequest, tableId: string) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', status: 401 };
  }
  const token = authHeader.substring(7);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { error: 'Token inválido', status: 401 };
  }

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!userRole) {
    return { error: 'Sin tenant asociado', status: 403 };
  }

  // Verify table belongs to tenant
  const { data: table } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('id', tableId)
    .eq('tenant_id', userRole.tenant_id)
    .is('deleted_at', null)
    .single();

  if (!table) {
    return { error: 'Mesa no encontrada', status: 404 };
  }

  return { user, userRole, table, supabase };
}

// ======================
// GET - Get Single Table
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerify(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { table, supabase, userRole } = result;

    // Get branch info
    const { data: branch } = await supabase
      .from('branches')
      .select('id, name')
      .eq('id', table.branch_id)
      .single();

    // Get today's reservations for this table
    const today = new Date().toISOString().split('T')[0];
    const { data: reservations } = await supabase
      .from('appointment_restaurant_details')
      .select(`
        id,
        party_size,
        arrival_status,
        occasion_type,
        special_requests,
        appointment:appointments(
          id,
          scheduled_at,
          duration_minutes,
          status,
          lead:leads(full_name, phone)
        )
      `)
      .eq('table_id', table.id)
      .gte('appointment.scheduled_at', `${today}T00:00:00`)
      .lte('appointment.scheduled_at', `${today}T23:59:59`)
      .not('appointment.status', 'in', '("cancelled","no_show")')
      .order('appointment.scheduled_at', { ascending: true });

    return NextResponse.json({
      success: true,
      data: {
        ...table,
        branch,
        today_reservations: reservations || [],
      },
    });

  } catch (error) {
    console.error('Get table error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PUT - Update Table
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerify(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { table, supabase, userRole } = result;

    // Check permissions
    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para editar mesas' }, { status: 403 });
    }

    const body = await request.json();

    // Validate table_number if changing
    if (body.table_number && body.table_number !== table.table_number) {
      const { data: existingTable } = await supabase
        .from('restaurant_tables')
        .select('id')
        .eq('branch_id', table.branch_id)
        .eq('table_number', body.table_number)
        .is('deleted_at', null)
        .neq('id', table.id)
        .single();

      if (existingTable) {
        return NextResponse.json({
          success: false,
          error: 'Ya existe una mesa con ese número en esta sucursal',
        }, { status: 400 });
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'table_number',
      'name',
      'min_capacity',
      'max_capacity',
      'zone',
      'floor',
      'position_x',
      'position_y',
      'is_outdoor',
      'is_accessible',
      'is_high_top',
      'has_power_outlet',
      'features',
      'can_combine',
      'combinable_with',
      'status',
      'priority',
      'is_active',
      'display_order',
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    // Update table
    const { data: updatedTable, error: updateError } = await supabase
      .from('restaurant_tables')
      .update(updateData)
      .eq('id', table.id)
      .select(`
        *,
        branch:branches(id, name)
      `)
      .single();

    if (updateError) {
      console.error('Error updating table:', updateError);
      return NextResponse.json({ success: false, error: 'Error al actualizar mesa' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updatedTable,
    });

  } catch (error) {
    console.error('Update table error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// DELETE - Soft Delete Table
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getUserAndVerify(request, params.id);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { table, supabase, userRole } = result;

    // Check permissions
    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para eliminar mesas' }, { status: 403 });
    }

    // Check if table has upcoming reservations
    const today = new Date().toISOString().split('T')[0];
    const { data: upcomingReservations } = await supabase
      .from('appointment_restaurant_details')
      .select(`
        id,
        appointment:appointments(status, scheduled_at)
      `)
      .eq('table_id', table.id)
      .gte('appointment.scheduled_at', `${today}T00:00:00`)
      .not('appointment.status', 'in', '("cancelled","no_show","completed")');

    if (upcomingReservations && upcomingReservations.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede eliminar una mesa con reservaciones pendientes',
      }, { status: 400 });
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('restaurant_tables')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', table.id);

    if (deleteError) {
      console.error('Error deleting table:', deleteError);
      return NextResponse.json({ success: false, error: 'Error al eliminar mesa' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete table error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

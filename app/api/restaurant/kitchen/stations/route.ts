// =====================================================
// TIS TIS PLATFORM - Kitchen Stations API
// GET: List stations, POST: Create station
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get user and tenant
async function getUserAndTenant(request: NextRequest) {
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

  return { user, userRole, supabase };
}

// ======================
// GET - List Stations
// ======================
export async function GET(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'branch_id requerido' }, { status: 400 });
    }

    const { data: stations, error } = await supabase
      .from('kitchen_stations')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching stations:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener estaciones' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: stations });

  } catch (error) {
    console.error('Get stations error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create Station
// ======================
export async function POST(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    // Check permissions
    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para crear estaciones' }, { status: 403 });
    }

    const body = await request.json();
    const {
      branch_id,
      code,
      name,
      description,
      station_type,
      handles_categories,
      printer_name,
      printer_ip,
      display_color,
      is_active,
      default_staff_ids,
    } = body;

    if (!branch_id || !code || !name) {
      return NextResponse.json({ success: false, error: 'branch_id, code y name son requeridos' }, { status: 400 });
    }

    // Check for duplicate code
    const { data: existing } = await supabase
      .from('kitchen_stations')
      .select('id')
      .eq('branch_id', branch_id)
      .eq('code', code)
      .is('deleted_at', null)
      .single();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Ya existe una estación con ese código' }, { status: 400 });
    }

    // Get next display order
    const { data: lastStation } = await supabase
      .from('kitchen_stations')
      .select('display_order')
      .eq('branch_id', branch_id)
      .is('deleted_at', null)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const displayOrder = (lastStation?.display_order || 0) + 1;

    const { data: station, error } = await supabase
      .from('kitchen_stations')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        code,
        name,
        description,
        station_type: station_type || 'prep',
        handles_categories: handles_categories || [],
        printer_name,
        printer_ip,
        display_color: display_color || '#3B82F6',
        display_order: displayOrder,
        is_active: is_active !== false,
        default_staff_ids: default_staff_ids || [],
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating station:', error);
      return NextResponse.json({ success: false, error: 'Error al crear estación' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: station }, { status: 201 });

  } catch (error) {
    console.error('Create station error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

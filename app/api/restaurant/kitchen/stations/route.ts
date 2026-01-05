// =====================================================
// TIS TIS PLATFORM - Kitchen Stations API
// GET: List stations, POST: Create station
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
  canWrite,
} from '@/src/lib/api/auth-helper';

// ======================
// GET - List Stations
// ======================
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

    const { data: stations, error } = await supabase
      .from('kitchen_stations')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching stations:', error);
      return errorResponse('Error al obtener estaciones', 500);
    }

    return successResponse(stations);

  } catch (error) {
    console.error('Get stations error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Station
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    // Check permissions
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para crear estaciones', 403);
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

    if (!branch_id || !isValidUUID(branch_id)) {
      return errorResponse('branch_id inválido', 400);
    }

    if (!code || !name) {
      return errorResponse('code y name son requeridos', 400);
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
      return errorResponse('Ya existe una estación con ese código', 400);
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
      return errorResponse('Error al crear estación', 500);
    }

    return successResponse(station, 201);

  } catch (error) {
    console.error('Create station error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

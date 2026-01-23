// =====================================================
// TIS TIS PLATFORM - Kitchen Station API (by ID)
// GET: Get station, PUT: Update station, DELETE: Delete station
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

// Valid station types
const VALID_STATION_TYPES = ['main', 'grill', 'fry', 'salad', 'sushi', 'pizza', 'dessert', 'bar', 'expeditor', 'prep', 'assembly'] as const;

// Sanitize text to prevent XSS
function sanitizeText(text: unknown, maxLength = 500): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') return null;
  const sanitized = text.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
  return sanitized.slice(0, maxLength) || null;
}

// Validate hex color
function sanitizeColor(color: unknown): string | undefined {
  if (typeof color !== 'string') return undefined;
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  return hexRegex.test(color) ? color : undefined;
}

// Validate IP address
function sanitizeIP(ip: unknown): string | null {
  if (typeof ip !== 'string' || !ip) return null;
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip) ? ip : null;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ======================
// GET - Get Station by ID
// ======================
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { id: stationId } = await context.params;

    if (!stationId || !isValidUUID(stationId)) {
      return errorResponse('ID de estación inválido', 400);
    }

    const { data: station, error } = await supabase
      .from('kitchen_stations')
      .select('*')
      .eq('id', stationId)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (error || !station) {
      return errorResponse('Estación no encontrada', 404);
    }

    return successResponse(station);

  } catch (error) {
    console.error('Get station error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// PUT - Update Station
// ======================
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { id: stationId } = await context.params;

    // Check permissions
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para editar estaciones', 403);
    }

    if (!stationId || !isValidUUID(stationId)) {
      return errorResponse('ID de estación inválido', 400);
    }

    // Verify station exists and belongs to tenant
    const { data: existingStation, error: fetchError } = await supabase
      .from('kitchen_stations')
      .select('id, branch_id, code')
      .eq('id', stationId)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingStation) {
      return errorResponse('Estación no encontrada', 404);
    }

    const body = await request.json();
    const {
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

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (code !== undefined) {
      const sanitizedCode = sanitizeText(code, 50);
      if (sanitizedCode) {
        // Check for duplicate code (excluding current station)
        const { data: duplicateStation } = await supabase
          .from('kitchen_stations')
          .select('id')
          .eq('branch_id', existingStation.branch_id)
          .eq('code', sanitizedCode)
          .neq('id', stationId)
          .is('deleted_at', null)
          .single();

        if (duplicateStation) {
          return errorResponse('Ya existe una estación con ese código', 400);
        }
        updateData.code = sanitizedCode;
      }
    }

    if (name !== undefined) {
      const sanitizedName = sanitizeText(name, 100);
      if (sanitizedName) {
        updateData.name = sanitizedName;
      }
    }

    if (description !== undefined) {
      updateData.description = sanitizeText(description, 500);
    }

    if (station_type !== undefined && VALID_STATION_TYPES.includes(station_type)) {
      updateData.station_type = station_type;
    }

    if (printer_name !== undefined) {
      updateData.printer_name = sanitizeText(printer_name, 100);
    }

    if (printer_ip !== undefined) {
      updateData.printer_ip = sanitizeIP(printer_ip);
    }

    if (display_color !== undefined) {
      const color = sanitizeColor(display_color);
      if (color) updateData.display_color = color;
    }

    if (is_active !== undefined) {
      updateData.is_active = Boolean(is_active);
    }

    if (handles_categories !== undefined) {
      const validCategories = Array.isArray(handles_categories)
        ? handles_categories.filter((id: unknown) => typeof id === 'string' && isValidUUID(id)).slice(0, 50)
        : [];
      updateData.handles_categories = validCategories;
    }

    if (default_staff_ids !== undefined) {
      const validStaffIds = Array.isArray(default_staff_ids)
        ? default_staff_ids.filter((id: unknown) => typeof id === 'string' && isValidUUID(id)).slice(0, 20)
        : [];
      updateData.default_staff_ids = validStaffIds;
    }

    // Always update updated_at
    updateData.updated_at = new Date().toISOString();

    const { data: station, error } = await supabase
      .from('kitchen_stations')
      .update(updateData)
      .eq('id', stationId)
      .eq('tenant_id', userRole.tenant_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating station:', error);
      return errorResponse('Error al actualizar estación', 500);
    }

    return successResponse(station);

  } catch (error) {
    console.error('Update station error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// DELETE - Soft Delete Station
// ======================
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { id: stationId } = await context.params;

    // Check permissions
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para eliminar estaciones', 403);
    }

    if (!stationId || !isValidUUID(stationId)) {
      return errorResponse('ID de estación inválido', 400);
    }

    // Verify station exists and belongs to tenant
    const { data: existingStation, error: fetchError } = await supabase
      .from('kitchen_stations')
      .select('id')
      .eq('id', stationId)
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingStation) {
      return errorResponse('Estación no encontrada', 404);
    }

    // Soft delete
    const { error } = await supabase
      .from('kitchen_stations')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', stationId)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('Error deleting station:', error);
      return errorResponse('Error al eliminar estación', 500);
    }

    return successResponse({ message: 'Estación eliminada correctamente' });

  } catch (error) {
    console.error('Delete station error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

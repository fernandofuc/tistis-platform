// =====================================================
// TIS TIS PLATFORM - Restaurant Tables API - Single Table
// GET: Get table, PUT: Update table, DELETE: Delete table
// Security: H1-H12 hardening applied
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  canWrite,
  canDelete,
  isValidUUID,
} from '@/src/lib/api/auth-helper';
import { sanitizeText, sanitizeInteger, isSafeKey, LIMITS } from '@/src/lib/api/sanitization-helper';

// Constants (match tables/route.ts)
const MAX_CAPACITY = 100;
const MAX_FEATURES = 20;
const MAX_COMBINABLE = 50;
const MAX_DISPLAY_ORDER = 2147483640; // H17: Safe max before INT overflow
const VALID_STATUSES = ['available', 'occupied', 'reserved', 'unavailable', 'maintenance'];

// H6/H13: Sanitize features array with prototype pollution protection
function sanitizeFeatures(features: unknown): string[] {
  if (!Array.isArray(features)) return [];
  const result: string[] = [];
  for (const f of features) {
    // H13: Strict type check - reject anything that's not a primitive string
    if (typeof f !== 'string') continue;
    // H13: Check for prototype pollution attempts in string content
    if (f.includes('__proto__') || f.includes('constructor') || f.includes('prototype')) continue;
    const sanitized = sanitizeText(f, 50);
    if (sanitized && sanitized.length > 0) {
      result.push(sanitized);
    }
    if (result.length >= MAX_FEATURES) break;
  }
  return result;
}

// H12: Sanitize combinable_with array (must be valid UUIDs)
function sanitizeCombinableWith(ids: unknown): string[] | null {
  if (!ids) return null;
  if (!Array.isArray(ids)) return null;
  return ids
    .filter((id): id is string => typeof id === 'string' && isValidUUID(id))
    .slice(0, MAX_COMBINABLE);
}

// ======================
// GET - Get Single Table (H11: Using centralized auth helper)
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // H2: Validate UUID
    if (!isValidUUID(id)) {
      return errorResponse('ID de mesa inválido', 400);
    }

    // H11: Use centralized auth helper
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const tenantId = userRole.tenant_id;

    // Verify table belongs to tenant
    const { data: table, error: tableError } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (tableError || !table) {
      return errorResponse('Mesa no encontrada', 404);
    }

    // Get branch info (H24: Validate tenant ownership)
    const { data: branch } = await supabase
      .from('branches')
      .select('id, name')
      .eq('id', table.branch_id)
      .eq('tenant_id', tenantId) // H24: Ensure branch belongs to same tenant
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

    return successResponse({
      ...table,
      branch,
      today_reservations: reservations || [],
    });

  } catch (error: unknown) {
    console.error('Get table error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown';
    return errorResponse(`Error interno: ${errorMessage}`, 500);
  }
}

// ======================
// PUT - Update Table (H11: Using centralized auth helper)
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // H2: Validate UUID
    if (!isValidUUID(id)) {
      return errorResponse('ID de mesa inválido', 400);
    }

    // H11: Use centralized auth helper
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    // Check permissions
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para editar mesas', 403);
    }

    const tenantId = userRole.tenant_id;

    // Verify table belongs to tenant
    const { data: table, error: tableError } = await supabase
      .from('restaurant_tables')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (tableError || !table) {
      return errorResponse('Mesa no encontrada', 404);
    }

    const body = await request.json();

    // H19: Explicitly block branch_id changes - tables cannot be moved between branches
    if (body.branch_id !== undefined && body.branch_id !== table.branch_id) {
      return errorResponse('No se puede cambiar la sucursal de una mesa existente', 400);
    }

    // Build sanitized update data using whitelist approach
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(), // H10: Always update timestamp
    };

    // H3: Sanitize text fields
    if (body.table_number !== undefined) {
      const sanitizedTableNumber = sanitizeText(body.table_number, 20);
      if (!sanitizedTableNumber) {
        return errorResponse('table_number inválido', 400);
      }

      // Check uniqueness if changing
      if (sanitizedTableNumber !== table.table_number) {
        const { data: existingTable } = await supabase
          .from('restaurant_tables')
          .select('id')
          .eq('branch_id', table.branch_id)
          .eq('table_number', sanitizedTableNumber)
          .is('deleted_at', null)
          .neq('id', table.id)
          .maybeSingle();

        if (existingTable) {
          return errorResponse('Ya existe una mesa con ese número en esta sucursal', 409);
        }
      }
      updateData.table_number = sanitizedTableNumber;
    }

    if (body.name !== undefined) {
      updateData.name = sanitizeText(body.name, LIMITS.MAX_TEXT_MEDIUM);
    }

    if (body.zone !== undefined) {
      updateData.zone = sanitizeText(body.zone, 50) || 'main';
    }

    // H7: Sanitize capacity fields with validation
    if (body.min_capacity !== undefined) {
      updateData.min_capacity = sanitizeInteger(body.min_capacity, 1, MAX_CAPACITY, 1) ?? 1;
    }
    if (body.max_capacity !== undefined) {
      updateData.max_capacity = sanitizeInteger(body.max_capacity, 1, MAX_CAPACITY, 4) ?? 4;
    }

    // H7: Validate min <= max (considering current values)
    const finalMinCap = (updateData.min_capacity as number) ?? table.min_capacity;
    const finalMaxCap = (updateData.max_capacity as number) ?? table.max_capacity;
    if (finalMinCap > finalMaxCap) {
      return errorResponse('min_capacity no puede ser mayor que max_capacity', 400);
    }

    // Sanitize numeric fields
    if (body.floor !== undefined) {
      updateData.floor = sanitizeInteger(body.floor, -10, 100, 1) ?? 1;
    }
    if (body.position_x !== undefined) {
      updateData.position_x = sanitizeInteger(body.position_x, 0, 10000, 0);
    }
    if (body.position_y !== undefined) {
      updateData.position_y = sanitizeInteger(body.position_y, 0, 10000, 0);
    }
    if (body.priority !== undefined) {
      updateData.priority = sanitizeInteger(body.priority, 0, 1000, 0) ?? 0;
    }
    if (body.display_order !== undefined) {
      // H17: Clamp display_order to prevent overflow
      const newOrder = sanitizeInteger(body.display_order, 0, MAX_DISPLAY_ORDER, 0) ?? 0;
      updateData.display_order = Math.min(newOrder, MAX_DISPLAY_ORDER);
    }

    // Boolean fields
    if (body.is_outdoor !== undefined) {
      updateData.is_outdoor = Boolean(body.is_outdoor);
    }
    if (body.is_accessible !== undefined) {
      updateData.is_accessible = Boolean(body.is_accessible);
    }
    if (body.is_high_top !== undefined) {
      updateData.is_high_top = Boolean(body.is_high_top);
    }
    if (body.has_power_outlet !== undefined) {
      updateData.has_power_outlet = Boolean(body.has_power_outlet);
    }
    if (body.can_combine !== undefined) {
      updateData.can_combine = Boolean(body.can_combine);
    }
    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    // H8: Validate status enum
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return errorResponse('status inválido', 400);
      }
      updateData.status = body.status;
    }

    // H6: Sanitize features array
    if (body.features !== undefined) {
      updateData.features = sanitizeFeatures(body.features);
    }

    // H12/H18: Sanitize combinable_with array and validate references
    if (body.combinable_with !== undefined) {
      const rawCombinableWith = sanitizeCombinableWith(body.combinable_with);

      if (rawCombinableWith && rawCombinableWith.length > 0) {
        // H18: Remove self-reference (can't combine with itself)
        const filteredIds = rawCombinableWith.filter(id => id !== table.id);

        if (filteredIds.length > 0) {
          // H18: Validate all referenced tables exist in same tenant
          const { data: validTables } = await supabase
            .from('restaurant_tables')
            .select('id')
            .in('id', filteredIds)
            .eq('tenant_id', tenantId)
            .is('deleted_at', null);

          const validIds = new Set(validTables?.map((t: { id: string }) => t.id) || []);
          const validatedCombinableWith = filteredIds.filter(id => validIds.has(id));
          updateData.combinable_with = validatedCombinableWith.length > 0 ? validatedCombinableWith : null;
        } else {
          updateData.combinable_with = null;
        }
      } else {
        updateData.combinable_with = null;
      }
    }

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
      console.error('Error updating table:', JSON.stringify(updateError));
      if (updateError.code === '23505') {
        return errorResponse('Ya existe una mesa con ese número', 409);
      }
      return errorResponse('Error al actualizar mesa', 500);
    }

    return successResponse(updatedTable);

  } catch (error: unknown) {
    console.error('Update table error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown';
    return errorResponse(`Error interno: ${errorMessage}`, 500);
  }
}

// ======================
// DELETE - Soft Delete Table (H11: Using centralized auth helper)
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // H2: Validate UUID
    if (!isValidUUID(id)) {
      return errorResponse('ID de mesa inválido', 400);
    }

    // H11: Use centralized auth helper
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    // Check permissions - only admin/owner can delete
    if (!canDelete(userRole.role)) {
      return errorResponse('Sin permisos para eliminar mesas', 403);
    }

    const tenantId = userRole.tenant_id;

    // Verify table belongs to tenant
    const { data: table, error: tableError } = await supabase
      .from('restaurant_tables')
      .select('id, branch_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (tableError || !table) {
      return errorResponse('Mesa no encontrada', 404);
    }

    // Check if table has upcoming reservations
    const today = new Date().toISOString().split('T')[0];
    const { data: upcomingReservations, count } = await supabase
      .from('appointment_restaurant_details')
      .select(`
        id,
        appointment:appointments!inner(status, scheduled_at)
      `, { count: 'exact', head: true })
      .eq('table_id', table.id)
      .gte('appointment.scheduled_at', `${today}T00:00:00`)
      .not('appointment.status', 'in', '("cancelled","no_show","completed")');

    if (count && count > 0) {
      return errorResponse('No se puede eliminar una mesa con reservaciones pendientes', 400);
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('restaurant_tables')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false, // Also mark as inactive
      })
      .eq('id', table.id);

    if (deleteError) {
      console.error('Error deleting table:', JSON.stringify(deleteError));
      return errorResponse('Error al eliminar mesa', 500);
    }

    return successResponse({ deleted: true });

  } catch (error: unknown) {
    console.error('Delete table error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown';
    return errorResponse(`Error interno: ${errorMessage}`, 500);
  }
}

// =====================================================
// TIS TIS PLATFORM - Restaurant Table Status API
// PATCH: Update table status
// Security: Using centralized auth helper
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  canWrite,
  isValidUUID,
} from '@/src/lib/api/auth-helper';

// Valid status values
const VALID_STATUSES = ['available', 'occupied', 'reserved', 'unavailable', 'maintenance'] as const;
type TableStatus = typeof VALID_STATUSES[number];

// ======================
// PATCH - Update Table Status
// ======================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return errorResponse('ID de mesa inválido', 400);
    }

    // Auth check
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    // Check permissions
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para cambiar estado de mesas', 403);
    }

    const tenantId = userRole.tenant_id;

    // Parse body
    const body = await request.json();
    const { status } = body;

    // Validate status
    if (!status || !VALID_STATUSES.includes(status as TableStatus)) {
      return errorResponse('Estado inválido. Estados válidos: available, occupied, reserved, unavailable, maintenance', 400);
    }

    // Verify table belongs to tenant and exists
    const { data: table, error: tableError } = await supabase
      .from('restaurant_tables')
      .select('id, status')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (tableError || !table) {
      return errorResponse('Mesa no encontrada', 404);
    }

    // Update status
    const { data: updatedTable, error: updateError } = await supabase
      .from('restaurant_tables')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        branch:branches(id, name)
      `)
      .single();

    if (updateError) {
      console.error('Error updating table status:', JSON.stringify(updateError));
      return errorResponse('Error al actualizar estado de mesa', 500);
    }

    return successResponse(updatedTable);

  } catch (error: unknown) {
    console.error('Update table status error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown';
    return errorResponse(`Error interno: ${errorMessage}`, 500);
  }
}

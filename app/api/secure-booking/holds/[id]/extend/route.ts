// =====================================================
// TIS TIS PLATFORM - Extend Hold API
// POST: Extend a hold's expiration time
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
} from '@/src/lib/api/auth-helper';

function sanitizeNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

// ======================
// POST - Extend Hold
// ======================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID invalido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse('JSON invalido en el cuerpo de la solicitud', 400);
    }

    const additionalMinutes = sanitizeNumber(body.additional_minutes, 1, 60, 10);

    // Get the current hold
    const { data: hold, error: fetchError } = await supabase
      .from('booking_holds')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (fetchError || !hold) {
      return errorResponse('Hold no encontrado', 404);
    }

    // Check if hold is still active
    if (hold.status !== 'active') {
      return errorResponse('Solo se puede extender un hold activo', 400);
    }

    // Check if already expired
    if (new Date(hold.expires_at) <= new Date()) {
      return errorResponse('El hold ya expiro, no se puede extender', 400);
    }

    // Calculate new expiration
    const currentExpiration = new Date(hold.expires_at);
    const newExpiration = new Date(currentExpiration.getTime() + additionalMinutes * 60 * 1000);

    // Update the hold
    const { data: updatedHold, error: updateError } = await supabase
      .from('booking_holds')
      .update({
        expires_at: newExpiration.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select()
      .single();

    if (updateError) {
      console.error('[holds/:id/extend] Update error:', updateError);
      return errorResponse('Error al extender hold', 500);
    }

    return successResponse(updatedHold);

  } catch (error) {
    console.error('[holds/:id/extend] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// =====================================================
// TIS TIS PLATFORM - Resolve Penalty API
// POST: Mark a penalty as resolved
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

function sanitizeText(text: unknown, maxLength = 500): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') return null;
  return text.replace(/<[^>]*>/g, '').trim().slice(0, maxLength) || null;
}

// ======================
// POST - Resolve Penalty
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

    const { userRole, user, supabase } = auth;

    // Only manager+ can resolve penalties
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para resolver penalizaciones', 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse('JSON invalido en el cuerpo de la solicitud', 400);
    }

    const { notes } = body;

    const { data: penalty, error } = await supabase
      .from('customer_penalties')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: sanitizeText(notes, 500),
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .eq('is_resolved', false) // Only update if not already resolved
      .select()
      .single();

    if (error) {
      console.error('[penalties/:id/resolve] Error:', error);
      return errorResponse('Error al resolver penalizacion', 500);
    }

    if (!penalty) {
      return errorResponse('Penalizacion no encontrada o ya resuelta', 404);
    }

    return successResponse(penalty);

  } catch (error) {
    console.error('[penalties/:id/resolve] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

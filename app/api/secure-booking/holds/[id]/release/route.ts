// =====================================================
// TIS TIS PLATFORM - Release Hold API
// POST: Release an active hold
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

function sanitizeText(text: unknown, maxLength = 255): string {
  if (text === null || text === undefined) return 'manual_release';
  if (typeof text !== 'string') return 'manual_release';
  return text.replace(/<[^>]*>/g, '').trim().slice(0, maxLength) || 'manual_release';
}

// ======================
// POST - Release Hold
// ======================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('Hold ID invalido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { supabase } = auth;
    const body = await request.json();
    const reason = sanitizeText(body.reason, 255);

    // Call RPC to release hold
    const { data: released, error: rpcError } = await supabase.rpc('release_booking_hold', {
      p_hold_id: id,
      p_reason: reason,
    });

    if (rpcError) {
      console.error('[holds/:id/release] RPC error:', rpcError);
      return errorResponse('Error al liberar hold', 500);
    }

    if (!released) {
      return errorResponse('Hold no encontrado o ya no esta activo', 404);
    }

    return successResponse({ released: true, reason });

  } catch (error) {
    console.error('[holds/:id/release] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// =====================================================
// TIS TIS PLATFORM - Secure Booking Hold by ID API
// GET: Get single hold, DELETE: Release hold
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

// ======================
// GET - Get Hold by ID
// ======================
export async function GET(
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

    const { data: hold, error } = await supabase
      .from('booking_holds')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (error || !hold) {
      return errorResponse('Hold no encontrado', 404);
    }

    return successResponse(hold);

  } catch (error) {
    console.error('[holds/:id] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// DELETE - Release Hold
// ======================
export async function DELETE(
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

    const { supabase } = auth;

    // Call RPC to release hold
    const { data: released, error: rpcError } = await supabase.rpc('release_booking_hold', {
      p_hold_id: id,
      p_reason: 'api_delete',
    });

    if (rpcError) {
      console.error('[holds/:id] Release error:', rpcError);
      return errorResponse('Error al liberar hold', 500);
    }

    if (!released) {
      return errorResponse('Hold no encontrado o ya no esta activo', 404);
    }

    return successResponse({ released: true });

  } catch (error) {
    console.error('[holds/:id] DELETE error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

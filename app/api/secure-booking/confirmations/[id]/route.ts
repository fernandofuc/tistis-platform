// =====================================================
// TIS TIS PLATFORM - Booking Confirmation by ID API
// GET: Get confirmation, PATCH: Update status
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

const VALID_STATUSES = ['pending', 'sent', 'delivered', 'read', 'responded', 'expired', 'failed'] as const;

// ======================
// GET - Get Confirmation by ID
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

    const { data: confirmation, error } = await supabase
      .from('booking_confirmations')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (error || !confirmation) {
      return errorResponse('Confirmacion no encontrada', 404);
    }

    return successResponse(confirmation);

  } catch (error) {
    console.error('[confirmations/:id] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// PATCH - Update Confirmation Status
// ======================
export async function PATCH(
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

    const { status, failure_reason } = body;

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return errorResponse('status invalido', 400);
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updateData.status = status;

      // Set appropriate timestamps based on status
      const now = new Date().toISOString();
      switch (status) {
        case 'sent':
          updateData.sent_at = now;
          break;
        case 'delivered':
          updateData.delivered_at = now;
          break;
        case 'read':
          updateData.read_at = now;
          break;
        case 'failed':
          if (failure_reason) {
            updateData.response_raw = failure_reason;
          }
          break;
      }
    }

    const { data: confirmation, error } = await supabase
      .from('booking_confirmations')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select()
      .single();

    if (error) {
      console.error('[confirmations/:id] PATCH error:', error);
      return errorResponse('Error al actualizar confirmacion', 500);
    }

    if (!confirmation) {
      return errorResponse('Confirmacion no encontrada', 404);
    }

    return successResponse(confirmation);

  } catch (error) {
    console.error('[confirmations/:id] PATCH error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

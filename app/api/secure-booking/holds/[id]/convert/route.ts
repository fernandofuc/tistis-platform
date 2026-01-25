// =====================================================
// TIS TIS PLATFORM - Convert Hold to Appointment API
// POST: Convert an active hold to an appointment
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
// POST - Convert Hold
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

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse('JSON invalido en el cuerpo de la solicitud', 400);
    }

    const { appointment_id } = body;

    if (!appointment_id || !isValidUUID(appointment_id as string)) {
      return errorResponse('appointment_id requerido y debe ser UUID valido', 400);
    }

    // Call RPC to convert hold
    const { data: converted, error: rpcError } = await supabase.rpc('convert_hold_to_appointment', {
      p_hold_id: id,
      p_appointment_id: appointment_id,
    });

    if (rpcError) {
      console.error('[holds/:id/convert] RPC error:', rpcError);
      return errorResponse('Error al convertir hold', 500);
    }

    if (!converted) {
      return errorResponse('Hold no encontrado o ya no esta activo', 404);
    }

    return successResponse({ converted: true, appointment_id });

  } catch (error) {
    console.error('[holds/:id/convert] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

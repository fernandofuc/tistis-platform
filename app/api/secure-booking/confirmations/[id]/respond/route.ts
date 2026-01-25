// =====================================================
// TIS TIS PLATFORM - Process Confirmation Response API
// POST: Process customer response to confirmation
// =====================================================
//
// SINCRONIZADO CON:
// - Service: src/features/secure-booking/services/confirmation-sender.service.ts
// - Types: src/features/secure-booking/types/index.ts
// - SQL: supabase/migrations/167_SECURE_BOOKING_SYSTEM.sql
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
import { confirmationSenderService } from '@/src/features/secure-booking/services/confirmation-sender.service';
import type { ConfirmationResponse } from '@/src/features/secure-booking/types';

const VALID_RESPONSES = ['confirmed', 'cancelled', 'need_change', 'other'] as const;

// ======================
// POST - Process Response
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

    const { response, raw_response } = body;

    // Validate response
    if (!response || !VALID_RESPONSES.includes(response as typeof VALID_RESPONSES[number])) {
      return errorResponse('response requerido y valido (confirmed, cancelled, need_change, other)', 400);
    }

    // Verify the confirmation belongs to this tenant
    const { data: confirmation, error: fetchError } = await supabase
      .from('booking_confirmations')
      .select('tenant_id')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (fetchError || !confirmation) {
      return errorResponse('Confirmacion no encontrada', 404);
    }

    // Use the service to process the response
    // SECURITY: Pass tenantId for tenant isolation
    const result = await confirmationSenderService.processResponse({
      tenantId: userRole.tenant_id,
      confirmationId: id,
      response: response as ConfirmationResponse,
      rawResponse: typeof raw_response === 'string' ? raw_response : undefined,
    });

    if (!result.success) {
      console.error('[confirmations/:id/respond] Process error:', result.error);

      // Return appropriate error status
      if (result.error === 'Confirmation already responded') {
        return errorResponse('La confirmacion ya fue respondida', 400);
      }
      if (result.error === 'Confirmation has expired') {
        return errorResponse('La confirmacion ya expiro', 400);
      }

      return errorResponse(result.error || 'Error al procesar respuesta', 500);
    }

    return successResponse({
      ...result.confirmation,
      action_taken: result.action,
    });

  } catch (error) {
    console.error('[confirmations/:id/respond] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// =====================================================
// TIS TIS PLATFORM - Resend Confirmation API
// POST: Resend a confirmation that was already sent
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

// ======================
// POST - Resend Confirmation
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

    // Verify the confirmation belongs to this tenant
    const { data: confirmation, error: fetchError } = await supabase
      .from('booking_confirmations')
      .select('tenant_id, status')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (fetchError || !confirmation) {
      return errorResponse('Confirmacion no encontrada', 404);
    }

    // Can only resend if not already responded
    if (confirmation.status === 'responded') {
      return errorResponse('No se puede reenviar una confirmacion ya respondida', 400);
    }

    // Use the service to resend
    // SECURITY: Pass tenantId for tenant isolation
    const result = await confirmationSenderService.resend(userRole.tenant_id, id);

    if (!result.success) {
      console.error('[confirmations/:id/resend] Resend failed:', result.error);

      // Return appropriate error status
      if (result.error?.includes('Cannot resend')) {
        return errorResponse(result.error, 400);
      }
      if (result.error === 'Confirmation not found') {
        return errorResponse('Confirmacion no encontrada', 404);
      }

      return errorResponse(result.error || 'Error al reenviar confirmacion', 500);
    }

    // Get the new confirmation record
    const { data: newConfirmation } = await supabase
      .from('booking_confirmations')
      .select('*')
      .eq('id', result.confirmationId)
      .single();

    return successResponse({
      ...newConfirmation,
      whatsapp_message_id: result.messageId,
      retry_count: result.retryCount,
    });

  } catch (error) {
    console.error('[confirmations/:id/resend] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

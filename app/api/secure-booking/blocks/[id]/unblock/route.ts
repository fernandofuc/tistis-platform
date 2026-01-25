// =====================================================
// TIS TIS PLATFORM - Unblock Customer API
// POST: Unblock a blocked customer
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
// POST - Unblock Customer
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

    // Only manager+ can unblock
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para desbloquear clientes', 403);
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return errorResponse('reason requerido', 400);
    }

    const now = new Date().toISOString();

    // Get the block first to get lead_id
    const { data: block, error: fetchError } = await supabase
      .from('customer_blocks')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (fetchError || !block) {
      return errorResponse('Bloqueo no encontrado', 404);
    }

    if (!block.is_active) {
      return errorResponse('El cliente ya fue desbloqueado', 400);
    }

    // Update the block
    const { data: updatedBlock, error: updateError } = await supabase
      .from('customer_blocks')
      .update({
        is_active: false,
        unblocked_at: now,
        unblocked_by: user.id,
        unblock_reason: sanitizeText(reason),
        updated_at: now,
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select()
      .single();

    if (updateError) {
      console.error('[blocks/:id/unblock] Update error:', updateError);
      return errorResponse('Error al desbloquear cliente', 500);
    }

    // Also update the trust score if lead_id exists
    if (block.lead_id) {
      await supabase
        .from('customer_trust_scores')
        .update({
          is_blocked: false,
          block_reason: null,
          blocked_at: null,
          updated_at: now,
        })
        .eq('tenant_id', userRole.tenant_id)
        .eq('lead_id', block.lead_id);
    }

    return successResponse(updatedBlock);

  } catch (error) {
    console.error('[blocks/:id/unblock] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

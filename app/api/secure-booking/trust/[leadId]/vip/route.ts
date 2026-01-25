// =====================================================
// TIS TIS PLATFORM - VIP Status API
// POST: Set VIP status for a customer
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
// POST - Set VIP Status
// ======================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;

    if (!isValidUUID(leadId)) {
      return errorResponse('lead_id invalido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, user, supabase } = auth;

    // Only manager+ can set VIP status
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para modificar estado VIP', 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse('JSON invalido en el cuerpo de la solicitud', 400);
    }

    const { is_vip, reason } = body;

    if (typeof is_vip !== 'boolean') {
      return errorResponse('is_vip requerido (boolean)', 400);
    }

    const now = new Date().toISOString();

    // Try to update existing record first
    const { data: existing, error: selectError } = await supabase
      .from('customer_trust_scores')
      .select('id')
      .eq('tenant_id', userRole.tenant_id)
      .eq('lead_id', leadId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('[trust/:leadId/vip] Select error:', selectError);
      return errorResponse('Error al obtener trust score', 500);
    }

    let trustScore;

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('customer_trust_scores')
        .update({
          is_vip,
          vip_reason: is_vip ? sanitizeText(reason) : null,
          vip_set_at: is_vip ? now : null,
          vip_set_by: is_vip ? user.id : null,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[trust/:leadId/vip] Update error:', error);
        return errorResponse('Error al actualizar estado VIP', 500);
      }
      trustScore = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from('customer_trust_scores')
        .insert({
          tenant_id: userRole.tenant_id,
          lead_id: leadId,
          trust_score: 80, // Default
          is_vip,
          vip_reason: is_vip ? sanitizeText(reason) : null,
          vip_set_at: is_vip ? now : null,
          vip_set_by: is_vip ? user.id : null,
        })
        .select()
        .single();

      if (error) {
        console.error('[trust/:leadId/vip] Insert error:', error);
        return errorResponse('Error al crear trust score', 500);
      }
      trustScore = data;
    }

    return successResponse(trustScore);

  } catch (error) {
    console.error('[trust/:leadId/vip] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// =====================================================
// TIS TIS PLATFORM - Customer Trust Score API
// GET: Get trust score, PATCH: Update trust score
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

function sanitizeText(text: unknown, maxLength = 255): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') return null;
  return text.replace(/<[^>]*>/g, '').trim().slice(0, maxLength) || null;
}

function sanitizeNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

// ======================
// GET - Get Trust Score
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;

    if (!isValidUUID(leadId)) {
      return errorResponse('Lead ID invalido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    // Call RPC to get/create trust score
    const { data: result, error: rpcError } = await supabase.rpc('get_customer_trust_score', {
      p_tenant_id: userRole.tenant_id,
      p_lead_id: leadId,
    });

    if (rpcError) {
      console.error('[trust/:leadId] RPC error:', rpcError);
      return errorResponse('Error al obtener trust score', 500);
    }

    // Check for authorization error
    if (result?.error === 'unauthorized') {
      return errorResponse('No autorizado', 403);
    }

    return successResponse(result);

  } catch (error) {
    console.error('[trust/:leadId] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// PATCH - Update Trust Score
// ======================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;

    if (!isValidUUID(leadId)) {
      return errorResponse('Lead ID invalido', 400);
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

    const { score_change, reason } = body;

    if (score_change === undefined || score_change === null) {
      return errorResponse('score_change requerido', 400);
    }

    // Sanitize score change (-100 to +100)
    const sanitizedChange = sanitizeNumber(score_change, -100, 100, 0);

    // Call RPC to update trust score
    const { data: result, error: rpcError } = await supabase.rpc('update_trust_score', {
      p_tenant_id: userRole.tenant_id,
      p_lead_id: leadId,
      p_score_change: sanitizedChange,
      p_reason: sanitizeText(reason, 500),
    });

    if (rpcError) {
      console.error('[trust/:leadId] PATCH RPC error:', rpcError);
      return errorResponse('Error al actualizar trust score', 500);
    }

    // Check for authorization error
    if (result?.error === 'unauthorized') {
      return errorResponse('No autorizado', 403);
    }

    return successResponse(result);

  } catch (error) {
    console.error('[trust/:leadId] PATCH error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

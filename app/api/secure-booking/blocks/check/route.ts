// =====================================================
// TIS TIS PLATFORM - Check Customer Blocked API
// GET: Check if customer is blocked via RPC
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

function sanitizePhone(phone: unknown): string | null {
  if (typeof phone !== 'string') return null;
  const cleaned = phone.replace(/[^\d+]/g, '').slice(0, 20);
  return cleaned.length >= 10 ? cleaned : null;
}

// ======================
// GET - Check if Blocked
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);

    const phoneNumber = searchParams.get('phone_number');
    const leadId = searchParams.get('lead_id');

    // Validate required phone number
    const sanitizedPhone = sanitizePhone(phoneNumber);
    if (!sanitizedPhone) {
      return errorResponse('phone_number requerido y debe ser valido', 400);
    }

    // Validate lead_id if provided
    if (leadId && !isValidUUID(leadId)) {
      return errorResponse('lead_id invalido', 400);
    }

    // Call RPC to check blocked status
    const { data: result, error: rpcError } = await supabase.rpc('check_customer_blocked', {
      p_tenant_id: userRole.tenant_id,
      p_phone_number: sanitizedPhone,
      p_lead_id: leadId || null,
    });

    if (rpcError) {
      console.error('[blocks/check] RPC error:', rpcError);
      return errorResponse('Error al verificar bloqueo', 500);
    }

    // Check for authorization error
    if (result?.error === 'unauthorized') {
      return errorResponse('No autorizado', 403);
    }

    return successResponse(result);

  } catch (error) {
    console.error('[blocks/check] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

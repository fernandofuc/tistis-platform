// =====================================================
// TIS TIS PLATFORM - Full Trust Score API
// GET: Get full trust score record with all fields
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
// GET - Get Full Trust Score
// ======================
export async function GET(
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

    const { userRole, supabase } = auth;

    // Get full trust score record
    const { data: trustScore, error } = await supabase
      .from('customer_trust_scores')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .eq('lead_id', leadId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found - return null/empty
        return successResponse(null);
      }
      console.error('[trust/:leadId/full] Error:', error);
      return errorResponse('Error al obtener trust score', 500);
    }

    return successResponse(trustScore);

  } catch (error) {
    console.error('[trust/:leadId/full] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

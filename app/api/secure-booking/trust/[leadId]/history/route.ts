// =====================================================
// TIS TIS PLATFORM - Customer History API
// GET: Get full customer history (trust, penalties, blocks)
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
// GET - Get Customer History
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

    // Get trust score
    const { data: trustScore, error: trustError } = await supabase
      .from('customer_trust_scores')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .eq('lead_id', leadId)
      .single();

    // Get penalties
    const { data: penalties, error: penaltiesError } = await supabase
      .from('customer_penalties')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get blocks
    const { data: blocks, error: blocksError } = await supabase
      .from('customer_blocks')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (penaltiesError || blocksError) {
      console.error('[trust/:leadId/history] Error:', { penaltiesError, blocksError });
      return errorResponse('Error al obtener historial', 500);
    }

    // If no trust score exists, create a default view
    const trustData = trustScore || {
      trust_score: 80,
      is_blocked: false,
      is_vip: false,
      no_shows: 0,
      no_pickups: 0,
      late_cancellations: 0,
      total_bookings: 0,
      completed_bookings: 0,
    };

    return successResponse({
      trust_score: trustData,
      penalties: penalties || [],
      blocks: blocks || [],
    });

  } catch (error) {
    console.error('[trust/:leadId/history] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

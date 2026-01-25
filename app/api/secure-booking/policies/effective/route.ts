// =====================================================
// TIS TIS PLATFORM - Effective Policy API
// GET: Get the effective policy for a vertical/branch combination
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
// GET - Get Effective Policy
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);

    const vertical = searchParams.get('vertical');
    const branchId = searchParams.get('branch_id');

    if (!vertical) {
      return errorResponse('vertical requerido', 400);
    }

    if (branchId && !isValidUUID(branchId)) {
      return errorResponse('branch_id invalido', 400);
    }

    // First, try to find a branch-specific policy
    if (branchId) {
      const { data: branchPolicy } = await supabase
        .from('vertical_booking_policies')
        .select('*')
        .eq('tenant_id', userRole.tenant_id)
        .eq('vertical', vertical)
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .single();

      if (branchPolicy) {
        return successResponse(branchPolicy);
      }
    }

    // Fall back to default policy for vertical
    const { data: defaultPolicy, error } = await supabase
      .from('vertical_booking_policies')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .eq('vertical', vertical)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (error) {
      // Try any active policy for the vertical
      const { data: anyPolicy, error: anyError } = await supabase
        .from('vertical_booking_policies')
        .select('*')
        .eq('tenant_id', userRole.tenant_id)
        .eq('vertical', vertical)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (anyError || !anyPolicy) {
        return errorResponse('No hay politica configurada para esta vertical', 404);
      }

      return successResponse(anyPolicy);
    }

    return successResponse(defaultPolicy);

  } catch (error) {
    console.error('[policies/effective] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

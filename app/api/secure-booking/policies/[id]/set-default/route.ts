// =====================================================
// TIS TIS PLATFORM - Set Default Policy API
// POST: Set a policy as default for its vertical
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
  isOwner,
} from '@/src/lib/api/auth-helper';

// ======================
// POST - Set as Default
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

    // Only owner/admin can change default
    if (!isOwner(userRole.role) && userRole.role !== 'admin') {
      return errorResponse('Sin permisos para cambiar politica por defecto', 403);
    }

    // Get the policy to find its vertical
    const { data: policy, error: fetchError } = await supabase
      .from('vertical_booking_policies')
      .select('vertical')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (fetchError || !policy) {
      return errorResponse('Politica no encontrada', 404);
    }

    // Unset other defaults for this vertical
    await supabase
      .from('vertical_booking_policies')
      .update({ is_default: false })
      .eq('tenant_id', userRole.tenant_id)
      .eq('vertical', policy.vertical)
      .neq('id', id);

    // Set this one as default
    const { data: updatedPolicy, error: updateError } = await supabase
      .from('vertical_booking_policies')
      .update({
        is_default: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select()
      .single();

    if (updateError) {
      console.error('[policies/:id/set-default] Update error:', updateError);
      return errorResponse('Error al establecer politica por defecto', 500);
    }

    return successResponse(updatedPolicy);

  } catch (error) {
    console.error('[policies/:id/set-default] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

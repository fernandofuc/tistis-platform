// =====================================================
// TIS TIS PLATFORM - Customer Block by ID API
// GET: Get block, PATCH: Update block, DELETE: Unblock
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

function sanitizeText(text: unknown, maxLength = 255): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') return null;
  return text.replace(/<[^>]*>/g, '').trim().slice(0, maxLength) || null;
}

// ======================
// GET - Get Block by ID
// ======================
export async function GET(
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

    const { data: block, error } = await supabase
      .from('customer_blocks')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (error || !block) {
      return errorResponse('Bloqueo no encontrado', 404);
    }

    return successResponse(block);

  } catch (error) {
    console.error('[blocks/:id] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// PATCH - Update Block
// ======================
export async function PATCH(
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

    // Only manager+ can update blocks
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos', 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse('JSON invalido en el cuerpo de la solicitud', 400);
    }

    const { unblock_at, block_details } = body;

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (unblock_at !== undefined) {
      if (unblock_at === null) {
        updateData.unblock_at = null; // Make permanent
      } else {
        const unblockDate = new Date(unblock_at as string);
        if (isNaN(unblockDate.getTime())) {
          return errorResponse('unblock_at invalido', 400);
        }
        updateData.unblock_at = unblockDate.toISOString();
      }
    }

    if (block_details !== undefined) {
      updateData.block_details = sanitizeText(block_details, 500);
    }

    const { data: block, error } = await supabase
      .from('customer_blocks')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select()
      .single();

    if (error) {
      console.error('[blocks/:id] PATCH error:', error);
      return errorResponse('Error al actualizar bloqueo', 500);
    }

    if (!block) {
      return errorResponse('Bloqueo no encontrado', 404);
    }

    return successResponse(block);

  } catch (error) {
    console.error('[blocks/:id] PATCH error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// DELETE - Unblock Customer
// ======================
export async function DELETE(
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

    // Get the block first to get lead_id
    const { data: existingBlock } = await supabase
      .from('customer_blocks')
      .select('lead_id, is_active')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (!existingBlock) {
      return errorResponse('Bloqueo no encontrado', 404);
    }

    if (!existingBlock.is_active) {
      return errorResponse('Este bloqueo ya fue removido', 400);
    }

    // Unblock by setting is_active = false
    const { data: block, error } = await supabase
      .from('customer_blocks')
      .update({
        is_active: false,
        unblocked_at: new Date().toISOString(),
        unblocked_by: user.id,
        unblock_reason: 'manual_unblock',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select()
      .single();

    if (error) {
      console.error('[blocks/:id] DELETE error:', error);
      return errorResponse('Error al desbloquear', 500);
    }

    // Update trust score if lead_id exists
    if (existingBlock.lead_id) {
      await supabase
        .from('customer_trust_scores')
        .update({
          is_blocked: false,
          block_reason: null,
          blocked_at: null,
        })
        .eq('tenant_id', userRole.tenant_id)
        .eq('lead_id', existingBlock.lead_id);
    }

    return successResponse({ unblocked: true, block });

  } catch (error) {
    console.error('[blocks/:id] DELETE error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

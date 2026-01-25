// =====================================================
// TIS TIS PLATFORM - Booking Policy by ID API
// GET: Get policy, PATCH: Update policy, DELETE: Delete policy
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

function sanitizeNumber(value: unknown, min: number, max: number): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num) || !isFinite(num)) return undefined;
  return Math.max(min, Math.min(max, num));
}

// ======================
// GET - Get Policy by ID
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

    const { data: policy, error } = await supabase
      .from('vertical_booking_policies')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (error || !policy) {
      return errorResponse('Politica no encontrada', 404);
    }

    return successResponse(policy);

  } catch (error) {
    console.error('[policies/:id] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// PATCH - Update Policy
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

    // Only owner/admin can update policies
    if (!isOwner(userRole.role) && userRole.role !== 'admin') {
      return errorResponse('Sin permisos para actualizar politicas', 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse('JSON invalido en el cuerpo de la solicitud', 400);
    }

    // Build update object only with provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Thresholds
    const thrConf = sanitizeNumber(body.trust_threshold_confirmation, 0, 100);
    if (thrConf !== undefined) updateData.trust_threshold_confirmation = thrConf;

    const thrDep = sanitizeNumber(body.trust_threshold_deposit, 0, 100);
    if (thrDep !== undefined) updateData.trust_threshold_deposit = thrDep;

    const thrBlock = sanitizeNumber(body.trust_threshold_block, 0, 100);
    if (thrBlock !== undefined) updateData.trust_threshold_block = thrBlock;

    // Penalties
    const penShow = sanitizeNumber(body.penalty_no_show, 0, 100);
    if (penShow !== undefined) updateData.penalty_no_show = penShow;

    const penPickup = sanitizeNumber(body.penalty_no_pickup, 0, 100);
    if (penPickup !== undefined) updateData.penalty_no_pickup = penPickup;

    const penCancel = sanitizeNumber(body.penalty_late_cancel, 0, 100);
    if (penCancel !== undefined) updateData.penalty_late_cancel = penCancel;

    const penConf = sanitizeNumber(body.penalty_no_confirmation, 0, 100);
    if (penConf !== undefined) updateData.penalty_no_confirmation = penConf;

    // Rewards
    const rewComp = sanitizeNumber(body.reward_completed, 0, 50);
    if (rewComp !== undefined) updateData.reward_completed = rewComp;

    const rewTime = sanitizeNumber(body.reward_on_time, 0, 50);
    if (rewTime !== undefined) updateData.reward_on_time = rewTime;

    // Auto-block
    const abShows = sanitizeNumber(body.auto_block_no_shows, 1, 10);
    if (abShows !== undefined) updateData.auto_block_no_shows = abShows;

    const abPickups = sanitizeNumber(body.auto_block_no_pickups, 1, 10);
    if (abPickups !== undefined) updateData.auto_block_no_pickups = abPickups;

    const abDuration = sanitizeNumber(body.auto_block_duration_hours, 1, 8760);
    if (abDuration !== undefined) updateData.auto_block_duration_hours = abDuration;

    // Hold config
    const holdDur = sanitizeNumber(body.hold_duration_minutes, 5, 60);
    if (holdDur !== undefined) updateData.hold_duration_minutes = holdDur;

    const holdBuf = sanitizeNumber(body.hold_buffer_minutes, 0, 30);
    if (holdBuf !== undefined) updateData.hold_buffer_minutes = holdBuf;

    // Confirmation
    if (body.require_confirmation_below_trust !== undefined) {
      updateData.require_confirmation_below_trust = Boolean(body.require_confirmation_below_trust);
    }

    const confTimeout = sanitizeNumber(body.confirmation_timeout_hours, 1, 48);
    if (confTimeout !== undefined) updateData.confirmation_timeout_hours = confTimeout;

    const confReminder = sanitizeNumber(body.confirmation_reminder_hours, 1, 72);
    if (confReminder !== undefined) updateData.confirmation_reminder_hours = confReminder;

    // Deposit
    if (body.require_deposit_below_trust !== undefined) {
      updateData.require_deposit_below_trust = Boolean(body.require_deposit_below_trust);
    }

    const depAmount = sanitizeNumber(body.deposit_amount_cents, 0, 10000000);
    if (depAmount !== undefined) updateData.deposit_amount_cents = depAmount;

    if (body.deposit_percent_of_service !== undefined) {
      updateData.deposit_percent_of_service = body.deposit_percent_of_service === null
        ? null
        : sanitizeNumber(body.deposit_percent_of_service, 0, 100);
    }

    // Active
    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    // Handle is_default separately
    if (body.is_default === true) {
      // First get the policy to know its vertical
      const { data: existingPolicy } = await supabase
        .from('vertical_booking_policies')
        .select('vertical')
        .eq('id', id)
        .eq('tenant_id', userRole.tenant_id)
        .single();

      if (existingPolicy) {
        // Unset other defaults for this vertical
        await supabase
          .from('vertical_booking_policies')
          .update({ is_default: false })
          .eq('tenant_id', userRole.tenant_id)
          .eq('vertical', existingPolicy.vertical)
          .neq('id', id);
      }
      updateData.is_default = true;
    } else if (body.is_default === false) {
      updateData.is_default = false;
    }

    const { data: policy, error } = await supabase
      .from('vertical_booking_policies')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select()
      .single();

    if (error) {
      console.error('[policies/:id] PATCH error:', error);
      return errorResponse('Error al actualizar politica', 500);
    }

    if (!policy) {
      return errorResponse('Politica no encontrada', 404);
    }

    return successResponse(policy);

  } catch (error) {
    console.error('[policies/:id] PATCH error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// DELETE - Delete Policy
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

    const { userRole, supabase } = auth;

    // Only owner can delete policies
    if (!isOwner(userRole.role)) {
      return errorResponse('Solo el propietario puede eliminar politicas', 403);
    }

    // Check if this is the default policy
    const { data: existingPolicy } = await supabase
      .from('vertical_booking_policies')
      .select('is_default')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (!existingPolicy) {
      return errorResponse('Politica no encontrada', 404);
    }

    if (existingPolicy.is_default) {
      return errorResponse('No se puede eliminar la politica por defecto. Primero establezca otra como defecto.', 400);
    }

    const { error } = await supabase
      .from('vertical_booking_policies')
      .delete()
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('[policies/:id] DELETE error:', error);
      return errorResponse('Error al eliminar politica', 500);
    }

    return successResponse({ deleted: true });

  } catch (error) {
    console.error('[policies/:id] DELETE error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

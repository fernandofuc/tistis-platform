// =====================================================
// TIS TIS PLATFORM - Booking Policies API
// GET: List policies, POST: Create policy
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
  isOwner,
} from '@/src/lib/api/auth-helper';

// Valid verticals
const VALID_VERTICALS = ['dental', 'restaurant', 'medical', 'beauty', 'veterinary', 'gym', 'clinic'] as const;

const MAX_QUERY_LIMIT = 50;

function sanitizeNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

function sanitizeNumberNullable(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num) || !isFinite(num)) return null;
  return Math.max(min, Math.min(max, num));
}

// ======================
// GET - List Policies
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
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const limitParam = parseInt(searchParams.get('limit') || '20');
    const limit = Math.max(1, Math.min(limitParam, MAX_QUERY_LIMIT));

    // Validate UUIDs if provided
    if (branchId && !isValidUUID(branchId)) {
      return errorResponse('branch_id invalido', 400);
    }

    let query = supabase
      .from('vertical_booking_policies')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .order('vertical', { ascending: true })
      .order('is_default', { ascending: false })
      .limit(limit);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (vertical) {
      query = query.eq('vertical', vertical);
    }

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: policies, error } = await query;

    if (error) {
      console.error('[policies] Error fetching:', error);
      return errorResponse('Error al obtener politicas', 500);
    }

    return successResponse(policies);

  } catch (error) {
    console.error('[policies] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Policy
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    // Only owner/admin can create policies
    if (!isOwner(userRole.role) && userRole.role !== 'admin') {
      return errorResponse('Sin permisos para crear politicas', 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse('JSON invalido en el cuerpo de la solicitud', 400);
    }

    const {
      vertical,
      branch_id,
      trust_threshold_confirmation,
      trust_threshold_deposit,
      trust_threshold_block,
      penalty_no_show,
      penalty_no_pickup,
      penalty_late_cancel,
      penalty_no_confirmation,
      reward_completed,
      reward_on_time,
      auto_block_no_shows,
      auto_block_no_pickups,
      auto_block_duration_hours,
      hold_duration_minutes,
      hold_buffer_minutes,
      require_confirmation_below_trust,
      confirmation_timeout_hours,
      confirmation_reminder_hours,
      require_deposit_below_trust,
      deposit_amount_cents,
      deposit_percent_of_service,
      is_active,
      is_default,
    } = body;

    // Validate vertical
    if (!vertical || !VALID_VERTICALS.includes(vertical as typeof VALID_VERTICALS[number])) {
      return errorResponse('vertical requerido y debe ser valido', 400);
    }

    // Validate branch_id if provided
    if (branch_id && !isValidUUID(branch_id as string)) {
      return errorResponse('branch_id invalido', 400);
    }

    // Build policy object with defaults
    const policyData = {
      tenant_id: userRole.tenant_id,
      vertical,
      branch_id: branch_id || null,
      // Thresholds
      trust_threshold_confirmation: sanitizeNumber(trust_threshold_confirmation, 0, 100, 80),
      trust_threshold_deposit: sanitizeNumber(trust_threshold_deposit, 0, 100, 30),
      trust_threshold_block: sanitizeNumber(trust_threshold_block, 0, 100, 15),
      // Penalties
      penalty_no_show: sanitizeNumber(penalty_no_show, 0, 100, 25),
      penalty_no_pickup: sanitizeNumber(penalty_no_pickup, 0, 100, 30),
      penalty_late_cancel: sanitizeNumber(penalty_late_cancel, 0, 100, 15),
      penalty_no_confirmation: sanitizeNumber(penalty_no_confirmation, 0, 100, 10),
      // Rewards
      reward_completed: sanitizeNumber(reward_completed, 0, 50, 5),
      reward_on_time: sanitizeNumber(reward_on_time, 0, 50, 3),
      // Auto-block
      auto_block_no_shows: sanitizeNumber(auto_block_no_shows, 1, 10, 3),
      auto_block_no_pickups: sanitizeNumber(auto_block_no_pickups, 1, 10, 2),
      auto_block_duration_hours: sanitizeNumber(auto_block_duration_hours, 1, 8760, 720), // 1h to 1 year
      // Hold config
      hold_duration_minutes: sanitizeNumber(hold_duration_minutes, 5, 60, 15),
      hold_buffer_minutes: sanitizeNumber(hold_buffer_minutes, 0, 30, 5),
      // Confirmation
      require_confirmation_below_trust: require_confirmation_below_trust !== false,
      confirmation_timeout_hours: sanitizeNumber(confirmation_timeout_hours, 1, 48, 2),
      confirmation_reminder_hours: sanitizeNumber(confirmation_reminder_hours, 1, 72, 24),
      // Deposit
      require_deposit_below_trust: require_deposit_below_trust !== false,
      deposit_amount_cents: sanitizeNumber(deposit_amount_cents, 0, 10000000, 10000), // Up to 100k
      deposit_percent_of_service: sanitizeNumberNullable(deposit_percent_of_service, 0, 100),
      // Active
      is_active: is_active !== false,
      is_default: is_default === true,
    };

    // If setting as default, unset other defaults for this vertical
    if (policyData.is_default) {
      await supabase
        .from('vertical_booking_policies')
        .update({ is_default: false })
        .eq('tenant_id', userRole.tenant_id)
        .eq('vertical', vertical);
    }

    const { data: policy, error: insertError } = await supabase
      .from('vertical_booking_policies')
      .insert(policyData)
      .select()
      .single();

    if (insertError) {
      // Check for unique constraint violation
      if (insertError.code === '23505') {
        return errorResponse('Ya existe una politica para esta combinacion vertical/branch', 409);
      }
      console.error('[policies] Insert error:', insertError);
      return errorResponse('Error al crear politica', 500);
    }

    return successResponse(policy, 201);

  } catch (error) {
    console.error('[policies] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

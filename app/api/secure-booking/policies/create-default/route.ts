// =====================================================
// TIS TIS PLATFORM - Create Default Policy API
// POST: Create default policy for a vertical if not exists
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isOwner,
} from '@/src/lib/api/auth-helper';

const VALID_VERTICALS = ['dental', 'restaurant', 'medical', 'beauty', 'veterinary', 'gym', 'clinic'] as const;

// Default policy values per vertical
const VERTICAL_DEFAULTS: Record<string, Partial<Record<string, number | boolean>>> = {
  dental: {
    trust_threshold_confirmation: 80,
    trust_threshold_deposit: 30,
    hold_duration_minutes: 20,
    deposit_amount_cents: 30000, // $300 MXN
  },
  restaurant: {
    trust_threshold_confirmation: 75,
    trust_threshold_deposit: 25,
    hold_duration_minutes: 15,
    deposit_amount_cents: 10000, // $100 MXN
    auto_block_no_pickups: 2, // Stricter for restaurants
  },
  medical: {
    trust_threshold_confirmation: 80,
    trust_threshold_deposit: 30,
    hold_duration_minutes: 20,
    deposit_amount_cents: 25000, // $250 MXN
  },
  beauty: {
    trust_threshold_confirmation: 75,
    trust_threshold_deposit: 25,
    hold_duration_minutes: 15,
    deposit_amount_cents: 15000, // $150 MXN
  },
  veterinary: {
    trust_threshold_confirmation: 80,
    trust_threshold_deposit: 30,
    hold_duration_minutes: 20,
    deposit_amount_cents: 20000, // $200 MXN
  },
  gym: {
    trust_threshold_confirmation: 70,
    trust_threshold_deposit: 20,
    hold_duration_minutes: 10,
    require_deposit_below_trust: false,
  },
  clinic: {
    trust_threshold_confirmation: 80,
    trust_threshold_deposit: 30,
    hold_duration_minutes: 20,
    deposit_amount_cents: 25000, // $250 MXN
  },
};

// ======================
// POST - Create Default Policy
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

    const { vertical } = body;

    if (!vertical || !VALID_VERTICALS.includes(vertical as typeof VALID_VERTICALS[number])) {
      return errorResponse('vertical requerido y valido', 400);
    }

    const verticalStr = vertical as string;

    // Check if a default already exists
    const { data: existing } = await supabase
      .from('vertical_booking_policies')
      .select('id')
      .eq('tenant_id', userRole.tenant_id)
      .eq('vertical', verticalStr)
      .eq('is_default', true)
      .single();

    if (existing) {
      return errorResponse('Ya existe una politica por defecto para esta vertical', 409);
    }

    // Get vertical-specific defaults
    const verticalDefaults = VERTICAL_DEFAULTS[verticalStr] || {};

    const policyData = {
      tenant_id: userRole.tenant_id,
      vertical: verticalStr,
      // Thresholds
      trust_threshold_confirmation: verticalDefaults.trust_threshold_confirmation ?? 80,
      trust_threshold_deposit: verticalDefaults.trust_threshold_deposit ?? 30,
      trust_threshold_block: 15,
      // Penalties
      penalty_no_show: 25,
      penalty_no_pickup: 30,
      penalty_late_cancel: 15,
      penalty_no_confirmation: 10,
      // Rewards
      reward_completed: 5,
      reward_on_time: 3,
      // Auto-block
      auto_block_no_shows: 3,
      auto_block_no_pickups: verticalDefaults.auto_block_no_pickups ?? 2,
      auto_block_duration_hours: 720, // 30 days
      // Hold config
      hold_duration_minutes: verticalDefaults.hold_duration_minutes ?? 15,
      hold_buffer_minutes: 5,
      // Confirmation
      require_confirmation_below_trust: true,
      confirmation_timeout_hours: 2,
      confirmation_reminder_hours: 24,
      // Deposit
      require_deposit_below_trust: verticalDefaults.require_deposit_below_trust ?? true,
      deposit_amount_cents: verticalDefaults.deposit_amount_cents ?? 10000,
      // Active
      is_active: true,
      is_default: true,
    };

    const { data: policy, error } = await supabase
      .from('vertical_booking_policies')
      .insert(policyData)
      .select()
      .single();

    if (error) {
      console.error('[policies/create-default] Insert error:', error);
      return errorResponse('Error al crear politica por defecto', 500);
    }

    return successResponse(policy, 201);

  } catch (error) {
    console.error('[policies/create-default] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

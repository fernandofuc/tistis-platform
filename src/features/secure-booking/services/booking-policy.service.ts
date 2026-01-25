// =====================================================
// TIS TIS PLATFORM - Booking Policy Service
// API service for vertical booking policies
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/167_SECURE_BOOKING_SYSTEM.sql
// - Types: src/features/secure-booking/types/index.ts
// =====================================================

import { supabase } from '@/src/shared/lib/supabase';
import type {
  VerticalBookingPolicy,
  PolicyFormData,
  TrustScoreView,
} from '../types';
import {
  needsConfirmation,
  needsDeposit,
  calculateDepositAmount,
} from '../types';

const API_BASE = '/api/secure-booking/policies';

// ======================
// HELPERS
// ======================

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    console.warn('[booking-policy.service] No session found - requests may fail with 401');
  }

  return {
    'Content-Type': 'application/json',
    ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Error en la solicitud');
  }
  return data.data;
}

// ======================
// READ OPERATIONS
// ======================

/**
 * Get all policies for tenant
 */
export async function getPolicies(params?: {
  vertical?: string;
  branch_id?: string;
  include_inactive?: boolean;
}): Promise<VerticalBookingPolicy[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();

  if (params?.vertical) searchParams.set('vertical', params.vertical);
  if (params?.branch_id) searchParams.set('branch_id', params.branch_id);
  if (params?.include_inactive) searchParams.set('include_inactive', 'true');

  const queryString = searchParams.toString();
  const url = queryString ? `${API_BASE}?${queryString}` : API_BASE;

  const response = await fetch(url, { headers });
  return handleResponse<VerticalBookingPolicy[]>(response);
}

/**
 * Get policy by ID
 */
export async function getPolicy(policyId: string): Promise<VerticalBookingPolicy> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${policyId}`, { headers });
  return handleResponse<VerticalBookingPolicy>(response);
}

/**
 * Get the effective policy for a vertical/branch combination
 * Returns branch-specific policy if exists, otherwise default vertical policy
 */
export async function getEffectivePolicy(
  vertical: string,
  branchId?: string
): Promise<VerticalBookingPolicy> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams({ vertical });
  if (branchId) searchParams.set('branch_id', branchId);

  const response = await fetch(`${API_BASE}/effective?${searchParams}`, { headers });
  return handleResponse<VerticalBookingPolicy>(response);
}

/**
 * Get default policy for a vertical
 */
export async function getDefaultPolicy(vertical: string): Promise<VerticalBookingPolicy | null> {
  const policies = await getPolicies({ vertical });
  return policies.find(p => p.is_default && p.is_active) || null;
}

// ======================
// WRITE OPERATIONS
// ======================

/**
 * Create a new policy
 */
export async function createPolicy(data: PolicyFormData): Promise<VerticalBookingPolicy> {
  const headers = await getAuthHeaders();
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<VerticalBookingPolicy>(response);
}

/**
 * Update an existing policy
 */
export async function updatePolicy(
  policyId: string,
  data: Partial<PolicyFormData>
): Promise<VerticalBookingPolicy> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${policyId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<VerticalBookingPolicy>(response);
}

/**
 * Delete a policy
 */
export async function deletePolicy(policyId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${policyId}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error al eliminar politica');
  }
}

/**
 * Set policy as default for its vertical
 */
export async function setAsDefault(policyId: string): Promise<VerticalBookingPolicy> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/${policyId}/set-default`, {
    method: 'POST',
    headers,
  });
  return handleResponse<VerticalBookingPolicy>(response);
}

/**
 * Create default policy for a vertical if not exists
 */
export async function createDefaultPolicy(vertical: string): Promise<VerticalBookingPolicy> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/create-default`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ vertical }),
  });
  return handleResponse<VerticalBookingPolicy>(response);
}

// ======================
// POLICY EVALUATION
// ======================

/**
 * Determine booking requirements based on trust score and policy
 */
export async function evaluateBookingRequirements(
  vertical: string,
  trustScore: TrustScoreView,
  serviceAmountCents?: number,
  branchId?: string
): Promise<{
  requiresConfirmation: boolean;
  requiresDeposit: boolean;
  depositAmountCents: number | null;
  holdDurationMinutes: number;
  policy: VerticalBookingPolicy;
}> {
  const policy = await getEffectivePolicy(vertical, branchId);

  const requiresConfirmation = needsConfirmation(
    trustScore.trust_score,
    policy,
    trustScore.is_vip
  );

  const requiresDeposit = needsDeposit(
    trustScore.trust_score,
    policy,
    trustScore.is_vip
  );

  const depositAmountCents = requiresDeposit
    ? calculateDepositAmount(policy, serviceAmountCents)
    : null;

  return {
    requiresConfirmation,
    requiresDeposit,
    depositAmountCents,
    holdDurationMinutes: policy.hold_duration_minutes,
    policy,
  };
}

/**
 * Check if a trust score would trigger auto-block
 */
export function shouldAutoBlock(
  trustScore: number,
  policy: VerticalBookingPolicy
): boolean {
  return trustScore < policy.trust_threshold_block;
}

/**
 * Get penalty score for a violation type
 */
export function getPenaltyScore(
  violationType: 'no_show' | 'no_pickup' | 'late_cancel' | 'no_confirmation',
  policy: VerticalBookingPolicy
): number {
  const penaltyMap: Record<string, keyof VerticalBookingPolicy> = {
    no_show: 'penalty_no_show',
    no_pickup: 'penalty_no_pickup',
    late_cancel: 'penalty_late_cancel',
    no_confirmation: 'penalty_no_confirmation',
  };
  return policy[penaltyMap[violationType]] as number;
}

/**
 * Get reward score for positive actions
 */
export function getRewardScore(
  action: 'completed' | 'on_time',
  policy: VerticalBookingPolicy
): number {
  const rewardMap: Record<string, keyof VerticalBookingPolicy> = {
    completed: 'reward_completed',
    on_time: 'reward_on_time',
  };
  return policy[rewardMap[action]] as number;
}

/**
 * Get hold duration in minutes
 */
export function getHoldDuration(policy: VerticalBookingPolicy): number {
  return policy.hold_duration_minutes + policy.hold_buffer_minutes;
}

/**
 * Calculate confirmation timeout
 */
export function getConfirmationTimeout(policy: VerticalBookingPolicy): Date {
  const now = new Date();
  now.setHours(now.getHours() + policy.confirmation_timeout_hours);
  return now;
}

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Format policy thresholds for display
 */
export function formatPolicyThresholds(policy: VerticalBookingPolicy): {
  confirmation: string;
  deposit: string;
  block: string;
} {
  return {
    confirmation: `< ${policy.trust_threshold_confirmation} puntos`,
    deposit: `< ${policy.trust_threshold_deposit} puntos`,
    block: `< ${policy.trust_threshold_block} puntos`,
  };
}

/**
 * Format deposit amount for display
 */
export function formatDepositConfig(policy: VerticalBookingPolicy): string {
  if (policy.deposit_percent_of_service) {
    return `${policy.deposit_percent_of_service}% del servicio`;
  }
  const amount = policy.deposit_amount_cents / 100;
  return `$${amount.toFixed(2)} MXN`;
}

/**
 * Format block duration for display
 */
export function formatBlockDuration(policy: VerticalBookingPolicy): string {
  const hours = policy.auto_block_duration_hours;
  if (hours >= 24 * 30) {
    const months = Math.round(hours / (24 * 30));
    return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  }
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return `${days} ${days === 1 ? 'dia' : 'dias'}`;
  }
  return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
}

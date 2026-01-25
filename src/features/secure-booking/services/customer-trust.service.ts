// =====================================================
// TIS TIS PLATFORM - Customer Trust Service
// API service for customer trust scores, penalties and blocks
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/167_SECURE_BOOKING_SYSTEM.sql
// - RPC: check_customer_blocked, get_customer_trust_score, record_customer_penalty,
//        update_trust_score, unblock_expired_customers
// - Types: src/features/secure-booking/types/index.ts
// =====================================================

import { supabase } from '@/src/shared/lib/supabase';
import type {
  CustomerTrustScore,
  TrustScoreView,
  CustomerPenalty,
  CustomerBlock,
  BlockFormData,
  PenaltyFormData,
  BlockCheckResult,
  RecordPenaltyResult,
  ViolationType,
} from '../types';

const API_BASE = '/api/secure-booking';

// ======================
// HELPERS
// ======================

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    console.warn('[customer-trust.service] No session found - requests may fail with 401');
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
// TRUST SCORE OPERATIONS
// ======================

/**
 * Get trust score for a lead
 * Creates a new score (default 80) if one doesn't exist
 */
export async function getTrustScore(leadId: string): Promise<TrustScoreView> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/trust/${leadId}`, { headers });
  return handleResponse<TrustScoreView>(response);
}

/**
 * Get full trust score record with history
 */
export async function getFullTrustScore(leadId: string): Promise<CustomerTrustScore> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/trust/${leadId}/full`, { headers });
  return handleResponse<CustomerTrustScore>(response);
}

/**
 * Update trust score manually
 */
export async function updateTrustScore(
  leadId: string,
  scoreChange: number,
  reason?: string
): Promise<{ success: boolean; new_score: number }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/trust/${leadId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ score_change: scoreChange, reason }),
  });
  return handleResponse<{ success: boolean; new_score: number }>(response);
}

/**
 * Set VIP status for a customer
 */
export async function setVipStatus(
  leadId: string,
  isVip: boolean,
  reason?: string
): Promise<CustomerTrustScore> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/trust/${leadId}/vip`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ is_vip: isVip, reason }),
  });
  return handleResponse<CustomerTrustScore>(response);
}

/**
 * Get customer history (penalties, blocks, bookings)
 */
export async function getCustomerHistory(leadId: string): Promise<{
  trust_score: CustomerTrustScore;
  penalties: CustomerPenalty[];
  blocks: CustomerBlock[];
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/trust/${leadId}/history`, { headers });
  return handleResponse<{
    trust_score: CustomerTrustScore;
    penalties: CustomerPenalty[];
    blocks: CustomerBlock[];
  }>(response);
}

// ======================
// BLOCK OPERATIONS
// ======================

/**
 * Check if a customer is blocked by phone or lead_id
 */
export async function checkCustomerBlocked(params: {
  phone_number: string;
  lead_id?: string;
}): Promise<BlockCheckResult> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams({
    phone_number: params.phone_number,
  });
  if (params.lead_id) searchParams.set('lead_id', params.lead_id);

  const response = await fetch(`${API_BASE}/blocks/check?${searchParams}`, { headers });
  return handleResponse<BlockCheckResult>(response);
}

/**
 * Get all active blocks
 */
export async function getActiveBlocks(): Promise<CustomerBlock[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/blocks?active=true`, { headers });
  return handleResponse<CustomerBlock[]>(response);
}

/**
 * Get blocks for a specific customer
 */
export async function getCustomerBlocks(params: {
  lead_id?: string;
  phone_number?: string;
  include_inactive?: boolean;
}): Promise<CustomerBlock[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();

  if (params.lead_id) searchParams.set('lead_id', params.lead_id);
  if (params.phone_number) searchParams.set('phone_number', params.phone_number);
  if (params.include_inactive) searchParams.set('include_inactive', 'true');

  const response = await fetch(`${API_BASE}/blocks?${searchParams}`, { headers });
  return handleResponse<CustomerBlock[]>(response);
}

/**
 * Block a customer manually
 */
export async function blockCustomer(data: BlockFormData): Promise<CustomerBlock> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/blocks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<CustomerBlock>(response);
}

/**
 * Unblock a customer
 */
export async function unblockCustomer(
  blockId: string,
  reason: string
): Promise<CustomerBlock> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/blocks/${blockId}/unblock`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  return handleResponse<CustomerBlock>(response);
}

/**
 * Update block expiration
 */
export async function updateBlockExpiration(
  blockId: string,
  unblockAt: string | null
): Promise<CustomerBlock> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/blocks/${blockId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ unblock_at: unblockAt }),
  });
  return handleResponse<CustomerBlock>(response);
}

// ======================
// PENALTY OPERATIONS
// ======================

/**
 * Record a new penalty
 * This also updates trust score and may auto-block
 */
export async function recordPenalty(data: PenaltyFormData): Promise<RecordPenaltyResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/penalties`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return handleResponse<RecordPenaltyResult>(response);
}

/**
 * Get penalties for a customer
 */
export async function getCustomerPenalties(params: {
  lead_id?: string;
  phone_number?: string;
  include_resolved?: boolean;
  violation_type?: ViolationType;
  limit?: number;
}): Promise<CustomerPenalty[]> {
  const headers = await getAuthHeaders();
  const searchParams = new URLSearchParams();

  if (params.lead_id) searchParams.set('lead_id', params.lead_id);
  if (params.phone_number) searchParams.set('phone_number', params.phone_number);
  if (params.include_resolved) searchParams.set('include_resolved', 'true');
  if (params.violation_type) searchParams.set('violation_type', params.violation_type);
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const response = await fetch(`${API_BASE}/penalties?${searchParams}`, { headers });
  return handleResponse<CustomerPenalty[]>(response);
}

/**
 * Resolve a penalty
 */
export async function resolvePenalty(
  penaltyId: string,
  notes?: string
): Promise<CustomerPenalty> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/penalties/${penaltyId}/resolve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ notes }),
  });
  return handleResponse<CustomerPenalty>(response);
}

/**
 * Get recent penalties across all customers (for dashboard)
 */
export async function getRecentPenalties(limit: number = 20): Promise<CustomerPenalty[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/penalties?limit=${limit}&include_resolved=false`, {
    headers,
  });
  return handleResponse<CustomerPenalty[]>(response);
}

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Quick check if customer can book
 * Returns true if not blocked and trust score is sufficient
 */
export async function canCustomerBook(params: {
  phone_number: string;
  lead_id?: string;
}): Promise<{ canBook: boolean; reason?: string; trustScore?: number }> {
  const blockResult = await checkCustomerBlocked(params);

  if (blockResult.is_blocked) {
    return {
      canBook: false,
      reason: `Cliente bloqueado: ${blockResult.block_reason}`,
    };
  }

  if (params.lead_id) {
    const trustResult = await getTrustScore(params.lead_id);
    return {
      canBook: true,
      trustScore: trustResult.trust_score,
    };
  }

  return { canBook: true };
}

/**
 * Get strike count for a specific violation type
 */
export function getStrikeCount(
  penalties: CustomerPenalty[],
  violationType: ViolationType
): number {
  return penalties.filter(
    p => p.violation_type === violationType && !p.is_resolved
  ).length;
}

/**
 * Calculate days until unblock
 */
export function getDaysUntilUnblock(block: CustomerBlock): number | null {
  if (!block.unblock_at) return null; // Permanent
  const unblockDate = new Date(block.unblock_at);
  const now = new Date();
  const diffMs = unblockDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

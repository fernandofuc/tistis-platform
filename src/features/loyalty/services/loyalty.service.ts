// =====================================================
// TIS TIS PLATFORM - Loyalty Service
// API client for loyalty system
// =====================================================

import { supabase } from '@/src/shared/lib/supabase';
import type {
  LoyaltyProgram,
  TokenRule,
  LoyaltyReward,
  MembershipPlan,
  Membership,
  Redemption,
  LoyaltyTransaction,
  MessageTemplate,
  LoyaltyStats,
  LoyaltyMember,
} from '../types';

// ======================
// HELPER
// ======================
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  // Get access token from Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data;
}

// ======================
// PROGRAM
// ======================
export async function getProgram(): Promise<LoyaltyProgram> {
  const result = await fetchWithAuth('/api/loyalty');
  // API returns { data: { program, tokenRules, ... } }
  return result.data.program;
}

export async function updateProgram(updates: Partial<LoyaltyProgram>): Promise<LoyaltyProgram> {
  const result = await fetchWithAuth('/api/loyalty', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return result.data;
}

// ======================
// STATS
// ======================
export async function getStats(period: number = 30): Promise<LoyaltyStats> {
  const result = await fetchWithAuth(`/api/loyalty/stats?period=${period}`);
  return result.data;
}

// ======================
// TOKEN RULES
// ======================
export async function getTokenRules(): Promise<TokenRule[]> {
  const result = await fetchWithAuth('/api/loyalty/token-rules');
  return result.data;
}

export async function createTokenRule(rule: Partial<TokenRule>): Promise<TokenRule> {
  const result = await fetchWithAuth('/api/loyalty/token-rules', {
    method: 'POST',
    body: JSON.stringify(rule),
  });
  return result.data;
}

export async function updateTokenRule(id: string, updates: Partial<TokenRule>): Promise<TokenRule> {
  const result = await fetchWithAuth('/api/loyalty/token-rules', {
    method: 'PUT',
    body: JSON.stringify({ id, ...updates }),
  });
  return result.data;
}

export async function deleteTokenRule(id: string): Promise<void> {
  await fetchWithAuth(`/api/loyalty/token-rules?id=${id}`, {
    method: 'DELETE',
  });
}

// ======================
// REWARDS
// ======================
export async function getRewards(includeInactive: boolean = false): Promise<LoyaltyReward[]> {
  const result = await fetchWithAuth(`/api/loyalty/rewards?include_inactive=${includeInactive}`);
  return result.data;
}

export async function createReward(reward: Partial<LoyaltyReward>): Promise<LoyaltyReward> {
  const result = await fetchWithAuth('/api/loyalty/rewards', {
    method: 'POST',
    body: JSON.stringify(reward),
  });
  return result.data;
}

export async function updateReward(id: string, updates: Partial<LoyaltyReward>): Promise<LoyaltyReward> {
  const result = await fetchWithAuth('/api/loyalty/rewards', {
    method: 'PUT',
    body: JSON.stringify({ id, ...updates }),
  });
  return result.data;
}

export async function deleteReward(id: string): Promise<void> {
  await fetchWithAuth(`/api/loyalty/rewards?id=${id}`, {
    method: 'DELETE',
  });
}

// ======================
// MEMBERSHIP PLANS
// ======================
export async function getMembershipPlans(includeInactive: boolean = false): Promise<MembershipPlan[]> {
  const result = await fetchWithAuth(`/api/loyalty/membership-plans?include_inactive=${includeInactive}`);
  return result.data;
}

export async function createMembershipPlan(plan: Partial<MembershipPlan>): Promise<MembershipPlan> {
  const result = await fetchWithAuth('/api/loyalty/membership-plans', {
    method: 'POST',
    body: JSON.stringify(plan),
  });
  return result.data;
}

export async function updateMembershipPlan(id: string, updates: Partial<MembershipPlan>): Promise<MembershipPlan> {
  const result = await fetchWithAuth('/api/loyalty/membership-plans', {
    method: 'PUT',
    body: JSON.stringify({ id, ...updates }),
  });
  return result.data;
}

export async function deleteMembershipPlan(id: string): Promise<void> {
  await fetchWithAuth(`/api/loyalty/membership-plans?id=${id}`, {
    method: 'DELETE',
  });
}

// ======================
// MEMBERSHIPS
// ======================
interface GetMembershipsParams {
  page?: number;
  limit?: number;
  status?: string;
  leadId?: string;
}

export async function getMemberships(params: GetMembershipsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.leadId) searchParams.set('lead_id', params.leadId);

  const result = await fetchWithAuth(`/api/loyalty/memberships?${searchParams}`);
  return result.data;
}

export async function createMembership(membership: {
  lead_id: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'annual';
  payment_method?: string;
  payment_amount?: number;
  notes?: string;
}): Promise<Membership> {
  const result = await fetchWithAuth('/api/loyalty/memberships', {
    method: 'POST',
    body: JSON.stringify(membership),
  });
  return result.data;
}

export async function updateMembership(id: string, updates: Partial<Membership>): Promise<Membership> {
  const result = await fetchWithAuth('/api/loyalty/memberships', {
    method: 'PUT',
    body: JSON.stringify({ id, ...updates }),
  });
  return result.data;
}

export async function cancelMembership(id: string): Promise<void> {
  await fetchWithAuth(`/api/loyalty/memberships?id=${id}`, {
    method: 'DELETE',
  });
}

// ======================
// MEMBERS
// ======================
interface GetMembersParams {
  page?: number;
  limit?: number;
  search?: string;
  filter?: 'all' | 'with_tokens' | 'with_membership' | 'inactive';
  sortBy?: 'tokens' | 'name' | 'last_activity';
  sortOrder?: 'asc' | 'desc';
}

export async function getMembers(params: GetMembersParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.search) searchParams.set('search', params.search);
  if (params.filter) searchParams.set('filter', params.filter);
  if (params.sortBy) searchParams.set('sort_by', params.sortBy);
  if (params.sortOrder) searchParams.set('sort_order', params.sortOrder);

  const result = await fetchWithAuth(`/api/loyalty/members?${searchParams}`);
  return result.data;
}

export async function awardTokens(leadId: string, tokens: number, description?: string): Promise<void> {
  await fetchWithAuth('/api/loyalty/members', {
    method: 'POST',
    body: JSON.stringify({
      lead_id: leadId,
      tokens,
      description,
      transaction_type: 'manual',
    }),
  });
}

// ======================
// TRANSACTIONS
// ======================
interface GetTransactionsParams {
  page?: number;
  limit?: number;
  leadId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

export async function getTransactions(params: GetTransactionsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.leadId) searchParams.set('lead_id', params.leadId);
  if (params.type) searchParams.set('type', params.type);
  if (params.startDate) searchParams.set('start_date', params.startDate);
  if (params.endDate) searchParams.set('end_date', params.endDate);

  const result = await fetchWithAuth(`/api/loyalty/transactions?${searchParams}`);
  return result.data;
}

// ======================
// REDEMPTIONS
// ======================
interface GetRedemptionsParams {
  page?: number;
  limit?: number;
  status?: 'pending' | 'used' | 'expired';
}

export async function getRedemptions(params: GetRedemptionsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.status) searchParams.set('status', params.status);

  const result = await fetchWithAuth(`/api/loyalty/redemptions?${searchParams}`);
  return result.data;
}

export async function redeemReward(leadId: string, rewardId: string, notes?: string): Promise<{
  redemption_id: string;
  redemption_code: string;
  reward_name: string;
  patient_name: string;
  tokens_used: number;
}> {
  const result = await fetchWithAuth('/api/loyalty/redemptions', {
    method: 'POST',
    body: JSON.stringify({ lead_id: leadId, reward_id: rewardId, notes }),
  });
  return result.data;
}

export async function markRedemptionUsed(idOrCode: string, notes?: string): Promise<Redemption> {
  const isUUID = idOrCode.includes('-');
  const result = await fetchWithAuth('/api/loyalty/redemptions', {
    method: 'PUT',
    body: JSON.stringify({
      [isUUID ? 'id' : 'redemption_code']: idOrCode,
      status: 'used',
      notes,
    }),
  });
  return result.data;
}

// ======================
// MESSAGE TEMPLATES
// ======================
export async function getMessageTemplates(type?: string): Promise<MessageTemplate[]> {
  const url = type
    ? `/api/loyalty/message-templates?type=${type}`
    : '/api/loyalty/message-templates';
  const result = await fetchWithAuth(url);
  return result.data;
}

export async function createMessageTemplate(template: Partial<MessageTemplate>): Promise<MessageTemplate> {
  const result = await fetchWithAuth('/api/loyalty/message-templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
  return result.data;
}

export async function updateMessageTemplate(id: string, updates: Partial<MessageTemplate>): Promise<MessageTemplate> {
  const result = await fetchWithAuth('/api/loyalty/message-templates', {
    method: 'PUT',
    body: JSON.stringify({ id, ...updates }),
  });
  return result.data;
}

export async function deleteMessageTemplate(id: string): Promise<void> {
  await fetchWithAuth(`/api/loyalty/message-templates?id=${id}`, {
    method: 'DELETE',
  });
}

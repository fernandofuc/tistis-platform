// =====================================================
// TIS TIS PLATFORM - Loyalty Types
// Type definitions for the loyalty system
// =====================================================

// ======================
// PROGRAM
// ======================
export interface LoyaltyProgram {
  id: string;
  tenant_id: string;
  program_name: string;
  program_description?: string | null;
  is_active: boolean;
  // Feature toggles
  tokens_enabled: boolean;
  membership_enabled: boolean;
  // Token configuration
  tokens_name: string;
  tokens_name_plural: string;
  tokens_icon?: string;
  tokens_per_currency: number;
  tokens_currency_threshold: number;
  tokens_expiry_days: number;
  // Reactivation configuration
  reactivation_enabled: boolean;
  reactivation_days_inactive: number;
  reactivation_message_template?: string;
  reactivation_offer_type?: string;
  reactivation_offer_value?: number;
  reactivation_max_attempts: number;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ======================
// TOKEN RULES
// ======================
export type ActionType =
  | 'purchase'
  | 'appointment'
  | 'referral'
  | 'review'
  | 'signup'
  | 'birthday'
  | 'custom';

export type PeriodType = 'day' | 'week' | 'month' | 'year' | 'lifetime';

export interface TokenRule {
  id: string;
  program_id: string;
  action_type: ActionType;
  action_name: string;
  action_description: string | null;
  tokens_amount: number;
  tokens_multiplier: number;
  max_per_period: number | null;
  period_type: PeriodType;
  conditions: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// ======================
// REWARDS
// ======================
export type RewardType =
  | 'discount_percentage'
  | 'discount_fixed'
  | 'free_service'
  | 'gift'
  | 'upgrade'
  | 'custom';

export interface LoyaltyReward {
  id: string;
  program_id: string;
  reward_name: string;
  reward_description: string | null;
  reward_type: RewardType;
  tokens_required: number;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  applicable_services: string[];
  stock_limit: number | null;
  stock_used: number;
  terms_conditions: string | null;
  valid_days: number;
  is_active: boolean;
  created_at: string;
}

// ======================
// MEMBERSHIP PLANS
// ======================
export interface MembershipPlan {
  id: string;
  program_id: string;
  plan_name: string;
  plan_description: string | null;
  price_monthly: number | null;
  price_annual: number | null;
  benefits: string[];
  discount_percent: number; // Database column name
  discount_percentage?: number; // Alias for frontend compatibility
  included_services: string[];
  tokens_multiplier: number;
  priority_booking: boolean;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
}

// ======================
// BALANCES & TRANSACTIONS
// ======================
export type TierType = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyBalance {
  id: string;
  program_id: string;
  lead_id: string;
  total_earned: number;
  total_spent: number;
  current_balance: number;
  lifetime_value: number;
  tier: TierType;
  last_activity_at: string;
  tokens_expiring_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionType =
  | 'earn_purchase'
  | 'earn_action'
  | 'spend'
  | 'adjustment'
  | 'expiration'
  | 'manual';

export interface LoyaltyTransaction {
  id: string;
  program_id: string;
  lead_id: string;
  tokens: number;
  transaction_type: TransactionType;
  description: string;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
  leads?: {
    id: string;
    name: string;
    email: string;
  };
}

// ======================
// MEMBERSHIPS
// ======================
export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'pending';
export type BillingCycle = 'monthly' | 'annual';
export type PaymentMethod = 'stripe' | 'manual' | 'cash' | 'transfer';

export interface Membership {
  id: string;
  program_id: string;
  lead_id: string;
  plan_id: string;
  status: MembershipStatus;
  start_date: string;
  end_date: string;
  billing_cycle: BillingCycle;
  payment_method: PaymentMethod;
  payment_amount: number;
  stripe_subscription_id: string | null;
  auto_renew: boolean;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  leads?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  loyalty_membership_plans?: {
    plan_name: string;
    price_monthly: number | null;
    price_annual: number | null;
    benefits: string[];
  };
}

// ======================
// REDEMPTIONS
// ======================
export type RedemptionStatus = 'pending' | 'used' | 'expired';

export interface Redemption {
  id: string;
  program_id: string;
  lead_id: string;
  reward_id: string;
  tokens_used: number;
  redemption_code: string;
  status: RedemptionStatus;
  used_at: string | null;
  expires_at: string;
  notes: string | null;
  created_at: string;
  leads?: {
    id: string;
    name: string;
    email: string;
  };
  loyalty_rewards?: {
    reward_name: string;
    reward_type: RewardType;
  };
}

// ======================
// MESSAGE TEMPLATES
// ======================
export type TemplateType =
  | 'membership_reminder'
  | 'membership_expired'
  | 'tokens_earned'
  | 'tokens_expiring'
  | 'reward_redeemed'
  | 'tier_upgrade'
  | 'reactivation'
  | 'welcome'
  | 'birthday';

export interface MessageTemplate {
  id: string;
  program_id: string;
  template_type: TemplateType;
  template_name: string;
  subject: string | null;
  message_template: string;
  whatsapp_template: string;
  variables: string[];
  is_active: boolean;
  send_via_whatsapp: boolean;
  send_via_email: boolean;
  created_at: string;
  updated_at: string;
}

// ======================
// STATS & DASHBOARD
// ======================
export interface LoyaltyStats {
  program: {
    id: string;
    name: string;
    tokens_name: string;
    is_active: boolean;
  };
  tokens: {
    total_in_circulation: number;
    total_earned_all_time: number;
    total_spent_all_time: number;
    average_balance: number;
    members_with_tokens: number;
  };
  tiers: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  memberships: {
    total_active: number;
    total_expired: number;
    total_cancelled: number;
    monthly_recurring_revenue: number;
    annual_recurring_revenue: number;
    new_this_period: number;
  };
  period: {
    days: number;
    tokens_earned: number;
    tokens_spent: number;
    transactions_count: number;
  };
  redemptions: {
    total_redemptions: number;
    pending: number;
    used: number;
    expired: number;
    total_tokens_redeemed: number;
    redemptions_this_period: number;
  };
  top_rewards: Array<{
    id: string;
    reward_name: string;
    tokens_required: number;
    redemption_count: number;
  }>;
  expiring_memberships: Array<{
    id: string;
    end_date: string;
    leads: { name: string; email: string };
    loyalty_membership_plans: { plan_name: string };
  }>;
}

// ======================
// MEMBER (Lead with loyalty info)
// ======================
export interface LoyaltyMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  last_interaction_at: string | null;
  created_at: string;
  tokens: {
    current: number;
    total_earned: number;
    total_spent: number;
    lifetime_value: number;
    tier: TierType;
  };
  membership: {
    id: string;
    plan_name: string;
    status: MembershipStatus;
    end_date: string;
  } | null;
}

// ======================
// API RESPONSES
// ======================
export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

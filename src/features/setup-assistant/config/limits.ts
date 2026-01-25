// =====================================================
// TIS TIS PLATFORM - Setup Assistant Limits Config
// Sprint 5: Plan-based usage limits
// =====================================================

/**
 * Plan identifiers matching the plans table
 * Active plans: starter < essentials < growth < enterprise
 */
export type PlanId = 'starter' | 'essentials' | 'growth' | 'enterprise';

/**
 * Defines usage limits for a plan
 */
export interface PlanLimits {
  messagesPerDay: number;
  filesPerDay: number;
  visionRequestsPerDay: number;
  tokensPerDay: number;
  features: {
    visionAnalysis: boolean;
    bulkImport: boolean;
    customPrompts: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
  };
}

/**
 * Plan limits configuration
 * These should match the values in the SQL function get_setup_usage_with_limits
 */
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: {
    messagesPerDay: 20,
    filesPerDay: 3,
    visionRequestsPerDay: 2,
    tokensPerDay: 10000,
    features: {
      visionAnalysis: true,
      bulkImport: false,
      customPrompts: false,
      advancedAnalytics: false,
      prioritySupport: false,
    },
  },
  essentials: {
    messagesPerDay: 50,
    filesPerDay: 10,
    visionRequestsPerDay: 5,
    tokensPerDay: 50000,
    features: {
      visionAnalysis: true,
      bulkImport: true,
      customPrompts: false,
      advancedAnalytics: false,
      prioritySupport: false,
    },
  },
  growth: {
    messagesPerDay: 200,
    filesPerDay: 50,
    visionRequestsPerDay: 25,
    tokensPerDay: 200000,
    features: {
      visionAnalysis: true,
      bulkImport: true,
      customPrompts: true,
      advancedAnalytics: true,
      prioritySupport: false,
    },
  },
  enterprise: {
    messagesPerDay: 999999,
    filesPerDay: 999999,
    visionRequestsPerDay: 999999,
    tokensPerDay: 999999999,
    features: {
      visionAnalysis: true,
      bulkImport: true,
      customPrompts: true,
      advancedAnalytics: true,
      prioritySupport: true,
    },
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get limits for a given plan
 * @param planId The plan identifier (case insensitive)
 * @returns Plan limits, defaulting to starter if unknown
 */
export function getPlanLimits(planId: string): PlanLimits {
  const normalizedPlanId = planId.toLowerCase() as PlanId;
  return PLAN_LIMITS[normalizedPlanId] || PLAN_LIMITS.starter;
}

/**
 * Check if current usage is at or over limit
 */
export function isAtLimit(
  usage: { messages: number; files: number; vision: number },
  limits: PlanLimits
): boolean {
  return (
    usage.messages >= limits.messagesPerDay ||
    usage.files >= limits.filesPerDay ||
    usage.vision >= limits.visionRequestsPerDay
  );
}

/**
 * Check if a plan has unlimited usage (enterprise)
 */
export function isUnlimitedPlan(planId: string): boolean {
  return planId.toLowerCase() === 'enterprise';
}

/**
 * Calculate percentage of limit used
 * @returns Percentage (0-100), capped at 100
 * Note: Returns 0 for unlimited plans (limit >= 999999) or invalid limits
 */
export function getLimitPercentage(current: number, limit: number): number {
  if (limit <= 0 || limit >= 999999) return 0;
  return Math.min(100, Math.round((current / limit) * 100));
}

/**
 * Determine if an upgrade prompt should be shown
 * Shows when any limit is at 80% or more (not for enterprise)
 */
export function shouldShowUpgradePrompt(
  usage: { messages: number; files: number; vision: number; tokens?: number },
  limits: PlanLimits,
  planId?: string
): boolean {
  // Never show upgrade prompt for enterprise
  if (planId && isUnlimitedPlan(planId)) return false;

  const messagePercentage = getLimitPercentage(usage.messages, limits.messagesPerDay);
  const filePercentage = getLimitPercentage(usage.files, limits.filesPerDay);
  const visionPercentage = getLimitPercentage(usage.vision, limits.visionRequestsPerDay);
  const tokensPercentage = usage.tokens !== undefined
    ? getLimitPercentage(usage.tokens, limits.tokensPerDay)
    : 0;

  return messagePercentage >= 80 || filePercentage >= 80 || visionPercentage >= 80 || tokensPercentage >= 80;
}

/**
 * Get the next plan for upgrade
 */
export function getUpgradePlan(currentPlanId: string): PlanId | null {
  const upgradePath: Record<string, PlanId | null> = {
    starter: 'essentials',
    essentials: 'growth',
    growth: 'enterprise',
    enterprise: null, // Enterprise is the highest plan
  };

  return upgradePath[currentPlanId.toLowerCase()] ?? 'essentials';
}

/**
 * Plan display information for UI
 */
export const PLAN_DISPLAY_INFO: Record<PlanId, { name: string; price: string; highlight: string }> = {
  starter: {
    name: 'Starter',
    price: '$3,490/mes',
    highlight: '20 mensajes/día, 3 archivos, 2 análisis',
  },
  essentials: {
    name: 'Essentials',
    price: '$7,490/mes',
    highlight: '50 mensajes/día, 10 archivos, 5 análisis',
  },
  growth: {
    name: 'Growth',
    price: '$12,490/mes',
    highlight: '200 mensajes/día, 50 archivos, 25 análisis',
  },
  enterprise: {
    name: 'Enterprise',
    price: 'Personalizado',
    highlight: 'Sin límites, soporte prioritario',
  },
};

// =====================================================
// TIS TIS PLATFORM - Rate Limit Constants
// Plan-based rate limits and configuration
// =====================================================

import type { PlanRateLimits } from '../types';

// ======================
// PLAN DEFINITIONS
// ======================

/**
 * Available plans in the system
 */
export type Plan = 'starter' | 'growth' | 'enterprise';

/**
 * Rate limits configuration by plan
 */
export const PLAN_RATE_LIMITS: Record<Plan, PlanRateLimits> = {
  starter: {
    plan: 'starter',
    default_rpm: 30, // Requests per minute
    default_daily: 1000, // Requests per day
    max_rpm: 60, // Maximum configurable RPM
    max_daily: 2000, // Maximum configurable daily
    max_keys: 2, // Maximum API keys
  },
  growth: {
    plan: 'growth',
    default_rpm: 60,
    default_daily: 10000,
    max_rpm: 120,
    max_daily: 20000,
    max_keys: 10,
  },
  enterprise: {
    plan: 'enterprise',
    default_rpm: 100,
    default_daily: 100000,
    max_rpm: 500,
    max_daily: 500000,
    max_keys: 50,
  },
};

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Get rate limits for a plan
 */
export function getPlanRateLimits(plan: string): PlanRateLimits {
  const normalizedPlan = plan.toLowerCase() as Plan;
  return PLAN_RATE_LIMITS[normalizedPlan] || PLAN_RATE_LIMITS.starter;
}

/**
 * Check if a plan exists
 */
export function isValidPlan(plan: string): plan is Plan {
  return plan.toLowerCase() in PLAN_RATE_LIMITS;
}

/**
 * Validate and clamp rate limit values
 */
export function validateRateLimits(
  plan: string,
  rpm?: number,
  daily?: number
): { rpm: number; daily: number } {
  const limits = getPlanRateLimits(plan);

  const validRpm = rpm
    ? Math.min(Math.max(rpm, 1), limits.max_rpm)
    : limits.default_rpm;

  const validDaily = daily
    ? Math.min(Math.max(daily, 100), limits.max_daily)
    : limits.default_daily;

  return { rpm: validRpm, daily: validDaily };
}

/**
 * Check if a tenant can create more API keys
 */
export function canCreateMoreKeys(
  plan: string,
  currentActiveKeys: number
): { allowed: boolean; remaining: number; limit: number } {
  const limits = getPlanRateLimits(plan);
  const remaining = limits.max_keys - currentActiveKeys;

  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    limit: limits.max_keys,
  };
}

// ======================
// RATE LIMIT HEADERS
// ======================

/**
 * Standard rate limit header names
 */
export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After',
} as const;

/**
 * Build rate limit headers for response
 */
export function buildRateLimitHeaders(
  limit: number,
  remaining: number,
  resetTimestamp: number
): Record<string, string> {
  return {
    [RATE_LIMIT_HEADERS.LIMIT]: String(limit),
    [RATE_LIMIT_HEADERS.REMAINING]: String(Math.max(0, remaining)),
    [RATE_LIMIT_HEADERS.RESET]: String(Math.floor(resetTimestamp / 1000)),
  };
}

// ======================
// ERROR MESSAGES
// ======================

/**
 * Rate limit error messages (Spanish)
 */
export const RATE_LIMIT_ERRORS = {
  MINUTE_EXCEEDED: (limit: number, retryAfter: number) =>
    `Has excedido el límite de ${limit} solicitudes por minuto. Intenta de nuevo en ${retryAfter} segundos.`,
  DAILY_EXCEEDED: (limit: number) =>
    `Has excedido el límite de ${limit} solicitudes diarias. El límite se reinicia a medianoche UTC.`,
  KEY_LIMIT_EXCEEDED: (limit: number, plan: string) =>
    `Has alcanzado el límite de ${limit} API Keys para tu plan ${plan}. Actualiza tu plan para crear más.`,
} as const;

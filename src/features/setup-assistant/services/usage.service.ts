// =====================================================
// TIS TIS PLATFORM - Setup Assistant Usage Service
// Sprint 5: Plan-based usage limits and tracking
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import {
  getPlanLimits,
  isUnlimitedPlan,
  getUpgradePlan,
  PLAN_DISPLAY_INFO,
  type PlanId,
} from '../config/limits';
import type { UsageInfo, DetailedUsageInfo } from '../types';

// Re-export from types for convenience
export type { DetailedUsageInfo };

// =====================================================
// TYPES
// =====================================================

/**
 * Result of checking if an action is allowed
 */
export interface ActionCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  limitCount?: number;
}

/**
 * Upgrade suggestion based on usage
 */
export interface UpgradeSuggestion {
  shouldUpgrade: boolean;
  suggestedPlan: PlanId | null;
  suggestedPlanName: string;
  suggestedPlanPrice: string;
  suggestedPlanHighlight: string;
  reason: string;
}

// =====================================================
// USAGE SERVICE CLASS
// =====================================================

export class UsageService {
  private static instance: UsageService;

  private constructor() {}

  static getInstance(): UsageService {
    if (!UsageService.instance) {
      UsageService.instance = new UsageService();
    }
    return UsageService.instance;
  }

  // ======================
  // GET USAGE
  // ======================

  /**
   * Get detailed usage info for a tenant
   */
  async getUsage(tenantId: string): Promise<DetailedUsageInfo> {
    const supabase = createServerClient();

    const { data, error } = await supabase.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    if (error) {
      console.error('[UsageService] Error getting usage:', error);
      throw new Error('Failed to get usage');
    }

    const usage = data?.[0];
    if (!usage) {
      // Return defaults for starter plan
      const defaultLimits = getPlanLimits('starter');
      return {
        messagesCount: 0,
        messagesLimit: defaultLimits.messagesPerDay,
        filesUploaded: 0,
        filesLimit: defaultLimits.filesPerDay,
        visionRequests: 0,
        visionLimit: defaultLimits.visionRequestsPerDay,
        planId: 'starter',
        planName: 'Starter',
        isAtLimit: false,
        resetAt: this.getNextResetTime(),
        tokensUsed: 0,
        tokensLimit: defaultLimits.tokensPerDay,
        percentages: {
          messages: 0,
          files: 0,
          vision: 0,
          tokens: 0,
        },
      };
    }

    // Check if enterprise (unlimited)
    const isEnterprise = isUnlimitedPlan(usage.plan_id);

    return {
      messagesCount: usage.messages_count,
      messagesLimit: usage.messages_limit,
      filesUploaded: usage.files_uploaded,
      filesLimit: usage.files_limit,
      visionRequests: usage.vision_requests,
      visionLimit: usage.vision_limit,
      planId: usage.plan_id,
      planName: usage.plan_name,
      isAtLimit: usage.is_at_limit,
      resetAt: usage.reset_at,
      tokensUsed: usage.total_tokens,
      tokensLimit: usage.tokens_limit,
      percentages: isEnterprise
        ? { messages: 0, files: 0, vision: 0, tokens: 0 }
        : {
            messages: this.calculatePercentage(usage.messages_count, usage.messages_limit),
            files: this.calculatePercentage(usage.files_uploaded, usage.files_limit),
            vision: this.calculatePercentage(usage.vision_requests, usage.vision_limit),
            tokens: this.calculatePercentage(usage.total_tokens, usage.tokens_limit),
          },
    };
  }

  // ======================
  // CHECK ACTION ALLOWED
  // ======================

  /**
   * Check if a specific action is allowed based on tenant limits
   */
  async canPerformAction(
    tenantId: string,
    action: 'message' | 'file' | 'vision'
  ): Promise<ActionCheckResult> {
    const usage = await this.getUsage(tenantId);

    // Enterprise is always allowed
    if (isUnlimitedPlan(usage.planId)) {
      return { allowed: true };
    }

    switch (action) {
      case 'message':
        if (usage.messagesCount >= usage.messagesLimit) {
          return {
            allowed: false,
            reason: `Has alcanzado el límite de ${usage.messagesLimit} mensajes diarios.`,
            currentCount: usage.messagesCount,
            limitCount: usage.messagesLimit,
          };
        }
        break;

      case 'file':
        if (usage.filesUploaded >= usage.filesLimit) {
          return {
            allowed: false,
            reason: `Has alcanzado el límite de ${usage.filesLimit} archivos diarios.`,
            currentCount: usage.filesUploaded,
            limitCount: usage.filesLimit,
          };
        }
        break;

      case 'vision':
        if (usage.visionRequests >= usage.visionLimit) {
          return {
            allowed: false,
            reason: `Has alcanzado el límite de ${usage.visionLimit} análisis de imagen diarios.`,
            currentCount: usage.visionRequests,
            limitCount: usage.visionLimit,
          };
        }
        break;
    }

    return { allowed: true };
  }

  // ======================
  // UPGRADE SUGGESTIONS
  // ======================

  /**
   * Get upgrade suggestions based on current usage
   */
  getUpgradeSuggestion(usage: DetailedUsageInfo): UpgradeSuggestion {
    const { planId, percentages } = usage;

    // Already on enterprise - no upgrade needed
    if (isUnlimitedPlan(planId)) {
      return {
        shouldUpgrade: false,
        suggestedPlan: null,
        suggestedPlanName: '',
        suggestedPlanPrice: '',
        suggestedPlanHighlight: '',
        reason: '',
      };
    }

    // Check if any limit is at 80% or more
    const highUsage = Object.values(percentages).some((p) => p >= 80);

    if (!highUsage) {
      return {
        shouldUpgrade: false,
        suggestedPlan: null,
        suggestedPlanName: '',
        suggestedPlanPrice: '',
        suggestedPlanHighlight: '',
        reason: '',
      };
    }

    // Get next plan in upgrade path
    const suggestedPlan = getUpgradePlan(planId);

    if (!suggestedPlan) {
      return {
        shouldUpgrade: false,
        suggestedPlan: null,
        suggestedPlanName: '',
        suggestedPlanPrice: '',
        suggestedPlanHighlight: '',
        reason: '',
      };
    }

    const planInfo = PLAN_DISPLAY_INFO[suggestedPlan];

    return {
      shouldUpgrade: true,
      suggestedPlan,
      suggestedPlanName: planInfo.name,
      suggestedPlanPrice: planInfo.price,
      suggestedPlanHighlight: planInfo.highlight,
      reason: this.getUpgradeReason(percentages),
    };
  }

  // ======================
  // HELPER METHODS
  // ======================

  /**
   * Calculate percentage (0-100)
   * Returns 0 for unlimited (>=999999) or invalid limits
   */
  private calculatePercentage(current: number, limit: number): number {
    if (limit <= 0 || limit >= 999999) return 0;
    return Math.min(100, Math.round((current / limit) * 100));
  }

  /**
   * Get next reset time (midnight UTC)
   */
  private getNextResetTime(): Date | string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Generate upgrade reason message based on high usage areas
   */
  private getUpgradeReason(percentages: Record<string, number>): string {
    const reasons: string[] = [];

    if (percentages.messages >= 80) {
      reasons.push('límite de mensajes');
    }
    if (percentages.files >= 80) {
      reasons.push('límite de archivos');
    }
    if (percentages.vision >= 80) {
      reasons.push('límite de análisis de imagen');
    }
    if (percentages.tokens >= 80) {
      reasons.push('límite de tokens');
    }

    if (reasons.length === 0) {
      return 'Más capacidad para tu negocio';
    }

    return `Estás cerca del ${reasons.join(' y ')}. Actualiza para continuar sin interrupciones.`;
  }

  /**
   * Format reset time for display
   */
  formatResetTime(resetAt: Date | string): string {
    const date = typeof resetAt === 'string' ? new Date(resetAt) : resetAt;
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff <= 0) {
      return 'ahora';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `en ${hours}h ${minutes}m`;
    }
    return `en ${minutes} minutos`;
  }
}

// Singleton instance export
export const usageService = UsageService.getInstance();

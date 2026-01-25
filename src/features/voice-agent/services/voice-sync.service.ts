// =====================================================
// TIS TIS PLATFORM - Voice Minute Sync Service
// Synchronizes voice limits with Stripe subscription changes
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PLAN_CONFIG } from '@/src/shared/config/plans';

// =====================================================
// VOICE MINUTES CONFIGURATION
// Voice is only available on Growth plan
// =====================================================

const VOICE_CONFIG = {
  /** Included minutes for Growth plan per month */
  GROWTH_INCLUDED_MINUTES: 100,
  /** Overage price per minute in centavos MXN ($3.50 MXN = 350 centavos) */
  OVERAGE_PRICE_CENTAVOS: 350,
  /** Default max overage charge in centavos ($1000 MXN = 100,000 centavos) */
  DEFAULT_MAX_OVERAGE_CENTAVOS: 100000,
  /** Default alert thresholds (percentages) */
  DEFAULT_ALERT_THRESHOLDS: [70, 85, 95, 100],
};

// =====================================================
// TYPES
// =====================================================

export interface SyncVoiceLimitsInput {
  tenantId: string;
  plan: string;
  stripeCustomerId?: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  voiceEnabled?: boolean;
  includedMinutes?: number;
  overagePrice?: number;
}

export interface ResetUsageInput {
  tenantId: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
}

export interface ResetResult {
  success: boolean;
  message: string;
  previousPeriodMinutes?: number;
  newPeriodId?: string;
}

// =====================================================
// SUPABASE CLIENT
// =====================================================

function createServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// =====================================================
// VOICE SYNC SERVICE CLASS
// =====================================================

export class VoiceSyncService {
  private static instance: VoiceSyncService;

  private constructor() {}

  static getInstance(): VoiceSyncService {
    if (!VoiceSyncService.instance) {
      VoiceSyncService.instance = new VoiceSyncService();
    }
    return VoiceSyncService.instance;
  }

  /**
   * Sync voice limits when subscription plan changes
   * - Enables/disables voice based on plan
   * - Updates included minutes
   * - Updates overage price
   */
  async syncVoiceLimits(input: SyncVoiceLimitsInput): Promise<SyncResult> {
    const { tenantId, plan, stripeCustomerId } = input;
    const supabase = createServerClient();

    console.log('[VoiceSyncService] Syncing voice limits', { tenantId, plan });

    // Get plan configuration
    const planConfig = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];

    if (!planConfig) {
      console.warn('[VoiceSyncService] Unknown plan:', plan);
      return {
        success: false,
        message: `Unknown plan: ${plan}`,
      };
    }

    // Determine if voice is enabled for this plan
    // Voice is only available on Growth plan
    const voiceEnabled = plan === 'growth';
    const includedMinutes = voiceEnabled ? VOICE_CONFIG.GROWTH_INCLUDED_MINUTES : 0;

    // Overage price in centavos (MXN)
    const overagePriceCentavos = voiceEnabled ? VOICE_CONFIG.OVERAGE_PRICE_CENTAVOS : 0;

    try {
      // Check if voice_minute_limits record exists
      const { data: existingLimits, error: fetchError } = await supabase
        .from('voice_minute_limits')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError) {
        console.error('[VoiceSyncService] Error fetching limits:', fetchError);
        return {
          success: false,
          message: fetchError.message,
        };
      }

      if (existingLimits) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('voice_minute_limits')
          .update({
            included_minutes: includedMinutes,
            overage_price_centavos: overagePriceCentavos,
            is_active: voiceEnabled,
            stripe_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId);

        if (updateError) {
          console.error('[VoiceSyncService] Error updating limits:', updateError);
          return {
            success: false,
            message: updateError.message,
          };
        }

        console.log('[VoiceSyncService] Updated voice limits', {
          tenantId,
          voiceEnabled,
          includedMinutes,
        });
      } else if (voiceEnabled) {
        // Create new record only if voice is enabled
        const { error: insertError } = await supabase
          .from('voice_minute_limits')
          .insert({
            tenant_id: tenantId,
            included_minutes: includedMinutes,
            overage_price_centavos: overagePriceCentavos,
            is_active: true,
            overage_policy: 'notify_only', // Default policy
            alert_thresholds: VOICE_CONFIG.DEFAULT_ALERT_THRESHOLDS,
            max_overage_charge_centavos: VOICE_CONFIG.DEFAULT_MAX_OVERAGE_CENTAVOS,
            stripe_customer_id: stripeCustomerId,
          });

        if (insertError) {
          console.error('[VoiceSyncService] Error creating limits:', insertError);
          return {
            success: false,
            message: insertError.message,
          };
        }

        console.log('[VoiceSyncService] Created voice limits', {
          tenantId,
          includedMinutes,
        });
      }

      return {
        success: true,
        message: voiceEnabled
          ? `Voice enabled with ${includedMinutes} minutes`
          : 'Voice disabled for this plan',
        voiceEnabled,
        includedMinutes,
        overagePrice: overagePriceCentavos / 100,
      };
    } catch (error) {
      console.error('[VoiceSyncService] Unexpected error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reset voice usage for new billing period
   * Called when invoice.paid is processed
   */
  async resetUsageForNewPeriod(input: ResetUsageInput): Promise<ResetResult> {
    const { tenantId, billingPeriodStart, billingPeriodEnd } = input;
    const supabase = createServerClient();

    console.log('[VoiceSyncService] Resetting usage for new period', {
      tenantId,
      billingPeriodStart,
      billingPeriodEnd,
    });

    try {
      // Get current period usage before reset
      const { data: currentPeriod } = await supabase
        .from('voice_minute_usage_periods')
        .select('id, included_used_minutes, overage_used_minutes')
        .eq('tenant_id', tenantId)
        .eq('is_current', true)
        .maybeSingle();

      const previousMinutes = currentPeriod
        ? currentPeriod.included_used_minutes + currentPeriod.overage_used_minutes
        : 0;

      // Mark current period as not current
      if (currentPeriod) {
        await supabase
          .from('voice_minute_usage_periods')
          .update({
            is_current: false,
            period_end: billingPeriodStart,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentPeriod.id);
      }

      // Create new period
      const { data: newPeriod, error: createError } = await supabase
        .from('voice_minute_usage_periods')
        .insert({
          tenant_id: tenantId,
          period_start: billingPeriodStart,
          period_end: billingPeriodEnd,
          included_used_minutes: 0,
          overage_used_minutes: 0,
          overage_charges_centavos: 0,
          is_current: true,
          is_blocked: false,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('[VoiceSyncService] Error creating new period:', createError);
        return {
          success: false,
          message: createError.message,
        };
      }

      console.log('[VoiceSyncService] Created new usage period', {
        tenantId,
        newPeriodId: newPeriod.id,
        previousMinutes,
      });

      return {
        success: true,
        message: 'Usage reset for new billing period',
        previousPeriodMinutes: previousMinutes,
        newPeriodId: newPeriod.id,
      };
    } catch (error) {
      console.error('[VoiceSyncService] Error resetting usage:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle subscription plan upgrade to Growth
   * Called when customer upgrades to voice-enabled plan
   */
  async handlePlanUpgrade(
    tenantId: string,
    newPlan: string,
    stripeCustomerId?: string
  ): Promise<SyncResult> {
    console.log('[VoiceSyncService] Handling plan upgrade', {
      tenantId,
      newPlan,
    });

    // Sync voice limits
    const syncResult = await this.syncVoiceLimits({
      tenantId,
      plan: newPlan,
      stripeCustomerId,
    });

    if (!syncResult.success) {
      return syncResult;
    }

    // If upgrading to Growth, ensure usage period exists
    if (newPlan === 'growth' && syncResult.voiceEnabled) {
      const supabase = createServerClient();

      // Check if current period exists
      const { data: currentPeriod } = await supabase
        .from('voice_minute_usage_periods')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('is_current', true)
        .maybeSingle();

      if (!currentPeriod) {
        // Create initial period
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        await supabase
          .from('voice_minute_usage_periods')
          .insert({
            tenant_id: tenantId,
            period_start: now.toISOString(),
            period_end: endOfMonth.toISOString(),
            included_used_minutes: 0,
            overage_used_minutes: 0,
            overage_charges_centavos: 0,
            is_current: true,
            is_blocked: false,
          });

        console.log('[VoiceSyncService] Created initial usage period for upgrade');
      }
    }

    return syncResult;
  }

  /**
   * Handle subscription downgrade from Growth
   * Called when customer downgrades from voice-enabled plan
   */
  async handlePlanDowngrade(tenantId: string, newPlan: string): Promise<SyncResult> {
    console.log('[VoiceSyncService] Handling plan downgrade', {
      tenantId,
      newPlan,
    });

    const supabase = createServerClient();

    // Disable voice
    const syncResult = await this.syncVoiceLimits({
      tenantId,
      plan: newPlan,
    });

    if (!syncResult.success) {
      return syncResult;
    }

    // Mark current period as ended
    const { error: updateError } = await supabase
      .from('voice_minute_usage_periods')
      .update({
        is_current: false,
        period_end: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('is_current', true);

    if (updateError) {
      console.warn('[VoiceSyncService] Error closing period:', updateError);
    }

    return {
      ...syncResult,
      message: 'Voice disabled due to plan downgrade',
    };
  }

  /**
   * Get tenant ID from Stripe customer ID
   */
  async getTenantFromStripeCustomer(stripeCustomerId: string): Promise<string | null> {
    const supabase = createServerClient();

    // Try voice_minute_limits first
    const { data: limits } = await supabase
      .from('voice_minute_limits')
      .select('tenant_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();

    if (limits?.tenant_id) {
      return limits.tenant_id;
    }

    // Try clients table
    const { data: client } = await supabase
      .from('clients')
      .select('tenant_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();

    return client?.tenant_id || null;
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const voiceSyncService = VoiceSyncService.getInstance();

/**
 * TIS TIS Platform - Voice Agent v2.2
 * Secure Booking Tool: Check Customer Trust
 *
 * Verifies customer trust score and determines booking action.
 * Integrates with Secure Booking System Phase 2.
 */

import type {
  ToolDefinition,
  ToolContext,
  CheckCustomerTrustParams,
  CustomerTrustResult,
  TrustLevel,
  TrustAction,
} from '../types';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Normalize phone number for consistent lookup
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Classify trust score into trust level
 */
function classifyTrustLevel(score: number, isVip: boolean, isBlocked: boolean): TrustLevel {
  if (isBlocked) return 'blocked';
  if (isVip) return 'vip';
  if (score >= 80) return 'trusted';
  if (score >= 50) return 'normal';
  return 'risky';
}

/**
 * Determine action based on trust score and policy thresholds
 */
function determineAction(
  score: number,
  isBlocked: boolean,
  thresholdConfirmation: number,
  thresholdDeposit: number
): TrustAction {
  if (isBlocked) return 'blocked';
  if (score >= thresholdConfirmation) return 'proceed';
  if (score >= thresholdDeposit) return 'require_confirmation';
  return 'require_deposit';
}

// =====================================================
// TOOL DEFINITION
// =====================================================

export const checkCustomerTrust: ToolDefinition<CheckCustomerTrustParams> = {
  name: 'check_customer_trust',
  description: 'Verifica el nivel de confianza del cliente antes de realizar una reservación o cita',
  category: 'secure_booking',

  parameters: {
    type: 'object',
    properties: {
      customerPhone: {
        type: 'string',
        description: 'Número de teléfono del cliente',
        minLength: 10,
      },
      leadId: {
        type: 'string',
        description: 'ID del lead si ya es conocido',
      },
      vertical: {
        type: 'string',
        description: 'Tipo de negocio para políticas específicas',
        enum: ['dental', 'restaurant', 'medical', 'beauty', 'veterinary', 'gym', 'clinic'],
      },
    },
    required: ['customerPhone'],
  },

  requiredCapabilities: ['trust_verification', 'secure_booking'],
  requiresConfirmation: false,
  enabledFor: ['dental_basic', 'dental_standard', 'dental_complete', 'rest_basic', 'rest_standard', 'rest_complete'],
  timeout: 10000,
  logDetails: true,

  handler: async (params, context): Promise<CustomerTrustResult> => {
    const { customerPhone, leadId, vertical } = params;
    const { supabase, tenantId, branchId, locale } = context;

    try {
      const normalizedPhone = normalizePhone(customerPhone);

      // Get tenant vertical if not provided
      let resolvedVertical = vertical;
      if (!resolvedVertical) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('vertical')
          .eq('id', tenantId)
          .single();

        resolvedVertical = tenant?.vertical || 'restaurant';
      }

      // Get booking policy for thresholds
      const { data: policy } = await supabase
        .from('vertical_booking_policies')
        .select('trust_threshold_confirmation, trust_threshold_deposit, deposit_amount_cents')
        .eq('tenant_id', tenantId)
        .eq('vertical', resolvedVertical)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(1)
        .single();

      const thresholdConfirmation = policy?.trust_threshold_confirmation ?? 80;
      const thresholdDeposit = policy?.trust_threshold_deposit ?? 30;
      const depositAmountCents = policy?.deposit_amount_cents ?? 10000;

      // Check if customer exists (by lead_id or phone)
      let trustData: {
        leadId?: string;
        trustScore: number;
        isVip: boolean;
        isBlocked: boolean;
        blockReason?: string;
        blockExpiresAt?: string;
        recentNoShows?: number;
        recentCompletions?: number;
      } | null = null;

      // Try to get trust score via RPC
      const { data: trustResult, error: trustError } = await supabase.rpc('get_customer_trust_score', {
        p_tenant_id: tenantId,
        p_lead_id: leadId || null,
        p_phone_number: normalizedPhone,
      });

      if (!trustError && trustResult) {
        trustData = {
          leadId: trustResult.lead_id,
          trustScore: trustResult.trust_score ?? 70,
          isVip: trustResult.is_vip ?? false,
          isBlocked: trustResult.is_blocked ?? false,
          blockReason: trustResult.block_reason,
          blockExpiresAt: trustResult.block_expires_at,
          recentNoShows: trustResult.recent_no_shows ?? 0,
          recentCompletions: trustResult.recent_completions ?? 0,
        };
      } else {
        // Fallback: Direct query to leads table
        const { data: lead } = await supabase
          .from('leads')
          .select('id, trust_score, is_vip')
          .eq('tenant_id', tenantId)
          .eq('phone', normalizedPhone)
          .single();

        if (lead) {
          // Check for active blocks
          const { data: block } = await supabase
            .from('customer_blocks')
            .select('reason, expires_at')
            .eq('tenant_id', tenantId)
            .eq('lead_id', lead.id)
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString())
            .single();

          trustData = {
            leadId: lead.id,
            trustScore: lead.trust_score ?? 70,
            isVip: lead.is_vip ?? false,
            isBlocked: !!block,
            blockReason: block?.reason,
            blockExpiresAt: block?.expires_at,
          };
        } else {
          // New customer - default trust score
          trustData = {
            trustScore: 70, // Default for new customers
            isVip: false,
            isBlocked: false,
          };
        }
      }

      // Classify and determine action
      const trustLevel = classifyTrustLevel(
        trustData.trustScore,
        trustData.isVip,
        trustData.isBlocked
      );

      const action = determineAction(
        trustData.trustScore,
        trustData.isBlocked,
        thresholdConfirmation,
        thresholdDeposit
      );

      // Build voice message based on result
      let voiceMessage: string;

      if (trustData.isBlocked) {
        voiceMessage = locale === 'en'
          ? "I'm sorry, but we're unable to process your booking at this time. Please contact us directly for assistance."
          : 'Lo siento, pero no podemos procesar su reservación en este momento. Por favor contáctenos directamente para asistencia.';
      } else if (action === 'proceed') {
        voiceMessage = locale === 'en'
          ? 'Your account is in good standing. We can proceed with your booking.'
          : 'Su cuenta está en buen estado. Podemos proceder con su reservación.';
      } else if (action === 'require_confirmation') {
        voiceMessage = locale === 'en'
          ? "To complete your booking, you'll need to confirm within the specified time."
          : 'Para completar su reservación, necesitará confirmar dentro del tiempo especificado.';
      } else {
        const depositAmount = (depositAmountCents / 100).toFixed(2);
        voiceMessage = locale === 'en'
          ? `To secure your booking, a deposit of $${depositAmount} will be required.`
          : `Para asegurar su reservación, se requerirá un depósito de $${depositAmount}.`;
      }

      return {
        success: true,
        voiceMessage,
        data: {
          trustScore: trustData.trustScore,
          trustLevel,
          action,
          isVip: trustData.isVip,
          isBlocked: trustData.isBlocked,
          blockReason: trustData.blockReason,
          blockExpiresAt: trustData.blockExpiresAt,
          recentNoShows: trustData.recentNoShows,
          recentCompletions: trustData.recentCompletions,
          depositAmountCents: action === 'require_deposit' ? depositAmountCents : undefined,
          leadId: trustData.leadId,
        },
      };
    } catch (error) {
      console.error('[CheckCustomerTrust] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? 'There was an issue verifying your account. We can still proceed with your booking.'
          : 'Hubo un problema al verificar su cuenta. Aún podemos proceder con su reservación.',
        data: {
          trustScore: 70, // Default fallback
          trustLevel: 'normal',
          action: 'proceed', // Default to proceed on error
          isVip: false,
          isBlocked: false,
        },
      };
    }
  },
};

export default checkCustomerTrust;

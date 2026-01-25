/**
 * TIS TIS Platform - Voice Agent v2.2
 * Secure Booking Tool: Create Secure Hold
 *
 * Creates a temporary hold on a booking slot to prevent double-booking
 * during the confirmation process. Integrates with Secure Booking System.
 */

import type {
  ToolDefinition,
  ToolContext,
  CreateSecureHoldParams,
  SecureHoldResult,
} from '../types';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Normalize phone number
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Calculate end datetime based on start and duration
 */
function calculateEndDatetime(date: string, time: string, durationMinutes: number): Date {
  const startDateTime = new Date(`${date}T${time}`);
  return new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
}

// =====================================================
// TOOL DEFINITION
// =====================================================

export const createSecureHold: ToolDefinition<CreateSecureHoldParams> = {
  name: 'create_secure_hold',
  description: 'Crea un hold temporal para reservar un horario mientras se confirma la reservación',
  category: 'secure_booking',

  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        format: 'date',
        description: 'Fecha del booking (YYYY-MM-DD)',
      },
      time: {
        type: 'string',
        description: 'Hora del booking (HH:MM)',
      },
      durationMinutes: {
        type: 'integer',
        description: 'Duración en minutos',
        minimum: 5,
        maximum: 480,
        default: 30,
      },
      customerPhone: {
        type: 'string',
        description: 'Teléfono del cliente',
        minLength: 10,
      },
      customerName: {
        type: 'string',
        description: 'Nombre del cliente',
      },
      leadId: {
        type: 'string',
        description: 'ID del lead si ya existe',
      },
      serviceId: {
        type: 'string',
        description: 'ID del servicio (para citas)',
      },
      holdType: {
        type: 'string',
        description: 'Tipo de hold',
        enum: ['reservation', 'appointment', 'order'],
      },
      vertical: {
        type: 'string',
        description: 'Tipo de negocio',
        enum: ['dental', 'restaurant', 'medical', 'beauty', 'veterinary', 'gym', 'clinic'],
      },
    },
    required: ['date', 'time', 'customerPhone'],
  },

  requiredCapabilities: ['booking_holds', 'secure_booking'],
  requiresConfirmation: false,
  enabledFor: ['dental_basic', 'dental_standard', 'dental_complete', 'rest_basic', 'rest_standard', 'rest_complete'],
  timeout: 15000,
  logDetails: true,

  handler: async (params, context): Promise<SecureHoldResult> => {
    const {
      date,
      time,
      durationMinutes = 30,
      customerPhone,
      customerName,
      leadId,
      serviceId,
      holdType = 'appointment',
      vertical,
    } = params;
    const { supabase, tenantId, branchId, callId, channel, locale } = context;

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

      // Calculate slot times
      const slotDatetime = new Date(`${date}T${time}`);
      const endDatetime = calculateEndDatetime(date, time, durationMinutes);

      // Validate slot is in the future
      if (slotDatetime <= new Date()) {
        return {
          success: false,
          error: 'Slot in past',
          voiceMessage: locale === 'en'
            ? 'That time has already passed. Please choose a future date and time.'
            : 'Esa fecha y hora ya pasaron. Por favor elija una fecha y hora futura.',
        };
      }

      // Get booking policy for hold configuration
      const { data: policy } = await supabase
        .from('vertical_booking_policies')
        .select('hold_duration_minutes, trust_threshold_confirmation, trust_threshold_deposit, deposit_amount_cents, require_confirmation_below_trust, require_deposit_below_trust')
        .eq('tenant_id', tenantId)
        .eq('vertical', resolvedVertical)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .limit(1)
        .single();

      const holdDurationMinutes = policy?.hold_duration_minutes ?? 15;
      const thresholdConfirmation = policy?.trust_threshold_confirmation ?? 80;
      const thresholdDeposit = policy?.trust_threshold_deposit ?? 30;
      const depositAmountCents = policy?.deposit_amount_cents ?? 10000;

      // Get customer trust score
      let trustScore = 70; // Default
      let customerLeadId = leadId;

      const { data: trustResult } = await supabase.rpc('get_customer_trust_score', {
        p_tenant_id: tenantId,
        p_lead_id: leadId || null,
        p_phone_number: normalizedPhone,
      });

      if (trustResult) {
        trustScore = trustResult.trust_score ?? 70;
        customerLeadId = trustResult.lead_id || leadId;

        // Check if blocked
        if (trustResult.is_blocked) {
          return {
            success: false,
            error: 'Customer blocked',
            voiceMessage: locale === 'en'
              ? "I'm sorry, but we're unable to process your booking at this time."
              : 'Lo siento, pero no podemos procesar su reservación en este momento.',
          };
        }
      }

      // Determine requirements based on trust
      const requiresDeposit = policy?.require_deposit_below_trust && trustScore < thresholdDeposit;
      const requiresConfirmation = policy?.require_confirmation_below_trust && trustScore < thresholdConfirmation;

      // Calculate hold expiration
      const expiresAt = new Date(Date.now() + holdDurationMinutes * 60 * 1000);

      // Try to create hold via RPC (atomic with availability check)
      const { data: holdResult, error: rpcError } = await supabase.rpc('create_booking_hold', {
        p_tenant_id: tenantId,
        p_branch_id: branchId || null,
        p_lead_id: customerLeadId || null,
        p_phone_number: normalizedPhone,
        p_hold_type: holdType,
        p_slot_datetime: slotDatetime.toISOString(),
        p_end_datetime: endDatetime.toISOString(),
        p_duration_minutes: durationMinutes,
        p_service_id: serviceId || null,
        p_source: channel,
        p_source_call_id: callId,
        p_metadata: {
          customer_name: customerName,
          trust_score_at_hold: trustScore,
          vertical: resolvedVertical,
        },
      });

      if (rpcError) {
        console.error('[CreateSecureHold] RPC error:', rpcError);

        // Fallback: Try direct insert
        let existingHoldsQuery = supabase
          .from('booking_holds')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .lte('slot_datetime', endDatetime.toISOString())
          .gte('end_datetime', slotDatetime.toISOString());

        // Handle branchId properly - use .is() for null comparison
        if (branchId) {
          existingHoldsQuery = existingHoldsQuery.eq('branch_id', branchId);
        }

        const { data: existingHolds } = await existingHoldsQuery.limit(1);

        if (existingHolds && existingHolds.length > 0) {
          return {
            success: false,
            error: 'Slot already held',
            voiceMessage: locale === 'en'
              ? 'Sorry, that time slot is currently being held by someone else. Would you like to try a different time?'
              : 'Lo siento, ese horario está siendo reservado por otra persona. ¿Le gustaría probar otro horario?',
          };
        }

        // Create hold directly
        const { data: insertedHold, error: insertError } = await supabase
          .from('booking_holds')
          .insert({
            tenant_id: tenantId,
            branch_id: branchId || null,
            lead_id: customerLeadId || null,
            phone_number: normalizedPhone,
            hold_type: holdType,
            slot_datetime: slotDatetime.toISOString(),
            end_datetime: endDatetime.toISOString(),
            expires_at: expiresAt.toISOString(),
            status: 'active',
            service_id: serviceId || null,
            trust_score_at_hold: trustScore,
            requires_deposit: requiresDeposit,
            deposit_amount_cents: requiresDeposit ? depositAmountCents : null,
            source: channel,
            source_call_id: callId,
            metadata: {
              customer_name: customerName,
              vertical: resolvedVertical,
            },
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('[CreateSecureHold] Insert error:', insertError);
          return {
            success: false,
            error: insertError.message,
            voiceMessage: locale === 'en'
              ? 'There was a problem reserving your time slot. Please try again.'
              : 'Hubo un problema al reservar su horario. Por favor intente de nuevo.',
          };
        }

        // Return success from fallback
        const expiresInMinutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);

        return {
          success: true,
          voiceMessage: locale === 'en'
            ? `Your time slot is being held for ${holdDurationMinutes} minutes. Please confirm your booking before it expires.`
            : `Su horario está reservado por ${holdDurationMinutes} minutos. Por favor confirme su reservación antes de que expire.`,
          data: {
            holdId: insertedHold.id,
            slotDatetime: slotDatetime.toISOString(),
            endDatetime: endDatetime.toISOString(),
            expiresAt: expiresAt.toISOString(),
            expiresInMinutes,
            trustScoreAtHold: trustScore,
            requiresDeposit,
            depositAmountCents: requiresDeposit ? depositAmountCents : undefined,
            requiresConfirmation,
          },
        };
      }

      // RPC succeeded
      if (!holdResult.success) {
        return {
          success: false,
          error: holdResult.error || 'Hold creation failed',
          voiceMessage: locale === 'en'
            ? holdResult.message || 'Unable to hold that time slot. Please try another time.'
            : holdResult.message || 'No se pudo reservar ese horario. Por favor intente otro horario.',
        };
      }

      const expiresInMinutes = Math.round((new Date(holdResult.expires_at).getTime() - Date.now()) / 60000);

      // Build success message
      let voiceMessage = locale === 'en'
        ? `Great! Your time slot is being held for ${holdDurationMinutes} minutes.`
        : `¡Excelente! Su horario está reservado por ${holdDurationMinutes} minutos.`;

      if (requiresDeposit) {
        const depositAmount = (depositAmountCents / 100).toFixed(2);
        voiceMessage += locale === 'en'
          ? ` A deposit of $${depositAmount} will be required to complete your booking.`
          : ` Se requerirá un depósito de $${depositAmount} para completar su reservación.`;
      } else if (requiresConfirmation) {
        voiceMessage += locale === 'en'
          ? ' Please confirm your booking to finalize it.'
          : ' Por favor confirme su reservación para finalizarla.';
      }

      return {
        success: true,
        voiceMessage,
        data: {
          holdId: holdResult.hold_id,
          slotDatetime: slotDatetime.toISOString(),
          endDatetime: endDatetime.toISOString(),
          expiresAt: holdResult.expires_at || expiresAt.toISOString(),
          expiresInMinutes,
          trustScoreAtHold: trustScore,
          requiresDeposit,
          depositAmountCents: requiresDeposit ? depositAmountCents : undefined,
          requiresConfirmation,
        },
      };
    } catch (error) {
      console.error('[CreateSecureHold] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't reserve that time slot. Please try again."
          : 'Lo siento, no pude reservar ese horario. Por favor intente de nuevo.',
      };
    }
  },
};

export default createSecureHold;

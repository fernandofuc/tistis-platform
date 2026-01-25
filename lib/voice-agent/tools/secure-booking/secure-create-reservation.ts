/**
 * TIS TIS Platform - Voice Agent v2.2
 * Secure Booking Tool: Secure Create Reservation
 *
 * Enhanced version of create_reservation that integrates
 * trust verification and hold management for restaurants.
 */

import type {
  ToolDefinition,
  ToolContext,
  SecureCreateReservationParams,
  SecureBookingResult,
  TrustAction,
} from '../types';
import {
  formatDateForVoice,
  formatTimeForVoice,
  formatPartySizeForVoice,
  formatConfirmationCodeForVoice,
} from '../formatters';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function generateConfirmationCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `RES-${timestamp}${random}`;
}

// =====================================================
// TOOL DEFINITION
// =====================================================

export const secureCreateReservation: ToolDefinition<SecureCreateReservationParams> = {
  name: 'secure_create_reservation',
  description: 'Crea una reservación de restaurante con verificación de confianza del cliente',
  category: 'secure_booking',

  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        format: 'date',
        description: 'Fecha de la reservación (YYYY-MM-DD)',
      },
      time: {
        type: 'string',
        description: 'Hora de la reservación (HH:MM)',
      },
      partySize: {
        type: 'integer',
        description: 'Número de personas',
        minimum: 1,
        maximum: 20,
      },
      customerName: {
        type: 'string',
        description: 'Nombre del cliente',
      },
      customerPhone: {
        type: 'string',
        description: 'Teléfono del cliente',
      },
      customerEmail: {
        type: 'string',
        format: 'email',
        description: 'Email del cliente (opcional)',
      },
      specialRequests: {
        type: 'string',
        description: 'Solicitudes especiales',
      },
      skipTrustCheck: {
        type: 'boolean',
        description: 'Saltar verificación de confianza',
        default: false,
      },
      holdId: {
        type: 'string',
        description: 'ID del hold si ya fue creado',
      },
    },
    required: ['date', 'time', 'partySize', 'customerName', 'customerPhone'],
  },

  requiredCapabilities: ['reservations', 'secure_booking'],
  requiresConfirmation: true,
  enabledFor: ['rest_basic', 'rest_standard', 'rest_complete'],
  timeout: 20000,

  confirmationMessage: (params) => {
    const dateStr = formatDateForVoice(params.date, 'es');
    const timeStr = formatTimeForVoice(params.time, 'es');
    const sizeStr = formatPartySizeForVoice(params.partySize, 'es');

    let message = `Voy a reservar para ${sizeStr} el ${dateStr} a las ${timeStr} a nombre de ${params.customerName}.`;

    if (params.specialRequests) {
      message += ` Con la solicitud especial: ${params.specialRequests}.`;
    }

    message += ' ¿Confirma la reservación?';
    return message;
  },

  handler: async (params, context): Promise<SecureBookingResult> => {
    const {
      date,
      time,
      partySize,
      customerName,
      customerPhone,
      customerEmail,
      specialRequests,
      skipTrustCheck = false,
      holdId,
    } = params;
    const { supabase, tenantId, branchId, callId, channel, locale } = context;

    try {
      const normalizedPhone = normalizePhone(customerPhone);

      // Validate date is in the future
      const reservationDateTime = new Date(`${date}T${time}`);
      if (reservationDateTime < new Date()) {
        return {
          success: false,
          error: 'Date in past',
          voiceMessage: locale === 'en'
            ? 'That time has already passed. Please choose a future date and time.'
            : 'Esa fecha y hora ya pasaron. Por favor elija una fecha y hora futura.',
        };
      }

      // Step 1: Verify customer trust
      let trustScore = 70;
      let trustAction: TrustAction = 'proceed';
      let depositRequired = false;
      let depositAmountCents = 0;
      let leadId: string | undefined;

      if (!skipTrustCheck && !holdId) {
        // Get booking policy
        const { data: policy } = await supabase
          .from('vertical_booking_policies')
          .select('trust_threshold_confirmation, trust_threshold_deposit, deposit_amount_cents, require_deposit_below_trust')
          .eq('tenant_id', tenantId)
          .eq('vertical', 'restaurant')
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .limit(1)
          .single();

        const thresholdConfirmation = policy?.trust_threshold_confirmation ?? 75;
        const thresholdDeposit = policy?.trust_threshold_deposit ?? 25;
        depositAmountCents = policy?.deposit_amount_cents ?? 10000;

        // Get trust score
        const { data: trustResult } = await supabase.rpc('get_customer_trust_score', {
          p_tenant_id: tenantId,
          p_lead_id: null,
          p_phone_number: normalizedPhone,
        });

        if (trustResult) {
          trustScore = trustResult.trust_score ?? 70;
          leadId = trustResult.lead_id;

          // Check if blocked
          if (trustResult.is_blocked) {
            return {
              success: false,
              error: 'Customer blocked',
              voiceMessage: locale === 'en'
                ? "I'm sorry, but we're unable to process your reservation at this time. Please contact us directly."
                : 'Lo siento, pero no podemos procesar su reservación en este momento. Por favor contáctenos directamente.',
            };
          }

          // Determine action
          if (trustScore >= thresholdConfirmation || trustResult.is_vip) {
            trustAction = 'proceed';
          } else if (trustScore >= thresholdDeposit) {
            trustAction = 'require_confirmation';
          } else {
            trustAction = 'require_deposit';
            depositRequired = policy?.require_deposit_below_trust ?? true;
          }
        }
      }

      // If hold was provided, get its info
      if (holdId) {
        const { data: hold } = await supabase
          .from('booking_holds')
          .select('trust_score_at_hold, requires_deposit, deposit_amount_cents, lead_id')
          .eq('id', holdId)
          .eq('tenant_id', tenantId)
          .single();

        if (hold) {
          trustScore = hold.trust_score_at_hold ?? 70;
          depositRequired = hold.requires_deposit ?? false;
          depositAmountCents = hold.deposit_amount_cents ?? 0;
          leadId = hold.lead_id;
        }
      }

      // Step 2: If deposit required and not yet paid, inform user
      if (depositRequired && trustAction === 'require_deposit') {
        const depositAmount = (depositAmountCents / 100).toFixed(2);
        return {
          success: false,
          error: 'Deposit required',
          errorCode: 'DEPOSIT_REQUIRED',
          voiceMessage: locale === 'en'
            ? `To secure your reservation, a deposit of $${depositAmount} is required. Would you like to proceed with the payment?`
            : `Para asegurar su reservación, se requiere un depósito de $${depositAmount}. ¿Desea proceder con el pago?`,
          data: {
            trustScoreAtBooking: trustScore,
            depositRequired: true,
            depositStatus: 'pending',
          },
        };
      }

      // Step 3: Check availability (including holds)
      const endDateTime = new Date(reservationDateTime.getTime() + 90 * 60 * 1000); // 90 min typical

      const { data: activeHolds } = await supabase
        .from('booking_holds')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .neq('id', holdId || '')
        .lte('slot_datetime', endDateTime.toISOString())
        .gte('end_datetime', reservationDateTime.toISOString())
        .limit(1);

      // Note: For restaurants, we check capacity differently
      // This is simplified - production would check table capacity
      const { data: existingReservations } = await supabase
        .from('reservations')
        .select('id, party_size')
        .eq('tenant_id', tenantId)
        .eq('date', date)
        .eq('time', time)
        .not('status', 'in', '("cancelled")');

      // Simple capacity check - assume 50 seats total
      const currentGuests = (existingReservations || []).reduce(
        (sum, r) => sum + (r.party_size || 0),
        0
      );

      if (currentGuests + partySize > 50) {
        return {
          success: false,
          error: 'No capacity',
          voiceMessage: locale === 'en'
            ? `I'm sorry, we don't have space for ${partySize} guests at that time. Would you like to try a different time?`
            : `Lo siento, no tenemos espacio para ${partySize} personas a esa hora. ¿Le gustaría probar otro horario?`,
        };
      }

      // Step 4: Generate confirmation code and create reservation
      const confirmationCode = generateConfirmationCode();

      const { data: reservation, error: insertError } = await supabase
        .from('reservations')
        .insert({
          tenant_id: tenantId,
          branch_id: branchId || null,
          date,
          time,
          party_size: partySize,
          customer_name: customerName,
          customer_phone: normalizedPhone,
          customer_email: customerEmail || null,
          special_requests: specialRequests || null,
          confirmation_code: confirmationCode,
          status: 'confirmed',
          source: channel,
          source_call_id: callId,
          hold_id: holdId || null,
          trust_score_at_booking: trustScore,
          created_at: new Date().toISOString(),
        })
        .select('id, confirmation_code')
        .single();

      if (insertError) {
        console.error('[SecureCreateReservation] Insert error:', insertError);

        if (insertError.message?.includes('duplicate')) {
          return {
            success: false,
            error: 'Duplicate reservation',
            voiceMessage: locale === 'en'
              ? 'It looks like a reservation already exists for this time. Would you like to modify it instead?'
              : 'Parece que ya existe una reservación para este horario. ¿Le gustaría modificarla?',
          };
        }

        return {
          success: false,
          error: insertError.message,
          voiceMessage: locale === 'en'
            ? 'There was a problem creating your reservation. Please try again.'
            : 'Hubo un problema al crear su reservación. Por favor intente de nuevo.',
        };
      }

      // Step 5: If hold existed, mark as converted
      if (holdId) {
        await supabase
          .from('booking_holds')
          .update({
            status: 'converted',
            converted_at: new Date().toISOString(),
            converted_to_id: reservation.id,
            converted_to_type: 'reservation',
          })
          .eq('id', holdId);
      }

      // Step 6: Update trust score (reward)
      if (leadId) {
        await supabase.rpc('update_trust_score', {
          p_lead_id: leadId,
          p_delta: 2,
          p_reason: 'reservation_completed',
          p_reference_id: reservation.id,
        });
      }

      // Format success message
      const dateStr = formatDateForVoice(date, locale);
      const timeStr = formatTimeForVoice(time, locale);
      const codeStr = formatConfirmationCodeForVoice(confirmationCode, locale);

      const voiceMessage = locale === 'en'
        ? `Your reservation for ${partySize} guests on ${dateStr} at ${timeStr} is confirmed. Your confirmation code is ${codeStr}. We'll see you then, ${customerName}!`
        : `Su reservación para ${partySize} personas el ${dateStr} a las ${timeStr} está confirmada. Su código de confirmación es ${codeStr}. ¡Lo esperamos, ${customerName}!`;

      return {
        success: true,
        voiceMessage,
        forwardToClient: true,
        data: {
          reservationId: reservation.id,
          confirmationCode: reservation.confirmation_code,
          dateTime: `${date} ${time}`,
          trustScoreAtBooking: trustScore,
          depositRequired: false,
          depositStatus: 'not_required',
          convertedFromHoldId: holdId,
        },
        metadata: {
          customerName,
          partySize,
        },
      };
    } catch (error) {
      console.error('[SecureCreateReservation] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't complete your reservation. Please try again."
          : 'Lo siento, no pude completar su reservación. Por favor intente de nuevo.',
      };
    }
  },
};

export default secureCreateReservation;

/**
 * TIS TIS Platform - Voice Agent v2.2
 * Secure Booking Tool: Convert Hold to Booking
 *
 * Converts an active hold into a confirmed booking (appointment or reservation).
 * Handles deposit verification if required.
 */

import type {
  ToolDefinition,
  ToolContext,
  ConvertHoldToBookingParams,
  ConvertHoldResult,
} from '../types';
import {
  formatDateForVoice,
  formatTimeForVoice,
  formatConfirmationCodeForVoice,
} from '../formatters';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate a unique confirmation code
 */
function generateConfirmationCode(prefix: string = 'TIS'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${code}`;
}

// =====================================================
// TOOL DEFINITION
// =====================================================

export const convertHoldToBooking: ToolDefinition<ConvertHoldToBookingParams> = {
  name: 'convert_hold_to_booking',
  description: 'Convierte un hold activo en una reservación o cita confirmada',
  category: 'secure_booking',

  parameters: {
    type: 'object',
    properties: {
      holdId: {
        type: 'string',
        description: 'ID del hold a convertir',
      },
      customerName: {
        type: 'string',
        description: 'Nombre del cliente (si no se proporcionó antes)',
      },
      customerEmail: {
        type: 'string',
        format: 'email',
        description: 'Email del cliente',
      },
      specialRequests: {
        type: 'string',
        description: 'Solicitudes especiales',
      },
      notes: {
        type: 'string',
        description: 'Notas adicionales',
      },
      depositPaymentId: {
        type: 'string',
        description: 'ID del pago de depósito si fue requerido',
      },
    },
    required: ['holdId'],
  },

  requiredCapabilities: ['booking_holds', 'secure_booking'],
  requiresConfirmation: true,
  enabledFor: ['dental_basic', 'dental_standard', 'dental_complete', 'rest_basic', 'rest_standard', 'rest_complete'],
  timeout: 20000,

  confirmationMessage: () => '¿Confirma que desea completar esta reservación?',

  handler: async (params, context): Promise<ConvertHoldResult> => {
    const {
      holdId,
      customerName,
      customerEmail,
      specialRequests,
      notes,
      depositPaymentId,
    } = params;
    const { supabase, tenantId, branchId, callId, channel, locale } = context;

    try {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(holdId)) {
        return {
          success: false,
          error: 'Invalid hold ID format',
          voiceMessage: locale === 'en'
            ? 'There was an issue with the hold reference. Please try again.'
            : 'Hubo un problema con la referencia del hold. Por favor intente de nuevo.',
        };
      }

      // Get the hold details
      const { data: hold, error: holdError } = await supabase
        .from('booking_holds')
        .select('*')
        .eq('id', holdId)
        .eq('tenant_id', tenantId)
        .single();

      if (holdError || !hold) {
        return {
          success: false,
          error: 'Hold not found',
          voiceMessage: locale === 'en'
            ? "I couldn't find that reservation hold. It may have expired."
            : 'No encontré ese hold de reservación. Es posible que haya expirado.',
        };
      }

      // Check hold status
      if (hold.status !== 'active') {
        const statusMessages: Record<string, { en: string; es: string }> = {
          converted: {
            en: 'This hold has already been converted to a booking.',
            es: 'Este hold ya fue convertido a una reservación.',
          },
          expired: {
            en: 'Sorry, this hold has expired. Would you like to try again with a new time?',
            es: 'Lo siento, este hold ha expirado. ¿Le gustaría intentar de nuevo con otro horario?',
          },
          released: {
            en: 'This hold was cancelled. Would you like to start a new booking?',
            es: 'Este hold fue cancelado. ¿Le gustaría iniciar una nueva reservación?',
          },
        };

        const msg = statusMessages[hold.status] || statusMessages.expired;

        return {
          success: false,
          error: `Hold status is ${hold.status}`,
          voiceMessage: locale === 'en' ? msg.en : msg.es,
        };
      }

      // Check if hold has expired
      if (new Date(hold.expires_at) < new Date()) {
        // Update hold status to expired
        await supabase
          .from('booking_holds')
          .update({ status: 'expired' })
          .eq('id', holdId);

        return {
          success: false,
          error: 'Hold expired',
          voiceMessage: locale === 'en'
            ? 'Sorry, your reservation hold has expired. Would you like to try again?'
            : 'Lo siento, su hold de reservación ha expirado. ¿Le gustaría intentar de nuevo?',
        };
      }

      // Check deposit requirement
      if (hold.requires_deposit && !depositPaymentId && !hold.deposit_paid) {
        const depositAmount = ((hold.deposit_amount_cents || 10000) / 100).toFixed(2);
        return {
          success: false,
          error: 'Deposit required',
          errorCode: 'DEPOSIT_REQUIRED',
          voiceMessage: locale === 'en'
            ? `A deposit of $${depositAmount} is required to complete your booking. Would you like to proceed with the payment?`
            : `Se requiere un depósito de $${depositAmount} para completar su reservación. ¿Desea proceder con el pago?`,
        };
      }

      // Get tenant vertical to determine booking type
      const { data: tenant } = await supabase
        .from('tenants')
        .select('vertical')
        .eq('id', tenantId)
        .single();

      const isRestaurant = tenant?.vertical === 'restaurant';
      const bookingType = hold.hold_type === 'reservation' || isRestaurant ? 'reservation' : 'appointment';

      // Extract datetime from hold
      const slotDate = new Date(hold.slot_datetime);
      const date = slotDate.toISOString().split('T')[0];
      const time = slotDate.toTimeString().slice(0, 5);

      // Generate confirmation code
      const confirmationCode = generateConfirmationCode(isRestaurant ? 'RES' : 'APT');

      // Get customer name from hold metadata or params
      const finalCustomerName = customerName || hold.metadata?.customer_name || 'Cliente';
      const phoneNumber = hold.phone_number;

      let bookingId: string;

      if (bookingType === 'reservation') {
        // Create reservation
        const { data: reservation, error: insertError } = await supabase
          .from('reservations')
          .insert({
            tenant_id: tenantId,
            branch_id: branchId || hold.branch_id || null,
            date,
            time,
            party_size: hold.metadata?.party_size || 2,
            customer_name: finalCustomerName,
            customer_phone: phoneNumber,
            customer_email: customerEmail || null,
            special_requests: specialRequests || null,
            confirmation_code: confirmationCode,
            status: 'confirmed',
            source: channel,
            source_call_id: callId,
            hold_id: holdId,
            trust_score_at_booking: hold.trust_score_at_hold,
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('[ConvertHoldToBooking] Reservation insert error:', insertError);
          return {
            success: false,
            error: insertError.message,
            voiceMessage: locale === 'en'
              ? 'There was a problem creating your reservation. Please try again.'
              : 'Hubo un problema al crear su reservación. Por favor intente de nuevo.',
          };
        }

        bookingId = reservation.id;
      } else {
        // Create appointment
        const endSlot = new Date(hold.end_datetime);
        const endTime = endSlot.toTimeString().slice(0, 5);

        const { data: appointment, error: insertError } = await supabase
          .from('appointments')
          .insert({
            tenant_id: tenantId,
            branch_id: branchId || hold.branch_id || null,
            date,
            start_time: time,
            end_time: endTime,
            patient_name: finalCustomerName,
            patient_phone: phoneNumber,
            patient_email: customerEmail || null,
            service_id: hold.service_id || null,
            notes: notes || specialRequests || null,
            confirmation_code: confirmationCode,
            status: 'confirmed',
            source: channel,
            source_call_id: callId,
            hold_id: holdId,
            trust_score_at_booking: hold.trust_score_at_hold,
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('[ConvertHoldToBooking] Appointment insert error:', insertError);
          return {
            success: false,
            error: insertError.message,
            voiceMessage: locale === 'en'
              ? 'There was a problem creating your appointment. Please try again.'
              : 'Hubo un problema al crear su cita. Por favor intente de nuevo.',
          };
        }

        bookingId = appointment.id;
      }

      // Update hold status to converted
      const { error: updateError } = await supabase
        .from('booking_holds')
        .update({
          status: 'converted',
          converted_at: new Date().toISOString(),
          converted_to_id: bookingId,
          converted_to_type: bookingType,
        })
        .eq('id', holdId);

      if (updateError) {
        console.error('[ConvertHoldToBooking] Hold update error:', updateError);
        // Continue anyway - booking was created successfully
      }

      // Update customer trust score (reward for completing booking)
      if (hold.lead_id) {
        await supabase.rpc('update_trust_score', {
          p_lead_id: hold.lead_id,
          p_delta: 2, // Small reward for completing booking
          p_reason: 'booking_completed',
          p_reference_id: bookingId,
        });
      }

      // Format success message
      const dateStr = formatDateForVoice(date, locale);
      const timeStr = formatTimeForVoice(time, locale);
      const codeStr = formatConfirmationCodeForVoice(confirmationCode, locale);

      const bookingTypeStr = bookingType === 'reservation'
        ? (locale === 'en' ? 'reservation' : 'reservación')
        : (locale === 'en' ? 'appointment' : 'cita');

      const voiceMessage = locale === 'en'
        ? `Your ${bookingTypeStr} is confirmed for ${dateStr} at ${timeStr}. Your confirmation code is ${codeStr}. We'll send you a reminder before your ${bookingTypeStr}. Is there anything else I can help you with?`
        : `Su ${bookingTypeStr} está confirmada para el ${dateStr} a las ${timeStr}. Su código de confirmación es ${codeStr}. Le enviaremos un recordatorio antes de su ${bookingTypeStr}. ¿Hay algo más en que pueda ayudarle?`;

      return {
        success: true,
        voiceMessage,
        forwardToClient: true,
        data: {
          converted: true,
          bookingId,
          confirmationCode,
          bookingType,
          dateTime: `${date} ${time}`,
        },
      };
    } catch (error) {
      console.error('[ConvertHoldToBooking] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't complete your booking. Please try again."
          : 'Lo siento, no pude completar su reservación. Por favor intente de nuevo.',
      };
    }
  },
};

export default convertHoldToBooking;

/**
 * TIS TIS Platform - Voice Agent v2.0
 * Restaurant Tool: Create Reservation
 *
 * Creates a new restaurant reservation with confirmation workflow.
 * Generates a unique confirmation code for the customer.
 */

import type {
  ToolDefinition,
  ToolContext,
  BookingResult,
  CreateReservationParams,
} from '../types';
import {
  formatDateForVoice,
  formatTimeForVoice,
  formatPartySizeForVoice,
  formatConfirmationCodeForVoice,
} from '../formatters';

// =====================================================
// TOOL DEFINITION
// =====================================================

export const createReservation: ToolDefinition<CreateReservationParams> = {
  name: 'create_reservation',
  description: 'Crea una nueva reservación en el restaurante',
  category: 'booking',

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
        minLength: 2,
      },
      customerPhone: {
        type: 'string',
        description: 'Teléfono del cliente',
        minLength: 10,
      },
      customerEmail: {
        type: 'string',
        format: 'email',
        description: 'Email del cliente (opcional)',
      },
      specialRequests: {
        type: 'string',
        description: 'Solicitudes especiales (ej: mesa en terraza, cumpleaños)',
      },
    },
    required: ['date', 'time', 'partySize', 'customerName', 'customerPhone'],
  },

  requiredCapabilities: ['reservations'],
  requiresConfirmation: true,
  enabledFor: ['rest_basic', 'rest_standard', 'rest_complete'],
  timeout: 15000,

  // Note: confirmationTemplate removed - confirmationMessage provides dynamic formatting
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

  handler: async (params, context): Promise<BookingResult> => {
    const {
      date,
      time,
      partySize,
      customerName,
      customerPhone,
      customerEmail,
      specialRequests,
    } = params;
    const { supabase, tenantId, branchId, callId, channel, locale } = context;

    try {
      // Generate confirmation code
      const confirmationCode = generateConfirmationCode();

      // Try to use atomic RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'create_reservation_atomic',
        {
          p_tenant_id: tenantId,
          p_branch_id: branchId || null,
          p_date: date,
          p_time: time,
          p_party_size: partySize,
          p_customer_name: customerName,
          p_customer_phone: normalizePhone(customerPhone),
          p_customer_email: customerEmail || null,
          p_special_requests: specialRequests || null,
          p_confirmation_code: confirmationCode,
          p_source: channel,
          p_source_call_id: callId,
        }
      );

      if (!rpcError && rpcData) {
        return formatSuccessResult(
          rpcData.reservation_id || rpcData.id,
          rpcData.confirmation_code || confirmationCode,
          date,
          time,
          partySize,
          customerName,
          locale
        );
      }

      // Fallback to direct insert if RPC doesn't exist
      console.warn('[CreateReservation] RPC not available, using direct insert');

      const { data: insertData, error: insertError } = await supabase
        .from('reservations')
        .insert({
          tenant_id: tenantId,
          branch_id: branchId || null,
          date,
          time,
          party_size: partySize,
          customer_name: customerName,
          customer_phone: normalizePhone(customerPhone),
          customer_email: customerEmail || null,
          special_requests: specialRequests || null,
          confirmation_code: confirmationCode,
          status: 'confirmed',
          source: channel,
          source_call_id: callId,
          created_at: new Date().toISOString(),
        })
        .select('id, confirmation_code')
        .single();

      if (insertError) {
        console.error('[CreateReservation] Insert error:', insertError);

        // Check for common errors
        if (insertError.message?.includes('duplicate')) {
          return {
            success: false,
            error: 'Duplicate reservation',
            errorCode: 'DUPLICATE',
            voiceMessage: locale === 'en'
              ? 'It looks like a reservation already exists for this time. Would you like to modify it instead?'
              : 'Parece que ya existe una reservación para este horario. ¿Le gustaría modificarla?',
          };
        }

        if (insertError.message?.includes('capacity')) {
          return {
            success: false,
            error: 'No capacity available',
            errorCode: 'NO_CAPACITY',
            voiceMessage: locale === 'en'
              ? 'Sorry, that time slot just filled up. Would you like to try a different time?'
              : 'Lo siento, ese horario acaba de llenarse. ¿Le gustaría probar otro horario?',
          };
        }

        return {
          success: false,
          error: insertError.message,
          errorCode: 'INSERT_ERROR',
          voiceMessage: locale === 'en'
            ? 'There was a problem creating the reservation. Please try again.'
            : 'Hubo un problema al crear la reservación. Por favor intente de nuevo.',
        };
      }

      return formatSuccessResult(
        insertData.id,
        insertData.confirmation_code,
        date,
        time,
        partySize,
        customerName,
        locale
      );
    } catch (error) {
      console.error('[CreateReservation] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't complete the reservation. Please try again."
          : 'Lo siento, no pude completar la reservación. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// MODIFY RESERVATION TOOL
// =====================================================

export const modifyReservation: ToolDefinition = {
  name: 'modify_reservation',
  description: 'Modifica una reservación existente',
  category: 'booking',

  parameters: {
    type: 'object',
    properties: {
      confirmationCode: {
        type: 'string',
        description: 'Código de confirmación de la reservación',
      },
      customerPhone: {
        type: 'string',
        description: 'Teléfono del cliente (para identificar reservación)',
      },
      newDate: {
        type: 'string',
        format: 'date',
        description: 'Nueva fecha (si cambia)',
      },
      newTime: {
        type: 'string',
        description: 'Nueva hora (si cambia)',
      },
      newPartySize: {
        type: 'integer',
        description: 'Nuevo número de personas (si cambia)',
        minimum: 1,
        maximum: 20,
      },
      newSpecialRequests: {
        type: 'string',
        description: 'Nuevas solicitudes especiales',
      },
    },
    required: [],
  },

  requiredCapabilities: ['reservations'],
  requiresConfirmation: true,
  enabledFor: ['rest_basic', 'rest_standard', 'rest_complete'],
  timeout: 15000,

  confirmationMessage: (params) => {
    const changes: string[] = [];

    if (params.newDate) {
      changes.push(`fecha: ${formatDateForVoice(params.newDate as string, 'es')}`);
    }
    if (params.newTime) {
      changes.push(`hora: ${formatTimeForVoice(params.newTime as string, 'es')}`);
    }
    if (params.newPartySize) {
      changes.push(`personas: ${params.newPartySize}`);
    }

    if (changes.length === 0) {
      return '¿Confirma que desea modificar la reservación?';
    }

    return `Voy a cambiar ${changes.join(', ')}. ¿Confirma los cambios?`;
  },

  handler: async (params, context): Promise<BookingResult> => {
    const { confirmationCode, customerPhone, newDate, newTime, newPartySize, newSpecialRequests } = params;
    const { supabase, tenantId, locale } = context;

    try {
      // Find the reservation
      let query = supabase
        .from('reservations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'confirmed');

      if (confirmationCode) {
        query = query.eq('confirmation_code', confirmationCode);
      } else if (customerPhone) {
        query = query.eq('customer_phone', normalizePhone(customerPhone as string));
      } else {
        return {
          success: false,
          error: 'Missing identifier',
          voiceMessage: locale === 'en'
            ? 'I need your confirmation code or phone number to find your reservation.'
            : 'Necesito su código de confirmación o número de teléfono para encontrar su reservación.',
        };
      }

      const { data: reservation, error: findError } = await query.single();

      if (findError || !reservation) {
        return {
          success: false,
          error: 'Reservation not found',
          voiceMessage: locale === 'en'
            ? "I couldn't find a reservation with that information. Could you verify the details?"
            : 'No pude encontrar una reservación con esos datos. ¿Podría verificar la información?',
        };
      }

      // Build update object
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (newDate) updates.date = newDate;
      if (newTime) updates.time = newTime;
      if (newPartySize) updates.party_size = newPartySize;
      if (newSpecialRequests !== undefined) updates.special_requests = newSpecialRequests;

      // Update reservation
      const { error: updateError } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', reservation.id);

      if (updateError) {
        console.error('[ModifyReservation] Update error:', updateError);
        return {
          success: false,
          error: updateError.message,
          voiceMessage: locale === 'en'
            ? 'There was a problem updating your reservation. Please try again.'
            : 'Hubo un problema al actualizar su reservación. Por favor intente de nuevo.',
        };
      }

      const finalDate = (newDate as string) || reservation.date;
      const finalTime = (newTime as string) || reservation.time;
      const dateStr = formatDateForVoice(finalDate, locale);
      const timeStr = formatTimeForVoice(finalTime, locale);

      return {
        success: true,
        voiceMessage: locale === 'en'
          ? `Your reservation has been updated. It's now for ${dateStr} at ${timeStr}. Your confirmation code remains ${reservation.confirmation_code}.`
          : `Su reservación ha sido actualizada. Ahora es para el ${dateStr} a las ${timeStr}. Su código de confirmación sigue siendo ${reservation.confirmation_code}.`,
        data: {
          reservationId: reservation.id,
          confirmationCode: reservation.confirmation_code,
          dateTime: `${finalDate} ${finalTime}`,
        },
      };
    } catch (error) {
      console.error('[ModifyReservation] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't modify the reservation. Please try again."
          : 'Lo siento, no pude modificar la reservación. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// CANCEL RESERVATION TOOL
// =====================================================

export const cancelReservation: ToolDefinition = {
  name: 'cancel_reservation',
  description: 'Cancela una reservación existente',
  category: 'booking',

  parameters: {
    type: 'object',
    properties: {
      confirmationCode: {
        type: 'string',
        description: 'Código de confirmación de la reservación',
      },
      customerPhone: {
        type: 'string',
        description: 'Teléfono del cliente',
      },
      reason: {
        type: 'string',
        description: 'Motivo de la cancelación (opcional)',
      },
    },
    required: [],
  },

  requiredCapabilities: ['reservations'],
  requiresConfirmation: true,
  enabledFor: ['rest_basic', 'rest_standard', 'rest_complete'],
  timeout: 10000,

  confirmationTemplate: '¿Está seguro que desea cancelar su reservación?',

  handler: async (params, context): Promise<BookingResult> => {
    const { confirmationCode, customerPhone, reason } = params;
    const { supabase, tenantId, locale } = context;

    try {
      // Find the reservation
      let query = supabase
        .from('reservations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'confirmed');

      if (confirmationCode) {
        query = query.eq('confirmation_code', confirmationCode);
      } else if (customerPhone) {
        query = query.eq('customer_phone', normalizePhone(customerPhone as string));
      } else {
        return {
          success: false,
          error: 'Missing identifier',
          voiceMessage: locale === 'en'
            ? 'I need your confirmation code or phone number to find your reservation.'
            : 'Necesito su código de confirmación o número de teléfono para encontrar su reservación.',
        };
      }

      const { data: reservation, error: findError } = await query.single();

      if (findError || !reservation) {
        return {
          success: false,
          error: 'Reservation not found',
          voiceMessage: locale === 'en'
            ? "I couldn't find a reservation to cancel. Could you verify the details?"
            : 'No pude encontrar una reservación para cancelar. ¿Podría verificar la información?',
        };
      }

      // Cancel reservation
      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          status: 'cancelled',
          cancellation_reason: reason as string || null,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', reservation.id);

      if (updateError) {
        console.error('[CancelReservation] Update error:', updateError);
        return {
          success: false,
          error: updateError.message,
          voiceMessage: locale === 'en'
            ? 'There was a problem cancelling your reservation. Please try again.'
            : 'Hubo un problema al cancelar su reservación. Por favor intente de nuevo.',
        };
      }

      return {
        success: true,
        voiceMessage: locale === 'en'
          ? 'Your reservation has been cancelled. We hope to see you another time!'
          : 'Su reservación ha sido cancelada. ¡Esperamos verlo en otra ocasión!',
        data: {
          reservationId: reservation.id,
          confirmationCode: reservation.confirmation_code,
        },
      };
    } catch (error) {
      console.error('[CancelReservation] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't cancel the reservation. Please try again."
          : 'Lo siento, no pude cancelar la reservación. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate a unique confirmation code
 */
function generateConfirmationCode(): string {
  const prefix = 'RES';
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `${prefix}-${timestamp}${random}`;
}

/**
 * Normalize phone number
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Format success result
 */
function formatSuccessResult(
  reservationId: string,
  confirmationCode: string,
  date: string,
  time: string,
  partySize: number,
  customerName: string,
  locale: string
): BookingResult {
  const dateStr = formatDateForVoice(date, locale);
  const timeStr = formatTimeForVoice(time, locale);
  const codeStr = formatConfirmationCodeForVoice(confirmationCode, locale);

  const voiceMessage = locale === 'en'
    ? `Your reservation is confirmed for ${dateStr} at ${timeStr}. Your confirmation code is ${codeStr}. We'll see you then, ${customerName}!`
    : `Su reservación está confirmada para el ${dateStr} a las ${timeStr}. Su código de confirmación es ${codeStr}. ¡Lo esperamos, ${customerName}!`;

  return {
    success: true,
    voiceMessage,
    data: {
      reservationId,
      confirmationCode,
      dateTime: `${date} ${time}`,
    },
    forwardToClient: true,
    metadata: {
      customerName,
      partySize,
    },
  };
}

export default createReservation;

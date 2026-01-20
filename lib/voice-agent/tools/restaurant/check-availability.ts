/**
 * TIS TIS Platform - Voice Agent v2.0
 * Restaurant Tool: Check Availability
 *
 * Verifies availability for a reservation at a specific date/time.
 * Returns available slots or alternatives if not available.
 */

import type {
  ToolDefinition,
  ToolContext,
  AvailabilityResult,
  CheckAvailabilityParams,
} from '../types';
import {
  formatDateForVoice,
  formatTimeForVoice,
  formatSlotsForVoice,
  formatPartySizeForVoice,
} from '../formatters';

// =====================================================
// TOOL DEFINITION
// =====================================================

export const checkAvailabilityRestaurant: ToolDefinition<CheckAvailabilityParams> = {
  name: 'check_availability',
  description: 'Verifica disponibilidad para reservación en restaurante',
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
        description: 'Hora preferida (HH:MM en formato 24h)',
      },
      partySize: {
        type: 'integer',
        description: 'Número de personas',
        minimum: 1,
        maximum: 20,
      },
      durationMinutes: {
        type: 'integer',
        description: 'Duración estimada en minutos',
        default: 90,
      },
    },
    required: ['date', 'time', 'partySize'],
  },

  requiredCapabilities: ['reservations'],
  requiresConfirmation: false,
  enabledFor: ['rest_basic', 'rest_standard', 'rest_complete'],
  timeout: 10000,

  handler: async (params, context): Promise<AvailabilityResult> => {
    const { date, time = '12:00', partySize = 2, durationMinutes = 90 } = params;
    const { supabase, tenantId, branchId, locale } = context;

    try {
      // Validate date is not in the past
      const requestedDate = new Date(date + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (requestedDate < today) {
        return {
          success: false,
          error: 'Past date',
          voiceMessage: locale === 'en'
            ? 'Sorry, that date has already passed. Please choose a future date.'
            : 'Lo siento, esa fecha ya pasó. Por favor elija una fecha futura.',
          data: {
            available: false,
          },
        };
      }

      // Call the availability check RPC
      const { data, error } = await supabase.rpc('check_reservation_availability', {
        p_tenant_id: tenantId,
        p_branch_id: branchId || null,
        p_date: date,
        p_time: time,
        p_party_size: partySize,
        p_duration_minutes: durationMinutes,
      });

      if (error) {
        console.error('[CheckAvailability] RPC error:', error);

        // Fallback to simple table query
        return await checkAvailabilityFallback(
          supabase,
          tenantId,
          branchId,
          date,
          time,
          partySize,
          locale
        );
      }

      // RPC returns { available, alternative_slots, capacity_info }
      const available = data?.available ?? false;
      const alternativeSlots = data?.alternative_slots || [];

      // Format voice response
      let voiceMessage: string;

      if (available) {
        voiceMessage = formatAvailableMessage(date, time, partySize, locale);
      } else if (alternativeSlots.length > 0) {
        voiceMessage = formatAlternativesMessage(
          date,
          time,
          partySize,
          alternativeSlots,
          locale
        );
      } else {
        voiceMessage = formatUnavailableMessage(date, locale);
      }

      return {
        success: true,
        voiceMessage,
        data: {
          available,
          requestedSlot: { date, time },
          alternativeSlots,
          nextAvailable: alternativeSlots[0] || undefined,
        },
      };
    } catch (error) {
      console.error('[CheckAvailability] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm having trouble checking availability right now. Please try again."
          : 'Tengo problemas para verificar la disponibilidad. Por favor intente de nuevo.',
        data: {
          available: false,
        },
      };
    }
  },
};

// =====================================================
// FALLBACK FUNCTION
// =====================================================

/**
 * Fallback availability check when RPC is not available
 */
async function checkAvailabilityFallback(
  supabase: ToolContext['supabase'],
  tenantId: string,
  branchId: string | undefined,
  date: string,
  time: string,
  partySize: number,
  locale: string
): Promise<AvailabilityResult> {
  try {
    // Get business configuration
    const { data: config } = await supabase
      .from('voice_configs')
      .select('business_config')
      .eq('tenant_id', tenantId)
      .single();

    const businessConfig = config?.business_config || {};
    const maxCapacity = businessConfig.max_party_size || 50;
    const operatingHours = businessConfig.operating_hours || {};

    // Check if date is in the future
    const requestedDate = new Date(date + 'T' + time);
    const now = new Date();

    if (requestedDate < now) {
      return {
        success: true,
        voiceMessage: locale === 'en'
          ? "That time has already passed. Would you like to book for a future date?"
          : 'Ese horario ya pasó. ¿Le gustaría reservar para otra fecha?',
        data: {
          available: false,
          requestedSlot: { date, time },
          alternativeSlots: [],
        },
      };
    }

    // Check capacity
    if (partySize > maxCapacity) {
      return {
        success: true,
        voiceMessage: locale === 'en'
          ? `I'm sorry, we can only accommodate groups of up to ${maxCapacity} people. For larger groups, please contact us directly.`
          : `Lo siento, solo podemos acomodar grupos de hasta ${maxCapacity} personas. Para grupos más grandes, por favor contáctenos directamente.`,
        data: {
          available: false,
          requestedSlot: { date, time },
        },
      };
    }

    // Count existing reservations for that time slot
    let query = supabase
      .from('reservations')
      .select('party_size', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .eq('status', 'confirmed');

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    // Check within a time window (1 hour before/after)
    const [hours, minutes] = time.split(':').map(Number);
    const startTime = `${String(Math.max(0, hours - 1)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const endTime = `${String(Math.min(23, hours + 1)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    query = query.gte('time', startTime).lte('time', endTime);

    const { data: reservations, count, error } = await query;

    if (error) {
      console.error('[CheckAvailability] Query error:', error);
    }

    // Simple availability logic - assume available if less than threshold
    const currentOccupancy = reservations?.reduce((sum, r) => sum + (r.party_size || 0), 0) || 0;
    const available = currentOccupancy + partySize <= maxCapacity * 0.8; // 80% threshold

    // Generate alternative slots
    const alternativeSlots: string[] = [];
    if (!available) {
      // Suggest times 1-2 hours before/after
      const alternatives = [
        `${String(Math.max(11, hours - 2)).padStart(2, '0')}:00`,
        `${String(Math.max(11, hours - 1)).padStart(2, '0')}:00`,
        `${String(Math.min(21, hours + 1)).padStart(2, '0')}:00`,
        `${String(Math.min(21, hours + 2)).padStart(2, '0')}:00`,
      ];

      for (const alt of alternatives) {
        if (alt !== time) {
          alternativeSlots.push(alt);
        }
      }
    }

    let voiceMessage: string;
    if (available) {
      voiceMessage = formatAvailableMessage(date, time, partySize, locale);
    } else if (alternativeSlots.length > 0) {
      voiceMessage = formatAlternativesMessage(date, time, partySize, alternativeSlots, locale);
    } else {
      voiceMessage = formatUnavailableMessage(date, locale);
    }

    return {
      success: true,
      voiceMessage,
      data: {
        available,
        requestedSlot: { date, time },
        alternativeSlots,
      },
    };
  } catch (error) {
    console.error('[CheckAvailability] Fallback error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      voiceMessage: locale === 'en'
        ? "I couldn't check availability. Please try again."
        : 'No pude verificar la disponibilidad. Por favor intente de nuevo.',
      data: {
        available: false,
      },
    };
  }
}

// =====================================================
// MESSAGE FORMATTERS
// =====================================================

/**
 * Format message when slot is available
 */
function formatAvailableMessage(
  date: string,
  time: string,
  partySize: number,
  locale: string
): string {
  const dateStr = formatDateForVoice(date, locale);
  const timeStr = formatTimeForVoice(time, locale);
  const sizeStr = formatPartySizeForVoice(partySize, locale);

  if (locale === 'en') {
    return `Great news! I have availability for ${sizeStr} on ${dateStr} at ${timeStr}. Would you like me to make the reservation?`;
  }

  return `¡Excelente! Tengo disponibilidad para ${sizeStr} el ${dateStr} a las ${timeStr}. ¿Le gustaría que hiciera la reservación?`;
}

/**
 * Format message when slot is not available but alternatives exist
 */
function formatAlternativesMessage(
  date: string,
  time: string,
  partySize: number,
  alternatives: string[],
  locale: string
): string {
  const dateStr = formatDateForVoice(date, locale);
  const timeStr = formatTimeForVoice(time, locale);
  const slotsStr = formatSlotsForVoice(alternatives, { locale, maxSlots: 3 });

  if (locale === 'en') {
    return `I'm sorry, ${timeStr} on ${dateStr} is not available. However, I have availability at ${slotsStr}. Would any of those times work for you?`;
  }

  return `Lo siento, a las ${timeStr} el ${dateStr} no está disponible. Sin embargo, tengo disponibilidad a las ${slotsStr}. ¿Le funcionaría alguno de esos horarios?`;
}

/**
 * Format message when no availability
 */
function formatUnavailableMessage(date: string, locale: string): string {
  const dateStr = formatDateForVoice(date, locale);

  if (locale === 'en') {
    return `I'm sorry, we don't have availability on ${dateStr}. Would you like to try a different date?`;
  }

  return `Lo siento, no tenemos disponibilidad el ${dateStr}. ¿Le gustaría probar con otra fecha?`;
}

export default checkAvailabilityRestaurant;

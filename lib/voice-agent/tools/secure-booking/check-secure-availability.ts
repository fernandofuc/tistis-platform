/**
 * TIS TIS Platform - Voice Agent v2.2
 * Secure Booking Tool: Check Secure Availability
 *
 * Checks slot availability considering both existing bookings
 * AND active holds. Provides accurate real-time availability.
 */

import type {
  ToolDefinition,
  ToolContext,
  CheckSecureAvailabilityParams,
  SecureAvailabilityResult,
} from '../types';
import {
  formatDateForVoice,
  formatTimeForVoice,
} from '../formatters';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Calculate end datetime
 */
function calculateEndDatetime(date: string, time: string, durationMinutes: number): Date {
  const startDateTime = new Date(`${date}T${time}`);
  return new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
}

/**
 * Format time from Date to HH:MM
 */
function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

// =====================================================
// TOOL DEFINITION
// =====================================================

export const checkSecureAvailability: ToolDefinition<CheckSecureAvailabilityParams> = {
  name: 'check_secure_availability',
  description: 'Verifica la disponibilidad de un horario considerando reservaciones y holds activos',
  category: 'secure_booking',

  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        format: 'date',
        description: 'Fecha a verificar (YYYY-MM-DD)',
      },
      time: {
        type: 'string',
        description: 'Hora a verificar (HH:MM)',
      },
      durationMinutes: {
        type: 'integer',
        description: 'Duración necesaria en minutos',
        minimum: 5,
        maximum: 480,
        default: 30,
      },
      partySize: {
        type: 'integer',
        description: 'Número de personas (para reservaciones)',
        minimum: 1,
        maximum: 50,
      },
      serviceType: {
        type: 'string',
        description: 'Tipo de servicio (para citas)',
      },
      staffId: {
        type: 'string',
        description: 'ID del staff/doctor específico',
      },
      includeAlternatives: {
        type: 'boolean',
        description: 'Incluir horarios alternativos si no está disponible',
        default: true,
      },
    },
    required: ['date'],
  },

  requiredCapabilities: ['secure_booking'],
  requiresConfirmation: false,
  enabledFor: ['dental_basic', 'dental_standard', 'dental_complete', 'rest_basic', 'rest_standard', 'rest_complete'],
  timeout: 10000,

  handler: async (params, context): Promise<SecureAvailabilityResult> => {
    const {
      date,
      time,
      durationMinutes = 30,
      partySize,
      serviceType,
      staffId,
      includeAlternatives = true,
    } = params;
    const { supabase, tenantId, branchId, locale } = context;

    try {
      // Validate date is not in the past
      const checkDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (checkDate < today) {
        return {
          success: false,
          error: 'Date in past',
          voiceMessage: locale === 'en'
            ? 'That date has already passed. Please choose a future date.'
            : 'Esa fecha ya pasó. Por favor elija una fecha futura.',
          data: {
            available: false,
            unavailableReason: 'outside_hours',
          },
        };
      }

      // If no specific time, return available times for the day
      if (!time) {
        const alternativeSlots = await findAvailableSlots(
          supabase,
          tenantId,
          branchId,
          date,
          durationMinutes,
          staffId,
          8 // Get up to 8 alternatives
        );

        if (alternativeSlots.length === 0) {
          return {
            success: true,
            voiceMessage: locale === 'en'
              ? `I'm sorry, there are no available times for ${formatDateForVoice(date, 'en')}. Would you like to check another date?`
              : `Lo siento, no hay horarios disponibles para el ${formatDateForVoice(date, 'es')}. ¿Le gustaría verificar otra fecha?`,
            data: {
              available: false,
              unavailableReason: 'no_capacity',
              alternativeSlots: [],
            },
          };
        }

        const timesStr = alternativeSlots
          .slice(0, 4)
          .map(s => formatTimeForVoice(s.time, locale))
          .join(', ');

        return {
          success: true,
          voiceMessage: locale === 'en'
            ? `For ${formatDateForVoice(date, 'en')}, I have these times available: ${timesStr}. Which one would you prefer?`
            : `Para el ${formatDateForVoice(date, 'es')}, tengo estos horarios disponibles: ${timesStr}. ¿Cuál prefiere?`,
          data: {
            available: true,
            alternativeSlots,
          },
        };
      }

      // Check specific time slot
      const slotStart = new Date(`${date}T${time}`);
      const slotEnd = calculateEndDatetime(date, time, durationMinutes);

      // Validate time is in the future
      if (slotStart <= new Date()) {
        return {
          success: true,
          voiceMessage: locale === 'en'
            ? 'That time has already passed. Would you like to check a later time?'
            : 'Esa hora ya pasó. ¿Le gustaría verificar un horario más tarde?',
          data: {
            available: false,
            unavailableReason: 'outside_hours',
            requestedSlot: { date, time, durationMinutes },
          },
        };
      }

      // Check for active holds
      const { data: activeHolds, error: holdsError } = await supabase
        .from('booking_holds')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .lte('slot_datetime', slotEnd.toISOString())
        .gte('end_datetime', slotStart.toISOString());

      if (holdsError) {
        console.error('[CheckSecureAvailability] Holds query error:', holdsError);
      }

      if (activeHolds && activeHolds.length > 0) {
        // Slot is held
        if (includeAlternatives) {
          const alternatives = await findAvailableSlots(
            supabase,
            tenantId,
            branchId,
            date,
            durationMinutes,
            staffId,
            4
          );

          const altStr = alternatives.length > 0
            ? alternatives.slice(0, 3).map(s => formatTimeForVoice(s.time, locale)).join(', ')
            : '';

          return {
            success: true,
            voiceMessage: locale === 'en'
              ? `That time is currently being held by someone else.${altStr ? ` How about ${altStr}?` : ' Would you like to try a different time?'}`
              : `Ese horario está siendo reservado por otra persona.${altStr ? ` ¿Qué tal ${altStr}?` : ' ¿Le gustaría probar otro horario?'}`,
            data: {
              available: false,
              unavailableReason: 'held',
              requestedSlot: { date, time, durationMinutes },
              alternativeSlots: alternatives,
              activeHoldsCount: activeHolds.length,
            },
          };
        }

        return {
          success: true,
          voiceMessage: locale === 'en'
            ? 'That time is currently being held by someone else. Would you like to try a different time?'
            : 'Ese horario está siendo reservado por otra persona. ¿Le gustaría probar otro horario?',
          data: {
            available: false,
            unavailableReason: 'held',
            requestedSlot: { date, time, durationMinutes },
            activeHoldsCount: activeHolds.length,
          },
        };
      }

      // Check for existing appointments (depends on vertical)
      const { data: tenant } = await supabase
        .from('tenants')
        .select('vertical')
        .eq('id', tenantId)
        .single();

      const isRestaurant = tenant?.vertical === 'restaurant';

      if (isRestaurant) {
        // Check reservations
        const { data: reservations } = await supabase
          .from('reservations')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('date', date)
          .not('status', 'in', '("cancelled")')
          .limit(50); // Check capacity

        // For restaurants, check if there's capacity (simplified)
        // In production, this would check table capacity
        const hasCapacity = !reservations || reservations.length < 20;

        if (!hasCapacity) {
          const alternatives = includeAlternatives
            ? await findAvailableSlots(supabase, tenantId, branchId, date, durationMinutes, staffId, 4)
            : [];

          return {
            success: true,
            voiceMessage: locale === 'en'
              ? 'We\'re fully booked at that time. Would you like to try a different time?'
              : 'Estamos llenos a esa hora. ¿Le gustaría probar otro horario?',
            data: {
              available: false,
              unavailableReason: 'no_capacity',
              requestedSlot: { date, time, durationMinutes },
              alternativeSlots: alternatives,
            },
          };
        }
      } else {
        // Check appointments
        let appointmentQuery = supabase
          .from('appointments')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('date', date)
          .not('status', 'in', '("cancelled","no_show")');

        if (staffId) {
          appointmentQuery = appointmentQuery.eq('doctor_id', staffId);
        }

        if (branchId) {
          appointmentQuery = appointmentQuery.eq('branch_id', branchId);
        }

        const { data: appointments } = await appointmentQuery;

        // Check for time overlap with existing appointments
        if (appointments && appointments.length > 0) {
          // Get full appointment details to check time overlap
          const { data: appointmentDetails } = await supabase
            .from('appointments')
            .select('id, start_time, end_time')
            .eq('tenant_id', tenantId)
            .eq('date', date)
            .not('status', 'in', '("cancelled","no_show")');

          const hasOverlap = (appointmentDetails || []).some((appt) => {
            if (!appt.start_time || !appt.end_time) return false;
            const apptStart = new Date(`${date}T${appt.start_time}`);
            const apptEnd = new Date(`${date}T${appt.end_time}`);
            // Check if slots overlap
            return slotStart < apptEnd && slotEnd > apptStart;
          });

          if (hasOverlap) {
            const alternatives = includeAlternatives
              ? await findAvailableSlots(supabase, tenantId, branchId, date, durationMinutes, staffId, 4)
              : [];

            return {
              success: true,
              voiceMessage: locale === 'en'
                ? 'That time slot is already booked. Would you like to try a different time?'
                : 'Ese horario ya está reservado. ¿Le gustaría probar otro horario?',
              data: {
                available: false,
                unavailableReason: 'booked',
                requestedSlot: { date, time, durationMinutes },
                alternativeSlots: alternatives,
              },
            };
          }
        }
      }

      // Slot is available
      const dateStr = formatDateForVoice(date, locale);
      const timeStr = formatTimeForVoice(time, locale);

      return {
        success: true,
        voiceMessage: locale === 'en'
          ? `Yes, ${dateStr} at ${timeStr} is available. Would you like me to book that for you?`
          : `Sí, el ${dateStr} a las ${timeStr} está disponible. ¿Le gustaría que lo reserve?`,
        data: {
          available: true,
          requestedSlot: { date, time, durationMinutes },
        },
      };
    } catch (error) {
      console.error('[CheckSecureAvailability] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? 'There was an issue checking availability. Please try again.'
          : 'Hubo un problema al verificar disponibilidad. Por favor intente de nuevo.',
        data: {
          available: false,
        },
      };
    }
  },
};

// =====================================================
// HELPER: Find Available Slots
// =====================================================

async function findAvailableSlots(
  supabase: ToolContext['supabase'],
  tenantId: string,
  branchId: string | undefined,
  date: string,
  durationMinutes: number,
  staffId: string | undefined,
  limit: number
): Promise<Array<{ date: string; time: string; staffId?: string; staffName?: string }>> {
  try {
    // Get business hours for the day
    const dayOfWeek = new Date(date).getDay();
    const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = daysMap[dayOfWeek];

    // Get branch hours - query first available branch if branchId not provided
    let branchQuery = supabase
      .from('branches')
      .select('business_hours')
      .eq('tenant_id', tenantId);

    if (branchId) {
      branchQuery = branchQuery.eq('id', branchId);
    } else {
      branchQuery = branchQuery.eq('is_default', true);
    }

    const { data: branch } = await branchQuery.limit(1).single();

    // Default hours
    let openTime = '09:00';
    let closeTime = '18:00';

    if (branch?.business_hours?.[dayName]) {
      const dayHours = branch.business_hours[dayName];
      if (dayHours.open && dayHours.close) {
        openTime = dayHours.open;
        closeTime = dayHours.close;
      }
    }

    // Generate time slots
    const slotInterval = 30; // 30-minute intervals

    let currentTime = new Date(`${date}T${openTime}`);
    const businessEndTime = new Date(`${date}T${closeTime}`);
    const now = new Date();

    // Generate all potential slots first
    const potentialSlots: Array<{ date: string; time: string; start: Date; end: Date }> = [];

    while (currentTime < businessEndTime && potentialSlots.length < limit * 3) {
      if (currentTime > now) {
        const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);
        potentialSlots.push({
          date,
          time: formatTime(currentTime),
          start: new Date(currentTime),
          end: slotEnd,
        });
      }
      currentTime = new Date(currentTime.getTime() + slotInterval * 60 * 1000);
    }

    if (potentialSlots.length === 0) {
      return [];
    }

    // Batch query: Get all active holds for the day in one query
    const dayStart = new Date(`${date}T${openTime}`);
    const dayEnd = new Date(`${date}T${closeTime}`);

    const { data: allHolds } = await supabase
      .from('booking_holds')
      .select('slot_datetime, end_datetime')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .gte('slot_datetime', dayStart.toISOString())
      .lte('slot_datetime', dayEnd.toISOString());

    // Filter out slots that conflict with holds
    const availableSlots = potentialSlots.filter((slot) => {
      const hasConflict = (allHolds || []).some((hold) => {
        const holdStart = new Date(hold.slot_datetime);
        const holdEnd = new Date(hold.end_datetime);
        // Check overlap: slot overlaps if it starts before hold ends AND ends after hold starts
        return slot.start < holdEnd && slot.end > holdStart;
      });
      return !hasConflict;
    });

    return availableSlots.slice(0, limit).map(({ date, time }) => ({ date, time }));
  } catch (error) {
    console.error('[findAvailableSlots] Error:', error);
    return [];
  }
}

export default checkSecureAvailability;

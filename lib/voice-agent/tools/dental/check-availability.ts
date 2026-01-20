/**
 * TIS TIS Platform - Voice Agent v2.0
 * Dental Tool: Check Availability
 *
 * Checks appointment availability for dental services.
 * Considers doctor availability, service duration, and specialty.
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
} from '../formatters';

// =====================================================
// TOOL DEFINITION
// =====================================================

export const checkAvailability: ToolDefinition<CheckAvailabilityParams> = {
  name: 'check_availability',
  description: 'Verifica disponibilidad de citas para servicios dentales',
  category: 'appointment',

  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Fecha deseada (YYYY-MM-DD)',
      },
      time: {
        type: 'string',
        description: 'Hora preferida (HH:MM)',
      },
      serviceType: {
        type: 'string',
        description: 'Tipo de servicio (limpieza, consulta, extraccion, etc.)',
      },
      doctorId: {
        type: 'string',
        description: 'ID del doctor preferido (opcional)',
      },
      specialty: {
        type: 'string',
        description: 'Especialidad requerida (ortodoncia, endodoncia, etc.)',
      },
    },
    required: ['date'],
  },

  requiredCapabilities: ['appointments'],
  requiresConfirmation: false,
  enabledFor: ['dental_basic', 'dental_standard', 'dental_complete'],
  timeout: 10000,

  handler: async (params, context): Promise<AvailabilityResult> => {
    const { date, time, serviceType, doctorId, specialty } = params;
    const { supabase, tenantId, branchId, locale } = context;

    try {
      // Validate date is not in the past
      const requestedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (requestedDate < today) {
        return {
          success: false,
          error: 'Date in past',
          voiceMessage: locale === 'en'
            ? 'That date has already passed. Would you like to check another date?'
            : 'Esa fecha ya pasó. ¿Le gustaría consultar otra fecha?',
        };
      }

      // Get service duration if service type provided
      let serviceDuration = 30; // default 30 minutes
      if (serviceType) {
        const { data: service } = await supabase
          .from('services')
          .select('duration_minutes')
          .eq('tenant_id', tenantId)
          .ilike('name', `%${serviceType}%`)
          .single();

        if (service?.duration_minutes) {
          serviceDuration = service.duration_minutes;
        }
      }

      // Try RPC function first for optimized query
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('check_dental_availability', {
          p_tenant_id: tenantId,
          p_branch_id: branchId || null,
          p_date: date,
          p_time: time || null,
          p_duration_minutes: serviceDuration,
          p_doctor_id: doctorId || null,
          p_specialty: specialty || null,
        });

      if (!rpcError && rpcResult) {
        return formatAvailabilityResponse(rpcResult, date, time, locale);
      }

      // Fallback: Direct query approach
      console.warn('[CheckAvailability] RPC failed, using fallback:', rpcError);

      // Get doctors for this tenant (optionally filtered by specialty)
      let doctorQuery = supabase
        .from('doctors')
        .select('id, name, specialty, schedule')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (branchId) {
        doctorQuery = doctorQuery.eq('branch_id', branchId);
      }

      if (doctorId) {
        doctorQuery = doctorQuery.eq('id', doctorId);
      }

      if (specialty) {
        doctorQuery = doctorQuery.ilike('specialty', `%${specialty}%`);
      }

      const { data: doctors, error: doctorError } = await doctorQuery;

      if (doctorError || !doctors || doctors.length === 0) {
        return {
          success: false,
          error: 'No doctors available',
          voiceMessage: locale === 'en'
            ? 'I could not find any available doctors for that date. Would you like to try a different date?'
            : 'No encontré doctores disponibles para esa fecha. ¿Le gustaría probar otra fecha?',
        };
      }

      // Get existing appointments for the date
      const { data: existingAppointments } = await supabase
        .from('appointments')
        .select('doctor_id, start_time, end_time')
        .eq('tenant_id', tenantId)
        .eq('date', date)
        .not('status', 'in', '("cancelled","no_show")');

      // Calculate available slots for each doctor
      const dayOfWeek = requestedDate.getDay();
      const availableSlots: Array<{
        time: string;
        doctorId: string;
        doctorName: string;
      }> = [];

      for (const doctor of doctors) {
        const schedule = doctor.schedule as Record<string, { start: string; end: string }> | null;
        const daySchedule = schedule?.[dayOfWeek.toString()];

        if (!daySchedule) continue; // Doctor doesn't work this day

        // Get doctor's appointments for the day
        const doctorAppointments = existingAppointments?.filter(
          apt => apt.doctor_id === doctor.id
        ) || [];

        // Generate available time slots
        const slots = generateTimeSlots(
          daySchedule.start,
          daySchedule.end,
          serviceDuration,
          doctorAppointments,
          time
        );

        for (const slot of slots) {
          availableSlots.push({
            time: slot,
            doctorId: doctor.id,
            doctorName: doctor.name,
          });
        }
      }

      // Sort by time
      availableSlots.sort((a, b) => a.time.localeCompare(b.time));

      // Check if specific time is available
      if (time) {
        const exactMatch = availableSlots.find(s => s.time === time);
        if (exactMatch) {
          const dateStr = formatDateForVoice(date, locale);
          const timeStr = formatTimeForVoice(time, locale);

          return {
            success: true,
            voiceMessage: locale === 'en'
              ? `Yes, we have availability on ${dateStr} at ${timeStr} with ${exactMatch.doctorName}. Would you like to book this appointment?`
              : `Sí, tenemos disponibilidad el ${dateStr} a las ${timeStr} con ${exactMatch.doctorName}. ¿Le gustaría agendar esta cita?`,
            data: {
              available: true,
              slots: [exactMatch],
              date,
              requestedTime: time,
            },
          };
        }
      }

      // Return available slots
      if (availableSlots.length === 0) {
        // Generate alternative dates
        const alternatives = await findAlternativeDates(
          supabase,
          tenantId,
          branchId,
          date,
          serviceDuration,
          doctorId,
          specialty
        );

        const dateStr = formatDateForVoice(date, locale);

        return {
          success: true,
          voiceMessage: locale === 'en'
            ? `I'm sorry, we don't have availability on ${dateStr}. ${alternatives}`
            : `Lo siento, no tenemos disponibilidad el ${dateStr}. ${alternatives}`,
          data: {
            available: false,
            slots: [],
            date,
            requestedTime: time,
          },
        };
      }

      // Format response with available slots
      const dateStr = formatDateForVoice(date, locale);
      const slotsStr = formatSlotsForVoice(
        availableSlots.slice(0, 4).map(s => s.time),
        { locale }
      );

      return {
        success: true,
        voiceMessage: locale === 'en'
          ? `On ${dateStr}, we have appointments available at ${slotsStr}. Which time works best for you?`
          : `El ${dateStr} tenemos citas disponibles a las ${slotsStr}. ¿Cuál horario le conviene mejor?`,
        data: {
          available: true,
          slots: availableSlots.slice(0, 8),
          date,
          requestedTime: time,
        },
      };
    } catch (error) {
      console.error('[CheckAvailability] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm having trouble checking availability. Please try again."
          : 'Tengo problemas para verificar disponibilidad. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Format RPC availability response
 */
function formatAvailabilityResponse(
  rpcResult: {
    available: boolean;
    slots: Array<{ time: string; doctor_id: string; doctor_name: string }>;
    alternatives?: string[];
  },
  date: string,
  requestedTime: string | undefined,
  locale: string
): AvailabilityResult {
  const dateStr = formatDateForVoice(date, locale);

  if (!rpcResult.available || rpcResult.slots.length === 0) {
    const altText = rpcResult.alternatives?.length
      ? (locale === 'en'
        ? `We have availability on ${rpcResult.alternatives.slice(0, 2).join(' or ')}.`
        : `Tenemos disponibilidad el ${rpcResult.alternatives.slice(0, 2).join(' o el ')}.`)
      : (locale === 'en'
        ? 'Would you like to check another date?'
        : '¿Le gustaría consultar otra fecha?');

    return {
      success: true,
      voiceMessage: locale === 'en'
        ? `I'm sorry, we don't have availability on ${dateStr}. ${altText}`
        : `Lo siento, no tenemos disponibilidad el ${dateStr}. ${altText}`,
      data: {
        available: false,
        slots: [],
        date,
        requestedTime,
      },
    };
  }

  // Format slots
  const formattedSlots = rpcResult.slots.map(s => ({
    time: s.time,
    doctorId: s.doctor_id,
    doctorName: s.doctor_name,
  }));

  // Check for exact time match
  if (requestedTime) {
    const exactMatch = formattedSlots.find(s => s.time === requestedTime);
    if (exactMatch) {
      const timeStr = formatTimeForVoice(requestedTime, locale);
      return {
        success: true,
        voiceMessage: locale === 'en'
          ? `Yes, we have availability on ${dateStr} at ${timeStr} with ${exactMatch.doctorName}. Would you like to book this appointment?`
          : `Sí, tenemos disponibilidad el ${dateStr} a las ${timeStr} con ${exactMatch.doctorName}. ¿Le gustaría agendar esta cita?`,
        data: {
          available: true,
          slots: [exactMatch],
          date,
          requestedTime,
        },
      };
    }
  }

  // Return multiple options
  const slotsStr = formatSlotsForVoice(
    formattedSlots.slice(0, 4).map(s => s.time),
    { locale }
  );

  return {
    success: true,
    voiceMessage: locale === 'en'
      ? `On ${dateStr}, we have appointments available at ${slotsStr}. Which time works best for you?`
      : `El ${dateStr} tenemos citas disponibles a las ${slotsStr}. ¿Cuál horario le conviene mejor?`,
    data: {
      available: true,
      slots: formattedSlots.slice(0, 8),
      date,
      requestedTime,
    },
  };
}

/**
 * Generate available time slots
 */
function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number,
  existingAppointments: Array<{ start_time: string; end_time: string }>,
  preferredTime?: string
): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Generate slots every 30 minutes (or duration if longer)
  const slotInterval = Math.max(30, durationMinutes);

  for (let minutes = startMinutes; minutes + durationMinutes <= endMinutes; minutes += slotInterval) {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    const slotTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    const slotEnd = minutes + durationMinutes;

    // Check if slot conflicts with existing appointments
    const hasConflict = existingAppointments.some(apt => {
      const [aptStartH, aptStartM] = apt.start_time.split(':').map(Number);
      const [aptEndH, aptEndM] = apt.end_time.split(':').map(Number);
      const aptStart = aptStartH * 60 + aptStartM;
      const aptEnd = aptEndH * 60 + aptEndM;

      return (minutes < aptEnd && slotEnd > aptStart);
    });

    if (!hasConflict) {
      slots.push(slotTime);
    }
  }

  // If preferred time specified, prioritize slots around it
  if (preferredTime && slots.length > 0) {
    const [prefHour, prefMin] = preferredTime.split(':').map(Number);
    const prefMinutes = prefHour * 60 + prefMin;

    slots.sort((a, b) => {
      const [aH, aM] = a.split(':').map(Number);
      const [bH, bM] = b.split(':').map(Number);
      const aDiff = Math.abs((aH * 60 + aM) - prefMinutes);
      const bDiff = Math.abs((bH * 60 + bM) - prefMinutes);
      return aDiff - bDiff;
    });
  }

  return slots;
}

/**
 * Find alternative dates with availability
 */
async function findAlternativeDates(
  supabase: ToolContext['supabase'],
  tenantId: string,
  branchId: string | undefined,
  originalDate: string,
  durationMinutes: number,
  doctorId?: string,
  specialty?: string
): Promise<string> {
  const alternatives: string[] = [];
  const startDate = new Date(originalDate);

  // Check next 7 days
  for (let i = 1; i <= 7 && alternatives.length < 2; i++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + i);
    const dateStr = checkDate.toISOString().split('T')[0];

    // Quick check for any availability
    let query = supabase
      .from('doctors')
      .select('id, schedule')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (branchId) query = query.eq('branch_id', branchId);
    if (doctorId) query = query.eq('id', doctorId);
    if (specialty) query = query.ilike('specialty', `%${specialty}%`);

    const { data: doctors } = await query;

    if (doctors && doctors.length > 0) {
      const dayOfWeek = checkDate.getDay();
      const hasAvailability = doctors.some(doctor => {
        const schedule = doctor.schedule as Record<string, { start: string; end: string }> | null;
        return schedule?.[dayOfWeek.toString()] !== undefined;
      });

      if (hasAvailability) {
        alternatives.push(dateStr);
      }
    }
  }

  if (alternatives.length === 0) {
    return '';
  }

  // Format alternatives
  const formatted = alternatives.map(d => formatDateForVoice(d, 'es'));
  return `Tenemos disponibilidad el ${formatted.join(' o el ')}.`;
}

export default checkAvailability;

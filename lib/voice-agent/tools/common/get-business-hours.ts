/**
 * TIS TIS Platform - Voice Agent v2.0
 * Common Tool: Get Business Hours
 *
 * Returns business hours for the tenant.
 * Works for any business type.
 */

import type {
  ToolDefinition,
  ToolResult,
  GetBusinessHoursParams,
} from '../types';
import { formatTimeForVoice, formatListForVoice } from '../formatters';

// =====================================================
// TYPES
// =====================================================

interface DaySchedule {
  open: string;
  close: string;
  closed?: boolean;
}

interface BusinessHours {
  [key: string]: DaySchedule | undefined;
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

// =====================================================
// TOOL DEFINITION
// =====================================================

export const getBusinessHours: ToolDefinition<GetBusinessHoursParams> = {
  name: 'get_business_hours',
  description: 'Obtiene los horarios de atención del negocio',
  category: 'info',

  parameters: {
    type: 'object',
    properties: {
      day: {
        type: 'string',
        description: 'Día específico (lunes, martes, etc.) o "today" o "tomorrow"',
      },
    },
    required: [],
  },

  requiredCapabilities: [],
  requiresConfirmation: false,
  enabledFor: [
    'rest_basic',
    'rest_complete',
    'dental_basic',
    'dental_complete',
  ],
  timeout: 5000,

  handler: async (params, context): Promise<ToolResult> => {
    const { day } = params;
    const { supabase, tenantId, branchId, locale } = context;

    try {
      // Get business hours from tenant or branch config
      let query = supabase
        .from('branches')
        .select('name, hours, timezone')
        .eq('tenant_id', tenantId);

      if (branchId) {
        query = query.eq('id', branchId);
      }

      const { data: branch, error: branchError } = await query.single();

      let hours: BusinessHours | null = null;
      let timezone = 'America/Mexico_City';
      let branchName = '';

      if (!branchError && branch?.hours) {
        hours = branch.hours as BusinessHours;
        timezone = branch.timezone || timezone;
        branchName = branch.name || '';
      }

      // Fallback to voice_config
      if (!hours) {
        const { data: voiceConfig } = await supabase
          .from('voice_configs')
          .select('business_hours, timezone')
          .eq('tenant_id', tenantId)
          .single();

        if (voiceConfig?.business_hours) {
          hours = voiceConfig.business_hours as BusinessHours;
          timezone = voiceConfig.timezone || timezone;
        }
      }

      // Fallback to business_knowledge
      if (!hours) {
        const { data: knowledge } = await supabase
          .from('business_knowledge')
          .select('content')
          .eq('tenant_id', tenantId)
          .eq('category', 'hours')
          .single();

        if (knowledge?.content) {
          try {
            hours = JSON.parse(knowledge.content) as BusinessHours;
          } catch {
            // Content is plain text, we'll handle it differently
            return {
              success: true,
              voiceMessage: knowledge.content,
              data: { rawContent: knowledge.content },
            };
          }
        }
      }

      if (!hours) {
        return {
          success: false,
          error: 'No hours found',
          voiceMessage: locale === 'en'
            ? "I don't have the business hours available right now. Would you like me to transfer you to someone who can help?"
            : 'No tengo los horarios disponibles en este momento. ¿Le gustaría que lo transfiera con alguien que pueda ayudarle?',
        };
      }

      // Format response based on requested day
      const voiceMessage = formatHoursResponse(hours, day, timezone, locale);

      return {
        success: true,
        voiceMessage,
        data: {
          hours,
          timezone,
          branchName,
          requestedDay: day,
        },
      };
    } catch (error) {
      console.error('[GetBusinessHours] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm having trouble getting the business hours. Please try again."
          : 'Tengo problemas para obtener los horarios. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const dayNames: Record<string, { en: string; es: string; index: number }> = {
  sunday: { en: 'Sunday', es: 'Domingo', index: 0 },
  monday: { en: 'Monday', es: 'Lunes', index: 1 },
  tuesday: { en: 'Tuesday', es: 'Martes', index: 2 },
  wednesday: { en: 'Wednesday', es: 'Miércoles', index: 3 },
  thursday: { en: 'Thursday', es: 'Jueves', index: 4 },
  friday: { en: 'Friday', es: 'Viernes', index: 5 },
  saturday: { en: 'Saturday', es: 'Sábado', index: 6 },
};

const dayNamesByIndex = Object.entries(dayNames)
  .sort((a, b) => a[1].index - b[1].index)
  .map(([key]) => key);

/**
 * Format business hours response for voice
 */
function formatHoursResponse(
  hours: BusinessHours,
  requestedDay: string | undefined,
  _timezone: string,
  locale: string
): string {
  // Determine which day(s) to return
  let targetDays: string[] = [];

  if (!requestedDay) {
    // Return all days
    targetDays = dayNamesByIndex;
  } else {
    const normalizedDay = normalizeDay(requestedDay);

    if (normalizedDay === 'today') {
      const today = new Date().getDay();
      targetDays = [dayNamesByIndex[today]];
    } else if (normalizedDay === 'tomorrow') {
      const tomorrow = (new Date().getDay() + 1) % 7;
      targetDays = [dayNamesByIndex[tomorrow]];
    } else if (normalizedDay) {
      targetDays = [normalizedDay];
    } else {
      targetDays = dayNamesByIndex;
    }
  }

  // Single day response
  if (targetDays.length === 1) {
    const day = targetDays[0];
    const schedule = hours[day];
    const dayName = locale === 'en' ? dayNames[day].en : dayNames[day].es;

    if (!schedule || schedule.closed) {
      return locale === 'en'
        ? `We are closed on ${dayName}.`
        : `Estamos cerrados el ${dayName}.`;
    }

    const openTime = formatTimeForVoice(schedule.open, locale);
    const closeTime = formatTimeForVoice(schedule.close, locale);

    return locale === 'en'
      ? `On ${dayName}, we're open from ${openTime} to ${closeTime}.`
      : `El ${dayName} estamos abiertos de ${openTime} a ${closeTime}.`;
  }

  // Multiple days - group by schedule
  const scheduleGroups = groupDaysBySchedule(hours, locale);

  if (scheduleGroups.length === 1) {
    // Same schedule every day
    const group = scheduleGroups[0];
    if (group.closed) {
      return locale === 'en'
        ? `We are currently closed.`
        : `Estamos actualmente cerrados.`;
    }

    return locale === 'en'
      ? `We're open ${group.daysStr} from ${group.openTime} to ${group.closeTime}.`
      : `Estamos abiertos ${group.daysStr} de ${group.openTime} a ${group.closeTime}.`;
  }

  // Different schedules - build response
  const parts: string[] = [];

  for (const group of scheduleGroups) {
    if (group.closed) {
      if (locale === 'en') {
        parts.push(`We're closed on ${group.daysStr}`);
      } else {
        parts.push(`Cerrados el ${group.daysStr}`);
      }
    } else {
      if (locale === 'en') {
        parts.push(`${group.daysStr} from ${group.openTime} to ${group.closeTime}`);
      } else {
        parts.push(`${group.daysStr} de ${group.openTime} a ${group.closeTime}`);
      }
    }
  }

  const intro = locale === 'en' ? "We're open" : 'Estamos abiertos';
  return `${intro} ${parts.join(locale === 'en' ? ', and ' : ', y ')}.`;
}

/**
 * Normalize day input to standard format
 */
function normalizeDay(input: string): string | null {
  const normalized = input.toLowerCase().trim();

  // Spanish to English mapping
  const spanishDays: Record<string, string> = {
    lunes: 'monday',
    martes: 'tuesday',
    miercoles: 'wednesday',
    miércoles: 'wednesday',
    jueves: 'thursday',
    viernes: 'friday',
    sabado: 'saturday',
    sábado: 'saturday',
    domingo: 'sunday',
    hoy: 'today',
    mañana: 'tomorrow',
    manana: 'tomorrow',
  };

  if (spanishDays[normalized]) {
    return spanishDays[normalized];
  }

  // Check English days
  for (const day of dayNamesByIndex) {
    if (normalized === day || normalized.startsWith(day.slice(0, 3))) {
      return day;
    }
  }

  if (normalized === 'today' || normalized === 'tomorrow') {
    return normalized;
  }

  return null;
}

interface ScheduleGroup {
  days: string[];
  daysStr: string;
  openTime: string;
  closeTime: string;
  closed: boolean;
}

/**
 * Group days by their schedule for concise voice output
 */
function groupDaysBySchedule(hours: BusinessHours, locale: string): ScheduleGroup[] {
  const groups: ScheduleGroup[] = [];
  const processed = new Set<string>();

  for (const day of dayNamesByIndex) {
    if (processed.has(day)) continue;

    const schedule = hours[day];
    const isClosed = !schedule || schedule.closed === true;
    const group: ScheduleGroup = {
      days: [day],
      daysStr: '',
      openTime: !isClosed && schedule?.open ? formatTimeForVoice(schedule.open, locale) : '',
      closeTime: !isClosed && schedule?.close ? formatTimeForVoice(schedule.close, locale) : '',
      closed: isClosed,
    };

    processed.add(day);

    // Find consecutive days with same schedule
    const dayIndex = dayNames[day].index;
    for (let i = dayIndex + 1; i < 7; i++) {
      const nextDay = dayNamesByIndex[i];
      const nextSchedule = hours[nextDay];

      const nextClosed = !nextSchedule || nextSchedule.closed === true;

      if (group.closed && nextClosed) {
        group.days.push(nextDay);
        processed.add(nextDay);
      } else if (
        !group.closed &&
        !nextClosed &&
        schedule &&
        nextSchedule &&
        schedule.open === nextSchedule.open &&
        schedule.close === nextSchedule.close
      ) {
        group.days.push(nextDay);
        processed.add(nextDay);
      } else {
        break;
      }
    }

    // Format days string
    group.daysStr = formatDaysRange(group.days, locale);
    groups.push(group);
  }

  return groups;
}

/**
 * Format a range of days for voice
 */
function formatDaysRange(days: string[], locale: string): string {
  if (days.length === 0) return '';

  if (days.length === 1) {
    return locale === 'en' ? dayNames[days[0]].en : dayNames[days[0]].es;
  }

  if (days.length === 2) {
    const day1 = locale === 'en' ? dayNames[days[0]].en : dayNames[days[0]].es;
    const day2 = locale === 'en' ? dayNames[days[1]].en : dayNames[days[1]].es;
    return `${day1} ${locale === 'en' ? 'and' : 'y'} ${day2}`;
  }

  // Check if consecutive
  const firstIndex = dayNames[days[0]].index;
  const lastIndex = dayNames[days[days.length - 1]].index;

  if (lastIndex - firstIndex === days.length - 1) {
    // Consecutive days - use range
    const firstDay = locale === 'en' ? dayNames[days[0]].en : dayNames[days[0]].es;
    const lastDay = locale === 'en' ? dayNames[days[days.length - 1]].en : dayNames[days[days.length - 1]].es;
    return `${firstDay} ${locale === 'en' ? 'through' : 'a'} ${lastDay}`;
  }

  // Non-consecutive - list them
  const dayNamesList = days.map(d =>
    locale === 'en' ? dayNames[d].en : dayNames[d].es
  );
  return formatListForVoice(dayNamesList, locale);
}

export default getBusinessHours;

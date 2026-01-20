/**
 * TIS TIS Platform - Voice Agent v2.0
 * Dental Tool: Get Doctors
 *
 * Retrieves information about dental professionals including
 * specialties, availability, and biographical details.
 */

import type {
  ToolDefinition,
  ToolContext,
  DoctorsResult,
  GetDoctorsParams,
} from '../types';
import { formatListForVoice } from '../formatters';

// =====================================================
// SPECIALTY MAPPING
// =====================================================

const SPECIALTY_DISPLAY: Record<string, { es: string; en: string }> = {
  general: { es: 'Odontología General', en: 'General Dentistry' },
  orthodontics: { es: 'Ortodoncia', en: 'Orthodontics' },
  endodontics: { es: 'Endodoncia', en: 'Endodontics' },
  periodontics: { es: 'Periodoncia', en: 'Periodontics' },
  prosthodontics: { es: 'Prostodoncia', en: 'Prosthodontics' },
  pediatric: { es: 'Odontopediatría', en: 'Pediatric Dentistry' },
  surgery: { es: 'Cirugía Oral', en: 'Oral Surgery' },
  implants: { es: 'Implantología', en: 'Implantology' },
  cosmetic: { es: 'Odontología Estética', en: 'Cosmetic Dentistry' },
  radiology: { es: 'Radiología Dental', en: 'Dental Radiology' },
};

const DAY_NAMES: Record<string, { es: string; en: string }> = {
  monday: { es: 'lunes', en: 'Monday' },
  tuesday: { es: 'martes', en: 'Tuesday' },
  wednesday: { es: 'miércoles', en: 'Wednesday' },
  thursday: { es: 'jueves', en: 'Thursday' },
  friday: { es: 'viernes', en: 'Friday' },
  saturday: { es: 'sábado', en: 'Saturday' },
  sunday: { es: 'domingo', en: 'Sunday' },
};

// =====================================================
// TOOL DEFINITION
// =====================================================

export const getDoctors: ToolDefinition<GetDoctorsParams> = {
  name: 'get_doctors',
  description: 'Obtiene información de los doctores y especialistas del consultorio dental',
  category: 'info',

  parameters: {
    type: 'object',
    properties: {
      specialty: {
        type: 'string',
        description: 'Filtrar por especialidad (ortodoncia, endodoncia, periodoncia, etc.)',
      },
      availableDate: {
        type: 'string',
        format: 'date',
        description: 'Filtrar por disponibilidad en una fecha específica',
      },
      includeSchedule: {
        type: 'boolean',
        description: 'Incluir información de horarios',
        default: false,
      },
      doctorId: {
        type: 'string',
        description: 'ID específico de un doctor para obtener detalles',
      },
    },
    required: [],
  },

  requiredCapabilities: ['doctor_info'],
  requiresConfirmation: false,
  enabledFor: ['dental_standard', 'dental_complete'],
  timeout: 8000,

  handler: async (params, context): Promise<DoctorsResult> => {
    const { specialty, availableDate, includeSchedule = false, doctorId } = params;
    const { supabase, tenantId, branchId, locale } = context;

    try {
      // Build query for doctors
      let query = supabase
        .from('doctors')
        .select(`
          id,
          name,
          title,
          specialty,
          bio,
          photo_url,
          is_active,
          schedule,
          available_days
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');

      // Filter by branch if applicable
      if (branchId) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }

      // Filter by specific doctor
      if (doctorId) {
        query = query.eq('id', doctorId);
      }

      // Filter by specialty
      if (specialty) {
        // Try exact match first, then partial match
        query = query.or(`specialty.ilike.%${specialty}%,specialty.eq.${specialty}`);
      }

      const { data: doctors, error: queryError } = await query;

      if (queryError) {
        console.error('[GetDoctors] Query error:', queryError);
        // Try fallback to business_knowledge
        return await getDoctorsFromKnowledge(supabase, tenantId, specialty, locale);
      }

      // No doctors found
      if (!doctors || doctors.length === 0) {
        return await getDoctorsFromKnowledge(supabase, tenantId, specialty, locale);
      }

      // Filter by available date if specified
      let filteredDoctors = doctors;
      if (availableDate) {
        const dayOfWeek = getDayOfWeek(availableDate);
        filteredDoctors = doctors.filter(doctor => {
          const availableDays = doctor.available_days as string[] | null;
          if (!availableDays) return true; // Assume available if not specified
          return availableDays.some(day =>
            day.toLowerCase() === dayOfWeek.toLowerCase()
          );
        });
      }

      // Format doctors for response
      const formattedDoctors = formatDoctors(filteredDoctors, specialty, includeSchedule, availableDate, locale);

      // Collect unique specialties
      const specialties = [...new Set(
        doctors
          .map(d => d.specialty)
          .filter((s): s is string => !!s)
      )];

      return {
        success: true,
        voiceMessage: formattedDoctors.voiceMessage,
        data: {
          doctors: formattedDoctors.doctors,
          specialties,
        },
      };
    } catch (error) {
      console.error('[GetDoctors] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm having trouble getting information about our doctors. Please try again."
          : 'Tengo problemas para obtener la información de nuestros doctores. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

interface DoctorRow {
  id: string;
  name: string;
  title: string | null;
  specialty: string | null;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean;
  schedule: Record<string, { start: string; end: string }> | null;
  available_days: string[] | null;
}

interface FormattedDoctor {
  id: string;
  name: string;
  title?: string;
  specialty?: string;
  bio?: string;
  availableDays?: string[];
  schedule?: Record<string, { start: string; end: string }>;
}

/**
 * Format doctors for voice/messaging response
 */
function formatDoctors(
  doctors: DoctorRow[],
  requestedSpecialty: string | undefined,
  includeSchedule: boolean,
  availableDate: string | undefined,
  locale: string
): { voiceMessage: string; doctors: FormattedDoctor[] } {
  const formattedList: FormattedDoctor[] = doctors.map(doctor => {
    const formatted: FormattedDoctor = {
      id: doctor.id,
      name: doctor.name,
    };

    if (doctor.title) {
      formatted.title = doctor.title;
    }

    if (doctor.specialty) {
      // Try to get localized specialty name
      const specialtyKey = doctor.specialty.toLowerCase().replace(/\s+/g, '_');
      const localizedSpecialty = SPECIALTY_DISPLAY[specialtyKey];
      formatted.specialty = localizedSpecialty
        ? (locale === 'en' ? localizedSpecialty.en : localizedSpecialty.es)
        : doctor.specialty;
    }

    if (doctor.bio) {
      // Truncate bio for voice
      formatted.bio = doctor.bio.length > 150
        ? doctor.bio.substring(0, 147) + '...'
        : doctor.bio;
    }

    if (doctor.available_days) {
      formatted.availableDays = doctor.available_days.map(day => {
        const dayKey = day.toLowerCase();
        return DAY_NAMES[dayKey]
          ? (locale === 'en' ? DAY_NAMES[dayKey].en : DAY_NAMES[dayKey].es)
          : day;
      });
    }

    if (includeSchedule && doctor.schedule) {
      formatted.schedule = doctor.schedule;
    }

    return formatted;
  });

  // Generate voice message
  let voiceMessage: string;

  if (formattedList.length === 0) {
    if (requestedSpecialty) {
      voiceMessage = locale === 'en'
        ? `I couldn't find any ${requestedSpecialty} specialists available. Would you like to see our other doctors?`
        : `No encontré especialistas en ${requestedSpecialty} disponibles. ¿Le gustaría ver nuestros otros doctores?`;
    } else if (availableDate) {
      voiceMessage = locale === 'en'
        ? `I couldn't find any doctors available on that date. Would you like to try another date?`
        : `No encontré doctores disponibles en esa fecha. ¿Le gustaría probar otra fecha?`;
    } else {
      voiceMessage = locale === 'en'
        ? "I couldn't find doctor information. Would you like me to connect you with the front desk?"
        : 'No encontré información de doctores. ¿Le gustaría que lo comunique con recepción?';
    }
  } else if (formattedList.length === 1) {
    const doctor = formattedList[0];
    const titleName = doctor.title ? `${doctor.title} ${doctor.name}` : doctor.name;
    const specialtyStr = doctor.specialty ? `, especialista en ${doctor.specialty}` : '';
    const availableStr = doctor.availableDays
      ? ` Está disponible los ${formatListForVoice(doctor.availableDays, locale)}.`
      : '';

    voiceMessage = locale === 'en'
      ? `We have ${titleName}${specialtyStr}.${availableStr} Would you like to schedule an appointment with this doctor?`
      : `Contamos con ${titleName}${specialtyStr}.${availableStr} ¿Le gustaría agendar una cita con este doctor?`;
  } else {
    // Multiple doctors
    const doctorNames = formattedList.slice(0, 4).map(d => {
      const name = d.title ? `${d.title} ${d.name}` : d.name;
      const spec = d.specialty ? ` (${d.specialty})` : '';
      return `${name}${spec}`;
    });

    const doctorList = formatListForVoice(doctorNames, locale);

    if (requestedSpecialty) {
      voiceMessage = locale === 'en'
        ? `For ${requestedSpecialty}, we have: ${doctorList}. Would you like to schedule with any of them?`
        : `Para ${requestedSpecialty}, contamos con: ${doctorList}. ¿Le gustaría agendar con alguno de ellos?`;
    } else {
      voiceMessage = locale === 'en'
        ? `Our dental team includes: ${doctorList}. Would you like more information about any of them?`
        : `Nuestro equipo dental incluye: ${doctorList}. ¿Le gustaría más información sobre alguno de ellos?`;
    }
  }

  return { voiceMessage, doctors: formattedList };
}

/**
 * Fallback: Get doctors from business_knowledge table
 */
async function getDoctorsFromKnowledge(
  supabase: ToolContext['supabase'],
  tenantId: string,
  specialty: string | undefined,
  locale: string
): Promise<DoctorsResult> {
  try {
    const { data: knowledge, error } = await supabase
      .from('business_knowledge')
      .select('content, metadata')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .or('category.eq.doctors,category.eq.staff,category.eq.team')
      .limit(1);

    if (error || !knowledge || knowledge.length === 0) {
      return {
        success: true,
        voiceMessage: locale === 'en'
          ? "I don't have detailed information about our doctors at the moment. Would you like me to connect you with the front desk?"
          : 'No tengo información detallada sobre nuestros doctores en este momento. ¿Le gustaría que lo comunique con recepción?',
        data: {
          doctors: [],
          specialties: [],
        },
      };
    }

    // Try to parse doctors from knowledge content
    const entry = knowledge[0];
    const doctors: FormattedDoctor[] = [];

    if (entry.metadata?.doctors && Array.isArray(entry.metadata.doctors)) {
      for (const doctor of entry.metadata.doctors) {
        // Filter by specialty if requested
        if (specialty && doctor.specialty) {
          if (!doctor.specialty.toLowerCase().includes(specialty.toLowerCase())) {
            continue;
          }
        }

        doctors.push({
          id: doctor.id || `kb-${Math.random().toString(36).slice(2, 8)}`,
          name: doctor.name,
          title: doctor.title,
          specialty: doctor.specialty,
          bio: doctor.bio,
          availableDays: doctor.available_days,
        });
      }
    }

    if (doctors.length === 0 && entry.content) {
      // Raw text fallback
      return {
        success: true,
        voiceMessage: locale === 'en'
          ? `Here's information about our team: ${entry.content.substring(0, 250)}...`
          : `Aquí está la información de nuestro equipo: ${entry.content.substring(0, 250)}...`,
        data: {
          doctors: [],
          specialties: [],
        },
      };
    }

    const specialties = [...new Set(doctors.map(d => d.specialty).filter(Boolean))];
    const doctorNames = doctors.slice(0, 3).map(d => d.title ? `${d.title} ${d.name}` : d.name);
    const doctorList = formatListForVoice(doctorNames, locale);

    return {
      success: true,
      voiceMessage: locale === 'en'
        ? `Our team includes: ${doctorList}. Would you like more details about any of them?`
        : `Nuestro equipo incluye: ${doctorList}. ¿Le gustaría más detalles sobre alguno de ellos?`,
      data: {
        doctors,
        specialties: specialties as string[],
      },
    };
  } catch (error) {
    console.error('[GetDoctors] Knowledge base error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      voiceMessage: locale === 'en'
        ? "I couldn't retrieve doctor information. Please try again."
        : 'No pude obtener la información de doctores. Por favor intente de nuevo.',
    };
  }
}

/**
 * Get day of week from date string
 */
function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

export default getDoctors;

// =====================================================
// TIS TIS PLATFORM - Appointment Booking Service
// AI-powered appointment creation and management
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';

// ======================
// TYPES
// ======================

export interface BookingRequest {
  tenant_id: string;
  lead_id: string;
  conversation_id: string;
  branch_id?: string;
  service_id?: string;
  staff_id?: string;
  requested_date?: string; // ISO date string
  requested_time?: string; // HH:MM format
  notes?: string;
  // Restaurant-specific fields
  party_size?: number;
  table_id?: string;
  occasion_type?: string;
  special_requests?: string;
  vertical?: 'dental' | 'restaurant' | 'clinic' | 'gym' | 'beauty' | 'veterinary' | 'general';
  // AI Traceability fields (dental and others)
  ai_booking_channel?: 'ai_whatsapp' | 'ai_voice' | 'ai_webchat' | 'ai_instagram' | 'ai_facebook';
  ai_urgency_level?: number; // 1-5
  ai_detected_symptoms?: string[];
  ai_confidence_score?: number; // 0-1
}

export interface BookingResult {
  success: boolean;
  appointment_id?: string;
  scheduled_at?: string;
  branch_name?: string;
  service_name?: string;
  staff_name?: string;
  duration_minutes?: number;
  error?: string;
  suggestion?: string; // Alternative time suggestion if requested slot unavailable
  // Restaurant-specific result fields
  party_size?: number;
  table_name?: string;
  occasion_type?: string;
  vertical?: 'dental' | 'restaurant' | 'clinic' | 'gym' | 'beauty' | 'veterinary' | 'general';
}

export interface AvailableSlot {
  date: string;
  time: string;
  staff_id: string;
  staff_name: string;
  branch_id: string;
  branch_name: string;
}

export interface ExtractedBookingData {
  date?: string;
  time?: string;
  service_name?: string;
  branch_name?: string;
  staff_name?: string;
  is_flexible?: boolean; // "cualquier día", "cuando tengan"
  // Restaurant-specific extracted data
  party_size?: number;
  occasion?: string;
  special_requests?: string;
}

// ======================
// DATE/TIME EXTRACTION
// ======================

/**
 * Extrae datos de fecha/hora del mensaje del cliente
 * Soporta formatos como:
 * - "mañana a las 4"
 * - "el jueves"
 * - "el 20 de diciembre a las 10"
 * - "la próxima semana"
 */
export function extractBookingData(message: string): ExtractedBookingData {
  const result: ExtractedBookingData = {};
  const messageLower = message.toLowerCase();
  const now = new Date();

  // Detectar flexibilidad
  if (/cualquier|cuando (tengan|puedan)|lo más pronto|urgente|hoy mismo/i.test(messageLower)) {
    result.is_flexible = true;
  }

  // Extraer día específico
  const dayPatterns: Record<string, number> = {
    'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
    'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6,
  };

  // "el jueves", "este viernes"
  const dayMatch = messageLower.match(/(?:el|este|próximo|proximo)\s*(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/i);
  if (dayMatch) {
    const targetDay = dayPatterns[dayMatch[1].toLowerCase()];
    if (targetDay !== undefined) {
      const date = getNextDayOfWeek(now, targetDay);
      result.date = date.toISOString().split('T')[0];
    }
  }

  // "mañana"
  if (/\bmañana\b/i.test(messageLower)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    result.date = tomorrow.toISOString().split('T')[0];
  }

  // "pasado mañana"
  if (/pasado\s*mañana/i.test(messageLower)) {
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    result.date = dayAfter.toISOString().split('T')[0];
  }

  // "hoy"
  if (/\bhoy\b/i.test(messageLower)) {
    result.date = now.toISOString().split('T')[0];
  }

  // "el 20 de diciembre", "20 de enero"
  const dateMatch = messageLower.match(/(\d{1,2})\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const monthNames: Record<string, number> = {
      'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
      'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
    };
    const month = monthNames[dateMatch[2].toLowerCase()];
    if (month !== undefined) {
      const year = month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
      const date = new Date(year, month, day);
      result.date = date.toISOString().split('T')[0];
    }
  }

  // Extraer hora
  // "a las 4", "a las 10:30", "4 pm", "16:00"
  const timeMatch = messageLower.match(/(?:a las?\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|hrs?|de la (mañana|tarde|noche))?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3]?.toLowerCase();

    // Ajustar por AM/PM
    if (period) {
      if ((period === 'pm' || period.includes('tarde') || period.includes('noche')) && hour < 12) {
        hour += 12;
      } else if ((period === 'am' || period.includes('mañana')) && hour === 12) {
        hour = 0;
      }
    } else if (hour >= 1 && hour <= 6) {
      // Asumir PM para horas como "a las 4" (4pm, no 4am)
      hour += 12;
    }

    result.time = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Extract party size (restaurant-specific)
  // "mesa para 4", "somos 6", "para 8 personas", "reserva para 2"
  const partySizeMatch = messageLower.match(/(?:mesa\s+)?(?:para|somos|de)\s+(\d{1,2})(?:\s+personas?)?/i);
  if (partySizeMatch) {
    result.party_size = parseInt(partySizeMatch[1]);
  }

  // Extract occasion (restaurant-specific)
  const occasionPatterns: Record<string, string> = {
    'cumpleaños': 'birthday',
    'cumple': 'birthday',
    'aniversario': 'anniversary',
    'negocios': 'business',
    'trabajo': 'business',
    'romántic': 'date_night',
    'cita': 'date_night',
    'familiar': 'family_gathering',
    'familia': 'family_gathering',
    'celebración': 'celebration',
    'celebrar': 'celebration',
    'graduación': 'graduation',
    'propuesta': 'proposal',
    'compromiso': 'proposal',
  };

  for (const [keyword, occasion] of Object.entries(occasionPatterns)) {
    if (messageLower.includes(keyword)) {
      result.occasion = occasion;
      break;
    }
  }

  // Extract special requests (restaurant-specific)
  // "vegetariano", "sin gluten", "alergia", "silla de bebé", "terraza", "privado"
  const specialRequestsPatterns = [
    'vegetariano', 'vegano', 'sin gluten', 'celiaco', 'alergia',
    'silla de bebé', 'silla alta', 'terraza', 'interior', 'privado',
    'ventana', 'tranquilo', 'vista',
  ];

  const foundRequests: string[] = [];
  for (const pattern of specialRequestsPatterns) {
    if (messageLower.includes(pattern)) {
      foundRequests.push(pattern);
    }
  }
  if (foundRequests.length > 0) {
    result.special_requests = foundRequests.join(', ');
  }

  return result;
}

/**
 * Obtiene la próxima fecha para un día de la semana específico
 */
function getNextDayOfWeek(date: Date, dayOfWeek: number): Date {
  const result = new Date(date);
  const currentDay = result.getDay();
  const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
  result.setDate(result.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
  return result;
}

// ======================
// AVAILABILITY CHECK
// ======================

/**
 * Verifica si un slot específico está disponible
 */
export async function checkSlotAvailability(
  tenantId: string,
  branchId: string,
  date: string,
  time: string,
  staffId?: string,
  durationMinutes: number = 60
): Promise<{ available: boolean; conflictReason?: string }> {
  const supabase = createServerClient();

  // Validar formato de fecha y hora
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^\d{2}:\d{2}$/;

  if (!dateRegex.test(date)) {
    return { available: false, conflictReason: 'Formato de fecha inválido (esperado YYYY-MM-DD)' };
  }
  if (!timeRegex.test(time)) {
    return { available: false, conflictReason: 'Formato de hora inválido (esperado HH:MM)' };
  }

  // Construir datetime con validación
  const scheduledAt = new Date(`${date}T${time}:00`);

  // Verificar que la fecha sea válida
  if (isNaN(scheduledAt.getTime())) {
    return { available: false, conflictReason: 'Fecha u hora inválida' };
  }

  // Verificar que la fecha no esté en el pasado
  const now = new Date();
  if (scheduledAt < now) {
    return { available: false, conflictReason: 'No se pueden agendar citas en el pasado' };
  }

  const endAt = new Date(scheduledAt.getTime() + durationMinutes * 60000);

  // 1. Verificar horario de operación de la sucursal
  const { data: branch } = await supabase
    .from('branches')
    .select('operating_hours')
    .eq('id', branchId)
    .single();

  if (branch?.operating_hours) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[scheduledAt.getDay()];
    const dayHours = branch.operating_hours[dayName];

    if (!dayHours || !dayHours.open || !dayHours.close) {
      return { available: false, conflictReason: 'La sucursal está cerrada ese día' };
    }

    const requestedTime = time;
    if (requestedTime < dayHours.open || requestedTime >= dayHours.close) {
      return {
        available: false,
        conflictReason: `Fuera de horario. La sucursal abre de ${dayHours.open} a ${dayHours.close}`
      };
    }
  }

  // 2. Verificar si hay citas que se traslapen
  let appointmentQuery = supabase
    .from('appointments')
    .select('id, scheduled_at, duration_minutes, staff_id')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .in('status', ['scheduled', 'confirmed'])
    .gte('scheduled_at', `${date}T00:00:00`)
    .lt('scheduled_at', `${date}T23:59:59`);

  if (staffId) {
    appointmentQuery = appointmentQuery.eq('staff_id', staffId);
  }

  const { data: existingAppointments } = await appointmentQuery;

  if (existingAppointments && existingAppointments.length > 0) {
    for (const apt of existingAppointments) {
      const aptStart = new Date(apt.scheduled_at);
      const aptEnd = new Date(aptStart.getTime() + (apt.duration_minutes || 60) * 60000);

      // Verificar traslape
      if (scheduledAt < aptEnd && endAt > aptStart) {
        return {
          available: false,
          conflictReason: 'Ya hay una cita programada en ese horario'
        };
      }
    }
  }

  // 3. Si se especificó staff, verificar su disponibilidad
  if (staffId) {
    const { data: staffAvailability } = await supabase
      .from('staff_availability')
      .select('*')
      .eq('staff_id', staffId)
      .eq('day_of_week', scheduledAt.getDay());

    if (staffAvailability && staffAvailability.length > 0) {
      const avail = staffAvailability[0];
      if (time < avail.start_time || time >= avail.end_time) {
        return {
          available: false,
          conflictReason: 'El doctor no está disponible en ese horario'
        };
      }
    }
  }

  return { available: true };
}

/**
 * Obtiene los próximos slots disponibles
 */
export async function getAvailableSlots(
  tenantId: string,
  branchId?: string,
  serviceId?: string,
  staffId?: string,
  fromDate?: string,
  limit: number = 5
): Promise<AvailableSlot[]> {
  const supabase = createServerClient();
  const slots: AvailableSlot[] = [];

  // Obtener duración del servicio si se especificó
  let durationMinutes = 60;
  if (serviceId) {
    const { data: service } = await supabase
      .from('services')
      .select('duration_minutes')
      .eq('id', serviceId)
      .single();
    if (service) durationMinutes = service.duration_minutes;
  }

  // Obtener sucursales
  let branchQuery = supabase
    .from('branches')
    .select('id, name, operating_hours')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (branchId) {
    branchQuery = branchQuery.eq('id', branchId);
  }

  const { data: branches } = await branchQuery;
  if (!branches || branches.length === 0) return slots;

  // Obtener staff
  let staffQuery = supabase
    .from('staff')
    .select(`
      id,
      display_name,
      first_name,
      last_name,
      staff_branches!inner(branch_id)
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('role', ['owner', 'dentist', 'specialist']);

  if (staffId) {
    staffQuery = staffQuery.eq('id', staffId);
  }

  const { data: staffMembers } = await staffQuery;

  // Generar slots para los próximos 7 días
  const startDate = fromDate ? new Date(fromDate) : new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  for (let dayOffset = 0; dayOffset < 14 && slots.length < limit; dayOffset++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const dateStr = checkDate.toISOString().split('T')[0];
    const dayName = dayNames[checkDate.getDay()];

    for (const branch of branches) {
      if (slots.length >= limit) break;

      const hours = branch.operating_hours?.[dayName];
      if (!hours?.open || !hours?.close) continue;

      // Generar slots cada hora
      const openHour = parseInt(hours.open.split(':')[0]);
      const closeHour = parseInt(hours.close.split(':')[0]);

      for (let hour = openHour; hour < closeHour && slots.length < limit; hour++) {
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;

        // Verificar disponibilidad
        const { available } = await checkSlotAvailability(
          tenantId,
          branch.id,
          dateStr,
          timeStr,
          staffId,
          durationMinutes
        );

        if (available) {
          // Encontrar un staff disponible si no se especificó
          let availableStaff = staffMembers?.find(s =>
            (s.staff_branches as any[])?.some((sb: any) => sb.branch_id === branch.id)
          );

          if (availableStaff || !staffId) {
            slots.push({
              date: dateStr,
              time: timeStr,
              staff_id: availableStaff?.id || '',
              staff_name: availableStaff?.display_name ||
                `${availableStaff?.first_name || ''} ${availableStaff?.last_name || ''}`.trim() ||
                'Por asignar',
              branch_id: branch.id,
              branch_name: branch.name,
            });
          }
        }
      }
    }
  }

  return slots;
}

// ======================
// BOOKING CREATION
// ======================

/**
 * Crea una cita en el sistema
 *
 * V8/V9 FIX: Usa create_appointment_atomic RPC con advisory lock
 * para prevenir race conditions entre Voice y Message channels
 */
export async function createBooking(request: BookingRequest): Promise<BookingResult> {
  const supabase = createServerClient();

  try {
    // 1. Validar que tenemos los datos mínimos
    if (!request.branch_id) {
      // Buscar sucursal por defecto (headquarters)
      const { data: defaultBranch } = await supabase
        .from('branches')
        .select('id, name')
        .eq('tenant_id', request.tenant_id)
        .eq('is_active', true)
        .order('is_headquarters', { ascending: false })
        .limit(1)
        .single();

      if (defaultBranch) {
        request.branch_id = defaultBranch.id;
      } else {
        return { success: false, error: 'No hay sucursales disponibles' };
      }
    }

    // 2. Obtener información del servicio si se especificó
    let serviceName = 'Consulta General';
    let durationMinutes = 60;

    if (request.service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('name, duration_minutes')
        .eq('id', request.service_id)
        .single();

      if (service) {
        serviceName = service.name;
        durationMinutes = service.duration_minutes;
      }
    }

    // 3. Determinar fecha y hora
    let scheduledAt: Date;
    if (request.requested_date && request.requested_time) {
      scheduledAt = new Date(`${request.requested_date}T${request.requested_time}:00`);
    } else {
      // Buscar próximo slot disponible
      const slots = await getAvailableSlots(
        request.tenant_id,
        request.branch_id,
        request.service_id,
        request.staff_id,
        undefined,
        1
      );

      if (slots.length === 0) {
        return {
          success: false,
          error: 'No hay horarios disponibles en los próximos días',
          suggestion: 'Por favor, contacta directamente con la clínica para agendar.'
        };
      }

      scheduledAt = new Date(`${slots[0].date}T${slots[0].time}:00`);
      request.branch_id = slots[0].branch_id;
      request.staff_id = slots[0].staff_id || undefined;
    }

    // 4. Validar que tenemos branch_id
    if (!request.branch_id) {
      return { success: false, error: 'No se pudo determinar la sucursal' };
    }

    // 5. Asignar staff si no se especificó
    if (!request.staff_id) {
      const { data: availableStaff } = await supabase
        .from('staff')
        .select(`
          id,
          display_name,
          staff_branches!inner(branch_id)
        `)
        .eq('tenant_id', request.tenant_id)
        .eq('is_active', true)
        .in('role', ['owner', 'dentist', 'specialist'])
        .limit(1);

      if (availableStaff && availableStaff.length > 0) {
        const staffInBranch = availableStaff.find(s =>
          (s.staff_branches as any[])?.some((sb: any) => sb.branch_id === request.branch_id)
        );
        if (staffInBranch) {
          request.staff_id = staffInBranch.id;
        }
      }
    }

    // 6. Determinar el canal para AI traceability
    const isRestaurant = request.vertical === 'restaurant';
    const aiChannel = request.ai_booking_channel || 'ai_whatsapp';

    // =================================================================
    // V8/V9 FIX: Use atomic RPC to prevent race conditions
    // This uses pg_advisory_xact_lock to ensure only one process
    // can book the same slot at a time (Voice OR Message, not both)
    // =================================================================
    const { data: result, error } = await supabase.rpc('create_appointment_atomic', {
      p_tenant_id: request.tenant_id,
      p_lead_id: request.lead_id,
      p_branch_id: request.branch_id,
      p_scheduled_at: scheduledAt.toISOString(),
      p_duration_minutes: isRestaurant ? 120 : durationMinutes,
      p_service_id: request.service_id || null,
      p_staff_id: request.staff_id || null,
      p_notes: request.notes || (isRestaurant ? 'Reservación agendada por asistente AI' : 'Cita agendada por asistente AI'),
      p_source: 'ai_booking',
      p_conversation_id: request.conversation_id || null,
      p_channel: aiChannel.replace('ai_', ''), // 'ai_whatsapp' -> 'whatsapp'
      // Restaurant specific
      p_party_size: request.party_size || null,
      p_occasion_type: request.occasion_type || null,
      p_special_requests: request.special_requests || null,
      // AI traceability
      p_ai_booking_channel: request.ai_booking_channel || null,
      p_ai_urgency_level: request.ai_urgency_level || null,
      p_ai_detected_symptoms: request.ai_detected_symptoms ? JSON.stringify(request.ai_detected_symptoms) : null,
      p_ai_confidence_score: request.ai_confidence_score || null,
    });

    if (error) {
      console.error('[Booking Service] Atomic booking error:', error);
      return {
        success: false,
        error: isRestaurant ? 'Error al crear la reservación' : 'Error al crear la cita',
      };
    }

    // The RPC returns an array with one row
    const bookingResult = result?.[0];

    if (!bookingResult?.success) {
      console.log('[Booking Service] Slot not available:', bookingResult?.error_message);
      return {
        success: false,
        error: bookingResult?.error_message || 'Horario no disponible',
        suggestion: bookingResult?.suggestion,
      };
    }

    // 7. Get appointment details for response
    const { data: appointment } = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        duration_minutes,
        branch:branches(name),
        service:services(name),
        staff:staff(display_name, first_name, last_name)
      `)
      .eq('id', bookingResult.appointment_id)
      .single();

    if (!appointment) {
      // Appointment was created but we couldn't fetch details
      // This shouldn't happen, but handle gracefully
      return {
        success: true,
        appointment_id: bookingResult.appointment_id,
        scheduled_at: scheduledAt.toISOString(),
        branch_name: '',
        service_name: serviceName,
        staff_name: 'Por asignar',
        duration_minutes: isRestaurant ? 120 : durationMinutes,
        vertical: request.vertical,
      };
    }

    const staffData = appointment.staff as any;
    const staffName = staffData?.display_name ||
      `${staffData?.first_name || ''} ${staffData?.last_name || ''}`.trim() ||
      'Por asignar';

    const finalResult: BookingResult = {
      success: true,
      appointment_id: appointment.id,
      scheduled_at: scheduledAt.toISOString(),
      branch_name: (appointment.branch as any)?.name || '',
      service_name: (appointment.service as any)?.name || serviceName,
      staff_name: staffName,
      duration_minutes: isRestaurant ? 120 : durationMinutes,
      vertical: request.vertical,
    };

    // Add restaurant-specific fields to result
    if (isRestaurant) {
      finalResult.party_size = request.party_size;
      finalResult.occasion_type = request.occasion_type;
    }

    console.log(`[Booking Service] Appointment created atomically: ${appointment.id}`);
    return finalResult;

  } catch (error) {
    console.error('[Booking Service] Unexpected error:', error);
    const errorMsg = request.vertical === 'restaurant'
      ? 'Error inesperado al crear la reservación'
      : 'Error inesperado al crear la cita';
    return { success: false, error: errorMsg };
  }
}

// ======================
// HELPERS
// ======================

/**
 * Formatea una fecha para mostrar al usuario
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  };
  return date.toLocaleDateString('es-MX', options);
}

/**
 * Genera mensaje de confirmación de cita/reservación
 * Adapta el mensaje según el vertical (dental, restaurant, etc.)
 */
export function generateBookingConfirmation(result: BookingResult): string {
  if (!result.success) {
    if (result.suggestion) {
      return `${result.error}. ${result.suggestion}`;
    }
    return result.error || 'No fue posible agendar.';
  }

  const date = new Date(result.scheduled_at!);
  const dateStr = date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeStr = date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const isRestaurant = result.vertical === 'restaurant';

  if (isRestaurant) {
    // Restaurant-specific confirmation message
    let message = `¡Perfecto! Tu reservación ha sido confirmada:\n\n`;
    message += `📅 ${dateStr}\n`;
    message += `⏰ ${timeStr}\n`;
    message += `📍 ${result.branch_name}\n`;

    if (result.party_size) {
      message += `👥 ${result.party_size} persona${result.party_size > 1 ? 's' : ''}\n`;
    }

    if (result.table_name) {
      message += `🪑 ${result.table_name}\n`;
    }

    if (result.occasion_type && result.occasion_type !== 'regular') {
      const occasionLabels: Record<string, string> = {
        birthday: '🎂 Cumpleaños',
        anniversary: '💑 Aniversario',
        business: '💼 Reunión de negocios',
        date_night: '💕 Cita romántica',
        family_gathering: '👨‍👩‍👧‍👦 Reunión familiar',
        celebration: '🎉 Celebración',
        graduation: '🎓 Graduación',
        proposal: '💍 Propuesta',
      };
      const label = occasionLabels[result.occasion_type];
      if (label) {
        message += `${label}\n`;
      }
    }

    message += `\n¡Te esperamos! Por favor llega a tiempo.`;
    message += `\n\nSi necesitas modificar o cancelar tu reservación, avísanos con al menos 2 horas de anticipación.`;

    return message;
  }

  // Default (dental/clinic) confirmation message
  let message = `¡Perfecto! Tu cita ha sido agendada:\n\n`;
  message += `📅 ${dateStr}\n`;
  message += `⏰ ${timeStr}\n`;
  message += `📍 ${result.branch_name}\n`;

  if (result.service_name) {
    message += `🦷 ${result.service_name}\n`;
  }

  if (result.staff_name && result.staff_name !== 'Por asignar') {
    message += `👨‍⚕️ ${result.staff_name}\n`;
  }

  message += `\nTe esperamos. Recuerda llegar 10 minutos antes.`;
  message += `\n\nSi necesitas reagendar, avísanos con al menos 4 horas de anticipación.`;

  return message;
}

// ======================
// EXPORTS
// ======================

export const AppointmentBookingService = {
  extractBookingData,
  checkSlotAvailability,
  getAvailableSlots,
  createBooking,
  generateBookingConfirmation,
};

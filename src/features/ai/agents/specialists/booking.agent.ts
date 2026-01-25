// =====================================================
// TIS TIS PLATFORM - Booking Agent
// Agente especializado en agendar citas
// =====================================================
//
// ARQUITECTURA V7.0 (HÍBRIDA) + SECURE BOOKING v2.2:
// - Tool Calling SIEMPRE activo para consultas de información
// - Lógica directa de booking por seguridad y control
// - Tools disponibles: get_service_info, get_branch_info, get_staff_info,
//   get_available_slots, list_services, search_knowledge_base
// - CREATE_APPOINTMENT se ejecuta directamente, NO via tool calling
// - SECURE BOOKING: Verificación de trust y holds temporales (v2.2)
//
// NOTA: El booking requiere un flujo controlado. El LLM NO debe
// decidir cuándo crear una cita - eso lo controla la lógica del agente.
// CERO context stuffing - el LLM obtiene info via Tool Calling.
// =====================================================

import { BaseAgent, type AgentResult } from './base.agent';
import type { TISTISAgentStateType } from '../../state';
import {
  extractBookingData,
  createBooking,
  generateBookingConfirmation,
  getAvailableSlots,
  type BookingRequest,
} from '../../services/appointment-booking.service';
import { createToolsForAgent, TOOL_NAMES } from '../../tools';
// v2.2: Secure Booking handlers
import {
  handleCheckCustomerTrust,
  handleSecureCreateAppointment,
  handleSecureCreateReservation,
  type ToolContext,
} from '../../tools/handlers';

// ======================
// DATE/TIME UTILITIES
// Industry-Standard Defensive Validation
// ======================

/**
 * Error codes for datetime validation failures.
 * Following ADR-0001: Explicit error codes for debugging and monitoring.
 */
const DateTimeErrorCode = {
  INVALID_DATE_FORMAT: 'DT_ERR_001',
  INVALID_DATE_VALUE: 'DT_ERR_002',
  INVALID_TIME_FORMAT: 'DT_ERR_003',
  // DT_ERR_004 reserved for future use (INVALID_TIME_VALUE)
  INVALID_ISO_STRING: 'DT_ERR_005',
  INVALID_DURATION: 'DT_ERR_006',
  // DT_ERR_007 reserved for future use (DATE_OUT_OF_RANGE)
} as const;

type DateTimeErrorCodeType = (typeof DateTimeErrorCode)[keyof typeof DateTimeErrorCode];

/**
 * Result type for datetime operations following the Result Pattern.
 * Provides explicit success/failure handling without exceptions.
 */
interface DateTimeResult {
  success: boolean;
  value: string;
  error?: {
    code: DateTimeErrorCodeType;
    message: string;
    input: Record<string, unknown>;
  };
}

// ----------------------
// Validation Functions
// ----------------------

/**
 * Validates date format (YYYY-MM-DD) and checks if it represents a valid calendar date.
 * Catches edge cases like 2024-02-30 (February doesn't have 30 days).
 *
 * @param date - String to validate
 * @returns true if valid YYYY-MM-DD format AND valid calendar date
 */
function isValidDateFormat(date: unknown): date is string {
  if (typeof date !== 'string' || !date) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  // Parse and verify - catches invalid dates like 2024-02-30
  const parsed = new Date(`${date}T12:00:00Z`); // Use noon UTC to avoid timezone issues
  if (isNaN(parsed.getTime())) return false;

  // Verify components match (JavaScript Date auto-corrects invalid dates)
  const [year, month, day] = date.split('-').map(Number);
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

/**
 * Validates time format (HH:MM) and checks if values are within valid ranges.
 *
 * @param time - String to validate
 * @returns true if valid HH:MM format (00:00 - 23:59)
 */
function isValidTimeFormat(time: unknown): time is string {
  if (typeof time !== 'string' || !time) return false;
  if (!/^\d{2}:\d{2}$/.test(time)) return false;

  const [hours, minutes] = time.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Validates an ISO 8601 datetime string.
 *
 * @param isoString - String to validate
 * @returns true if valid ISO 8601 datetime
 */
function isValidISO8601(isoString: unknown): isoString is string {
  if (typeof isoString !== 'string' || !isoString) return false;
  const parsed = new Date(isoString);
  return !isNaN(parsed.getTime());
}

/**
 * Validates that a date is within acceptable business range.
 * Prevents booking dates too far in the past or future.
 *
 * @param date - Date string in YYYY-MM-DD format
 * @param maxFutureDays - Maximum days in the future (default: 365)
 * @param maxPastDays - Maximum days in the past (default: 0 = today only)
 * @returns true if date is within acceptable range
 */
function isDateInBusinessRange(
  date: string,
  maxFutureDays: number = 365,
  maxPastDays: number = 0
): boolean {
  const inputDate = new Date(`${date}T12:00:00Z`);
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);

  const diffDays = Math.floor((inputDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= -maxPastDays && diffDays <= maxFutureDays;
}

// ----------------------
// Core DateTime Functions
// ----------------------

/**
 * Creates an ISO 8601 datetime string from date and time components.
 * Ensures consistent datetime format across the entire booking system.
 *
 * DEFENSIVE VALIDATION (v2.3):
 * - Validates date format (YYYY-MM-DD)
 * - Validates time format (HH:MM)
 * - Validates resulting datetime is valid
 * - Returns Result type for explicit error handling
 *
 * @param date - Date in YYYY-MM-DD format
 * @param time - Time in HH:MM format
 * @returns DateTimeResult with success status and ISO 8601 string or error details
 *
 * @example
 * const result = toISO8601DateTimeSafe('2024-01-15', '10:00');
 * if (result.success) {
 *   console.log(result.value); // '2024-01-15T16:00:00.000Z' (UTC)
 * } else {
 *   console.error(result.error); // { code: 'DT_ERR_001', message: '...', input: {...} }
 * }
 */
function toISO8601DateTimeSafe(date: string, time: string): DateTimeResult {
  // Validation 1: Date format
  if (!isValidDateFormat(date)) {
    return {
      success: false,
      value: '',
      error: {
        code: DateTimeErrorCode.INVALID_DATE_FORMAT,
        message: `Invalid date format. Expected YYYY-MM-DD, received: "${date}"`,
        input: { date, time },
      },
    };
  }

  // Validation 2: Time format
  if (!isValidTimeFormat(time)) {
    return {
      success: false,
      value: '',
      error: {
        code: DateTimeErrorCode.INVALID_TIME_FORMAT,
        message: `Invalid time format. Expected HH:MM, received: "${time}"`,
        input: { date, time },
      },
    };
  }

  // Validation 3: Business range (optional, warn only in logs)
  if (!isDateInBusinessRange(date)) {
    // Log warning but don't fail - business logic may allow extended ranges
    console.warn(
      `[BookingAgent] Date "${date}" is outside typical business range (today to +365 days)`
    );
  }

  // Create datetime - at this point inputs are validated
  const datetime = new Date(`${date}T${time}:00`);

  // Final validation: Ensure Date object is valid (should always pass after above validations)
  if (isNaN(datetime.getTime())) {
    return {
      success: false,
      value: '',
      error: {
        code: DateTimeErrorCode.INVALID_DATE_VALUE,
        message: `Failed to parse datetime from validated inputs: "${date}T${time}:00"`,
        input: { date, time },
      },
    };
  }

  return {
    success: true,
    value: datetime.toISOString(),
  };
}

/**
 * Legacy function for backward compatibility.
 * Creates an ISO 8601 datetime string from date and time components.
 *
 * @param date - Date in YYYY-MM-DD format
 * @param time - Time in HH:MM format
 * @returns ISO 8601 datetime string (YYYY-MM-DDTHH:mm:ss.sssZ)
 * @throws Error if inputs are invalid (use toISO8601DateTimeSafe for non-throwing version)
 *
 * @example
 * toISO8601DateTime('2024-01-15', '10:00')
 * // => '2024-01-15T16:00:00.000Z' (UTC, depends on local timezone)
 */
function toISO8601DateTime(date: string, time: string): string {
  const result = toISO8601DateTimeSafe(date, time);

  if (!result.success) {
    // Log error for monitoring
    console.error('[BookingAgent] DateTime validation failed:', result.error);

    // Throw with descriptive message for debugging
    throw new Error(
      `[${result.error?.code}] ${result.error?.message}. ` +
        `This indicates a bug in the calling code - date/time should be validated before reaching this point.`
    );
  }

  return result.value;
}

/**
 * Calculates an end datetime by adding duration to a start datetime.
 *
 * DEFENSIVE VALIDATION (v2.3):
 * - Validates startIso is a valid ISO 8601 string
 * - Validates duration is a positive finite number
 * - Returns Result type for explicit error handling
 *
 * @param startIso - ISO 8601 start datetime
 * @param durationMinutes - Duration in minutes to add (must be >= 0)
 * @returns DateTimeResult with success status and ISO 8601 end datetime or error
 */
function addMinutesToISOSafe(startIso: string, durationMinutes: number): DateTimeResult {
  // Validation 1: ISO string format
  if (!isValidISO8601(startIso)) {
    return {
      success: false,
      value: '',
      error: {
        code: DateTimeErrorCode.INVALID_ISO_STRING,
        message: `Invalid ISO 8601 datetime string: "${startIso}"`,
        input: { startIso, durationMinutes },
      },
    };
  }

  // Validation 2: Duration is valid number
  if (typeof durationMinutes !== 'number' || !Number.isFinite(durationMinutes)) {
    return {
      success: false,
      value: '',
      error: {
        code: DateTimeErrorCode.INVALID_DURATION,
        message: `Duration must be a finite number, received: ${durationMinutes} (${typeof durationMinutes})`,
        input: { startIso, durationMinutes },
      },
    };
  }

  // Validation 3: Duration is non-negative
  if (durationMinutes < 0) {
    return {
      success: false,
      value: '',
      error: {
        code: DateTimeErrorCode.INVALID_DURATION,
        message: `Duration must be non-negative, received: ${durationMinutes}`,
        input: { startIso, durationMinutes },
      },
    };
  }

  // Calculate end datetime
  const datetime = new Date(startIso);
  datetime.setMinutes(datetime.getMinutes() + durationMinutes);

  return {
    success: true,
    value: datetime.toISOString(),
  };
}

/**
 * Legacy function for backward compatibility.
 * Calculates an end datetime by adding duration to a start datetime.
 *
 * @param startIso - ISO 8601 start datetime
 * @param durationMinutes - Duration in minutes to add
 * @returns ISO 8601 end datetime string
 * @throws Error if inputs are invalid (use addMinutesToISOSafe for non-throwing version)
 */
function addMinutesToISO(startIso: string, durationMinutes: number): string {
  const result = addMinutesToISOSafe(startIso, durationMinutes);

  if (!result.success) {
    console.error('[BookingAgent] Duration calculation failed:', result.error);
    throw new Error(
      `[${result.error?.code}] ${result.error?.message}. ` +
        `This indicates a bug in the calling code.`
    );
  }

  return result.value;
}

// ======================
// BOOKING AGENT
// ======================

/**
 * Agente de Booking
 *
 * Este es el agente más crítico del sistema. Responsabilidades:
 * 1. Recopilar información necesaria para agendar
 * 2. Verificar disponibilidad
 * 3. Crear la cita en el sistema
 * 4. Confirmar los detalles al cliente
 *
 * ARQUITECTURA HÍBRIDA:
 * - Tool Calling para: get_service_info, list_services, get_available_slots, get_branch_info, get_staff_info
 * - Lógica directa para: createBooking (seguridad)
 */
class BookingAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'booking',
      description: 'Agente de agendamiento de citas',
      systemPromptTemplate: `Eres el especialista en agendamiento de {{TENANT_NAME}}.

# TU ROL
Tu trabajo es ayudar a los clientes a agendar citas de manera eficiente y amable.
- Recopila la información necesaria (fecha, hora, servicio)
- Verifica disponibilidad
- Confirma todos los detalles
- Asegúrate de que el cliente tenga toda la información

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- Sé proactivo en ofrecer opciones
- NO uses emojis a menos que el cliente los use primero

# INFORMACIÓN NECESARIA PARA AGENDAR
1. Servicio deseado (si no está claro)
2. Fecha preferida (o flexibilidad)
3. Horario preferido (mañana, tarde, hora específica)
4. Sucursal preferida (si hay múltiples)
5. Nombre del cliente (si no lo tenemos)

# INSTRUCCIONES ESPECÍFICAS
- Si el cliente da fecha/hora específica, verifica disponibilidad
- Si el cliente es flexible, ofrece las próximas opciones disponibles
- Siempre confirma TODOS los detalles antes de crear la cita
- Después de agendar, proporciona: fecha, hora, dirección, y preparación si aplica
- Si no hay disponibilidad en la fecha solicitada, ofrece alternativas

# EJEMPLO DE RESPUESTAS

Cliente: "Quiero agendar una cita"
Tú: "¡Con gusto! ¿Para qué servicio te gustaría agendar y tienes alguna fecha en mente?"

Cliente: "Para mañana"
Tú: "Perfecto. Para mañana tenemos disponible a las 10:00am, 2:00pm y 4:00pm. ¿Cuál horario te funciona mejor?"

Cliente: "A las 10"
Tú: "Excelente. Te confirmo tu cita para mañana [fecha] a las 10:00am en [sucursal]. La dirección es [dirección]. ¿Es correcto?"

# USO OBLIGATORIO DE HERRAMIENTAS
NUNCA inventes información. Usa las herramientas para obtener datos reales.

1. Información de servicios:
   - USA get_service_info(service_name="nombre") para servicio específico
   - USA list_services() para ver todos los servicios disponibles

2. Disponibilidad de horarios:
   - USA get_available_slots(date="YYYY-MM-DD") para fecha específica
   - USA get_available_slots() sin fecha para próximos disponibles
   - Si retorna vacío → responde "No hay disponibilidad ese día, ¿te parece el [siguiente día con slots]?"

3. Información de sucursales:
   - USA get_branch_info() para obtener sucursales y direcciones

# FLUJO DE AGENDAMIENTO
1. Si falta SERVICIO → pregunta o usa list_services para sugerir
2. Si falta FECHA → pregunta preferencia o ofrece próximos slots
3. Si falta HORA → usa get_available_slots y presenta opciones
4. Si falta SUCURSAL (y hay varias) → pregunta cuál prefiere
5. ANTES de crear cita → CONFIRMA todos los detalles con el cliente

# MANEJO DE ERRORES
- get_available_slots vacío → ofrece fechas alternativas cercanas
- Servicio no existe → sugiere servicios similares de list_services
- Sucursal no especificada → pregunta o usa la principal

# IMPORTANTE
La creación de citas se ejecuta automáticamente cuando tengas: servicio, fecha, hora, sucursal.
Siempre CONFIRMA con el cliente antes de proceder.`,
      temperature: 0.4, // Bajo para consistencia en datos
      maxTokens: 400,
      canHandoffTo: ['pricing', 'location', 'escalation'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const tenant = state.tenant;
    const lead = state.lead;
    const extracted = state.extracted_data;

    // 1. Extraer datos de booking del mensaje
    const bookingData = extractBookingData(state.current_message);

    // 2. Combinar con datos ya extraídos
    const preferredDate = extracted.preferred_date || bookingData.date;
    const preferredTime = extracted.preferred_time || bookingData.time;
    const isFlexible = extracted.is_flexible_schedule || bookingData.is_flexible;

    // 3. Determinar sucursal
    let branchId: string | undefined;
    const branches = state.business_context?.branches || [];

    if (lead?.preferred_branch_id) {
      branchId = lead.preferred_branch_id;
    } else if (extracted.preferred_branch) {
      const branch = branches.find((b) =>
        b.name.toLowerCase().includes(extracted.preferred_branch!.toLowerCase())
      );
      branchId = branch?.id;
    } else if (branches.length === 1) {
      branchId = branches[0].id;
    }

    // 4. Determinar servicio
    let serviceId: string | undefined;
    const services = state.business_context?.services || [];

    if (extracted.service_interest?.service_id) {
      serviceId = extracted.service_interest.service_id;
    } else {
      // Buscar en el mensaje
      const messageLower = state.current_message.toLowerCase();
      for (const service of services) {
        if (messageLower.includes(service.name.toLowerCase())) {
          serviceId = service.id;
          break;
        }
      }
    }

    // 5. Verificar si tenemos suficiente información para crear cita
    const hasEnoughInfo = preferredDate && (preferredTime || isFlexible) && branchId;

    if (hasEnoughInfo && tenant) {
      // Intentar crear la cita
      const bookingRequest: BookingRequest = {
        tenant_id: tenant.tenant_id,
        lead_id: lead?.lead_id || '',
        conversation_id: state.conversation?.conversation_id || '',
        branch_id: branchId,
        service_id: serviceId,
        requested_date: preferredDate,
        requested_time: preferredTime,
        // AI traceability
        ai_booking_channel: state.channel === 'voice' ? 'ai_voice' : state.channel === 'whatsapp' ? 'ai_whatsapp' : 'ai_webchat',
      };

      const bookingResult = await createBooking(bookingRequest);

      if (bookingResult.success) {
        // Cita creada exitosamente
        const confirmationMessage = generateBookingConfirmation(bookingResult);

        return {
          response: confirmationMessage,
          tokens_used: 0,
        };
      } else {
        // No se pudo crear, ofrecer alternativas
        let alternativeContext = `\nNOTA: No se pudo crear la cita. Razón: ${bookingResult.error}`;

        if (bookingResult.suggestion) {
          alternativeContext += `\nSugerencia: ${bookingResult.suggestion}`;
        }

        // Obtener slots disponibles
        if (branchId && tenant) {
          const slots = await getAvailableSlots(tenant.tenant_id, branchId, undefined, undefined, undefined, 5);
          if (slots.length > 0) {
            alternativeContext += `\n\nHorarios disponibles próximos:`;
            for (const slot of slots) {
              const date = new Date(slot.date + 'T12:00:00');
              const dateStr = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
              alternativeContext += `\n- ${dateStr} a las ${slot.time} en ${slot.branch_name}`;
            }
          }
        }

        alternativeContext += '\n\nOfrece alternativas de horario al cliente.';

        let response: string;
        let tokens: number;

        // ARQUITECTURA V7: Siempre usar Tool Calling
        const allTools = createToolsForAgent(this.config.name, state);
        const consultationTools = allTools.filter(t => t.name !== TOOL_NAMES.CREATE_APPOINTMENT);

        const result = await this.callLLMWithTools(state, consultationTools, alternativeContext);
        response = result.response;
        tokens = result.tokens;

        return {
          response,
          tokens_used: tokens,
        };
      }
    } else {
      // No tenemos suficiente información, preguntar lo que falta
      let missingInfo: string[] = [];

      if (!branchId && branches.length > 1) {
        missingInfo.push('sucursal preferida');
      }
      if (!preferredDate) {
        missingInfo.push('fecha preferida');
      }
      if (!preferredTime && !isFlexible) {
        missingInfo.push('horario preferido');
      }
      if (!serviceId && services.length > 1) {
        missingInfo.push('servicio deseado');
      }

      let additionalContext = '';

      if (missingInfo.length > 0) {
        additionalContext += `\nNOTA: Falta información para agendar: ${missingInfo.join(', ')}. Pregunta de manera natural.`;
      }

      // Obtener disponibilidad para ofrecer opciones (se pasa como contexto adicional)
      if (tenant && branchId) {
        const slots = await getAvailableSlots(tenant.tenant_id, branchId, undefined, undefined, undefined, 5);
        if (slots.length > 0) {
          additionalContext += `\n\n# PRÓXIMOS HORARIOS DISPONIBLES\n`;
          for (const slot of slots) {
            const date = new Date(slot.date + 'T12:00:00');
            const dateStr = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
            additionalContext += `- ${dateStr} a las ${slot.time}\n`;
          }
        }
      }

      // =====================================================
      // ARQUITECTURA V7: Tool Calling para consultas
      // El LLM usa tools para obtener info de servicios/sucursales
      // La creación de citas se controla directamente (seguridad)
      // =====================================================
      const allTools = createToolsForAgent(this.config.name, state);
      const consultationTools = allTools.filter(t => t.name !== TOOL_NAMES.CREATE_APPOINTMENT);

      console.log(`[booking] Using V7 Architecture with ${consultationTools.length} consultation tools`);

      const result = await this.callLLMWithTools(state, consultationTools, additionalContext);

      console.log(`[booking] Tool calls made: ${result.toolCalls.join(', ') || 'none'}`);

      return {
        response: result.response,
        tokens_used: result.tokens,
      };
    }
  }
}

// ======================
// VERTICAL-SPECIFIC BOOKING AGENTS
// ======================

/**
 * Booking Agent para Dental
 * Incluye preguntas específicas sobre síntomas y detección de urgencia
 *
 * IMPORTANTE: Este agente usa información de urgencia detectada por el vertical-router
 * para priorizar citas, pero NO modifica el prompt base.
 *
 * SECURE BOOKING v2.2:
 * - Verificación de trust del cliente antes de crear cita
 * - Sistema de holds temporales para evitar doble booking
 * - Manejo de depósitos para clientes con historial de no-shows
 */
class BookingDentalAgentClass extends BookingAgentClass {
  constructor() {
    super();
    this.config.name = 'booking_dental';
    this.config.systemPromptTemplate += `

# INSTRUCCIONES ESPECÍFICAS PARA DENTAL
- Pregunta si tiene dolor o molestia actual
- Si hay dolor, ofrece cita de urgencia
- Pregunta si es primera vez o paciente recurrente
- Menciona que debe traer estudios previos si los tiene`;
  }

  /**
   * Build ToolContext from TISTISAgentStateType for secure booking handlers
   */
  private buildToolContext(state: TISTISAgentStateType): ToolContext {
    return {
      tenant_id: state.tenant?.tenant_id || '',
      lead_id: state.lead?.lead_id || '',
      business_context: state.business_context,
      lead: state.lead,
      vertical: 'dental',
    };
  }

  /**
   * Override de execute para dental
   * ARQUITECTURA V7 + SECURE BOOKING v2.2:
   * - Tool Calling para obtener información
   * - Secure Booking para verificación de trust y holds
   *
   * Usa la información de urgencia del metadata para:
   * 1. Priorizar la búsqueda de slots (mismo día para urgencias)
   * 2. Añadir contexto sobre la urgencia detectada al LLM
   * 3. Guardar datos de trazabilidad AI en la cita
   */
  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const tenant = state.tenant;
    const lead = state.lead;
    const extracted = state.extracted_data;

    // 1. Obtener información de urgencia del metadata (detectada por vertical-router)
    const dentalUrgency = state.metadata?.dental_urgency as {
      level: number;
      type: string;
      symptoms: string[];
      recommended_timeframe: string;
      is_urgent: boolean;
    } | undefined;

    // 2. Extraer datos de booking del mensaje
    const bookingData = extractBookingData(state.current_message);

    // 3. Combinar con datos ya extraídos
    let preferredDate = extracted.preferred_date || bookingData.date;
    const preferredTime = extracted.preferred_time || bookingData.time;
    const isFlexible = extracted.is_flexible_schedule || bookingData.is_flexible;

    // 4. Para urgencias nivel 4-5, priorizar HOY si no especificó fecha
    if (dentalUrgency?.is_urgent && !preferredDate) {
      // Sugerir fecha de hoy para urgencias
      const today = new Date();
      preferredDate = today.toISOString().split('T')[0];
    }

    // 5. Determinar sucursal
    let branchId: string | undefined;
    const branches = state.business_context?.branches || [];

    if (lead?.preferred_branch_id) {
      branchId = lead.preferred_branch_id;
    } else if (extracted.preferred_branch) {
      const branch = branches.find((b) =>
        b.name.toLowerCase().includes(extracted.preferred_branch!.toLowerCase())
      );
      branchId = branch?.id;
    } else if (branches.length === 1) {
      branchId = branches[0].id;
    }

    // 6. Determinar servicio
    let serviceId: string | undefined;
    const services = state.business_context?.services || [];

    if (extracted.service_interest?.service_id) {
      serviceId = extracted.service_interest.service_id;
    } else {
      const messageLower = state.current_message.toLowerCase();
      for (const service of services) {
        if (messageLower.includes(service.name.toLowerCase())) {
          serviceId = service.id;
          break;
        }
      }
    }

    // 7. Verificar si tenemos suficiente información para crear cita
    const hasEnoughInfo = preferredDate && (preferredTime || isFlexible) && branchId;

    if (hasEnoughInfo && tenant && preferredDate) {
      // =====================================================
      // SECURE BOOKING v2.2: Use secure appointment flow
      // =====================================================
      const toolContext = this.buildToolContext(state);

      // Try secure booking (handles trust verification, holds, etc.)
      const secureResult = await handleSecureCreateAppointment(
        {
          date: preferredDate,
          time: preferredTime || '10:00', // Default morning
          service_id: serviceId,
          branch_id: branchId,
          notes: dentalUrgency?.symptoms?.length ? `Síntomas: ${dentalUrgency.symptoms.join(', ')}` : undefined,
          skip_trust_check: false,
        },
        toolContext
      );

      // Handle error response
      if ('error' in secureResult && typeof secureResult.error === 'string' && !('success' in secureResult)) {
        return {
          response: secureResult.error,
          tokens_used: 0,
        };
      }

      const appointmentResult = secureResult as Exclude<typeof secureResult, { error: string }>;

      if (appointmentResult.success) {
        // ARQUITECTURA LANGGRAPH: Usar delta updates
        // El reducer hace shallow merge: (prev, next) => ({ ...prev, ...next })
        // Solo enviamos los campos que cambiaron - el reducer los mezcla con el estado existente
        return {
          response: appointmentResult.confirmation_message,
          tokens_used: 0,
          state_updates: {
            secure_booking: {
              trust_verified: true,
              customer_confirmed: true,
            },
          },
        };
      }

      // Handle deposit required case
      if (appointmentResult.error_code === 'DEPOSIT_REQUIRED') {
        // ARQUITECTURA LANGGRAPH: Construir nuevo estado inmutable con el hold agregado
        // Usar deposit_amount_cents del resultado o de la política, con fallback a valor por defecto
        const depositAmountCents = appointmentResult.deposit_amount_cents
          ?? state.secure_booking?.booking_policy?.deposit_amount_cents
          ?? 10000; // Default: $100 MXN

        // ISO 8601 Standard: Use toISO8601DateTime for consistent datetime format
        const slotTime = preferredTime || '10:00'; // Default morning for dental
        const slotDatetimeISO = toISO8601DateTime(preferredDate, slotTime);

        // Construir el nuevo hold si tenemos hold_id
        if (!appointmentResult.hold_id) {
          return {
            response: appointmentResult.confirmation_message,
            tokens_used: 0,
          };
        }

        const newHold = {
          hold_id: appointmentResult.hold_id,
          slot_datetime: slotDatetimeISO,
          end_datetime: addMinutesToISO(slotDatetimeISO, 60), // 1 hour appointment
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          requires_deposit: true,
          deposit_amount_cents: depositAmountCents,
          trust_score_at_hold: appointmentResult.trust_score_at_booking ?? 70,
          hold_type: 'appointment' as const,
          vertical: 'dental' as const,
        };

        // ARQUITECTURA LANGGRAPH: Para arrays, enviamos el array completo
        // porque el shallow merge REEMPLAZA arrays, no los concatena
        const existingHolds = state.secure_booking?.active_holds || [];

        return {
          response: appointmentResult.confirmation_message,
          tokens_used: 0,
          state_updates: {
            secure_booking: {
              active_holds: [...existingHolds, newHold],
            },
          },
        };
      }

      // Handle blocked customer
      if (appointmentResult.error_code === 'BLOCKED') {
        return {
          response: appointmentResult.error || 'Lo siento, no podemos procesar tu cita en este momento. Por favor contacta directamente a la clínica.',
          tokens_used: 0,
        };
      }

      // Handle no availability or slot held - offer alternatives
      if (appointmentResult.error_code === 'NO_AVAILABILITY' || appointmentResult.error_code === 'SLOT_HELD') {
        let alternativeContext = `\n\nNOTA: ${appointmentResult.confirmation_message || 'No se pudo crear la cita.'}`;

        // Para urgencias, priorizar slots del mismo día
        if (branchId && tenant) {
          const slots = await getAvailableSlots(
            tenant.tenant_id,
            branchId,
            undefined,
            undefined,
            undefined,
            dentalUrgency?.is_urgent ? 3 : 5
          );

          if (slots.length > 0) {
            alternativeContext += dentalUrgency?.is_urgent
              ? `\n\nHorarios de URGENCIA disponibles:`
              : `\n\nHorarios disponibles próximos:`;

            for (const slot of slots) {
              const date = new Date(slot.date + 'T12:00:00');
              const dateStr = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
              alternativeContext += `\n- ${dateStr} a las ${slot.time} en ${slot.branch_name}`;
            }
          }
        }

        const allTools = createToolsForAgent('booking_dental', state);
        const consultationTools = allTools.filter(t => t.name !== TOOL_NAMES.CREATE_APPOINTMENT);

        const result = await this.callLLMWithTools(
          state,
          consultationTools,
          `${alternativeContext}\n\nOfrece alternativas de horario al cliente.`
        );

        return {
          response: result.response,
          tokens_used: result.tokens,
        };
      }

      // Fallback to legacy booking flow
      const bookingRequest: BookingRequest = {
        tenant_id: tenant.tenant_id,
        lead_id: lead?.lead_id || '',
        conversation_id: state.conversation?.conversation_id || '',
        branch_id: branchId,
        service_id: serviceId,
        requested_date: preferredDate,
        requested_time: preferredTime,
        vertical: 'dental',
        ai_booking_channel: state.channel === 'voice' ? 'ai_voice' : state.channel === 'whatsapp' ? 'ai_whatsapp' : 'ai_webchat',
        ai_urgency_level: dentalUrgency?.level,
        ai_detected_symptoms: dentalUrgency?.symptoms,
      };

      const bookingResult = await createBooking(bookingRequest);

      if (bookingResult.success) {
        const confirmationMessage = generateBookingConfirmation(bookingResult);
        return {
          response: confirmationMessage,
          tokens_used: 0,
        };
      } else {
        // No se pudo crear, ofrecer alternativas
        let alternativeContext = `\n\nNOTA: No se pudo crear la cita. Razón: ${bookingResult.error}`;

        if (bookingResult.suggestion) {
          alternativeContext += `\nSugerencia: ${bookingResult.suggestion}`;
        }

        // Para urgencias, priorizar slots del mismo día
        if (branchId && tenant) {
          const slots = await getAvailableSlots(
            tenant.tenant_id,
            branchId,
            undefined,
            undefined,
            undefined,
            dentalUrgency?.is_urgent ? 3 : 5 // Menos slots pero más inmediatos para urgencias
          );

          if (slots.length > 0) {
            alternativeContext += dentalUrgency?.is_urgent
              ? `\n\nHorarios de URGENCIA disponibles:`
              : `\n\nHorarios disponibles próximos:`;

            for (const slot of slots) {
              const date = new Date(slot.date + 'T12:00:00');
              const dateStr = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
              alternativeContext += `\n- ${dateStr} a las ${slot.time} en ${slot.branch_name}`;
            }
          }
        }

        // ARQUITECTURA V7: Usar Tool Calling
        const allTools = createToolsForAgent('booking_dental', state);
        const consultationTools = allTools.filter(t => t.name !== TOOL_NAMES.CREATE_APPOINTMENT);

        const result = await this.callLLMWithTools(
          state,
          consultationTools,
          `${alternativeContext}\n\nOfrece alternativas de horario al cliente.`
        );

        return {
          response: result.response,
          tokens_used: result.tokens,
        };
      }
    } else {
      // No tenemos suficiente información, preguntar lo que falta
      let missingInfo: string[] = [];

      if (!branchId && branches.length > 1) {
        missingInfo.push('sucursal preferida');
      }
      if (!preferredDate) {
        missingInfo.push('fecha preferida');
      }
      if (!preferredTime && !isFlexible) {
        missingInfo.push('horario preferido');
      }
      if (!serviceId && services.length > 1) {
        missingInfo.push('servicio deseado');
      }

      let additionalContext = '';

      // 8. Añadir contexto de urgencia detectada (NO modifica prompt, solo contexto)
      if (dentalUrgency && dentalUrgency.level >= 3) {
        additionalContext += `\n\n# INFORMACIÓN DE URGENCIA DETECTADA`;
        additionalContext += `\nNivel: ${dentalUrgency.level}/5`;
        additionalContext += `\nTipo: ${dentalUrgency.type}`;
        if (dentalUrgency.symptoms.length > 0) {
          additionalContext += `\nSíntomas mencionados: ${dentalUrgency.symptoms.join(', ')}`;
        }
        additionalContext += `\nRecomendación: Agendar ${dentalUrgency.recommended_timeframe}`;
        additionalContext += `\nNOTA: Prioriza ofrecer citas inmediatas para este paciente.`;
      }

      // Obtener disponibilidad
      if (tenant && branchId) {
        const slots = await getAvailableSlots(tenant.tenant_id, branchId, undefined, undefined, undefined, 5);
        if (slots.length > 0) {
          additionalContext += `\n\n# PRÓXIMOS HORARIOS DISPONIBLES\n`;
          for (const slot of slots) {
            const date = new Date(slot.date + 'T12:00:00');
            const dateStr = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
            additionalContext += `- ${dateStr} a las ${slot.time}\n`;
          }
        }
      }

      if (missingInfo.length > 0) {
        additionalContext += `\n\nNOTA: Falta información para agendar: ${missingInfo.join(', ')}. Pregunta de manera natural.`;
      }

      // ARQUITECTURA V7: Usar Tool Calling
      const allTools = createToolsForAgent('booking_dental', state);
      const consultationTools = allTools.filter(t => t.name !== TOOL_NAMES.CREATE_APPOINTMENT);

      const result = await this.callLLMWithTools(state, consultationTools, additionalContext);

      return {
        response: result.response,
        tokens_used: result.tokens,
      };
    }
  }
}

/**
 * Booking Agent para Restaurantes
 * Incluye preguntas sobre número de personas y ocasión
 *
 * SECURE BOOKING v2.2:
 * - Verificación de trust del cliente antes de crear reservación
 * - Sistema de holds temporales para evitar overbooking
 * - Manejo de depósitos para clientes con bajo trust score
 */
class BookingRestaurantAgentClass extends BookingAgentClass {
  constructor() {
    super();
    this.config.name = 'booking_restaurant';
    this.config.systemPromptTemplate = this.config.systemPromptTemplate.replace(
      '# INFORMACIÓN NECESARIA PARA AGENDAR',
      `# INFORMACIÓN NECESARIA PARA RESERVAR
1. Fecha de la reserva
2. Hora deseada
3. Número de personas
4. Si es ocasión especial (cumpleaños, aniversario, etc.)
5. Preferencias de ubicación (terraza, privado, etc.)`
    );
  }

  /**
   * Build ToolContext from TISTISAgentStateType for secure booking handlers
   */
  private buildToolContext(state: TISTISAgentStateType): ToolContext {
    return {
      tenant_id: state.tenant?.tenant_id || '',
      lead_id: state.lead?.lead_id || '',
      business_context: state.business_context,
      lead: state.lead,
      vertical: 'restaurant',
    };
  }

  /**
   * ARQUITECTURA V7 + SECURE BOOKING v2.2:
   * - Tool Calling para obtener información
   * - Secure Booking para verificación de trust y holds
   */
  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const tenant = state.tenant;
    const lead = state.lead;
    const extracted = state.extracted_data;

    // Extract booking data including restaurant-specific fields
    const bookingData = extractBookingData(state.current_message);

    const preferredDate = extracted.preferred_date || bookingData.date;
    const preferredTime = extracted.preferred_time || bookingData.time;
    const isFlexible = extracted.is_flexible_schedule || bookingData.is_flexible;

    // Determine branch
    let branchId: string | undefined;
    const branches = state.business_context?.branches || [];

    if (lead?.preferred_branch_id) {
      branchId = lead.preferred_branch_id;
    } else if (extracted.preferred_branch) {
      const branch = branches.find((b) =>
        b.name.toLowerCase().includes(extracted.preferred_branch!.toLowerCase())
      );
      branchId = branch?.id;
    } else if (branches.length === 1) {
      branchId = branches[0].id;
    }

    // For restaurant, check if we have party_size (required)
    const partySize = bookingData.party_size || extracted.party_size;
    const occasion = bookingData.occasion || extracted.occasion;
    const specialRequests = bookingData.special_requests;

    // Verify we have enough info for restaurant reservation
    const hasEnoughInfo = preferredDate && (preferredTime || isFlexible) && branchId && partySize;

    if (hasEnoughInfo && tenant) {
      // =====================================================
      // SECURE BOOKING v2.2: Use secure reservation flow
      // =====================================================
      const toolContext = this.buildToolContext(state);

      // Try secure booking (handles trust verification, holds, etc.)
      const secureResult = await handleSecureCreateReservation(
        {
          date: preferredDate,
          time: preferredTime || '19:00', // Default dinner time
          party_size: partySize,
          branch_id: branchId,
          special_requests: specialRequests || (occasion ? `Ocasión: ${occasion}` : undefined),
          skip_trust_check: false,
        },
        toolContext
      );

      // Handle error response
      if ('error' in secureResult && typeof secureResult.error === 'string' && !('success' in secureResult)) {
        return {
          response: secureResult.error,
          tokens_used: 0,
        };
      }

      const bookingResult = secureResult as Exclude<typeof secureResult, { error: string }>;

      if (bookingResult.success) {
        // ARQUITECTURA LANGGRAPH: Usar delta updates
        // El reducer hace shallow merge - solo enviamos los campos que cambiaron
        return {
          response: bookingResult.confirmation_message,
          tokens_used: 0,
          state_updates: {
            secure_booking: {
              trust_verified: true,
              customer_confirmed: true,
            },
          },
        };
      }

      // Handle deposit required case
      if (bookingResult.error_code === 'DEPOSIT_REQUIRED') {
        // Usar deposit_amount_cents del resultado o de la política, con fallback a valor por defecto
        const depositAmountCents = bookingResult.deposit_amount_cents
          ?? state.secure_booking?.booking_policy?.deposit_amount_cents
          ?? 10000; // Default: $100 MXN

        // ISO 8601 Standard: Use toISO8601DateTime for consistent datetime format
        const slotTime = preferredTime || '19:00'; // Default dinner time for restaurant
        const slotDatetimeISO = toISO8601DateTime(preferredDate, slotTime);

        // Verificar que tenemos hold_id para crear el hold
        if (!bookingResult.hold_id) {
          return {
            response: bookingResult.confirmation_message,
            tokens_used: 0,
          };
        }

        const newHold = {
          hold_id: bookingResult.hold_id,
          slot_datetime: slotDatetimeISO,
          end_datetime: addMinutesToISO(slotDatetimeISO, 90), // 1.5 hour reservation
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          requires_deposit: true,
          deposit_amount_cents: depositAmountCents,
          trust_score_at_hold: bookingResult.trust_score_at_booking ?? 70,
          hold_type: 'reservation' as const,
          vertical: 'restaurant' as const,
        };

        // ARQUITECTURA LANGGRAPH: Para arrays, enviamos el array completo
        // porque el shallow merge REEMPLAZA arrays, no los concatena
        const existingHolds = state.secure_booking?.active_holds || [];

        return {
          response: bookingResult.confirmation_message,
          tokens_used: 0,
          state_updates: {
            secure_booking: {
              active_holds: [...existingHolds, newHold],
            },
          },
        };
      }

      // Handle blocked customer
      if (bookingResult.error_code === 'BLOCKED') {
        return {
          response: bookingResult.error || 'Lo siento, no podemos procesar tu reservación en este momento. Por favor contacta directamente al restaurante.',
          tokens_used: 0,
        };
      }

      // Handle no availability or slot held
      if (bookingResult.error_code === 'NO_AVAILABILITY' || bookingResult.error_code === 'SLOT_HELD') {
        let alternativeContext = `\n\nNOTA: ${bookingResult.confirmation_message || 'No se pudo crear la reservación.'}`;

        if (branchId && tenant) {
          const slots = await getAvailableSlots(tenant.tenant_id, branchId, undefined, undefined, undefined, 5);
          if (slots.length > 0) {
            alternativeContext += `\n\nHorarios disponibles próximos:`;
            for (const slot of slots) {
              const date = new Date(slot.date + 'T12:00:00');
              const dateStr = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
              alternativeContext += `\n- ${dateStr} a las ${slot.time}`;
            }
          }
        }

        // ARQUITECTURA V7: Usar Tool Calling
        const allTools = createToolsForAgent('booking_restaurant', state);
        const consultationTools = allTools.filter(t => t.name !== TOOL_NAMES.CREATE_APPOINTMENT);

        const result = await this.callLLMWithTools(
          state,
          consultationTools,
          `${alternativeContext}\n\nOfrece alternativas de horario al cliente.`
        );

        return { response: result.response, tokens_used: result.tokens };
      }

      // Fallback to legacy booking flow
      const bookingRequest: BookingRequest = {
        tenant_id: tenant.tenant_id,
        lead_id: lead?.lead_id || '',
        conversation_id: state.conversation?.conversation_id || '',
        branch_id: branchId,
        requested_date: preferredDate,
        requested_time: preferredTime,
        party_size: partySize,
        occasion_type: occasion,
        special_requests: specialRequests,
        vertical: 'restaurant',
        ai_booking_channel: state.channel === 'voice' ? 'ai_voice' : state.channel === 'whatsapp' ? 'ai_whatsapp' : 'ai_webchat',
      };

      const legacyResult = await createBooking(bookingRequest);

      if (legacyResult.success) {
        const confirmationMessage = generateBookingConfirmation(legacyResult);
        return {
          response: confirmationMessage,
          tokens_used: 0,
        };
      } else {
        let alternativeContext = `\n\nNOTA: No se pudo crear la reservación. Razón: ${legacyResult.error}`;
        if (legacyResult.suggestion) {
          alternativeContext += `\nSugerencia: ${legacyResult.suggestion}`;
        }

        const allTools = createToolsForAgent('booking_restaurant', state);
        const consultationTools = allTools.filter(t => t.name !== TOOL_NAMES.CREATE_APPOINTMENT);

        const result = await this.callLLMWithTools(
          state,
          consultationTools,
          `${alternativeContext}\n\nOfrece alternativas de horario al cliente.`
        );

        return { response: result.response, tokens_used: result.tokens };
      }
    } else {
      // Not enough info, ask for what's missing
      let missingInfo: string[] = [];

      if (!branchId && branches.length > 1) {
        missingInfo.push('sucursal preferida');
      }
      if (!preferredDate) {
        missingInfo.push('fecha de la reserva');
      }
      if (!preferredTime && !isFlexible) {
        missingInfo.push('hora deseada');
      }
      if (!partySize) {
        missingInfo.push('número de personas');
      }

      let additionalContext = '';
      // ARQUITECTURA LANGGRAPH: Usar delta updates para campos que cambiaron
      // Para objetos anidados (customer_trust) enviamos el objeto completo porque shallow merge los reemplaza
      let secureBookingDelta: Partial<import('../../state').SecureBookingContext> | undefined = undefined;

      // SECURE BOOKING v2.2: Check trust proactively if we have lead
      if (tenant && lead) {
        const toolContext = this.buildToolContext(state);
        const trustCheck = await handleCheckCustomerTrust({}, toolContext);

        if (!('error' in trustCheck) || 'success' in trustCheck) {
          const trustResult = trustCheck as Exclude<typeof trustCheck, { error: string }>;
          if (trustResult.is_vip) {
            additionalContext += `\n\n# CLIENTE VIP\nEste cliente es VIP. Trátaló con prioridad.`;
          } else if (trustResult.deposit_required) {
            additionalContext += `\n\n# NOTA: Este cliente requiere depósito para confirmar reservaciones.`;
          }

          // ARQUITECTURA LANGGRAPH: Delta update con objeto anidado completo
          // - enabled, trust_verified: campos escalares (delta)
          // - customer_trust: objeto anidado (completo, porque shallow merge lo reemplaza)
          secureBookingDelta = {
            enabled: true,
            trust_verified: true,
            customer_trust: {
              trust_score: trustResult.trust_score,
              trust_level: trustResult.trust_level,
              recommended_action: trustResult.recommended_action,
              is_vip: trustResult.is_vip,
              is_blocked: trustResult.is_blocked,
              block_reason: trustResult.block_reason,
              no_show_count: trustResult.no_show_count,
              completed_appointments: trustResult.completed_appointments,
              deposit_required: trustResult.deposit_required,
              deposit_amount_cents: trustResult.deposit_amount_cents,
            },
          };
        }
      }

      if (tenant && branchId) {
        const slots = await getAvailableSlots(tenant.tenant_id, branchId, undefined, undefined, undefined, 5);
        if (slots.length > 0) {
          additionalContext += `\n\n# PRÓXIMOS HORARIOS DISPONIBLES\n`;
          for (const slot of slots) {
            const date = new Date(slot.date + 'T12:00:00');
            const dateStr = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
            additionalContext += `- ${dateStr} a las ${slot.time}\n`;
          }
        }
      }

      if (missingInfo.length > 0) {
        additionalContext += `\n\nNOTA: Falta información para reservar: ${missingInfo.join(', ')}. Pregunta de manera natural.`;
      }

      // ARQUITECTURA V7: Usar Tool Calling
      const allTools = createToolsForAgent('booking_restaurant', state);
      const consultationTools = allTools.filter(t => t.name !== TOOL_NAMES.CREATE_APPOINTMENT);

      const result = await this.callLLMWithTools(state, consultationTools, additionalContext);

      // ARQUITECTURA LANGGRAPH: Retornar state_updates con el delta de secure_booking
      return {
        response: result.response,
        tokens_used: result.tokens,
        state_updates: secureBookingDelta ? { secure_booking: secureBookingDelta } : undefined,
      };
    }
  }
}

/**
 * Booking Agent para Servicios Médicos
 * Incluye preguntas sobre síntomas y urgencia
 */
class BookingMedicalAgentClass extends BookingAgentClass {
  constructor() {
    super();
    this.config.name = 'booking_medical';
    this.config.systemPromptTemplate += `

# INSTRUCCIONES ESPECÍFICAS PARA CONSULTAS MÉDICAS
- Pregunta por la especialidad que necesita
- Si menciona síntomas, pregunta la urgencia
- Pregunta si tiene seguro médico
- Recuerda mencionar que debe traer identificación y estudios previos`;
  }
}

// Instancias singleton
export const BookingAgent = new BookingAgentClass();
export const BookingDentalAgent = new BookingDentalAgentClass();
export const BookingRestaurantAgent = new BookingRestaurantAgentClass();
export const BookingMedicalAgent = new BookingMedicalAgentClass();

// Nodos para LangGraph
export const bookingNode = BookingAgent.toNode();
export const bookingDentalNode = BookingDentalAgent.toNode();
export const bookingRestaurantNode = BookingRestaurantAgent.toNode();
export const bookingMedicalNode = BookingMedicalAgent.toNode();

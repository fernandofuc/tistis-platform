// =====================================================
// TIS TIS PLATFORM - Booking Agent
// Agente especializado en agendar citas
// =====================================================
//
// ARQUITECTURA v6.0 (HÍBRIDA):
// - Mantiene lógica directa de booking por seguridad y control
// - Usa Tool Calling SOLO para consultas de información auxiliar
// - Tools disponibles: get_service_info, get_branch_info, get_staff_info
// - CREATE_APPOINTMENT se ejecuta directamente, NO via tool calling
//
// NOTA: El booking requiere un flujo controlado. El LLM NO debe
// decidir cuándo crear una cita - eso lo controla la lógica del agente.
// =====================================================

import { BaseAgent, type AgentResult, formatServicesForPrompt, formatBranchesForPrompt } from './base.agent';
import type { TISTISAgentStateType } from '../../state';
import {
  extractBookingData,
  createBooking,
  generateBookingConfirmation,
  getAvailableSlots,
  type BookingRequest,
} from '../../services/appointment-booking.service';
import { createToolsForAgent, TOOL_NAMES } from '../../tools';

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
  /** Flag para usar Tool Calling para consultas */
  protected useToolCalling: boolean = true;

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

# IMPORTANTE SOBRE HERRAMIENTAS
- USA get_service_info o list_services para obtener información de servicios
- USA get_available_slots para ver disponibilidad de horarios
- USA get_branch_info para información de sucursales
- La creación de citas la maneja el sistema automáticamente cuando tengas todos los datos`,
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

        if (this.useToolCalling) {
          const allTools = createToolsForAgent(this.config.name, state);
          const consultationTools = allTools.filter(t => t.name !== TOOL_NAMES.CREATE_APPOINTMENT);

          const result = await this.callLLMWithTools(state, consultationTools, alternativeContext);
          response = result.response;
          tokens = result.tokens;
        } else {
          const servicesContext = formatServicesForPrompt(state.business_context);
          const branchesContext = formatBranchesForPrompt(state.business_context);

          const result = await this.callLLM(state, `${servicesContext}\n${branchesContext}${alternativeContext}`);
          response = result.response;
          tokens = result.tokens;
        }

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

      let response: string;
      let tokens: number;

      if (this.useToolCalling) {
        // =====================================================
        // ARQUITECTURA HÍBRIDA: Tool Calling para consultas
        // El LLM puede usar tools para obtener info de servicios/sucursales
        // pero NO para crear citas (eso lo controla este agente)
        // =====================================================
        const allTools = createToolsForAgent(this.config.name, state);
        // Filtrar CREATE_APPOINTMENT - eso lo controlamos nosotros
        const consultationTools = allTools.filter(t => t.name !== TOOL_NAMES.CREATE_APPOINTMENT);

        console.log(`[booking] Using Tool Calling mode with ${consultationTools.length} consultation tools`);

        const result = await this.callLLMWithTools(state, consultationTools, additionalContext);
        response = result.response;
        tokens = result.tokens;

        console.log(`[booking] Tool calls made: ${result.toolCalls.join(', ') || 'none'}`);
      } else {
        // =====================================================
        // MODO LEGACY: Context Stuffing
        // =====================================================
        console.log(`[booking] Using legacy mode (context stuffing)`);

        const servicesContext = formatServicesForPrompt(state.business_context);
        const branchesContext = formatBranchesForPrompt(state.business_context);

        const result = await this.callLLM(state, `${servicesContext}\n${branchesContext}${additionalContext}`);
        response = result.response;
        tokens = result.tokens;
      }

      return {
        response,
        tokens_used: tokens,
      };
    }
  }

  /**
   * Habilita o deshabilita Tool Calling para consultas
   * La creación de citas siempre es controlada directamente
   */
  setToolCallingMode(enabled: boolean): void {
    this.useToolCalling = enabled;
    console.log(`[booking] Tool Calling mode: ${enabled ? 'enabled' : 'disabled'}`);
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
   * Override de execute para dental
   * Usa la información de urgencia del metadata para:
   * 1. Priorizar la búsqueda de slots (mismo día para urgencias)
   * 2. Añadir contexto sobre la urgencia detectada al LLM
   * 3. Guardar datos de trazabilidad AI en la cita
   *
   * NO modifica el prompt base, solo añade contexto adicional
   */
  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const tenant = state.tenant;
    const lead = state.lead;
    const extracted = state.extracted_data;

    // Construir contexto base
    const servicesContext = formatServicesForPrompt(state.business_context);
    const branchesContext = formatBranchesForPrompt(state.business_context);

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

    if (hasEnoughInfo && tenant) {
      // Crear cita con datos de trazabilidad AI
      const bookingRequest: BookingRequest = {
        tenant_id: tenant.tenant_id,
        lead_id: lead?.lead_id || '',
        conversation_id: state.conversation?.conversation_id || '',
        branch_id: branchId,
        service_id: serviceId,
        requested_date: preferredDate,
        requested_time: preferredTime,
        vertical: 'dental',
        // Datos de trazabilidad AI para dental
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

        const { response, tokens } = await this.callLLM(
          state,
          `${servicesContext}\n${branchesContext}${alternativeContext}\n\nOfrece alternativas de horario al cliente.`
        );

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

      let additionalContext = `${servicesContext}\n${branchesContext}`;

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

      const { response, tokens } = await this.callLLM(state, additionalContext);

      return {
        response,
        tokens_used: tokens,
      };
    }
  }
}

/**
 * Booking Agent para Restaurantes
 * Incluye preguntas sobre número de personas y ocasión
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

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const tenant = state.tenant;
    const lead = state.lead;
    const extracted = state.extracted_data;

    const servicesContext = formatServicesForPrompt(state.business_context);
    const branchesContext = formatBranchesForPrompt(state.business_context);

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
      const bookingRequest: BookingRequest = {
        tenant_id: tenant.tenant_id,
        lead_id: lead?.lead_id || '',
        conversation_id: state.conversation?.conversation_id || '',
        branch_id: branchId,
        requested_date: preferredDate,
        requested_time: preferredTime,
        // Restaurant-specific fields
        party_size: partySize,
        occasion_type: occasion,
        special_requests: specialRequests,
        vertical: 'restaurant',
        // AI traceability
        ai_booking_channel: state.channel === 'voice' ? 'ai_voice' : state.channel === 'whatsapp' ? 'ai_whatsapp' : 'ai_webchat',
      };

      const bookingResult = await createBooking(bookingRequest);

      if (bookingResult.success) {
        const confirmationMessage = generateBookingConfirmation(bookingResult);
        return {
          response: confirmationMessage,
          tokens_used: 0,
        };
      } else {
        let alternativeContext = `\n\nNOTA: No se pudo crear la reservación. Razón: ${bookingResult.error}`;
        if (bookingResult.suggestion) {
          alternativeContext += `\nSugerencia: ${bookingResult.suggestion}`;
        }

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

        const { response, tokens } = await this.callLLM(
          state,
          `${servicesContext}\n${branchesContext}${alternativeContext}\n\nOfrece alternativas de horario al cliente.`
        );

        return { response, tokens_used: tokens };
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

      let additionalContext = `${servicesContext}\n${branchesContext}`;

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

      const { response, tokens } = await this.callLLM(state, additionalContext);
      return { response, tokens_used: tokens };
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

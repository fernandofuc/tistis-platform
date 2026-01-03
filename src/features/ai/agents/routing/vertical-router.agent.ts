// =====================================================
// TIS TIS PLATFORM - Vertical Router Agent
// Enruta a agentes especializados por vertical de negocio
// =====================================================

import {
  type TISTISAgentStateType,
  type AgentTrace,
  addAgentTrace,
} from '../../state';

// ======================
// TYPES
// ======================

// IMPORTANT: Only 'dental' and 'restaurant' are currently active in production
// Other verticals will be added as the platform expands
type Vertical = 'dental' | 'restaurant' | 'clinic' | 'gym' | 'beauty' | 'veterinary' | 'general';

interface VerticalConfig {
  /** Agentes disponibles para este vertical */
  agents: string[];
  /** Prompts especializados por intención */
  intent_prompts: Record<string, string>;
  /** Keywords específicos del vertical */
  keywords: string[];
  /** Prioridad de booking para este vertical */
  booking_priority: 'high' | 'medium' | 'low';
}

// ======================
// VERTICAL CONFIGURATIONS
// ======================

const VERTICAL_CONFIGS: Record<Vertical, VerticalConfig> = {
  // =====================================================
  // ACTIVE VERTICALS (Currently in Production)
  // =====================================================
  dental: {
    agents: ['greeting', 'pricing', 'booking_dental', 'faq', 'location', 'urgent_care', 'escalation'],
    intent_prompts: {
      GREETING: 'Saluda cálidamente y pregunta cómo puedes ayudar con su salud dental.',
      PRICE_INQUIRY: 'Proporciona precios claros de tratamientos dentales. Menciona opciones de financiamiento.',
      BOOK_APPOINTMENT: 'Ayuda a agendar cita dental. Pregunta por síntomas si no los ha mencionado.',
      PAIN_URGENT: 'Expresa empatía por el dolor. Ofrece cita de emergencia lo antes posible.',
      LOCATION: 'Proporciona la dirección completa de la clínica y cómo llegar.',
    },
    keywords: ['diente', 'muela', 'dentista', 'ortodoncia', 'brackets', 'limpieza', 'caries', 'corona', 'implante', 'blanqueamiento', 'endodoncia', 'extracción'],
    booking_priority: 'high',
  },
  restaurant: {
    agents: ['greeting', 'pricing', 'booking_restaurant', 'ordering_restaurant', 'faq', 'location', 'menu', 'escalation'],
    intent_prompts: {
      GREETING: 'Da la bienvenida y menciona especialidades del día si las hay.',
      PRICE_INQUIRY: 'Comparte el menú y rangos de precios. Menciona promociones vigentes.',
      BOOK_APPOINTMENT: 'Ayuda a reservar mesa. Pregunta número de personas y si es ocasión especial.',
      PICKUP_ORDER: 'Ayuda a tomar el pedido para recoger. Confirma los platillos y da número de orden.',
      LOCATION: 'Proporciona ubicación y opciones de estacionamiento.',
    },
    keywords: ['reserva', 'mesa', 'menu', 'carta', 'comida', 'cena', 'almuerzo', 'evento', 'privado', 'terraza', 'servicio', 'platillo', 'pedir', 'ordenar', 'llevar', 'recoger', 'pickup'],
    booking_priority: 'high',
  },

  // =====================================================
  // PLANNED VERTICALS (Coming Soon)
  // =====================================================
  clinic: {
    agents: ['greeting', 'pricing', 'booking_medical', 'faq', 'location', 'urgent_care', 'triage', 'escalation'],
    intent_prompts: {
      GREETING: 'Saluda profesionalmente y pregunta en qué especialidad puede ayudar.',
      PRICE_INQUIRY: 'Proporciona costos de consultas y procedimientos. Menciona si aceptan seguros.',
      BOOK_APPOINTMENT: 'Ayuda a agendar cita médica. Pregunta por especialidad necesaria.',
      PAIN_URGENT: 'Toma en serio los síntomas. Ofrece cita urgente o direcciona a urgencias si es grave.',
      FAQ: 'Responde preguntas médicas generales. Aclara que para diagnóstico se requiere consulta.',
    },
    keywords: ['doctor', 'consulta', 'especialista', 'medicina', 'salud', 'síntoma', 'tratamiento', 'estudio', 'laboratorio', 'radiografía', 'ultrasonido'],
    booking_priority: 'high',
  },
  gym: {
    agents: ['greeting', 'pricing', 'booking_gym', 'faq', 'location', 'membership', 'escalation'],
    intent_prompts: {
      GREETING: 'Saluda con energía y pregunta sobre sus objetivos de fitness.',
      PRICE_INQUIRY: 'Proporciona precios de membresías y paquetes. Menciona promociones.',
      BOOK_APPOINTMENT: 'Ayuda a agendar clase o sesión con entrenador.',
      LOCATION: 'Proporciona ubicación y horarios del gimnasio.',
    },
    keywords: ['gym', 'gimnasio', 'membresía', 'clase', 'entrenador', 'fitness', 'ejercicio', 'pesas', 'cardio', 'spinning'],
    booking_priority: 'medium',
  },
  beauty: {
    agents: ['greeting', 'pricing', 'booking_beauty', 'faq', 'location', 'escalation'],
    intent_prompts: {
      GREETING: 'Saluda calurosamente y pregunta qué tratamiento le interesa.',
      PRICE_INQUIRY: 'Proporciona precios de servicios de belleza. Menciona paquetes.',
      BOOK_APPOINTMENT: 'Ayuda a agendar cita de belleza. Pregunta por estilista preferido.',
      LOCATION: 'Proporciona ubicación del salón.',
    },
    keywords: ['corte', 'color', 'manicure', 'pedicure', 'facial', 'masaje', 'spa', 'cabello', 'uñas', 'tratamiento'],
    booking_priority: 'high',
  },
  veterinary: {
    agents: ['greeting', 'pricing', 'booking_vet', 'faq', 'location', 'urgent_care', 'escalation'],
    intent_prompts: {
      GREETING: 'Saluda con cariño y pregunta sobre la mascota.',
      PRICE_INQUIRY: 'Proporciona precios de consultas y servicios veterinarios.',
      BOOK_APPOINTMENT: 'Ayuda a agendar cita veterinaria. Pregunta por especie y síntomas.',
      PAIN_URGENT: 'Expresa preocupación por la mascota. Ofrece cita urgente.',
      LOCATION: 'Proporciona ubicación de la clínica veterinaria.',
    },
    keywords: ['perro', 'gato', 'mascota', 'veterinario', 'vacuna', 'desparasitar', 'consulta', 'emergencia', 'cirugía'],
    booking_priority: 'high',
  },

  // =====================================================
  // FALLBACK
  // =====================================================
  general: {
    agents: ['greeting', 'pricing', 'booking', 'faq', 'location', 'escalation'],
    intent_prompts: {
      GREETING: 'Saluda amablemente y pregunta cómo puedes ayudar.',
      PRICE_INQUIRY: 'Proporciona información de precios disponible.',
      BOOK_APPOINTMENT: 'Ayuda a agendar cita o servicio.',
      LOCATION: 'Proporciona información de ubicación.',
    },
    keywords: [],
    booking_priority: 'medium',
  },
};

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Obtiene la configuración del vertical
 */
function getVerticalConfig(vertical: Vertical): VerticalConfig {
  return VERTICAL_CONFIGS[vertical] || VERTICAL_CONFIGS.general;
}

/**
 * Detecta el vertical basado en keywords del mensaje
 * Útil si el tenant tiene múltiples verticales
 */
function detectVerticalFromMessage(message: string): Vertical | null {
  const messageLower = message.toLowerCase();

  for (const [vertical, config] of Object.entries(VERTICAL_CONFIGS)) {
    if (vertical === 'general') continue;

    for (const keyword of config.keywords) {
      if (messageLower.includes(keyword)) {
        return vertical as Vertical;
      }
    }
  }

  return null;
}

/**
 * Obtiene el prompt especializado para el vertical e intención
 */
function getVerticalPrompt(vertical: Vertical, intent: string): string {
  const config = getVerticalConfig(vertical);
  return config.intent_prompts[intent] || config.intent_prompts.GREETING || '';
}

/**
 * Determina el agente de booking específico del vertical
 */
function getBookingAgent(vertical: Vertical): string {
  const config = getVerticalConfig(vertical);
  const bookingAgent = config.agents.find((a) => a.startsWith('booking'));
  return bookingAgent || 'booking';
}

/**
 * Detecta si el mensaje indica intención de hacer un pedido pickup/delivery
 * IMPORTANTE: Solo activa ordering si el cliente EXPLÍCITAMENTE quiere pedir
 */
function detectPickupOrderIntent(message: string): boolean {
  const messageLower = message.toLowerCase();

  // Keywords que indican pedido para llevar/recoger
  const pickupKeywords = [
    'quiero pedir',
    'quisiera ordenar',
    'para llevar',
    'para recoger',
    'pickup',
    'ordenar comida',
    'pedir comida',
    'hacer un pedido',
    'me das',
    'me pueden preparar',
    'quiero ordenar',
    'quisiera pedir',
    'puedo pedir',
    'puedo ordenar',
    'delivery',
    'a domicilio',
  ];

  for (const keyword of pickupKeywords) {
    if (messageLower.includes(keyword)) {
      return true;
    }
  }

  // También detectar patrones como "2 hamburguesas para llevar"
  const orderPattern = /\d+\s+\w+.*(llevar|recoger|pickup)/i;
  if (orderPattern.test(messageLower)) {
    return true;
  }

  return false;
}

/**
 * Resultado de la detección de urgencia dental
 * Usado para enriquecer el contexto sin modificar prompts
 */
interface DentalUrgencyResult {
  isUrgent: boolean;
  urgencyLevel: 1 | 2 | 3 | 4 | 5; // 1=routine, 5=emergency
  urgencyType: 'routine' | 'pain_mild' | 'pain_moderate' | 'pain_severe' | 'trauma' | 'swelling' | 'bleeding' | 'emergency';
  detectedSymptoms: string[];
  recommendedTimeframe: string;
}

/**
 * Detecta si el mensaje indica una urgencia dental
 * IMPORTANTE: Esta función NO modifica prompts, solo enriquece el contexto
 * para que el agente de booking pueda priorizar correctamente
 *
 * Niveles de urgencia:
 * 1 = Rutina (checkup, limpieza programada)
 * 2 = Leve (sensibilidad, molestia menor)
 * 3 = Moderado (dolor manejable, problema estético)
 * 4 = Urgente (dolor severo, hinchazón, sangrado)
 * 5 = Emergencia (trauma, diente caído, absceso)
 */
function detectUrgentDentalIntent(message: string): DentalUrgencyResult {
  const messageLower = message.toLowerCase();
  const detectedSymptoms: string[] = [];
  let urgencyLevel: 1 | 2 | 3 | 4 | 5 = 1;
  let urgencyType: DentalUrgencyResult['urgencyType'] = 'routine';
  let recommendedTimeframe = 'Próximas 2 semanas';

  // NIVEL 5 - EMERGENCIA (requiere atención inmediata)
  const emergencyKeywords = [
    'se me cayó el diente',
    'se me cayo el diente',
    'diente caído',
    'diente caido',
    'se me rompió',
    'se me rompio',
    'me pegaron',
    'accidente',
    'golpe en la boca',
    'traumatismo',
    'diente fracturado',
    'sangra mucho',
    'no para de sangrar',
    'absceso',
    'pus',
    'fiebre y dolor',
    'hinchazón severa',
    'no puedo abrir la boca',
    'no puedo tragar',
  ];

  for (const keyword of emergencyKeywords) {
    if (messageLower.includes(keyword)) {
      detectedSymptoms.push(keyword);
      urgencyLevel = 5;
      urgencyType = 'emergency';
      recommendedTimeframe = 'Inmediato';
    }
  }

  // NIVEL 4 - URGENTE (atención mismo día)
  if (urgencyLevel < 4) {
    const urgentKeywords = [
      'dolor muy fuerte',
      'dolor insoportable',
      'no puedo dormir',
      'no he dormido',
      'me duele mucho',
      'dolor intenso',
      'hinchazón',
      'hinchado',
      'inflamado',
      'sangrado',
      'sangra',
      'dolor severo',
      'urgente',
      'emergencia',
      'no aguanto',
      'desesperado',
    ];

    for (const keyword of urgentKeywords) {
      if (messageLower.includes(keyword)) {
        detectedSymptoms.push(keyword);
        if (urgencyLevel < 4) {
          urgencyLevel = 4;
          // Determinar tipo específico
          if (messageLower.includes('hincha') || messageLower.includes('inflama')) {
            urgencyType = 'swelling';
          } else if (messageLower.includes('sangr')) {
            urgencyType = 'bleeding';
          } else {
            urgencyType = 'pain_severe';
          }
          recommendedTimeframe = 'Hoy';
        }
      }
    }
  }

  // NIVEL 3 - MODERADO (próximos 2-3 días)
  if (urgencyLevel < 3) {
    const moderateKeywords = [
      'me duele',
      'dolor',
      'molestia fuerte',
      'no puedo masticar',
      'diente roto',
      'corona caída',
      'empaste caído',
      'se me salió',
      'dolor al morder',
    ];

    for (const keyword of moderateKeywords) {
      if (messageLower.includes(keyword)) {
        detectedSymptoms.push(keyword);
        if (urgencyLevel < 3) {
          urgencyLevel = 3;
          urgencyType = 'pain_moderate';
          recommendedTimeframe = 'Próximos 2-3 días';
        }
      }
    }
  }

  // NIVEL 2 - LEVE (próxima semana)
  if (urgencyLevel < 2) {
    const mildKeywords = [
      'sensibilidad',
      'sensible',
      'molestia',
      'incomodidad',
      'algo raro',
      'se siente raro',
      'encía roja',
      'mal aliento',
      'manchas',
    ];

    for (const keyword of mildKeywords) {
      if (messageLower.includes(keyword)) {
        detectedSymptoms.push(keyword);
        if (urgencyLevel < 2) {
          urgencyLevel = 2;
          urgencyType = 'pain_mild';
          recommendedTimeframe = 'Próxima semana';
        }
      }
    }
  }

  // Detectar si es rutina explícita (baja prioridad)
  const routineKeywords = [
    'chequeo',
    'revisión general',
    'revision general',
    'limpieza dental',
    'profilaxis',
    'cuando tengan',
    'no es urgente',
    'sin prisa',
  ];

  for (const keyword of routineKeywords) {
    if (messageLower.includes(keyword)) {
      // Solo reducir si no hay síntomas urgentes
      if (detectedSymptoms.length === 0) {
        urgencyLevel = 1;
        urgencyType = 'routine';
        recommendedTimeframe = 'Próximas 2 semanas';
      }
    }
  }

  return {
    isUrgent: urgencyLevel >= 4,
    urgencyLevel,
    urgencyType,
    detectedSymptoms: [...new Set(detectedSymptoms)], // Remove duplicates
    recommendedTimeframe,
  };
}

/**
 * Verifica si un agente está disponible para el vertical
 */
function isAgentAvailable(vertical: Vertical, agentName: string): boolean {
  const config = getVerticalConfig(vertical);
  return config.agents.includes(agentName);
}

// ======================
// MAIN ROUTER NODE
// ======================

/**
 * Nodo Vertical Router del grafo LangGraph
 *
 * Responsabilidades:
 * 1. Validar que el agente destino está disponible para el vertical
 * 2. Agregar contexto especializado del vertical
 * 3. Ajustar routing si es necesario
 * 4. Preparar prompts especializados
 */
export async function verticalRouterNode(
  state: TISTISAgentStateType
): Promise<Partial<TISTISAgentStateType>> {
  const startTime = Date.now();
  const agentName = 'vertical_router';

  console.log(`[Vertical Router] Routing for vertical: ${state.vertical}`);

  try {
    const vertical = state.vertical || 'general';
    const config = getVerticalConfig(vertical);
    let nextAgent = state.next_agent || 'general';

    // Variables para enriquecer el contexto
    let dentalUrgency: DentalUrgencyResult | null = null;

    // 1. DENTAL: Detectar urgencia para enriquecer contexto de booking
    // NOTA: Dental solo agenda citas, NO hay ordering
    // La urgencia se usa para priorizar la cita, no para redirigir a otro agente
    if (vertical === 'dental') {
      dentalUrgency = detectUrgentDentalIntent(state.current_message);

      if (dentalUrgency.isUrgent) {
        console.log(`[Vertical Router] Detected URGENT dental case: level ${dentalUrgency.urgencyLevel}, symptoms: ${dentalUrgency.detectedSymptoms.join(', ')}`);
      }
    }

    // 2. RESTAURANT: Detectar intención de pedido pickup/delivery
    // IMPORTANTE: Solo activa ordering si es vertical restaurant Y cliente quiere pedir
    if (vertical === 'restaurant' && detectPickupOrderIntent(state.current_message)) {
      console.log(`[Vertical Router] Detected PICKUP_ORDER intent for restaurant`);
      nextAgent = 'ordering_restaurant';
    }

    // 3. Verificar si el agente destino está disponible para este vertical
    if (!isAgentAvailable(vertical, nextAgent)) {
      // Buscar alternativa o usar general
      console.log(`[Vertical Router] Agent ${nextAgent} not available for ${vertical}, using fallback`);

      // Para booking, usar el específico del vertical
      if (nextAgent.startsWith('booking')) {
        nextAgent = getBookingAgent(vertical);
      } else {
        nextAgent = 'general';
      }
    }

    // 4. Obtener prompt especializado
    const verticalPrompt = getVerticalPrompt(vertical, state.detected_intent);

    // 5. Crear traza con información de urgencia si aplica
    const traceDecision = dentalUrgency
      ? `Using ${vertical} config, priority: ${config.booking_priority}, urgency: ${dentalUrgency.urgencyLevel}`
      : `Using ${vertical} config, priority: ${config.booking_priority}`;

    const trace: AgentTrace = addAgentTrace(
      state,
      {
        agent_name: agentName,
        input_summary: `Routing ${state.detected_intent} for ${vertical}`,
        output_summary: `Next: ${nextAgent}`,
        decision: traceDecision,
        duration_ms: Date.now() - startTime,
      }
    );

    console.log(`[Vertical Router] Routed to: ${nextAgent} for ${vertical}`);

    // 6. Construir respuesta con contexto enriquecido
    const result: Partial<TISTISAgentStateType> = {
      current_agent: agentName,
      next_agent: nextAgent,
      routing_reason: `${state.routing_reason} | Vertical: ${vertical}`,
      agent_trace: [trace],
    };

    // 7. DENTAL: Añadir información de urgencia al metadata para que booking_dental la use
    // Esto NO modifica prompts, solo enriquece el contexto disponible
    if (dentalUrgency && vertical === 'dental') {
      result.metadata = {
        ...state.metadata,
        dental_urgency: {
          level: dentalUrgency.urgencyLevel,
          type: dentalUrgency.urgencyType,
          symptoms: dentalUrgency.detectedSymptoms,
          recommended_timeframe: dentalUrgency.recommendedTimeframe,
          is_urgent: dentalUrgency.isUrgent,
        },
      };
    }

    return result;
  } catch (error) {
    console.error('[Vertical Router] Error:', error);

    const trace: AgentTrace = addAgentTrace(
      state,
      {
        agent_name: agentName,
        input_summary: `Error routing for ${state.vertical}`,
        output_summary: `ERROR: ${error instanceof Error ? error.message : 'Unknown'}`,
        decision: 'Fallback to general',
        duration_ms: Date.now() - startTime,
      }
    );

    return {
      current_agent: agentName,
      next_agent: 'general',
      agent_trace: [trace],
      errors: [error instanceof Error ? error.message : 'Unknown router error'],
    };
  }
}

/**
 * Función de routing condicional después del vertical router
 */
export function verticalRouterRouter(state: TISTISAgentStateType): string {
  // Ir al agente determinado
  return state.next_agent || 'general';
}

// ======================
// EXPORTS
// ======================

export const VerticalRouterAgent = {
  node: verticalRouterNode,
  router: verticalRouterRouter,
  getVerticalConfig,
  getVerticalPrompt,
  getBookingAgent,
  isAgentAvailable,
  detectVerticalFromMessage,
  detectPickupOrderIntent,
  detectUrgentDentalIntent,
  VERTICAL_CONFIGS,
};

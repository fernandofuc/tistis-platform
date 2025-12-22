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

type Vertical = 'dental' | 'restaurant' | 'medical' | 'services' | 'retail' | 'general';

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
    agents: ['greeting', 'pricing', 'booking_restaurant', 'faq', 'location', 'menu', 'escalation'],
    intent_prompts: {
      GREETING: 'Da la bienvenida y menciona especialidades del día si las hay.',
      PRICE_INQUIRY: 'Comparte el menú y rangos de precios. Menciona promociones vigentes.',
      BOOK_APPOINTMENT: 'Ayuda a reservar mesa. Pregunta número de personas y si es ocasión especial.',
      LOCATION: 'Proporciona ubicación y opciones de estacionamiento.',
    },
    keywords: ['reserva', 'mesa', 'menu', 'carta', 'comida', 'cena', 'almuerzo', 'evento', 'privado', 'terraza', 'servicio', 'platillo'],
    booking_priority: 'high',
  },
  medical: {
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
  services: {
    agents: ['greeting', 'pricing', 'booking_services', 'faq', 'location', 'escalation'],
    intent_prompts: {
      GREETING: 'Saluda y pregunta qué servicio le interesa.',
      PRICE_INQUIRY: 'Proporciona cotización del servicio solicitado.',
      BOOK_APPOINTMENT: 'Ayuda a agendar cita para el servicio.',
      LOCATION: 'Informa si el servicio es a domicilio o en establecimiento.',
    },
    keywords: ['servicio', 'cotización', 'presupuesto', 'trabajo', 'proyecto', 'reparación', 'instalación', 'mantenimiento'],
    booking_priority: 'medium',
  },
  retail: {
    agents: ['greeting', 'pricing', 'catalog', 'faq', 'location', 'order', 'escalation'],
    intent_prompts: {
      GREETING: 'Da la bienvenida y menciona ofertas o novedades.',
      PRICE_INQUIRY: 'Proporciona precios y disponibilidad de productos.',
      BOOK_APPOINTMENT: 'Ayuda a apartar productos o agendar entrega.',
      LOCATION: 'Informa sobre tiendas físicas y opciones de envío.',
    },
    keywords: ['producto', 'comprar', 'precio', 'disponibilidad', 'envío', 'tienda', 'pedido', 'apartado'],
    booking_priority: 'low',
  },
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

    // 1. Verificar si el agente destino está disponible para este vertical
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

    // 2. Obtener prompt especializado
    const verticalPrompt = getVerticalPrompt(vertical, state.detected_intent);

    // 3. Crear traza
    const trace: AgentTrace = addAgentTrace(
      state,
      {
        agent_name: agentName,
        input_summary: `Routing ${state.detected_intent} for ${vertical}`,
        output_summary: `Next: ${nextAgent}`,
        decision: `Using ${vertical} config, priority: ${config.booking_priority}`,
        duration_ms: Date.now() - startTime,
      }
    );

    console.log(`[Vertical Router] Routed to: ${nextAgent} for ${vertical}`);

    return {
      current_agent: agentName,
      next_agent: nextAgent,
      routing_reason: `${state.routing_reason} | Vertical: ${vertical}`,
      agent_trace: [trace],
    };
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
  VERTICAL_CONFIGS,
};

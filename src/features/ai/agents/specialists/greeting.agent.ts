// =====================================================
// TIS TIS PLATFORM - Greeting Agent
// Agente especializado en saludos y bienvenidas
// =====================================================

import { BaseAgent, type AgentResult } from './base.agent';
import type { TISTISAgentStateType } from '../../state';

// ======================
// GREETING AGENT
// ======================

/**
 * Agente de Saludo
 *
 * Responsabilidades:
 * 1. Dar la bienvenida al cliente
 * 2. Identificar el propósito de la visita
 * 3. Guiar hacia el siguiente paso (FAQ, pricing, booking)
 */
class GreetingAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'greeting',
      description: 'Agente de saludo y bienvenida',
      systemPromptTemplate: `Eres el asistente virtual de {{TENANT_NAME}}.

# TU ROL
Eres el primer punto de contacto con los clientes. Tu trabajo es:
1. Dar una bienvenida cálida y profesional
2. Identificar qué necesita el cliente
3. Guiarlo hacia la información o acción correcta

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- NO uses emojis a menos que el cliente los use primero
- Sé conciso pero amable

# INSTRUCCIONES ESPECÍFICAS
- Si el cliente solo saluda, pregunta cómo puedes ayudarlo
- Si menciona algo específico (precio, cita, ubicación), responde directamente a eso
- Siempre ofrece opciones claras de lo que puedes ayudar
- Personaliza si conoces el nombre del cliente

# EJEMPLOS DE RESPUESTAS

Cliente: "Hola"
Tú: "¡Hola! Bienvenido a {{TENANT_NAME}}. ¿En qué puedo ayudarte hoy? Puedo darte información sobre nuestros servicios, precios, o ayudarte a agendar una cita."

Cliente: "Buenos días, quiero información"
Tú: "¡Buenos días! Con gusto te ayudo. ¿Qué información necesitas? Puedo contarte sobre nuestros servicios, precios, horarios o ubicación."

Cliente: "Hola, quisiera una cita"
Tú: "¡Hola! Perfecto, te ayudo a agendar tu cita. ¿Para qué servicio te gustaría agendarla?"`,
      temperature: 0.7,
      maxTokens: 200,
      canHandoffTo: ['pricing', 'booking', 'faq', 'location', 'hours'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    // Si el mensaje tiene más contexto que un saludo simple, puede necesitar handoff
    const messageLower = state.current_message.toLowerCase();

    // Detectar si el saludo viene con una intención clara
    if (state.detected_intent !== 'GREETING' && state.detected_intent !== 'UNKNOWN') {
      // Hacer handoff al agente apropiado después de saludar brevemente
      const handoffMap: Record<string, string> = {
        PRICE_INQUIRY: 'pricing',
        BOOK_APPOINTMENT: 'booking',
        LOCATION: 'location',
        HOURS: 'hours',
        FAQ: 'faq',
      };

      const nextAgent = handoffMap[state.detected_intent];
      if (nextAgent) {
        // Generar saludo breve y luego handoff
        const { response, tokens } = await this.callLLM(
          state,
          `El cliente saludó pero también pregunta por ${state.detected_intent}.
          Da un saludo breve y amable, pero no respondas a la pregunta específica.
          Solo saluda y confirma que vas a ayudar con su consulta.`
        );

        return {
          response,
          next_agent: nextAgent,
          handoff_reason: `Greeting with ${state.detected_intent} detected`,
          tokens_used: tokens,
        };
      }
    }

    // Saludo simple - responder completo
    const { response, tokens } = await this.callLLM(state);

    return {
      response,
      tokens_used: tokens,
    };
  }

  protected shouldHandoff(state: TISTISAgentStateType) {
    // Si la intención es clara, hacer handoff después de saludar
    const handoffIntents = ['PRICE_INQUIRY', 'BOOK_APPOINTMENT', 'LOCATION', 'HOURS', 'FAQ'];

    if (handoffIntents.includes(state.detected_intent)) {
      const handoffMap: Record<string, string> = {
        PRICE_INQUIRY: 'pricing',
        BOOK_APPOINTMENT: 'booking',
        LOCATION: 'location',
        HOURS: 'hours',
        FAQ: 'faq',
      };

      return {
        handoff: true,
        to: handoffMap[state.detected_intent],
        reason: `Client greeted but intends ${state.detected_intent}`,
      };
    }

    return { handoff: false };
  }
}

// Instancia singleton
export const GreetingAgent = new GreetingAgentClass();

// Nodo para LangGraph
export const greetingNode = GreetingAgent.toNode();

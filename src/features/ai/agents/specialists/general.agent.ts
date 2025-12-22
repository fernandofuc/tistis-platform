// =====================================================
// TIS TIS PLATFORM - General/Fallback Agent
// Agente de propósito general para casos no específicos
// =====================================================

import { BaseAgent, type AgentResult, formatServicesForPrompt, formatBranchesForPrompt, formatFAQsForPrompt } from './base.agent';
import type { TISTISAgentStateType } from '../../state';

// ======================
// GENERAL AGENT
// ======================

/**
 * Agente General
 *
 * Este es el agente de fallback cuando ningún otro es apropiado.
 * Responsabilidades:
 * 1. Manejar consultas generales
 * 2. Detectar si puede redirigir a un especialista
 * 3. Proporcionar información básica del negocio
 * 4. Escalar si es necesario
 */
class GeneralAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'general',
      description: 'Agente de propósito general y fallback',
      systemPromptTemplate: `Eres el asistente virtual de {{TENANT_NAME}}.

# TU ROL
Eres un asistente versátil que puede ayudar con cualquier consulta general.
- Responde de manera útil a cualquier pregunta
- Si detectas una necesidad específica, guía al cliente
- Siempre busca ser útil y llevar hacia una acción concreta

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- Sé amable y servicial
- NO uses emojis a menos que el cliente los use primero

# INSTRUCCIONES ESPECÍFICAS
- Si el cliente pregunta algo que no entiendes, pide clarificación
- Si detectas que quiere agendar, ofrece ayuda para hacerlo
- Si pregunta algo muy técnico o específico, ofrece conectar con un especialista
- Siempre termina ofreciendo ayuda adicional

# LO QUE PUEDES HACER
- Dar información general del negocio
- Explicar servicios disponibles
- Proporcionar ubicación y horarios
- Ayudar a agendar citas
- Responder preguntas frecuentes

# EJEMPLO DE RESPUESTAS

Cliente: "Buenas, tengo una duda"
Tú: "¡Hola! Con gusto te ayudo. ¿Cuál es tu duda?"

Cliente: [mensaje confuso]
Tú: "Disculpa, quiero asegurarme de entenderte bien. ¿Podrías explicarme un poco más qué necesitas?"

Cliente: "Gracias por la info"
Tú: "¡De nada! ¿Hay algo más en lo que pueda ayudarte?"`,
      temperature: 0.7,
      maxTokens: 300,
      canHandoffTo: ['pricing', 'booking', 'location', 'faq', 'escalation'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    // Construir contexto completo
    const servicesContext = formatServicesForPrompt(state.business_context);
    const branchesContext = formatBranchesForPrompt(state.business_context);
    const faqsContext = formatFAQsForPrompt(state.business_context);

    const fullContext = `# INFORMACIÓN DEL NEGOCIO

## SERVICIOS
${servicesContext}

## SUCURSALES
${branchesContext}

## PREGUNTAS FRECUENTES
${faqsContext}`;

    // Detectar si hay una intención clara que debamos atender
    const intent = state.detected_intent;
    let additionalNote = '';

    if (intent !== 'UNKNOWN') {
      const intentDescriptions: Record<string, string> = {
        GREETING: 'El cliente está saludando.',
        PRICE_INQUIRY: 'El cliente pregunta por precios.',
        BOOK_APPOINTMENT: 'El cliente quiere agendar.',
        LOCATION: 'El cliente pregunta por ubicación.',
        HOURS: 'El cliente pregunta por horarios.',
        FAQ: 'El cliente tiene una pregunta general.',
      };
      additionalNote = `\n\nNOTA: ${intentDescriptions[intent] || 'Responde de manera general.'}`;
    }

    // Si el mensaje parece de despedida
    const messageLower = state.current_message.toLowerCase();
    const farewellIndicators = ['gracias', 'adios', 'adiós', 'bye', 'hasta luego', 'nos vemos'];
    if (farewellIndicators.some((fw) => messageLower.includes(fw))) {
      additionalNote = '\n\nNOTA: El cliente está despidiéndose. Despídete amablemente y ofrece ayuda futura.';
    }

    const { response, tokens } = await this.callLLM(state, fullContext + additionalNote);

    return {
      response,
      tokens_used: tokens,
    };
  }
}

// Instancia singleton
export const GeneralAgent = new GeneralAgentClass();

// Nodo para LangGraph
export const generalNode = GeneralAgent.toNode();

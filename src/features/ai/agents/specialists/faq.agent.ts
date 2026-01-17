// =====================================================
// TIS TIS PLATFORM - FAQ Agent
// Agente especializado en preguntas frecuentes
// =====================================================
//
// ARQUITECTURA V7.0:
// - Tool Calling SIEMPRE activo para obtener info on-demand
// - Búsqueda RAG via search_knowledge_base para knowledge base
// - CERO context stuffing - el LLM pide lo que necesita
// - Reduce tokens significativamente
// =====================================================

import { BaseAgent, type AgentResult } from './base.agent';
import type { TISTISAgentStateType } from '../../state';
import { createToolsForAgent } from '../../tools';

// ======================
// FAQ AGENT
// ======================

/**
 * Agente de FAQ - ARQUITECTURA V7
 *
 * Responsabilidades:
 * 1. Responder preguntas frecuentes
 * 2. Proporcionar información general del negocio
 * 3. Explicar procedimientos y servicios
 * 4. Guiar hacia información más específica o booking
 *
 * TOOLS DISPONIBLES (se obtienen automáticamente vía Tool Calling):
 * - get_faq_answer: Buscar respuestas en FAQs configuradas
 * - search_knowledge_base: Buscar en la base de conocimiento (RAG)
 * - get_service_info: Obtener info de servicios específicos
 * - get_business_policy: Obtener políticas del negocio
 */
class FAQAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'faq',
      description: 'Agente de preguntas frecuentes e información general',
      systemPromptTemplate: `Eres el especialista en información de {{TENANT_NAME}}.

# TU ROL
Tu trabajo es responder preguntas generales sobre el negocio, servicios y procedimientos.
- USA get_faq_answer para buscar respuestas en las preguntas frecuentes
- USA search_knowledge_base para información adicional
- Si preguntan por un servicio específico, USA get_service_info
- Si preguntan por políticas, USA get_business_policy
- Si no tienes la información, ofrece conectar con un asesor

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- Sé informativo pero conciso
- NO uses emojis a menos que el cliente los use primero

# INSTRUCCIONES ESPECÍFICAS
- Si la pregunta tiene respuesta exacta en FAQs, úsala
- Si la pregunta es sobre un servicio específico, da detalles
- Si preguntan algo muy técnico, simplifica la respuesta
- Siempre ofrece ayuda adicional o agendar cita si aplica
- Si no sabes algo con certeza, sé honesto y ofrece escalación

# IMPORTANTE
- NO inventes información. Si no la tienes, usa las herramientas.
- Si una FAQ no existe, busca en knowledge base o indica que no tienes esa información.`,
      temperature: 0.6,
      maxTokens: 350,
      canHandoffTo: ['pricing', 'booking', 'location', 'escalation'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const messageLower = state.current_message.toLowerCase();

    // Contexto adicional basado en análisis del mensaje
    const additionalContext = '';

    // =====================================================
    // ARQUITECTURA V7: Tool Calling SIEMPRE activo
    // El LLM decide qué información necesita y la obtiene on-demand
    // NO hay modo legacy - CERO context stuffing
    // =====================================================
    const tools = createToolsForAgent(this.config.name, state);

    console.log(`[faq] V7 Tool Calling with ${tools.length} tools`);

    const result = await this.callLLMWithTools(state, tools, additionalContext);
    const response = result.response;
    const tokens = result.tokens;
    const toolCalls = result.toolCalls;

    console.log(`[faq] Tool calls made: ${toolCalls.join(', ') || 'none'}`);

    // Detectar si el cliente quiere más información o agendar
    const bookingIndicators = ['agendar', 'cita', 'reservar', 'cuándo', 'cuando', 'disponible'];
    const pricingIndicators = ['precio', 'costo', 'cuánto', 'cuanto', 'vale'];

    if (bookingIndicators.some((ind) => messageLower.includes(ind))) {
      return {
        response,
        next_agent: 'booking',
        handoff_reason: 'Client wants to book after FAQ',
        tokens_used: tokens,
      };
    }

    if (pricingIndicators.some((ind) => messageLower.includes(ind))) {
      return {
        response,
        next_agent: 'pricing',
        handoff_reason: 'Client wants pricing after FAQ',
        tokens_used: tokens,
      };
    }

    return {
      response,
      tokens_used: tokens,
    };
  }
}

// Instancia singleton
export const FAQAgent = new FAQAgentClass();

// Nodo para LangGraph
export const faqNode = FAQAgent.toNode();

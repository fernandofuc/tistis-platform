// =====================================================
// TIS TIS PLATFORM - Pricing Agent
// Agente especializado en consultas de precios
// =====================================================
//
// ARQUITECTURA V7.0:
// - Tool Calling SIEMPRE activo para obtener info on-demand
// - Búsqueda RAG via search_knowledge_base para knowledge base
// - CERO context stuffing - el LLM pide lo que necesita
// - Reduce tokens de ~20K a ~2K por mensaje
// =====================================================

import { BaseAgent, type AgentResult } from './base.agent';
import type { TISTISAgentStateType } from '../../state';
import { createToolsForAgent } from '../../tools';

// ======================
// PRICING AGENT
// ======================

/**
 * Agente de Precios - ARQUITECTURA V7
 *
 * Responsabilidades:
 * 1. Proporcionar información clara de precios
 * 2. Explicar opciones de financiamiento si existen
 * 3. Mencionar promociones activas
 * 4. Guiar hacia booking si el cliente está interesado
 *
 * TOOLS DISPONIBLES (se obtienen automáticamente vía Tool Calling):
 * - get_service_info: Obtener precio de un servicio específico
 * - list_services: Listar todos los servicios con precios
 * - get_business_policy: Obtener políticas de pago
 * - get_faq_answer: Buscar respuestas a preguntas frecuentes
 * - search_knowledge_base: Buscar en RAG del tenant (promociones, etc.)
 */
class PricingAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'pricing',
      description: 'Agente de consultas de precios y cotizaciones',
      systemPromptTemplate: `Eres el especialista en precios de {{TENANT_NAME}}.

# TU ROL
Tu trabajo es proporcionar información clara y transparente sobre precios.
- Sé directo con los precios, no los ocultes
- Si hay rangos, explica por qué (complejidad, materiales, etc.)
- Menciona promociones activas si aplican
- Si el cliente muestra interés, invítalo a agendar

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- Sé claro y transparente con los precios
- NO uses emojis a menos que el cliente los use primero

# USO OBLIGATORIO DE HERRAMIENTAS
REGLA CRÍTICA: NUNCA inventes precios. CADA precio DEBE provenir de una herramienta.

1. Servicio específico → USA get_service_info(service_name="nombre del servicio")
   - El nombre puede ser parcial (ej: "limpieza", "blanqueamiento")
   - Si retorna error, usa list_services para ver opciones disponibles

2. Consulta general de precios → USA list_services(category=opcional)
   - Si preguntan "qué servicios tienen", usa esto
   - Puedes filtrar por categoría si la mencionan

3. Promociones o financiamiento → USA search_knowledge_base(query="promociones" o "financiamiento")
   - Busca información adicional en la base de conocimiento

4. Formas de pago → USA get_business_policy(policy_type="payment")

# MANEJO DE ERRORES
- Si get_service_info retorna "No encontré servicio" → responde "No tenemos ese servicio, pero ofrecemos: [usar list_services]"
- Si no hay promociones → NO las inventes, simplemente no las menciones
- Si el cliente pregunta algo muy específico sin respuesta → ofrece conectar con un asesor

# FLUJO RECOMENDADO
1. Identifica qué servicio(s) pregunta el cliente
2. Usa la herramienta apropiada para obtener precio REAL
3. Presenta el precio claramente
4. Si aplica, menciona promociones o financiamiento
5. Ofrece agendar cita si muestra interés`,
      temperature: 0.5,
      maxTokens: 300,
      canHandoffTo: ['booking', 'faq', 'escalation'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const messageLower = state.current_message.toLowerCase();

    // Contexto adicional basado en análisis del mensaje
    let additionalContext = '';

    if (state.extracted_data.service_interest?.price_sensitive) {
      additionalContext += '\nNOTA: El cliente parece sensible al precio. Si existen opciones de financiamiento o paquetes, menciónalos.';
    }

    // =====================================================
    // ARQUITECTURA V7: Tool Calling SIEMPRE activo
    // El LLM decide qué información necesita y la obtiene on-demand
    // NO hay modo legacy - CERO context stuffing
    // =====================================================
    const tools = createToolsForAgent(this.config.name, state);

    console.log(`[pricing] V7 Tool Calling with ${tools.length} tools`);

    const result = await this.callLLMWithTools(state, tools, additionalContext);
    const response = result.response;
    const tokens = result.tokens;
    const toolCalls = result.toolCalls;

    console.log(`[pricing] Tool calls made: ${toolCalls.join(', ') || 'none'}`);

    // Detectar si el cliente está listo para agendar
    const bookingIndicators = ['cuándo', 'cuando', 'cita', 'agendar', 'disponible', 'horario', 'quiero', 'me interesa'];
    const wantsToBook = bookingIndicators.some((indicator) =>
      messageLower.includes(indicator)
    );

    // Si parece querer agendar, sugerir handoff a booking
    if (wantsToBook || state.extracted_data.preferred_date) {
      return {
        response,
        next_agent: 'booking',
        handoff_reason: 'Client showed booking interest after pricing',
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
export const PricingAgent = new PricingAgentClass();

// Nodo para LangGraph
export const pricingNode = PricingAgent.toNode();

// =====================================================
// TIS TIS PLATFORM - General/Fallback Agent
// Agente de propósito general para casos no específicos
// =====================================================
//
// ARQUITECTURA V7.0:
// - Tool Calling SIEMPRE activo para obtener info on-demand
// - Búsqueda RAG via search_knowledge_base
// - CERO context stuffing - el LLM pide lo que necesita
// =====================================================

import { BaseAgent, type AgentResult } from './base.agent';
import type { TISTISAgentStateType } from '../../state';
import { createToolsForAgent } from '../../tools';

// ======================
// GENERAL AGENT
// ======================

/**
 * Agente General - ARQUITECTURA V7
 *
 * Este es el agente de fallback cuando ningún otro es apropiado.
 * Responsabilidades:
 * 1. Manejar consultas generales
 * 2. Detectar si puede redirigir a un especialista
 * 3. Proporcionar información básica del negocio
 * 4. Escalar si es necesario
 *
 * TOOLS DISPONIBLES (se obtienen automáticamente vía Tool Calling):
 * - get_service_info: Información de servicios específicos
 * - list_services: Catálogo completo de servicios
 * - get_branch_info: Información de sucursales
 * - get_operating_hours: Horarios de atención
 * - get_faq_answer: Respuestas a preguntas frecuentes
 * - search_knowledge_base: Buscar en base de conocimiento (RAG)
 * - get_business_policy: Políticas del negocio
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

# USO OBLIGATORIO DE HERRAMIENTAS
REGLA CRÍTICA: NUNCA inventes información. CADA respuesta DEBE provenir de una herramienta.

1. Preguntas sobre servicios:
   → USA get_service_info(service_name="nombre") para servicio específico
   → USA list_services() para ver catálogo completo
   - Ejemplo: "¿qué tratamientos tienen?" → list_services()

2. Ubicación y contacto:
   → USA get_branch_info(branch_name="sucursal") para sucursal específica
   → USA get_branch_info() sin parámetros para todas las sucursales
   - Siempre incluye Google Maps si está disponible

3. Horarios:
   → USA get_operating_hours(day="lunes") para día específico
   → USA get_operating_hours() para horario completo
   - Ejemplo: "¿abren los domingos?" → get_operating_hours(day="domingo")

4. Preguntas frecuentes:
   → USA get_faq_answer(question="texto de la pregunta")
   - Ejemplo: "¿aceptan tarjeta?" → get_faq_answer(question="aceptan tarjeta")

5. Información general del negocio:
   → USA search_knowledge_base(query="tema")
   - Para información no estructurada (historia, valores, etc.)

6. Políticas:
   → USA get_business_policy(policy_type="cancellation|payment|rescheduling|warranty")

# FLUJO DE DECISIÓN
1. Identifica el tipo de pregunta
2. Usa la herramienta apropiada (ver arriba)
3. Si no encuentra resultado → prueba search_knowledge_base como fallback
4. Si aún no hay resultado → ofrece conectar con un especialista

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

# MANEJO DE ERRORES
- Si ninguna herramienta retorna resultados:
  → "No tengo esa información específica. ¿Te gustaría que te conecte con alguien que pueda ayudarte?"
- NUNCA inventes datos que no provengan de las herramientas`,
      temperature: 0.7,
      maxTokens: 300,
      canHandoffTo: ['pricing', 'booking', 'location', 'faq', 'escalation'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const messageLower = state.current_message.toLowerCase();

    // Detectar si hay una intención clara que debamos atender
    const intent = state.detected_intent;
    let additionalContext = '';

    if (intent !== 'UNKNOWN') {
      const intentDescriptions: Record<string, string> = {
        GREETING: 'El cliente está saludando.',
        PRICE_INQUIRY: 'El cliente pregunta por precios.',
        BOOK_APPOINTMENT: 'El cliente quiere agendar.',
        LOCATION: 'El cliente pregunta por ubicación.',
        HOURS: 'El cliente pregunta por horarios.',
        FAQ: 'El cliente tiene una pregunta general.',
      };
      additionalContext = `\nNOTA: ${intentDescriptions[intent] || 'Responde de manera general.'}`;
    }

    // Si el mensaje parece de despedida
    const farewellIndicators = ['gracias', 'adios', 'adiós', 'bye', 'hasta luego', 'nos vemos'];
    if (farewellIndicators.some((fw) => messageLower.includes(fw))) {
      additionalContext = '\nNOTA: El cliente está despidiéndose. Despídete amablemente y ofrece ayuda futura.';
    }

    // =====================================================
    // ARQUITECTURA V7: Tool Calling SIEMPRE activo
    // El LLM decide qué información necesita y la obtiene on-demand
    // NO hay modo legacy - CERO context stuffing
    // =====================================================
    const tools = createToolsForAgent(this.config.name, state);

    console.log(`[general] V7 Tool Calling with ${tools.length} tools`);

    const result = await this.callLLMWithTools(state, tools, additionalContext);
    const response = result.response;
    const tokens = result.tokens;
    const toolCalls = result.toolCalls;

    console.log(`[general] Tool calls made: ${toolCalls.join(', ') || 'none'}`);

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

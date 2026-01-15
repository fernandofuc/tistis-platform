// =====================================================
// TIS TIS PLATFORM - Pricing Agent
// Agente especializado en consultas de precios
// =====================================================
//
// ARQUITECTURA v6.0:
// - Usa Tool Calling para obtener información de servicios on-demand
// - NO carga todo el catálogo en el contexto inicial
// - Reduce tokens de ~20K a ~2K por mensaje
// =====================================================

import { BaseAgent, type AgentResult } from './base.agent';
import type { TISTISAgentStateType } from '../../state';
import { createToolsForAgent } from '../../tools';

// ======================
// PRICING AGENT
// ======================

/**
 * Agente de Precios
 *
 * Responsabilidades:
 * 1. Proporcionar información clara de precios
 * 2. Explicar opciones de financiamiento si existen
 * 3. Mencionar promociones activas
 * 4. Guiar hacia booking si el cliente está interesado
 *
 * TOOLS DISPONIBLES:
 * - get_service_info: Obtener precio de un servicio específico
 * - list_services: Listar todos los servicios con precios
 * - get_business_policy: Obtener políticas de pago
 * - get_faq_answer: Buscar respuestas a preguntas frecuentes
 */
class PricingAgentClass extends BaseAgent {
  /** Flag para usar Tool Calling vs modo legacy */
  private useToolCalling: boolean = true;

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

# INSTRUCCIONES ESPECÍFICAS
- Si preguntan por un servicio específico, USA get_service_info para obtener el precio exacto
- Si preguntan en general, USA list_services para ver el catálogo
- Si hay promoción activa, menciónala naturalmente
- Si preguntan por formas de pago, USA get_business_policy con tipo "payment"
- Siempre termina ofreciendo agendar cita si el cliente parece interesado

# IMPORTANTE
- NO inventes precios. Si no tienes la información, usa las herramientas.
- Si un servicio no existe en el catálogo, dilo honestamente.`,
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

    let response: string;
    let tokens: number;
    let toolCalls: string[] = [];

    if (this.useToolCalling) {
      // =====================================================
      // NUEVA ARQUITECTURA: Tool Calling
      // El LLM decide qué información necesita y la obtiene on-demand
      // =====================================================
      const tools = createToolsForAgent(this.config.name, state);

      console.log(`[pricing] Using Tool Calling mode with ${tools.length} tools`);

      const result = await this.callLLMWithTools(state, tools, additionalContext);
      response = result.response;
      tokens = result.tokens;
      toolCalls = result.toolCalls;

      console.log(`[pricing] Tool calls made: ${toolCalls.join(', ') || 'none'}`);
    } else {
      // =====================================================
      // MODO LEGACY: Context Stuffing (para compatibilidad)
      // =====================================================
      console.log(`[pricing] Using legacy mode (context stuffing)`);

      // Importar función helper del modo legacy
      const { formatServicesForPrompt } = await import('./base.agent');

      const servicesContext = `# CATÁLOGO DE SERVICIOS Y PRECIOS\n${formatServicesForPrompt(state.business_context)}`;

      const result = await this.callLLM(state, servicesContext + additionalContext);
      response = result.response;
      tokens = result.tokens;
    }

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

  /**
   * Habilita o deshabilita Tool Calling
   * Útil para testing o rollback gradual
   */
  setToolCallingMode(enabled: boolean): void {
    this.useToolCalling = enabled;
    console.log(`[pricing] Tool Calling mode: ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Instancia singleton
export const PricingAgent = new PricingAgentClass();

// Nodo para LangGraph
export const pricingNode = PricingAgent.toNode();

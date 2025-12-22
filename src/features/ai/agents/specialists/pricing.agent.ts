// =====================================================
// TIS TIS PLATFORM - Pricing Agent
// Agente especializado en consultas de precios
// =====================================================

import { BaseAgent, type AgentResult, formatServicesForPrompt } from './base.agent';
import type { TISTISAgentStateType } from '../../state';

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

# INSTRUCCIONES ESPECÍFICAS
- Si preguntan por un servicio específico, da el precio exacto
- Si preguntan en general, menciona rangos y los servicios más populares
- Si hay promoción activa, menciónala naturalmente
- Si preguntan por formas de pago, explica opciones disponibles
- Siempre termina ofreciendo agendar cita si el cliente parece interesado

# EJEMPLO DE RESPUESTAS

Cliente: "¿Cuánto cuesta una limpieza dental?"
Tú: "La limpieza dental tiene un costo de $800. El procedimiento dura aproximadamente 45 minutos. ¿Te gustaría agendar una cita?"

Cliente: "¿Cuánto cobran por consulta?"
Tú: "La consulta de valoración tiene un costo de $500, y si decides realizar el tratamiento ese mismo día, se descuenta del total. ¿Hay algún servicio en particular que te interese?"

Cliente: "¿Tienen alguna promoción?"
Tú: "Sí, actualmente tenemos [promoción]. ¿Te interesa aprovecharla?"`,
      temperature: 0.5,
      maxTokens: 300,
      canHandoffTo: ['booking', 'faq', 'escalation'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    // Construir contexto de servicios y precios
    const servicesContext = `# CATÁLOGO DE SERVICIOS Y PRECIOS
${formatServicesForPrompt(state.business_context)}`;

    // Detectar si pregunta por servicio específico
    const services = state.business_context?.services || [];
    let serviceMatch: string | null = null;

    const messageLower = state.current_message.toLowerCase();
    for (const service of services) {
      if (messageLower.includes(service.name.toLowerCase())) {
        serviceMatch = service.name;
        break;
      }
    }

    let additionalContext = servicesContext;

    if (serviceMatch) {
      additionalContext += `\n\nNOTA: El cliente pregunta específicamente por "${serviceMatch}". Da información detallada de este servicio.`;
    }

    // Si detectamos interés en servicio, actualizar extracted_data
    if (state.extracted_data.service_interest?.price_sensitive) {
      additionalContext += `\n\nNOTA: El cliente parece sensible al precio. Menciona opciones de financiamiento o paquetes si existen.`;
    }

    const { response, tokens } = await this.callLLM(state, additionalContext);

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

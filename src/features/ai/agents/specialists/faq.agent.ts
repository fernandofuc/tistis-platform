// =====================================================
// TIS TIS PLATFORM - FAQ Agent
// Agente especializado en preguntas frecuentes
// =====================================================

import { BaseAgent, type AgentResult, formatFAQsForPrompt, formatServicesForPrompt } from './base.agent';
import type { TISTISAgentStateType } from '../../state';

// ======================
// FAQ AGENT
// ======================

/**
 * Agente de FAQ
 *
 * Responsabilidades:
 * 1. Responder preguntas frecuentes
 * 2. Proporcionar información general del negocio
 * 3. Explicar procedimientos y servicios
 * 4. Guiar hacia información más específica o booking
 */
class FAQAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'faq',
      description: 'Agente de preguntas frecuentes e información general',
      systemPromptTemplate: `Eres el especialista en información de {{TENANT_NAME}}.

# TU ROL
Tu trabajo es responder preguntas generales sobre el negocio, servicios y procedimientos.
- Usa las FAQs configuradas como referencia principal
- Si la pregunta no está en FAQs, usa el contexto del negocio
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

# EJEMPLO DE RESPUESTAS

Cliente: "¿Cómo funciona el tratamiento?"
Tú: "El tratamiento consiste en [explicación clara]. Generalmente toma [tiempo] y los resultados [descripción]. ¿Te gustaría más información o agendar una valoración?"

Cliente: "¿Qué incluye la consulta?"
Tú: "La consulta incluye [lista de lo incluido]. Al final te entregaremos [resultados]. ¿Te gustaría agendar?"

Cliente: "¿Aceptan seguros?"
Tú: "Sí, trabajamos con [seguros]. Para verificar tu cobertura específica, te recomendamos traer tu póliza a la consulta. ¿Te ayudo a agendar?"`,
      temperature: 0.6,
      maxTokens: 350,
      canHandoffTo: ['pricing', 'booking', 'location', 'escalation'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    // Construir contexto de FAQs y servicios
    const faqsContext = `# PREGUNTAS FRECUENTES
${formatFAQsForPrompt(state.business_context)}`;

    const servicesContext = `# SERVICIOS DISPONIBLES
${formatServicesForPrompt(state.business_context)}`;

    // Buscar si hay FAQ que coincida con la pregunta
    const faqs = state.business_context?.faqs || [];
    const messageLower = state.current_message.toLowerCase();

    let matchingFaq: { question: string; answer: string } | null = null;
    for (const faq of faqs) {
      const questionLower = faq.question.toLowerCase();
      // Buscar coincidencia por palabras clave
      const keywords = questionLower.split(' ').filter((w) => w.length > 3);
      const matches = keywords.filter((kw) => messageLower.includes(kw));
      if (matches.length >= 2 || messageLower.includes(questionLower)) {
        matchingFaq = faq;
        break;
      }
    }

    let additionalContext = `${faqsContext}\n\n${servicesContext}`;

    if (matchingFaq) {
      additionalContext += `\n\nNOTA: Hay una FAQ que coincide con la pregunta:
Pregunta: ${matchingFaq.question}
Respuesta: ${matchingFaq.answer}
Usa esta respuesta como base pero personalízala al contexto de la conversación.`;
    }

    const { response, tokens } = await this.callLLM(state, additionalContext);

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

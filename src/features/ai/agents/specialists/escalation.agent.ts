// =====================================================
// TIS TIS PLATFORM - Escalation Agent
// Agente que maneja la escalación a humanos
// =====================================================

import { BaseAgent, type AgentResult } from './base.agent';
import type { TISTISAgentStateType } from '../../state';
import { escalateConversation } from '../../services/ai.service';

// ======================
// ESCALATION AGENT
// ======================

/**
 * Agente de Escalación
 *
 * Este agente se activa cuando:
 * 1. El cliente solicita hablar con un humano
 * 2. Se detecta una situación urgente
 * 3. El AI no puede manejar la solicitud
 * 4. Se alcanza el límite de iteraciones
 */
class EscalationAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'escalation',
      description: 'Agente de escalación a atención humana',
      systemPromptTemplate: `Eres el asistente de transición de {{TENANT_NAME}}.

# TU ROL
Tu trabajo es informar al cliente que será atendido por un humano.
- Sé empático y asegura al cliente que será atendido
- No intentes resolver el problema tú mismo
- Proporciona información de tiempo de espera si aplica

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- Sé empático y tranquilizador
- NO uses emojis a menos que el cliente los use primero

# INSTRUCCIONES ESPECÍFICAS
- Informa que un asesor humano tomará la conversación
- Si es urgencia/emergencia, da información de contacto directo
- Agradece la paciencia del cliente
- No prometas tiempos específicos si no los conoces

# TIPOS DE ESCALACIÓN

## URGENCIA/EMERGENCIA
Si el cliente tiene dolor intenso o emergencia, responde:
"Entiendo que es urgente. Un asesor te contactará de inmediato. Si es una emergencia médica grave, te recomiendo acudir directamente a urgencias o llamar a [número de emergencia]."

## SOLICITUD DE HUMANO
Si el cliente pidió hablar con un humano:
"Por supuesto, te comunico con uno de nuestros asesores. En breve te atenderá una persona de nuestro equipo."

## LÍMITE DE CAPACIDAD
Si el AI no puede resolver:
"Gracias por tu paciencia. Para brindarte la mejor atención, te comunicaré con uno de nuestros especialistas que podrá ayudarte con tu consulta específica."`,
      temperature: 0.5,
      maxTokens: 200,
      canHandoffTo: [], // No puede hacer handoff a otros agentes
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const escalationReason = state.control.escalation_reason || 'Escalación solicitada';
    const intent = state.detected_intent;

    // Determinar tipo de escalación
    let escalationType: 'urgent' | 'human_request' | 'limit' | 'general' = 'general';

    // Obtener configuración de límite del tenant
    const maxIterations = state.tenant?.ai_config?.max_turns_before_escalation ?? 5;

    if (intent === 'PAIN_URGENT' || state.extracted_data.pain_level && state.extracted_data.pain_level >= 4) {
      escalationType = 'urgent';
    } else if (intent === 'HUMAN_REQUEST') {
      escalationType = 'human_request';
    } else if (state.control.max_iterations_reached || state.control.iteration_count >= maxIterations) {
      escalationType = 'limit';
    }

    // Construir contexto específico según el tipo
    let additionalContext = `\n\n# CONTEXTO DE ESCALACIÓN\n`;
    additionalContext += `- Tipo: ${escalationType}\n`;
    additionalContext += `- Razón: ${escalationReason}\n`;

    if (escalationType === 'urgent') {
      additionalContext += `\nIMPORTANTE: Es una situación urgente. Prioriza la seguridad del paciente.`;

      // Buscar número de emergencia del negocio
      const branches = state.business_context?.branches || [];
      const mainBranch = branches.find((b) => b.is_headquarters) || branches[0];
      if (mainBranch?.phone) {
        additionalContext += `\nNúmero directo: ${mainBranch.phone}`;
      }
    }

    if (state.lead?.name) {
      additionalContext += `\nNombre del cliente: ${state.lead.name}`;
    }

    const { response, tokens } = await this.callLLM(state, additionalContext);

    // Ejecutar escalación en la base de datos
    if (state.conversation?.conversation_id) {
      try {
        await escalateConversation(state.conversation.conversation_id, escalationReason);
        console.log(`[Escalation] Conversation ${state.conversation.conversation_id} escalated: ${escalationReason}`);
      } catch (error) {
        console.error('[Escalation] Error escalating conversation:', error);
      }
    }

    return {
      response,
      tokens_used: tokens,
      should_escalate: true,
      escalation_reason: escalationReason,
    };
  }
}

// ======================
// URGENT CARE AGENT
// ======================

/**
 * Agente de Cuidado Urgente
 *
 * Especializado en situaciones de dolor o emergencia médica.
 * Puede ofrecer cita de emergencia antes de escalar.
 */
class UrgentCareAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'urgent_care',
      description: 'Agente para situaciones urgentes y de dolor',
      systemPromptTemplate: `Eres el asistente de emergencias de {{TENANT_NAME}}.

# TU ROL
Tu trabajo es atender a clientes con situaciones urgentes o dolor.
- Muestra empatía inmediata
- Evalúa la urgencia
- Ofrece cita de emergencia si es posible
- Escala a humano si es necesario

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- Sé empático pero eficiente
- Prioriza la seguridad del paciente

# INSTRUCCIONES ESPECÍFICAS
- Primero muestra empatía por el dolor/situación
- Pregunta brevemente sobre la severidad si no está clara
- Ofrece la cita más pronto disponible
- Si es emergencia grave, proporciona número directo
- Siempre termina asegurando que serán atendidos

# EJEMPLO DE RESPUESTAS

Cliente: "Me duele mucho la muela"
Tú: "Lamento que estés pasando por esto. Tenemos espacios de emergencia. ¿Puedes venir hoy mismo? Tenemos disponible a las [hora]. Si el dolor es insoportable, también puedes llamar directamente al [número]."

Cliente: "Tengo una emergencia"
Tú: "Entiendo. Para emergencias tenemos atención prioritaria. ¿Puedes contarme brevemente qué pasa para ayudarte de la mejor manera?"`,
      temperature: 0.4,
      maxTokens: 250,
      canHandoffTo: ['booking', 'escalation'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const painLevel = state.extracted_data.pain_level || 3;

    // Si el dolor es muy alto, priorizar atención inmediata
    if (painLevel >= 4) {
      const branches = state.business_context?.branches || [];
      const mainBranch = branches.find((b) => b.is_headquarters) || branches[0];

      let urgentContext = `\n\n# SITUACIÓN URGENTE\n`;
      urgentContext += `- Nivel de dolor reportado: ${painLevel}/5 (ALTO)\n`;

      if (mainBranch?.phone) {
        urgentContext += `- Número directo para emergencias: ${mainBranch.phone}\n`;
      }

      urgentContext += `\nPrioriza conseguirle una cita lo antes posible o que llame directamente.`;

      const { response, tokens } = await this.callLLM(state, urgentContext);

      // Marcar para escalación prioritaria
      return {
        response,
        tokens_used: tokens,
        should_escalate: true,
        escalation_reason: `Dolor nivel ${painLevel}/5 - requiere atención prioritaria`,
      };
    }

    // Dolor moderado - ofrecer cita pronto
    const { response, tokens } = await this.callLLM(
      state,
      '\nEl cliente tiene molestias. Ofrece una cita pronto pero no es emergencia crítica.'
    );

    // Hacer handoff a booking para agendar
    return {
      response,
      next_agent: 'booking',
      handoff_reason: 'Urgent care needs booking for soon appointment',
      tokens_used: tokens,
    };
  }
}

// Instancias singleton
export const EscalationAgent = new EscalationAgentClass();
export const UrgentCareAgent = new UrgentCareAgentClass();

// Nodos para LangGraph
export const escalationNode = EscalationAgent.toNode();
export const urgentCareNode = UrgentCareAgent.toNode();

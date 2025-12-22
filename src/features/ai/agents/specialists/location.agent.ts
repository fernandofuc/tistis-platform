// =====================================================
// TIS TIS PLATFORM - Location Agent
// Agente especializado en consultas de ubicación
// =====================================================

import { BaseAgent, type AgentResult, formatBranchesForPrompt } from './base.agent';
import type { TISTISAgentStateType } from '../../state';

// ======================
// LOCATION AGENT
// ======================

/**
 * Agente de Ubicación
 *
 * Responsabilidades:
 * 1. Proporcionar direcciones claras
 * 2. Compartir links de Google Maps
 * 3. Explicar cómo llegar
 * 4. Informar sobre estacionamiento
 */
class LocationAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'location',
      description: 'Agente de consultas de ubicación y direcciones',
      systemPromptTemplate: `Eres el especialista en ubicaciones de {{TENANT_NAME}}.

# TU ROL
Tu trabajo es ayudar a los clientes a encontrar nuestras sucursales.
- Proporciona direcciones completas y claras
- Siempre incluye el link de Google Maps si está disponible
- Menciona referencias útiles para llegar
- Informa sobre opciones de estacionamiento si aplica

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- Sé muy claro con las direcciones
- NO uses emojis a menos que el cliente los use primero

# INSTRUCCIONES ESPECÍFICAS
- Si hay múltiples sucursales, pregunta cuál le queda más cerca
- Proporciona siempre la dirección completa
- Incluye el link de Google Maps para facilitar la navegación
- Si preguntan por horarios también, respóndelos
- Después de dar la ubicación, ofrece agendar cita

# EJEMPLO DE RESPUESTAS

Cliente: "¿Dónde están ubicados?"
Tú: "Nuestra clínica está en [dirección completa]. Te comparto el link de Google Maps: [link]. ¿Te gustaría agendar una cita?"

Cliente: "¿Cómo llego a su consultorio?"
Tú: "Estamos ubicados en [dirección]. Como referencia, estamos [referencia]. Aquí tienes el mapa: [link]. ¿Hay algo más en lo que pueda ayudarte?"

Cliente: "¿Tienen estacionamiento?"
Tú: "Sí, contamos con estacionamiento para clientes. Nuestra dirección es [dirección]. ¿Quieres que te ayude a agendar una cita?"`,
      temperature: 0.5,
      maxTokens: 250,
      canHandoffTo: ['booking', 'hours'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    // Construir contexto de sucursales
    const branchesContext = `# SUCURSALES Y UBICACIONES
${formatBranchesForPrompt(state.business_context)}`;

    // Detectar si pregunta por sucursal específica
    const branches = state.business_context?.branches || [];
    let branchMatch: string | null = null;

    const messageLower = state.current_message.toLowerCase();
    for (const branch of branches) {
      if (messageLower.includes(branch.name.toLowerCase()) ||
          messageLower.includes(branch.city.toLowerCase())) {
        branchMatch = branch.name;
        break;
      }
    }

    let additionalContext = branchesContext;

    if (branchMatch) {
      additionalContext += `\n\nNOTA: El cliente pregunta específicamente por "${branchMatch}". Da información detallada de esta sucursal.`;
    } else if (branches.length > 1) {
      additionalContext += `\n\nNOTA: Hay múltiples sucursales. Pregunta al cliente cuál le queda más cerca o menciona la principal.`;
    }

    // Si hay sucursal preferida del lead, mencionarla
    if (state.lead?.preferred_branch_id) {
      const preferredBranch = branches.find((b) => b.id === state.lead?.preferred_branch_id);
      if (preferredBranch) {
        additionalContext += `\n\nNOTA: La sucursal preferida del cliente es "${preferredBranch.name}". Prioriza esta información.`;
      }
    }

    const { response, tokens } = await this.callLLM(state, additionalContext);

    return {
      response,
      tokens_used: tokens,
    };
  }
}

// Instancia singleton
export const LocationAgent = new LocationAgentClass();

// Nodo para LangGraph
export const locationNode = LocationAgent.toNode();

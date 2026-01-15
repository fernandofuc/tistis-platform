// =====================================================
// TIS TIS PLATFORM - Location Agent
// Agente especializado en consultas de ubicación
// =====================================================
//
// ARQUITECTURA v6.0:
// - Usa Tool Calling para obtener información on-demand
// - Consulta sucursales específicas sin cargar todas
// =====================================================

import { BaseAgent, type AgentResult, formatBranchesForPrompt } from './base.agent';
import type { TISTISAgentStateType } from '../../state';
import { createToolsForAgent } from '../../tools';

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
 *
 * TOOLS DISPONIBLES:
 * - get_branch_info: Información de sucursales específicas
 * - get_operating_hours: Horarios de atención
 */
class LocationAgentClass extends BaseAgent {
  /** Flag para usar Tool Calling vs modo legacy */
  private useToolCalling: boolean = true;

  constructor() {
    super({
      name: 'location',
      description: 'Agente de consultas de ubicación y direcciones',
      systemPromptTemplate: `Eres el especialista en ubicaciones de {{TENANT_NAME}}.

# TU ROL
Tu trabajo es ayudar a los clientes a encontrar nuestras sucursales.
- USA get_branch_info para obtener información de sucursales
- USA get_operating_hours si preguntan por horarios también
- Proporciona direcciones completas y claras
- Siempre incluye el link de Google Maps si está disponible

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

# IMPORTANTE
- NO inventes direcciones. Usa get_branch_info para obtener la información correcta.
- Si no encuentras la sucursal, indica que verificarás con el negocio.`,
      temperature: 0.5,
      maxTokens: 250,
      canHandoffTo: ['booking', 'hours'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const messageLower = state.current_message.toLowerCase();

    // Detectar si pregunta por sucursal específica
    const branches = state.business_context?.branches || [];
    let additionalContext = '';

    // Detectar menciones de sucursales específicas
    for (const branch of branches) {
      if (messageLower.includes(branch.name.toLowerCase()) ||
          (branch.city && messageLower.includes(branch.city.toLowerCase()))) {
        additionalContext = `\nNOTA: El cliente pregunta específicamente por "${branch.name}". Usa get_branch_info con branch_name="${branch.name}".`;
        break;
      }
    }

    // Si hay sucursal preferida del lead
    if (state.lead?.preferred_branch_id) {
      const preferredBranch = branches.find((b) => b.id === state.lead?.preferred_branch_id);
      if (preferredBranch) {
        additionalContext += `\nNOTA: La sucursal preferida del cliente es "${preferredBranch.name}". Prioriza esta información.`;
      }
    }

    // Si hay múltiples sucursales y no especificó
    if (!additionalContext && branches.length > 1) {
      additionalContext = '\nNOTA: Hay múltiples sucursales. Pregunta al cliente cuál le queda más cerca o usa get_branch_info sin parámetros para obtener todas.';
    }

    let response: string;
    let tokens: number;
    let toolCalls: string[] = [];

    if (this.useToolCalling) {
      // =====================================================
      // NUEVA ARQUITECTURA: Tool Calling
      // =====================================================
      const tools = createToolsForAgent(this.config.name, state);

      console.log(`[location] Using Tool Calling mode with ${tools.length} tools`);

      const result = await this.callLLMWithTools(state, tools, additionalContext);
      response = result.response;
      tokens = result.tokens;
      toolCalls = result.toolCalls;

      console.log(`[location] Tool calls made: ${toolCalls.join(', ') || 'none'}`);
    } else {
      // =====================================================
      // MODO LEGACY: Context Stuffing (para compatibilidad)
      // =====================================================
      console.log(`[location] Using legacy mode (context stuffing)`);

      const branchesContext = `# SUCURSALES Y UBICACIONES
${formatBranchesForPrompt(state.business_context)}`;

      const result = await this.callLLM(state, branchesContext + additionalContext);
      response = result.response;
      tokens = result.tokens;
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
    console.log(`[location] Tool Calling mode: ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Instancia singleton
export const LocationAgent = new LocationAgentClass();

// Nodo para LangGraph
export const locationNode = LocationAgent.toNode();

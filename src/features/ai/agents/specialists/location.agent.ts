// =====================================================
// TIS TIS PLATFORM - Location Agent
// Agente especializado en consultas de ubicación
// =====================================================
//
// ARQUITECTURA V7.0:
// - Tool Calling SIEMPRE activo para obtener info on-demand
// - Consulta sucursales específicas sin cargar todas
// - CERO context stuffing
// =====================================================

import { BaseAgent, type AgentResult } from './base.agent';
import type { TISTISAgentStateType } from '../../state';
import { createToolsForAgent } from '../../tools';

// ======================
// LOCATION AGENT
// ======================

/**
 * Agente de Ubicación - ARQUITECTURA V7
 *
 * Responsabilidades:
 * 1. Proporcionar direcciones claras
 * 2. Compartir links de Google Maps
 * 3. Explicar cómo llegar
 * 4. Informar sobre estacionamiento
 *
 * TOOLS DISPONIBLES (se obtienen automáticamente vía Tool Calling):
 * - get_branch_info: Información de sucursales específicas
 * - get_operating_hours: Horarios de atención
 */
class LocationAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'location',
      description: 'Agente de consultas de ubicación y direcciones',
      systemPromptTemplate: `Eres el especialista en ubicaciones de {{TENANT_NAME}}.

# TU ROL
Tu trabajo es ayudar a los clientes a encontrar nuestras sucursales.

# USO OBLIGATORIO DE HERRAMIENTAS
REGLA CRÍTICA: NUNCA inventes direcciones ni información de contacto.

1. Información de una sucursal específica:
   → USA get_branch_info(branch_name="nombre de la sucursal")
   - Ejemplo: "¿dónde está la sucursal del centro?" → get_branch_info(branch_name="Centro")

2. Todas las sucursales:
   → USA get_branch_info() sin parámetros
   - Retorna lista completa con direcciones y Google Maps

3. Si también preguntan horarios:
   → USA get_operating_hours(branch_name="sucursal", day="día")
   - Puedes combinar con get_branch_info en la misma respuesta

# INFORMACIÓN QUE DEBES INCLUIR (si está disponible)
- Dirección completa (calle, número, colonia, CP, ciudad)
- Link de Google Maps (SIEMPRE si está disponible)
- Teléfono de la sucursal
- Puntos de referencia si los hay
- Información de estacionamiento si aplica

# FLUJO RECOMENDADO
1. Si hay UNA sola sucursal → get_branch_info() y da toda la info
2. Si hay MÚLTIPLES sucursales:
   - Pregunta cuál le queda más cerca: "¿Cuál zona te queda mejor: Centro, Norte o Sur?"
   - O lista todas brevemente si pregunta por todas
3. Después de dar ubicación → ofrece agendar cita

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- Sé muy claro con las direcciones
- NO uses emojis a menos que el cliente los use primero

# MANEJO DE ERRORES
- Si get_branch_info no encuentra la sucursal:
  → "No encontré esa sucursal. Tenemos las siguientes: [listar sucursales disponibles]"
- Si no hay Google Maps disponible:
  → Da la dirección completa para que pueda buscarla
- NUNCA inventes direcciones que no provengan de get_branch_info`,
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

    // =====================================================
    // ARQUITECTURA V7: Tool Calling SIEMPRE activo
    // NO hay modo legacy - CERO context stuffing
    // =====================================================
    const tools = createToolsForAgent(this.config.name, state);

    console.log(`[location] V7 Tool Calling with ${tools.length} tools`);

    const result = await this.callLLMWithTools(state, tools, additionalContext);
    const response = result.response;
    const tokens = result.tokens;
    const toolCalls = result.toolCalls;

    console.log(`[location] Tool calls made: ${toolCalls.join(', ') || 'none'}`);

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

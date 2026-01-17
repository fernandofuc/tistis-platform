// =====================================================
// TIS TIS PLATFORM - Hours Agent
// Agente especializado en consultas de horarios
// =====================================================
//
// ARQUITECTURA V7.0:
// - Tool Calling SIEMPRE activo para obtener info on-demand
// - Consulta horarios específicos sin cargar todo el contexto
// - CERO context stuffing
// =====================================================

import { BaseAgent, type AgentResult } from './base.agent';
import type { TISTISAgentStateType } from '../../state';
import { createToolsForAgent } from '../../tools';

// ======================
// HOURS AGENT
// ======================

/**
 * Agente de Horarios - ARQUITECTURA V7
 *
 * Responsabilidades:
 * 1. Proporcionar horarios de atención
 * 2. Informar sobre días festivos o cierres especiales
 * 3. Indicar horarios por sucursal si hay múltiples
 *
 * TOOLS DISPONIBLES (se obtienen automáticamente vía Tool Calling):
 * - get_operating_hours: Horarios de atención por sucursal/día
 * - get_branch_info: Información adicional de sucursales
 */
class HoursAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'hours',
      description: 'Agente de consultas de horarios de atención',
      systemPromptTemplate: `Eres el especialista en horarios de {{TENANT_NAME}}.

# TU ROL
Tu trabajo es proporcionar información clara sobre horarios de atención.
- USA get_operating_hours para obtener horarios específicos
- USA get_branch_info si necesitas información adicional de sucursales
- Da horarios específicos y claros
- Informa sobre días de descanso

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- Sé muy claro con los horarios
- NO uses emojis a menos que el cliente los use primero

# INSTRUCCIONES ESPECÍFICAS
- Da el horario completo (apertura y cierre)
- Si preguntan por un día específico, responde ese día
- Si hay múltiples sucursales, pregunta cuál le interesa o da todas
- Después de dar horario, ofrece agendar cita

# IMPORTANTE
- NO inventes horarios. Usa get_operating_hours para obtener la información correcta.
- Si el día preguntado está cerrado, indica alternativas.`,
      temperature: 0.5,
      maxTokens: 200,
      canHandoffTo: ['booking', 'location'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const messageLower = state.current_message.toLowerCase();

    // Detectar si pregunta por día específico
    const dayKeywords: Record<string, string> = {
      'lunes': 'lunes',
      'martes': 'martes',
      'miércoles': 'miércoles',
      'miercoles': 'miércoles',
      'jueves': 'jueves',
      'viernes': 'viernes',
      'sábado': 'sábado',
      'sabado': 'sábado',
      'domingo': 'domingo',
      'hoy': new Date().toLocaleDateString('es-MX', { weekday: 'long' }).toLowerCase(),
      'mañana': new Date(Date.now() + 86400000).toLocaleDateString('es-MX', { weekday: 'long' }).toLowerCase(),
    };

    let specificDay: string | null = null;
    for (const [keyword, day] of Object.entries(dayKeywords)) {
      if (messageLower.includes(keyword)) {
        specificDay = day;
        break;
      }
    }

    let additionalContext = '';
    if (specificDay) {
      additionalContext = `\nNOTA: El cliente pregunta por el día "${specificDay}". Usa get_operating_hours con day="${specificDay}" para obtener ese horario específico.`;
    }

    // =====================================================
    // ARQUITECTURA V7: Tool Calling SIEMPRE activo
    // NO hay modo legacy - CERO context stuffing
    // =====================================================
    const tools = createToolsForAgent(this.config.name, state);

    console.log(`[hours] V7 Tool Calling with ${tools.length} tools`);

    const result = await this.callLLMWithTools(state, tools, additionalContext);
    const response = result.response;
    const tokens = result.tokens;
    const toolCalls = result.toolCalls;

    console.log(`[hours] Tool calls made: ${toolCalls.join(', ') || 'none'}`);

    return {
      response,
      tokens_used: tokens,
    };
  }
}

// Instancia singleton
export const HoursAgent = new HoursAgentClass();

// Nodo para LangGraph
export const hoursNode = HoursAgent.toNode();

// =====================================================
// TIS TIS PLATFORM - Hours Agent
// Agente especializado en consultas de horarios
// =====================================================
//
// ARQUITECTURA v6.0:
// - Usa Tool Calling para obtener información on-demand
// - Consulta horarios específicos sin cargar todo el contexto
// =====================================================

import { BaseAgent, type AgentResult, formatBranchesForPrompt } from './base.agent';
import type { TISTISAgentStateType } from '../../state';
import { createToolsForAgent } from '../../tools';

// ======================
// HOURS AGENT
// ======================

/**
 * Agente de Horarios
 *
 * Responsabilidades:
 * 1. Proporcionar horarios de atención
 * 2. Informar sobre días festivos o cierres especiales
 * 3. Indicar horarios por sucursal si hay múltiples
 *
 * TOOLS DISPONIBLES:
 * - get_operating_hours: Horarios de atención por sucursal/día
 * - get_branch_info: Información adicional de sucursales
 */
class HoursAgentClass extends BaseAgent {
  /** Flag para usar Tool Calling vs modo legacy */
  private useToolCalling: boolean = true;

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

    let response: string;
    let tokens: number;
    let toolCalls: string[] = [];

    if (this.useToolCalling) {
      // =====================================================
      // NUEVA ARQUITECTURA: Tool Calling
      // =====================================================
      const tools = createToolsForAgent(this.config.name, state);

      console.log(`[hours] Using Tool Calling mode with ${tools.length} tools`);

      const result = await this.callLLMWithTools(state, tools, additionalContext);
      response = result.response;
      tokens = result.tokens;
      toolCalls = result.toolCalls;

      console.log(`[hours] Tool calls made: ${toolCalls.join(', ') || 'none'}`);
    } else {
      // =====================================================
      // MODO LEGACY: Context Stuffing (para compatibilidad)
      // =====================================================
      console.log(`[hours] Using legacy mode (context stuffing)`);

      const branches = state.business_context?.branches || [];

      let hoursContext = '# HORARIOS DE ATENCIÓN\n\n';

      for (const branch of branches) {
        const hqTag = branch.is_headquarters ? ' (Principal)' : '';
        hoursContext += `## ${branch.name}${hqTag}\n`;

        if (branch.operating_hours && Object.keys(branch.operating_hours).length > 0) {
          const dayNames: Record<string, string> = {
            monday: 'Lunes',
            tuesday: 'Martes',
            wednesday: 'Miércoles',
            thursday: 'Jueves',
            friday: 'Viernes',
            saturday: 'Sábado',
            sunday: 'Domingo',
          };

          for (const [day, hours] of Object.entries(branch.operating_hours)) {
            if (hours && typeof hours === 'object' && 'open' in hours) {
              const dayName = dayNames[day.toLowerCase()] || day;
              hoursContext += `- ${dayName}: ${hours.open} - ${hours.close}\n`;
            }
          }
        } else {
          hoursContext += '- Horarios no disponibles\n';
        }

        hoursContext += '\n';
      }

      const result = await this.callLLM(state, hoursContext + additionalContext);
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
    console.log(`[hours] Tool Calling mode: ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Instancia singleton
export const HoursAgent = new HoursAgentClass();

// Nodo para LangGraph
export const hoursNode = HoursAgent.toNode();

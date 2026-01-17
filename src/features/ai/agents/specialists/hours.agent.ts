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

# USO OBLIGATORIO DE HERRAMIENTAS
REGLA CRÍTICA: NUNCA inventes horarios. CADA horario DEBE provenir de get_operating_hours.

1. Horario de un día específico:
   → USA get_operating_hours(day="lunes")
   - Días válidos: lunes, martes, miércoles, jueves, viernes, sábado, domingo
   - Ejemplo: "¿abren los sábados?" → get_operating_hours(day="sábado")

2. Horario completo de la semana:
   → USA get_operating_hours() sin parámetros
   - Retorna todos los días con apertura y cierre

3. Horario de sucursal específica:
   → USA get_operating_hours(branch_name="Centro")
   - Si hay múltiples sucursales con horarios diferentes

4. Si también preguntan ubicación:
   → USA get_branch_info() para complementar

# FORMATO DE RESPUESTA
- Siempre incluye hora de apertura Y cierre
- Formato claro: "Lunes a Viernes: 9:00 AM - 7:00 PM"
- Si está cerrado un día: "Domingos: Cerrado"
- Menciona días festivos si hay información disponible

# FLUJO RECOMENDADO
1. Pregunta por día específico → get_operating_hours(day="día")
2. Pregunta general → get_operating_hours() para toda la semana
3. Si el día está cerrado → sugiere el día más cercano abierto
4. Después de dar horario → ofrece agendar cita

# INTERPRETACIÓN DE "HOY" Y "MAÑANA"
- Si dicen "hoy" → el sistema ya detecta qué día es y te lo indica
- Si dicen "mañana" → el sistema calcula el día siguiente

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- Sé muy claro con los horarios
- NO uses emojis a menos que el cliente los use primero

# MANEJO DE ERRORES
- Si no hay horario para un día: "Ese día estamos cerrados. ¿Te gustaría saber el horario de [día más cercano]?"
- Si no hay horarios configurados: "No tengo los horarios disponibles, pero puedo conectarte con alguien que te ayude."
- NUNCA inventes horarios que no provengan de get_operating_hours`,
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

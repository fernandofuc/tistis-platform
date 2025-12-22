// =====================================================
// TIS TIS PLATFORM - Hours Agent
// Agente especializado en consultas de horarios
// =====================================================

import { BaseAgent, type AgentResult, formatBranchesForPrompt } from './base.agent';
import type { TISTISAgentStateType } from '../../state';

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
 */
class HoursAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'hours',
      description: 'Agente de consultas de horarios de atención',
      systemPromptTemplate: `Eres el especialista en horarios de {{TENANT_NAME}}.

# TU ROL
Tu trabajo es proporcionar información clara sobre horarios de atención.
- Da horarios específicos y claros
- Menciona si hay diferencias entre sucursales
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

# EJEMPLO DE RESPUESTAS

Cliente: "¿A qué hora abren?"
Tú: "Nuestro horario es de lunes a viernes de 9:00am a 7:00pm, y sábados de 9:00am a 2:00pm. ¿Te gustaría agendar una cita?"

Cliente: "¿Atienden los domingos?"
Tú: "Los domingos no tenemos atención regular, pero para emergencias puedes llamar al [número]. De lunes a sábado te podemos atender. ¿Quieres que te agende para el lunes?"`,
      temperature: 0.5,
      maxTokens: 200,
      canHandoffTo: ['booking', 'location'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const branches = state.business_context?.branches || [];

    // Construir contexto de horarios
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

    // Detectar si pregunta por día específico
    const messageLower = state.current_message.toLowerCase();
    const dayKeywords: Record<string, string> = {
      'lunes': 'monday',
      'martes': 'tuesday',
      'miércoles': 'wednesday',
      'miercoles': 'wednesday',
      'jueves': 'thursday',
      'viernes': 'friday',
      'sábado': 'saturday',
      'sabado': 'saturday',
      'domingo': 'sunday',
      'hoy': new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
      'mañana': new Date(Date.now() + 86400000).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
    };

    let specificDay: string | null = null;
    for (const [keyword, day] of Object.entries(dayKeywords)) {
      if (messageLower.includes(keyword)) {
        specificDay = day;
        break;
      }
    }

    if (specificDay) {
      hoursContext += `\nNOTA: El cliente pregunta específicamente por el ${specificDay}. Da información clara de ese día.`;
    }

    const { response, tokens } = await this.callLLM(state, hoursContext);

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

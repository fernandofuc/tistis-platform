// =====================================================
// TIS TIS PLATFORM - Supervisor Agent
// Agente principal que orquesta el flujo de conversación
// =====================================================
// REVISIÓN 5.0: Integración con SafetyResilienceService
// - P25: Detección de emergencias médicas/dentales
// - P27: Detección de eventos especiales (restaurant)
// - P29: Detección de alergias y safety requirements
// - P23: Validación de configuración incompleta
// =====================================================

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import {
  type TISTISAgentStateType,
  type AgentTrace,
  addAgentTrace,
} from '../../state';
import type { AIIntent, AISignal } from '@/src/shared/types/whatsapp';
import { DEFAULT_MODELS } from '@/src/shared/config/ai-models';
import {
  SafetyResilienceService,
  logSafetyIncident,
  logSpecialEventRequest,
  type EmergencyDetectionResult,
  type SafetyDetectionResult,
  type SpecialEventDetectionResult,
  type ConfigCompleteness,
  type SafetyIncidentType,
  type SafetyActionTaken,
} from '../../services/safety-resilience.service';

// ======================
// CONFIGURATION
// ======================

const SUPERVISOR_MODEL = DEFAULT_MODELS.MESSAGING; // gpt-5-mini
const MAX_TOKENS = 300;
const TEMPERATURE = 0.3; // Bajo para decisiones consistentes

// ======================
// TYPES
// ======================

interface SupervisorDecision {
  intent: AIIntent;
  signals: AISignal[];
  next_agent: string;
  routing_reason: string;
  should_escalate: boolean;
  escalation_reason?: string;
  extracted_data: Partial<TISTISAgentStateType['extracted_data']>;
}

// P25/P27/P29: Safety & Resilience Detection Results
interface SafetyAnalysisResult {
  emergency: EmergencyDetectionResult;
  safety: SafetyDetectionResult;
  specialEvent: SpecialEventDetectionResult;
  configCompleteness: ConfigCompleteness;
}

// ======================
// INTENT DETECTION (Rule-based para velocidad)
// ======================

/**
 * Detecta la intención del mensaje usando reglas (ultra rápido)
 * Esto se ejecuta ANTES de llamar al LLM para optimizar
 */
function detectIntentRuleBased(message: string): AIIntent {
  const messageLower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Patrones de intención ordenados por prioridad
  const patterns: Array<{ intent: AIIntent; regex: RegExp }> = [
    // URGENCIA - Prioridad máxima
    {
      intent: 'PAIN_URGENT',
      regex: /\b(dolor|duele|molest|urgen|emergen|sangr|hincha|infla|roto|quebr|fractur|accidente)\b/,
    },
    // SOLICITUD DE HUMANO
    {
      intent: 'HUMAN_REQUEST',
      regex: /\b(humano|persona|asesor|gerente|encargado|supervisor|hablar con alguien|quiero hablar)\b/,
    },
    // FACTURACIÓN - Alta prioridad para restaurantes
    {
      intent: 'INVOICE_REQUEST',
      regex: /\b(factura|facturar|cfdi|rfc|datos fiscales|necesito factura|quiero factura|mi factura|comprobante fiscal)\b/,
    },
    // BOOKING - Alta prioridad comercial
    {
      intent: 'BOOK_APPOINTMENT',
      regex: /\b(cita|agendar|reservar|appointment|disponib|horario|agenda|turno|cuando pueden|cuando puedo|fecha|manana|pasado|semana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/,
    },
    // PRECIO
    {
      intent: 'PRICE_INQUIRY',
      regex: /\b(precio|costo|cuanto|valor|cotiz|tarifa|presupuesto|cobra|pagar|caro|barato|economico|financ|meses sin)\b/,
    },
    // UBICACIÓN
    {
      intent: 'LOCATION',
      regex: /\b(donde|ubicacion|direccion|llegar|mapa|sucursal|consultorio|clinica|local|estaciona|cerca)\b/,
    },
    // HORARIOS
    {
      intent: 'HOURS',
      regex: /\b(horario|abren|cierran|atienden|hora de|que hora|hasta que hora|a que hora)\b/,
    },
    // FAQ
    {
      intent: 'FAQ',
      regex: /\b(como funciona|que incluye|cuanto dura|requisitos|necesito|puedo|se puede|acepta|tienen|ofrecen|hacen|realizan)\b/,
    },
    // SALUDO
    {
      intent: 'GREETING',
      regex: /^(hola|buenos|buenas|hi|hello|hey|saludos|que tal|buen dia|buenas tardes|buenas noches)/,
    },
  ];

  for (const { intent, regex } of patterns) {
    if (regex.test(messageLower)) {
      return intent;
    }
  }

  return 'UNKNOWN';
}

/**
 * Detecta señales de scoring basado en keywords
 */
function detectSignals(
  message: string,
  scoringRules: TISTISAgentStateType['business_context']
): AISignal[] {
  const signals: AISignal[] = [];
  const messageLower = message.toLowerCase();

  const rules = scoringRules?.scoring_rules || [];

  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      if (messageLower.includes(keyword.toLowerCase())) {
        signals.push({
          signal: rule.signal_name,
          points: rule.points,
        });
        break; // Solo contar una vez por regla
      }
    }
  }

  return signals;
}

/**
 * Extrae datos estructurados del mensaje
 */
function extractData(message: string): Partial<TISTISAgentStateType['extracted_data']> {
  const extracted: Partial<TISTISAgentStateType['extracted_data']> = {};

  // Extraer email
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    extracted.email = emailMatch[0];
  }

  // Extraer teléfono (formato mexicano)
  const phoneMatch = message.match(/\b(\+?52)?[\s.-]?\d{2,3}[\s.-]?\d{3,4}[\s.-]?\d{4}\b/);
  if (phoneMatch) {
    extracted.phone = phoneMatch[0].replace(/[\s.-]/g, '');
  }

  // Detectar fechas relativas
  const messageLower = message.toLowerCase();
  if (/\b(hoy|ahora|ya)\b/.test(messageLower)) {
    extracted.preferred_date = 'today';
    extracted.service_interest = {
      ...extracted.service_interest,
      service_name: '',
      urgency: 'urgent',
      price_sensitive: false,
    };
  } else if (/\b(mañana|manana)\b/.test(messageLower)) {
    extracted.preferred_date = 'tomorrow';
  } else if (/\b(esta semana|próxima semana|proxima semana)\b/.test(messageLower)) {
    extracted.preferred_date = 'this_week';
    extracted.is_flexible_schedule = true;
  }

  // Detectar horario preferido
  if (/\b(mañana|manana|temprano|am)\b/.test(messageLower)) {
    extracted.preferred_time = 'morning';
  } else if (/\b(tarde|pm|despues de las 2|despues del mediodia)\b/.test(messageLower)) {
    extracted.preferred_time = 'afternoon';
  }

  // Detectar nivel de dolor (para verticales médicas)
  if (/\b(mucho dolor|dolor fuerte|insoportable|no aguanto)\b/.test(messageLower)) {
    extracted.pain_level = 5;
    extracted.symptoms = ['dolor intenso'];
  } else if (/\b(bastante dolor|dolor moderado)\b/.test(messageLower)) {
    extracted.pain_level = 3;
  } else if (/\b(molestia|incomodidad|leve)\b/.test(messageLower)) {
    extracted.pain_level = 1;
  }

  // Detectar sensibilidad al precio
  if (/\b(barato|economico|presupuesto|caro|precio|cuanto)\b/.test(messageLower)) {
    if (extracted.service_interest) {
      extracted.service_interest.price_sensitive = true;
    }
  }

  return extracted;
}

/**
 * Determina el siguiente agente basado en la intención
 */
function determineNextAgent(
  intent: AIIntent,
  vertical: TISTISAgentStateType['vertical']
): string {
  // Mapeo de intención a agente
  const intentToAgent: Record<AIIntent, string> = {
    GREETING: 'greeting',
    PRICE_INQUIRY: 'pricing',
    BOOK_APPOINTMENT: 'booking',
    PAIN_URGENT: 'urgent_care',
    HUMAN_REQUEST: 'escalation',
    LOCATION: 'location',
    HOURS: 'hours',
    FAQ: 'faq',
    INVOICE_REQUEST: 'invoicing_restaurant',
    UNKNOWN: 'general',
  };

  // Para booking, usar agente especializado por vertical
  if (intent === 'BOOK_APPOINTMENT') {
    return `booking_${vertical}`;
  }

  // Para facturación, solo disponible para restaurantes
  if (intent === 'INVOICE_REQUEST' && vertical === 'restaurant') {
    return 'invoicing_restaurant';
  } else if (intent === 'INVOICE_REQUEST') {
    // Para otras verticales, ir a general (pueden manejarlo manualmente)
    return 'general';
  }

  return intentToAgent[intent] || 'general';
}

/**
 * Determina si debe escalar inmediatamente
 */
function shouldEscalateImmediate(
  intent: AIIntent,
  signals: AISignal[],
  message: string,
  autoEscalateKeywords: string[] = []
): { escalate: boolean; reason?: string } {
  // Escalación por intención
  if (intent === 'HUMAN_REQUEST') {
    return { escalate: true, reason: 'Cliente solicitó hablar con un humano' };
  }

  if (intent === 'PAIN_URGENT') {
    return { escalate: true, reason: 'Situación de dolor/urgencia detectada' };
  }

  // Escalación por keywords configurados
  const messageLower = message.toLowerCase();
  for (const keyword of autoEscalateKeywords) {
    if (messageLower.includes(keyword.toLowerCase())) {
      return { escalate: true, reason: `Keyword de escalación: ${keyword}` };
    }
  }

  // Escalación por múltiples señales de alto valor
  const highValueSignals = signals.filter((s) => s.points >= 15);
  if (highValueSignals.length >= 2) {
    return { escalate: true, reason: 'Lead de alto valor detectado' };
  }

  return { escalate: false };
}

// ======================
// MAIN SUPERVISOR NODE
// ======================

/**
 * Nodo Supervisor del grafo LangGraph
 *
 * Responsabilidades:
 * 1. Analizar el mensaje entrante
 * 2. Detectar intención y señales
 * 3. Extraer datos estructurados
 * 4. Decidir siguiente agente (routing)
 * 5. Determinar si escalar a humano
 * 6. REVISIÓN 5.0: Detectar emergencias, alergias, eventos especiales
 */
export async function supervisorNode(
  state: TISTISAgentStateType
): Promise<Partial<TISTISAgentStateType>> {
  const startTime = Date.now();
  const agentName = 'supervisor';

  console.log(`[Supervisor] Processing message for tenant ${state.tenant?.tenant_id}`);

  try {
    // 1. Detectar intención (rule-based, ultra rápido)
    const intent = detectIntentRuleBased(state.current_message);

    // 2. Detectar señales de scoring
    const signals = detectSignals(state.current_message, state.business_context);

    // 3. Extraer datos estructurados
    const extractedData = extractData(state.current_message);

    // =========================================================
    // REVISIÓN 5.0: Safety & Resilience Checks
    // =========================================================

    // P25: Detectar emergencias médicas/dentales
    const emergencyResult = SafetyResilienceService.detectEmergency(
      state.current_message,
      state.vertical
    );

    // P29: Detectar requerimientos de seguridad (alergias, etc.)
    const safetyResult = SafetyResilienceService.detectSafetyRequirements(
      state.current_message,
      state.vertical
    );

    // P27: Detectar eventos especiales (restaurante)
    const specialEventResult = SafetyResilienceService.detectSpecialEvent(
      state.current_message,
      state.vertical
    );

    // P23: Validar configuración del negocio
    const configCompleteness = SafetyResilienceService.validateBusinessConfiguration(
      state.business_context,
      state.vertical
    );

    // Log safety analysis for debugging
    if (emergencyResult.isEmergency || safetyResult.requiresSafetyDisclaimer || specialEventResult.isSpecialEvent) {
      console.log(`[Supervisor] Safety Analysis:`, {
        emergency: emergencyResult.isEmergency ? emergencyResult.emergencyType : 'none',
        safety: safetyResult.requiresSafetyDisclaimer ? safetyResult.category : 'none',
        specialEvent: specialEventResult.isSpecialEvent ? specialEventResult.eventType : 'none',
        configComplete: configCompleteness.isComplete,
      });

      // =========================================================
      // REVISIÓN 5.1 P2 FIX: Log incidents to database for compliance
      // =========================================================
      if (state.tenant?.tenant_id) {
        // P2: Log emergencies
        if (emergencyResult.isEmergency) {
          const incidentType: SafetyIncidentType = emergencyResult.emergencyType === 'dental_emergency'
            ? 'emergency_dental'
            : emergencyResult.emergencyType === 'medical_emergency'
              ? 'emergency_medical'
              : emergencyResult.emergencyType === 'accident'
                ? 'accident'
                : 'severe_pain';

          const actionTaken: SafetyActionTaken = emergencyResult.severity >= 4
            ? 'escalated_immediate'
            : emergencyResult.recommendedAction === 'urgent_care'
              ? 'urgent_care_routing'
              : 'human_notified';

          // Fire and forget - don't block main flow
          logSafetyIncident(
            state.tenant.tenant_id,
            state.conversation?.conversation_id,
            state.lead?.lead_id,
            incidentType,
            emergencyResult.severity as 1 | 2 | 3 | 4 | 5,
            state.current_message,
            state.channel,
            state.vertical,
            actionTaken,
            emergencyResult.keywords,
            emergencyResult.emergencyMessage
          ).catch(err => console.error('[Supervisor] Error logging emergency incident:', err));
        }

        // P2: Log safety requirements (allergies, etc.)
        if (safetyResult.requiresSafetyDisclaimer) {
          const safetyIncidentType: SafetyIncidentType =
            safetyResult.category === 'food_allergy' ? 'food_allergy' :
              safetyResult.category === 'dietary_restriction' ? 'dietary_restriction' :
                'medical_condition';

          const safetyAction: SafetyActionTaken = safetyResult.shouldEscalateToHuman
            ? 'escalated_immediate'
            : 'disclaimer_shown';

          logSafetyIncident(
            state.tenant.tenant_id,
            state.conversation?.conversation_id,
            state.lead?.lead_id,
            safetyIncidentType,
            safetyResult.shouldEscalateToHuman ? 4 : 3,
            state.current_message,
            state.channel,
            state.vertical,
            safetyAction,
            safetyResult.detectedItems,
            safetyResult.disclaimer
          ).catch(err => console.error('[Supervisor] Error logging safety incident:', err));
        }

        // P3: Log special events
        if (specialEventResult.isSpecialEvent && specialEventResult.shouldEscalate) {
          logSpecialEventRequest(
            state.tenant.tenant_id,
            state.conversation?.conversation_id,
            state.lead?.lead_id,
            state.business_context?.branches?.[0]?.id,
            specialEventResult.eventType,
            specialEventResult.groupSize,
            undefined, // requestedDate - to be extracted later
            specialEventResult.specialRequirements,
            undefined, // dietaryRestrictions
            specialEventResult.escalationReason,
            state.lead?.name,
            state.lead?.phone
          ).catch(err => console.error('[Supervisor] Error logging special event:', err));
        }
      }
    }

    // =========================================================
    // Determinar escalación considerando safety checks
    // =========================================================

    // 4. Verificar escalación inmediata (original)
    let escalationCheck = shouldEscalateImmediate(
      intent,
      signals,
      state.current_message,
      state.tenant?.ai_config.auto_escalate_keywords
    );

    // P25: Override escalación si hay emergencia crítica
    if (emergencyResult.isEmergency && emergencyResult.severity >= 4) {
      escalationCheck = {
        escalate: true,
        reason: `EMERGENCIA: ${emergencyResult.emergencyType} (severidad ${emergencyResult.severity}/5)`,
      };
      console.warn(`[Supervisor] EMERGENCY DETECTED: ${emergencyResult.emergencyType}`);
    }

    // P29: Escalar si alergia severa requiere humano
    if (safetyResult.shouldEscalateToHuman && !escalationCheck.escalate) {
      escalationCheck = {
        escalate: true,
        reason: `SEGURIDAD: ${safetyResult.category} - requiere atención humana`,
      };
      console.warn(`[Supervisor] SAFETY ESCALATION: ${safetyResult.category}`);
    }

    // P27: Escalar si evento especial requiere coordinación
    if (specialEventResult.shouldEscalate && !escalationCheck.escalate) {
      escalationCheck = {
        escalate: true,
        reason: specialEventResult.escalationReason || `Evento especial: ${specialEventResult.eventType}`,
      };
      console.log(`[Supervisor] SPECIAL EVENT ESCALATION: ${specialEventResult.eventType}`);
    }

    // 5. Determinar siguiente agente
    let nextAgent: string;
    if (escalationCheck.escalate) {
      // P25: Si es emergencia pero no crítica, ir a urgent_care primero
      if (emergencyResult.isEmergency && emergencyResult.recommendedAction === 'urgent_care') {
        nextAgent = 'urgent_care';
      } else {
        nextAgent = 'escalation';
      }
    } else {
      nextAgent = determineNextAgent(intent, state.vertical);
    }

    // 6. Calcular score total
    const totalScoreChange = signals.reduce((sum, s) => sum + s.points, 0);

    // 7. Preparar metadata de safety para el estado
    const safetyMetadata = {
      emergency_detected: emergencyResult.isEmergency,
      emergency_type: emergencyResult.emergencyType,
      emergency_severity: emergencyResult.severity,
      emergency_message: emergencyResult.emergencyMessage,
      safety_disclaimer: safetyResult.disclaimer,
      safety_category: safetyResult.category,
      special_event_type: specialEventResult.eventType,
      special_event_requirements: specialEventResult.specialRequirements,
      config_completeness_score: configCompleteness.completenessScore,
      config_missing_critical: configCompleteness.missingCritical,
    };

    // 8. Crear traza del agente
    const trace: AgentTrace = addAgentTrace(
      state,
      {
        agent_name: agentName,
        input_summary: `Message: "${state.current_message.substring(0, 50)}..."`,
        output_summary: `Intent: ${intent}, Next: ${nextAgent}${emergencyResult.isEmergency ? ' [EMERGENCY]' : ''}`,
        decision: `Routing to ${nextAgent} because ${intent}${emergencyResult.isEmergency ? ` (Emergency: ${emergencyResult.emergencyType})` : ''}`,
        duration_ms: Date.now() - startTime,
      }
    );

    console.log(`[Supervisor] Intent: ${intent}, Next agent: ${nextAgent}, Score change: ${totalScoreChange}`);

    // 9. Retornar actualizaciones al estado
    return {
      detected_intent: intent,
      detected_signals: signals,
      extracted_data: {
        ...state.extracted_data,
        ...extractedData,
        // P25: Agregar nivel de dolor de emergency detection si es más preciso
        pain_level: emergencyResult.severity > (extractedData.pain_level || 0)
          ? emergencyResult.severity
          : extractedData.pain_level,
      },
      current_agent: agentName,
      next_agent: nextAgent,
      routing_reason: `Intent ${intent} detected with ${signals.length} signals`,
      score_change: totalScoreChange,
      control: {
        ...state.control,
        should_escalate: escalationCheck.escalate,
        escalation_reason: escalationCheck.reason,
        iteration_count: state.control.iteration_count + 1,
      },
      agent_trace: [trace],
      // REVISIÓN 5.0: Agregar safety metadata al estado para uso en agentes
      safety_analysis: safetyMetadata,
    };
  } catch (error) {
    console.error('[Supervisor] Error:', error);

    // En caso de error, escalar a humano
    const trace: AgentTrace = addAgentTrace(
      state,
      {
        agent_name: agentName,
        input_summary: `Message: "${state.current_message.substring(0, 50)}..."`,
        output_summary: `ERROR: ${error instanceof Error ? error.message : 'Unknown'}`,
        decision: 'Escalating due to error',
        duration_ms: Date.now() - startTime,
      }
    );

    return {
      current_agent: agentName,
      next_agent: 'escalation',
      control: {
        ...state.control,
        should_escalate: true,
        escalation_reason: `Error en supervisor: ${error instanceof Error ? error.message : 'Unknown'}`,
      },
      agent_trace: [trace],
      errors: [error instanceof Error ? error.message : 'Unknown supervisor error'],
    };
  }
}

// ======================
// ROUTING FUNCTION
// ======================

/**
 * Función de routing condicional para LangGraph
 * Determina el siguiente nodo basado en el estado
 */
export function supervisorRouter(state: TISTISAgentStateType): string {
  // Si debe escalar, ir directo a escalación
  if (state.control.should_escalate) {
    return 'escalation';
  }

  // Si alcanzó límite de iteraciones, escalar
  if (state.control.iteration_count >= 5) {
    return 'escalation';
  }

  // Usar el next_agent determinado por el supervisor
  return state.next_agent || 'general';
}

// ======================
// EXPORTS
// ======================

export const SupervisorAgent = {
  node: supervisorNode,
  router: supervisorRouter,
  detectIntent: detectIntentRuleBased,
  detectSignals,
  extractData,
};

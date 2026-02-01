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

import {
  type TISTISAgentStateType,
  type AgentTrace,
  type BranchContext,
  type BranchResolutionSource,
  type BusinessContext,
  addAgentTrace,
  needsBranchDisambiguation,
  isMultiBranch,
  getCurrentBranchId,
  createBranchContextUpdate,
} from '../../state';
import type { AIIntent, AISignal } from '@/src/shared/types/whatsapp';
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
// BRANCH-AWARE MESSAGING (v4.9.0)
// ======================

/**
 * Resultado de la detección de sucursal en mensaje
 */
interface BranchDetectionLocalResult {
  detected: boolean;
  branchId?: string;
  branchName?: string;
  confidence: number;
  matchType?: 'exact' | 'partial' | 'city' | 'alias';
  multipleMatches: boolean;
  matchedBranches?: Array<{ id: string; name: string; confidence: number }>;
}

/**
 * Detecta menciones de sucursal en el mensaje usando reglas locales
 * Esta es una detección rápida rule-based antes de llamar al RPC
 */
function detectBranchMentionLocal(
  message: string,
  branches: BusinessContext['branches'] | undefined
): BranchDetectionLocalResult {
  if (!branches || !Array.isArray(branches) || branches.length === 0) {
    return { detected: false, confidence: 0, multipleMatches: false };
  }

  // Si solo hay una sucursal, siempre es esa
  if (branches.length === 1) {
    return {
      detected: true,
      branchId: branches[0].id,
      branchName: branches[0].name,
      confidence: 1.0,
      matchType: 'exact',
      multipleMatches: false,
    };
  }

  const messageLower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matches: Array<{ id: string; name: string; confidence: number; matchType: 'exact' | 'partial' | 'city' | 'alias' }> = [];

  for (const branch of branches) {
    const branchNameLower = branch.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const branchCityLower = (branch.city || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const branchAddressLower = (branch.address || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Búsqueda exacta por nombre
    if (messageLower.includes(branchNameLower)) {
      matches.push({ id: branch.id, name: branch.name, confidence: 1.0, matchType: 'exact' });
      continue;
    }

    // Búsqueda por ciudad
    if (branchCityLower && branchCityLower.length >= 4 && messageLower.includes(branchCityLower)) {
      matches.push({ id: branch.id, name: branch.name, confidence: 0.8, matchType: 'city' });
      continue;
    }

    // Búsqueda parcial por palabras del nombre
    const nameWords = branchNameLower.split(/\s+/).filter(w => w.length >= 4);
    for (const word of nameWords) {
      if (messageLower.includes(word)) {
        matches.push({ id: branch.id, name: branch.name, confidence: 0.6, matchType: 'partial' });
        break;
      }
    }

    // Búsqueda por palabras de la dirección (colonias, calles conocidas)
    if (branchAddressLower) {
      const addressWords = branchAddressLower.split(/\s+/).filter(w => w.length >= 5);
      for (const word of addressWords) {
        if (messageLower.includes(word)) {
          matches.push({ id: branch.id, name: branch.name, confidence: 0.5, matchType: 'partial' });
          break;
        }
      }
    }
  }

  // Ordenar por confianza y retornar
  matches.sort((a, b) => b.confidence - a.confidence);

  if (matches.length === 0) {
    return { detected: false, confidence: 0, multipleMatches: false };
  }

  // Si hay un match claro (confidence > 0.7 y es el único o significativamente mejor)
  const topMatch = matches[0];
  const hasMultipleMatches = matches.length > 1 && matches[1].confidence >= topMatch.confidence * 0.8;

  return {
    detected: true,
    branchId: topMatch.id,
    branchName: topMatch.name,
    confidence: topMatch.confidence,
    matchType: topMatch.matchType,
    multipleMatches: hasMultipleMatches,
    matchedBranches: hasMultipleMatches ? matches : undefined,
  };
}

/**
 * Determina si el intent requiere contexto de sucursal
 * Los booking intents siempre necesitan sucursal
 */
function intentRequiresBranchContext(intent: AIIntent): boolean {
  const branchRequiredIntents: AIIntent[] = [
    'BOOK_APPOINTMENT',
    'LOCATION',
    'HOURS',
  ];
  return branchRequiredIntents.includes(intent);
}

/**
 * Inicializa el contexto de sucursal para la sesión
 * Se llama al inicio del supervisor para preparar el estado
 */
function initializeBranchContext(
  state: TISTISAgentStateType,
  branchDetection: BranchDetectionLocalResult
): Partial<BranchContext> {
  const branches = state.business_context?.branches || [];

  // Si solo hay una sucursal, el contexto está resuelto
  if (branches.length <= 1) {
    if (branches.length === 1) {
      return {
        is_multi_branch: false,
        current_branch_id: branches[0].id,
        current_branch_name: branches[0].name,
        current_branch_address: branches[0].address,
        current_branch_city: branches[0].city,
        current_branch_phone: branches[0].phone,
        resolution_source: 'single_branch',
        resolution_confidence: 1.0,
        disambiguation_state: 'not_needed',
        user_confirmed: true,
      };
    }
    return {
      is_multi_branch: false,
      disambiguation_state: 'not_needed',
      user_confirmed: false,
      error: 'No hay sucursales configuradas',
    };
  }

  // Multi-sucursal: verificar si ya tenemos contexto
  const existingBranchId = getCurrentBranchId(state);
  if (existingBranchId) {
    const existingBranch = branches.find(b => b.id === existingBranchId);
    if (existingBranch) {
      return {
        is_multi_branch: true,
        current_branch_id: existingBranch.id,
        current_branch_name: existingBranch.name,
        current_branch_address: existingBranch.address,
        current_branch_city: existingBranch.city,
        current_branch_phone: existingBranch.phone,
        resolution_source: state.lead?.preferred_branch_id === existingBranchId
          ? 'lead_preference'
          : state.conversation?.branch_id === existingBranchId
            ? 'conversation'
            : 'default',
        resolution_confidence: 0.9,
        disambiguation_state: 'resolved',
        user_confirmed: false,
        lead_preferred_branch_id: state.lead?.preferred_branch_id,
        available_branches: branches.map(b => ({
          branch_id: b.id,
          branch_name: b.name,
          is_preferred: b.id === state.lead?.preferred_branch_id,
          is_headquarters: b.is_headquarters || false,
        })),
      };
    }
  }

  // Si detectamos una sucursal en el mensaje
  if (branchDetection.detected && !branchDetection.multipleMatches && branchDetection.confidence >= 0.7) {
    const detectedBranch = branches.find(b => b.id === branchDetection.branchId);
    if (detectedBranch) {
      return {
        is_multi_branch: true,
        current_branch_id: detectedBranch.id,
        current_branch_name: detectedBranch.name,
        current_branch_address: detectedBranch.address,
        current_branch_city: detectedBranch.city,
        current_branch_phone: detectedBranch.phone,
        resolution_source: 'ai_detected',
        resolution_confidence: branchDetection.confidence,
        disambiguation_state: branchDetection.confidence >= 0.9 ? 'resolved' : 'pending',
        user_confirmed: false,
        available_branches: branches.map(b => ({
          branch_id: b.id,
          branch_name: b.name,
          is_preferred: b.id === state.lead?.preferred_branch_id,
          is_headquarters: b.is_headquarters || false,
        })),
      };
    }
  }

  // No se pudo resolver: marcar como pendiente de desambiguación
  return {
    is_multi_branch: true,
    disambiguation_state: 'pending',
    user_confirmed: false,
    lead_preferred_branch_id: state.lead?.preferred_branch_id,
    available_branches: branches.map(b => ({
      branch_id: b.id,
      branch_name: b.name,
      is_preferred: b.id === state.lead?.preferred_branch_id,
      is_headquarters: b.is_headquarters || false,
    })),
  };
}

/**
 * Genera la pregunta de desambiguación de sucursal
 */
function generateBranchDisambiguationQuestion(
  branches: BusinessContext['branches'] | undefined,
  preferredBranchId?: string
): string {
  if (!branches || branches.length === 0) {
    return '¿A cuál sucursal te gustaría acudir?';
  }

  // Si hay una preferida, mencionarla
  const preferred = branches.find(b => b.id === preferredBranchId);
  if (preferred) {
    return `Veo que anteriormente has visitado ${preferred.name}. ¿Te gustaría agendar ahí o en otra sucursal?`;
  }

  // Si son 2 sucursales, nombrarlas
  if (branches.length === 2) {
    return `Tenemos dos sucursales: ${branches[0].name} y ${branches[1].name}. ¿Cuál prefieres?`;
  }

  // Si son pocas, listarlas
  if (branches.length <= 4) {
    const names = branches.map(b => b.name).join(', ');
    return `Tenemos las siguientes sucursales: ${names}. ¿A cuál te gustaría acudir?`;
  }

  // Muchas sucursales: pregunta abierta
  return `Tenemos ${branches.length} sucursales. ¿En qué zona o ciudad te gustaría agendar?`;
}

// ======================
// TYPES FOR LEARNING CONTEXT
// ======================

/**
 * SPRINT 3: Contexto de aprendizaje para mejorar detección de intenciones
 */
interface LearningContext {
  topServiceRequests?: Array<{ service: string; frequency: number }>;
  commonObjections?: Array<{ objection: string; frequency: number }>;
  schedulingPreferences?: Array<{ preference: string; frequency: number }>;
  painPoints?: Array<{ pain: string; frequency: number }>;
  learnedVocabulary?: Array<{ term: string; meaning: string; category: string }>;
}

// ======================
// INTENT DETECTION (Rule-based + Learning patterns)
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
 * SPRINT 3: Detecta la intención usando patrones aprendidos
 *
 * Esta función se ejecuta DESPUÉS de detectIntentRuleBased
 * para mejorar la detección usando patrones del negocio específico.
 *
 * @param message - Mensaje del usuario
 * @param learningContext - Contexto de aprendizaje del negocio
 * @returns Intent mejorado o null si no hay mejora
 */
function detectIntentWithLearning(
  message: string,
  learningContext: LearningContext | null | undefined
): { intent: AIIntent | null; reason: string | null } {
  if (!learningContext) {
    return { intent: null, reason: null };
  }

  const messageLower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Helper para normalizar texto (quitar acentos)
  const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. Detectar servicios mencionados usando vocabulario aprendido
  // Si el mensaje menciona un servicio específico del negocio, probablemente es PRICE_INQUIRY o BOOK_APPOINTMENT
  if (learningContext.topServiceRequests && learningContext.topServiceRequests.length > 0) {
    for (const { service } of learningContext.topServiceRequests.slice(0, 10)) {
      // Normalizar términos del servicio para comparación sin acentos
      const serviceTerms = normalize(service).split(/\s+/);
      const serviceFound = serviceTerms.some(term =>
        term.length >= 4 && messageLower.includes(term)
      );

      if (serviceFound) {
        // Si menciona el servicio con palabras de precio, es PRICE_INQUIRY
        // NOTA: messageLower ya está normalizado (sin acentos), así que usamos versiones sin acento
        if (/\b(precio|costo|cuanto|vale|valor)\b/.test(messageLower)) {
          return {
            intent: 'PRICE_INQUIRY',
            reason: `Learned service "${service}" mentioned with price inquiry`
          };
        }
        // Si menciona el servicio con palabras de reserva, es BOOK_APPOINTMENT
        if (/\b(cita|agendar|reservar|turno|cuando)\b/.test(messageLower)) {
          return {
            intent: 'BOOK_APPOINTMENT',
            reason: `Learned service "${service}" mentioned with booking intent`
          };
        }
      }
    }
  }

  // 2. Detectar objeciones comunes para manejar retention
  if (learningContext.commonObjections && learningContext.commonObjections.length > 0) {
    for (const { objection } of learningContext.commonObjections.slice(0, 5)) {
      // Normalizar términos de objeción para comparación sin acentos
      const objectionTerms = normalize(objection).split(/\s+/);
      const objectionFound = objectionTerms.filter(t => t.length >= 4)
        .some(term => messageLower.includes(term));

      if (objectionFound) {
        // Objeciones comunes detectadas - esto puede informar al pricing agent
        return {
          intent: 'PRICE_INQUIRY',
          reason: `Learned objection pattern: "${objection}"`
        };
      }
    }
  }

  // 3. Detectar dolor/síntomas usando painPoints aprendidos (para dentales/médicos)
  if (learningContext.painPoints && learningContext.painPoints.length > 0) {
    for (const { pain } of learningContext.painPoints.slice(0, 5)) {
      // Normalizar términos de dolor para comparación sin acentos
      const painTerms = normalize(pain).split(/\s+/);
      const painFound = painTerms.filter(t => t.length >= 4)
        .some(term => messageLower.includes(term));

      if (painFound) {
        return {
          intent: 'PAIN_URGENT',
          reason: `Learned pain pattern: "${pain}"`
        };
      }
    }
  }

  // 4. Usar vocabulario aprendido para mejorar detección
  if (learningContext.learnedVocabulary && learningContext.learnedVocabulary.length > 0) {
    for (const { term, category } of learningContext.learnedVocabulary.slice(0, 20)) {
      // Normalizar término para comparación sin acentos
      if (messageLower.includes(normalize(term))) {
        // Mapear categoría de vocabulario a intent
        switch (category) {
          case 'symptom':
          case 'urgency':
            return { intent: 'PAIN_URGENT', reason: `Learned vocabulary: "${term}" (${category})` };
          case 'procedure':
          case 'service':
            return { intent: 'FAQ', reason: `Learned vocabulary: "${term}" (${category})` };
          case 'time':
          case 'scheduling_preference':
            return { intent: 'BOOK_APPOINTMENT', reason: `Learned vocabulary: "${term}" (${category})` };
          case 'payment':
            return { intent: 'PRICE_INQUIRY', reason: `Learned vocabulary: "${term}" (${category})` };
        }
      }
    }
  }

  return { intent: null, reason: null };
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
    // =========================================================
    // v4.9.0: BRANCH-AWARE MESSAGING - Step 0
    // Detectar menciones de sucursal y preparar contexto
    // =========================================================
    const branches = state.business_context?.branches || [];
    const branchDetection = detectBranchMentionLocal(state.current_message, branches);
    const branchContextUpdate = initializeBranchContext(state, branchDetection);

    if (branchDetection.detected) {
      console.log(`[Supervisor] Branch detected: ${branchDetection.branchName} (confidence: ${branchDetection.confidence})`);
    }

    // 1. Detectar intención (rule-based, ultra rápido)
    let intent = detectIntentRuleBased(state.current_message);
    let learningEnhancedReason: string | null = null;

    // SPRINT 3: Si la intención base es UNKNOWN o FAQ, intentar mejorar con learning patterns
    const learningContext = state.business_context?.learning_context;
    if ((intent === 'UNKNOWN' || intent === 'FAQ') && learningContext) {
      const learningResult = detectIntentWithLearning(state.current_message, learningContext);
      if (learningResult.intent) {
        console.log(`[Supervisor] SPRINT 3: Intent enhanced by learning: ${intent} -> ${learningResult.intent}`);
        intent = learningResult.intent;
        learningEnhancedReason = learningResult.reason;
      }
    }

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
    let branchDisambiguationNeeded = false;
    let branchDisambiguationQuestion: string | undefined;

    if (escalationCheck.escalate) {
      // P25: Si es emergencia pero no crítica, ir a urgent_care primero
      if (emergencyResult.isEmergency && emergencyResult.recommendedAction === 'urgent_care') {
        nextAgent = 'urgent_care';
      } else {
        nextAgent = 'escalation';
      }
    } else {
      nextAgent = determineNextAgent(intent, state.vertical);

      // =========================================================
      // v4.9.0: BRANCH-AWARE MESSAGING - Verificar si se necesita
      // desambiguación antes de routing a booking agents
      // =========================================================
      const requiresBranch = intentRequiresBranchContext(intent);
      const isMultiBranchTenant = branches.length > 1;
      const hasBranchContext = branchContextUpdate.current_branch_id &&
        branchContextUpdate.disambiguation_state === 'resolved';

      // Si el intent requiere sucursal, es multi-branch, y no tenemos contexto resuelto
      if (requiresBranch && isMultiBranchTenant && !hasBranchContext) {
        // Verificar si ya preguntamos (evitar loop)
        const alreadyAsked = state.branch_context?.disambiguation_state === 'asked';

        if (!alreadyAsked) {
          // Necesitamos preguntar al usuario
          branchDisambiguationNeeded = true;
          branchDisambiguationQuestion = generateBranchDisambiguationQuestion(
            branches,
            state.lead?.preferred_branch_id
          );

          console.log(`[Supervisor] Branch disambiguation needed for intent: ${intent}`);

          // Redirigir a branch_disambiguation agent (o manejar en general)
          // Por ahora, el greeting/general agent manejará la pregunta
          if (intent === 'GREETING' || intent === 'UNKNOWN') {
            nextAgent = 'greeting';
          } else {
            // Para booking, necesitamos primero preguntar la sucursal
            // El agente greeting puede manejar esto y luego redirigir
            nextAgent = 'branch_selector';
          }
        }
      }
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
    // SPRINT 3: Incluir información sobre si la intención fue mejorada por learning
    const learningTag = learningEnhancedReason ? ' [LEARNING]' : '';
    const branchTag = branchDisambiguationNeeded ? ' [BRANCH_DISAMBIGUATION]' : (branchDetection.detected ? ' [BRANCH_DETECTED]' : '');
    const trace: AgentTrace = addAgentTrace(
      state,
      {
        agent_name: agentName,
        input_summary: `Message: "${state.current_message.substring(0, 50)}..."`,
        output_summary: `Intent: ${intent}, Next: ${nextAgent}${emergencyResult.isEmergency ? ' [EMERGENCY]' : ''}${learningTag}${branchTag}`,
        decision: `Routing to ${nextAgent} because ${intent}${emergencyResult.isEmergency ? ` (Emergency: ${emergencyResult.emergencyType})` : ''}${learningEnhancedReason ? ` (Learning: ${learningEnhancedReason})` : ''}${branchDisambiguationNeeded ? ' (Branch disambiguation needed)' : ''}`,
        duration_ms: Date.now() - startTime,
      }
    );

    console.log(`[Supervisor] Intent: ${intent}, Next agent: ${nextAgent}, Score change: ${totalScoreChange}${learningEnhancedReason ? `, Learning: ${learningEnhancedReason}` : ''}${branchDisambiguationNeeded ? ', Branch disambiguation needed' : ''}`);

    // 9. Preparar branch context update
    // Si se necesita desambiguación, marcar como 'asked' para evitar loop
    const finalBranchContext: Partial<BranchContext> = branchDisambiguationNeeded
      ? {
          ...branchContextUpdate,
          disambiguation_state: 'asked',
        }
      : branchContextUpdate;

    // 10. Retornar actualizaciones al estado
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
        // v4.9.0: Agregar datos de sucursal detectada
        preferred_branch_id: branchDetection.detected ? branchDetection.branchId : state.extracted_data?.preferred_branch_id,
        preferred_branch_name: branchDetection.detected ? branchDetection.branchName : state.extracted_data?.preferred_branch_name,
        branch_detection_confidence: branchDetection.detected ? branchDetection.confidence : undefined,
      },
      current_agent: agentName,
      next_agent: nextAgent,
      routing_reason: branchDisambiguationNeeded
        ? `Intent ${intent} requires branch context - asking user to select branch`
        : `Intent ${intent} detected with ${signals.length} signals`,
      score_change: totalScoreChange,
      control: {
        ...state.control,
        should_escalate: escalationCheck.escalate,
        escalation_reason: escalationCheck.reason,
        iteration_count: state.control.iteration_count + 1,
        // v4.9.0: Agregar clarification si se necesita desambiguación
        needs_clarification: branchDisambiguationNeeded,
        clarification_question: branchDisambiguationQuestion,
      },
      agent_trace: [trace],
      // REVISIÓN 5.0: Agregar safety metadata al estado para uso en agentes
      safety_analysis: safetyMetadata,
      // v4.9.0: Agregar branch context al estado
      branch_context: {
        ...state.branch_context,
        ...finalBranchContext,
        last_updated_at: new Date().toISOString(),
      },
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

  // Si alcanzó límite de iteraciones, escalar (usar configuración del tenant)
  const maxIterations = state.tenant?.ai_config?.max_turns_before_escalation ?? 5;
  if (state.control.iteration_count >= maxIterations) {
    return 'escalation';
  }

  // v4.9.0: Si necesita clarificación de sucursal, redirigir apropiadamente
  if (state.control.needs_clarification && state.branch_context?.disambiguation_state === 'asked') {
    // Si el next_agent es branch_selector pero no existe, usar general
    if (state.next_agent === 'branch_selector') {
      // El agente general manejará la pregunta de sucursal
      return 'general';
    }
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
  // v4.9.0: Branch-Aware Messaging exports
  detectBranchMention: detectBranchMentionLocal,
  intentRequiresBranch: intentRequiresBranchContext,
  initializeBranchContext,
  generateBranchQuestion: generateBranchDisambiguationQuestion,
};

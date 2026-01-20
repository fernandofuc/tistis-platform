/**
 * TIS TIS Platform - Voice Agent v2.0
 * Router Node
 *
 * Classifies user intent and routes to the appropriate processing path.
 * Uses a combination of:
 * 1. Keyword matching for fast classification
 * 2. LLM for ambiguous cases
 *
 * Intents:
 * - tool: User wants to perform an action (book, cancel, order)
 * - rag: User is asking about business info (menu, hours, services)
 * - direct: Simple response (greeting, farewell)
 * - transfer: User wants to speak with a human
 * - confirm: User is confirming/denying a previous action
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { VoiceAgentState, VoiceIntent } from '../state';
import { recordLatency, addError } from '../state';

// =====================================================
// TYPES
// =====================================================

/**
 * Classification result
 */
interface ClassificationResult {
  intent: VoiceIntent;
  confidence: number;
  subIntent?: string;
  entities: Record<string, unknown>;
}

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Whether to use LLM for classification */
  useLLM?: boolean;

  /** LLM model to use */
  model?: string;

  /** Confidence threshold for keyword matching */
  keywordConfidenceThreshold?: number;

  /** Temperature for LLM */
  temperature?: number;
}

// =====================================================
// KEYWORD PATTERNS
// =====================================================

/**
 * Keyword patterns for fast intent classification
 */
const INTENT_PATTERNS: Record<VoiceIntent, RegExp[]> = {
  tool: [
    // Reservations
    /\b(reserv(ar?|ación)|book(ing)?|agendar?|programar?|cita)\b/i,
    /\b(cancelar?|cancel(ar)?|anular?)\b/i,
    /\b(modificar?|cambiar?|mover?|reprogramar?)\b/i,
    /\b(orden(ar)?|pedir?|order)\b/i,
    // Actions
    /\b(hacer|quiero|necesito|me gustaría)\s+(una?\s+)?(reserv|cita|orden|pedir)/i,
    /\b(para)\s+\d+\s+(personas?)/i,
  ],
  rag: [
    // Information queries
    /\b(qué|cuál|cuáles|cómo|dónde|cuándo|cuánto|tienen)\b/i,
    /\b(menú|carta|platillos?|servicios?|precios?|costos?)\b/i,
    /\b(horario|hora|abierto|cerrado|abren|cierran)\b/i,
    /\b(ubicación|dirección|llegar|estacionamiento)\b/i,
    /\b(información|info|sobre|acerca)\b/i,
    /\b(doctore?s?|especialistas?|tratamientos?)\b/i,
    /\b(seguro|cobertura|aceptan)\b/i,
  ],
  direct: [
    // Greetings
    /\b(hola|buenos?\s+(días?|tardes?|noches?)|qué\s+tal|hi|hello)\b/i,
    // Farewells
    /\b(adiós|hasta\s+luego|gracias|bye|chao|nos\s+vemos)\b/i,
    // Acknowledgments
    /\b(ok(ay)?|entiendo|de\s+acuerdo|perfecto|listo|claro)\b/i,
  ],
  transfer: [
    /\b(hablar|comunicar)\s+(con)?\s*(una?\s+)?(persona|humano|agente|gerente|encargado)/i,
    /\b(transfiere|pásame|comunícame)\b/i,
    /\b(necesito|quiero)\s+(hablar|ayuda)\s+(de)?\s+(un)?\s*(humano|persona|agente)/i,
    /\b(no\s+me\s+entiendes?|no\s+sirves?|inútil)\b/i,
  ],
  confirm: [
    /^(sí|si|yes|claro|correcto|exacto|afirmativo|dale|va|está\s+bien|ok)$/i,
    /^(no|nel|negativo|cancel(ar)?|mejor\s+no)$/i,
    /\b(confirm(o|ar|ado)?)\b/i,
  ],
  unknown: [],
};

/**
 * Sub-intent patterns
 */
const SUB_INTENT_PATTERNS: Record<string, RegExp[]> = {
  // Reservation sub-intents
  'reservation.create': [/\b(reserv(ar?)|hacer\s+una?\s+reserv|agendar?)\b/i],
  'reservation.cancel': [/\b(cancelar?|anular?)\s*(la|mi)?\s*(reserv|cita)/i],
  'reservation.modify': [/\b(cambiar?|modificar?|mover?)\s*(la|mi)?\s*(reserv|cita)/i],
  'reservation.check': [/\b(ver|consultar?|checar?)\s*(mi|la)?\s*(reserv|cita)/i],

  // Appointment sub-intents
  'appointment.create': [/\b(cita|consulta|agendar?)\b/i],
  'appointment.cancel': [/\b(cancelar?)\s*(la|mi)?\s*(cita|consulta)/i],

  // Order sub-intents
  'order.create': [/\b(pedir?|orden(ar)?|quiero)\b/i],
  'order.status': [/\b(estado|dónde\s+(está|viene)|rastrear?)\s*(mi)?\s*(orden|pedido)/i],

  // Info sub-intents
  'info.hours': [/\b(horario|hora|abierto|cerrado|abren|cierran)\b/i],
  'info.menu': [/\b(menú|carta|platillos?|comida)\b/i],
  'info.services': [/\b(servicios?|tratamientos?|qué\s+hacen)\b/i],
  'info.location': [/\b(ubicación|dirección|dónde\s+(están|queda))\b/i],
  'info.pricing': [/\b(precio|costo|cuánto\s+cuesta|tarifa)\b/i],
};

/**
 * Entity extraction patterns
 */
const ENTITY_PATTERNS = {
  date: /\b(hoy|mañana|pasado\s+mañana|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/gi,
  time: /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|hrs?)?|(?:a\s+las?|por\s+la)\s+\d{1,2})\b/gi,
  quantity: /\b(\d+)\s*(personas?|invitados?|comensales?|people)\b/gi,
  phone: /\b(\d{10}|\d{3}[\s\-]?\d{3}[\s\-]?\d{4})\b/g,
  name: /\b(me\s+llamo|soy|nombre\s+es)\s+([A-Za-záéíóúñÁÉÍÓÚÑ]+(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)?)\b/i,
};

// =====================================================
// ROUTER NODE
// =====================================================

/**
 * Router node - classifies intent and routes conversation
 */
export async function routerNode(
  state: VoiceAgentState,
  config?: RouterConfig
): Promise<Partial<VoiceAgentState>> {
  const startTime = Date.now();
  const nodeConfig = {
    useLLM: config?.useLLM ?? false,
    keywordConfidenceThreshold: config?.keywordConfidenceThreshold ?? 0.7,
    model: config?.model ?? 'gpt-4o-mini',
    temperature: config?.temperature ?? 0,
  };

  try {
    // Guard against undefined/null input
    const input = (state.currentInput || '').trim();

    if (!input) {
      return {
        ...recordLatency(state, 'router', startTime),
        currentNode: 'router',
        normalizedInput: '',
        intent: 'direct',
        confidence: 0.5,
        entities: {},
      };
    }

    // Normalize input
    const normalizedInput = normalizeInput(input);

    // Check if this is a confirmation response
    if (state.confirmationStatus === 'pending') {
      const confirmResult = classifyConfirmation(normalizedInput);
      if (confirmResult.intent === 'confirm') {
        return {
          ...recordLatency(state, 'router', startTime),
          currentNode: 'router',
          normalizedInput,
          intent: 'confirm',
          confidence: confirmResult.confidence,
          subIntent: confirmResult.subIntent,
          entities: confirmResult.entities,
        };
      }
    }

    // Try keyword-based classification first (fast)
    const keywordResult = classifyByKeywords(normalizedInput);

    // If high confidence, use keyword result
    if (keywordResult.confidence >= nodeConfig.keywordConfidenceThreshold) {
      console.log(
        `[Router] Keyword classification: ${keywordResult.intent} (${keywordResult.confidence.toFixed(2)})`,
        { subIntent: keywordResult.subIntent }
      );

      return {
        ...recordLatency(state, 'router', startTime),
        currentNode: 'router',
        normalizedInput,
        intent: keywordResult.intent,
        confidence: keywordResult.confidence,
        subIntent: keywordResult.subIntent,
        entities: keywordResult.entities,
      };
    }

    // If LLM enabled and low confidence, use LLM
    if (nodeConfig.useLLM && keywordResult.confidence < nodeConfig.keywordConfidenceThreshold) {
      const llmResult = await classifyByLLM(
        normalizedInput,
        state.assistantType,
        nodeConfig.model,
        nodeConfig.temperature
      );

      console.log(
        `[Router] LLM classification: ${llmResult.intent} (${llmResult.confidence.toFixed(2)})`,
        { subIntent: llmResult.subIntent }
      );

      return {
        ...recordLatency(state, 'router', startTime),
        currentNode: 'router',
        normalizedInput,
        intent: llmResult.intent,
        confidence: llmResult.confidence,
        subIntent: llmResult.subIntent,
        entities: { ...keywordResult.entities, ...llmResult.entities },
      };
    }

    // Return keyword result even if low confidence
    console.log(
      `[Router] Using keyword result with low confidence: ${keywordResult.intent} (${keywordResult.confidence.toFixed(2)})`
    );

    return {
      ...recordLatency(state, 'router', startTime),
      currentNode: 'router',
      normalizedInput,
      intent: keywordResult.intent !== 'unknown' ? keywordResult.intent : 'direct',
      confidence: keywordResult.confidence,
      subIntent: keywordResult.subIntent,
      entities: keywordResult.entities,
    };
  } catch (error) {
    console.error('[Router] Error:', error);

    return {
      ...addError(state, 'router', error instanceof Error ? error.message : 'Unknown error', true),
      ...recordLatency(state, 'router', startTime),
      currentNode: 'router',
      intent: 'direct',
      confidence: 0.5,
      entities: {},
    };
  }
}

// =====================================================
// CLASSIFICATION FUNCTIONS
// =====================================================

/**
 * Normalize input for classification
 */
function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents for matching
    .replace(/[^\w\s]/g, ' ')        // Remove punctuation
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();
}

/**
 * Classify intent using keyword patterns
 */
function classifyByKeywords(input: string): ClassificationResult {
  const scores: Record<VoiceIntent, number> = {
    tool: 0,
    rag: 0,
    direct: 0,
    transfer: 0,
    confirm: 0,
    unknown: 0,
  };

  // Score each intent
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        scores[intent as VoiceIntent] += 1;
      }
    }
  }

  // Find best intent
  let bestIntent: VoiceIntent = 'unknown';
  let bestScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as VoiceIntent;
    }
  }

  // Calculate confidence
  const totalPatterns = Object.values(INTENT_PATTERNS).reduce((sum, p) => sum + p.length, 0);
  const matchedPatterns = Object.values(scores).reduce((sum, s) => sum + s, 0);
  const confidence = matchedPatterns > 0
    ? Math.min(0.95, bestScore / Math.max(1, matchedPatterns) + (bestScore * 0.1))
    : 0.3;

  // Get sub-intent
  const subIntent = getSubIntent(input, bestIntent);

  // Extract entities
  const entities = extractEntities(input);

  return {
    intent: bestIntent === 'unknown' && matchedPatterns === 0 ? 'direct' : bestIntent,
    confidence,
    subIntent,
    entities,
  };
}

/**
 * Classify confirmation response
 */
function classifyConfirmation(input: string): ClassificationResult {
  const positivePatterns = [
    /^(s[ií]|yes|claro|correcto|exacto|afirmativo|dale|va|est[áa]\s+bien|ok|okay|confirmo|de\s+acuerdo)$/i,
    /\b(s[ií],?\s+(por\s+favor)?|confirm(o|ar)|acepto)\b/i,
  ];

  const negativePatterns = [
    /^(no|nel|negativo|cancel(ar)?|mejor\s+no|ni|nop|nope)$/i,
    /\b(no\s+(quiero|deseo|gracias)|cancel(ar|o)?|anular?)\b/i,
  ];

  for (const pattern of positivePatterns) {
    if (pattern.test(input)) {
      return {
        intent: 'confirm',
        confidence: 0.95,
        subIntent: 'confirmed',
        entities: {},
      };
    }
  }

  for (const pattern of negativePatterns) {
    if (pattern.test(input)) {
      return {
        intent: 'confirm',
        confidence: 0.95,
        subIntent: 'denied',
        entities: {},
      };
    }
  }

  return {
    intent: 'unknown',
    confidence: 0,
    entities: {},
  };
}

/**
 * Get sub-intent from input
 */
function getSubIntent(input: string, mainIntent: VoiceIntent): string | undefined {
  if (mainIntent === 'unknown') return undefined;

  for (const [subIntent, patterns] of Object.entries(SUB_INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return subIntent;
      }
    }
  }

  return undefined;
}

/**
 * Extract entities from input
 */
function extractEntities(input: string): Record<string, unknown> {
  const entities: Record<string, unknown> = {};

  // Extract date
  const dateMatches = input.match(ENTITY_PATTERNS.date);
  if (dateMatches) {
    entities.date = dateMatches[0];
  }

  // Extract time
  const timeMatches = input.match(ENTITY_PATTERNS.time);
  if (timeMatches) {
    entities.time = timeMatches[0];
  }

  // Extract quantity (number of people)
  const quantityMatch = input.match(ENTITY_PATTERNS.quantity);
  if (quantityMatch) {
    entities.quantity = parseInt(quantityMatch[1], 10);
  }

  // Extract phone
  const phoneMatches = input.match(ENTITY_PATTERNS.phone);
  if (phoneMatches) {
    entities.phone = phoneMatches[0].replace(/[\s\-]/g, '');
  }

  // Extract name
  const nameMatch = input.match(ENTITY_PATTERNS.name);
  if (nameMatch) {
    entities.name = nameMatch[2];
  }

  return entities;
}

/**
 * Classify using LLM for ambiguous cases
 */
async function classifyByLLM(
  input: string,
  assistantType: string,
  model: string,
  temperature: number
): Promise<ClassificationResult> {
  const llm = new ChatOpenAI({
    modelName: model,
    temperature,
    maxTokens: 150,
  });

  const systemPrompt = `You are an intent classifier for a voice assistant.
Assistant type: ${assistantType}

Classify the user input into ONE of these intents:
- tool: User wants to perform an action (book reservation, cancel appointment, place order)
- rag: User is asking about business information (menu, hours, services, prices)
- direct: Simple response needed (greeting, farewell, acknowledgment, small talk)
- transfer: User explicitly wants to speak with a human

Respond ONLY with JSON:
{"intent": "tool|rag|direct|transfer", "confidence": 0.0-1.0, "subIntent": "optional sub-category"}`;

  try {
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(input),
    ]);

    const content = response.content as string;
    const parsed = JSON.parse(content);

    return {
      intent: parsed.intent as VoiceIntent,
      confidence: parsed.confidence || 0.8,
      subIntent: parsed.subIntent,
      entities: {},
    };
  } catch {
    return {
      intent: 'direct',
      confidence: 0.5,
      entities: {},
    };
  }
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create router node with configuration
 */
export function createRouterNode(config?: RouterConfig) {
  return (state: VoiceAgentState) => routerNode(state, config);
}

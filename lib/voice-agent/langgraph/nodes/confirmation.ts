/**
 * TIS TIS Platform - Voice Agent v2.0
 * Confirmation Node
 *
 * Handles user confirmation for actions that require explicit consent.
 * This is a critical node for:
 * - Reservations (create, modify, cancel)
 * - Appointments (create, modify, cancel)
 * - Transfers to human agents
 * - Any destructive or significant actions
 *
 * Flow:
 * 1. Check if confirmation is pending
 * 2. Parse user response (positive/negative)
 * 3. Update state accordingly
 * 4. Route to appropriate next node
 */

import type { VoiceAgentState, ConfirmationStatus } from '../state';
import { recordLatency, addError } from '../state';

// =====================================================
// TYPES
// =====================================================

/**
 * Confirmation node configuration
 */
export interface ConfirmationConfig {
  /** Default locale for messages */
  locale?: string;

  /** Whether to be strict about confirmation parsing */
  strictParsing?: boolean;

  /** Custom positive patterns */
  positivePatterns?: RegExp[];

  /** Custom negative patterns */
  negativePatterns?: RegExp[];

  /** Maximum attempts before auto-decline */
  maxAttempts?: number;
}

/**
 * Confirmation result
 */
export interface ConfirmationResult {
  /** Whether confirmation was understood */
  understood: boolean;

  /** The confirmation status */
  status: ConfirmationStatus;

  /** Confidence in the interpretation */
  confidence: number;

  /** Message to relay back */
  message?: string;
}

// =====================================================
// CONFIRMATION PATTERNS
// =====================================================

/**
 * Positive confirmation patterns (Spanish and English)
 */
const POSITIVE_PATTERNS: RegExp[] = [
  // Spanish affirmative
  /^(s[ií]|sip|aja|ajá|claro|correcto|exacto|exactamente)$/i,
  /^(afirmativo|dale|va|está\s+bien|ok(ay)?|okey|vale)$/i,
  /^(por\s+supuesto|desde\s+luego|c[oó]mo\s+no|adelante)$/i,
  /^(confirmo|confirm[ao]do|acepto|de\s+acuerdo)$/i,
  /^(así\s+es|eso\s+es|es\s+correcto)$/i,
  /\b(s[ií],?\s*(por\s+favor)?|confirm[ao]|acepto)\b/i,
  /\b(está\s+bien|de\s+acuerdo|perfecto|excelente)\b/i,
  // English affirmative
  /^(yes|yeah|yep|yup|sure|okay|ok|alright|right)$/i,
  /^(absolutely|definitely|certainly|of\s+course)$/i,
  /^(confirm|confirmed|i\s+confirm|go\s+ahead|proceed)$/i,
  /\b(yes,?\s*(please)?|confirm|agree)\b/i,
];

/**
 * Negative confirmation patterns (Spanish and English)
 */
const NEGATIVE_PATTERNS: RegExp[] = [
  // Spanish negative
  /^(no|nel|nop|nope|negativo|para\s+nada)$/i,
  /^(nunca|jamás|ni\s+de\s+chiste|ni\s+loco)$/i,
  /^(mejor\s+no|no\s+gracias|no\s+quiero)$/i,
  /^(cancelar?|cancel[ao]|anular?)$/i,
  /\b(no,?\s*(gracias)?|no\s+quiero|no\s+deseo)\b/i,
  /\b(cancel(ar|o)?|anular?|dejar(lo)?)\b/i,
  // English negative
  /^(no|nope|nah|negative|not\s+really)$/i,
  /^(never|no\s+way|forget\s+it)$/i,
  /^(cancel|don't|do\s+not|stop)$/i,
  /\b(no,?\s*(thanks)?|don't\s+want|cancel)\b/i,
];

/**
 * Unclear/ambiguous patterns
 */
const UNCLEAR_PATTERNS: RegExp[] = [
  // Questions or uncertainty
  /\?$/,
  /^(qué|que|what|huh|cómo|como|how)\b/i,
  /^(no\s+sé|no\s+estoy\s+seguro|i\s+don't\s+know|not\s+sure)$/i,
  /^(tal\s+vez|quizás|maybe|perhaps)$/i,
  /^(déjame\s+pensar|let\s+me\s+think|espera|wait)$/i,
  /\b(depende|depends|it\s+depends)\b/i,
];

// =====================================================
// CONFIRMATION NODE
// =====================================================

/**
 * Confirmation node - handles user confirmations
 */
export async function confirmationNode(
  state: VoiceAgentState,
  config?: ConfirmationConfig
): Promise<Partial<VoiceAgentState>> {
  const startTime = Date.now();
  const nodeConfig = {
    locale: config?.locale ?? state.locale ?? 'es',
    strictParsing: config?.strictParsing ?? false,
    maxAttempts: config?.maxAttempts ?? 3,
  };

  try {
    // Check if there's a pending confirmation
    if (state.confirmationStatus !== 'pending') {
      console.log('[Confirmation] No pending confirmation');
      return {
        ...recordLatency(state, 'confirmation', startTime),
        currentNode: 'confirmation',
      };
    }

    const input = state.normalizedInput || state.currentInput;
    console.log(`[Confirmation] Processing input: "${input}"`);

    // Parse the confirmation response
    const result = parseConfirmationResponse(
      input,
      nodeConfig.locale,
      config?.positivePatterns,
      config?.negativePatterns
    );

    console.log(
      `[Confirmation] Result: ${result.status} (confidence: ${result.confidence.toFixed(2)})`
    );

    // Handle based on result
    if (result.status === 'confirmed') {
      return {
        ...recordLatency(state, 'confirmation', startTime),
        currentNode: 'confirmation',
        confirmationStatus: 'confirmed',
        response: undefined, // Will be set by tool executor after execution
      };
    }

    if (result.status === 'denied') {
      // Clear pending tool when denied
      const denialMessage = getDenialMessage(state.pendingTool?.name, nodeConfig.locale);

      return {
        ...recordLatency(state, 'confirmation', startTime),
        currentNode: 'confirmation',
        confirmationStatus: 'denied',
        pendingTool: undefined,
        response: denialMessage,
      };
    }

    // Unclear response - ask for clarification
    const clarificationMessage = getClarificationMessage(
      state.pendingTool?.confirmationMessage,
      nodeConfig.locale
    );

    return {
      ...recordLatency(state, 'confirmation', startTime),
      currentNode: 'confirmation',
      confirmationStatus: 'pending', // Keep pending
      response: clarificationMessage,
    };
  } catch (error) {
    console.error('[Confirmation] Error:', error);

    return {
      ...addError(state, 'confirmation', error instanceof Error ? error.message : 'Unknown error', true),
      ...recordLatency(state, 'confirmation', startTime),
      currentNode: 'confirmation',
      confirmationStatus: 'denied', // Default to denied on error for safety
      pendingTool: undefined,
      response: nodeConfig.locale === 'en'
        ? 'I couldn\'t understand your response. The action has been cancelled.'
        : 'No pude entender su respuesta. La acción ha sido cancelada.',
    };
  }
}

// =====================================================
// PARSING FUNCTIONS
// =====================================================

/**
 * Parse user response to determine confirmation status
 */
export function parseConfirmationResponse(
  input: string,
  locale: string,
  customPositive?: RegExp[],
  customNegative?: RegExp[]
): ConfirmationResult {
  // Normalize input
  const normalized = normalizeInput(input);

  // Check if input is too short or empty
  if (normalized.length < 1) {
    return {
      understood: false,
      status: 'pending',
      confidence: 0,
      message: locale === 'en'
        ? 'I didn\'t catch that. Could you please confirm?'
        : 'No escuché bien. ¿Puede confirmar por favor?',
    };
  }

  // Check positive patterns first
  const positivePatterns = customPositive || POSITIVE_PATTERNS;
  for (const pattern of positivePatterns) {
    if (pattern.test(normalized)) {
      return {
        understood: true,
        status: 'confirmed',
        confidence: 0.95,
      };
    }
  }

  // Check negative patterns
  const negativePatterns = customNegative || NEGATIVE_PATTERNS;
  for (const pattern of negativePatterns) {
    if (pattern.test(normalized)) {
      return {
        understood: true,
        status: 'denied',
        confidence: 0.95,
      };
    }
  }

  // Check for unclear/ambiguous patterns
  for (const pattern of UNCLEAR_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        understood: false,
        status: 'pending',
        confidence: 0.3,
        message: locale === 'en'
          ? 'I need a clear yes or no. Do you want to proceed?'
          : 'Necesito un sí o no claro. ¿Desea proceder?',
      };
    }
  }

  // Try fuzzy matching for common variations
  const fuzzyResult = fuzzyMatchConfirmation(normalized, locale);
  if (fuzzyResult.understood) {
    return fuzzyResult;
  }

  // Couldn't determine - ask for clarification
  return {
    understood: false,
    status: 'pending',
    confidence: 0.2,
    message: locale === 'en'
      ? 'I\'m not sure if that\'s a yes or no. Could you please confirm or cancel?'
      : 'No estoy seguro si eso es un sí o un no. ¿Puede confirmar o cancelar por favor?',
  };
}

/**
 * Normalize input for pattern matching
 */
function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ')    // Remove punctuation except spaces
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();
}

/**
 * Fuzzy match for common variations
 */
function fuzzyMatchConfirmation(input: string, locale: string): ConfirmationResult {
  // Positive fuzzy matches
  const positiveTerms = [
    'si', 'yes', 'ok', 'okay', 'vale', 'bien', 'claro', 'confirmo',
    'acepto', 'adelante', 'procede', 'hazlo', 'do it', 'go ahead',
  ];

  // Negative fuzzy matches
  const negativeTerms = [
    'no', 'cancel', 'cancelar', 'parar', 'stop', 'detener', 'anular',
    'olvida', 'forget', 'dejalo', 'leave', 'quit',
  ];

  // Check if input starts with or contains positive terms
  for (const term of positiveTerms) {
    if (input === term || input.startsWith(term + ' ') || input.includes(' ' + term)) {
      return {
        understood: true,
        status: 'confirmed',
        confidence: 0.8,
      };
    }
  }

  // Check negative terms
  for (const term of negativeTerms) {
    if (input === term || input.startsWith(term + ' ') || input.includes(' ' + term)) {
      return {
        understood: true,
        status: 'denied',
        confidence: 0.8,
      };
    }
  }

  return {
    understood: false,
    status: 'pending',
    confidence: 0.1,
  };
}

// =====================================================
// MESSAGE GENERATION
// =====================================================

/**
 * Get message for when user denies confirmation
 */
function getDenialMessage(toolName: string | undefined, locale: string): string {
  const messages: Record<string, Record<string, string>> = {
    create_reservation: {
      es: 'Entendido, la reservación no se ha creado. ¿Hay algo más en lo que pueda ayudarle?',
      en: 'Understood, the reservation was not created. Is there anything else I can help with?',
    },
    cancel_reservation: {
      es: 'Entendido, su reservación no será cancelada. ¿Hay algo más en lo que pueda ayudarle?',
      en: 'Understood, your reservation will not be cancelled. Is there anything else I can help with?',
    },
    modify_reservation: {
      es: 'Entendido, no se harán cambios a su reservación. ¿Hay algo más en lo que pueda ayudarle?',
      en: 'Understood, no changes will be made. Is there anything else I can help with?',
    },
    create_appointment: {
      es: 'Entendido, la cita no se ha agendado. ¿Hay algo más en lo que pueda ayudarle?',
      en: 'Understood, the appointment was not scheduled. Is there anything else I can help with?',
    },
    cancel_appointment: {
      es: 'Entendido, su cita no será cancelada. ¿Hay algo más en lo que pueda ayudarle?',
      en: 'Understood, your appointment will not be cancelled. Is there anything else I can help with?',
    },
    transfer_to_human: {
      es: 'Entendido, permanecerá conmigo. ¿En qué más puedo ayudarle?',
      en: 'Understood, you\'ll stay with me. How else can I help you?',
    },
  };

  if (toolName && messages[toolName]) {
    return messages[toolName][locale] || messages[toolName]['es'];
  }

  return locale === 'en'
    ? 'Understood, the action has been cancelled. Is there anything else I can help with?'
    : 'Entendido, la acción ha sido cancelada. ¿Hay algo más en lo que pueda ayudarle?';
}

/**
 * Get clarification message when response is unclear
 */
function getClarificationMessage(
  originalConfirmation: string | undefined,
  locale: string
): string {
  if (originalConfirmation) {
    // Add clarification to the original question
    const prefix = locale === 'en'
      ? 'I need a clear response. '
      : 'Necesito una respuesta clara. ';
    return prefix + originalConfirmation;
  }

  return locale === 'en'
    ? 'I\'m sorry, I didn\'t understand. Please say yes to confirm or no to cancel.'
    : 'Lo siento, no entendí. Por favor diga sí para confirmar o no para cancelar.';
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Check if a response is likely positive
 */
export function isPositiveResponse(input: string): boolean {
  const normalized = normalizeInput(input);
  return POSITIVE_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Check if a response is likely negative
 */
export function isNegativeResponse(input: string): boolean {
  const normalized = normalizeInput(input);
  return NEGATIVE_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Get confidence score for a confirmation response
 */
export function getConfirmationConfidence(input: string): number {
  const normalized = normalizeInput(input);

  // Check exact matches first
  for (const pattern of POSITIVE_PATTERNS) {
    if (pattern.test(normalized)) {
      // Exact single-word matches get highest confidence
      if (normalized.length <= 10) return 0.95;
      return 0.85;
    }
  }

  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(normalized)) {
      if (normalized.length <= 10) return 0.95;
      return 0.85;
    }
  }

  // Check unclear patterns
  for (const pattern of UNCLEAR_PATTERNS) {
    if (pattern.test(normalized)) {
      return 0.3;
    }
  }

  return 0.2;
}

/**
 * Generate confirmation prompt for a tool
 */
export function generateConfirmationPrompt(
  toolName: string,
  params: Record<string, unknown>,
  locale: string
): string {
  const templates: Record<string, Record<string, string>> = {
    create_reservation: {
      es: `¿Confirma la reservación para {guests} personas el {date} a las {time}?`,
      en: `Do you confirm the reservation for {guests} guests on {date} at {time}?`,
    },
    cancel_reservation: {
      es: '¿Está seguro que desea cancelar su reservación?',
      en: 'Are you sure you want to cancel your reservation?',
    },
    modify_reservation: {
      es: '¿Confirma los cambios a su reservación?',
      en: 'Do you confirm the changes to your reservation?',
    },
    create_appointment: {
      es: `¿Confirma la cita para el {date} a las {time}?`,
      en: `Do you confirm the appointment for {date} at {time}?`,
    },
    cancel_appointment: {
      es: '¿Está seguro que desea cancelar su cita?',
      en: 'Are you sure you want to cancel your appointment?',
    },
    transfer_to_human: {
      es: '¿Desea que lo transfiera con un agente humano?',
      en: 'Would you like me to transfer you to a human agent?',
    },
  };

  let template = templates[toolName]?.[locale] || templates[toolName]?.['es'];

  if (!template) {
    return locale === 'en'
      ? 'Do you want to proceed with this action?'
      : '¿Desea proceder con esta acción?';
  }

  // Replace placeholders with actual values
  for (const [key, value] of Object.entries(params)) {
    template = template.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value || ''));
  }

  return template;
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create confirmation node with configuration
 */
export function createConfirmationNode(config?: ConfirmationConfig) {
  return (state: VoiceAgentState) => confirmationNode(state, config);
}

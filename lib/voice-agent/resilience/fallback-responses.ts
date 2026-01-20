/**
 * TIS TIS Platform - Voice Agent v2.0
 * Fallback Responses for Circuit Breaker
 *
 * Provides user-friendly fallback messages when the circuit
 * is open or operations fail. Messages are:
 * - Natural and conversational
 * - Short (optimized for voice)
 * - Non-technical
 * - Offer alternatives when possible
 *
 * Supported languages: es-MX (Mexican Spanish), en-US (US English)
 */

import type {
  FallbackType,
  SupportedLanguage,
  FallbackResponse,
} from './types';

// =====================================================
// FALLBACK RESPONSE DEFINITIONS
// =====================================================

/**
 * Fallback responses organized by language and type
 */
const FALLBACK_RESPONSES: Record<
  SupportedLanguage,
  Record<FallbackType, Omit<FallbackResponse, 'type' | 'language'>>
> = {
  'es-MX': {
    systemError: {
      message:
        'Lo siento, estoy teniendo algunos problemas técnicos en este momento. ' +
        'Por favor intenta de nuevo en unos minutos.',
      offerAlternative: true,
      alternativeAction:
        'Si es urgente, puedes llamar directamente al negocio.',
    },
    timeout: {
      message:
        'La operación está tomando más tiempo del esperado. ' +
        'Por favor intenta de nuevo en un momento.',
      offerAlternative: true,
      alternativeAction: 'Puedes intentar más tarde o llamar directamente.',
    },
    circuitOpen: {
      message:
        'Estamos experimentando algunas dificultades técnicas. ' +
        'Nuestro equipo ya está trabajando en ello.',
      offerAlternative: true,
      alternativeAction:
        'Por favor intenta en unos minutos o llama directamente al negocio.',
    },
    serviceUnavailable: {
      message:
        'El servicio no está disponible en este momento. ' +
        'Estamos trabajando para resolverlo lo más pronto posible.',
      offerAlternative: true,
      alternativeAction: 'Puedes intentar más tarde o visitar nuestra página web.',
    },
  },

  'en-US': {
    systemError: {
      message:
        "I'm sorry, I'm experiencing some technical difficulties right now. " +
        'Please try again in a few minutes.',
      offerAlternative: true,
      alternativeAction:
        "If it's urgent, you can call the business directly.",
    },
    timeout: {
      message:
        'This operation is taking longer than expected. ' +
        'Please try again in a moment.',
      offerAlternative: true,
      alternativeAction: 'You can try again later or call directly.',
    },
    circuitOpen: {
      message:
        "We're experiencing some technical difficulties. " +
        'Our team is already working on it.',
      offerAlternative: true,
      alternativeAction:
        'Please try again in a few minutes or call the business directly.',
    },
    serviceUnavailable: {
      message:
        'This service is currently unavailable. ' +
        "We're working to resolve this as quickly as possible.",
      offerAlternative: true,
      alternativeAction: 'You can try again later or visit our website.',
    },
  },
};

// =====================================================
// SHORT FALLBACK RESPONSES (for voice)
// =====================================================

/**
 * Shorter versions for voice interactions where brevity is critical
 */
const SHORT_FALLBACK_RESPONSES: Record<
  SupportedLanguage,
  Record<FallbackType, string>
> = {
  'es-MX': {
    systemError: 'Lo siento, tengo problemas técnicos. Intenta de nuevo.',
    timeout: 'La operación tardó mucho. Intenta de nuevo.',
    circuitOpen: 'Tenemos dificultades técnicas. Intenta en unos minutos.',
    serviceUnavailable: 'El servicio no está disponible. Intenta más tarde.',
  },
  'en-US': {
    systemError: "Sorry, I'm having technical issues. Please try again.",
    timeout: 'This took too long. Please try again.',
    circuitOpen: "We're having technical issues. Please try in a few minutes.",
    serviceUnavailable: 'Service unavailable. Please try again later.',
  },
};

// =====================================================
// CONTEXTUAL FALLBACK RESPONSES
// =====================================================

/**
 * Context-specific fallback responses for common scenarios
 */
const CONTEXTUAL_FALLBACKS: Record<
  SupportedLanguage,
  Record<string, string>
> = {
  'es-MX': {
    appointment_booking:
      'No pude procesar tu cita en este momento. ' +
      '¿Podrías intentar de nuevo o llamar directamente?',
    order_status:
      'No pude obtener la información de tu pedido. ' +
      'Intenta de nuevo en un momento.',
    menu_inquiry:
      'No tengo acceso al menú en este momento. ' +
      '¿Te gustaría intentar de nuevo?',
    payment_processing:
      'No pude procesar el pago. ' +
      'Por favor intenta de nuevo o usa otro método de pago.',
    general_query:
      'No pude completar tu solicitud. ' +
      '¿Podrías intentar de nuevo?',
  },
  'en-US': {
    appointment_booking:
      "I couldn't process your appointment right now. " +
      'Could you try again or call directly?',
    order_status:
      "I couldn't get your order information. " +
      'Please try again in a moment.',
    menu_inquiry:
      "I don't have access to the menu right now. " +
      'Would you like to try again?',
    payment_processing:
      "I couldn't process the payment. " +
      'Please try again or use another payment method.',
    general_query:
      "I couldn't complete your request. " +
      'Could you please try again?',
  },
};

// =====================================================
// PUBLIC FUNCTIONS
// =====================================================

/**
 * Get a fallback response for a given type and language
 *
 * @param type - Type of fallback response
 * @param language - Language code (es-MX or en-US)
 * @returns Complete fallback response object
 */
export function getFallbackResponse(
  type: FallbackType,
  language: SupportedLanguage = 'es-MX'
): FallbackResponse {
  const responses = FALLBACK_RESPONSES[language] ?? FALLBACK_RESPONSES['es-MX'];
  const response = responses[type] ?? responses.systemError;

  return {
    ...response,
    type,
    language,
  };
}

/**
 * Get a short fallback message (optimized for voice)
 *
 * @param type - Type of fallback response
 * @param language - Language code
 * @returns Short fallback message string
 */
export function getShortFallbackMessage(
  type: FallbackType,
  language: SupportedLanguage = 'es-MX'
): string {
  const responses =
    SHORT_FALLBACK_RESPONSES[language] ?? SHORT_FALLBACK_RESPONSES['es-MX'];
  return responses[type] ?? responses.systemError;
}

/**
 * Get a contextual fallback message for a specific scenario
 *
 * @param context - The context/scenario key
 * @param language - Language code
 * @returns Contextual fallback message or general fallback
 */
export function getContextualFallback(
  context: string,
  language: SupportedLanguage = 'es-MX'
): string {
  const contextuals =
    CONTEXTUAL_FALLBACKS[language] ?? CONTEXTUAL_FALLBACKS['es-MX'];
  return contextuals[context] ?? contextuals.general_query;
}

/**
 * Build a complete fallback message with optional alternative
 *
 * @param type - Type of fallback
 * @param language - Language code
 * @param includeAlternative - Whether to include alternative action
 * @returns Complete message string
 */
export function buildFallbackMessage(
  type: FallbackType,
  language: SupportedLanguage = 'es-MX',
  includeAlternative: boolean = true
): string {
  const response = getFallbackResponse(type, language);

  if (includeAlternative && response.offerAlternative && response.alternativeAction) {
    return `${response.message} ${response.alternativeAction}`;
  }

  return response.message;
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): SupportedLanguage[] {
  return ['es-MX', 'en-US'];
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): language is SupportedLanguage {
  return language === 'es-MX' || language === 'en-US';
}

/**
 * Get fallback message for voice with SSML tags
 * (Speech Synthesis Markup Language for better TTS)
 *
 * @param type - Type of fallback
 * @param language - Language code
 * @returns SSML-formatted message
 */
export function getFallbackWithSSML(
  type: FallbackType,
  language: SupportedLanguage = 'es-MX'
): string {
  const message = getShortFallbackMessage(type, language);

  // Wrap in SSML with appropriate pauses
  return `<speak>
    <prosody rate="medium" pitch="medium">
      ${message}
    </prosody>
    <break time="300ms"/>
  </speak>`;
}

// =====================================================
// CONSTANTS EXPORT
// =====================================================

export {
  FALLBACK_RESPONSES,
  SHORT_FALLBACK_RESPONSES,
  CONTEXTUAL_FALLBACKS,
};

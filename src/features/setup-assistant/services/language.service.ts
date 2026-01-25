// =====================================================
// TIS TIS PLATFORM - Language Detection Service
// Detección y manejo de idiomas para Setup Assistant
// FASE 12: Multi-idioma
// =====================================================

// =====================================================
// TYPES
// =====================================================

export type SupportedLanguage = 'es' | 'en';

export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number;
  detectedFrom: 'content' | 'browser' | 'user_preference' | 'default';
}

export interface LocalizedStrings {
  // Greetings
  greeting: string;
  welcomeBack: string;

  // Common responses
  processing: string;
  understood: string;
  confirmAction: string;
  askForMore: string;

  // Errors
  errorGeneral: string;
  errorNotUnderstood: string;
  errorTryAgain: string;

  // Setup steps
  setupWelcome: string;
  setupServicesPrompt: string;
  setupBranchesPrompt: string;
  setupFAQsPrompt: string;
  setupComplete: string;

  // Image analysis
  analyzingImage: string;
  imageAnalyzed: string;
  noDataExtracted: string;

  // Confirmations
  dataImported: string;
  configSaved: string;
  wantToAddMore: string;
}

// =====================================================
// LANGUAGE PATTERNS
// =====================================================

const SPANISH_PATTERNS = [
  // Common Spanish words
  /\b(hola|buenos|días|tardes|noches|gracias|por favor|sí|si|no|cómo|qué|cuál|cuándo|dónde|porque|quiero|necesito|puedo|tengo|estoy|somos|tienen|puede|podría|gustaría|ayuda|información|precio|cita|servicio|negocio|configurar|agregar|cambiar|modificar|eliminar|ver|mostrar|lista|menú|horario)\b/gi,
  // Spanish question marks
  /¿/,
  // Spanish accents
  /[áéíóúñü]/i,
  // Common Spanish phrases
  /\b(me gustaría|quisiera|podría|necesito saber|cómo puedo|qué tal|está bien|de acuerdo|por supuesto|claro que|sin problema|muchas gracias|muy amable)\b/gi,
];

const ENGLISH_PATTERNS = [
  // Common English words
  /\b(hello|hi|hey|good morning|afternoon|evening|thanks|thank you|please|yes|no|how|what|which|when|where|why|want|need|can|have|am|we|they|could|would|help|information|price|appointment|service|business|setup|add|change|modify|delete|view|show|list|menu|schedule)\b/gi,
  // Common English phrases
  /\b(I would like|I want to|could you|can you|I need|how can I|what about|sounds good|that's fine|of course|no problem|thank you very much|very kind)\b/gi,
];

// =====================================================
// LOCALIZED STRINGS
// =====================================================

const STRINGS_ES: LocalizedStrings = {
  // Greetings
  greeting: '¡Hola! Soy tu asistente de configuración. ¿En qué puedo ayudarte hoy?',
  welcomeBack: '¡Bienvenido de nuevo! Continuemos con la configuración de tu negocio.',

  // Common responses
  processing: 'Procesando tu solicitud...',
  understood: 'Entendido.',
  confirmAction: '¿Confirmas que deseas realizar esta acción?',
  askForMore: '¿Hay algo más en lo que pueda ayudarte?',

  // Errors
  errorGeneral: 'Lo siento, ocurrió un error. Por favor intenta de nuevo.',
  errorNotUnderstood: 'No estoy seguro de haber entendido. ¿Podrías reformular tu solicitud?',
  errorTryAgain: 'Algo salió mal. Por favor intenta de nuevo.',

  // Setup steps
  setupWelcome: '¡Bienvenido al asistente de configuración! Te ayudaré a configurar tu negocio paso a paso.',
  setupServicesPrompt: '¿Qué servicios ofrece tu negocio? Puedes describirlos o enviarme una imagen de tu lista de precios.',
  setupBranchesPrompt: '¿Cuántas sucursales tiene tu negocio? Cuéntame sobre cada una.',
  setupFAQsPrompt: '¿Cuáles son las preguntas más frecuentes que te hacen tus clientes?',
  setupComplete: '¡Excelente! La configuración inicial está completa. Tu asistente de IA ya está listo para ayudar a tus clientes.',

  // Image analysis
  analyzingImage: 'Analizando la imagen...',
  imageAnalyzed: 'He analizado la imagen. Esto es lo que encontré:',
  noDataExtracted: 'No pude extraer información de la imagen. ¿Podrías enviar una más clara?',

  // Confirmations
  dataImported: 'Los datos han sido importados correctamente.',
  configSaved: 'La configuración ha sido guardada.',
  wantToAddMore: '¿Deseas agregar más información?',
};

const STRINGS_EN: LocalizedStrings = {
  // Greetings
  greeting: "Hi! I'm your setup assistant. How can I help you today?",
  welcomeBack: "Welcome back! Let's continue setting up your business.",

  // Common responses
  processing: 'Processing your request...',
  understood: 'Got it.',
  confirmAction: 'Do you confirm you want to perform this action?',
  askForMore: 'Is there anything else I can help you with?',

  // Errors
  errorGeneral: "I'm sorry, an error occurred. Please try again.",
  errorNotUnderstood: "I'm not sure I understood. Could you rephrase your request?",
  errorTryAgain: 'Something went wrong. Please try again.',

  // Setup steps
  setupWelcome: 'Welcome to the setup assistant! I will help you configure your business step by step.',
  setupServicesPrompt: 'What services does your business offer? You can describe them or send me an image of your price list.',
  setupBranchesPrompt: 'How many locations does your business have? Tell me about each one.',
  setupFAQsPrompt: "What are the most frequently asked questions from your customers?",
  setupComplete: "Excellent! The initial setup is complete. Your AI assistant is now ready to help your customers.",

  // Image analysis
  analyzingImage: 'Analyzing the image...',
  imageAnalyzed: "I've analyzed the image. Here's what I found:",
  noDataExtracted: "I couldn't extract information from the image. Could you send a clearer one?",

  // Confirmations
  dataImported: 'The data has been imported successfully.',
  configSaved: 'The configuration has been saved.',
  wantToAddMore: 'Would you like to add more information?',
};

const STRINGS_MAP: Record<SupportedLanguage, LocalizedStrings> = {
  es: STRINGS_ES,
  en: STRINGS_EN,
};

// =====================================================
// LANGUAGE SERVICE CLASS
// =====================================================

export class LanguageService {
  private static instance: LanguageService;
  private conversationLanguages: Map<string, SupportedLanguage>;

  private constructor() {
    this.conversationLanguages = new Map();
  }

  static getInstance(): LanguageService {
    if (!LanguageService.instance) {
      LanguageService.instance = new LanguageService();
    }
    return LanguageService.instance;
  }

  /**
   * Detect language from text content
   */
  detectLanguage(text: string): LanguageDetectionResult {
    if (!text || text.trim().length === 0) {
      return {
        language: 'es',
        confidence: 0,
        detectedFrom: 'default',
      };
    }

    const normalizedText = text.toLowerCase();

    // Count matches for each language
    let spanishMatches = 0;
    let englishMatches = 0;

    for (const pattern of SPANISH_PATTERNS) {
      const matches = normalizedText.match(pattern);
      if (matches) {
        spanishMatches += matches.length;
      }
    }

    for (const pattern of ENGLISH_PATTERNS) {
      const matches = normalizedText.match(pattern);
      if (matches) {
        englishMatches += matches.length;
      }
    }

    const totalMatches = spanishMatches + englishMatches;

    // If no patterns matched, default to Spanish
    if (totalMatches === 0) {
      return {
        language: 'es',
        confidence: 0.5,
        detectedFrom: 'default',
      };
    }

    const spanishRatio = spanishMatches / totalMatches;
    const language: SupportedLanguage = spanishRatio >= 0.5 ? 'es' : 'en';
    const confidence = Math.max(spanishRatio, 1 - spanishRatio);

    return {
      language,
      confidence,
      detectedFrom: 'content',
    };
  }

  /**
   * Get or set language for a conversation
   */
  getConversationLanguage(conversationId: string): SupportedLanguage {
    return this.conversationLanguages.get(conversationId) || 'es';
  }

  /**
   * Set language for a conversation
   */
  setConversationLanguage(conversationId: string, language: SupportedLanguage): void {
    this.conversationLanguages.set(conversationId, language);
  }

  /**
   * Auto-detect and set conversation language from first message
   */
  detectAndSetLanguage(conversationId: string, text: string): SupportedLanguage {
    const detection = this.detectLanguage(text);

    // Only update if confidence is high enough
    if (detection.confidence >= 0.6) {
      this.setConversationLanguage(conversationId, detection.language);
    }

    return this.getConversationLanguage(conversationId);
  }

  /**
   * Get localized strings for a language
   */
  getStrings(language: SupportedLanguage): LocalizedStrings {
    return STRINGS_MAP[language] || STRINGS_MAP.es;
  }

  /**
   * Get a specific localized string
   */
  getString(language: SupportedLanguage, key: keyof LocalizedStrings): string {
    const strings = this.getStrings(language);
    return strings[key] || STRINGS_MAP.es[key];
  }

  /**
   * Format a template string with variables
   */
  formatString(
    language: SupportedLanguage,
    key: keyof LocalizedStrings,
    variables: Record<string, string | number>
  ): string {
    let text = this.getString(language, key);

    for (const [varKey, value] of Object.entries(variables)) {
      text = text.replace(new RegExp(`\\{\\{${varKey}\\}\\}`, 'g'), String(value));
    }

    return text;
  }

  /**
   * Get system prompt language instruction
   */
  getLanguageInstruction(language: SupportedLanguage): string {
    if (language === 'en') {
      return `
IMPORTANT: Respond in ENGLISH. The user is communicating in English.
- Use clear, professional English
- Be friendly and helpful
- Keep responses concise
`;
    }

    return `
IMPORTANTE: Responde en ESPAÑOL. El usuario se comunica en español.
- Usa español claro y profesional
- Sé amable y servicial
- Mantén las respuestas concisas
`;
  }

  /**
   * Clear conversation language (on conversation end)
   */
  clearConversation(conversationId: string): void {
    this.conversationLanguages.delete(conversationId);
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return ['es', 'en'];
  }

  /**
   * Get language display name
   */
  getLanguageDisplayName(language: SupportedLanguage): string {
    const names: Record<SupportedLanguage, string> = {
      es: 'Español',
      en: 'English',
    };
    return names[language];
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const languageService = LanguageService.getInstance();

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Detect language from text
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  return languageService.detectLanguage(text);
}

/**
 * Get localized string
 */
export function t(language: SupportedLanguage, key: keyof LocalizedStrings): string {
  return languageService.getString(language, key);
}

/**
 * Get language instruction for prompts
 */
export function getLanguageInstruction(language: SupportedLanguage): string {
  return languageService.getLanguageInstruction(language);
}

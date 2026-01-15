// =====================================================
// TIS TIS PLATFORM - Prompt Validation Service
// Sistema Crítico de Validación Post-Generación
// =====================================================
// Este servicio valida que los prompts generados por Gemini
// cumplan con TODOS los requisitos críticos antes de activarse
//
// REGLAS CRÍTICAS:
// 1. Voice DEBE tener muletillas SI useFillerPhrases=true
//    Voice NO debe mencionarlas SI useFillerPhrases=false
// 2. Messaging NO debe tener muletillas de voz (nunca)
// 3. Emojis permitidos: solo funcionales (✅ ❌ 📍 📞 ⏰ 📅)
// 4. Coherencia con personalidad configurada
// 5. Información completa y correcta
// =====================================================

import type { PromptType } from './prompt-generator.service';

// ======================
// TYPES
// ======================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number; // 0-100
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
  category: 'voice' | 'messaging' | 'general';
}

export interface ValidationWarning {
  code: string;
  message: string;
  suggestion: string;
}

// ======================
// CONSTANTS
// ======================

// Muletillas conversacionales por personalidad
const FILLER_PHRASES_BY_PERSONALITY: Record<string, string[]> = {
  formal: [
    'Permítame verificar',
    'Un momento por favor',
    'Permítame consultar',
    'Déjeme confirmar',
    'Disculpe un momento',
  ],
  professional: [
    'Claro',
    'Por supuesto',
    'Déjame ver',
    'Entiendo',
    'Perfecto',
  ],
  professional_friendly: [
    'Claro',
    'Mmm',
    'Déjame ver',
    'Bueno',
    'Entiendo',
  ],
  casual: [
    'Mmm',
    'Órale',
    'Bueno',
    'Claro',
    'Déjame ver',
    'Pues',
  ],
};

// Emojis permitidos (solo funcionales)
const ALLOWED_EMOJIS = ['✅', '❌', '📍', '📞', '⏰', '📅'];

// Emojis prohibidos (caritas e informales)
const FORBIDDEN_EMOJIS = [
  '😊', '😂', '🤣', '😍', '🥰', '😘', '😉', '😎', '😢', '😭',
  '😡', '😤', '😱', '🤔', '🤷', '🙄', '😏', '😜', '😝', '🤪',
  '👍', '👎', '🙏', '💪', '✌️', '🤞', '👏', '🙌',
];

// Palabras/frases que indican muletillas de voz (para detectar en messaging)
const VOICE_FILLER_INDICATORS = [
  'mmm',
  'ehh',
  'umm',
  'ah',
  'este',
  'pues',
  'bueno',
  'órale',
  'déjame ver',
  'déjeme ver',
  'permítame',
  'un momento',
  'disculpe',
];

// Pre-compilar regex de muletillas para performance
// (evita compilar 60 regex por cada validación)
const VOICE_FILLER_PATTERNS = VOICE_FILLER_INDICATORS.flatMap(filler => {
  const escapedFiller = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`${escapedFiller}\\.{2,3}`, 'i'),           // Mmm...
    new RegExp(`^${escapedFiller}[\\s,]`, 'i'),            // ^Mmm
    new RegExp(`\\s${escapedFiller}[\\s,]`, 'i'),          // " Mmm "
    new RegExp(`${escapedFiller},`, 'i'),                  // Mmm,
  ];
});

// Longitud esperada de prompts
const PROMPT_LENGTH = {
  min: 800,   // Mínimo caracteres
  max: 8000,  // Máximo caracteres
  ideal_min: 1500,
  ideal_max: 6000,
};

// ======================
// VOICE-SPECIFIC PATTERNS (FASE 6 IMPROVEMENTS)
// ======================

// Patrones de números escritos incorrectamente para voz
// Voz debe usar "dos mil quinientos" no "$2,500" ni "2500"
const VOICE_RAW_NUMBER_PATTERNS = [
  /\$\d{1,3}(,\d{3})+/g,           // $1,500 o $12,500
  /\$\d{4,}/g,                      // $1500 (sin coma, 4+ dígitos)
  /\d{1,3}(,\d{3})+\s*(pesos|mxn|usd|dólares)/gi, // 1,500 pesos
];

// Patrones de formato markdown prohibido para voz
// Voz NO puede usar bullets, negritas, listas - es audio, no texto
const VOICE_FORBIDDEN_FORMATTING_PATTERNS = [
  /^[\s]*[-*•]\s+/gm,              // - item o * item o • item
  /\*\*[^*]+\*\*/g,                // **negrita**
  /\*[^*]+\*/g,                    // *cursiva*
  /^#+\s+/gm,                      // # headers
  /`[^`]+`/g,                      // `código`
  /\[[^\]]+\]\([^)]+\)/g,          // [link](url)
];

// Indicadores de buenas prácticas de voz
const VOICE_BEST_PRACTICES = {
  // Debe mencionar deletreo de emails
  emailSpelling: [
    'deletrea', 'letra por letra', 'deletrear', 'spelling',
    'letra a letra', 'cada letra',
  ],
  // Debe mencionar pausas en datos importantes
  dataPauses: [
    'pausa', 'despacio', 'lentamente', 'claramente',
    'repite', 'repetir', 'confirma', 'confirmar',
  ],
  // Debe mencionar respuestas cortas
  shortResponses: [
    'concis', 'breve', '2-3 oraciones', 'dos o tres oraciones',
    'corta', 'máximo 3', 'máximo tres',
  ],
  // Debe prohibir emojis explícitamente
  noEmojis: [
    'no.*emoji', 'sin emoji', 'nunca.*emoji', 'evita.*emoji',
    'no usar emoji',
  ],
};

// ======================
// VALIDATION FUNCTIONS
// ======================

/**
 * Valida un prompt generado antes de guardarlo/activarlo
 */
export function validateGeneratedPrompt(
  prompt: string,
  promptType: PromptType,
  personality: string,
  context?: {
    tenantName?: string;
    services?: string[];
    branches?: string[];
    useFillerPhrases?: boolean;  // Si está desactivado, Voice NO debe tener muletillas
    customFillerPhrases?: string[];  // Frases personalizadas del cliente
  }
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Validar longitud
  validateLength(prompt, errors, warnings);

  // 2. Validaciones específicas por tipo
  if (promptType === 'voice') {
    validateVoicePrompt(
      prompt,
      personality,
      context?.useFillerPhrases ?? true,
      context?.customFillerPhrases,
      errors,
      warnings
    );
  } else if (promptType === 'messaging') {
    validateMessagingPrompt(prompt, errors, warnings);
  }

  // 3. Validar emojis (aplicable a ambos tipos)
  validateEmojis(prompt, errors, warnings);

  // 4. Validar coherencia con contexto
  if (context) {
    validateContext(prompt, context, errors, warnings);
  }

  // 5. Calcular score
  const score = calculateValidationScore(errors, warnings, prompt.length);

  return {
    valid: errors.filter(e => e.severity === 'critical').length === 0,
    errors,
    warnings,
    score,
  };
}

/**
 * Valida la longitud del prompt
 */
function validateLength(
  prompt: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const length = prompt.length;

  if (length < PROMPT_LENGTH.min) {
    errors.push({
      code: 'PROMPT_TOO_SHORT',
      message: `Prompt muy corto (${length} chars). Mínimo: ${PROMPT_LENGTH.min}`,
      severity: 'critical',
      category: 'general',
    });
  }

  if (length > PROMPT_LENGTH.max) {
    errors.push({
      code: 'PROMPT_TOO_LONG',
      message: `Prompt muy largo (${length} chars). Máximo: ${PROMPT_LENGTH.max}`,
      severity: 'high',
      category: 'general',
    });
  }

  if (length < PROMPT_LENGTH.ideal_min || length > PROMPT_LENGTH.ideal_max) {
    warnings.push({
      code: 'PROMPT_LENGTH_SUBOPTIMAL',
      message: `Longitud fuera del rango ideal (${length} chars)`,
      suggestion: `Rango ideal: ${PROMPT_LENGTH.ideal_min}-${PROMPT_LENGTH.ideal_max} caracteres`,
    });
  }
}

/**
 * Valida prompts de Voice (llamadas telefónicas)
 */
function validateVoicePrompt(
  prompt: string,
  personality: string,
  useFillerPhrases: boolean,
  customFillerPhrases: string[] | undefined,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const promptLower = prompt.toLowerCase();

  // Normalizar personalidad (handle diferentes formatos)
  const normalizedPersonality = personality
    .toLowerCase()
    .replace(/-/g, '_')  // professional-friendly → professional_friendly
    .trim();

  // Verificar que personalidad existe en nuestro enum
  const personalityExists = normalizedPersonality in FILLER_PHRASES_BY_PERSONALITY;
  if (!personalityExists) {
    warnings.push({
      code: 'UNKNOWN_PERSONALITY',
      message: `Personalidad "${personality}" no reconocida. Usando fallback "professional_friendly"`,
      suggestion: `Personalidades válidas: ${Object.keys(FILLER_PHRASES_BY_PERSONALITY).join(', ')}`,
    });
  }

  // ========================================
  // VALIDACIÓN DE MULETILLAS (según config)
  // ========================================
  if (useFillerPhrases) {
    // Cliente tiene muletillas ACTIVADAS → Prompt DEBE incluirlas
    // Priorizar custom phrases si existen, sino usar las de personalidad
    const expectedFillers = (customFillerPhrases && customFillerPhrases.length > 0)
      ? customFillerPhrases
      : (FILLER_PHRASES_BY_PERSONALITY[normalizedPersonality] ||
         FILLER_PHRASES_BY_PERSONALITY.professional_friendly);

    // Verificar que el prompt MENCIONA usar muletillas (no solo las contiene)
    const mentionsFillers = promptLower.includes('muletilla') ||
                            expectedFillers.some(filler => promptLower.includes(filler.toLowerCase()));

    // Verificar que INSTRUYE a usarlas (no solo las menciona)
    const instructsFillers = /incluye|usa|utiliza|agrega|incorpora.*muletilla/i.test(prompt) ||
                             /muletilla.*como|tales como.*["'].*["']/i.test(prompt);

    // Verificar que usa palabras de OBLIGATORIEDAD (siempre, debe, obligatorio)
    const hasObligatoryLanguage = /siempre|debe|obligatorio|necesario.*muletilla/i.test(prompt) ||
                                   /muletilla.*siempre|debe|obligatorio|necesario/i.test(prompt);

    if (!mentionsFillers) {
      errors.push({
        code: 'VOICE_MISSING_FILLERS',
        message: `Voice prompt DEBE mencionar muletillas conversacionales para personalidad "${personality}"`,
        severity: 'critical',
        category: 'voice',
      });
    }

    if (mentionsFillers && !instructsFillers) {
      warnings.push({
        code: 'VOICE_WEAK_FILLER_INSTRUCTION',
        message: 'Prompt menciona muletillas pero no es explícito en instruir su uso',
        suggestion: 'Agregar: "SIEMPRE incluye muletillas como..."',
      });
    }

    if (mentionsFillers && instructsFillers && !hasObligatoryLanguage) {
      warnings.push({
        code: 'VOICE_MISSING_MANDATORY_LANGUAGE',
        message: 'Prompt no enfatiza que muletillas son OBLIGATORIAS (debe usar "siempre", "debe", etc.)',
        suggestion: 'Agregar: "SIEMPRE debe incluir muletillas..." o "Es obligatorio usar muletillas..."',
      });
    }
  } else {
    // Cliente tiene muletillas DESACTIVADAS → Prompt NO debe INSTRUIR a usarlas
    // Está OK si menciona "NO usar muletillas", pero NO si instruye a usarlas
    const instructsToUseFillersPattern = /siempre|debe|incluye|usa|utiliza|agrega|incorpora.*muletilla/i;
    const prohibitsFillersPattern = /no.*usar.*muletilla|sin.*muletilla|evita.*muletilla/i;

    const instructsToUseFillers = instructsToUseFillersPattern.test(prompt);
    const prohibitsFillers = prohibitsFillersPattern.test(prompt);

    if (instructsToUseFillers && !prohibitsFillers) {
      errors.push({
        code: 'VOICE_FILLERS_DISABLED_BUT_INSTRUCTED',
        message: 'Cliente desactivó muletillas pero el prompt instruye a usarlas',
        severity: 'critical',
        category: 'voice',
      });
    }

    // Opcional: Warning si NO menciona explícitamente la prohibición
    if (!prohibitsFillers) {
      warnings.push({
        code: 'VOICE_FILLERS_DISABLED_NOT_EXPLICIT',
        message: 'Cliente desactivó muletillas pero prompt no lo menciona explícitamente',
        suggestion: 'Agregar: "NO usar muletillas conversacionales"',
      });
    }
  }

  // Validar que menciona que es una llamada de voz
  const voiceIndicators = ['llamada', 'voz', 'telefónica', 'conversación'];
  const hasVoiceContext = voiceIndicators.some(indicator =>
    promptLower.includes(indicator)
  );

  if (!hasVoiceContext) {
    warnings.push({
      code: 'VOICE_MISSING_CONTEXT',
      message: 'Prompt no menciona explícitamente que es una llamada de voz',
      suggestion: 'Incluir contexto: "Esta es una conversación telefónica..."',
    });
  }

  // Validar concisión (Voice debe ser breve)
  const hasConciseness = promptLower.includes('concis') ||
                         promptLower.includes('breve') ||
                         promptLower.includes('2-3 oraciones');

  if (!hasConciseness) {
    warnings.push({
      code: 'VOICE_MISSING_CONCISENESS',
      message: 'Prompt no enfatiza respuestas concisas',
      suggestion: 'Agregar: "Respuestas concisas de 2-3 oraciones máximo"',
    });
  }

  // CRÍTICO: Voice NO debe tener emojis de carita
  const hasForbiddenEmojis = FORBIDDEN_EMOJIS.some(emoji => prompt.includes(emoji));
  if (hasForbiddenEmojis) {
    errors.push({
      code: 'VOICE_HAS_EMOJI_FACES',
      message: 'Voice NO debe incluir emojis de caritas o informales',
      severity: 'critical',
      category: 'voice',
    });
  }

  // ========================================
  // VALIDACIONES ADICIONALES FASE 6
  // ========================================

  // 1. Validar números crudos (deben estar escritos como palabras para TTS)
  validateVoiceNumbers(prompt, errors, warnings);

  // 2. Validar formato prohibido (no markdown en voz)
  validateVoiceFormatting(prompt, errors, warnings);

  // 3. Validar buenas prácticas de voz
  validateVoiceBestPractices(prompt, warnings);
}

/**
 * Valida que los números en prompts de voz estén escritos correctamente
 * Voz debe usar "dos mil quinientos" no "$2,500"
 */
function validateVoiceNumbers(
  prompt: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Buscar números con formato monetario crudo
  const rawNumbersFound: string[] = [];

  for (const pattern of VOICE_RAW_NUMBER_PATTERNS) {
    const matches = prompt.match(pattern);
    if (matches) {
      rawNumbersFound.push(...matches);
    }
  }

  if (rawNumbersFound.length > 0) {
    // Verificar si el prompt INSTRUYE sobre cómo manejar números
    const promptLower = prompt.toLowerCase();
    const instructsAboutNumbers =
      promptLower.includes('número') && (
        promptLower.includes('palabra') ||
        promptLower.includes('escrib') ||
        promptLower.includes('pronunci') ||
        promptLower.includes('dic')
      );

    if (!instructsAboutNumbers) {
      errors.push({
        code: 'VOICE_RAW_NUMBERS',
        message: `Números crudos detectados en prompt de voz: ${rawNumbersFound.slice(0, 3).join(', ')}. Voice debe usar números como palabras ("dos mil quinientos" no "$2,500")`,
        severity: 'high',
        category: 'voice',
      });
    } else {
      // Si instruye pero tiene ejemplos crudos, es warning
      warnings.push({
        code: 'VOICE_RAW_NUMBERS_WITH_INSTRUCTION',
        message: `Prompt tiene números crudos pero instruye sobre su manejo. Revisar ejemplos.`,
        suggestion: 'Verificar que los ejemplos de precios también usen formato hablado',
      });
    }
  }

  // Verificar que el prompt mencione cómo manejar precios en voz
  const promptLower = prompt.toLowerCase();
  const mentionsPriceHandling =
    (promptLower.includes('precio') || promptLower.includes('costo')) &&
    (promptLower.includes('palabra') || promptLower.includes('letra') ||
     promptLower.includes('deletrea') || promptLower.includes('pronunci'));

  if (!mentionsPriceHandling) {
    warnings.push({
      code: 'VOICE_MISSING_PRICE_INSTRUCTION',
      message: 'Prompt de voz no menciona cómo comunicar precios verbalmente',
      suggestion: 'Agregar: "Los precios deben decirse como palabras: \'mil quinientos pesos\' no \'$1,500\'"',
    });
  }
}

/**
 * Valida que el prompt de voz no use formato markdown
 * Voz es audio, no puede "ver" bullets o negritas
 */
function validateVoiceFormatting(
  prompt: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const formattingIssues: string[] = [];

  for (const pattern of VOICE_FORBIDDEN_FORMATTING_PATTERNS) {
    if (pattern.test(prompt)) {
      // Identificar qué tipo de formato se encontró
      if (pattern.source.includes('[-*•]')) {
        formattingIssues.push('bullets/listas');
      } else if (pattern.source.includes('\\*\\*')) {
        formattingIssues.push('negritas');
      } else if (pattern.source.includes('^#+')) {
        formattingIssues.push('encabezados');
      } else if (pattern.source.includes('`')) {
        formattingIssues.push('código');
      } else if (pattern.source.includes('\\[')) {
        formattingIssues.push('enlaces');
      }
    }
  }

  // Eliminar duplicados
  const uniqueIssues = [...new Set(formattingIssues)];

  if (uniqueIssues.length > 0) {
    errors.push({
      code: 'VOICE_HAS_VISUAL_FORMATTING',
      message: `Prompt de voz contiene formato visual: ${uniqueIssues.join(', ')}. Voice es audio, no puede mostrar formato.`,
      severity: 'high',
      category: 'voice',
    });

    warnings.push({
      code: 'VOICE_FORMATTING_SUGGESTION',
      message: 'El formato visual no se transmite en llamadas telefónicas',
      suggestion: 'Convertir listas a oraciones naturales: "Primero X, luego Y, y finalmente Z"',
    });
  }
}

/**
 * Valida buenas prácticas específicas de voz
 */
function validateVoiceBestPractices(
  prompt: string,
  warnings: ValidationWarning[]
): void {
  const promptLower = prompt.toLowerCase();

  // 1. Verificar mención de deletreo de emails
  const hasEmailSpelling = VOICE_BEST_PRACTICES.emailSpelling.some(
    term => promptLower.includes(term.toLowerCase())
  );

  // Solo advertir si el prompt menciona emails pero no cómo deletrearlos
  if (promptLower.includes('email') || promptLower.includes('correo')) {
    if (!hasEmailSpelling) {
      warnings.push({
        code: 'VOICE_MISSING_EMAIL_SPELLING',
        message: 'Prompt menciona emails pero no instruye sobre deletreo',
        suggestion: 'Agregar: "Los emails deben deletrearse letra por letra para evitar errores"',
      });
    }
  }

  // 2. Verificar mención de pausas en datos importantes
  const hasDataPauses = VOICE_BEST_PRACTICES.dataPauses.some(
    term => promptLower.includes(term.toLowerCase())
  );

  // Solo advertir si menciona teléfonos o direcciones
  if (promptLower.includes('teléfono') || promptLower.includes('dirección') ||
      promptLower.includes('telefono') || promptLower.includes('direccion')) {
    if (!hasDataPauses) {
      warnings.push({
        code: 'VOICE_MISSING_DATA_PAUSES',
        message: 'Prompt menciona teléfonos/direcciones pero no instruye sobre pausas',
        suggestion: 'Agregar: "Los teléfonos y direcciones deben decirse lentamente, repitiendo si es necesario"',
      });
    }
  }

  // 3. Verificar prohibición explícita de emojis
  const hasNoEmojisInstruction = VOICE_BEST_PRACTICES.noEmojis.some(
    pattern => new RegExp(pattern, 'i').test(prompt)
  );

  if (!hasNoEmojisInstruction) {
    warnings.push({
      code: 'VOICE_MISSING_NO_EMOJI_RULE',
      message: 'Prompt de voz no prohíbe explícitamente el uso de emojis',
      suggestion: 'Agregar: "NUNCA uses emojis en respuestas de voz - es una llamada telefónica"',
    });
  }

  // 4. Verificar mención de respuestas cortas
  const hasShortResponseRule = VOICE_BEST_PRACTICES.shortResponses.some(
    term => promptLower.includes(term.toLowerCase())
  );

  if (!hasShortResponseRule) {
    warnings.push({
      code: 'VOICE_MISSING_SHORT_RESPONSE_RULE',
      message: 'Prompt de voz no enfatiza respuestas cortas',
      suggestion: 'Agregar: "Respuestas de máximo 2-3 oraciones. Voz es más lenta que texto."',
    });
  }
}

/**
 * Valida prompts de Messaging (WhatsApp, Instagram, etc.)
 */
function validateMessagingPrompt(
  prompt: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const promptLower = prompt.toLowerCase();

  // CRÍTICO: Messaging NO debe tener muletillas de voz
  // Nota: Estos patrones detectan USO de muletillas, no solo mención
  // Ejemplo OK: "NO uses 'Mmm...'" → No matchea porque no está aislada
  // Ejemplo MAL: "Mmm... sí tenemos eso" → Matchea (uso real)
  // Usamos VOICE_FILLER_PATTERNS pre-compiladas para performance
  const hasVoiceFillers = VOICE_FILLER_PATTERNS.some(pattern => pattern.test(prompt));

  if (hasVoiceFillers) {
    errors.push({
      code: 'MESSAGING_HAS_VOICE_FILLERS',
      message: 'Messaging NO debe incluir muletillas de voz (Mmm..., Bueno..., etc.)',
      severity: 'critical',
      category: 'messaging',
    });
  }

  // Validar que menciona que es texto escrito
  const textIndicators = ['mensaje', 'texto', 'escrito', 'chat', 'whatsapp', 'instagram'];
  const hasTextContext = textIndicators.some(indicator =>
    promptLower.includes(indicator)
  );

  if (!hasTextContext) {
    warnings.push({
      code: 'MESSAGING_MISSING_CONTEXT',
      message: 'Prompt no menciona explícitamente que es comunicación por texto',
      suggestion: 'Incluir contexto: "Este es un asistente de mensajería..."',
    });
  }

  // Validar formato (Messaging puede usar bullets, listas)
  const hasFormatting = promptLower.includes('bullet') ||
                        promptLower.includes('lista') ||
                        promptLower.includes('formato');

  if (!hasFormatting) {
    warnings.push({
      code: 'MESSAGING_MISSING_FORMATTING',
      message: 'Prompt no menciona uso de formato (bullets, listas)',
      suggestion: 'Agregar: "Puede usar bullets o listas cuando sea útil"',
    });
  }
}

/**
 * Valida uso de emojis
 */
function validateEmojis(
  prompt: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Detectar CUALQUIER emoji en el prompt
  // Regex compatible con ES6+ (evita \p{} que requiere ES2018+)
  // Rangos incluidos:
  // - U+1F300-1F9FF: Miscellaneous Symbols, Emoticons, etc.
  // - U+2600-26FF: Miscellaneous Symbols (☀️, ⚡, etc.)
  // - U+2700-27BF: Dingbats (✅, ❌, etc.)
  // - U+1F1E0-1F1FF: Regional Indicator Symbols (banderas)
  // - U+2300-23FF: Miscellaneous Technical (⏰, ⌛, ⏳, etc.)
  // - U+2B50-2B55: Stars and symbols (⭐, etc.)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]/gu;
  const emojisFound = prompt.match(emojiRegex) || [];

  if (emojisFound.length === 0) {
    // No hay emojis - esto está bien
    return;
  }

  // Verificar que solo sean emojis permitidos
  const forbiddenEmojisFound = emojisFound.filter(emoji =>
    !ALLOWED_EMOJIS.includes(emoji)
  );

  if (forbiddenEmojisFound.length > 0) {
    // P4 FIX: Emojis prohibidos son ahora CRITICAL para rechazar el prompt
    errors.push({
      code: 'FORBIDDEN_EMOJIS',
      message: `Emojis no permitidos encontrados: ${Array.from(new Set(forbiddenEmojisFound)).join(', ')}`,
      severity: 'critical', // P4 FIX: Changed from 'high' to 'critical'
      category: 'general',
    });

    warnings.push({
      code: 'EMOJI_RESTRICTION',
      message: 'Solo se permiten emojis funcionales',
      suggestion: `Emojis permitidos: ${ALLOWED_EMOJIS.join(' ')}`,
    });
  }
}

/**
 * Valida coherencia con contexto del negocio
 */
function validateContext(
  prompt: string,
  context: {
    tenantName?: string;
    services?: string[];
    branches?: string[];
  },
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const promptLower = prompt.toLowerCase();

  // Validar que menciona el nombre del negocio
  if (context.tenantName) {
    const hasTenantName = promptLower.includes(context.tenantName.toLowerCase());
    if (!hasTenantName) {
      warnings.push({
        code: 'MISSING_TENANT_NAME',
        message: `Prompt no menciona el nombre del negocio: "${context.tenantName}"`,
        suggestion: 'Asegurar que el prompt incluye el nombre del negocio',
      });
    }
  }

  // Validar que menciona servicios (al menos algunos)
  if (context.services && context.services.length > 0) {
    const mentionsServices = context.services.some(service =>
      service && promptLower.includes(service.toLowerCase())
    );

    if (!mentionsServices) {
      warnings.push({
        code: 'MISSING_SERVICES',
        message: 'Prompt no menciona ningún servicio específico',
        suggestion: 'Incluir ejemplos de servicios principales',
      });
    }
  }

  // Validar que menciona sucursales
  if (context.branches && context.branches.length > 0) {
    const mentionsBranches = context.branches.some(branch =>
      branch && promptLower.includes(branch.toLowerCase())
    );

    if (!mentionsBranches && context.branches.length > 1) {
      warnings.push({
        code: 'MISSING_BRANCHES',
        message: 'Prompt no menciona las sucursales disponibles',
        suggestion: `Incluir información de ${context.branches.length} sucursales`,
      });
    }
  }
}

/**
 * Calcula score de calidad del prompt (0-100)
 */
function calculateValidationScore(
  errors: ValidationError[],
  warnings: ValidationWarning[],
  promptLength: number
): number {
  let score = 100;

  // Penalizar por errores
  errors.forEach(error => {
    if (error.severity === 'critical') {
      score -= 30;
    } else if (error.severity === 'high') {
      score -= 15;
    } else {
      score -= 5;
    }
  });

  // Penalizar por warnings (menos severo)
  score -= warnings.length * 2;

  // Bonificar si longitud está en rango ideal
  if (promptLength >= PROMPT_LENGTH.ideal_min && promptLength <= PROMPT_LENGTH.ideal_max) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Genera reporte legible de validación
 */
export function formatValidationReport(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('REPORTE DE VALIDACIÓN DE PROMPT');
  lines.push('='.repeat(60));
  lines.push('');

  // Score
  const scoreEmoji = result.score >= 90 ? '✅' : result.score >= 70 ? '⚠️' : '❌';
  lines.push(`Score: ${result.score}/100 ${scoreEmoji}`);
  lines.push(`Estado: ${result.valid ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`);
  lines.push('');

  // Errores
  if (result.errors.length > 0) {
    lines.push('ERRORES:');
    result.errors.forEach((error, i) => {
      const severityIcon = error.severity === 'critical' ? '🔴' :
                           error.severity === 'high' ? '🟠' : '🟡';
      lines.push(`${i + 1}. ${severityIcon} [${error.code}] ${error.message}`);
    });
    lines.push('');
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('ADVERTENCIAS:');
    result.warnings.forEach((warning, i) => {
      lines.push(`${i + 1}. ⚠️ [${warning.code}] ${warning.message}`);
      lines.push(`   💡 ${warning.suggestion}`);
    });
    lines.push('');
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    lines.push('✅ No se encontraron problemas');
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}

// ======================
// EXPORTS
// ======================

export const PromptValidatorService = {
  validateGeneratedPrompt,
  formatValidationReport,
};

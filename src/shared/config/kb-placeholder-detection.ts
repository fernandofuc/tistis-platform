// =====================================================
// TIS TIS PLATFORM - Placeholder Detection
// Detecta contenido placeholder, genérico o de prueba
// =====================================================

// ======================
// TYPES
// ======================

export interface PlaceholderDetectionResult {
  isPlaceholder: boolean;
  isGeneric: boolean;
  confidence: number;         // 0-100
  matchedPatterns: string[];  // Patrones que hicieron match
  suggestions?: string[];     // Sugerencias para mejorar
}

// ======================
// PLACEHOLDER PATTERNS
// ======================

/**
 * Patrones que indican contenido de prueba/placeholder
 * Organizados por severidad: críticos (placeholder seguro) vs warning (posible)
 */
const PLACEHOLDER_PATTERNS = {
  // CRÍTICOS - 100% placeholder
  critical: [
    /^test$/i,
    /^prueba$/i,
    /^testing$/i,
    /^placeholder$/i,
    /^sample$/i,
    /^ejemplo$/i,
    /^demo$/i,
    /^foo$/i,
    /^bar$/i,
    /^baz$/i,
    /^asdf+$/i,
    /^qwerty$/i,
    /^1234+$/,
    /^abcd+$/i,
    /^xxx+$/i,
    /^yyy+$/i,
    /^zzz+$/i,
    /lorem ipsum/i,
    /dolor sit amet/i,
    /consectetur adipiscing/i,
    /\[.*aquí.*\]/i,           // [escribe aquí]
    /\[.*completa.*\]/i,       // [completa esto]
    /\{.*placeholder.*\}/i,
    /\{\{.*\}\}/,              // {{placeholder}}
    /TODO/,
    /FIXME/,
    /PENDING/i,
    /TBD$/i,                   // To Be Determined
    /N\/A$/i,                  // N/A solo
    /^\.+$/,                   // Solo puntos
    /^-+$/,                    // Solo guiones
    /^_+$/,                    // Solo underscores
  ],

  // ALTA PROBABILIDAD - Muy probablemente placeholder
  high: [
    /^.{1,5}$/,               // Menos de 5 caracteres (muy sospechoso)
    /^hola$/i,                // Solo "hola"
    /^hi$/i,
    /^ok$/i,
    /^sí$/i,
    /^no$/i,
    /^nada$/i,
    /^algo$/i,
    /^cosa$/i,
    /^stuff$/i,
    /^blah/i,
    /^etc\.?$/i,
    /^\.\.\.$/, // Solo ...
    /jfslkdjf|asldkfj|qoweiru/i,  // Teclado aleatorio
  ],

  // SOSPECHOSO - Podría ser placeholder
  suspicious: [
    /^.{6,10}$/,              // 6-10 caracteres (podría ser muy corto)
    /^información$/i,         // Solo "información" sin contexto
    /^descripción$/i,
    /^contenido$/i,
    /^texto$/i,
    /^data$/i,
    /por definir/i,
    /en construcción/i,
    /próximamente/i,
    /coming soon/i,
  ],
};

/**
 * Patrones de contenido genérico
 * No son placeholders, pero son demasiado genéricos para ser útiles
 */
const GENERIC_PATTERNS = [
  // Saludos ultra-genéricos
  /^bienvenido[s]?$/i,
  /^hola,?\s*(¿)?cómo\s*(te\s*)?(puedo|podemos)\s*ayudar/i,
  /^gracias por (contactarnos|escribir(nos)?)/i,
  /^en qué (te|le) (puedo|podemos) ayudar/i,

  // Despedidas genéricas
  /^hasta (pronto|luego)$/i,
  /^que (tenga|tengas) (un )?(buen|excelente) día$/i,
  /^gracias$/i,

  // Políticas genéricas sin detalles
  /^nuestra política de cancelación/i,           // Sin especificar la política
  /^aceptamos (varios|diferentes) métodos de pago/i,  // Sin especificar cuáles

  // Contenido sin personalización
  /somos una empresa/i,                          // Sin decir qué tipo
  /ofrecemos (los|nuestros) servicios/i,         // Sin decir cuáles
  /contamos con personal capacitado/i,           // Sin especificar
  /años de experiencia/i,                        // Sin número específico
];

/**
 * Frases que indican falta de información específica
 */
const VAGUE_INDICATORS = [
  'etc',
  'y más',
  'entre otros',
  'diversos',
  'varios',
  'diferentes',
  'múltiples',
  'algunos',
  'ciertos',
  'consultar',
  'preguntar',
  'depende',
  'varía',
  'variable',
];

// ======================
// DETECTION FUNCTIONS
// ======================

/**
 * Detecta si el contenido es un placeholder o genérico
 */
export function detectPlaceholder(content: string | null | undefined): PlaceholderDetectionResult {
  // Manejo de null/undefined/vacío
  if (!content || typeof content !== 'string') {
    return {
      isPlaceholder: true,
      isGeneric: false,
      confidence: 100,
      matchedPatterns: ['EMPTY_CONTENT'],
      suggestions: ['Agrega contenido específico de tu negocio'],
    };
  }

  const trimmedContent = content.trim();

  // Contenido vacío después de trim
  if (trimmedContent.length === 0) {
    return {
      isPlaceholder: true,
      isGeneric: false,
      confidence: 100,
      matchedPatterns: ['EMPTY_AFTER_TRIM'],
      suggestions: ['Agrega contenido específico de tu negocio'],
    };
  }

  const matchedPatterns: string[] = [];
  let isPlaceholder = false;
  let confidence = 0;

  // Verificar patrones críticos
  for (const pattern of PLACEHOLDER_PATTERNS.critical) {
    if (pattern.test(trimmedContent)) {
      matchedPatterns.push(`CRITICAL: ${pattern.source}`);
      isPlaceholder = true;
      confidence = Math.max(confidence, 100);
    }
  }

  // Si ya es placeholder crítico, retornar
  if (isPlaceholder && confidence === 100) {
    return {
      isPlaceholder: true,
      isGeneric: false,
      confidence: 100,
      matchedPatterns,
      suggestions: ['Reemplaza este contenido de prueba con información real de tu negocio'],
    };
  }

  // Verificar patrones de alta probabilidad
  for (const pattern of PLACEHOLDER_PATTERNS.high) {
    if (pattern.test(trimmedContent)) {
      matchedPatterns.push(`HIGH: ${pattern.source}`);
      confidence = Math.max(confidence, 85);
    }
  }

  // Verificar patrones sospechosos
  for (const pattern of PLACEHOLDER_PATTERNS.suspicious) {
    if (pattern.test(trimmedContent)) {
      matchedPatterns.push(`SUSPICIOUS: ${pattern.source}`);
      confidence = Math.max(confidence, 60);
    }
  }

  // Verificar caracteres repetitivos (señal de placeholder)
  const repetitivePattern = detectRepetitiveCharacters(trimmedContent);
  if (repetitivePattern) {
    matchedPatterns.push(`REPETITIVE: ${repetitivePattern}`);
    confidence = Math.max(confidence, 90);
  }

  // Verificar si parece contenido aleatorio de teclado
  const keyboardRandom = detectKeyboardRandom(trimmedContent);
  if (keyboardRandom) {
    matchedPatterns.push('KEYBOARD_RANDOM');
    confidence = Math.max(confidence, 95);
  }

  // Determinar si es placeholder basado en confidence
  isPlaceholder = confidence >= 70;

  // Verificar contenido genérico
  const isGeneric = !isPlaceholder && detectGenericContent(trimmedContent);

  return {
    isPlaceholder,
    isGeneric,
    confidence,
    matchedPatterns,
    suggestions: isPlaceholder
      ? ['Reemplaza con contenido específico y detallado de tu negocio']
      : isGeneric
      ? ['Personaliza el contenido con detalles específicos (nombres, números, políticas exactas)']
      : undefined,
  };
}

/**
 * Detecta contenido genérico (no placeholder, pero poco útil)
 */
export function detectGenericContent(content: string): boolean {
  const trimmed = content.trim().toLowerCase();

  // Verificar patrones genéricos
  for (const pattern of GENERIC_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  // Verificar exceso de indicadores vagos
  const vagueCount = VAGUE_INDICATORS.filter(
    indicator => trimmed.includes(indicator.toLowerCase())
  ).length;

  // Si hay más de 2 indicadores vagos en contenido corto, es genérico
  if (vagueCount >= 2 && content.length < 200) {
    return true;
  }

  // Verificar ratio de contenido específico vs genérico
  const specificIndicators = [
    /\d+/,                  // Números específicos
    /\$/,                   // Precios
    /%/,                    // Porcentajes
    /\d{1,2}:\d{2}/,       // Horarios
    /lunes|martes|miércoles|jueves|viernes|sábado|domingo/i,
    /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i,  // Inglés también
    /@/,                    // Emails
    /\+\d/,                 // Teléfonos
    /MXN|USD|EUR/i,        // Monedas
  ];

  const hasSpecifics = specificIndicators.some(pattern => pattern.test(content));

  // Si es contenido largo sin detalles específicos, es genérico
  if (content.length > 100 && !hasSpecifics) {
    // Verificar si al menos menciona algo concreto
    // Regex mejorada: detecta palabras capitalizadas en español, inglés y minúsculas
    const concreteWords = content.match(/\b[A-ZÁÉÍÓÚÑa-záéíóúñ]{4,}\b/g) || [];
    const uniqueConcreteWords = new Set(concreteWords.map(w => w.toLowerCase()));

    // Si tiene pocas palabras concretas únicas (excluyendo palabras muy comunes), es genérico
    const commonWords = new Set(['para', 'como', 'este', 'esta', 'todo', 'todos', 'cada', 'sobre', 'desde', 'hasta', 'with', 'from', 'your', 'that', 'this', 'have', 'been', 'very', 'more', 'some']);
    const meaningfulWords = [...uniqueConcreteWords].filter(w => !commonWords.has(w));

    if (meaningfulWords.length < 3) {
      return true;
    }
  }

  return false;
}

/**
 * Detecta caracteres repetitivos (aaaa, 1111, etc.)
 */
function detectRepetitiveCharacters(content: string): string | null {
  // Patrón: mismo carácter 4+ veces seguidas
  const repetitiveMatch = content.match(/(.)\1{3,}/);
  if (repetitiveMatch) {
    return `"${repetitiveMatch[0]}" (repetición de "${repetitiveMatch[1]}")`;
  }

  // Patrón: mismo par de caracteres 3+ veces
  const pairMatch = content.match(/(.{2})\1{2,}/);
  if (pairMatch && pairMatch[0].length >= 6) {
    return `"${pairMatch[0]}" (repetición de "${pairMatch[1]}")`;
  }

  return null;
}

/**
 * Detecta contenido que parece tecleado al azar
 */
function detectKeyboardRandom(content: string): boolean {
  // Solo contenido corto
  if (content.length > 50) return false;

  // Verificar si tiene solo consonantes sin vocales (excepto "y")
  const vowelCount = (content.match(/[aeiouáéíóú]/gi) || []).length;
  const letterCount = (content.match(/[a-záéíóúñ]/gi) || []).length;

  if (letterCount > 5 && vowelCount / letterCount < 0.1) {
    return true;
  }

  // Verificar patrones de teclado comunes
  const keyboardPatterns = [
    /qwer|asdf|zxcv/i,
    /uiop|jkl;|nm,\./i,
    /1234|4321|0987/,
  ];

  return keyboardPatterns.some(p => p.test(content));
}

// ======================
// QUALITY ANALYSIS
// ======================

/**
 * Analiza la calidad general del contenido
 */
export function analyzeContentQuality(content: string): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const detection = detectPlaceholder(content);

  // Placeholder detection
  if (detection.isPlaceholder) {
    score = 10;
    issues.push('Contenido detectado como placeholder');
    suggestions.push('Reemplaza con contenido real y específico');
    return { score, issues, suggestions };
  }

  // Generic content
  if (detection.isGeneric) {
    score -= 30;
    issues.push('Contenido muy genérico');
    suggestions.push('Agrega detalles específicos: nombres, números, políticas exactas');
  }

  // Length analysis
  const trimmed = content.trim();
  if (trimmed.length < 30) {
    score -= 25;
    issues.push('Contenido muy corto');
    suggestions.push('Expande con más detalles relevantes');
  } else if (trimmed.length < 80) {
    score -= 10;
    issues.push('Contenido podría ser más detallado');
  }

  // Specificity analysis
  const hasNumbers = /\d/.test(content);
  const hasDays = /lunes|martes|miércoles|jueves|viernes|sábado|domingo/i.test(content);
  const hasPrices = /\$|pesos|mxn|usd/i.test(content);
  const hasHours = /\d{1,2}:\d{2}|\d{1,2}\s*(am|pm|hrs?)/i.test(content);

  const specificityScore = [hasNumbers, hasDays, hasPrices, hasHours].filter(Boolean).length;

  if (specificityScore === 0 && trimmed.length > 50) {
    score -= 15;
    suggestions.push('Considera agregar datos específicos: horarios, precios, días');
  }

  return {
    score: Math.max(0, score),
    issues,
    suggestions,
  };
}

// ======================
// EXPORTS
// ======================

export const PlaceholderDetection = {
  detectPlaceholder,
  detectGenericContent,
  analyzeContentQuality,
};

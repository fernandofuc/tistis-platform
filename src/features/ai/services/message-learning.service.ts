// =====================================================
// TIS TIS PLATFORM - Message Learning Service
// Servicio de aprendizaje automático de mensajes
// =====================================================
// Este servicio analiza los mensajes entrantes para:
// - Extraer patrones de comportamiento
// - Aprender vocabulario específico del negocio
// - Detectar preferencias de horarios
// - Identificar objeciones comunes
// - Generar insights automáticos
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';

// ======================
// REVISIÓN 5.2 G-B2: PII SANITIZATION
// ======================

/**
 * Patrones de información personal identificable (PII)
 * Estos patrones se eliminan del texto antes de almacenar
 * para cumplir con GDPR/LFPDPPP
 */
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // RFC mexicano (persona física y moral)
  { pattern: /[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/gi, replacement: '[RFC]' },
  // Email
  { pattern: /[\w.-]+@[\w.-]+\.\w+/gi, replacement: '[EMAIL]' },
  // Teléfono mexicano (varios formatos)
  { pattern: /(\+?52)?[\s.-]?\d{2,3}[\s.-]?\d{3,4}[\s.-]?\d{4}/g, replacement: '[TELEFONO]' },
  // CURP
  { pattern: /[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/gi, replacement: '[CURP]' },
  // Tarjeta de crédito (4 grupos de 4 dígitos)
  { pattern: /\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}/g, replacement: '[TARJETA]' },
  // NSS (IMSS - 11 dígitos)
  { pattern: /\b\d{11}\b/g, replacement: '[NSS]' },
  // Nombres propios después de "soy", "me llamo", "mi nombre es"
  { pattern: /(?:soy|me llamo|mi nombre es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/gi, replacement: '[NOMBRE]' },
  // Direcciones con número (calle + número)
  { pattern: /(?:calle|av(?:enida)?|blvd|boulevard|col(?:onia)?)\s+[\w\s]+\s*#?\s*\d+/gi, replacement: '[DIRECCION]' },
  // Código postal mexicano
  { pattern: /\b(?:c\.?p\.?\s*)?\d{5}\b/gi, replacement: '[CP]' },
];

/**
 * REVISIÓN 5.2 G-B2: Sanitiza información personal del texto
 * Reemplaza PII con placeholders seguros antes de almacenar
 *
 * @param text - Texto a sanitizar
 * @returns Texto sin información personal identificable
 */
function sanitizePII(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let sanitized = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    // Crear nueva instancia para evitar problemas con lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);
    sanitized = sanitized.replace(regex, replacement);
  }

  return sanitized;
}

/**
 * Verifica si un texto contiene PII
 * Útil para logging y métricas
 */
export function containsPII(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  for (const { pattern } of PII_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    if (regex.test(text)) {
      return true;
    }
  }

  return false;
}

// ======================
// TYPES
// ======================

export interface LearningConfig {
  learning_enabled: boolean;
  learn_vocabulary: boolean;
  learn_patterns: boolean;
  learn_scheduling_preferences: boolean;
  learn_objections: boolean;
  learn_competitors: boolean;
  min_occurrences_for_pattern: number;
  confidence_threshold: number;
  anonymize_data: boolean;
}

export interface ExtractedPattern {
  type: string;
  value: string;
  context?: string;
  sentiment?: number;
  metadata?: Record<string, unknown>;
}

export interface ExtractedVocabulary {
  term: string;
  meaning?: string;
  category: string;
  synonyms?: string[];
}

export interface ProcessingResult {
  success: boolean;
  patterns_extracted: number;
  vocabulary_extracted: number;
  error?: string;
}

// ======================
// PATTERN DETECTION
// ======================

/**
 * Patrones de regex para detectar diferentes tipos de información
 * Específico para español y el contexto de negocios de servicios
 */
const PATTERN_DETECTORS: Record<string, RegExp[]> = {
  // Solicitudes de servicios
  service_request: [
    /(?:quiero|necesito|busco|me interesa|cotiza[rn]?|información sobre|precio de)\s+(?:una?\s+)?(.+?)(?:\?|\.|,|$)/gi,
    /(?:cuánto cuesta|cuál es el precio de|tienen)\s+(.+?)(?:\?|\.|,|$)/gi,
  ],

  // Preferencias de horarios
  scheduling_preference: [
    /(?:prefiero|me gustaría|puedo|mejor)\s+(?:en\s+)?(?:la\s+)?(mañana|tarde|noche)/gi,
    /(?:entre|de)\s+(\d{1,2})\s*(?:y|a)\s*(\d{1,2})/gi,
    /(?:después de|antes de|a las)\s+(\d{1,2}(?::\d{2})?)/gi,
    /(lunes|martes|miércoles|jueves|viernes|sábado|domingo)s?/gi,
    /(fin de semana|entre semana)/gi,
  ],

  // Puntos de dolor (symptoms for dental/medical)
  pain_point: [
    /(?:me duele|tengo dolor|molestia en|problema con|me lastimé?)\s+(.+?)(?:\?|\.|,|$)/gi,
    /(?:dolor|molestia|sensibilidad|inflamación)\s+(?:de|en)\s+(.+?)(?:\?|\.|,|$)/gi,
    /(?:desde hace|hace)\s+(\d+\s+(?:días?|semanas?|meses?))/gi,
  ],

  // Objeciones
  objection: [
    /(?:es muy|está muy|me parece)\s+(caro|costoso|elevado)/gi,
    /(?:no tengo|no cuento con)\s+(.+?)(?:\?|\.|,|$)/gi,
    /(?:tengo que|necesito)\s+(?:pensarlo|consultarlo|ver)/gi,
    /(?:otro lugar|otra clínica|la competencia)\s+(.+?)(?:\?|\.|,|$)/gi,
    /(?:no estoy seguro|no sé si|dudo)/gi,
  ],

  // Menciones de competencia
  competitor_mention: [
    /(?:en|de|con)\s+(\w+\s+(?:dental|clínica|consultorio))/gi,
    /(?:fui a|estuve en|me atendieron en)\s+(.+?)(?:\?|\.|,|pero|$)/gi,
  ],

  // Indicadores de urgencia
  urgency_indicator: [
    /(?:urgente|emergencia|lo antes posible|hoy mismo|ahora)/gi,
    /(?:muy|bastante|mucho)\s+dolor/gi,
    /(?:no puedo|no aguanto|insoportable)/gi,
  ],

  // Satisfacción
  satisfaction: [
    /(?:gracias|excelente|muy bien|perfecto|genial|me encanta)/gi,
    /(?:buen|excelente|muy buena?)\s+(?:servicio|atención|trato)/gi,
  ],

  // Quejas
  complaint: [
    /(?:mal servicio|mala atención|no me gustó|queja|reclamo)/gi,
    /(?:tardaron mucho|esperé|no me atendieron)/gi,
    /(?:decepcionado|molesto|frustrado)/gi,
  ],

  // Referidos
  referral: [
    /(?:me recomendó|me refirió|me dijeron de)\s+(.+?)(?:\?|\.|,|$)/gi,
    /(?:un amigo|mi amiga|familiar|conocido)\s+(?:me|les)/gi,
  ],
};

/**
 * Extrae patrones de un mensaje
 *
 * REVISIÓN 5.2 G-B2: Ahora sanitiza PII antes de procesar
 *
 * NOTA: El parámetro `vertical` está reservado para uso futuro
 * cuando se añadan patrones específicos por vertical.
 * Actualmente se usan los patrones generales para todos.
 */
export function extractPatterns(
  message: string,
  vertical: string = 'general'
): ExtractedPattern[] {
  // Validar entrada
  if (!message || typeof message !== 'string') {
    return [];
  }

  // REVISIÓN 5.2 G-B10: Limitar longitud ANTES de cualquier procesamiento
  const MAX_MESSAGE_LENGTH = 5000;
  const truncatedMessage = message.length > MAX_MESSAGE_LENGTH
    ? message.substring(0, MAX_MESSAGE_LENGTH)
    : message;

  // REVISIÓN 5.2 G-B2: Sanitizar PII antes de extraer patrones
  // El contexto guardado NO debe contener información personal
  const sanitizedMessage = sanitizePII(truncatedMessage);

  const patterns: ExtractedPattern[] = [];
  const messageLower = truncatedMessage.toLowerCase(); // Para matching usamos original
  const sanitizedLower = sanitizedMessage.toLowerCase(); // Para contexto usamos sanitizado
  const MAX_PATTERNS_PER_TYPE = 10; // Límite de patrones por tipo

  // Set para evitar duplicados (clave: type + value normalizado)
  const seenPatterns = new Set<string>();

  for (const [patternType, regexes] of Object.entries(PATTERN_DETECTORS)) {
    let patternsOfType = 0;

    for (const regex of regexes) {
      if (patternsOfType >= MAX_PATTERNS_PER_TYPE) break;

      // Crear nueva instancia para evitar problemas con lastIndex
      const re = new RegExp(regex.source, regex.flags);
      let match;
      let lastIndex = -1;
      let iterations = 0;
      const MAX_ITERATIONS = 100; // Protección contra loops infinitos

      while ((match = re.exec(messageLower)) !== null && iterations < MAX_ITERATIONS) {
        iterations++;

        // Protección contra loops infinitos (regex que no avanza)
        if (match.index === lastIndex) {
          re.lastIndex++;
          continue;
        }
        lastIndex = match.index;

        // El valor capturado es el primer grupo o el match completo
        // REVISIÓN 5.2 G-B2: Sanitizar el valor extraído también
        const rawValue = (match[1] || match[0]).trim();
        const value = sanitizePII(rawValue);

        // Clave de deduplicación: tipo + valor normalizado
        const dedupeKey = `${patternType}:${value.toLowerCase()}`;

        // Evitar valores muy cortos, muy largos, o duplicados
        if (value.length >= 3 && value.length <= 100 && !seenPatterns.has(dedupeKey)) {
          seenPatterns.add(dedupeKey);

          // REVISIÓN 5.2 G-B2: Contexto siempre sanitizado
          const contextStart = Math.max(0, match.index - 20);
          const contextEnd = Math.min(sanitizedMessage.length, match.index + match[0].length + 20);
          const sanitizedContext = sanitizedMessage.substring(contextStart, contextEnd);

          patterns.push({
            type: patternType,
            value: value,
            context: sanitizedContext,
          });
          patternsOfType++;
          if (patternsOfType >= MAX_PATTERNS_PER_TYPE) break;
        }
      }
    }
  }

  // Detectar sentimiento básico
  const sentiment = detectSentiment(truncatedMessage);
  if (sentiment !== 0) {
    patterns.forEach(p => {
      p.sentiment = sentiment;
    });
  }

  return patterns;
}

/**
 * Detección de sentimiento muy básica (-1 a 1)
 */
function detectSentiment(message: string): number {
  const positive = /gracias|excelente|perfecto|genial|muy bien|me encanta|feliz|contento/gi;
  const negative = /mal|peor|terrible|horrible|enojado|molesto|frustrado|queja|problema/gi;

  const positiveMatches = (message.match(positive) || []).length;
  const negativeMatches = (message.match(negative) || []).length;

  if (positiveMatches > negativeMatches) {
    return Math.min(1, positiveMatches * 0.3);
  } else if (negativeMatches > positiveMatches) {
    return Math.max(-1, -negativeMatches * 0.3);
  }

  return 0;
}

// ======================
// VOCABULARY EXTRACTION
// ======================

// REVISIÓN 5.3 G-B13: Configuración de validación de vocabulario (internal)
// La versión exportada está al final del archivo
const VOCABULARY_VALIDATION_INTERNAL = {
  max_term_length: 100,
  min_term_length: 2,
  forbidden_patterns: [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /\{\{/,
    /\$\{/,
    /data:/i,
    /vbscript:/i,
    /expression\s*\(/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<link/i,
    /<meta/i,
    /&#x?[0-9a-f]+;/i,
    /%3c/i,
    /%3e/i,
  ],
  allowed_chars: /^[\p{L}\p{N}\s.,;:!?¿¡'"()\-\/&@#%+*=]+$/u,
};

/**
 * REVISIÓN 5.3 G-B13: Versión interna de sanitización de vocabulario
 * Usada por extractVocabulary antes de que la versión exportada esté disponible
 */
function sanitizeVocabularyTermInternal(term: string): string | null {
  if (!term || typeof term !== 'string') return null;

  const trimmed = term.trim();

  if (trimmed.length < VOCABULARY_VALIDATION_INTERNAL.min_term_length) return null;
  if (trimmed.length > VOCABULARY_VALIDATION_INTERNAL.max_term_length) return null;

  // Check forbidden patterns
  for (const pattern of VOCABULARY_VALIDATION_INTERNAL.forbidden_patterns) {
    if (pattern.test(trimmed)) {
      console.warn(`[Learning] Vocabulary term rejected internally: ${pattern.source}`);
      return null;
    }
  }

  // Check allowed chars, try to sanitize if not
  if (!VOCABULARY_VALIDATION_INTERNAL.allowed_chars.test(trimmed)) {
    const sanitized = trimmed
      .replace(/[^\p{L}\p{N}\s.,;:!?¿¡'"()\-\/&@#%+*=]/gu, '')
      .trim();
    if (sanitized.length >= VOCABULARY_VALIDATION_INTERNAL.min_term_length) {
      return sanitized;
    }
    return null;
  }

  return trimmed;
}

/**
 * Categorías de vocabulario por vertical
 */
const VOCABULARY_CATEGORIES: Record<string, Record<string, RegExp[]>> = {
  // ======================
  // DENTAL VOCABULARY
  // ======================
  dental: {
    // Síntomas y condiciones
    symptom: [
      /(dolor de muelas?|sensibilidad|sangrado de encías?|mal aliento|bruxismo)/gi,
      /(caries|infección|absceso|flemón|gingivitis|periodontitis)/gi,
      /(hinchazón|inflamación|molestia|punzada|pulsación)/gi,
      /(diente flojo|diente roto|diente astillado|fractura dental)/gi,
    ],
    // Procedimientos y tratamientos
    procedure: [
      /(limpieza|blanqueamiento|extracción|endodoncia|ortodoncia|implante)/gi,
      /(corona|puente|carilla|resina|amalgama|empaste|obturación)/gi,
      /(radiografía|rayos x|panorámica|tomografía)/gi,
      /(profilaxis|curetaje|raspado|alisado radicular)/gi,
      /(prótesis|dentadura|placa|retenedor|guarda oclusal)/gi,
    ],
    // Términos técnicos/anatómicos
    technical: [
      /(molar|premolar|incisivo|canino|cordal|muela del juicio)/gi,
      /(encía|esmalte|dentina|pulpa|raíz|nervio)/gi,
      /(mandíbula|maxilar|paladar|lengua|mejilla)/gi,
      /(oclusión|mordida|articulación temporomandibular|atm)/gi,
    ],
    // Urgencias dentales
    urgency: [
      /(emergencia|urgencia|urgente|dolor severo|dolor intenso)/gi,
      /(no puedo dormir|insoportable|no aguanto|muy fuerte)/gi,
      /(golpe|trauma|accidente|caída|se cayó el diente)/gi,
    ],
  },

  // ======================
  // RESTAURANT VOCABULARY
  // ======================
  restaurant: {
    // Tipos de servicio
    service: [
      /(mesa|reservación|reserva|evento|catering|delivery|para llevar)/gi,
      /(pickup|recoger|a domicilio|envío|servicio a mesa)/gi,
      /(privado|terraza|salón|barra|jardín|interior|exterior)/gi,
    ],
    // Tiempos de comida
    meal_time: [
      /(desayuno|comida|almuerzo|cena|brunch|merienda)/gi,
      /(happy hour|hora feliz|after office|madrugada)/gi,
    ],
    // Tipos de platillos/categorías
    // NOTA: vegetariano/vegano están en "preference" - aquí solo categorías de ingredientes principales
    food_category: [
      /(entrada|plato fuerte|postre|guarnición|aperitivo|botana)/gi,
      /(ensalada|sopa|crema|pasta|pizza|hamburguesa|taco)/gi,
      /(mariscos|carnes|pollo|pescado|res|cerdo|cordero)/gi,
      /(bebida|refresco|cerveza|vino|coctel|café|té)/gi,
    ],
    // Preferencias y restricciones
    preference: [
      /(sin gluten|gluten free|vegetariano|vegano|kosher|halal)/gi,
      /(alergia|alérgico|intolerancia|sin lácteos|sin nueces)/gi,
      /(picante|sin picante|término medio|bien cocido|crudo)/gi,
      // Modificadores de platillos (con contexto para evitar falsos positivos)
      /(?:quiero|pido|con|sin)\s+(extra|poco|mucho|doble|mitad)\s+\w+/gi,
    ],
    // Ocasiones especiales
    occasion: [
      /(cumpleaños|aniversario|graduación|boda|despedida)/gi,
      /(reunión|junta|celebración|fiesta|evento especial)/gi,
      /(cita romántica|primera cita|propuesta|compromiso)/gi,
    ],
    // Facturación (específico México)
    billing: [
      /(factura|facturar|cfdi|rfc|razón social|régimen fiscal)/gi,
      /(ticket|cuenta|nota|recibo|comprobante)/gi,
      /(propina|servicio incluido|iva|impuesto)/gi,
    ],
    // Quejas comunes en restaurantes
    // NOTA: Evitar palabras ambiguas como "crudo" (puede ser preferencia) o "frío" (puede ser pedido)
    complaint: [
      /(tardaron|esperé mucho|lento|demasiado tiempo|nunca llegó)/gi,
      /(estaba frío|llegó frío|mal sabor|feo sabor|podrido|echado a perder)/gi,
      /(sucio|mosca|cabello|pelo|mal servicio|grosero|maleducado)/gi,
      /(equivocaron|no era lo que pedí|incorrecto|faltó|cobro de más|me cobraron mal)/gi,
    ],
    // Elogios comunes
    compliment: [
      /(delicioso|exquisito|excelente|rico|sabroso|increíble)/gi,
      /(buena atención|buen servicio|rápido|amable|recomiendo)/gi,
      /(volveré|volvería|favorito|el mejor|cinco estrellas)/gi,
    ],
  },

  // ======================
  // GENERAL VOCABULARY (aplica a todos)
  // ======================
  general: {
    time: [
      /(cita|consulta|valoración|sesión|turno|appointment)/gi,
    ],
    contact: [
      /(teléfono|celular|whatsapp|correo|email|dirección)/gi,
    ],
    payment: [
      /(precio|costo|pago|tarjeta|efectivo|transferencia)/gi,
      /(promoción|descuento|oferta|paquete|mensualidad)/gi,
    ],
  },
};

/**
 * Extrae vocabulario específico del negocio
 */
export function extractVocabulary(
  message: string,
  vertical: string = 'general'
): ExtractedVocabulary[] {
  // Validar entrada
  if (!message || typeof message !== 'string') {
    return [];
  }

  // Limitar longitud del mensaje
  const MAX_MESSAGE_LENGTH = 5000;
  const truncatedMessage = message.length > MAX_MESSAGE_LENGTH
    ? message.substring(0, MAX_MESSAGE_LENGTH)
    : message;

  const vocabulary: ExtractedVocabulary[] = [];
  const messageLower = truncatedMessage.toLowerCase();
  const MAX_VOCABULARY = 50; // Límite de términos

  // Obtener patrones del vertical específico + general
  const verticalPatterns = VOCABULARY_CATEGORIES[vertical] || {};
  const generalPatterns = VOCABULARY_CATEGORIES.general || {};
  const allPatterns = { ...generalPatterns, ...verticalPatterns };

  for (const [category, regexes] of Object.entries(allPatterns)) {
    if (vocabulary.length >= MAX_VOCABULARY) break;

    for (const regex of regexes) {
      if (vocabulary.length >= MAX_VOCABULARY) break;

      const re = new RegExp(regex.source, regex.flags);
      let match;
      let lastIndex = -1;
      let iterations = 0;
      const MAX_ITERATIONS = 100;

      while ((match = re.exec(messageLower)) !== null && iterations < MAX_ITERATIONS) {
        iterations++;

        // Protección contra loops infinitos
        if (match.index === lastIndex) {
          re.lastIndex++;
          continue;
        }
        lastIndex = match.index;

        const rawTerm = (match[1] || match[0]).trim();

        // REVISIÓN 5.3 G-B13: Validar y sanitizar término
        const sanitizedTerm = sanitizeVocabularyTermInternal(rawTerm);

        // Evitar duplicados y términos inválidos
        if (sanitizedTerm && !vocabulary.some(v => v.term === sanitizedTerm)) {
          vocabulary.push({
            term: sanitizedTerm,
            category,
          });
          if (vocabulary.length >= MAX_VOCABULARY) break;
        }
      }
    }
  }

  return vocabulary;
}

// ======================
// HIGH PRIORITY PATTERNS (Tiempo Real)
// ======================

/**
 * Patrones de alta prioridad que se procesan INMEDIATAMENTE
 * No esperan al CRON job porque requieren acción rápida
 *
 * IMPORTANTE: Esto NO consume tokens de LLM - solo usa regex
 */
const HIGH_PRIORITY_PATTERN_TYPES = [
  'urgency_indicator',  // Urgencias (dental, médico)
  'objection',          // Objeciones de precio/competencia
  'complaint',          // Quejas (requieren atención inmediata)
  'satisfaction',       // Satisfacción (feedback positivo)
  'pain_point',         // Puntos de dolor (síntomas)
] as const;

type HighPriorityPatternType = typeof HIGH_PRIORITY_PATTERN_TYPES[number];

// ======================
// REVISIÓN 5.3 G-B12: PATTERN RATE LIMITING (INTERNAL)
// ======================

const PATTERN_RATE_LIMITS_INTERNAL = {
  max_patterns_per_lead_per_hour: 50,
  max_same_pattern_per_lead_per_hour: 5,
  cooldown_after_limit_ms: 60000,
  cache_ttl_ms: 3600000,
};

interface PatternRateLimitStateInternal {
  totalCount: number;
  patternCounts: Map<string, number>;
  lastReset: number;
  inCooldown: boolean;
  cooldownEnds?: number;
}

const patternRateLimitCacheInternal = new Map<string, PatternRateLimitStateInternal>();

/**
 * REVISIÓN 5.3 G-B12: Versión interna de rate limiting
 */
function checkPatternRateLimitInternal(
  tenantId: string,
  identifier: string,
  patternType: string,
  patternValue: string
): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const key = `${tenantId}:${identifier}`;
  const patternKey = `${patternType}:${patternValue.toLowerCase().trim()}`;

  let state = patternRateLimitCacheInternal.get(key);

  // Reset si pasó 1 hora
  if (!state || now - state.lastReset > PATTERN_RATE_LIMITS_INTERNAL.cache_ttl_ms) {
    state = {
      totalCount: 0,
      patternCounts: new Map(),
      lastReset: now,
      inCooldown: false,
    };
  }

  // Check cooldown activo
  if (state.inCooldown && state.cooldownEnds && now < state.cooldownEnds) {
    return { allowed: false, reason: 'In cooldown' };
  } else if (state.inCooldown) {
    state.inCooldown = false;
    state.cooldownEnds = undefined;
  }

  // Check límite total
  if (state.totalCount >= PATTERN_RATE_LIMITS_INTERNAL.max_patterns_per_lead_per_hour) {
    state.inCooldown = true;
    state.cooldownEnds = now + PATTERN_RATE_LIMITS_INTERNAL.cooldown_after_limit_ms;
    patternRateLimitCacheInternal.set(key, state);
    return { allowed: false, reason: 'Total pattern limit reached' };
  }

  // Check límite del mismo patrón
  const patternCount = state.patternCounts.get(patternKey) || 0;
  if (patternCount >= PATTERN_RATE_LIMITS_INTERNAL.max_same_pattern_per_lead_per_hour) {
    return { allowed: false, reason: 'Same pattern limit' };
  }

  // Actualizar contadores
  state.totalCount++;
  state.patternCounts.set(patternKey, patternCount + 1);
  patternRateLimitCacheInternal.set(key, state);

  return { allowed: true };
}

export interface RealTimeProcessingResult {
  processed: boolean;
  high_priority_patterns: ExtractedPattern[];
  requires_immediate_action: boolean;
  action_type?: 'urgent_booking' | 'escalation' | 'retention' | 'feedback';
  processing_time_ms: number;
}

/**
 * Procesa patrones de ALTA PRIORIDAD en tiempo real
 *
 * Esta función se llama SÍNCRONAMENTE después de cada mensaje
 * para detectar patrones que requieren acción inmediata.
 *
 * NO consume tokens de LLM - solo usa regex.
 * NO reemplaza el CRON - solo procesa patrones críticos inmediatamente.
 *
 * Casos de uso:
 * - Dental: Detectar urgencia para priorizar booking
 * - Restaurant: Detectar queja para escalación inmediata
 * - Todos: Detectar objeciones de precio para retención
 */
export async function processHighPriorityPatterns(
  tenantId: string,
  messageContent: string,
  vertical: string = 'general',
  options?: {
    conversationId?: string;
    leadId?: string;
    channel?: string;
  }
): Promise<RealTimeProcessingResult> {
  const startTime = Date.now();

  // 1. Extraer TODOS los patrones (rápido, solo regex)
  const allPatterns = extractPatterns(messageContent, vertical);

  // 2. Filtrar solo los de alta prioridad
  const highPriorityPatterns = allPatterns.filter(
    p => (HIGH_PRIORITY_PATTERN_TYPES as readonly string[]).includes(p.type)
  );

  // Si no hay patrones de alta prioridad, retornar rápido
  if (highPriorityPatterns.length === 0) {
    return {
      processed: true,
      high_priority_patterns: [],
      requires_immediate_action: false,
      processing_time_ms: Date.now() - startTime,
    };
  }

  // 3. Determinar si requiere acción inmediata y qué tipo
  let requiresImmediateAction = false;
  let actionType: RealTimeProcessingResult['action_type'];

  // Prioridad de acciones (de mayor a menor urgencia)
  const hasUrgency = highPriorityPatterns.some(p => p.type === 'urgency_indicator');
  const hasPainPoint = highPriorityPatterns.some(p => p.type === 'pain_point');
  const hasComplaint = highPriorityPatterns.some(p => p.type === 'complaint');
  const hasObjection = highPriorityPatterns.some(p => p.type === 'objection');
  const hasSatisfaction = highPriorityPatterns.some(p => p.type === 'satisfaction');

  // Determinar acción basada en patrones detectados
  if (hasUrgency || (hasPainPoint && vertical === 'dental')) {
    requiresImmediateAction = true;
    actionType = 'urgent_booking';
  } else if (hasComplaint) {
    requiresImmediateAction = true;
    actionType = 'escalation';
  } else if (hasObjection) {
    requiresImmediateAction = true;
    actionType = 'retention';
  } else if (hasSatisfaction) {
    // Satisfacción no requiere acción urgente pero sí se registra
    requiresImmediateAction = false;
    actionType = 'feedback';
  }

  // 4. Guardar patrones de alta prioridad INMEDIATAMENTE en BD
  // Esto permite que el equipo vea alertas en tiempo real
  const supabase = createServerClient();

  // REVISIÓN 5.3 G-B12: Identificador para rate limiting
  const rateLimitIdentifier = options?.leadId || options?.conversationId || 'anonymous';

  try {
    // REVISIÓN 5.3 G-B12: Filtrar patrones que pasan el rate limit
    const allowedPatterns = highPriorityPatterns.filter(pattern => {
      const rateCheck = checkPatternRateLimitInternal(
        tenantId,
        rateLimitIdentifier,
        pattern.type,
        pattern.value
      );
      if (!rateCheck.allowed) {
        console.log(`[Learning] Pattern rate limited: ${pattern.type}:${pattern.value} - ${rateCheck.reason}`);
      }
      return rateCheck.allowed;
    });

    // Si no hay patrones permitidos después del rate limiting, salir
    if (allowedPatterns.length === 0) {
      return {
        processed: true,
        high_priority_patterns: highPriorityPatterns, // Retornar los originales para que el caller sepa qué se detectó
        requires_immediate_action: false, // Pero no generar acción
        processing_time_ms: Date.now() - startTime,
      };
    }

    // Ejecutar todas las inserciones en paralelo para mejor rendimiento
    // En lugar de N queries secuenciales, hacemos N queries paralelas
    const patternPromises = allowedPatterns.map(pattern =>
      supabase.rpc('upsert_message_pattern', {
        p_tenant_id: tenantId,
        p_pattern_type: pattern.type,
        p_pattern_value: pattern.value,
        p_context_example: pattern.context,
        p_sentiment: pattern.sentiment,
        p_metadata: {
          ...(pattern.metadata || {}),
          processed_realtime: true,
          conversation_id: options?.conversationId,
          lead_id: options?.leadId,
          channel: options?.channel,
          requires_action: requiresImmediateAction,
          action_type: actionType,
        },
      })
    );

    // Esperar todas las promesas, pero no fallar si alguna falla
    await Promise.allSettled(patternPromises);

    // 5. Si requiere acción, crear alerta para el equipo
    if (requiresImmediateAction && options?.leadId) {
      await createHighPriorityAlert(supabase, {
        tenantId,
        leadId: options.leadId,
        conversationId: options.conversationId,
        actionType: actionType!,
        patterns: highPriorityPatterns,
        channel: options.channel,
      });
    }
  } catch (error) {
    // Log pero no fallar - el procesamiento de patrones no debe bloquear el flujo
    console.warn('[Learning Service] Error saving high priority patterns:', error);
  }

  return {
    processed: true,
    high_priority_patterns: highPriorityPatterns,
    requires_immediate_action: requiresImmediateAction,
    action_type: actionType,
    processing_time_ms: Date.now() - startTime,
  };
}

// ======================
// REVISIÓN 5.3 G-B17: ALERT THROTTLING (INTERNAL)
// ======================

const ALERT_THROTTLE_CONFIG_INTERNAL = {
  max_alerts_per_type_per_hour: 10,
  max_alerts_per_tenant_per_hour: 50,
  dedup_window_minutes: 15,
  cache_ttl_ms: 3600000,
};

interface AlertThrottleStateInternal {
  type: string;
  count: number;
  lastReset: number;
  recentPatterns: string[];
}

const alertThrottleCacheInternal = new Map<string, AlertThrottleStateInternal>();
const tenantAlertCountInternal = new Map<string, { count: number; lastReset: number }>();

/**
 * REVISIÓN 5.3 G-B17: Versión interna de throttling
 */
function shouldSendAlertInternal(
  tenantId: string,
  actionType: string,
  patternValue: string
): { send: boolean; reason?: string } {
  const now = Date.now();
  const typeKey = `${tenantId}:${actionType}`;
  const totalKey = `${tenantId}:total`;

  // Check límite total por tenant
  let tenantTotal = tenantAlertCountInternal.get(totalKey);
  if (!tenantTotal || now - tenantTotal.lastReset > ALERT_THROTTLE_CONFIG_INTERNAL.cache_ttl_ms) {
    tenantTotal = { count: 0, lastReset: now };
  }

  if (tenantTotal.count >= ALERT_THROTTLE_CONFIG_INTERNAL.max_alerts_per_tenant_per_hour) {
    return { send: false, reason: `Tenant alert limit (${ALERT_THROTTLE_CONFIG_INTERNAL.max_alerts_per_tenant_per_hour}/hr)` };
  }

  // Check límite por tipo
  let typeState = alertThrottleCacheInternal.get(typeKey);
  if (!typeState || now - typeState.lastReset > ALERT_THROTTLE_CONFIG_INTERNAL.cache_ttl_ms) {
    typeState = { type: actionType, count: 0, lastReset: now, recentPatterns: [] };
  }

  if (typeState.count >= ALERT_THROTTLE_CONFIG_INTERNAL.max_alerts_per_type_per_hour) {
    return { send: false, reason: `Type limit for ${actionType} (${ALERT_THROTTLE_CONFIG_INTERNAL.max_alerts_per_type_per_hour}/hr)` };
  }

  // Check deduplicación
  const normalizedPattern = patternValue.toLowerCase().trim();
  if (typeState.recentPatterns.includes(normalizedPattern)) {
    return { send: false, reason: 'Duplicate pattern' };
  }

  // Actualizar contadores
  typeState.count++;
  typeState.recentPatterns.push(normalizedPattern);
  if (typeState.recentPatterns.length > 20) typeState.recentPatterns.shift();
  alertThrottleCacheInternal.set(typeKey, typeState);

  tenantTotal.count++;
  tenantAlertCountInternal.set(totalKey, tenantTotal);

  return { send: true };
}

/**
 * Crea una alerta de alta prioridad para el equipo
 * Se muestra en el dashboard usando el sistema de notificaciones existente
 *
 * REVISIÓN 5.3 G-B17: Ahora implementa throttling para evitar alert fatigue
 */
async function createHighPriorityAlert(
  supabase: ReturnType<typeof createServerClient>,
  params: {
    tenantId: string;
    leadId: string;
    conversationId?: string;
    actionType: NonNullable<RealTimeProcessingResult['action_type']>;
    patterns: ExtractedPattern[];
    channel?: string;
  }
): Promise<void> {
  const { tenantId, leadId, conversationId, actionType, patterns, channel } = params;

  // REVISIÓN 5.3 G-B17: Check throttling antes de crear alerta
  const primaryPattern = patterns[0]?.value || '';
  const throttleCheck = shouldSendAlertInternal(tenantId, actionType, primaryPattern);

  if (!throttleCheck.send) {
    console.log(`[Learning] Alert throttled for ${tenantId}:${actionType} - ${throttleCheck.reason}`);
    return; // No enviar alerta
  }

  // Mapear tipo de acción a configuración de notificación
  // Usamos tipos compatibles con el sistema de notificaciones existente
  const alertConfig: Record<string, {
    type: 'lead_hot' | 'conversation_escalated' | 'system_alert';
    priority: 'urgent' | 'high' | 'normal';
    title: string;
    actionLabel: string;
  }> = {
    urgent_booking: {
      type: 'lead_hot',
      priority: 'urgent',
      title: '🚨 Solicitud de cita URGENTE',
      actionLabel: 'Ver Lead',
    },
    escalation: {
      type: 'conversation_escalated',
      priority: 'high',
      title: '⚠️ Queja detectada - Requiere atención',
      actionLabel: 'Ver Conversación',
    },
    retention: {
      type: 'system_alert',
      priority: 'high',
      title: '💰 Objeción de precio detectada',
      actionLabel: 'Ver Lead',
    },
    feedback: {
      type: 'system_alert',
      priority: 'normal',
      title: '⭐ Feedback positivo recibido',
      actionLabel: 'Ver Lead',
    },
  };

  const config = alertConfig[actionType];
  if (!config) return;

  // Construir descripción con los patrones detectados
  const patternsSummary = patterns
    .map(p => `${p.type}: "${p.value}"`)
    .slice(0, 3) // Limitar a 3 patrones para no saturar el mensaje
    .join(', ');

  try {
    // Obtener user_ids del staff del tenant (owner, admin, manager)
    const { data: staffUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .in('role', ['owner', 'admin', 'manager']);

    if (!staffUsers || staffUsers.length === 0) {
      console.log('[Learning Service] No staff users found for tenant, skipping alert');
      return;
    }

    const userIds = staffUsers.map(u => u.user_id);

    // REVISIÓN 5.2 G-B6: Intentar RPC primero, fallback a insert directo
    const notificationData = {
      lead_id: leadId,
      conversation_id: conversationId,
      patterns: patterns.map(p => ({ type: p.type, value: p.value })),
      channel: channel,
      detected_at: new Date().toISOString(),
      source: 'ai_learning_realtime',
    };

    // Intentar usar broadcast_notification RPC
    const { error: rpcError } = await supabase.rpc('broadcast_notification', {
      p_tenant_id: tenantId,
      p_user_ids: userIds,
      p_type: config.type,
      p_title: config.title,
      p_message: `Patrones detectados: ${patternsSummary}`,
      p_priority: config.priority,
      p_related_entity_type: 'lead',
      p_related_entity_id: leadId,
      p_action_url: conversationId
        ? `/dashboard/conversations/${conversationId}`
        : `/dashboard/leads/${leadId}`,
      p_action_label: config.actionLabel,
      p_metadata: notificationData,
    });

    // REVISIÓN 5.2 G-B6: Si RPC falla, usar insert directo como fallback
    if (rpcError) {
      console.warn('[Learning Service] broadcast_notification RPC failed, using direct insert fallback:', rpcError.message);

      // Fallback: Insertar notificaciones directamente
      const notifications = userIds.map(userId => ({
        tenant_id: tenantId,
        user_id: userId,
        type: config.type,
        title: config.title,
        message: `Patrones detectados: ${patternsSummary}`,
        priority: config.priority,
        related_entity_type: 'lead',
        related_entity_id: leadId,
        action_url: conversationId
          ? `/dashboard/conversations/${conversationId}`
          : `/dashboard/leads/${leadId}`,
        action_label: config.actionLabel,
        metadata: notificationData,
        read: false,
        created_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('[Learning Service] Direct notification insert also failed:', insertError.message);
      } else {
        console.log(`[Learning Service] Fallback: Created ${notifications.length} notifications via direct insert`);
      }
    }
  } catch (error) {
    // No fallar silenciosamente - loguear el error pero no bloquear el flujo
    console.warn('[Learning Service] Error creating high priority alert:', error);
  }
}

/**
 * Verifica rápidamente si un mensaje tiene patrones de alta prioridad
 * Sin guardar en BD - solo detección rápida
 */
export function hasHighPriorityPatterns(
  messageContent: string,
  vertical: string = 'general'
): { hasHighPriority: boolean; types: string[] } {
  const patterns = extractPatterns(messageContent, vertical);
  const highPriorityTypes = patterns
    .filter(p => (HIGH_PRIORITY_PATTERN_TYPES as readonly string[]).includes(p.type))
    .map(p => p.type);

  return {
    hasHighPriority: highPriorityTypes.length > 0,
    types: [...new Set(highPriorityTypes)], // Únicos
  };
}

// ======================
// MAIN SERVICE
// ======================

/**
 * Verifica si el aprendizaje está habilitado para un tenant
 */
export async function isLearningEnabled(tenantId: string): Promise<boolean> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('ai_learning_config')
    .select('learning_enabled')
    .eq('tenant_id', tenantId)
    .single();

  return data?.learning_enabled ?? false;
}

/**
 * Obtiene la configuración de aprendizaje de un tenant
 */
export async function getLearningConfig(tenantId: string): Promise<LearningConfig | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('ai_learning_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as LearningConfig;
}

/**
 * Encola un mensaje para procesamiento de aprendizaje
 */
export async function queueMessageForLearning(
  tenantId: string,
  conversationId: string,
  messageId: string,
  messageContent: string,
  messageRole: 'lead' | 'assistant',
  options?: {
    channel?: string;
    leadId?: string;
    detectedIntent?: string;
    detectedSignals?: Record<string, unknown>;
    aiResponse?: string;
  }
): Promise<boolean> {
  const supabase = createServerClient();

  const { error } = await supabase.rpc('queue_message_for_learning', {
    p_tenant_id: tenantId,
    p_conversation_id: conversationId,
    p_message_id: messageId,
    p_message_content: messageContent,
    p_message_role: messageRole,
    p_channel: options?.channel || 'whatsapp',
    // Asegurar que valores vacíos se conviertan a null para tipos UUID
    p_lead_id: options?.leadId && options.leadId.trim() !== '' ? options.leadId : null,
    p_detected_intent: options?.detectedIntent || null,
    p_detected_signals: options?.detectedSignals || null,
    p_ai_response: options?.aiResponse || null,
  });

  if (error) {
    console.error('[Learning Service] Error queuing message:', error);
    return false;
  }

  return true;
}

/**
 * Procesa un mensaje de la cola de aprendizaje
 */
export async function processLearningMessage(
  queueItemId: string
): Promise<ProcessingResult> {
  const supabase = createServerClient();

  try {
    // 1. Obtener el item de la cola
    const { data: queueItem, error: fetchError } = await supabase
      .from('ai_learning_queue')
      .select('*')
      .eq('id', queueItemId)
      .single();

    if (fetchError || !queueItem) {
      return { success: false, patterns_extracted: 0, vocabulary_extracted: 0, error: 'Queue item not found' };
    }

    // 2. Marcar como procesando
    await supabase
      .from('ai_learning_queue')
      .update({ status: 'processing', processing_started_at: new Date().toISOString() })
      .eq('id', queueItemId);

    // 3. Obtener configuración del tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('vertical')
      .eq('id', queueItem.tenant_id)
      .single();

    const vertical = tenant?.vertical || 'general';

    // 4. Extraer patrones del mensaje
    const patterns = extractPatterns(queueItem.message_content, vertical);

    // 5. Extraer vocabulario
    const vocabulary = extractVocabulary(queueItem.message_content, vertical);

    // 6. Guardar patrones en la base de datos
    for (const pattern of patterns) {
      await supabase.rpc('upsert_message_pattern', {
        p_tenant_id: queueItem.tenant_id,
        p_pattern_type: pattern.type,
        p_pattern_value: pattern.value,
        p_context_example: pattern.context,
        p_sentiment: pattern.sentiment,
        p_metadata: pattern.metadata || {},
      });
    }

    // 7. Guardar vocabulario con upsert que incrementa contador
    for (const vocab of vocabulary) {
      const normalizedTerm = vocab.term.toLowerCase().trim();

      // Primero verificar si ya existe
      const { data: existing } = await supabase
        .from('ai_learned_vocabulary')
        .select('id, usage_count')
        .eq('tenant_id', queueItem.tenant_id)
        .eq('normalized_term', normalizedTerm)
        .single();

      if (existing) {
        // Actualizar contador y timestamp
        await supabase
          .from('ai_learned_vocabulary')
          .update({
            usage_count: (existing.usage_count || 1) + 1,
            last_used: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Insertar nuevo
        await supabase
          .from('ai_learned_vocabulary')
          .insert({
            tenant_id: queueItem.tenant_id,
            term: vocab.term,
            normalized_term: normalizedTerm,
            meaning: vocab.meaning,
            category: vocab.category,
            synonyms: vocab.synonyms,
            usage_count: 1,
            last_used: new Date().toISOString(),
          });
      }
    }

    // 8. Marcar como completado
    await supabase
      .from('ai_learning_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        patterns_extracted: patterns,
        vocabulary_extracted: vocabulary,
      })
      .eq('id', queueItemId);

    return {
      success: true,
      patterns_extracted: patterns.length,
      vocabulary_extracted: vocabulary.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Learning Service] Error processing queue item ${queueItemId}:`, errorMessage);

    // Intentar marcar como fallido (con try-catch para evitar error silencioso)
    try {
      await supabase
        .from('ai_learning_queue')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', queueItemId);
    } catch (updateError) {
      console.error('[Learning Service] Error updating failed status:', updateError);
    }

    return {
      success: false,
      patterns_extracted: 0,
      vocabulary_extracted: 0,
      error: errorMessage,
    };
  }
}

/**
 * Procesa todos los mensajes pendientes en la cola
 *
 * REVISIÓN 5.3 G-B15: Implementa fairness por tenant usando round-robin
 * Evita que tenants de alto volumen acaparen el procesamiento
 */
export async function processLearningQueue(limit: number = 100): Promise<{
  processed: number;
  successful: number;
  failed: number;
  tenants_processed?: number;
}> {
  const supabase = createServerClient();

  // REVISIÓN 5.3 G-B15: Obtener tenants únicos con items pendientes
  const { data: tenantsWithPending, error: tenantError } = await supabase
    .from('ai_learning_queue')
    .select('tenant_id')
    .eq('status', 'pending')
    .limit(1000); // Limitar para no sobrecargar

  if (tenantError) {
    console.error('[Learning Queue] Error fetching tenants:', tenantError);
    return { processed: 0, successful: 0, failed: 0 };
  }

  if (!tenantsWithPending || tenantsWithPending.length === 0) {
    return { processed: 0, successful: 0, failed: 0 };
  }

  // Obtener lista única de tenants
  const uniqueTenantIds = [...new Set(tenantsWithPending.map(t => t.tenant_id))];
  const numTenants = uniqueTenantIds.length;

  // Calcular cuántos items procesar por tenant (round-robin)
  // Mínimo 1, máximo según el límite total dividido por número de tenants
  const itemsPerTenant = Math.max(1, Math.floor(limit / numTenants));
  const remainingItems = limit - (itemsPerTenant * numTenants);

  console.log(`[Learning Queue] G-B15 Fairness: ${numTenants} tenants, ${itemsPerTenant} items/tenant`);

  let totalProcessed = 0;
  let successful = 0;
  let failed = 0;
  let tenantsProcessed = 0;

  // REVISIÓN 5.3 G-B15: Procesar round-robin por tenant
  for (let i = 0; i < uniqueTenantIds.length && totalProcessed < limit; i++) {
    const tenantId = uniqueTenantIds[i];

    // Dar items extra al primer tenant si hay remainder
    const currentLimit = itemsPerTenant + (i < remainingItems ? 1 : 0);

    if (currentLimit <= 0) continue;

    // Obtener items de este tenant
    const { data: tenantItems } = await supabase
      .from('ai_learning_queue')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(currentLimit);

    if (!tenantItems || tenantItems.length === 0) continue;

    tenantsProcessed++;

    // Procesar items de este tenant
    for (const item of tenantItems) {
      if (totalProcessed >= limit) break;

      const result = await processLearningMessage(item.id);
      totalProcessed++;

      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }
  }

  console.log(`[Learning Queue] G-B15: Processed ${totalProcessed} items from ${tenantsProcessed} tenants`);

  return {
    processed: totalProcessed,
    successful,
    failed,
    tenants_processed: tenantsProcessed,
  };
}

/**
 * Obtiene el contexto de aprendizaje para enriquecer prompts
 */
export async function getLearningContext(tenantId: string): Promise<{
  topServiceRequests: Array<{ service: string; frequency: number }>;
  commonObjections: Array<{ objection: string; frequency: number }>;
  schedulingPreferences: Array<{ preference: string; frequency: number }>;
  painPoints: Array<{ pain: string; frequency: number }>;
  learnedVocabulary: Array<{ term: string; meaning: string; category: string }>;
} | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('get_tenant_learning_context', {
    p_tenant_id: tenantId,
  });

  if (error || !data) {
    console.error('[Learning Service] Error getting learning context:', error);
    return null;
  }

  return {
    topServiceRequests: data.top_service_requests || [],
    commonObjections: data.common_objections || [],
    schedulingPreferences: data.scheduling_preferences || [],
    painPoints: data.pain_points || [],
    learnedVocabulary: data.learned_vocabulary || [],
  };
}

/**
 * Habilita el aprendizaje para un tenant (requiere plan Essentials+)
 */
export async function enableLearning(
  tenantId: string,
  config?: Partial<LearningConfig>
): Promise<boolean> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('ai_learning_config')
    .upsert({
      tenant_id: tenantId,
      learning_enabled: true,
      learn_vocabulary: config?.learn_vocabulary ?? true,
      learn_patterns: config?.learn_patterns ?? true,
      learn_scheduling_preferences: config?.learn_scheduling_preferences ?? true,
      learn_objections: config?.learn_objections ?? true,
      learn_competitors: config?.learn_competitors ?? true,
      min_occurrences_for_pattern: config?.min_occurrences_for_pattern ?? 3,
      confidence_threshold: config?.confidence_threshold ?? 0.7,
      anonymize_data: config?.anonymize_data ?? true,
    }, {
      onConflict: 'tenant_id',
    });

  if (error) {
    console.error('[Learning Service] Error enabling learning:', error);
    return false;
  }

  return true;
}

/**
 * Deshabilita el aprendizaje para un tenant
 */
export async function disableLearning(tenantId: string): Promise<boolean> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('ai_learning_config')
    .update({ learning_enabled: false })
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[Learning Service] Error disabling learning:', error);
    return false;
  }

  return true;
}

// ======================
// EXPORTS
// ======================

export const MessageLearningService = {
  // Config
  isLearningEnabled,
  getLearningConfig,
  enableLearning,
  disableLearning,

  // Processing
  queueMessageForLearning,
  processLearningMessage,
  processLearningQueue,

  // Real-time High Priority Processing (NO consume tokens LLM)
  processHighPriorityPatterns,
  hasHighPriorityPatterns,

  // Extraction
  extractPatterns,
  extractVocabulary,

  // Context
  getLearningContext,
};

// Re-export types for convenience
export type {
  HighPriorityPatternType,
};

// ======================
// REVISIÓN 5.3 G-B13: VOCABULARY VALIDATION
// ======================

/**
 * Configuración de validación de vocabulario
 * Previene XSS y otros ataques de inyección
 */
const VOCABULARY_VALIDATION = {
  max_term_length: 100,
  min_term_length: 2,
  forbidden_patterns: [
    /<script/i,           // Script tags
    /javascript:/i,        // JavaScript protocol
    /on\w+\s*=/i,         // Event handlers (onclick, onerror, etc.)
    /\{\{/,               // Template injection
    /\$\{/,               // Template literals
    /data:/i,             // Data URLs
    /vbscript:/i,         // VBScript protocol
    /expression\s*\(/i,   // CSS expression
    /<iframe/i,           // Iframe injection
    /<object/i,           // Object tag
    /<embed/i,            // Embed tag
    /<link/i,             // Link tag injection
    /<meta/i,             // Meta tag injection
    /&#x?[0-9a-f]+;/i,    // HTML entities (encoded attacks)
    /%3c/i,               // URL encoded <
    /%3e/i,               // URL encoded >
  ],
  // Caracteres permitidos: letras (incluyendo acentuadas), números, espacios, puntuación básica
  allowed_chars: /^[\p{L}\p{N}\s.,;:!?¿¡'"()\-\/&@#%+*=]+$/u,
};

/**
 * REVISIÓN 5.3 G-B13: Valida un término de vocabulario
 * Previene XSS, inyección de scripts y caracteres maliciosos
 *
 * @param term - Término a validar
 * @returns Objeto con validez y razón de rechazo si aplica
 */
export function validateVocabularyTerm(term: string): { valid: boolean; reason?: string; sanitized?: string } {
  // Verificar que existe
  if (!term || typeof term !== 'string') {
    return { valid: false, reason: 'Term is empty or not a string' };
  }

  const trimmedTerm = term.trim();

  // Verificar longitud mínima
  if (trimmedTerm.length < VOCABULARY_VALIDATION.min_term_length) {
    return { valid: false, reason: 'Term too short' };
  }

  // Verificar longitud máxima
  if (trimmedTerm.length > VOCABULARY_VALIDATION.max_term_length) {
    return { valid: false, reason: 'Term too long' };
  }

  // Verificar patrones prohibidos (XSS, inyección)
  for (const pattern of VOCABULARY_VALIDATION.forbidden_patterns) {
    if (pattern.test(trimmedTerm)) {
      console.warn(`[Learning] Vocabulary term rejected - forbidden pattern: ${pattern.source}`);
      return { valid: false, reason: 'Forbidden pattern detected' };
    }
  }

  // Verificar caracteres permitidos
  if (!VOCABULARY_VALIDATION.allowed_chars.test(trimmedTerm)) {
    // Intentar sanitizar removiendo caracteres no permitidos
    const sanitized = trimmedTerm
      .replace(/[^\p{L}\p{N}\s.,;:!?¿¡'"()\-\/&@#%+*=]/gu, '')
      .trim();

    if (sanitized.length >= VOCABULARY_VALIDATION.min_term_length) {
      return { valid: true, sanitized };
    }
    return { valid: false, reason: 'Invalid characters that cannot be sanitized' };
  }

  return { valid: true, sanitized: trimmedTerm };
}

/**
 * Sanitiza un término de vocabulario, removiendo contenido potencialmente peligroso
 * Si el término no puede ser sanitizado, retorna null
 */
export function sanitizeVocabularyTerm(term: string): string | null {
  const validation = validateVocabularyTerm(term);

  if (!validation.valid && !validation.sanitized) {
    return null;
  }

  return validation.sanitized || term.trim();
}

// ======================
// REVISIÓN 5.3 G-B17: ALERT THROTTLING
// ======================

/**
 * Configuración de throttling de alertas
 * Previene "alert fatigue" limitando la frecuencia de notificaciones
 */
const ALERT_THROTTLE_CONFIG = {
  max_alerts_per_type_per_hour: 10,    // Máximo de alertas por tipo por hora
  max_alerts_per_tenant_per_hour: 50,  // Máximo total de alertas por tenant por hora
  dedup_window_minutes: 15,            // Ventana para considerar duplicados
  cache_ttl_ms: 3600000,               // 1 hora en ms
};

/**
 * Estado del throttle para una combinación tenant+tipo
 */
interface AlertThrottleState {
  type: string;
  count: number;
  lastReset: number;
  recentPatterns: string[];  // Para deduplicación
}

/**
 * Cache en memoria para throttling de alertas
 * Key: `${tenantId}:${actionType}`
 */
const alertThrottleCache = new Map<string, AlertThrottleState>();

/**
 * Cache para conteo total por tenant
 * Key: `${tenantId}:total`
 */
const tenantAlertCount = new Map<string, { count: number; lastReset: number }>();

/**
 * REVISIÓN 5.3 G-B17: Verifica si se debe enviar una alerta
 * Implementa throttling por tipo y deduplicación de patrones similares
 *
 * @param tenantId - ID del tenant
 * @param actionType - Tipo de acción (urgent_booking, escalation, etc.)
 * @param patternValue - Valor del patrón detectado (para deduplicación)
 * @returns true si se debe enviar la alerta, false si está throttled
 */
export function shouldSendAlert(
  tenantId: string,
  actionType: string,
  patternValue: string
): { send: boolean; reason?: string } {
  const now = Date.now();
  const typeKey = `${tenantId}:${actionType}`;
  const totalKey = `${tenantId}:total`;

  // 1. Check límite total por tenant
  let tenantTotal = tenantAlertCount.get(totalKey);
  if (!tenantTotal || now - tenantTotal.lastReset > ALERT_THROTTLE_CONFIG.cache_ttl_ms) {
    tenantTotal = { count: 0, lastReset: now };
  }

  if (tenantTotal.count >= ALERT_THROTTLE_CONFIG.max_alerts_per_tenant_per_hour) {
    return {
      send: false,
      reason: `Tenant alert limit reached (${ALERT_THROTTLE_CONFIG.max_alerts_per_tenant_per_hour}/hr)`
    };
  }

  // 2. Check límite por tipo
  let typeState = alertThrottleCache.get(typeKey);

  // Reset si pasó 1 hora
  if (!typeState || now - typeState.lastReset > ALERT_THROTTLE_CONFIG.cache_ttl_ms) {
    typeState = {
      type: actionType,
      count: 0,
      lastReset: now,
      recentPatterns: [],
    };
  }

  // Check límite por tipo por hora
  if (typeState.count >= ALERT_THROTTLE_CONFIG.max_alerts_per_type_per_hour) {
    return {
      send: false,
      reason: `Type limit reached for ${actionType} (${ALERT_THROTTLE_CONFIG.max_alerts_per_type_per_hour}/hr)`
    };
  }

  // 3. Check deduplicación de patrón
  const normalizedPattern = patternValue.toLowerCase().trim();
  if (typeState.recentPatterns.includes(normalizedPattern)) {
    return {
      send: false,
      reason: `Duplicate pattern within ${ALERT_THROTTLE_CONFIG.dedup_window_minutes} min`
    };
  }

  // 4. Todo OK - actualizar contadores
  typeState.count++;
  typeState.recentPatterns.push(normalizedPattern);

  // Mantener solo los últimos 20 patrones para deduplicación
  if (typeState.recentPatterns.length > 20) {
    typeState.recentPatterns.shift();
  }

  alertThrottleCache.set(typeKey, typeState);

  // Actualizar contador total del tenant
  tenantTotal.count++;
  tenantAlertCount.set(totalKey, tenantTotal);

  return { send: true };
}

/**
 * Limpia el cache de throttling (útil para tests)
 */
export function clearAlertThrottleCache(): void {
  alertThrottleCache.clear();
  tenantAlertCount.clear();
}

// ======================
// REVISIÓN 5.3 G-B12: PATTERN RATE LIMITING
// ======================

/**
 * Configuración de rate limiting para patrones
 * Previene manipulación de sentimiento via repetición
 */
const PATTERN_RATE_LIMITS = {
  max_patterns_per_lead_per_hour: 50,      // Máximo de patrones únicos por lead/hora
  max_same_pattern_per_lead_per_hour: 5,   // Máximo del mismo patrón por lead/hora
  max_patterns_per_conversation_per_hour: 100, // Máximo por conversación
  cooldown_after_limit_ms: 60000,          // 1 minuto de cooldown
  cache_ttl_ms: 3600000,                   // 1 hora
};

/**
 * Estado del rate limit por lead
 */
interface PatternRateLimitState {
  totalCount: number;
  patternCounts: Map<string, number>;  // patternKey -> count
  lastReset: number;
  inCooldown: boolean;
  cooldownEnds?: number;
}

/**
 * Cache en memoria para rate limiting de patrones
 * Key: `${tenantId}:${leadId || conversationId}`
 */
const patternRateLimitCache = new Map<string, PatternRateLimitState>();

/**
 * REVISIÓN 5.3 G-B12: Verifica rate limit para un patrón
 * Previene manipulación de sentiment via repetición masiva
 *
 * @param tenantId - ID del tenant
 * @param identifier - leadId o conversationId
 * @param patternType - Tipo de patrón
 * @param patternValue - Valor del patrón
 * @returns true si el patrón puede ser procesado, false si está rate limited
 */
export function checkPatternRateLimit(
  tenantId: string,
  identifier: string,
  patternType: string,
  patternValue: string
): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const key = `${tenantId}:${identifier}`;
  const patternKey = `${patternType}:${patternValue.toLowerCase().trim()}`;

  let state = patternRateLimitCache.get(key);

  // Reset si pasó 1 hora
  if (!state || now - state.lastReset > PATTERN_RATE_LIMITS.cache_ttl_ms) {
    state = {
      totalCount: 0,
      patternCounts: new Map(),
      lastReset: now,
      inCooldown: false,
    };
  }

  // Check cooldown activo
  if (state.inCooldown && state.cooldownEnds && now < state.cooldownEnds) {
    return {
      allowed: false,
      reason: `In cooldown until ${new Date(state.cooldownEnds).toISOString()}`
    };
  } else if (state.inCooldown) {
    // Salir de cooldown
    state.inCooldown = false;
    state.cooldownEnds = undefined;
  }

  // Check límite total
  if (state.totalCount >= PATTERN_RATE_LIMITS.max_patterns_per_lead_per_hour) {
    // Entrar en cooldown
    state.inCooldown = true;
    state.cooldownEnds = now + PATTERN_RATE_LIMITS.cooldown_after_limit_ms;
    patternRateLimitCache.set(key, state);

    console.warn(`[Learning] Rate limit: Total pattern limit reached for ${identifier}`);
    return {
      allowed: false,
      reason: `Total pattern limit reached (${PATTERN_RATE_LIMITS.max_patterns_per_lead_per_hour}/hr)`
    };
  }

  // Check límite del mismo patrón
  const patternCount = state.patternCounts.get(patternKey) || 0;
  if (patternCount >= PATTERN_RATE_LIMITS.max_same_pattern_per_lead_per_hour) {
    console.warn(`[Learning] Rate limit: Same pattern limit for ${patternKey}`);
    return {
      allowed: false,
      reason: `Same pattern limit (${PATTERN_RATE_LIMITS.max_same_pattern_per_lead_per_hour}/hr)`
    };
  }

  // Actualizar contadores
  state.totalCount++;
  state.patternCounts.set(patternKey, patternCount + 1);
  patternRateLimitCache.set(key, state);

  return { allowed: true };
}

/**
 * Limpia el cache de rate limiting (útil para tests)
 */
export function clearPatternRateLimitCache(): void {
  patternRateLimitCache.clear();
}

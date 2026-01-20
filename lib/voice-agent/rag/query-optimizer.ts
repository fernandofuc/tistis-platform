/**
 * TIS TIS Platform - Voice Agent v2.0
 * Query Optimizer
 *
 * Optimizes voice queries for better retrieval results:
 * - Expands abbreviations and synonyms
 * - Detects query intent
 * - Extracts keywords
 * - Targets appropriate categories
 */

import type {
  OptimizedQuery,
  QueryIntent,
  QueryUrgency,
  QueryOptimizerConfig,
  SynonymDictionary,
  AbbreviationDictionary,
} from './types';

// =====================================================
// DEFAULT DICTIONARIES
// =====================================================

/**
 * Common abbreviations used in voice
 */
const DEFAULT_ABBREVIATIONS: AbbreviationDictionary = {
  es: {
    // Time
    'hrs': 'horas',
    'min': 'minutos',
    'seg': 'segundos',
    // Days
    'lun': 'lunes',
    'mar': 'martes',
    'mie': 'miércoles',
    'jue': 'jueves',
    'vie': 'viernes',
    'sab': 'sábado',
    'dom': 'domingo',
    // Common
    'info': 'información',
    'tel': 'teléfono',
    'dir': 'dirección',
    'aprox': 'aproximadamente',
    'disp': 'disponible',
    'reserv': 'reservación',
    'cancel': 'cancelación',
    // Restaurant
    'rest': 'restaurante',
    'desc': 'descuento',
    'promo': 'promoción',
    // Medical
    'dr': 'doctor',
    'dra': 'doctora',
    'lic': 'licenciado',
  },
  en: {
    // Time
    'hrs': 'hours',
    'min': 'minutes',
    'sec': 'seconds',
    // Days
    'mon': 'monday',
    'tue': 'tuesday',
    'wed': 'wednesday',
    'thu': 'thursday',
    'fri': 'friday',
    'sat': 'saturday',
    'sun': 'sunday',
    // Common
    'info': 'information',
    'tel': 'telephone',
    'addr': 'address',
    'approx': 'approximately',
    'avail': 'available',
    'reserv': 'reservation',
    'cancel': 'cancellation',
    // Restaurant
    'rest': 'restaurant',
    'disc': 'discount',
    'promo': 'promotion',
    // Medical
    'appt': 'appointment',
    'dr': 'doctor',
  },
};

/**
 * Common synonyms for better retrieval
 */
const DEFAULT_SYNONYMS: SynonymDictionary = {
  es: {
    // Menu/Food
    'menú': ['carta', 'platillos', 'comida', 'platos'],
    'comida': ['alimentos', 'platillos', 'platos'],
    'bebidas': ['tragos', 'drinks', 'refrescos'],
    'desayuno': ['almuerzo temprano', 'mañana'],
    'almuerzo': ['comida', 'lunch'],
    'cena': ['comida nocturna', 'dinner'],
    'postre': ['dulce', 'postre', 'helado'],

    // Pricing
    'precio': ['costo', 'valor', 'cuánto cuesta', 'cuánto vale'],
    'caro': ['costoso', 'elevado'],
    'barato': ['económico', 'accesible', 'precio bajo'],
    'promoción': ['descuento', 'oferta', 'especial'],

    // Hours
    'horario': ['horas', 'cuando abren', 'cuando cierran'],
    'abierto': ['disponible', 'operando', 'funcionando'],
    'cerrado': ['no disponible', 'fuera de servicio'],

    // Location
    'dirección': ['ubicación', 'donde están', 'cómo llegar'],
    'ubicación': ['localización', 'dirección', 'donde queda'],
    'estacionamiento': ['parking', 'donde estacionar'],

    // Reservations
    'reservación': ['reserva', 'apartar', 'mesa'],
    'disponibilidad': ['espacios', 'lugares', 'mesas disponibles'],
    'cancelar': ['anular', 'eliminar reserva'],

    // Services (Dental)
    'limpieza': ['profilaxis', 'limpieza dental'],
    'cita': ['consulta', 'turno', 'appointment'],
    'doctor': ['dentista', 'odontólogo', 'especialista'],
    'tratamiento': ['procedimiento', 'servicio'],
    'ortodoncia': ['brackets', 'frenos', 'alineadores'],
    'blanqueamiento': ['aclarado dental', 'whitening'],

    // Policies
    'política': ['reglas', 'normas', 'condiciones'],
    'cancelación': ['anulación', 'cancelar'],
    'pago': ['cobro', 'forma de pago', 'métodos de pago'],
  },
  en: {
    // Menu/Food
    'menu': ['dishes', 'food', 'meals', 'options'],
    'food': ['meals', 'dishes', 'cuisine'],
    'drinks': ['beverages', 'refreshments'],
    'breakfast': ['morning meal', 'brunch'],
    'lunch': ['midday meal', 'noon meal'],
    'dinner': ['evening meal', 'supper'],
    'dessert': ['sweets', 'treats'],

    // Pricing
    'price': ['cost', 'how much', 'rate'],
    'expensive': ['pricey', 'costly'],
    'cheap': ['affordable', 'budget', 'low cost'],
    'promotion': ['discount', 'deal', 'special', 'offer'],

    // Hours
    'hours': ['schedule', 'when open', 'operating times'],
    'open': ['available', 'operating'],
    'closed': ['unavailable', 'not operating'],

    // Location
    'address': ['location', 'where', 'directions'],
    'location': ['address', 'where located'],
    'parking': ['where to park', 'parking lot'],

    // Reservations
    'reservation': ['booking', 'table', 'reserve'],
    'availability': ['open spots', 'available times'],
    'cancel': ['remove booking', 'delete reservation'],

    // Services (Dental)
    'cleaning': ['prophylaxis', 'dental cleaning'],
    'appointment': ['visit', 'consultation'],
    'doctor': ['dentist', 'specialist'],
    'treatment': ['procedure', 'service'],
    'orthodontics': ['braces', 'aligners'],
    'whitening': ['bleaching', 'teeth whitening'],

    // Policies
    'policy': ['rules', 'terms', 'conditions'],
    'cancellation': ['cancel policy', 'refund'],
    'payment': ['billing', 'pay', 'payment methods'],
  },
};

/**
 * Intent detection patterns
 */
const INTENT_PATTERNS: Record<QueryIntent, { es: RegExp[]; en: RegExp[] }> = {
  menu: {
    es: [
      /men[úu]/i,
      /carta/i,
      /platillos?/i,
      /comida/i,
      /platos?/i,
      /qu[ée] (tienen|ofrecen|sirven)/i,
      /especialidad/i,
    ],
    en: [
      /menu/i,
      /dishes?/i,
      /food/i,
      /meals?/i,
      /what do you (have|serve|offer)/i,
      /specialty/i,
    ],
  },
  services: {
    es: [
      /servicios?/i,
      /tratamientos?/i,
      /procedimientos?/i,
      /qu[ée] (hacen|ofrecen)/i,
      /especialidades?/i,
    ],
    en: [
      /services?/i,
      /treatments?/i,
      /procedures?/i,
      /what do you (do|offer)/i,
      /specialties?/i,
    ],
  },
  hours: {
    es: [
      /horarios?/i,
      /horas?/i,
      /qu[ée] hora/i,
      /cu[aá]ndo (abren|cierran)/i,
      /abierto/i,
      /cerrado/i,
      /hasta qu[ée] hora/i,
    ],
    en: [
      /hours?/i,
      /schedule/i,
      /when (open|close|do you)/i,
      /open/i,
      /closed/i,
      /until what time/i,
    ],
  },
  location: {
    es: [
      /direcci[oó]n/i,
      /ubicaci[oó]n/i,
      /d[oó]nde (est[aá]n|queda)/i,
      /c[oó]mo llegar/i,
      /estacionamiento/i,
      /cerca de/i,
    ],
    en: [
      /address/i,
      /location/i,
      /where (are you|is it|located)/i,
      /how to get/i,
      /directions/i,
      /parking/i,
      /near/i,
    ],
  },
  pricing: {
    es: [
      /precios?/i,
      /costos?/i,
      /cu[aá]nto (cuesta|vale|es)/i,
      /tarifas?/i,
      /valor/i,
    ],
    en: [
      /prices?/i,
      /costs?/i,
      /how much/i,
      /rates?/i,
      /fees?/i,
    ],
  },
  policies: {
    es: [
      /pol[ií]ticas?/i,
      /reglas?/i,
      /cancelaci[oó]n/i,
      /reembolso/i,
      /condiciones?/i,
      /t[ée]rminos?/i,
    ],
    en: [
      /polic(y|ies)/i,
      /rules?/i,
      /cancellation/i,
      /refund/i,
      /conditions?/i,
      /terms?/i,
    ],
  },
  availability: {
    es: [
      /disponibilidad/i,
      /disponible/i,
      /hay (lugar|espacio|mesa)/i,
      /tienen (lugar|espacio)/i,
    ],
    en: [
      /availability/i,
      /available/i,
      /is there (room|space|table)/i,
      /do you have (room|space)/i,
    ],
  },
  contact: {
    es: [
      /tel[ée]fono/i,
      /contacto/i,
      /email/i,
      /correo/i,
      /c[oó]mo (contactar|comunicar)/i,
    ],
    en: [
      /phone/i,
      /contact/i,
      /email/i,
      /how to (contact|reach)/i,
    ],
  },
  promotions: {
    es: [
      /promoci[oó]n/i,
      /descuento/i,
      /oferta/i,
      /especial/i,
      /2x1/i,
    ],
    en: [
      /promotion/i,
      /discount/i,
      /deal/i,
      /special/i,
      /offer/i,
      /2 for 1/i,
    ],
  },
  general: {
    es: [/.*/],
    en: [/.*/],
  },
};

/**
 * Category mapping based on intent
 */
const INTENT_TO_CATEGORIES: Record<QueryIntent, string[]> = {
  menu: ['menu', 'food', 'drinks', 'dishes'],
  services: ['services', 'treatments', 'procedures'],
  hours: ['hours', 'schedule', 'business_hours'],
  location: ['location', 'address', 'directions', 'parking'],
  pricing: ['pricing', 'prices', 'costs', 'rates'],
  policies: ['policies', 'cancellation', 'terms', 'rules'],
  availability: ['availability', 'schedule', 'capacity'],
  contact: ['contact', 'phone', 'email', 'social'],
  promotions: ['promotions', 'deals', 'offers', 'specials'],
  general: ['general', 'info', 'about'],
};

// =====================================================
// QUERY OPTIMIZER CLASS
// =====================================================

/**
 * Query optimizer for voice RAG
 */
export class QueryOptimizer {
  private config: Required<QueryOptimizerConfig>;
  private synonyms: SynonymDictionary;
  private abbreviations: AbbreviationDictionary;

  constructor(config?: QueryOptimizerConfig) {
    this.config = {
      expandSynonyms: config?.expandSynonyms ?? true,
      expandAbbreviations: config?.expandAbbreviations ?? true,
      detectIntent: config?.detectIntent ?? true,
      customSynonyms: config?.customSynonyms ?? {},
      locale: config?.locale ?? 'es',
    };

    // Merge custom synonyms with defaults (for both locales)
    this.synonyms = {
      es: { ...DEFAULT_SYNONYMS.es, ...this.config.customSynonyms },
      en: { ...DEFAULT_SYNONYMS.en, ...this.config.customSynonyms },
    };

    this.abbreviations = DEFAULT_ABBREVIATIONS;
  }

  /**
   * Optimize a query for better retrieval
   */
  optimize(query: string): OptimizedQuery {
    const locale = this.config.locale;
    const original = query.trim();
    let optimized = original.toLowerCase();

    // Track modifications
    let wasModified = false;
    const addedSynonyms: string[] = [];

    // Step 1: Expand abbreviations
    if (this.config.expandAbbreviations) {
      const expanded = this.expandAbbreviations(optimized, locale);
      if (expanded !== optimized) {
        optimized = expanded;
        wasModified = true;
      }
    }

    // Step 2: Detect intent
    const intent = this.config.detectIntent
      ? this.detectIntent(optimized, locale)
      : 'general';

    // Step 3: Extract keywords
    const keywords = this.extractKeywords(optimized, locale);

    // Step 4: Expand synonyms
    if (this.config.expandSynonyms) {
      const { expanded, synonyms } = this.expandSynonyms(optimized, locale);
      if (synonyms.length > 0) {
        optimized = expanded;
        addedSynonyms.push(...synonyms);
        wasModified = true;
      }
    }

    // Step 5: Determine urgency
    const urgency = this.detectUrgency(original, locale);

    // Step 6: Get target categories
    const targetCategories = INTENT_TO_CATEGORIES[intent] || ['general'];

    return {
      original,
      optimized,
      intent,
      keywords,
      synonyms: addedSynonyms,
      urgency,
      targetCategories,
      wasModified,
    };
  }

  /**
   * Expand abbreviations in query
   */
  private expandAbbreviations(query: string, locale: string): string {
    const abbrevs = locale === 'en'
      ? this.abbreviations.en
      : this.abbreviations.es;

    let result = query;
    for (const [abbrev, full] of Object.entries(abbrevs)) {
      // Match abbreviation as whole word
      const pattern = new RegExp(`\\b${abbrev}\\b`, 'gi');
      result = result.replace(pattern, full);
    }

    return result;
  }

  /**
   * Detect query intent
   */
  private detectIntent(query: string, locale: string): QueryIntent {
    const patterns = INTENT_PATTERNS;

    for (const [intent, localePatterns] of Object.entries(patterns)) {
      if (intent === 'general') continue; // Check last

      const intentPatterns = locale === 'en'
        ? localePatterns.en
        : localePatterns.es;

      for (const pattern of intentPatterns) {
        if (pattern.test(query)) {
          return intent as QueryIntent;
        }
      }
    }

    return 'general';
  }

  /**
   * Extract keywords from query
   */
  private extractKeywords(query: string, locale: string): string[] {
    // Remove common stop words
    const stopWords = locale === 'en'
      ? ['the', 'a', 'an', 'is', 'are', 'do', 'does', 'what', 'where', 'when', 'how', 'can', 'i', 'you', 'me', 'to', 'for', 'of', 'in', 'on', 'at']
      : ['el', 'la', 'los', 'las', 'un', 'una', 'es', 'son', 'qué', 'cuál', 'cuáles', 'dónde', 'cuándo', 'cómo', 'puedo', 'puede', 'me', 'te', 'para', 'de', 'en', 'a', 'y', 'o'];

    const words = query
      .toLowerCase()
      .replace(/[¿?¡!.,;:'"]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));

    // Remove duplicates
    return [...new Set(words)];
  }

  /**
   * Expand synonyms in query
   */
  private expandSynonyms(
    query: string,
    locale: string
  ): { expanded: string; synonyms: string[] } {
    const synonymDict = locale === 'en'
      ? this.synonyms.en
      : this.synonyms.es;

    const addedSynonyms: string[] = [];
    let expanded = query;

    for (const [word, synonyms] of Object.entries(synonymDict)) {
      const pattern = new RegExp(`\\b${word}\\b`, 'gi');
      if (pattern.test(query)) {
        // Add first 2 synonyms to the query
        const toAdd = synonyms.slice(0, 2);
        expanded += ' ' + toAdd.join(' ');
        addedSynonyms.push(...toAdd);
      }
    }

    return { expanded, synonyms: addedSynonyms };
  }

  /**
   * Detect urgency level
   */
  private detectUrgency(query: string, locale: string): QueryUrgency {
    const urgentPatterns = locale === 'en'
      ? [/urgent/i, /asap/i, /right now/i, /immediately/i, /emergency/i]
      : [/urgente/i, /ahora/i, /ya/i, /inmediato/i, /emergencia/i, /rápido/i];

    for (const pattern of urgentPatterns) {
      if (pattern.test(query)) {
        return 'immediate';
      }
    }

    return 'normal';
  }

  /**
   * Add custom synonyms at runtime
   */
  addSynonyms(locale: string, synonyms: Record<string, string[]>): void {
    if (locale === 'en') {
      this.synonyms.en = { ...this.synonyms.en, ...synonyms };
    } else {
      this.synonyms.es = { ...this.synonyms.es, ...synonyms };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<QueryOptimizerConfig> {
    return { ...this.config };
  }
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create a query optimizer instance
 */
export function createQueryOptimizer(config?: QueryOptimizerConfig): QueryOptimizer {
  return new QueryOptimizer(config);
}

// =====================================================
// DEFAULT INSTANCE
// =====================================================

let defaultOptimizer: QueryOptimizer | null = null;

/**
 * Get the default query optimizer instance
 */
export function getQueryOptimizer(config?: QueryOptimizerConfig): QueryOptimizer {
  if (!defaultOptimizer) {
    defaultOptimizer = createQueryOptimizer(config);
  }
  return defaultOptimizer;
}

/**
 * Reset the default optimizer (for testing)
 */
export function resetQueryOptimizer(): void {
  defaultOptimizer = null;
}

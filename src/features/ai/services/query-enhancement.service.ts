// =====================================================
// TIS TIS PLATFORM - Query Enhancement Service
// V7.2: Pre-procesamiento inteligente de consultas para RAG
// =====================================================
//
// Este servicio mejora las consultas del usuario antes de buscar
// en la base de conocimiento, aplicando técnicas avanzadas de NLP:
//
// 1. Query Expansion: Añade sinónimos y términos relacionados
// 2. Query Rewriting: Reformula para mejor matching semántico
// 3. Intent Extraction: Identifica la intención principal
// 4. Context Injection: Añade contexto del negocio
//
// Basado en mejores prácticas de la industria 2025-2026:
// - SearchUnify FRAG approach
// - Google Research: Sufficient Context
// - Agentic RAG patterns
// =====================================================

// ======================
// TYPES
// ======================

export interface EnhancedQuery {
  /** Query original del usuario */
  original: string;
  /** Query expandida con sinónimos y términos relacionados */
  expanded: string;
  /** Query reescrita para mejor matching semántico */
  rewritten: string;
  /** Intención detectada */
  intent: QueryIntent;
  /** Keywords extraídas para búsqueda híbrida */
  keywords: string[];
  /** Categorías relevantes detectadas */
  categories: string[];
  /** Score de confianza en la mejora (0-1) */
  confidence: number;
}

export type QueryIntent =
  | 'service_inquiry'      // Pregunta sobre servicios/precios
  | 'policy_inquiry'       // Pregunta sobre políticas
  | 'location_inquiry'     // Pregunta sobre ubicación/horarios
  | 'booking_inquiry'      // Pregunta sobre citas/reservas
  | 'faq_general'          // Pregunta general/FAQ
  | 'complaint'            // Queja o problema
  | 'menu_inquiry'         // Pregunta sobre menú (restaurant)
  | 'order_inquiry'        // Pregunta sobre pedidos
  | 'loyalty_inquiry'      // Pregunta sobre puntos/lealtad
  | 'unknown';             // No se pudo determinar

export interface QueryEnhancementConfig {
  /** Vertical del negocio para contexto específico */
  vertical?: 'dental' | 'medical' | 'restaurant' | 'general';
  /** Nombre del negocio para contexto */
  businessName?: string;
  /** Idioma de las consultas */
  language?: 'es' | 'en';
  /** Habilitar expansión de sinónimos */
  enableSynonymExpansion?: boolean;
  /** Habilitar detección de intención */
  enableIntentDetection?: boolean;
}

// ======================
// SYNONYM DICTIONARIES
// ======================

/**
 * Diccionario de sinónimos por vertical en español
 * Expandido para cubrir variaciones comunes de usuarios
 */
const SYNONYMS: Record<string, Record<string, string[]>> = {
  dental: {
    // Tratamientos
    limpieza: ['profilaxis', 'limpieza dental', 'limpia', 'higiene dental', 'limpieza profunda'],
    blanqueamiento: ['blanqueo', 'aclarar dientes', 'dientes blancos', 'whitening', 'blanqueado'],
    ortodoncia: ['brackets', 'frenos', 'frenillos', 'alineadores', 'invisalign', 'aparatos'],
    implante: ['implantes', 'implante dental', 'implantes dentales', 'tornillo dental'],
    corona: ['coronas', 'funda', 'fundas dentales', 'capas', 'carilla'],
    extraccion: ['extraer', 'sacar muela', 'sacar diente', 'quitar muela', 'extracción'],
    endodoncia: ['tratamiento de conducto', 'matar nervio', 'conductos', 'root canal'],
    resina: ['empaste', 'relleno', 'amalgama', 'curar carie', 'obturación'],
    // Problemas
    dolor: ['duele', 'molestia', 'me duele', 'tengo dolor', 'punzada'],
    carie: ['caries', 'picadura', 'hoyo', 'agujero en el diente', 'diente negro'],
    sangrado: ['sangra', 'sangran las encias', 'encías sangrantes', 'sangre'],
    sensibilidad: ['sensible', 'dientes sensibles', 'me molesta el frío', 'duele el frío'],
    // Consultas
    precio: ['costo', 'cuanto cuesta', 'cuanto sale', 'valor', 'tarifa', 'cobran'],
    cita: ['consulta', 'agendar', 'turno', 'hora', 'reservar', 'appointment'],
    urgencia: ['emergencia', 'urgente', 'ya', 'ahora', 'dolor fuerte'],
  },
  medical: {
    consulta: ['cita', 'chequeo', 'revisión', 'visita', 'appointment'],
    doctor: ['médico', 'especialista', 'dr', 'dra', 'profesional'],
    analisis: ['estudios', 'examenes', 'laboratorio', 'pruebas', 'labs'],
    receta: ['medicamentos', 'medicina', 'tratamiento', 'prescription'],
    precio: ['costo', 'cuanto cuesta', 'cuanto sale', 'valor', 'tarifa'],
    seguro: ['aseguradora', 'póliza', 'cobertura', 'insurance'],
  },
  restaurant: {
    // Menú
    menu: ['carta', 'menú', 'platillos', 'que tienen', 'que hay'],
    comida: ['alimento', 'platillo', 'plato', 'dish'],
    bebida: ['drinks', 'tomar', 'refrescos', 'jugos'],
    postre: ['postres', 'dulce', 'pastel', 'helado'],
    entrada: ['entradas', 'appetizer', 'botana', 'para empezar'],
    // Pedidos
    pedido: ['orden', 'pedir', 'ordenar', 'quiero', 'me trae'],
    domicilio: ['delivery', 'a domicilio', 'envío', 'llevar a casa', 'entrega'],
    recoger: ['pickup', 'para llevar', 'llevar', 'to go'],
    reservacion: ['reservar', 'mesa', 'booking', 'guardar lugar'],
    // Precios
    precio: ['costo', 'cuanto cuesta', 'cuanto sale', 'valor'],
    promocion: ['promo', 'oferta', 'descuento', '2x1', 'combo'],
    // Características
    vegetariano: ['vegano', 'sin carne', 'plant based', 'verduras'],
    picante: ['enchilado', 'picoso', 'chile', 'spicy'],
  },
  general: {
    precio: ['costo', 'cuanto cuesta', 'cuanto sale', 'valor', 'tarifa', 'cobran'],
    horario: ['hora', 'abierto', 'cerrado', 'cuando abren', 'atienden'],
    ubicacion: ['direccion', 'donde estan', 'como llego', 'dirección', 'mapa'],
    telefono: ['llamar', 'numero', 'cel', 'whatsapp', 'contacto'],
    cita: ['agendar', 'reservar', 'turno', 'appointment', 'consulta'],
  },
};

// ======================
// INTENT PATTERNS
// ======================

/**
 * Patrones regex para detectar intención de la consulta
 */
const INTENT_PATTERNS: Array<{ intent: QueryIntent; patterns: RegExp[] }> = [
  {
    intent: 'service_inquiry',
    patterns: [
      /cuanto\s*(cuesta|sale|cobran|es)/i,
      /precio\s*(de|del|para)/i,
      /qu[ée]\s*(servicios|tratamientos)/i,
      /hacen\s*(limpieza|blanqueamiento|ortodoncia)/i,
      /ofrecen/i,
      /tienen.*servicio/i,
    ],
  },
  {
    intent: 'policy_inquiry',
    patterns: [
      /pol[ií]tica\s*(de|del)/i,
      /cancelar|cancelaci[oó]n/i,
      /reagendar|cambiar\s*cita/i,
      /garant[ií]a/i,
      /reembolso|devoluci[oó]n/i,
      /formas?\s*de\s*pago/i,
      /aceptan\s*(tarjeta|efectivo)/i,
    ],
  },
  {
    intent: 'location_inquiry',
    patterns: [
      /d[oó]nde\s*(est[aá]n|queda|ubicados)/i,
      /direcci[oó]n/i,
      /c[oó]mo\s*llego/i,
      /ubicaci[oó]n/i,
      /sucursal/i,
      /mapa|google\s*maps/i,
    ],
  },
  {
    intent: 'booking_inquiry',
    patterns: [
      /agendar|reservar|apartar/i,
      /cita|turno|consulta/i,
      /disponibilidad|disponible/i,
      /horarios?\s*(disponibles?|libres?)/i,
      /cu[aá]ndo\s*pueden/i,
      /pr[oó]xima\s*cita/i,
    ],
  },
  {
    intent: 'menu_inquiry',
    patterns: [
      /men[uú]|carta/i,
      /qu[eé]\s*(platillos|tienen|hay)/i,
      /comida|bebida/i,
      /plato\s*(del\s*d[ií]a|fuerte)/i,
      /postres?|entradas?/i,
    ],
  },
  {
    intent: 'order_inquiry',
    patterns: [
      /pedir|ordenar|quiero/i,
      /pedido|orden/i,
      /domicilio|delivery/i,
      /para\s*llevar|pickup/i,
      /cu[aá]nto\s*tarda/i,
      /tiempo\s*de\s*entrega/i,
    ],
  },
  {
    intent: 'loyalty_inquiry',
    patterns: [
      /puntos?|tokens?/i,
      /lealtad|loyalty/i,
      /canjear|redimir/i,
      /recompensas?|premios?/i,
      /membres[ií]a/i,
      /cu[aá]ntos?\s*puntos/i,
    ],
  },
  {
    intent: 'complaint',
    patterns: [
      /queja|quejarme/i,
      /mal\s*servicio/i,
      /problema|issue/i,
      /molesto|enojado|frustrado/i,
      /gerente|supervisor|encargado/i,
      /no\s*me\s*gust[oó]/i,
      /p[eé]simo/i,
    ],
  },
];

// ======================
// CATEGORY KEYWORDS
// ======================

/**
 * Keywords que indican categorías específicas en la KB
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  about_us: ['sobre nosotros', 'quienes somos', 'historia', 'empresa', 'negocio'],
  differentiators: ['diferencia', 'mejor que', 'ventaja', 'único', 'especial'],
  certifications: ['certificación', 'certificado', 'acreditación', 'diploma'],
  technology: ['tecnología', 'equipo', 'moderno', 'digital', 'escáner', 'láser'],
  materials: ['material', 'calidad', 'producto', 'ingrediente', 'marca'],
  process: ['proceso', 'procedimiento', 'cómo funciona', 'pasos'],
  aftercare: ['cuidados', 'después', 'recuperación', 'mantenimiento'],
  preparation: ['preparación', 'antes', 'previo', 'recomendación'],
  promotions: ['promoción', 'oferta', 'descuento', 'especial', 'combo'],
  testimonials: ['testimonio', 'opinión', 'reseña', 'review', 'experiencia'],
};

// ======================
// QUERY ENHANCEMENT SERVICE
// ======================

class QueryEnhancementServiceClass {
  private config: QueryEnhancementConfig;

  constructor(config: QueryEnhancementConfig = {}) {
    this.config = {
      vertical: 'general',
      language: 'es',
      enableSynonymExpansion: true,
      enableIntentDetection: true,
      ...config,
    };
  }

  /**
   * Configura el servicio para un contexto específico
   */
  configure(config: Partial<QueryEnhancementConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Mejora una consulta del usuario para mejor retrieval
   */
  enhance(query: string, contextConfig?: Partial<QueryEnhancementConfig>): EnhancedQuery {
    const config = { ...this.config, ...contextConfig };
    const normalizedQuery = this.normalizeQuery(query);

    // 1. Detectar intención
    const intent = config.enableIntentDetection
      ? this.detectIntent(normalizedQuery)
      : 'unknown';

    // 2. Extraer keywords
    const keywords = this.extractKeywords(normalizedQuery);

    // 3. Detectar categorías relevantes
    const categories = this.detectCategories(normalizedQuery);

    // 4. Expandir con sinónimos
    const expanded = config.enableSynonymExpansion
      ? this.expandWithSynonyms(normalizedQuery, config.vertical)
      : normalizedQuery;

    // 5. Reescribir para mejor semántica
    const rewritten = this.rewriteForSemantics(normalizedQuery, intent, config);

    // 6. Calcular confianza
    const confidence = this.calculateConfidence(intent, keywords, categories);

    return {
      original: query,
      expanded,
      rewritten,
      intent,
      keywords,
      categories,
      confidence,
    };
  }

  /**
   * Normaliza la consulta (minúsculas, quita acentos extra, etc.)
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[¿¡]/g, ''); // Quitar signos de interrogación invertidos
  }

  /**
   * Detecta la intención principal de la consulta
   */
  private detectIntent(query: string): QueryIntent {
    for (const { intent, patterns } of INTENT_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          return intent;
        }
      }
    }
    return 'faq_general';
  }

  /**
   * Extrae keywords importantes de la consulta
   */
  private extractKeywords(query: string): string[] {
    // Stopwords en español que no aportan significado
    const stopwords = new Set([
      'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
      'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para',
      'que', 'qué', 'como', 'cómo', 'donde', 'dónde', 'cuando', 'cuándo',
      'es', 'son', 'está', 'están', 'hay', 'tiene', 'tienen',
      'me', 'te', 'se', 'nos', 'les', 'lo', 'le',
      'mi', 'tu', 'su', 'mis', 'tus', 'sus',
      'y', 'o', 'pero', 'si', 'no', 'muy', 'más', 'menos',
      'este', 'esta', 'estos', 'estas', 'ese', 'esa',
      'hola', 'buenos', 'buenas', 'días', 'tardes', 'noches',
      'quiero', 'quisiera', 'puedo', 'pueden', 'podría', 'podrían',
      'favor', 'gracias', 'por favor',
    ]);

    const words = query
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopwords.has(word));

    // Retornar palabras únicas
    return [...new Set(words)];
  }

  /**
   * Detecta categorías de KB relevantes para la consulta
   */
  private detectCategories(query: string): string[] {
    const detectedCategories: string[] = [];

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (query.includes(keyword)) {
          detectedCategories.push(category);
          break;
        }
      }
    }

    return detectedCategories;
  }

  /**
   * Expande la consulta con sinónimos según la vertical
   */
  private expandWithSynonyms(query: string, vertical?: string): string {
    const synonymDict = {
      ...SYNONYMS.general,
      ...(vertical && SYNONYMS[vertical] ? SYNONYMS[vertical] : {}),
    };

    let expanded = query;

    for (const [term, synonyms] of Object.entries(synonymDict)) {
      // Si la query contiene algún sinónimo, añadir el término principal
      for (const synonym of synonyms) {
        if (query.includes(synonym) && !query.includes(term)) {
          expanded += ` ${term}`;
          break;
        }
      }

      // Si la query contiene el término principal, añadir sinónimos principales
      if (query.includes(term) && synonyms.length > 0) {
        // Solo añadir los 2 sinónimos más importantes
        expanded += ` ${synonyms.slice(0, 2).join(' ')}`;
      }
    }

    return expanded.trim();
  }

  /**
   * Reescribe la consulta para mejor matching semántico
   */
  private rewriteForSemantics(
    query: string,
    intent: QueryIntent,
    config: QueryEnhancementConfig
  ): string {
    let rewritten = query;

    // Añadir contexto basado en intención
    switch (intent) {
      case 'service_inquiry':
        rewritten = `información sobre servicio: ${query}`;
        break;
      case 'policy_inquiry':
        rewritten = `política del negocio: ${query}`;
        break;
      case 'location_inquiry':
        rewritten = `ubicación y dirección: ${query}`;
        break;
      case 'booking_inquiry':
        rewritten = `reservar cita: ${query}`;
        break;
      case 'menu_inquiry':
        rewritten = `menú y platillos: ${query}`;
        break;
      case 'order_inquiry':
        rewritten = `realizar pedido: ${query}`;
        break;
      case 'loyalty_inquiry':
        rewritten = `programa de lealtad puntos: ${query}`;
        break;
      case 'complaint':
        rewritten = `resolver problema: ${query}`;
        break;
      default:
        // Para FAQ general, mantener la query pero añadir contexto de vertical
        if (config.vertical && config.vertical !== 'general') {
          const verticalContext = {
            dental: 'clínica dental',
            medical: 'consultorio médico',
            restaurant: 'restaurante',
          };
          rewritten = `${verticalContext[config.vertical]}: ${query}`;
        }
    }

    // Añadir nombre del negocio si está disponible
    if (config.businessName) {
      rewritten = `${config.businessName} - ${rewritten}`;
    }

    return rewritten;
  }

  /**
   * Calcula un score de confianza para la mejora
   */
  private calculateConfidence(
    intent: QueryIntent,
    keywords: string[],
    categories: string[]
  ): number {
    let confidence = 0.5; // Base

    // Intent identificado claramente
    if (intent !== 'unknown' && intent !== 'faq_general') {
      confidence += 0.2;
    }

    // Tiene keywords significativos
    if (keywords.length >= 2) {
      confidence += 0.1;
    }

    // Categorías detectadas
    if (categories.length > 0) {
      confidence += 0.1;
    }

    // Limitar a 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Genera una query optimizada para embeddings
   * Combina la query expandida y reescrita de forma inteligente
   */
  getOptimizedQuery(enhanced: EnhancedQuery): string {
    // Para búsqueda semántica, usar la versión reescrita
    // que tiene mejor contexto para los embeddings
    return enhanced.rewritten;
  }

  /**
   * Genera keywords para búsqueda híbrida (keyword + semantic)
   */
  getHybridSearchTerms(enhanced: EnhancedQuery): {
    semanticQuery: string;
    keywordTerms: string[];
    categories: string[];
  } {
    return {
      semanticQuery: enhanced.rewritten,
      keywordTerms: enhanced.keywords,
      categories: enhanced.categories,
    };
  }
}

// ======================
// SINGLETON EXPORT
// ======================

export const QueryEnhancementService = new QueryEnhancementServiceClass();

/**
 * Factory para crear instancias configuradas
 */
export function createQueryEnhancementService(
  config: QueryEnhancementConfig
): QueryEnhancementServiceClass {
  return new QueryEnhancementServiceClass(config);
}

export default QueryEnhancementService;

/**
 * BM25 Search Service
 * MEJORA-3.2: Búsqueda keyword con BM25 real
 *
 * BM25 (Best Matching 25) es el algoritmo estándar de la industria
 * para búsqueda por palabras clave, utilizado por Elasticsearch, Lucene, etc.
 *
 * BM25 considera:
 * - Frecuencia del término en el documento (TF)
 * - Frecuencia inversa del documento (IDF)
 * - Longitud del documento (normalización)
 *
 * Este servicio implementa BM25 en memoria con caché por tenant.
 */

// ============================================
// TIPOS
// ============================================

/**
 * Tipo simplificado para cliente Supabase usado en este servicio
 */
interface SupabaseQueryResult {
  data: unknown[] | null;
}

interface SupabaseLikeClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => SupabaseQueryResult;
      };
    };
  };
}

export interface BM25Document {
  id: string;
  content: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface BM25SearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface BM25Config {
  /** Saturación de frecuencia de término (default: 1.2) */
  k1: number;
  /** Normalización por longitud (default: 0.75) */
  b: number;
}

interface InternalDocument {
  id: string;
  terms: string[];
  termFreq: Map<string, number>;
  length: number;
  metadata?: Record<string, unknown>;
}

// ============================================
// TOKENIZADOR ESPAÑOL
// ============================================

const SPANISH_STOPWORDS = new Set([
  'a',
  'al',
  'algo',
  'algunas',
  'algunos',
  'ante',
  'antes',
  'como',
  'con',
  'contra',
  'cual',
  'cuando',
  'de',
  'del',
  'desde',
  'donde',
  'durante',
  'e',
  'el',
  'ella',
  'ellas',
  'ellos',
  'en',
  'entre',
  'era',
  'erais',
  'eran',
  'eras',
  'eres',
  'es',
  'esa',
  'esas',
  'ese',
  'eso',
  'esos',
  'esta',
  'estado',
  'estamos',
  'estan',
  'estar',
  'estas',
  'este',
  'esto',
  'estos',
  'estoy',
  'fue',
  'fuera',
  'fueron',
  'fui',
  'fuimos',
  'ha',
  'habeis',
  'habia',
  'habiais',
  'habiamos',
  'habian',
  'habias',
  'han',
  'has',
  'hasta',
  'hay',
  'haya',
  'he',
  'hemos',
  'la',
  'las',
  'le',
  'les',
  'lo',
  'los',
  'mas',
  'me',
  'mi',
  'mia',
  'mias',
  'mientras',
  'mio',
  'mios',
  'mis',
  'mucho',
  'muchos',
  'muy',
  'nada',
  'ni',
  'no',
  'nos',
  'nosotras',
  'nosotros',
  'nuestra',
  'nuestras',
  'nuestro',
  'nuestros',
  'o',
  'os',
  'otra',
  'otras',
  'otro',
  'otros',
  'para',
  'pero',
  'poco',
  'por',
  'porque',
  'que',
  'quien',
  'quienes',
  'se',
  'sea',
  'seais',
  'seamos',
  'sean',
  'seas',
  'sera',
  'sereis',
  'seremos',
  'seria',
  'seriais',
  'seriamos',
  'serian',
  'serias',
  'si',
  'sido',
  'siendo',
  'sin',
  'sobre',
  'sois',
  'somos',
  'son',
  'soy',
  'su',
  'sus',
  'suya',
  'suyas',
  'suyo',
  'suyos',
  'tal',
  'tambien',
  'tan',
  'tanto',
  'te',
  'teneis',
  'tenemos',
  'tener',
  'tengo',
  'ti',
  'tiene',
  'tienen',
  'tienes',
  'todo',
  'todos',
  'tu',
  'tus',
  'tuya',
  'tuyas',
  'tuyo',
  'tuyos',
  'un',
  'una',
  'uno',
  'unos',
  'vosotras',
  'vosotros',
  'vuestra',
  'vuestras',
  'vuestro',
  'vuestros',
  'y',
  'ya',
  'yo',
]);

/**
 * Tokeniza texto en español
 * - Normaliza acentos
 * - Remueve puntuación
 * - Filtra stopwords
 * - Filtra palabras muy cortas
 */
function tokenizeSpanish(text: string): string[] {
  return (
    text
      .toLowerCase()
      // Normalizar acentos para búsqueda más flexible
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Remover puntuación
      .replace(/[^\w\s]/g, ' ')
      // Dividir por espacios
      .split(/\s+/)
      // Filtrar stopwords y palabras muy cortas
      .filter((word) => word.length > 2 && !SPANISH_STOPWORDS.has(word))
  );
}

// ============================================
// SERVICIO PRINCIPAL
// ============================================

export class BM25Service {
  private documents: Map<string, InternalDocument> = new Map();
  private documentFreq: Map<string, number> = new Map(); // IDF
  private avgDocLength: number = 0;
  private totalDocs: number = 0;
  private config: BM25Config;
  private isIndexed: boolean = false;

  constructor(config?: Partial<BM25Config>) {
    this.config = {
      k1: 1.2,
      b: 0.75,
      ...config,
    };
  }

  /**
   * Añade documentos al índice
   */
  addDocuments(documents: BM25Document[]): void {
    for (const doc of documents) {
      // Combinar título y contenido para mejor búsqueda
      const fullText = doc.title ? `${doc.title} ${doc.content}` : doc.content;
      const terms = tokenizeSpanish(fullText);

      // Calcular frecuencia de términos
      const termFreq = new Map<string, number>();
      for (const term of terms) {
        termFreq.set(term, (termFreq.get(term) || 0) + 1);
      }

      this.documents.set(doc.id, {
        id: doc.id,
        terms,
        termFreq,
        length: terms.length,
        metadata: doc.metadata,
      });
    }

    this.isIndexed = false;
  }

  /**
   * Añade un documento individual
   */
  addDocument(doc: BM25Document): void {
    this.addDocuments([doc]);
  }

  /**
   * Construye el índice BM25 (calcula IDF y avgDocLength)
   */
  buildIndex(): void {
    if (this.isIndexed) return;

    this.documentFreq.clear();
    let totalLength = 0;

    // Calcular document frequency para cada término
    for (const doc of this.documents.values()) {
      const uniqueTerms = new Set(doc.terms);
      for (const term of uniqueTerms) {
        this.documentFreq.set(term, (this.documentFreq.get(term) || 0) + 1);
      }
      totalLength += doc.length;
    }

    this.totalDocs = this.documents.size;
    this.avgDocLength = this.totalDocs > 0 ? totalLength / this.totalDocs : 0;
    this.isIndexed = true;

    console.log('[BM25] Index built:', {
      documentCount: this.totalDocs,
      avgDocLength: this.avgDocLength.toFixed(2),
      uniqueTerms: this.documentFreq.size,
    });
  }

  /**
   * Busca documentos usando BM25
   */
  search(query: string, limit: number = 10): BM25SearchResult[] {
    if (!this.isIndexed) {
      this.buildIndex();
    }

    if (this.totalDocs === 0) {
      return [];
    }

    const queryTerms = tokenizeSpanish(query);

    if (queryTerms.length === 0) {
      return [];
    }

    const scores: Array<{ id: string; score: number; metadata?: Record<string, unknown> }> = [];

    for (const doc of this.documents.values()) {
      let score = 0;

      for (const term of queryTerms) {
        const tf = doc.termFreq.get(term) || 0;
        if (tf === 0) continue;

        const df = this.documentFreq.get(term) || 0;
        if (df === 0) continue;

        // IDF: log((N - df + 0.5) / (df + 0.5))
        const idf = Math.log(
          (this.totalDocs - df + 0.5) / (df + 0.5) + 1
        );

        // BM25 score para este término
        const numerator = tf * (this.config.k1 + 1);
        const denominator =
          tf +
          this.config.k1 *
            (1 - this.config.b + this.config.b * (doc.length / this.avgDocLength));

        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        scores.push({
          id: doc.id,
          score,
          metadata: doc.metadata,
        });
      }
    }

    // Ordenar por score descendente
    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, limit);
  }

  /**
   * Limpia el índice
   */
  clear(): void {
    this.documents.clear();
    this.documentFreq.clear();
    this.avgDocLength = 0;
    this.totalDocs = 0;
    this.isIndexed = false;
  }

  /**
   * Elimina un documento del índice
   */
  removeDocument(docId: string): boolean {
    const deleted = this.documents.delete(docId);
    if (deleted) {
      this.isIndexed = false; // Requiere reconstruir índice
    }
    return deleted;
  }

  /**
   * Recarga documentos desde la base de datos
   */
  async reloadFromDatabase(
    supabase: SupabaseLikeClient,
    tenantId: string
  ): Promise<number> {
    this.clear();

    try {
      // Cargar artículos
      const { data: articles } = await supabase
        .from('ai_knowledge_articles')
        .select('id, title, content')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      // Cargar FAQs
      const { data: faqs } = await supabase
        .from('faqs')
        .select('id, question, answer')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      // Cargar políticas
      const { data: policies } = await supabase
        .from('ai_business_policies')
        .select('id, policy_type, policy_text')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      // Cargar servicios
      const { data: services } = await supabase
        .from('services')
        .select('id, name, description')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      // Añadir artículos
      if (articles && Array.isArray(articles)) {
        this.addDocuments(
          (articles as Array<{ id: string; title: string; content: string }>).map((a) => ({
            id: `article-${a.id}`,
            content: a.content || '',
            title: a.title || '',
            metadata: { type: 'article', title: a.title },
          }))
        );
      }

      // Añadir FAQs
      if (faqs && Array.isArray(faqs)) {
        this.addDocuments(
          (faqs as Array<{ id: string; question: string; answer: string }>).map((f) => ({
            id: `faq-${f.id}`,
            content: f.answer || '',
            title: f.question || '',
            metadata: { type: 'faq', title: f.question },
          }))
        );
      }

      // Añadir políticas
      if (policies && Array.isArray(policies)) {
        this.addDocuments(
          (policies as Array<{ id: string; policy_type: string; policy_text: string }>).map((p) => ({
            id: `policy-${p.id}`,
            content: p.policy_text || '',
            title: p.policy_type || '',
            metadata: { type: 'policy', title: p.policy_type },
          }))
        );
      }

      // Añadir servicios
      if (services && Array.isArray(services)) {
        this.addDocuments(
          (services as Array<{ id: string; name: string; description: string }>).map((s) => ({
            id: `service-${s.id}`,
            content: s.description || '',
            title: s.name || '',
            metadata: { type: 'service', title: s.name },
          }))
        );
      }

      this.buildIndex();
      return this.documents.size;
    } catch (error) {
      console.error('[BM25] Error reloading from database:', error);
      return 0;
    }
  }

  /**
   * Obtiene estadísticas del índice
   */
  getStats(): {
    documentCount: number;
    isIndexed: boolean;
    avgDocLength: number;
    uniqueTerms: number;
  } {
    return {
      documentCount: this.documents.size,
      isIndexed: this.isIndexed,
      avgDocLength: this.avgDocLength,
      uniqueTerms: this.documentFreq.size,
    };
  }
}

// ============================================
// CACHÉ DE ÍNDICES POR TENANT
// ============================================

interface TenantIndexEntry {
  service: BM25Service;
  createdAt: number;
  lastUsed: number;
}

const tenantIndexes = new Map<string, TenantIndexEntry>();
const INDEX_TTL_MS = 30 * 60 * 1000; // 30 minutos
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Limpiar cada 5 minutos

// Limpieza periódica de índices expirados
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

function startCleanupInterval(): void {
  if (cleanupIntervalId) return;

  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    for (const [tenantId, entry] of tenantIndexes.entries()) {
      if (now - entry.lastUsed > INDEX_TTL_MS) {
        tenantIndexes.delete(tenantId);
        console.log(`[BM25] Evicted expired index for tenant: ${tenantId}`);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Obtiene o crea el índice BM25 para un tenant
 */
export async function getBM25Index(
  supabase: SupabaseLikeClient,
  tenantId: string,
  forceReload: boolean = false
): Promise<BM25Service> {
  startCleanupInterval();

  const existing = tenantIndexes.get(tenantId);

  if (existing && !forceReload) {
    existing.lastUsed = Date.now();
    return existing.service;
  }

  // Crear nuevo índice
  const service = new BM25Service();
  await service.reloadFromDatabase(supabase, tenantId);

  tenantIndexes.set(tenantId, {
    service,
    createdAt: Date.now(),
    lastUsed: Date.now(),
  });

  console.log(`[BM25] Created index for tenant: ${tenantId}`);
  return service;
}

/**
 * Invalida el índice de un tenant
 */
export function clearBM25Index(tenantId: string): void {
  tenantIndexes.delete(tenantId);
  console.log(`[BM25] Cleared index for tenant: ${tenantId}`);
}

/**
 * Invalida todos los índices
 */
export function clearAllBM25Indexes(): void {
  tenantIndexes.clear();
  console.log('[BM25] Cleared all indexes');
}

/**
 * Detiene el cleanup interval y limpia recursos
 * Usar en graceful shutdown
 */
export function shutdownBM25Service(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.log('[BM25] Cleanup interval stopped');
  }
  tenantIndexes.clear();
  console.log('[BM25] Service shutdown complete');
}

/**
 * Obtiene estadísticas de todos los índices en caché
 */
export function getBM25CacheStats(): {
  tenantCount: number;
  totalDocuments: number;
  tenants: Array<{ tenantId: string; documentCount: number; ageMs: number }>;
} {
  const now = Date.now();
  const tenants: Array<{ tenantId: string; documentCount: number; ageMs: number }> = [];
  let totalDocuments = 0;

  for (const [tenantId, entry] of tenantIndexes.entries()) {
    const stats = entry.service.getStats();
    totalDocuments += stats.documentCount;
    tenants.push({
      tenantId,
      documentCount: stats.documentCount,
      ageMs: now - entry.createdAt,
    });
  }

  return {
    tenantCount: tenantIndexes.size,
    totalDocuments,
    tenants,
  };
}

export default BM25Service;

// =====================================================
// TIS TIS PLATFORM - Embedding Service
// Servicio para generar y gestionar embeddings para RAG
// V7.3: Hybrid Search + Re-ranking + Query Enhancement + FASE 3 Mejoras
// =====================================================
//
// Este servicio maneja:
// - Generación de embeddings con OpenAI text-embedding-3-small
// - Actualización de embeddings en base de datos
// - Búsqueda semántica en knowledge base
// - V7.2: Hybrid Search (semántica + keywords)
// - V7.2: Re-ranking con metadatos y recency
// - V7.2: Context Sufficiency Check
//
// MEJORAS FASE 3 (2026):
// - MEJORA-3.1: Semantic Chunking (chunking.service.ts)
// - MEJORA-3.2: BM25 Real (bm25.service.ts)
// - MEJORA-3.3: RRF Fusion (rrf.ts)
// - MEJORA-3.4: Embedding Cache (embedding-cache.service.ts)
// - MEJORA-3.5: Recency Boost Activation
//
// MODELO: text-embedding-3-small (1536 dimensiones)
// - Más económico que text-embedding-ada-002
// - Mejor rendimiento en español
// - Suficiente para knowledge base empresarial
// =====================================================

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import {
  QueryEnhancementService,
  type EnhancedQuery,
  type QueryEnhancementConfig,
} from './query-enhancement.service';

// MEJORA-3.1: Chunking Service
import { getChunkingService } from './chunking.service';

// MEJORA-3.2: BM25 Service
import { getBM25Index } from './bm25.service';

// MEJORA-3.3: RRF Fusion
import {
  fuseTwoLists,
  normalizeRRFScores,
  type RankedDocument,
} from '../utils/rrf';

// MEJORA-3.4: Embedding Cache
import { getEmbeddingCacheService } from './embedding-cache.service';

// ======================
// TYPES
// ======================

export interface EmbeddingResult {
  embedding: number[];
  tokens_used: number;
}

export interface SemanticSearchResult {
  source_type: 'knowledge_article' | 'faq' | 'policy' | 'service';
  source_id: string;
  title: string;
  content: string;
  category: string;
  similarity: number;
}

/**
 * V7.2: Resultado enriquecido con metadatos para re-ranking
 */
export interface EnrichedSearchResult extends SemanticSearchResult {
  /** Score combinado después de re-ranking */
  final_score: number;
  /** Score semántico original */
  semantic_score: number;
  /** Score de keywords matching */
  keyword_score: number;
  /** Boost por recency (contenido reciente) */
  recency_boost: number;
  /** Boost por categoría match */
  category_boost: number;
  /** Indica si el contexto es suficiente */
  context_sufficient: boolean;
  /** MEJORA-3.5: Fecha de actualización (para recency boost) */
  updated_at?: string;
}

/**
 * MEJORA-3.1: Resultado de búsqueda en chunks
 */
export interface ChunkSearchResult {
  chunk_id: string;
  source_id: string;
  source_type: string;
  content: string;
  chunk_index: number;
  total_chunks: number;
  headings: string[];
  keywords: string[];
  similarity: number;
}

/**
 * V7.2: Opciones para búsqueda avanzada
 */
export interface AdvancedSearchOptions {
  /** Número máximo de resultados */
  limit?: number;
  /** Threshold de similitud mínimo */
  similarityThreshold?: number;
  /** Habilitar hybrid search (semántica + keywords) */
  enableHybridSearch?: boolean;
  /** Habilitar re-ranking con metadatos */
  enableReranking?: boolean;
  /** Categorías preferidas (boost) */
  preferredCategories?: string[];
  /** Configuración de Query Enhancement */
  queryEnhancementConfig?: QueryEnhancementConfig;
  /** Peso de búsqueda semántica vs keywords (0-1) */
  semanticWeight?: number;
}

/**
 * V7.2: Resultado de búsqueda avanzada
 */
export interface AdvancedSearchResponse {
  /** Resultados ordenados por relevancia */
  results: EnrichedSearchResult[];
  /** Query mejorada que se usó */
  enhancedQuery: EnhancedQuery;
  /** Métricas de la búsqueda */
  metrics: {
    totalResults: number;
    semanticResults: number;
    keywordResults: number;
    processingTimeMs: number;
    contextSufficiencyScore: number;
  };
}

export interface PendingEmbedding {
  source_type: string;
  id: string;
  tenant_id: string;
  title: string;
  text_content: string;
  embedding_updated_at: string | null;
}

// ======================
// CONFIGURATION
// ======================

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_SIMILARITY_THRESHOLD = 0.5;
const MAX_TEXT_LENGTH = 8000; // ~2000 tokens aproximadamente

/**
 * V7.2: Configuración de re-ranking
 */
const RERANKING_CONFIG = {
  // Peso de cada factor en el score final
  weights: {
    semantic: 0.5,      // Similitud semántica
    keyword: 0.25,      // Match de keywords
    recency: 0.1,       // Contenido reciente
    category: 0.15,     // Match de categoría preferida
  },
  // Boost por recency (días)
  recencyBoosts: {
    7: 0.1,    // Última semana
    30: 0.05,  // Último mes
    90: 0.02,  // Último trimestre
  },
  // Threshold mínimo para considerar contexto suficiente
  contextSufficiencyThreshold: 0.6,
};

// ======================
// EMBEDDING SERVICE
// ======================

class EmbeddingServiceClass {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Genera embedding para un texto dado
   * MEJORA-3.4: Utiliza caché para reducir latencia y costos
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // Truncar texto si es muy largo
    const truncatedText =
      text.length > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) : text;

    try {
      // MEJORA-3.4: Usar caché de embeddings
      const cacheService = getEmbeddingCacheService();
      const { embedding, fromCache } = await cacheService.getOrGenerate(
        truncatedText,
        EMBEDDING_MODEL,
        async () => {
          // Generar embedding si no está en caché
          const response = await this.openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: truncatedText,
            dimensions: EMBEDDING_DIMENSIONS,
          });
          return response.data[0].embedding;
        }
      );

      if (fromCache) {
        console.log('[embedding] Cache hit for query');
      }

      return {
        embedding,
        tokens_used: fromCache ? 0 : Math.ceil(truncatedText.length / 4), // Estimación si viene de caché
      };
    } catch (error) {
      console.error('[embedding] Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Genera embeddings para múltiples textos en batch
   * Más eficiente que llamar generateEmbedding múltiples veces
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<EmbeddingResult[]> {
    // Truncar textos largos
    const truncatedTexts = texts.map(text =>
      text.length > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) : text
    );

    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncatedTexts,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      const tokensPerItem = Math.ceil(response.usage.total_tokens / texts.length);

      return response.data.map(item => ({
        embedding: item.embedding,
        tokens_used: tokensPerItem,
      }));
    } catch (error) {
      console.error('[embedding] Error generating batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Búsqueda semántica básica en knowledge base
   * (Mantiene compatibilidad con V7.1)
   */
  async searchKnowledgeBase(
    tenantId: string,
    query: string,
    limit: number = 5,
    similarityThreshold: number = DEFAULT_SIMILARITY_THRESHOLD
  ): Promise<SemanticSearchResult[]> {
    // 1. Generar embedding de la consulta
    const queryEmbedding = await this.generateEmbedding(query);

    // 2. Buscar en Supabase usando la función RPC
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      const { data, error } = await supabase.rpc('search_knowledge_base_semantic', {
        p_tenant_id: tenantId,
        p_query_embedding: `[${queryEmbedding.embedding.join(',')}]`,
        p_limit: limit,
        p_similarity_threshold: similarityThreshold,
      });

      if (error) {
        console.error('[embedding] Semantic search error:', error);
        throw error;
      }

      return (data || []) as SemanticSearchResult[];
    } catch (error) {
      console.error('[embedding] Search knowledge base error:', error);
      throw error;
    }
  }

  /**
   * V7.2: Búsqueda avanzada con Query Enhancement, Hybrid Search y Re-ranking
   * Esta es la función principal recomendada para RAG en producción
   */
  async searchKnowledgeBaseAdvanced(
    tenantId: string,
    query: string,
    options: AdvancedSearchOptions = {}
  ): Promise<AdvancedSearchResponse> {
    const startTime = Date.now();
    const {
      limit = 5,
      similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
      enableHybridSearch = true,
      enableReranking = true,
      preferredCategories = [],
      queryEnhancementConfig = {},
      semanticWeight = 0.6,
    } = options;

    // 1. Query Enhancement
    const enhancedQuery = QueryEnhancementService.enhance(query, queryEnhancementConfig);
    console.log(`[embedding] Enhanced query: "${query}" -> "${enhancedQuery.rewritten}"`);

    // 2. Búsqueda semántica con query mejorada
    const semanticResults = await this.searchKnowledgeBase(
      tenantId,
      enhancedQuery.rewritten,
      limit * 2, // Obtener más resultados para re-ranking
      similarityThreshold * 0.8 // Threshold más permisivo, re-ranking filtrará
    );

    // 3. Hybrid Search: búsqueda por keywords en paralelo
    let keywordResults: SemanticSearchResult[] = [];
    if (enableHybridSearch && enhancedQuery.keywords.length > 0) {
      keywordResults = await this.searchByKeywords(tenantId, enhancedQuery.keywords, limit);
    }

    // 4. Combinar y deduplicar resultados
    const combinedResults = this.combineResults(semanticResults, keywordResults, semanticWeight);

    // 5. Re-ranking con metadatos
    let enrichedResults: EnrichedSearchResult[];
    if (enableReranking) {
      enrichedResults = this.rerankResults(combinedResults, enhancedQuery, preferredCategories);
    } else {
      enrichedResults = combinedResults.map(r => ({
        ...r,
        final_score: r.similarity,
        semantic_score: r.similarity,
        keyword_score: 0,
        recency_boost: 0,
        category_boost: 0,
        context_sufficient: r.similarity >= RERANKING_CONFIG.contextSufficiencyThreshold,
      }));
    }

    // 6. Ordenar por score final y limitar
    enrichedResults.sort((a, b) => b.final_score - a.final_score);
    enrichedResults = enrichedResults.slice(0, limit);

    // 7. Calcular Context Sufficiency Score
    const contextSufficiencyScore = this.calculateContextSufficiency(enrichedResults);

    const processingTimeMs = Date.now() - startTime;
    console.log(`[embedding] Advanced search completed in ${processingTimeMs}ms | ${enrichedResults.length} results | sufficiency=${contextSufficiencyScore.toFixed(2)}`);

    return {
      results: enrichedResults,
      enhancedQuery,
      metrics: {
        totalResults: enrichedResults.length,
        semanticResults: semanticResults.length,
        keywordResults: keywordResults.length,
        processingTimeMs,
        contextSufficiencyScore,
      },
    };
  }

  /**
   * V7.2 + MEJORA-3.2: Búsqueda por keywords usando BM25 real
   */
  private async searchByKeywords(
    tenantId: string,
    keywords: string[],
    limit: number
  ): Promise<SemanticSearchResult[]> {
    if (keywords.length === 0) return [];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // MEJORA-3.2: Usar BM25 real en lugar de ILIKE
      const bm25Index = await getBM25Index(supabase, tenantId);
      const query = keywords.join(' ');
      const bm25Results = bm25Index.search(query, limit * 2);

      if (bm25Results.length === 0) {
        console.log('[embedding] No BM25 results, falling back to ILIKE');
        return this.searchByKeywordsLegacy(tenantId, keywords, limit);
      }

      console.log('[embedding] BM25 search results:', {
        tenantId,
        query: query.substring(0, 50),
        resultsCount: bm25Results.length,
      });

      // Necesitamos obtener el contenido completo de los documentos
      const results: SemanticSearchResult[] = [];

      // FIX: Normalizar usando el max score real de los resultados
      const maxScore = bm25Results.length > 0 ? Math.max(...bm25Results.map(r => r.score)) : 1;
      const normalizeScore = (score: number) => maxScore > 0 ? score / maxScore : 0;

      for (const bm25Result of bm25Results.slice(0, limit)) {
        // Parsear el ID para obtener tipo y ID real
        const [type, ...idParts] = bm25Result.id.split('-');
        const sourceId = idParts.join('-');

        // Normalizar score BM25 al rango 0-1 usando el max score real
        const normalizedScore = normalizeScore(bm25Result.score);

        results.push({
          source_type: type === 'article' ? 'knowledge_article' : (type as SemanticSearchResult['source_type']),
          source_id: sourceId,
          title: (bm25Result.metadata?.title as string) || '',
          content: '', // El contenido se obtiene del documento original si es necesario
          category: (bm25Result.metadata?.type as string) || 'general',
          similarity: normalizedScore,
        });
      }

      return results;
    } catch (error) {
      console.error('[embedding] BM25 search error, falling back to ILIKE:', error);
      return this.searchByKeywordsLegacy(tenantId, keywords, limit);
    }
  }

  /**
   * Búsqueda legacy por keywords usando ILIKE (fallback)
   */
  private async searchByKeywordsLegacy(
    tenantId: string,
    keywords: string[],
    limit: number
  ): Promise<SemanticSearchResult[]> {
    if (keywords.length === 0) return [];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // Sanitizar keywords
      const sanitizeKeyword = (k: string) =>
        k
          .replace(/[%_\\]/g, '')
          .replace(/[^\p{L}\p{N}\s]/gu, '')
          .trim();

      const keywordsToSearch = keywords
        .slice(0, 3)
        .map(sanitizeKeyword)
        .filter((k) => k.length > 1);

      if (keywordsToSearch.length === 0) return [];

      const articleFilters = keywordsToSearch
        .map((k) => `title.ilike.%${k}%,content.ilike.%${k}%`)
        .join(',');
      const faqFilters = keywordsToSearch
        .map((k) => `question.ilike.%${k}%,answer.ilike.%${k}%`)
        .join(',');

      // Buscar en knowledge_articles
      const { data: articles } = await supabase
        .from('ai_knowledge_articles')
        .select('id, title, content, category, updated_at')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .or(articleFilters)
        .limit(limit);

      // Buscar en FAQs
      const { data: faqs } = await supabase
        .from('faqs')
        .select('id, question, answer, category, updated_at')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .or(faqFilters)
        .limit(limit);

      const results: SemanticSearchResult[] = [];

      if (articles) {
        for (const article of articles) {
          const keywordScore = this.calculateKeywordScore(
            `${article.title} ${article.content}`,
            keywords
          );
          if (keywordScore > 0.1) {
            results.push({
              source_type: 'knowledge_article',
              source_id: article.id,
              title: article.title,
              content: article.content,
              category: article.category || 'general',
              similarity: keywordScore,
            });
          }
        }
      }

      if (faqs) {
        for (const faq of faqs) {
          const keywordScore = this.calculateKeywordScore(
            `${faq.question} ${faq.answer}`,
            keywords
          );
          if (keywordScore > 0.1) {
            results.push({
              source_type: 'faq',
              source_id: faq.id,
              title: faq.question,
              content: faq.answer,
              category: faq.category || 'general',
              similarity: keywordScore,
            });
          }
        }
      }

      return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
    } catch (error) {
      console.error('[embedding] Legacy keyword search error:', error);
      return [];
    }
  }

  /**
   * V7.2: Calcula score de matching de keywords
   * Score ponderado: keywords al inicio de la lista tienen más peso
   */
  private calculateKeywordScore(text: string, keywords: string[]): number {
    if (keywords.length === 0) return 0;

    const lowerText = text.toLowerCase();
    let totalWeight = 0;

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i].toLowerCase();
      // Keywords anteriores tienen más peso (más importantes)
      const weight = 1 - (i * 0.1);

      if (lowerText.includes(keyword)) {
        totalWeight += weight;
      }
    }

    return totalWeight / keywords.length;
  }

  /**
   * V7.2 + MEJORA-3.3: Combina resultados usando RRF (Reciprocal Rank Fusion)
   * RRF es más robusto que la combinación lineal porque no depende de la escala de scores
   */
  private combineResults(
    semanticResults: SemanticSearchResult[],
    keywordResults: SemanticSearchResult[],
    semanticWeight: number
  ): SemanticSearchResult[] {
    // Early return si no hay resultados
    if (semanticResults.length === 0 && keywordResults.length === 0) {
      return [];
    }

    // Si solo hay un tipo de resultados, retornarlos directamente
    if (keywordResults.length === 0) {
      return semanticResults;
    }
    if (semanticResults.length === 0) {
      return keywordResults;
    }

    // MEJORA-3.3: Usar RRF para combinar resultados
    // Convertir a formato RankedDocument
    const semanticRanked: RankedDocument<SemanticSearchResult>[] = semanticResults.map((r, index) => ({
      id: `${r.source_type}-${r.source_id}`,
      score: r.similarity,
      rank: index + 1,
      document: r,
    }));

    const keywordRanked: RankedDocument<SemanticSearchResult>[] = keywordResults.map((r, index) => ({
      id: `${r.source_type}-${r.source_id}`,
      score: r.similarity,
      rank: index + 1,
      document: r,
    }));

    // Aplicar RRF con pesos configurables
    // Asegurar que los pesos sean positivos
    const clampedSemanticWeight = Math.max(0.1, Math.min(1, semanticWeight));
    const keywordWeight = Math.max(0.1, 1 - clampedSemanticWeight);
    const rrfResults = fuseTwoLists<SemanticSearchResult>(
      semanticRanked,
      keywordRanked,
      clampedSemanticWeight,
      keywordWeight,
      60 // k=60 es el valor estándar de RRF
    );

    // Normalizar scores RRF a rango 0-1
    const normalizedResults = normalizeRRFScores(rrfResults);

    console.log('[embedding] RRF fusion completed:', {
      semanticCount: semanticResults.length,
      keywordCount: keywordResults.length,
      fusedCount: normalizedResults.length,
    });

    // Convertir de vuelta a SemanticSearchResult
    return normalizedResults.map(r => ({
      ...r.document,
      similarity: r.rrfScore,
    }));
  }

  /**
   * V7.2 + MEJORA-3.5: Re-ranking de resultados con metadatos y recency boost real
   */
  private rerankResults(
    results: SemanticSearchResult[],
    enhancedQuery: EnhancedQuery,
    preferredCategories: string[]
  ): EnrichedSearchResult[] {
    const { weights, recencyBoosts } = RERANKING_CONFIG;

    return results.map(result => {
      // Score semántico
      const semanticScore = result.similarity;

      // Score de keywords
      const keywordScore = this.calculateKeywordScore(
        `${result.title} ${result.content}`,
        enhancedQuery.keywords
      );

      // MEJORA-3.5: Boost por recency real usando updated_at
      let recencyBoost = 0;
      const enrichedResult = result as EnrichedSearchResult;
      if (enrichedResult.updated_at) {
        const updatedAt = new Date(enrichedResult.updated_at);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff <= 7) {
          recencyBoost = recencyBoosts[7]; // 0.1 para última semana
        } else if (daysDiff <= 30) {
          recencyBoost = recencyBoosts[30]; // 0.05 para último mes
        } else if (daysDiff <= 90) {
          recencyBoost = recencyBoosts[90]; // 0.02 para último trimestre
        }
      }

      // Boost por categoría preferida
      let categoryBoost = 0;
      if (preferredCategories.length > 0) {
        if (preferredCategories.includes(result.category)) {
          categoryBoost = 0.15;
        } else if (enhancedQuery.categories.includes(result.category)) {
          categoryBoost = 0.1;
        }
      } else if (enhancedQuery.categories.includes(result.category)) {
        categoryBoost = 0.1;
      }

      // Calcular score final
      const finalScore =
        semanticScore * weights.semantic +
        keywordScore * weights.keyword +
        recencyBoost * weights.recency +
        categoryBoost * weights.category;

      // Determinar si el contexto es suficiente
      const contextSufficient = finalScore >= RERANKING_CONFIG.contextSufficiencyThreshold;

      return {
        ...result,
        final_score: finalScore,
        semantic_score: semanticScore,
        keyword_score: keywordScore,
        recency_boost: recencyBoost,
        category_boost: categoryBoost,
        context_sufficient: contextSufficient,
        updated_at: enrichedResult.updated_at,
      };
    });
  }

  /**
   * V7.2: Calcula el score de suficiencia de contexto
   * Basado en: Google Research "Deeper insights into RAG: Sufficient Context"
   */
  private calculateContextSufficiency(results: EnrichedSearchResult[]): number {
    if (results.length === 0) return 0;

    // Factores que determinan si hay suficiente contexto:
    // 1. Al menos un resultado con alta confianza
    // 2. Diversidad de fuentes
    // 3. Coverage de la query

    const topResult = results[0];
    const hasHighConfidence = topResult.final_score >= 0.7;

    // Diversidad de tipos de fuente
    const sourceTypes = new Set(results.map(r => r.source_type));
    const diversityScore = Math.min(sourceTypes.size / 3, 1);

    // Coverage: promedio de scores de los top 3
    const top3Avg = results.slice(0, 3).reduce((sum, r) => sum + r.final_score, 0) / Math.min(3, results.length);

    // Score combinado
    const sufficiencyScore = (
      (hasHighConfidence ? 0.4 : 0.2) +
      (diversityScore * 0.3) +
      (top3Avg * 0.3)
    );

    return Math.min(sufficiencyScore, 1);
  }

  /**
   * V7.2: Verifica si hay suficiente contexto para responder
   * Retorna true si el agente debería responder, false si debería escalar o pedir más info
   */
  isContextSufficient(searchResponse: AdvancedSearchResponse): boolean {
    const { metrics, results } = searchResponse;

    // Sin resultados = contexto insuficiente
    if (results.length === 0) return false;

    // Score de suficiencia muy bajo
    if (metrics.contextSufficiencyScore < 0.4) return false;

    // Top result con score muy bajo
    if (results[0].final_score < 0.5) return false;

    return true;
  }

  /**
   * Actualiza el embedding de un knowledge article
   */
  async updateKnowledgeArticleEmbedding(articleId: string, content: string): Promise<void> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const result = await this.generateEmbedding(content);

    const { error } = await supabase.rpc('update_knowledge_article_embedding', {
      p_article_id: articleId,
      p_embedding: `[${result.embedding.join(',')}]`,
    });

    if (error) {
      console.error('[embedding] Update article embedding error:', error);
      throw error;
    }

    console.log(`[embedding] Updated embedding for knowledge_article ${articleId}`);
  }

  /**
   * Actualiza el embedding de una FAQ
   */
  async updateFaqEmbedding(faqId: string, question: string, answer: string): Promise<void> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Combinar pregunta y respuesta para mejor búsqueda semántica
    const fullText = `${question} ${answer}`;
    const result = await this.generateEmbedding(fullText);

    const { error } = await supabase.rpc('update_faq_embedding', {
      p_faq_id: faqId,
      p_embedding: `[${result.embedding.join(',')}]`,
    });

    if (error) {
      console.error('[embedding] Update FAQ embedding error:', error);
      throw error;
    }

    console.log(`[embedding] Updated embedding for faq ${faqId}`);
  }

  /**
   * Actualiza el embedding de una política
   */
  async updatePolicyEmbedding(policyId: string, title: string, policyText: string): Promise<void> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fullText = `${title} ${policyText}`;
    const result = await this.generateEmbedding(fullText);

    const { error } = await supabase.rpc('update_policy_embedding', {
      p_policy_id: policyId,
      p_embedding: `[${result.embedding.join(',')}]`,
    });

    if (error) {
      console.error('[embedding] Update policy embedding error:', error);
      throw error;
    }

    console.log(`[embedding] Updated embedding for policy ${policyId}`);
  }

  /**
   * Actualiza el embedding de un servicio
   */
  async updateServiceEmbedding(serviceId: string, name: string, description: string): Promise<void> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fullText = `${name} ${description}`;
    const result = await this.generateEmbedding(fullText);

    const { error } = await supabase.rpc('update_service_embedding', {
      p_service_id: serviceId,
      p_embedding: `[${result.embedding.join(',')}]`,
    });

    if (error) {
      console.error('[embedding] Update service embedding error:', error);
      throw error;
    }

    console.log(`[embedding] Updated embedding for service ${serviceId}`);
  }

  /**
   * Obtiene contenido pendiente de embedding para un tenant
   */
  async getPendingEmbeddings(tenantId?: string): Promise<PendingEmbedding[]> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('v_pending_embeddings')
      .select('*');

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('[embedding] Get pending embeddings error:', error);
      throw error;
    }

    return (data || []) as PendingEmbedding[];
  }

  /**
   * Procesa embeddings pendientes en batch
   * Útil para jobs de background
   */
  async processPendingEmbeddings(tenantId?: string, batchSize: number = 10): Promise<{
    processed: number;
    errors: number;
  }> {
    const pending = await this.getPendingEmbeddings(tenantId);
    let processed = 0;
    let errors = 0;

    // Procesar en batches
    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);

      // Generar embeddings en batch
      const texts = batch.map(item => item.text_content);

      try {
        const embeddings = await this.generateEmbeddingsBatch(texts);

        // Actualizar cada item
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const embedding = embeddings[j];

          try {
            const supabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            let updateFn: string;
            switch (item.source_type) {
              case 'knowledge_article':
                updateFn = 'update_knowledge_article_embedding';
                break;
              case 'faq':
                updateFn = 'update_faq_embedding';
                break;
              case 'policy':
                updateFn = 'update_policy_embedding';
                break;
              case 'service':
                updateFn = 'update_service_embedding';
                break;
              default:
                continue;
            }

            const paramName = `p_${item.source_type === 'knowledge_article' ? 'article' : item.source_type}_id`;
            const { error } = await supabase.rpc(updateFn, {
              [paramName]: item.id,
              p_embedding: `[${embedding.embedding.join(',')}]`,
            });

            if (error) {
              console.error(`[embedding] Error updating ${item.source_type} ${item.id}:`, error);
              errors++;
            } else {
              processed++;
            }
          } catch (updateError) {
            console.error(`[embedding] Error updating item ${item.id}:`, updateError);
            errors++;
          }
        }
      } catch (batchError) {
        console.error('[embedding] Batch generation error:', batchError);
        errors += batch.length;
      }
    }

    console.log(`[embedding] Processed ${processed} embeddings, ${errors} errors`);
    return { processed, errors };
  }

  // ============================================
  // MEJORA-3.1: MÉTODOS DE CHUNKS
  // ============================================

  /**
   * MEJORA-3.1: Busca en chunks semánticos
   * Usa la tabla ai_knowledge_chunks para búsqueda más precisa
   */
  async searchKnowledgeChunks(
    tenantId: string,
    query: string,
    options: {
      limit?: number;
      similarityThreshold?: number;
      sourceTypes?: string[];
    } = {}
  ): Promise<ChunkSearchResult[]> {
    const {
      limit = 5,
      similarityThreshold = 0.5,
      sourceTypes = null,
    } = options;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // Generar embedding de la query
      const queryEmbedding = await this.generateEmbedding(query);

      // Buscar en chunks usando la función RPC
      const { data, error } = await supabase.rpc('search_knowledge_chunks', {
        p_tenant_id: tenantId,
        p_query_embedding: `[${queryEmbedding.embedding.join(',')}]`,
        p_limit: limit,
        p_similarity_threshold: similarityThreshold,
        p_source_types: sourceTypes,
      });

      if (error) {
        console.error('[embedding] Chunk search error:', error);
        throw error;
      }

      console.log(`[embedding] Chunk search: ${(data || []).length} results for tenant ${tenantId}`);

      return (data || []).map((row: {
        chunk_id: string;
        source_id: string;
        source_type: string;
        content: string;
        chunk_index: number;
        total_chunks: number;
        headings: string[];
        keywords: string[];
        similarity: number;
      }) => ({
        chunk_id: row.chunk_id,
        source_id: row.source_id,
        source_type: row.source_type,
        content: row.content,
        chunk_index: row.chunk_index,
        total_chunks: row.total_chunks,
        headings: row.headings || [],
        keywords: row.keywords || [],
        similarity: row.similarity,
      }));
    } catch (error) {
      console.error('[embedding] Search knowledge chunks error:', error);
      throw error;
    }
  }

  /**
   * MEJORA-3.1: Procesa un documento dividiéndolo en chunks con embeddings
   * Ideal para documentos largos que necesitan búsqueda granular
   */
  async processDocumentWithChunking(
    tenantId: string,
    sourceId: string,
    sourceType: 'article' | 'faq' | 'policy' | 'service',
    content: string,
    title?: string
  ): Promise<{
    chunksCreated: number;
    embeddingsGenerated: number;
    processingTimeMs: number;
  }> {
    const startTime = Date.now();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // 1. Obtener servicio de chunking
      const chunkingService = getChunkingService();

      // 2. Dividir documento en chunks
      const fullContent = title ? `${title}\n\n${content}` : content;
      const chunkingResult = await chunkingService.chunkText(
        fullContent,
        sourceId,
        sourceType
      );

      console.log(`[embedding] Chunking complete: ${chunkingResult.totalChunks} chunks, avg size ${Math.round(chunkingResult.avgChunkSize)}`);

      // 3. Eliminar chunks existentes del documento
      const { error: deleteError } = await supabase.rpc('regenerate_document_chunks', {
        p_tenant_id: tenantId,
        p_source_id: sourceId,
        p_source_type: sourceType,
      });

      if (deleteError) {
        console.warn('[embedding] Error deleting existing chunks:', deleteError);
      }

      // 4. Generar embeddings en batch
      const chunkTexts = chunkingResult.chunks.map(c => c.content);
      const embeddings = await this.generateEmbeddingsBatch(chunkTexts);

      // 5. Insertar chunks con embeddings
      let embeddingsGenerated = 0;
      for (let i = 0; i < chunkingResult.chunks.length; i++) {
        const chunk = chunkingResult.chunks[i];
        const embedding = embeddings[i];

        // Generar hash del contenido para deduplicación
        const contentHash = createHash('sha256')
          .update(chunk.content)
          .digest('hex');

        const { error: insertError } = await supabase
          .from('ai_knowledge_chunks')
          .insert({
            tenant_id: tenantId,
            source_id: sourceId,
            source_type: sourceType,
            content: chunk.content,
            content_hash: contentHash,
            embedding: `[${embedding.embedding.join(',')}]`,
            embedding_model: EMBEDDING_MODEL,
            embedding_updated_at: new Date().toISOString(),
            chunk_index: chunk.index,
            total_chunks: chunk.totalChunks,
            start_char: chunk.metadata.startChar,
            end_char: chunk.metadata.endChar,
            word_count: chunk.metadata.wordCount,
            has_overlap_before: chunk.metadata.hasOverlapBefore,
            has_overlap_after: chunk.metadata.hasOverlapAfter,
            headings: chunk.metadata.headings || [],
            keywords: chunk.metadata.keywords || [],
          });

        if (insertError) {
          console.error(`[embedding] Error inserting chunk ${i}:`, insertError);
        } else {
          embeddingsGenerated++;
        }
      }

      const processingTimeMs = Date.now() - startTime;
      console.log(`[embedding] Document processing complete: ${embeddingsGenerated}/${chunkingResult.totalChunks} chunks in ${processingTimeMs}ms`);

      return {
        chunksCreated: chunkingResult.totalChunks,
        embeddingsGenerated,
        processingTimeMs,
      };
    } catch (error) {
      console.error('[embedding] Process document with chunking error:', error);
      throw error;
    }
  }

  /**
   * MEJORA-3.1: Obtiene chunks de un documento específico
   */
  async getDocumentChunks(
    tenantId: string,
    sourceId: string,
    sourceType: string
  ): Promise<{
    chunks: Array<{
      chunk_id: string;
      content: string;
      chunk_index: number;
      total_chunks: number;
      word_count: number;
      headings: string[];
      keywords: string[];
      has_embedding: boolean;
    }>;
    totalChunks: number;
  }> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      const { data, error } = await supabase.rpc('get_document_chunks', {
        p_tenant_id: tenantId,
        p_source_id: sourceId,
        p_source_type: sourceType,
      });

      if (error) {
        console.error('[embedding] Get document chunks error:', error);
        throw error;
      }

      return {
        chunks: data || [],
        totalChunks: (data || []).length,
      };
    } catch (error) {
      console.error('[embedding] Get document chunks error:', error);
      throw error;
    }
  }

  /**
   * MEJORA-3.1: Obtiene estadísticas de chunks por tenant
   */
  async getChunkStats(tenantId: string): Promise<Array<{
    source_type: string;
    total_chunks: number;
    chunks_with_embedding: number;
    avg_word_count: number;
    total_documents: number;
  }>> {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      const { data, error } = await supabase.rpc('get_chunk_stats', {
        p_tenant_id: tenantId,
      });

      if (error) {
        console.error('[embedding] Get chunk stats error:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[embedding] Get chunk stats error:', error);
      throw error;
    }
  }
}

// Singleton export
export const EmbeddingService = new EmbeddingServiceClass();
export default EmbeddingService;

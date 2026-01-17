// =====================================================
// TIS TIS PLATFORM - Embedding Service
// Servicio para generar y gestionar embeddings para RAG
// V7.2: Hybrid Search + Re-ranking + Query Enhancement
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
// MODELO: text-embedding-3-small (1536 dimensiones)
// - Más económico que text-embedding-ada-002
// - Mejor rendimiento en español
// - Suficiente para knowledge base empresarial
//
// Mejores prácticas implementadas (2025-2026):
// - Query Enhancement antes de embedding
// - Hybrid Search para mejor recall
// - Re-ranking para mejor precision
// - Context Sufficiency validation
// =====================================================

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import {
  QueryEnhancementService,
  type EnhancedQuery,
  type QueryEnhancementConfig,
} from './query-enhancement.service';

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
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // Truncar texto si es muy largo
    const truncatedText = text.length > MAX_TEXT_LENGTH
      ? text.substring(0, MAX_TEXT_LENGTH)
      : text;

    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncatedText,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      return {
        embedding: response.data[0].embedding,
        tokens_used: response.usage.total_tokens,
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
   * V7.2: Búsqueda por keywords (para Hybrid Search)
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
      // Construir filtro OR para múltiples keywords (máximo 3 para performance)
      // Sanitizar keywords: escapar caracteres especiales de LIKE (%_) y limpiar
      const sanitizeKeyword = (k: string) =>
        k.replace(/[%_\\]/g, '').replace(/[^\p{L}\p{N}\s]/gu, '').trim();

      const keywordsToSearch = keywords
        .slice(0, 3)
        .map(sanitizeKeyword)
        .filter(k => k.length > 1); // Solo keywords con al menos 2 caracteres

      if (keywordsToSearch.length === 0) return [];

      const articleFilters = keywordsToSearch
        .map(k => `title.ilike.%${k}%,content.ilike.%${k}%`)
        .join(',');
      const faqFilters = keywordsToSearch
        .map(k => `question.ilike.%${k}%,answer.ilike.%${k}%`)
        .join(',');

      // Buscar en knowledge_articles
      const { data: articles } = await supabase
        .from('ai_knowledge_articles')
        .select('id, title, content, category')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .or(articleFilters)
        .limit(limit);

      // Buscar en FAQs
      const { data: faqs } = await supabase
        .from('faqs')
        .select('id, question, answer, category')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .or(faqFilters)
        .limit(limit);

      // Convertir a SemanticSearchResult con score de keyword matching
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
              similarity: keywordScore, // Usar keyword score como similarity
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
      console.error('[embedding] Keyword search error:', error);
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
   * V7.2: Combina resultados de búsqueda semántica y keywords
   */
  private combineResults(
    semanticResults: SemanticSearchResult[],
    keywordResults: SemanticSearchResult[],
    semanticWeight: number
  ): SemanticSearchResult[] {
    const resultMap = new Map<string, SemanticSearchResult & { combinedScore: number }>();
    const keywordWeight = 1 - semanticWeight;

    // Añadir resultados semánticos
    for (const result of semanticResults) {
      const key = `${result.source_type}-${result.source_id}`;
      resultMap.set(key, {
        ...result,
        combinedScore: result.similarity * semanticWeight,
      });
    }

    // Añadir/combinar resultados de keywords
    for (const result of keywordResults) {
      const key = `${result.source_type}-${result.source_id}`;
      const existing = resultMap.get(key);

      if (existing) {
        // Combinar scores
        existing.combinedScore += result.similarity * keywordWeight;
        existing.similarity = existing.combinedScore;
      } else {
        resultMap.set(key, {
          ...result,
          combinedScore: result.similarity * keywordWeight,
        });
      }
    }

    return Array.from(resultMap.values()).map(r => ({
      source_type: r.source_type,
      source_id: r.source_id,
      title: r.title,
      content: r.content,
      category: r.category,
      similarity: r.combinedScore,
    }));
  }

  /**
   * V7.2: Re-ranking de resultados con metadatos
   */
  private rerankResults(
    results: SemanticSearchResult[],
    enhancedQuery: EnhancedQuery,
    preferredCategories: string[]
  ): EnrichedSearchResult[] {
    const { weights } = RERANKING_CONFIG;

    return results.map(result => {
      // Score semántico
      const semanticScore = result.similarity;

      // Score de keywords
      const keywordScore = this.calculateKeywordScore(
        `${result.title} ${result.content}`,
        enhancedQuery.keywords
      );

      // Boost por recency (simplificado - en producción usar updated_at)
      const recencyBoost = 0; // TODO: Implementar con timestamps reales

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
}

// Singleton export
export const EmbeddingService = new EmbeddingServiceClass();
export default EmbeddingService;

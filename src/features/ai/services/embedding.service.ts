// =====================================================
// TIS TIS PLATFORM - Embedding Service
// Servicio para generar y gestionar embeddings para RAG
// =====================================================
//
// Este servicio maneja:
// - Generación de embeddings con OpenAI text-embedding-3-small
// - Actualización de embeddings en base de datos
// - Búsqueda semántica en knowledge base
//
// MODELO: text-embedding-3-small (1536 dimensiones)
// - Más económico que text-embedding-ada-002
// - Mejor rendimiento en español
// - Suficiente para knowledge base empresarial
// =====================================================

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

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
   * Búsqueda semántica en knowledge base usando embeddings
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

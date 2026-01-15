-- =====================================================
-- TIS TIS PLATFORM - RAG Embeddings System
-- Migration 112: Vector Embeddings para Knowledge Base
-- =====================================================
--
-- Este sistema habilita búsqueda semántica (RAG) en:
-- - ai_knowledge_articles
-- - faqs
-- - ai_business_policies
-- - services (ai_description)
--
-- Usa la extensión pgvector de Supabase para almacenar y buscar embeddings.
-- =====================================================

-- =====================================================
-- 1. HABILITAR EXTENSIÓN PGVECTOR (si no está habilitada)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- =====================================================
-- 2. AGREGAR COLUMNAS DE EMBEDDING A TABLAS EXISTENTES
-- =====================================================

-- ai_knowledge_articles: Embedding del contenido completo
ALTER TABLE ai_knowledge_articles
ADD COLUMN IF NOT EXISTS embedding vector(1536),      -- OpenAI text-embedding-3-small dimension
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN ai_knowledge_articles.embedding IS 'Vector embedding (text-embedding-3-small) del contenido para búsqueda semántica';

-- faqs: Embedding de pregunta + respuesta
ALTER TABLE faqs
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN faqs.embedding IS 'Vector embedding de la pregunta + respuesta para búsqueda semántica';

-- ai_business_policies: Embedding de la política
ALTER TABLE ai_business_policies
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN ai_business_policies.embedding IS 'Vector embedding del texto de la política para búsqueda semántica';

-- services: Embedding de la descripción AI
ALTER TABLE services
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN services.embedding IS 'Vector embedding de ai_description para búsqueda semántica';

-- =====================================================
-- 3. ÍNDICES PARA BÚSQUEDA VECTORIAL (IVFFlat)
-- =====================================================
-- Usamos IVFFlat para búsqueda aproximada eficiente
-- lists = sqrt(rows) es una buena aproximación

-- Índice para knowledge_articles
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_embedding
ON ai_knowledge_articles
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 20);

-- Índice para FAQs
CREATE INDEX IF NOT EXISTS idx_faqs_embedding
ON faqs
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 20);

-- Índice para business_policies
CREATE INDEX IF NOT EXISTS idx_business_policies_embedding
ON ai_business_policies
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 10);

-- Índice para services
CREATE INDEX IF NOT EXISTS idx_services_embedding
ON services
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 20);

-- =====================================================
-- 4. FUNCIÓN: Búsqueda Semántica en Knowledge Base
-- =====================================================
-- Esta función busca en todas las fuentes de conocimiento
-- usando similitud de coseno con el embedding de la consulta.

CREATE OR REPLACE FUNCTION search_knowledge_base_semantic(
    p_tenant_id UUID,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 5,
    p_similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    source_type TEXT,
    source_id UUID,
    title TEXT,
    content TEXT,
    category TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH all_results AS (
        -- Buscar en knowledge_articles
        SELECT
            'knowledge_article'::TEXT as source_type,
            ka.id as source_id,
            ka.title,
            ka.content,
            ka.category,
            1 - (ka.embedding <=> p_query_embedding) as similarity
        FROM ai_knowledge_articles ka
        WHERE ka.tenant_id = p_tenant_id
          AND ka.is_active = true
          AND ka.embedding IS NOT NULL

        UNION ALL

        -- Buscar en FAQs
        SELECT
            'faq'::TEXT as source_type,
            f.id as source_id,
            f.question as title,
            f.answer as content,
            COALESCE(f.category, 'general') as category,
            1 - (f.embedding <=> p_query_embedding) as similarity
        FROM faqs f
        WHERE f.tenant_id = p_tenant_id
          AND f.is_active = true
          AND f.embedding IS NOT NULL

        UNION ALL

        -- Buscar en business_policies
        SELECT
            'policy'::TEXT as source_type,
            bp.id as source_id,
            bp.title,
            bp.policy_text as content,
            bp.policy_type as category,
            1 - (bp.embedding <=> p_query_embedding) as similarity
        FROM ai_business_policies bp
        WHERE bp.tenant_id = p_tenant_id
          AND bp.is_active = true
          AND bp.embedding IS NOT NULL

        UNION ALL

        -- Buscar en services (descripción AI)
        SELECT
            'service'::TEXT as source_type,
            s.id as source_id,
            s.name as title,
            COALESCE(s.ai_description, s.description, '') as content,
            COALESCE(s.category, 'general') as category,
            1 - (s.embedding <=> p_query_embedding) as similarity
        FROM services s
        WHERE s.tenant_id = p_tenant_id
          AND s.is_active = true
          AND s.embedding IS NOT NULL
          AND COALESCE(s.ai_description, s.description, '') != ''
    )
    SELECT *
    FROM all_results ar
    WHERE ar.similarity >= p_similarity_threshold
    ORDER BY ar.similarity DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_knowledge_base_semantic IS
'Búsqueda semántica en knowledge base usando embeddings.
Busca en: knowledge_articles, faqs, business_policies, services.
Retorna resultados ordenados por similitud de coseno.';

GRANT EXECUTE ON FUNCTION search_knowledge_base_semantic(UUID, vector, INTEGER, FLOAT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_knowledge_base_semantic(UUID, vector, INTEGER, FLOAT) TO service_role;

-- =====================================================
-- 5. FUNCIÓN: Actualizar embedding de un artículo
-- =====================================================
-- Esta función es llamada desde el backend cuando se actualiza contenido

CREATE OR REPLACE FUNCTION update_knowledge_article_embedding(
    p_article_id UUID,
    p_embedding vector(1536)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE ai_knowledge_articles
    SET
        embedding = p_embedding,
        embedding_updated_at = NOW()
    WHERE id = p_article_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_faq_embedding(
    p_faq_id UUID,
    p_embedding vector(1536)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE faqs
    SET
        embedding = p_embedding,
        embedding_updated_at = NOW()
    WHERE id = p_faq_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_policy_embedding(
    p_policy_id UUID,
    p_embedding vector(1536)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE ai_business_policies
    SET
        embedding = p_embedding,
        embedding_updated_at = NOW()
    WHERE id = p_policy_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_service_embedding(
    p_service_id UUID,
    p_embedding vector(1536)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE services
    SET
        embedding = p_embedding,
        embedding_updated_at = NOW()
    WHERE id = p_service_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_knowledge_article_embedding(UUID, vector) TO service_role;
GRANT EXECUTE ON FUNCTION update_faq_embedding(UUID, vector) TO service_role;
GRANT EXECUTE ON FUNCTION update_policy_embedding(UUID, vector) TO service_role;
GRANT EXECUTE ON FUNCTION update_service_embedding(UUID, vector) TO service_role;

-- =====================================================
-- 6. VISTA: Contenido pendiente de embedding
-- =====================================================
-- Útil para batch processing de embeddings

CREATE OR REPLACE VIEW v_pending_embeddings AS
SELECT
    'knowledge_article' as source_type,
    ka.id,
    ka.tenant_id,
    ka.title,
    ka.content as text_content,
    ka.embedding_updated_at
FROM ai_knowledge_articles ka
WHERE ka.is_active = true
  AND (ka.embedding IS NULL OR ka.embedding_updated_at < ka.updated_at)

UNION ALL

SELECT
    'faq' as source_type,
    f.id,
    f.tenant_id,
    f.question as title,
    f.question || ' ' || f.answer as text_content,
    f.embedding_updated_at
FROM faqs f
WHERE f.is_active = true
  AND (f.embedding IS NULL OR f.embedding_updated_at < f.updated_at)

UNION ALL

SELECT
    'policy' as source_type,
    bp.id,
    bp.tenant_id,
    bp.title,
    bp.title || ' ' || bp.policy_text as text_content,
    bp.embedding_updated_at
FROM ai_business_policies bp
WHERE bp.is_active = true
  AND (bp.embedding IS NULL OR bp.embedding_updated_at < bp.updated_at)

UNION ALL

SELECT
    'service' as source_type,
    s.id,
    s.tenant_id,
    s.name as title,
    s.name || ' ' || COALESCE(s.ai_description, s.description, '') as text_content,
    s.embedding_updated_at
FROM services s
WHERE s.is_active = true
  AND COALESCE(s.ai_description, s.description, '') != ''
  AND (s.embedding IS NULL OR s.embedding_updated_at < s.updated_at);

COMMENT ON VIEW v_pending_embeddings IS
'Vista que muestra contenido que necesita actualización de embeddings.
Usado por el job de batch processing.';

-- =====================================================
-- 7. DOCUMENTACIÓN
-- =====================================================
COMMENT ON EXTENSION vector IS 'pgvector extension for vector similarity search';

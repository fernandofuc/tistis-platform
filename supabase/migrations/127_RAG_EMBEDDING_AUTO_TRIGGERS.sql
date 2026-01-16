-- =====================================================
-- TIS TIS PLATFORM - Migration 127
-- RAG Embedding Auto-Triggers
-- =====================================================
-- Purpose: Automatically mark content as needing embedding update
-- when articles, FAQs, policies, or services are created/updated.
-- This enables the CRON job to process them automatically.
-- =====================================================

-- =====================================================
-- PARTE 1: TRIGGER FUNCTION para marcar embedding pendiente
-- =====================================================
-- Esta función se ejecuta cuando se INSERT/UPDATE contenido
-- y marca embedding_updated_at = NULL para que el CRON lo procese

CREATE OR REPLACE FUNCTION public.mark_embedding_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Solo marcar como pendiente si el contenido relevante cambió
    -- Para INSERT, siempre marcar
    -- Para UPDATE, solo si el contenido cambió

    IF TG_OP = 'INSERT' THEN
        -- Para INSERT, el embedding ya viene NULL por defecto
        -- No necesitamos hacer nada extra
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Verificar si el contenido cambió según la tabla
        CASE TG_TABLE_NAME
            WHEN 'ai_knowledge_articles' THEN
                IF OLD.title IS DISTINCT FROM NEW.title
                   OR OLD.content IS DISTINCT FROM NEW.content
                   OR OLD.tags IS DISTINCT FROM NEW.tags THEN
                    NEW.embedding := NULL;
                    NEW.embedding_updated_at := NULL;
                END IF;

            WHEN 'faqs' THEN
                IF OLD.question IS DISTINCT FROM NEW.question
                   OR OLD.answer IS DISTINCT FROM NEW.answer THEN
                    NEW.embedding := NULL;
                    NEW.embedding_updated_at := NULL;
                END IF;

            WHEN 'ai_business_policies' THEN
                IF OLD.title IS DISTINCT FROM NEW.title
                   OR OLD.content IS DISTINCT FROM NEW.content THEN
                    NEW.embedding := NULL;
                    NEW.embedding_updated_at := NULL;
                END IF;

            WHEN 'services' THEN
                IF OLD.name IS DISTINCT FROM NEW.name
                   OR OLD.description IS DISTINCT FROM NEW.description THEN
                    NEW.embedding := NULL;
                    NEW.embedding_updated_at := NULL;
                END IF;
        END CASE;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION mark_embedding_pending IS
'Automatically marks content as needing embedding regeneration when relevant fields change.
Used by triggers on ai_knowledge_articles, faqs, ai_business_policies, and services tables.';


-- =====================================================
-- PARTE 2: TRIGGERS para cada tabla
-- =====================================================

-- Trigger para ai_knowledge_articles
DROP TRIGGER IF EXISTS trg_mark_embedding_pending_articles ON public.ai_knowledge_articles;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'ai_knowledge_articles') THEN

        -- Verificar si las columnas de embedding existen
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_knowledge_articles' AND column_name = 'embedding') THEN

            CREATE TRIGGER trg_mark_embedding_pending_articles
                BEFORE UPDATE ON public.ai_knowledge_articles
                FOR EACH ROW
                EXECUTE FUNCTION mark_embedding_pending();

            RAISE NOTICE 'Trigger created: trg_mark_embedding_pending_articles';
        ELSE
            RAISE NOTICE 'Column embedding not found in ai_knowledge_articles, skipping trigger';
        END IF;
    END IF;
END $$;


-- Trigger para faqs
DROP TRIGGER IF EXISTS trg_mark_embedding_pending_faqs ON public.faqs;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'faqs') THEN

        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'faqs' AND column_name = 'embedding') THEN

            CREATE TRIGGER trg_mark_embedding_pending_faqs
                BEFORE UPDATE ON public.faqs
                FOR EACH ROW
                EXECUTE FUNCTION mark_embedding_pending();

            RAISE NOTICE 'Trigger created: trg_mark_embedding_pending_faqs';
        ELSE
            RAISE NOTICE 'Column embedding not found in faqs, skipping trigger';
        END IF;
    END IF;
END $$;


-- Trigger para ai_business_policies
DROP TRIGGER IF EXISTS trg_mark_embedding_pending_policies ON public.ai_business_policies;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'ai_business_policies') THEN

        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_business_policies' AND column_name = 'embedding') THEN

            CREATE TRIGGER trg_mark_embedding_pending_policies
                BEFORE UPDATE ON public.ai_business_policies
                FOR EACH ROW
                EXECUTE FUNCTION mark_embedding_pending();

            RAISE NOTICE 'Trigger created: trg_mark_embedding_pending_policies';
        ELSE
            RAISE NOTICE 'Column embedding not found in ai_business_policies, skipping trigger';
        END IF;
    END IF;
END $$;


-- Trigger para services
DROP TRIGGER IF EXISTS trg_mark_embedding_pending_services ON public.services;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'services') THEN

        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'services' AND column_name = 'embedding') THEN

            CREATE TRIGGER trg_mark_embedding_pending_services
                BEFORE UPDATE ON public.services
                FOR EACH ROW
                EXECUTE FUNCTION mark_embedding_pending();

            RAISE NOTICE 'Trigger created: trg_mark_embedding_pending_services';
        ELSE
            RAISE NOTICE 'Column embedding not found in services, skipping trigger';
        END IF;
    END IF;
END $$;


-- =====================================================
-- PARTE 3: Función para obtener estadísticas de embeddings pendientes
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_embedding_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE(
    source_type TEXT,
    total_count BIGINT,
    pending_count BIGINT,
    processed_count BIGINT,
    pending_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        -- Knowledge Articles
        SELECT
            'knowledge_article'::TEXT as src,
            COUNT(*)::BIGINT as total,
            COUNT(*) FILTER (WHERE embedding IS NULL)::BIGINT as pending
        FROM ai_knowledge_articles
        WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
          AND is_active = true

        UNION ALL

        -- FAQs
        SELECT
            'faq'::TEXT,
            COUNT(*)::BIGINT,
            COUNT(*) FILTER (WHERE embedding IS NULL)::BIGINT
        FROM faqs
        WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
          AND is_active = true

        UNION ALL

        -- Policies
        SELECT
            'policy'::TEXT,
            COUNT(*)::BIGINT,
            COUNT(*) FILTER (WHERE embedding IS NULL)::BIGINT
        FROM ai_business_policies
        WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
          AND is_active = true

        UNION ALL

        -- Services
        SELECT
            'service'::TEXT,
            COUNT(*)::BIGINT,
            COUNT(*) FILTER (WHERE embedding IS NULL)::BIGINT
        FROM services
        WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
          AND is_active = true
    )
    SELECT
        s.src as source_type,
        s.total as total_count,
        s.pending as pending_count,
        (s.total - s.pending)::BIGINT as processed_count,
        CASE
            WHEN s.total > 0 THEN ROUND((s.pending::NUMERIC / s.total::NUMERIC) * 100, 2)
            ELSE 0
        END as pending_percentage
    FROM stats s;
END;
$$;

COMMENT ON FUNCTION get_embedding_stats IS
'Returns statistics about embedding status for knowledge base content.
Shows total, pending, and processed counts per content type.
Useful for monitoring RAG system health.';

GRANT EXECUTE ON FUNCTION get_embedding_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_embedding_stats(UUID) TO service_role;


-- =====================================================
-- PARTE 4: Endpoint para verificar estado de RAG
-- =====================================================
-- Esta función se puede llamar desde la API para mostrar
-- el estado del sistema RAG en el dashboard

CREATE OR REPLACE FUNCTION public.get_rag_health_status(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats RECORD;
    v_total_pending INTEGER := 0;
    v_total_items INTEGER := 0;
    v_health_status TEXT;
    v_result JSONB;
BEGIN
    -- Agregar estadísticas
    FOR v_stats IN SELECT * FROM get_embedding_stats(p_tenant_id) LOOP
        v_total_pending := v_total_pending + v_stats.pending_count;
        v_total_items := v_total_items + v_stats.total_count;
    END LOOP;

    -- Determinar estado de salud
    IF v_total_items = 0 THEN
        v_health_status := 'no_content';
    ELSIF v_total_pending = 0 THEN
        v_health_status := 'healthy';
    ELSIF v_total_pending::NUMERIC / v_total_items::NUMERIC < 0.1 THEN
        v_health_status := 'good';
    ELSIF v_total_pending::NUMERIC / v_total_items::NUMERIC < 0.5 THEN
        v_health_status := 'degraded';
    ELSE
        v_health_status := 'critical';
    END IF;

    -- Construir resultado
    v_result := jsonb_build_object(
        'status', v_health_status,
        'total_items', v_total_items,
        'pending_embeddings', v_total_pending,
        'processed_embeddings', v_total_items - v_total_pending,
        'completion_percentage', CASE
            WHEN v_total_items > 0
            THEN ROUND(((v_total_items - v_total_pending)::NUMERIC / v_total_items::NUMERIC) * 100, 2)
            ELSE 100
        END,
        'details', (
            SELECT jsonb_agg(jsonb_build_object(
                'type', source_type,
                'total', total_count,
                'pending', pending_count,
                'processed', processed_count
            ))
            FROM get_embedding_stats(p_tenant_id)
        ),
        'last_check', NOW()
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_rag_health_status IS
'Returns the health status of the RAG system for a tenant.
Status can be: healthy, good, degraded, critical, or no_content.
Includes detailed breakdown by content type.';

GRANT EXECUTE ON FUNCTION get_rag_health_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rag_health_status(UUID) TO service_role;


-- =====================================================
-- MIGRACIÓN COMPLETADA
-- =====================================================

SELECT 'Migration 127: RAG Embedding Auto-Triggers - COMPLETADA' as status;

-- Resumen de lo implementado:
-- ✅ mark_embedding_pending() - Función trigger para marcar contenido pendiente
-- ✅ Triggers en 4 tablas: articles, faqs, policies, services
-- ✅ get_embedding_stats() - Estadísticas de embeddings por tenant
-- ✅ get_rag_health_status() - Estado de salud del sistema RAG

-- =============================================
-- MEJORA-3.1: Tabla de chunks para RAG mejorado
-- División semántica de documentos con embeddings por chunk
-- =============================================

-- Verificar que la extensión vector existe
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla de chunks
CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Referencia al documento original
  source_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('article', 'faq', 'policy', 'service')),

  -- Contenido del chunk
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL, -- SHA-256 para deduplicación

  -- Embedding
  embedding vector(1536),
  embedding_model TEXT DEFAULT 'text-embedding-3-small',
  embedding_updated_at TIMESTAMPTZ,

  -- Metadata del chunk
  chunk_index INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  start_char INTEGER,
  end_char INTEGER,
  word_count INTEGER,
  has_overlap_before BOOLEAN DEFAULT false,
  has_overlap_after BOOLEAN DEFAULT false,

  -- Metadata enriquecida (extraída del contenido)
  headings TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint para evitar duplicados del mismo chunk
  UNIQUE(tenant_id, source_id, source_type, chunk_index)
);

-- =============================================
-- ÍNDICES
-- =============================================

-- Índice principal por tenant
CREATE INDEX IF NOT EXISTS idx_chunks_tenant ON ai_knowledge_chunks(tenant_id);

-- Índice por documento fuente
CREATE INDEX IF NOT EXISTS idx_chunks_source ON ai_knowledge_chunks(source_id, source_type);

-- Índice vectorial para búsqueda semántica (IVFFlat con 50 listas)
-- Nota: Ajustar lists según el número de chunks esperados
-- Regla general: lists = sqrt(num_rows)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON ai_knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- Índice GIN para búsqueda en keywords
CREATE INDEX IF NOT EXISTS idx_chunks_keywords ON ai_knowledge_chunks USING GIN(keywords);

-- Índice para deduplicación por hash
CREATE INDEX IF NOT EXISTS idx_chunks_hash ON ai_knowledge_chunks(content_hash);

-- Índice para búsqueda por tipo de fuente
CREATE INDEX IF NOT EXISTS idx_chunks_source_type ON ai_knowledge_chunks(tenant_id, source_type);

-- =============================================
-- RLS (Row Level Security)
-- =============================================

ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT: usuarios pueden ver chunks de su tenant
DROP POLICY IF EXISTS "Tenants can view own chunks" ON ai_knowledge_chunks;
CREATE POLICY "Tenants can view own chunks"
  ON ai_knowledge_chunks FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Policy para INSERT: usuarios pueden crear chunks en su tenant
DROP POLICY IF EXISTS "Tenants can insert own chunks" ON ai_knowledge_chunks;
CREATE POLICY "Tenants can insert own chunks"
  ON ai_knowledge_chunks FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Policy para UPDATE: usuarios pueden actualizar chunks de su tenant
DROP POLICY IF EXISTS "Tenants can update own chunks" ON ai_knowledge_chunks;
CREATE POLICY "Tenants can update own chunks"
  ON ai_knowledge_chunks FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Policy para DELETE: usuarios pueden eliminar chunks de su tenant
DROP POLICY IF EXISTS "Tenants can delete own chunks" ON ai_knowledge_chunks;
CREATE POLICY "Tenants can delete own chunks"
  ON ai_knowledge_chunks FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- =============================================
-- TRIGGER PARA UPDATED_AT
-- =============================================

DROP TRIGGER IF EXISTS update_chunks_updated_at ON ai_knowledge_chunks;
CREATE TRIGGER update_chunks_updated_at
  BEFORE UPDATE ON ai_knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCIONES
-- =============================================

-- Función para búsqueda semántica en chunks
CREATE OR REPLACE FUNCTION search_knowledge_chunks(
  p_tenant_id UUID,
  p_query_embedding vector(1536),
  p_limit INTEGER DEFAULT 5,
  p_similarity_threshold FLOAT DEFAULT 0.5,
  p_source_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  source_id UUID,
  source_type TEXT,
  content TEXT,
  chunk_index INTEGER,
  total_chunks INTEGER,
  headings TEXT[],
  keywords TEXT[],
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as chunk_id,
    c.source_id,
    c.source_type,
    c.content,
    c.chunk_index,
    c.total_chunks,
    c.headings,
    c.keywords,
    (1 - (c.embedding <=> p_query_embedding))::FLOAT as similarity
  FROM ai_knowledge_chunks c
  WHERE c.tenant_id = p_tenant_id
    AND c.embedding IS NOT NULL
    AND (p_source_types IS NULL OR c.source_type = ANY(p_source_types))
    AND (1 - (c.embedding <=> p_query_embedding)) >= p_similarity_threshold
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant para service role
GRANT EXECUTE ON FUNCTION search_knowledge_chunks(UUID, vector(1536), INTEGER, FLOAT, TEXT[]) TO service_role;

-- Función para regenerar chunks de un documento (elimina los existentes)
CREATE OR REPLACE FUNCTION regenerate_document_chunks(
  p_tenant_id UUID,
  p_source_id UUID,
  p_source_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM ai_knowledge_chunks
  WHERE tenant_id = p_tenant_id
    AND source_id = p_source_id
    AND source_type = p_source_type;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant para service role
GRANT EXECUTE ON FUNCTION regenerate_document_chunks(UUID, UUID, TEXT) TO service_role;

-- Función para obtener chunks de un documento
CREATE OR REPLACE FUNCTION get_document_chunks(
  p_tenant_id UUID,
  p_source_id UUID,
  p_source_type TEXT
)
RETURNS TABLE (
  chunk_id UUID,
  content TEXT,
  chunk_index INTEGER,
  total_chunks INTEGER,
  word_count INTEGER,
  headings TEXT[],
  keywords TEXT[],
  has_embedding BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as chunk_id,
    c.content,
    c.chunk_index,
    c.total_chunks,
    c.word_count,
    c.headings,
    c.keywords,
    (c.embedding IS NOT NULL) as has_embedding
  FROM ai_knowledge_chunks c
  WHERE c.tenant_id = p_tenant_id
    AND c.source_id = p_source_id
    AND c.source_type = p_source_type
  ORDER BY c.chunk_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant para service role
GRANT EXECUTE ON FUNCTION get_document_chunks(UUID, UUID, TEXT) TO service_role;

-- Función para obtener estadísticas de chunks por tenant
CREATE OR REPLACE FUNCTION get_chunk_stats(p_tenant_id UUID)
RETURNS TABLE (
  source_type TEXT,
  total_chunks BIGINT,
  chunks_with_embedding BIGINT,
  avg_word_count NUMERIC,
  total_documents BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.source_type,
    COUNT(*)::BIGINT as total_chunks,
    COUNT(CASE WHEN c.embedding IS NOT NULL THEN 1 END)::BIGINT as chunks_with_embedding,
    AVG(c.word_count)::NUMERIC as avg_word_count,
    COUNT(DISTINCT c.source_id)::BIGINT as total_documents
  FROM ai_knowledge_chunks c
  WHERE c.tenant_id = p_tenant_id
  GROUP BY c.source_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant para service role
GRANT EXECUTE ON FUNCTION get_chunk_stats(UUID) TO service_role;

-- Función para limpiar chunks huérfanos (documentos eliminados)
CREATE OR REPLACE FUNCTION cleanup_orphan_chunks()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_partial INTEGER;
BEGIN
  -- Eliminar chunks de artículos que ya no existen
  DELETE FROM ai_knowledge_chunks
  WHERE source_type = 'article'
    AND source_id NOT IN (SELECT id FROM ai_knowledge_articles);
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_deleted := v_deleted + v_partial;

  -- Eliminar chunks de FAQs que ya no existen
  DELETE FROM ai_knowledge_chunks
  WHERE source_type = 'faq'
    AND source_id NOT IN (SELECT id FROM faqs);
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_deleted := v_deleted + v_partial;

  -- Eliminar chunks de políticas que ya no existen
  DELETE FROM ai_knowledge_chunks
  WHERE source_type = 'policy'
    AND source_id NOT IN (SELECT id FROM ai_business_policies);
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_deleted := v_deleted + v_partial;

  -- Eliminar chunks de servicios que ya no existen
  DELETE FROM ai_knowledge_chunks
  WHERE source_type = 'service'
    AND source_id NOT IN (SELECT id FROM services);
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_deleted := v_deleted + v_partial;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant para service role
GRANT EXECUTE ON FUNCTION cleanup_orphan_chunks() TO service_role;

-- =============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =============================================

COMMENT ON TABLE ai_knowledge_chunks IS 'MEJORA-3.1: Chunks semánticos para RAG mejorado. Divide documentos largos en fragmentos con overlap para mejor contexto.';
COMMENT ON COLUMN ai_knowledge_chunks.content_hash IS 'SHA-256 del contenido para deduplicación';
COMMENT ON COLUMN ai_knowledge_chunks.chunk_index IS 'Índice del chunk dentro del documento (0-based)';
COMMENT ON COLUMN ai_knowledge_chunks.total_chunks IS 'Total de chunks en el documento';
COMMENT ON COLUMN ai_knowledge_chunks.has_overlap_before IS 'Indica si este chunk tiene overlap con el anterior';
COMMENT ON COLUMN ai_knowledge_chunks.has_overlap_after IS 'Indica si este chunk tiene overlap con el siguiente';
COMMENT ON COLUMN ai_knowledge_chunks.headings IS 'Títulos/encabezados extraídos del contenido del chunk';
COMMENT ON COLUMN ai_knowledge_chunks.keywords IS 'Palabras clave extraídas del contenido del chunk';
COMMENT ON FUNCTION search_knowledge_chunks IS 'Búsqueda semántica en chunks con filtro por tipo de fuente';
COMMENT ON FUNCTION regenerate_document_chunks IS 'Elimina chunks existentes de un documento para regeneración';
COMMENT ON FUNCTION get_document_chunks IS 'Obtiene todos los chunks de un documento ordenados por índice';
COMMENT ON FUNCTION get_chunk_stats IS 'Estadísticas de chunks por tenant agrupadas por tipo de fuente';
COMMENT ON FUNCTION cleanup_orphan_chunks IS 'Limpia chunks cuyos documentos fuente han sido eliminados';

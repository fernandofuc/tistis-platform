-- =============================================
-- MEJORA-2.4: Dead Letter Queue para mensajes fallidos
-- Permite almacenar, investigar y reprocesar mensajes que fallaron
-- =============================================

-- Tabla principal de DLQ
CREATE TABLE IF NOT EXISTS ai_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Mensaje original
  original_message TEXT NOT NULL,
  original_payload JSONB DEFAULT '{}',

  -- Información del error
  error_message TEXT NOT NULL,
  error_code TEXT,
  error_stack TEXT,
  failure_count INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  channel TEXT, -- whatsapp, instagram, facebook, voice, webchat
  processing_stage TEXT NOT NULL, -- webhook, ai_processing, response_sending, tool_execution
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Estado
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'resolved', 'archived')),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ÍNDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_dlq_tenant ON ai_dead_letter_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dlq_status ON ai_dead_letter_queue(status);
CREATE INDEX IF NOT EXISTS idx_dlq_created ON ai_dead_letter_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_dlq_conversation ON ai_dead_letter_queue(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dlq_channel ON ai_dead_letter_queue(channel);
CREATE INDEX IF NOT EXISTS idx_dlq_stage ON ai_dead_letter_queue(processing_stage);
CREATE INDEX IF NOT EXISTS idx_dlq_last_attempt ON ai_dead_letter_queue(last_attempt_at);

-- Índice compuesto para búsqueda de retry
CREATE INDEX IF NOT EXISTS idx_dlq_retry_search ON ai_dead_letter_queue(tenant_id, status, failure_count, last_attempt_at);

-- =============================================
-- RLS (Row Level Security)
-- =============================================

ALTER TABLE ai_dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- Policy para ver DLQ del propio tenant o si es admin
DROP POLICY IF EXISTS "Tenants can view own DLQ" ON ai_dead_letter_queue;
CREATE POLICY "Tenants can view own DLQ"
  ON ai_dead_letter_queue FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Policy para actualizar DLQ del propio tenant
DROP POLICY IF EXISTS "Tenants can update own DLQ" ON ai_dead_letter_queue;
CREATE POLICY "Tenants can update own DLQ"
  ON ai_dead_letter_queue FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Policy para insertar en DLQ (solo del propio tenant)
DROP POLICY IF EXISTS "Tenants can insert to own DLQ" ON ai_dead_letter_queue;
CREATE POLICY "Tenants can insert to own DLQ"
  ON ai_dead_letter_queue FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Policy para eliminar de DLQ (solo del propio tenant, para admin/testing)
DROP POLICY IF EXISTS "Tenants can delete own DLQ" ON ai_dead_letter_queue;
CREATE POLICY "Tenants can delete own DLQ"
  ON ai_dead_letter_queue FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- =============================================
-- TRIGGER PARA UPDATED_AT
-- =============================================

-- Crear función si no existe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS update_dlq_updated_at ON ai_dead_letter_queue;
CREATE TRIGGER update_dlq_updated_at
  BEFORE UPDATE ON ai_dead_letter_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCIÓN PARA AGREGAR A DLQ (con deduplicación)
-- =============================================

CREATE OR REPLACE FUNCTION add_to_dead_letter_queue(
  p_tenant_id UUID,
  p_conversation_id UUID,
  p_contact_id UUID,
  p_original_message TEXT,
  p_original_payload JSONB,
  p_error_message TEXT,
  p_error_code TEXT,
  p_error_stack TEXT,
  p_channel TEXT,
  p_processing_stage TEXT
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_existing_id UUID;
BEGIN
  -- Verificar si ya existe un registro similar reciente (deduplicación)
  -- Evita duplicados del mismo mensaje fallido en los últimos 5 minutos
  SELECT id INTO v_existing_id
  FROM ai_dead_letter_queue
  WHERE tenant_id = p_tenant_id
    AND conversation_id IS NOT DISTINCT FROM p_conversation_id
    AND original_message = p_original_message
    AND status = 'pending'
    AND created_at > NOW() - INTERVAL '5 minutes';

  IF v_existing_id IS NOT NULL THEN
    -- Incrementar contador de fallos del registro existente
    UPDATE ai_dead_letter_queue
    SET failure_count = failure_count + 1,
        last_attempt_at = NOW(),
        error_message = p_error_message,
        error_code = p_error_code,
        error_stack = p_error_stack
    WHERE id = v_existing_id;

    RETURN v_existing_id;
  END IF;

  -- Crear nuevo registro
  INSERT INTO ai_dead_letter_queue (
    tenant_id, conversation_id, contact_id,
    original_message, original_payload,
    error_message, error_code, error_stack,
    channel, processing_stage
  ) VALUES (
    p_tenant_id, p_conversation_id, p_contact_id,
    p_original_message, p_original_payload,
    p_error_message, p_error_code, p_error_stack,
    p_channel, p_processing_stage
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant para service role
GRANT EXECUTE ON FUNCTION add_to_dead_letter_queue(UUID, UUID, UUID, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- =============================================
-- FUNCIÓN PARA OBTENER MENSAJES PARA RETRY
-- =============================================

CREATE OR REPLACE FUNCTION get_dlq_messages_for_retry(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS SETOF ai_dead_letter_queue AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM ai_dead_letter_queue
  WHERE tenant_id = p_tenant_id
    AND status = 'pending'
    AND failure_count < 5 -- Máximo 5 intentos
    AND last_attempt_at < NOW() - INTERVAL '5 minutes' -- Esperar 5 min entre intentos
  ORDER BY created_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED; -- Lock para evitar procesamiento duplicado
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant para service role
GRANT EXECUTE ON FUNCTION get_dlq_messages_for_retry(UUID, INTEGER) TO service_role;

-- =============================================
-- FUNCIÓN PARA ESTADÍSTICAS DE DLQ
-- =============================================

CREATE OR REPLACE FUNCTION get_dlq_stats(p_tenant_id UUID)
RETURNS TABLE (
  status TEXT,
  count BIGINT,
  avg_failures NUMERIC,
  oldest_created_at TIMESTAMPTZ,
  newest_created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dlq.status,
    COUNT(*)::BIGINT,
    AVG(dlq.failure_count)::NUMERIC,
    MIN(dlq.created_at),
    MAX(dlq.created_at)
  FROM ai_dead_letter_queue dlq
  WHERE dlq.tenant_id = p_tenant_id
  GROUP BY dlq.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant para service role
GRANT EXECUTE ON FUNCTION get_dlq_stats(UUID) TO service_role;

-- =============================================
-- FUNCIÓN PARA ARCHIVAR MENSAJES ANTIGUOS
-- =============================================

CREATE OR REPLACE FUNCTION archive_old_dlq_messages(
  p_days_old INTEGER DEFAULT 30,
  p_max_failures INTEGER DEFAULT 5
)
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Usar MAKE_INTERVAL para evitar interpolación de strings (seguridad)
  UPDATE ai_dead_letter_queue
  SET status = 'archived'
  WHERE status = 'pending'
    AND (
      created_at < NOW() - MAKE_INTERVAL(days => p_days_old)
      OR failure_count >= p_max_failures
    );

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant para service role
GRANT EXECUTE ON FUNCTION archive_old_dlq_messages(INTEGER, INTEGER) TO service_role;

-- =============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =============================================

COMMENT ON TABLE ai_dead_letter_queue IS 'MEJORA-2.4: Cola de mensajes fallidos para reprocesamiento y debugging';
COMMENT ON COLUMN ai_dead_letter_queue.processing_stage IS 'Etapa donde falló: webhook, ai_processing, response_sending, tool_execution';
COMMENT ON COLUMN ai_dead_letter_queue.failure_count IS 'Número de intentos fallidos (máximo 5 antes de archivar)';
COMMENT ON COLUMN ai_dead_letter_queue.status IS 'pending=espera retry, retrying=en proceso, resolved=resuelto, archived=archivado';
COMMENT ON COLUMN ai_dead_letter_queue.original_payload IS 'Payload completo original para debugging';
COMMENT ON FUNCTION add_to_dead_letter_queue IS 'Agrega mensaje a DLQ con deduplicación automática';
COMMENT ON FUNCTION get_dlq_messages_for_retry IS 'Obtiene mensajes pendientes para retry con locking';
COMMENT ON FUNCTION get_dlq_stats IS 'Estadísticas de DLQ por tenant';
COMMENT ON FUNCTION archive_old_dlq_messages IS 'Archiva mensajes antiguos o con muchos fallos';

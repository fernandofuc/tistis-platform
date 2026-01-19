-- =============================================
-- MEJORA-2.1: Tablas para LangGraph Checkpointing
-- Basado en el schema oficial de PostgresSaver
-- Permite persistir estado del grafo para:
-- - Recuperación después de crashes/reinicios
-- - Escalamiento horizontal
-- - Resumir conversaciones interrumpidas
-- =============================================

-- Tabla principal de checkpoints
CREATE TABLE IF NOT EXISTS langgraph_checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  parent_checkpoint_id TEXT,
  type TEXT,
  checkpoint JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

-- Tabla de writes pendientes
CREATE TABLE IF NOT EXISTS langgraph_checkpoint_writes (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  channel TEXT NOT NULL,
  type TEXT,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

-- Tabla de blobs (para estados grandes)
CREATE TABLE IF NOT EXISTS langgraph_checkpoint_blobs (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL,
  version TEXT NOT NULL,
  type TEXT NOT NULL,
  data BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);

-- =============================================
-- ÍNDICES PARA BÚSQUEDAS EFICIENTES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_checkpoints_thread
  ON langgraph_checkpoints(thread_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_created
  ON langgraph_checkpoints(created_at);
CREATE INDEX IF NOT EXISTS idx_checkpoints_parent
  ON langgraph_checkpoints(parent_checkpoint_id);

CREATE INDEX IF NOT EXISTS idx_writes_thread
  ON langgraph_checkpoint_writes(thread_id);
CREATE INDEX IF NOT EXISTS idx_writes_checkpoint
  ON langgraph_checkpoint_writes(checkpoint_id);

CREATE INDEX IF NOT EXISTS idx_blobs_thread
  ON langgraph_checkpoint_blobs(thread_id);

-- =============================================
-- FUNCIÓN DE LIMPIEZA DE CHECKPOINTS ANTIGUOS
-- =============================================

CREATE OR REPLACE FUNCTION cleanup_old_checkpoints()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Eliminar checkpoints antiguos (> 7 días)
  WITH deleted AS (
    DELETE FROM langgraph_checkpoints
    WHERE created_at < NOW() - INTERVAL '7 days'
    RETURNING thread_id, checkpoint_id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  -- Eliminar writes huérfanos
  DELETE FROM langgraph_checkpoint_writes w
  WHERE NOT EXISTS (
    SELECT 1 FROM langgraph_checkpoints c
    WHERE c.thread_id = w.thread_id
      AND c.checkpoint_id = w.checkpoint_id
  );

  -- Eliminar blobs huérfanos
  DELETE FROM langgraph_checkpoint_blobs b
  WHERE NOT EXISTS (
    SELECT 1 FROM langgraph_checkpoints c
    WHERE c.thread_id = b.thread_id
  );

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_old_checkpoints() TO service_role;

-- =============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =============================================

COMMENT ON TABLE langgraph_checkpoints IS 'MEJORA-2.1: Almacena estados del grafo LangGraph para persistencia y recuperación';
COMMENT ON TABLE langgraph_checkpoint_writes IS 'MEJORA-2.1: Writes pendientes entre checkpoints para operaciones atómicas';
COMMENT ON TABLE langgraph_checkpoint_blobs IS 'MEJORA-2.1: Datos binarios grandes del estado (serialización de objetos complejos)';

COMMENT ON COLUMN langgraph_checkpoints.thread_id IS 'ID único del thread (usamos conversation_id)';
COMMENT ON COLUMN langgraph_checkpoints.checkpoint_ns IS 'Namespace del checkpoint para aislamiento';
COMMENT ON COLUMN langgraph_checkpoints.checkpoint_id IS 'ID único del checkpoint';
COMMENT ON COLUMN langgraph_checkpoints.parent_checkpoint_id IS 'ID del checkpoint padre (para historial)';
COMMENT ON COLUMN langgraph_checkpoints.checkpoint IS 'Estado completo del grafo serializado en JSON';
COMMENT ON COLUMN langgraph_checkpoints.metadata IS 'Metadata adicional del checkpoint';

COMMENT ON FUNCTION cleanup_old_checkpoints() IS 'MEJORA-2.1: Limpia checkpoints mayores a 7 días y datos huérfanos';

-- =============================================
-- PROGRAMAR LIMPIEZA AUTOMÁTICA (si pg_cron está disponible)
-- =============================================

-- Nota: Descomentar si pg_cron está instalado en Supabase
-- SELECT cron.schedule('cleanup-langgraph-checkpoints', '0 4 * * *', 'SELECT cleanup_old_checkpoints()');

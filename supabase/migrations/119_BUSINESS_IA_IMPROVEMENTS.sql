-- =====================================================
-- MIGRACIÓN 119: Business IA Improvements
-- REVISIÓN 5.2 - Sistema de locks y mejoras de Business IA
-- =====================================================

-- ======================
-- G-B1: System Locks Table
-- ======================

-- Tabla para locks distribuidos
-- Usada para evitar concurrencia en CRON jobs
CREATE TABLE IF NOT EXISTS public.system_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lock_name TEXT NOT NULL UNIQUE,
  acquired_by TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para búsqueda eficiente de locks expirados
-- NOTE: Removed partial index with NOW() - PostgreSQL requires IMMUTABLE functions in index predicates
-- The index still helps queries that filter by expires_at
CREATE INDEX IF NOT EXISTS idx_system_locks_expires
ON public.system_locks (expires_at);

-- Índice para búsqueda por nombre
CREATE INDEX IF NOT EXISTS idx_system_locks_name
ON public.system_locks (lock_name);

-- RLS: Solo service role puede manipular locks
ALTER TABLE public.system_locks ENABLE ROW LEVEL SECURITY;

-- Política para service role
CREATE POLICY "service_role_system_locks" ON public.system_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ======================
-- G-B3: Columna para data_points validados
-- ======================

-- Indicador de si los data_points mínimos fueron cumplidos
ALTER TABLE public.ai_business_insights
ADD COLUMN IF NOT EXISTS min_data_points_met BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN public.ai_business_insights.min_data_points_met IS
'Indica si el insight fue generado con suficientes data points';

-- ======================
-- G-B8: Columna para vertical snapshot
-- ======================

-- Guarda la vertical al momento de generación para auditoría
ALTER TABLE public.ai_business_insights
ADD COLUMN IF NOT EXISTS vertical_at_generation TEXT;

COMMENT ON COLUMN public.ai_business_insights.vertical_at_generation IS
'Vertical del tenant al momento de generar el insight';

-- ======================
-- G-B9: Función para limpiar cola de aprendizaje antigua
-- ======================

CREATE OR REPLACE FUNCTION public.cleanup_learning_queue(
  p_max_age_days INTEGER DEFAULT 7,
  p_max_items INTEGER DEFAULT 10000
)
RETURNS TABLE(deleted_count INTEGER, remaining_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_remaining INTEGER := 0;
BEGIN
  -- Eliminar items procesados o fallidos más antiguos que max_age_days
  WITH deleted AS (
    DELETE FROM public.ai_learning_queue
    WHERE created_at < NOW() - (p_max_age_days || ' days')::INTERVAL
      AND status IN ('completed', 'failed')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  -- Si hay demasiados items pendientes, eliminar los más antiguos
  IF p_max_items > 0 THEN
    WITH to_delete AS (
      SELECT id
      FROM public.ai_learning_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      OFFSET p_max_items
    ),
    deleted AS (
      DELETE FROM public.ai_learning_queue
      WHERE id IN (SELECT id FROM to_delete)
      RETURNING id
    )
    SELECT v_deleted + COUNT(*) INTO v_deleted FROM deleted;
  END IF;

  -- Contar items restantes
  SELECT COUNT(*) INTO v_remaining FROM public.ai_learning_queue;

  RETURN QUERY SELECT v_deleted, v_remaining;
END;
$$;

COMMENT ON FUNCTION public.cleanup_learning_queue IS
'G-B9: Limpia la cola de aprendizaje de items antiguos y mantiene límite máximo';

-- ======================
-- G-B10: Función para validar longitud de mensaje
-- ======================

-- Esta validación se hace principalmente en código, pero añadimos
-- un check constraint como última línea de defensa
ALTER TABLE public.ai_learning_queue
ADD CONSTRAINT check_message_length
CHECK (LENGTH(message_content) <= 10000);

-- También a patrones
ALTER TABLE public.ai_message_patterns
ADD CONSTRAINT check_pattern_value_length
CHECK (LENGTH(pattern_value) <= 500);

-- ======================
-- Función auxiliar: Obtener estado de locks
-- ======================

CREATE OR REPLACE FUNCTION public.get_active_locks()
RETURNS TABLE(
  lock_name TEXT,
  acquired_by TEXT,
  acquired_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_expired BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lock_name,
    acquired_by,
    acquired_at,
    expires_at,
    expires_at < NOW() AS is_expired
  FROM public.system_locks
  ORDER BY acquired_at DESC;
$$;

-- ======================
-- Grants
-- ======================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_locks TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_learning_queue TO service_role;
GRANT EXECUTE ON FUNCTION public.get_active_locks TO service_role;

-- ======================
-- Log de migración
-- ======================

DO $$
BEGIN
  RAISE NOTICE 'Migration 119_BUSINESS_IA_IMPROVEMENTS.sql completed successfully';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  - G-B1: system_locks table for distributed locking';
  RAISE NOTICE '  - G-B3: min_data_points_met column on ai_business_insights';
  RAISE NOTICE '  - G-B8: vertical_at_generation column on ai_business_insights';
  RAISE NOTICE '  - G-B9: cleanup_learning_queue function';
  RAISE NOTICE '  - G-B10: Length constraints on queue and patterns';
END;
$$;

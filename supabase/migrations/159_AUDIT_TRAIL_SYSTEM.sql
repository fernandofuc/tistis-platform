-- =====================================================
-- TIS TIS PLATFORM - Migration 159
-- AUDIT TRAIL SYSTEM
-- Sprint 4: Sistema completo de auditoría para tracking
-- =====================================================
-- NOTA: Esta migración extiende la tabla audit_logs existente
-- (creada en migración 011) con columnas adicionales para
-- soporte multi-tenant y tracking mejorado.
-- =====================================================

-- =====================================================
-- 1. AGREGAR COLUMNAS FALTANTES A audit_logs EXISTENTE
-- =====================================================

-- Agregar tenant_id si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Agregar columna changes (reemplaza old_data/new_data)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'changes'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN changes JSONB DEFAULT '{}';
    END IF;
END $$;

-- Agregar columna metadata
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- Agregar columna status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN status TEXT DEFAULT 'success';
    END IF;
END $$;

-- Agregar columna error_message
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'error_message'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN error_message TEXT;
    END IF;
END $$;

-- Migrar datos de old_data/new_data a changes si existen
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'old_data'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'changes'
    ) THEN
        UPDATE public.audit_logs
        SET changes = jsonb_build_object(
            'before', COALESCE(old_data, '{}'::jsonb),
            'after', COALESCE(new_data, '{}'::jsonb)
        )
        WHERE changes = '{}'::jsonb
          AND (old_data IS NOT NULL OR new_data IS NOT NULL);
    END IF;
END $$;

-- Convertir entity_type a TEXT si es VARCHAR
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs'
          AND column_name = 'entity_type' AND data_type = 'character varying'
    ) THEN
        ALTER TABLE public.audit_logs ALTER COLUMN entity_type TYPE TEXT;
    END IF;
END $$;

-- Convertir action a TEXT si es VARCHAR
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs'
          AND column_name = 'action' AND data_type = 'character varying'
    ) THEN
        ALTER TABLE public.audit_logs ALTER COLUMN action TYPE TEXT;
    END IF;
END $$;

-- Convertir ip_address a INET si es VARCHAR
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs'
          AND column_name = 'ip_address' AND data_type = 'character varying'
    ) THEN
        -- Primero limpiar valores inválidos
        UPDATE public.audit_logs SET ip_address = NULL WHERE ip_address = '';
        -- Luego convertir
        ALTER TABLE public.audit_logs ALTER COLUMN ip_address TYPE INET USING ip_address::INET;
    END IF;
END $$;

-- Convertir request_id a TEXT si es UUID
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs'
          AND column_name = 'request_id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.audit_logs ALTER COLUMN request_id TYPE TEXT USING request_id::TEXT;
    END IF;
END $$;

-- =====================================================
-- 2. COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE audit_logs IS 'Sistema de auditoría para tracking de todas las operaciones críticas';
COMMENT ON COLUMN audit_logs.action IS 'Tipo de acción realizada';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'entity_type'
    ) THEN
        COMMENT ON COLUMN audit_logs.entity_type IS 'Tipo de entidad afectada (lead, appointment, etc.)';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'changes'
    ) THEN
        COMMENT ON COLUMN audit_logs.changes IS 'Cambios realizados en formato { before: {...}, after: {...} }';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'metadata'
    ) THEN
        COMMENT ON COLUMN audit_logs.metadata IS 'Metadatos adicionales de la operación';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'request_id'
    ) THEN
        COMMENT ON COLUMN audit_logs.request_id IS 'ID único de la request para correlación de logs';
    END IF;
END $$;

-- =====================================================
-- 3. ÍNDICES PARA PERFORMANCE (con IF NOT EXISTS)
-- =====================================================

-- Índice principal para queries por tenant
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON audit_logs (tenant_id, created_at DESC);

-- Índice para buscar por entidad específica (mejorado con tenant)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_entity
  ON audit_logs (tenant_id, entity_type, entity_id);

-- Índice para buscar por usuario con tenant
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_user
  ON audit_logs (tenant_id, user_id, created_at DESC);

-- Índice para buscar por acción con tenant
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action
  ON audit_logs (tenant_id, action, created_at DESC);

-- Índice para correlación de requests
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id_new
  ON audit_logs (request_id)
  WHERE request_id IS NOT NULL;

-- Índice para búsqueda en JSONB (búsqueda de campos específicos)
CREATE INDEX IF NOT EXISTS idx_audit_logs_changes_gin
  ON audit_logs USING GIN (changes jsonb_path_ops);

-- Índice para búsqueda en metadata
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin
  ON audit_logs USING GIN (metadata jsonb_path_ops);

-- =====================================================
-- 4. RLS POLICIES (drop y recrear para evitar conflictos)
-- =====================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Eliminar policies antiguas si existen
DROP POLICY IF EXISTS "Super admin can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Service role full access audit logs" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_read" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_service_insert" ON audit_logs;

-- Policy: Admins pueden ver audit logs de su tenant
CREATE POLICY "audit_logs_admin_read" ON audit_logs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'owner', 'super_admin')
    )
    -- También permitir si client_id existe y coincide (compatibilidad)
    OR (
      client_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin', 'owner', 'super_admin')
      )
    )
  );

-- Policy: Solo el sistema puede insertar (via service role)
CREATE POLICY "audit_logs_service_insert" ON audit_logs
  FOR INSERT
  WITH CHECK (
    current_setting('role', true) = 'service_role'
    OR tenant_id IN (
      SELECT ur.tenant_id
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'owner')
    )
  );

-- =====================================================
-- 5. FUNCIÓN HELPER PARA INSERTAR AUDIT LOGS
-- =====================================================

CREATE OR REPLACE FUNCTION log_audit(
  p_tenant_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_changes JSONB DEFAULT '{}',
  p_metadata JSONB DEFAULT '{}',
  p_request_id TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_logs (
    tenant_id,
    user_id,
    action,
    entity_type,
    entity_id,
    changes,
    metadata,
    request_id,
    ip_address,
    user_agent,
    status,
    error_message
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_changes,
    p_metadata,
    p_request_id,
    p_ip_address,
    p_user_agent,
    p_status,
    p_error_message
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit IS 'Helper function para insertar registros de auditoría';

-- =====================================================
-- 6. FUNCIÓN PARA OBTENER AUDIT TRAIL DE UNA ENTIDAD
-- =====================================================

CREATE OR REPLACE FUNCTION get_entity_audit_trail(
  p_tenant_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  action TEXT,
  user_id UUID,
  changes JSONB,
  metadata JSONB,
  status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.user_id,
    al.changes,
    al.metadata,
    al.status,
    al.created_at
  FROM audit_logs al
  WHERE al.tenant_id = p_tenant_id
    AND al.entity_type = p_entity_type
    AND al.entity_id = p_entity_id
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_entity_audit_trail IS 'Obtiene el historial de auditoría de una entidad específica';

-- =====================================================
-- 7. FUNCIÓN PARA ESTADÍSTICAS DE AUDITORÍA
-- =====================================================

CREATE OR REPLACE FUNCTION get_audit_stats(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
  action TEXT,
  entity_type TEXT,
  count BIGINT,
  success_count BIGINT,
  failure_count BIGINT
) AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
BEGIN
  v_start_date := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
  v_end_date := COALESCE(p_end_date, NOW());

  RETURN QUERY
  SELECT
    al.action,
    al.entity_type,
    COUNT(*)::BIGINT as count,
    COUNT(*) FILTER (WHERE al.status = 'success')::BIGINT as success_count,
    COUNT(*) FILTER (WHERE al.status = 'failure')::BIGINT as failure_count
  FROM audit_logs al
  WHERE al.tenant_id = p_tenant_id
    AND al.created_at BETWEEN v_start_date AND v_end_date
  GROUP BY al.action, al.entity_type
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_audit_stats IS 'Estadísticas agregadas de auditoría por acción y entidad';

-- =====================================================
-- 8. VERIFICACIÓN
-- =====================================================

DO $$
DECLARE
  v_col_count INT;
BEGIN
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
    AND column_name IN ('tenant_id', 'changes', 'metadata', 'status', 'error_message');

  RAISE NOTICE 'audit_logs: % columnas nuevas verificadas', v_col_count;

  IF v_col_count < 5 THEN
    RAISE WARNING 'Algunas columnas pueden no haberse creado correctamente';
  END IF;
END $$;

-- =====================================================
-- FIN DE MIGRACIÓN 159
-- =====================================================

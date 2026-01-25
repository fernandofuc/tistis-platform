-- =====================================================
-- TIS TIS PLATFORM - Migration 159
-- AUDIT TRAIL SYSTEM
-- Sprint 4: Sistema completo de auditoría para tracking
-- =====================================================

-- =====================================================
-- 1. TABLA PRINCIPAL: audit_logs
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificación del tenant y usuario
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Información de la acción
  action TEXT NOT NULL CHECK (action IN (
    'CREATE', 'UPDATE', 'DELETE', 'READ',
    'LOGIN', 'LOGOUT', 'FAILED_LOGIN',
    'EXPORT', 'IMPORT', 'BULK_UPDATE',
    'SETTINGS_CHANGE', 'PERMISSION_CHANGE',
    'AI_RESPONSE', 'ESCALATION', 'BOOKING',
    'ORDER_CREATE', 'ORDER_UPDATE', 'ORDER_CANCEL',
    'INTEGRATION_SYNC', 'WEBHOOK_RECEIVED',
    'CUSTOM'
  )),

  -- Entidad afectada
  entity_type TEXT NOT NULL,  -- 'lead', 'appointment', 'conversation', etc.
  entity_id UUID,             -- ID de la entidad (opcional para acciones globales)

  -- Detalles del cambio
  changes JSONB DEFAULT '{}',  -- { before: {...}, after: {...} }
  metadata JSONB DEFAULT '{}', -- Contexto adicional (IP, user agent, etc.)

  -- Contexto de la petición
  request_id TEXT,            -- ID único de la request (para correlación)
  ip_address INET,
  user_agent TEXT,

  -- Resultado
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure', 'partial')),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentarios de documentación
COMMENT ON TABLE audit_logs IS 'Sistema de auditoría para tracking de todas las operaciones críticas';
COMMENT ON COLUMN audit_logs.action IS 'Tipo de acción realizada';
COMMENT ON COLUMN audit_logs.entity_type IS 'Tipo de entidad afectada (lead, appointment, etc.)';
COMMENT ON COLUMN audit_logs.changes IS 'Cambios realizados en formato { before: {...}, after: {...} }';
COMMENT ON COLUMN audit_logs.metadata IS 'Metadatos adicionales de la operación';
COMMENT ON COLUMN audit_logs.request_id IS 'ID único de la request para correlación de logs';

-- =====================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índice principal para queries por tenant
CREATE INDEX idx_audit_logs_tenant_created
  ON audit_logs (tenant_id, created_at DESC);

-- Índice para buscar por entidad específica
CREATE INDEX idx_audit_logs_entity
  ON audit_logs (tenant_id, entity_type, entity_id);

-- Índice para buscar por usuario
CREATE INDEX idx_audit_logs_user
  ON audit_logs (tenant_id, user_id, created_at DESC);

-- Índice para buscar por acción
CREATE INDEX idx_audit_logs_action
  ON audit_logs (tenant_id, action, created_at DESC);

-- Índice para correlación de requests
CREATE INDEX idx_audit_logs_request_id
  ON audit_logs (request_id)
  WHERE request_id IS NOT NULL;

-- Índice para búsqueda en JSONB (búsqueda de campos específicos)
CREATE INDEX idx_audit_logs_changes_gin
  ON audit_logs USING GIN (changes jsonb_path_ops);

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Solo admins pueden ver audit logs
CREATE POLICY "audit_logs_admin_read" ON audit_logs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT ur.tenant_id
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'owner')
    )
  );

-- Policy: Solo el sistema puede insertar (via service role)
-- Los usuarios normales no pueden insertar directamente
CREATE POLICY "audit_logs_service_insert" ON audit_logs
  FOR INSERT
  WITH CHECK (
    -- Permitir insert si viene del service role o si es admin
    current_setting('role', true) = 'service_role'
    OR tenant_id IN (
      SELECT ur.tenant_id
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'owner')
    )
  );

-- Policy: Nadie puede actualizar o eliminar audit logs (inmutabilidad)
-- (No se crean policies UPDATE/DELETE, por defecto están bloqueadas)

-- =====================================================
-- 4. FUNCIÓN HELPER PARA INSERTAR AUDIT LOGS
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
-- 5. FUNCIÓN PARA OBTENER AUDIT TRAIL DE UNA ENTIDAD
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
-- 6. FUNCIÓN PARA ESTADÍSTICAS DE AUDITORÍA
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
  -- Apply defaults if NULL is passed
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
-- 7. POLÍTICA DE RETENCIÓN (opcional - comentada)
-- =====================================================

-- Función para limpiar logs antiguos (ejecutar vía cron)
-- CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
--   p_retention_days INT DEFAULT 365
-- ) RETURNS INT AS $$
-- DECLARE
--   v_deleted INT;
-- BEGIN
--   DELETE FROM audit_logs
--   WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;
--
--   GET DIAGNOSTICS v_deleted = ROW_COUNT;
--   RETURN v_deleted;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

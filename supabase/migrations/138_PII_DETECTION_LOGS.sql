-- =============================================
-- MEJORA-1.1: Tabla de logs de detección PII
-- Para compliance GDPR/HIPAA
-- =============================================

-- Tabla de logs
CREATE TABLE IF NOT EXISTS ai_pii_detection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  pii_types TEXT[] NOT NULL DEFAULT '{}',
  detection_count INTEGER NOT NULL DEFAULT 0,
  detection_time_ms INTEGER,
  original_hash TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas de compliance
CREATE INDEX IF NOT EXISTS idx_pii_logs_tenant ON ai_pii_detection_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pii_logs_detected_at ON ai_pii_detection_logs(detected_at);
CREATE INDEX IF NOT EXISTS idx_pii_logs_types ON ai_pii_detection_logs USING GIN(pii_types);

-- RLS
ALTER TABLE ai_pii_detection_logs ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists and recreate
DROP POLICY IF EXISTS "Tenants can view own PII logs" ON ai_pii_detection_logs;

CREATE POLICY "Tenants can view own PII logs"
  ON ai_pii_detection_logs FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Policy for authenticated users to insert (solo su tenant)
DROP POLICY IF EXISTS "Authenticated users can insert PII logs for their tenant" ON ai_pii_detection_logs;

CREATE POLICY "Authenticated users can insert PII logs for their tenant"
  ON ai_pii_detection_logs FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Policy for service role (bypass RLS para operaciones del sistema)
-- Service role tiene bypass por defecto, pero documentamos la intención

-- Comentarios
COMMENT ON TABLE ai_pii_detection_logs IS 'MEJORA-1.1: Logs de detección PII para compliance';
COMMENT ON COLUMN ai_pii_detection_logs.original_hash IS 'Hash SHA-256 del texto original (no almacena PII)';
COMMENT ON COLUMN ai_pii_detection_logs.pii_types IS 'Tipos de PII detectados (credit_card, ssn, email, etc)';

-- Política de retención: eliminar logs > 90 días
CREATE OR REPLACE FUNCTION cleanup_old_pii_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_pii_detection_logs
  WHERE detected_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_old_pii_logs() TO service_role;

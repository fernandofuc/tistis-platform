-- =====================================================
-- TIS TIS PLATFORM - API Key Audit and Alerts System
-- Migration 136: Sistema de Auditoría y Alertas para API Keys
-- =====================================================
--
-- PROPÓSITO:
-- Implementar sistema completo de auditoría y alertas de seguridad
-- para el sistema de API Keys
--
-- TABLAS:
-- 1. api_key_audit_logs - Logs de auditoría de eventos
-- 2. api_key_dismissed_alerts - Alertas descartadas por usuarios
-- 3. api_key_read_alerts - Alertas marcadas como leídas
--
-- =====================================================

-- =====================================================
-- 1. TABLA: api_key_audit_logs
-- =====================================================

CREATE TABLE IF NOT EXISTS api_key_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- ==================
    -- Actor Information
    -- ==================
    actor_id UUID REFERENCES auth.users(id),
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'system', 'api_key')),
    actor_email VARCHAR(255),

    -- ==================
    -- Action Details
    -- ==================
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'api_key.created',
        'api_key.updated',
        'api_key.revoked',
        'api_key.rotated',
        'api_key.viewed',
        'api_key.used',
        'api_key.rate_limited',
        'api_key.auth_failed',
        'api_key.ip_blocked',
        'api_key.scope_denied',
        'api_key.expired'
    )),
    resource_type VARCHAR(20) NOT NULL DEFAULT 'api_key',
    resource_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,

    -- ==================
    -- Result
    -- ==================
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure', 'blocked')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),

    -- ==================
    -- Context
    -- ==================
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,

    -- ==================
    -- Timestamp
    -- ==================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE api_key_audit_logs IS 'Audit logs for API Key events and security incidents';
COMMENT ON COLUMN api_key_audit_logs.actor_type IS 'Type of actor: user, system, or api_key';
COMMENT ON COLUMN api_key_audit_logs.action IS 'Type of action performed';
COMMENT ON COLUMN api_key_audit_logs.severity IS 'Severity level: info, warning, error, critical';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant
    ON api_key_audit_logs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
    ON api_key_audit_logs(resource_id)
    WHERE resource_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON api_key_audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON api_key_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
    ON api_key_audit_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity
    ON api_key_audit_logs(severity)
    WHERE severity IN ('error', 'critical');

-- Additional indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_status
    ON api_key_audit_logs(status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_type
    ON api_key_audit_logs(actor_type);

-- Composite index for security analysis queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_status_created
    ON api_key_audit_logs(tenant_id, status, created_at DESC);

-- Composite index for filtering by action and severity
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action_severity
    ON api_key_audit_logs(tenant_id, action, severity);

-- =====================================================
-- 2. TABLA: api_key_dismissed_alerts
-- =====================================================

CREATE TABLE IF NOT EXISTS api_key_dismissed_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Alert identification
    alert_id VARCHAR(100) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,

    -- Dismissal info
    dismissed_by UUID NOT NULL REFERENCES auth.users(id),
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint to prevent duplicate dismissals
    UNIQUE(tenant_id, alert_type, key_id)
);

-- Comments
COMMENT ON TABLE api_key_dismissed_alerts IS 'Tracks which security alerts have been dismissed by users';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dismissed_alerts_tenant
    ON api_key_dismissed_alerts(tenant_id);

CREATE INDEX IF NOT EXISTS idx_dismissed_alerts_key
    ON api_key_dismissed_alerts(key_id)
    WHERE key_id IS NOT NULL;

-- =====================================================
-- 3. TABLA: api_key_read_alerts
-- =====================================================

CREATE TABLE IF NOT EXISTS api_key_read_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Alert identification
    alert_id VARCHAR(100) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,

    -- Read info
    read_by UUID NOT NULL REFERENCES auth.users(id),
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint
    UNIQUE(tenant_id, alert_id)
);

-- Comments
COMMENT ON TABLE api_key_read_alerts IS 'Tracks which security alerts have been read by users';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_read_alerts_tenant
    ON api_key_read_alerts(tenant_id);

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE api_key_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_dismissed_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_read_alerts ENABLE ROW LEVEL SECURITY;

-- api_key_audit_logs - SELECT
DROP POLICY IF EXISTS "audit_logs_select_policy" ON api_key_audit_logs;
CREATE POLICY "audit_logs_select_policy" ON api_key_audit_logs
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- api_key_audit_logs - INSERT (service role only, no policy needed)

-- api_key_dismissed_alerts - SELECT
DROP POLICY IF EXISTS "dismissed_alerts_select_policy" ON api_key_dismissed_alerts;
CREATE POLICY "dismissed_alerts_select_policy" ON api_key_dismissed_alerts
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- api_key_dismissed_alerts - INSERT
DROP POLICY IF EXISTS "dismissed_alerts_insert_policy" ON api_key_dismissed_alerts;
CREATE POLICY "dismissed_alerts_insert_policy" ON api_key_dismissed_alerts
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
        AND dismissed_by = auth.uid()
    );

-- api_key_read_alerts - SELECT
DROP POLICY IF EXISTS "read_alerts_select_policy" ON api_key_read_alerts;
CREATE POLICY "read_alerts_select_policy" ON api_key_read_alerts
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- api_key_read_alerts - INSERT/UPDATE
DROP POLICY IF EXISTS "read_alerts_insert_policy" ON api_key_read_alerts;
CREATE POLICY "read_alerts_insert_policy" ON api_key_read_alerts
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
        AND read_by = auth.uid()
    );

-- =====================================================
-- 5. GRANTS FOR SERVICE ROLE
-- =====================================================

GRANT INSERT ON api_key_audit_logs TO service_role;
GRANT SELECT ON api_key_audit_logs TO service_role;
GRANT INSERT, SELECT ON api_key_dismissed_alerts TO service_role;
GRANT INSERT, SELECT, UPDATE ON api_key_read_alerts TO service_role;

-- =====================================================
-- 6. CLEANUP FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
    p_retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM api_key_audit_logs
    WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Cleans up audit logs older than N days';
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs TO service_role;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

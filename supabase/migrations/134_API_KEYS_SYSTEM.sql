-- =====================================================
-- TIS TIS PLATFORM - API Keys Management System
-- Migration 134: Sistema de Gestión de API Keys
-- =====================================================
--
-- PROPÓSITO:
-- Implementar un sistema profesional de API Keys siguiendo
-- los estándares de la industria (Stripe, OpenAI, SendGrid):
--
-- 1. Generación segura de API Keys con prefijos
-- 2. Almacenamiento hasheado (nunca plain text)
-- 3. Permisos granulares por scope
-- 4. Rate limiting configurable
-- 5. Tracking de uso para analytics
-- 6. IP Whitelist opcional
-- 7. Expiración opcional
--
-- ARQUITECTURA:
-- tenant → api_keys → api_key_usage_logs
--                   → scopes (JSONB)
--
-- SEGURIDAD:
-- - Keys hasheadas con SHA-256
-- - Solo hint visible después de creación
-- - RLS para aislamiento multi-tenant
-- - Audit trail completo
--
-- =====================================================

-- =====================================================
-- 1. TABLA PRINCIPAL: api_keys
-- =====================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),

    -- ==================
    -- Identificación
    -- ==================
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- ==================
    -- Key Security
    -- ==================
    -- NUNCA almacenamos la key en plain text
    -- Solo el hash SHA-256 para validación
    key_hash VARCHAR(64) NOT NULL,           -- SHA-256 hash (64 chars hex)
    key_hint VARCHAR(8) NOT NULL,            -- Últimos 4 chars: "...a4f7"
    key_prefix VARCHAR(20) NOT NULL,         -- "tis_live_" o "tis_test_"
    environment VARCHAR(10) NOT NULL DEFAULT 'live'
        CHECK (environment IN ('live', 'test')),

    -- ==================
    -- Permisos (Scopes)
    -- ==================
    -- Array de scopes permitidos, ej: ["leads:read", "leads:write", "appointments:read"]
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- ==================
    -- Rate Limiting
    -- ==================
    rate_limit_rpm INTEGER DEFAULT 60
        CHECK (rate_limit_rpm > 0 AND rate_limit_rpm <= 1000),
    rate_limit_daily INTEGER DEFAULT 10000
        CHECK (rate_limit_daily > 0 AND rate_limit_daily <= 1000000),

    -- ==================
    -- Restricciones Opcionales
    -- ==================
    -- Array de IPs permitidas (null = todas permitidas)
    ip_whitelist TEXT[],
    -- Fecha de expiración opcional
    expires_at TIMESTAMPTZ,

    -- ==================
    -- Tracking de Uso
    -- ==================
    last_used_at TIMESTAMPTZ,
    last_used_ip INET,
    last_used_endpoint VARCHAR(255),
    usage_count BIGINT DEFAULT 0,
    usage_count_today INTEGER DEFAULT 0,
    usage_reset_date DATE DEFAULT CURRENT_DATE,

    -- ==================
    -- Estado y Revocación
    -- ==================
    is_active BOOLEAN DEFAULT true,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id),
    revoke_reason TEXT,

    -- ==================
    -- Metadata
    -- ==================
    metadata JSONB DEFAULT '{}'::jsonb,

    -- ==================
    -- Auditoría
    -- ==================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- ==================
    -- Constraints
    -- ==================
    UNIQUE(tenant_id, name),      -- Nombre único por tenant
    UNIQUE(key_hash)              -- Hash único globalmente
);

-- Comentarios de tabla
COMMENT ON TABLE api_keys IS 'API Keys para acceso programático a la plataforma TIS TIS';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash de la API key - nunca almacenamos la key real';
COMMENT ON COLUMN api_keys.key_hint IS 'Últimos 4 caracteres de la key para identificación visual';
COMMENT ON COLUMN api_keys.scopes IS 'Array de permisos: ["leads:read", "appointments:write", etc]';
COMMENT ON COLUMN api_keys.ip_whitelist IS 'IPs permitidas (null = todas). Ej: ["192.168.1.1", "10.0.0.0/24"]';

-- =====================================================
-- 2. ÍNDICES PARA api_keys
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant
    ON api_keys(tenant_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash
    ON api_keys(key_hash);

CREATE INDEX IF NOT EXISTS idx_api_keys_active
    ON api_keys(tenant_id, is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_api_keys_environment
    ON api_keys(tenant_id, environment);

CREATE INDEX IF NOT EXISTS idx_api_keys_created_by
    ON api_keys(created_by);

CREATE INDEX IF NOT EXISTS idx_api_keys_expires
    ON api_keys(expires_at)
    WHERE expires_at IS NOT NULL;

-- =====================================================
-- 3. TRIGGER PARA updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_api_keys_updated_at ON api_keys;
CREATE TRIGGER trigger_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_updated_at();

-- =====================================================
-- 4. TRIGGER PARA RESET DIARIO DE CONTADOR
-- =====================================================

CREATE OR REPLACE FUNCTION reset_api_key_daily_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Si cambió el día, resetear contador diario
    IF NEW.usage_reset_date IS DISTINCT FROM CURRENT_DATE THEN
        NEW.usage_count_today = 0;
        NEW.usage_reset_date = CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_api_keys_daily_reset ON api_keys;
CREATE TRIGGER trigger_api_keys_daily_reset
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION reset_api_key_daily_usage();

-- =====================================================
-- 5. RLS POLICIES PARA api_keys
-- =====================================================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- SELECT: Solo owner/admin del tenant pueden ver
DROP POLICY IF EXISTS "api_keys_select_policy" ON api_keys;
CREATE POLICY "api_keys_select_policy" ON api_keys
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- INSERT: Solo owner/admin pueden crear
DROP POLICY IF EXISTS "api_keys_insert_policy" ON api_keys;
CREATE POLICY "api_keys_insert_policy" ON api_keys
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
        AND created_by = auth.uid()
    );

-- UPDATE: Solo owner/admin pueden actualizar
DROP POLICY IF EXISTS "api_keys_update_policy" ON api_keys;
CREATE POLICY "api_keys_update_policy" ON api_keys
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- DELETE: Solo owner puede eliminar (soft delete preferido)
DROP POLICY IF EXISTS "api_keys_delete_policy" ON api_keys;
CREATE POLICY "api_keys_delete_policy" ON api_keys
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'owner'
        )
    );

-- =====================================================
-- 6. TABLA DE LOGS: api_key_usage_logs
-- =====================================================

CREATE TABLE IF NOT EXISTS api_key_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- ==================
    -- Request Info
    -- ==================
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
    scope_used VARCHAR(100),
    request_path TEXT,
    query_params JSONB,

    -- ==================
    -- Response Info
    -- ==================
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    error_code VARCHAR(50),

    -- ==================
    -- Client Info
    -- ==================
    ip_address INET,
    user_agent TEXT,
    origin VARCHAR(255),

    -- ==================
    -- Timestamp
    -- ==================
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentarios
COMMENT ON TABLE api_key_usage_logs IS 'Logs de uso de API Keys para analytics y auditoría';
COMMENT ON COLUMN api_key_usage_logs.response_time_ms IS 'Tiempo de respuesta en milisegundos';

-- =====================================================
-- 7. ÍNDICES PARA api_key_usage_logs
-- =====================================================

-- Índice principal para queries por key
CREATE INDEX IF NOT EXISTS idx_usage_logs_api_key
    ON api_key_usage_logs(api_key_id);

-- Índice para queries por tenant
CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant
    ON api_key_usage_logs(tenant_id);

-- Índice para queries por fecha (reportes)
CREATE INDEX IF NOT EXISTS idx_usage_logs_created
    ON api_key_usage_logs(created_at DESC);

-- Índice compuesto para analytics por key y fecha
CREATE INDEX IF NOT EXISTS idx_usage_logs_key_date
    ON api_key_usage_logs(api_key_id, created_at DESC);

-- Índice para filtrar por endpoint (reportes de uso)
CREATE INDEX IF NOT EXISTS idx_usage_logs_endpoint
    ON api_key_usage_logs(endpoint);

-- Índice para filtrar por status (errores)
CREATE INDEX IF NOT EXISTS idx_usage_logs_status
    ON api_key_usage_logs(status_code)
    WHERE status_code >= 400;

-- Particionamiento por mes para mejor performance (comentado - activar si hay muchos logs)
-- CREATE INDEX IF NOT EXISTS idx_usage_logs_month
--     ON api_key_usage_logs(date_trunc('month', created_at));

-- =====================================================
-- 8. RLS PARA api_key_usage_logs
-- =====================================================

ALTER TABLE api_key_usage_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: Solo owner/admin pueden ver logs
DROP POLICY IF EXISTS "usage_logs_select_policy" ON api_key_usage_logs;
CREATE POLICY "usage_logs_select_policy" ON api_key_usage_logs
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- INSERT: Permitir inserts desde service role (logging desde backend)
-- No hay policy de INSERT porque se hace con service role key

-- =====================================================
-- 9. FUNCIÓN RPC: Validar API Key
-- =====================================================

CREATE OR REPLACE FUNCTION validate_api_key(
    p_key_hash VARCHAR(64)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    key_record RECORD;
BEGIN
    -- Buscar la key por hash
    SELECT
        id,
        tenant_id,
        name,
        scopes,
        rate_limit_rpm,
        rate_limit_daily,
        ip_whitelist,
        expires_at,
        is_active,
        usage_count_today,
        usage_reset_date
    INTO key_record
    FROM api_keys
    WHERE key_hash = p_key_hash;

    -- Key no encontrada
    IF NOT FOUND THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'invalid_key',
            'message', 'API key not found'
        );
    END IF;

    -- Key revocada/inactiva
    IF NOT key_record.is_active THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'key_revoked',
            'message', 'API key has been revoked'
        );
    END IF;

    -- Key expirada
    IF key_record.expires_at IS NOT NULL AND key_record.expires_at < NOW() THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'key_expired',
            'message', 'API key has expired'
        );
    END IF;

    -- Resetear contador si cambió el día
    IF key_record.usage_reset_date IS DISTINCT FROM CURRENT_DATE THEN
        UPDATE api_keys
        SET usage_count_today = 0, usage_reset_date = CURRENT_DATE
        WHERE id = key_record.id;
        key_record.usage_count_today := 0;
    END IF;

    -- Key válida - retornar info
    RETURN json_build_object(
        'valid', true,
        'key_id', key_record.id,
        'tenant_id', key_record.tenant_id,
        'name', key_record.name,
        'scopes', key_record.scopes,
        'rate_limit_rpm', key_record.rate_limit_rpm,
        'rate_limit_daily', key_record.rate_limit_daily,
        'ip_whitelist', key_record.ip_whitelist,
        'usage_today', key_record.usage_count_today
    );
END;
$$;

COMMENT ON FUNCTION validate_api_key IS 'Valida una API key por su hash y retorna información para autorización';

-- =====================================================
-- 10. FUNCIÓN RPC: Verificar Rate Limit
-- =====================================================

CREATE OR REPLACE FUNCTION check_api_key_rate_limit(
    p_api_key_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    key_record RECORD;
    requests_minute INTEGER;
    requests_today INTEGER;
BEGIN
    -- Obtener configuración de la key
    SELECT
        rate_limit_rpm,
        rate_limit_daily,
        usage_count_today,
        usage_reset_date
    INTO key_record
    FROM api_keys
    WHERE id = p_api_key_id
    AND is_active = true;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'key_not_found'
        );
    END IF;

    -- Contar requests en el último minuto
    SELECT COUNT(*)
    INTO requests_minute
    FROM api_key_usage_logs
    WHERE api_key_id = p_api_key_id
    AND created_at >= NOW() - INTERVAL '1 minute';

    -- Usar contador diario de la tabla (más eficiente)
    IF key_record.usage_reset_date = CURRENT_DATE THEN
        requests_today := key_record.usage_count_today;
    ELSE
        requests_today := 0;
    END IF;

    -- Verificar límite por minuto
    IF requests_minute >= key_record.rate_limit_rpm THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'rate_limit_minute',
            'limit', key_record.rate_limit_rpm,
            'current', requests_minute,
            'retry_after_seconds', 60
        );
    END IF;

    -- Verificar límite diario
    IF requests_today >= key_record.rate_limit_daily THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'rate_limit_daily',
            'limit', key_record.rate_limit_daily,
            'current', requests_today,
            'retry_after_seconds', EXTRACT(EPOCH FROM (
                date_trunc('day', NOW()) + INTERVAL '1 day' - NOW()
            ))::INTEGER
        );
    END IF;

    -- Permitido
    RETURN json_build_object(
        'allowed', true,
        'remaining_minute', key_record.rate_limit_rpm - requests_minute,
        'remaining_daily', key_record.rate_limit_daily - requests_today,
        'limit_rpm', key_record.rate_limit_rpm,
        'limit_daily', key_record.rate_limit_daily
    );
END;
$$;

COMMENT ON FUNCTION check_api_key_rate_limit IS 'Verifica si una API key puede realizar más requests según sus rate limits';

-- =====================================================
-- 11. FUNCIÓN RPC: Registrar Uso de API Key
-- =====================================================

CREATE OR REPLACE FUNCTION log_api_key_usage(
    p_api_key_id UUID,
    p_tenant_id UUID,
    p_endpoint VARCHAR(255),
    p_method VARCHAR(10),
    p_scope_used VARCHAR(100),
    p_status_code INTEGER,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_request_path TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insertar log
    INSERT INTO api_key_usage_logs (
        api_key_id,
        tenant_id,
        endpoint,
        method,
        scope_used,
        status_code,
        response_time_ms,
        ip_address,
        user_agent,
        error_message,
        request_path
    ) VALUES (
        p_api_key_id,
        p_tenant_id,
        p_endpoint,
        p_method,
        p_scope_used,
        p_status_code,
        p_response_time_ms,
        p_ip_address,
        p_user_agent,
        p_error_message,
        p_request_path
    );

    -- Actualizar contadores en api_keys
    UPDATE api_keys
    SET
        last_used_at = NOW(),
        last_used_ip = p_ip_address,
        last_used_endpoint = p_endpoint,
        usage_count = usage_count + 1,
        usage_count_today = CASE
            WHEN usage_reset_date = CURRENT_DATE THEN usage_count_today + 1
            ELSE 1
        END,
        usage_reset_date = CURRENT_DATE
    WHERE id = p_api_key_id;
END;
$$;

COMMENT ON FUNCTION log_api_key_usage IS 'Registra el uso de una API key y actualiza contadores';

-- =====================================================
-- 12. FUNCIÓN RPC: Estadísticas de Uso
-- =====================================================

CREATE OR REPLACE FUNCTION get_api_key_usage_stats(
    p_api_key_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
    start_date TIMESTAMPTZ;
BEGIN
    start_date := NOW() - (p_days || ' days')::INTERVAL;

    SELECT json_build_object(
        'total_requests', COALESCE(COUNT(*), 0),
        'successful_requests', COALESCE(COUNT(*) FILTER (WHERE status_code < 400), 0),
        'failed_requests', COALESCE(COUNT(*) FILTER (WHERE status_code >= 400), 0),
        'avg_response_time_ms', COALESCE(ROUND(AVG(response_time_ms)), 0),
        'min_response_time_ms', COALESCE(MIN(response_time_ms), 0),
        'max_response_time_ms', COALESCE(MAX(response_time_ms), 0),
        'unique_ips', COUNT(DISTINCT ip_address),
        'requests_by_endpoint', (
            SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json)
            FROM (
                SELECT endpoint, COUNT(*) as count
                FROM api_key_usage_logs
                WHERE api_key_id = p_api_key_id
                AND created_at >= start_date
                GROUP BY endpoint
                ORDER BY count DESC
                LIMIT 10
            ) e
        ),
        'requests_by_status', (
            SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
            FROM (
                SELECT
                    CASE
                        WHEN status_code < 300 THEN '2xx'
                        WHEN status_code < 400 THEN '3xx'
                        WHEN status_code < 500 THEN '4xx'
                        ELSE '5xx'
                    END as status_group,
                    COUNT(*) as count
                FROM api_key_usage_logs
                WHERE api_key_id = p_api_key_id
                AND created_at >= start_date
                GROUP BY status_group
                ORDER BY status_group
            ) s
        ),
        'requests_by_day', (
            SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.date), '[]'::json)
            FROM (
                SELECT
                    date_trunc('day', created_at)::date as date,
                    COUNT(*) as count,
                    COUNT(*) FILTER (WHERE status_code < 400) as success_count,
                    COUNT(*) FILTER (WHERE status_code >= 400) as error_count
                FROM api_key_usage_logs
                WHERE api_key_id = p_api_key_id
                AND created_at >= start_date
                GROUP BY date_trunc('day', created_at)
                ORDER BY date
            ) d
        ),
        'recent_errors', (
            SELECT COALESCE(json_agg(row_to_json(err)), '[]'::json)
            FROM (
                SELECT
                    endpoint,
                    method,
                    status_code,
                    error_message,
                    created_at
                FROM api_key_usage_logs
                WHERE api_key_id = p_api_key_id
                AND status_code >= 400
                AND created_at >= start_date
                ORDER BY created_at DESC
                LIMIT 10
            ) err
        )
    ) INTO result
    FROM api_key_usage_logs
    WHERE api_key_id = p_api_key_id
    AND created_at >= start_date;

    RETURN COALESCE(result, json_build_object(
        'total_requests', 0,
        'successful_requests', 0,
        'failed_requests', 0,
        'avg_response_time_ms', 0,
        'requests_by_endpoint', '[]'::json,
        'requests_by_status', '[]'::json,
        'requests_by_day', '[]'::json,
        'recent_errors', '[]'::json
    ));
END;
$$;

COMMENT ON FUNCTION get_api_key_usage_stats IS 'Obtiene estadísticas de uso de una API key para los últimos N días';

-- =====================================================
-- 13. FUNCIÓN RPC: Obtener Todas las API Keys del Tenant
-- =====================================================

CREATE OR REPLACE FUNCTION get_tenant_api_keys(
    p_tenant_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(json_agg(row_to_json(k) ORDER BY k.created_at DESC), '[]'::json)
        FROM (
            SELECT
                id,
                name,
                description,
                key_hint,
                key_prefix,
                environment,
                scopes,
                rate_limit_rpm,
                rate_limit_daily,
                ip_whitelist,
                expires_at,
                is_active,
                last_used_at,
                usage_count,
                usage_count_today,
                created_at,
                updated_at,
                CASE WHEN revoked_at IS NOT NULL THEN true ELSE false END as is_revoked,
                revoked_at,
                revoke_reason
            FROM api_keys
            WHERE tenant_id = p_tenant_id
        ) k
    );
END;
$$;

COMMENT ON FUNCTION get_tenant_api_keys IS 'Obtiene todas las API keys de un tenant (sin exponer los hashes)';

-- =====================================================
-- 14. FUNCIÓN HELPER: Verificar Scope
-- =====================================================

CREATE OR REPLACE FUNCTION api_key_has_scope(
    p_api_key_id UUID,
    p_required_scope VARCHAR(100)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    key_scopes JSONB;
BEGIN
    SELECT scopes INTO key_scopes
    FROM api_keys
    WHERE id = p_api_key_id
    AND is_active = true;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Verificar si tiene el scope exacto o wildcard
    RETURN (
        key_scopes ? p_required_scope
        OR key_scopes ? '*'
        OR key_scopes ? split_part(p_required_scope, ':', 1) || ':*'
    );
END;
$$;

COMMENT ON FUNCTION api_key_has_scope IS 'Verifica si una API key tiene un scope específico';

-- =====================================================
-- 15. CLEANUP: Job para limpiar logs antiguos (opcional)
-- =====================================================

-- Esta función puede ser llamada por un cron job externo
CREATE OR REPLACE FUNCTION cleanup_old_api_key_logs(
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
    DELETE FROM api_key_usage_logs
    WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_api_key_logs IS 'Limpia logs de API keys más antiguos que N días';

-- =====================================================
-- 16. GRANTS PARA SERVICE ROLE
-- =====================================================

-- Permitir que el service role pueda insertar logs
GRANT INSERT ON api_key_usage_logs TO service_role;
GRANT UPDATE ON api_keys TO service_role;
GRANT EXECUTE ON FUNCTION validate_api_key TO service_role;
GRANT EXECUTE ON FUNCTION check_api_key_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION log_api_key_usage TO service_role;
GRANT EXECUTE ON FUNCTION get_api_key_usage_stats TO service_role;
GRANT EXECUTE ON FUNCTION get_tenant_api_keys TO service_role;
GRANT EXECUTE ON FUNCTION api_key_has_scope TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_api_key_logs TO service_role;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

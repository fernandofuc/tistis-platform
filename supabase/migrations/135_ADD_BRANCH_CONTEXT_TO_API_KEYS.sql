-- =====================================================
-- TIS TIS PLATFORM - API Keys Branch Context Migration
-- Migration: FASE 2 - Add branch_id support
-- =====================================================
--
-- PROPÓSITO:
-- Agregar soporte para API Keys específicas por sucursal
-- manteniendo retrocompatibilidad con keys existentes.
--
-- ESTRATEGIA:
-- 1. Agregar columna branch_id (nullable)
-- 2. Agregar scope_type para identificar tipo de key
-- 3. Índices optimizados para queries con branch
-- 4. Constraints para validar integridad
-- 5. Función helper para verificar permisos
--
-- ROLLBACK:
-- Este migration es reversible - ver final del archivo
-- =====================================================

-- =====================================================
-- PASO 1: Agregar Columnas Nuevas
-- =====================================================

-- Agregar branch_id (nullable para retrocompatibilidad)
ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;

-- Agregar scope_type para distinguir keys tenant-wide vs branch-specific
ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS scope_type VARCHAR(20) DEFAULT 'tenant'
    CHECK (scope_type IN ('tenant', 'branch'));

-- Agregar metadata adicional
ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS branch_context JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN api_keys.branch_id IS 'Branch UUID for branch-specific API Keys. NULL = tenant-wide access (legacy)';
COMMENT ON COLUMN api_keys.scope_type IS 'Scope type: tenant (all branches) or branch (single branch)';
COMMENT ON COLUMN api_keys.branch_context IS 'Additional branch context metadata (branch name, etc.)';

-- =====================================================
-- PASO 2: Actualizar Keys Existentes
-- =====================================================

-- Marcar todas las keys existentes como 'tenant' scope (legacy behavior)
UPDATE api_keys
SET scope_type = 'tenant',
    branch_context = jsonb_build_object(
        'legacy', true,
        'migrated_at', NOW()::text,
        'note', 'Pre-FASE2 API Key with tenant-wide access'
    )
WHERE scope_type IS NULL OR scope_type = 'tenant';

-- =====================================================
-- PASO 3: Índices para Performance
-- =====================================================

-- Índice para queries por branch (solo keys con branch)
CREATE INDEX IF NOT EXISTS idx_api_keys_branch
    ON api_keys(branch_id)
    WHERE branch_id IS NOT NULL;

-- Índice compuesto para tenant + branch lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_branch
    ON api_keys(tenant_id, branch_id)
    WHERE branch_id IS NOT NULL;

-- Índice para scope_type filtering
CREATE INDEX IF NOT EXISTS idx_api_keys_scope_type
    ON api_keys(scope_type);

-- =====================================================
-- PASO 4: Constraints de Integridad
-- =====================================================

-- Constraint: Si scope_type es 'branch', branch_id DEBE existir
ALTER TABLE api_keys
    ADD CONSTRAINT api_keys_branch_scope_consistency
    CHECK (
        (scope_type = 'tenant' AND branch_id IS NULL) OR
        (scope_type = 'branch' AND branch_id IS NOT NULL)
    );

-- Constraint: branch_id debe pertenecer al mismo tenant
-- NOTA: Este constraint se valida a nivel de aplicación por performance
-- pero dejamos un trigger para auditoría

CREATE OR REPLACE FUNCTION validate_api_key_branch_ownership()
RETURNS TRIGGER AS $$
DECLARE
    branch_tenant_id UUID;
BEGIN
    -- Si no hay branch_id, no hay nada que validar
    IF NEW.branch_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Obtener tenant_id del branch
    SELECT tenant_id INTO branch_tenant_id
    FROM branches
    WHERE id = NEW.branch_id;

    -- Validar que coincide con el tenant de la API key
    IF branch_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Branch % does not exist', NEW.branch_id;
    END IF;

    IF branch_tenant_id != NEW.tenant_id THEN
        RAISE EXCEPTION 'Branch % does not belong to tenant %', NEW.branch_id, NEW.tenant_id;
    END IF;

    -- Auto-set scope_type si no está definido
    IF NEW.scope_type IS NULL THEN
        NEW.scope_type := 'branch';
    END IF;

    -- Auto-populate branch_context
    NEW.branch_context := jsonb_build_object(
        'branch_id', NEW.branch_id::text,
        'branch_name', (SELECT name FROM branches WHERE id = NEW.branch_id),
        'created_at', NOW()::text
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validación automática
DROP TRIGGER IF EXISTS trigger_validate_api_key_branch ON api_keys;
CREATE TRIGGER trigger_validate_api_key_branch
    BEFORE INSERT OR UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION validate_api_key_branch_ownership();

-- =====================================================
-- PASO 5: Función Helper para Verificar Permisos
-- =====================================================

CREATE OR REPLACE FUNCTION api_key_has_branch_access(
    p_api_key_id UUID,
    p_required_branch_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    key_record RECORD;
BEGIN
    -- Obtener info de la API key
    SELECT
        scope_type,
        branch_id,
        is_active
    INTO key_record
    FROM api_keys
    WHERE id = p_api_key_id;

    -- Key no encontrada o inactiva
    IF NOT FOUND OR NOT key_record.is_active THEN
        RETURN FALSE;
    END IF;

    -- Caso 1: Key tenant-wide (legacy) → acceso a todas las branches
    IF key_record.scope_type = 'tenant' THEN
        RETURN TRUE;
    END IF;

    -- Caso 2: Key branch-specific → solo acceso a su branch
    IF key_record.scope_type = 'branch' THEN
        RETURN key_record.branch_id = p_required_branch_id;
    END IF;

    -- Default: no access
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION api_key_has_branch_access IS 'Verifica si una API Key tiene acceso a un branch específico';

-- =====================================================
-- PASO 6: Actualizar Función validate_api_key
-- =====================================================

-- Extender función existente para retornar branch context
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
        branch_id,        -- ✅ NUEVO
        scope_type,       -- ✅ NUEVO
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

    -- Key válida - retornar info INCLUYENDO branch context
    RETURN json_build_object(
        'valid', true,
        'key_id', key_record.id,
        'tenant_id', key_record.tenant_id,
        'branch_id', key_record.branch_id,          -- ✅ NUEVO
        'scope_type', key_record.scope_type,        -- ✅ NUEVO
        'name', key_record.name,
        'scopes', key_record.scopes,
        'rate_limit_rpm', key_record.rate_limit_rpm,
        'rate_limit_daily', key_record.rate_limit_daily,
        'ip_whitelist', key_record.ip_whitelist,
        'usage_today', key_record.usage_count_today
    );
END;
$$;

-- =====================================================
-- PASO 7: Analytics View (Opcional)
-- =====================================================

CREATE OR REPLACE VIEW api_keys_with_branch_info AS
SELECT
    k.id,
    k.tenant_id,
    k.branch_id,
    k.scope_type,
    k.name,
    k.environment,
    k.is_active,
    k.created_at,
    k.last_used_at,
    k.usage_count,
    t.name as tenant_name,
    b.name as branch_name,
    b.address as branch_address
FROM api_keys k
LEFT JOIN tenants t ON t.id = k.tenant_id
LEFT JOIN branches b ON b.id = k.branch_id;

COMMENT ON VIEW api_keys_with_branch_info IS 'View con información denormalizada de API Keys y sus branches';

-- =====================================================
-- PASO 8: Grants
-- =====================================================

GRANT EXECUTE ON FUNCTION api_key_has_branch_access TO service_role;
GRANT SELECT ON api_keys_with_branch_info TO service_role;

-- =====================================================
-- ROLLBACK INSTRUCTIONS
-- =====================================================

/*
-- Para revertir esta migración en caso de problemas:

-- 1. Drop trigger y función
DROP TRIGGER IF EXISTS trigger_validate_api_key_branch ON api_keys;
DROP FUNCTION IF EXISTS validate_api_key_branch_ownership();
DROP FUNCTION IF EXISTS api_key_has_branch_access(UUID, UUID);

-- 2. Drop view
DROP VIEW IF EXISTS api_keys_with_branch_info;

-- 3. Drop constraints
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_branch_scope_consistency;

-- 4. Drop índices
DROP INDEX IF EXISTS idx_api_keys_branch;
DROP INDEX IF EXISTS idx_api_keys_tenant_branch;
DROP INDEX IF EXISTS idx_api_keys_scope_type;

-- 5. Drop columnas (CUIDADO: esto borra datos!)
-- Recomendación: NO ejecutar DROP COLUMN en producción
-- En su lugar, dejar las columnas y revertir a nivel de aplicación
-- ALTER TABLE api_keys DROP COLUMN IF EXISTS branch_id;
-- ALTER TABLE api_keys DROP COLUMN IF EXISTS scope_type;
-- ALTER TABLE api_keys DROP COLUMN IF EXISTS branch_context;

-- 6. Revertir función validate_api_key a versión anterior
-- (Copiar código de migración 134_API_KEYS_SYSTEM.sql)
*/

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

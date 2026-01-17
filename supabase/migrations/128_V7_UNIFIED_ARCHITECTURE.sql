-- =====================================================
-- TIS TIS PLATFORM - V7 Unified Architecture
-- Migration 128: Support for V7 Unified AI System
-- =====================================================
-- Esta migración implementa el soporte de base de datos para
-- la arquitectura V7 donde Preview y Producción usan el mismo
-- código path (LangGraph).
--
-- OBJETIVO: Eliminar inconsistencias entre lo que el usuario
-- prueba en Preview y lo que reciben sus clientes en producción.
--
-- CAMBIOS:
-- 1. Agregar flag use_v7_unified a ai_tenant_config
-- 2. Crear función helper para verificar si usar V7
-- 3. Crear vista de estadísticas de adopción
-- 4. Agregar métricas de circuit breaker
-- =====================================================

-- =====================================================
-- 1. AGREGAR COLUMNA use_v7_unified
-- =====================================================
-- Este flag determina si el tenant usa la arquitectura V7 unificada.
-- Cuando es true, tanto Preview como Producción usan el mismo código.

ALTER TABLE ai_tenant_config
ADD COLUMN IF NOT EXISTS use_v7_unified BOOLEAN DEFAULT false;

COMMENT ON COLUMN ai_tenant_config.use_v7_unified IS
'Flag para arquitectura V7 unificada. Cuando true, Preview y Producción
usan el mismo código path (LangGraph). Garantiza consistencia entre
lo que el usuario prueba y lo que reciben sus clientes.
Default: false para rollout gradual.';

-- Índice para consultas rápidas de tenants V7
CREATE INDEX IF NOT EXISTS idx_ai_tenant_config_v7_unified
ON public.ai_tenant_config(use_v7_unified)
WHERE use_v7_unified = true;

-- =====================================================
-- 2. FUNCIÓN HELPER PARA VERIFICAR V7
-- =====================================================

CREATE OR REPLACE FUNCTION public.tenant_uses_v7(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT
      CASE
        -- Si tiene V7 explícito, usar ese
        WHEN use_v7_unified IS NOT NULL THEN use_v7_unified
        -- Fallback: si tiene LangGraph activo, considerarlo V7
        ELSE COALESCE(use_langgraph, false)
      END
     FROM public.ai_tenant_config
     WHERE tenant_id = p_tenant_id
     LIMIT 1),
    false
  );
$$;

COMMENT ON FUNCTION public.tenant_uses_v7 IS
'Verifica si un tenant usa la arquitectura V7 unificada.
Retorna true si use_v7_unified = true, o como fallback si use_langgraph = true.';

GRANT EXECUTE ON FUNCTION public.tenant_uses_v7(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_uses_v7(UUID) TO service_role;

-- =====================================================
-- 3. VISTA DE ESTADÍSTICAS DE ADOPCIÓN V7
-- =====================================================

CREATE OR REPLACE VIEW v_ai_v7_adoption_stats AS
SELECT
    COUNT(*) FILTER (WHERE use_v7_unified = true) as v7_explicit_enabled,
    COUNT(*) FILTER (WHERE use_langgraph = true AND (use_v7_unified IS NULL OR use_v7_unified = false)) as langgraph_only,
    COUNT(*) FILTER (WHERE (use_v7_unified IS NULL OR use_v7_unified = false) AND (use_langgraph IS NULL OR use_langgraph = false)) as legacy_only,
    COUNT(*) as total_tenants,
    ROUND(
      COUNT(*) FILTER (WHERE use_v7_unified = true OR use_langgraph = true)::numeric /
      NULLIF(COUNT(*)::numeric, 0) * 100, 2
    ) as modern_architecture_percentage
FROM ai_tenant_config;

COMMENT ON VIEW v_ai_v7_adoption_stats IS
'Vista de estadísticas de adopción de arquitectura V7/LangGraph vs Legacy.
Usado para monitorear el progreso de la migración.';

-- =====================================================
-- 4. TABLA PARA MÉTRICAS DE CIRCUIT BREAKER
-- =====================================================
-- Permite persistir y analizar el comportamiento del circuit breaker

CREATE TABLE IF NOT EXISTS ai_circuit_breaker_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('success', 'failure', 'open', 'half_open', 'close', 'fallback')),
    error_message TEXT,
    processing_time_ms INTEGER,
    used_fallback BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_tenant
ON ai_circuit_breaker_events(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_type_time
ON ai_circuit_breaker_events(event_type, created_at DESC);

-- RLS
ALTER TABLE ai_circuit_breaker_events ENABLE ROW LEVEL SECURITY;

-- Solo service_role puede insertar/leer
CREATE POLICY "Service role full access on circuit_breaker"
ON ai_circuit_breaker_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Owners pueden ver métricas de su tenant
CREATE POLICY "Owners can view circuit breaker events"
ON ai_circuit_breaker_events
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid() AND role = 'owner'
    )
);

COMMENT ON TABLE ai_circuit_breaker_events IS
'Eventos del circuit breaker de AI para monitoreo y análisis.
Registra éxitos, fallos, cambios de estado y uso de fallback.';

-- =====================================================
-- 5. FUNCIÓN PARA REGISTRAR EVENTOS DE CIRCUIT BREAKER
-- =====================================================

CREATE OR REPLACE FUNCTION log_circuit_breaker_event(
    p_tenant_id UUID,
    p_event_type TEXT,
    p_error_message TEXT DEFAULT NULL,
    p_processing_time_ms INTEGER DEFAULT NULL,
    p_used_fallback BOOLEAN DEFAULT false,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO ai_circuit_breaker_events (
        tenant_id,
        event_type,
        error_message,
        processing_time_ms,
        used_fallback,
        metadata
    ) VALUES (
        p_tenant_id,
        p_event_type,
        p_error_message,
        p_processing_time_ms,
        p_used_fallback,
        p_metadata
    )
    RETURNING id INTO event_id;

    RETURN event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_circuit_breaker_event TO service_role;

-- =====================================================
-- 6. VISTA DE HEALTH DEL SISTEMA AI
-- =====================================================

CREATE OR REPLACE VIEW v_ai_system_health AS
WITH recent_events AS (
    SELECT
        tenant_id,
        event_type,
        used_fallback,
        processing_time_ms,
        created_at
    FROM ai_circuit_breaker_events
    WHERE created_at > NOW() - INTERVAL '1 hour'
),
tenant_health AS (
    SELECT
        tenant_id,
        COUNT(*) FILTER (WHERE event_type = 'success') as successes,
        COUNT(*) FILTER (WHERE event_type = 'failure') as failures,
        COUNT(*) FILTER (WHERE used_fallback = true) as fallbacks,
        AVG(processing_time_ms) FILTER (WHERE processing_time_ms IS NOT NULL) as avg_latency_ms,
        MAX(processing_time_ms) FILTER (WHERE processing_time_ms IS NOT NULL) as max_latency_ms
    FROM recent_events
    GROUP BY tenant_id
)
SELECT
    tenant_id,
    successes,
    failures,
    fallbacks,
    ROUND(avg_latency_ms::numeric, 2) as avg_latency_ms,
    max_latency_ms,
    CASE
        WHEN successes + failures = 0 THEN 100
        ELSE ROUND((successes::numeric / (successes + failures)::numeric) * 100, 2)
    END as success_rate,
    CASE
        WHEN failures >= 5 THEN 'critical'
        WHEN failures >= 3 THEN 'degraded'
        WHEN fallbacks > 0 THEN 'recovering'
        ELSE 'healthy'
    END as health_status
FROM tenant_health;

COMMENT ON VIEW v_ai_system_health IS
'Vista de salud del sistema AI por tenant (última hora).
Muestra tasa de éxito, latencia y estado del circuit breaker.';

-- =====================================================
-- 7. CLEANUP DE EVENTOS ANTIGUOS
-- =====================================================
-- Función para limpiar eventos de circuit breaker más antiguos de 7 días

CREATE OR REPLACE FUNCTION cleanup_old_circuit_breaker_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ai_circuit_breaker_events
    WHERE created_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE 'Deleted % old circuit breaker events', deleted_count;
    RETURN deleted_count;
END;
$$;

-- =====================================================
-- 8. ACTIVAR V7 PARA TODOS LOS TENANTS
-- =====================================================
-- Como estamos en fase de prueba, activamos V7 para todos

UPDATE ai_tenant_config SET use_v7_unified = true;

-- 9. LOG DE MIGRACIÓN
-- =====================================================

DO $$
DECLARE
    v7_count INTEGER;
    langgraph_count INTEGER;
    legacy_count INTEGER;
BEGIN
    SELECT
        COUNT(*) FILTER (WHERE use_v7_unified = true),
        COUNT(*) FILTER (WHERE use_langgraph = true AND (use_v7_unified IS NULL OR use_v7_unified = false)),
        COUNT(*) FILTER (WHERE (use_v7_unified IS NULL OR use_v7_unified = false) AND (use_langgraph IS NULL OR use_langgraph = false))
    INTO v7_count, langgraph_count, legacy_count
    FROM ai_tenant_config;

    RAISE NOTICE 'Migration 128 completed: V7 Unified Architecture';
    RAISE NOTICE 'V7 ACTIVATED FOR ALL TENANTS';
    RAISE NOTICE 'Current distribution: V7=%, LangGraph=%, Legacy=%', v7_count, langgraph_count, legacy_count;
END $$;

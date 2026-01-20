-- =====================================================
-- TIS TIS PLATFORM - VOICE AGENT v2.0
-- Migration: 145_VOICE_ASSISTANT_METRICS.sql
-- Date: January 2025
-- Version: 2.0
--
-- PURPOSE: Crear tabla de metricas agregadas para
-- el Voice Agent. Almacena estadisticas por periodo
-- para dashboard y analisis de performance.
--
-- PARTE DE: Voice Agent v2.0 - FASE 01 - MICROFASE 1.4
-- =====================================================

-- =====================================================
-- TABLA: voice_assistant_metrics
-- Metricas agregadas por periodo (hora/dia/semana)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_assistant_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relaciones (en TIS TIS, tenant = business)
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    config_id UUID REFERENCES public.voice_assistant_configs(id) ON DELETE SET NULL,

    -- Periodo de agregacion
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN (
        'hourly',
        'daily',
        'weekly',
        'monthly'
    )),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Metricas de llamadas
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    abandoned_calls INTEGER DEFAULT 0,
    transferred_calls INTEGER DEFAULT 0,

    -- Metricas de duracion
    total_duration_seconds INTEGER DEFAULT 0,
    avg_duration_seconds DECIMAL(10,2) DEFAULT 0,
    min_duration_seconds INTEGER DEFAULT 0,
    max_duration_seconds INTEGER DEFAULT 0,

    -- Metricas de latencia
    avg_latency_ms INTEGER DEFAULT 0,
    p50_latency_ms INTEGER DEFAULT 0,
    p95_latency_ms INTEGER DEFAULT 0,
    p99_latency_ms INTEGER DEFAULT 0,

    -- Metricas de negocio por vertical
    -- Restaurant
    reservations_created INTEGER DEFAULT 0,
    reservations_modified INTEGER DEFAULT 0,
    reservations_cancelled INTEGER DEFAULT 0,
    orders_created INTEGER DEFAULT 0,
    orders_total_value DECIMAL(12,2) DEFAULT 0,

    -- Dental
    appointments_created INTEGER DEFAULT 0,
    appointments_modified INTEGER DEFAULT 0,
    appointments_cancelled INTEGER DEFAULT 0,

    -- Comunes
    faq_questions_answered INTEGER DEFAULT 0,
    human_transfers INTEGER DEFAULT 0,

    -- Metricas de satisfaccion
    -- (si se implementa post-call survey)
    surveys_sent INTEGER DEFAULT 0,
    surveys_completed INTEGER DEFAULT 0,
    avg_satisfaction_score DECIMAL(3,2),
    nps_score DECIMAL(5,2),

    -- Metricas de errores
    error_count INTEGER DEFAULT 0,
    circuit_breaker_trips INTEGER DEFAULT 0,
    timeout_count INTEGER DEFAULT 0,
    transcription_errors INTEGER DEFAULT 0,

    -- Metricas de costo
    total_voice_cost DECIMAL(10,4) DEFAULT 0,
    total_ai_cost DECIMAL(10,4) DEFAULT 0,
    total_telephony_cost DECIMAL(10,4) DEFAULT 0,

    -- Metadata
    is_aggregated BOOLEAN DEFAULT false, -- True cuando se calculo de voice_calls
    aggregated_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: periodo unico por tenant y config
    UNIQUE(tenant_id, config_id, period_type, period_start)
);

-- =====================================================
-- INDICES
-- =====================================================

-- Indice por tenant
CREATE INDEX idx_voice_assistant_metrics_tenant
    ON public.voice_assistant_metrics(tenant_id);

-- Indice por periodo (para queries de dashboard)
CREATE INDEX idx_voice_assistant_metrics_period
    ON public.voice_assistant_metrics(period_type, period_start DESC);

-- Indice por config
CREATE INDEX idx_voice_assistant_metrics_config
    ON public.voice_assistant_metrics(config_id)
    WHERE config_id IS NOT NULL;

-- Indice compuesto para queries comunes de dashboard
CREATE INDEX idx_voice_assistant_metrics_tenant_period
    ON public.voice_assistant_metrics(tenant_id, period_type, period_start DESC);

-- Indice para agregacion
CREATE INDEX idx_voice_assistant_metrics_not_aggregated
    ON public.voice_assistant_metrics(is_aggregated)
    WHERE is_aggregated = false;

-- =====================================================
-- TRIGGER: Actualizar updated_at automaticamente
-- =====================================================

CREATE TRIGGER update_voice_assistant_metrics_updated_at
    BEFORE UPDATE ON public.voice_assistant_metrics
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.voice_assistant_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios pueden ver metricas de su tenant
CREATE POLICY "voice_assistant_metrics_select_own"
    ON public.voice_assistant_metrics
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()
        )
    );

-- Policy: Solo service role puede insertar/actualizar (via jobs de agregacion)
CREATE POLICY "voice_assistant_metrics_service_role"
    ON public.voice_assistant_metrics
    FOR ALL
    USING (
        current_setting('role', true) = 'service_role'
    )
    WITH CHECK (
        current_setting('role', true) = 'service_role'
    );

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE public.voice_assistant_metrics IS
'Metricas agregadas del Voice Agent por periodo. Se generan automaticamente desde voice_calls para optimizar queries de dashboard.';

COMMENT ON COLUMN public.voice_assistant_metrics.period_type IS
'Tipo de agregacion: hourly (por hora), daily (por dia), weekly (por semana), monthly (por mes).';

COMMENT ON COLUMN public.voice_assistant_metrics.is_aggregated IS
'True cuando las metricas fueron calculadas de voice_calls. False si es un placeholder.';

-- =====================================================
-- FUNCION: Agregar metricas desde voice_calls
-- =====================================================

-- Drop function if exists to allow signature changes
DROP FUNCTION IF EXISTS aggregate_voice_metrics(UUID, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION aggregate_voice_metrics(
    p_tenant_id UUID,
    p_period_type VARCHAR,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
    v_config_id UUID;
    v_metric_id UUID;
    v_metrics RECORD;
BEGIN
    -- Obtener config_id
    SELECT id INTO v_config_id
    FROM public.voice_assistant_configs
    WHERE tenant_id = p_tenant_id
    LIMIT 1;

    -- Calcular metricas agregadas desde voice_calls
    SELECT
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_calls,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_calls,
        COUNT(*) FILTER (WHERE status = 'abandoned' OR end_reason = 'customer_hangup') as abandoned_calls,
        COUNT(*) FILTER (WHERE end_reason = 'transferred') as transferred_calls,
        COALESCE(SUM(duration_seconds), 0) as total_duration,
        COALESCE(AVG(duration_seconds), 0) as avg_duration,
        COALESCE(MIN(duration_seconds), 0) as min_duration,
        COALESCE(MAX(duration_seconds), 0) as max_duration,
        COALESCE(AVG(latency_ms), 0)::INTEGER as avg_latency,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms), 0)::INTEGER as p50_latency,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::INTEGER as p95_latency,
        COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms), 0)::INTEGER as p99_latency,
        COUNT(*) FILTER (WHERE analysis_data->>'reservation_created' = 'true') as reservations_created,
        COUNT(*) FILTER (WHERE analysis_data->>'appointment_created' = 'true') as appointments_created,
        COUNT(*) FILTER (WHERE analysis_data->>'order_created' = 'true') as orders_created,
        COUNT(*) FILTER (WHERE end_reason = 'transferred') as human_transfers
    INTO v_metrics
    FROM public.voice_calls
    WHERE tenant_id = p_tenant_id
        AND started_at >= p_start_date
        AND started_at < p_end_date;

    -- Insertar o actualizar metricas
    INSERT INTO public.voice_assistant_metrics (
        tenant_id,
        config_id,
        period_type,
        period_start,
        period_end,
        total_calls,
        successful_calls,
        failed_calls,
        abandoned_calls,
        transferred_calls,
        total_duration_seconds,
        avg_duration_seconds,
        min_duration_seconds,
        max_duration_seconds,
        avg_latency_ms,
        p50_latency_ms,
        p95_latency_ms,
        p99_latency_ms,
        reservations_created,
        appointments_created,
        orders_created,
        human_transfers,
        is_aggregated,
        aggregated_at
    )
    VALUES (
        p_tenant_id,
        v_config_id,
        p_period_type,
        p_start_date,
        p_end_date,
        v_metrics.total_calls,
        v_metrics.successful_calls,
        v_metrics.failed_calls,
        v_metrics.abandoned_calls,
        v_metrics.transferred_calls,
        v_metrics.total_duration,
        v_metrics.avg_duration,
        v_metrics.min_duration,
        v_metrics.max_duration,
        v_metrics.avg_latency,
        v_metrics.p50_latency,
        v_metrics.p95_latency,
        v_metrics.p99_latency,
        v_metrics.reservations_created,
        v_metrics.appointments_created,
        v_metrics.orders_created,
        v_metrics.human_transfers,
        true,
        NOW()
    )
    ON CONFLICT (tenant_id, config_id, period_type, period_start)
    DO UPDATE SET
        total_calls = EXCLUDED.total_calls,
        successful_calls = EXCLUDED.successful_calls,
        failed_calls = EXCLUDED.failed_calls,
        abandoned_calls = EXCLUDED.abandoned_calls,
        transferred_calls = EXCLUDED.transferred_calls,
        total_duration_seconds = EXCLUDED.total_duration_seconds,
        avg_duration_seconds = EXCLUDED.avg_duration_seconds,
        min_duration_seconds = EXCLUDED.min_duration_seconds,
        max_duration_seconds = EXCLUDED.max_duration_seconds,
        avg_latency_ms = EXCLUDED.avg_latency_ms,
        p50_latency_ms = EXCLUDED.p50_latency_ms,
        p95_latency_ms = EXCLUDED.p95_latency_ms,
        p99_latency_ms = EXCLUDED.p99_latency_ms,
        reservations_created = EXCLUDED.reservations_created,
        appointments_created = EXCLUDED.appointments_created,
        orders_created = EXCLUDED.orders_created,
        human_transfers = EXCLUDED.human_transfers,
        is_aggregated = true,
        aggregated_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_metric_id;

    RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION aggregate_voice_metrics IS
'Agrega metricas desde voice_calls para un periodo especifico. Se llama desde un cron job.';

-- =====================================================
-- FUNCION: Obtener metricas para dashboard
-- =====================================================

-- Drop function if exists to allow signature changes
DROP FUNCTION IF EXISTS get_voice_dashboard_metrics(UUID, VARCHAR, INTEGER);

CREATE OR REPLACE FUNCTION get_voice_dashboard_metrics(
    p_tenant_id UUID,
    p_period_type VARCHAR DEFAULT 'daily',
    p_limit INTEGER DEFAULT 30
)
RETURNS TABLE (
    period_start TIMESTAMPTZ,
    total_calls INTEGER,
    successful_calls INTEGER,
    failed_calls INTEGER,
    avg_duration_seconds DECIMAL,
    p95_latency_ms INTEGER,
    reservations_created INTEGER,
    appointments_created INTEGER,
    human_transfers INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.period_start,
        m.total_calls,
        m.successful_calls,
        m.failed_calls,
        m.avg_duration_seconds,
        m.p95_latency_ms,
        m.reservations_created,
        m.appointments_created,
        m.human_transfers
    FROM public.voice_assistant_metrics m
    WHERE m.tenant_id = p_tenant_id
        AND m.period_type = p_period_type
    ORDER BY m.period_start DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_voice_dashboard_metrics IS
'Obtiene metricas agregadas para mostrar en el dashboard del Voice Agent.';

-- =====================================================
-- FIN MIGRACION 145
-- =====================================================

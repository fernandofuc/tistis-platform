-- =====================================================
-- TIS TIS PLATFORM - VOICE AGENT v2.0
-- Migration: 146_VOICE_CIRCUIT_BREAKER_STATE.sql
-- Date: January 2025
-- Version: 2.0
--
-- PURPOSE: Crear tabla para el estado del Circuit Breaker
-- del Voice Agent. Implementa el patron Circuit Breaker
-- para manejar fallos y proteger el sistema.
--
-- PARTE DE: Voice Agent v2.0 - FASE 01 - MICROFASE 1.5
--
-- CIRCUIT BREAKER PATTERN:
-- - CLOSED: Normal operation, tracking failures
-- - OPEN: Failures exceeded threshold, rejecting calls
-- - HALF_OPEN: Testing if service recovered
-- =====================================================

-- =====================================================
-- TIPO ENUM: Estado del Circuit Breaker
-- =====================================================

DO $$ BEGIN
    CREATE TYPE voice_circuit_breaker_state_enum AS ENUM (
        'CLOSED',    -- Normal operation
        'OPEN',      -- Failing, reject requests
        'HALF_OPEN'  -- Testing recovery
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLA: voice_circuit_breaker_state
-- Estado del circuit breaker por business/servicio
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_circuit_breaker_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relaciones
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

    -- Identificador del servicio monitoreado
    service_name VARCHAR(100) NOT NULL CHECK (service_name IN (
        'vapi',           -- VAPI API
        'elevenlabs',     -- ElevenLabs TTS
        'deepgram',       -- Deepgram STT
        'openai',         -- OpenAI/GPT
        'twilio',         -- Twilio telephony
        'webhook',        -- Nuestro webhook handler
        'voice_agent'     -- Voice Agent general
    )),

    -- Estado actual del circuit breaker
    state voice_circuit_breaker_state_enum NOT NULL DEFAULT 'CLOSED',

    -- Contadores
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    consecutive_successes INTEGER DEFAULT 0,

    -- Configuracion del circuit breaker
    failure_threshold INTEGER DEFAULT 5,         -- Fallos para abrir
    success_threshold INTEGER DEFAULT 3,         -- Exitos para cerrar desde HALF_OPEN
    timeout_seconds INTEGER DEFAULT 60,          -- Tiempo en OPEN antes de HALF_OPEN

    -- Timestamps de eventos
    last_failure_time TIMESTAMPTZ,
    last_success_time TIMESTAMPTZ,
    last_state_change TIMESTAMPTZ DEFAULT NOW(),
    opened_at TIMESTAMPTZ,                       -- Cuando se abrio
    half_opened_at TIMESTAMPTZ,                  -- Cuando paso a half-open

    -- Ultimo error registrado
    last_error_message TEXT,
    last_error_code VARCHAR(100),

    -- Metricas de ventana de tiempo (ultimos 5 min)
    window_start TIMESTAMPTZ DEFAULT NOW(),
    window_failure_count INTEGER DEFAULT 0,
    window_success_count INTEGER DEFAULT 0,
    window_total_count INTEGER DEFAULT 0,

    -- Metadata
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: un registro por business + servicio
    UNIQUE(business_id, service_name)
);

-- =====================================================
-- INDICES
-- =====================================================

-- Indice por tenant
CREATE INDEX idx_voice_circuit_breaker_tenant
    ON public.voice_circuit_breaker_state(tenant_id);

-- Indice por business
CREATE INDEX idx_voice_circuit_breaker_business
    ON public.voice_circuit_breaker_state(business_id);

-- Indice por estado (para alertas y monitoreo)
CREATE INDEX idx_voice_circuit_breaker_state
    ON public.voice_circuit_breaker_state(state);

-- Indice para encontrar circuit breakers abiertos
CREATE INDEX idx_voice_circuit_breaker_open
    ON public.voice_circuit_breaker_state(state, opened_at)
    WHERE state = 'OPEN';

-- Indice compuesto para queries comunes
CREATE INDEX idx_voice_circuit_breaker_business_service
    ON public.voice_circuit_breaker_state(business_id, service_name);

-- =====================================================
-- TRIGGER: Actualizar updated_at automaticamente
-- =====================================================

CREATE TRIGGER update_voice_circuit_breaker_updated_at
    BEFORE UPDATE ON public.voice_circuit_breaker_state
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.voice_circuit_breaker_state ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios pueden ver estado de su tenant
CREATE POLICY "voice_circuit_breaker_select_own"
    ON public.voice_circuit_breaker_state
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()
        )
    );

-- Policy: Solo service role puede modificar (via backend)
CREATE POLICY "voice_circuit_breaker_service_role"
    ON public.voice_circuit_breaker_state
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

COMMENT ON TABLE public.voice_circuit_breaker_state IS
'Estado del Circuit Breaker para el Voice Agent. Implementa el patron Circuit Breaker para manejar fallos de servicios externos (VAPI, ElevenLabs, etc.).';

COMMENT ON COLUMN public.voice_circuit_breaker_state.state IS
'Estado actual: CLOSED (normal), OPEN (rechazando), HALF_OPEN (probando).';

COMMENT ON COLUMN public.voice_circuit_breaker_state.failure_threshold IS
'Numero de fallos consecutivos para abrir el circuit breaker.';

COMMENT ON COLUMN public.voice_circuit_breaker_state.timeout_seconds IS
'Segundos en estado OPEN antes de pasar a HALF_OPEN para probar recovery.';

-- =====================================================
-- FUNCION: Registrar exito en el circuit breaker
-- =====================================================

CREATE OR REPLACE FUNCTION record_circuit_breaker_success(
    p_business_id UUID,
    p_service_name VARCHAR
)
RETURNS voice_circuit_breaker_state_enum AS $$
DECLARE
    v_state voice_circuit_breaker_state_enum;
    v_success_threshold INTEGER;
    v_consecutive_successes INTEGER;
BEGIN
    -- Obtener o crear registro
    INSERT INTO public.voice_circuit_breaker_state (
        tenant_id, business_id, service_name
    )
    SELECT b.tenant_id, p_business_id, p_service_name
    FROM public.businesses b
    WHERE b.id = p_business_id
    ON CONFLICT (business_id, service_name) DO NOTHING;

    -- Actualizar contadores
    UPDATE public.voice_circuit_breaker_state
    SET
        success_count = success_count + 1,
        consecutive_successes = consecutive_successes + 1,
        consecutive_failures = 0,
        last_success_time = NOW(),
        window_success_count = window_success_count + 1,
        window_total_count = window_total_count + 1
    WHERE business_id = p_business_id
        AND service_name = p_service_name
    RETURNING state, success_threshold, consecutive_successes
    INTO v_state, v_success_threshold, v_consecutive_successes;

    -- Transicion de estado si aplica
    IF v_state = 'HALF_OPEN' AND v_consecutive_successes >= v_success_threshold THEN
        -- Cerrar el circuit breaker
        UPDATE public.voice_circuit_breaker_state
        SET
            state = 'CLOSED',
            last_state_change = NOW(),
            opened_at = NULL,
            half_opened_at = NULL
        WHERE business_id = p_business_id
            AND service_name = p_service_name;
        v_state := 'CLOSED';
    END IF;

    RETURN v_state;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_circuit_breaker_success IS
'Registra un exito en el circuit breaker. Puede cerrar el breaker si esta en HALF_OPEN.';

-- =====================================================
-- FUNCION: Registrar fallo en el circuit breaker
-- =====================================================

CREATE OR REPLACE FUNCTION record_circuit_breaker_failure(
    p_business_id UUID,
    p_service_name VARCHAR,
    p_error_message TEXT DEFAULT NULL,
    p_error_code VARCHAR DEFAULT NULL
)
RETURNS voice_circuit_breaker_state_enum AS $$
DECLARE
    v_state voice_circuit_breaker_state_enum;
    v_failure_threshold INTEGER;
    v_consecutive_failures INTEGER;
    v_tenant_id UUID;
BEGIN
    -- Obtener tenant_id
    SELECT tenant_id INTO v_tenant_id
    FROM public.businesses
    WHERE id = p_business_id;

    -- Obtener o crear registro
    INSERT INTO public.voice_circuit_breaker_state (
        tenant_id, business_id, service_name
    )
    VALUES (v_tenant_id, p_business_id, p_service_name)
    ON CONFLICT (business_id, service_name) DO NOTHING;

    -- Actualizar contadores
    UPDATE public.voice_circuit_breaker_state
    SET
        failure_count = failure_count + 1,
        consecutive_failures = consecutive_failures + 1,
        consecutive_successes = 0,
        last_failure_time = NOW(),
        last_error_message = COALESCE(p_error_message, last_error_message),
        last_error_code = COALESCE(p_error_code, last_error_code),
        window_failure_count = window_failure_count + 1,
        window_total_count = window_total_count + 1
    WHERE business_id = p_business_id
        AND service_name = p_service_name
    RETURNING state, failure_threshold, consecutive_failures
    INTO v_state, v_failure_threshold, v_consecutive_failures;

    -- Transicion de estado si aplica
    IF v_state = 'CLOSED' AND v_consecutive_failures >= v_failure_threshold THEN
        -- Abrir el circuit breaker
        UPDATE public.voice_circuit_breaker_state
        SET
            state = 'OPEN',
            last_state_change = NOW(),
            opened_at = NOW()
        WHERE business_id = p_business_id
            AND service_name = p_service_name;
        v_state := 'OPEN';
    ELSIF v_state = 'HALF_OPEN' THEN
        -- Volver a abrir si falla en HALF_OPEN
        UPDATE public.voice_circuit_breaker_state
        SET
            state = 'OPEN',
            last_state_change = NOW(),
            opened_at = NOW(),
            half_opened_at = NULL
        WHERE business_id = p_business_id
            AND service_name = p_service_name;
        v_state := 'OPEN';
    END IF;

    RETURN v_state;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_circuit_breaker_failure IS
'Registra un fallo en el circuit breaker. Puede abrir el breaker si excede el threshold.';

-- =====================================================
-- FUNCION: Verificar si se puede hacer request
-- =====================================================

CREATE OR REPLACE FUNCTION can_make_request(
    p_business_id UUID,
    p_service_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    v_state voice_circuit_breaker_state_enum;
    v_opened_at TIMESTAMPTZ;
    v_timeout_seconds INTEGER;
BEGIN
    -- Obtener estado actual
    SELECT state, opened_at, timeout_seconds
    INTO v_state, v_opened_at, v_timeout_seconds
    FROM public.voice_circuit_breaker_state
    WHERE business_id = p_business_id
        AND service_name = p_service_name;

    -- Si no existe registro, permitir
    IF v_state IS NULL THEN
        RETURN true;
    END IF;

    -- Si esta cerrado, permitir
    IF v_state = 'CLOSED' THEN
        RETURN true;
    END IF;

    -- Si esta half-open, permitir (para probar)
    IF v_state = 'HALF_OPEN' THEN
        RETURN true;
    END IF;

    -- Si esta abierto, verificar si ya paso el timeout
    IF v_state = 'OPEN' AND v_opened_at IS NOT NULL THEN
        IF NOW() > (v_opened_at + (v_timeout_seconds || ' seconds')::interval) THEN
            -- Pasar a HALF_OPEN
            UPDATE public.voice_circuit_breaker_state
            SET
                state = 'HALF_OPEN',
                last_state_change = NOW(),
                half_opened_at = NOW(),
                consecutive_successes = 0,
                consecutive_failures = 0
            WHERE business_id = p_business_id
                AND service_name = p_service_name;
            RETURN true;
        END IF;
    END IF;

    -- Circuit breaker abierto, rechazar
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_make_request IS
'Verifica si se puede hacer un request al servicio. Maneja transiciones de OPEN a HALF_OPEN.';

-- =====================================================
-- FUNCION: Obtener estado de todos los circuit breakers
-- =====================================================

CREATE OR REPLACE FUNCTION get_circuit_breaker_status(p_business_id UUID)
RETURNS TABLE (
    service_name VARCHAR,
    state voice_circuit_breaker_state_enum,
    failure_count INTEGER,
    consecutive_failures INTEGER,
    last_failure_time TIMESTAMPTZ,
    last_error_message TEXT,
    opened_at TIMESTAMPTZ,
    is_healthy BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cb.service_name,
        cb.state,
        cb.failure_count,
        cb.consecutive_failures,
        cb.last_failure_time,
        cb.last_error_message,
        cb.opened_at,
        (cb.state = 'CLOSED') as is_healthy
    FROM public.voice_circuit_breaker_state cb
    WHERE cb.business_id = p_business_id
    ORDER BY cb.service_name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_circuit_breaker_status IS
'Obtiene el estado de todos los circuit breakers para un business.';

-- =====================================================
-- FUNCION: Reset manual del circuit breaker
-- =====================================================

CREATE OR REPLACE FUNCTION reset_circuit_breaker(
    p_business_id UUID,
    p_service_name VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.voice_circuit_breaker_state
    SET
        state = 'CLOSED',
        failure_count = 0,
        consecutive_failures = 0,
        consecutive_successes = 0,
        last_state_change = NOW(),
        opened_at = NULL,
        half_opened_at = NULL,
        window_failure_count = 0,
        window_success_count = 0,
        window_total_count = 0,
        window_start = NOW()
    WHERE business_id = p_business_id
        AND service_name = p_service_name;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_circuit_breaker IS
'Reset manual del circuit breaker. Usar con cuidado - solo para recovery manual.';

-- =====================================================
-- FIN MIGRACION 146
-- =====================================================

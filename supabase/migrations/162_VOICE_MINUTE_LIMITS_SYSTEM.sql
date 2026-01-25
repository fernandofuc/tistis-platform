-- =====================================================
-- TIS TIS PLATFORM - VOICE MINUTE LIMITS SYSTEM
-- Migration: 162_VOICE_MINUTE_LIMITS_SYSTEM.sql
-- Date: January 2025
-- Version: 1.0
--
-- PURPOSE: Implementar sistema de limites de minutos
-- para Voice Agent en plan Growth. Incluye:
-- - Configuracion de limites por tenant
-- - Tracking de uso por periodo de facturacion
-- - Log de transacciones para auditoria
-- - RPCs para validacion y registro
-- - Sistema de alertas automatico
--
-- PLAN GROWTH: 200 minutos incluidos/mes
-- OVERAGE: $3.50 MXN por minuto adicional
-- =====================================================

-- =====================================================
-- MICRO-FASE 1.1: TABLA voice_minute_limits
-- Configuracion de limites por tenant
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_minute_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relacion con tenant (1 registro por tenant)
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Limites base (configurados segun plan)
    included_minutes INTEGER NOT NULL DEFAULT 200
        CHECK (included_minutes >= 0),

    -- Precio de overage en centavos MXN ($3.50 MXN = 350 centavos)
    overage_price_centavos INTEGER NOT NULL DEFAULT 350
        CHECK (overage_price_centavos >= 0),

    -- Politica cuando se excede el limite
    -- block: rechaza llamadas al exceder
    -- charge: permite y cobra
    -- notify_only: permite sin cobrar (uso de cortesia limitado)
    overage_policy VARCHAR(20) NOT NULL DEFAULT 'charge'
        CHECK (overage_policy IN ('block', 'charge', 'notify_only')),

    -- Limite maximo de cargo por overage en centavos (proteccion)
    -- Default $2,000 MXN para evitar cargos excesivos por error
    max_overage_charge_centavos INTEGER NOT NULL DEFAULT 200000
        CHECK (max_overage_charge_centavos >= 0),

    -- Umbrales de alerta (porcentajes 0-100)
    -- Se envia alerta cuando el uso alcanza cada umbral
    -- NOT NULL para evitar comportamiento inesperado en RPCs
    alert_thresholds INTEGER[] NOT NULL DEFAULT ARRAY[70, 85, 95, 100],

    -- Configuracion de notificaciones
    email_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
    push_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
    webhook_alerts_enabled BOOLEAN NOT NULL DEFAULT false,
    webhook_url TEXT,

    -- Stripe metered billing (para cobro automatico)
    stripe_meter_id VARCHAR(255),
    stripe_price_id VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Un registro por tenant (constraint unico)
    UNIQUE(tenant_id)
);

-- Comentarios de documentacion
COMMENT ON TABLE public.voice_minute_limits IS
'Configuracion de limites de minutos de Voice Agent por tenant. Solo aplica a plan Growth.';

COMMENT ON COLUMN public.voice_minute_limits.included_minutes IS
'Minutos incluidos en el plan (200 para Growth).';

COMMENT ON COLUMN public.voice_minute_limits.overage_policy IS
'block: rechaza llamadas al exceder. charge: permite y cobra $3.50/min. notify_only: permite sin cobrar.';

COMMENT ON COLUMN public.voice_minute_limits.max_overage_charge_centavos IS
'Limite de seguridad para evitar cargos excesivos. Default $2,000 MXN (200000 centavos).';

COMMENT ON COLUMN public.voice_minute_limits.alert_thresholds IS
'Porcentajes de uso que disparan alertas. Default: 70%, 85%, 95%, 100%.';

-- =====================================================
-- MICRO-FASE 1.2: TABLA voice_minute_usage
-- Tracking de uso por periodo de facturacion
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_minute_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relacion con tenant
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Periodo de facturacion (mensual, alineado con billing de Stripe)
    billing_period_start TIMESTAMPTZ NOT NULL,
    billing_period_end TIMESTAMPTZ NOT NULL,

    -- Uso de minutos incluidos (puede tener decimales por redondeo)
    included_minutes_used DECIMAL(10,2) NOT NULL DEFAULT 0
        CHECK (included_minutes_used >= 0),

    -- Uso de minutos en overage
    overage_minutes_used DECIMAL(10,2) NOT NULL DEFAULT 0
        CHECK (overage_minutes_used >= 0),

    -- Cargos de overage acumulados (centavos MXN)
    overage_charges_centavos INTEGER NOT NULL DEFAULT 0
        CHECK (overage_charges_centavos >= 0),

    -- Control de alertas (evita enviar misma alerta multiples veces)
    last_alert_threshold INTEGER NOT NULL DEFAULT 0
        CHECK (last_alert_threshold >= 0),
    last_alert_sent_at TIMESTAMPTZ,

    -- Estado de bloqueo
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    blocked_at TIMESTAMPTZ,
    blocked_reason VARCHAR(255),

    -- Stripe tracking (para conciliacion)
    stripe_invoice_id VARCHAR(255),
    stripe_usage_record_id VARCHAR(255),

    -- Estadisticas
    total_calls INTEGER NOT NULL DEFAULT 0
        CHECK (total_calls >= 0),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Un registro por periodo por tenant
    UNIQUE(tenant_id, billing_period_start),

    -- Constraint para asegurar que el periodo es valido
    CONSTRAINT valid_billing_period CHECK (billing_period_end > billing_period_start)
);

-- Indices para queries comunes
CREATE INDEX idx_voice_minute_usage_tenant
    ON public.voice_minute_usage(tenant_id);

CREATE INDEX idx_voice_minute_usage_period
    ON public.voice_minute_usage(billing_period_start, billing_period_end);

-- Indice para obtener periodo actual rapidamente
CREATE INDEX idx_voice_minute_usage_current
    ON public.voice_minute_usage(tenant_id, billing_period_end DESC);

-- Indice para buscar periodos no facturados
CREATE INDEX idx_voice_minute_usage_pending_billing
    ON public.voice_minute_usage(billing_period_end, is_blocked)
    WHERE overage_charges_centavos > 0 AND stripe_invoice_id IS NULL;

-- Comentarios
COMMENT ON TABLE public.voice_minute_usage IS
'Tracking de uso de minutos de Voice Agent por periodo de facturacion mensual.';

COMMENT ON COLUMN public.voice_minute_usage.last_alert_threshold IS
'Ultimo umbral de alerta enviado (70, 85, 95, 100). Evita enviar la misma alerta multiples veces.';

COMMENT ON COLUMN public.voice_minute_usage.is_blocked IS
'True cuando el tenant ha sido bloqueado por exceder limites con politica block.';

-- =====================================================
-- MICRO-FASE 1.3: TABLA voice_minute_transactions
-- Log detallado de cada uso de minutos (auditoria)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_minute_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relaciones
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    usage_id UUID NOT NULL REFERENCES public.voice_minute_usage(id) ON DELETE CASCADE,
    call_id UUID REFERENCES public.voice_calls(id) ON DELETE SET NULL,

    -- Detalles de uso
    minutes_used DECIMAL(10,2) NOT NULL
        CHECK (minutes_used >= 0),
    seconds_used INTEGER NOT NULL
        CHECK (seconds_used > 0),

    -- Clasificacion
    is_overage BOOLEAN NOT NULL DEFAULT false,

    -- Cargo si es overage (centavos MXN)
    charge_centavos INTEGER NOT NULL DEFAULT 0
        CHECK (charge_centavos >= 0),

    -- Stripe tracking (para conciliacion detallada)
    stripe_invoice_item_id VARCHAR(255),
    stripe_usage_record_id VARCHAR(255),

    -- Metadata de la llamada (para debugging)
    call_metadata JSONB DEFAULT '{}',

    -- Timestamps
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_voice_minute_transactions_tenant
    ON public.voice_minute_transactions(tenant_id);

CREATE INDEX idx_voice_minute_transactions_usage
    ON public.voice_minute_transactions(usage_id);

CREATE INDEX idx_voice_minute_transactions_call
    ON public.voice_minute_transactions(call_id)
    WHERE call_id IS NOT NULL;

CREATE INDEX idx_voice_minute_transactions_recorded
    ON public.voice_minute_transactions(recorded_at DESC);

-- Indice para transacciones de overage no facturadas
CREATE INDEX idx_voice_minute_transactions_overage_unbilled
    ON public.voice_minute_transactions(tenant_id, is_overage, stripe_invoice_item_id)
    WHERE is_overage = true AND stripe_invoice_item_id IS NULL;

-- Indice unico parcial para prevenir doble-registro de la misma llamada
-- Solo aplica cuando call_id no es NULL (permite multiples registros manuales sin call_id)
CREATE UNIQUE INDEX idx_voice_minute_transactions_call_unique
    ON public.voice_minute_transactions(call_id)
    WHERE call_id IS NOT NULL;

-- Comentarios
COMMENT ON TABLE public.voice_minute_transactions IS
'Log de cada transaccion de minutos de Voice Agent. Usado para auditoria y billing detallado.';

COMMENT ON COLUMN public.voice_minute_transactions.is_overage IS
'True si estos minutos fueron consumidos despues de agotar los minutos incluidos.';

COMMENT ON COLUMN public.voice_minute_transactions.call_metadata IS
'Metadata de la llamada para debugging (direccion, duracion, etc).';

-- =====================================================
-- MICRO-FASE 1.4: RPC check_minute_limit
-- Validar si una llamada puede proceder
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_minute_limit(
    p_tenant_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_limits RECORD;
    v_usage RECORD;
    v_tenant RECORD;
    v_total_used DECIMAL;
    v_remaining DECIMAL;
    v_current_period_start TIMESTAMPTZ;
    v_current_period_end TIMESTAMPTZ;
    v_usage_percent DECIMAL;
    v_result JSONB;
    v_has_access BOOLEAN;
BEGIN
    -- =====================================================
    -- SECURITY: Verificar que el usuario tiene acceso al tenant
    -- Solo permite acceso si:
    -- 1. Es service_role (llamadas desde backend)
    -- 2. El usuario es staff del tenant
    -- =====================================================
    IF current_setting('role', true) != 'service_role' THEN
        SELECT EXISTS(
            SELECT 1 FROM public.staff
            WHERE user_id = auth.uid()
            AND tenant_id = p_tenant_id
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RETURN jsonb_build_object(
                'can_proceed', false,
                'error', 'Access denied to this tenant',
                'error_code', 'ACCESS_DENIED'
            );
        END IF;
    END IF;

    -- Verificar que el tenant existe y tiene plan Growth
    SELECT id, plan INTO v_tenant
    FROM public.tenants
    WHERE id = p_tenant_id;

    IF v_tenant IS NULL THEN
        RETURN jsonb_build_object(
            'can_proceed', false,
            'error', 'Tenant not found',
            'error_code', 'TENANT_NOT_FOUND'
        );
    END IF;

    -- Solo Growth tiene Voice Agent
    IF v_tenant.plan != 'growth' THEN
        RETURN jsonb_build_object(
            'can_proceed', false,
            'error', 'Voice Agent solo esta disponible en el plan Growth',
            'error_code', 'PLAN_NOT_ELIGIBLE'
        );
    END IF;

    -- Obtener configuracion de limites (con ON CONFLICT para race conditions)
    SELECT * INTO v_limits
    FROM public.voice_minute_limits
    WHERE tenant_id = p_tenant_id;

    -- Si no tiene configuracion, crear default (con ON CONFLICT)
    IF v_limits IS NULL THEN
        INSERT INTO public.voice_minute_limits (tenant_id)
        VALUES (p_tenant_id)
        ON CONFLICT (tenant_id) DO NOTHING;

        -- Re-fetch after potential insert
        SELECT * INTO v_limits
        FROM public.voice_minute_limits
        WHERE tenant_id = p_tenant_id;
    END IF;

    -- Calcular periodo actual (inicio del mes actual)
    v_current_period_start := date_trunc('month', NOW());
    v_current_period_end := date_trunc('month', NOW()) + INTERVAL '1 month';

    -- Obtener o crear registro de uso para el periodo (con ON CONFLICT)
    SELECT * INTO v_usage
    FROM public.voice_minute_usage
    WHERE tenant_id = p_tenant_id
        AND billing_period_start = v_current_period_start;

    IF v_usage IS NULL THEN
        INSERT INTO public.voice_minute_usage (
            tenant_id,
            billing_period_start,
            billing_period_end
        ) VALUES (
            p_tenant_id,
            v_current_period_start,
            v_current_period_end
        )
        ON CONFLICT (tenant_id, billing_period_start) DO NOTHING;

        -- Re-fetch after potential insert
        SELECT * INTO v_usage
        FROM public.voice_minute_usage
        WHERE tenant_id = p_tenant_id
            AND billing_period_start = v_current_period_start;
    END IF;

    -- Calcular totales
    v_total_used := v_usage.included_minutes_used + v_usage.overage_minutes_used;
    v_remaining := GREATEST(0, v_limits.included_minutes - v_usage.included_minutes_used);
    v_usage_percent := CASE
        WHEN v_limits.included_minutes > 0
        THEN (v_usage.included_minutes_used / v_limits.included_minutes) * 100
        ELSE 0
    END;

    -- Construir resultado base
    v_result := jsonb_build_object(
        'can_proceed', CASE
            WHEN v_usage.is_blocked THEN false
            WHEN v_limits.overage_policy = 'block' AND v_remaining <= 0 THEN false
            ELSE true
        END,
        'policy', v_limits.overage_policy,
        'included_minutes', v_limits.included_minutes,
        'included_used', v_usage.included_minutes_used,
        'overage_used', v_usage.overage_minutes_used,
        'remaining_included', v_remaining,
        'total_used', v_total_used,
        'usage_percent', ROUND(v_usage_percent, 1),
        'is_at_limit', v_remaining <= 0,
        'is_blocked', v_usage.is_blocked,
        'blocked_reason', v_usage.blocked_reason,
        'overage_price_centavos', v_limits.overage_price_centavos,
        'current_overage_charges', v_usage.overage_charges_centavos,
        'max_overage_charge', v_limits.max_overage_charge_centavos,
        'usage_id', v_usage.id,
        'billing_period_start', v_current_period_start,
        'billing_period_end', v_current_period_end,
        'total_calls', v_usage.total_calls
    );

    -- Agregar razon de bloqueo si no puede proceder
    IF NOT (v_result->>'can_proceed')::boolean THEN
        IF v_usage.is_blocked THEN
            v_result := v_result || jsonb_build_object(
                'block_reason', COALESCE(v_usage.blocked_reason, 'Limite de minutos excedido'),
                'error_code', 'BLOCKED_BY_ADMIN'
            );
        ELSIF v_limits.overage_policy = 'block' AND v_remaining <= 0 THEN
            v_result := v_result || jsonb_build_object(
                'block_reason', 'Has alcanzado el limite de ' || v_limits.included_minutes || ' minutos incluidos este mes. Cambia tu politica a "charge" para continuar.',
                'error_code', 'LIMIT_EXCEEDED_BLOCK_POLICY'
            );
        END IF;
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.check_minute_limit IS
'Verifica si un tenant puede realizar una llamada de Voice Agent basandose en sus limites de minutos. Devuelve can_proceed=true/false y detalles del uso actual.';

-- =====================================================
-- MICRO-FASE 1.5: RPC record_minute_usage
-- Registrar minutos usados despues de una llamada
-- =====================================================

CREATE OR REPLACE FUNCTION public.record_minute_usage(
    p_tenant_id UUID,
    p_call_id UUID,
    p_seconds_used INTEGER,
    p_call_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    v_limits RECORD;
    v_usage RECORD;
    v_minutes_used DECIMAL;
    v_is_overage BOOLEAN := false;
    v_charge_centavos INTEGER := 0;
    v_minutes_to_included DECIMAL;
    v_minutes_to_overage DECIMAL;
    v_current_period_start TIMESTAMPTZ;
    v_transaction_id UUID;
    v_alert_threshold INTEGER;
    v_usage_percent DECIMAL;
    v_should_block BOOLEAN := false;
    v_result JSONB;
    v_has_access BOOLEAN;
    v_array_len INTEGER;
BEGIN
    -- =====================================================
    -- SECURITY: Verificar que el usuario tiene acceso al tenant
    -- =====================================================
    IF current_setting('role', true) != 'service_role' THEN
        SELECT EXISTS(
            SELECT 1 FROM public.staff
            WHERE user_id = auth.uid()
            AND tenant_id = p_tenant_id
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Access denied to this tenant',
                'error_code', 'ACCESS_DENIED'
            );
        END IF;
    END IF;

    -- Validar input
    IF p_seconds_used <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'seconds_used must be greater than 0',
            'error_code', 'INVALID_INPUT'
        );
    END IF;

    -- Convertir segundos a minutos (redondeando hacia arriba)
    -- 61 segundos = 2 minutos facturados
    v_minutes_used := CEIL(p_seconds_used::DECIMAL / 60);

    -- Obtener configuracion de limites
    SELECT * INTO v_limits
    FROM public.voice_minute_limits
    WHERE tenant_id = p_tenant_id;

    IF v_limits IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No limit configuration found for tenant',
            'error_code', 'CONFIG_NOT_FOUND'
        );
    END IF;

    -- Calcular periodo actual
    v_current_period_start := date_trunc('month', NOW());

    -- Obtener registro de uso actual (con lock para evitar race conditions)
    SELECT * INTO v_usage
    FROM public.voice_minute_usage
    WHERE tenant_id = p_tenant_id
        AND billing_period_start = v_current_period_start
    FOR UPDATE;

    IF v_usage IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No usage record found for current period. Call check_minute_limit first.',
            'error_code', 'USAGE_NOT_FOUND'
        );
    END IF;

    -- Verificar si esta bloqueado
    IF v_usage.is_blocked THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Tenant is blocked from making calls',
            'error_code', 'TENANT_BLOCKED',
            'blocked_reason', v_usage.blocked_reason
        );
    END IF;

    -- Calcular distribucion de minutos
    -- Primero se consumen minutos incluidos, luego overage
    v_minutes_to_included := LEAST(
        v_minutes_used,
        GREATEST(0, v_limits.included_minutes - v_usage.included_minutes_used)
    );
    v_minutes_to_overage := v_minutes_used - v_minutes_to_included;

    -- Si hay minutos en overage
    IF v_minutes_to_overage > 0 THEN
        v_is_overage := true;

        -- Calcular cargo segun politica
        IF v_limits.overage_policy = 'charge' THEN
            v_charge_centavos := CEIL(v_minutes_to_overage * v_limits.overage_price_centavos);

            -- Verificar limite maximo de overage
            IF (v_usage.overage_charges_centavos + v_charge_centavos) > v_limits.max_overage_charge_centavos THEN
                -- Ajustar cargo al maximo permitido
                v_charge_centavos := GREATEST(0, v_limits.max_overage_charge_centavos - v_usage.overage_charges_centavos);
                -- Marcar para bloqueo si se alcanza el maximo
                IF v_charge_centavos = 0 THEN
                    v_should_block := true;
                END IF;
            END IF;
        ELSIF v_limits.overage_policy = 'block' THEN
            -- Con politica block, no deberia llegar aqui (check_minute_limit debio bloquear)
            -- Pero por seguridad, registrar sin cargo
            v_charge_centavos := 0;
        ELSE
            -- notify_only: no cobrar pero registrar
            v_charge_centavos := 0;
        END IF;
    END IF;

    -- Actualizar registro de uso
    UPDATE public.voice_minute_usage
    SET
        included_minutes_used = included_minutes_used + v_minutes_to_included,
        overage_minutes_used = overage_minutes_used + v_minutes_to_overage,
        overage_charges_centavos = overage_charges_centavos + v_charge_centavos,
        total_calls = total_calls + 1,
        is_blocked = CASE WHEN v_should_block THEN true ELSE is_blocked END,
        blocked_at = CASE WHEN v_should_block THEN NOW() ELSE blocked_at END,
        blocked_reason = CASE WHEN v_should_block THEN 'Limite maximo de cargo por overage alcanzado' ELSE blocked_reason END,
        updated_at = NOW()
    WHERE id = v_usage.id
    RETURNING * INTO v_usage;

    -- Registrar transaccion
    INSERT INTO public.voice_minute_transactions (
        tenant_id,
        usage_id,
        call_id,
        minutes_used,
        seconds_used,
        is_overage,
        charge_centavos,
        call_metadata
    ) VALUES (
        p_tenant_id,
        v_usage.id,
        p_call_id,
        v_minutes_used,
        p_seconds_used,
        v_is_overage,
        v_charge_centavos,
        p_call_metadata
    )
    RETURNING id INTO v_transaction_id;

    -- Calcular porcentaje de uso para alertas
    v_usage_percent := CASE
        WHEN v_limits.included_minutes > 0
        THEN (v_usage.included_minutes_used / v_limits.included_minutes) * 100
        ELSE 0
    END;

    -- Determinar si hay que enviar alerta
    v_alert_threshold := NULL;
    v_array_len := COALESCE(array_length(v_limits.alert_thresholds, 1), 0);

    IF v_array_len > 0 THEN
        -- Buscar el umbral mas alto que se haya alcanzado y no se haya notificado
        FOR i IN 1..v_array_len LOOP
            IF v_usage_percent >= v_limits.alert_thresholds[i]
               AND v_limits.alert_thresholds[i] > COALESCE(v_usage.last_alert_threshold, 0) THEN
                v_alert_threshold := v_limits.alert_thresholds[i];
            END IF;
        END LOOP;
    END IF;

    -- Actualizar ultimo umbral de alerta si aplica
    IF v_alert_threshold IS NOT NULL THEN
        UPDATE public.voice_minute_usage
        SET
            last_alert_threshold = v_alert_threshold,
            last_alert_sent_at = NOW()
        WHERE id = v_usage.id;
    END IF;

    -- Construir resultado
    v_result := jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'minutes_recorded', v_minutes_used,
        'seconds_recorded', p_seconds_used,
        'minutes_to_included', v_minutes_to_included,
        'minutes_to_overage', v_minutes_to_overage,
        'is_overage', v_is_overage,
        'charge_centavos', v_charge_centavos,
        'charge_pesos', ROUND(v_charge_centavos / 100.0, 2),
        'total_included_used', v_usage.included_minutes_used,
        'total_overage_used', v_usage.overage_minutes_used,
        'total_overage_charges_centavos', v_usage.overage_charges_centavos,
        'total_overage_charges_pesos', ROUND(v_usage.overage_charges_centavos / 100.0, 2),
        'usage_percent', ROUND(v_usage_percent, 1),
        'remaining_included', GREATEST(0, v_limits.included_minutes - v_usage.included_minutes_used),
        'alert_threshold_triggered', v_alert_threshold,
        'is_blocked', v_usage.is_blocked
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.record_minute_usage IS
'Registra el uso de minutos de una llamada de Voice Agent. Calcula cargos de overage si aplica y dispara alertas automaticamente.';

-- =====================================================
-- MICRO-FASE 1.6: RPC get_minute_usage_summary
-- Obtener resumen de uso para dashboard
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_minute_usage_summary(
    p_tenant_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_limits RECORD;
    v_usage RECORD;
    v_current_period_start TIMESTAMPTZ;
    v_current_period_end TIMESTAMPTZ;
    v_days_remaining INTEGER;
    v_days_elapsed INTEGER;
    v_days_total INTEGER;
    v_usage_percent DECIMAL;
    v_avg_call_duration DECIMAL;
    v_result JSONB;
    v_has_access BOOLEAN;
BEGIN
    -- =====================================================
    -- SECURITY: Verificar que el usuario tiene acceso al tenant
    -- =====================================================
    IF current_setting('role', true) != 'service_role' THEN
        SELECT EXISTS(
            SELECT 1 FROM public.staff
            WHERE user_id = auth.uid()
            AND tenant_id = p_tenant_id
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RETURN jsonb_build_object(
                'error', 'Access denied to this tenant',
                'error_code', 'ACCESS_DENIED'
            );
        END IF;
    END IF;

    -- Calcular periodo actual
    v_current_period_start := date_trunc('month', NOW());
    v_current_period_end := date_trunc('month', NOW()) + INTERVAL '1 month';
    -- CEIL para days_remaining evita mostrar "0 días" cuando aún queda tiempo
    v_days_remaining := CEIL(EXTRACT(EPOCH FROM v_current_period_end - NOW()) / 86400)::INTEGER;
    v_days_elapsed := FLOOR(EXTRACT(EPOCH FROM NOW() - v_current_period_start) / 86400)::INTEGER;
    v_days_total := EXTRACT(DAY FROM v_current_period_end - v_current_period_start)::INTEGER;

    -- Obtener configuracion de limites (con ON CONFLICT para race conditions)
    SELECT * INTO v_limits
    FROM public.voice_minute_limits
    WHERE tenant_id = p_tenant_id;

    -- Si no tiene configuracion, crear default
    IF v_limits IS NULL THEN
        INSERT INTO public.voice_minute_limits (tenant_id)
        VALUES (p_tenant_id)
        ON CONFLICT (tenant_id) DO NOTHING;

        SELECT * INTO v_limits
        FROM public.voice_minute_limits
        WHERE tenant_id = p_tenant_id;
    END IF;

    -- Obtener o crear registro de uso (con ON CONFLICT)
    SELECT * INTO v_usage
    FROM public.voice_minute_usage
    WHERE tenant_id = p_tenant_id
        AND billing_period_start = v_current_period_start;

    IF v_usage IS NULL THEN
        INSERT INTO public.voice_minute_usage (
            tenant_id,
            billing_period_start,
            billing_period_end
        ) VALUES (
            p_tenant_id,
            v_current_period_start,
            v_current_period_end
        )
        ON CONFLICT (tenant_id, billing_period_start) DO NOTHING;

        SELECT * INTO v_usage
        FROM public.voice_minute_usage
        WHERE tenant_id = p_tenant_id
            AND billing_period_start = v_current_period_start;
    END IF;

    -- Calcular porcentaje de uso
    v_usage_percent := CASE
        WHEN v_limits.included_minutes > 0
        THEN (v_usage.included_minutes_used / v_limits.included_minutes) * 100
        ELSE 0
    END;

    -- Calcular duracion promedio de llamada
    v_avg_call_duration := CASE
        WHEN v_usage.total_calls > 0
        THEN (v_usage.included_minutes_used + v_usage.overage_minutes_used) / v_usage.total_calls
        ELSE 0
    END;

    -- Construir resultado
    v_result := jsonb_build_object(
        -- Limites configurados
        'included_minutes', v_limits.included_minutes,
        'overage_policy', v_limits.overage_policy,
        'overage_price_centavos', v_limits.overage_price_centavos,
        'overage_price_pesos', ROUND(v_limits.overage_price_centavos / 100.0, 2),
        'max_overage_charge_centavos', v_limits.max_overage_charge_centavos,
        'max_overage_charge_pesos', ROUND(v_limits.max_overage_charge_centavos / 100.0, 2),
        'alert_thresholds', v_limits.alert_thresholds,

        -- Uso actual
        'included_minutes_used', ROUND(v_usage.included_minutes_used, 1),
        'overage_minutes_used', ROUND(v_usage.overage_minutes_used, 1),
        'total_minutes_used', ROUND(v_usage.included_minutes_used + v_usage.overage_minutes_used, 1),
        'remaining_included', GREATEST(0, v_limits.included_minutes - v_usage.included_minutes_used),

        -- Porcentaje y estado
        'usage_percent', ROUND(v_usage_percent, 1),
        'is_at_limit', v_usage.included_minutes_used >= v_limits.included_minutes,
        'is_over_limit', v_usage.overage_minutes_used > 0,
        'is_blocked', v_usage.is_blocked,
        'blocked_reason', v_usage.blocked_reason,

        -- Cargos
        'overage_charges_centavos', v_usage.overage_charges_centavos,
        'overage_charges_pesos', ROUND(v_usage.overage_charges_centavos / 100.0, 2),

        -- Periodo
        'billing_period_start', v_current_period_start,
        'billing_period_end', v_current_period_end,
        'days_remaining', v_days_remaining,
        'days_elapsed', v_days_elapsed,
        'days_total', v_days_total,

        -- Stats
        'total_calls', v_usage.total_calls,
        'avg_call_duration', ROUND(v_avg_call_duration, 1),
        'last_alert_threshold', v_usage.last_alert_threshold,

        -- Config de notificaciones
        'email_alerts_enabled', v_limits.email_alerts_enabled,
        'push_alerts_enabled', v_limits.push_alerts_enabled,
        'webhook_alerts_enabled', v_limits.webhook_alerts_enabled
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_minute_usage_summary IS
'Obtiene el resumen completo de uso de minutos de Voice Agent para mostrar en el dashboard.';

-- =====================================================
-- MICRO-FASE 1.6b: RPC update_minute_limit_policy
-- Actualizar politica de overage
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_minute_limit_policy(
    p_tenant_id UUID,
    p_overage_policy VARCHAR(20)
)
RETURNS JSONB AS $$
DECLARE
    v_limits RECORD;
    v_has_access BOOLEAN;
    v_unblocked_count INTEGER;
BEGIN
    -- =====================================================
    -- SECURITY: Verificar que el usuario tiene acceso al tenant
    -- Solo admin/owner pueden cambiar politicas
    -- =====================================================
    IF current_setting('role', true) != 'service_role' THEN
        SELECT EXISTS(
            SELECT 1 FROM public.staff
            WHERE user_id = auth.uid()
            AND tenant_id = p_tenant_id
            AND role IN ('owner', 'admin')
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Access denied. Only owner or admin can change policy.',
                'error_code', 'ACCESS_DENIED'
            );
        END IF;
    END IF;

    -- Validar politica
    IF p_overage_policy NOT IN ('block', 'charge', 'notify_only') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid overage policy. Must be: block, charge, or notify_only',
            'error_code', 'INVALID_POLICY'
        );
    END IF;

    -- Actualizar politica (con ON CONFLICT para race conditions)
    UPDATE public.voice_minute_limits
    SET
        overage_policy = p_overage_policy,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
    RETURNING * INTO v_limits;

    IF v_limits IS NULL THEN
        -- Crear configuracion si no existe
        INSERT INTO public.voice_minute_limits (tenant_id, overage_policy)
        VALUES (p_tenant_id, p_overage_policy)
        ON CONFLICT (tenant_id) DO UPDATE
        SET overage_policy = p_overage_policy, updated_at = NOW()
        RETURNING * INTO v_limits;
    END IF;

    -- Si cambiamos a charge o notify_only, desbloquear si estaba bloqueado por limite/overage
    -- Patron LIKE actualizado para matchear mensajes reales
    v_unblocked_count := 0;
    IF p_overage_policy IN ('charge', 'notify_only') THEN
        UPDATE public.voice_minute_usage
        SET
            is_blocked = false,
            blocked_reason = NULL,
            blocked_at = NULL,
            updated_at = NOW()
        WHERE tenant_id = p_tenant_id
            AND is_blocked = true
            AND (
                blocked_reason LIKE '%Limite%'
                OR blocked_reason LIKE '%limite%'
                OR blocked_reason LIKE '%overage%'
                OR blocked_reason LIKE '%excedido%'
            );

        GET DIAGNOSTICS v_unblocked_count = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_policy', v_limits.overage_policy,
        'tenant_id', p_tenant_id,
        'periods_unblocked', v_unblocked_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_minute_limit_policy IS
'Actualiza la politica de overage para un tenant. Desbloquea automaticamente si cambia a charge o notify_only.';

-- =====================================================
-- MICRO-FASE 1.7: TRIGGERS
-- =====================================================

-- Trigger para actualizar updated_at automaticamente
CREATE TRIGGER update_voice_minute_limits_updated_at
    BEFORE UPDATE ON public.voice_minute_limits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_voice_minute_usage_updated_at
    BEFORE UPDATE ON public.voice_minute_usage
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- MICRO-FASE 1.7: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.voice_minute_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_minute_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_minute_transactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES: voice_minute_limits
-- =====================================================

-- SELECT: Usuarios pueden ver limites de su tenant
CREATE POLICY "voice_minute_limits_select_own"
    ON public.voice_minute_limits
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()
        )
    );

-- UPDATE: Solo admin/owner pueden actualizar
CREATE POLICY "voice_minute_limits_update_own"
    ON public.voice_minute_limits
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.staff
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.staff
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- Service role tiene acceso total
CREATE POLICY "voice_minute_limits_service_role"
    ON public.voice_minute_limits
    FOR ALL
    USING (
        current_setting('role', true) = 'service_role'
    )
    WITH CHECK (
        current_setting('role', true) = 'service_role'
    );

-- =====================================================
-- POLICIES: voice_minute_usage
-- =====================================================

-- SELECT: Usuarios pueden ver uso de su tenant
CREATE POLICY "voice_minute_usage_select_own"
    ON public.voice_minute_usage
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()
        )
    );

-- Service role tiene acceso total (para RPCs)
CREATE POLICY "voice_minute_usage_service_role"
    ON public.voice_minute_usage
    FOR ALL
    USING (
        current_setting('role', true) = 'service_role'
    )
    WITH CHECK (
        current_setting('role', true) = 'service_role'
    );

-- =====================================================
-- POLICIES: voice_minute_transactions
-- =====================================================

-- SELECT: Usuarios pueden ver transacciones de su tenant
CREATE POLICY "voice_minute_transactions_select_own"
    ON public.voice_minute_transactions
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()
        )
    );

-- Service role tiene acceso total (para RPCs)
CREATE POLICY "voice_minute_transactions_service_role"
    ON public.voice_minute_transactions
    FOR ALL
    USING (
        current_setting('role', true) = 'service_role'
    )
    WITH CHECK (
        current_setting('role', true) = 'service_role'
    );

-- =====================================================
-- GRANTS para RPCs
-- =====================================================

GRANT EXECUTE ON FUNCTION public.check_minute_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_minute_limit(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.record_minute_usage(UUID, UUID, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_minute_usage(UUID, UUID, INTEGER, JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_minute_usage_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_minute_usage_summary(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_minute_limit_policy(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_minute_limit_policy(UUID, VARCHAR) TO service_role;

-- =====================================================
-- MICRO-FASE 1.8: SEED DATA
-- Configuracion inicial para tenants Growth existentes
-- =====================================================

-- Insertar configuracion de limites para tenants Growth que:
-- 1. Tienen plan Growth
-- 2. Tienen voice_assistant_configs (significa que usan Voice Agent)
-- 3. NO tienen voice_minute_limits todavia
INSERT INTO public.voice_minute_limits (tenant_id)
SELECT DISTINCT t.id
FROM public.tenants t
INNER JOIN public.voice_assistant_configs vac ON vac.tenant_id = t.id
LEFT JOIN public.voice_minute_limits vml ON vml.tenant_id = t.id
WHERE t.plan = 'growth'
  AND vml.id IS NULL;

-- Crear registros de uso para el periodo actual para todos los
-- tenants con voice_minute_limits que no tengan registro del mes actual
INSERT INTO public.voice_minute_usage (
    tenant_id,
    billing_period_start,
    billing_period_end
)
SELECT
    vml.tenant_id,
    date_trunc('month', NOW()),
    date_trunc('month', NOW()) + INTERVAL '1 month'
FROM public.voice_minute_limits vml
LEFT JOIN public.voice_minute_usage vmu
    ON vmu.tenant_id = vml.tenant_id
    AND vmu.billing_period_start = date_trunc('month', NOW())
WHERE vmu.id IS NULL;

-- =====================================================
-- FIN MIGRACION 162: VOICE MINUTE LIMITS SYSTEM
-- =====================================================

-- Resumen de objetos creados:
-- TABLAS:
--   - voice_minute_limits: Configuracion de limites por tenant
--   - voice_minute_usage: Tracking de uso por periodo
--   - voice_minute_transactions: Log detallado de transacciones
--
-- FUNCIONES RPC:
--   - check_minute_limit(tenant_id): Verifica si puede hacer llamada
--   - record_minute_usage(tenant_id, call_id, seconds, metadata): Registra uso
--   - get_minute_usage_summary(tenant_id): Resumen para dashboard
--   - update_minute_limit_policy(tenant_id, policy): Cambia politica
--
-- INDICES: 10 indices para optimizar queries comunes (incluye 1 unique parcial para prevenir duplicados)
-- POLICIES: 7 policies de RLS para seguridad (SELECT + service_role por tabla, UPDATE admin para limits)
-- TRIGGERS: 2 triggers para updated_at

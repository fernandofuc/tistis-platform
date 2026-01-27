-- =====================================================
-- TIS TIS PLATFORM - VOICE MINUTE SYSTEM (CONSOLIDADO)
-- Consolidates: 162, 163, 166
-- Date: 2026-01-26
-- Version: 1.0 CONSOLIDATED
--
-- Este archivo consolida las siguientes migraciones:
-- - 162_VOICE_MINUTE_LIMITS_SYSTEM.sql (tablas y RPCs core)
-- - 163_VOICE_BILLING_FUNCTIONS.sql (funciones de billing)
-- - 166_VOICE_USAGE_ALERTS.sql (sistema de alertas)
--
-- PROPÓSITO: Sistema completo de límites de minutos para Voice Agent:
-- - Configuración de límites por tenant (200 min/mes Growth)
-- - Tracking de uso por período de facturación
-- - Log de transacciones para auditoría
-- - Políticas de overage (block/charge/notify_only)
-- - Sistema de alertas proactivas (70%, 85%, 95%, 100%)
-- - Funciones de billing para Stripe
--
-- DEPENDENCIAS: tenants, voice_calls, staff, subscriptions, clients
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Iniciando Voice Minute System (Consolidado)';
    RAISE NOTICE 'Combina migraciones: 162, 163, 166';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- PARTE 1: TABLAS DE CONFIGURACIÓN Y USO (de 162)
-- =====================================================

-- 1.1 voice_minute_limits: Configuración de límites por tenant
CREATE TABLE IF NOT EXISTS public.voice_minute_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    included_minutes INTEGER NOT NULL DEFAULT 200 CHECK (included_minutes >= 0),
    overage_price_centavos INTEGER NOT NULL DEFAULT 350 CHECK (overage_price_centavos >= 0),
    overage_policy VARCHAR(20) NOT NULL DEFAULT 'charge'
        CHECK (overage_policy IN ('block', 'charge', 'notify_only')),
    max_overage_charge_centavos INTEGER NOT NULL DEFAULT 200000
        CHECK (max_overage_charge_centavos >= 0),
    alert_thresholds INTEGER[] NOT NULL DEFAULT ARRAY[70, 85, 95, 100],
    email_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
    push_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
    webhook_alerts_enabled BOOLEAN NOT NULL DEFAULT false,
    webhook_url TEXT,
    -- Columnas de 166
    alert_channels text[] DEFAULT '{in_app}',
    email_recipients text[],
    alert_cooldown_minutes int DEFAULT 60,
    -- Stripe
    stripe_meter_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

COMMENT ON TABLE public.voice_minute_limits IS
'Configuración de límites de minutos de Voice Agent por tenant. Solo aplica a plan Growth.';

-- 1.2 voice_minute_usage: Tracking de uso por período
CREATE TABLE IF NOT EXISTS public.voice_minute_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    billing_period_start TIMESTAMPTZ NOT NULL,
    billing_period_end TIMESTAMPTZ NOT NULL,
    included_minutes_used DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (included_minutes_used >= 0),
    overage_minutes_used DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (overage_minutes_used >= 0),
    overage_charges_centavos INTEGER NOT NULL DEFAULT 0 CHECK (overage_charges_centavos >= 0),
    last_alert_threshold INTEGER NOT NULL DEFAULT 0 CHECK (last_alert_threshold >= 0),
    last_alert_sent_at TIMESTAMPTZ,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    blocked_at TIMESTAMPTZ,
    blocked_reason VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    stripe_usage_record_id VARCHAR(255),
    total_calls INTEGER NOT NULL DEFAULT 0 CHECK (total_calls >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, billing_period_start),
    CONSTRAINT valid_billing_period CHECK (billing_period_end > billing_period_start)
);

-- Índices para voice_minute_usage
CREATE INDEX IF NOT EXISTS idx_voice_minute_usage_tenant
    ON public.voice_minute_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_minute_usage_period
    ON public.voice_minute_usage(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_voice_minute_usage_current
    ON public.voice_minute_usage(tenant_id, billing_period_end DESC);
CREATE INDEX IF NOT EXISTS idx_voice_minute_usage_pending_billing
    ON public.voice_minute_usage(billing_period_end, is_blocked)
    WHERE overage_charges_centavos > 0 AND stripe_invoice_id IS NULL;

COMMENT ON TABLE public.voice_minute_usage IS
'Tracking de uso de minutos de Voice Agent por período de facturación mensual.';

-- 1.3 voice_minute_transactions: Log de transacciones
CREATE TABLE IF NOT EXISTS public.voice_minute_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    usage_id UUID NOT NULL REFERENCES public.voice_minute_usage(id) ON DELETE CASCADE,
    call_id UUID,
    minutes_used DECIMAL(10,2) NOT NULL CHECK (minutes_used >= 0),
    seconds_used INTEGER NOT NULL CHECK (seconds_used > 0),
    is_overage BOOLEAN NOT NULL DEFAULT false,
    charge_centavos INTEGER NOT NULL DEFAULT 0 CHECK (charge_centavos >= 0),
    stripe_invoice_item_id VARCHAR(255),
    stripe_usage_record_id VARCHAR(255),
    call_metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para transactions
CREATE INDEX IF NOT EXISTS idx_voice_minute_transactions_tenant
    ON public.voice_minute_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_minute_transactions_usage
    ON public.voice_minute_transactions(usage_id);
CREATE INDEX IF NOT EXISTS idx_voice_minute_transactions_recorded
    ON public.voice_minute_transactions(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_minute_transactions_overage_unbilled
    ON public.voice_minute_transactions(tenant_id, is_overage, stripe_invoice_item_id)
    WHERE is_overage = true AND stripe_invoice_item_id IS NULL;

-- Índice único parcial para prevenir doble-registro
DO $$
BEGIN
    CREATE UNIQUE INDEX idx_voice_minute_transactions_call_unique
        ON public.voice_minute_transactions(call_id)
        WHERE call_id IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN
    NULL;
END $$;

COMMENT ON TABLE public.voice_minute_transactions IS
'Log de cada transacción de minutos de Voice Agent. Usado para auditoría y billing detallado.';

-- =====================================================
-- PARTE 2: TABLA DE ALERTAS (de 166)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_usage_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  threshold int NOT NULL CHECK (threshold IN (70, 85, 95, 100)),
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  usage_percent numeric(5,2) NOT NULL,
  minutes_used numeric(10,2) NOT NULL,
  included_minutes int NOT NULL,
  overage_minutes numeric(10,2) DEFAULT 0,
  overage_charge_centavos int DEFAULT 0,
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  sent_via text[] DEFAULT '{}',
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Índices para alerts
CREATE INDEX IF NOT EXISTS idx_voice_alerts_tenant
  ON public.voice_usage_alerts(tenant_id, acknowledged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_alerts_threshold
  ON public.voice_usage_alerts(tenant_id, threshold, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_alerts_severity
  ON public.voice_usage_alerts(tenant_id, severity)
  WHERE acknowledged = false;

COMMENT ON TABLE public.voice_usage_alerts IS
  'Stores proactive alerts when voice usage reaches thresholds';

-- =====================================================
-- PARTE 3: RPCs CORE (de 162)
-- =====================================================

-- 3.1 check_minute_limit
CREATE OR REPLACE FUNCTION public.check_minute_limit(p_tenant_id UUID)
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
    -- Security check
    IF current_setting('role', true) != 'service_role' THEN
        SELECT EXISTS(
            SELECT 1 FROM public.staff
            WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
        ) INTO v_has_access;
        IF NOT v_has_access THEN
            RETURN jsonb_build_object('can_proceed', false, 'error', 'Access denied', 'error_code', 'ACCESS_DENIED');
        END IF;
    END IF;

    -- Verify tenant exists and has Growth plan
    SELECT id, plan INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF v_tenant IS NULL THEN
        RETURN jsonb_build_object('can_proceed', false, 'error', 'Tenant not found', 'error_code', 'TENANT_NOT_FOUND');
    END IF;
    IF v_tenant.plan != 'growth' THEN
        RETURN jsonb_build_object('can_proceed', false, 'error', 'Voice Agent solo disponible en plan Growth', 'error_code', 'PLAN_NOT_ELIGIBLE');
    END IF;

    -- Get or create limits config
    SELECT * INTO v_limits FROM public.voice_minute_limits WHERE tenant_id = p_tenant_id;
    IF v_limits IS NULL THEN
        INSERT INTO public.voice_minute_limits (tenant_id) VALUES (p_tenant_id) ON CONFLICT (tenant_id) DO NOTHING;
        SELECT * INTO v_limits FROM public.voice_minute_limits WHERE tenant_id = p_tenant_id;
    END IF;

    -- Calculate current period
    v_current_period_start := date_trunc('month', NOW());
    v_current_period_end := date_trunc('month', NOW()) + INTERVAL '1 month';

    -- Get or create usage record
    SELECT * INTO v_usage FROM public.voice_minute_usage
    WHERE tenant_id = p_tenant_id AND billing_period_start = v_current_period_start;
    IF v_usage IS NULL THEN
        INSERT INTO public.voice_minute_usage (tenant_id, billing_period_start, billing_period_end)
        VALUES (p_tenant_id, v_current_period_start, v_current_period_end)
        ON CONFLICT (tenant_id, billing_period_start) DO NOTHING;
        SELECT * INTO v_usage FROM public.voice_minute_usage
        WHERE tenant_id = p_tenant_id AND billing_period_start = v_current_period_start;
    END IF;

    -- Calculate usage
    v_total_used := v_usage.included_minutes_used + v_usage.overage_minutes_used;
    v_remaining := GREATEST(0, v_limits.included_minutes - v_usage.included_minutes_used);
    v_usage_percent := CASE WHEN v_limits.included_minutes > 0
        THEN (v_usage.included_minutes_used / v_limits.included_minutes) * 100 ELSE 0 END;

    -- Build result
    v_result := jsonb_build_object(
        'can_proceed', CASE
            WHEN v_usage.is_blocked THEN false
            WHEN v_limits.overage_policy = 'block' AND v_remaining <= 0 THEN false
            ELSE true END,
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
        'usage_id', v_usage.id,
        'billing_period_start', v_current_period_start,
        'billing_period_end', v_current_period_end,
        'total_calls', v_usage.total_calls
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.check_minute_limit IS
'Verifica si un tenant puede realizar una llamada de Voice Agent basándose en sus límites.';

-- 3.2 record_minute_usage (versión simplificada)
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
    v_usage_percent DECIMAL;
    v_result JSONB;
BEGIN
    IF p_seconds_used <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'seconds_used must be > 0', 'error_code', 'INVALID_INPUT');
    END IF;

    v_minutes_used := CEIL(p_seconds_used::DECIMAL / 60);
    v_current_period_start := date_trunc('month', NOW());

    SELECT * INTO v_limits FROM public.voice_minute_limits WHERE tenant_id = p_tenant_id;
    IF v_limits IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No limit config found', 'error_code', 'CONFIG_NOT_FOUND');
    END IF;

    SELECT * INTO v_usage FROM public.voice_minute_usage
    WHERE tenant_id = p_tenant_id AND billing_period_start = v_current_period_start FOR UPDATE;
    IF v_usage IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No usage record found', 'error_code', 'USAGE_NOT_FOUND');
    END IF;

    IF v_usage.is_blocked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tenant is blocked', 'error_code', 'TENANT_BLOCKED');
    END IF;

    v_minutes_to_included := LEAST(v_minutes_used, GREATEST(0, v_limits.included_minutes - v_usage.included_minutes_used));
    v_minutes_to_overage := v_minutes_used - v_minutes_to_included;

    IF v_minutes_to_overage > 0 THEN
        v_is_overage := true;
        IF v_limits.overage_policy = 'charge' THEN
            v_charge_centavos := CEIL(v_minutes_to_overage * v_limits.overage_price_centavos);
        END IF;
    END IF;

    UPDATE public.voice_minute_usage SET
        included_minutes_used = included_minutes_used + v_minutes_to_included,
        overage_minutes_used = overage_minutes_used + v_minutes_to_overage,
        overage_charges_centavos = overage_charges_centavos + v_charge_centavos,
        total_calls = total_calls + 1,
        updated_at = NOW()
    WHERE id = v_usage.id RETURNING * INTO v_usage;

    INSERT INTO public.voice_minute_transactions (
        tenant_id, usage_id, call_id, minutes_used, seconds_used, is_overage, charge_centavos, call_metadata
    ) VALUES (
        p_tenant_id, v_usage.id, p_call_id, v_minutes_used, p_seconds_used, v_is_overage, v_charge_centavos, p_call_metadata
    ) RETURNING id INTO v_transaction_id;

    v_usage_percent := CASE WHEN v_limits.included_minutes > 0
        THEN (v_usage.included_minutes_used / v_limits.included_minutes) * 100 ELSE 0 END;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'minutes_recorded', v_minutes_used,
        'is_overage', v_is_overage,
        'charge_centavos', v_charge_centavos,
        'usage_percent', ROUND(v_usage_percent, 1),
        'remaining_included', GREATEST(0, v_limits.included_minutes - v_usage.included_minutes_used)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.3 get_minute_usage_summary
CREATE OR REPLACE FUNCTION public.get_minute_usage_summary(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_limits RECORD;
    v_usage RECORD;
    v_current_period_start TIMESTAMPTZ;
    v_current_period_end TIMESTAMPTZ;
    v_usage_percent DECIMAL;
    v_result JSONB;
BEGIN
    v_current_period_start := date_trunc('month', NOW());
    v_current_period_end := date_trunc('month', NOW()) + INTERVAL '1 month';

    SELECT * INTO v_limits FROM public.voice_minute_limits WHERE tenant_id = p_tenant_id;
    IF v_limits IS NULL THEN
        INSERT INTO public.voice_minute_limits (tenant_id) VALUES (p_tenant_id) ON CONFLICT DO NOTHING;
        SELECT * INTO v_limits FROM public.voice_minute_limits WHERE tenant_id = p_tenant_id;
    END IF;

    SELECT * INTO v_usage FROM public.voice_minute_usage
    WHERE tenant_id = p_tenant_id AND billing_period_start = v_current_period_start;
    IF v_usage IS NULL THEN
        INSERT INTO public.voice_minute_usage (tenant_id, billing_period_start, billing_period_end)
        VALUES (p_tenant_id, v_current_period_start, v_current_period_end) ON CONFLICT DO NOTHING;
        SELECT * INTO v_usage FROM public.voice_minute_usage
        WHERE tenant_id = p_tenant_id AND billing_period_start = v_current_period_start;
    END IF;

    v_usage_percent := CASE WHEN v_limits.included_minutes > 0
        THEN (v_usage.included_minutes_used / v_limits.included_minutes) * 100 ELSE 0 END;

    RETURN jsonb_build_object(
        'included_minutes', v_limits.included_minutes,
        'overage_policy', v_limits.overage_policy,
        'overage_price_centavos', v_limits.overage_price_centavos,
        'included_minutes_used', ROUND(v_usage.included_minutes_used, 1),
        'overage_minutes_used', ROUND(v_usage.overage_minutes_used, 1),
        'remaining_included', GREATEST(0, v_limits.included_minutes - v_usage.included_minutes_used),
        'usage_percent', ROUND(v_usage_percent, 1),
        'is_at_limit', v_usage.included_minutes_used >= v_limits.included_minutes,
        'is_blocked', v_usage.is_blocked,
        'overage_charges_centavos', v_usage.overage_charges_centavos,
        'billing_period_start', v_current_period_start,
        'billing_period_end', v_current_period_end,
        'days_remaining', CEIL(EXTRACT(EPOCH FROM v_current_period_end - NOW()) / 86400)::INTEGER,
        'total_calls', v_usage.total_calls
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.4 update_minute_limit_policy
CREATE OR REPLACE FUNCTION public.update_minute_limit_policy(
    p_tenant_id UUID,
    p_overage_policy VARCHAR(20)
)
RETURNS JSONB AS $$
DECLARE
    v_limits RECORD;
BEGIN
    IF p_overage_policy NOT IN ('block', 'charge', 'notify_only') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid policy', 'error_code', 'INVALID_POLICY');
    END IF;

    UPDATE public.voice_minute_limits
    SET overage_policy = p_overage_policy, updated_at = NOW()
    WHERE tenant_id = p_tenant_id
    RETURNING * INTO v_limits;

    IF v_limits IS NULL THEN
        INSERT INTO public.voice_minute_limits (tenant_id, overage_policy)
        VALUES (p_tenant_id, p_overage_policy)
        ON CONFLICT (tenant_id) DO UPDATE SET overage_policy = p_overage_policy, updated_at = NOW()
        RETURNING * INTO v_limits;
    END IF;

    -- Auto-unblock if changing to charge/notify_only
    IF p_overage_policy IN ('charge', 'notify_only') THEN
        UPDATE public.voice_minute_usage SET is_blocked = false, blocked_reason = NULL, blocked_at = NULL
        WHERE tenant_id = p_tenant_id AND is_blocked = true AND blocked_reason LIKE '%Limite%';
    END IF;

    RETURN jsonb_build_object('success', true, 'new_policy', v_limits.overage_policy);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PARTE 4: BILLING FUNCTIONS (de 163)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_tenants_pending_overage_billing(p_check_date TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE (
    tenant_id UUID, tenant_name TEXT, stripe_customer_id TEXT, stripe_subscription_id TEXT,
    overage_minutes DECIMAL, overage_charges_centavos INTEGER, period_start TIMESTAMPTZ, period_end TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (t.id)
        t.id, t.business_name, s.stripe_customer_id, s.stripe_subscription_id,
        vmu.overage_minutes_used, vmu.overage_charges_centavos,
        vmu.billing_period_start, vmu.billing_period_end
    FROM tenants t
    INNER JOIN clients c ON c.tenant_id = t.id
    INNER JOIN subscriptions s ON s.client_id = c.id
    INNER JOIN voice_minute_limits vml ON vml.tenant_id = t.id
    INNER JOIN voice_minute_usage vmu ON vmu.tenant_id = t.id AND vmu.billing_period_end <= p_check_date
    WHERE t.plan = 'growth' AND vml.overage_policy = 'charge'
        AND vmu.overage_minutes_used > 0 AND vmu.overage_charges_centavos > 0
        AND vmu.stripe_invoice_id IS NULL
        AND s.stripe_customer_id IS NOT NULL AND s.status = 'active'
    ORDER BY t.id, vmu.billing_period_start DESC;
END;
$$;

-- 4.2 get_current_overage_preview
CREATE OR REPLACE FUNCTION public.get_current_overage_preview(
    p_tenant_id UUID
)
RETURNS TABLE (
    overage_minutes DECIMAL,
    overage_charges_centavos INTEGER,
    days_elapsed INTEGER,
    days_total INTEGER,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    overage_price_centavos INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_period_start TIMESTAMPTZ;
BEGIN
    -- Calcular periodo actual
    v_current_period_start := date_trunc('month', NOW());

    RETURN QUERY
    SELECT
        COALESCE(vmu.overage_minutes_used, 0) AS overage_minutes,
        COALESCE(vmu.overage_charges_centavos, 0) AS overage_charges_centavos,
        COALESCE(EXTRACT(DAY FROM (NOW() - vmu.billing_period_start))::INTEGER,
                 EXTRACT(DAY FROM (NOW() - v_current_period_start))::INTEGER) AS days_elapsed,
        COALESCE(EXTRACT(DAY FROM (vmu.billing_period_end - vmu.billing_period_start))::INTEGER,
                 EXTRACT(DAY FROM (v_current_period_start + INTERVAL '1 month' - v_current_period_start))::INTEGER) AS days_total,
        COALESCE(vmu.billing_period_start, v_current_period_start) AS period_start,
        COALESCE(vmu.billing_period_end, v_current_period_start + INTERVAL '1 month') AS period_end,
        vml.overage_price_centavos
    FROM voice_minute_limits vml
    LEFT JOIN voice_minute_usage vmu ON (
        vmu.tenant_id = vml.tenant_id
        AND vmu.billing_period_start = v_current_period_start
    )
    WHERE vml.tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.get_current_overage_preview IS
'Obtiene preview de excedentes actuales para un tenant. Útil para mostrar cargos proyectados.';

-- 4.3 mark_overage_as_billed
CREATE OR REPLACE FUNCTION public.mark_overage_as_billed(
    p_tenant_id UUID, p_period_start TIMESTAMPTZ, p_stripe_invoice_item_id TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_usage_id UUID; v_count INTEGER;
BEGIN
    UPDATE voice_minute_usage SET stripe_invoice_id = p_stripe_invoice_item_id, updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND billing_period_start = p_period_start AND stripe_invoice_id IS NULL
    RETURNING id INTO v_usage_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Not found or already billed'); END IF;
    UPDATE voice_minute_transactions SET stripe_invoice_item_id = p_stripe_invoice_item_id
    WHERE usage_id = v_usage_id AND is_overage = true AND stripe_invoice_item_id IS NULL;
    RETURN jsonb_build_object('success', true, 'usage_id', v_usage_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_monthly_voice_usage()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER := 0; v_new_period_start TIMESTAMPTZ; v_new_period_end TIMESTAMPTZ;
BEGIN
    v_new_period_start := date_trunc('month', NOW());
    v_new_period_end := date_trunc('month', NOW()) + INTERVAL '1 month';
    INSERT INTO voice_minute_usage (tenant_id, billing_period_start, billing_period_end)
    SELECT vml.tenant_id, v_new_period_start, v_new_period_end
    FROM voice_minute_limits vml
    LEFT JOIN voice_minute_usage vmu ON vmu.tenant_id = vml.tenant_id AND vmu.billing_period_start = v_new_period_start
    WHERE vmu.id IS NULL
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN jsonb_build_object('success', true, 'tenants_processed', v_count, 'new_period_start', v_new_period_start);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_voice_billing_history(
    p_tenant_id UUID, p_limit INTEGER DEFAULT 12, p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    usage_id UUID, period_start TIMESTAMPTZ, period_end TIMESTAMPTZ,
    included_minutes_used DECIMAL, overage_minutes_used DECIMAL, total_minutes_used DECIMAL,
    overage_charges_centavos INTEGER, total_calls INTEGER, is_billed BOOLEAN, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT vmu.id, vmu.billing_period_start, vmu.billing_period_end,
        vmu.included_minutes_used, vmu.overage_minutes_used,
        (vmu.included_minutes_used + vmu.overage_minutes_used),
        vmu.overage_charges_centavos, vmu.total_calls, (vmu.stripe_invoice_id IS NOT NULL), vmu.created_at
    FROM voice_minute_usage vmu WHERE vmu.tenant_id = p_tenant_id
    ORDER BY vmu.billing_period_start DESC LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 4.6 update_overage_payment_status
CREATE OR REPLACE FUNCTION public.update_overage_payment_status(
    p_stripe_invoice_item_id TEXT,
    p_stripe_invoice_id TEXT,
    p_paid_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- Actualizar voice_minute_usage con el invoice_id real
    UPDATE voice_minute_usage
    SET
        stripe_invoice_id = p_stripe_invoice_id,
        updated_at = NOW()
    WHERE stripe_invoice_id = p_stripe_invoice_item_id
       OR stripe_invoice_id = p_stripe_invoice_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'records_updated', v_updated_count,
        'invoice_id', p_stripe_invoice_id,
        'paid_at', p_paid_at
    );
END;
$$;

COMMENT ON FUNCTION public.update_overage_payment_status IS
'Actualiza el estado de pago cuando Stripe confirma el pago del invoice.
Llamado por webhook invoice.paid.';

-- =====================================================
-- PARTE 5: ALERT FUNCTIONS (de 166)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_unacknowledged_voice_alert_count(p_tenant_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN (SELECT COUNT(*)::int FROM voice_usage_alerts WHERE tenant_id = p_tenant_id AND acknowledged = false);
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_all_voice_alerts(p_tenant_id uuid, p_user_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  UPDATE voice_usage_alerts SET acknowledged = true, acknowledged_at = now(), acknowledged_by = p_user_id
  WHERE tenant_id = p_tenant_id AND acknowledged = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- =====================================================
-- PARTE 6: RLS POLICIES
-- =====================================================

ALTER TABLE public.voice_minute_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_minute_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_minute_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_usage_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for voice_minute_limits
DROP POLICY IF EXISTS "voice_minute_limits_select_own" ON public.voice_minute_limits;
CREATE POLICY "voice_minute_limits_select_own" ON public.voice_minute_limits FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "voice_minute_limits_service_role" ON public.voice_minute_limits;
CREATE POLICY "voice_minute_limits_service_role" ON public.voice_minute_limits FOR ALL
    USING (current_setting('role', true) = 'service_role')
    WITH CHECK (current_setting('role', true) = 'service_role');

-- Policies for voice_minute_usage
DROP POLICY IF EXISTS "voice_minute_usage_select_own" ON public.voice_minute_usage;
CREATE POLICY "voice_minute_usage_select_own" ON public.voice_minute_usage FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "voice_minute_usage_service_role" ON public.voice_minute_usage;
CREATE POLICY "voice_minute_usage_service_role" ON public.voice_minute_usage FOR ALL
    USING (current_setting('role', true) = 'service_role')
    WITH CHECK (current_setting('role', true) = 'service_role');

-- Policies for voice_minute_transactions
DROP POLICY IF EXISTS "voice_minute_transactions_select_own" ON public.voice_minute_transactions;
CREATE POLICY "voice_minute_transactions_select_own" ON public.voice_minute_transactions FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "voice_minute_transactions_service_role" ON public.voice_minute_transactions;
CREATE POLICY "voice_minute_transactions_service_role" ON public.voice_minute_transactions FOR ALL
    USING (current_setting('role', true) = 'service_role')
    WITH CHECK (current_setting('role', true) = 'service_role');

-- Policies for voice_usage_alerts
DROP POLICY IF EXISTS "service_role_voice_alerts" ON public.voice_usage_alerts;
CREATE POLICY "service_role_voice_alerts" ON public.voice_usage_alerts FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "tenant_view_alerts" ON public.voice_usage_alerts;
CREATE POLICY "tenant_view_alerts" ON public.voice_usage_alerts FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "tenant_acknowledge_alerts" ON public.voice_usage_alerts;
CREATE POLICY "tenant_acknowledge_alerts" ON public.voice_usage_alerts FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()));

-- =====================================================
-- PARTE 7: TRIGGERS & GRANTS
-- =====================================================

-- Triggers para updated_at (solo si existe la función)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_voice_minute_limits_updated_at ON public.voice_minute_limits;
    CREATE TRIGGER update_voice_minute_limits_updated_at
      BEFORE UPDATE ON public.voice_minute_limits FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_voice_minute_usage_updated_at ON public.voice_minute_usage;
    CREATE TRIGGER update_voice_minute_usage_updated_at
      BEFORE UPDATE ON public.voice_minute_usage FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Grants
GRANT EXECUTE ON FUNCTION public.check_minute_limit(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_minute_usage(UUID, UUID, INTEGER, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_minute_usage_summary(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_minute_limit_policy(UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_tenants_pending_overage_billing TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_overage_as_billed TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_monthly_voice_usage TO service_role;
GRANT EXECUTE ON FUNCTION public.get_voice_billing_history TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_overage_preview TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_overage_payment_status TO service_role;
GRANT EXECUTE ON FUNCTION public.get_unacknowledged_voice_alert_count TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_all_voice_alerts TO authenticated, service_role;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'VOICE MINUTE SYSTEM (CONSOLIDADO) - COMPLETADO';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tablas: voice_minute_limits, voice_minute_usage,';
  RAISE NOTICE '        voice_minute_transactions, voice_usage_alerts';
  RAISE NOTICE '';
  RAISE NOTICE 'RPCs Core: check_minute_limit, record_minute_usage,';
  RAISE NOTICE '           get_minute_usage_summary, update_minute_limit_policy';
  RAISE NOTICE '';
  RAISE NOTICE 'RPCs Billing: get_tenants_pending_overage_billing,';
  RAISE NOTICE '              get_current_overage_preview, mark_overage_as_billed,';
  RAISE NOTICE '              reset_monthly_voice_usage, get_voice_billing_history,';
  RAISE NOTICE '              update_overage_payment_status';
  RAISE NOTICE '';
  RAISE NOTICE 'RPCs Alerts: get_unacknowledged_voice_alert_count,';
  RAISE NOTICE '             acknowledge_all_voice_alerts';
  RAISE NOTICE '';
  RAISE NOTICE 'Consolida: 162, 163, 166';
  RAISE NOTICE '=====================================================';
END $$;

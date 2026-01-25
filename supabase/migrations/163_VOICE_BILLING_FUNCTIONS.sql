-- =====================================================
-- TIS TIS PLATFORM - VOICE BILLING FUNCTIONS
-- Migration: 163_VOICE_BILLING_FUNCTIONS.sql
-- Date: January 2025
-- Version: 1.0
-- FASE 5.4: Stripe Integration for Voice Minute Limits
--
-- PURPOSE: Funciones SQL para el proceso de facturación
-- de minutos excedentes de Voice Agent
-- =====================================================

-- =====================================================
-- FUNCIÓN: get_tenants_pending_overage_billing
-- Obtiene tenants con excedentes pendientes de facturar
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_tenants_pending_overage_billing(
    p_check_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    overage_minutes DECIMAL,
    overage_charges_centavos INTEGER,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (t.id)
        t.id AS tenant_id,
        t.business_name AS tenant_name,
        s.stripe_customer_id,
        s.stripe_subscription_id,
        vmu.overage_minutes_used AS overage_minutes,
        vmu.overage_charges_centavos,
        vmu.billing_period_start AS period_start,
        vmu.billing_period_end AS period_end
    FROM tenants t
    -- Join con clients para obtener subscription
    INNER JOIN clients c ON c.tenant_id = t.id
    INNER JOIN subscriptions s ON s.client_id = c.id
    -- Join con voice_minute_limits para verificar política
    INNER JOIN voice_minute_limits vml ON vml.tenant_id = t.id
    -- Join con voice_minute_usage para obtener uso
    INNER JOIN voice_minute_usage vmu ON (
        vmu.tenant_id = t.id
        AND vmu.billing_period_end <= p_check_date
    )
    WHERE
        -- Solo tenants con plan Growth (voice agent)
        t.plan = 'growth'
        -- Solo política de cobro
        AND vml.overage_policy = 'charge'
        -- Tiene excedentes no facturados
        AND vmu.overage_minutes_used > 0
        AND vmu.overage_charges_centavos > 0
        AND vmu.stripe_invoice_id IS NULL
        -- Tiene Stripe configurado
        AND s.stripe_customer_id IS NOT NULL
        AND s.stripe_subscription_id IS NOT NULL
        AND s.status = 'active'
    ORDER BY t.id, vmu.billing_period_start DESC;
END;
$$;

COMMENT ON FUNCTION public.get_tenants_pending_overage_billing IS
'Obtiene todos los tenants con excedentes de voz pendientes de facturar.
Solo incluye tenants con plan Growth, política charge, y stripe configurado.';

-- =====================================================
-- FUNCIÓN: get_current_overage_preview
-- Preview de excedentes actuales para un tenant
-- =====================================================

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

-- =====================================================
-- FUNCIÓN: mark_overage_as_billed
-- Marca los excedentes como facturados después de crear invoice item
-- =====================================================

CREATE OR REPLACE FUNCTION public.mark_overage_as_billed(
    p_tenant_id UUID,
    p_period_start TIMESTAMPTZ,
    p_stripe_invoice_item_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count INTEGER;
    v_usage_id UUID;
BEGIN
    -- Actualizar voice_minute_usage
    UPDATE voice_minute_usage
    SET
        stripe_invoice_id = p_stripe_invoice_item_id,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
        AND billing_period_start = p_period_start
        AND stripe_invoice_id IS NULL
    RETURNING id INTO v_usage_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No matching usage record found or already billed',
            'error_code', 'USAGE_NOT_FOUND'
        );
    END IF;

    -- Actualizar transactions asociadas
    UPDATE voice_minute_transactions
    SET
        stripe_invoice_item_id = p_stripe_invoice_item_id
    WHERE usage_id = v_usage_id
        AND is_overage = true
        AND stripe_invoice_item_id IS NULL;

    RETURN jsonb_build_object(
        'success', true,
        'usage_id', v_usage_id,
        'transactions_updated', (
            SELECT COUNT(*) FROM voice_minute_transactions
            WHERE usage_id = v_usage_id
            AND stripe_invoice_item_id = p_stripe_invoice_item_id
        )
    );
END;
$$;

COMMENT ON FUNCTION public.mark_overage_as_billed IS
'Marca los excedentes de voz como facturados después de crear el invoice item en Stripe.
Evita doble facturación al marcar usage y transactions con el invoice_item_id.';

-- =====================================================
-- FUNCIÓN: reset_monthly_voice_usage
-- Resetea el uso mensual al inicio de nuevo período
-- =====================================================

CREATE OR REPLACE FUNCTION public.reset_monthly_voice_usage()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant RECORD;
    v_count INTEGER := 0;
    v_new_period_start TIMESTAMPTZ;
    v_new_period_end TIMESTAMPTZ;
BEGIN
    -- Calcular nuevo período
    v_new_period_start := date_trunc('month', NOW());
    v_new_period_end := date_trunc('month', NOW()) + INTERVAL '1 month';

    -- Para cada tenant con voice_minute_limits que no tenga registro del nuevo período
    FOR v_tenant IN
        SELECT vml.tenant_id
        FROM voice_minute_limits vml
        LEFT JOIN voice_minute_usage vmu ON (
            vmu.tenant_id = vml.tenant_id
            AND vmu.billing_period_start = v_new_period_start
        )
        WHERE vmu.id IS NULL
    LOOP
        -- Crear nuevo registro de uso para el período
        INSERT INTO voice_minute_usage (
            tenant_id,
            billing_period_start,
            billing_period_end
        ) VALUES (
            v_tenant.tenant_id,
            v_new_period_start,
            v_new_period_end
        )
        ON CONFLICT (tenant_id, billing_period_start) DO NOTHING;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'tenants_processed', v_count,
        'new_period_start', v_new_period_start,
        'new_period_end', v_new_period_end
    );
END;
$$;

COMMENT ON FUNCTION public.reset_monthly_voice_usage IS
'Crea nuevos registros de uso para el período mensual actual.
Llamado por cron job al inicio de cada mes.';

-- =====================================================
-- FUNCIÓN: get_voice_billing_history
-- Obtiene historial de facturación de voz para un tenant
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_voice_billing_history(
    p_tenant_id UUID,
    p_limit INTEGER DEFAULT 12,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    usage_id UUID,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    included_minutes_used DECIMAL,
    overage_minutes_used DECIMAL,
    total_minutes_used DECIMAL,
    overage_charges_centavos INTEGER,
    overage_charges_pesos DECIMAL,
    total_calls INTEGER,
    is_billed BOOLEAN,
    stripe_invoice_id TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar acceso (en llamada directa, verificar que sea del tenant)
    -- Service role siempre tiene acceso
    IF COALESCE(current_setting('role', true), '') != 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM staff
            WHERE user_id = auth.uid()
            AND staff.tenant_id = p_tenant_id
        ) THEN
            RAISE EXCEPTION 'Access denied to tenant billing history';
        END IF;
    END IF;

    RETURN QUERY
    SELECT
        vmu.id AS usage_id,
        vmu.billing_period_start AS period_start,
        vmu.billing_period_end AS period_end,
        vmu.included_minutes_used,
        vmu.overage_minutes_used,
        (vmu.included_minutes_used + vmu.overage_minutes_used) AS total_minutes_used,
        vmu.overage_charges_centavos,
        ROUND(vmu.overage_charges_centavos / 100.0, 2) AS overage_charges_pesos,
        vmu.total_calls,
        (vmu.stripe_invoice_id IS NOT NULL) AS is_billed,
        vmu.stripe_invoice_id,
        vmu.created_at
    FROM voice_minute_usage vmu
    WHERE vmu.tenant_id = p_tenant_id
    ORDER BY vmu.billing_period_start DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.get_voice_billing_history IS
'Obtiene el historial de facturación de voz por período para mostrar en el dashboard.';

-- =====================================================
-- FUNCIÓN: update_overage_payment_status
-- Actualiza el estado de pago de excedentes (llamado por webhook)
-- =====================================================

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
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.get_tenants_pending_overage_billing TO service_role;
GRANT EXECUTE ON FUNCTION public.get_current_overage_preview TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_overage_as_billed TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_monthly_voice_usage TO service_role;
GRANT EXECUTE ON FUNCTION public.get_voice_billing_history TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_overage_payment_status TO service_role;

-- =====================================================
-- FIN MIGRACION 163: VOICE BILLING FUNCTIONS
-- =====================================================

-- Resumen de funciones creadas:
-- 1. get_tenants_pending_overage_billing: Lista tenants con overage pendiente
-- 2. get_current_overage_preview: Preview de cargos para UI
-- 3. mark_overage_as_billed: Marca overage como facturado
-- 4. reset_monthly_voice_usage: Crea registros para nuevo período
-- 5. get_voice_billing_history: Historial de facturación
-- 6. update_overage_payment_status: Actualiza estado de pago

-- =====================================================
-- MIGRATION 044: Subscription Cancellation System
--
-- Implementa el sistema completo de cancelación de suscripciones:
-- 1. Nuevos campos en subscriptions para cancelación
-- 2. Nuevos campos en tenants para retención de datos
-- 3. Campo deactivated_at en user_roles
-- 4. Tabla cancellation_feedback para analytics
-- 5. Actualizar CHECK constraint en subscription_changes
-- =====================================================

-- ============================================
-- 1. CAMPOS ADICIONALES EN subscriptions
-- ============================================

-- Campo para fecha de cancelación
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Campo para razón de cancelación
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(50);

-- Campo para detalles adicionales de cancelación
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS cancellation_details TEXT;

-- Campo para fecha límite de retención de datos
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS data_retention_until TIMESTAMPTZ;

-- Actualizar status para incluir 'cancelling'
-- Nota: Si ya existe un CHECK constraint, necesitamos recrearlo
DO $$
BEGIN
    -- Intentar añadir 'cancelling' como valor válido
    -- Si falla porque el constraint no lo permite, recrearlo
    ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_status_check;

    ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'past_due', 'cancelled', 'cancelling', 'incomplete', 'trialing', 'unpaid'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Status constraint update skipped: %', SQLERRM;
END $$;

-- ============================================
-- 2. CAMPOS ADICIONALES EN tenants
-- ============================================

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS data_retention_until TIMESTAMPTZ;

-- Actualizar status para incluir 'cancelling'
DO $$
BEGIN
    ALTER TABLE public.tenants
    DROP CONSTRAINT IF EXISTS tenants_status_check;

    ALTER TABLE public.tenants
    ADD CONSTRAINT tenants_status_check
    CHECK (status IN ('active', 'inactive', 'suspended', 'cancelling', 'cancelled'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Tenants status constraint update skipped: %', SQLERRM;
END $$;

-- ============================================
-- 3. CAMPOS ADICIONALES EN user_roles
-- ============================================

ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(100);

-- ============================================
-- 4. ACTUALIZAR subscription_changes CHECK
-- ============================================

DO $$
BEGIN
    ALTER TABLE public.subscription_changes
    DROP CONSTRAINT IF EXISTS subscription_changes_change_type_check;

    ALTER TABLE public.subscription_changes
    ADD CONSTRAINT subscription_changes_change_type_check
    CHECK (change_type IN (
        'branch_added',
        'branch_removed',
        'plan_upgraded',
        'plan_downgraded',
        'addon_added',
        'addon_removed',
        'quantity_changed',
        'subscription_cancelled',
        'subscription_reactivated'
    ));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'subscription_changes constraint update skipped: %', SQLERRM;
END $$;

-- ============================================
-- 5. TABLA: cancellation_feedback
-- Feedback de cancelaciones para analytics
-- ============================================

CREATE TABLE IF NOT EXISTS public.cancellation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,

    -- Plan al momento de cancelar
    plan_at_cancellation VARCHAR(50) NOT NULL,

    -- Razón de cancelación
    reason VARCHAR(50) NOT NULL CHECK (reason IN (
        'too_expensive',
        'not_using',
        'missing_features',
        'technical_issues',
        'switching',
        'closing_business',
        'other',
        'not_specified'
    )),

    -- Detalles adicionales (si reason = 'other')
    reason_details TEXT,

    -- Métricas de uso al cancelar (para análisis)
    subscription_duration_days INT,
    monthly_amount DECIMAL(10,2),
    branches_count INT,
    total_leads INT,
    total_appointments INT,
    total_conversations INT,

    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Índices para analytics
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_reason ON public.cancellation_feedback(reason);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_plan ON public.cancellation_feedback(plan_at_cancellation);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_created ON public.cancellation_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_tenant ON public.cancellation_feedback(tenant_id);

-- ============================================
-- 6. RLS POLICIES para cancellation_feedback
-- ============================================

ALTER TABLE public.cancellation_feedback ENABLE ROW LEVEL SECURITY;

-- Solo el sistema puede insertar feedback
CREATE POLICY "System can insert cancellation feedback" ON public.cancellation_feedback
FOR INSERT
TO service_role
WITH CHECK (true);

-- Solo admins/owners pueden ver feedback de su tenant
CREATE POLICY "Admins can view cancellation feedback" ON public.cancellation_feedback
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'owner')
        AND ur.is_active = true
    )
);

-- ============================================
-- 7. FUNCIÓN: get_cancellation_analytics
-- Para dashboard de analytics
-- ============================================

CREATE OR REPLACE FUNCTION get_cancellation_analytics(
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    reason VARCHAR(50),
    count BIGINT,
    avg_duration_days NUMERIC,
    avg_monthly_amount NUMERIC,
    percentage NUMERIC
) AS $$
DECLARE
    v_total BIGINT;
BEGIN
    -- Obtener total de cancelaciones en el período
    SELECT COUNT(*) INTO v_total
    FROM public.cancellation_feedback
    WHERE created_at BETWEEN p_start_date AND p_end_date;

    IF v_total = 0 THEN
        v_total := 1; -- Evitar división por cero
    END IF;

    RETURN QUERY
    SELECT
        cf.reason,
        COUNT(*)::BIGINT,
        ROUND(AVG(cf.subscription_duration_days)::NUMERIC, 1),
        ROUND(AVG(cf.monthly_amount)::NUMERIC, 2),
        ROUND((COUNT(*)::NUMERIC / v_total::NUMERIC * 100), 1)
    FROM public.cancellation_feedback cf
    WHERE cf.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY cf.reason
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 8. FUNCIÓN: reactivate_subscription
-- Para cuando un cliente quiere volver
-- ============================================

CREATE OR REPLACE FUNCTION reactivate_subscription(p_tenant_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    subscription_id UUID
) AS $$
DECLARE
    v_subscription RECORD;
    v_data_retention TIMESTAMPTZ;
BEGIN
    -- Buscar suscripción cancelada del tenant
    SELECT s.* INTO v_subscription
    FROM public.subscriptions s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.tenant_id = p_tenant_id
    AND s.status IN ('cancelled', 'cancelling')
    ORDER BY s.cancelled_at DESC
    LIMIT 1;

    IF v_subscription IS NULL THEN
        RETURN QUERY SELECT false, 'No se encontró suscripción cancelada'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Verificar que está dentro del período de retención
    IF v_subscription.data_retention_until < NOW() THEN
        RETURN QUERY SELECT false, 'El período de retención de datos ha expirado'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- La reactivación real se hace via Stripe API
    -- Esta función solo verifica elegibilidad
    RETURN QUERY SELECT
        true,
        format('Suscripción elegible para reactivación. Datos retenidos hasta %s', v_subscription.data_retention_until)::TEXT,
        v_subscription.id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 9. COMENTARIOS DE DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE public.cancellation_feedback IS
'Feedback de cancelaciones para análisis de churn y mejora del producto';

COMMENT ON COLUMN public.cancellation_feedback.reason IS
'Razón principal de cancelación seleccionada por el usuario';

COMMENT ON COLUMN public.cancellation_feedback.subscription_duration_days IS
'Días que el cliente estuvo suscrito antes de cancelar';

COMMENT ON FUNCTION get_cancellation_analytics(TIMESTAMPTZ, TIMESTAMPTZ) IS
'Retorna estadísticas de cancelaciones para un período dado';

COMMENT ON FUNCTION reactivate_subscription(UUID) IS
'Verifica si una suscripción cancelada puede ser reactivada';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 044 completed successfully';
    RAISE NOTICE '   - subscriptions: added cancellation fields';
    RAISE NOTICE '   - tenants: added cancellation fields';
    RAISE NOTICE '   - user_roles: added deactivation fields';
    RAISE NOTICE '   - cancellation_feedback: table created';
    RAISE NOTICE '   - Functions: get_cancellation_analytics, reactivate_subscription';
END $$;

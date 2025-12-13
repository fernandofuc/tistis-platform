-- =====================================================
-- MIGRATION 020: Branch Billing System
--
-- Implementa el sistema completo de facturación por sucursales:
-- 1. Tabla de historial de cambios de suscripción
-- 2. Columna max_branches en subscriptions
-- 3. Función para validar límite de sucursales
-- 4. Trigger para sincronizar conteo de sucursales
-- 5. Políticas RLS para subscription_changes
-- =====================================================

-- ============================================
-- 1. TABLA: subscription_changes
-- Historial de todos los cambios de suscripción
-- ============================================

CREATE TABLE IF NOT EXISTS public.subscription_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    -- Tipo de cambio
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN (
        'branch_added',
        'branch_removed',
        'plan_upgraded',
        'plan_downgraded',
        'addon_added',
        'addon_removed',
        'quantity_changed'
    )),

    -- Valores antes y después del cambio
    previous_value JSONB DEFAULT '{}'::jsonb,
    new_value JSONB DEFAULT '{}'::jsonb,

    -- Impacto financiero
    price_impact DECIMAL(10,2) DEFAULT 0, -- Positivo = cobro, Negativo = crédito
    proration_amount DECIMAL(10,2) DEFAULT 0, -- Monto prorrateado

    -- Referencias de Stripe
    stripe_invoice_id VARCHAR(255),
    stripe_invoice_item_id VARCHAR(255),

    -- Metadata adicional
    reason TEXT, -- Razón del cambio (opcional)
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Índices para búsquedas comunes
    CONSTRAINT subscription_changes_subscription_id_not_null CHECK (subscription_id IS NOT NULL)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_subscription_changes_subscription ON public.subscription_changes(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_tenant ON public.subscription_changes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_type ON public.subscription_changes(change_type);
CREATE INDEX IF NOT EXISTS idx_subscription_changes_created ON public.subscription_changes(created_at DESC);

-- ============================================
-- 2. COLUMNAS ADICIONALES EN subscriptions
-- ============================================

-- max_branches: Límite de sucursales según el plan actual
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS max_branches INT DEFAULT 1;

-- current_branches: Contador de sucursales activas (calculado)
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS current_branches INT DEFAULT 1;

-- branch_unit_price: Precio por sucursal extra (para referencia rápida)
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS branch_unit_price DECIMAL(10,2) DEFAULT 0;

-- can_modify_branches: Si el plan permite agregar/quitar sucursales
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS can_modify_branches BOOLEAN DEFAULT true;

-- Actualizar subscriptions existentes con max_branches basado en el campo branches
UPDATE public.subscriptions
SET max_branches = COALESCE(branches, 1),
    current_branches = COALESCE(branches, 1)
WHERE max_branches IS NULL OR max_branches = 0;

-- ============================================
-- 3. FUNCIÓN: check_branch_limit
-- Valida si se puede crear una nueva sucursal
-- ============================================

CREATE OR REPLACE FUNCTION check_branch_limit(p_tenant_id UUID)
RETURNS TABLE (
    can_create BOOLEAN,
    current_count INT,
    max_allowed INT,
    subscription_plan VARCHAR,
    message TEXT
) AS $$
DECLARE
    v_subscription RECORD;
    v_current_branches INT;
BEGIN
    -- Obtener suscripción activa del tenant
    SELECT s.* INTO v_subscription
    FROM public.subscriptions s
    JOIN public.clients c ON c.id = s.client_id
    WHERE c.tenant_id = p_tenant_id
    AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;

    -- Si no hay suscripción, retornar error
    IF v_subscription IS NULL THEN
        RETURN QUERY SELECT
            false,
            0,
            0,
            'none'::VARCHAR,
            'No se encontró una suscripción activa'::TEXT;
        RETURN;
    END IF;

    -- Contar sucursales activas actuales
    SELECT COUNT(*) INTO v_current_branches
    FROM public.branches
    WHERE tenant_id = p_tenant_id
    AND is_active = true;

    -- Validar límite
    IF v_current_branches >= v_subscription.max_branches THEN
        RETURN QUERY SELECT
            false,
            v_current_branches,
            v_subscription.max_branches,
            v_subscription.plan,
            format('Has alcanzado el límite de %s sucursales. Actualiza tu plan para agregar más.', v_subscription.max_branches);
        RETURN;
    END IF;

    -- Puede crear
    RETURN QUERY SELECT
        true,
        v_current_branches,
        v_subscription.max_branches,
        v_subscription.plan,
        format('Puedes crear hasta %s sucursales más.', v_subscription.max_branches - v_current_branches);
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. FUNCIÓN: sync_branch_count
-- Sincroniza el conteo de sucursales en subscriptions
-- ============================================

CREATE OR REPLACE FUNCTION sync_branch_count()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_branch_count INT;
BEGIN
    -- Determinar tenant_id según la operación
    IF TG_OP = 'DELETE' THEN
        v_tenant_id := OLD.tenant_id;
    ELSE
        v_tenant_id := NEW.tenant_id;
    END IF;

    -- Contar sucursales activas del tenant
    SELECT COUNT(*) INTO v_branch_count
    FROM public.branches
    WHERE tenant_id = v_tenant_id
    AND is_active = true;

    -- Actualizar subscriptions
    UPDATE public.subscriptions s
    SET current_branches = v_branch_count,
        updated_at = NOW()
    FROM public.clients c
    WHERE c.id = s.client_id
    AND c.tenant_id = v_tenant_id
    AND s.status = 'active';

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para sincronizar conteo
DROP TRIGGER IF EXISTS trigger_sync_branch_count ON public.branches;
CREATE TRIGGER trigger_sync_branch_count
AFTER INSERT OR UPDATE OF is_active OR DELETE ON public.branches
FOR EACH ROW EXECUTE FUNCTION sync_branch_count();

-- ============================================
-- 5. FUNCIÓN: get_branch_pricing
-- Obtiene el precio por sucursal extra según el plan
-- ============================================

CREATE OR REPLACE FUNCTION get_branch_pricing(p_plan VARCHAR)
RETURNS TABLE (
    base_price DECIMAL,
    extra_branch_price DECIMAL,
    progressive_pricing JSONB
) AS $$
BEGIN
    -- Precios según PLAN_CONFIG en create-checkout/route.ts
    CASE p_plan
        WHEN 'starter' THEN
            RETURN QUERY SELECT
                299000::DECIMAL / 100,
                0::DECIMAL, -- Starter no permite sucursales extra
                '[]'::JSONB;
        WHEN 'essentials' THEN
            RETURN QUERY SELECT
                749000::DECIMAL / 100,
                199000::DECIMAL / 100,
                '[
                    {"qty": 2, "price": 1990},
                    {"qty": 3, "price": 1790},
                    {"qty": 4, "price": 1590},
                    {"qty": 5, "price": 1490}
                ]'::JSONB;
        WHEN 'growth' THEN
            RETURN QUERY SELECT
                1499000::DECIMAL / 100,
                299000::DECIMAL / 100,
                '[
                    {"qty": 2, "price": 2990},
                    {"qty": 3, "price": 2690},
                    {"qty": 4, "price": 2390}
                ]'::JSONB;
        WHEN 'scale' THEN
            RETURN QUERY SELECT
                2999000::DECIMAL / 100,
                399000::DECIMAL / 100,
                '[
                    {"qty": 2, "price": 3990},
                    {"qty": 3, "price": 3590},
                    {"qty": 4, "price": 3290}
                ]'::JSONB;
        ELSE
            RETURN QUERY SELECT
                0::DECIMAL,
                0::DECIMAL,
                '[]'::JSONB;
    END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 6. RLS POLICIES para subscription_changes
-- ============================================

ALTER TABLE public.subscription_changes ENABLE ROW LEVEL SECURITY;

-- Admins pueden ver cambios de su tenant
CREATE POLICY "Admins can view subscription changes" ON public.subscription_changes
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'owner')
    )
);

-- Solo el sistema puede insertar cambios (via service role)
CREATE POLICY "System can insert subscription changes" ON public.subscription_changes
FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================
-- 7. ACTUALIZAR DATOS EXISTENTES
-- ============================================

-- Actualizar subscriptions existentes con max_branches desde branches count
UPDATE public.subscriptions s
SET
    max_branches = GREATEST(COALESCE(s.branches, 1), 1),
    current_branches = (
        SELECT COUNT(*)
        FROM public.branches b
        JOIN public.clients c ON c.tenant_id = b.tenant_id
        WHERE c.id = s.client_id
        AND b.is_active = true
    ),
    can_modify_branches = (s.plan != 'starter')
WHERE s.status IN ('active', 'past_due');

-- ============================================
-- 8. COMENTARIOS DE DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE public.subscription_changes IS
'Historial de todos los cambios de suscripción para auditoría y facturación';

COMMENT ON COLUMN public.subscription_changes.change_type IS
'Tipo de cambio: branch_added, branch_removed, plan_upgraded, etc.';

COMMENT ON COLUMN public.subscription_changes.price_impact IS
'Impacto en precio mensual. Positivo = cobro adicional, Negativo = crédito';

COMMENT ON COLUMN public.subscription_changes.proration_amount IS
'Monto prorrateado calculado para el período actual';

COMMENT ON FUNCTION check_branch_limit(UUID) IS
'Valida si un tenant puede crear más sucursales según su plan';

COMMENT ON FUNCTION get_branch_pricing(VARCHAR) IS
'Retorna precios de sucursales extra según el plan';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verificación final
DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_column_exists BOOLEAN;
BEGIN
    -- Verificar tabla subscription_changes
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'subscription_changes'
    ) INTO v_table_exists;

    -- Verificar columna max_branches
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'max_branches'
    ) INTO v_column_exists;

    IF v_table_exists AND v_column_exists THEN
        RAISE NOTICE '✅ Migration 020 completed successfully';
        RAISE NOTICE '   - Table subscription_changes: CREATED';
        RAISE NOTICE '   - Column subscriptions.max_branches: ADDED';
        RAISE NOTICE '   - Functions: check_branch_limit, sync_branch_count, get_branch_pricing';
        RAISE NOTICE '   - Trigger: trigger_sync_branch_count on branches';
    ELSE
        RAISE WARNING '⚠️ Migration 020 may have issues';
    END IF;
END $$;

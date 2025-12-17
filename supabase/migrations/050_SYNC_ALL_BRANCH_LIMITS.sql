-- =====================================================
-- MIGRATION 050: Sync All Branch Limits
--
-- Sincroniza max_branches y current_branches para TODAS
-- las suscripciones, incluyendo cuentas de prueba
-- =====================================================

-- 1. Actualizar max_branches basado en el plan
UPDATE public.subscriptions
SET max_branches = CASE plan
    WHEN 'starter' THEN 1
    WHEN 'essentials' THEN 5
    WHEN 'growth' THEN 8
    WHEN 'scale' THEN 15
    ELSE 5  -- default
END;

-- 2. Sincronizar current_branches con el conteo real
UPDATE public.subscriptions s
SET current_branches = COALESCE((
    SELECT COUNT(*)
    FROM public.branches b
    WHERE b.tenant_id = (
        SELECT c.tenant_id
        FROM public.clients c
        WHERE c.id = s.client_id
    )
    AND b.is_active = true
), 0);

-- 3. Verificar y reportar
DO $$
DECLARE
    v_sub RECORD;
    v_issues INT := 0;
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  Migration 050: Branch Limits Synced';
    RAISE NOTICE '=====================================================';

    FOR v_sub IN
        SELECT
            s.id,
            s.plan,
            s.max_branches,
            s.current_branches,
            s.status,
            c.email
        FROM public.subscriptions s
        JOIN public.clients c ON c.id = s.client_id
        ORDER BY s.created_at DESC
    LOOP
        -- Check if over limit
        IF v_sub.current_branches > v_sub.max_branches THEN
            v_issues := v_issues + 1;
            RAISE WARNING '⚠️ OVER LIMIT: % (%) - %/% branches on % plan',
                v_sub.email, v_sub.status, v_sub.current_branches, v_sub.max_branches, v_sub.plan;
        ELSE
            RAISE NOTICE '✅ OK: % - %/% branches on % plan',
                v_sub.email, v_sub.current_branches, v_sub.max_branches, v_sub.plan;
        END IF;
    END LOOP;

    IF v_issues > 0 THEN
        RAISE WARNING '-----------------------------------------------------';
        RAISE WARNING '  % subscription(s) are OVER their branch limit!', v_issues;
        RAISE WARNING '  Users should delete excess branches or upgrade plan.';
        RAISE WARNING '-----------------------------------------------------';
    ELSE
        RAISE NOTICE '-----------------------------------------------------';
        RAISE NOTICE '  All subscriptions are within their limits.';
        RAISE NOTICE '-----------------------------------------------------';
    END IF;
END $$;

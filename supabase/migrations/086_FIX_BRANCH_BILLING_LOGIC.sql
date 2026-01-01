-- =====================================================
-- Migration 086: FIX BRANCH BILLING LOGIC
-- =====================================================
-- PROBLEMA: Cuando un usuario cambia de plan (ej: Starter a Essentials),
-- el sistema actualizaba max_branches al límite del nuevo plan (8),
-- pero el usuario solo había contratado 1 sucursal inicialmente.
-- Esto permitía crear sucursales gratis sin cobrar.
--
-- SOLUCIÓN:
-- 1. max_branches ahora representa SUCURSALES CONTRATADAS (lo que paga)
-- 2. El límite del plan se obtiene del código (plans.ts: branchLimit)
-- 3. Para agregar más sucursales, deben pasar por add-extra y pagar
--
-- Esta migración corrige los datos existentes:
-- - Primero sincroniza current_branches con el conteo real
-- - Luego establece max_branches = current_branches (lo que realmente tiene)
-- - El código ya no actualiza max_branches al cambiar de plan
-- =====================================================

-- ======================
-- PASO 1: Sincronizar current_branches con el conteo real de branches
-- ======================

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
), 1)
WHERE status IN ('active', 'trialing');

-- ======================
-- PASO 2: Corregir max_branches para todas las subscriptions
-- max_branches = current_branches (lo que realmente tienen contratado)
-- Solo corregimos donde max_branches > current_branches
-- ======================

UPDATE public.subscriptions
SET max_branches = GREATEST(current_branches, 1)
WHERE max_branches > current_branches
  AND status IN ('active', 'trialing');

-- ======================
-- PASO 3: Verificar y loggear cambios
-- ======================

DO $$
DECLARE
    v_sub RECORD;
    v_total INTEGER;
    v_corrected INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM public.subscriptions
    WHERE status IN ('active', 'trialing');

    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN Migration 086:';
    RAISE NOTICE '  - Subscriptions activas/trial: %', v_total;
    RAISE NOTICE '========================================';

    -- Mostrar estado de cada subscription
    FOR v_sub IN
        SELECT
            s.id,
            s.plan,
            s.max_branches,
            s.current_branches,
            s.status,
            c.contact_email,
            c.business_name
        FROM public.subscriptions s
        LEFT JOIN public.clients c ON c.id = s.client_id
        WHERE s.status IN ('active', 'trialing')
        ORDER BY s.created_at DESC
    LOOP
        RAISE NOTICE '  - % (%): % sucursales contratadas, % actuales',
            COALESCE(v_sub.contact_email, v_sub.business_name, 'Sin nombre'),
            v_sub.plan,
            v_sub.max_branches,
            v_sub.current_branches;
    END LOOP;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'IMPORTANTE: Ahora max_branches = sucursales contratadas';
    RAISE NOTICE 'El límite del plan se verifica en el código (plans.ts)';
    RAISE NOTICE '========================================';
END $$;

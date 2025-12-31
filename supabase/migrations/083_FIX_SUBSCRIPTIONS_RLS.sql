-- =====================================================
-- Migration 083: FIX SUBSCRIPTIONS RLS POLICIES
-- =====================================================
-- PROBLEMA: Error 406 (Not Acceptable) al consultar subscriptions
--
-- La política actual solo permite acceso via:
--   client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
--
-- Pero en el nuevo flujo multi-tenant, los usuarios pueden acceder
-- a subscriptions via su tenant_id (a través de user_roles).
--
-- SOLUCIÓN: Actualizar la política RLS para permitir acceso tanto
-- por user_id directo como por tenant_id via user_roles.
-- =====================================================

-- ======================
-- PASO 1: Verificar que RLS está habilitado
-- ======================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ======================
-- PASO 2: Eliminar política existente
-- ======================
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;

-- ======================
-- PASO 3: Crear nueva política más completa
-- ======================
-- Los usuarios pueden ver subscriptions si:
-- 1. Son dueños directos del client (client.user_id = auth.uid())
-- 2. Pertenecen al mismo tenant (via user_roles activo)
CREATE POLICY "Users can view subscriptions for their tenant"
ON public.subscriptions FOR SELECT
USING (
    -- Acceso directo: el client pertenece al usuario
    client_id IN (
        SELECT c.id FROM public.clients c WHERE c.user_id = auth.uid()
    )
    OR
    -- Acceso via tenant: el usuario tiene rol activo en el tenant del client
    client_id IN (
        SELECT c.id
        FROM public.clients c
        WHERE c.tenant_id IN (
            SELECT ur.tenant_id
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.is_active = true
        )
    )
);

-- ======================
-- PASO 4: Política para INSERT (solo system/service role debería insertar)
-- ======================
-- La creación de subscriptions generalmente se hace via API con service role
-- Pero permitimos que el dueño del tenant pueda crear
DROP POLICY IF EXISTS "Owners can insert subscriptions" ON public.subscriptions;
CREATE POLICY "Owners can insert subscriptions"
ON public.subscriptions FOR INSERT
WITH CHECK (
    client_id IN (
        SELECT c.id
        FROM public.clients c
        WHERE c.tenant_id IN (
            SELECT ur.tenant_id
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.is_active = true
            AND ur.role IN ('owner', 'admin')
        )
    )
);

-- ======================
-- PASO 5: Política para UPDATE (solo owners)
-- ======================
DROP POLICY IF EXISTS "Owners can update subscriptions" ON public.subscriptions;
CREATE POLICY "Owners can update subscriptions"
ON public.subscriptions FOR UPDATE
USING (
    client_id IN (
        SELECT c.id
        FROM public.clients c
        WHERE c.tenant_id IN (
            SELECT ur.tenant_id
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.is_active = true
            AND ur.role IN ('owner', 'admin')
        )
    )
);

-- ======================
-- PASO 6: Política para DELETE (solo owners)
-- ======================
DROP POLICY IF EXISTS "Owners can delete subscriptions" ON public.subscriptions;
CREATE POLICY "Owners can delete subscriptions"
ON public.subscriptions FOR DELETE
USING (
    client_id IN (
        SELECT c.id
        FROM public.clients c
        WHERE c.tenant_id IN (
            SELECT ur.tenant_id
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.is_active = true
            AND ur.role = 'owner'
        )
    )
);

-- ======================
-- VERIFICACIÓN FINAL
-- ======================
DO $$
DECLARE
    v_policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = 'subscriptions' AND schemaname = 'public';

    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN Migration 083:';
    RAISE NOTICE '  - Políticas en subscriptions: %', v_policy_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Las políticas ahora permiten acceso via tenant_id';
    RAISE NOTICE 'Los errores 406 deberían estar resueltos.';
    RAISE NOTICE '========================================';
END $$;

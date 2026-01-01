-- =====================================================
-- Migration 085: FIX WEBHOOK RLS - SERVICE ROLE BYPASS
-- =====================================================
-- PROBLEMA: Los webhooks de Stripe corren server-to-server sin
-- contexto de usuario autenticado. Aunque usen SERVICE_ROLE_KEY,
-- algunas configuraciones de RLS pueden bloquear las operaciones.
--
-- SOLUCIÓN: Agregar políticas explícitas que permitan operaciones
-- desde service role (que no tiene auth.uid()).
--
-- El service role key bypassa RLS por defecto en Supabase,
-- pero estas políticas son un respaldo adicional.
-- =====================================================

-- ======================
-- PASO 1: Política de UPDATE para subscriptions sin restricción de auth.uid()
-- Esta política permite updates cuando auth.uid() es NULL (webhooks)
-- pero el cliente tiene un stripe_customer_id válido
-- ======================

-- Primero, crear política para permitir updates desde webhooks (sin auth.uid)
DROP POLICY IF EXISTS "Service role can update subscriptions" ON public.subscriptions;

-- El service role bypassa RLS automáticamente, pero por si acaso
-- hay configuraciones que lo bloquean, permitimos updates cuando:
-- 1. El registro tiene un client_id válido (existe el client)
-- 2. Y auth.uid() es NULL (indica que es una llamada de service role/webhook)
CREATE POLICY "Service role can update subscriptions"
ON public.subscriptions FOR UPDATE
USING (
    -- Si no hay usuario autenticado (webhook/service role)
    -- permitir si el client_id existe
    auth.uid() IS NULL
    AND client_id IN (SELECT id FROM public.clients)
);

-- ======================
-- PASO 2: Similar para tenants
-- ======================
DROP POLICY IF EXISTS "Service role can update tenants" ON public.tenants;

CREATE POLICY "Service role can update tenants"
ON public.tenants FOR UPDATE
USING (
    auth.uid() IS NULL
);

-- ======================
-- PASO 3: Verificar que service_role tiene permisos especiales
-- ======================
-- Nota: En Supabase, el service_role_key automáticamente bypassa RLS.
-- Estas políticas son solo un respaldo en caso de configuraciones especiales.

-- ======================
-- VERIFICACIÓN FINAL
-- ======================
DO $$
DECLARE
    v_sub_policies INTEGER;
    v_tenant_policies INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_sub_policies
    FROM pg_policies
    WHERE tablename = 'subscriptions' AND schemaname = 'public';

    SELECT COUNT(*) INTO v_tenant_policies
    FROM pg_policies
    WHERE tablename = 'tenants' AND schemaname = 'public';

    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN Migration 085:';
    RAISE NOTICE '  - Políticas en subscriptions: %', v_sub_policies;
    RAISE NOTICE '  - Políticas en tenants: %', v_tenant_policies;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Los webhooks deberían poder actualizar ahora.';
    RAISE NOTICE '========================================';
END $$;

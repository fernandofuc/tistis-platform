-- =====================================================
-- Migration 034: TENANTS RLS
-- =====================================================
-- Permite que usuarios autenticados vean su tenant
-- =====================================================

-- PASO 1: Eliminar políticas existentes
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenants_select" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update" ON public.tenants;
DROP POLICY IF EXISTS "tenants_delete" ON public.tenants;
DROP POLICY IF EXISTS "tenants_service" ON public.tenants;
DROP POLICY IF EXISTS "t1" ON public.tenants;
DROP POLICY IF EXISTS "t2" ON public.tenants;
DROP POLICY IF EXISTS "t3" ON public.tenants;

-- PASO 2: Crear nuevas políticas

-- Usuarios pueden ver su propio tenant (via user_roles)
CREATE POLICY "t1" ON public.tenants FOR SELECT USING (
  id = public.get_tenant()
);

-- Service role puede todo
CREATE POLICY "t2" ON public.tenants FOR ALL USING (auth.role() = 'service_role');

-- Owners/admins pueden actualizar su tenant
CREATE POLICY "t3" ON public.tenants FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = tenants.id
    AND ur.role IN ('owner', 'admin')
    AND ur.is_active = true
  )
);

-- PASO 3: Habilitar RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- LISTO!
-- =====================================================

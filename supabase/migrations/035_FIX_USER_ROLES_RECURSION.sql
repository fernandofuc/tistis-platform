-- =====================================================
-- Migration 035: FIX USER_ROLES INFINITE RECURSION
-- =====================================================
-- El problema: ur3 policy hace SELECT FROM user_roles
-- lo cual causa recursion infinita.
-- Solucion: usar funcion SECURITY DEFINER que bypasea RLS
-- =====================================================

-- PASO 1: Eliminar politicas problematicas de user_roles
DROP POLICY IF EXISTS "ur1" ON public.user_roles;
DROP POLICY IF EXISTS "ur2" ON public.user_roles;
DROP POLICY IF EXISTS "ur3" ON public.user_roles;

-- PASO 2: Crear funcion helper para verificar admin (bypasa RLS)
CREATE OR REPLACE FUNCTION public.is_tenant_admin(check_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = check_tenant_id
    AND role IN ('owner', 'admin')
    AND is_active = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO service_role;

-- PASO 3: Crear nuevas politicas para user_roles (sin recursion)

-- Users can read their own roles
CREATE POLICY "ur_select_own" ON public.user_roles
FOR SELECT USING (user_id = auth.uid());

-- Service role can do everything
CREATE POLICY "ur_service" ON public.user_roles
FOR ALL USING (auth.role() = 'service_role');

-- Admins can manage roles in their tenant (usando funcion que bypasa RLS)
CREATE POLICY "ur_admin_manage" ON public.user_roles
FOR ALL USING (public.is_tenant_admin(tenant_id));

-- PASO 4: Re-habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- LISTO!
-- =====================================================

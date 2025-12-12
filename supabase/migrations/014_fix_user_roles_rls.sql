-- =====================================================
-- TIS TIS PLATFORM - FIX RLS RECURSION IN user_roles
-- Migration: 014_fix_user_roles_rls.sql
-- Date: December 11, 2024
--
-- PROBLEMA: La política "Admins can manage tenant user_roles" causa
-- recursión infinita porque consulta user_roles dentro de la política
-- de user_roles.
--
-- SOLUCIÓN: Usar auth.jwt() para obtener tenant_id del token JWT
-- en lugar de consultar la tabla recursivamente.
-- =====================================================

-- =====================================================
-- PASO 1: Crear función helper que NO cause recursión
-- =====================================================

-- Función que obtiene tenant_id del JWT token (NO consulta user_roles)
CREATE OR REPLACE FUNCTION public.get_jwt_tenant_id()
RETURNS UUID AS $$
BEGIN
    -- Intenta obtener tenant_id del user_metadata en el JWT
    RETURN (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Función que verifica rol del JWT (NO consulta user_roles)
CREATE OR REPLACE FUNCTION public.get_jwt_role()
RETURNS TEXT AS $$
BEGIN
    -- Intenta obtener role del user_metadata en el JWT
    RETURN auth.jwt() -> 'user_metadata' ->> 'role';
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Función simplificada para verificar si es admin (basada en JWT)
CREATE OR REPLACE FUNCTION public.is_jwt_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    v_role := public.get_jwt_role();
    RETURN v_role IN ('super_admin', 'admin', 'owner');
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- PASO 2: Arreglar políticas de user_roles (CRÍTICO)
-- =====================================================

-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage tenant user_roles" ON public.user_roles;

-- Nueva política: Users pueden ver SUS PROPIOS roles (no recursiva)
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (
        user_id = auth.uid()  -- Solo comparación directa, sin subquery
    );

-- Nueva política: Admins pueden gestionar roles de su tenant (usando JWT)
CREATE POLICY "Admins can manage tenant user_roles" ON public.user_roles
    FOR ALL USING (
        -- Super admin puede todo
        public.get_jwt_role() = 'super_admin'
        OR
        -- Admin/Owner puede gestionar roles de su propio tenant
        (
            public.is_jwt_admin()
            AND tenant_id = public.get_jwt_tenant_id()
        )
    );

-- =====================================================
-- PASO 3: Actualizar funciones helper existentes
--         para usar fallback a JWT cuando sea necesario
-- =====================================================

-- Actualizar get_user_tenant_id para priorizar JWT y evitar recursión
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- PRIORIDAD 1: JWT token (evita consultas a BD)
    IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
        v_tenant_id := public.get_jwt_tenant_id();
        IF v_tenant_id IS NOT NULL THEN
            RETURN v_tenant_id;
        END IF;
    END IF;

    -- PRIORIDAD 2: Consultar user_roles (solo si JWT no tiene tenant_id)
    -- Nota: Esto podría causar recursión si se llama desde políticas de user_roles
    SELECT tenant_id INTO v_tenant_id
    FROM public.user_roles
    WHERE user_id = v_user_id
    AND is_active = true
    LIMIT 1;

    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Actualizar is_super_admin para priorizar JWT
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- PRIORIDAD 1: JWT token (evita consultas a BD)
    IF (p_user_id IS NULL OR p_user_id = auth.uid())
       AND public.get_jwt_role() = 'super_admin' THEN
        RETURN TRUE;
    END IF;

    -- PRIORIDAD 2: Consultar user_roles
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_user_id
        AND role = 'super_admin'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Actualizar has_tenant_access para priorizar JWT
CREATE OR REPLACE FUNCTION public.has_tenant_access(p_tenant_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_jwt_tenant UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- PRIORIDAD 1: Super admin tiene acceso a todo (via JWT)
    IF (p_user_id IS NULL OR p_user_id = auth.uid())
       AND public.get_jwt_role() = 'super_admin' THEN
        RETURN TRUE;
    END IF;

    -- PRIORIDAD 2: Verificar tenant_id en JWT
    IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
        v_jwt_tenant := public.get_jwt_tenant_id();
        IF v_jwt_tenant IS NOT NULL AND v_jwt_tenant = p_tenant_id THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- PRIORIDAD 3: Consultar user_roles (fallback)
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_user_id
        AND tenant_id = p_tenant_id
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- PASO 4: Asegurar que user tiene registro en user_roles
--         (Trigger para sincronizar desde staff)
-- =====================================================

-- Función para sincronizar staff → user_roles
CREATE OR REPLACE FUNCTION public.sync_staff_to_user_roles()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo procesar si staff tiene user_id
    IF NEW.user_id IS NOT NULL THEN
        -- Insertar o actualizar user_roles
        INSERT INTO public.user_roles (user_id, tenant_id, role, staff_id, is_active)
        VALUES (NEW.user_id, NEW.tenant_id, NEW.role, NEW.id, NEW.is_active)
        ON CONFLICT (user_id, tenant_id) DO UPDATE SET
            role = EXCLUDED.role,
            staff_id = EXCLUDED.staff_id,
            is_active = EXCLUDED.is_active,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS trigger_sync_staff_user_role ON public.staff;
CREATE TRIGGER trigger_sync_staff_user_role
    AFTER INSERT OR UPDATE OF user_id, role, is_active ON public.staff
    FOR EACH ROW EXECUTE FUNCTION public.sync_staff_to_user_roles();

-- =====================================================
-- PASO 5: Sincronizar datos existentes
-- =====================================================

-- Insertar user_roles para staff existentes que tengan user_id
INSERT INTO public.user_roles (user_id, tenant_id, role, staff_id, is_active)
SELECT
    s.user_id,
    s.tenant_id,
    s.role,
    s.id,
    s.is_active
FROM public.staff s
WHERE s.user_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO UPDATE SET
    role = EXCLUDED.role,
    staff_id = EXCLUDED.staff_id,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- =====================================================
-- PASO 6: Verificación
-- =====================================================

-- Mostrar resultado
DO $$
DECLARE
    policy_count INTEGER;
    role_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'user_roles' AND schemaname = 'public';

    SELECT COUNT(*) INTO role_count
    FROM public.user_roles;

    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'FIX RLS RECURSION COMPLETADO';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Políticas en user_roles: %', policy_count;
    RAISE NOTICE 'Registros en user_roles: %', role_count;
    RAISE NOTICE '';
    RAISE NOTICE 'CAMBIOS REALIZADOS:';
    RAISE NOTICE '1. Creadas funciones JWT helpers (get_jwt_tenant_id, get_jwt_role, is_jwt_admin)';
    RAISE NOTICE '2. Reemplazadas políticas recursivas en user_roles';
    RAISE NOTICE '3. Actualizadas funciones helper para priorizar JWT';
    RAISE NOTICE '4. Sincronizados user_roles desde staff existentes';
    RAISE NOTICE '';
    RAISE NOTICE 'El dashboard debería funcionar ahora.';
    RAISE NOTICE '=====================================================';
END $$;

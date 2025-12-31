-- =====================================================
-- Migration 075: FIX OWNER ROLES
-- =====================================================
-- PROBLEMA: El provisioning creaba usuarios con role='admin'
-- pero debería ser role='owner' para el dueño del negocio.
--
-- Los botones "Cambiar Plan" y "Cancelar Suscripción" solo
-- aparecen para usuarios con role='owner'.
--
-- SOLUCIÓN: Actualizar todos los staff y user_roles que son
-- el primer usuario de su tenant a role='owner'.
-- =====================================================

-- ======================
-- PASO 1: Identificar staff que deben ser owners
-- ======================

-- Un staff debe ser 'owner' si:
-- 1. Es el único staff del tenant, O
-- 2. Fue creado junto con el tenant (mismo día aprox)

-- Para simplicidad, actualizamos TODOS los staff con role='admin'
-- que pertenecen a tenants donde son el ÚNICO staff con ese role
-- a 'owner'.

-- Primero, crear backup por si acaso
CREATE TABLE IF NOT EXISTS public.staff_role_backup_075 AS
SELECT id, tenant_id, email, role, role_title, created_at
FROM public.staff
WHERE role = 'admin';

COMMENT ON TABLE public.staff_role_backup_075 IS
'Backup de staff con role admin antes de Migration 075 (para rollback manual si es necesario)';

-- ======================
-- PASO 2: Actualizar staff a owner
-- ======================

-- Actualizar a 'owner' todos los staff que:
-- 1. Tienen role='admin'
-- 2. Son el primer staff creado para su tenant (menor created_at)
WITH first_staff_per_tenant AS (
  SELECT DISTINCT ON (tenant_id)
    id,
    tenant_id
  FROM public.staff
  WHERE role = 'admin'
  ORDER BY tenant_id, created_at ASC
)
UPDATE public.staff s
SET
  role = 'owner',
  role_title = 'Propietario',
  updated_at = NOW()
FROM first_staff_per_tenant f
WHERE s.id = f.id;

-- Contar cuántos fueron actualizados
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM public.staff
  WHERE role = 'owner' AND role_title = 'Propietario';

  RAISE NOTICE 'STAFF: % registros actualizados a role=owner', v_updated_count;
END $$;

-- ======================
-- PASO 3: Actualizar user_roles a owner
-- ======================

-- Backup de user_roles
CREATE TABLE IF NOT EXISTS public.user_roles_backup_075 AS
SELECT id, user_id, tenant_id, role, created_at
FROM public.user_roles
WHERE role = 'admin';

COMMENT ON TABLE public.user_roles_backup_075 IS
'Backup de user_roles con role admin antes de Migration 075';

-- Actualizar user_roles que corresponden a los staff que ahora son owners
UPDATE public.user_roles ur
SET
  role = 'owner',
  updated_at = NOW()
FROM public.staff s
WHERE ur.staff_id = s.id
  AND s.role = 'owner'
  AND ur.role = 'admin';

-- Contar cuántos fueron actualizados
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM public.user_roles
  WHERE role = 'owner';

  RAISE NOTICE 'USER_ROLES: % registros actualizados a role=owner', v_updated_count;
END $$;

-- ======================
-- PASO 4: Actualizar auth.users metadata
-- ======================

-- Nota: No podemos actualizar auth.users directamente desde SQL
-- porque user_metadata es JSON y requiere la API de Supabase Auth.
-- Los usuarios deberán cerrar sesión y volver a entrar para que
-- el metadata se actualice, O ejecutar un script de API separado.

-- ======================
-- VERIFICACIÓN FINAL
-- ======================

DO $$
DECLARE
  v_staff_owners INTEGER;
  v_user_role_owners INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_staff_owners FROM public.staff WHERE role = 'owner';
  SELECT COUNT(*) INTO v_user_role_owners FROM public.user_roles WHERE role = 'owner';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN FINAL Migration 075:';
  RAISE NOTICE '  - Staff con role=owner: %', v_staff_owners;
  RAISE NOTICE '  - User_roles con role=owner: %', v_user_role_owners;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'NOTA: Los usuarios deben cerrar sesión y volver';
  RAISE NOTICE 'a entrar para ver los cambios reflejados.';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- LISTO! Los usuarios con role='owner' ahora pueden:
-- - Cambiar su plan de suscripción
-- - Cancelar su suscripción
-- - Gestionar facturación
-- =====================================================

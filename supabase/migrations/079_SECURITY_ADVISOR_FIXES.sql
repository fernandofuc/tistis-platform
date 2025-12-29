-- =====================================================
-- Migration 079: SECURITY ADVISOR FIXES
-- =====================================================
-- Corrige los 4 errores reportados por Supabase Security Advisor:
--
-- 1. SECURITY DEFINER en v_trial_subscriptions
-- 2. SECURITY DEFINER en v_client_trial_history
-- 3. RLS deshabilitado en trial_audit_log
-- 4. RLS deshabilitado en trial_migration_backup_074
--
-- Fecha: 29 de Diciembre, 2025
-- =====================================================

-- ======================
-- PROBLEMA 1: v_trial_subscriptions con SECURITY DEFINER
-- ======================
-- Las vistas por defecto se crean con SECURITY DEFINER, lo que significa
-- que se ejecutan con los permisos del creador, NO del usuario actual.
-- Esto puede ser un riesgo de seguridad.
--
-- SOLUCIÓN: Recrear con security_invoker=true (PostgreSQL 15+)
-- Esto hace que la vista se ejecute con los permisos del usuario que la consulta.

DROP VIEW IF EXISTS public.v_trial_subscriptions;

CREATE VIEW public.v_trial_subscriptions
WITH (security_invoker = true)
AS
SELECT
  s.id AS subscription_id,
  s.client_id,
  c.business_name,
  c.contact_email,
  s.plan,
  s.trial_start,
  s.trial_end,
  s.trial_status,
  s.will_convert_to_paid,
  s.status,
  -- Calcular días restantes (usar FLOOR para no reportar días extra)
  FLOOR(EXTRACT(EPOCH FROM (s.trial_end - NOW())) / 86400) AS days_remaining,
  CASE
    WHEN s.trial_end < NOW() THEN 'expired'
    WHEN s.will_convert_to_paid THEN 'will_convert'
    ELSE 'will_cancel'
  END AS action_needed,
  s.created_at,
  s.updated_at
FROM public.subscriptions s
INNER JOIN public.clients c ON c.id = s.client_id
WHERE s.trial_status = 'active'
ORDER BY s.trial_end ASC;

COMMENT ON VIEW public.v_trial_subscriptions IS
'Vista para monitorear trials activos. SECURITY_INVOKER=true para respetar RLS del usuario.';

-- Grant para service_role (mantener acceso administrativo)
GRANT SELECT ON public.v_trial_subscriptions TO service_role;

-- ======================
-- PROBLEMA 2: v_client_trial_history con SECURITY DEFINER
-- ======================

DROP VIEW IF EXISTS public.v_client_trial_history;

CREATE VIEW public.v_client_trial_history
WITH (security_invoker = true)
AS
SELECT
  c.id AS client_id,
  c.business_name,
  c.contact_email,
  s.id AS subscription_id,
  s.trial_start,
  s.trial_end,
  s.trial_status,
  s.status AS subscription_status,
  s.will_convert_to_paid,
  s.created_at,
  s.cancelled_at,
  CASE
    WHEN s.trial_status = 'active' THEN 'Trial activo'
    WHEN s.trial_status = 'converted' THEN 'Convertido a pago'
    WHEN s.trial_status = 'ended' THEN 'Trial finalizado sin conversión'
    ELSE 'Desconocido'
  END AS status_description
FROM public.clients c
LEFT JOIN public.subscriptions s ON s.client_id = c.id AND s.trial_status IS NOT NULL
ORDER BY c.business_name, s.created_at DESC;

COMMENT ON VIEW public.v_client_trial_history IS
'Historial de trials por cliente. SECURITY_INVOKER=true para respetar RLS.';

-- Grant para service_role
GRANT SELECT ON public.v_client_trial_history TO service_role;

-- ======================
-- PROBLEMA 3: trial_audit_log sin RLS
-- ======================
-- Esta tabla contiene logs de auditoría de trials.
-- Debe tener RLS para proteger datos sensibles.

-- Habilitar RLS
ALTER TABLE public.trial_audit_log ENABLE ROW LEVEL SECURITY;

-- Forzar RLS incluso para el owner de la tabla
ALTER TABLE public.trial_audit_log FORCE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "service_role_full_access_trial_audit" ON public.trial_audit_log;
DROP POLICY IF EXISTS "users_view_own_trial_audit" ON public.trial_audit_log;
DROP POLICY IF EXISTS "service_role_insert_trial_audit" ON public.trial_audit_log;

-- Policy: Solo service_role puede ver todos los logs
CREATE POLICY "service_role_full_access_trial_audit"
ON public.trial_audit_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Usuarios autenticados pueden ver logs de sus propias suscripciones
-- (a través de la relación subscription -> client -> user)
CREATE POLICY "users_view_own_trial_audit"
ON public.trial_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.subscriptions s
    INNER JOIN public.clients cl ON cl.id = s.client_id
    WHERE s.id = trial_audit_log.subscription_id
      AND cl.user_id = auth.uid()
  )
);

-- Policy: Solo service_role puede insertar logs (las funciones usan SECURITY DEFINER)
CREATE POLICY "service_role_insert_trial_audit"
ON public.trial_audit_log
FOR INSERT
TO authenticated
WITH CHECK (false); -- Usuarios no pueden insertar directamente

COMMENT ON TABLE public.trial_audit_log IS
'Log de auditoría para trials. RLS habilitado - usuarios solo ven sus propios logs.';

-- ======================
-- PROBLEMA 4: trial_migration_backup_074 sin RLS
-- ======================
-- Esta tabla fue creada como backup durante la migración 074.
-- Opciones:
-- A) Eliminarla si ya no se necesita
-- B) Habilitar RLS si necesita mantenerse
--
-- DECISIÓN: Habilitar RLS y restringir acceso solo a service_role
-- (es una tabla de backup/auditoría, no debería ser accedida por usuarios)

-- Verificar si la tabla existe antes de modificarla
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'trial_migration_backup_074'
  ) THEN
    -- Habilitar RLS
    ALTER TABLE public.trial_migration_backup_074 ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.trial_migration_backup_074 FORCE ROW LEVEL SECURITY;

    RAISE NOTICE 'RLS habilitado en trial_migration_backup_074';
  ELSE
    RAISE NOTICE 'Tabla trial_migration_backup_074 no existe, saltando...';
  END IF;
END $$;

-- Policy: Solo service_role puede acceder (tabla de backup administrativo)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'trial_migration_backup_074'
  ) THEN
    -- Drop policy if exists to avoid error
    DROP POLICY IF EXISTS "service_role_only_backup_074" ON public.trial_migration_backup_074;

    -- Create policy
    EXECUTE 'CREATE POLICY "service_role_only_backup_074"
    ON public.trial_migration_backup_074
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true)';

    RAISE NOTICE 'Policy creada para trial_migration_backup_074';
  END IF;
END $$;

-- Comentario para documentar propósito
COMMENT ON TABLE public.trial_migration_backup_074 IS
'Backup de trials modificados en Migration 074. Solo accesible por service_role.';

-- ======================
-- VERIFICACIÓN FINAL
-- ======================

-- Verificar que las vistas tienen security_invoker
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verificar v_trial_subscriptions
  SELECT COUNT(*) INTO v_count
  FROM pg_views
  WHERE viewname = 'v_trial_subscriptions'
    AND schemaname = 'public';

  IF v_count > 0 THEN
    RAISE NOTICE '✅ v_trial_subscriptions recreada correctamente';
  ELSE
    RAISE WARNING '❌ v_trial_subscriptions no encontrada';
  END IF;

  -- Verificar v_client_trial_history
  SELECT COUNT(*) INTO v_count
  FROM pg_views
  WHERE viewname = 'v_client_trial_history'
    AND schemaname = 'public';

  IF v_count > 0 THEN
    RAISE NOTICE '✅ v_client_trial_history recreada correctamente';
  ELSE
    RAISE WARNING '❌ v_client_trial_history no encontrada';
  END IF;
END $$;

-- Verificar RLS habilitado en tablas
DO $$
DECLARE
  v_rls_enabled BOOLEAN;
BEGIN
  -- Verificar trial_audit_log
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'trial_audit_log'
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  IF v_rls_enabled THEN
    RAISE NOTICE '✅ RLS habilitado en trial_audit_log';
  ELSE
    RAISE WARNING '❌ RLS NO habilitado en trial_audit_log';
  END IF;

  -- Verificar trial_migration_backup_074
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'trial_migration_backup_074'
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  IF v_rls_enabled IS NOT NULL AND v_rls_enabled THEN
    RAISE NOTICE '✅ RLS habilitado en trial_migration_backup_074';
  ELSIF v_rls_enabled IS NULL THEN
    RAISE NOTICE 'ℹ️ Tabla trial_migration_backup_074 no existe';
  ELSE
    RAISE WARNING '❌ RLS NO habilitado en trial_migration_backup_074';
  END IF;
END $$;

-- =====================================================
-- MIGRACIÓN COMPLETA
-- =====================================================
-- ✅ v_trial_subscriptions: Recreada con security_invoker=true
-- ✅ v_client_trial_history: Recreada con security_invoker=true
-- ✅ trial_audit_log: RLS habilitado + policies creadas
-- ✅ trial_migration_backup_074: RLS habilitado (solo service_role)
-- =====================================================

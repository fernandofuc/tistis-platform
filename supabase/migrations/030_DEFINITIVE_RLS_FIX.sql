-- =====================================================
-- Migration 030: DEFINITIVE RLS FIX
-- =====================================================
-- PROBLEMA: Las políticas RLS usan JWT user_metadata.tenant_id
-- pero ese campo NO ESTÁ SETEADO para muchos usuarios.
--
-- SOLUCIÓN: Crear función helper que SIEMPRE funcione usando
-- SECURITY DEFINER para leer user_roles sin depender de RLS.
-- =====================================================

-- =====================================================
-- PASO 1: Crear función robusta para obtener tenant_id
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
BEGIN
  -- Obtener el user_id actual
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Método 1: Intentar obtener de JWT (más rápido si existe)
  BEGIN
    v_tenant_id := (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid;
    IF v_tenant_id IS NOT NULL THEN
      RETURN v_tenant_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Método 2: Obtener de user_roles (siempre funciona porque somos SECURITY DEFINER)
  SELECT ur.tenant_id INTO v_tenant_id
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id
    AND ur.is_active = true
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    RETURN v_tenant_id;
  END IF;

  -- Método 3: Obtener de clients (para usuarios que son clientes)
  SELECT c.tenant_id INTO v_tenant_id
  FROM public.clients c
  WHERE c.user_id = v_user_id
  LIMIT 1;

  RETURN v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO service_role;

-- =====================================================
-- PASO 2: Fix USER_ROLES RLS
-- =====================================================
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "user_roles_select_self" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_roles_service_all" ON public.user_roles
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "user_roles_manage_tenant" ON public.user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.tenant_id = user_roles.tenant_id
            AND ur.role IN ('owner', 'admin')
            AND ur.is_active = true
        )
    );

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 3: Fix STAFF RLS
-- =====================================================
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'staff' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "staff_select" ON public.staff
    FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "staff_insert" ON public.staff
    FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "staff_update" ON public.staff
    FOR UPDATE USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "staff_delete" ON public.staff
    FOR DELETE USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "staff_service" ON public.staff
    FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 4: Fix PATIENTS RLS
-- =====================================================
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'patients' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.patients', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "patients_select" ON public.patients
    FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "patients_insert" ON public.patients
    FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "patients_update" ON public.patients
    FOR UPDATE USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "patients_delete" ON public.patients
    FOR DELETE USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "patients_service" ON public.patients
    FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 5: Fix SERVICES RLS
-- =====================================================
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'services' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.services', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "services_select" ON public.services
    FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "services_insert" ON public.services
    FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "services_update" ON public.services
    FOR UPDATE USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "services_delete" ON public.services
    FOR DELETE USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "services_service" ON public.services
    FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 6: Fix STAFF_BRANCHES RLS
-- =====================================================
ALTER TABLE public.staff_branches DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'staff_branches' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff_branches', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "staff_branches_select" ON public.staff_branches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id = public.get_user_tenant_id()
        )
    );

CREATE POLICY "staff_branches_insert" ON public.staff_branches
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id = public.get_user_tenant_id()
        )
    );

CREATE POLICY "staff_branches_update" ON public.staff_branches
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id = public.get_user_tenant_id()
        )
    );

CREATE POLICY "staff_branches_delete" ON public.staff_branches
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id = public.get_user_tenant_id()
        )
    );

CREATE POLICY "staff_branches_service" ON public.staff_branches
    FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.staff_branches ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 7: Fix LEADS RLS (if table exists)
-- =====================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads' AND table_schema = 'public') THEN
        ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;

        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'leads' AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.leads', pol.policyname);
        END LOOP;

        EXECUTE 'CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "leads_delete" ON public.leads FOR DELETE USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "leads_service" ON public.leads FOR ALL USING (auth.role() = ''service_role'')';

        ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- PASO 8: Fix APPOINTMENTS RLS (if table exists)
-- =====================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments' AND table_schema = 'public') THEN
        ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;

        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'appointments' AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.appointments', pol.policyname);
        END LOOP;

        EXECUTE 'CREATE POLICY "appointments_select" ON public.appointments FOR SELECT USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "appointments_insert" ON public.appointments FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "appointments_delete" ON public.appointments FOR DELETE USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "appointments_service" ON public.appointments FOR ALL USING (auth.role() = ''service_role'')';

        ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- PASO 9: Fix CLINICAL_HISTORY RLS (if table exists)
-- =====================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinical_history' AND table_schema = 'public') THEN
        ALTER TABLE public.clinical_history DISABLE ROW LEVEL SECURITY;

        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'clinical_history' AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.clinical_history', pol.policyname);
        END LOOP;

        EXECUTE 'CREATE POLICY "clinical_history_select" ON public.clinical_history FOR SELECT USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "clinical_history_insert" ON public.clinical_history FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "clinical_history_update" ON public.clinical_history FOR UPDATE USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "clinical_history_service" ON public.clinical_history FOR ALL USING (auth.role() = ''service_role'')';

        ALTER TABLE public.clinical_history ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- PASO 10: Fix PATIENT_FILES RLS (if table exists)
-- =====================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_files' AND table_schema = 'public') THEN
        ALTER TABLE public.patient_files DISABLE ROW LEVEL SECURITY;

        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'patient_files' AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.patient_files', pol.policyname);
        END LOOP;

        EXECUTE 'CREATE POLICY "patient_files_select" ON public.patient_files FOR SELECT USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "patient_files_insert" ON public.patient_files FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "patient_files_update" ON public.patient_files FOR UPDATE USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "patient_files_service" ON public.patient_files FOR ALL USING (auth.role() = ''service_role'')';

        ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- PASO 11: Fix BRANCHES RLS (if table exists)
-- =====================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'branches' AND table_schema = 'public') THEN
        ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;

        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'branches' AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.branches', pol.policyname);
        END LOOP;

        EXECUTE 'CREATE POLICY "branches_select" ON public.branches FOR SELECT USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "branches_insert" ON public.branches FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "branches_update" ON public.branches FOR UPDATE USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "branches_delete" ON public.branches FOR DELETE USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "branches_service" ON public.branches FOR ALL USING (auth.role() = ''service_role'')';

        ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- PASO 12: Fix CONVERSATIONS RLS (if table exists)
-- =====================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations' AND table_schema = 'public') THEN
        ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;

        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'conversations' AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversations', pol.policyname);
        END LOOP;

        EXECUTE 'CREATE POLICY "conversations_select" ON public.conversations FOR SELECT USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "conversations_service" ON public.conversations FOR ALL USING (auth.role() = ''service_role'')';

        ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- PASO 13: Fix MESSAGES RLS (if table exists)
-- =====================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
        ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'messages' AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname);
        END LOOP;

        EXECUTE 'CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "messages_service" ON public.messages FOR ALL USING (auth.role() = ''service_role'')';

        ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- PASO 14: Fix QUOTES RLS (if table exists)
-- =====================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotes' AND table_schema = 'public') THEN
        ALTER TABLE public.quotes DISABLE ROW LEVEL SECURITY;

        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'quotes' AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.quotes', pol.policyname);
        END LOOP;

        EXECUTE 'CREATE POLICY "quotes_select" ON public.quotes FOR SELECT USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "quotes_insert" ON public.quotes FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "quotes_update" ON public.quotes FOR UPDATE USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "quotes_delete" ON public.quotes FOR DELETE USING (tenant_id = public.get_user_tenant_id())';
        EXECUTE 'CREATE POLICY "quotes_service" ON public.quotes FOR ALL USING (auth.role() = ''service_role'')';

        ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- PASO 15: Fix QUOTE_ITEMS RLS (if table exists)
-- =====================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_items' AND table_schema = 'public') THEN
        ALTER TABLE public.quote_items DISABLE ROW LEVEL SECURITY;

        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'quote_items' AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.quote_items', pol.policyname);
        END LOOP;

        EXECUTE 'CREATE POLICY "quote_items_select" ON public.quote_items FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.tenant_id = public.get_user_tenant_id())
        )';
        EXECUTE 'CREATE POLICY "quote_items_insert" ON public.quote_items FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.tenant_id = public.get_user_tenant_id())
        )';
        EXECUTE 'CREATE POLICY "quote_items_update" ON public.quote_items FOR UPDATE USING (
            EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.tenant_id = public.get_user_tenant_id())
        )';
        EXECUTE 'CREATE POLICY "quote_items_delete" ON public.quote_items FOR DELETE USING (
            EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.tenant_id = public.get_user_tenant_id())
        )';
        EXECUTE 'CREATE POLICY "quote_items_service" ON public.quote_items FOR ALL USING (auth.role() = ''service_role'')';

        ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================
-- Para verificar que todo está correcto, ejecuta:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- =====================================================
-- NOTAS IMPORTANTES:
-- 1. La función get_user_tenant_id() es SECURITY DEFINER,
--    esto permite que lea user_roles sin depender de RLS
-- 2. Todos los policies ahora usan esta función en lugar del JWT directo
-- 3. Service role siempre puede hacer todo (para APIs del backend)
-- 4. Esta migración REEMPLAZA los policies de las migraciones 028 y 029
-- =====================================================

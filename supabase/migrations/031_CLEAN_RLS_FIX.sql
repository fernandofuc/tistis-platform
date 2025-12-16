-- =====================================================
-- Migration 031: CLEAN RLS FIX
-- =====================================================
-- Primero limpia funciones anteriores, luego aplica fix
-- =====================================================

-- PASO 0: Eliminar funciones anteriores que puedan causar conflicto
DROP FUNCTION IF EXISTS public.get_user_tenant_id();
DROP FUNCTION IF EXISTS public.get_current_tenant_id();

-- =====================================================
-- PASO 1: Crear función única para obtener tenant_id
-- =====================================================
CREATE FUNCTION public.get_my_tenant_id()
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
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Método 1: JWT (rápido si existe)
  BEGIN
    v_tenant_id := (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid;
    IF v_tenant_id IS NOT NULL THEN
      RETURN v_tenant_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Método 2: user_roles
  SELECT ur.tenant_id INTO v_tenant_id
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id AND ur.is_active = true
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    RETURN v_tenant_id;
  END IF;

  -- Método 3: clients
  SELECT c.tenant_id INTO v_tenant_id
  FROM public.clients c
  WHERE c.user_id = v_user_id
  LIMIT 1;

  RETURN v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO service_role;

-- =====================================================
-- PASO 2: USER_ROLES
-- =====================================================
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "ur_self" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ur_service" ON public.user_roles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "ur_admin" ON public.user_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = auth.uid() AND x.tenant_id = user_roles.tenant_id AND x.role IN ('owner','admin') AND x.is_active)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 3: STAFF
-- =====================================================
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'staff' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "staff_tenant" ON public.staff FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "staff_svc" ON public.staff FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 4: PATIENTS
-- =====================================================
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'patients' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.patients', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "patients_tenant" ON public.patients FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "patients_svc" ON public.patients FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 5: SERVICES
-- =====================================================
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'services' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.services', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "services_tenant" ON public.services FOR ALL USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY "services_svc" ON public.services FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 6: STAFF_BRANCHES
-- =====================================================
ALTER TABLE public.staff_branches DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'staff_branches' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff_branches', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "sb_tenant" ON public.staff_branches FOR ALL USING (
  EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_branches.staff_id AND s.tenant_id = public.get_my_tenant_id())
);
CREATE POLICY "sb_svc" ON public.staff_branches FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.staff_branches ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 7: LEADS
-- =====================================================
DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads' AND table_schema = 'public') THEN
    ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'leads' AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.leads', pol.policyname);
    END LOOP;
    EXECUTE 'CREATE POLICY "leads_tenant" ON public.leads FOR ALL USING (tenant_id = public.get_my_tenant_id())';
    EXECUTE 'CREATE POLICY "leads_svc" ON public.leads FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- PASO 8: APPOINTMENTS
-- =====================================================
DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments' AND table_schema = 'public') THEN
    ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'appointments' AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.appointments', pol.policyname);
    END LOOP;
    EXECUTE 'CREATE POLICY "appt_tenant" ON public.appointments FOR ALL USING (tenant_id = public.get_my_tenant_id())';
    EXECUTE 'CREATE POLICY "appt_svc" ON public.appointments FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- PASO 9: BRANCHES
-- =====================================================
DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'branches' AND table_schema = 'public') THEN
    ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'branches' AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.branches', pol.policyname);
    END LOOP;
    EXECUTE 'CREATE POLICY "branches_tenant" ON public.branches FOR ALL USING (tenant_id = public.get_my_tenant_id())';
    EXECUTE 'CREATE POLICY "branches_svc" ON public.branches FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- PASO 10: CLINICAL_HISTORY
-- =====================================================
DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinical_history' AND table_schema = 'public') THEN
    ALTER TABLE public.clinical_history DISABLE ROW LEVEL SECURITY;
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'clinical_history' AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.clinical_history', pol.policyname);
    END LOOP;
    EXECUTE 'CREATE POLICY "ch_tenant" ON public.clinical_history FOR ALL USING (tenant_id = public.get_my_tenant_id())';
    EXECUTE 'CREATE POLICY "ch_svc" ON public.clinical_history FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.clinical_history ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- PASO 11: PATIENT_FILES
-- =====================================================
DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_files' AND table_schema = 'public') THEN
    ALTER TABLE public.patient_files DISABLE ROW LEVEL SECURITY;
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'patient_files' AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.patient_files', pol.policyname);
    END LOOP;
    EXECUTE 'CREATE POLICY "pf_tenant" ON public.patient_files FOR ALL USING (tenant_id = public.get_my_tenant_id())';
    EXECUTE 'CREATE POLICY "pf_svc" ON public.patient_files FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- PASO 12: CONVERSATIONS
-- =====================================================
DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations' AND table_schema = 'public') THEN
    ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'conversations' AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversations', pol.policyname);
    END LOOP;
    EXECUTE 'CREATE POLICY "conv_tenant" ON public.conversations FOR ALL USING (tenant_id = public.get_my_tenant_id())';
    EXECUTE 'CREATE POLICY "conv_svc" ON public.conversations FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- PASO 13: MESSAGES
-- =====================================================
DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
    ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'messages' AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname);
    END LOOP;
    EXECUTE 'CREATE POLICY "msg_tenant" ON public.messages FOR ALL USING (tenant_id = public.get_my_tenant_id())';
    EXECUTE 'CREATE POLICY "msg_svc" ON public.messages FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- PASO 14: QUOTES
-- =====================================================
DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotes' AND table_schema = 'public') THEN
    ALTER TABLE public.quotes DISABLE ROW LEVEL SECURITY;
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'quotes' AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.quotes', pol.policyname);
    END LOOP;
    EXECUTE 'CREATE POLICY "quotes_tenant" ON public.quotes FOR ALL USING (tenant_id = public.get_my_tenant_id())';
    EXECUTE 'CREATE POLICY "quotes_svc" ON public.quotes FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- PASO 15: QUOTE_ITEMS
-- =====================================================
DO $$
DECLARE pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_items' AND table_schema = 'public') THEN
    ALTER TABLE public.quote_items DISABLE ROW LEVEL SECURITY;
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'quote_items' AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.quote_items', pol.policyname);
    END LOOP;
    EXECUTE 'CREATE POLICY "qi_tenant" ON public.quote_items FOR ALL USING (
      EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.tenant_id = public.get_my_tenant_id())
    )';
    EXECUTE 'CREATE POLICY "qi_svc" ON public.quote_items FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- LISTO - Ejecuta esto en Supabase SQL Editor
-- =====================================================

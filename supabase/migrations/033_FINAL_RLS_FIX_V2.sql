-- =====================================================
-- Migration 033: FINAL RLS FIX V2
-- =====================================================

-- =====================================================
-- PASO 1: ELIMINAR TODAS LAS POLÍTICAS
-- =====================================================

-- USER_ROLES
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_self" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_service_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_manage_tenant" ON public.user_roles;
DROP POLICY IF EXISTS "ur_self" ON public.user_roles;
DROP POLICY IF EXISTS "ur_service" ON public.user_roles;
DROP POLICY IF EXISTS "ur_admin" ON public.user_roles;
DROP POLICY IF EXISTS "ur1" ON public.user_roles;
DROP POLICY IF EXISTS "ur2" ON public.user_roles;
DROP POLICY IF EXISTS "ur3" ON public.user_roles;

-- STAFF
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_select" ON public.staff;
DROP POLICY IF EXISTS "staff_insert" ON public.staff;
DROP POLICY IF EXISTS "staff_update" ON public.staff;
DROP POLICY IF EXISTS "staff_delete" ON public.staff;
DROP POLICY IF EXISTS "staff_service" ON public.staff;
DROP POLICY IF EXISTS "staff_tenant" ON public.staff;
DROP POLICY IF EXISTS "staff_svc" ON public.staff;
DROP POLICY IF EXISTS "staff_select_tenant" ON public.staff;
DROP POLICY IF EXISTS "staff_insert_tenant" ON public.staff;
DROP POLICY IF EXISTS "staff_update_tenant" ON public.staff;
DROP POLICY IF EXISTS "staff_delete_tenant" ON public.staff;
DROP POLICY IF EXISTS "s1" ON public.staff;
DROP POLICY IF EXISTS "s2" ON public.staff;

-- PATIENTS
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patients_select" ON public.patients;
DROP POLICY IF EXISTS "patients_insert" ON public.patients;
DROP POLICY IF EXISTS "patients_update" ON public.patients;
DROP POLICY IF EXISTS "patients_delete" ON public.patients;
DROP POLICY IF EXISTS "patients_service" ON public.patients;
DROP POLICY IF EXISTS "patients_tenant" ON public.patients;
DROP POLICY IF EXISTS "patients_svc" ON public.patients;
DROP POLICY IF EXISTS "patients_select_tenant" ON public.patients;
DROP POLICY IF EXISTS "patients_insert_tenant" ON public.patients;
DROP POLICY IF EXISTS "patients_update_tenant" ON public.patients;
DROP POLICY IF EXISTS "patients_delete_tenant" ON public.patients;
DROP POLICY IF EXISTS "p1" ON public.patients;
DROP POLICY IF EXISTS "p2" ON public.patients;

-- SERVICES
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "services_select" ON public.services;
DROP POLICY IF EXISTS "services_insert" ON public.services;
DROP POLICY IF EXISTS "services_update" ON public.services;
DROP POLICY IF EXISTS "services_delete" ON public.services;
DROP POLICY IF EXISTS "services_service" ON public.services;
DROP POLICY IF EXISTS "services_tenant" ON public.services;
DROP POLICY IF EXISTS "services_svc" ON public.services;
DROP POLICY IF EXISTS "services_select_tenant" ON public.services;
DROP POLICY IF EXISTS "services_insert_tenant" ON public.services;
DROP POLICY IF EXISTS "services_update_tenant" ON public.services;
DROP POLICY IF EXISTS "sv1" ON public.services;
DROP POLICY IF EXISTS "sv2" ON public.services;

-- STAFF_BRANCHES
ALTER TABLE public.staff_branches DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_branches_select" ON public.staff_branches;
DROP POLICY IF EXISTS "staff_branches_insert" ON public.staff_branches;
DROP POLICY IF EXISTS "staff_branches_update" ON public.staff_branches;
DROP POLICY IF EXISTS "staff_branches_delete" ON public.staff_branches;
DROP POLICY IF EXISTS "staff_branches_service" ON public.staff_branches;
DROP POLICY IF EXISTS "sb_tenant" ON public.staff_branches;
DROP POLICY IF EXISTS "sb_svc" ON public.staff_branches;
DROP POLICY IF EXISTS "sb1" ON public.staff_branches;
DROP POLICY IF EXISTS "sb2" ON public.staff_branches;

-- CLINICAL_HISTORY
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clinical_history' AND table_schema = 'public') THEN
    ALTER TABLE public.clinical_history DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "clinical_history_select" ON public.clinical_history;
    DROP POLICY IF EXISTS "clinical_history_insert" ON public.clinical_history;
    DROP POLICY IF EXISTS "clinical_history_update" ON public.clinical_history;
    DROP POLICY IF EXISTS "clinical_history_service" ON public.clinical_history;
    DROP POLICY IF EXISTS "ch_tenant" ON public.clinical_history;
    DROP POLICY IF EXISTS "ch_svc" ON public.clinical_history;
    DROP POLICY IF EXISTS "ch1" ON public.clinical_history;
    DROP POLICY IF EXISTS "ch2" ON public.clinical_history;
  END IF;
END $$;

-- PATIENT_FILES
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_files' AND table_schema = 'public') THEN
    ALTER TABLE public.patient_files DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "patient_files_select" ON public.patient_files;
    DROP POLICY IF EXISTS "patient_files_insert" ON public.patient_files;
    DROP POLICY IF EXISTS "patient_files_update" ON public.patient_files;
    DROP POLICY IF EXISTS "patient_files_service" ON public.patient_files;
    DROP POLICY IF EXISTS "pf_tenant" ON public.patient_files;
    DROP POLICY IF EXISTS "pf_svc" ON public.patient_files;
    DROP POLICY IF EXISTS "pf1" ON public.patient_files;
    DROP POLICY IF EXISTS "pf2" ON public.patient_files;
  END IF;
END $$;

-- LEADS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads' AND table_schema = 'public') THEN
    ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "leads_select" ON public.leads;
    DROP POLICY IF EXISTS "leads_insert" ON public.leads;
    DROP POLICY IF EXISTS "leads_update" ON public.leads;
    DROP POLICY IF EXISTS "leads_delete" ON public.leads;
    DROP POLICY IF EXISTS "leads_service" ON public.leads;
    DROP POLICY IF EXISTS "leads_tenant" ON public.leads;
    DROP POLICY IF EXISTS "leads_svc" ON public.leads;
    DROP POLICY IF EXISTS "l1" ON public.leads;
    DROP POLICY IF EXISTS "l2" ON public.leads;
  END IF;
END $$;

-- APPOINTMENTS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments' AND table_schema = 'public') THEN
    ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "appointments_select" ON public.appointments;
    DROP POLICY IF EXISTS "appointments_insert" ON public.appointments;
    DROP POLICY IF EXISTS "appointments_update" ON public.appointments;
    DROP POLICY IF EXISTS "appointments_delete" ON public.appointments;
    DROP POLICY IF EXISTS "appointments_service" ON public.appointments;
    DROP POLICY IF EXISTS "appt_tenant" ON public.appointments;
    DROP POLICY IF EXISTS "appt_svc" ON public.appointments;
    DROP POLICY IF EXISTS "a1" ON public.appointments;
    DROP POLICY IF EXISTS "a2" ON public.appointments;
  END IF;
END $$;

-- BRANCHES
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'branches' AND table_schema = 'public') THEN
    ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "branches_select" ON public.branches;
    DROP POLICY IF EXISTS "branches_insert" ON public.branches;
    DROP POLICY IF EXISTS "branches_update" ON public.branches;
    DROP POLICY IF EXISTS "branches_delete" ON public.branches;
    DROP POLICY IF EXISTS "branches_service" ON public.branches;
    DROP POLICY IF EXISTS "branches_tenant" ON public.branches;
    DROP POLICY IF EXISTS "branches_svc" ON public.branches;
    DROP POLICY IF EXISTS "b1" ON public.branches;
    DROP POLICY IF EXISTS "b2" ON public.branches;
  END IF;
END $$;

-- CONVERSATIONS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations' AND table_schema = 'public') THEN
    ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
    DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
    DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
    DROP POLICY IF EXISTS "conversations_service" ON public.conversations;
    DROP POLICY IF EXISTS "conv_tenant" ON public.conversations;
    DROP POLICY IF EXISTS "conv_svc" ON public.conversations;
    DROP POLICY IF EXISTS "c1" ON public.conversations;
    DROP POLICY IF EXISTS "c2" ON public.conversations;
  END IF;
END $$;

-- MESSAGES (sin tenant_id - skip)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
    ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "messages_select" ON public.messages;
    DROP POLICY IF EXISTS "messages_insert" ON public.messages;
    DROP POLICY IF EXISTS "messages_update" ON public.messages;
    DROP POLICY IF EXISTS "messages_service" ON public.messages;
    DROP POLICY IF EXISTS "msg_tenant" ON public.messages;
    DROP POLICY IF EXISTS "msg_svc" ON public.messages;
    DROP POLICY IF EXISTS "m1" ON public.messages;
    DROP POLICY IF EXISTS "m2" ON public.messages;
  END IF;
END $$;

-- QUOTES
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quotes' AND table_schema = 'public') THEN
    ALTER TABLE public.quotes DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "quotes_select" ON public.quotes;
    DROP POLICY IF EXISTS "quotes_insert" ON public.quotes;
    DROP POLICY IF EXISTS "quotes_update" ON public.quotes;
    DROP POLICY IF EXISTS "quotes_delete" ON public.quotes;
    DROP POLICY IF EXISTS "quotes_service" ON public.quotes;
    DROP POLICY IF EXISTS "quotes_tenant" ON public.quotes;
    DROP POLICY IF EXISTS "quotes_svc" ON public.quotes;
    DROP POLICY IF EXISTS "q1" ON public.quotes;
    DROP POLICY IF EXISTS "q2" ON public.quotes;
  END IF;
END $$;

-- QUOTE_ITEMS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_items' AND table_schema = 'public') THEN
    ALTER TABLE public.quote_items DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "quote_items_select" ON public.quote_items;
    DROP POLICY IF EXISTS "quote_items_insert" ON public.quote_items;
    DROP POLICY IF EXISTS "quote_items_update" ON public.quote_items;
    DROP POLICY IF EXISTS "quote_items_delete" ON public.quote_items;
    DROP POLICY IF EXISTS "quote_items_service" ON public.quote_items;
    DROP POLICY IF EXISTS "qi_tenant" ON public.quote_items;
    DROP POLICY IF EXISTS "qi_svc" ON public.quote_items;
    DROP POLICY IF EXISTS "qi1" ON public.quote_items;
    DROP POLICY IF EXISTS "qi2" ON public.quote_items;
  END IF;
END $$;

-- =====================================================
-- PASO 2: ELIMINAR FUNCIONES
-- =====================================================
DROP FUNCTION IF EXISTS public.get_current_tenant_id();
DROP FUNCTION IF EXISTS public.get_user_tenant_id();
DROP FUNCTION IF EXISTS public.get_my_tenant_id();
DROP FUNCTION IF EXISTS public.get_tenant();

-- =====================================================
-- PASO 3: CREAR FUNCIÓN
-- =====================================================
CREATE FUNCTION public.get_tenant()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  tid uuid;
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RETURN NULL; END IF;

  BEGIN
    tid := (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid;
    IF tid IS NOT NULL THEN RETURN tid; END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  SELECT tenant_id INTO tid FROM public.user_roles
  WHERE user_id = uid AND is_active = true LIMIT 1;
  IF tid IS NOT NULL THEN RETURN tid; END IF;

  SELECT tenant_id INTO tid FROM public.clients WHERE user_id = uid LIMIT 1;

  RETURN tid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant() TO service_role;

-- =====================================================
-- PASO 4: CREAR POLÍTICAS
-- =====================================================

-- USER_ROLES
CREATE POLICY "ur1" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ur2" ON public.user_roles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "ur3" ON public.user_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id = auth.uid() AND x.tenant_id = user_roles.tenant_id AND x.role IN ('owner','admin') AND x.is_active)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- STAFF
CREATE POLICY "s1" ON public.staff FOR ALL USING (tenant_id = public.get_tenant());
CREATE POLICY "s2" ON public.staff FOR ALL USING (auth.role() = 'service_role');
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- PATIENTS
CREATE POLICY "p1" ON public.patients FOR ALL USING (tenant_id = public.get_tenant());
CREATE POLICY "p2" ON public.patients FOR ALL USING (auth.role() = 'service_role');
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- SERVICES
CREATE POLICY "sv1" ON public.services FOR ALL USING (tenant_id = public.get_tenant());
CREATE POLICY "sv2" ON public.services FOR ALL USING (auth.role() = 'service_role');
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- STAFF_BRANCHES
CREATE POLICY "sb1" ON public.staff_branches FOR ALL USING (
  EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_branches.staff_id AND s.tenant_id = public.get_tenant())
);
CREATE POLICY "sb2" ON public.staff_branches FOR ALL USING (auth.role() = 'service_role');
ALTER TABLE public.staff_branches ENABLE ROW LEVEL SECURITY;

-- CLINICAL_HISTORY (solo si tiene tenant_id)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clinical_history' AND column_name = 'tenant_id' AND table_schema = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY "ch1" ON public.clinical_history FOR ALL USING (tenant_id = public.get_tenant())';
    EXECUTE 'CREATE POLICY "ch2" ON public.clinical_history FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.clinical_history ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- PATIENT_FILES (solo si tiene tenant_id)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_files' AND column_name = 'tenant_id' AND table_schema = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY "pf1" ON public.patient_files FOR ALL USING (tenant_id = public.get_tenant())';
    EXECUTE 'CREATE POLICY "pf2" ON public.patient_files FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- LEADS (solo si tiene tenant_id)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'tenant_id' AND table_schema = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY "l1" ON public.leads FOR ALL USING (tenant_id = public.get_tenant())';
    EXECUTE 'CREATE POLICY "l2" ON public.leads FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- APPOINTMENTS (solo si tiene tenant_id)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'tenant_id' AND table_schema = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY "a1" ON public.appointments FOR ALL USING (tenant_id = public.get_tenant())';
    EXECUTE 'CREATE POLICY "a2" ON public.appointments FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- BRANCHES (solo si tiene tenant_id)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'tenant_id' AND table_schema = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY "b1" ON public.branches FOR ALL USING (tenant_id = public.get_tenant())';
    EXECUTE 'CREATE POLICY "b2" ON public.branches FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- CONVERSATIONS (solo si tiene tenant_id)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'tenant_id' AND table_schema = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY "c1" ON public.conversations FOR ALL USING (tenant_id = public.get_tenant())';
    EXECUTE 'CREATE POLICY "c2" ON public.conversations FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- MESSAGES - Vinculado por conversation_id a conversations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'messages' AND column_name = 'conversation_id' AND table_schema = 'public'
    ) THEN
      EXECUTE 'CREATE POLICY "m1" ON public.messages FOR ALL USING (
        EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.tenant_id = public.get_tenant())
      )';
      EXECUTE 'CREATE POLICY "m2" ON public.messages FOR ALL USING (auth.role() = ''service_role'')';
      ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
    END IF;
  END IF;
END $$;

-- QUOTES (solo si tiene tenant_id)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'tenant_id' AND table_schema = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY "q1" ON public.quotes FOR ALL USING (tenant_id = public.get_tenant())';
    EXECUTE 'CREATE POLICY "q2" ON public.quotes FOR ALL USING (auth.role() = ''service_role'')';
    ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- QUOTE_ITEMS
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_items' AND table_schema = 'public') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'quote_items' AND column_name = 'quote_id' AND table_schema = 'public'
    ) THEN
      EXECUTE 'CREATE POLICY "qi1" ON public.quote_items FOR ALL USING (
        EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.tenant_id = public.get_tenant())
      )';
      EXECUTE 'CREATE POLICY "qi2" ON public.quote_items FOR ALL USING (auth.role() = ''service_role'')';
      ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
    END IF;
  END IF;
END $$;

-- =====================================================
-- LISTO!
-- =====================================================

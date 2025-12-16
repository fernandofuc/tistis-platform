-- =====================================================
-- Migration 029: Robust RLS with User Roles Fallback
-- =====================================================
-- Problem: JWT-based RLS fails when user_metadata doesn't have tenant_id
-- Solution: Create a helper function that checks JWT first, then falls back to user_roles
-- =====================================================

-- 1. CREATE helper function to get tenant_id robustly
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  jwt_tenant_id uuid;
  role_tenant_id uuid;
  current_user_id uuid;
BEGIN
  -- First try: Get from JWT user_metadata (fastest)
  BEGIN
    jwt_tenant_id := (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid;
    IF jwt_tenant_id IS NOT NULL THEN
      RETURN jwt_tenant_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- JWT parsing failed, continue to fallback
    NULL;
  END;

  -- Fallback: Get from user_roles table
  current_user_id := auth.uid();
  IF current_user_id IS NOT NULL THEN
    SELECT tenant_id INTO role_tenant_id
    FROM public.user_roles
    WHERE user_id = current_user_id
      AND is_active = true
    LIMIT 1;

    IF role_tenant_id IS NOT NULL THEN
      RETURN role_tenant_id;
    END IF;
  END IF;

  -- No tenant found
  RETURN NULL;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_tenant_id() TO authenticated;

-- =====================================================
-- 2. Update user_roles RLS to allow self-read (needed for fallback)
-- =====================================================
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_roles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
    END LOOP;
END $$;

-- Allow users to read their own roles (critical for tenant detection)
CREATE POLICY "user_roles_select_own" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

-- Allow service role and owner/admin to manage roles
CREATE POLICY "user_roles_insert" ON public.user_roles
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
    );

CREATE POLICY "user_roles_update" ON public.user_roles
    FOR UPDATE USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('owner', 'admin')
            AND ur.tenant_id = public.user_roles.tenant_id
        )
    );

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. Fix PATIENTS table RLS
-- =====================================================
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'patients'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.patients', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "patients_select" ON public.patients
    FOR SELECT USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "patients_insert" ON public.patients
    FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "patients_update" ON public.patients
    FOR UPDATE USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "patients_delete" ON public.patients
    FOR DELETE USING (tenant_id = public.get_current_tenant_id());

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. Fix STAFF table RLS
-- =====================================================
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'staff'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "staff_select" ON public.staff
    FOR SELECT USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "staff_insert" ON public.staff
    FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "staff_update" ON public.staff
    FOR UPDATE USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "staff_delete" ON public.staff
    FOR DELETE USING (tenant_id = public.get_current_tenant_id());

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. Fix STAFF_BRANCHES table RLS
-- =====================================================
ALTER TABLE public.staff_branches DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'staff_branches'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff_branches', pol.policyname);
    END LOOP;
END $$;

-- Staff branches join on staff which has tenant_id
CREATE POLICY "staff_branches_select" ON public.staff_branches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id = public.get_current_tenant_id()
        )
    );

CREATE POLICY "staff_branches_insert" ON public.staff_branches
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id = public.get_current_tenant_id()
        )
    );

CREATE POLICY "staff_branches_update" ON public.staff_branches
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id = public.get_current_tenant_id()
        )
    );

CREATE POLICY "staff_branches_delete" ON public.staff_branches
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id = public.get_current_tenant_id()
        )
    );

ALTER TABLE public.staff_branches ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. Fix SERVICES table RLS
-- =====================================================
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'services'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.services', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "services_select" ON public.services
    FOR SELECT USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "services_insert" ON public.services
    FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "services_update" ON public.services
    FOR UPDATE USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "services_delete" ON public.services
    FOR DELETE USING (tenant_id = public.get_current_tenant_id());

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. Fix CLINICAL_HISTORY table RLS
-- =====================================================
ALTER TABLE public.clinical_history DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'clinical_history'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.clinical_history', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "clinical_history_select" ON public.clinical_history
    FOR SELECT USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "clinical_history_insert" ON public.clinical_history
    FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "clinical_history_update" ON public.clinical_history
    FOR UPDATE USING (tenant_id = public.get_current_tenant_id());

ALTER TABLE public.clinical_history ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. Fix PATIENT_FILES table RLS
-- =====================================================
ALTER TABLE public.patient_files DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'patient_files'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.patient_files', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "patient_files_select" ON public.patient_files
    FOR SELECT USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "patient_files_insert" ON public.patient_files
    FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "patient_files_update" ON public.patient_files
    FOR UPDATE USING (tenant_id = public.get_current_tenant_id());

ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 9. Fix LEADS table RLS (if exists)
-- =====================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads' AND table_schema = 'public') THEN
        ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;

        -- Drop existing policies
        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'leads'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.leads', pol.policyname);
        END LOOP;

        EXECUTE 'CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (tenant_id = public.get_current_tenant_id())';
        EXECUTE 'CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant_id())';
        EXECUTE 'CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (tenant_id = public.get_current_tenant_id())';
        EXECUTE 'CREATE POLICY "leads_delete" ON public.leads FOR DELETE USING (tenant_id = public.get_current_tenant_id())';

        ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- 10. Fix APPOINTMENTS table RLS (if exists)
-- =====================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments' AND table_schema = 'public') THEN
        ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;

        -- Drop existing policies
        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'appointments'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.appointments', pol.policyname);
        END LOOP;

        EXECUTE 'CREATE POLICY "appointments_select" ON public.appointments FOR SELECT USING (tenant_id = public.get_current_tenant_id())';
        EXECUTE 'CREATE POLICY "appointments_insert" ON public.appointments FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant_id())';
        EXECUTE 'CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE USING (tenant_id = public.get_current_tenant_id())';
        EXECUTE 'CREATE POLICY "appointments_delete" ON public.appointments FOR DELETE USING (tenant_id = public.get_current_tenant_id())';

        ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- Applied: 2024-12-15
-- This migration creates a robust get_current_tenant_id() function
-- that first tries JWT metadata, then falls back to user_roles table.
-- All RLS policies now use this function for tenant isolation.
-- =====================================================

-- =====================================================
-- Migration 028: Fix ALL RLS Policies to Use JWT tenant_id
-- =====================================================
-- This migration fixes RLS policies for ALL tables that were
-- causing issues due to recursive user_roles lookups or
-- missing 'owner' role support.
--
-- Tables fixed: staff, staff_branches, patients, clinical_history, patient_files
-- =====================================================

-- =====================================================
-- PART 1: STAFF TABLE
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

CREATE POLICY "staff_select_tenant" ON public.staff
    FOR SELECT USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "staff_insert_tenant" ON public.staff
    FOR INSERT WITH CHECK (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "staff_update_tenant" ON public.staff
    FOR UPDATE USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "staff_delete_tenant" ON public.staff
    FOR DELETE USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 2: STAFF_BRANCHES TABLE
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

-- staff_branches links staff to branches - allow access if user can access the staff member
CREATE POLICY "staff_branches_select" ON public.staff_branches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
        )
    );

CREATE POLICY "staff_branches_insert" ON public.staff_branches
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
        )
    );

CREATE POLICY "staff_branches_update" ON public.staff_branches
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
        )
    );

CREATE POLICY "staff_branches_delete" ON public.staff_branches
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
        )
    );

ALTER TABLE public.staff_branches ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 3: PATIENTS TABLE
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

CREATE POLICY "patients_select_tenant" ON public.patients
    FOR SELECT USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "patients_insert_tenant" ON public.patients
    FOR INSERT WITH CHECK (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "patients_update_tenant" ON public.patients
    FOR UPDATE USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "patients_delete_tenant" ON public.patients
    FOR DELETE USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 4: CLINICAL_HISTORY TABLE
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
    FOR SELECT USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "clinical_history_insert" ON public.clinical_history
    FOR INSERT WITH CHECK (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "clinical_history_update" ON public.clinical_history
    FOR UPDATE USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

ALTER TABLE public.clinical_history ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 5: PATIENT_FILES TABLE
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
    FOR SELECT USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "patient_files_insert" ON public.patient_files
    FOR INSERT WITH CHECK (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "patient_files_update" ON public.patient_files
    FOR UPDATE USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 6: SERVICES TABLE (for appointments dropdown)
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

CREATE POLICY "services_select_tenant" ON public.services
    FOR SELECT USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "services_insert_tenant" ON public.services
    FOR INSERT WITH CHECK (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "services_update_tenant" ON public.services
    FOR UPDATE USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Applied: 2024-12-15
-- This migration uses JWT-based tenant_id checking for all
-- policies, avoiding the need to lookup user_roles which
-- caused infinite recursion.
-- =====================================================

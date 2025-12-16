-- =====================================================
-- Migration 027: Fix Patients RLS to Include Owner Role
-- =====================================================
-- Problem: The patients table RLS policies don't include the 'owner' role,
-- which is the role assigned to tenant owners during onboarding.
-- This causes "Error al crear el paciente" when owners try to create patients.
--
-- Solution: Drop and recreate RLS policies to include 'owner' role,
-- and use simpler JWT-based tenant_id check to avoid recursion.
-- =====================================================

-- 1. DISABLE RLS temporarily
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;

-- 2. DROP all existing policies on patients
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'patients'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.patients', pol.policyname);
    END LOOP;
END $$;

-- 3. CREATE simple, non-recursive policies using JWT tenant_id

-- Policy: Users can SELECT patients from their tenant
CREATE POLICY "patients_select_own_tenant" ON public.patients
    FOR SELECT
    USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

-- Policy: Users can INSERT patients into their tenant
CREATE POLICY "patients_insert_own_tenant" ON public.patients
    FOR INSERT
    WITH CHECK (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

-- Policy: Users can UPDATE patients in their tenant
CREATE POLICY "patients_update_own_tenant" ON public.patients
    FOR UPDATE
    USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

-- Policy: Users can DELETE patients from their tenant (optional, admins only could be stricter)
CREATE POLICY "patients_delete_own_tenant" ON public.patients
    FOR DELETE
    USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

-- 4. RE-ENABLE RLS
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Also fix clinical_history and patient_files policies
-- =====================================================

-- CLINICAL_HISTORY
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

-- PATIENT_FILES
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
-- Applied: 2024-12-15
-- This migration fixes the patients RLS policies to use
-- JWT-based tenant_id checking instead of user_roles lookup,
-- avoiding infinite recursion and including owner role access.
-- =====================================================

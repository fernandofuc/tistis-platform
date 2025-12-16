-- =====================================================
-- Migration 025: Fix RLS Infinite Recursion
-- =====================================================
-- Problem: Policies on user_roles, staff, and branches were causing
-- "infinite recursion detected in policy for relation user_roles" error.
-- The policies were referencing user_roles table which itself had policies
-- that referenced back, creating an infinite loop.
--
-- Solution: Replace all complex policies with simple ones that only use:
-- - auth.uid() for user identification
-- - auth.jwt() -> 'user_metadata' ->> 'tenant_id' for tenant isolation
-- These don't require subqueries to other RLS-protected tables.
-- =====================================================

-- 1. DESHABILITAR RLS en tablas afectadas temporalmente
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;

-- 2. ELIMINAR TODAS las políticas de user_roles
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_roles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
    END LOOP;
END $$;

-- 3. ELIMINAR políticas de staff que referencian user_roles
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'staff'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff', pol.policyname);
    END LOOP;
END $$;

-- 4. ELIMINAR políticas de branches que referencian user_roles
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'branches'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.branches', pol.policyname);
    END LOOP;
END $$;

-- 5. CREAR políticas SIMPLES sin recursión

-- user_roles: Solo basado en auth.uid() y JWT
CREATE POLICY "user_roles_select" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_roles_insert" ON public.user_roles
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- staff: Solo basado en tenant_id del JWT
CREATE POLICY "staff_select" ON public.staff
    FOR SELECT USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "staff_insert" ON public.staff
    FOR INSERT WITH CHECK (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

CREATE POLICY "staff_update" ON public.staff
    FOR UPDATE USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

-- branches: Solo basado en tenant_id del JWT
CREATE POLICY "branches_select" ON public.branches
    FOR SELECT USING (
        tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

-- 6. RE-HABILITAR RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Applied: 2024-12-15
-- This migration was applied manually via Supabase SQL Editor
-- to fix the infinite recursion error in RLS policies.
-- =====================================================

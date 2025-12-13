-- =====================================================
-- MIGRATION 018: Fix staff_branches RLS Policies
--
-- PROBLEMA: La tabla staff_branches tiene RLS habilitado pero
-- no tiene políticas definidas, causando que todas las operaciones
-- INSERT/DELETE fallen silenciosamente.
--
-- SOLUCION: Agregar políticas RLS para staff_branches
-- =====================================================

-- 1. Primero verificamos que RLS está habilitado
ALTER TABLE public.staff_branches ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (if any) to avoid conflicts
DROP POLICY IF EXISTS "Users can view staff_branches" ON public.staff_branches;
DROP POLICY IF EXISTS "Admins can manage staff_branches" ON public.staff_branches;
DROP POLICY IF EXISTS "Service role full access staff_branches" ON public.staff_branches;

-- 3. Create SELECT policy - Users can view staff_branches for their tenant
CREATE POLICY "Users can view staff_branches" ON public.staff_branches
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id IN (
                SELECT tenant_id FROM public.user_roles
                WHERE user_id = auth.uid()
            )
        )
    );

-- 4. Create INSERT policy - Admins can create staff_branches
CREATE POLICY "Admins can manage staff_branches INSERT" ON public.staff_branches
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id IN (
                SELECT tenant_id FROM public.user_roles
                WHERE user_id = auth.uid()
                AND role IN ('super_admin', 'admin', 'owner', 'manager')
            )
        )
    );

-- 5. Create UPDATE policy - Admins can update staff_branches
CREATE POLICY "Admins can manage staff_branches UPDATE" ON public.staff_branches
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id IN (
                SELECT tenant_id FROM public.user_roles
                WHERE user_id = auth.uid()
                AND role IN ('super_admin', 'admin', 'owner', 'manager')
            )
        )
    );

-- 6. Create DELETE policy - Admins can delete staff_branches
CREATE POLICY "Admins can manage staff_branches DELETE" ON public.staff_branches
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.id = staff_branches.staff_id
            AND s.tenant_id IN (
                SELECT tenant_id FROM public.user_roles
                WHERE user_id = auth.uid()
                AND role IN ('super_admin', 'admin', 'owner', 'manager')
            )
        )
    );

-- 7. Create service role bypass policy (for system operations)
CREATE POLICY "Service role full access staff_branches" ON public.staff_branches
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- 8. Verification query
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'staff_branches'
ORDER BY policyname;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

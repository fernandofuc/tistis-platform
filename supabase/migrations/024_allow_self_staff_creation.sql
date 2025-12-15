-- =====================================================
-- Migration 024: Allow Self Staff Creation
-- =====================================================
-- Problem: Users who complete checkout have tenant_id in user_metadata
-- but no staff record. RLS blocks them from creating their own staff record
-- because the INSERT policy requires user_roles entry (chicken-egg problem).
--
-- Solution: Allow users to INSERT their own staff record if:
-- 1. They are authenticated
-- 2. The staff email matches their auth email
-- 3. The tenant_id matches their user_metadata tenant_id
-- 4. They don't already have a staff record in that tenant
-- =====================================================

-- Drop existing restrictive policy and create more permissive ones
DROP POLICY IF EXISTS "Admins can manage staff" ON public.staff;

-- Policy 1: Users can INSERT their OWN staff record (self-registration)
CREATE POLICY "Users can create own staff record" ON public.staff
    FOR INSERT
    WITH CHECK (
        -- Must be authenticated
        auth.uid() IS NOT NULL
        -- Email must match authenticated user's email
        AND email = auth.email()
        -- Tenant must match user's metadata tenant_id
        AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
        -- User must not already have a staff record in this tenant
        AND NOT EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.tenant_id = tenant_id
            AND s.email = auth.email()
        )
    );

-- Policy 2: Admins/Owners can manage ALL staff (existing behavior)
CREATE POLICY "Admins can manage staff" ON public.staff
    FOR ALL USING (
        public.is_super_admin() OR
        (tenant_id IN (
            SELECT ur.tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'owner')
            AND ur.is_active = true
        ))
    );

-- Policy 3: Users can UPDATE their OWN staff record
CREATE POLICY "Users can update own staff record" ON public.staff
    FOR UPDATE USING (
        auth.uid() IS NOT NULL
        AND (
            -- Either user_id matches
            user_id = auth.uid()
            -- Or email matches (for records created before user_id was set)
            OR email = auth.email()
        )
        AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    );

-- Also ensure user_roles allows self-registration for first user
DROP POLICY IF EXISTS "Users can create own user_role" ON public.user_roles;
CREATE POLICY "Users can create own user_role" ON public.user_roles
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
        AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
        -- Only allow if no existing user_roles for this user in this tenant
        AND NOT EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.tenant_id = tenant_id
            AND ur.user_id = auth.uid()
        )
    );

-- Grant necessary permissions
GRANT INSERT, UPDATE ON public.staff TO authenticated;
GRANT INSERT ON public.user_roles TO authenticated;

-- =====================================================
-- Verification query (run manually to test):
-- SELECT * FROM public.staff WHERE email = 'your-email@example.com';
-- =====================================================

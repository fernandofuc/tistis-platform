-- =====================================================
-- MIGRATION 046: Fix ALL branch-related functions
--
-- Fixes the "column c.tenant_id does not exist" error
-- in multiple functions that use JOIN syntax
-- =====================================================

-- ============================================
-- 1. FIX: sync_branch_count trigger function
-- This is called automatically when a branch is inserted/updated/deleted
-- ============================================

CREATE OR REPLACE FUNCTION sync_branch_count()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_branch_count INT;
    v_client_id UUID;
BEGIN
    -- Determine tenant_id based on operation
    IF TG_OP = 'DELETE' THEN
        v_tenant_id := OLD.tenant_id;
    ELSE
        v_tenant_id := NEW.tenant_id;
    END IF;

    -- Count active branches for tenant
    SELECT COUNT(*) INTO v_branch_count
    FROM public.branches
    WHERE tenant_id = v_tenant_id
    AND is_active = true;

    -- Step 1: Get client_id for this tenant
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE tenant_id = v_tenant_id
    LIMIT 1;

    -- Step 2: Update subscription if client exists
    IF v_client_id IS NOT NULL THEN
        UPDATE public.subscriptions
        SET current_branches = v_branch_count,
            updated_at = NOW()
        WHERE client_id = v_client_id
        AND status = 'active';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. FIX: check_branch_limit function
-- Already fixed in 045, but ensuring it's correct
-- ============================================

CREATE OR REPLACE FUNCTION check_branch_limit(p_tenant_id UUID)
RETURNS TABLE (
    can_create BOOLEAN,
    current_count INT,
    max_allowed INT,
    subscription_plan VARCHAR,
    message TEXT
) AS $$
DECLARE
    v_subscription RECORD;
    v_current_branches INT;
    v_client_id UUID;
BEGIN
    -- Step 1: Get client_id for this tenant
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE tenant_id = p_tenant_id
    LIMIT 1;

    -- If no client found, return error
    IF v_client_id IS NULL THEN
        RETURN QUERY SELECT
            false,
            0,
            0,
            'none'::VARCHAR,
            'No se encontró cliente asociado al tenant'::TEXT;
        RETURN;
    END IF;

    -- Step 2: Get active subscription for this client
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE client_id = v_client_id
    AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no subscription, return error
    IF v_subscription IS NULL THEN
        RETURN QUERY SELECT
            false,
            0,
            0,
            'none'::VARCHAR,
            'No se encontró una suscripción activa'::TEXT;
        RETURN;
    END IF;

    -- Count current active branches
    SELECT COUNT(*) INTO v_current_branches
    FROM public.branches
    WHERE tenant_id = p_tenant_id
    AND is_active = true;

    -- Validate limit
    IF v_current_branches >= v_subscription.max_branches THEN
        RETURN QUERY SELECT
            false,
            v_current_branches,
            v_subscription.max_branches,
            v_subscription.plan,
            format('Has alcanzado el límite de %s sucursales. Actualiza tu plan para agregar más.', v_subscription.max_branches);
        RETURN;
    END IF;

    -- Can create
    RETURN QUERY SELECT
        true,
        v_current_branches,
        v_subscription.max_branches,
        v_subscription.plan,
        format('Puedes crear hasta %s sucursales más.', v_subscription.max_branches - v_current_branches);
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. Recreate the trigger to ensure it uses the new function
-- ============================================

DROP TRIGGER IF EXISTS trigger_sync_branch_count ON public.branches;
CREATE TRIGGER trigger_sync_branch_count
AFTER INSERT OR UPDATE OF is_active OR DELETE ON public.branches
FOR EACH ROW EXECUTE FUNCTION sync_branch_count();

-- ============================================
-- Verification
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 046: All branch functions fixed successfully';
    RAISE NOTICE '   - sync_branch_count: Fixed to use two-step query';
    RAISE NOTICE '   - check_branch_limit: Confirmed using two-step query';
    RAISE NOTICE '   - trigger_sync_branch_count: Recreated';
END $$;

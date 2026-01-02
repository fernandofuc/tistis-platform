-- =====================================================
-- TIS TIS PLATFORM - Fix Branch Sync Trigger for Trialing
-- Fixes trigger to also update trialing subscriptions
-- =====================================================

-- The sync_branch_count function only updates subscriptions with status='active'
-- But users in trial (status='trialing') should also have their count updated

CREATE OR REPLACE FUNCTION sync_branch_count()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_branch_count INT;
    v_client_id UUID;
BEGIN
    -- Get tenant_id from the affected row
    v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);

    -- Count active branches for this tenant
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
    -- FIX: Also update 'trialing' subscriptions, not just 'active'
    IF v_client_id IS NOT NULL THEN
        UPDATE public.subscriptions
        SET current_branches = v_branch_count,
            updated_at = NOW()
        WHERE client_id = v_client_id
        AND status IN ('active', 'trialing');  -- FIXED: Added 'trialing'
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trigger_sync_branch_count ON public.branches;
CREATE TRIGGER trigger_sync_branch_count
    AFTER INSERT OR UPDATE OR DELETE ON public.branches
    FOR EACH ROW
    EXECUTE FUNCTION sync_branch_count();

-- Log the fix
DO $$
BEGIN
    RAISE NOTICE '✅ sync_branch_count function updated to support trialing subscriptions';
    RAISE NOTICE '   - Now updates subscriptions with status IN (active, trialing)';
END $$;

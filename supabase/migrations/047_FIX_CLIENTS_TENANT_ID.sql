-- =====================================================
-- MIGRATION 047: Ensure clients table has tenant_id column
-- and fix all branch-related functions
-- =====================================================

-- First, check if tenant_id exists in clients table and add it if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clients'
        AND column_name = 'tenant_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.clients ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
        RAISE NOTICE '✅ Added tenant_id column to clients table';
    ELSE
        RAISE NOTICE '✅ tenant_id column already exists in clients table';
    END IF;
END $$;

-- Create index on tenant_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON public.clients(tenant_id);

-- Update sync_branch_count to handle cases where tenant_id might be null in clients
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

    -- Try to find client by tenant_id first
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE tenant_id = v_tenant_id
    LIMIT 1;

    -- Update subscription if client exists
    IF v_client_id IS NOT NULL THEN
        UPDATE public.subscriptions
        SET current_branches = v_branch_count,
            updated_at = NOW()
        WHERE client_id = v_client_id
        AND status = 'active';
    END IF;

    RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the branch operation
    RAISE WARNING 'sync_branch_count error: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update check_branch_limit with better error handling
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

    -- If no client found by tenant_id, try to find subscription directly
    IF v_client_id IS NULL THEN
        -- Try to get subscription via tenants table
        SELECT s.* INTO v_subscription
        FROM public.subscriptions s
        WHERE s.status = 'active'
        AND EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = p_tenant_id
            -- Add other matching criteria if needed
        )
        ORDER BY s.created_at DESC
        LIMIT 1;

        -- If still no subscription, allow creation with defaults
        IF v_subscription IS NULL THEN
            RETURN QUERY SELECT
                true,
                0,
                10,  -- Default max
                'none'::VARCHAR,
                'No subscription found, allowing branch creation'::TEXT;
            RETURN;
        END IF;
    ELSE
        -- Step 2: Get active subscription for this client
        SELECT * INTO v_subscription
        FROM public.subscriptions
        WHERE client_id = v_client_id
        AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    -- If no subscription found, allow with defaults
    IF v_subscription IS NULL THEN
        RETURN QUERY SELECT
            true,
            0,
            10,
            'none'::VARCHAR,
            'No se encontró una suscripción activa, permitiendo creación'::TEXT;
        RETURN;
    END IF;

    -- Count current active branches
    SELECT COUNT(*) INTO v_current_branches
    FROM public.branches
    WHERE tenant_id = p_tenant_id
    AND is_active = true;

    -- Validate limit
    IF v_current_branches >= COALESCE(v_subscription.max_branches, 10) THEN
        RETURN QUERY SELECT
            false,
            v_current_branches,
            COALESCE(v_subscription.max_branches, 10),
            COALESCE(v_subscription.plan, 'unknown'),
            format('Has alcanzado el límite de %s sucursales.', COALESCE(v_subscription.max_branches, 10));
        RETURN;
    END IF;

    -- Can create
    RETURN QUERY SELECT
        true,
        v_current_branches,
        COALESCE(v_subscription.max_branches, 10),
        COALESCE(v_subscription.plan, 'unknown'),
        format('Puedes crear hasta %s sucursales más.', COALESCE(v_subscription.max_branches, 10) - v_current_branches);
    RETURN;

EXCEPTION WHEN OTHERS THEN
    -- On any error, allow creation with warning
    RAISE WARNING 'check_branch_limit error: %', SQLERRM;
    RETURN QUERY SELECT
        true,
        0,
        10,
        'error'::VARCHAR,
        format('Error checking limit: %s - allowing creation', SQLERRM)::TEXT;
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_sync_branch_count ON public.branches;
CREATE TRIGGER trigger_sync_branch_count
AFTER INSERT OR UPDATE OF is_active OR DELETE ON public.branches
FOR EACH ROW EXECUTE FUNCTION sync_branch_count();

-- Verification
DO $$
DECLARE
    v_has_tenant_id BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clients'
        AND column_name = 'tenant_id'
        AND table_schema = 'public'
    ) INTO v_has_tenant_id;

    RAISE NOTICE '✅ Migration 047 completed';
    RAISE NOTICE '   - clients.tenant_id exists: %', v_has_tenant_id;
    RAISE NOTICE '   - sync_branch_count: Updated with error handling';
    RAISE NOTICE '   - check_branch_limit: Updated with fallbacks';
END $$;

-- =====================================================
-- MIGRATION 045: Fix check_branch_limit function
--
-- The original function used a JOIN with alias 'c' that
-- was causing "column c.tenant_id does not exist" error
-- =====================================================

-- Drop and recreate the function with fixed query
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

-- Add comment
COMMENT ON FUNCTION check_branch_limit(UUID) IS
'Validates if a tenant can create more branches based on their subscription plan. Fixed to use two-step query instead of JOIN.';

-- Verification
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 045: check_branch_limit function updated successfully';
END $$;

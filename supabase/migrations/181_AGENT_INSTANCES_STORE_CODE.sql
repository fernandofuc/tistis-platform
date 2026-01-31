-- =====================================================
-- Migration: 181_AGENT_INSTANCES_STORE_CODE.sql
-- Date: January 30, 2026
-- Version: 1.0
--
-- PURPOSE: Add store_code support for multi-branch filtering
-- in TIS TIS Local Agent for Soft Restaurant integration.
--
-- CHANGES:
-- 1. Add store_code column to agent_instances table
-- 2. Update validate_agent_token RPC to include store_code
-- 3. Add index for store_code lookups
--
-- RELATED:
-- - 180_AGENT_INSTANCES.sql (base table and functions)
-- - 152_SR_CONSOLIDATED_FINAL.sql (sr_sales requires branch_id)
-- - TisTis.Agent.Core/Configuration/AgentConfiguration.cs
-- =====================================================

-- =====================================================
-- STEP 1: Add store_code column to agent_instances
-- =====================================================

ALTER TABLE public.agent_instances
ADD COLUMN IF NOT EXISTS store_code VARCHAR(50);

COMMENT ON COLUMN public.agent_instances.store_code IS
'Soft Restaurant store code (CodigoTienda/Almacen) for multi-branch filtering.
When set, agent SQL queries filter by this store code.
Must match the CodigoTienda/Almacen field in SR database.
Empty/NULL = single-store mode (no filtering).';

-- =====================================================
-- STEP 2: Create index for store_code lookups
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_agent_instances_store_code
    ON public.agent_instances(store_code)
    WHERE store_code IS NOT NULL AND store_code <> '';

-- =====================================================
-- STEP 3: Update validate_agent_token function
-- Now includes store_code in sync_config JSONB
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_agent_token(
    p_agent_id VARCHAR(64),
    p_token_hash VARCHAR(64)
)
RETURNS TABLE (
    is_valid BOOLEAN,
    error_code VARCHAR(50),
    tenant_id UUID,
    integration_id UUID,
    branch_id UUID,
    status public.agent_status,
    sync_config JSONB,
    tenant_name VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agent RECORD;
    v_tenant_name VARCHAR(255);
BEGIN
    -- Find agent by ID and token hash
    SELECT ai.*, t.business_name INTO v_agent
    FROM public.agent_instances ai
    JOIN public.tenants t ON t.id = ai.tenant_id
    WHERE ai.agent_id = p_agent_id
      AND ai.auth_token_hash = p_token_hash;

    -- Agent not found or invalid token
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            FALSE,
            'INVALID_CREDENTIALS'::VARCHAR(50),
            NULL::UUID,
            NULL::UUID,
            NULL::UUID,
            NULL::public.agent_status,
            NULL::JSONB,
            NULL::VARCHAR(255);
        RETURN;
    END IF;

    -- Token expired
    IF v_agent.token_expires_at < NOW() THEN
        RETURN QUERY SELECT
            FALSE,
            'TOKEN_EXPIRED'::VARCHAR(50),
            v_agent.tenant_id,
            v_agent.integration_id,
            v_agent.branch_id,
            v_agent.status,
            NULL::JSONB,
            NULL::VARCHAR(255);
        RETURN;
    END IF;

    -- Agent is disabled/offline (allow re-connection)
    -- Don't block, just return status for client to handle

    -- Valid - return context with store_code in sync_config
    RETURN QUERY SELECT
        TRUE,
        NULL::VARCHAR(50),
        v_agent.tenant_id,
        v_agent.integration_id,
        v_agent.branch_id,
        v_agent.status,
        jsonb_build_object(
            'sync_interval_seconds', v_agent.sync_interval_seconds,
            'sync_menu', v_agent.sync_menu,
            'sync_inventory', v_agent.sync_inventory,
            'sync_sales', v_agent.sync_sales,
            'sync_tables', v_agent.sync_tables,
            'store_code', COALESCE(v_agent.store_code, '')
        ),
        v_agent.business_name;
END;
$$;

COMMENT ON FUNCTION public.validate_agent_token IS
'Validates agent credentials and returns context if valid.
Returns is_valid=false with error_code if validation fails.
sync_config now includes store_code for multi-branch filtering.
Used by API endpoints to authenticate agent requests.';

-- =====================================================
-- STEP 4: Create helper function to update agent store_code
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_agent_store_code(
    p_agent_id VARCHAR(64),
    p_store_code VARCHAR(50),
    p_branch_id UUID DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL  -- Required for security
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated INTEGER;
    v_tenant_id UUID;
BEGIN
    -- SECURITY: Validate tenant_id is provided or can be derived
    IF p_tenant_id IS NULL THEN
        -- Try to get tenant_id from user_roles for current user
        SELECT tenant_id INTO v_tenant_id
        FROM public.user_roles
        WHERE user_id = auth.uid()
        LIMIT 1;

        IF v_tenant_id IS NULL THEN
            RETURN FALSE;  -- No tenant context
        END IF;
    ELSE
        v_tenant_id := p_tenant_id;
    END IF;

    -- SECURITY: Only update if agent belongs to the specified tenant
    UPDATE public.agent_instances
    SET
        store_code = p_store_code,
        branch_id = COALESCE(p_branch_id, branch_id),
        updated_at = NOW()
    WHERE agent_id = p_agent_id
      AND tenant_id = v_tenant_id;  -- Tenant isolation

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN v_updated > 0;
END;
$$;

COMMENT ON FUNCTION public.update_agent_store_code IS
'Updates store_code and optionally branch_id for an agent.
SECURITY: Requires p_tenant_id or derives from auth.uid() via user_roles.
Only updates agents belonging to the specified tenant (RLS-like isolation).
Used during agent configuration for multi-branch setups.
Returns true if agent was found and updated.';

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION public.update_agent_store_code TO service_role;

-- =====================================================
-- STEP 5: Migration notes
-- =====================================================

COMMENT ON SCHEMA public IS
'TIS TIS Platform schema - Multi-branch store_code support added in migration 181.
Updated: agent_instances.store_code column.
Updated: validate_agent_token now returns store_code in sync_config.
New: update_agent_store_code helper function.';

-- =====================================================
-- DONE
-- =====================================================

-- =====================================================
-- Migration: 180_AGENT_INSTANCES.sql
-- Date: January 30, 2026
-- Version: 1.0
--
-- PURPOSE: Sistema de instancias de agentes locales para
-- integración con Soft Restaurant via TIS TIS Local Agent.
-- Almacena registro de agentes, credenciales, estado de
-- conexión y logs detallados de sincronización.
--
-- ARCHITECTURE:
-- - agent_instances: Instalaciones del agente Windows
-- - agent_sync_logs: Auditoría detallada por sync
-- - Funciones: mark_offline_agents, get_agent_stats, validate_agent_token
--
-- RELATED:
-- - 078_INTEGRATION_HUB.sql (integration_connections)
-- - 152_SR_CONSOLIDATED_FINAL.sql (sr_sales)
-- - TypeScript: src/features/integrations/types/integration.types.ts
-- =====================================================

-- =====================================================
-- STEP 1: TYPE - Agent Status Enum
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_status') THEN
        CREATE TYPE public.agent_status AS ENUM (
            'pending',      -- Waiting for installation
            'registered',   -- Agent registered, not yet connected
            'connected',    -- Connected and healthy
            'syncing',      -- Currently synchronizing data
            'error',        -- Connection or sync error
            'offline'       -- No heartbeat received (5+ minutes)
        );
    END IF;
END
$$;

COMMENT ON TYPE public.agent_status IS
'Status lifecycle of a TIS TIS Local Agent instance.
Transitions: pending → registered → connected ↔ syncing/error → offline';

-- =====================================================
-- STEP 2: TYPE - Agent Sync Type Enum
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_sync_type') THEN
        CREATE TYPE public.agent_sync_type AS ENUM (
            'menu',         -- Products/recipes sync
            'inventory',    -- Stock levels sync
            'sales',        -- Sales transactions sync
            'tables',       -- Table/floor plan sync
            'full'          -- Complete sync of all data
        );
    END IF;
END
$$;

COMMENT ON TYPE public.agent_sync_type IS
'Type of data being synchronized by the agent';

-- =====================================================
-- STEP 3: TYPE - Agent Sync Status Enum
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_sync_status') THEN
        CREATE TYPE public.agent_sync_status AS ENUM (
            'started',      -- Sync initiated
            'processing',   -- Processing records
            'completed',    -- All records processed successfully
            'partial',      -- Some records processed, some failed
            'failed'        -- Sync failed completely
        );
    END IF;
END
$$;

COMMENT ON TYPE public.agent_sync_status IS
'Status of a sync operation batch';

-- =====================================================
-- STEP 4: TABLE - agent_instances
-- Instalaciones del agente TIS TIS Local Agent
-- =====================================================

CREATE TABLE IF NOT EXISTS public.agent_instances (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

    -- Agent identification
    agent_id VARCHAR(64) NOT NULL UNIQUE,  -- tis-agent-{hex} format
    agent_version VARCHAR(20) NOT NULL,     -- e.g., "1.0.0"
    machine_name VARCHAR(255),              -- Windows hostname

    -- Status
    status public.agent_status NOT NULL DEFAULT 'pending',

    -- Soft Restaurant connection info (auto-detected by agent)
    sr_version VARCHAR(50),                 -- e.g., "Soft Restaurant 10.5.2"
    sr_database_name VARCHAR(100),          -- e.g., "DVSOFT_RESTAURANTE"
    sr_sql_instance VARCHAR(100),           -- e.g., "SQLEXPRESS"
    sr_empresa_id VARCHAR(50),              -- SR company ID

    -- Sync configuration
    sync_interval_seconds INTEGER NOT NULL DEFAULT 300,  -- 5 min default
    sync_menu BOOLEAN NOT NULL DEFAULT TRUE,
    sync_inventory BOOLEAN NOT NULL DEFAULT TRUE,
    sync_sales BOOLEAN NOT NULL DEFAULT TRUE,
    sync_tables BOOLEAN NOT NULL DEFAULT FALSE,

    -- Statistics
    last_heartbeat_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    last_sync_records INTEGER DEFAULT 0,
    total_records_synced BIGINT DEFAULT 0,

    -- Error tracking
    consecutive_errors INTEGER DEFAULT 0,
    last_error_message TEXT,
    last_error_at TIMESTAMPTZ,

    -- Security (token stored as hash)
    auth_token_hash VARCHAR(64) NOT NULL,   -- SHA-256 hash
    token_expires_at TIMESTAMPTZ NOT NULL,
    allowed_ips TEXT[],                     -- Optional IP whitelist

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT agent_instances_sync_interval_check
        CHECK (sync_interval_seconds >= 60 AND sync_interval_seconds <= 86400),
    CONSTRAINT agent_instances_at_least_one_sync
        CHECK (sync_menu OR sync_inventory OR sync_sales OR sync_tables)
);

-- Comments
COMMENT ON TABLE public.agent_instances IS
'TIS TIS Local Agent instances for Soft Restaurant integration.
Each record represents a Windows agent installation at a customer location.
The agent reads SR SQL Server directly and syncs data to TIS TIS.';

COMMENT ON COLUMN public.agent_instances.agent_id IS
'Unique agent identifier in format: tis-agent-{16-hex-chars}';

COMMENT ON COLUMN public.agent_instances.auth_token_hash IS
'SHA-256 hash of the auth token. Original token shown only once during setup.';

COMMENT ON COLUMN public.agent_instances.allowed_ips IS
'Optional whitelist of IP addresses allowed to connect. Empty = all IPs allowed.';

COMMENT ON COLUMN public.agent_instances.consecutive_errors IS
'Counter of consecutive errors. Reset to 0 when agent reports healthy status.';

-- =====================================================
-- STEP 5: TABLE - agent_sync_logs
-- Auditoría detallada de cada sincronización
-- =====================================================

CREATE TABLE IF NOT EXISTS public.agent_sync_logs (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    agent_id VARCHAR(64) NOT NULL REFERENCES public.agent_instances(agent_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Sync identification
    sync_type public.agent_sync_type NOT NULL,
    batch_id UUID NOT NULL,                 -- Groups batches of same sync
    batch_index INTEGER NOT NULL DEFAULT 1, -- 1, 2, 3... for multi-batch
    batch_total INTEGER NOT NULL DEFAULT 1, -- Total batches expected

    -- Status
    status public.agent_sync_status NOT NULL DEFAULT 'started',

    -- Record counts
    records_received INTEGER DEFAULT 0,     -- Raw records from agent
    records_processed INTEGER DEFAULT 0,    -- Successfully processed
    records_created INTEGER DEFAULT 0,      -- New records inserted
    records_updated INTEGER DEFAULT 0,      -- Existing records updated
    records_skipped INTEGER DEFAULT 0,      -- Skipped (duplicates, etc.)
    records_failed INTEGER DEFAULT 0,       -- Failed to process

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,                    -- Calculated on completion

    -- Error details
    error_message TEXT,
    error_details JSONB,                    -- Full error context
    failed_records JSONB,                   -- Records that failed (for retry)

    -- Debug info
    raw_payload_size_bytes INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE public.agent_sync_logs IS
'Detailed audit trail of every sync operation from TIS TIS Local Agent.
Each batch creates a separate record. Use batch_id to group related batches.';

COMMENT ON COLUMN public.agent_sync_logs.batch_id IS
'UUID grouping all batches of a single sync operation.
If data is split into 3 batches, all 3 share the same batch_id.';

COMMENT ON COLUMN public.agent_sync_logs.failed_records IS
'JSONB array of records that failed processing.
Used for retry logic and debugging.';

-- =====================================================
-- STEP 6: INDEXES for performance
-- =====================================================

-- agent_instances indexes
CREATE INDEX IF NOT EXISTS idx_agent_instances_tenant
    ON public.agent_instances(tenant_id);

CREATE INDEX IF NOT EXISTS idx_agent_instances_integration
    ON public.agent_instances(integration_id);

CREATE INDEX IF NOT EXISTS idx_agent_instances_status
    ON public.agent_instances(status)
    WHERE status IN ('connected', 'syncing', 'error');

CREATE INDEX IF NOT EXISTS idx_agent_instances_heartbeat
    ON public.agent_instances(last_heartbeat_at)
    WHERE status IN ('connected', 'syncing');

CREATE INDEX IF NOT EXISTS idx_agent_instances_token_hash
    ON public.agent_instances(auth_token_hash);

CREATE INDEX IF NOT EXISTS idx_agent_instances_agent_id
    ON public.agent_instances(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_instances_branch
    ON public.agent_instances(branch_id)
    WHERE branch_id IS NOT NULL;

-- agent_sync_logs indexes
CREATE INDEX IF NOT EXISTS idx_agent_sync_logs_agent
    ON public.agent_sync_logs(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_sync_logs_tenant
    ON public.agent_sync_logs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_agent_sync_logs_batch
    ON public.agent_sync_logs(batch_id);

CREATE INDEX IF NOT EXISTS idx_agent_sync_logs_type_status
    ON public.agent_sync_logs(sync_type, status);

CREATE INDEX IF NOT EXISTS idx_agent_sync_logs_created
    ON public.agent_sync_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_sync_logs_tenant_created
    ON public.agent_sync_logs(tenant_id, created_at DESC);

-- =====================================================
-- STEP 7: RLS POLICIES
-- =====================================================

ALTER TABLE public.agent_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sync_logs ENABLE ROW LEVEL SECURITY;

-- agent_instances policies (owner/admin only)
DROP POLICY IF EXISTS agent_instances_tenant_select ON public.agent_instances;
CREATE POLICY agent_instances_tenant_select ON public.agent_instances
    FOR SELECT
    USING (public.user_has_integration_access(tenant_id));

DROP POLICY IF EXISTS agent_instances_tenant_insert ON public.agent_instances;
CREATE POLICY agent_instances_tenant_insert ON public.agent_instances
    FOR INSERT
    WITH CHECK (public.user_has_integration_access(tenant_id));

DROP POLICY IF EXISTS agent_instances_tenant_update ON public.agent_instances;
CREATE POLICY agent_instances_tenant_update ON public.agent_instances
    FOR UPDATE
    USING (public.user_has_integration_access(tenant_id));

DROP POLICY IF EXISTS agent_instances_tenant_delete ON public.agent_instances;
CREATE POLICY agent_instances_tenant_delete ON public.agent_instances
    FOR DELETE
    USING (public.user_has_integration_access(tenant_id));

-- Service role bypass (needed for agent API endpoints)
DROP POLICY IF EXISTS agent_instances_service_role ON public.agent_instances;
CREATE POLICY agent_instances_service_role ON public.agent_instances
    FOR ALL
    TO service_role
    USING (true);

-- agent_sync_logs policies
DROP POLICY IF EXISTS agent_sync_logs_tenant_select ON public.agent_sync_logs;
CREATE POLICY agent_sync_logs_tenant_select ON public.agent_sync_logs
    FOR SELECT
    USING (public.user_has_integration_access(tenant_id));

DROP POLICY IF EXISTS agent_sync_logs_tenant_insert ON public.agent_sync_logs;
CREATE POLICY agent_sync_logs_tenant_insert ON public.agent_sync_logs
    FOR INSERT
    WITH CHECK (public.user_has_integration_access(tenant_id));

-- Service role bypass for sync logs
DROP POLICY IF EXISTS agent_sync_logs_service_role ON public.agent_sync_logs;
CREATE POLICY agent_sync_logs_service_role ON public.agent_sync_logs
    FOR ALL
    TO service_role
    USING (true);

-- =====================================================
-- STEP 8: FUNCTION - mark_offline_agents
-- Marca agentes sin heartbeat en 5+ minutos como offline
-- =====================================================

CREATE OR REPLACE FUNCTION public.mark_offline_agents(
    p_timeout_minutes INTEGER DEFAULT 5
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE public.agent_instances
    SET
        status = 'offline',
        updated_at = NOW()
    WHERE status IN ('connected', 'syncing')
      AND last_heartbeat_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.mark_offline_agents IS
'Marks agents as offline if no heartbeat received within timeout.
Default timeout: 5 minutes. Should be called by cron job every minute.
Returns count of agents marked offline.';

-- =====================================================
-- STEP 9: FUNCTION - get_agent_stats
-- Retorna estadísticas agregadas del tenant
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_agent_stats(
    p_tenant_id UUID
)
RETURNS TABLE (
    total_agents INTEGER,
    connected_agents INTEGER,
    syncing_agents INTEGER,
    error_agents INTEGER,
    offline_agents INTEGER,
    total_records_synced BIGINT,
    syncs_today INTEGER,
    syncs_failed_today INTEGER,
    last_sync_at TIMESTAMPTZ,
    avg_sync_duration_ms NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH agent_counts AS (
        SELECT
            COUNT(*)::INTEGER AS total,
            COUNT(*) FILTER (WHERE status = 'connected')::INTEGER AS connected,
            COUNT(*) FILTER (WHERE status = 'syncing')::INTEGER AS syncing,
            COUNT(*) FILTER (WHERE status = 'error')::INTEGER AS error,
            COUNT(*) FILTER (WHERE status = 'offline')::INTEGER AS offline,
            COALESCE(SUM(ai.total_records_synced), 0) AS total_synced,
            MAX(ai.last_sync_at) AS max_sync
        FROM public.agent_instances ai
        WHERE ai.tenant_id = p_tenant_id
    ),
    sync_stats AS (
        SELECT
            COUNT(*) FILTER (WHERE sl.created_at >= CURRENT_DATE)::INTEGER AS today_count,
            COUNT(*) FILTER (WHERE sl.status = 'failed' AND sl.created_at >= CURRENT_DATE)::INTEGER AS today_failed,
            ROUND(AVG(sl.duration_ms) FILTER (WHERE sl.status = 'completed'), 2) AS avg_duration
        FROM public.agent_sync_logs sl
        WHERE sl.tenant_id = p_tenant_id
    )
    SELECT
        ac.total,
        ac.connected,
        ac.syncing,
        ac.error,
        ac.offline,
        ac.total_synced,
        ss.today_count,
        ss.today_failed,
        ac.max_sync,
        ss.avg_duration
    FROM agent_counts ac, sync_stats ss;
END;
$$;

COMMENT ON FUNCTION public.get_agent_stats IS
'Returns aggregated statistics for all agents of a tenant.
Includes connection status counts, sync counts, and performance metrics.';

-- =====================================================
-- STEP 10: FUNCTION - validate_agent_token
-- Valida token del agente y retorna contexto
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

    -- Valid - return context
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
            'sync_tables', v_agent.sync_tables
        ),
        v_agent.business_name;
END;
$$;

COMMENT ON FUNCTION public.validate_agent_token IS
'Validates agent credentials and returns context if valid.
Returns is_valid=false with error_code if validation fails.
Used by API endpoints to authenticate agent requests.';

-- =====================================================
-- STEP 11: FUNCTION - record_agent_heartbeat
-- Actualiza timestamp de heartbeat y estado
-- =====================================================

CREATE OR REPLACE FUNCTION public.record_agent_heartbeat(
    p_agent_id VARCHAR(64),
    p_status public.agent_status,
    p_last_sync_records INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated BOOLEAN;
BEGIN
    UPDATE public.agent_instances
    SET
        status = p_status,
        last_heartbeat_at = NOW(),
        last_sync_records = COALESCE(p_last_sync_records, last_sync_records),
        consecutive_errors = CASE
            WHEN p_status = 'error' THEN consecutive_errors + 1
            WHEN p_status IN ('connected', 'syncing') THEN 0
            ELSE consecutive_errors
        END,
        last_error_message = CASE
            WHEN p_status = 'error' THEN p_error_message
            ELSE last_error_message
        END,
        last_error_at = CASE
            WHEN p_status = 'error' THEN NOW()
            ELSE last_error_at
        END,
        updated_at = NOW()
    WHERE agent_id = p_agent_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    RETURN v_updated > 0;
END;
$$;

COMMENT ON FUNCTION public.record_agent_heartbeat IS
'Records heartbeat from agent and updates status.
Resets error counter when status is connected/syncing.
Increments error counter when status is error.';

-- =====================================================
-- STEP 12: FUNCTION - complete_agent_sync
-- Completa un batch de sync y actualiza estadísticas
-- =====================================================

CREATE OR REPLACE FUNCTION public.complete_agent_sync(
    p_log_id UUID,
    p_status public.agent_sync_status,
    p_records_processed INTEGER,
    p_records_created INTEGER,
    p_records_updated INTEGER,
    p_records_skipped INTEGER,
    p_records_failed INTEGER,
    p_error_message TEXT DEFAULT NULL,
    p_error_details JSONB DEFAULT NULL,
    p_failed_records JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log RECORD;
    v_duration_ms INTEGER;
BEGIN
    -- Get log record
    SELECT * INTO v_log FROM public.agent_sync_logs WHERE id = p_log_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Calculate duration in milliseconds (EPOCH returns total seconds)
    -- EXTRACT(EPOCH) * 1000 gives total milliseconds correctly
    v_duration_ms := (EXTRACT(EPOCH FROM (NOW() - v_log.started_at)) * 1000)::INTEGER;

    -- Update sync log
    UPDATE public.agent_sync_logs
    SET
        status = p_status,
        records_processed = p_records_processed,
        records_created = p_records_created,
        records_updated = p_records_updated,
        records_skipped = p_records_skipped,
        records_failed = p_records_failed,
        completed_at = NOW(),
        duration_ms = v_duration_ms,
        error_message = p_error_message,
        error_details = p_error_details,
        failed_records = p_failed_records
    WHERE id = p_log_id;

    -- Update agent statistics if sync completed successfully
    IF p_status IN ('completed', 'partial') THEN
        UPDATE public.agent_instances
        SET
            last_sync_at = NOW(),
            last_sync_records = p_records_processed,
            total_records_synced = total_records_synced + p_records_created + p_records_updated,
            status = CASE WHEN status = 'syncing' THEN 'connected' ELSE status END,
            updated_at = NOW()
        WHERE agent_id = v_log.agent_id;
    END IF;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.complete_agent_sync IS
'Completes a sync batch and updates agent statistics.
Called when agent finishes processing a batch.';

-- =====================================================
-- STEP 13: TRIGGERS
-- =====================================================

-- Auto-update updated_at on agent_instances
DROP TRIGGER IF EXISTS set_updated_at_agent_instances ON public.agent_instances;
CREATE TRIGGER set_updated_at_agent_instances
    BEFORE UPDATE ON public.agent_instances
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 14: GRANTS (service role needs full access)
-- =====================================================

GRANT ALL ON public.agent_instances TO service_role;
GRANT ALL ON public.agent_sync_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_offline_agents TO service_role;
GRANT EXECUTE ON FUNCTION public.get_agent_stats TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_agent_token TO service_role;
GRANT EXECUTE ON FUNCTION public.record_agent_heartbeat TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_agent_sync TO service_role;

-- =====================================================
-- DONE
-- =====================================================

COMMENT ON SCHEMA public IS
'TIS TIS Platform schema - Agent Instances added in migration 180.
New tables: agent_instances, agent_sync_logs.
New functions: mark_offline_agents, get_agent_stats, validate_agent_token,
record_agent_heartbeat, complete_agent_sync.';

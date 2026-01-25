-- =====================================================
-- TIS TIS PLATFORM - Migration 158
-- Sprint 2: Performance Indexes + API Key Scope Enforcement in RLS
-- =====================================================
-- CHANGES:
-- 1. Add performance indexes to external_contacts and integration tables
-- 2. Add helper functions for scope checking (get_current_api_key_scopes, has_api_scope)
-- 3. Create RESTRICTIVE RLS policies that enforce API key scopes
--
-- ARCHITECTURE NOTE:
-- Currently, API key scope enforcement happens at the application layer
-- (Next.js API routes via api-key-auth.ts). These RLS policies provide
-- a SECOND layer of defense at the database level.
--
-- For RLS scope enforcement to work, the API key middleware would need to:
-- 1. Create a custom JWT with 'api_key_scopes' claim
-- 2. Use that JWT when creating the Supabase client
--
-- Until that's implemented, has_api_scope() returns TRUE for all requests,
-- effectively deferring scope enforcement to the application layer.
-- =====================================================

BEGIN;

-- =====================================================
-- PART 1: ADDITIONAL INDEXES FOR external_contacts
-- =====================================================

-- Index for filtering by integration connection
-- Use case: "Show all contacts from HubSpot integration X"
CREATE INDEX IF NOT EXISTS idx_external_contacts_integration
    ON public.external_contacts(integration_id);

-- Index for filtering by external source
-- Use case: "Show all contacts imported from HubSpot vs Salesforce"
CREATE INDEX IF NOT EXISTS idx_external_contacts_source
    ON public.external_contacts(tenant_id, external_source);

-- Index for sync operations (find stale contacts)
-- Use case: "Find contacts not synced in last 24 hours"
CREATE INDEX IF NOT EXISTS idx_external_contacts_last_sync
    ON public.external_contacts(tenant_id, last_synced_at DESC);

-- Composite index for common filtering patterns
-- Use case: "All pending dedup contacts from specific integration"
CREATE INDEX IF NOT EXISTS idx_external_contacts_integration_dedup
    ON public.external_contacts(integration_id, dedup_status)
    WHERE dedup_status = 'pending';

-- Index for full name search (case-insensitive)
-- Use case: "Search contacts by name"
CREATE INDEX IF NOT EXISTS idx_external_contacts_fullname
    ON public.external_contacts(tenant_id, LOWER(full_name) varchar_pattern_ops);

-- =====================================================
-- PART 2: INDEXES FOR OTHER INTEGRATION TABLES
-- =====================================================

-- external_appointments: Index for date range queries
CREATE INDEX IF NOT EXISTS idx_external_appointments_date_range
    ON public.external_appointments(tenant_id, scheduled_start, scheduled_end);

-- external_appointments: Index for integration filtering
CREATE INDEX IF NOT EXISTS idx_external_appointments_integration
    ON public.external_appointments(integration_id);

-- external_inventory: Index for integration filtering
CREATE INDEX IF NOT EXISTS idx_external_inventory_integration
    ON public.external_inventory(integration_id);

-- external_products: Index for integration filtering
CREATE INDEX IF NOT EXISTS idx_external_products_integration
    ON public.external_products(integration_id);

-- integration_sync_logs: Index for recent logs by connection
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_recent
    ON public.integration_sync_logs(connection_id, started_at DESC);

-- =====================================================
-- PART 3: API KEY SCOPE ENFORCEMENT HELPERS
-- =====================================================

-- Function to get current API key context from request headers
-- This works with Supabase's auth.jwt() for API key validation
CREATE OR REPLACE FUNCTION get_current_api_key_scopes()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_scopes TEXT[];
    v_jwt_claims JSONB;
BEGIN
    -- Get JWT claims from current session
    v_jwt_claims := auth.jwt();

    -- Extract scopes from JWT if present (set by API key auth middleware)
    IF v_jwt_claims ? 'api_key_scopes' THEN
        SELECT array_agg(s)
        INTO v_scopes
        FROM jsonb_array_elements_text(v_jwt_claims->'api_key_scopes') AS s;

        RETURN COALESCE(v_scopes, ARRAY[]::TEXT[]);
    END IF;

    -- For non-API key requests (normal user sessions), return NULL
    -- This allows normal RLS policies to apply
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION get_current_api_key_scopes() IS
'Returns API key scopes from JWT claims, or NULL for regular user sessions';

-- Function to check if current request has required scope
CREATE OR REPLACE FUNCTION has_api_scope(required_scope TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_scopes TEXT[];
    v_resource TEXT;
BEGIN
    v_scopes := get_current_api_key_scopes();

    -- If no API key context (regular user session), allow access
    -- Normal RLS policies will handle authorization
    IF v_scopes IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Check for wildcard scope (admin access)
    IF '*' = ANY(v_scopes) THEN
        RETURN TRUE;
    END IF;

    -- Check for exact scope match
    IF required_scope = ANY(v_scopes) THEN
        RETURN TRUE;
    END IF;

    -- Check for resource-level wildcard (e.g., 'leads:*' covers 'leads:read')
    v_resource := split_part(required_scope, ':', 1);
    IF (v_resource || ':*') = ANY(v_scopes) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION has_api_scope(TEXT) IS
'Checks if current API key has required scope. Returns TRUE for regular user sessions.';

-- =====================================================
-- PART 4: RESTRICTIVE POLICIES FOR API KEY SCOPE ENFORCEMENT
-- =====================================================
-- IMPORTANT: These are RESTRICTIVE policies that work WITH existing
-- PERMISSIVE policies. PostgreSQL RLS logic:
--   access = (ALL restrictive pass) AND (ANY permissive passes)
--
-- Existing permissive policies handle tenant isolation.
-- These restrictive policies add scope requirements for API keys.
-- For regular users, has_api_scope() returns TRUE (no restriction).
-- =====================================================

-- 4.1 LEADS TABLE - Scope enforcement (RESTRICTIVE)
DROP POLICY IF EXISTS leads_scope_check ON public.leads;
CREATE POLICY leads_scope_check ON public.leads
    AS RESTRICTIVE
    FOR SELECT
    USING (has_api_scope('leads:read'));

DROP POLICY IF EXISTS leads_scope_insert ON public.leads;
CREATE POLICY leads_scope_insert ON public.leads
    AS RESTRICTIVE
    FOR INSERT
    WITH CHECK (has_api_scope('leads:write'));

DROP POLICY IF EXISTS leads_scope_update ON public.leads;
CREATE POLICY leads_scope_update ON public.leads
    AS RESTRICTIVE
    FOR UPDATE
    USING (has_api_scope('leads:write'));

DROP POLICY IF EXISTS leads_scope_delete ON public.leads;
CREATE POLICY leads_scope_delete ON public.leads
    AS RESTRICTIVE
    FOR DELETE
    USING (has_api_scope('leads:delete'));

-- 4.2 APPOINTMENTS TABLE - Scope enforcement (RESTRICTIVE)
DROP POLICY IF EXISTS appointments_scope_check ON public.appointments;
CREATE POLICY appointments_scope_check ON public.appointments
    AS RESTRICTIVE
    FOR SELECT
    USING (has_api_scope('appointments:read'));

DROP POLICY IF EXISTS appointments_scope_insert ON public.appointments;
CREATE POLICY appointments_scope_insert ON public.appointments
    AS RESTRICTIVE
    FOR INSERT
    WITH CHECK (has_api_scope('appointments:write'));

DROP POLICY IF EXISTS appointments_scope_update ON public.appointments;
CREATE POLICY appointments_scope_update ON public.appointments
    AS RESTRICTIVE
    FOR UPDATE
    USING (has_api_scope('appointments:write'));

DROP POLICY IF EXISTS appointments_scope_delete ON public.appointments;
CREATE POLICY appointments_scope_delete ON public.appointments
    AS RESTRICTIVE
    FOR DELETE
    USING (has_api_scope('appointments:delete'));

-- 4.3 CONVERSATIONS TABLE - Scope enforcement (RESTRICTIVE)
DROP POLICY IF EXISTS conversations_scope_check ON public.conversations;
CREATE POLICY conversations_scope_check ON public.conversations
    AS RESTRICTIVE
    FOR SELECT
    USING (has_api_scope('conversations:read'));

-- 4.4 MESSAGES TABLE - Scope enforcement (RESTRICTIVE)
DROP POLICY IF EXISTS messages_scope_check ON public.messages;
CREATE POLICY messages_scope_check ON public.messages
    AS RESTRICTIVE
    FOR SELECT
    USING (has_api_scope('messages:read'));

-- =====================================================
-- CLEANUP: Remove old PERMISSIVE scope policies if they exist
-- (from earlier version of this migration)
-- =====================================================
DROP POLICY IF EXISTS leads_api_read ON public.leads;
DROP POLICY IF EXISTS leads_api_write ON public.leads;
DROP POLICY IF EXISTS leads_api_update ON public.leads;
DROP POLICY IF EXISTS leads_api_delete ON public.leads;
DROP POLICY IF EXISTS appointments_api_read ON public.appointments;
DROP POLICY IF EXISTS appointments_api_write ON public.appointments;
DROP POLICY IF EXISTS appointments_api_update ON public.appointments;
DROP POLICY IF EXISTS appointments_api_delete ON public.appointments;
DROP POLICY IF EXISTS conversations_api_read ON public.conversations;
DROP POLICY IF EXISTS messages_api_read ON public.messages;

-- =====================================================
-- PART 5: GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION get_current_api_key_scopes TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_api_key_scopes TO service_role;
GRANT EXECUTE ON FUNCTION has_api_scope TO authenticated;
GRANT EXECUTE ON FUNCTION has_api_scope TO service_role;

-- =====================================================
-- PART 6: VERIFICATION
-- =====================================================

DO $$
DECLARE
    v_idx_count INTEGER;
    v_policy_count INTEGER;
BEGIN
    -- Count new indexes
    SELECT COUNT(*) INTO v_idx_count
    FROM pg_indexes
    WHERE indexname IN (
        'idx_external_contacts_integration',
        'idx_external_contacts_source',
        'idx_external_contacts_last_sync',
        'idx_external_contacts_integration_dedup',
        'idx_external_contacts_fullname',
        'idx_external_appointments_date_range',
        'idx_external_appointments_integration',
        'idx_external_inventory_integration',
        'idx_external_products_integration',
        'idx_integration_sync_logs_recent'
    );

    -- Count new RESTRICTIVE RLS policies
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE policyname LIKE '%_scope_%';

    RAISE NOTICE 'Created % new indexes', v_idx_count;
    RAISE NOTICE 'Created % RESTRICTIVE scope-enforcement policies', v_policy_count;

    IF v_idx_count < 5 THEN
        RAISE WARNING 'Some indexes may not have been created';
    END IF;

    IF v_policy_count < 10 THEN
        RAISE WARNING 'Some scope policies may not have been created. Expected 10, got %', v_policy_count;
    END IF;
END $$;

COMMIT;

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- DROP INDEX IF EXISTS idx_external_contacts_integration;
-- DROP INDEX IF EXISTS idx_external_contacts_source;
-- DROP INDEX IF EXISTS idx_external_contacts_last_sync;
-- DROP INDEX IF EXISTS idx_external_contacts_integration_dedup;
-- DROP INDEX IF EXISTS idx_external_contacts_fullname;
-- DROP INDEX IF EXISTS idx_external_appointments_date_range;
-- DROP INDEX IF EXISTS idx_external_appointments_integration;
-- DROP INDEX IF EXISTS idx_external_inventory_integration;
-- DROP INDEX IF EXISTS idx_external_products_integration;
-- DROP INDEX IF EXISTS idx_integration_sync_logs_recent;
-- DROP POLICY IF EXISTS leads_scope_check ON public.leads;
-- DROP POLICY IF EXISTS leads_scope_insert ON public.leads;
-- DROP POLICY IF EXISTS leads_scope_update ON public.leads;
-- DROP POLICY IF EXISTS leads_scope_delete ON public.leads;
-- DROP POLICY IF EXISTS appointments_scope_check ON public.appointments;
-- DROP POLICY IF EXISTS appointments_scope_insert ON public.appointments;
-- DROP POLICY IF EXISTS appointments_scope_update ON public.appointments;
-- DROP POLICY IF EXISTS appointments_scope_delete ON public.appointments;
-- DROP POLICY IF EXISTS conversations_scope_check ON public.conversations;
-- DROP POLICY IF EXISTS messages_scope_check ON public.messages;
-- DROP FUNCTION IF EXISTS get_current_api_key_scopes();
-- DROP FUNCTION IF EXISTS has_api_scope(TEXT);

-- =====================================================
-- TIS TIS PLATFORM - FASE 3: Performance Optimization
-- Migration: 136_OPTIMIZE_BRANCH_FILTERING_INDEXES
-- Description: Add partial indexes for common branch-filtered queries
-- Performance Target: P95 latency < 80ms (20% improvement)
--
-- CORREGIDO:
-- - Quitado CONCURRENTLY (no funciona en SQL Editor de Supabase)
-- - Quitado NOW() en predicados (no es IMMUTABLE)
-- - Quitado tablas que no existen (menu_items, inventory_items)
-- =====================================================

-- =====================================================
-- PARTIAL INDEXES FOR COMMON QUERIES
-- =====================================================

-- LEADS: Active status queries with branch filtering
CREATE INDEX IF NOT EXISTS idx_leads_branch_active_statuses
    ON leads(branch_id, created_at DESC)
    WHERE status IN ('new', 'contacted', 'qualified');

-- LEADS: Search queries with branch filtering
CREATE INDEX IF NOT EXISTS idx_leads_branch_search
    ON leads(branch_id, name, phone, email)
    WHERE status IS NOT NULL;

-- APPOINTMENTS: By branch and scheduled time
CREATE INDEX IF NOT EXISTS idx_appointments_branch_scheduled
    ON appointments(branch_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_appointments_branch_scheduled_desc
    ON appointments(branch_id, scheduled_at DESC);

-- STAFF: Active staff per branch
CREATE INDEX IF NOT EXISTS idx_staff_branch_active
    ON staff(branch_id, role)
    WHERE is_active = true;

-- =====================================================
-- COMPOSITE INDEXES FOR TENANT + BRANCH FILTERING
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_leads_tenant_branch_created
    ON leads(tenant_id, branch_id, created_at DESC)
    WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_branch_scheduled
    ON appointments(tenant_id, branch_id, scheduled_at DESC);

-- =====================================================
-- COVERING INDEXES FOR SELECT OPTIMIZATION
-- =====================================================

-- Covering index for lead list queries
CREATE INDEX IF NOT EXISTS idx_leads_branch_covering
    ON leads(branch_id, created_at DESC)
    INCLUDE (id, tenant_id, phone, name, status, source);

-- Covering index for appointment list queries
CREATE INDEX IF NOT EXISTS idx_appointments_branch_covering
    ON appointments(branch_id, scheduled_at)
    INCLUDE (id, tenant_id, lead_id, staff_id, status, service_type);

-- =====================================================
-- API KEYS OPTIMIZATION
-- =====================================================

-- Optimize API key authentication lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_hash_active
    ON api_keys(key_hash)
    WHERE is_active = true;

-- Branch-specific API keys lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_branch_scope
    ON api_keys(tenant_id, branch_id, scope_type)
    WHERE is_active = true;

-- =====================================================
-- UPDATE DATABASE STATISTICS
-- =====================================================

ANALYZE leads;
ANALYZE appointments;
ANALYZE staff;
ANALYZE api_keys;
ANALYZE branches;

-- =====================================================
-- MONITORING VIEW
-- =====================================================

CREATE OR REPLACE VIEW vw_fase3_index_usage AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%_branch%'
ORDER BY idx_scan DESC;

-- =====================================================
-- PERFORMANCE VALIDATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION validate_fase3_indexes()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check 1: Verify indexes exist
    RETURN QUERY
    SELECT
        'Index Existence'::TEXT,
        CASE WHEN COUNT(*) >= 8 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        FORMAT('Found %s/8 expected indexes', COUNT(*))::TEXT
    FROM pg_indexes
    WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%_branch%';

    -- Check 2: Verify indexes are being used
    RETURN QUERY
    SELECT
        'Index Usage'::TEXT,
        CASE WHEN COUNT(*) >= 5 THEN 'PASS' ELSE 'WARN' END::TEXT,
        FORMAT('%s indexes have recorded scans', COUNT(*))::TEXT
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%_branch%'
        AND idx_scan > 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

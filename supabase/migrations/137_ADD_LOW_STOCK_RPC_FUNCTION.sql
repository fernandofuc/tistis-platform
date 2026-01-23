-- =====================================================
-- TIS TIS PLATFORM - FASE 3: Branch Stats RPC Functions
-- Migration: 137_ADD_LOW_STOCK_RPC_FUNCTION
-- Description: RPC functions for caching layer to query branch stats
--
-- CORREGIDO:
-- - Quitado inventory_items (tabla no existe)
-- - Quitado CONCURRENTLY en REFRESH (no funciona en SQL Editor)
-- - Funciones solo usan tablas que existen (leads, appointments, branches)
-- =====================================================

-- =====================================================
-- BRANCH STATISTICS SUMMARY FUNCTION
-- =====================================================

/**
 * Get branch statistics summary (for dashboard widgets)
 * Optimized for caching - returns aggregated data
 */
CREATE OR REPLACE FUNCTION get_branch_stats_summary(
    p_tenant_id UUID,
    p_branch_id UUID
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    lead_stats JSONB;
    appointment_stats JSONB;
BEGIN
    -- Lead statistics
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'new', COUNT(*) FILTER (WHERE status = 'new'),
        'contacted', COUNT(*) FILTER (WHERE status = 'contacted'),
        'qualified', COUNT(*) FILTER (WHERE status = 'qualified'),
        'converted', COUNT(*) FILTER (WHERE status = 'converted')
    )
    INTO lead_stats
    FROM leads
    WHERE tenant_id = p_tenant_id
        AND branch_id = p_branch_id;

    -- Appointment statistics
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE DATE(scheduled_at) = CURRENT_DATE),
        'upcoming', COUNT(*) FILTER (WHERE scheduled_at > NOW() AND status = 'confirmed'),
        'completed', COUNT(*) FILTER (WHERE status = 'completed')
    )
    INTO appointment_stats
    FROM appointments
    WHERE tenant_id = p_tenant_id
        AND branch_id = p_branch_id;

    -- Combine all stats (sin inventory por ahora)
    result := jsonb_build_object(
        'branch_id', p_branch_id,
        'leads', lead_stats,
        'appointments', appointment_stats,
        'generated_at', NOW()
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
STABLE;

GRANT EXECUTE ON FUNCTION get_branch_stats_summary(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_branch_stats_summary(UUID, UUID) TO service_role;

-- =====================================================
-- CACHE-FRIENDLY MATERIALIZED VIEW
-- =====================================================

/**
 * Materialized view for branch performance metrics
 * Refresh this view periodically (e.g., every 5 minutes via cron)
 * For use in analytics dashboard
 */
DROP MATERIALIZED VIEW IF EXISTS mv_branch_performance_metrics CASCADE;

CREATE MATERIALIZED VIEW mv_branch_performance_metrics AS
SELECT
    b.id AS branch_id,
    b.tenant_id,
    b.name AS branch_name,
    b.is_headquarters,

    -- Lead metrics (last 30 days)
    COUNT(DISTINCT l.id) FILTER (WHERE l.created_at > NOW() - INTERVAL '30 days') AS leads_30d,
    COUNT(DISTINCT l.id) FILTER (WHERE l.created_at > NOW() - INTERVAL '7 days') AS leads_7d,
    COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'converted' AND l.updated_at > NOW() - INTERVAL '30 days') AS conversions_30d,

    -- Appointment metrics (last 30 days)
    COUNT(DISTINCT a.id) FILTER (WHERE a.created_at > NOW() - INTERVAL '30 days') AS appointments_30d,
    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'completed' AND a.updated_at > NOW() - INTERVAL '30 days') AS completed_appointments_30d,

    -- Last updated
    NOW() AS refreshed_at

FROM branches b
LEFT JOIN leads l ON l.branch_id = b.id AND l.tenant_id = b.tenant_id
LEFT JOIN appointments a ON a.branch_id = b.id AND a.tenant_id = b.tenant_id
WHERE b.is_active = true
GROUP BY b.id, b.tenant_id, b.name, b.is_headquarters;

-- Create index on materialized view for fast lookups
CREATE UNIQUE INDEX idx_mv_branch_performance_branch_id
    ON mv_branch_performance_metrics(branch_id);

CREATE INDEX idx_mv_branch_performance_tenant
    ON mv_branch_performance_metrics(tenant_id);

-- Grant select permission
GRANT SELECT ON mv_branch_performance_metrics TO authenticated;
GRANT SELECT ON mv_branch_performance_metrics TO service_role;

-- =====================================================
-- REFRESH FUNCTION FOR MATERIALIZED VIEW
-- =====================================================

/**
 * Refresh branch performance metrics
 * Call this via cron job or API endpoint
 * NOTA: CONCURRENTLY requiere un UNIQUE INDEX (ya lo tenemos)
 * pero no funciona en SQL Editor, ejecutar manualmente si es necesario
 */
CREATE OR REPLACE FUNCTION refresh_branch_performance_metrics()
RETURNS VOID AS $$
BEGIN
    -- Sin CONCURRENTLY para compatibilidad con SQL Editor
    REFRESH MATERIALIZED VIEW mv_branch_performance_metrics;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION refresh_branch_performance_metrics() TO service_role;

-- =====================================================
-- MONITORING VIEW
-- =====================================================

-- Check when materialized view was last refreshed
CREATE OR REPLACE VIEW vw_cache_freshness AS
SELECT
    'mv_branch_performance_metrics' AS view_name,
    MAX(refreshed_at) AS last_refresh,
    EXTRACT(EPOCH FROM (NOW() - MAX(refreshed_at))) AS seconds_since_refresh,
    CASE
        WHEN EXTRACT(EPOCH FROM (NOW() - MAX(refreshed_at))) < 600 THEN 'FRESH'
        WHEN EXTRACT(EPOCH FROM (NOW() - MAX(refreshed_at))) < 1800 THEN 'STALE'
        ELSE 'VERY_STALE'
    END AS freshness_status
FROM mv_branch_performance_metrics;

GRANT SELECT ON vw_cache_freshness TO authenticated;
GRANT SELECT ON vw_cache_freshness TO service_role;

-- =====================================================
-- ROLLBACK STRATEGY
-- =====================================================

-- To rollback:
-- DROP FUNCTION IF EXISTS get_branch_stats_summary(UUID, UUID);
-- DROP MATERIALIZED VIEW IF EXISTS mv_branch_performance_metrics CASCADE;
-- DROP FUNCTION IF EXISTS refresh_branch_performance_metrics();
-- DROP VIEW IF EXISTS vw_cache_freshness;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

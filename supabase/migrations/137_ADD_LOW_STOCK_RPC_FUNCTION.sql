-- =====================================================
-- TIS TIS PLATFORM - FASE 3: Low Stock RPC Function
-- Migration: 137_ADD_LOW_STOCK_RPC_FUNCTION
-- Description: RPC function for caching layer to query low stock items
-- =====================================================

-- =====================================================
-- LOW STOCK ITEMS QUERY FUNCTION
-- =====================================================

/**
 * Get inventory items where current_stock < minimum_stock
 * Supports branch filtering and caching
 *
 * @param p_tenant_id - Required tenant ID
 * @param p_branch_id - Optional branch ID (null = all branches)
 * @returns Array of low stock items with branch context
 */
CREATE OR REPLACE FUNCTION get_low_stock_items(
    p_tenant_id UUID,
    p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    tenant_id UUID,
    branch_id UUID,
    branch_name TEXT,
    name TEXT,
    sku TEXT,
    current_stock INTEGER,
    minimum_stock INTEGER,
    stock_deficit INTEGER,
    unit TEXT,
    category TEXT,
    last_updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.tenant_id,
        i.branch_id,
        b.name AS branch_name,
        i.name,
        i.sku,
        i.current_stock,
        i.minimum_stock,
        (i.minimum_stock - i.current_stock) AS stock_deficit,
        i.unit,
        i.category,
        i.updated_at AS last_updated_at
    FROM inventory_items i
    LEFT JOIN branches b ON b.id = i.branch_id
    WHERE i.tenant_id = p_tenant_id
        AND i.current_stock < i.minimum_stock
        AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
    ORDER BY (i.minimum_stock - i.current_stock) DESC, i.name ASC;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
STABLE; -- STABLE because it doesn't modify data and result is consistent within transaction

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_low_stock_items(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_items(UUID, UUID) TO service_role;

-- =====================================================
-- ADDITIONAL HELPER FUNCTIONS FOR CACHING LAYER
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
    inventory_stats JSONB;
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

    -- Inventory statistics
    SELECT jsonb_build_object(
        'total_items', COUNT(*),
        'low_stock_items', COUNT(*) FILTER (WHERE current_stock < minimum_stock),
        'out_of_stock', COUNT(*) FILTER (WHERE current_stock = 0)
    )
    INTO inventory_stats
    FROM inventory_items
    WHERE tenant_id = p_tenant_id
        AND branch_id = p_branch_id;

    -- Combine all stats
    result := jsonb_build_object(
        'branch_id', p_branch_id,
        'leads', lead_stats,
        'appointments', appointment_stats,
        'inventory', inventory_stats,
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
-- CACHE-FRIENDLY VIEWS
-- =====================================================

/**
 * Materialized view for branch performance metrics
 * Refresh this view periodically (e.g., every 5 minutes via cron)
 * For use in analytics dashboard
 */
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_branch_performance_metrics AS
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

    -- Inventory health
    COUNT(DISTINCT ii.id) AS total_inventory_items,
    COUNT(DISTINCT ii.id) FILTER (WHERE ii.current_stock < ii.minimum_stock) AS low_stock_items,

    -- Last updated
    NOW() AS refreshed_at

FROM branches b
LEFT JOIN leads l ON l.branch_id = b.id AND l.tenant_id = b.tenant_id
LEFT JOIN appointments a ON a.branch_id = b.id AND a.tenant_id = b.tenant_id
LEFT JOIN inventory_items ii ON ii.branch_id = b.id AND ii.tenant_id = b.tenant_id
WHERE b.is_active = true
GROUP BY b.id, b.tenant_id, b.name, b.is_headquarters;

-- Create index on materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_branch_performance_branch_id
    ON mv_branch_performance_metrics(branch_id);

CREATE INDEX IF NOT EXISTS idx_mv_branch_performance_tenant
    ON mv_branch_performance_metrics(tenant_id);

-- Grant select permission
GRANT SELECT ON mv_branch_performance_metrics TO authenticated;
GRANT SELECT ON mv_branch_performance_metrics TO service_role;

-- =====================================================
-- REFRESH FUNCTION FOR MATERIALIZED VIEW
-- =====================================================

/**
 * Refresh branch performance metrics
 * Call this via cron job or API endpoint every 5 minutes
 */
CREATE OR REPLACE FUNCTION refresh_branch_performance_metrics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_branch_performance_metrics;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION refresh_branch_performance_metrics() TO service_role;

-- =====================================================
-- MONITORING QUERIES
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
-- DROP FUNCTION IF EXISTS get_low_stock_items(UUID, UUID);
-- DROP FUNCTION IF EXISTS get_branch_stats_summary(UUID, UUID);
-- DROP MATERIALIZED VIEW IF EXISTS mv_branch_performance_metrics CASCADE;
-- DROP FUNCTION IF EXISTS refresh_branch_performance_metrics();
-- DROP VIEW IF EXISTS vw_cache_freshness;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

-- =====================================================
-- TIS TIS PLATFORM - SOFT RESTAURANT BACKEND HELPERS
-- Migration: 159_SR_BACKEND_HELPER_FUNCTIONS.sql
-- Date: 2026-01-22
-- Purpose: Helper functions for SR backend integration
-- =====================================================

-- =====================================================
-- FUNCTION: Set session branch_id for RLS
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_session_branch_id(p_branch_id UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_branch_id', p_branch_id::TEXT, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.set_session_branch_id(UUID) IS
'Sets the session variable app.current_branch_id for RLS branch isolation.
Used by SR webhook endpoint to filter queries by branch.

Usage:
SELECT set_session_branch_id(''550e8400-e29b-41d4-a716-446655440000'');';

-- =====================================================
-- FUNCTION: Increment product mapping stats (atomic)
-- =====================================================

CREATE OR REPLACE FUNCTION public.increment_sr_product_mapping_stats(
    p_tenant_id UUID,
    p_branch_id UUID,
    p_integration_id UUID,
    p_product_code TEXT
)
RETURNS void AS $$
BEGIN
    UPDATE public.sr_product_mappings
    SET
        times_sold = times_sold + 1,
        last_sold_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND branch_id = p_branch_id
      AND integration_id = p_integration_id
      AND sr_product_code = p_product_code;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.increment_sr_product_mapping_stats IS
'Atomically increments times_sold for SR product mapping.
Prevents race conditions when multiple sales have the same product.';

-- =====================================================
-- FUNCTION: Get pending SR sales count
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_pending_sr_sales_count(
    p_tenant_id UUID,
    p_branch_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF p_branch_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count
        FROM public.sr_sales
        WHERE tenant_id = p_tenant_id
          AND branch_id = p_branch_id
          AND status = 'pending';
    ELSE
        SELECT COUNT(*) INTO v_count
        FROM public.sr_sales
        WHERE tenant_id = p_tenant_id
          AND status = 'pending';
    END IF;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_pending_sr_sales_count IS
'Returns count of pending SR sales for a tenant/branch.
Used for monitoring and dashboard widgets.';

-- =====================================================
-- FUNCTION: Get unmapped SR products
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_unmapped_sr_products(
    p_tenant_id UUID,
    p_branch_id UUID,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    sr_product_code TEXT,
    sr_product_name TEXT,
    times_sold INTEGER,
    last_sold_at TIMESTAMPTZ,
    total_revenue DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.sr_product_code,
        m.sr_product_name,
        m.times_sold,
        m.last_sold_at,
        COALESCE(SUM(i.subtotal_without_tax + i.tax_amount - i.discount_amount), 0) AS total_revenue
    FROM public.sr_product_mappings m
    LEFT JOIN public.sr_sale_items i ON i.product_code = m.sr_product_code
        AND i.tenant_id = m.tenant_id
        AND i.branch_id = m.branch_id
    WHERE m.tenant_id = p_tenant_id
      AND m.branch_id = p_branch_id
      AND m.menu_item_id IS NULL
      AND m.is_active = false
    GROUP BY m.sr_product_code, m.sr_product_name, m.times_sold, m.last_sold_at
    ORDER BY m.times_sold DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_unmapped_sr_products IS
'Returns list of SR products that need manual mapping.
Sorted by times_sold descending to prioritize popular items.';

-- =====================================================
-- COMPLETION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '======================================================';
    RAISE NOTICE 'Migration 159_SR_BACKEND_HELPER_FUNCTIONS.sql';
    RAISE NOTICE '======================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'HELPER FUNCTIONS CREATED:';
    RAISE NOTICE '  ✅ set_session_branch_id(UUID)';
    RAISE NOTICE '  ✅ increment_sr_product_mapping_stats(...)';
    RAISE NOTICE '  ✅ get_pending_sr_sales_count(UUID, UUID)';
    RAISE NOTICE '  ✅ get_unmapped_sr_products(UUID, UUID, INTEGER)';
    RAISE NOTICE '';
    RAISE NOTICE 'Backend integration ready!';
    RAISE NOTICE '======================================================';
END $$;

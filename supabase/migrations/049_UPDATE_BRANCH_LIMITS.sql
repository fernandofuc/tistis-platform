-- =====================================================
-- MIGRATION 049: Update Branch Limits Per Plan
--
-- New limits:
-- - Starter: 1 branch
-- - Essentials: 5 branches (was 3)
-- - Growth: 8 branches (was 5)
-- - Scale: 15 branches (was 10)
-- =====================================================

-- Update existing subscriptions with new limits based on plan
UPDATE public.subscriptions
SET max_branches = CASE plan
    WHEN 'starter' THEN 1
    WHEN 'essentials' THEN 5
    WHEN 'growth' THEN 8
    WHEN 'scale' THEN 15
    ELSE 5  -- default to essentials
END
WHERE status IN ('active', 'pending', 'past_due');

-- Verification
DO $$
DECLARE
    v_updated_count INT;
BEGIN
    SELECT COUNT(*) INTO v_updated_count
    FROM public.subscriptions
    WHERE status IN ('active', 'pending', 'past_due');

    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  Migration 049: Branch Limits Updated';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  New limits:';
    RAISE NOTICE '    - Starter: 1 branch';
    RAISE NOTICE '    - Essentials: 5 branches';
    RAISE NOTICE '    - Growth: 8 branches';
    RAISE NOTICE '    - Scale: 15 branches';
    RAISE NOTICE '  Updated % subscriptions', v_updated_count;
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- MIGRATION 082: Optimize Trial Conversion
-- Adds stripe_customer_id to get_trials_expiring_today for faster billing
-- =====================================================

-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_trials_expiring_today();

-- Recreate function with stripe_customer_id in return type
-- This allows the cron job to use the existing Stripe customer directly
-- instead of searching by email every time
CREATE OR REPLACE FUNCTION public.get_trials_expiring_today()
RETURNS TABLE (
  subscription_id UUID,
  client_id UUID,
  trial_end TIMESTAMPTZ,
  will_convert_to_paid BOOLEAN,
  client_email VARCHAR,
  client_name VARCHAR,
  stripe_customer_id VARCHAR  -- NEW: For optimized Stripe billing
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS subscription_id,
    s.client_id,
    s.trial_end,
    s.will_convert_to_paid,
    c.contact_email AS client_email,
    c.business_name AS client_name,
    COALESCE(s.stripe_customer_id, c.stripe_customer_id) AS stripe_customer_id  -- Try subscription first, then client
  FROM public.subscriptions s
  INNER JOIN public.clients c ON c.id = s.client_id
  WHERE
    s.trial_status = 'active'
    AND s.status = 'trialing'
    AND s.trial_end <= NOW()
  ORDER BY s.trial_end ASC
  LIMIT 1000;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_trials_expiring_today() IS
'Returns trials that have expired and need processing. Includes stripe_customer_id for optimized billing.';

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 082 completed - get_trials_expiring_today now returns stripe_customer_id';
END $$;

-- =====================================================
-- MIGRATION 080: Add retry_count to webhook_events
--
-- Tracks retry attempts for failed webhook events
-- Allows failed events to be retried by Stripe
-- =====================================================

-- Add retry_count column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'webhook_events'
        AND column_name = 'retry_count'
    ) THEN
        ALTER TABLE public.webhook_events ADD COLUMN retry_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Update index to help with failed event lookups
DROP INDEX IF EXISTS idx_webhook_events_status;
CREATE INDEX idx_webhook_events_status_retry ON public.webhook_events(status, retry_count)
WHERE status = 'failed';

-- Verification
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  Migration 080: Webhook Retry Count';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  - Added retry_count column to webhook_events';
    RAISE NOTICE '  - Updated index for failed event monitoring';
    RAISE NOTICE '=====================================================';
END $$;

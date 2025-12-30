-- =====================================================
-- MIGRATION 081: Webhook Events Index and Cleanup
--
-- Adds performance index and automatic cleanup for webhook_events table
-- Prevents table from growing indefinitely and causing slow queries
-- =====================================================

-- Add index on event_id for fast lookups (idempotency checks)
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);

-- Add index on processed_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON public.webhook_events(processed_at);

-- Create function to clean up old webhook events (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.webhook_events
    WHERE processed_at < NOW() - INTERVAL '30 days'
    AND status = 'success';  -- Only delete successful events, keep failed for debugging

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE 'Cleaned up % old webhook events', deleted_count;
    RETURN deleted_count;
END;
$$;

-- Create a scheduled cleanup (manual trigger - requires pg_cron extension or external cron)
-- This creates a function that can be called periodically
COMMENT ON FUNCTION cleanup_old_webhook_events IS
'Clean up webhook events older than 30 days. Call this periodically via cron or scheduled task.
Example: SELECT cleanup_old_webhook_events();';

-- Add column for attempt tracking if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'webhook_events'
        AND column_name = 'attempt_count'
    ) THEN
        ALTER TABLE public.webhook_events ADD COLUMN attempt_count INTEGER DEFAULT 1;
    END IF;
END $$;

-- Verification
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  Migration 081: Webhook Events Cleanup';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  - Added index on event_id for fast lookups';
    RAISE NOTICE '  - Added index on processed_at for cleanup';
    RAISE NOTICE '  - Created cleanup_old_webhook_events() function';
    RAISE NOTICE '  - Call SELECT cleanup_old_webhook_events() periodically';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- MIGRATION 048: Webhook Events Idempotency Table
--
-- Ensures Stripe webhooks are processed only once,
-- preventing duplicate processing on retries.
-- =====================================================

-- Create webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) NOT NULL UNIQUE,  -- Stripe event ID (evt_xxx)
    event_type VARCHAR(100) NOT NULL,        -- checkout.session.completed, etc.
    status VARCHAR(20) NOT NULL DEFAULT 'success', -- success, failed
    error_message TEXT,                       -- Error message if failed
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by event_id
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);

-- Index for cleanup queries (find old events)
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at);

-- Index for failed events monitoring
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events(status) WHERE status = 'failed';

-- Comment on table
COMMENT ON TABLE public.webhook_events IS 'Tracks processed Stripe webhook events for idempotency - prevents duplicate processing on retries';

-- RLS Policy: Only service role can access this table
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (webhooks use service role key)
CREATE POLICY "Service role full access to webhook_events"
ON public.webhook_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Optional: Create function to cleanup old events (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.webhook_events
    WHERE created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  Migration 048: Webhook Events Idempotency';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  - webhook_events table: Created';
    RAISE NOTICE '  - Indexes: event_id, created_at, status';
    RAISE NOTICE '  - RLS: Enabled (service_role only)';
    RAISE NOTICE '  - Cleanup function: cleanup_old_webhook_events()';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  ';
    RAISE NOTICE '  To cleanup old events manually:';
    RAISE NOTICE '  SELECT cleanup_old_webhook_events();';
    RAISE NOTICE '  ';
END $$;

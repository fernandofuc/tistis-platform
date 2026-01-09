-- =====================================================
-- TIS TIS PLATFORM - Fix Edge Case Scenarios
-- Migration 113: Critical fixes for edge cases found in REVISION 4.5
-- =====================================================
-- ISSUES FIXED:
--
-- H2: Empty message content causes constraint violation
-- H5: AI responses over 4096 chars fail silently on WhatsApp
-- H6: Tenant deactivated mid-processing continues running jobs
-- H7: Lead deleted during AI processing causes errors
-- H8: Jobs stuck in 'processing' state indefinitely
-- H9: conversation_metadata not created before read
--
-- SOLUTIONS:
-- - Relax constraint to allow placeholder for non-text messages
-- - Add max_message_length to channel config
-- - Add tenant status check to job claiming
-- - Add lead active check to AI processing
-- - Add timeout handling for stuck jobs
-- - Ensure conversation_metadata row exists
-- =====================================================

-- =====================================================
-- 1. FIX H2: Allow placeholder content for non-text messages
-- The constraint was too strict - audio/video/sticker need placeholders
-- =====================================================

-- Drop the old constraint
ALTER TABLE public.messages
    DROP CONSTRAINT IF EXISTS check_message_content_not_empty;

-- Add a more flexible constraint that allows system placeholders
ALTER TABLE public.messages
    ADD CONSTRAINT check_message_content_valid
    CHECK (
        content IS NOT NULL
        AND (
            -- Regular text must have actual content
            (message_type = 'text' AND LENGTH(TRIM(content)) > 0)
            -- Non-text can have placeholder like [Audio], [Image], etc.
            OR (message_type != 'text' AND LENGTH(content) > 0)
            -- System messages can be empty-ish
            OR sender_type = 'system'
        )
    );

COMMENT ON CONSTRAINT check_message_content_valid ON public.messages IS
'Ensures messages have valid content.
Text messages must have actual content.
Media messages can have placeholders like [Audio], [Image].
System messages are more flexible.
MODIFIED in migration 113 to fix H2.';

-- =====================================================
-- 2. FIX H5: Add channel message length limits
-- WhatsApp has 4096 char limit, other channels vary
-- =====================================================

-- Add max_message_length to channel_connections if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'channel_connections'
        AND column_name = 'max_message_length'
    ) THEN
        ALTER TABLE public.channel_connections
            ADD COLUMN max_message_length INTEGER DEFAULT 4096;

        -- Set defaults based on channel
        UPDATE public.channel_connections SET max_message_length = CASE
            WHEN channel = 'whatsapp' THEN 4096
            WHEN channel = 'instagram' THEN 1000
            WHEN channel = 'facebook' THEN 2000
            WHEN channel = 'tiktok' THEN 500
            ELSE 4096
        END;
    END IF;
END $$;

-- =====================================================
-- 3. FIX H6: Add tenant status check to job claiming
-- Don't process jobs for inactive tenants
-- =====================================================

CREATE OR REPLACE FUNCTION public.claim_next_job(
    p_job_types TEXT[] DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS public.job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job public.job_queue;
BEGIN
    -- Atomically select, lock, and update in one query
    -- FIXED: Added tenant status check to skip jobs for inactive tenants
    UPDATE public.job_queue jq
    SET
        status = 'processing',
        started_at = NOW(),
        attempts = COALESCE(attempts, 0) + 1,
        updated_at = NOW()
    WHERE jq.id = (
        SELECT jq2.id
        FROM public.job_queue jq2
        INNER JOIN public.tenants t ON jq2.tenant_id = t.id
        WHERE jq2.status = 'pending'
          AND jq2.scheduled_for <= NOW()
          AND t.status = 'active'  -- Only process for active tenants
          AND (p_job_types IS NULL OR jq2.job_type = ANY(p_job_types))
          AND (p_tenant_id IS NULL OR jq2.tenant_id = p_tenant_id)
        ORDER BY jq2.priority ASC, jq2.scheduled_for ASC
        LIMIT 1
        FOR UPDATE OF jq2 SKIP LOCKED
    )
    RETURNING * INTO v_job;

    RETURN v_job;
END;
$$;

COMMENT ON FUNCTION claim_next_job IS
'Atomically claims the next pending job from the queue.
FIXED in migration 113: Now checks tenant.status = active.
Jobs for inactive/suspended tenants are skipped.';

-- =====================================================
-- 4. FIX H7: Add lead active check function
-- For use before AI processing
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_lead_active(
    p_lead_id UUID
)
RETURNS TABLE(
    is_active BOOLEAN,
    lead_name TEXT,
    tenant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (l.deleted_at IS NULL) as is_active,
        COALESCE(l.full_name, l.name, 'Desconocido') as lead_name,
        l.tenant_id
    FROM leads l
    WHERE l.id = p_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION check_lead_active TO authenticated;
GRANT EXECUTE ON FUNCTION check_lead_active TO service_role;

COMMENT ON FUNCTION check_lead_active IS
'Checks if a lead is active (not soft-deleted) before AI processing.
Returns is_active=false if lead was deleted during processing.
CREATED in migration 113 to fix H7.';

-- =====================================================
-- 5. FIX H8: Add job timeout handling
-- Mark jobs as failed if stuck in processing too long
-- =====================================================

-- Add processing_timeout_minutes to ai_tenant_config if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ai_tenant_config'
        AND column_name = 'processing_timeout_minutes'
    ) THEN
        ALTER TABLE public.ai_tenant_config
            ADD COLUMN processing_timeout_minutes INTEGER DEFAULT 5;
    END IF;
END $$;

-- Function to cleanup stuck jobs (should be called by CRON)
CREATE OR REPLACE FUNCTION public.cleanup_stuck_jobs(
    p_timeout_minutes INTEGER DEFAULT 10
)
RETURNS TABLE(
    jobs_cleaned INTEGER,
    job_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cleaned_ids UUID[];
    v_count INTEGER;
BEGIN
    -- Find and mark stuck jobs as failed
    WITH stuck_jobs AS (
        UPDATE job_queue
        SET
            status = 'failed',
            error_message = 'Processing timeout - job exceeded ' || p_timeout_minutes || ' minutes',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE status = 'processing'
          AND started_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL
        RETURNING id
    )
    SELECT array_agg(id), COUNT(*)::INTEGER
    INTO v_cleaned_ids, v_count
    FROM stuck_jobs;

    -- Log if any jobs were cleaned up
    IF v_count > 0 THEN
        INSERT INTO security_audit_log (event_type, severity, details)
        VALUES (
            'stuck_jobs_cleanup',
            'medium',
            jsonb_build_object(
                'jobs_cleaned', v_count,
                'job_ids', v_cleaned_ids,
                'timeout_minutes', p_timeout_minutes,
                'timestamp', NOW()
            )
        );
    END IF;

    RETURN QUERY SELECT COALESCE(v_count, 0), COALESCE(v_cleaned_ids, ARRAY[]::UUID[]);
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_stuck_jobs TO service_role;

COMMENT ON FUNCTION cleanup_stuck_jobs IS
'Cleans up jobs stuck in processing state for too long.
Should be called by CRON every few minutes.
Marks stuck jobs as failed with timeout error.
CREATED in migration 113 to fix H8.';

-- =====================================================
-- 6. FIX H9: Ensure conversation_metadata exists
-- Create row if not exists when setting invoicing state
-- =====================================================

-- Modify set_invoicing_state to ensure row exists first
CREATE OR REPLACE FUNCTION public.set_invoicing_state(
    p_conversation_id UUID,
    p_state JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Get and validate tenant from conversation
    SELECT c.tenant_id INTO v_tenant_id
    FROM conversations c
    WHERE c.id = p_conversation_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Conversation not found: %', p_conversation_id;
    END IF;

    -- Ensure conversation_metadata row exists, then update
    INSERT INTO conversation_metadata (conversation_id, invoicing_state, updated_at)
    VALUES (p_conversation_id, p_state, NOW())
    ON CONFLICT (conversation_id) DO UPDATE
    SET invoicing_state = p_state,
        updated_at = NOW();
END;
$$;

-- Also ensure get_invoicing_state returns empty object instead of null
CREATE OR REPLACE FUNCTION public.get_invoicing_state(
    p_conversation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_state JSONB;
BEGIN
    -- Get and validate tenant from conversation
    SELECT c.tenant_id INTO v_tenant_id
    FROM conversations c
    WHERE c.id = p_conversation_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Conversation not found: %', p_conversation_id;
    END IF;

    -- Get the invoicing state
    SELECT cm.invoicing_state INTO v_state
    FROM conversation_metadata cm
    WHERE cm.conversation_id = p_conversation_id;

    -- Return empty object instead of null for safer handling
    RETURN COALESCE(v_state, '{}'::JSONB);
END;
$$;

-- =====================================================
-- 7. Add helper function to truncate message for channel
-- Used before sending to ensure message fits channel limits
-- =====================================================

CREATE OR REPLACE FUNCTION public.truncate_message_for_channel(
    p_message TEXT,
    p_channel VARCHAR(20) DEFAULT 'whatsapp',
    p_max_length INTEGER DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_max_length INTEGER;
    v_truncated TEXT;
BEGIN
    -- Get channel-specific max length
    v_max_length := COALESCE(p_max_length, CASE p_channel
        WHEN 'whatsapp' THEN 4096
        WHEN 'instagram' THEN 1000
        WHEN 'facebook' THEN 2000
        WHEN 'tiktok' THEN 500
        ELSE 4096
    END);

    -- If message fits, return as-is
    IF LENGTH(p_message) <= v_max_length THEN
        RETURN p_message;
    END IF;

    -- Truncate and add continuation marker
    v_truncated := SUBSTRING(p_message FROM 1 FOR (v_max_length - 50));

    -- Try to break at last sentence
    IF POSITION('.' IN REVERSE(v_truncated)) > 0 THEN
        v_truncated := SUBSTRING(v_truncated FROM 1 FOR (v_max_length - 50 - POSITION('.' IN REVERSE(v_truncated)) + 1));
    END IF;

    RETURN v_truncated || E'\n\n[Mensaje truncado por límite de caracteres]';
END;
$$;

COMMENT ON FUNCTION truncate_message_for_channel IS
'Truncates a message to fit channel-specific character limits.
Tries to break at sentence boundary for better UX.
Adds truncation notice at end.
CREATED in migration 113 to fix H5.';

-- =====================================================
-- 8. Add index for stuck job queries
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_job_queue_stuck
    ON job_queue(status, started_at)
    WHERE status = 'processing';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Fixed edge case scenarios:
-- [x] H2: Relaxed message content constraint for media types
-- [x] H5: Added max_message_length to channels + truncate function
-- [x] H6: claim_next_job now checks tenant.status = 'active'
-- [x] H7: Added check_lead_active function for AI processing
-- [x] H8: Added cleanup_stuck_jobs function for timeouts
-- [x] H9: set_invoicing_state ensures row exists first
-- =====================================================

SELECT 'Migration 113: Edge Case Scenarios Fixed - COMPLETADA' as status;

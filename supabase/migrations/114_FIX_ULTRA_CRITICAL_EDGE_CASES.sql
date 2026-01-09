-- =====================================================
-- TIS TIS PLATFORM - Fix Ultra-Critical Edge Cases
-- Migration 114: Critical fixes from REVISION 4.6
-- =====================================================
-- ISSUES FIXED:
--
-- U1: AI generates response but DB insert fails (token waste)
-- U3: Messages out of order (old timestamp arrives later)
-- U4: channel_connection disconnects mid-job
-- U7: WhatsApp API rate limiting (1000 msg/min)
-- U9: Meta/TikTok token expiration handling
--
-- SOLUTIONS:
-- - Add cached_ai_response to job_queue for retry
-- - Add message timestamp validation
-- - Add connection status check to job processing
-- - Add rate_limit tracking per channel
-- - Add token expiration tracking
-- =====================================================

-- =====================================================
-- 1. FIX U1: Cache AI response in job for retry
-- If DB insert fails, we can retry with cached response
-- =====================================================

-- Add column to store the generated AI response
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'job_queue'
        AND column_name = 'cached_result'
    ) THEN
        ALTER TABLE public.job_queue
            ADD COLUMN cached_result JSONB DEFAULT NULL;

        COMMENT ON COLUMN job_queue.cached_result IS
            'Stores intermediate results for retry. For AI jobs, caches the AI response
             so if DB insert fails, retry uses cached response instead of regenerating.
             CREATED in migration 114 to fix U1.';
    END IF;
END $$;

-- Function to cache AI response before DB operations
CREATE OR REPLACE FUNCTION public.cache_job_ai_response(
    p_job_id UUID,
    p_ai_response TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE job_queue
    SET cached_result = jsonb_build_object(
        'ai_response', p_ai_response,
        'metadata', p_metadata,
        'cached_at', NOW()
    ),
    updated_at = NOW()
    WHERE id = p_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION cache_job_ai_response TO service_role;

COMMENT ON FUNCTION cache_job_ai_response IS
'Caches AI response in job before attempting DB insert.
If insert fails and job retries, it uses cached response instead of
regenerating (which would consume more AI tokens).
CREATED in migration 114 to fix U1.';

-- =====================================================
-- 2. FIX U3: Message timestamp validation
-- Detect and handle out-of-order messages
-- =====================================================

-- Add timestamp columns for ordering
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'messages'
        AND column_name = 'external_timestamp'
    ) THEN
        ALTER TABLE public.messages
            ADD COLUMN external_timestamp TIMESTAMPTZ DEFAULT NULL;

        COMMENT ON COLUMN messages.external_timestamp IS
            'Original timestamp from external system (WhatsApp, etc.).
             Used to detect out-of-order message delivery.
             CREATED in migration 114 to fix U3.';
    END IF;
END $$;

-- Modified save_incoming_message to track external timestamp
CREATE OR REPLACE FUNCTION public.save_incoming_message_v2(
    p_conversation_id UUID,
    p_lead_id UUID,
    p_content TEXT,
    p_message_type VARCHAR(50),
    p_channel VARCHAR(20),
    p_media_url TEXT DEFAULT NULL,
    p_whatsapp_message_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_external_timestamp TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
    message_id UUID,
    is_duplicate BOOLEAN,
    conversation_reopened BOOLEAN,
    is_out_of_order BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_message_id UUID;
    v_is_duplicate BOOLEAN := false;
    v_conversation_reopened BOOLEAN := false;
    v_is_out_of_order BOOLEAN := false;
    v_last_message_at TIMESTAMPTZ;
    v_conversation_status TEXT;
BEGIN
    -- Check for duplicate based on whatsapp_message_id
    IF p_whatsapp_message_id IS NOT NULL THEN
        SELECT m.id INTO v_message_id
        FROM messages m
        WHERE m.metadata->>'whatsapp_message_id' = p_whatsapp_message_id
        LIMIT 1;

        IF v_message_id IS NOT NULL THEN
            v_is_duplicate := true;
            RETURN QUERY SELECT v_message_id, v_is_duplicate, v_conversation_reopened, v_is_out_of_order;
            RETURN;
        END IF;
    END IF;

    -- Get current conversation state
    SELECT c.status, c.last_message_at INTO v_conversation_status, v_last_message_at
    FROM conversations c
    WHERE c.id = p_conversation_id;

    -- Check if message is out of order
    IF p_external_timestamp IS NOT NULL AND v_last_message_at IS NOT NULL THEN
        IF p_external_timestamp < v_last_message_at THEN
            v_is_out_of_order := true;
            -- Log out-of-order message for analysis
            INSERT INTO security_audit_log (event_type, severity, details)
            VALUES (
                'message_out_of_order',
                'low',
                jsonb_build_object(
                    'conversation_id', p_conversation_id,
                    'external_timestamp', p_external_timestamp,
                    'last_message_at', v_last_message_at,
                    'delay_seconds', EXTRACT(EPOCH FROM (v_last_message_at - p_external_timestamp))
                )
            );
        END IF;
    END IF;

    -- Insert the message
    INSERT INTO messages (
        conversation_id,
        sender_type,
        sender_id,
        content,
        message_type,
        channel,
        media_url,
        status,
        external_timestamp,
        metadata
    ) VALUES (
        p_conversation_id,
        'lead',
        p_lead_id,
        p_content,
        p_message_type,
        p_channel,
        p_media_url,
        'received',
        p_external_timestamp,
        p_metadata || jsonb_build_object('whatsapp_message_id', p_whatsapp_message_id)
    )
    RETURNING id INTO v_message_id;

    -- Reopen conversation if closed/resolved
    IF v_conversation_status IN ('resolved', 'closed', 'archived') THEN
        UPDATE conversations
        SET status = 'active',
            last_message_at = GREATEST(NOW(), COALESCE(p_external_timestamp, NOW())),
            updated_at = NOW()
        WHERE id = p_conversation_id;
        v_conversation_reopened := true;
    ELSE
        -- Only update last_message_at if not out of order
        UPDATE conversations
        SET last_message_at = CASE
            WHEN v_is_out_of_order THEN last_message_at -- Keep existing
            ELSE GREATEST(NOW(), COALESCE(p_external_timestamp, NOW()))
        END,
        updated_at = NOW()
        WHERE id = p_conversation_id;
    END IF;

    RETURN QUERY SELECT v_message_id, v_is_duplicate, v_conversation_reopened, v_is_out_of_order;
END;
$$;

GRANT EXECUTE ON FUNCTION save_incoming_message_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION save_incoming_message_v2 TO service_role;

COMMENT ON FUNCTION save_incoming_message_v2 IS
'Enhanced version of save_incoming_message that:
- Detects out-of-order messages via external_timestamp
- Logs out-of-order events for monitoring
- Correctly handles timestamp ordering
CREATED in migration 114 to fix U3.';

-- =====================================================
-- 3. FIX U4: Connection status validation in job claiming
-- Don't process send jobs for disconnected channels
-- =====================================================

-- Add function to validate connection before processing send job
CREATE OR REPLACE FUNCTION public.validate_channel_connection_for_job(
    p_job_id UUID,
    p_channel_connection_id UUID
)
RETURNS TABLE(
    is_valid BOOLEAN,
    connection_status TEXT,
    error_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
    v_channel TEXT;
    v_token_expires_at TIMESTAMPTZ;
BEGIN
    -- Check connection status
    SELECT
        cc.status,
        cc.channel,
        COALESCE(
            cc.whatsapp_token_expires_at,
            cc.instagram_token_expires_at,
            cc.facebook_token_expires_at,
            cc.tiktok_token_expires_at
        )
    INTO v_status, v_channel, v_token_expires_at
    FROM channel_connections cc
    WHERE cc.id = p_channel_connection_id;

    -- Connection not found
    IF v_status IS NULL THEN
        RETURN QUERY SELECT false, 'not_found'::TEXT, 'Channel connection not found'::TEXT;
        RETURN;
    END IF;

    -- Connection not connected
    IF v_status != 'connected' THEN
        -- Mark job as failed immediately
        UPDATE job_queue
        SET status = 'failed',
            error_message = 'Channel disconnected: ' || v_status,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_job_id;

        RETURN QUERY SELECT false, v_status, ('Channel status is ' || v_status)::TEXT;
        RETURN;
    END IF;

    -- Token expired (if tracked)
    IF v_token_expires_at IS NOT NULL AND v_token_expires_at < NOW() THEN
        -- Log for token refresh alerting
        INSERT INTO security_audit_log (event_type, severity, details)
        VALUES (
            'token_expired',
            'high',
            jsonb_build_object(
                'channel_connection_id', p_channel_connection_id,
                'channel', v_channel,
                'expired_at', v_token_expires_at,
                'job_id', p_job_id
            )
        );

        RETURN QUERY SELECT false, 'token_expired'::TEXT, 'Access token has expired'::TEXT;
        RETURN;
    END IF;

    -- All checks passed
    RETURN QUERY SELECT true, v_status, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_channel_connection_for_job TO service_role;

COMMENT ON FUNCTION validate_channel_connection_for_job IS
'Validates channel connection before processing a send job.
Checks: connection exists, status=connected, token not expired.
CREATED in migration 114 to fix U4 and U9.';

-- =====================================================
-- 4. FIX U7: Rate limiting per channel
-- Track outbound message rates to stay within API limits
-- =====================================================

-- Create rate limit tracking table
CREATE TABLE IF NOT EXISTS public.channel_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_connection_id UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', NOW()),
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- One entry per connection per minute window
    CONSTRAINT unique_rate_limit_window UNIQUE (channel_connection_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_connection_window
    ON channel_rate_limits(channel_connection_id, window_start DESC);

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_channel_connection_id UUID,
    p_channel VARCHAR(20)
)
RETURNS TABLE(
    allowed BOOLEAN,
    current_count INTEGER,
    limit_count INTEGER,
    retry_after_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_start TIMESTAMPTZ := date_trunc('minute', NOW());
    v_current_count INTEGER;
    v_limit INTEGER;
BEGIN
    -- Set channel-specific limits (messages per minute)
    v_limit := CASE p_channel
        WHEN 'whatsapp' THEN 80  -- WhatsApp: ~80/min is safe (1000/min theoretical)
        WHEN 'instagram' THEN 30 -- Instagram: more conservative
        WHEN 'facebook' THEN 50  -- Facebook: moderate
        WHEN 'tiktok' THEN 10    -- TikTok: very limited (10/user/day)
        ELSE 30
    END;

    -- Upsert rate limit entry and get count
    INSERT INTO channel_rate_limits (channel_connection_id, window_start, message_count)
    VALUES (p_channel_connection_id, v_window_start, 1)
    ON CONFLICT (channel_connection_id, window_start)
    DO UPDATE SET message_count = channel_rate_limits.message_count + 1
    RETURNING message_count INTO v_current_count;

    -- Check if over limit
    IF v_current_count > v_limit THEN
        RETURN QUERY SELECT
            false,
            v_current_count,
            v_limit,
            (60 - EXTRACT(SECOND FROM NOW()))::INTEGER;  -- Seconds until next window
    ELSE
        RETURN QUERY SELECT true, v_current_count, v_limit, 0;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;

COMMENT ON FUNCTION check_rate_limit IS
'Checks if we can send a message within rate limits.
Returns allowed=false and retry_after_seconds if rate limited.
CREATED in migration 114 to fix U7.';

-- Cleanup old rate limit entries (call from CRON)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_entries(
    p_hours_old INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM channel_rate_limits
    WHERE window_start < NOW() - (p_hours_old || ' hours')::INTERVAL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_rate_limit_entries TO service_role;

-- =====================================================
-- 5. FIX U9: Token expiration tracking
-- Add token expiration columns if missing
-- =====================================================

DO $$
BEGIN
    -- WhatsApp token expiration
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'channel_connections'
        AND column_name = 'whatsapp_token_expires_at'
    ) THEN
        ALTER TABLE public.channel_connections
            ADD COLUMN whatsapp_token_expires_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    -- Instagram token expiration
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'channel_connections'
        AND column_name = 'instagram_token_expires_at'
    ) THEN
        ALTER TABLE public.channel_connections
            ADD COLUMN instagram_token_expires_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    -- Facebook token expiration
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'channel_connections'
        AND column_name = 'facebook_token_expires_at'
    ) THEN
        ALTER TABLE public.channel_connections
            ADD COLUMN facebook_token_expires_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    -- TikTok token expiration
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'channel_connections'
        AND column_name = 'tiktok_token_expires_at'
    ) THEN
        ALTER TABLE public.channel_connections
            ADD COLUMN tiktok_token_expires_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- Function to get connections with expiring tokens
CREATE OR REPLACE FUNCTION public.get_expiring_tokens(
    p_hours_ahead INTEGER DEFAULT 24
)
RETURNS TABLE(
    channel_connection_id UUID,
    tenant_id UUID,
    channel VARCHAR(20),
    expires_at TIMESTAMPTZ,
    hours_until_expiry NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cc.id as channel_connection_id,
        cc.tenant_id,
        cc.channel,
        COALESCE(
            cc.whatsapp_token_expires_at,
            cc.instagram_token_expires_at,
            cc.facebook_token_expires_at,
            cc.tiktok_token_expires_at
        ) as expires_at,
        EXTRACT(EPOCH FROM (
            COALESCE(
                cc.whatsapp_token_expires_at,
                cc.instagram_token_expires_at,
                cc.facebook_token_expires_at,
                cc.tiktok_token_expires_at
            ) - NOW()
        )) / 3600 as hours_until_expiry
    FROM channel_connections cc
    WHERE cc.status = 'connected'
      AND (
        (cc.channel = 'whatsapp' AND cc.whatsapp_token_expires_at < NOW() + (p_hours_ahead || ' hours')::INTERVAL)
        OR (cc.channel = 'instagram' AND cc.instagram_token_expires_at < NOW() + (p_hours_ahead || ' hours')::INTERVAL)
        OR (cc.channel = 'facebook' AND cc.facebook_token_expires_at < NOW() + (p_hours_ahead || ' hours')::INTERVAL)
        OR (cc.channel = 'tiktok' AND cc.tiktok_token_expires_at < NOW() + (p_hours_ahead || ' hours')::INTERVAL)
      )
    ORDER BY expires_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_expiring_tokens TO service_role;

COMMENT ON FUNCTION get_expiring_tokens IS
'Gets channel connections with tokens expiring within specified hours.
Used by CRON to alert admins about expiring tokens.
CREATED in migration 114 to fix U9.';

-- =====================================================
-- 6. Add indexes for new functionality
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_messages_external_timestamp
    ON messages(conversation_id, external_timestamp DESC)
    WHERE external_timestamp IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_queue_cached_result
    ON job_queue(id)
    WHERE cached_result IS NOT NULL;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Fixed ultra-critical edge cases:
-- [x] U1: Added cached_result to job_queue for AI response caching
-- [x] U3: Added external_timestamp tracking and out-of-order detection
-- [x] U4: Added validate_channel_connection_for_job function
-- [x] U7: Added channel_rate_limits table and check_rate_limit function
-- [x] U9: Added token expiration columns and get_expiring_tokens function
-- =====================================================

SELECT 'Migration 114: Ultra-Critical Edge Cases Fixed - COMPLETADA' as status;

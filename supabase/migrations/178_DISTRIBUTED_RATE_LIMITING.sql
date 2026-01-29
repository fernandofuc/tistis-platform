-- =====================================================
-- Migration 178: Distributed Rate Limiting System
-- =====================================================
-- Purpose: Replace in-memory rate limiting with persistent storage
-- that scales across multiple servers in production
-- =====================================================

-- Create rate limit entries table
CREATE TABLE IF NOT EXISTS rate_limit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint on identifier for upsert operations
  CONSTRAINT rate_limit_identifier_unique UNIQUE (identifier)
);

-- Create index for fast lookups by identifier
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit_entries(identifier);

-- Create index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_rate_limit_reset_at ON rate_limit_entries(reset_at);

-- Enable RLS but allow service role to manage entries
ALTER TABLE rate_limit_entries ENABLE ROW LEVEL SECURITY;

-- Policy for service role (used by API routes)
CREATE POLICY "Service role can manage rate limits"
ON rate_limit_entries
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- RPC: Atomic rate limit check and increment
-- =====================================================
-- This function atomically checks and increments the rate limit counter
-- Returns: { success: boolean, remaining: int, reset_at: timestamptz }

-- Drop existing function(s) with any signature to avoid conflicts
DROP FUNCTION IF EXISTS check_rate_limit(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS check_rate_limit(TEXT, INTEGER);
DROP FUNCTION IF EXISTS check_rate_limit(TEXT);

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_limit INTEGER DEFAULT 100,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_reset_at TIMESTAMPTZ := v_now + (p_window_seconds || ' seconds')::INTERVAL;
  v_entry rate_limit_entries%ROWTYPE;
  v_count INTEGER;
  v_remaining INTEGER;
  v_success BOOLEAN;
BEGIN
  -- Upsert the rate limit entry atomically
  INSERT INTO rate_limit_entries (identifier, count, reset_at)
  VALUES (p_identifier, 1, v_reset_at)
  ON CONFLICT (identifier) DO UPDATE
  SET
    -- If window expired, reset counter; otherwise increment
    count = CASE
      WHEN rate_limit_entries.reset_at < v_now THEN 1
      ELSE rate_limit_entries.count + 1
    END,
    -- If window expired, set new reset time; otherwise keep existing
    reset_at = CASE
      WHEN rate_limit_entries.reset_at < v_now THEN v_reset_at
      ELSE rate_limit_entries.reset_at
    END
  RETURNING * INTO v_entry;

  v_count := v_entry.count;
  v_remaining := GREATEST(0, p_limit - v_count);
  v_success := v_count <= p_limit;

  RETURN jsonb_build_object(
    'success', v_success,
    'limit', p_limit,
    'remaining', v_remaining,
    'reset', EXTRACT(EPOCH FROM v_entry.reset_at) * 1000,
    'count', v_count
  );
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- =====================================================
-- RPC: Cleanup expired entries
-- =====================================================
-- Called periodically to clean up expired rate limit entries
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Delete expired entries
  DELETE FROM rate_limit_entries
  WHERE reset_at < NOW();

  -- Get count of deleted rows using GET DIAGNOSTICS
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN COALESCE(v_deleted, 0);
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION cleanup_expired_rate_limits TO service_role;

-- =====================================================
-- Scheduled cleanup job using pg_cron (if available)
-- =====================================================
-- Note: Requires pg_cron extension to be enabled
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule(
--   'cleanup-rate-limits',
--   '*/5 * * * *',  -- Every 5 minutes
--   'SELECT cleanup_expired_rate_limits()'
-- );

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE rate_limit_entries IS 'Distributed rate limiting storage. Replaces in-memory Map for multi-server scaling.';
COMMENT ON COLUMN rate_limit_entries.identifier IS 'Unique identifier for rate limit (e.g., rate:ip:192.168.1.1:standard)';
COMMENT ON COLUMN rate_limit_entries.count IS 'Number of requests in current window';
COMMENT ON COLUMN rate_limit_entries.reset_at IS 'When the current window expires and counter resets';
COMMENT ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) IS 'Atomic rate limit check and increment. Returns success status and remaining quota.';
COMMENT ON FUNCTION cleanup_expired_rate_limits IS 'Cleanup expired rate limit entries. Call periodically.';

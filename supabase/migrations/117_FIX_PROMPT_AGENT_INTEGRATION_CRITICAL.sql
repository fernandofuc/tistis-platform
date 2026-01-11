-- =====================================================
-- Migration 117: Fix Prompt-Agent Integration Critical Issues
-- REVISIÓN 4.9 - Escenarios Críticos Adicionales
-- =====================================================
-- Fixes:
-- P12: Prompt changes mid-conversation (lock by conversation)
-- P13: BaseAgent ignores cached prompt (handled in code)
-- P20: Voice timeout handling
-- P22: Concurrent prompt generation race condition
-- =====================================================

-- =====================================================
-- P12 FIX: Lock prompt version per active conversation
-- =====================================================

-- Table to track which prompt version a conversation started with
CREATE TABLE IF NOT EXISTS public.conversation_prompt_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  prompt_hash TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id, channel)
);

-- FIX: Cannot use NOW() in index predicate (must be IMMUTABLE)
-- Instead, create a regular index on expires_at for efficient filtering
CREATE INDEX IF NOT EXISTS idx_conversation_prompt_locks_lookup
ON public.conversation_prompt_locks (tenant_id, conversation_id, channel, expires_at);

-- Function to get or lock prompt for a conversation
CREATE OR REPLACE FUNCTION public.get_locked_prompt_for_conversation(
  p_tenant_id UUID,
  p_conversation_id UUID,
  p_channel TEXT
)
RETURNS TABLE(
  generated_prompt TEXT,
  prompt_version INTEGER,
  source_data_hash TEXT,
  was_locked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_lock RECORD;
  v_current_prompt RECORD;
BEGIN
  -- Check for existing valid lock
  SELECT cpl.prompt_version, cpl.prompt_hash
  INTO v_existing_lock
  FROM public.conversation_prompt_locks cpl
  WHERE cpl.conversation_id = p_conversation_id
    AND cpl.channel = p_channel
    AND cpl.expires_at > NOW();

  -- Get current active prompt
  SELECT agp.generated_prompt, agp.prompt_version, agp.source_data_hash
  INTO v_current_prompt
  FROM public.ai_generated_prompts agp
  WHERE agp.tenant_id = p_tenant_id
    AND agp.channel = p_channel
    AND agp.status = 'active'
  LIMIT 1;

  IF v_current_prompt IS NULL THEN
    -- No prompt available
    RETURN QUERY SELECT NULL::TEXT, 0, NULL::TEXT, FALSE;
    RETURN;
  END IF;

  IF v_existing_lock IS NOT NULL THEN
    -- Lock exists, check if prompt version matches
    IF v_existing_lock.prompt_version = v_current_prompt.prompt_version THEN
      -- Same version, return current prompt
      RETURN QUERY SELECT
        v_current_prompt.generated_prompt,
        v_current_prompt.prompt_version,
        v_current_prompt.source_data_hash,
        TRUE;
    ELSE
      -- Version mismatch - conversation started with older version
      -- Get the historical prompt if available, or use current
      SELECT agp.generated_prompt, agp.prompt_version, agp.source_data_hash
      INTO v_current_prompt
      FROM public.ai_generated_prompts agp
      WHERE agp.tenant_id = p_tenant_id
        AND agp.channel = p_channel
        AND agp.prompt_version = v_existing_lock.prompt_version
      LIMIT 1;

      IF v_current_prompt IS NOT NULL THEN
        RETURN QUERY SELECT
          v_current_prompt.generated_prompt,
          v_current_prompt.prompt_version,
          v_current_prompt.source_data_hash,
          TRUE;
      ELSE
        -- Historical version not found, use current (fallback)
        RETURN QUERY SELECT
          v_current_prompt.generated_prompt,
          v_current_prompt.prompt_version,
          v_current_prompt.source_data_hash,
          FALSE;
      END IF;
    END IF;
  ELSE
    -- No lock exists, create one
    INSERT INTO public.conversation_prompt_locks (
      conversation_id,
      tenant_id,
      channel,
      prompt_version,
      prompt_hash,
      locked_at,
      expires_at
    ) VALUES (
      p_conversation_id,
      p_tenant_id,
      p_channel,
      v_current_prompt.prompt_version,
      v_current_prompt.source_data_hash,
      NOW(),
      NOW() + INTERVAL '2 hours'
    )
    ON CONFLICT (conversation_id, channel) DO UPDATE SET
      expires_at = NOW() + INTERVAL '2 hours';

    RETURN QUERY SELECT
      v_current_prompt.generated_prompt,
      v_current_prompt.prompt_version,
      v_current_prompt.source_data_hash,
      TRUE;
  END IF;
END;
$$;

-- =====================================================
-- P20 FIX: Track voice response times and detect slow responses
-- =====================================================

-- Function to check if voice responses are within acceptable latency
CREATE OR REPLACE FUNCTION public.check_voice_latency_health(
  p_tenant_id UUID,
  p_threshold_ms INTEGER DEFAULT 5000
)
RETURNS TABLE(
  avg_latency_ms NUMERIC,
  p95_latency_ms NUMERIC,
  calls_exceeding_threshold INTEGER,
  total_recent_calls INTEGER,
  health_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH recent_calls AS (
    SELECT
      vc.latency_avg_ms,
      vc.id
    FROM public.voice_calls vc
    WHERE vc.tenant_id = p_tenant_id
      AND vc.created_at > NOW() - INTERVAL '24 hours'
      AND vc.latency_avg_ms IS NOT NULL
  )
  SELECT
    COALESCE(AVG(rc.latency_avg_ms), 0)::NUMERIC AS avg_latency_ms,
    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY rc.latency_avg_ms), 0)::NUMERIC AS p95_latency_ms,
    COUNT(*) FILTER (WHERE rc.latency_avg_ms > p_threshold_ms)::INTEGER AS calls_exceeding_threshold,
    COUNT(*)::INTEGER AS total_recent_calls,
    CASE
      WHEN COUNT(*) = 0 THEN 'NO_DATA'
      WHEN PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY rc.latency_avg_ms) > p_threshold_ms * 1.5 THEN 'CRITICAL'
      WHEN PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY rc.latency_avg_ms) > p_threshold_ms THEN 'WARNING'
      ELSE 'OK'
    END AS health_status
  FROM recent_calls rc;
END;
$$;

-- =====================================================
-- P22 FIX: Prevent concurrent prompt generation
-- =====================================================

-- Table to track active prompt generation jobs
CREATE TABLE IF NOT EXISTS public.prompt_generation_locks (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by TEXT,  -- server instance identifier
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
  UNIQUE(tenant_id, channel)
);

-- Function to acquire lock for prompt generation
CREATE OR REPLACE FUNCTION public.acquire_prompt_generation_lock(
  p_tenant_id UUID,
  p_channel TEXT,
  p_locked_by TEXT DEFAULT NULL
)
RETURNS TABLE(
  acquired BOOLEAN,
  existing_lock_expires_at TIMESTAMPTZ,
  wait_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_lock RECORD;
BEGIN
  -- Check for existing non-expired lock
  SELECT pgl.expires_at
  INTO v_existing_lock
  FROM public.prompt_generation_locks pgl
  WHERE pgl.tenant_id = p_tenant_id
    AND pgl.channel = p_channel
    AND pgl.expires_at > NOW()
  FOR UPDATE SKIP LOCKED;

  IF v_existing_lock IS NOT NULL THEN
    -- Lock exists and is valid
    RETURN QUERY SELECT
      FALSE,
      v_existing_lock.expires_at,
      EXTRACT(EPOCH FROM (v_existing_lock.expires_at - NOW()))::INTEGER;
    RETURN;
  END IF;

  -- Try to acquire lock
  INSERT INTO public.prompt_generation_locks (
    tenant_id,
    channel,
    locked_at,
    locked_by,
    expires_at
  ) VALUES (
    p_tenant_id,
    p_channel,
    NOW(),
    p_locked_by,
    NOW() + INTERVAL '2 minutes'
  )
  ON CONFLICT (tenant_id, channel) DO UPDATE SET
    locked_at = NOW(),
    locked_by = p_locked_by,
    expires_at = NOW() + INTERVAL '2 minutes'
  WHERE prompt_generation_locks.expires_at <= NOW();

  -- Check if we got the lock
  IF FOUND THEN
    RETURN QUERY SELECT TRUE, NULL::TIMESTAMPTZ, 0;
  ELSE
    -- Couldn't acquire, return existing lock info
    SELECT pgl.expires_at
    INTO v_existing_lock
    FROM public.prompt_generation_locks pgl
    WHERE pgl.tenant_id = p_tenant_id
      AND pgl.channel = p_channel;

    RETURN QUERY SELECT
      FALSE,
      v_existing_lock.expires_at,
      COALESCE(EXTRACT(EPOCH FROM (v_existing_lock.expires_at - NOW()))::INTEGER, 0);
  END IF;
END;
$$;

-- Function to release prompt generation lock
CREATE OR REPLACE FUNCTION public.release_prompt_generation_lock(
  p_tenant_id UUID,
  p_channel TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.prompt_generation_locks
  WHERE tenant_id = p_tenant_id
    AND channel = p_channel;

  RETURN FOUND;
END;
$$;

-- =====================================================
-- P19 FIX: Agent error recovery - don't escalate immediately
-- =====================================================

-- Table to track agent errors for smarter recovery
CREATE TABLE IF NOT EXISTS public.agent_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID,
  agent_name TEXT NOT NULL,
  error_type TEXT NOT NULL,  -- 'timeout', 'api_error', 'validation', 'unknown'
  error_message TEXT,
  recovery_action TEXT,  -- 'retry', 'fallback_agent', 'escalate'
  retry_count INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FIX: Cannot use NOW() in index predicate (must be IMMUTABLE)
-- Instead, create a regular index with created_at for efficient time-based filtering
CREATE INDEX IF NOT EXISTS idx_agent_error_log_recent
ON public.agent_error_log (tenant_id, agent_name, created_at DESC);

-- Function to determine recovery action based on error history
CREATE OR REPLACE FUNCTION public.get_agent_recovery_action(
  p_tenant_id UUID,
  p_agent_name TEXT,
  p_error_type TEXT,
  p_conversation_id UUID DEFAULT NULL
)
RETURNS TABLE(
  recommended_action TEXT,
  fallback_agent TEXT,
  should_retry BOOLEAN,
  recent_error_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recent_errors INTEGER;
  v_conversation_errors INTEGER;
BEGIN
  -- Count recent errors for this agent
  SELECT COUNT(*) INTO v_recent_errors
  FROM public.agent_error_log ael
  WHERE ael.tenant_id = p_tenant_id
    AND ael.agent_name = p_agent_name
    AND ael.created_at > NOW() - INTERVAL '5 minutes';

  -- Count errors in this conversation
  IF p_conversation_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_conversation_errors
    FROM public.agent_error_log ael
    WHERE ael.conversation_id = p_conversation_id
      AND ael.agent_name = p_agent_name;
  ELSE
    v_conversation_errors := 0;
  END IF;

  -- Determine action
  IF v_conversation_errors >= 2 THEN
    -- Too many errors in this conversation, escalate
    RETURN QUERY SELECT
      'escalate'::TEXT,
      NULL::TEXT,
      FALSE,
      v_recent_errors;
  ELSIF p_error_type = 'timeout' AND v_recent_errors < 3 THEN
    -- Timeout with low error rate, retry once
    RETURN QUERY SELECT
      'retry'::TEXT,
      NULL::TEXT,
      TRUE,
      v_recent_errors;
  ELSIF p_error_type = 'api_error' THEN
    -- API error, try fallback agent
    RETURN QUERY SELECT
      'fallback_agent'::TEXT,
      'general'::TEXT,
      FALSE,
      v_recent_errors;
  ELSIF v_recent_errors >= 5 THEN
    -- High error rate, escalate
    RETURN QUERY SELECT
      'escalate'::TEXT,
      NULL::TEXT,
      FALSE,
      v_recent_errors;
  ELSE
    -- Default: try general agent
    RETURN QUERY SELECT
      'fallback_agent'::TEXT,
      'general'::TEXT,
      FALSE,
      v_recent_errors;
  END IF;
END;
$$;

-- =====================================================
-- Cleanup job for expired locks
-- =====================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_prompt_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Clean conversation prompt locks
  DELETE FROM public.conversation_prompt_locks
  WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Clean generation locks
  DELETE FROM public.prompt_generation_locks
  WHERE expires_at < NOW();

  RETURN v_deleted;
END;
$$;

-- =====================================================
-- View: Agent health monitoring
-- =====================================================

CREATE OR REPLACE VIEW public.v_agent_health_dashboard AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  ael.agent_name,
  COUNT(*) FILTER (WHERE ael.created_at > NOW() - INTERVAL '1 hour') AS errors_last_hour,
  COUNT(*) FILTER (WHERE ael.created_at > NOW() - INTERVAL '24 hours') AS errors_last_24h,
  COUNT(*) FILTER (WHERE ael.error_type = 'timeout') AS timeout_errors,
  COUNT(*) FILTER (WHERE ael.error_type = 'api_error') AS api_errors,
  MODE() WITHIN GROUP (ORDER BY ael.recovery_action) AS most_common_recovery,
  CASE
    WHEN COUNT(*) FILTER (WHERE ael.created_at > NOW() - INTERVAL '1 hour') > 10 THEN 'CRITICAL'
    WHEN COUNT(*) FILTER (WHERE ael.created_at > NOW() - INTERVAL '1 hour') > 5 THEN 'WARNING'
    ELSE 'OK'
  END AS health_status
FROM public.tenants t
LEFT JOIN public.agent_error_log ael ON t.id = ael.tenant_id
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.name, ael.agent_name
ORDER BY errors_last_hour DESC NULLS LAST;

-- Grant permissions
GRANT SELECT ON public.v_agent_health_dashboard TO authenticated;

-- =====================================================
-- Log migration
-- =====================================================

-- FIX: audit_logs uses 'metadata' column, not 'changes'
INSERT INTO public.audit_logs (action, entity_type, metadata, created_at)
VALUES (
  'migration_applied',
  'database',
  jsonb_build_object(
    'migration', '117_FIX_PROMPT_AGENT_INTEGRATION_CRITICAL',
    'fixes', ARRAY['P12', 'P19', 'P20', 'P22'],
    'tables_created', ARRAY['conversation_prompt_locks', 'prompt_generation_locks', 'agent_error_log'],
    'description', 'Critical prompt-agent integration and error recovery fixes'
  ),
  NOW()
);

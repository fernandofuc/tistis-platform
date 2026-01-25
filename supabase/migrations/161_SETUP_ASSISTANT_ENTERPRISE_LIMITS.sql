-- =====================================================
-- TIS TIS PLATFORM - Migration 161
-- SETUP ASSISTANT: Add Enterprise Plan Limits
-- Updates get_setup_usage_with_limits to support enterprise tier
-- =====================================================

-- =====================================================
-- 1. UPDATE RPC: get_setup_usage_with_limits
-- Now includes enterprise plan with unlimited usage
-- =====================================================

DROP FUNCTION IF EXISTS get_setup_usage_with_limits(UUID);

CREATE OR REPLACE FUNCTION get_setup_usage_with_limits(
  p_tenant_id UUID
) RETURNS TABLE (
  messages_count INT,
  messages_limit INT,
  files_uploaded INT,
  files_limit INT,
  vision_requests INT,
  vision_limit INT,
  total_tokens BIGINT,
  tokens_limit BIGINT,
  plan_id TEXT,
  plan_name TEXT,
  is_at_limit BOOLEAN,
  reset_at TIMESTAMPTZ
) AS $$
DECLARE
  v_plan_id TEXT;
  v_plan_name TEXT;
  v_messages_limit INT;
  v_files_limit INT;
  v_vision_limit INT;
  v_tokens_limit BIGINT;
BEGIN
  -- Validate input
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  -- Get active subscription plan for tenant
  -- Check for active or trialing subscriptions
  SELECT
    COALESCE(s.plan_id, 'starter'),
    COALESCE(p.name, 'Starter')
  INTO v_plan_id, v_plan_name
  FROM tenants t
  LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN ('active', 'trialing')
  LEFT JOIN plans p ON p.id = s.plan_id
  WHERE t.id = p_tenant_id;

  -- Default if tenant not found
  IF v_plan_id IS NULL THEN
    v_plan_id := 'starter';
    v_plan_name := 'Starter';
  END IF;

  -- Set limits based on plan
  -- Active plans: starter < essentials < growth < enterprise
  CASE LOWER(v_plan_id)
    WHEN 'starter' THEN
      v_messages_limit := 20;
      v_files_limit := 3;
      v_vision_limit := 2;
      v_tokens_limit := 10000;
    WHEN 'essentials' THEN
      v_messages_limit := 50;
      v_files_limit := 10;
      v_vision_limit := 5;
      v_tokens_limit := 50000;
    WHEN 'growth' THEN
      v_messages_limit := 200;
      v_files_limit := 50;
      v_vision_limit := 25;
      v_tokens_limit := 200000;
    WHEN 'enterprise' THEN
      -- Enterprise: effectively unlimited (999999 for practical purposes)
      v_messages_limit := 999999;
      v_files_limit := 999999;
      v_vision_limit := 999999;
      v_tokens_limit := 999999999;
    ELSE
      -- Default to starter limits for unknown plans
      v_messages_limit := 20;
      v_files_limit := 3;
      v_vision_limit := 2;
      v_tokens_limit := 10000;
  END CASE;

  -- Return usage with limits
  RETURN QUERY
  SELECT
    COALESCE(u.messages_count, 0)::INT AS messages_count,
    v_messages_limit AS messages_limit,
    COALESCE(u.files_uploaded, 0)::INT AS files_uploaded,
    v_files_limit AS files_limit,
    COALESCE(u.vision_requests, 0)::INT AS vision_requests,
    v_vision_limit AS vision_limit,
    (COALESCE(u.total_input_tokens, 0) + COALESCE(u.total_output_tokens, 0))::BIGINT AS total_tokens,
    v_tokens_limit AS tokens_limit,
    v_plan_id AS plan_id,
    v_plan_name AS plan_name,
    -- Enterprise is never at limit
    CASE
      WHEN LOWER(v_plan_id) = 'enterprise' THEN FALSE
      ELSE (
        COALESCE(u.messages_count, 0) >= v_messages_limit OR
        COALESCE(u.files_uploaded, 0) >= v_files_limit OR
        COALESCE(u.vision_requests, 0) >= v_vision_limit
      )
    END::BOOLEAN AS is_at_limit,
    -- Reset time is midnight UTC next day
    (DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day')::TIMESTAMPTZ AS reset_at
  FROM (SELECT 1) AS dummy
  LEFT JOIN setup_assistant_usage u
    ON u.tenant_id = p_tenant_id
    AND u.usage_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_setup_usage_with_limits IS
  'Returns current Setup Assistant usage with plan-based limits (starter, essentials, growth, enterprise) and reset time';

-- =====================================================
-- 2. CREATE RPC: check_setup_action_allowed
-- Helper function to check if an action is allowed
-- =====================================================

CREATE OR REPLACE FUNCTION check_setup_action_allowed(
  p_tenant_id UUID,
  p_action TEXT -- 'message', 'file', or 'vision'
) RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  current_count INT,
  limit_count INT
) AS $$
DECLARE
  v_usage RECORD;
BEGIN
  -- Validate input
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF p_action NOT IN ('message', 'file', 'vision') THEN
    RAISE EXCEPTION 'action must be one of: message, file, vision';
  END IF;

  -- Get current usage with limits
  SELECT * INTO v_usage
  FROM get_setup_usage_with_limits(p_tenant_id);

  -- Check based on action type
  CASE p_action
    WHEN 'message' THEN
      RETURN QUERY SELECT
        (v_usage.messages_count < v_usage.messages_limit)::BOOLEAN AS allowed,
        CASE
          WHEN v_usage.messages_count >= v_usage.messages_limit
          THEN format('Has alcanzado el límite de %s mensajes diarios.', v_usage.messages_limit)
          ELSE NULL
        END AS reason,
        v_usage.messages_count AS current_count,
        v_usage.messages_limit AS limit_count;

    WHEN 'file' THEN
      RETURN QUERY SELECT
        (v_usage.files_uploaded < v_usage.files_limit)::BOOLEAN AS allowed,
        CASE
          WHEN v_usage.files_uploaded >= v_usage.files_limit
          THEN format('Has alcanzado el límite de %s archivos diarios.', v_usage.files_limit)
          ELSE NULL
        END AS reason,
        v_usage.files_uploaded AS current_count,
        v_usage.files_limit AS limit_count;

    WHEN 'vision' THEN
      RETURN QUERY SELECT
        (v_usage.vision_requests < v_usage.vision_limit)::BOOLEAN AS allowed,
        CASE
          WHEN v_usage.vision_requests >= v_usage.vision_limit
          THEN format('Has alcanzado el límite de %s análisis de imagen diarios.', v_usage.vision_limit)
          ELSE NULL
        END AS reason,
        v_usage.vision_requests AS current_count,
        v_usage.vision_limit AS limit_count;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_setup_action_allowed IS
  'Checks if a specific action (message, file, vision) is allowed based on tenant plan limits';

-- =====================================================
-- FIN DE MIGRACIÓN 161
-- =====================================================

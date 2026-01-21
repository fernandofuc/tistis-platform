-- =====================================================
-- TIS TIS Platform - Migration 151
-- FIX SUPABASE SECURITY ADVISOR ERRORS
--
-- Fixes 20 security issues reported by Supabase Security Advisor:
-- - 13 Security Definer Views -> Changed to SECURITY INVOKER
-- - 7 RLS Disabled Tables -> Enabled RLS with appropriate policies
-- =====================================================

-- =====================================================
-- PART 1: FIX SECURITY DEFINER VIEWS
-- Change all views from SECURITY DEFINER to SECURITY INVOKER
-- =====================================================

-- 1. v_voice_agent_v2_summary
ALTER VIEW IF EXISTS public.v_voice_agent_v2_summary SET (security_invoker = true);

-- 2. v_inventory_waste_summary
ALTER VIEW IF EXISTS public.v_inventory_waste_summary SET (security_invoker = true);

-- 3. v_safety_dashboard
ALTER VIEW IF EXISTS public.v_safety_dashboard SET (security_invoker = true);

-- 4. v_ai_system_health
ALTER VIEW IF EXISTS public.v_ai_system_health SET (security_invoker = true);

-- 5. v_pending_embeddings
ALTER VIEW IF EXISTS public.v_pending_embeddings SET (security_invoker = true);

-- 6. v_inbox_conversations
ALTER VIEW IF EXISTS public.v_inbox_conversations SET (security_invoker = true);

-- 7. v_order_consumption_summary
ALTER VIEW IF EXISTS public.v_order_consumption_summary SET (security_invoker = true);

-- 8. v_agent_health_dashboard
ALTER VIEW IF EXISTS public.v_agent_health_dashboard SET (security_invoker = true);

-- 9. v_appointment_loyalty_summary
ALTER VIEW IF EXISTS public.v_appointment_loyalty_summary SET (security_invoker = true);

-- 10. v_ai_v7_adoption_stats
ALTER VIEW IF EXISTS public.v_ai_v7_adoption_stats SET (security_invoker = true);

-- 11. v_prompt_health_dashboard
ALTER VIEW IF EXISTS public.v_prompt_health_dashboard SET (security_invoker = true);

-- 12. v_ai_booking_analytics
ALTER VIEW IF EXISTS public.v_ai_booking_analytics SET (security_invoker = true);

-- 13. v_critical_instructions_stats
ALTER VIEW IF EXISTS public.v_critical_instructions_stats SET (security_invoker = true);

-- =====================================================
-- PART 2: ENABLE RLS ON TABLES WITHOUT RLS
-- =====================================================

-- 1. conversation_prompt_locks
-- This table is used for locking during prompt generation
ALTER TABLE IF EXISTS public.conversation_prompt_locks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access (internal system table)
DROP POLICY IF EXISTS "conversation_prompt_locks_service_only" ON public.conversation_prompt_locks;
CREATE POLICY "conversation_prompt_locks_service_only" ON public.conversation_prompt_locks
  FOR ALL
  USING (
    current_setting('role', true) = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- 2. prompt_generation_locks
-- This table is used for locking during prompt generation
ALTER TABLE IF EXISTS public.prompt_generation_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompt_generation_locks_service_only" ON public.prompt_generation_locks;
CREATE POLICY "prompt_generation_locks_service_only" ON public.prompt_generation_locks
  FOR ALL
  USING (
    current_setting('role', true) = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- 3. agent_error_log
-- Error logs should be accessible by tenant users
ALTER TABLE IF EXISTS public.agent_error_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_error_log_tenant_isolation" ON public.agent_error_log;
CREATE POLICY "agent_error_log_tenant_isolation" ON public.agent_error_log
  FOR ALL
  USING (
    current_setting('role', true) = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

-- 4. langgraph_checkpoints
-- LangGraph internal table - service role only
ALTER TABLE IF EXISTS public.langgraph_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "langgraph_checkpoints_service_only" ON public.langgraph_checkpoints;
CREATE POLICY "langgraph_checkpoints_service_only" ON public.langgraph_checkpoints
  FOR ALL
  USING (
    current_setting('role', true) = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- 5. channel_rate_limits
-- Rate limits accessible by tenant users through channel_connections relationship
-- Note: This table has channel_connection_id, not direct tenant_id
ALTER TABLE IF EXISTS public.channel_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel_rate_limits_tenant_isolation" ON public.channel_rate_limits;
CREATE POLICY "channel_rate_limits_tenant_isolation" ON public.channel_rate_limits
  FOR ALL
  USING (
    current_setting('role', true) = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.channel_connections cc
      WHERE cc.id = channel_rate_limits.channel_connection_id
      AND cc.tenant_id IN (
        SELECT tenant_id FROM public.user_roles
        WHERE user_id = auth.uid()
      )
    )
  );

-- 6. langgraph_checkpoint_writes
-- LangGraph internal table - service role only
ALTER TABLE IF EXISTS public.langgraph_checkpoint_writes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "langgraph_checkpoint_writes_service_only" ON public.langgraph_checkpoint_writes;
CREATE POLICY "langgraph_checkpoint_writes_service_only" ON public.langgraph_checkpoint_writes
  FOR ALL
  USING (
    current_setting('role', true) = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- 7. langgraph_checkpoint_blobs
-- LangGraph internal table - service role only
ALTER TABLE IF EXISTS public.langgraph_checkpoint_blobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "langgraph_checkpoint_blobs_service_only" ON public.langgraph_checkpoint_blobs;
CREATE POLICY "langgraph_checkpoint_blobs_service_only" ON public.langgraph_checkpoint_blobs
  FOR ALL
  USING (
    current_setting('role', true) = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 151: Fixed 20 Supabase Security Advisor errors';
  RAISE NOTICE '- 13 views changed from SECURITY DEFINER to SECURITY INVOKER';
  RAISE NOTICE '- 7 tables now have RLS enabled with appropriate policies';
END $$;

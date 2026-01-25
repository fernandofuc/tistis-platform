-- =====================================================
-- TIS TIS PLATFORM - Migration 160
-- SETUP ASSISTANT SYSTEM
-- AI-powered configuration assistant for tenants
-- =====================================================

-- =====================================================
-- 1. TABLA PRINCIPAL: setup_assistant_conversations
-- Stores conversation sessions for the setup assistant
-- =====================================================

CREATE TABLE IF NOT EXISTS setup_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant and user identification
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Conversation state
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'archived')),

  -- Current setup context
  current_module TEXT CHECK (current_module IN (
    'general', 'loyalty', 'agents', 'knowledge_base',
    'services', 'promotions', 'staff', 'branches', NULL
  )),

  -- Progress tracking per module
  -- Example: { "loyalty": "completed", "services": "in_progress", "agents": "pending" }
  setup_progress JSONB NOT NULL DEFAULT '{}',

  -- Conversation metadata
  title TEXT,                              -- AI-generated title
  summary TEXT,                            -- Summary of what was configured

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_setup_conversations_tenant_status
  ON setup_assistant_conversations(tenant_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_setup_conversations_user_status
  ON setup_assistant_conversations(user_id, status);

CREATE INDEX IF NOT EXISTS idx_setup_conversations_tenant_created
  ON setup_assistant_conversations(tenant_id, created_at DESC);

-- RLS
ALTER TABLE setup_assistant_conversations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can access conversations of their tenant
CREATE POLICY "setup_conversations_tenant_access"
  ON setup_assistant_conversations
  FOR ALL USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE setup_assistant_conversations IS
  'Stores AI Setup Assistant conversation sessions for guided configuration';
COMMENT ON COLUMN setup_assistant_conversations.current_module IS
  'Current module being configured: general, loyalty, agents, knowledge_base, services, promotions, staff, branches';
COMMENT ON COLUMN setup_assistant_conversations.setup_progress IS
  'JSON tracking progress per module: { module_name: "pending"|"in_progress"|"completed" }';

-- =====================================================
-- 2. TABLA DE MENSAJES: setup_assistant_messages
-- Individual messages within conversations
-- =====================================================

CREATE TABLE IF NOT EXISTS setup_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationship to conversation
  conversation_id UUID NOT NULL
    REFERENCES setup_assistant_conversations(id) ON DELETE CASCADE,

  -- Tenant ID for RLS (denormalized for performance)
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Attachments (images, documents)
  -- Format: [{ "type": "image"|"document", "url": "...", "filename": "...", "mimeType": "...", "size": 123, "analysis": {...} }]
  attachments JSONB NOT NULL DEFAULT '[]',

  -- Actions executed by the assistant
  -- Format: [{ "type": "create"|"update"|"delete"|"configure", "module": "...", "entityType": "...", "entityId": "...", "status": "success"|"failure", "details": {...} }]
  actions_taken JSONB NOT NULL DEFAULT '[]',

  -- Token usage tracking
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient pagination and lookups
CREATE INDEX IF NOT EXISTS idx_setup_messages_conversation_created
  ON setup_assistant_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_setup_messages_tenant_created
  ON setup_assistant_messages(tenant_id, created_at DESC);

-- GIN index for searching in actions_taken
CREATE INDEX IF NOT EXISTS idx_setup_messages_actions_gin
  ON setup_assistant_messages USING GIN (actions_taken jsonb_path_ops);

-- RLS
ALTER TABLE setup_assistant_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can access messages of their tenant
CREATE POLICY "setup_messages_tenant_access"
  ON setup_assistant_messages
  FOR ALL USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE setup_assistant_messages IS
  'Individual messages within Setup Assistant conversations';
COMMENT ON COLUMN setup_assistant_messages.attachments IS
  'Array of file attachments with optional AI analysis results';
COMMENT ON COLUMN setup_assistant_messages.actions_taken IS
  'Array of configuration actions executed by the assistant';

-- =====================================================
-- 3. TABLA DE USO: setup_assistant_usage
-- Daily usage tracking for rate limiting
-- =====================================================

CREATE TABLE IF NOT EXISTS setup_assistant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant identification
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Usage period (one record per tenant per day)
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Usage counters
  messages_count INT NOT NULL DEFAULT 0,
  files_uploaded INT NOT NULL DEFAULT 0,
  vision_requests INT NOT NULL DEFAULT 0,
  total_input_tokens BIGINT NOT NULL DEFAULT 0,
  total_output_tokens BIGINT NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint: one record per tenant per day
  CONSTRAINT setup_usage_tenant_date_unique UNIQUE(tenant_id, usage_date)
);

-- Index for usage queries
CREATE INDEX IF NOT EXISTS idx_setup_usage_tenant_date
  ON setup_assistant_usage(tenant_id, usage_date DESC);

-- RLS
ALTER TABLE setup_assistant_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only READ usage of their tenant
CREATE POLICY "setup_usage_tenant_read"
  ON setup_assistant_usage
  FOR SELECT USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

-- Policy: Service role can insert/update (for API routes)
CREATE POLICY "setup_usage_service_insert"
  ON setup_assistant_usage
  FOR INSERT WITH CHECK (
    current_setting('role', true) = 'service_role'
    OR tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "setup_usage_service_update"
  ON setup_assistant_usage
  FOR UPDATE USING (
    current_setting('role', true) = 'service_role'
    OR tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'owner')
    )
  );

-- Comments
COMMENT ON TABLE setup_assistant_usage IS
  'Daily usage tracking for Setup Assistant rate limiting by plan';
COMMENT ON COLUMN setup_assistant_usage.usage_date IS
  'The date this usage record applies to (resets daily at midnight UTC)';

-- =====================================================
-- 4. FUNCIÓN RPC: increment_setup_usage
-- Atomically increments usage counters (upsert pattern)
-- =====================================================

CREATE OR REPLACE FUNCTION increment_setup_usage(
  p_tenant_id UUID,
  p_messages INT DEFAULT 0,
  p_files INT DEFAULT 0,
  p_vision INT DEFAULT 0,
  p_input_tokens BIGINT DEFAULT 0,
  p_output_tokens BIGINT DEFAULT 0
) RETURNS setup_assistant_usage AS $$
DECLARE
  v_result setup_assistant_usage;
BEGIN
  -- Validate input
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  -- Upsert with atomic increment
  INSERT INTO setup_assistant_usage (
    tenant_id,
    usage_date,
    messages_count,
    files_uploaded,
    vision_requests,
    total_input_tokens,
    total_output_tokens
  ) VALUES (
    p_tenant_id,
    CURRENT_DATE,
    GREATEST(0, p_messages),
    GREATEST(0, p_files),
    GREATEST(0, p_vision),
    GREATEST(0, p_input_tokens),
    GREATEST(0, p_output_tokens)
  )
  ON CONFLICT (tenant_id, usage_date)
  DO UPDATE SET
    messages_count = setup_assistant_usage.messages_count + GREATEST(0, p_messages),
    files_uploaded = setup_assistant_usage.files_uploaded + GREATEST(0, p_files),
    vision_requests = setup_assistant_usage.vision_requests + GREATEST(0, p_vision),
    total_input_tokens = setup_assistant_usage.total_input_tokens + GREATEST(0, p_input_tokens),
    total_output_tokens = setup_assistant_usage.total_output_tokens + GREATEST(0, p_output_tokens),
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_setup_usage IS
  'Atomically increments Setup Assistant usage counters (upsert pattern). Use SECURITY DEFINER to bypass RLS.';

-- =====================================================
-- 5. FUNCIÓN RPC: get_setup_usage_with_limits
-- Returns current usage with plan-based limits
-- =====================================================

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
  -- Active plans: starter < essentials < growth
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
    COALESCE(u.total_input_tokens + u.total_output_tokens, 0)::BIGINT AS total_tokens,
    v_tokens_limit AS tokens_limit,
    v_plan_id AS plan_id,
    v_plan_name AS plan_name,
    (
      COALESCE(u.messages_count, 0) >= v_messages_limit OR
      COALESCE(u.files_uploaded, 0) >= v_files_limit OR
      COALESCE(u.vision_requests, 0) >= v_vision_limit
    )::BOOLEAN AS is_at_limit,
    -- Reset time is midnight UTC next day
    (DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day')::TIMESTAMPTZ AS reset_at
  FROM (SELECT 1) AS dummy
  LEFT JOIN setup_assistant_usage u
    ON u.tenant_id = p_tenant_id
    AND u.usage_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_setup_usage_with_limits IS
  'Returns current Setup Assistant usage with plan-based limits and reset time';

-- =====================================================
-- 6. TRIGGERS: Auto-update updated_at
-- Uses existing public.update_updated_at_column() function
-- (defined in 012_CONSOLIDATED_SCHEMA.sql)
-- =====================================================

-- Trigger for conversations
DROP TRIGGER IF EXISTS trigger_setup_conversations_updated ON setup_assistant_conversations;
CREATE TRIGGER trigger_setup_conversations_updated
  BEFORE UPDATE ON setup_assistant_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for usage
DROP TRIGGER IF EXISTS trigger_setup_usage_updated ON setup_assistant_usage;
CREATE TRIGGER trigger_setup_usage_updated
  BEFORE UPDATE ON setup_assistant_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 7. STORAGE BUCKET: setup-assistant-uploads
-- For file uploads (images, documents)
-- =====================================================

-- Create bucket if not exists (this may fail silently if bucket exists)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'setup-assistant-uploads',
    'setup-assistant-uploads',
    false,  -- Private bucket
    10485760,  -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  -- Bucket may already exist or storage extension not installed
  RAISE NOTICE 'Could not create storage bucket: %', SQLERRM;
END $$;

-- RLS for storage bucket
-- IMPORTANT: Files MUST be stored with path pattern: {tenant_id}/{user_id}/{timestamp}-{uuid}.{ext}
-- This ensures tenant isolation via path-based validation (first segment = tenant_id)
DO $$
BEGIN
  -- Policy for authenticated users to upload to their tenant folder
  -- Validates that the first path segment (tenant_id) matches user's tenant
  DROP POLICY IF EXISTS "setup_uploads_tenant_insert" ON storage.objects;
  CREATE POLICY "setup_uploads_tenant_insert"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'setup-assistant-uploads'
      AND auth.uid() IS NOT NULL
      -- Extract tenant_id from path (first segment) and validate user has access
      AND (storage.foldername(name))[1]::UUID IN (
        SELECT ur.tenant_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
      )
    );

  -- Policy for authenticated users to read from their tenant folder
  DROP POLICY IF EXISTS "setup_uploads_tenant_select" ON storage.objects;
  CREATE POLICY "setup_uploads_tenant_select"
    ON storage.objects
    FOR SELECT
    USING (
      bucket_id = 'setup-assistant-uploads'
      AND auth.uid() IS NOT NULL
      AND (storage.foldername(name))[1]::UUID IN (
        SELECT ur.tenant_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
      )
    );

  -- Policy for authenticated users to delete their uploads
  DROP POLICY IF EXISTS "setup_uploads_tenant_delete" ON storage.objects;
  CREATE POLICY "setup_uploads_tenant_delete"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'setup-assistant-uploads'
      AND auth.uid() IS NOT NULL
      AND (storage.foldername(name))[1]::UUID IN (
        SELECT ur.tenant_id FROM user_roles ur
        WHERE ur.user_id = auth.uid()
      )
    );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create storage policies: %', SQLERRM;
END $$;

-- =====================================================
-- FIN DE MIGRACIÓN 160
-- =====================================================

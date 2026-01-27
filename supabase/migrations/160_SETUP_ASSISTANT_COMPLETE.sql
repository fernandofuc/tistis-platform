-- =====================================================
-- TIS TIS PLATFORM - SETUP ASSISTANT SYSTEM (CONSOLIDADO)
-- Consolidates: 160, 161, 164
-- Date: 2026-01-26
-- Version: 1.0 CONSOLIDATED
--
-- Este archivo consolida las siguientes migraciones:
-- - 160_SETUP_ASSISTANT_SYSTEM.sql (tablas base)
-- - 161_SETUP_ASSISTANT_ENTERPRISE_LIMITS.sql (limites enterprise)
-- - 164_SETUP_ASSISTANT_CHECKPOINTS.sql (LangGraph checkpoints)
--
-- PROPÓSITO: Sistema completo de Setup Assistant con:
-- - Conversaciones y mensajes del asistente de configuración
-- - Tracking de uso con límites por plan
-- - Persistencia de estado LangGraph para recovery
-- - Storage bucket para uploads
--
-- DEPENDENCIAS: tenants, user_roles, plans, subscriptions
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Iniciando Setup Assistant System (Consolidado)';
    RAISE NOTICE 'Combina migraciones: 160, 161, 164';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- PARTE 1: TABLAS PRINCIPALES (de 160)
-- =====================================================

-- 1.1 setup_assistant_conversations
CREATE TABLE IF NOT EXISTS setup_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'archived')),
  current_module TEXT CHECK (current_module IN (
    'general', 'loyalty', 'agents', 'knowledge_base',
    'services', 'promotions', 'staff', 'branches', NULL
  )),
  setup_progress JSONB NOT NULL DEFAULT '{}',
  title TEXT,
  summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para conversaciones
CREATE INDEX IF NOT EXISTS idx_setup_conversations_tenant_status
  ON setup_assistant_conversations(tenant_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_setup_conversations_user_status
  ON setup_assistant_conversations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_setup_conversations_tenant_created
  ON setup_assistant_conversations(tenant_id, created_at DESC);

-- RLS para conversaciones
ALTER TABLE setup_assistant_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "setup_conversations_tenant_access" ON setup_assistant_conversations;
CREATE POLICY "setup_conversations_tenant_access"
  ON setup_assistant_conversations
  FOR ALL USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

COMMENT ON TABLE setup_assistant_conversations IS
  'Stores AI Setup Assistant conversation sessions for guided configuration';

-- 1.2 setup_assistant_messages
CREATE TABLE IF NOT EXISTS setup_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL
    REFERENCES setup_assistant_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]',
  actions_taken JSONB NOT NULL DEFAULT '[]',
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mensajes
CREATE INDEX IF NOT EXISTS idx_setup_messages_conversation_created
  ON setup_assistant_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_setup_messages_tenant_created
  ON setup_assistant_messages(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_setup_messages_actions_gin
  ON setup_assistant_messages USING GIN (actions_taken jsonb_path_ops);

-- RLS para mensajes
ALTER TABLE setup_assistant_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "setup_messages_tenant_access" ON setup_assistant_messages;
CREATE POLICY "setup_messages_tenant_access"
  ON setup_assistant_messages
  FOR ALL USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

COMMENT ON TABLE setup_assistant_messages IS
  'Individual messages within Setup Assistant conversations';

-- 1.3 setup_assistant_usage
CREATE TABLE IF NOT EXISTS setup_assistant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_count INT NOT NULL DEFAULT 0,
  files_uploaded INT NOT NULL DEFAULT 0,
  vision_requests INT NOT NULL DEFAULT 0,
  total_input_tokens BIGINT NOT NULL DEFAULT 0,
  total_output_tokens BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT setup_usage_tenant_date_unique UNIQUE(tenant_id, usage_date)
);

-- Índices para usage
CREATE INDEX IF NOT EXISTS idx_setup_usage_tenant_date
  ON setup_assistant_usage(tenant_id, usage_date DESC);

-- RLS para usage
ALTER TABLE setup_assistant_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "setup_usage_tenant_read" ON setup_assistant_usage;
CREATE POLICY "setup_usage_tenant_read"
  ON setup_assistant_usage
  FOR SELECT USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "setup_usage_service_insert" ON setup_assistant_usage;
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

DROP POLICY IF EXISTS "setup_usage_service_update" ON setup_assistant_usage;
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

COMMENT ON TABLE setup_assistant_usage IS
  'Daily usage tracking for Setup Assistant rate limiting by plan';

-- =====================================================
-- PARTE 2: LANGGRAPH CHECKPOINTS (de 164)
-- =====================================================

CREATE TABLE IF NOT EXISTS setup_assistant_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL,
  checkpoint_ns text NOT NULL DEFAULT '',
  checkpoint_id text NOT NULL,
  parent_checkpoint_id text,
  checkpoint_data jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT setup_assistant_checkpoints_unique
    UNIQUE (thread_id, checkpoint_ns, checkpoint_id)
);

-- Índices para checkpoints
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_id
  ON setup_assistant_checkpoints(thread_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_ns
  ON setup_assistant_checkpoints(thread_id, checkpoint_ns);
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_created
  ON setup_assistant_checkpoints(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkpoints_parent
  ON setup_assistant_checkpoints(parent_checkpoint_id)
  WHERE parent_checkpoint_id IS NOT NULL;

-- RLS para checkpoints (solo service role)
ALTER TABLE setup_assistant_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON setup_assistant_checkpoints;
CREATE POLICY "service_role_full_access" ON setup_assistant_checkpoints
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE setup_assistant_checkpoints IS
  'Stores LangGraph checkpoints for Setup Assistant session recovery';

-- =====================================================
-- PARTE 3: FUNCIONES RPC
-- =====================================================

-- 3.1 increment_setup_usage
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
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  INSERT INTO setup_assistant_usage (
    tenant_id, usage_date, messages_count, files_uploaded,
    vision_requests, total_input_tokens, total_output_tokens
  ) VALUES (
    p_tenant_id, CURRENT_DATE, GREATEST(0, p_messages),
    GREATEST(0, p_files), GREATEST(0, p_vision),
    GREATEST(0, p_input_tokens), GREATEST(0, p_output_tokens)
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
  'Atomically increments Setup Assistant usage counters';

-- 3.2 get_setup_usage_with_limits (con Enterprise de 161)
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
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  SELECT
    COALESCE(s.plan_id, 'starter'),
    COALESCE(p.name, 'Starter')
  INTO v_plan_id, v_plan_name
  FROM tenants t
  LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN ('active', 'trialing')
  LEFT JOIN plans p ON p.id = s.plan_id
  WHERE t.id = p_tenant_id;

  IF v_plan_id IS NULL THEN
    v_plan_id := 'starter';
    v_plan_name := 'Starter';
  END IF;

  -- Límites por plan (incluye enterprise de 161)
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
      v_messages_limit := 999999;
      v_files_limit := 999999;
      v_vision_limit := 999999;
      v_tokens_limit := 999999999;
    ELSE
      v_messages_limit := 20;
      v_files_limit := 3;
      v_vision_limit := 2;
      v_tokens_limit := 10000;
  END CASE;

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
    CASE
      WHEN LOWER(v_plan_id) = 'enterprise' THEN FALSE
      ELSE (
        COALESCE(u.messages_count, 0) >= v_messages_limit OR
        COALESCE(u.files_uploaded, 0) >= v_files_limit OR
        COALESCE(u.vision_requests, 0) >= v_vision_limit
      )
    END::BOOLEAN AS is_at_limit,
    (DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day')::TIMESTAMPTZ AS reset_at
  FROM (SELECT 1) AS dummy
  LEFT JOIN setup_assistant_usage u
    ON u.tenant_id = p_tenant_id
    AND u.usage_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_setup_usage_with_limits IS
  'Returns Setup Assistant usage with plan-based limits (starter, essentials, growth, enterprise)';

-- 3.3 check_setup_action_allowed (de 161)
CREATE OR REPLACE FUNCTION check_setup_action_allowed(
  p_tenant_id UUID,
  p_action TEXT
) RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  current_count INT,
  limit_count INT
) AS $$
DECLARE
  v_usage RECORD;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF p_action NOT IN ('message', 'file', 'vision') THEN
    RAISE EXCEPTION 'action must be one of: message, file, vision';
  END IF;

  SELECT * INTO v_usage FROM get_setup_usage_with_limits(p_tenant_id);

  CASE p_action
    WHEN 'message' THEN
      RETURN QUERY SELECT
        (v_usage.messages_count < v_usage.messages_limit)::BOOLEAN,
        CASE WHEN v_usage.messages_count >= v_usage.messages_limit
          THEN format('Has alcanzado el límite de %s mensajes diarios.', v_usage.messages_limit)
          ELSE NULL END,
        v_usage.messages_count,
        v_usage.messages_limit;
    WHEN 'file' THEN
      RETURN QUERY SELECT
        (v_usage.files_uploaded < v_usage.files_limit)::BOOLEAN,
        CASE WHEN v_usage.files_uploaded >= v_usage.files_limit
          THEN format('Has alcanzado el límite de %s archivos diarios.', v_usage.files_limit)
          ELSE NULL END,
        v_usage.files_uploaded,
        v_usage.files_limit;
    WHEN 'vision' THEN
      RETURN QUERY SELECT
        (v_usage.vision_requests < v_usage.vision_limit)::BOOLEAN,
        CASE WHEN v_usage.vision_requests >= v_usage.vision_limit
          THEN format('Has alcanzado el límite de %s análisis diarios.', v_usage.vision_limit)
          ELSE NULL END,
        v_usage.vision_requests,
        v_usage.vision_limit;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_setup_action_allowed IS
  'Checks if a specific action is allowed based on tenant plan limits';

-- 3.4 cleanup_old_checkpoints (de 164)
CREATE OR REPLACE FUNCTION cleanup_old_checkpoints(
  p_thread_id text,
  p_keep_count int DEFAULT 10
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count int := 0;
BEGIN
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY thread_id, checkpoint_ns
             ORDER BY created_at DESC
           ) as rn
    FROM setup_assistant_checkpoints
    WHERE thread_id = p_thread_id
  ),
  to_delete AS (
    SELECT id FROM ranked WHERE rn > p_keep_count
  )
  DELETE FROM setup_assistant_checkpoints
  WHERE id IN (SELECT id FROM to_delete);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- 3.5 cleanup_all_old_checkpoints (de 164)
CREATE OR REPLACE FUNCTION cleanup_all_old_checkpoints(
  p_keep_count int DEFAULT 10,
  p_max_age interval DEFAULT '30 days'::interval
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count int := 0;
  v_total_deleted int := 0;
  v_thread record;
BEGIN
  DELETE FROM setup_assistant_checkpoints
  WHERE created_at < now() - p_max_age;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_total_deleted := v_total_deleted + v_deleted_count;

  FOR v_thread IN (
    SELECT DISTINCT thread_id FROM setup_assistant_checkpoints
  ) LOOP
    SELECT cleanup_old_checkpoints(v_thread.thread_id, p_keep_count) INTO v_deleted_count;
    v_total_deleted := v_total_deleted + v_deleted_count;
  END LOOP;

  RETURN v_total_deleted;
END;
$$;

-- =====================================================
-- PARTE 4: TRIGGERS
-- =====================================================

-- Auto-cleanup de checkpoints
CREATE OR REPLACE FUNCTION trigger_cleanup_old_checkpoints()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF random() < 0.1 THEN
    PERFORM cleanup_old_checkpoints(NEW.thread_id, 10);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_cleanup_checkpoints ON setup_assistant_checkpoints;
CREATE TRIGGER tr_cleanup_checkpoints
  AFTER INSERT ON setup_assistant_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cleanup_old_checkpoints();

-- Auto-update updated_at (usa función existente si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS trigger_setup_conversations_updated ON setup_assistant_conversations;
    CREATE TRIGGER trigger_setup_conversations_updated
      BEFORE UPDATE ON setup_assistant_conversations
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS trigger_setup_usage_updated ON setup_assistant_usage;
    CREATE TRIGGER trigger_setup_usage_updated
      BEFORE UPDATE ON setup_assistant_usage
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- =====================================================
-- PARTE 5: STORAGE BUCKET
-- =====================================================

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'setup-assistant-uploads',
    'setup-assistant-uploads',
    false,
    10485760,  -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create storage bucket: %', SQLERRM;
END $$;

-- Storage RLS policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "setup_uploads_tenant_insert" ON storage.objects;
  CREATE POLICY "setup_uploads_tenant_insert"
    ON storage.objects FOR INSERT WITH CHECK (
      bucket_id = 'setup-assistant-uploads'
      AND auth.uid() IS NOT NULL
      AND (storage.foldername(name))[1]::UUID IN (
        SELECT ur.tenant_id FROM user_roles ur WHERE ur.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "setup_uploads_tenant_select" ON storage.objects;
  CREATE POLICY "setup_uploads_tenant_select"
    ON storage.objects FOR SELECT USING (
      bucket_id = 'setup-assistant-uploads'
      AND auth.uid() IS NOT NULL
      AND (storage.foldername(name))[1]::UUID IN (
        SELECT ur.tenant_id FROM user_roles ur WHERE ur.user_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "setup_uploads_tenant_delete" ON storage.objects;
  CREATE POLICY "setup_uploads_tenant_delete"
    ON storage.objects FOR DELETE USING (
      bucket_id = 'setup-assistant-uploads'
      AND auth.uid() IS NOT NULL
      AND (storage.foldername(name))[1]::UUID IN (
        SELECT ur.tenant_id FROM user_roles ur WHERE ur.user_id = auth.uid()
      )
    );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create storage policies: %', SQLERRM;
END $$;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'SETUP ASSISTANT SYSTEM (CONSOLIDADO) - COMPLETADO';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tablas creadas:';
  RAISE NOTICE '  - setup_assistant_conversations';
  RAISE NOTICE '  - setup_assistant_messages';
  RAISE NOTICE '  - setup_assistant_usage';
  RAISE NOTICE '  - setup_assistant_checkpoints';
  RAISE NOTICE '';
  RAISE NOTICE 'Funciones RPC:';
  RAISE NOTICE '  - increment_setup_usage()';
  RAISE NOTICE '  - get_setup_usage_with_limits() [con Enterprise]';
  RAISE NOTICE '  - check_setup_action_allowed()';
  RAISE NOTICE '  - cleanup_old_checkpoints()';
  RAISE NOTICE '  - cleanup_all_old_checkpoints()';
  RAISE NOTICE '';
  RAISE NOTICE 'Storage bucket: setup-assistant-uploads';
  RAISE NOTICE '';
  RAISE NOTICE 'Consolida: 160, 161, 164';
  RAISE NOTICE '=====================================================';
END $$;

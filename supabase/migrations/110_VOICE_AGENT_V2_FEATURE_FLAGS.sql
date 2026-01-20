-- =====================================================
-- VOICE AGENT V2 - FEATURE FLAGS AND MIGRATION TABLES
-- Migration: 110
-- Description: Creates tables for Voice Agent v2 feature flags,
--              migration tracking, and metrics aggregation.
-- =====================================================

-- ===========================================
-- SECTION 1: PLATFORM FEATURE FLAGS TABLE
-- ===========================================

-- Platform-level feature flags table for gradual rollouts (distinct from client feature_flags)
-- Used for Voice Agent v2 rollout and future platform-wide feature flags
CREATE TABLE IF NOT EXISTS platform_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  percentage INTEGER DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  enabled_tenants TEXT[] DEFAULT '{}',
  disabled_tenants TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Index for quick lookups by name
CREATE INDEX IF NOT EXISTS idx_platform_feature_flags_name ON platform_feature_flags(name);

-- Index for finding flags by enabled status
CREATE INDEX IF NOT EXISTS idx_platform_feature_flags_enabled ON platform_feature_flags(enabled);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_platform_feature_flags_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_platform_feature_flags_updated_at ON platform_feature_flags;
CREATE TRIGGER trigger_platform_feature_flags_updated_at
  BEFORE UPDATE ON platform_feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_feature_flags_timestamp();

-- ===========================================
-- SECTION 2: PLATFORM FEATURE FLAG AUDIT LOG
-- ===========================================

CREATE TABLE IF NOT EXISTS platform_feature_flag_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'enabled', 'disabled', 'percentage_changed', 'tenant_added', 'tenant_removed'
  old_value JSONB,
  new_value JSONB,
  changed_by TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying audit log by flag
CREATE INDEX IF NOT EXISTS idx_platform_feature_flag_audit_flag_name ON platform_feature_flag_audit_log(flag_name);

-- Index for querying audit log by date
CREATE INDEX IF NOT EXISTS idx_platform_feature_flag_audit_created_at ON platform_feature_flag_audit_log(created_at DESC);

-- ===========================================
-- SECTION 3: MIGRATION BACKUPS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS migration_backups (
  id VARCHAR(100) PRIMARY KEY,
  tables TEXT[] NOT NULL,
  record_count INTEGER DEFAULT 0,
  backup_data JSONB,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'restored'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  restored_at TIMESTAMPTZ
);

-- Index for finding backups by status
CREATE INDEX IF NOT EXISTS idx_migration_backups_status ON migration_backups(status);

-- ===========================================
-- SECTION 4: MIGRATION ROLLBACK LOG
-- ===========================================

CREATE TABLE IF NOT EXISTS migration_rollback_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rollback_level VARCHAR(50) NOT NULL, -- 'tenant', 'partial', 'total', 'data'
  action TEXT NOT NULL,
  affected_records INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}',
  executed_by TEXT,
  reason TEXT,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying rollbacks by date
CREATE INDEX IF NOT EXISTS idx_rollback_log_executed_at ON migration_rollback_log(executed_at DESC);

-- ===========================================
-- SECTION 5: VOICE ASSISTANT CONFIGS (V2)
-- ===========================================

-- Check if table exists before creating
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_assistant_configs') THEN
    CREATE TABLE voice_assistant_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      assistant_type_id VARCHAR(50) NOT NULL,
      vapi_assistant_id VARCHAR(100),
      phone_number_id VARCHAR(100),
      voice_id VARCHAR(50) NOT NULL DEFAULT 'coral',
      voice_speed DECIMAL(3,2) DEFAULT 1.0 CHECK (voice_speed >= 0.5 AND voice_speed <= 2.0),
      personality_type VARCHAR(50) DEFAULT 'friendly',
      special_instructions TEXT,
      enabled_capabilities TEXT[] DEFAULT '{}',
      template_version VARCHAR(10) DEFAULT '1',
      is_active BOOLEAN DEFAULT true,
      schema_version VARCHAR(10) DEFAULT 'v2',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      migrated_from_v1 BOOLEAN DEFAULT false,
      migrated_at TIMESTAMPTZ,
      original_prompt_hash VARCHAR(32)
    );

    -- Indexes for voice_assistant_configs
    CREATE INDEX idx_voice_assistant_configs_business ON voice_assistant_configs(business_id);
    CREATE INDEX idx_voice_assistant_configs_active ON voice_assistant_configs(is_active);
    CREATE INDEX idx_voice_assistant_configs_type ON voice_assistant_configs(assistant_type_id);
  END IF;
END;
$$;

-- ===========================================
-- SECTION 6: VOICE ASSISTANT METRICS
-- ===========================================

CREATE TABLE IF NOT EXISTS voice_assistant_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_calls INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  avg_duration_seconds INTEGER DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  p50_latency_ms INTEGER DEFAULT 0,
  p95_latency_ms INTEGER DEFAULT 0,
  reservations_created INTEGER DEFAULT 0,
  appointments_created INTEGER DEFAULT 0,
  orders_created INTEGER DEFAULT 0,
  human_transfers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one record per business per period
  UNIQUE(business_id, period_start, period_end)
);

-- Indexes for metrics queries
CREATE INDEX IF NOT EXISTS idx_voice_metrics_business ON voice_assistant_metrics(business_id);
CREATE INDEX IF NOT EXISTS idx_voice_metrics_period ON voice_assistant_metrics(period_start, period_end);

-- ===========================================
-- SECTION 7: ADD API_VERSION TO VOICE_CALLS
-- ===========================================

-- Add api_version column to track which version handled each call
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_calls' AND column_name = 'api_version'
  ) THEN
    ALTER TABLE voice_calls ADD COLUMN api_version VARCHAR(10) DEFAULT 'v1';
  END IF;
END;
$$;

-- Index for filtering by version
CREATE INDEX IF NOT EXISTS idx_voice_calls_api_version ON voice_calls(api_version);

-- ===========================================
-- SECTION 8: INSERT DEFAULT FEATURE FLAG
-- ===========================================

-- Insert the voice_agent_v2 feature flag with default values
INSERT INTO platform_feature_flags (name, description, enabled, percentage, enabled_tenants, disabled_tenants)
VALUES (
  'voice_agent_v2',
  'Voice Agent v2.0 gradual rollout flag. Controls which tenants use the new voice agent system.',
  false,
  0,
  '{}',
  '{}'
)
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- SECTION 9: RLS POLICIES
-- ===========================================

-- Enable RLS on new tables
ALTER TABLE platform_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_feature_flag_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_rollback_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_assistant_metrics ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access for backend)
CREATE POLICY "service_role_platform_feature_flags" ON platform_feature_flags
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_platform_feature_flag_audit" ON platform_feature_flag_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_migration_backups" ON migration_backups
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_migration_rollback_log" ON migration_rollback_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_voice_assistant_metrics" ON voice_assistant_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Read-only for authenticated users (admins can view flags status)
CREATE POLICY "authenticated_read_platform_feature_flags" ON platform_feature_flags
  FOR SELECT TO authenticated USING (true);

-- Metrics accessible to business owners
CREATE POLICY "business_owner_voice_metrics" ON voice_assistant_metrics
  FOR SELECT TO authenticated
  USING (
    business_id IN (
      SELECT tenant_id FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Enable RLS on voice_assistant_configs if table was created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_assistant_configs') THEN
    ALTER TABLE voice_assistant_configs ENABLE ROW LEVEL SECURITY;

    -- Service role full access
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'voice_assistant_configs' AND policyname = 'service_role_voice_assistant_configs'
    ) THEN
      CREATE POLICY "service_role_voice_assistant_configs" ON voice_assistant_configs
        FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- Business owners can view and manage their voice configs
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'voice_assistant_configs' AND policyname = 'business_owner_voice_configs'
    ) THEN
      CREATE POLICY "business_owner_voice_configs" ON voice_assistant_configs
        FOR ALL TO authenticated
        USING (
          business_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
          )
        )
        WITH CHECK (
          business_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
          )
        );
    END IF;
  END IF;
END;
$$;

-- ===========================================
-- SECTION 10: HELPER FUNCTIONS
-- ===========================================

-- Atomic function to update tenant v2 status (prevents race conditions)
CREATE OR REPLACE FUNCTION update_tenant_v2_status(
  p_tenant_id TEXT,
  p_action VARCHAR(10),  -- 'enable', 'disable', 'reset'
  p_updated_by TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  CASE p_action
    WHEN 'enable' THEN
      -- Remove from disabled, add to enabled (atomically)
      UPDATE platform_feature_flags
      SET
        enabled_tenants = CASE
          WHEN p_tenant_id = ANY(enabled_tenants) THEN enabled_tenants
          ELSE array_append(enabled_tenants, p_tenant_id)
        END,
        disabled_tenants = array_remove(disabled_tenants, p_tenant_id),
        updated_at = NOW(),
        updated_by = p_updated_by
      WHERE name = 'voice_agent_v2';

    WHEN 'disable' THEN
      -- Remove from enabled, add to disabled (atomically)
      UPDATE platform_feature_flags
      SET
        disabled_tenants = CASE
          WHEN p_tenant_id = ANY(disabled_tenants) THEN disabled_tenants
          ELSE array_append(disabled_tenants, p_tenant_id)
        END,
        enabled_tenants = array_remove(enabled_tenants, p_tenant_id),
        updated_at = NOW(),
        updated_by = p_updated_by
      WHERE name = 'voice_agent_v2';

    WHEN 'reset' THEN
      -- Remove from both lists (atomically)
      UPDATE platform_feature_flags
      SET
        enabled_tenants = array_remove(enabled_tenants, p_tenant_id),
        disabled_tenants = array_remove(disabled_tenants, p_tenant_id),
        updated_at = NOW(),
        updated_by = p_updated_by
      WHERE name = 'voice_agent_v2';

    ELSE
      RAISE EXCEPTION 'Invalid action: %. Must be enable, disable, or reset', p_action;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a tenant should use v2
CREATE OR REPLACE FUNCTION should_use_voice_agent_v2(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_flags RECORD;
  v_hash INTEGER;
  v_percentile INTEGER;
BEGIN
  -- Get feature flags from platform_feature_flags
  SELECT enabled, percentage, enabled_tenants, disabled_tenants
  INTO v_flags
  FROM platform_feature_flags
  WHERE name = 'voice_agent_v2';

  -- If no flag found or globally disabled
  IF v_flags IS NULL OR NOT v_flags.enabled THEN
    RETURN false;
  END IF;

  -- If tenant is explicitly disabled
  IF p_tenant_id::text = ANY(v_flags.disabled_tenants) THEN
    RETURN false;
  END IF;

  -- If tenant is explicitly enabled
  IF p_tenant_id::text = ANY(v_flags.enabled_tenants) THEN
    RETURN true;
  END IF;

  -- Percentage-based decision using hash
  SELECT hashtext(p_tenant_id::text) INTO v_hash;
  v_percentile := ABS(v_hash) % 100;

  RETURN v_percentile < v_flags.percentage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log platform feature flag changes
CREATE OR REPLACE FUNCTION log_platform_feature_flag_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO platform_feature_flag_audit_log (flag_name, action, old_value, new_value, changed_by)
    VALUES (
      NEW.name,
      CASE
        WHEN OLD.enabled != NEW.enabled THEN
          CASE WHEN NEW.enabled THEN 'enabled' ELSE 'disabled' END
        WHEN OLD.percentage != NEW.percentage THEN 'percentage_changed'
        WHEN OLD.enabled_tenants != NEW.enabled_tenants THEN 'tenant_list_updated'
        WHEN OLD.disabled_tenants != NEW.disabled_tenants THEN 'disabled_list_updated'
        ELSE 'updated'
      END,
      jsonb_build_object(
        'enabled', OLD.enabled,
        'percentage', OLD.percentage,
        'enabled_tenants', OLD.enabled_tenants,
        'disabled_tenants', OLD.disabled_tenants
      ),
      jsonb_build_object(
        'enabled', NEW.enabled,
        'percentage', NEW.percentage,
        'enabled_tenants', NEW.enabled_tenants,
        'disabled_tenants', NEW.disabled_tenants
      ),
      NEW.updated_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_platform_feature_flag_audit ON platform_feature_flags;
CREATE TRIGGER trigger_platform_feature_flag_audit
  AFTER UPDATE ON platform_feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION log_platform_feature_flag_change();

-- ===========================================
-- SECTION 11: GRANT PERMISSIONS
-- ===========================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON platform_feature_flags TO authenticated;
GRANT SELECT ON voice_assistant_metrics TO authenticated;

-- Service role needs full access
GRANT ALL ON platform_feature_flags TO service_role;
GRANT ALL ON platform_feature_flag_audit_log TO service_role;
GRANT ALL ON migration_backups TO service_role;
GRANT ALL ON migration_rollback_log TO service_role;
GRANT ALL ON voice_assistant_metrics TO service_role;
GRANT ALL ON voice_assistant_configs TO service_role;

-- ===========================================
-- MIGRATION COMPLETE
-- ===========================================

COMMENT ON TABLE platform_feature_flags IS 'Platform-level feature flags for gradual rollouts and A/B testing';
COMMENT ON TABLE platform_feature_flag_audit_log IS 'Audit log for platform feature flag changes';
COMMENT ON TABLE migration_backups IS 'Backup references for data migrations';
COMMENT ON TABLE migration_rollback_log IS 'Log of rollback operations';
COMMENT ON TABLE voice_assistant_metrics IS 'Aggregated metrics for voice assistant performance';
COMMENT ON TABLE voice_assistant_configs IS 'Voice agent configurations for v2 system';
COMMENT ON FUNCTION should_use_voice_agent_v2 IS 'Determines if a tenant should use Voice Agent v2';
COMMENT ON FUNCTION update_tenant_v2_status IS 'Atomically updates tenant v2 override status to prevent race conditions';

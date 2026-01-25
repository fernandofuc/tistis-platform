-- =====================================================
-- TIS TIS PLATFORM - Voice Usage Alerts
-- Migration: 166_VOICE_USAGE_ALERTS
-- Sistema de alertas proactivas para Voice Minute Limits
-- FASE 11: Proactive Alerts
-- =====================================================

-- =====================================================
-- ALERTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS voice_usage_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  threshold int NOT NULL CHECK (threshold IN (70, 85, 95, 100)),
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  usage_percent numeric(5,2) NOT NULL,
  minutes_used numeric(10,2) NOT NULL,
  included_minutes int NOT NULL,
  overage_minutes numeric(10,2) DEFAULT 0,
  overage_charge_centavos int DEFAULT 0,
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  sent_via text[] DEFAULT '{}',
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Tenant lookup with unacknowledged first
CREATE INDEX IF NOT EXISTS idx_voice_alerts_tenant
  ON voice_usage_alerts(tenant_id, acknowledged, created_at DESC);

-- Threshold lookup for cooldown check
CREATE INDEX IF NOT EXISTS idx_voice_alerts_threshold
  ON voice_usage_alerts(tenant_id, threshold, created_at DESC);

-- Severity for filtering critical alerts
CREATE INDEX IF NOT EXISTS idx_voice_alerts_severity
  ON voice_usage_alerts(tenant_id, severity)
  WHERE acknowledged = false;

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE voice_usage_alerts ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_voice_alerts" ON voice_usage_alerts
  FOR ALL
  USING (auth.role() = 'service_role');

-- Users can view their tenant's alerts
CREATE POLICY "tenant_view_alerts" ON voice_usage_alerts
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles
      WHERE user_id = auth.uid()
    )
  );

-- Users can acknowledge their tenant's alerts
CREATE POLICY "tenant_acknowledge_alerts" ON voice_usage_alerts
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_roles
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- ADD ALERT CONFIG COLUMNS TO voice_minute_limits
-- =====================================================

DO $$
BEGIN
  -- Alert thresholds enabled (default: all)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_minute_limits'
    AND column_name = 'alert_thresholds'
  ) THEN
    ALTER TABLE voice_minute_limits
    ADD COLUMN alert_thresholds int[] DEFAULT '{70, 85, 95, 100}';
  END IF;

  -- Alert channels enabled (default: in_app only)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_minute_limits'
    AND column_name = 'alert_channels'
  ) THEN
    ALTER TABLE voice_minute_limits
    ADD COLUMN alert_channels text[] DEFAULT '{in_app}';
  END IF;

  -- Webhook URL for webhook alerts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_minute_limits'
    AND column_name = 'webhook_url'
  ) THEN
    ALTER TABLE voice_minute_limits
    ADD COLUMN webhook_url text;
  END IF;

  -- Email recipients for email alerts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_minute_limits'
    AND column_name = 'email_recipients'
  ) THEN
    ALTER TABLE voice_minute_limits
    ADD COLUMN email_recipients text[];
  END IF;

  -- Cooldown minutes between alerts for same threshold
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_minute_limits'
    AND column_name = 'alert_cooldown_minutes'
  ) THEN
    ALTER TABLE voice_minute_limits
    ADD COLUMN alert_cooldown_minutes int DEFAULT 60;
  END IF;
END $$;

-- =====================================================
-- NOTIFICATION TYPE FOR VOICE ALERTS
-- =====================================================

-- Ensure notifications table has voice_usage_alert type support
DO $$
BEGIN
  -- Add severity column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications'
    AND column_name = 'severity'
  ) THEN
    ALTER TABLE notifications
    ADD COLUMN severity text DEFAULT 'info';
  END IF;

  -- Add action_url column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications'
    AND column_name = 'action_url'
  ) THEN
    ALTER TABLE notifications
    ADD COLUMN action_url text;
  END IF;

  -- Add metadata column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE notifications
    ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- =====================================================
-- FUNCTION: Get unacknowledged alert count
-- =====================================================

CREATE OR REPLACE FUNCTION get_unacknowledged_voice_alert_count(p_tenant_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::int
    FROM voice_usage_alerts
    WHERE tenant_id = p_tenant_id
    AND acknowledged = false
  );
END;
$$;

-- =====================================================
-- FUNCTION: Bulk acknowledge alerts
-- =====================================================

CREATE OR REPLACE FUNCTION acknowledge_all_voice_alerts(
  p_tenant_id uuid,
  p_user_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE voice_usage_alerts
  SET
    acknowledged = true,
    acknowledged_at = now(),
    acknowledged_by = p_user_id
  WHERE tenant_id = p_tenant_id
  AND acknowledged = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE voice_usage_alerts IS
  'Stores proactive alerts when voice usage reaches thresholds';

COMMENT ON COLUMN voice_usage_alerts.threshold IS
  'Usage threshold that triggered the alert (70, 85, 95, or 100)';

COMMENT ON COLUMN voice_usage_alerts.severity IS
  'Alert severity: info (70%), warning (85-95%), critical (100%)';

COMMENT ON COLUMN voice_usage_alerts.sent_via IS
  'Channels through which alert was sent: in_app, email, webhook';

COMMENT ON COLUMN voice_minute_limits.alert_thresholds IS
  'Thresholds at which to send alerts (default: 70, 85, 95, 100)';

COMMENT ON COLUMN voice_minute_limits.alert_channels IS
  'Channels to send alerts through (default: in_app only)';

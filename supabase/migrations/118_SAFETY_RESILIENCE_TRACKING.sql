-- =====================================================
-- Migration 118: Safety & Resilience Tracking System
-- REVISIÓN 5.0 - Sistema de Tracking de Seguridad
-- =====================================================
-- Implements:
-- P25: Emergency tracking and escalation logging
-- P27: Special event tracking for restaurants
-- P29: Allergy/safety incident tracking
-- P37: Voice call reconnection tracking
-- P38: Escalation fallback tracking
-- =====================================================

-- =====================================================
-- TABLE: safety_incidents
-- Tracks all safety-related incidents for audit/compliance
-- =====================================================

CREATE TABLE IF NOT EXISTS public.safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Incident classification
  incident_type TEXT NOT NULL CHECK (incident_type IN (
    'emergency_dental', 'emergency_medical', 'severe_pain', 'accident',
    'food_allergy', 'dietary_restriction', 'medical_condition',
    'special_event_escalation', 'config_incomplete', 'escalation_failed'
  )),
  severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5), -- 1=low, 5=critical

  -- Detection details
  detected_keywords TEXT[],
  original_message TEXT,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  vertical TEXT NOT NULL,

  -- Actions taken
  action_taken TEXT NOT NULL CHECK (action_taken IN (
    'escalated_immediate', 'urgent_care_routing', 'human_notified',
    'disclaimer_shown', 'fallback_response', 'callback_scheduled'
  )),
  disclaimer_shown TEXT,

  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_safety_incidents_tenant
ON public.safety_incidents (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_safety_incidents_type
ON public.safety_incidents (incident_type, severity DESC)
WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_safety_incidents_unresolved
ON public.safety_incidents (tenant_id, resolved, created_at DESC)
WHERE resolved = FALSE;

-- RLS
ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant safety incidents"
ON public.safety_incidents FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage all safety incidents"
ON public.safety_incidents FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- TABLE: special_event_requests
-- Tracks special event requests for restaurants
-- =====================================================

CREATE TABLE IF NOT EXISTS public.special_event_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'birthday', 'anniversary', 'corporate', 'wedding',
    'large_group', 'catering', 'vip', 'other'
  )),
  group_size INTEGER,
  requested_date DATE,
  requested_time TIME,

  -- Requirements
  special_requirements TEXT[],
  dietary_restrictions TEXT[],
  additional_notes TEXT,

  -- Contact info (may be redundant with lead but useful for quick access)
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'contacted', 'confirmed', 'cancelled', 'completed'
  )),
  assigned_to UUID REFERENCES auth.users(id),
  escalation_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_special_events_tenant_status
ON public.special_event_requests (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_special_events_pending
ON public.special_event_requests (tenant_id, status)
WHERE status = 'pending';

-- RLS
ALTER TABLE public.special_event_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant special events"
ON public.special_event_requests FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own tenant special events"
ON public.special_event_requests FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage all special events"
ON public.special_event_requests FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- TABLE: voice_call_sessions
-- Extended tracking for voice call reconnection (P37)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  caller_phone TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Session tracking
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  is_reconnection BOOLEAN DEFAULT FALSE,
  previous_session_id UUID REFERENCES public.voice_call_sessions(id),

  -- Call state snapshot (for reconnection)
  last_intent TEXT,
  partial_booking JSONB,
  conversation_summary TEXT,

  -- Call metadata
  vapi_call_id TEXT,
  call_duration_seconds INTEGER,
  was_escalated BOOLEAN DEFAULT FALSE,
  escalation_outcome TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick session lookup by phone number
CREATE INDEX IF NOT EXISTS idx_voice_sessions_phone
ON public.voice_call_sessions (tenant_id, caller_phone, session_start DESC);

-- Index for reconnection lookup (recent sessions)
CREATE INDEX IF NOT EXISTS idx_voice_sessions_reconnection
ON public.voice_call_sessions (tenant_id, caller_phone, session_start DESC)
WHERE session_end IS NULL OR session_start > NOW() - INTERVAL '5 minutes';

-- RLS
ALTER TABLE public.voice_call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant voice sessions"
ON public.voice_call_sessions FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage all voice sessions"
ON public.voice_call_sessions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- TABLE: escalation_callbacks
-- Tracks callback requests when escalation fails (P38)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.escalation_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Callback details
  callback_type TEXT NOT NULL CHECK (callback_type IN (
    'voice_callback', 'message_callback', 'priority_contact'
  )),
  original_channel TEXT NOT NULL,
  escalation_reason TEXT NOT NULL,

  -- Contact info
  phone_number TEXT,
  preferred_time TEXT,
  message_left TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'attempted', 'completed', 'failed', 'cancelled'
  )),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for pending callbacks
CREATE INDEX IF NOT EXISTS idx_callbacks_pending
ON public.escalation_callbacks (tenant_id, status, created_at)
WHERE status = 'pending' AND expires_at > NOW();

-- RLS
ALTER TABLE public.escalation_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant callbacks"
ON public.escalation_callbacks FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own tenant callbacks"
ON public.escalation_callbacks FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage all callbacks"
ON public.escalation_callbacks FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- FUNCTION: log_safety_incident
-- Centralized function to log safety incidents
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_safety_incident(
  p_tenant_id UUID,
  p_conversation_id UUID,
  p_lead_id UUID,
  p_incident_type TEXT,
  p_severity INTEGER,
  p_original_message TEXT,
  p_channel TEXT,
  p_vertical TEXT,
  p_action_taken TEXT,
  p_detected_keywords TEXT[] DEFAULT NULL,
  p_disclaimer_shown TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_incident_id UUID;
BEGIN
  INSERT INTO public.safety_incidents (
    tenant_id,
    conversation_id,
    lead_id,
    incident_type,
    severity,
    original_message,
    channel,
    vertical,
    action_taken,
    detected_keywords,
    disclaimer_shown,
    metadata
  ) VALUES (
    p_tenant_id,
    p_conversation_id,
    p_lead_id,
    p_incident_type,
    p_severity,
    p_original_message,
    p_channel,
    p_vertical,
    p_action_taken,
    p_detected_keywords,
    p_disclaimer_shown,
    p_metadata
  )
  RETURNING id INTO v_incident_id;

  -- Log critical incidents to audit_logs as well
  IF p_severity >= 4 THEN
    INSERT INTO public.audit_logs (
      action,
      entity_type,
      entity_id,
      changes,
      created_at
    ) VALUES (
      'safety_incident_critical',
      'safety_incidents',
      v_incident_id,
      jsonb_build_object(
        'incident_type', p_incident_type,
        'severity', p_severity,
        'tenant_id', p_tenant_id,
        'action_taken', p_action_taken
      ),
      NOW()
    );
  END IF;

  RETURN v_incident_id;
END;
$$;

-- =====================================================
-- FUNCTION: get_recent_voice_session
-- For voice call reconnection (P37)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_recent_voice_session(
  p_tenant_id UUID,
  p_caller_phone TEXT,
  p_max_age_minutes INTEGER DEFAULT 5
)
RETURNS TABLE(
  session_id UUID,
  last_intent TEXT,
  partial_booking JSONB,
  conversation_summary TEXT,
  session_age_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vcs.id AS session_id,
    vcs.last_intent,
    vcs.partial_booking,
    vcs.conversation_summary,
    EXTRACT(EPOCH FROM (NOW() - vcs.session_start))::INTEGER AS session_age_seconds
  FROM public.voice_call_sessions vcs
  WHERE vcs.tenant_id = p_tenant_id
    AND vcs.caller_phone = p_caller_phone
    AND vcs.session_start > NOW() - (p_max_age_minutes || ' minutes')::INTERVAL
    AND vcs.last_intent IS NOT NULL
  ORDER BY vcs.session_start DESC
  LIMIT 1;
END;
$$;

-- =====================================================
-- FUNCTION: create_escalation_callback
-- Creates a callback task when escalation fails (P38)
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_escalation_callback(
  p_tenant_id UUID,
  p_conversation_id UUID,
  p_lead_id UUID,
  p_callback_type TEXT,
  p_original_channel TEXT,
  p_escalation_reason TEXT,
  p_phone_number TEXT DEFAULT NULL,
  p_preferred_time TEXT DEFAULT NULL,
  p_message_left TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_callback_id UUID;
BEGIN
  INSERT INTO public.escalation_callbacks (
    tenant_id,
    conversation_id,
    lead_id,
    callback_type,
    original_channel,
    escalation_reason,
    phone_number,
    preferred_time,
    message_left
  ) VALUES (
    p_tenant_id,
    p_conversation_id,
    p_lead_id,
    p_callback_type,
    p_original_channel,
    p_escalation_reason,
    p_phone_number,
    p_preferred_time,
    p_message_left
  )
  RETURNING id INTO v_callback_id;

  RETURN v_callback_id;
END;
$$;

-- =====================================================
-- VIEW: v_safety_dashboard
-- Dashboard view for safety metrics
-- =====================================================

CREATE OR REPLACE VIEW public.v_safety_dashboard AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.vertical,
  -- Last 24 hours metrics
  COUNT(*) FILTER (WHERE si.created_at > NOW() - INTERVAL '24 hours') AS incidents_24h,
  COUNT(*) FILTER (WHERE si.created_at > NOW() - INTERVAL '24 hours' AND si.severity >= 4) AS critical_24h,
  COUNT(*) FILTER (WHERE si.created_at > NOW() - INTERVAL '24 hours' AND si.incident_type LIKE 'emergency%') AS emergencies_24h,
  COUNT(*) FILTER (WHERE si.created_at > NOW() - INTERVAL '24 hours' AND si.incident_type = 'food_allergy') AS allergy_incidents_24h,
  -- Unresolved incidents
  COUNT(*) FILTER (WHERE si.resolved = FALSE) AS unresolved_count,
  -- Last 7 days metrics
  COUNT(*) FILTER (WHERE si.created_at > NOW() - INTERVAL '7 days') AS incidents_7d,
  -- Resolution rate
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE si.resolved = TRUE) / NULLIF(COUNT(*), 0),
    1
  ) AS resolution_rate_pct,
  -- Health status
  CASE
    WHEN COUNT(*) FILTER (WHERE si.created_at > NOW() - INTERVAL '24 hours' AND si.severity >= 4 AND si.resolved = FALSE) > 0 THEN 'CRITICAL'
    WHEN COUNT(*) FILTER (WHERE si.created_at > NOW() - INTERVAL '24 hours' AND si.severity >= 3 AND si.resolved = FALSE) > 3 THEN 'WARNING'
    ELSE 'OK'
  END AS health_status
FROM public.tenants t
LEFT JOIN public.safety_incidents si ON t.id = si.tenant_id
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.name, t.vertical
ORDER BY critical_24h DESC NULLS LAST, incidents_24h DESC NULLS LAST;

-- Grant access
GRANT SELECT ON public.v_safety_dashboard TO authenticated;

-- =====================================================
-- Triggers for updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_special_event_requests_updated_at
  BEFORE UPDATE ON public.special_event_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_voice_call_sessions_updated_at
  BEFORE UPDATE ON public.voice_call_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Log migration
-- =====================================================

INSERT INTO public.audit_logs (action, entity_type, changes, created_at)
VALUES (
  'migration_applied',
  'database',
  jsonb_build_object(
    'migration', '118_SAFETY_RESILIENCE_TRACKING',
    'fixes', ARRAY['P25', 'P27', 'P29', 'P37', 'P38'],
    'tables_created', ARRAY['safety_incidents', 'special_event_requests', 'voice_call_sessions', 'escalation_callbacks'],
    'functions_created', ARRAY['log_safety_incident', 'get_recent_voice_session', 'create_escalation_callback'],
    'description', 'Safety & Resilience tracking system for REVISIÓN 5.0'
  ),
  NOW()
);

-- =====================================================
-- 008_notifications_module.sql
-- =====================================================
-- Sistema de notificaciones in-app para TIS TIS Platform
-- Real-time notifications para eventos importantes

-- =====================================================
-- TABLE: notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Target user
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification details
  type VARCHAR(50) NOT NULL CHECK (
    type IN (
      'new_lead',
      'lead_hot',
      'appointment_created',
      'appointment_confirmed',
      'appointment_cancelled',
      'appointment_reminder',
      'message_received',
      'conversation_escalated',
      'quote_sent',
      'quote_accepted',
      'quote_rejected',
      'patient_created',
      'system_alert'
    )
  ),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Priority
  priority VARCHAR(20) DEFAULT 'normal' CHECK (
    priority IN ('low', 'normal', 'high', 'urgent')
  ),

  -- Related entities
  related_entity_type VARCHAR(50), -- 'lead', 'appointment', 'conversation', 'quote', 'patient'
  related_entity_id UUID,

  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  archived BOOLEAN DEFAULT FALSE,

  -- Action
  action_url TEXT, -- URL to navigate to when clicked
  action_label VARCHAR(100), -- "Ver Lead", "Ver Cita", etc.

  -- Metadata
  metadata JSONB, -- Additional data for the notification
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Auto-archive after this date
);

-- Indexes
CREATE INDEX idx_notifications_tenant ON public.notifications(tenant_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_type ON public.notifications(type);
CREATE INDEX idx_notifications_priority ON public.notifications(priority);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_related_entity ON public.notifications(related_entity_type, related_entity_id);

-- =====================================================
-- TABLE: notification_preferences
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- In-app notifications
  enable_in_app BOOLEAN DEFAULT TRUE,

  -- Notification types preferences
  notify_new_lead BOOLEAN DEFAULT TRUE,
  notify_lead_hot BOOLEAN DEFAULT TRUE,
  notify_appointment_created BOOLEAN DEFAULT TRUE,
  notify_appointment_confirmed BOOLEAN DEFAULT TRUE,
  notify_appointment_cancelled BOOLEAN DEFAULT TRUE,
  notify_appointment_reminder BOOLEAN DEFAULT TRUE,
  notify_message_received BOOLEAN DEFAULT TRUE,
  notify_conversation_escalated BOOLEAN DEFAULT TRUE,
  notify_quote_sent BOOLEAN DEFAULT FALSE,
  notify_quote_accepted BOOLEAN DEFAULT TRUE,
  notify_quote_rejected BOOLEAN DEFAULT FALSE,
  notify_patient_created BOOLEAN DEFAULT FALSE,
  notify_system_alert BOOLEAN DEFAULT TRUE,

  -- Email notifications (for future)
  enable_email BOOLEAN DEFAULT FALSE,
  email_daily_digest BOOLEAN DEFAULT FALSE,

  -- Push notifications (for future mobile app)
  enable_push BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notification_preferences_user ON public.notification_preferences(user_id);

-- =====================================================
-- FUNCTION: Create notification for user
-- =====================================================
CREATE OR REPLACE FUNCTION create_notification(
  p_tenant_id UUID,
  p_user_id UUID,
  p_type VARCHAR(50),
  p_title VARCHAR(255),
  p_message TEXT,
  p_priority VARCHAR(20) DEFAULT 'normal',
  p_related_entity_type VARCHAR(50) DEFAULT NULL,
  p_related_entity_id UUID DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_action_label VARCHAR(100) DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
  user_preferences RECORD;
  should_notify BOOLEAN := TRUE;
BEGIN
  -- Check user preferences
  SELECT * INTO user_preferences
  FROM public.notification_preferences
  WHERE user_id = p_user_id;

  -- If no preferences exist, create default
  IF NOT FOUND THEN
    INSERT INTO public.notification_preferences (user_id)
    VALUES (p_user_id);
    should_notify := TRUE;
  ELSE
    -- Check if user wants this type of notification
    CASE p_type
      WHEN 'new_lead' THEN should_notify := user_preferences.notify_new_lead;
      WHEN 'lead_hot' THEN should_notify := user_preferences.notify_lead_hot;
      WHEN 'appointment_created' THEN should_notify := user_preferences.notify_appointment_created;
      WHEN 'appointment_confirmed' THEN should_notify := user_preferences.notify_appointment_confirmed;
      WHEN 'appointment_cancelled' THEN should_notify := user_preferences.notify_appointment_cancelled;
      WHEN 'appointment_reminder' THEN should_notify := user_preferences.notify_appointment_reminder;
      WHEN 'message_received' THEN should_notify := user_preferences.notify_message_received;
      WHEN 'conversation_escalated' THEN should_notify := user_preferences.notify_conversation_escalated;
      WHEN 'quote_sent' THEN should_notify := user_preferences.notify_quote_sent;
      WHEN 'quote_accepted' THEN should_notify := user_preferences.notify_quote_accepted;
      WHEN 'quote_rejected' THEN should_notify := user_preferences.notify_quote_rejected;
      WHEN 'patient_created' THEN should_notify := user_preferences.notify_patient_created;
      WHEN 'system_alert' THEN should_notify := user_preferences.notify_system_alert;
      ELSE should_notify := TRUE;
    END CASE;

    -- Always notify if high priority or urgent
    IF p_priority IN ('high', 'urgent') THEN
      should_notify := TRUE;
    END IF;
  END IF;

  -- Create notification if user wants it
  IF should_notify THEN
    INSERT INTO public.notifications (
      tenant_id,
      user_id,
      type,
      title,
      message,
      priority,
      related_entity_type,
      related_entity_id,
      action_url,
      action_label,
      metadata,
      expires_at
    )
    VALUES (
      p_tenant_id,
      p_user_id,
      p_type,
      p_title,
      p_message,
      p_priority,
      p_related_entity_type,
      p_related_entity_id,
      p_action_url,
      p_action_label,
      p_metadata,
      NOW() + INTERVAL '30 days' -- Auto-expire after 30 days
    )
    RETURNING id INTO notification_id;

    RETURN notification_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Mark notification as read
-- =====================================================
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.notifications
  SET read = TRUE, read_at = NOW()
  WHERE id = notification_id
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Mark all notifications as read
-- =====================================================
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read = TRUE, read_at = NOW()
  WHERE user_id = auth.uid()
    AND read = FALSE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Clean up old notifications
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  -- Archive expired notifications
  UPDATE public.notifications
  SET archived = TRUE
  WHERE expires_at < NOW()
    AND archived = FALSE;

  -- Delete archived notifications older than 90 days
  DELETE FROM public.notifications
  WHERE archived = TRUE
    AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule this function to run daily
-- SELECT cron.schedule('cleanup-notifications', '0 3 * * *', 'SELECT cleanup_old_notifications()');

-- =====================================================
-- FUNCTION: Broadcast notification to multiple users
-- =====================================================
CREATE OR REPLACE FUNCTION broadcast_notification(
  p_tenant_id UUID,
  p_user_ids UUID[],
  p_type VARCHAR(50),
  p_title VARCHAR(255),
  p_message TEXT,
  p_priority VARCHAR(20) DEFAULT 'normal',
  p_related_entity_type VARCHAR(50) DEFAULT NULL,
  p_related_entity_id UUID DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_action_label VARCHAR(100) DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  user_id UUID;
  notification_count INTEGER := 0;
BEGIN
  -- Create notification for each user
  FOREACH user_id IN ARRAY p_user_ids
  LOOP
    IF create_notification(
      p_tenant_id,
      user_id,
      p_type,
      p_title,
      p_message,
      p_priority,
      p_related_entity_type,
      p_related_entity_id,
      p_action_url,
      p_action_label,
      p_metadata
    ) IS NOT NULL THEN
      notification_count := notification_count + 1;
    END IF;
  END LOOP;

  RETURN notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Update updated_at timestamp
-- =====================================================
CREATE TRIGGER trg_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS POLICIES: notifications
-- =====================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read, archive)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- System can create notifications for any user
CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (TRUE);

-- =====================================================
-- RLS POLICIES: notification_preferences
-- =====================================================
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "Users can read own notification preferences"
ON public.notification_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own preferences
CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can create their own preferences
CREATE POLICY "Users can create own notification preferences"
ON public.notification_preferences FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- =====================================================
-- VIEWS: Useful notification views
-- =====================================================

-- View: Unread notifications count per user
CREATE OR REPLACE VIEW public.unread_notifications_count AS
SELECT
  user_id,
  COUNT(*) as unread_count,
  COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
  COUNT(*) FILTER (WHERE priority = 'high') as high_priority_count
FROM public.notifications
WHERE read = FALSE AND archived = FALSE
GROUP BY user_id;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.notifications IS 'Notificaciones in-app para usuarios';
COMMENT ON TABLE public.notification_preferences IS 'Preferencias de notificaciones por usuario';
COMMENT ON FUNCTION create_notification IS 'Crea una notificación para un usuario respetando sus preferencias';
COMMENT ON FUNCTION broadcast_notification IS 'Envía una notificación a múltiples usuarios';
COMMENT ON FUNCTION mark_notification_read IS 'Marca una notificación como leída';
COMMENT ON FUNCTION mark_all_notifications_read IS 'Marca todas las notificaciones del usuario como leídas';
COMMENT ON FUNCTION cleanup_old_notifications IS 'Limpia notificaciones antiguas (ejecutar diariamente)';

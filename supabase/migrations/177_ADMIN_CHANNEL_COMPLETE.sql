-- =====================================================
-- TIS TIS PLATFORM - ADMIN CHANNEL SYSTEM (CONSOLIDADO)
-- Consolidates: 177, 178
-- Date: 2026-01-26
-- Version: 1.0 CONSOLIDATED
--
-- Este archivo consolida las siguientes migraciones:
-- - 177_ADMIN_CHANNEL_SYSTEM.sql (tablas, RPCs, RLS)
-- - 178_ADMIN_CHANNEL_NOTIFICATION_TRIGGERS.sql (triggers automáticos)
--
-- PROPÓSITO: Sistema completo de Admin Channel B2B:
-- - Vinculación de usuarios via WhatsApp/Telegram
-- - Conversaciones con contexto LangGraph
-- - Mensajes con intents y acciones
-- - Notificaciones programadas y automáticas
-- - Triggers para hot leads, escalaciones, inventario bajo
-- - Auditoría completa
--
-- DEPENDENCIAS: tenants, staff, user_roles, leads, conversations
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Iniciando Admin Channel System (Consolidado)';
    RAISE NOTICE 'Combina migraciones: 177, 178';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- PARTE 1: ENUMS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_user_status') THEN
    CREATE TYPE admin_user_status AS ENUM ('pending', 'active', 'suspended', 'blocked');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_channel_type') THEN
    CREATE TYPE admin_channel_type AS ENUM ('whatsapp', 'telegram');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_conversation_status') THEN
    CREATE TYPE admin_conversation_status AS ENUM ('active', 'resolved', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_message_role') THEN
    CREATE TYPE admin_message_role AS ENUM ('user', 'assistant', 'system');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_message_status') THEN
    CREATE TYPE admin_message_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_notification_type') THEN
    CREATE TYPE admin_notification_type AS ENUM (
      'daily_summary', 'weekly_digest', 'monthly_report',
      'low_inventory', 'hot_lead', 'escalation',
      'appointment_reminder', 'payment_received', 'custom'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_notification_priority') THEN
    CREATE TYPE admin_notification_priority AS ENUM ('low', 'normal', 'high', 'urgent');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_audit_category') THEN
    CREATE TYPE admin_audit_category AS ENUM ('auth', 'analytics', 'config', 'notification', 'system');
  END IF;
END$$;

-- =====================================================
-- PARTE 2: TABLAS PRINCIPALES
-- =====================================================

-- 2.1 admin_channel_users
CREATE TABLE IF NOT EXISTS admin_channel_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  phone_normalized VARCHAR(20),
  telegram_user_id VARCHAR(50),
  telegram_username VARCHAR(100),
  status admin_user_status NOT NULL DEFAULT 'pending',
  link_code VARCHAR(6),
  link_code_expires_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ,
  can_view_analytics BOOLEAN DEFAULT true,
  can_configure BOOLEAN DEFAULT true,
  can_receive_notifications BOOLEAN DEFAULT true,
  messages_today INTEGER DEFAULT 0,
  messages_this_hour INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  rate_limit_reset_at TIMESTAMPTZ,
  preferred_language VARCHAR(5) DEFAULT 'es',
  notification_hours_start INTEGER DEFAULT 8,
  notification_hours_end INTEGER DEFAULT 22,
  timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_phone_per_tenant UNIQUE (tenant_id, phone_normalized),
  CONSTRAINT unique_telegram_per_tenant UNIQUE (tenant_id, telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_channel_users_tenant ON admin_channel_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_channel_users_phone ON admin_channel_users(phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_channel_users_telegram ON admin_channel_users(telegram_user_id) WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_channel_users_link_code ON admin_channel_users(link_code) WHERE link_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_channel_users_status ON admin_channel_users(status);

-- 2.2 admin_channel_conversations
CREATE TABLE IF NOT EXISTS admin_channel_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES admin_channel_users(id) ON DELETE CASCADE,
  channel admin_channel_type NOT NULL,
  channel_conversation_id VARCHAR(100),
  status admin_conversation_status DEFAULT 'active',
  current_intent VARCHAR(50),
  pending_action JSONB,
  context JSONB DEFAULT '{}',
  message_count INTEGER DEFAULT 0,
  last_user_message_at TIMESTAMPTZ,
  last_bot_message_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_conversations_tenant ON admin_channel_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_conversations_user ON admin_channel_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_conversations_channel ON admin_channel_conversations(channel);
CREATE INDEX IF NOT EXISTS idx_admin_conversations_status ON admin_channel_conversations(status);
CREATE INDEX IF NOT EXISTS idx_admin_conversations_active ON admin_channel_conversations(user_id, channel) WHERE status = 'active';

-- 2.3 admin_channel_messages
CREATE TABLE IF NOT EXISTS admin_channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES admin_channel_conversations(id) ON DELETE CASCADE,
  role admin_message_role NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'document', 'template')),
  channel_message_id VARCHAR(100),
  detected_intent VARCHAR(50),
  intent_confidence DECIMAL(3,2),
  extracted_data JSONB DEFAULT '{}',
  actions_executed JSONB DEFAULT '[]',
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  status admin_message_status DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_conversation ON admin_channel_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_created ON admin_channel_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_messages_intent ON admin_channel_messages(detected_intent) WHERE detected_intent IS NOT NULL;

-- 2.4 admin_channel_notifications
CREATE TABLE IF NOT EXISTS admin_channel_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES admin_channel_users(id) ON DELETE CASCADE,
  notification_type admin_notification_type NOT NULL,
  title VARCHAR(200),
  content TEXT NOT NULL,
  template_data JSONB DEFAULT '{}',
  scheduled_for TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  channel VARCHAR(20) CHECK (channel IN ('whatsapp', 'telegram', 'both')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  priority admin_notification_priority DEFAULT 'normal',
  trigger_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_tenant ON admin_channel_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user ON admin_channel_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_scheduled ON admin_channel_notifications(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_channel_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_pending ON admin_channel_notifications(tenant_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_admin_notifications_pending_scheduled ON admin_channel_notifications(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_created ON admin_channel_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_priority ON admin_channel_notifications(priority, created_at) WHERE status = 'pending';

-- 2.5 admin_channel_audit_log
CREATE TABLE IF NOT EXISTS admin_channel_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES admin_channel_users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES admin_channel_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES admin_channel_messages(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  action_category admin_audit_category NOT NULL,
  description TEXT,
  request_data JSONB,
  response_data JSONB,
  success BOOLEAN DEFAULT true,
  error_code VARCHAR(50),
  error_message TEXT,
  channel VARCHAR(20),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_tenant ON admin_channel_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_user ON admin_channel_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_channel_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_category ON admin_channel_audit_log(action_category);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_channel_audit_log(tenant_id, created_at DESC);
-- Note: Removed partial index predicate (NOW() is not IMMUTABLE)
-- Query filtering by date will still use idx_admin_audit_created efficiently
CREATE INDEX IF NOT EXISTS idx_admin_audit_recent ON admin_channel_audit_log(created_at DESC);

-- =====================================================
-- PARTE 3: RLS POLICIES
-- =====================================================

ALTER TABLE admin_channel_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_channel_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_channel_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_channel_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role policies
DROP POLICY IF EXISTS "Service role full access admin_channel_users" ON admin_channel_users;
CREATE POLICY "Service role full access admin_channel_users"
ON admin_channel_users FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access admin_channel_conversations" ON admin_channel_conversations;
CREATE POLICY "Service role full access admin_channel_conversations"
ON admin_channel_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access admin_channel_messages" ON admin_channel_messages;
CREATE POLICY "Service role full access admin_channel_messages"
ON admin_channel_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access admin_channel_notifications" ON admin_channel_notifications;
CREATE POLICY "Service role full access admin_channel_notifications"
ON admin_channel_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access admin_channel_audit_log" ON admin_channel_audit_log;
CREATE POLICY "Service role full access admin_channel_audit_log"
ON admin_channel_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tenant isolation policies (solo si existe has_tenant_access)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_tenant_access') THEN
    DROP POLICY IF EXISTS "Tenant users can view own admin_channel_users" ON admin_channel_users;
    CREATE POLICY "Tenant users can view own admin_channel_users"
    ON admin_channel_users FOR SELECT TO authenticated USING (public.has_tenant_access(tenant_id));

    DROP POLICY IF EXISTS "Tenant users can view own conversations" ON admin_channel_conversations;
    CREATE POLICY "Tenant users can view own conversations"
    ON admin_channel_conversations FOR SELECT TO authenticated USING (public.has_tenant_access(tenant_id));

    DROP POLICY IF EXISTS "Tenant users can view own notifications" ON admin_channel_notifications;
    CREATE POLICY "Tenant users can view own notifications"
    ON admin_channel_notifications FOR SELECT TO authenticated USING (public.has_tenant_access(tenant_id));

    DROP POLICY IF EXISTS "Tenant users can view own audit logs" ON admin_channel_audit_log;
    CREATE POLICY "Tenant users can view own audit logs"
    ON admin_channel_audit_log FOR SELECT TO authenticated USING (public.has_tenant_access(tenant_id));
  END IF;
END $$;

-- Admin management policies
DROP POLICY IF EXISTS "Tenant admins can manage admin_channel_users" ON admin_channel_users;
CREATE POLICY "Tenant admins can manage admin_channel_users"
ON admin_channel_users FOR ALL TO authenticated
USING (tenant_id IN (
  SELECT ur.tenant_id FROM user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'owner') AND ur.is_active = true
));

-- =====================================================
-- PARTE 4: RPCs
-- =====================================================

-- 4.1 generate_admin_link_code
CREATE OR REPLACE FUNCTION generate_admin_link_code(
  p_tenant_id UUID, p_staff_id UUID DEFAULT NULL
) RETURNS TABLE (link_code VARCHAR(6), expires_at TIMESTAMPTZ, user_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code VARCHAR(6);
  v_expires TIMESTAMPTZ;
  v_user_id UUID;
  v_existing_id UUID;
BEGIN
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  v_expires := NOW() + INTERVAL '15 minutes';

  SELECT id INTO v_existing_id FROM admin_channel_users
  WHERE tenant_id = p_tenant_id AND staff_id = p_staff_id AND p_staff_id IS NOT NULL LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE admin_channel_users SET link_code = v_code, link_code_expires_at = v_expires,
      status = 'pending', updated_at = NOW() WHERE id = v_existing_id RETURNING id INTO v_user_id;
  ELSE
    INSERT INTO admin_channel_users (tenant_id, staff_id, link_code, link_code_expires_at, status)
    VALUES (p_tenant_id, p_staff_id, v_code, v_expires, 'pending') RETURNING id INTO v_user_id;
  END IF;

  RETURN QUERY SELECT v_code, v_expires, v_user_id;
END;
$$;

-- 4.2 verify_admin_link_code
CREATE OR REPLACE FUNCTION verify_admin_link_code(
  p_link_code VARCHAR(6), p_phone_normalized VARCHAR(20) DEFAULT NULL,
  p_telegram_user_id VARCHAR(50) DEFAULT NULL, p_telegram_username VARCHAR(100) DEFAULT NULL
) RETURNS TABLE (success BOOLEAN, tenant_id UUID, user_id UUID, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user RECORD;
BEGIN
  IF p_phone_normalized IS NULL AND p_telegram_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'Debe proporcionar telefono o Telegram ID'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_user FROM admin_channel_users
  WHERE link_code = p_link_code AND link_code_expires_at > NOW() AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'Codigo invalido o expirado'::TEXT;
    RETURN;
  END IF;

  UPDATE admin_channel_users SET phone_normalized = p_phone_normalized,
    telegram_user_id = p_telegram_user_id, telegram_username = p_telegram_username,
    status = 'active', linked_at = NOW(), link_code = NULL, link_code_expires_at = NULL,
    updated_at = NOW() WHERE id = v_user.id;

  INSERT INTO admin_channel_audit_log (tenant_id, user_id, action, action_category, description, request_data, success)
  VALUES (v_user.tenant_id, v_user.id, 'link_account', 'auth', 'Usuario vinculo su cuenta via codigo',
    jsonb_build_object('phone', p_phone_normalized, 'telegram_user_id', p_telegram_user_id), true);

  RETURN QUERY SELECT true, v_user.tenant_id, v_user.id, NULL::TEXT;
END;
$$;

-- 4.3 get_admin_channel_user
CREATE OR REPLACE FUNCTION get_admin_channel_user(
  p_phone_normalized VARCHAR(20) DEFAULT NULL, p_telegram_user_id VARCHAR(50) DEFAULT NULL
) RETURNS TABLE (
  user_id UUID, tenant_id UUID, staff_id UUID, status TEXT,
  can_view_analytics BOOLEAN, can_configure BOOLEAN, can_receive_notifications BOOLEAN,
  preferred_language VARCHAR(5), timezone VARCHAR(50), tenant_name VARCHAR(200), tenant_vertical VARCHAR(50)
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY SELECT u.id, u.tenant_id, u.staff_id, u.status::TEXT,
    u.can_view_analytics, u.can_configure, u.can_receive_notifications,
    u.preferred_language, u.timezone, t.name, t.vertical
  FROM admin_channel_users u JOIN tenants t ON t.id = u.tenant_id
  WHERE u.status = 'active' AND (
    (p_phone_normalized IS NOT NULL AND u.phone_normalized = p_phone_normalized)
    OR (p_telegram_user_id IS NOT NULL AND u.telegram_user_id = p_telegram_user_id)
  ) LIMIT 1;
END;
$$;

-- 4.4 update_admin_rate_limit
CREATE OR REPLACE FUNCTION update_admin_rate_limit(p_user_id UUID)
RETURNS TABLE (can_send BOOLEAN, messages_remaining_hour INTEGER, messages_remaining_day INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user RECORD; v_max_per_hour INTEGER := 30; v_max_per_day INTEGER := 100;
BEGIN
  SELECT * INTO v_user FROM admin_channel_users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 0, 0, NOW(); RETURN; END IF;

  IF v_user.rate_limit_reset_at IS NULL OR v_user.rate_limit_reset_at < NOW() THEN
    UPDATE admin_channel_users SET messages_this_hour = 1,
      messages_today = CASE WHEN DATE(last_message_at) < CURRENT_DATE THEN 1 ELSE messages_today + 1 END,
      last_message_at = NOW(), rate_limit_reset_at = NOW() + INTERVAL '1 hour', updated_at = NOW()
    WHERE id = p_user_id RETURNING * INTO v_user;
  ELSE
    UPDATE admin_channel_users SET messages_this_hour = messages_this_hour + 1,
      messages_today = CASE WHEN DATE(last_message_at) < CURRENT_DATE THEN 1 ELSE messages_today + 1 END,
      last_message_at = NOW(), updated_at = NOW() WHERE id = p_user_id RETURNING * INTO v_user;
  END IF;

  RETURN QUERY SELECT v_user.messages_this_hour <= v_max_per_hour AND v_user.messages_today <= v_max_per_day,
    GREATEST(0, v_max_per_hour - v_user.messages_this_hour),
    GREATEST(0, v_max_per_day - v_user.messages_today), v_user.rate_limit_reset_at;
END;
$$;

-- 4.5 get_or_create_admin_conversation
CREATE OR REPLACE FUNCTION get_or_create_admin_conversation(p_user_id UUID, p_channel admin_channel_type)
RETURNS TABLE (conversation_id UUID, is_new BOOLEAN, current_intent VARCHAR(50), pending_action JSONB, context JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conv RECORD; v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM admin_channel_users WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;

  SELECT * INTO v_conv FROM admin_channel_conversations
  WHERE user_id = p_user_id AND channel = p_channel AND status = 'active' ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_conv.id, false, v_conv.current_intent, v_conv.pending_action, v_conv.context;
    RETURN;
  END IF;

  INSERT INTO admin_channel_conversations (tenant_id, user_id, channel, status, context)
  VALUES (v_user.tenant_id, p_user_id, p_channel, 'active', '{}'::JSONB) RETURNING * INTO v_conv;

  INSERT INTO admin_channel_audit_log (tenant_id, user_id, conversation_id, action, action_category, description, success)
  VALUES (v_user.tenant_id, p_user_id, v_conv.id, 'start_conversation', 'system', 'Nueva conversacion iniciada via ' || p_channel::TEXT, true);

  RETURN QUERY SELECT v_conv.id, true, v_conv.current_intent, v_conv.pending_action, v_conv.context;
END;
$$;

-- 4.6 save_admin_message
CREATE OR REPLACE FUNCTION save_admin_message(
  p_conversation_id UUID, p_role admin_message_role, p_content TEXT,
  p_detected_intent VARCHAR(50) DEFAULT NULL, p_intent_confidence DECIMAL(3,2) DEFAULT NULL,
  p_extracted_data JSONB DEFAULT '{}', p_actions_executed JSONB DEFAULT '[]',
  p_input_tokens INTEGER DEFAULT 0, p_output_tokens INTEGER DEFAULT 0, p_channel_message_id VARCHAR(100) DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_message_id UUID;
BEGIN
  INSERT INTO admin_channel_messages (conversation_id, role, content, detected_intent, intent_confidence,
    extracted_data, actions_executed, input_tokens, output_tokens, channel_message_id, status)
  VALUES (p_conversation_id, p_role, p_content, p_detected_intent, p_intent_confidence,
    p_extracted_data, p_actions_executed, p_input_tokens, p_output_tokens, p_channel_message_id, 'sent')
  RETURNING id INTO v_message_id;

  UPDATE admin_channel_conversations SET message_count = message_count + 1,
    current_intent = COALESCE(p_detected_intent, current_intent),
    last_user_message_at = CASE WHEN p_role = 'user' THEN NOW() ELSE last_user_message_at END,
    last_bot_message_at = CASE WHEN p_role = 'assistant' THEN NOW() ELSE last_bot_message_at END,
    updated_at = NOW() WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;

-- =====================================================
-- PARTE 5: NOTIFICATION TRIGGERS (de 178)
-- =====================================================

-- 5.1 Hot lead trigger
CREATE OR REPLACE FUNCTION trigger_hot_lead_notification()
RETURNS TRIGGER AS $$
DECLARE v_tenant_name VARCHAR(200);
BEGIN
  IF NEW.score >= 80 AND (OLD IS NULL OR OLD.score < 80) THEN
    SELECT name INTO v_tenant_name FROM tenants WHERE id = NEW.tenant_id;
    INSERT INTO admin_channel_notifications (
      tenant_id, user_id, notification_type, title, content, priority, channel, trigger_data, status, created_at, updated_at
    )
    SELECT NEW.tenant_id, acu.id, 'hot_lead', 'Lead Caliente',
      format(E'Nuevo Lead Caliente\n\nNombre: %s\nTelefono: %s\nFuente: %s\nScore: %s%%',
        COALESCE(NEW.name, 'Sin nombre'), COALESCE(NEW.phone, 'N/A'), COALESCE(NEW.source, 'Directo'), NEW.score),
      'urgent', 'both', jsonb_build_object('lead_id', NEW.id, 'name', NEW.name, 'score', NEW.score), 'pending', NOW(), NOW()
    FROM admin_channel_users acu WHERE acu.tenant_id = NEW.tenant_id AND acu.status = 'active' AND acu.can_receive_notifications = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
    DROP TRIGGER IF EXISTS lead_hot_notification_trigger ON leads;
    CREATE TRIGGER lead_hot_notification_trigger AFTER INSERT OR UPDATE OF score ON leads FOR EACH ROW EXECUTE FUNCTION trigger_hot_lead_notification();
  END IF;
END $$;

-- 5.2 Escalation trigger
CREATE OR REPLACE FUNCTION trigger_escalation_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'escalated' AND (OLD IS NULL OR OLD.status != 'escalated') THEN
    INSERT INTO admin_channel_notifications (
      tenant_id, user_id, notification_type, title, content, priority, channel, trigger_data, status, created_at, updated_at
    )
    SELECT NEW.tenant_id, acu.id, 'escalation', 'Conversacion Escalada',
      format(E'Conversacion Escalada\n\nCliente: %s\nCanal: %s\nRazon: %s',
        COALESCE(NEW.customer_name, 'Cliente'), COALESCE(NEW.channel, 'WhatsApp'), COALESCE(NEW.escalation_reason, 'Solicitud de humano')),
      'urgent', 'both', jsonb_build_object('conversation_id', NEW.id, 'customer_name', NEW.customer_name), 'pending', NOW(), NOW()
    FROM admin_channel_users acu WHERE acu.tenant_id = NEW.tenant_id AND acu.status = 'active' AND acu.can_receive_notifications = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
    DROP TRIGGER IF EXISTS conversation_escalation_trigger ON conversations;
    CREATE TRIGGER conversation_escalation_trigger AFTER UPDATE OF status ON conversations FOR EACH ROW EXECUTE FUNCTION trigger_escalation_notification();
  END IF;
END $$;

-- 5.3 Low inventory trigger
CREATE OR REPLACE FUNCTION trigger_low_inventory_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stock <= NEW.min_stock AND (OLD IS NULL OR OLD.current_stock > OLD.min_stock) THEN
    INSERT INTO admin_channel_notifications (
      tenant_id, user_id, notification_type, title, content, priority, channel, trigger_data, status, created_at, updated_at
    )
    SELECT NEW.tenant_id, acu.id, 'low_inventory', 'Inventario Bajo',
      format(E'Alerta de Inventario\n\n%s\nStock actual: %s\nMinimo: %s', NEW.name, NEW.current_stock, NEW.min_stock),
      'high', 'both', jsonb_build_object('item_id', NEW.id, 'name', NEW.name, 'current_stock', NEW.current_stock), 'pending', NOW(), NOW()
    FROM admin_channel_users acu WHERE acu.tenant_id = NEW.tenant_id AND acu.status = 'active' AND acu.can_receive_notifications = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_items') THEN
    DROP TRIGGER IF EXISTS inventory_low_notification_trigger ON inventory_items;
    CREATE TRIGGER inventory_low_notification_trigger AFTER UPDATE OF current_stock ON inventory_items FOR EACH ROW EXECUTE FUNCTION trigger_low_inventory_notification();
  END IF;
END $$;

-- =====================================================
-- PARTE 6: UPDATED_AT TRIGGERS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $trigger$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $trigger$ LANGUAGE plpgsql;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_admin_channel_users_updated_at ON admin_channel_users;
CREATE TRIGGER trg_admin_channel_users_updated_at BEFORE UPDATE ON admin_channel_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_admin_channel_conversations_updated_at ON admin_channel_conversations;
CREATE TRIGGER trg_admin_channel_conversations_updated_at BEFORE UPDATE ON admin_channel_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_admin_channel_notifications_updated_at ON admin_channel_notifications;
CREATE TRIGGER trg_admin_channel_notifications_updated_at BEFORE UPDATE ON admin_channel_notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PARTE 7: GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION generate_admin_link_code TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION verify_admin_link_code TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_admin_channel_user TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_admin_rate_limit TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_or_create_admin_conversation TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION save_admin_message TO authenticated, service_role;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'ADMIN CHANNEL SYSTEM (CONSOLIDADO) - COMPLETADO';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tablas: admin_channel_users, admin_channel_conversations,';
  RAISE NOTICE '        admin_channel_messages, admin_channel_notifications,';
  RAISE NOTICE '        admin_channel_audit_log';
  RAISE NOTICE '';
  RAISE NOTICE 'RPCs: generate_admin_link_code, verify_admin_link_code,';
  RAISE NOTICE '      get_admin_channel_user, update_admin_rate_limit,';
  RAISE NOTICE '      get_or_create_admin_conversation, save_admin_message';
  RAISE NOTICE '';
  RAISE NOTICE 'Triggers: hot_lead, escalation, low_inventory';
  RAISE NOTICE '';
  RAISE NOTICE 'Consolida: 177, 178';
  RAISE NOTICE '=====================================================';
END $$;

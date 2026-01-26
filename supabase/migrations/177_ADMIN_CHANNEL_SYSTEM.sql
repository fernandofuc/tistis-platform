-- =====================================================
-- TIS TIS PLATFORM - Admin Channel System
-- Permite a clientes B2B interactuar via WhatsApp/Telegram
-- para consultar analytics, configurar servicios y recibir alertas
-- Migracion: 177 (siguiente despues de 176_JOB_QUEUE_SYSTEM)
-- =====================================================

-- =====================================================
-- ENUMS (con patron IF NOT EXISTS de TIS TIS)
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
-- TABLA: admin_channel_users
-- Vinculacion de telefono/telegram a tenant
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_channel_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,

  -- Identificadores de canal
  phone_normalized VARCHAR(20),
  telegram_user_id VARCHAR(50),
  telegram_username VARCHAR(100),

  -- Estado (usando ENUM)
  status admin_user_status NOT NULL DEFAULT 'pending',

  -- Vinculacion
  link_code VARCHAR(6),
  link_code_expires_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ,

  -- Permisos
  can_view_analytics BOOLEAN DEFAULT true,
  can_configure BOOLEAN DEFAULT true,
  can_receive_notifications BOOLEAN DEFAULT true,

  -- Rate limiting
  messages_today INTEGER DEFAULT 0,
  messages_this_hour INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  rate_limit_reset_at TIMESTAMPTZ,

  -- Preferencias
  preferred_language VARCHAR(5) DEFAULT 'es',
  notification_hours_start INTEGER DEFAULT 8,
  notification_hours_end INTEGER DEFAULT 22,
  timezone VARCHAR(50) DEFAULT 'America/Mexico_City',

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  -- NOTA: Las constraints UNIQUE con NULL permiten multiples valores NULL
  -- (NULL != NULL en SQL estandar), asi que usuarios pueden tener phone_normalized=NULL
  -- y solo telegram_user_id configurado, o viceversa
  CONSTRAINT unique_phone_per_tenant UNIQUE (tenant_id, phone_normalized),
  CONSTRAINT unique_telegram_per_tenant UNIQUE (tenant_id, telegram_user_id)
  -- NOTA: La validacion de "al menos un canal activo" se hace en verify_admin_link_code RPC
  -- No usamos CHECK constraint porque durante el estado 'pending' ambos pueden ser NULL
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_admin_channel_users_tenant ON admin_channel_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_channel_users_phone ON admin_channel_users(phone_normalized) WHERE phone_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_channel_users_telegram ON admin_channel_users(telegram_user_id) WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_channel_users_link_code ON admin_channel_users(link_code) WHERE link_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_channel_users_status ON admin_channel_users(status);

-- =====================================================
-- TABLA: admin_channel_conversations
-- Historial de conversaciones
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_channel_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES admin_channel_users(id) ON DELETE CASCADE,

  -- Canal (usando ENUM)
  channel admin_channel_type NOT NULL,
  channel_conversation_id VARCHAR(100),

  -- Estado (usando ENUM)
  status admin_conversation_status DEFAULT 'active',

  -- Contexto LangGraph
  current_intent VARCHAR(50),
  pending_action JSONB,
  context JSONB DEFAULT '{}',

  -- Metricas
  message_count INTEGER DEFAULT 0,
  last_user_message_at TIMESTAMPTZ,
  last_bot_message_at TIMESTAMPTZ,

  -- Timestamps
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

-- =====================================================
-- TABLA: admin_channel_messages
-- Mensajes individuales
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES admin_channel_conversations(id) ON DELETE CASCADE,

  -- Mensaje (usando ENUMs)
  role admin_message_role NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(20) DEFAULT 'text'
    CHECK (content_type IN ('text', 'image', 'document', 'template')),

  -- Canal
  channel_message_id VARCHAR(100),

  -- IA
  detected_intent VARCHAR(50),
  intent_confidence DECIMAL(3,2),
  extracted_data JSONB DEFAULT '{}',

  -- Acciones
  actions_executed JSONB DEFAULT '[]',

  -- Tokens (para billing)
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,

  -- Estado (usando ENUM)
  status admin_message_status DEFAULT 'sent',
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_conversation ON admin_channel_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_created ON admin_channel_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_messages_intent ON admin_channel_messages(detected_intent) WHERE detected_intent IS NOT NULL;

-- =====================================================
-- TABLA: admin_channel_notifications
-- Notificaciones programadas y enviadas
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_channel_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES admin_channel_users(id) ON DELETE CASCADE,

  -- Tipo (usando ENUM)
  notification_type admin_notification_type NOT NULL,

  -- Contenido
  title VARCHAR(200),
  content TEXT NOT NULL,
  template_data JSONB DEFAULT '{}',

  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule VARCHAR(100),

  -- Estado
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),

  -- Delivery (canal puede ser 'both' asi que se mantiene VARCHAR)
  channel VARCHAR(20) CHECK (channel IN ('whatsapp', 'telegram', 'both')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,

  -- Prioridad (usando ENUM)
  priority admin_notification_priority DEFAULT 'normal',

  -- Metadata
  trigger_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_tenant ON admin_channel_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user ON admin_channel_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_scheduled ON admin_channel_notifications(scheduled_for)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_channel_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_pending ON admin_channel_notifications(tenant_id, status)
  WHERE status = 'pending';

-- =====================================================
-- TABLA: admin_channel_audit_log
-- Auditoria completa de acciones
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_channel_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES admin_channel_users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES admin_channel_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES admin_channel_messages(id) ON DELETE SET NULL,

  -- Accion (usando ENUM para category)
  action VARCHAR(100) NOT NULL,
  action_category admin_audit_category NOT NULL,

  -- Detalles
  description TEXT,
  request_data JSONB,
  response_data JSONB,

  -- Resultado
  success BOOLEAN DEFAULT true,
  error_code VARCHAR(50),
  error_message TEXT,

  -- Contexto
  channel VARCHAR(20),
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_tenant ON admin_channel_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_user ON admin_channel_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_channel_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_category ON admin_channel_audit_log(action_category);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_channel_audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_recent ON admin_channel_audit_log(created_at DESC) WHERE created_at > NOW() - INTERVAL '30 days';

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE admin_channel_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_channel_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_channel_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_channel_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role full access (para operaciones del sistema)
DROP POLICY IF EXISTS "Service role full access admin_channel_users" ON admin_channel_users;
CREATE POLICY "Service role full access admin_channel_users"
ON admin_channel_users FOR ALL TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access admin_channel_conversations" ON admin_channel_conversations;
CREATE POLICY "Service role full access admin_channel_conversations"
ON admin_channel_conversations FOR ALL TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access admin_channel_messages" ON admin_channel_messages;
CREATE POLICY "Service role full access admin_channel_messages"
ON admin_channel_messages FOR ALL TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access admin_channel_notifications" ON admin_channel_notifications;
CREATE POLICY "Service role full access admin_channel_notifications"
ON admin_channel_notifications FOR ALL TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access admin_channel_audit_log" ON admin_channel_audit_log;
CREATE POLICY "Service role full access admin_channel_audit_log"
ON admin_channel_audit_log FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Tenant isolation policies (usando funcion helper existente has_tenant_access)
DROP POLICY IF EXISTS "Tenant users can view own admin_channel_users" ON admin_channel_users;
CREATE POLICY "Tenant users can view own admin_channel_users"
ON admin_channel_users FOR SELECT TO authenticated
USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Tenant admins can manage admin_channel_users" ON admin_channel_users;
CREATE POLICY "Tenant admins can manage admin_channel_users"
ON admin_channel_users FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'owner')
    AND ur.is_active = true
  )
);

DROP POLICY IF EXISTS "Tenant users can view own conversations" ON admin_channel_conversations;
CREATE POLICY "Tenant users can view own conversations"
ON admin_channel_conversations FOR SELECT TO authenticated
USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Tenant users can view own messages" ON admin_channel_messages;
CREATE POLICY "Tenant users can view own messages"
ON admin_channel_messages FOR SELECT TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM admin_channel_conversations
    WHERE public.has_tenant_access(tenant_id)
  )
);

DROP POLICY IF EXISTS "Tenant users can view own notifications" ON admin_channel_notifications;
CREATE POLICY "Tenant users can view own notifications"
ON admin_channel_notifications FOR SELECT TO authenticated
USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Tenant users can view own audit logs" ON admin_channel_audit_log;
CREATE POLICY "Tenant users can view own audit logs"
ON admin_channel_audit_log FOR SELECT TO authenticated
USING (public.has_tenant_access(tenant_id));

-- =====================================================
-- FUNCIONES RPC
-- =====================================================

-- Generar codigo de vinculacion
CREATE OR REPLACE FUNCTION generate_admin_link_code(
  p_tenant_id UUID,
  p_staff_id UUID DEFAULT NULL
) RETURNS TABLE (
  link_code VARCHAR(6),
  expires_at TIMESTAMPTZ,
  user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code VARCHAR(6);
  v_expires TIMESTAMPTZ;
  v_user_id UUID;
  v_existing_id UUID;
BEGIN
  -- Generar codigo aleatorio de 6 digitos
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  v_expires := NOW() + INTERVAL '15 minutes';

  -- Verificar si ya existe un usuario con este staff_id
  SELECT id INTO v_existing_id
  FROM admin_channel_users
  WHERE tenant_id = p_tenant_id AND staff_id = p_staff_id AND p_staff_id IS NOT NULL
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Actualizar usuario existente (regenerar codigo)
    UPDATE admin_channel_users
    SET link_code = v_code,
        link_code_expires_at = v_expires,
        status = 'pending',
        updated_at = NOW()
    WHERE id = v_existing_id
    RETURNING id INTO v_user_id;
  ELSE
    -- Crear nuevo usuario en estado pending (sin canal aun)
    -- phone_normalized y telegram_user_id se setean en verify_admin_link_code
    INSERT INTO admin_channel_users (
      tenant_id, staff_id, link_code, link_code_expires_at, status
    ) VALUES (
      p_tenant_id, p_staff_id, v_code, v_expires, 'pending'
    )
    RETURNING id INTO v_user_id;
  END IF;

  RETURN QUERY SELECT v_code, v_expires, v_user_id;
END;
$$;

-- Verificar codigo de vinculacion
CREATE OR REPLACE FUNCTION verify_admin_link_code(
  p_link_code VARCHAR(6),
  p_phone_normalized VARCHAR(20) DEFAULT NULL,
  p_telegram_user_id VARCHAR(50) DEFAULT NULL,
  p_telegram_username VARCHAR(100) DEFAULT NULL
) RETURNS TABLE (
  success BOOLEAN,
  tenant_id UUID,
  user_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- Validar que se proporcione al menos un canal
  IF p_phone_normalized IS NULL AND p_telegram_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'Debe proporcionar telefono o Telegram ID'::TEXT;
    RETURN;
  END IF;

  -- Buscar codigo valido
  SELECT * INTO v_user
  FROM admin_channel_users
  WHERE link_code = p_link_code
    AND link_code_expires_at > NOW()
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'Codigo invalido o expirado'::TEXT;
    RETURN;
  END IF;

  -- Actualizar con datos del canal
  -- NOTA: Seteamos directamente los valores proporcionados, no usamos COALESCE
  -- porque el usuario en estado 'pending' no tiene canal configurado aun
  UPDATE admin_channel_users
  SET phone_normalized = p_phone_normalized,  -- NULL si no se proporciona
      telegram_user_id = p_telegram_user_id,  -- NULL si no se proporciona
      telegram_username = p_telegram_username,
      status = 'active',
      linked_at = NOW(),
      link_code = NULL,
      link_code_expires_at = NULL,
      updated_at = NOW()
  WHERE id = v_user.id;

  -- Log de auditoria
  INSERT INTO admin_channel_audit_log (
    tenant_id, user_id, action, action_category, description,
    request_data, success
  ) VALUES (
    v_user.tenant_id, v_user.id, 'link_account', 'auth',
    'Usuario vinculo su cuenta via codigo',
    jsonb_build_object(
      'phone', p_phone_normalized,
      'telegram_user_id', p_telegram_user_id
    ),
    true
  );

  RETURN QUERY SELECT true, v_user.tenant_id, v_user.id, NULL::TEXT;
END;
$$;

-- Obtener usuario por telefono o telegram
CREATE OR REPLACE FUNCTION get_admin_channel_user(
  p_phone_normalized VARCHAR(20) DEFAULT NULL,
  p_telegram_user_id VARCHAR(50) DEFAULT NULL
) RETURNS TABLE (
  user_id UUID,
  tenant_id UUID,
  staff_id UUID,
  status TEXT,
  can_view_analytics BOOLEAN,
  can_configure BOOLEAN,
  can_receive_notifications BOOLEAN,
  preferred_language VARCHAR(5),
  timezone VARCHAR(50),
  tenant_name VARCHAR(200),
  tenant_vertical VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.tenant_id,
    u.staff_id,
    u.status::TEXT,
    u.can_view_analytics,
    u.can_configure,
    u.can_receive_notifications,
    u.preferred_language,
    u.timezone,
    t.name,
    t.vertical
  FROM admin_channel_users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.status = 'active'
    AND (
      (p_phone_normalized IS NOT NULL AND u.phone_normalized = p_phone_normalized)
      OR (p_telegram_user_id IS NOT NULL AND u.telegram_user_id = p_telegram_user_id)
    )
  LIMIT 1;
END;
$$;

-- Actualizar rate limiting
CREATE OR REPLACE FUNCTION update_admin_rate_limit(
  p_user_id UUID
) RETURNS TABLE (
  can_send BOOLEAN,
  messages_remaining_hour INTEGER,
  messages_remaining_day INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_max_per_hour INTEGER := 30;
  v_max_per_day INTEGER := 100;
BEGIN
  SELECT * INTO v_user FROM admin_channel_users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, NOW();
    RETURN;
  END IF;

  -- Reset counters si es necesario
  IF v_user.rate_limit_reset_at IS NULL OR v_user.rate_limit_reset_at < NOW() THEN
    UPDATE admin_channel_users
    SET messages_this_hour = 1,
        messages_today = CASE
          WHEN DATE(last_message_at) < CURRENT_DATE THEN 1
          ELSE messages_today + 1
        END,
        last_message_at = NOW(),
        rate_limit_reset_at = NOW() + INTERVAL '1 hour',
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING * INTO v_user;
  ELSE
    UPDATE admin_channel_users
    SET messages_this_hour = messages_this_hour + 1,
        messages_today = CASE
          WHEN DATE(last_message_at) < CURRENT_DATE THEN 1
          ELSE messages_today + 1
        END,
        last_message_at = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING * INTO v_user;
  END IF;

  RETURN QUERY SELECT
    v_user.messages_this_hour <= v_max_per_hour AND v_user.messages_today <= v_max_per_day,
    GREATEST(0, v_max_per_hour - v_user.messages_this_hour),
    GREATEST(0, v_max_per_day - v_user.messages_today),
    v_user.rate_limit_reset_at;
END;
$$;

-- Crear o obtener conversacion activa
CREATE OR REPLACE FUNCTION get_or_create_admin_conversation(
  p_user_id UUID,
  p_channel admin_channel_type
) RETURNS TABLE (
  conversation_id UUID,
  is_new BOOLEAN,
  current_intent VARCHAR(50),
  pending_action JSONB,
  context JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_user RECORD;
BEGIN
  -- Obtener usuario para tenant_id
  SELECT * INTO v_user FROM admin_channel_users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Buscar conversacion activa existente
  SELECT * INTO v_conv
  FROM admin_channel_conversations
  WHERE user_id = p_user_id
    AND channel = p_channel
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_conv.id, false, v_conv.current_intent, v_conv.pending_action, v_conv.context;
    RETURN;
  END IF;

  -- Crear nueva conversacion
  INSERT INTO admin_channel_conversations (
    tenant_id, user_id, channel, status, context
  ) VALUES (
    v_user.tenant_id, p_user_id, p_channel, 'active', '{}'::JSONB
  )
  RETURNING * INTO v_conv;

  -- Log de auditoria
  INSERT INTO admin_channel_audit_log (
    tenant_id, user_id, conversation_id, action, action_category, description, success
  ) VALUES (
    v_user.tenant_id, p_user_id, v_conv.id, 'start_conversation', 'system',
    'Nueva conversacion iniciada via ' || p_channel::TEXT, true
  );

  RETURN QUERY SELECT v_conv.id, true, v_conv.current_intent, v_conv.pending_action, v_conv.context;
END;
$$;

-- Guardar mensaje y actualizar conversacion
CREATE OR REPLACE FUNCTION save_admin_message(
  p_conversation_id UUID,
  p_role admin_message_role,
  p_content TEXT,
  p_detected_intent VARCHAR(50) DEFAULT NULL,
  p_intent_confidence DECIMAL(3,2) DEFAULT NULL,
  p_extracted_data JSONB DEFAULT '{}',
  p_actions_executed JSONB DEFAULT '[]',
  p_input_tokens INTEGER DEFAULT 0,
  p_output_tokens INTEGER DEFAULT 0,
  p_channel_message_id VARCHAR(100) DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id UUID;
BEGIN
  -- Insertar mensaje
  INSERT INTO admin_channel_messages (
    conversation_id, role, content, detected_intent, intent_confidence,
    extracted_data, actions_executed, input_tokens, output_tokens,
    channel_message_id, status
  ) VALUES (
    p_conversation_id, p_role, p_content, p_detected_intent, p_intent_confidence,
    p_extracted_data, p_actions_executed, p_input_tokens, p_output_tokens,
    p_channel_message_id, 'sent'
  )
  RETURNING id INTO v_message_id;

  -- Actualizar conversacion
  UPDATE admin_channel_conversations
  SET message_count = message_count + 1,
      current_intent = COALESCE(p_detected_intent, current_intent),
      last_user_message_at = CASE WHEN p_role = 'user' THEN NOW() ELSE last_user_message_at END,
      last_bot_message_at = CASE WHEN p_role = 'assistant' THEN NOW() ELSE last_bot_message_at END,
      updated_at = NOW()
  WHERE id = p_conversation_id;

  RETURN v_message_id;
END;
$$;

-- =====================================================
-- TRIGGERS
-- Usa la funcion existente update_updated_at_column()
-- =====================================================

-- Verificar que existe la funcion (deberia existir de migraciones anteriores)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $trigger$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;
  END IF;
END$$;

-- Auto-update timestamps
DROP TRIGGER IF EXISTS trg_admin_channel_users_updated_at ON admin_channel_users;
CREATE TRIGGER trg_admin_channel_users_updated_at
BEFORE UPDATE ON admin_channel_users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_admin_channel_conversations_updated_at ON admin_channel_conversations;
CREATE TRIGGER trg_admin_channel_conversations_updated_at
BEFORE UPDATE ON admin_channel_conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_admin_channel_notifications_updated_at ON admin_channel_notifications;
CREATE TRIGGER trg_admin_channel_notifications_updated_at
BEFORE UPDATE ON admin_channel_notifications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION generate_admin_link_code TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION verify_admin_link_code TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_admin_channel_user TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_admin_rate_limit TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_or_create_admin_conversation TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION save_admin_message TO authenticated, service_role;

-- =====================================================
-- COMENTARIOS DE DOCUMENTACION
-- =====================================================

COMMENT ON TABLE admin_channel_users IS 'Usuarios del canal admin vinculados via WhatsApp/Telegram para gestion B2B';
COMMENT ON TABLE admin_channel_conversations IS 'Conversaciones de canal admin con contexto LangGraph';
COMMENT ON TABLE admin_channel_messages IS 'Mensajes individuales con intents y acciones ejecutadas';
COMMENT ON TABLE admin_channel_notifications IS 'Notificaciones programadas y alertas automaticas';
COMMENT ON TABLE admin_channel_audit_log IS 'Log de auditoria completo para compliance y debugging';

COMMENT ON FUNCTION generate_admin_link_code IS 'Genera codigo de 6 digitos para vincular cuenta de WhatsApp/Telegram';
COMMENT ON FUNCTION verify_admin_link_code IS 'Verifica codigo y activa cuenta del usuario admin';
COMMENT ON FUNCTION get_admin_channel_user IS 'Obtiene usuario admin por telefono o Telegram ID';
COMMENT ON FUNCTION update_admin_rate_limit IS 'Actualiza contadores de rate limiting y verifica limites';
COMMENT ON FUNCTION get_or_create_admin_conversation IS 'Obtiene conversacion activa o crea una nueva';
COMMENT ON FUNCTION save_admin_message IS 'Guarda mensaje y actualiza metricas de conversacion';

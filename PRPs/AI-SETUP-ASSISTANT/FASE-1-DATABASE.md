# FASE 1: Database Schema Design

## Objetivo
Disenar e implementar el schema de base de datos para el AI Setup Assistant, incluyendo conversaciones, mensajes, uso de recursos y configuraciones.

---

## Microfases

### 1.1 Tabla Principal: setup_assistant_conversations

```sql
-- Migración: 160_SETUP_ASSISTANT_CONVERSATIONS.sql

CREATE TABLE setup_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Estado de la conversación
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'archived')),

  -- Contexto actual del setup
  current_module TEXT,  -- 'loyalty', 'agents', 'knowledge_base', 'services', etc.
  setup_progress JSONB DEFAULT '{}',  -- { loyalty: 'completed', agents: 'in_progress' }

  -- Metadata
  title TEXT,  -- Título opcional generado por IA
  summary TEXT,  -- Resumen de lo configurado

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_setup_conversations_tenant
  ON setup_assistant_conversations(tenant_id, status, last_message_at DESC);
CREATE INDEX idx_setup_conversations_user
  ON setup_assistant_conversations(user_id, status);

-- RLS
ALTER TABLE setup_assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "setup_conversations_tenant_access"
  ON setup_assistant_conversations
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles
      WHERE user_id = auth.uid()
    )
  );
```

**Criterios de aceptación:**
- [ ] Tabla creada con todos los campos
- [ ] Índices optimizados
- [ ] RLS configurado correctamente

---

### 1.2 Tabla de Mensajes: setup_assistant_messages

```sql
-- En la misma migración

CREATE TABLE setup_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL
    REFERENCES setup_assistant_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Contenido del mensaje
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Archivos adjuntos
  attachments JSONB DEFAULT '[]',
  -- [{ type: 'image', url: '...', analysis: {...} }]

  -- Acciones ejecutadas por el asistente
  actions_taken JSONB DEFAULT '[]',
  -- [{ type: 'create_service', entity_id: '...', status: 'success' }]

  -- Tokens usados
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para paginación de mensajes
CREATE INDEX idx_setup_messages_conversation
  ON setup_assistant_messages(conversation_id, created_at ASC);
CREATE INDEX idx_setup_messages_tenant
  ON setup_assistant_messages(tenant_id, created_at DESC);

-- RLS
ALTER TABLE setup_assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "setup_messages_tenant_access"
  ON setup_assistant_messages
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles
      WHERE user_id = auth.uid()
    )
  );
```

**Criterios de aceptación:**
- [ ] Mensajes vinculados a conversaciones
- [ ] Soporte para attachments y acciones
- [ ] Tracking de tokens

---

### 1.3 Tabla de Uso: setup_assistant_usage

```sql
-- Tabla para control de límites por plan

CREATE TABLE setup_assistant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Período (día actual)
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Contadores
  messages_count INT DEFAULT 0,
  files_uploaded INT DEFAULT 0,
  vision_requests INT DEFAULT 0,
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint: un registro por tenant por día
  UNIQUE(tenant_id, usage_date)
);

-- Índice para consultas de uso
CREATE INDEX idx_setup_usage_tenant_date
  ON setup_assistant_usage(tenant_id, usage_date DESC);

-- RLS
ALTER TABLE setup_assistant_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "setup_usage_tenant_read"
  ON setup_assistant_usage
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_roles
      WHERE user_id = auth.uid()
    )
  );

-- Solo service_role puede insertar/actualizar
CREATE POLICY "setup_usage_service_write"
  ON setup_assistant_usage
  FOR INSERT WITH CHECK (
    current_setting('role', true) = 'service_role'
  );

CREATE POLICY "setup_usage_service_update"
  ON setup_assistant_usage
  FOR UPDATE USING (
    current_setting('role', true) = 'service_role'
  );
```

**Criterios de aceptación:**
- [ ] Tracking diario de uso
- [ ] Constraint de unicidad por tenant/día
- [ ] Solo service_role puede modificar

---

### 1.4 Funciones RPC Helper

```sql
-- Función para incrementar uso de forma atómica
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
    p_messages,
    p_files,
    p_vision,
    p_input_tokens,
    p_output_tokens
  )
  ON CONFLICT (tenant_id, usage_date)
  DO UPDATE SET
    messages_count = setup_assistant_usage.messages_count + p_messages,
    files_uploaded = setup_assistant_usage.files_uploaded + p_files,
    vision_requests = setup_assistant_usage.vision_requests + p_vision,
    total_input_tokens = setup_assistant_usage.total_input_tokens + p_input_tokens,
    total_output_tokens = setup_assistant_usage.total_output_tokens + p_output_tokens,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener uso actual con límites
CREATE OR REPLACE FUNCTION get_setup_usage_with_limits(
  p_tenant_id UUID
) RETURNS TABLE (
  messages_count INT,
  messages_limit INT,
  files_uploaded INT,
  files_limit INT,
  vision_requests INT,
  vision_limit INT,
  plan_id TEXT
) AS $$
DECLARE
  v_plan_id TEXT;
  v_limits RECORD;
BEGIN
  -- Obtener plan del tenant
  SELECT s.plan_id INTO v_plan_id
  FROM subscriptions s
  WHERE s.tenant_id = p_tenant_id
    AND s.status = 'active'
  LIMIT 1;

  -- Defaults si no hay plan
  IF v_plan_id IS NULL THEN
    v_plan_id := 'starter';
  END IF;

  -- Definir límites por plan
  CASE v_plan_id
    WHEN 'starter' THEN
      v_limits := (20, 3, 2);
    WHEN 'essentials' THEN
      v_limits := (50, 10, 5);
    WHEN 'growth' THEN
      v_limits := (200, 50, 25);
    WHEN 'enterprise' THEN
      v_limits := (999999, 999999, 999999);
    ELSE
      v_limits := (20, 3, 2);
  END CASE;

  RETURN QUERY
  SELECT
    COALESCE(u.messages_count, 0)::INT,
    v_limits.f1::INT,
    COALESCE(u.files_uploaded, 0)::INT,
    v_limits.f2::INT,
    COALESCE(u.vision_requests, 0)::INT,
    v_limits.f3::INT,
    v_plan_id
  FROM (SELECT 1) AS dummy
  LEFT JOIN setup_assistant_usage u
    ON u.tenant_id = p_tenant_id
    AND u.usage_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Criterios de aceptación:**
- [ ] increment_setup_usage funciona atómicamente
- [ ] get_setup_usage_with_limits retorna datos correctos
- [ ] Límites por plan configurados

---

### 1.5 Trigger para updated_at

```sql
-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_setup_assistant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_setup_conversations_updated
  BEFORE UPDATE ON setup_assistant_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_setup_assistant_updated_at();

CREATE TRIGGER trigger_setup_usage_updated
  BEFORE UPDATE ON setup_assistant_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_setup_assistant_updated_at();

-- Comentarios de documentación
COMMENT ON TABLE setup_assistant_conversations IS
  'Conversaciones del AI Setup Assistant para configuración guiada';
COMMENT ON TABLE setup_assistant_messages IS
  'Mensajes individuales dentro de conversaciones de setup';
COMMENT ON TABLE setup_assistant_usage IS
  'Tracking de uso diario para control de límites por plan';
COMMENT ON FUNCTION increment_setup_usage IS
  'Incrementa contadores de uso de forma atómica (upsert)';
COMMENT ON FUNCTION get_setup_usage_with_limits IS
  'Retorna uso actual junto con límites del plan';
```

**Criterios de aceptación:**
- [ ] Triggers funcionan correctamente
- [ ] Documentación completa

---

## Archivo de Migración Final

**Nombre:** `supabase/migrations/160_SETUP_ASSISTANT_SYSTEM.sql`

**Contenido:** Combinación de todas las microfases anteriores.

---

## Validación de Fase 1

```bash
# Aplicar migración
supabase db push

# Verificar tablas
psql -c "\dt setup_assistant_*"

# Verificar RLS
psql -c "SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE 'setup_assistant%'"

# Test de funciones RPC
psql -c "SELECT * FROM increment_setup_usage('tenant-uuid', 1, 0, 0, 100, 50)"
psql -c "SELECT * FROM get_setup_usage_with_limits('tenant-uuid')"
```

---

## Checklist de Fase 1

- [ ] 1.1 Tabla setup_assistant_conversations creada
- [ ] 1.2 Tabla setup_assistant_messages creada
- [ ] 1.3 Tabla setup_assistant_usage creada
- [ ] 1.4 Funciones RPC implementadas
- [ ] 1.5 Triggers y documentación agregados
- [ ] Migración aplicada sin errores
- [ ] RLS policies verificadas
- [ ] Funciones RPC testeadas

---

## Siguiente Fase

→ [FASE-2-API.md](./FASE-2-API.md)

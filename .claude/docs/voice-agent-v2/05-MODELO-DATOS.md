# VOICE AGENT v2.0 - MODELO DE DATOS

**Documento:** 05-MODELO-DATOS.md
**Version:** 2.0.0
**Fecha:** 2026-01-19
**Estado:** Especificacion Completa

---

## 1. RESUMEN DE CAMBIOS

### 1.1 Nuevas Tablas

| Tabla | Proposito |
|-------|-----------|
| `voice_assistant_types` | Tipos predefinidos de asistente por vertical |
| `voice_catalog` | Catalogo de voces disponibles |
| `voice_assistant_configs` | Configuracion de asistente por tenant (reemplaza `voice_agent_config`) |
| `voice_assistant_metrics` | Metricas agregadas de rendimiento |
| `voice_circuit_breaker_state` | Estado del circuit breaker por tenant |

### 1.2 Tablas Existentes (Sin Cambios Mayores)

| Tabla | Cambios |
|-------|---------|
| `voice_calls` | Agregar campos para nuevos analisis |
| `voice_call_messages` | Sin cambios |
| `voice_phone_numbers` | Sin cambios |
| `voice_usage_logs` | Sin cambios |

---

## 2. NUEVAS TABLAS

### 2.1 voice_assistant_types

Tipos predefinidos de asistente por vertical.

```sql
-- ============================================================================
-- TABLA: voice_assistant_types
-- Descripcion: Tipos predefinidos de asistente por vertical
-- ============================================================================

CREATE TABLE voice_assistant_types (
  -- Identificador
  id TEXT PRIMARY KEY,                    -- 'rest_basic', 'dental_complete', etc.

  -- Clasificacion
  vertical TEXT NOT NULL,                 -- 'restaurant', 'dental', 'clinic', etc.
  name TEXT NOT NULL,                     -- 'Reservaciones', 'Citas + Servicios'
  name_en TEXT,                           -- 'Reservations' (i18n futuro)
  description TEXT,                       -- Descripcion para UI
  description_en TEXT,                    -- Descripcion en ingles (i18n futuro)

  -- Capacidades
  enabled_capabilities TEXT[] NOT NULL,   -- ['check_availability', 'create_reservation']
  disabled_capabilities TEXT[] DEFAULT '{}',

  -- Configuracion de prompt
  prompt_template TEXT NOT NULL,          -- 'restaurant_reservations_v1'
  prompt_version TEXT DEFAULT '1.0.0',

  -- Tools disponibles
  tools_schema JSONB NOT NULL,            -- Lista de tools habilitados
  /*
    Ejemplo:
    {
      "tools": ["check_availability", "create_reservation", "get_business_hours"],
      "require_confirmation": ["create_reservation", "create_order"]
    }
  */

  -- Structured data schemas
  structured_data_schemas JSONB NOT NULL, -- Schemas para extraccion
  /*
    Ejemplo:
    {
      "reservation": true,
      "order": false,
      "lead": true,
      "emergency": false
    }
  */

  -- Voz por defecto
  default_voice_id TEXT,                  -- ID del catalogo de voces
  default_personality TEXT DEFAULT 'friendly',

  -- Ordenamiento y estado
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_voice_assistant_types_vertical
ON voice_assistant_types(vertical)
WHERE is_active = true;

-- Trigger para updated_at
CREATE TRIGGER update_voice_assistant_types_updated_at
  BEFORE UPDATE ON voice_assistant_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 2.2 voice_catalog

Catalogo de voces disponibles.

```sql
-- ============================================================================
-- TABLA: voice_catalog
-- Descripcion: Catalogo de voces pre-configuradas
-- ============================================================================

CREATE TABLE voice_catalog (
  -- Identificador
  id TEXT PRIMARY KEY,                    -- 'sofia_es', 'carlos_es', etc.

  -- Provider info
  provider TEXT NOT NULL,                 -- 'elevenlabs', 'google', 'azure'
  provider_voice_id TEXT NOT NULL,        -- ID en el provider (ej: ElevenLabs voice ID)

  -- Informacion de la voz
  name TEXT NOT NULL,                     -- 'Sofia', 'Carlos'
  gender TEXT,                            -- 'female', 'male', 'neutral'
  language TEXT NOT NULL,                 -- 'es', 'en', 'pt'
  accent TEXT,                            -- 'mexico', 'spain', 'argentina', 'neutral'
  description TEXT,                       -- 'Voz calida y profesional...'

  -- URL de preview (audio sample)
  preview_url TEXT,                       -- URL a audio de muestra

  -- Configuracion tecnica
  model TEXT,                             -- 'eleven_multilingual_v2'
  stability DECIMAL DEFAULT 0.5,          -- 0-1
  similarity_boost DECIMAL DEFAULT 0.75,  -- 0-1
  style DECIMAL DEFAULT 0,                -- 0-1
  use_speaker_boost BOOLEAN DEFAULT true,

  -- Categorias y tags
  categories TEXT[] DEFAULT '{}',         -- ['professional', 'warm', 'young']
  recommended_for TEXT[] DEFAULT '{}',    -- ['restaurant', 'dental']

  -- Ordenamiento y estado
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,       -- Requiere plan especial?

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_voice_catalog_language
ON voice_catalog(language, is_active)
WHERE is_active = true;

CREATE INDEX idx_voice_catalog_provider
ON voice_catalog(provider)
WHERE is_active = true;

-- Trigger para updated_at
CREATE TRIGGER update_voice_catalog_updated_at
  BEFORE UPDATE ON voice_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 2.3 voice_assistant_configs

Configuracion de asistente por tenant (reemplaza `voice_agent_config`).

```sql
-- ============================================================================
-- TABLA: voice_assistant_configs
-- Descripcion: Configuracion de asistente de voz por tenant
-- Nota: Reemplaza la tabla voice_agent_config anterior
-- ============================================================================

CREATE TABLE voice_assistant_configs (
  -- Identificador
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relaciones
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  -- Si branch_id es NULL, aplica a todos los branches

  -- Tipo de asistente
  assistant_type_id TEXT NOT NULL REFERENCES voice_assistant_types(id),

  -- Personalizacion del asistente
  assistant_name TEXT NOT NULL DEFAULT 'Asistente',
  personality TEXT DEFAULT 'friendly',
  -- Opciones: 'professional', 'friendly', 'casual'

  first_message TEXT,
  -- Si es NULL, se usa el default del tipo

  custom_instructions TEXT,
  -- Instrucciones adicionales del admin

  -- Configuracion de voz
  voice_id TEXT REFERENCES voice_catalog(id),
  -- Si es NULL, se usa el default del tipo

  speech_speed TEXT DEFAULT 'balanced',
  -- Opciones: 'fast', 'balanced', 'patient'

  -- Comportamiento
  use_filler_phrases BOOLEAN DEFAULT true,
  filler_phrases TEXT[] DEFAULT ARRAY[
    'Dejame ver...',
    'Un momento por favor...',
    'Claro, dejame checar...',
    'Mmm...'
  ],

  max_response_length INTEGER DEFAULT 150,
  -- Maximo de caracteres por respuesta

  -- Escalacion
  escalation_enabled BOOLEAN DEFAULT true,
  escalation_phone TEXT,
  escalation_triggers TEXT[] DEFAULT ARRAY[
    'hablar con humano',
    'quiero hablar con alguien',
    'gerente',
    'esto es urgente'
  ],
  transfer_message TEXT DEFAULT 'Entiendo, dejame transferirte con alguien del equipo.',

  -- Estado
  is_enabled BOOLEAN DEFAULT false,

  -- Prompt cacheado
  cached_prompt TEXT,
  cached_prompt_hash TEXT,
  cached_prompt_at TIMESTAMPTZ,
  prompt_invalidated_at TIMESTAMPTZ,
  -- Se setea cuando cambian datos del negocio

  -- IDs de proveedores (internos, nunca expuestos al cliente)
  vapi_assistant_id TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Constraint: Un tenant solo puede tener una config por branch (o global)
  UNIQUE(tenant_id, branch_id)
);

-- Indices
CREATE INDEX idx_voice_assistant_configs_tenant
ON voice_assistant_configs(tenant_id)
WHERE is_enabled = true;

CREATE INDEX idx_voice_assistant_configs_tenant_branch
ON voice_assistant_configs(tenant_id, branch_id);

-- Trigger para updated_at
CREATE TRIGGER update_voice_assistant_configs_updated_at
  BEFORE UPDATE ON voice_assistant_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 2.4 voice_assistant_metrics

Metricas agregadas de rendimiento.

```sql
-- ============================================================================
-- TABLA: voice_assistant_metrics
-- Descripcion: Metricas agregadas de rendimiento por asistente
-- ============================================================================

CREATE TABLE voice_assistant_metrics (
  -- Identificador
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relaciones
  assistant_config_id UUID NOT NULL REFERENCES voice_assistant_configs(id) ON DELETE CASCADE,

  -- Periodo
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'daily',
  -- Opciones: 'hourly', 'daily', 'weekly', 'monthly'

  -- Volumen
  total_calls INTEGER DEFAULT 0,
  answered_calls INTEGER DEFAULT 0,
  missed_calls INTEGER DEFAULT 0,
  abandoned_calls INTEGER DEFAULT 0,

  -- Duracion
  avg_call_duration_seconds DECIMAL,
  max_call_duration_seconds INTEGER,
  min_call_duration_seconds INTEGER,
  total_call_minutes DECIMAL,

  -- Rendimiento (latencia)
  avg_response_latency_ms DECIMAL,
  p50_response_latency_ms DECIMAL,
  p95_response_latency_ms DECIMAL,
  p99_response_latency_ms DECIMAL,

  -- Circuit breaker
  circuit_breaker_trips INTEGER DEFAULT 0,
  fallback_responses_used INTEGER DEFAULT 0,

  -- Resultados
  successful_bookings INTEGER DEFAULT 0,
  successful_orders INTEGER DEFAULT 0,
  escalations INTEGER DEFAULT 0,
  information_given INTEGER DEFAULT 0,

  -- Satisfaccion (basado en analisis de sentimiento)
  positive_sentiment_calls INTEGER DEFAULT 0,
  neutral_sentiment_calls INTEGER DEFAULT 0,
  negative_sentiment_calls INTEGER DEFAULT 0,

  -- Costos
  total_cost_usd DECIMAL DEFAULT 0,
  avg_cost_per_call_usd DECIMAL,

  -- Tokens
  total_ai_tokens INTEGER DEFAULT 0,
  avg_tokens_per_call INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: Un solo registro por periodo
  UNIQUE(assistant_config_id, period_start, period_end, period_type)
);

-- Indices
CREATE INDEX idx_voice_assistant_metrics_period
ON voice_assistant_metrics(assistant_config_id, period_start, period_end);

CREATE INDEX idx_voice_assistant_metrics_type
ON voice_assistant_metrics(period_type, period_start);
```

### 2.5 voice_circuit_breaker_state

Estado del circuit breaker por tenant.

```sql
-- ============================================================================
-- TABLA: voice_circuit_breaker_state
-- Descripcion: Estado persistido del circuit breaker por tenant
-- ============================================================================

CREATE TABLE voice_circuit_breaker_state (
  -- Identificador (un estado por tenant)
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

  -- Estado del circuit breaker
  state TEXT NOT NULL DEFAULT 'CLOSED',
  -- Opciones: 'CLOSED', 'OPEN', 'HALF_OPEN'

  -- Contadores
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  half_open_attempts INTEGER DEFAULT 0,

  -- Timestamps de eventos
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_state_change_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  -- Cuando se abrio el circuit breaker

  -- Configuracion (puede override defaults)
  failure_threshold INTEGER DEFAULT 5,
  recovery_timeout_ms INTEGER DEFAULT 30000,
  max_latency_ms INTEGER DEFAULT 8000,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER update_voice_circuit_breaker_state_updated_at
  BEFORE UPDATE ON voice_circuit_breaker_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 3. SEED DATA

### 3.1 Seed: voice_assistant_types

```sql
-- ============================================================================
-- SEED: voice_assistant_types
-- ============================================================================

INSERT INTO voice_assistant_types (
  id, vertical, name, description,
  enabled_capabilities, prompt_template,
  tools_schema, structured_data_schemas,
  default_voice_id, sort_order
) VALUES

-- ================== RESTAURANT ==================

('rest_basic', 'restaurant', 'Reservaciones',
 'Solo maneja reservaciones de mesa y consultas basicas del restaurante',
 ARRAY['check_availability', 'create_reservation', 'get_business_hours', 'get_business_info'],
 'restaurant_reservations_v1',
 '{
   "tools": ["check_availability", "create_reservation", "get_business_hours", "get_business_info"],
   "require_confirmation": ["create_reservation"]
 }',
 '{"reservation": true, "order": false, "lead": true}',
 'sofia_es', 1),

('rest_standard', 'restaurant', 'Reservaciones + Menu',
 'Maneja reservaciones y consultas del menu, precios y recomendaciones',
 ARRAY['check_availability', 'create_reservation', 'get_business_hours', 'get_business_info', 'get_menu', 'get_recommendations'],
 'restaurant_standard_v1',
 '{
   "tools": ["check_availability", "create_reservation", "get_business_hours", "get_business_info", "get_menu", "get_recommendations"],
   "require_confirmation": ["create_reservation"]
 }',
 '{"reservation": true, "order": false, "lead": true}',
 'sofia_es', 2),

('rest_complete', 'restaurant', 'Completo',
 'Todo incluido: reservaciones, menu, pedidos telefonicos y seguimiento',
 ARRAY['check_availability', 'create_reservation', 'get_business_hours', 'get_business_info', 'get_menu', 'get_recommendations', 'create_order', 'get_order_status', 'modify_order'],
 'restaurant_complete_v1',
 '{
   "tools": ["check_availability", "create_reservation", "get_business_hours", "get_business_info", "get_menu", "get_recommendations", "create_order", "get_order_status", "modify_order"],
   "require_confirmation": ["create_reservation", "create_order", "modify_order"]
 }',
 '{"reservation": true, "order": true, "lead": true}',
 'sofia_es', 3),

-- ================== DENTAL ==================

('dental_basic', 'dental', 'Citas Basico',
 'Solo maneja agendamiento de citas y consultas de horarios',
 ARRAY['check_availability', 'create_appointment', 'get_business_hours', 'get_business_info'],
 'dental_appointments_v1',
 '{
   "tools": ["check_availability", "create_appointment", "get_business_hours", "get_business_info"],
   "require_confirmation": ["create_appointment"]
 }',
 '{"appointment": true, "inquiry": false, "lead": true, "emergency": false}',
 'carlos_es', 1),

('dental_standard', 'dental', 'Citas + Servicios',
 'Maneja citas y proporciona informacion de servicios y precios aproximados',
 ARRAY['check_availability', 'create_appointment', 'get_business_hours', 'get_business_info', 'get_services', 'get_prices', 'get_staff_info'],
 'dental_standard_v1',
 '{
   "tools": ["check_availability", "create_appointment", "get_business_hours", "get_business_info", "get_services", "get_prices", "get_staff_info"],
   "require_confirmation": ["create_appointment"]
 }',
 '{"appointment": true, "inquiry": true, "lead": true, "emergency": false}',
 'carlos_es', 2),

('dental_complete', 'dental', 'Completo',
 'Todo incluido: citas, servicios, reagendamiento, cancelaciones y manejo de urgencias',
 ARRAY['check_availability', 'create_appointment', 'modify_appointment', 'cancel_appointment', 'get_business_hours', 'get_business_info', 'get_services', 'get_prices', 'get_staff_info', 'handle_emergency', 'send_reminder'],
 'dental_complete_v1',
 '{
   "tools": ["check_availability", "create_appointment", "modify_appointment", "cancel_appointment", "get_business_hours", "get_business_info", "get_services", "get_prices", "get_staff_info", "handle_emergency", "send_reminder"],
   "require_confirmation": ["create_appointment", "modify_appointment", "cancel_appointment"]
 }',
 '{"appointment": true, "inquiry": true, "lead": true, "emergency": true}',
 'carlos_es', 3);
```

### 3.2 Seed: voice_catalog

```sql
-- ============================================================================
-- SEED: voice_catalog
-- ============================================================================

INSERT INTO voice_catalog (
  id, provider, provider_voice_id,
  name, gender, language, accent, description,
  model, stability, similarity_boost,
  categories, recommended_for, sort_order
) VALUES

-- ================== VOCES EN ESPANOL ==================

('sofia_es', 'elevenlabs', 'LegCbmbXKbT5PUp3QFWv',
 'Sofia', 'female', 'es', 'neutral',
 'Voz femenina calida y profesional. Ideal para atencion al cliente y servicios.',
 'eleven_multilingual_v2', 0.5, 0.75,
 ARRAY['warm', 'professional', 'friendly'],
 ARRAY['restaurant', 'dental', 'clinic', 'beauty'],
 1),

('carlos_es', 'elevenlabs', 'onwK4e9ZLuTAKqWW03F9',
 'Carlos', 'male', 'es', 'neutral',
 'Voz masculina seria y confiable. Ideal para servicios profesionales y medicos.',
 'eleven_multilingual_v2', 0.6, 0.70,
 ARRAY['professional', 'trustworthy', 'mature'],
 ARRAY['dental', 'clinic', 'veterinary'],
 2),

('luna_es', 'elevenlabs', 'jBpfuIE2acCO8z3wKNLl',
 'Luna', 'female', 'es', 'mexico',
 'Voz femenina juvenil y amigable. Ideal para restaurantes casuales y gimnasios.',
 'eleven_multilingual_v2', 0.45, 0.80,
 ARRAY['young', 'friendly', 'energetic'],
 ARRAY['restaurant', 'gym', 'beauty'],
 3),

('diego_es', 'elevenlabs', 'TxGEqnHWrfWFTfGW9XjX',
 'Diego', 'male', 'es', 'neutral',
 'Voz masculina neutral y clara. Versatil para cualquier tipo de negocio.',
 'eleven_multilingual_v2', 0.55, 0.75,
 ARRAY['neutral', 'clear', 'versatile'],
 ARRAY['restaurant', 'dental', 'clinic', 'gym', 'beauty', 'veterinary'],
 4),

('maria_es', 'elevenlabs', 'XB0fDUnXU5powFXDhCwa',
 'Maria', 'female', 'es', 'spain',
 'Voz femenina con acento espanol. Elegante y sofisticada.',
 'eleven_multilingual_v2', 0.5, 0.75,
 ARRAY['elegant', 'sophisticated', 'european'],
 ARRAY['restaurant', 'beauty'],
 5),

('javier_es', 'elevenlabs', 'ErXwobaYiN019PkySvjV',
 'Javier', 'male', 'es', 'mexico',
 'Voz masculina con acento mexicano. Cercano y amigable.',
 'eleven_multilingual_v2', 0.5, 0.75,
 ARRAY['friendly', 'approachable', 'casual'],
 ARRAY['restaurant', 'gym'],
 6),

-- ================== VOCES EN INGLES (Futuro) ==================

('sarah_en', 'elevenlabs', 'EXAVITQu4vr4xnSDxMaL',
 'Sarah', 'female', 'en', 'american',
 'Professional female voice for customer service. American accent.',
 'eleven_multilingual_v2', 0.5, 0.75,
 ARRAY['professional', 'friendly'],
 ARRAY['restaurant', 'dental', 'clinic'],
 10),

('michael_en', 'elevenlabs', 'flq6f7yk4E4fJM5XTYuZ',
 'Michael', 'male', 'en', 'american',
 'Friendly male voice for general business. American accent.',
 'eleven_multilingual_v2', 0.5, 0.75,
 ARRAY['friendly', 'professional'],
 ARRAY['restaurant', 'dental', 'clinic'],
 11);
```

---

## 4. RLS POLICIES

```sql
-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- voice_assistant_types: Lectura publica (tipos son globales)
ALTER TABLE voice_assistant_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_assistant_types_select_all"
ON voice_assistant_types FOR SELECT
TO authenticated
USING (is_active = true);

-- voice_catalog: Lectura publica
ALTER TABLE voice_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_catalog_select_all"
ON voice_catalog FOR SELECT
TO authenticated
USING (is_active = true);

-- voice_assistant_configs: Solo el tenant puede ver/modificar su config
ALTER TABLE voice_assistant_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_assistant_configs_select_own"
ON voice_assistant_configs FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "voice_assistant_configs_insert_own"
ON voice_assistant_configs FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "voice_assistant_configs_update_own"
ON voice_assistant_configs FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- voice_assistant_metrics: Solo el tenant puede ver sus metricas
ALTER TABLE voice_assistant_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_assistant_metrics_select_own"
ON voice_assistant_metrics FOR SELECT
TO authenticated
USING (
  assistant_config_id IN (
    SELECT id FROM voice_assistant_configs
    WHERE tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
    )
  )
);

-- voice_circuit_breaker_state: Solo acceso interno (service role)
ALTER TABLE voice_circuit_breaker_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_circuit_breaker_state_service_only"
ON voice_circuit_breaker_state FOR ALL
TO service_role
USING (true);
```

---

## 5. FUNCIONES SQL HELPERS

### 5.1 Funcion: get_voice_config_for_call

```sql
-- ============================================================================
-- FUNCION: get_voice_config_for_call
-- Descripcion: Obtiene la configuracion de voz para una llamada
-- Nota: Incluye config incluso si is_enabled = false (para llamadas activas)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_voice_config_for_call(
  p_phone_number TEXT
)
RETURNS TABLE (
  config_id UUID,
  tenant_id UUID,
  assistant_type_id TEXT,
  assistant_name TEXT,
  personality TEXT,
  first_message TEXT,
  custom_instructions TEXT,
  voice_id TEXT,
  speech_speed TEXT,
  use_filler_phrases BOOLEAN,
  filler_phrases TEXT[],
  escalation_enabled BOOLEAN,
  escalation_phone TEXT,
  escalation_triggers TEXT[],
  transfer_message TEXT,
  cached_prompt TEXT,
  vapi_assistant_id TEXT,
  -- Del tipo
  type_name TEXT,
  type_capabilities TEXT[],
  type_tools_schema JSONB,
  type_structured_data_schemas JSONB,
  type_prompt_template TEXT,
  -- De la voz
  voice_provider TEXT,
  voice_provider_id TEXT,
  voice_model TEXT,
  voice_stability DECIMAL,
  voice_similarity_boost DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vac.id as config_id,
    vac.tenant_id,
    vac.assistant_type_id,
    vac.assistant_name,
    vac.personality,
    vac.first_message,
    vac.custom_instructions,
    vac.voice_id,
    vac.speech_speed,
    vac.use_filler_phrases,
    vac.filler_phrases,
    vac.escalation_enabled,
    vac.escalation_phone,
    vac.escalation_triggers,
    vac.transfer_message,
    vac.cached_prompt,
    vac.vapi_assistant_id,
    -- Del tipo
    vat.name as type_name,
    vat.enabled_capabilities as type_capabilities,
    vat.tools_schema as type_tools_schema,
    vat.structured_data_schemas as type_structured_data_schemas,
    vat.prompt_template as type_prompt_template,
    -- De la voz
    vc.provider as voice_provider,
    vc.provider_voice_id as voice_provider_id,
    vc.model as voice_model,
    vc.stability as voice_stability,
    vc.similarity_boost as voice_similarity_boost
  FROM voice_phone_numbers vpn
  JOIN voice_assistant_configs vac ON vac.tenant_id = vpn.tenant_id
  JOIN voice_assistant_types vat ON vat.id = vac.assistant_type_id
  LEFT JOIN voice_catalog vc ON vc.id = COALESCE(vac.voice_id, vat.default_voice_id)
  WHERE vpn.phone_number = p_phone_number
    AND vpn.status = 'active'
  -- No filtramos por is_enabled para permitir llamadas activas
  LIMIT 1;
END;
$$;
```

### 5.2 Funcion: update_circuit_breaker_state

```sql
-- ============================================================================
-- FUNCION: update_circuit_breaker_state
-- Descripcion: Actualiza el estado del circuit breaker atomicamente
-- ============================================================================

CREATE OR REPLACE FUNCTION update_circuit_breaker_state(
  p_tenant_id UUID,
  p_new_state TEXT,
  p_failure_count INTEGER DEFAULT NULL,
  p_success_count INTEGER DEFAULT NULL,
  p_last_failure_at TIMESTAMPTZ DEFAULT NULL,
  p_last_success_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS voice_circuit_breaker_state
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result voice_circuit_breaker_state;
BEGIN
  INSERT INTO voice_circuit_breaker_state (
    tenant_id,
    state,
    failure_count,
    success_count,
    last_failure_at,
    last_success_at,
    last_state_change_at,
    opened_at
  )
  VALUES (
    p_tenant_id,
    p_new_state,
    COALESCE(p_failure_count, 0),
    COALESCE(p_success_count, 0),
    p_last_failure_at,
    p_last_success_at,
    NOW(),
    CASE WHEN p_new_state = 'OPEN' THEN NOW() ELSE NULL END
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    state = EXCLUDED.state,
    failure_count = COALESCE(p_failure_count, voice_circuit_breaker_state.failure_count),
    success_count = COALESCE(p_success_count, voice_circuit_breaker_state.success_count),
    last_failure_at = COALESCE(p_last_failure_at, voice_circuit_breaker_state.last_failure_at),
    last_success_at = COALESCE(p_last_success_at, voice_circuit_breaker_state.last_success_at),
    last_state_change_at = CASE
      WHEN voice_circuit_breaker_state.state != EXCLUDED.state THEN NOW()
      ELSE voice_circuit_breaker_state.last_state_change_at
    END,
    opened_at = CASE
      WHEN EXCLUDED.state = 'OPEN' AND voice_circuit_breaker_state.state != 'OPEN' THEN NOW()
      WHEN EXCLUDED.state != 'OPEN' THEN NULL
      ELSE voice_circuit_breaker_state.opened_at
    END,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
```

### 5.3 Funcion: aggregate_voice_metrics

```sql
-- ============================================================================
-- FUNCION: aggregate_voice_metrics
-- Descripcion: Agrega metricas de llamadas en un periodo
-- ============================================================================

CREATE OR REPLACE FUNCTION aggregate_voice_metrics(
  p_assistant_config_id UUID,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_period_type TEXT DEFAULT 'daily'
)
RETURNS voice_assistant_metrics
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result voice_assistant_metrics;
  v_tenant_id UUID;
BEGIN
  -- Obtener tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM voice_assistant_configs
  WHERE id = p_assistant_config_id;

  -- Insertar o actualizar metricas
  INSERT INTO voice_assistant_metrics (
    assistant_config_id,
    period_start,
    period_end,
    period_type,
    total_calls,
    answered_calls,
    missed_calls,
    abandoned_calls,
    avg_call_duration_seconds,
    max_call_duration_seconds,
    min_call_duration_seconds,
    total_call_minutes,
    avg_response_latency_ms,
    successful_bookings,
    escalations,
    positive_sentiment_calls,
    neutral_sentiment_calls,
    negative_sentiment_calls,
    total_cost_usd,
    total_ai_tokens
  )
  SELECT
    p_assistant_config_id,
    p_period_start,
    p_period_end,
    p_period_type,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE status = 'completed') as answered_calls,
    COUNT(*) FILTER (WHERE status = 'missed') as missed_calls,
    COUNT(*) FILTER (WHERE status = 'abandoned') as abandoned_calls,
    AVG(duration_seconds) as avg_call_duration_seconds,
    MAX(duration_seconds) as max_call_duration_seconds,
    MIN(duration_seconds) as min_call_duration_seconds,
    SUM(duration_seconds) / 60.0 as total_call_minutes,
    AVG(latency_avg_ms) as avg_response_latency_ms,
    COUNT(*) FILTER (WHERE outcome = 'appointment_booked') as successful_bookings,
    COUNT(*) FILTER (WHERE escalated = true) as escalations,
    COUNT(*) FILTER (WHERE (analysis->>'sentiment')::text = 'positive') as positive_sentiment_calls,
    COUNT(*) FILTER (WHERE (analysis->>'sentiment')::text = 'neutral') as neutral_sentiment_calls,
    COUNT(*) FILTER (WHERE (analysis->>'sentiment')::text = 'negative') as negative_sentiment_calls,
    SUM(cost_usd) as total_cost_usd,
    SUM(ai_tokens_used) as total_ai_tokens
  FROM voice_calls
  WHERE tenant_id = v_tenant_id
    AND started_at >= p_period_start
    AND started_at < p_period_end
  ON CONFLICT (assistant_config_id, period_start, period_end, period_type)
  DO UPDATE SET
    total_calls = EXCLUDED.total_calls,
    answered_calls = EXCLUDED.answered_calls,
    missed_calls = EXCLUDED.missed_calls,
    abandoned_calls = EXCLUDED.abandoned_calls,
    avg_call_duration_seconds = EXCLUDED.avg_call_duration_seconds,
    max_call_duration_seconds = EXCLUDED.max_call_duration_seconds,
    min_call_duration_seconds = EXCLUDED.min_call_duration_seconds,
    total_call_minutes = EXCLUDED.total_call_minutes,
    avg_response_latency_ms = EXCLUDED.avg_response_latency_ms,
    successful_bookings = EXCLUDED.successful_bookings,
    escalations = EXCLUDED.escalations,
    positive_sentiment_calls = EXCLUDED.positive_sentiment_calls,
    neutral_sentiment_calls = EXCLUDED.neutral_sentiment_calls,
    negative_sentiment_calls = EXCLUDED.negative_sentiment_calls,
    total_cost_usd = EXCLUDED.total_cost_usd,
    total_ai_tokens = EXCLUDED.total_ai_tokens,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
```

---

## 6. MIGRACION DE DATOS

### 6.1 Script de Migracion

```sql
-- ============================================================================
-- MIGRACION: voice_agent_config -> voice_assistant_configs
-- ============================================================================

-- Paso 1: Crear backup
CREATE TABLE IF NOT EXISTS voice_agent_config_backup_v2 AS
SELECT * FROM voice_agent_config;

-- Paso 2: Migrar datos
INSERT INTO voice_assistant_configs (
  tenant_id,
  branch_id,
  assistant_type_id,
  assistant_name,
  personality,
  first_message,
  custom_instructions,
  voice_id,
  speech_speed,
  use_filler_phrases,
  filler_phrases,
  escalation_enabled,
  escalation_phone,
  escalation_triggers,
  is_enabled,
  cached_prompt,
  cached_prompt_at,
  vapi_assistant_id,
  created_at,
  updated_at
)
SELECT
  vac.tenant_id,
  NULL as branch_id, -- Aplica a todos los branches
  CASE
    WHEN t.vertical = 'restaurant' THEN 'rest_standard'
    WHEN t.vertical = 'dental' THEN 'dental_standard'
    ELSE 'rest_standard'
  END as assistant_type_id,
  COALESCE(vac.assistant_name, 'Asistente') as assistant_name,
  COALESCE(vac.assistant_personality, 'friendly') as personality,
  vac.first_message,
  vac.custom_instructions,
  'sofia_es' as voice_id, -- Default
  COALESCE(vac.response_speed, 'balanced') as speech_speed,
  COALESCE(vac.use_filler_phrases, true),
  COALESCE(vac.filler_phrases, ARRAY['Dejame ver...', 'Un momento...']),
  COALESCE(vac.escalation_enabled, true),
  vac.escalation_phone,
  COALESCE(vac.escalation_triggers, ARRAY['hablar con humano', 'gerente']),
  vac.voice_enabled as is_enabled,
  vac.system_prompt as cached_prompt,
  vac.system_prompt_generated_at as cached_prompt_at,
  vac.vapi_assistant_id,
  vac.created_at,
  vac.updated_at
FROM voice_agent_config vac
JOIN tenants t ON t.id = vac.tenant_id
ON CONFLICT (tenant_id, branch_id) DO NOTHING;

-- Paso 3: Verificar migracion
DO $$
DECLARE
  v_old_count INTEGER;
  v_new_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_old_count FROM voice_agent_config;
  SELECT COUNT(*) INTO v_new_count FROM voice_assistant_configs;

  IF v_old_count > v_new_count THEN
    RAISE WARNING 'Migration incomplete: old=%, new=%', v_old_count, v_new_count;
  ELSE
    RAISE NOTICE 'Migration successful: % records migrated', v_new_count;
  END IF;
END $$;
```

---

## 7. DIAGRAMA ER

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VOICE AGENT v2.0 - ER DIAGRAM                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────┐         ┌──────────────────────┐                     │
│  │ voice_assistant_types│         │ voice_catalog        │                     │
│  ├──────────────────────┤         ├──────────────────────┤                     │
│  │ PK id (TEXT)         │         │ PK id (TEXT)         │                     │
│  │    vertical          │         │    provider          │                     │
│  │    name              │         │    provider_voice_id │                     │
│  │    enabled_capabilit.│         │    name              │                     │
│  │    tools_schema      │         │    gender            │                     │
│  │    structured_data_s.│         │    language          │                     │
│  │    default_voice_id ─┼────────>│    model             │                     │
│  │    prompt_template   │         │    stability         │                     │
│  └──────────┬───────────┘         └──────────────────────┘                     │
│             │                                ▲                                   │
│             │ 1:N                            │                                   │
│             ▼                                │ 1:N                               │
│  ┌──────────────────────┐                   │                                   │
│  │ voice_assistant_     │                   │                                   │
│  │ configs              │                   │                                   │
│  ├──────────────────────┤                   │                                   │
│  │ PK id (UUID)         │                   │                                   │
│  │ FK tenant_id ────────┼──> tenants        │                                   │
│  │ FK branch_id ────────┼──> branches       │                                   │
│  │ FK assistant_type_id─┼───────────────────┘                                   │
│  │ FK voice_id ─────────┼───────────────────>                                   │
│  │    assistant_name    │                                                        │
│  │    personality       │                                                        │
│  │    is_enabled        │                                                        │
│  │    cached_prompt     │                                                        │
│  │    vapi_assistant_id │                                                        │
│  └──────────┬───────────┘                                                        │
│             │                                                                    │
│             │ 1:N                                                                │
│             ▼                                                                    │
│  ┌──────────────────────┐         ┌──────────────────────┐                     │
│  │ voice_assistant_     │         │ voice_circuit_       │                     │
│  │ metrics              │         │ breaker_state        │                     │
│  ├──────────────────────┤         ├──────────────────────┤                     │
│  │ PK id (UUID)         │         │ PK tenant_id ────────┼──> tenants          │
│  │ FK assistant_config_i│         │    state             │                     │
│  │    period_start      │         │    failure_count     │                     │
│  │    period_end        │         │    last_failure_at   │                     │
│  │    total_calls       │         │    last_state_change │                     │
│  │    avg_latency_ms    │         └──────────────────────┘                     │
│  └──────────────────────┘                                                        │
│                                                                                  │
│  ┌──────────────────────┐         ┌──────────────────────┐                     │
│  │ voice_calls          │         │ voice_call_messages  │                     │
│  ├──────────────────────┤         ├──────────────────────┤                     │
│  │ PK id (UUID)         │◄────────┤ FK call_id           │                     │
│  │ FK tenant_id         │  1:N    │ PK id (UUID)         │                     │
│  │    vapi_call_id      │         │    role              │                     │
│  │    status            │         │    content           │                     │
│  │    duration_seconds  │         │    sequence_number   │                     │
│  │    analysis          │         └──────────────────────┘                     │
│  │    outcome           │                                                        │
│  └──────────────────────┘                                                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. PROXIMOS PASOS

1. Crear migraciones en `supabase/migrations/`
2. Ejecutar seed data
3. Actualizar tipos TypeScript
4. Actualizar servicios para usar nuevas tablas

---

*Este documento es parte de la documentacion de Voice Agent v2.0.*

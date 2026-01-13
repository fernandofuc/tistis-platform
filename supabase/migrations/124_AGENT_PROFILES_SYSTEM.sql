-- =====================================================
-- TIS TIS PLATFORM - Agent Profiles System
-- Migration 124: Sistema de Perfiles de Agentes de IA
-- =====================================================
--
-- PROPÓSITO:
-- Crear un sistema unificado de perfiles de agentes que permita:
-- 1. Perfil de Negocio (clínica/restaurante) - mensajería + voz
-- 2. Perfil Personal (marca del doctor/dueño) - solo mensajería
--
-- Cada perfil tiene su propia configuración pero comparte:
-- - Knowledge Base del tenant
-- - Servicios y catálogo
-- - Sucursales y staff
--
-- ARQUITECTURA:
-- tenant → agent_profiles → ai_agents (canales)
--                        → voice_agent_config (solo business)
--
-- =====================================================

-- =====================================================
-- 0. PRE-REQUISITO: TABLA ai_agents
-- Tabla que almacena los agentes de IA por canal
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Tipo de canal
    channel_type VARCHAR(50) NOT NULL CHECK (channel_type IN (
        'whatsapp',
        'instagram',
        'facebook',
        'tiktok',
        'webchat'
    )),

    -- Identificador del canal (phone_number_id para WhatsApp, page_id para Meta, etc.)
    channel_identifier VARCHAR(255),

    -- Número de cuenta (para múltiples cuentas del mismo canal)
    account_number INTEGER DEFAULT 1 CHECK (account_number IN (1, 2)),

    -- Estado del agente
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Configuración específica del canal
    channel_config JSONB DEFAULT '{}'::jsonb,

    -- Estadísticas
    messages_processed INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un agente por canal+cuenta por tenant
    UNIQUE(tenant_id, channel_type, account_number)
);

-- Índices para ai_agents
CREATE INDEX IF NOT EXISTS idx_ai_agents_tenant ON ai_agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_channel ON ai_agents(channel_type);
CREATE INDEX IF NOT EXISTS idx_ai_agents_active ON ai_agents(tenant_id, is_active) WHERE is_active = true;

-- Trigger para updated_at en ai_agents
CREATE OR REPLACE FUNCTION update_ai_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_agents_updated_at ON ai_agents;
CREATE TRIGGER trigger_ai_agents_updated_at
    BEFORE UPDATE ON ai_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_agents_updated_at();

-- RLS para ai_agents
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_agents_select_policy" ON ai_agents;
CREATE POLICY "ai_agents_select_policy" ON ai_agents
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "ai_agents_insert_policy" ON ai_agents;
CREATE POLICY "ai_agents_insert_policy" ON ai_agents
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "ai_agents_update_policy" ON ai_agents;
CREATE POLICY "ai_agents_update_policy" ON ai_agents
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "ai_agents_delete_policy" ON ai_agents;
CREATE POLICY "ai_agents_delete_policy" ON ai_agents
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'owner'
        )
    );

DROP POLICY IF EXISTS "ai_agents_service_role_policy" ON ai_agents;
CREATE POLICY "ai_agents_service_role_policy" ON ai_agents
    FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE ai_agents IS
'Agentes de IA configurados por canal de mensajería. Cada tenant puede tener múltiples agentes
para diferentes canales (WhatsApp, Instagram, etc.) con hasta 2 cuentas por canal.';

-- =====================================================
-- 1. TABLA: agent_profiles
-- Perfiles de agente (business o personal)
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Tipo de perfil
    profile_type VARCHAR(20) NOT NULL CHECK (profile_type IN ('business', 'personal')),

    -- Información básica del perfil
    profile_name VARCHAR(100) NOT NULL,
    profile_description TEXT,

    -- Template de agente seleccionado
    -- Ej: 'dental_full', 'dental_appointments_only', 'resto_full', etc.
    agent_template VARCHAR(50) NOT NULL DEFAULT 'full_service',

    -- Estilo de respuesta
    response_style VARCHAR(30) NOT NULL DEFAULT 'professional_friendly'
        CHECK (response_style IN ('professional', 'professional_friendly', 'casual', 'formal')),

    -- Configuración de delay (principalmente para perfil personal)
    response_delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (response_delay_minutes >= 0 AND response_delay_minutes <= 60),
    response_delay_first_only BOOLEAN NOT NULL DEFAULT true,

    -- Instrucciones adicionales específicas del perfil
    -- Se AÑADEN a las instrucciones de la KB, no las reemplazan
    custom_instructions_override TEXT,

    -- Configuración de AI Learning
    ai_learning_enabled BOOLEAN NOT NULL DEFAULT true,
    ai_learning_config JSONB NOT NULL DEFAULT '{
        "learn_patterns": true,
        "learn_vocabulary": false,
        "learn_preferences": true,
        "sync_to_business_ia": true
    }'::jsonb,

    -- Configuración adicional del perfil
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Estado
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Constraints
    -- Un tenant puede tener máximo 1 perfil de cada tipo
    UNIQUE(tenant_id, profile_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_agent_profiles_tenant ON agent_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_type ON agent_profiles(profile_type);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_active ON agent_profiles(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_agent_profiles_template ON agent_profiles(agent_template);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_agent_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_profiles_updated_at
    BEFORE UPDATE ON agent_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_profiles_updated_at();

-- =====================================================
-- 2. MODIFICAR: ai_agents
-- Agregar referencia al perfil
-- =====================================================

-- Agregar columna profile_id
ALTER TABLE ai_agents
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL;

-- Índice para búsqueda por perfil
CREATE INDEX IF NOT EXISTS idx_ai_agents_profile ON ai_agents(profile_id) WHERE profile_id IS NOT NULL;

-- =====================================================
-- 3. MODIFICAR: voice_agent_config
-- Agregar referencia al perfil (siempre será business)
-- =====================================================

ALTER TABLE voice_agent_config
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_voice_agent_config_profile ON voice_agent_config(profile_id) WHERE profile_id IS NOT NULL;

-- =====================================================
-- 4. MODIFICAR: ai_generated_prompts
-- Agregar referencia al perfil para cache por perfil
-- =====================================================

ALTER TABLE ai_generated_prompts
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES agent_profiles(id) ON DELETE CASCADE;

-- Actualizar constraint único para incluir profile_id
-- Primero eliminar el viejo si existe
ALTER TABLE ai_generated_prompts
DROP CONSTRAINT IF EXISTS ai_generated_prompts_tenant_id_channel_key;

-- Crear nuevo constraint que permite NULL en profile_id (backward compatible)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_generated_prompts_tenant_channel_profile
ON ai_generated_prompts(tenant_id, channel, COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- =====================================================
-- 5. TABLA: agent_templates
-- Templates de agente predefinidos por TIS TIS
-- =====================================================

CREATE TABLE IF NOT EXISTS agent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificación
    template_key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Clasificación
    vertical VARCHAR(50) NOT NULL CHECK (vertical IN ('dental', 'restaurant', 'medical', 'gym', 'beauty', 'veterinary', 'services', 'general')),
    profile_type VARCHAR(20) NOT NULL CHECK (profile_type IN ('business', 'personal')),

    -- Capacidades habilitadas
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Ejemplo: ["booking", "pricing", "faq", "lead_capture", "objections"]

    -- Prompt base (template con variables {{business_name}}, etc.)
    prompt_template TEXT NOT NULL,

    -- Variables que el cliente puede personalizar
    customizable_variables JSONB NOT NULL DEFAULT '["business_name", "greeting", "schedule"]'::jsonb,

    -- Orden de display
    display_order INTEGER NOT NULL DEFAULT 0,

    -- Estado
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_templates_vertical ON agent_templates(vertical);
CREATE INDEX IF NOT EXISTS idx_agent_templates_type ON agent_templates(profile_type);
CREATE INDEX IF NOT EXISTS idx_agent_templates_active ON agent_templates(is_active, vertical) WHERE is_active = true;

-- =====================================================
-- 6. RLS POLICIES - agent_profiles
-- =====================================================

ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: Usuarios pueden ver perfiles de sus tenants
CREATE POLICY "agent_profiles_select_policy" ON agent_profiles
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
        )
    );

-- INSERT: Solo owners/admins pueden crear perfiles
CREATE POLICY "agent_profiles_insert_policy" ON agent_profiles
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- UPDATE: Solo owners/admins pueden actualizar
CREATE POLICY "agent_profiles_update_policy" ON agent_profiles
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- DELETE: Solo owners pueden eliminar
CREATE POLICY "agent_profiles_delete_policy" ON agent_profiles
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'owner'
        )
    );

-- Service role bypass
CREATE POLICY "agent_profiles_service_role_policy" ON agent_profiles
    FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- 7. RLS POLICIES - agent_templates
-- =====================================================

ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;

-- Templates son de solo lectura para usuarios autenticados
CREATE POLICY "agent_templates_select_policy" ON agent_templates
    FOR SELECT
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Solo service_role puede modificar templates
CREATE POLICY "agent_templates_service_role_policy" ON agent_templates
    FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- 8. FUNCIÓN: Crear perfil business por defecto
-- Se ejecuta cuando se crea un nuevo tenant
-- =====================================================

CREATE OR REPLACE FUNCTION create_default_business_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Crear perfil de negocio por defecto
    INSERT INTO agent_profiles (
        tenant_id,
        profile_type,
        profile_name,
        agent_template,
        response_style,
        ai_learning_enabled,
        is_active,
        created_by
    ) VALUES (
        NEW.id,
        'business',
        COALESCE(NEW.name, 'Mi Negocio'),
        'full_service',
        'professional_friendly',
        true,
        true,
        NEW.owner_id
    )
    ON CONFLICT (tenant_id, profile_type) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil cuando se crea tenant
-- Solo si no existe ya
DROP TRIGGER IF EXISTS trigger_create_default_profile ON tenants;
CREATE TRIGGER trigger_create_default_profile
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION create_default_business_profile();

-- =====================================================
-- 9. FUNCIÓN: Obtener perfil activo para un tenant
-- =====================================================

CREATE OR REPLACE FUNCTION get_active_agent_profile(
    p_tenant_id UUID,
    p_profile_type VARCHAR DEFAULT 'business'
)
RETURNS TABLE (
    profile_id UUID,
    profile_name VARCHAR,
    profile_type VARCHAR,
    agent_template VARCHAR,
    response_style VARCHAR,
    response_delay_minutes INTEGER,
    response_delay_first_only BOOLEAN,
    custom_instructions TEXT,
    ai_learning_enabled BOOLEAN,
    ai_learning_config JSONB,
    settings JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ap.id,
        ap.profile_name,
        ap.profile_type,
        ap.agent_template,
        ap.response_style,
        ap.response_delay_minutes,
        ap.response_delay_first_only,
        ap.custom_instructions_override,
        ap.ai_learning_enabled,
        ap.ai_learning_config,
        ap.settings
    FROM agent_profiles ap
    WHERE ap.tenant_id = p_tenant_id
      AND ap.profile_type = p_profile_type
      AND ap.is_active = true
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_agent_profile TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_agent_profile TO service_role;

-- =====================================================
-- 10. FUNCIÓN: Vincular agentes existentes a perfiles
-- Migración de datos existentes
-- =====================================================

CREATE OR REPLACE FUNCTION migrate_existing_agents_to_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tenant_record RECORD;
    business_profile_id UUID;
BEGIN
    -- Para cada tenant que tenga ai_agents pero no tenga profile
    FOR tenant_record IN
        SELECT DISTINCT t.id as tenant_id, t.name, t.owner_id
        FROM tenants t
        JOIN ai_agents aa ON aa.tenant_id = t.id
        WHERE NOT EXISTS (
            SELECT 1 FROM agent_profiles ap
            WHERE ap.tenant_id = t.id AND ap.profile_type = 'business'
        )
    LOOP
        -- Crear perfil business para este tenant
        INSERT INTO agent_profiles (
            tenant_id,
            profile_type,
            profile_name,
            agent_template,
            response_style,
            is_active
        ) VALUES (
            tenant_record.tenant_id,
            'business',
            COALESCE(tenant_record.name, 'Mi Negocio'),
            'full_service',
            'professional_friendly',
            true
        )
        RETURNING id INTO business_profile_id;

        -- Vincular ai_agents existentes a este perfil
        UPDATE ai_agents
        SET profile_id = business_profile_id
        WHERE tenant_id = tenant_record.tenant_id
          AND profile_id IS NULL;

        -- Vincular voice_agent_config si existe
        UPDATE voice_agent_config
        SET profile_id = business_profile_id
        WHERE tenant_id = tenant_record.tenant_id
          AND profile_id IS NULL;

        RAISE NOTICE 'Migrated tenant % to profile %', tenant_record.tenant_id, business_profile_id;
    END LOOP;

    -- También crear perfiles para tenants sin ai_agents
    INSERT INTO agent_profiles (tenant_id, profile_type, profile_name, agent_template, response_style, is_active)
    SELECT t.id, 'business', COALESCE(t.name, 'Mi Negocio'), 'full_service', 'professional_friendly', true
    FROM tenants t
    WHERE NOT EXISTS (
        SELECT 1 FROM agent_profiles ap WHERE ap.tenant_id = t.id AND ap.profile_type = 'business'
    )
    ON CONFLICT (tenant_id, profile_type) DO NOTHING;
END;
$$;

-- Ejecutar migración
SELECT migrate_existing_agents_to_profiles();

-- =====================================================
-- 11. INSERTAR TEMPLATES DE AGENTE PREDEFINIDOS
-- =====================================================

-- Limpiar templates existentes para evitar duplicados
DELETE FROM agent_templates WHERE template_key LIKE 'dental_%' OR template_key LIKE 'resto_%' OR template_key LIKE 'general_%';

-- Templates para DENTAL
INSERT INTO agent_templates (template_key, name, description, vertical, profile_type, capabilities, prompt_template, customizable_variables, display_order, is_default) VALUES
(
    'dental_full',
    'Asistente Completo',
    'Agenda citas, responde consultas, captura leads, maneja objeciones',
    'dental',
    'business',
    '["booking", "pricing", "faq", "lead_capture", "objections", "location", "hours"]'::jsonb,
    'Eres el asistente virtual de {{business_name}}, una clínica dental profesional ubicada en {{location}}.

PERSONALIDAD: {{response_style}}

TU MISIÓN:
- Agendar citas con nuestros especialistas
- Informar sobre servicios y precios
- Resolver dudas de pacientes potenciales
- Capturar información de leads interesados

REGLAS INQUEBRANTABLES:
1. NUNCA inventar precios específicos si no los conoces
2. NUNCA diagnosticar condiciones médicas
3. SIEMPRE derivar emergencias a llamada directa
4. SIEMPRE confirmar datos antes de agendar

SALUDO: {{greeting}}
HORARIO: {{schedule}}',
    '["business_name", "location", "greeting", "schedule", "response_style"]'::jsonb,
    1,
    true
),
(
    'dental_appointments_only',
    'Solo Citas',
    'Se enfoca únicamente en agendar citas con el equipo dental',
    'dental',
    'business',
    '["booking", "location", "hours"]'::jsonb,
    'Eres el asistente de citas de {{business_name}}.

TU ÚNICA MISIÓN: Agendar citas con nuestros dentistas.

Para cualquier otra consulta, indica amablemente que tu función es agendar citas y ofrece hacerlo.

SALUDO: {{greeting}}
HORARIO: {{schedule}}',
    '["business_name", "greeting", "schedule"]'::jsonb,
    2,
    false
),
(
    'dental_personal',
    'Marca Personal Doctor',
    'Para las redes sociales personales del doctor',
    'dental',
    'personal',
    '["redirect_to_clinic", "basic_info"]'::jsonb,
    'Eres el asistente personal de {{doctor_name}}, odontólogo especialista.

Cuando alguien pregunte por citas o servicios, deriva amablemente a la clínica:
"Para agendar una cita, te invito a contactar directamente a {{clinic_name}} donde {{doctor_name}} atiende. Puedes escribirles a {{clinic_contact}}."

Puedes responder preguntas generales sobre odontología de forma educativa, pero NUNCA:
- Dar diagnósticos
- Dar precios específicos
- Agendar citas directamente',
    '["doctor_name", "clinic_name", "clinic_contact"]'::jsonb,
    10,
    true
);

-- Templates para RESTAURANT
INSERT INTO agent_templates (template_key, name, description, vertical, profile_type, capabilities, prompt_template, customizable_variables, display_order, is_default) VALUES
(
    'resto_full',
    'Servicio Completo',
    'Reservaciones de mesas + pedidos para recoger',
    'restaurant',
    'business',
    '["reservations", "ordering", "menu_info", "location", "hours"]'::jsonb,
    'Eres el asistente virtual de {{business_name}}, un restaurante ubicado en {{location}}.

PUEDES AYUDAR CON:
1. Reservaciones de mesa
2. Pedidos para recoger en sucursal
3. Información del menú
4. Horarios y ubicación

PERSONALIDAD: {{response_style}}

SALUDO: {{greeting}}
HORARIO: {{schedule}}

REGLAS:
- Para reservaciones, SIEMPRE confirma: fecha, hora, número de personas, nombre
- Para pedidos, confirma: platillos, sucursal de recogida, hora aproximada
- Si preguntan por delivery, indica que solo manejamos pedidos para recoger',
    '["business_name", "location", "greeting", "schedule", "response_style"]'::jsonb,
    1,
    true
),
(
    'resto_reservations_only',
    'Solo Reservaciones',
    'Únicamente maneja reservaciones de mesas',
    'restaurant',
    'business',
    '["reservations", "location", "hours"]'::jsonb,
    'Eres el asistente de reservaciones de {{business_name}}.

TU ÚNICA FUNCIÓN: Reservar mesas para nuestros clientes.

Para reservar necesito:
- Fecha y hora deseada
- Número de personas
- Nombre para la reservación
- Teléfono de contacto

SALUDO: {{greeting}}
HORARIO: {{schedule}}',
    '["business_name", "greeting", "schedule"]'::jsonb,
    2,
    false
),
(
    'resto_orders_only',
    'Solo Pedidos',
    'Únicamente maneja pedidos para recoger',
    'restaurant',
    'business',
    '["ordering", "menu_info", "location"]'::jsonb,
    'Eres el asistente de pedidos de {{business_name}}.

TU FUNCIÓN: Tomar pedidos para recoger en sucursal.

Para tu pedido necesito:
- Qué platillos deseas
- En qué sucursal lo recogerás
- Hora aproximada de recogida
- Nombre para el pedido

NOTA: No manejamos delivery, solo pedidos para recoger.

SALUDO: {{greeting}}',
    '["business_name", "greeting"]'::jsonb,
    3,
    false
);

-- Template GENERAL (para cualquier vertical)
INSERT INTO agent_templates (template_key, name, description, vertical, profile_type, capabilities, prompt_template, customizable_variables, display_order, is_default) VALUES
(
    'general_full',
    'Asistente General',
    'Asistente versátil para cualquier tipo de negocio',
    'general',
    'business',
    '["booking", "pricing", "faq", "lead_capture", "location", "hours"]'::jsonb,
    'Eres el asistente virtual de {{business_name}}.

PERSONALIDAD: {{response_style}}

PUEDES AYUDAR CON:
- Agendar citas o reservaciones
- Informar sobre servicios y precios
- Resolver preguntas frecuentes
- Proporcionar información de ubicación y horarios

SALUDO: {{greeting}}
HORARIO: {{schedule}}

REGLAS:
- Sé amable y profesional
- Si no sabes algo, ofrece conectar con un humano
- Confirma siempre los datos importantes',
    '["business_name", "greeting", "schedule", "response_style"]'::jsonb,
    1,
    true
),
(
    'general_personal',
    'Marca Personal',
    'Para perfiles personales de profesionales',
    'general',
    'personal',
    '["redirect_to_business", "basic_info"]'::jsonb,
    'Eres el asistente personal de {{owner_name}}.

Para consultas de servicios profesionales, deriva amablemente:
"Para agendar una cita o conocer servicios, te invito a contactar a {{business_name}}: {{business_contact}}"

Puedes mantener conversaciones casuales y responder preguntas generales de forma educativa.',
    '["owner_name", "business_name", "business_contact"]'::jsonb,
    10,
    true
);

-- =====================================================
-- 12. COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE agent_profiles IS
'Perfiles de agentes de IA por tenant. Cada tenant puede tener un perfil "business" (clínica/restaurante)
y opcionalmente un perfil "personal" (marca del dueño/doctor). Los perfiles comparten la Knowledge Base
pero tienen configuración independiente.';

COMMENT ON TABLE agent_templates IS
'Templates predefinidos por TIS TIS para diferentes verticales y tipos de perfil.
Los usuarios seleccionan un template y personalizan las variables.';

COMMENT ON COLUMN agent_profiles.agent_template IS
'Clave del template de agente seleccionado (ej: dental_full, resto_reservations_only)';

COMMENT ON COLUMN agent_profiles.custom_instructions_override IS
'Instrucciones adicionales que se AÑADEN al prompt base. Útil para instrucciones específicas del perfil
que no están en la Knowledge Base general.';

COMMENT ON COLUMN agent_profiles.response_delay_minutes IS
'Delay en minutos antes de responder. Útil para perfil personal para simular respuesta humana.
0 = respuesta inmediata.';

COMMENT ON COLUMN agent_profiles.ai_learning_config IS
'Configuración de qué aprende el AI de las conversaciones. learn_vocabulary=false evita que adopte
jerga de clientes (ej: no decir "camaroncito").';

-- =====================================================
-- FIN DE MIGRACIÓN 124
-- =====================================================

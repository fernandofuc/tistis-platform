-- =====================================================
-- TIS TIS PLATFORM - Knowledge Base System
-- Migration 023: Complete Knowledge Base for AI Context
-- =====================================================
-- Este sistema permite a cada cliente personalizar completamente
-- la información que su asistente de AI conoce y cómo responde.
-- =====================================================

-- =====================================================
-- 1. TABLA: knowledge_base_services (Catálogo de Servicios Detallado)
-- Servicios con precios, descripciones ricas y notas especiales
-- =====================================================
-- NOTA: Ya existe tabla 'services', la extendemos con más campos
ALTER TABLE services
ADD COLUMN IF NOT EXISTS price_note TEXT,           -- "Desde $X", "Consultar", "Varía según caso"
ADD COLUMN IF NOT EXISTS ai_description TEXT,       -- Descripción específica para AI (más detallada)
ADD COLUMN IF NOT EXISTS special_instructions TEXT, -- Instrucciones especiales para el AI
ADD COLUMN IF NOT EXISTS requires_consultation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS promotion_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS promotion_text TEXT;

COMMENT ON COLUMN services.price_note IS 'Nota adicional sobre precio: "Desde $X", "Consultar", etc.';
COMMENT ON COLUMN services.ai_description IS 'Descripción enriquecida para que el AI explique mejor el servicio';
COMMENT ON COLUMN services.special_instructions IS 'Instrucciones especiales: "Si preguntan por X, mencionar Y"';

-- =====================================================
-- 2. TABLA: ai_custom_instructions (Instrucciones Personalizadas)
-- Instrucciones específicas que el cliente quiere que el AI siga
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_custom_instructions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE, -- NULL = aplica a todas

    -- Tipo de instrucción
    instruction_type TEXT NOT NULL CHECK (instruction_type IN (
        'identity',          -- Identidad del negocio
        'greeting',          -- Cómo saludar
        'farewell',          -- Cómo despedirse
        'pricing_policy',    -- Política de precios
        'special_cases',     -- Casos especiales
        'competitors',       -- Cómo manejar menciones de competencia
        'objections',        -- Cómo manejar objeciones
        'upsell',            -- Oportunidades de upsell
        'tone_examples',     -- Ejemplos de tono deseado
        'forbidden',         -- Lo que NUNCA debe decir
        'always_mention',    -- Lo que SIEMPRE debe mencionar
        'custom'             -- Otro tipo personalizado
    )),

    -- Contenido
    title TEXT NOT NULL,              -- Título corto para la UI
    instruction TEXT NOT NULL,        -- La instrucción en sí
    examples TEXT,                    -- Ejemplos de uso (opcional)

    -- Control
    priority INTEGER DEFAULT 0,       -- Mayor prioridad = aparece primero en prompt
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ai_instructions_tenant ON ai_custom_instructions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_instructions_branch ON ai_custom_instructions(branch_id);
CREATE INDEX IF NOT EXISTS idx_ai_instructions_type ON ai_custom_instructions(instruction_type);
CREATE INDEX IF NOT EXISTS idx_ai_instructions_active ON ai_custom_instructions(tenant_id, is_active)
    WHERE is_active = true;

-- =====================================================
-- 3. TABLA: ai_response_templates (Plantillas de Respuesta)
-- Respuestas predefinidas para situaciones comunes
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_response_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,

    -- Trigger: cuándo usar esta plantilla
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'greeting',              -- Saludo inicial
        'after_hours',           -- Fuera de horario
        'appointment_confirm',   -- Confirmación de cita
        'appointment_reminder',  -- Recordatorio de cita
        'price_inquiry',         -- Pregunta de precio
        'location_inquiry',      -- Pregunta de ubicación
        'doctor_inquiry',        -- Pregunta sobre doctor
        'emergency',             -- Emergencia
        'complaint',             -- Queja
        'thank_you',             -- Agradecimiento
        'farewell',              -- Despedida
        'follow_up',             -- Seguimiento
        'promotion',             -- Promoción activa
        'custom'                 -- Personalizado
    )),

    -- Contenido
    name TEXT NOT NULL,               -- Nombre interno
    template_text TEXT NOT NULL,      -- Texto de la plantilla (puede incluir variables)
    variables_available TEXT[],       -- Variables disponibles: {nombre}, {servicio}, etc.

    -- Control
    is_active BOOLEAN DEFAULT true,
    use_count INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_templates_tenant ON ai_response_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_templates_trigger ON ai_response_templates(trigger_type);

-- =====================================================
-- 4. TABLA: ai_business_policies (Políticas del Negocio)
-- Políticas que el AI debe conocer y comunicar
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_business_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Tipo de política
    policy_type TEXT NOT NULL CHECK (policy_type IN (
        'cancellation',      -- Política de cancelación
        'rescheduling',      -- Política de reagendamiento
        'payment',           -- Métodos de pago
        'insurance',         -- Seguros aceptados
        'warranty',          -- Garantías
        'pricing',           -- Política de precios
        'late_arrival',      -- Llegada tarde
        'deposits',          -- Depósitos/anticipos
        'refunds',           -- Reembolsos
        'emergency',         -- Emergencias
        'custom'             -- Personalizado
    )),

    -- Contenido
    title TEXT NOT NULL,
    policy_text TEXT NOT NULL,       -- Texto completo de la política
    short_version TEXT,              -- Versión corta para respuestas rápidas

    -- Control
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_policies_tenant ON ai_business_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_policies_type ON ai_business_policies(policy_type);

-- =====================================================
-- 5. TABLA: ai_knowledge_articles (Artículos de Conocimiento)
-- Información adicional libre que el AI debe conocer
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_knowledge_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,

    -- Categorización
    category TEXT NOT NULL CHECK (category IN (
        'about_us',          -- Sobre nosotros
        'differentiators',   -- Diferenciadores
        'certifications',    -- Certificaciones y acreditaciones
        'technology',        -- Tecnología usada
        'materials',         -- Materiales/productos usados
        'process',           -- Procesos/procedimientos
        'aftercare',         -- Cuidados post-servicio
        'preparation',       -- Preparación pre-servicio
        'promotions',        -- Promociones actuales
        'events',            -- Eventos especiales
        'testimonials',      -- Testimonios destacados
        'awards',            -- Premios y reconocimientos
        'partnerships',      -- Alianzas
        'custom'             -- Otro
    )),

    -- Contenido
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,            -- Resumen corto para respuestas rápidas

    -- Control
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unicidad
    UNIQUE(tenant_id, title)
);

CREATE INDEX IF NOT EXISTS idx_ai_articles_tenant ON ai_knowledge_articles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_articles_category ON ai_knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_ai_articles_active ON ai_knowledge_articles(tenant_id)
    WHERE is_active = true;

-- =====================================================
-- 6. TABLA: ai_competitor_handling (Manejo de Competencia)
-- Cómo responder cuando mencionan competidores
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_competitor_handling (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    competitor_name TEXT NOT NULL,           -- Nombre del competidor
    competitor_aliases TEXT[],               -- Otros nombres/apodos
    response_strategy TEXT NOT NULL,         -- Estrategia de respuesta
    talking_points TEXT[],                   -- Puntos a destacar
    avoid_saying TEXT[],                     -- Lo que NO decir

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, competitor_name)
);

CREATE INDEX IF NOT EXISTS idx_ai_competitors_tenant ON ai_competitor_handling(tenant_id);

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================

-- ai_custom_instructions
ALTER TABLE ai_custom_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant instructions"
    ON ai_custom_instructions FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY "Managers can manage instructions"
    ON ai_custom_instructions FOR ALL
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

-- ai_response_templates
ALTER TABLE ai_response_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant templates"
    ON ai_response_templates FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY "Managers can manage templates"
    ON ai_response_templates FOR ALL
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

-- ai_business_policies
ALTER TABLE ai_business_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant policies"
    ON ai_business_policies FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY "Managers can manage policies"
    ON ai_business_policies FOR ALL
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

-- ai_knowledge_articles
ALTER TABLE ai_knowledge_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant articles"
    ON ai_knowledge_articles FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY "Managers can manage articles"
    ON ai_knowledge_articles FOR ALL
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

-- ai_competitor_handling
ALTER TABLE ai_competitor_handling ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view competitor handling"
    ON ai_competitor_handling FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY "Managers can manage competitor handling"
    ON ai_competitor_handling FOR ALL
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

-- =====================================================
-- 8. ACTUALIZAR RPC get_tenant_ai_context
-- Agregar Knowledge Base al contexto de AI
-- =====================================================

-- Eliminar función existente para recrearla
DROP FUNCTION IF EXISTS get_tenant_ai_context(UUID);

CREATE OR REPLACE FUNCTION get_tenant_ai_context(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    tenant_row RECORD;
    ai_config_row RECORD;
BEGIN
    -- Get tenant basic info
    SELECT id, name, vertical, settings->>'timezone' as timezone
    INTO tenant_row
    FROM tenants
    WHERE id = p_tenant_id AND status = 'active';

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Get AI config
    SELECT
        COALESCE(custom_instructions, '') as system_prompt,
        COALESCE(ai_model, 'gpt-5-mini') as model,
        COALESCE(ai_temperature, 0.7) as temperature,
        COALESCE(ai_personality, 'professional_friendly') as response_style,
        COALESCE(max_tokens, 300) as max_response_length,
        COALESCE(enable_scoring, true) as enable_scoring,
        COALESCE(escalation_keywords, ARRAY[]::TEXT[]) as auto_escalate_keywords,
        COALESCE(business_hours_start, '09:00') as bh_start,
        COALESCE(business_hours_end, '18:00') as bh_end,
        COALESCE(business_hours_days, ARRAY[1,2,3,4,5]) as bh_days
    INTO ai_config_row
    FROM ai_tenant_config
    WHERE tenant_id = p_tenant_id;

    -- Build complete result with Knowledge Base
    result := jsonb_build_object(
        'tenant_id', p_tenant_id,
        'tenant_name', tenant_row.name,
        'vertical', COALESCE(tenant_row.vertical, 'dental'),
        'timezone', COALESCE(tenant_row.timezone, 'America/Mexico_City'),

        -- AI Config
        'ai_config', jsonb_build_object(
            'system_prompt', COALESCE(ai_config_row.system_prompt, ''),
            'model', COALESCE(ai_config_row.model, 'gpt-5-mini'),
            'temperature', COALESCE(ai_config_row.temperature, 0.7),
            'response_style', COALESCE(ai_config_row.response_style, 'professional_friendly'),
            'max_response_length', COALESCE(ai_config_row.max_response_length, 300),
            'enable_scoring', COALESCE(ai_config_row.enable_scoring, true),
            'auto_escalate_keywords', COALESCE(ai_config_row.auto_escalate_keywords, ARRAY[]::TEXT[]),
            'business_hours', jsonb_build_object(
                'start', COALESCE(ai_config_row.bh_start, '09:00'),
                'end', COALESCE(ai_config_row.bh_end, '18:00'),
                'days', COALESCE(ai_config_row.bh_days, ARRAY[1,2,3,4,5])
            )
        ),

        -- Services (con campos extendidos)
        'services', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'name', s.name,
                'description', COALESCE(s.description, ''),
                'ai_description', COALESCE(s.ai_description, s.description, ''),
                'price_min', COALESCE(s.price_min, 0),
                'price_max', COALESCE(s.price_max, s.price_min),
                'price_note', COALESCE(s.price_note, ''),
                'duration_minutes', COALESCE(s.duration_minutes, 30),
                'category', COALESCE(s.category, 'general'),
                'special_instructions', COALESCE(s.special_instructions, ''),
                'requires_consultation', COALESCE(s.requires_consultation, false),
                'promotion_active', COALESCE(s.promotion_active, false),
                'promotion_text', COALESCE(s.promotion_text, '')
            ) ORDER BY s.category, s.name)
            FROM services s
            WHERE s.tenant_id = p_tenant_id AND s.is_active = true
        ), '[]'::jsonb),

        -- FAQs
        'faqs', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'question', f.question,
                'answer', f.answer,
                'category', COALESCE(f.category, 'general')
            ) ORDER BY f.display_order)
            FROM faqs f
            WHERE f.tenant_id = p_tenant_id AND f.is_active = true
        ), '[]'::jsonb),

        -- Branches
        'branches', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', b.id,
                'name', b.name,
                'address', COALESCE(b.address, ''),
                'city', COALESCE(b.city, ''),
                'phone', COALESCE(b.phone, ''),
                'whatsapp_number', COALESCE(b.whatsapp_number, b.phone),
                'email', COALESCE(b.email, ''),
                'operating_hours', COALESCE(b.operating_hours, '{}'::jsonb),
                'google_maps_url', COALESCE(b.google_maps_url, ''),
                'is_headquarters', COALESCE(b.is_headquarters, false),
                'staff_ids', COALESCE((
                    SELECT jsonb_agg(sb.staff_id)
                    FROM staff_branches sb
                    WHERE sb.branch_id = b.id
                ), '[]'::jsonb)
            ) ORDER BY b.is_headquarters DESC, b.name)
            FROM branches b
            WHERE b.tenant_id = p_tenant_id AND b.is_active = true
        ), '[]'::jsonb),

        -- Doctors
        'doctors', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', st.id,
                'name', COALESCE(st.display_name, CONCAT(st.first_name, ' ', st.last_name)),
                'first_name', st.first_name,
                'last_name', st.last_name,
                'role', st.role,
                'role_title', COALESCE(st.role_title,
                    CASE st.role
                        WHEN 'owner' THEN 'Director'
                        WHEN 'dentist' THEN 'Dentista'
                        WHEN 'specialist' THEN 'Especialista'
                        ELSE st.role
                    END
                ),
                'email', st.email,
                'phone', COALESCE(st.phone, ''),
                'branch_ids', COALESCE((
                    SELECT jsonb_agg(sb.branch_id)
                    FROM staff_branches sb
                    WHERE sb.staff_id = st.id
                ), '[]'::jsonb),
                'specialty', COALESCE((
                    SELECT dp.specialty
                    FROM staff_dental_profile dp
                    WHERE dp.staff_id = st.id
                ), ''),
                'bio', COALESCE((
                    SELECT dp.bio_short
                    FROM staff_dental_profile dp
                    WHERE dp.staff_id = st.id
                ), '')
            ) ORDER BY st.role_title, st.display_name)
            FROM staff st
            WHERE st.tenant_id = p_tenant_id
              AND st.is_active = true
              AND st.role IN ('owner', 'dentist', 'specialist', 'manager')
        ), '[]'::jsonb),

        -- Scoring rules
        'scoring_rules', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'signal_name', sr.signal_name,
                'points', sr.points,
                'keywords', COALESCE(sr.detection_config->'keywords', '[]'::jsonb),
                'category', COALESCE(sr.category, 'general')
            ))
            FROM ai_scoring_rules sr
            WHERE (sr.tenant_id = p_tenant_id OR sr.is_global = true)
              AND sr.is_active = true
        ), '[]'::jsonb),

        -- =====================================================
        -- KNOWLEDGE BASE - NUEVO
        -- =====================================================

        -- Custom Instructions (ordenadas por prioridad)
        'custom_instructions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'type', ci.instruction_type,
                'title', ci.title,
                'instruction', ci.instruction,
                'examples', COALESCE(ci.examples, ''),
                'branch_id', ci.branch_id
            ) ORDER BY ci.priority DESC, ci.created_at)
            FROM ai_custom_instructions ci
            WHERE ci.tenant_id = p_tenant_id AND ci.is_active = true
        ), '[]'::jsonb),

        -- Business Policies
        'business_policies', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'type', bp.policy_type,
                'title', bp.title,
                'policy', bp.policy_text,
                'short_version', COALESCE(bp.short_version, '')
            ) ORDER BY bp.policy_type)
            FROM ai_business_policies bp
            WHERE bp.tenant_id = p_tenant_id AND bp.is_active = true
        ), '[]'::jsonb),

        -- Knowledge Articles
        'knowledge_articles', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'category', ka.category,
                'title', ka.title,
                'content', ka.content,
                'summary', COALESCE(ka.summary, ''),
                'branch_id', ka.branch_id
            ) ORDER BY ka.category, ka.display_order)
            FROM ai_knowledge_articles ka
            WHERE ka.tenant_id = p_tenant_id AND ka.is_active = true
        ), '[]'::jsonb),

        -- Response Templates
        'response_templates', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'trigger', rt.trigger_type,
                'name', rt.name,
                'template', rt.template_text,
                'variables', COALESCE(rt.variables_available, ARRAY[]::TEXT[]),
                'branch_id', rt.branch_id
            ) ORDER BY rt.trigger_type)
            FROM ai_response_templates rt
            WHERE rt.tenant_id = p_tenant_id AND rt.is_active = true
        ), '[]'::jsonb),

        -- Competitor Handling
        'competitor_handling', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'competitor', ch.competitor_name,
                'aliases', COALESCE(ch.competitor_aliases, ARRAY[]::TEXT[]),
                'strategy', ch.response_strategy,
                'talking_points', COALESCE(ch.talking_points, ARRAY[]::TEXT[]),
                'avoid_saying', COALESCE(ch.avoid_saying, ARRAY[]::TEXT[])
            ))
            FROM ai_competitor_handling ch
            WHERE ch.tenant_id = p_tenant_id AND ch.is_active = true
        ), '[]'::jsonb)
    );

    RETURN result;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION get_tenant_ai_context(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_ai_context(UUID) TO service_role;

-- =====================================================
-- 9. TRIGGERS PARA updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_instructions_updated_at
    BEFORE UPDATE ON ai_custom_instructions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_templates_updated_at
    BEFORE UPDATE ON ai_response_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_policies_updated_at
    BEFORE UPDATE ON ai_business_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_articles_updated_at
    BEFORE UPDATE ON ai_knowledge_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================
COMMENT ON TABLE ai_custom_instructions IS
'Instrucciones personalizadas que cada cliente define para su asistente AI.
Incluye: identidad, tono, casos especiales, cosas a evitar, etc.';

COMMENT ON TABLE ai_response_templates IS
'Plantillas de respuesta predefinidas para situaciones comunes.
El AI las usa como referencia para mantener consistencia.';

COMMENT ON TABLE ai_business_policies IS
'Políticas del negocio que el AI debe conocer y comunicar.
Cancelaciones, pagos, garantías, etc.';

COMMENT ON TABLE ai_knowledge_articles IS
'Artículos de conocimiento libre: sobre nosotros, diferenciadores,
certificaciones, tecnología, cuidados, etc.';

COMMENT ON TABLE ai_competitor_handling IS
'Estrategias para cuando el cliente menciona competidores.
Define qué decir y qué evitar.';

COMMENT ON FUNCTION get_tenant_ai_context IS
'Retorna el contexto COMPLETO de AI para un tenant incluyendo:
- Configuración base de AI
- Servicios con precios y descripciones extendidas
- FAQs
- Sucursales con horarios
- Doctores/especialistas
- Reglas de scoring
- NUEVO: Knowledge Base completo
  - Instrucciones personalizadas
  - Políticas del negocio
  - Artículos de conocimiento
  - Plantillas de respuesta
  - Manejo de competencia

Usado por ai.service.ts para construir system prompts para GPT.';

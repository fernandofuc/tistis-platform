-- =====================================================
-- TIS TIS PLATFORM - AI Booking System
-- Migration 051: Support tables for AI-powered appointment booking
-- =====================================================

-- =====================================================
-- 1. TABLA: staff_availability (Disponibilidad del Staff)
-- Define los horarios en que cada staff puede atender
-- =====================================================
CREATE TABLE IF NOT EXISTS staff_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE, -- NULL = todas las sucursales

    -- Día de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado)
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

    -- Horario de disponibilidad
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Tipo de disponibilidad
    availability_type TEXT DEFAULT 'available' CHECK (availability_type IN ('available', 'busy', 'break', 'blocked')),

    -- Notas (ej: "Solo consultas", "Cirugías")
    notes TEXT,

    -- Control
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Restricción: no horarios superpuestos para el mismo staff/día/sucursal
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_staff_availability_staff ON staff_availability(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_availability_day ON staff_availability(day_of_week);
CREATE INDEX IF NOT EXISTS idx_staff_availability_branch ON staff_availability(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_availability_active ON staff_availability(staff_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view availability in their tenant"
    ON staff_availability FOR SELECT
    USING (staff_id IN (
        SELECT s.id FROM staff s
        WHERE s.tenant_id IN (
            SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "Managers can manage availability"
    ON staff_availability FOR ALL
    USING (staff_id IN (
        SELECT s.id FROM staff s
        WHERE s.tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
        )
    ));

-- =====================================================
-- 2. TABLA: conversation_events (Eventos de Conversación)
-- Registra eventos importantes en la conversación
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Tipo de evento
    event_type TEXT NOT NULL CHECK (event_type IN (
        'started',
        'escalated',
        'closed',
        'appointment_created',
        'appointment_cancelled',
        'appointment_rescheduled',
        'service_interest',
        'lead_qualified',
        'lead_data_updated',
        'staff_assigned',
        'transfer',
        'note_added',
        'custom'
    )),

    -- Datos del evento (JSON)
    event_data JSONB DEFAULT '{}',

    -- Quién generó el evento
    triggered_by TEXT DEFAULT 'ai' CHECK (triggered_by IN ('ai', 'staff', 'system', 'customer')),
    triggered_by_user_id UUID REFERENCES auth.users(id),

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_conversation_events_conv ON conversation_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_events_type ON conversation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_conversation_events_time ON conversation_events(created_at DESC);

-- RLS
ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events in their tenant conversations"
    ON conversation_events FOR SELECT
    USING (conversation_id IN (
        SELECT c.id FROM conversations c
        JOIN leads l ON c.lead_id = l.id
        WHERE l.tenant_id IN (
            SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "AI and staff can create events"
    ON conversation_events FOR INSERT
    WITH CHECK (conversation_id IN (
        SELECT c.id FROM conversations c
        JOIN leads l ON c.lead_id = l.id
        WHERE l.tenant_id IN (
            SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
        )
    ));

-- =====================================================
-- 3. AÑADIR COLUMNAS A leads
-- =====================================================
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS interested_service_id UUID REFERENCES services(id),
ADD COLUMN IF NOT EXISTS preferred_branch_id UUID REFERENCES branches(id),
ADD COLUMN IF NOT EXISTS preferred_staff_id UUID REFERENCES staff(id),
ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

-- =====================================================
-- 4. FUNCIÓN: Crear disponibilidad por defecto
-- Cuando se crea un staff, crear disponibilidad L-V 9-18
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_staff_availability()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo para roles que atienden pacientes
    IF NEW.role IN ('owner', 'dentist', 'specialist') THEN
        -- Crear disponibilidad L-V 9:00-18:00
        INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time)
        SELECT
            NEW.id,
            day,
            '09:00'::TIME,
            '18:00'::TIME
        FROM generate_series(1, 5) AS day -- Lunes a Viernes
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger (solo si no existe)
DROP TRIGGER IF EXISTS trigger_create_default_availability ON staff;
CREATE TRIGGER trigger_create_default_availability
    AFTER INSERT ON staff
    FOR EACH ROW
    EXECUTE FUNCTION create_default_staff_availability();

-- =====================================================
-- 5. FUNCIÓN: Actualizar last_interaction_at en leads
-- =====================================================
CREATE OR REPLACE FUNCTION update_lead_last_interaction()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE leads
    SET last_interaction_at = NOW()
    WHERE id = (
        SELECT lead_id FROM conversations WHERE id = NEW.conversation_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger en messages
DROP TRIGGER IF EXISTS trigger_update_lead_interaction ON messages;
CREATE TRIGGER trigger_update_lead_interaction
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_last_interaction();

-- =====================================================
-- 6. ACTUALIZAR RPC get_tenant_ai_context
-- Agregar disponibilidad de doctores
-- =====================================================
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

    -- Build complete result
    result := jsonb_build_object(
        'tenant_id', p_tenant_id,
        'tenant_name', tenant_row.name,
        'vertical', COALESCE(tenant_row.vertical, 'dental'),
        'timezone', COALESCE(tenant_row.timezone, 'America/Mexico_City'),

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

        'faqs', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'question', f.question,
                'answer', f.answer,
                'category', COALESCE(f.category, 'general')
            ) ORDER BY f.display_order)
            FROM faqs f
            WHERE f.tenant_id = p_tenant_id AND f.is_active = true
        ), '[]'::jsonb),

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

        -- Doctores CON DISPONIBILIDAD
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
                ), ''),
                -- NUEVO: Disponibilidad del doctor
                'availability', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                        'day_of_week', sa.day_of_week,
                        'start_time', sa.start_time::TEXT,
                        'end_time', sa.end_time::TEXT,
                        'branch_id', sa.branch_id,
                        'notes', COALESCE(sa.notes, '')
                    ) ORDER BY sa.day_of_week, sa.start_time)
                    FROM staff_availability sa
                    WHERE sa.staff_id = st.id AND sa.is_active = true
                ), '[]'::jsonb)
            ) ORDER BY st.role_title, st.display_name)
            FROM staff st
            WHERE st.tenant_id = p_tenant_id
              AND st.is_active = true
              AND st.role IN ('owner', 'dentist', 'specialist', 'manager')
        ), '[]'::jsonb),

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

GRANT EXECUTE ON FUNCTION get_tenant_ai_context(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_ai_context(UUID) TO service_role;

-- =====================================================
-- 7. COMENTARIOS
-- =====================================================
COMMENT ON TABLE staff_availability IS
'Define los horarios de disponibilidad de cada miembro del staff.
Usado por el AI para verificar y ofrecer slots disponibles.';

COMMENT ON TABLE conversation_events IS
'Registra eventos importantes en una conversación.
Incluye: citas creadas, escalamientos, intereses detectados, etc.';

COMMENT ON FUNCTION get_tenant_ai_context IS
'Retorna el contexto completo de AI para un tenant incluyendo:
- Configuración de AI
- Servicios con precios
- FAQs
- Sucursales con horarios
- Doctores CON DISPONIBILIDAD (nuevo)
- Reglas de scoring
- Knowledge Base completo

Usado por ai.service.ts para construir prompts y tomar decisiones de booking.';

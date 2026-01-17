-- =====================================================
-- TIS TIS PLATFORM - Fix AI Tenant Config Columns
-- Migration 129: Add missing columns for RPC compatibility
-- =====================================================
-- PROBLEMA: El RPC get_tenant_ai_context busca columnas que
-- nunca fueron creadas en ai_tenant_config:
-- - enable_scoring
-- - business_hours_start
-- - business_hours_end
-- - business_hours_days
--
-- SOLUCIÓN: Agregar las columnas faltantes con valores por defecto
-- =====================================================

-- =====================================================
-- 1. AGREGAR COLUMNAS FALTANTES
-- =====================================================

-- enable_scoring: Habilita el sistema de scoring de leads
ALTER TABLE ai_tenant_config
ADD COLUMN IF NOT EXISTS enable_scoring BOOLEAN DEFAULT true;

COMMENT ON COLUMN ai_tenant_config.enable_scoring IS
'Habilita el sistema de scoring de leads basado en señales de conversación.
Default: true';

-- business_hours_start: Hora de inicio del horario de atención
ALTER TABLE ai_tenant_config
ADD COLUMN IF NOT EXISTS business_hours_start TIME DEFAULT '09:00';

COMMENT ON COLUMN ai_tenant_config.business_hours_start IS
'Hora de inicio del horario de atención (formato HH:MM).
Default: 09:00';

-- business_hours_end: Hora de fin del horario de atención
ALTER TABLE ai_tenant_config
ADD COLUMN IF NOT EXISTS business_hours_end TIME DEFAULT '18:00';

COMMENT ON COLUMN ai_tenant_config.business_hours_end IS
'Hora de fin del horario de atención (formato HH:MM).
Default: 18:00';

-- business_hours_days: Días de la semana con atención (1=Lunes, 7=Domingo)
ALTER TABLE ai_tenant_config
ADD COLUMN IF NOT EXISTS business_hours_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5];

COMMENT ON COLUMN ai_tenant_config.business_hours_days IS
'Días de la semana con atención. 1=Lunes, 2=Martes, ..., 7=Domingo.
Default: [1,2,3,4,5] (Lunes a Viernes)';

-- =====================================================
-- 2. ACTUALIZAR RPC get_tenant_ai_context
-- =====================================================
-- Recreamos el RPC con manejo robusto de columnas opcionales

DROP FUNCTION IF EXISTS get_tenant_ai_context(UUID);

CREATE OR REPLACE FUNCTION get_tenant_ai_context(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
    tenant_row RECORD;
    ai_config_row RECORD;
    v_vertical TEXT;
BEGIN
    -- Get tenant basic info
    SELECT id, name, vertical, settings->>'timezone' as timezone
    INTO tenant_row
    FROM tenants
    WHERE id = p_tenant_id AND status = 'active';

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Store vertical for later use
    v_vertical := COALESCE(tenant_row.vertical, 'dental');

    -- Get AI config with safe defaults for all columns
    SELECT
        COALESCE(custom_instructions, '') as system_prompt,
        COALESCE(ai_model, 'gpt-4o-mini') as model,
        COALESCE(ai_temperature, 0.7) as temperature,
        COALESCE(ai_personality, 'professional_friendly') as response_style,
        COALESCE(max_tokens, 300) as max_response_length,
        COALESCE(enable_scoring, true) as enable_scoring,
        COALESCE(escalation_keywords, ARRAY[]::TEXT[]) as auto_escalate_keywords,
        COALESCE(business_hours_start::TEXT, '09:00') as bh_start,
        COALESCE(business_hours_end::TEXT, '18:00') as bh_end,
        COALESCE(business_hours_days, ARRAY[1,2,3,4,5]) as bh_days
    INTO ai_config_row
    FROM ai_tenant_config
    WHERE tenant_id = p_tenant_id;

    -- If no config found, use defaults
    IF NOT FOUND THEN
        ai_config_row := ROW(
            '',                      -- system_prompt
            'gpt-4o-mini',          -- model
            0.7,                     -- temperature
            'professional_friendly', -- response_style
            300,                     -- max_response_length
            true,                    -- enable_scoring
            ARRAY[]::TEXT[],        -- auto_escalate_keywords
            '09:00',                -- bh_start
            '18:00',                -- bh_end
            ARRAY[1,2,3,4,5]        -- bh_days
        );
    END IF;

    -- Build complete result
    result := jsonb_build_object(
        'tenant_id', p_tenant_id,
        'tenant_name', tenant_row.name,
        'vertical', v_vertical,
        'timezone', COALESCE(tenant_row.timezone, 'America/Mexico_City'),

        'ai_config', jsonb_build_object(
            'system_prompt', COALESCE(ai_config_row.system_prompt, ''),
            'model', COALESCE(ai_config_row.model, 'gpt-4o-mini'),
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

        -- STAFF/DOCTORS - DINÁMICO POR VERTICAL
        'doctors', CASE
            -- DENTAL: Buscar en staff_dental_profile
            WHEN v_vertical = 'dental' THEN COALESCE((
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
                ) ORDER BY st.display_name)
                FROM staff st
                WHERE st.tenant_id = p_tenant_id
                  AND st.is_active = true
                  AND st.role IN ('owner', 'dentist', 'specialist', 'hygienist')
            ), '[]'::jsonb)
            -- OTROS VERTICALES: Staff genérico
            ELSE COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', st.id,
                    'name', COALESCE(st.display_name, CONCAT(st.first_name, ' ', st.last_name)),
                    'first_name', st.first_name,
                    'last_name', st.last_name,
                    'role', st.role,
                    'role_title', COALESCE(st.role_title, st.role),
                    'email', st.email,
                    'phone', COALESCE(st.phone, ''),
                    'branch_ids', COALESCE((
                        SELECT jsonb_agg(sb.branch_id)
                        FROM staff_branches sb
                        WHERE sb.staff_id = st.id
                    ), '[]'::jsonb),
                    'specialty', '',
                    'bio', ''
                ) ORDER BY st.display_name)
                FROM staff st
                WHERE st.tenant_id = p_tenant_id AND st.is_active = true
            ), '[]'::jsonb)
        END,

        'scoring_rules', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'signal_name', sr.signal_name,
                'points', sr.points,
                'keywords', COALESCE(sr.keywords, ARRAY[]::TEXT[]),
                'category', COALESCE(sr.category, 'general')
            ))
            FROM ai_scoring_rules sr
            WHERE sr.tenant_id = p_tenant_id AND sr.is_active = true
        ), '[]'::jsonb),

        'custom_instructions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'type', ci.instruction_type,
                'title', ci.title,
                'instruction', ci.instruction,
                'examples', ci.examples,
                'branch_id', ci.branch_id
            ) ORDER BY ci.priority DESC)
            FROM ai_custom_instructions ci
            WHERE ci.tenant_id = p_tenant_id AND ci.is_active = true
        ), '[]'::jsonb),

        'business_policies', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'type', bp.policy_type,
                'title', bp.title,
                'policy', bp.policy_text,
                'short_version', bp.short_version,
                'branch_id', bp.branch_id
            ))
            FROM ai_business_policies bp
            WHERE bp.tenant_id = p_tenant_id AND bp.is_active = true
        ), '[]'::jsonb),

        'knowledge_articles', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'category', ka.category,
                'title', ka.title,
                'content', ka.content,
                'summary', ka.summary,
                'branch_id', ka.branch_id
            ))
            FROM ai_knowledge_articles ka
            WHERE ka.tenant_id = p_tenant_id AND ka.is_active = true
        ), '[]'::jsonb),

        'response_templates', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'trigger', rt.trigger_phrase,
                'name', rt.name,
                'template', rt.template_text,
                'variables', rt.variables,
                'branch_id', rt.branch_id
            ))
            FROM ai_response_templates rt
            WHERE rt.tenant_id = p_tenant_id AND rt.is_active = true
        ), '[]'::jsonb),

        'competitor_handling', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'competitor', ch.competitor_name,
                'aliases', ch.aliases,
                'strategy', ch.strategy,
                'talking_points', ch.talking_points,
                'avoid_saying', ch.avoid_saying
            ))
            FROM ai_competitor_handling ch
            WHERE ch.tenant_id = p_tenant_id AND ch.is_active = true
        ), '[]'::jsonb)
    );

    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_tenant_ai_context(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_ai_context(UUID) TO service_role;

-- =====================================================
-- 3. LOG DE MIGRACIÓN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 129 completed: Fixed ai_tenant_config columns';
    RAISE NOTICE 'Added columns: enable_scoring, business_hours_start, business_hours_end, business_hours_days';
    RAISE NOTICE 'Updated RPC: get_tenant_ai_context with robust defaults';
END $$;

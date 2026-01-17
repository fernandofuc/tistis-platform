-- =====================================================
-- TIS TIS PLATFORM - Fix RPC Escalation Fields
-- Migration 133: Add missing escalation fields to RPC
-- =====================================================
-- PROBLEMA: El RPC get_tenant_ai_context no devuelve:
-- - max_turns_before_escalation
-- - escalate_on_hot_lead
--
-- Estos campos existen en ai_tenant_config pero no se
-- incluyen en el resultado del RPC, por lo que LangGraph
-- no puede usarlos para determinar cuándo escalar.
--
-- SOLUCIÓN: Actualizar el RPC para incluir estos campos
-- =====================================================

DROP FUNCTION IF EXISTS get_tenant_ai_context(UUID);
DROP FUNCTION IF EXISTS table_exists(TEXT);

-- =====================================================
-- 1. FUNCIÓN AUXILIAR PARA VERIFICAR TABLAS
-- =====================================================

CREATE OR REPLACE FUNCTION table_exists(p_table_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = p_table_name
    );
END;
$$;

-- =====================================================
-- 2. RECREAR RPC get_tenant_ai_context
-- =====================================================

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
    v_services JSONB := '[]'::jsonb;
    v_faqs JSONB := '[]'::jsonb;
    v_branches JSONB := '[]'::jsonb;
    v_doctors JSONB := '[]'::jsonb;
    v_scoring_rules JSONB := '[]'::jsonb;
    v_custom_instructions JSONB := '[]'::jsonb;
    v_business_policies JSONB := '[]'::jsonb;
    v_knowledge_articles JSONB := '[]'::jsonb;
    v_response_templates JSONB := '[]'::jsonb;
    v_competitor_handling JSONB := '[]'::jsonb;
BEGIN
    -- =========================================
    -- PASO 1: Obtener info básica del tenant
    -- =========================================
    SELECT id, name, vertical, settings->>'timezone' as timezone
    INTO tenant_row
    FROM tenants
    WHERE id = p_tenant_id AND status = 'active';

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_vertical := COALESCE(tenant_row.vertical, 'dental');

    -- =========================================
    -- PASO 2: Obtener configuración AI
    -- AHORA INCLUYE: max_turns_before_escalation, escalate_on_hot_lead
    -- =========================================
    SELECT
        COALESCE(custom_instructions, '') as system_prompt,
        COALESCE(ai_model, 'gpt-4o-mini') as model,
        COALESCE(ai_temperature, 0.7) as temperature,
        COALESCE(ai_personality, 'professional_friendly') as response_style,
        COALESCE(max_tokens, 300) as max_response_length,
        COALESCE(enable_scoring, true) as enable_scoring,
        COALESCE(escalation_keywords, ARRAY[]::TEXT[]) as auto_escalate_keywords,
        -- NUEVOS CAMPOS DE ESCALACIÓN
        COALESCE(max_turns_before_escalation, 10) as max_turns_before_escalation,
        COALESCE(escalate_on_hot_lead, true) as escalate_on_hot_lead,
        -- Business hours
        COALESCE(business_hours_start::TEXT, '09:00') as bh_start,
        COALESCE(business_hours_end::TEXT, '18:00') as bh_end,
        COALESCE(business_hours_days, ARRAY[1,2,3,4,5]) as bh_days
    INTO ai_config_row
    FROM ai_tenant_config
    WHERE tenant_id = p_tenant_id;

    -- Si no hay config, usar defaults
    IF ai_config_row IS NULL THEN
        ai_config_row := ROW(
            '',                      -- system_prompt
            'gpt-4o-mini',          -- model
            0.7,                     -- temperature
            'professional_friendly', -- response_style
            300,                     -- max_response_length
            true,                    -- enable_scoring
            ARRAY[]::TEXT[],        -- auto_escalate_keywords
            10,                      -- max_turns_before_escalation (DEFAULT)
            true,                    -- escalate_on_hot_lead (DEFAULT)
            '09:00',                -- bh_start
            '18:00',                -- bh_end
            ARRAY[1,2,3,4,5]        -- bh_days
        );
    END IF;

    -- =========================================
    -- PASO 3: Obtener servicios
    -- =========================================
    IF table_exists('services') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'description', COALESCE(s.description, ''),
            'ai_description', COALESCE(s.ai_description, s.description, ''),
            'price_min', COALESCE(s.price_min, 0),
            'price_max', COALESCE(s.price_max, s.price_min, 0),
            'price_note', COALESCE(s.price_note, ''),
            'duration_minutes', COALESCE(s.duration_minutes, 30),
            'category', COALESCE(s.category, 'general'),
            'special_instructions', COALESCE(s.special_instructions, ''),
            'requires_consultation', COALESCE(s.requires_consultation, false),
            'promotion_active', COALESCE(s.promotion_active, false),
            'promotion_text', COALESCE(s.promotion_text, '')
        ) ORDER BY s.category, s.name), '[]'::jsonb)
        INTO v_services
        FROM services s
        WHERE s.tenant_id = p_tenant_id AND s.is_active = true;
    END IF;

    -- =========================================
    -- PASO 4: Obtener FAQs
    -- =========================================
    IF table_exists('faqs') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'question', f.question,
            'answer', f.answer,
            'category', COALESCE(f.category, 'general')
        ) ORDER BY f.display_order), '[]'::jsonb)
        INTO v_faqs
        FROM faqs f
        WHERE f.tenant_id = p_tenant_id AND f.is_active = true;
    END IF;

    -- =========================================
    -- PASO 5: Obtener sucursales
    -- =========================================
    IF table_exists('branches') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', b.id,
            'name', b.name,
            'address', COALESCE(b.address, ''),
            'city', COALESCE(b.city, ''),
            'phone', COALESCE(b.phone, ''),
            'whatsapp_number', COALESCE(b.whatsapp_number, b.phone, ''),
            'email', COALESCE(b.email, ''),
            'operating_hours', COALESCE(b.operating_hours, '{}'::jsonb),
            'google_maps_url', COALESCE(b.google_maps_url, ''),
            'is_headquarters', COALESCE(b.is_headquarters, false),
            'staff_ids', COALESCE((
                SELECT jsonb_agg(sb.staff_id)
                FROM staff_branches sb
                WHERE sb.branch_id = b.id
            ), '[]'::jsonb)
        ) ORDER BY b.is_headquarters DESC, b.name), '[]'::jsonb)
        INTO v_branches
        FROM branches b
        WHERE b.tenant_id = p_tenant_id AND b.is_active = true;
    END IF;

    -- =========================================
    -- PASO 6: Obtener staff/doctors
    -- =========================================
    IF table_exists('staff') THEN
        IF v_vertical = 'dental' AND table_exists('staff_dental_profile') THEN
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
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
            ) ORDER BY st.display_name), '[]'::jsonb)
            INTO v_doctors
            FROM staff st
            WHERE st.tenant_id = p_tenant_id
              AND st.is_active = true
              AND st.role IN ('owner', 'dentist', 'specialist', 'hygienist');
        ELSE
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
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
            ) ORDER BY st.display_name), '[]'::jsonb)
            INTO v_doctors
            FROM staff st
            WHERE st.tenant_id = p_tenant_id AND st.is_active = true;
        END IF;
    END IF;

    -- =========================================
    -- PASO 7: ai_scoring_rules
    -- =========================================
    IF table_exists('ai_scoring_rules') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'signal_name', sr.signal_name,
            'points', sr.points,
            'keywords', COALESCE(sr.detection_config->'keywords', '[]'::jsonb),
            'category', COALESCE(sr.category, 'general')
        )), '[]'::jsonb)
        INTO v_scoring_rules
        FROM ai_scoring_rules sr
        WHERE sr.tenant_id = p_tenant_id AND sr.is_active = true;
    END IF;

    -- =========================================
    -- PASO 8: ai_custom_instructions
    -- =========================================
    IF table_exists('ai_custom_instructions') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'type', ci.instruction_type,
            'title', ci.title,
            'instruction', ci.instruction,
            'examples', ci.examples,
            'branch_id', ci.branch_id
        ) ORDER BY ci.priority DESC), '[]'::jsonb)
        INTO v_custom_instructions
        FROM ai_custom_instructions ci
        WHERE ci.tenant_id = p_tenant_id AND ci.is_active = true;
    END IF;

    -- =========================================
    -- PASO 9: ai_business_policies
    -- =========================================
    IF table_exists('ai_business_policies') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'type', bp.policy_type,
            'title', bp.title,
            'policy', bp.policy_text,
            'short_version', bp.short_version
        )), '[]'::jsonb)
        INTO v_business_policies
        FROM ai_business_policies bp
        WHERE bp.tenant_id = p_tenant_id AND bp.is_active = true;
    END IF;

    -- =========================================
    -- PASO 10: ai_knowledge_articles
    -- =========================================
    IF table_exists('ai_knowledge_articles') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'category', ka.category,
            'title', ka.title,
            'content', ka.content,
            'summary', ka.summary,
            'branch_id', ka.branch_id
        )), '[]'::jsonb)
        INTO v_knowledge_articles
        FROM ai_knowledge_articles ka
        WHERE ka.tenant_id = p_tenant_id AND ka.is_active = true;
    END IF;

    -- =========================================
    -- PASO 11: ai_response_templates
    -- =========================================
    IF table_exists('ai_response_templates') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'trigger', rt.trigger_type,
            'name', rt.name,
            'template', rt.template_text
        )), '[]'::jsonb)
        INTO v_response_templates
        FROM ai_response_templates rt
        WHERE rt.tenant_id = p_tenant_id AND rt.is_active = true;
    END IF;

    -- =========================================
    -- PASO 12: ai_competitor_handling
    -- =========================================
    IF table_exists('ai_competitor_handling') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'competitor', ch.competitor_name,
            'aliases', ch.competitor_aliases,
            'strategy', ch.response_strategy,
            'talking_points', ch.talking_points,
            'avoid_saying', ch.avoid_saying
        )), '[]'::jsonb)
        INTO v_competitor_handling
        FROM ai_competitor_handling ch
        WHERE ch.tenant_id = p_tenant_id AND ch.is_active = true;
    END IF;

    -- =========================================
    -- PASO 13: Construir resultado final
    -- AHORA INCLUYE max_turns_before_escalation y escalate_on_hot_lead
    -- =========================================
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
            -- NUEVOS CAMPOS DE ESCALACIÓN EN EL JSON
            'max_turns_before_escalation', COALESCE(ai_config_row.max_turns_before_escalation, 10),
            'escalate_on_hot_lead', COALESCE(ai_config_row.escalate_on_hot_lead, true),
            'business_hours', jsonb_build_object(
                'start', COALESCE(ai_config_row.bh_start, '09:00'),
                'end', COALESCE(ai_config_row.bh_end, '18:00'),
                'days', COALESCE(ai_config_row.bh_days, ARRAY[1,2,3,4,5])
            )
        ),

        'services', COALESCE(v_services, '[]'::jsonb),
        'faqs', COALESCE(v_faqs, '[]'::jsonb),
        'branches', COALESCE(v_branches, '[]'::jsonb),
        'doctors', COALESCE(v_doctors, '[]'::jsonb),
        'scoring_rules', COALESCE(v_scoring_rules, '[]'::jsonb),
        'custom_instructions', COALESCE(v_custom_instructions, '[]'::jsonb),
        'business_policies', COALESCE(v_business_policies, '[]'::jsonb),
        'knowledge_articles', COALESCE(v_knowledge_articles, '[]'::jsonb),
        'response_templates', COALESCE(v_response_templates, '[]'::jsonb),
        'competitor_handling', COALESCE(v_competitor_handling, '[]'::jsonb)
    );

    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_tenant_ai_context(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_ai_context(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION table_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION table_exists(TEXT) TO service_role;

-- =====================================================
-- 3. LOG DE MIGRACIÓN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 133 completed: Added escalation fields to RPC';
    RAISE NOTICE 'New fields in ai_config JSON:';
    RAISE NOTICE '  - max_turns_before_escalation (default: 10)';
    RAISE NOTICE '  - escalate_on_hot_lead (default: true)';
END $$;

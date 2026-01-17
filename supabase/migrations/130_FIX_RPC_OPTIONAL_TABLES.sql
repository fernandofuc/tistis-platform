-- =====================================================
-- TIS TIS PLATFORM - Fix RPC Optional Tables
-- Migration 130: Handle optional tables gracefully
-- =====================================================
-- PROBLEMA: El RPC get_tenant_ai_context falla cuando
-- alguna de las tablas opcionales no existe:
-- - staff_dental_profile
-- - ai_scoring_rules
-- - ai_custom_instructions
-- - ai_business_policies
-- - ai_knowledge_articles
-- - ai_response_templates
-- - ai_competitor_handling
--
-- SOLUCIÓN: Recrear el RPC con manejo defensivo que
-- verifica existencia de tablas antes de consultarlas
-- =====================================================

-- =====================================================
-- 1. FUNCIÓN AUXILIAR PARA VERIFICAR TABLAS
-- =====================================================

CREATE OR REPLACE FUNCTION table_exists(p_table_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
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
-- 2. RECREAR RPC get_tenant_ai_context ROBUSTO
-- =====================================================

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
    v_services JSONB;
    v_faqs JSONB;
    v_branches JSONB;
    v_doctors JSONB;
    v_scoring_rules JSONB;
    v_custom_instructions JSONB;
    v_business_policies JSONB;
    v_knowledge_articles JSONB;
    v_response_templates JSONB;
    v_competitor_handling JSONB;
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
    -- =========================================
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

    -- Si no hay config, usar defaults
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

    -- =========================================
    -- PASO 3: Obtener servicios (tabla obligatoria)
    -- =========================================
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

    -- =========================================
    -- PASO 4: Obtener FAQs (tabla obligatoria)
    -- =========================================
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'question', f.question,
        'answer', f.answer,
        'category', COALESCE(f.category, 'general')
    ) ORDER BY f.display_order), '[]'::jsonb)
    INTO v_faqs
    FROM faqs f
    WHERE f.tenant_id = p_tenant_id AND f.is_active = true;

    -- =========================================
    -- PASO 5: Obtener sucursales (tabla obligatoria)
    -- =========================================
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

    -- =========================================
    -- PASO 6: Obtener staff/doctors
    -- NOTA: staff_dental_profile es OPCIONAL
    -- =========================================
    IF v_vertical = 'dental' AND table_exists('staff_dental_profile') THEN
        -- Vertical dental CON tabla de perfil dental
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
        -- Otros verticales o sin tabla dental profile
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

    -- =========================================
    -- PASO 7: Tablas OPCIONALES del Knowledge Base
    -- Solo consultar si existen
    -- =========================================

    -- ai_scoring_rules (OPCIONAL)
    IF table_exists('ai_scoring_rules') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'signal_name', sr.signal_name,
            'points', sr.points,
            'keywords', COALESCE(sr.keywords, ARRAY[]::TEXT[]),
            'category', COALESCE(sr.category, 'general')
        )), '[]'::jsonb)
        INTO v_scoring_rules
        FROM ai_scoring_rules sr
        WHERE sr.tenant_id = p_tenant_id AND sr.is_active = true;
    ELSE
        v_scoring_rules := '[]'::jsonb;
    END IF;

    -- ai_custom_instructions (OPCIONAL)
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
    ELSE
        v_custom_instructions := '[]'::jsonb;
    END IF;

    -- ai_business_policies (OPCIONAL)
    IF table_exists('ai_business_policies') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'type', bp.policy_type,
            'title', bp.title,
            'policy', bp.policy_text,
            'short_version', bp.short_version,
            'branch_id', bp.branch_id
        )), '[]'::jsonb)
        INTO v_business_policies
        FROM ai_business_policies bp
        WHERE bp.tenant_id = p_tenant_id AND bp.is_active = true;
    ELSE
        v_business_policies := '[]'::jsonb;
    END IF;

    -- ai_knowledge_articles (OPCIONAL)
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
    ELSE
        v_knowledge_articles := '[]'::jsonb;
    END IF;

    -- ai_response_templates (OPCIONAL)
    IF table_exists('ai_response_templates') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'trigger', rt.trigger_phrase,
            'name', rt.name,
            'template', rt.template_text,
            'variables', rt.variables,
            'branch_id', rt.branch_id
        )), '[]'::jsonb)
        INTO v_response_templates
        FROM ai_response_templates rt
        WHERE rt.tenant_id = p_tenant_id AND rt.is_active = true;
    ELSE
        v_response_templates := '[]'::jsonb;
    END IF;

    -- ai_competitor_handling (OPCIONAL)
    IF table_exists('ai_competitor_handling') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'competitor', ch.competitor_name,
            'aliases', ch.aliases,
            'strategy', ch.strategy,
            'talking_points', ch.talking_points,
            'avoid_saying', ch.avoid_saying
        )), '[]'::jsonb)
        INTO v_competitor_handling
        FROM ai_competitor_handling ch
        WHERE ch.tenant_id = p_tenant_id AND ch.is_active = true;
    ELSE
        v_competitor_handling := '[]'::jsonb;
    END IF;

    -- =========================================
    -- PASO 8: Construir resultado final
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
            'business_hours', jsonb_build_object(
                'start', COALESCE(ai_config_row.bh_start, '09:00'),
                'end', COALESCE(ai_config_row.bh_end, '18:00'),
                'days', COALESCE(ai_config_row.bh_days, ARRAY[1,2,3,4,5])
            )
        ),

        'services', v_services,
        'faqs', v_faqs,
        'branches', v_branches,
        'doctors', v_doctors,
        'scoring_rules', v_scoring_rules,
        'custom_instructions', v_custom_instructions,
        'business_policies', v_business_policies,
        'knowledge_articles', v_knowledge_articles,
        'response_templates', v_response_templates,
        'competitor_handling', v_competitor_handling
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
DECLARE
    missing_tables TEXT := '';
BEGIN
    -- Check which tables are missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_dental_profile') THEN
        missing_tables := missing_tables || 'staff_dental_profile, ';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_scoring_rules') THEN
        missing_tables := missing_tables || 'ai_scoring_rules, ';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_custom_instructions') THEN
        missing_tables := missing_tables || 'ai_custom_instructions, ';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_business_policies') THEN
        missing_tables := missing_tables || 'ai_business_policies, ';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_knowledge_articles') THEN
        missing_tables := missing_tables || 'ai_knowledge_articles, ';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_response_templates') THEN
        missing_tables := missing_tables || 'ai_response_templates, ';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_competitor_handling') THEN
        missing_tables := missing_tables || 'ai_competitor_handling, ';
    END IF;

    RAISE NOTICE 'Migration 130 completed: RPC now handles optional tables gracefully';

    IF missing_tables != '' THEN
        RAISE NOTICE 'Optional tables not found (will return empty arrays): %', RTRIM(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'All optional tables exist';
    END IF;
END $$;

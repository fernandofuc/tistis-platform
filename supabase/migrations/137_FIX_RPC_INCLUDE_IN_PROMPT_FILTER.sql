-- =====================================================
-- TIS TIS PLATFORM - Migration 137
-- FIX: RPC get_tenant_ai_context to filter include_in_prompt
-- =====================================================
--
-- PROBLEMA:
-- El RPC get_tenant_ai_context NO filtraba por include_in_prompt = true,
-- incluyendo TODAS las instrucciones activas en lugar de solo las críticas.
--
-- SOLUCIÓN:
-- Agregar filtro include_in_prompt = true y limitar a 5 instrucciones.
--
-- =====================================================

-- Recrear la función con el filtro correcto
CREATE OR REPLACE FUNCTION get_tenant_ai_context(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
    WHERE id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_vertical := COALESCE(tenant_row.vertical, 'dental');

    -- =========================================
    -- PASO 2: Obtener configuración AI
    -- INCLUYE: max_turns_before_escalation, escalate_on_hot_lead
    -- =========================================
    SELECT
        COALESCE(custom_instructions, '') as system_prompt,
        COALESCE(ai_model, 'gpt-4o-mini') as model,
        COALESCE(ai_temperature, 0.7) as temperature,
        COALESCE(ai_personality, 'professional_friendly') as response_style,
        COALESCE(max_tokens, 300) as max_response_length,
        COALESCE(enable_scoring, true) as enable_scoring,
        COALESCE(escalation_keywords, ARRAY[]::TEXT[]) as auto_escalate_keywords,
        -- Campos de escalación
        COALESCE(max_turns_before_escalation, 10) as max_turns_before_escalation,
        COALESCE(escalate_on_hot_lead, true) as escalate_on_hot_lead,
        -- Business hours
        COALESCE(business_hours_start, '09:00') as bh_start,
        COALESCE(business_hours_end, '18:00') as bh_end,
        COALESCE(business_days, ARRAY[1,2,3,4,5]) as bh_days
    INTO ai_config_row
    FROM ai_tenant_config
    WHERE tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        ai_config_row := ROW(
            '',           -- system_prompt
            'gpt-4o-mini', -- model
            0.7,          -- temperature
            'professional_friendly', -- response_style
            300,          -- max_response_length
            true,         -- enable_scoring
            ARRAY[]::TEXT[], -- auto_escalate_keywords
            10,           -- max_turns_before_escalation
            true,         -- escalate_on_hot_lead
            '09:00',      -- bh_start
            '18:00',      -- bh_end
            ARRAY[1,2,3,4,5] -- bh_days
        );
    END IF;

    -- =========================================
    -- PASO 3: Obtener servicios
    -- =========================================
    IF table_exists('services') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'description', COALESCE(s.ai_description, s.description),
            'price_min', s.price_min,
            'price_max', s.price_max,
            'price_note', s.price_note,
            'duration_minutes', s.duration_minutes,
            'category', s.category,
            'promotion_active', COALESCE(s.promotion_active, false),
            'promotion_text', s.promotion_text,
            'requires_consultation', COALESCE(s.requires_consultation, false),
            'special_instructions', s.special_instructions
        )), '[]'::jsonb)
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
            'answer', f.answer
        )), '[]'::jsonb)
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
            'address', b.address,
            'city', b.city,
            'phone', b.phone,
            'operating_hours', b.operating_hours,
            'is_headquarters', COALESCE(b.is_headquarters, false)
        )), '[]'::jsonb)
        INTO v_branches
        FROM branches b
        WHERE b.tenant_id = p_tenant_id AND b.is_active = true;
    END IF;

    -- =========================================
    -- PASO 6: Obtener doctores/staff
    -- =========================================
    IF table_exists('users') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', u.id,
            'name', COALESCE(u.display_name, CONCAT(u.first_name, ' ', u.last_name)),
            'role', ur.role,
            'specialty', u.specialty
        )), '[]'::jsonb)
        INTO v_doctors
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = p_tenant_id
        WHERE ur.role IN ('dentist', 'doctor', 'specialist', 'staff', 'admin')
          AND u.is_active = true;
    END IF;

    -- =========================================
    -- PASO 7: ai_scoring_rules
    -- =========================================
    IF table_exists('ai_scoring_rules') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', sr.id,
            'rule_name', sr.rule_name,
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
    -- FIX: Solo incluir instrucciones con include_in_prompt = true
    -- Ordenadas por priority DESC, limitadas a 5
    -- =========================================
    IF table_exists('ai_custom_instructions') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'type', ci.instruction_type,
            'title', ci.title,
            'instruction', ci.instruction,
            'priority', COALESCE(ci.priority, 0),
            'examples', ci.examples,
            'branch_id', ci.branch_id
        ) ORDER BY ci.priority DESC), '[]'::jsonb)
        INTO v_custom_instructions
        FROM (
            SELECT * FROM ai_custom_instructions
            WHERE tenant_id = p_tenant_id
              AND is_active = true
              AND include_in_prompt = true
            ORDER BY priority DESC
            LIMIT 5
        ) ci;
    END IF;

    -- =========================================
    -- PASO 9: ai_business_policies
    -- =========================================
    IF table_exists('ai_business_policies') THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'type', bp.policy_type,
            'title', bp.title,
            'policy', bp.policy_text
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
            'tags', ka.tags
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
            'trigger_type', rt.trigger_type,
            'name', rt.name,
            'template', rt.template_text,
            'variables', COALESCE(rt.variables_available, '[]'::jsonb)
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
            'name', ch.competitor_name,
            'strategy', ch.response_strategy,
            'differentiators', COALESCE(ch.key_differentiators, ARRAY[]::TEXT[])
        )), '[]'::jsonb)
        INTO v_competitor_handling
        FROM ai_competitor_handling ch
        WHERE ch.tenant_id = p_tenant_id AND ch.is_active = true;
    END IF;

    -- =========================================
    -- CONSTRUIR RESULTADO FINAL
    -- =========================================
    result := jsonb_build_object(
        'tenant_id', p_tenant_id,
        'tenant_name', tenant_row.name,
        'vertical', v_vertical,
        'timezone', COALESCE(tenant_row.timezone, 'America/Mexico_City'),

        'ai_config', jsonb_build_object(
            'system_prompt', ai_config_row.system_prompt,
            'model', ai_config_row.model,
            'temperature', ai_config_row.temperature,
            'response_style', ai_config_row.response_style,
            'max_response_length', ai_config_row.max_response_length,
            'enable_scoring', ai_config_row.enable_scoring,
            'auto_escalate_keywords', ai_config_row.auto_escalate_keywords,
            'max_turns_before_escalation', ai_config_row.max_turns_before_escalation,
            'escalate_on_hot_lead', ai_config_row.escalate_on_hot_lead,
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

-- =====================================================
-- VERIFICACIÓN DE LA MIGRACIÓN
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Migración 137 completada: RPC get_tenant_ai_context ahora filtra include_in_prompt=true y limita a 5 instrucciones';
END $$;

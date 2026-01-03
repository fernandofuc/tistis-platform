-- =====================================================
-- TIS TIS PLATFORM - Multi-Vertical AI Context
-- Migration 094: Dynamic staff profiles per vertical
-- =====================================================
-- Esta migración actualiza get_tenant_ai_context para
-- obtener el perfil correcto según la vertical del tenant
-- (dental, restaurant, etc.)
-- =====================================================
-- DEPENDENCIAS:
--   - 003_esva_schema_v2.sql: staff_dental_profile
--   - 051_AI_BOOKING_SYSTEM.sql: staff_availability
--   - 088_RESTAURANT_VERTICAL_SCHEMA.sql: restaurant tables
-- =====================================================

-- =====================================================
-- PARTE 0: VERIFICAR DEPENDENCIAS
-- =====================================================
-- Nota: Si estas tablas no existen, la función usará '[]' por defecto
-- gracias al patrón COALESCE(..., '[]'::jsonb)

DO $$
BEGIN
    -- Verificar tablas críticas
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff') THEN
        RAISE EXCEPTION 'Table staff does not exist. Run previous migrations first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        RAISE EXCEPTION 'Table tenants does not exist. Run previous migrations first.';
    END IF;

    -- Advertir sobre tablas opcionales
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_dental_profile') THEN
        RAISE NOTICE 'Table staff_dental_profile not found - dental profile data will be empty';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_availability') THEN
        RAISE NOTICE 'Table staff_availability not found - availability data will be empty';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_menu_items') THEN
        RAISE NOTICE 'Table restaurant_menu_items not found - menu data will be empty';
    END IF;
END $$;

-- =====================================================
-- PARTE 1: ACTUALIZAR RPC get_tenant_ai_context
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

    -- Get AI config
    SELECT
        COALESCE(custom_instructions, '') as system_prompt,
        COALESCE(ai_model, 'gpt-4o-mini') as model,
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

        -- =====================================================
        -- STAFF/DOCTORS - DINÁMICO POR VERTICAL
        -- =====================================================
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
                    -- Perfil DENTAL
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
                    'license_number', COALESCE((
                        SELECT dp.license_number
                        FROM staff_dental_profile dp
                        WHERE dp.staff_id = st.id
                    ), ''),
                    -- Disponibilidad
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
            ), '[]'::jsonb)

            -- RESTAURANT: Buscar en staff_restaurant_profile
            WHEN v_vertical = 'restaurant' THEN COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', st.id,
                    'name', COALESCE(st.display_name, CONCAT(st.first_name, ' ', st.last_name)),
                    'first_name', st.first_name,
                    'last_name', st.last_name,
                    'role', st.role,
                    'role_title', COALESCE(st.role_title,
                        CASE st.role
                            WHEN 'owner' THEN 'Propietario'
                            WHEN 'manager' THEN 'Gerente'
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
                    -- Perfil RESTAURANT
                    'restaurant_role', COALESCE((
                        SELECT rp.restaurant_role
                        FROM staff_restaurant_profile rp
                        WHERE rp.staff_id = st.id
                    ), ''),
                    'cuisine_specialties', COALESCE((
                        SELECT rp.cuisine_specialties
                        FROM staff_restaurant_profile rp
                        WHERE rp.staff_id = st.id
                    ), ARRAY[]::TEXT[]),
                    'bio', COALESCE((
                        SELECT rp.bio_short
                        FROM staff_restaurant_profile rp
                        WHERE rp.staff_id = st.id
                    ), ''),
                    -- Disponibilidad
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
                  AND st.role IN ('owner', 'manager', 'chef', 'host')
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
                  AND st.role IN ('owner', 'manager', 'specialist')
            ), '[]'::jsonb)
        END,

        -- =====================================================
        -- MENÚ (solo para restaurant)
        -- =====================================================
        'menu_items', CASE
            WHEN v_vertical = 'restaurant' THEN COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', mi.id,
                    'name', mi.name,
                    'description', COALESCE(mi.short_description, mi.description, ''),
                    'base_price', mi.price,
                    'category_id', mi.category_id,
                    'category_name', COALESCE(mc.name, 'Otros'),
                    'is_available', mi.is_available,
                    'is_popular', mi.is_featured,
                    'is_vegetarian', mi.is_vegetarian,
                    'is_vegan', mi.is_vegan,
                    'is_gluten_free', mi.is_gluten_free,
                    'allergens', COALESCE(mi.allergens, ARRAY[]::TEXT[]),
                    'tags', ARRAY[]::TEXT[] -- Computed tags
                ) ORDER BY mc.display_order, mi.display_order)
                FROM restaurant_menu_items mi
                LEFT JOIN restaurant_menu_categories mc ON mc.id = mi.category_id
                WHERE mi.tenant_id = p_tenant_id
                  AND mi.deleted_at IS NULL
                  AND mi.is_available = true
            ), '[]'::jsonb)
            ELSE '[]'::jsonb
        END,

        'menu_categories', CASE
            WHEN v_vertical = 'restaurant' THEN COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', mc.id,
                    'name', mc.name,
                    'slug', mc.slug,
                    'description', COALESCE(mc.description, ''),
                    'display_order', mc.display_order
                ) ORDER BY mc.display_order)
                FROM restaurant_menu_categories mc
                WHERE mc.tenant_id = p_tenant_id
                  AND mc.deleted_at IS NULL
                  AND mc.is_active = true
            ), '[]'::jsonb)
            ELSE '[]'::jsonb
        END,

        -- =====================================================
        -- RESTO DE CONTEXTO (común a todos los verticales)
        -- =====================================================
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
-- PARTE 2: COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION get_tenant_ai_context IS
'Retorna el contexto completo de AI para un tenant.

MULTI-VERTICAL: Automáticamente detecta el vertical del tenant y
retorna el perfil de staff correcto:
- dental: staff_dental_profile (specialty, license_number)
- restaurant: staff_restaurant_profile (restaurant_role, cuisine_specialties)
- otros: perfil genérico

También incluye menu_items y menu_categories solo para restaurant.

Usado por:
- ai.service.ts para construir prompts
- appointment-booking.service.ts para disponibilidad
- ordering.agent.ts para menú de restaurant';


-- =====================================================
-- MIGRACIÓN COMPLETADA
-- =====================================================

SELECT 'Migration 094: Multi-Vertical AI Context - COMPLETADA' as status;

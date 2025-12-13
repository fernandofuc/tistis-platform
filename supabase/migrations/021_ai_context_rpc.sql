-- =====================================================
-- TIS TIS PLATFORM - AI Context RPC Function
-- Migration 021: Complete AI context for prompts
-- =====================================================

-- Drop if exists (for rerunning)
DROP FUNCTION IF EXISTS get_tenant_ai_context(UUID);

-- =====================================================
-- RPC: get_tenant_ai_context
-- Returns complete context for AI prompts including:
-- - Tenant info
-- - AI config (system_prompt, personality, etc.)
-- - Services with prices
-- - FAQs
-- - Branches with operating hours and assigned staff
-- - Doctors/specialists with their specialties
-- - Scoring rules
-- =====================================================
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

        -- Services
        'services', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'name', s.name,
                'description', COALESCE(s.description, ''),
                'price_min', COALESCE(s.price_min, 0),
                'price_max', COALESCE(s.price_max, s.price_min),
                'duration_minutes', COALESCE(s.duration_minutes, 30),
                'category', COALESCE(s.category, 'general')
            ) ORDER BY s.name)
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

        -- Branches with full info including assigned doctors
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
                -- Staff assigned to this branch
                'staff_ids', COALESCE((
                    SELECT jsonb_agg(sb.staff_id)
                    FROM staff_branches sb
                    WHERE sb.branch_id = b.id
                ), '[]'::jsonb)
            ) ORDER BY b.is_headquarters DESC, b.name)
            FROM branches b
            WHERE b.tenant_id = p_tenant_id AND b.is_active = true
        ), '[]'::jsonb),

        -- Doctors/Specialists with their info
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
                -- Branches where this doctor works
                'branch_ids', COALESCE((
                    SELECT jsonb_agg(sb.branch_id)
                    FROM staff_branches sb
                    WHERE sb.staff_id = st.id
                ), '[]'::jsonb),
                -- Dental profile info if exists
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
        ), '[]'::jsonb)
    );

    RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_tenant_ai_context(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_ai_context(UUID) TO service_role;

-- =====================================================
-- Add comment for documentation
-- =====================================================
COMMENT ON FUNCTION get_tenant_ai_context IS
'Returns complete AI context for a tenant including:
- Tenant info and timezone
- AI configuration (system prompt, personality, etc.)
- Services with prices and durations
- FAQs for common questions
- Branches with operating hours and assigned staff
- Doctors/specialists with specialties and branch assignments
- Lead scoring rules

Used by ai.service.ts to build system prompts for GPT.';

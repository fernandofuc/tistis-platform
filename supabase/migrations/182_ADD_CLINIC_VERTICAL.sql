-- =====================================================
-- TIS TIS PLATFORM - ADD CLINIC VERTICAL
-- Migration: 182_ADD_CLINIC_VERTICAL.sql
-- Date: January 31, 2026
-- Version: 1.0
--
-- PURPOSE: Add 'clinic' vertical to all CHECK constraints
-- across the database. The 'clinic' vertical represents
-- medical clinics, aesthetic centers, spas, and general
-- medical consulting offices.
--
-- CONTEXT: The 'clinic' vertical was added to the frontend
-- code (verticals.ts, provisioning.ts) but the database
-- CHECK constraints still prevent inserting 'clinic' values.
--
-- AFFECTED TABLES:
-- - tenants
-- - ai_prompt_templates
-- - ai_tenant_config
-- - vertical_guides
-- - industry_recommendations
-- - industry_recommendation
-- - business_intelligence_config
-- - voice_agent_catalog
-- - assistant_profiles
-- - assistant_profiles_v2
-- - voice_assistant_types
-- - unified_assistant_types
-- =====================================================

BEGIN;

-- =====================================================
-- PART 1: TENANTS TABLE
-- Most critical - this is where vertical is first set
-- =====================================================

-- Check if constraint exists before dropping
DO $$
BEGIN
    -- Drop existing constraint
    ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_vertical_check;

    -- Add new constraint with 'clinic' included
    ALTER TABLE tenants ADD CONSTRAINT tenants_vertical_check
    CHECK (vertical IN (
        'dental',
        'restaurant',
        'clinic',
        'pharmacy',
        'retail',
        'medical',
        'gym',
        'beauty',
        'veterinary',
        'services',
        'other'
    ));

    RAISE NOTICE 'Updated CHECK constraint on tenants.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update tenants constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PART 2: AI_PROMPT_TEMPLATES TABLE
-- =====================================================

DO $$
BEGIN
    ALTER TABLE ai_prompt_templates DROP CONSTRAINT IF EXISTS ai_prompt_templates_vertical_check;

    ALTER TABLE ai_prompt_templates ADD CONSTRAINT ai_prompt_templates_vertical_check
    CHECK (vertical IN (
        'dental',
        'restaurant',
        'clinic',
        'medical',
        'gym',
        'beauty',
        'veterinary',
        'services',
        'retail',
        'other'
    ));

    RAISE NOTICE 'Updated CHECK constraint on ai_prompt_templates.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update ai_prompt_templates constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PART 3: AI_TENANT_CONFIG TABLE
-- =====================================================

DO $$
BEGIN
    ALTER TABLE ai_tenant_config DROP CONSTRAINT IF EXISTS ai_tenant_config_vertical_check;

    ALTER TABLE ai_tenant_config ADD CONSTRAINT ai_tenant_config_vertical_check
    CHECK (vertical IN (
        'dental',
        'restaurant',
        'clinic',
        'medical',
        'gym',
        'beauty',
        'veterinary',
        'services',
        'retail',
        'other'
    ));

    RAISE NOTICE 'Updated CHECK constraint on ai_tenant_config.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update ai_tenant_config constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PART 4: VERTICAL_GUIDES TABLE
-- =====================================================

DO $$
BEGIN
    ALTER TABLE vertical_guides DROP CONSTRAINT IF EXISTS vertical_guides_vertical_check;

    ALTER TABLE vertical_guides ADD CONSTRAINT vertical_guides_vertical_check
    CHECK (vertical IN (
        'dental',
        'restaurant',
        'clinic',
        'pharmacy',
        'retail',
        'medical',
        'gym',
        'beauty',
        'veterinary',
        'services',
        'other'
    ));

    RAISE NOTICE 'Updated CHECK constraint on vertical_guides.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update vertical_guides constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PART 5: INDUSTRY_RECOMMENDATIONS TABLE (migration 012)
-- =====================================================

DO $$
BEGIN
    ALTER TABLE industry_recommendations DROP CONSTRAINT IF EXISTS industry_recommendations_vertical_check;

    ALTER TABLE industry_recommendations ADD CONSTRAINT industry_recommendations_vertical_check
    CHECK (vertical IN (
        'dental',
        'restaurant',
        'clinic',
        'pharmacy',
        'retail',
        'medical',
        'gym',
        'beauty',
        'veterinary',
        'services',
        'other'
    ));

    RAISE NOTICE 'Updated CHECK constraint on industry_recommendations.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update industry_recommendations constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PART 6: INDUSTRY_RECOMMENDATION TABLE (migration 013)
-- Note: Different table name, singular
-- =====================================================

DO $$
BEGIN
    ALTER TABLE industry_recommendation DROP CONSTRAINT IF EXISTS industry_recommendation_vertical_check;

    ALTER TABLE industry_recommendation ADD CONSTRAINT industry_recommendation_vertical_check
    CHECK (vertical IN (
        'dental',
        'restaurant',
        'clinic',
        'pharmacy',
        'retail',
        'medical',
        'gym',
        'beauty',
        'veterinary',
        'services',
        'other'
    ));

    RAISE NOTICE 'Updated CHECK constraint on industry_recommendation.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update industry_recommendation constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PART 7: BUSINESS_INTELLIGENCE_CONFIG TABLE
-- =====================================================

DO $$
BEGIN
    ALTER TABLE business_intelligence_config DROP CONSTRAINT IF EXISTS business_intelligence_config_recommended_vertical_check;

    ALTER TABLE business_intelligence_config ADD CONSTRAINT business_intelligence_config_recommended_vertical_check
    CHECK (recommended_vertical IN (
        'dental',
        'restaurant',
        'clinic',
        'pharmacy',
        'retail',
        'medical',
        'gym',
        'beauty',
        'veterinary',
        'services',
        'other'
    ));

    RAISE NOTICE 'Updated CHECK constraint on business_intelligence_config.recommended_vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update business_intelligence_config constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PART 8: VOICE_AGENT_CATALOG TABLE
-- =====================================================

DO $$
BEGIN
    ALTER TABLE voice_agent_catalog DROP CONSTRAINT IF EXISTS voice_agent_catalog_vertical_check;

    ALTER TABLE voice_agent_catalog ADD CONSTRAINT voice_agent_catalog_vertical_check
    CHECK (vertical IN (
        'dental',
        'restaurant',
        'clinic',
        'medical',
        'gym',
        'beauty',
        'veterinary',
        'services',
        'retail',
        'other'
    ));

    RAISE NOTICE 'Updated CHECK constraint on voice_agent_catalog.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update voice_agent_catalog constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PART 9: ASSISTANT_PROFILES TABLE
-- =====================================================

DO $$
BEGIN
    ALTER TABLE assistant_profiles DROP CONSTRAINT IF EXISTS assistant_profiles_vertical_check;

    ALTER TABLE assistant_profiles ADD CONSTRAINT assistant_profiles_vertical_check
    CHECK (vertical IN (
        'dental',
        'restaurant',
        'clinic',
        'medical',
        'gym',
        'beauty',
        'veterinary',
        'services',
        'general'
    ));

    RAISE NOTICE 'Updated CHECK constraint on assistant_profiles.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update assistant_profiles constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PART 10: ASSISTANT_PROFILES_V2 TABLE
-- =====================================================

DO $$
BEGIN
    ALTER TABLE assistant_profiles_v2 DROP CONSTRAINT IF EXISTS assistant_profiles_v2_vertical_check;

    ALTER TABLE assistant_profiles_v2 ADD CONSTRAINT assistant_profiles_v2_vertical_check
    CHECK (vertical IN (
        'dental',
        'restaurant',
        'clinic',
        'retail',
        'services'
    ));

    RAISE NOTICE 'Updated CHECK constraint on assistant_profiles_v2.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update assistant_profiles_v2 constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PART 11: VOICE_ASSISTANT_TYPES TABLE
-- =====================================================

DO $$
BEGIN
    ALTER TABLE voice_assistant_types DROP CONSTRAINT IF EXISTS voice_assistant_types_vertical_check;

    ALTER TABLE voice_assistant_types ADD CONSTRAINT voice_assistant_types_vertical_check
    CHECK (vertical IN (
        'dental',
        'restaurant',
        'clinic'
    ));

    RAISE NOTICE 'Updated CHECK constraint on voice_assistant_types.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update voice_assistant_types constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PART 12: UNIFIED_ASSISTANT_TYPES TABLE
-- =====================================================

DO $$
BEGIN
    ALTER TABLE unified_assistant_types DROP CONSTRAINT IF EXISTS unified_assistant_types_vertical_check;

    ALTER TABLE unified_assistant_types ADD CONSTRAINT unified_assistant_types_vertical_check
    CHECK (vertical IN (
        'dental',
        'restaurant',
        'clinic'
    ));

    RAISE NOTICE 'Updated CHECK constraint on unified_assistant_types.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update unified_assistant_types constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PART 13: INSERT SEED DATA FOR CLINIC VERTICAL
-- Add clinic to vertical_guides if not exists
-- =====================================================

-- Insert clinic vertical guide if it doesn't exist
INSERT INTO vertical_guides (
    vertical,
    display_name,
    description,
    sample_services,
    sample_faqs,
    sample_doctors,
    ai_personality_suggestion,
    ui_config
)
SELECT
    'clinic',
    'Consultorios',
    'Consultorios médicos, estéticos, de belleza y especialidades',
    '[
        {"name": "Consulta General", "description": "Consulta médica general", "price": 800, "duration": 30},
        {"name": "Consulta Especialidad", "description": "Consulta con especialista", "price": 1200, "duration": 45},
        {"name": "Procedimiento Menor", "description": "Procedimientos ambulatorios menores", "price": 2500, "duration": 60},
        {"name": "Diagnóstico", "description": "Evaluación y diagnóstico", "price": 1500, "duration": 45}
    ]'::jsonb,
    '[
        {"question": "¿Cuáles son los horarios de atención?", "answer": "Atendemos de lunes a viernes de 9:00 a 19:00 y sábados de 9:00 a 14:00."},
        {"question": "¿Aceptan seguros médicos?", "answer": "Sí, trabajamos con las principales aseguradoras. Consulte disponibilidad."},
        {"question": "¿Cómo puedo agendar una cita?", "answer": "Puede agendar por WhatsApp, llamada telefónica o a través de nuestro sitio web."}
    ]'::jsonb,
    '[
        {"name": "Dr. Médico General", "specialty": "Medicina General", "available_days": ["lunes", "miércoles", "viernes"]}
    ]'::jsonb,
    'Profesional y empático. Utiliza terminología médica cuando sea apropiado pero explica de manera sencilla. Prioriza la seguridad y bienestar del paciente.',
    '{"theme": "medical", "primary_color": "#059669", "icon": "✨"}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM vertical_guides WHERE vertical = 'clinic'
);

-- =====================================================
-- PART 14: ADD CLINIC AI PROMPT TEMPLATE
-- =====================================================

INSERT INTO ai_prompt_templates (
    vertical,
    prompt_key,
    prompt_name,
    prompt_description,
    prompt_text,
    available_variables,
    response_format,
    is_default,
    is_active,
    version
)
SELECT
    'clinic',
    'main_assistant',
    'Asistente de Consultorio',
    'Prompt principal para asistentes virtuales de consultorios médicos y estéticos',
    'Eres un asistente virtual profesional para {{clinic_name}}, un consultorio especializado en brindar atención médica de calidad.

Tu rol es:
1. Responder consultas sobre servicios y especialidades
2. Ayudar a agendar citas con los especialistas apropiados
3. Proporcionar información sobre precios y disponibilidad
4. Resolver dudas frecuentes sobre procedimientos

Información del consultorio:
- Servicios: {{services}}
- Especialistas: {{doctors}}
- Horarios: {{hours}}
- Sucursales: {{branches}}

Preguntas frecuentes:
{{faqs}}

Instrucciones especiales del consultorio:
{{custom_instructions}}

Mantén un tono profesional pero cercano. Siempre prioriza la seguridad del paciente y recomienda una consulta presencial cuando sea necesario.',
    ARRAY['clinic_name', 'services', 'doctors', 'hours', 'branches', 'faqs', 'custom_instructions'],
    'structured',
    true,
    true,
    1
WHERE NOT EXISTS (
    SELECT 1 FROM ai_prompt_templates
    WHERE vertical = 'clinic' AND prompt_key = 'main_assistant'
);

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to verify the migration was successful
-- =====================================================

-- Verify tenants constraint allows 'clinic'
DO $$
DECLARE
    constraint_def TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid)
    INTO constraint_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'tenants'
    AND c.conname LIKE '%vertical%';

    IF constraint_def LIKE '%clinic%' THEN
        RAISE NOTICE 'SUCCESS: tenants.vertical now accepts clinic';
    ELSE
        RAISE WARNING 'FAILED: tenants.vertical does not include clinic';
    END IF;
END $$;

-- Final summary
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Migration 182_ADD_CLINIC_VERTICAL completed';
    RAISE NOTICE 'The clinic vertical is now supported across all tables';
    RAISE NOTICE '=====================================================';
END $$;

COMMIT;

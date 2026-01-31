-- =====================================================
-- TIS TIS PLATFORM - FIX CLINIC VERTICAL MISSING TABLES
-- Migration: 183_FIX_CLINIC_VERTICAL_MISSING_TABLES.sql
-- Date: January 31, 2026
-- Version: 1.0
--
-- PURPOSE: Fix tables that were MISSED in migration 182
-- Migration 182 added 'clinic' to 12 tables but MISSED:
-- - vertical_configs (from 012_CONSOLIDATED_SCHEMA.sql)
-- - agent_templates (from 124_AGENT_PROFILES_SYSTEM.sql)
--
-- This migration also normalizes the vertical list to include
-- all 11 standard verticals for consistency.
--
-- STANDARD VERTICALS LIST (11 values):
-- dental, restaurant, clinic, pharmacy, retail, medical,
-- gym, beauty, veterinary, services, other
--
-- CONTEXT: Second pass to ensure all tables support 'clinic'
-- =====================================================

BEGIN;

-- =====================================================
-- PART 1: VERTICAL_CONFIGS TABLE
-- Created in 012_CONSOLIDATED_SCHEMA.sql with limited verticals
-- =====================================================

DO $$
BEGIN
    -- Drop existing constraint
    ALTER TABLE vertical_configs DROP CONSTRAINT IF EXISTS vertical_configs_vertical_check;

    -- Add new constraint with ALL verticals including 'clinic'
    ALTER TABLE vertical_configs ADD CONSTRAINT vertical_configs_vertical_check
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

    RAISE NOTICE 'Updated CHECK constraint on vertical_configs.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update vertical_configs constraint: %', SQLERRM;
END $$;

-- Insert clinic configuration if not exists
INSERT INTO vertical_configs (
    vertical,
    display_name,
    description,
    icon,
    primary_color,
    modules_enabled,
    sidebar_config,
    is_active
)
SELECT
    'clinic',
    'Consultorios',
    'Consultorios médicos, estéticos, de belleza y especialidades',
    'sparkles',
    '#059669',
    '["leads", "appointments", "patients", "clinical_history", "quotes", "conversations", "analytics"]'::jsonb,
    '[{"id": "dashboard", "label": "Dashboard", "icon": "LayoutDashboard", "href": "/dashboard"},
      {"id": "leads", "label": "Leads", "icon": "Users", "href": "/dashboard/leads"},
      {"id": "calendario", "label": "Agenda", "icon": "Calendar", "href": "/dashboard/calendario"},
      {"id": "patients", "label": "Pacientes", "icon": "UserCheck", "href": "/dashboard/patients"},
      {"id": "inbox", "label": "Inbox", "icon": "MessageSquare", "href": "/dashboard/inbox"},
      {"id": "quotes", "label": "Cotizaciones", "icon": "FileText", "href": "/dashboard/quotes"},
      {"id": "analytics", "label": "Analytics", "icon": "BarChart3", "href": "/dashboard/analytics"},
      {"id": "settings", "label": "Configuración", "icon": "Settings", "href": "/dashboard/settings"}]'::jsonb,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM vertical_configs WHERE vertical = 'clinic'
);

-- =====================================================
-- PART 2: AGENT_TEMPLATES TABLE
-- Created in 124_AGENT_PROFILES_SYSTEM.sql with limited verticals
-- =====================================================

DO $$
BEGIN
    -- Drop existing constraint
    ALTER TABLE agent_templates DROP CONSTRAINT IF EXISTS agent_templates_vertical_check;

    -- Add new constraint with 'clinic' included
    -- Note: agent_templates uses 'general' instead of 'other'
    ALTER TABLE agent_templates ADD CONSTRAINT agent_templates_vertical_check
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

    RAISE NOTICE 'Updated CHECK constraint on agent_templates.vertical';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update agent_templates constraint: %', SQLERRM;
END $$;

-- Insert clinic-specific templates if not exist
-- Template 1: Full service clinic assistant
INSERT INTO agent_templates (
    template_key,
    name,
    description,
    vertical,
    profile_type,
    capabilities,
    prompt_template,
    customizable_variables,
    display_order,
    is_default,
    is_active
)
SELECT
    'clinic_full',
    'Asistente Completo',
    'Agenda citas, responde consultas, captura leads para consultorios médicos',
    'clinic',
    'business',
    '["booking", "pricing", "faq", "lead_capture", "location", "hours"]'::jsonb,
    'Eres el asistente virtual de {{business_name}}, un consultorio médico profesional ubicado en {{location}}.

PERSONALIDAD: {{response_style}}

TU MISIÓN:
- Agendar consultas con nuestros especialistas
- Informar sobre servicios y costos aproximados
- Resolver dudas de pacientes potenciales
- Capturar información de leads interesados

REGLAS INQUEBRANTABLES:
1. NUNCA dar diagnósticos médicos
2. NUNCA inventar precios específicos si no los conoces
3. SIEMPRE derivar emergencias a servicios de urgencias
4. SIEMPRE confirmar datos antes de agendar
5. SIEMPRE recomendar consulta presencial para evaluación

SALUDO: {{greeting}}
HORARIO: {{schedule}}',
    '["business_name", "location", "greeting", "schedule", "response_style"]'::jsonb,
    1,
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM agent_templates WHERE template_key = 'clinic_full'
);

-- Template 2: Appointments only for clinics
INSERT INTO agent_templates (
    template_key,
    name,
    description,
    vertical,
    profile_type,
    capabilities,
    prompt_template,
    customizable_variables,
    display_order,
    is_default,
    is_active
)
SELECT
    'clinic_appointments_only',
    'Solo Citas',
    'Se enfoca únicamente en agendar consultas médicas',
    'clinic',
    'business',
    '["booking", "location", "hours"]'::jsonb,
    'Eres el asistente de citas de {{business_name}}.

TU ÚNICA MISIÓN: Agendar consultas con nuestros especialistas.

Para cualquier otra consulta médica, indica amablemente que tu función es agendar y ofrece hacerlo.

IMPORTANTE: NO des consejos médicos. Para emergencias, derivar a urgencias.

SALUDO: {{greeting}}
HORARIO: {{schedule}}',
    '["business_name", "greeting", "schedule"]'::jsonb,
    2,
    false,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM agent_templates WHERE template_key = 'clinic_appointments_only'
);

-- Template 3: Personal brand for clinic doctors
INSERT INTO agent_templates (
    template_key,
    name,
    description,
    vertical,
    profile_type,
    capabilities,
    prompt_template,
    customizable_variables,
    display_order,
    is_default,
    is_active
)
SELECT
    'clinic_personal',
    'Marca Personal Médico',
    'Para las redes sociales personales del médico/especialista',
    'clinic',
    'personal',
    '["redirect_to_clinic", "basic_info"]'::jsonb,
    'Eres el asistente personal de {{doctor_name}}, médico especialista.

Cuando alguien pregunte por citas o servicios, deriva amablemente al consultorio:
"Para agendar una consulta, te invito a contactar directamente a {{clinic_name}} donde {{doctor_name}} atiende. Puedes escribirles a {{clinic_contact}}."

Puedes responder preguntas generales de salud de forma educativa, pero NUNCA:
- Dar diagnósticos
- Recetar medicamentos
- Dar precios específicos
- Agendar citas directamente',
    '["doctor_name", "clinic_name", "clinic_contact"]'::jsonb,
    10,
    true,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM agent_templates WHERE template_key = 'clinic_personal'
);

-- =====================================================
-- PART 3: VERIFICATION QUERIES
-- =====================================================

-- Verify vertical_configs constraint
DO $$
DECLARE
    constraint_def TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid)
    INTO constraint_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'vertical_configs'
    AND c.conname LIKE '%vertical%';

    IF constraint_def LIKE '%clinic%' THEN
        RAISE NOTICE 'SUCCESS: vertical_configs.vertical now accepts clinic';
    ELSE
        RAISE WARNING 'FAILED: vertical_configs.vertical does not include clinic';
    END IF;
END $$;

-- Verify agent_templates constraint
DO $$
DECLARE
    constraint_def TEXT;
BEGIN
    SELECT pg_get_constraintdef(c.oid)
    INTO constraint_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'agent_templates'
    AND c.conname LIKE '%vertical%';

    IF constraint_def LIKE '%clinic%' THEN
        RAISE NOTICE 'SUCCESS: agent_templates.vertical now accepts clinic';
    ELSE
        RAISE WARNING 'FAILED: agent_templates.vertical does not include clinic';
    END IF;
END $$;

-- Final summary
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Migration 183_FIX_CLINIC_VERTICAL_MISSING_TABLES completed';
    RAISE NOTICE 'Fixed tables: vertical_configs, agent_templates';
    RAISE NOTICE 'Added clinic templates for agent_templates';
    RAISE NOTICE '=====================================================';
END $$;

COMMIT;

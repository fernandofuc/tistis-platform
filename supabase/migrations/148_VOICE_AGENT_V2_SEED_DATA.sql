-- =====================================================
-- TIS TIS PLATFORM - VOICE AGENT v2.0
-- Migration: 148_VOICE_AGENT_V2_SEED_DATA.sql
-- Date: January 2025
-- Version: 2.0
--
-- PURPOSE: Seed data para Voice Agent v2.0
-- - 6 tipos de asistente (3 restaurant + 3 dental)
-- - Catalogo de voces (ElevenLabs + Azure)
--
-- PARTE DE: Voice Agent v2.0 - FASE 01 - MICROFASE 1.7 y 1.8
-- =====================================================

-- =====================================================
-- PARTE A: TIPOS DE ASISTENTE - RESTAURANT
-- =====================================================

-- Restaurant Basic: Solo reservaciones
INSERT INTO public.voice_assistant_types (
    name,
    display_name,
    description,
    vertical,
    enabled_capabilities,
    available_tools,
    default_voice_id,
    default_personality,
    prompt_template_name,
    template_version,
    max_call_duration_seconds,
    display_order,
    is_active
) VALUES (
    'rest_basic',
    'Restaurante Basico',
    'Asistente de voz para restaurantes enfocado en reservaciones. Maneja consultas de disponibilidad, creacion y modificacion de reservaciones.',
    'restaurant',
    '["reservations", "business_hours", "location_info"]'::jsonb,
    '[
        {
            "name": "check_availability",
            "description": "Verificar disponibilidad para una fecha y hora",
            "parameters": {
                "date": "string (YYYY-MM-DD)",
                "time": "string (HH:MM)",
                "party_size": "number"
            },
            "requires_confirmation": false
        },
        {
            "name": "create_reservation",
            "description": "Crear una nueva reservacion",
            "parameters": {
                "customer_name": "string",
                "customer_phone": "string",
                "date": "string (YYYY-MM-DD)",
                "time": "string (HH:MM)",
                "party_size": "number",
                "special_requests": "string (optional)"
            },
            "requires_confirmation": true
        },
        {
            "name": "modify_reservation",
            "description": "Modificar una reservacion existente",
            "parameters": {
                "reservation_id": "string",
                "new_date": "string (optional)",
                "new_time": "string (optional)",
                "new_party_size": "number (optional)"
            },
            "requires_confirmation": true
        },
        {
            "name": "cancel_reservation",
            "description": "Cancelar una reservacion",
            "parameters": {
                "reservation_id": "string"
            },
            "requires_confirmation": true
        },
        {
            "name": "get_business_hours",
            "description": "Obtener horarios del restaurante",
            "parameters": {},
            "requires_confirmation": false
        }
    ]'::jsonb,
    NULL,
    'professional_friendly',
    'restaurant_basic',
    1,
    600,
    1,
    true
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    enabled_capabilities = EXCLUDED.enabled_capabilities,
    available_tools = EXCLUDED.available_tools,
    updated_at = NOW();

-- Restaurant Standard: Reservaciones + Pedidos
INSERT INTO public.voice_assistant_types (
    name,
    display_name,
    description,
    vertical,
    enabled_capabilities,
    available_tools,
    default_voice_id,
    default_personality,
    prompt_template_name,
    template_version,
    max_call_duration_seconds,
    display_order,
    is_active
) VALUES (
    'rest_standard',
    'Restaurante Estandar',
    'Asistente de voz para restaurantes con capacidad de reservaciones y pedidos para llevar. Maneja menu, precios y ordenes.',
    'restaurant',
    '["reservations", "orders", "menu_info", "business_hours", "location_info"]'::jsonb,
    '[
        {
            "name": "check_availability",
            "description": "Verificar disponibilidad para una fecha y hora",
            "parameters": {
                "date": "string (YYYY-MM-DD)",
                "time": "string (HH:MM)",
                "party_size": "number"
            },
            "requires_confirmation": false
        },
        {
            "name": "create_reservation",
            "description": "Crear una nueva reservacion",
            "parameters": {
                "customer_name": "string",
                "customer_phone": "string",
                "date": "string (YYYY-MM-DD)",
                "time": "string (HH:MM)",
                "party_size": "number",
                "special_requests": "string (optional)"
            },
            "requires_confirmation": true
        },
        {
            "name": "get_menu",
            "description": "Obtener menu del restaurante",
            "parameters": {
                "category": "string (optional)"
            },
            "requires_confirmation": false
        },
        {
            "name": "create_order",
            "description": "Crear un pedido para llevar",
            "parameters": {
                "customer_name": "string",
                "customer_phone": "string",
                "items": "array of {item_id, quantity, notes}",
                "pickup_time": "string (HH:MM)"
            },
            "requires_confirmation": true
        },
        {
            "name": "get_order_status",
            "description": "Consultar estado de un pedido",
            "parameters": {
                "order_id": "string"
            },
            "requires_confirmation": false
        },
        {
            "name": "get_business_hours",
            "description": "Obtener horarios del restaurante",
            "parameters": {},
            "requires_confirmation": false
        }
    ]'::jsonb,
    NULL,
    'professional_friendly',
    'restaurant_standard',
    1,
    900,
    2,
    true
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    enabled_capabilities = EXCLUDED.enabled_capabilities,
    available_tools = EXCLUDED.available_tools,
    updated_at = NOW();

-- Restaurant Complete: Todo + FAQ + Transfer
INSERT INTO public.voice_assistant_types (
    name,
    display_name,
    description,
    vertical,
    enabled_capabilities,
    available_tools,
    default_voice_id,
    default_personality,
    prompt_template_name,
    template_version,
    max_call_duration_seconds,
    display_order,
    is_active
) VALUES (
    'rest_complete',
    'Restaurante Completo',
    'Asistente de voz completo para restaurantes. Incluye reservaciones, pedidos, FAQ, y transferencia a humano.',
    'restaurant',
    '["reservations", "orders", "menu_info", "faq", "human_transfer", "business_hours", "location_info", "specials"]'::jsonb,
    '[
        {
            "name": "check_availability",
            "description": "Verificar disponibilidad para una fecha y hora",
            "parameters": {
                "date": "string (YYYY-MM-DD)",
                "time": "string (HH:MM)",
                "party_size": "number"
            },
            "requires_confirmation": false
        },
        {
            "name": "create_reservation",
            "description": "Crear una nueva reservacion",
            "parameters": {
                "customer_name": "string",
                "customer_phone": "string",
                "date": "string (YYYY-MM-DD)",
                "time": "string (HH:MM)",
                "party_size": "number",
                "special_requests": "string (optional)"
            },
            "requires_confirmation": true
        },
        {
            "name": "get_menu",
            "description": "Obtener menu del restaurante",
            "parameters": {
                "category": "string (optional)"
            },
            "requires_confirmation": false
        },
        {
            "name": "create_order",
            "description": "Crear un pedido para llevar",
            "parameters": {
                "customer_name": "string",
                "customer_phone": "string",
                "items": "array of {item_id, quantity, notes}",
                "pickup_time": "string (HH:MM)"
            },
            "requires_confirmation": true
        },
        {
            "name": "search_faq",
            "description": "Buscar en preguntas frecuentes",
            "parameters": {
                "query": "string"
            },
            "requires_confirmation": false
        },
        {
            "name": "transfer_to_human",
            "description": "Transferir la llamada a un humano",
            "parameters": {
                "reason": "string",
                "department": "string (optional)"
            },
            "requires_confirmation": true
        },
        {
            "name": "get_daily_specials",
            "description": "Obtener especiales del dia",
            "parameters": {},
            "requires_confirmation": false
        },
        {
            "name": "get_business_hours",
            "description": "Obtener horarios del restaurante",
            "parameters": {},
            "requires_confirmation": false
        }
    ]'::jsonb,
    NULL,
    'warm',
    'restaurant_complete',
    1,
    1200,
    3,
    true
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    enabled_capabilities = EXCLUDED.enabled_capabilities,
    available_tools = EXCLUDED.available_tools,
    updated_at = NOW();

-- =====================================================
-- PARTE B: TIPOS DE ASISTENTE - DENTAL
-- =====================================================

-- Dental Basic: Solo citas
INSERT INTO public.voice_assistant_types (
    name,
    display_name,
    description,
    vertical,
    enabled_capabilities,
    available_tools,
    default_voice_id,
    default_personality,
    prompt_template_name,
    template_version,
    max_call_duration_seconds,
    display_order,
    is_active
) VALUES (
    'dental_basic',
    'Clinica Dental Basico',
    'Asistente de voz para clinicas dentales enfocado en citas. Maneja consultas de disponibilidad, creacion y modificacion de citas.',
    'dental',
    '["appointments", "business_hours", "location_info"]'::jsonb,
    '[
        {
            "name": "check_availability",
            "description": "Verificar disponibilidad para cita dental",
            "parameters": {
                "date": "string (YYYY-MM-DD)",
                "time": "string (HH:MM)",
                "service_type": "string (optional)",
                "dentist_id": "string (optional)"
            },
            "requires_confirmation": false
        },
        {
            "name": "create_appointment",
            "description": "Crear una nueva cita",
            "parameters": {
                "patient_name": "string",
                "patient_phone": "string",
                "date": "string (YYYY-MM-DD)",
                "time": "string (HH:MM)",
                "service_type": "string",
                "dentist_id": "string (optional)",
                "notes": "string (optional)"
            },
            "requires_confirmation": true
        },
        {
            "name": "modify_appointment",
            "description": "Modificar una cita existente",
            "parameters": {
                "appointment_id": "string",
                "new_date": "string (optional)",
                "new_time": "string (optional)"
            },
            "requires_confirmation": true
        },
        {
            "name": "cancel_appointment",
            "description": "Cancelar una cita",
            "parameters": {
                "appointment_id": "string",
                "reason": "string (optional)"
            },
            "requires_confirmation": true
        },
        {
            "name": "get_business_hours",
            "description": "Obtener horarios de la clinica",
            "parameters": {},
            "requires_confirmation": false
        }
    ]'::jsonb,
    NULL,
    'professional',
    'dental_basic',
    1,
    600,
    4,
    true
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    enabled_capabilities = EXCLUDED.enabled_capabilities,
    available_tools = EXCLUDED.available_tools,
    updated_at = NOW();

-- Dental Standard: Citas + Servicios + Info
INSERT INTO public.voice_assistant_types (
    name,
    display_name,
    description,
    vertical,
    enabled_capabilities,
    available_tools,
    default_voice_id,
    default_personality,
    prompt_template_name,
    template_version,
    max_call_duration_seconds,
    display_order,
    is_active
) VALUES (
    'dental_standard',
    'Clinica Dental Estandar',
    'Asistente de voz para clinicas dentales con informacion de servicios y precios. Ideal para clinicas de tamano medio.',
    'dental',
    '["appointments", "services_info", "pricing", "dentist_info", "business_hours", "location_info"]'::jsonb,
    '[
        {
            "name": "check_availability",
            "description": "Verificar disponibilidad para cita dental",
            "parameters": {
                "date": "string (YYYY-MM-DD)",
                "time": "string (HH:MM)",
                "service_type": "string (optional)",
                "dentist_id": "string (optional)"
            },
            "requires_confirmation": false
        },
        {
            "name": "create_appointment",
            "description": "Crear una nueva cita",
            "parameters": {
                "patient_name": "string",
                "patient_phone": "string",
                "date": "string (YYYY-MM-DD)",
                "time": "string (HH:MM)",
                "service_type": "string",
                "dentist_id": "string (optional)",
                "notes": "string (optional)"
            },
            "requires_confirmation": true
        },
        {
            "name": "get_services",
            "description": "Obtener lista de servicios dentales",
            "parameters": {
                "category": "string (optional)"
            },
            "requires_confirmation": false
        },
        {
            "name": "get_service_pricing",
            "description": "Obtener precios de servicios",
            "parameters": {
                "service_id": "string"
            },
            "requires_confirmation": false
        },
        {
            "name": "get_dentist_info",
            "description": "Obtener informacion de dentistas",
            "parameters": {
                "dentist_id": "string (optional)"
            },
            "requires_confirmation": false
        },
        {
            "name": "get_business_hours",
            "description": "Obtener horarios de la clinica",
            "parameters": {},
            "requires_confirmation": false
        }
    ]'::jsonb,
    NULL,
    'professional_friendly',
    'dental_standard',
    1,
    900,
    5,
    true
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    enabled_capabilities = EXCLUDED.enabled_capabilities,
    available_tools = EXCLUDED.available_tools,
    updated_at = NOW();

-- Dental Complete: Todo + FAQ + Transfer + Emergencias
INSERT INTO public.voice_assistant_types (
    name,
    display_name,
    description,
    vertical,
    enabled_capabilities,
    available_tools,
    default_voice_id,
    default_personality,
    prompt_template_name,
    template_version,
    max_call_duration_seconds,
    display_order,
    is_active
) VALUES (
    'dental_complete',
    'Clinica Dental Completo',
    'Asistente de voz completo para clinicas dentales. Incluye citas, servicios, FAQ, emergencias y transferencia a humano.',
    'dental',
    '["appointments", "services_info", "pricing", "dentist_info", "faq", "emergency_triage", "human_transfer", "insurance_info", "business_hours", "location_info"]'::jsonb,
    '[
        {
            "name": "check_availability",
            "description": "Verificar disponibilidad para cita dental",
            "parameters": {
                "date": "string (YYYY-MM-DD)",
                "time": "string (HH:MM)",
                "service_type": "string (optional)",
                "dentist_id": "string (optional)"
            },
            "requires_confirmation": false
        },
        {
            "name": "create_appointment",
            "description": "Crear una nueva cita",
            "parameters": {
                "patient_name": "string",
                "patient_phone": "string",
                "date": "string (YYYY-MM-DD)",
                "time": "string (HH:MM)",
                "service_type": "string",
                "dentist_id": "string (optional)",
                "notes": "string (optional)"
            },
            "requires_confirmation": true
        },
        {
            "name": "get_services",
            "description": "Obtener lista de servicios dentales",
            "parameters": {
                "category": "string (optional)"
            },
            "requires_confirmation": false
        },
        {
            "name": "search_faq",
            "description": "Buscar en preguntas frecuentes",
            "parameters": {
                "query": "string"
            },
            "requires_confirmation": false
        },
        {
            "name": "triage_emergency",
            "description": "Evaluar emergencia dental",
            "parameters": {
                "symptoms": "string",
                "severity": "string (mild, moderate, severe)",
                "duration": "string"
            },
            "requires_confirmation": false
        },
        {
            "name": "check_insurance",
            "description": "Verificar cobertura de seguro",
            "parameters": {
                "insurance_provider": "string",
                "service_type": "string (optional)"
            },
            "requires_confirmation": false
        },
        {
            "name": "transfer_to_human",
            "description": "Transferir la llamada a un humano",
            "parameters": {
                "reason": "string",
                "department": "string (optional)",
                "urgency": "string (normal, urgent)"
            },
            "requires_confirmation": true
        },
        {
            "name": "get_business_hours",
            "description": "Obtener horarios de la clinica",
            "parameters": {},
            "requires_confirmation": false
        }
    ]'::jsonb,
    NULL,
    'professional_friendly',
    'dental_complete',
    1,
    1200,
    6,
    true
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    enabled_capabilities = EXCLUDED.enabled_capabilities,
    available_tools = EXCLUDED.available_tools,
    updated_at = NOW();

-- =====================================================
-- PARTE C: CATALOGO DE VOCES - ELEVENLABS
-- =====================================================

-- Maria - Voz femenina calida (mexicana)
INSERT INTO public.voice_catalog (
    provider,
    voice_id,
    name,
    display_name,
    gender,
    accent,
    language,
    supported_languages,
    personality_tags,
    preview_url,
    cost_per_minute,
    recommended_settings,
    default_speed,
    default_stability,
    default_similarity_boost,
    recommended_verticals,
    display_order,
    is_active,
    is_premium
) VALUES (
    'elevenlabs',
    'EXAVITQu4vr4xnSDxMaL',
    'maria',
    'Maria',
    'female',
    'mexicano',
    'es',
    ARRAY['es', 'es-MX'],
    '["calida", "profesional", "amable", "paciente"]'::jsonb,
    'https://api.elevenlabs.io/v1/voices/EXAVITQu4vr4xnSDxMaL/preview',
    0.0200,
    '{
        "model": "eleven_turbo_v2_5",
        "style": 0.0,
        "use_speaker_boost": true
    }'::jsonb,
    1.00,
    0.50,
    0.75,
    ARRAY['restaurant', 'dental'],
    1,
    true,
    false
) ON CONFLICT (provider, voice_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    personality_tags = EXCLUDED.personality_tags,
    recommended_settings = EXCLUDED.recommended_settings,
    updated_at = NOW();

-- Sofia - Voz femenina energetica
INSERT INTO public.voice_catalog (
    provider,
    voice_id,
    name,
    display_name,
    gender,
    accent,
    language,
    supported_languages,
    personality_tags,
    preview_url,
    cost_per_minute,
    recommended_settings,
    default_speed,
    default_stability,
    default_similarity_boost,
    recommended_verticals,
    display_order,
    is_active,
    is_premium
) VALUES (
    'elevenlabs',
    'jsCqWAovK2LkecY7zXl4',
    'sofia',
    'Sofia',
    'female',
    'mexicano',
    'es',
    ARRAY['es', 'es-MX'],
    '["energetica", "alegre", "dinamica", "juvenil"]'::jsonb,
    'https://api.elevenlabs.io/v1/voices/jsCqWAovK2LkecY7zXl4/preview',
    0.0200,
    '{
        "model": "eleven_turbo_v2_5",
        "style": 0.2,
        "use_speaker_boost": true
    }'::jsonb,
    1.05,
    0.45,
    0.80,
    ARRAY['restaurant'],
    2,
    true,
    false
) ON CONFLICT (provider, voice_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    personality_tags = EXCLUDED.personality_tags,
    recommended_settings = EXCLUDED.recommended_settings,
    updated_at = NOW();

-- Carlos - Voz masculina profesional
INSERT INTO public.voice_catalog (
    provider,
    voice_id,
    name,
    display_name,
    gender,
    accent,
    language,
    supported_languages,
    personality_tags,
    preview_url,
    cost_per_minute,
    recommended_settings,
    default_speed,
    default_stability,
    default_similarity_boost,
    recommended_verticals,
    display_order,
    is_active,
    is_premium
) VALUES (
    'elevenlabs',
    'LegCbmbXKbT5PUp3QFWv',
    'carlos',
    'Carlos',
    'male',
    'mexicano',
    'es',
    ARRAY['es', 'es-MX'],
    '["profesional", "serio", "confiable", "formal"]'::jsonb,
    'https://api.elevenlabs.io/v1/voices/LegCbmbXKbT5PUp3QFWv/preview',
    0.0200,
    '{
        "model": "eleven_turbo_v2_5",
        "style": 0.0,
        "use_speaker_boost": true
    }'::jsonb,
    0.95,
    0.55,
    0.70,
    ARRAY['dental'],
    3,
    true,
    false
) ON CONFLICT (provider, voice_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    personality_tags = EXCLUDED.personality_tags,
    recommended_settings = EXCLUDED.recommended_settings,
    updated_at = NOW();

-- Diego - Voz masculina amigable
INSERT INTO public.voice_catalog (
    provider,
    voice_id,
    name,
    display_name,
    gender,
    accent,
    language,
    supported_languages,
    personality_tags,
    preview_url,
    cost_per_minute,
    recommended_settings,
    default_speed,
    default_stability,
    default_similarity_boost,
    recommended_verticals,
    display_order,
    is_active,
    is_premium
) VALUES (
    'elevenlabs',
    'TxGEqnHWrfWFTfGW9XjX',
    'diego',
    'Diego',
    'male',
    'mexicano',
    'es',
    ARRAY['es', 'es-MX'],
    '["amigable", "cercano", "relajado", "natural"]'::jsonb,
    'https://api.elevenlabs.io/v1/voices/TxGEqnHWrfWFTfGW9XjX/preview',
    0.0200,
    '{
        "model": "eleven_turbo_v2_5",
        "style": 0.1,
        "use_speaker_boost": true
    }'::jsonb,
    1.00,
    0.50,
    0.75,
    ARRAY['restaurant', 'dental'],
    4,
    true,
    false
) ON CONFLICT (provider, voice_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    personality_tags = EXCLUDED.personality_tags,
    recommended_settings = EXCLUDED.recommended_settings,
    updated_at = NOW();

-- =====================================================
-- PARTE D: CATALOGO DE VOCES - AZURE (Backup)
-- =====================================================

-- Ana - Voz Azure neural (backup)
INSERT INTO public.voice_catalog (
    provider,
    voice_id,
    name,
    display_name,
    gender,
    accent,
    language,
    supported_languages,
    personality_tags,
    preview_url,
    cost_per_minute,
    recommended_settings,
    default_speed,
    default_stability,
    default_similarity_boost,
    recommended_verticals,
    display_order,
    is_active,
    is_premium
) VALUES (
    'azure',
    'es-MX-DaliaNeural',
    'ana',
    'Ana (Azure)',
    'female',
    'mexicano',
    'es',
    ARRAY['es', 'es-MX'],
    '["neutral", "clara", "profesional"]'::jsonb,
    NULL,
    0.0160,
    '{
        "style": "friendly",
        "pitch": "+0%",
        "rate": "+0%"
    }'::jsonb,
    1.00,
    NULL,
    NULL,
    ARRAY['restaurant', 'dental'],
    10,
    true,
    false
) ON CONFLICT (provider, voice_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    personality_tags = EXCLUDED.personality_tags,
    recommended_settings = EXCLUDED.recommended_settings,
    updated_at = NOW();

-- Jorge - Voz Azure neural masculina (backup)
INSERT INTO public.voice_catalog (
    provider,
    voice_id,
    name,
    display_name,
    gender,
    accent,
    language,
    supported_languages,
    personality_tags,
    preview_url,
    cost_per_minute,
    recommended_settings,
    default_speed,
    default_stability,
    default_similarity_boost,
    recommended_verticals,
    display_order,
    is_active,
    is_premium
) VALUES (
    'azure',
    'es-MX-JorgeNeural',
    'jorge',
    'Jorge (Azure)',
    'male',
    'mexicano',
    'es',
    ARRAY['es', 'es-MX'],
    '["neutral", "profesional", "serio"]'::jsonb,
    NULL,
    0.0160,
    '{
        "style": "professional",
        "pitch": "+0%",
        "rate": "+0%"
    }'::jsonb,
    1.00,
    NULL,
    NULL,
    ARRAY['dental'],
    11,
    true,
    false
) ON CONFLICT (provider, voice_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    personality_tags = EXCLUDED.personality_tags,
    recommended_settings = EXCLUDED.recommended_settings,
    updated_at = NOW();

-- =====================================================
-- VERIFICACION DE SEED DATA
-- =====================================================

DO $$
DECLARE
    v_types_count INTEGER;
    v_voices_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_types_count FROM public.voice_assistant_types;
    SELECT COUNT(*) INTO v_voices_count FROM public.voice_catalog;

    RAISE NOTICE 'Voice Agent v2.0 Seed Data:';
    RAISE NOTICE '  - Tipos de asistente: %', v_types_count;
    RAISE NOTICE '  - Voces en catalogo: %', v_voices_count;

    IF v_types_count < 6 THEN
        RAISE WARNING 'Se esperaban 6 tipos de asistente, se encontraron %', v_types_count;
    END IF;

    IF v_voices_count < 6 THEN
        RAISE WARNING 'Se esperaban al menos 6 voces, se encontraron %', v_voices_count;
    END IF;
END $$;

-- =====================================================
-- FIN MIGRACION 148
-- =====================================================

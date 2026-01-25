-- =====================================================
-- TIS TIS PLATFORM - UNIFIED ASSISTANT TYPES
-- Migration: 155_UNIFIED_ASSISTANT_TYPES.sql
-- Date: January 2026
-- Version: 1.0
--
-- PURPOSE:
-- 1. Unificar tipos de asistente entre Voice Agent y Messaging Agent
-- 2. Actualizar vertical Restaurant: rest_standard ahora incluye pedidos pickup
-- 3. Actualizar vertical Dental: eliminar dental_basic, fusionar con dental_standard
-- 4. Agregar service_options a tenants para configuracion de servicios
-- 5. Crear tabla messaging_assistant_types para canal de mensajeria
-- 6. Crear funcion get_unified_assistant_types para queries unificadas
--
-- CAMBIOS PRINCIPALES:
-- - rest_standard: +create_order, +get_order_status (pedidos pickup)
-- - dental_basic: ELIMINADO (migrar configs a dental_standard)
-- - dental_standard: fusiona capacidades de basic + standard
-- - Nueva columna tenants.service_options (JSONB)
-- - Nueva tabla messaging_assistant_types
--
-- PARTE DE: Unificacion de Agentes v1.0
-- =====================================================

-- =====================================================
-- PASO 1: AGREGAR SERVICE_OPTIONS A TENANTS
-- =====================================================

-- Agregar columna service_options si no existe
-- SINCRONIZADO CON: src/shared/types/unified-assistant-types.ts (TenantServiceOptions)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'tenants'
        AND column_name = 'service_options'
    ) THEN
        ALTER TABLE public.tenants ADD COLUMN service_options JSONB DEFAULT '{
            "dine_in_enabled": true,
            "pickup_enabled": true,
            "delivery_enabled": false,
            "reservations_enabled": true,
            "catering_enabled": false,
            "delivery_config": {
                "provider": "internal",
                "max_radius_km": 5,
                "minimum_order_amount": 0,
                "delivery_fee": 0,
                "estimated_time_minutes": 30,
                "delivery_zones": []
            },
            "pickup_config": {
                "min_preparation_time": 15,
                "time_slots_enabled": false,
                "slot_duration_minutes": 15,
                "pickup_instructions": null
            }
        }'::jsonb;

        COMMENT ON COLUMN public.tenants.service_options IS
        'Opciones de servicio del negocio (TenantServiceOptions).
        SINCRONIZADO CON: src/shared/types/unified-assistant-types.ts

        Estructura:
        - dine_in_enabled: boolean
        - pickup_enabled: boolean
        - delivery_enabled: boolean
        - reservations_enabled: boolean
        - catering_enabled: boolean
        - delivery_config: {provider, max_radius_km, minimum_order_amount, delivery_fee, estimated_time_minutes, delivery_zones}
        - pickup_config: {min_preparation_time, time_slots_enabled, slot_duration_minutes, pickup_instructions}';

        RAISE NOTICE 'Columna service_options agregada a tenants';
    ELSE
        RAISE NOTICE 'Columna service_options ya existe en tenants';
    END IF;
END $$;

-- =====================================================
-- PASO 2: ACTUALIZAR VOICE_ASSISTANT_TYPES - REST_STANDARD
-- Agregar capacidades de pedidos pickup
-- =====================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.voice_assistant_types WHERE name = 'rest_standard') THEN
        UPDATE public.voice_assistant_types
        SET
            display_name = 'Reservaciones + Menu',
            description = 'Asistente para reservaciones, consultas de menu, precios, recomendaciones y pedidos para recoger en sucursal.',
            enabled_capabilities = '["reservations", "orders", "menu_info", "recommendations", "business_hours", "location_info"]'::jsonb,
            available_tools = '[
                {
                    "name": "check_availability",
                    "description": "Verificar disponibilidad para reservacion",
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
                    "name": "get_menu",
                    "description": "Obtener menu del restaurante",
                    "parameters": {
                        "category": "string (optional)"
                    },
                    "requires_confirmation": false
                },
                {
                    "name": "search_menu",
                    "description": "Buscar platillos en el menu",
                    "parameters": {
                        "query": "string",
                        "filters": "object (optional)"
                    },
                    "requires_confirmation": false
                },
                {
                    "name": "get_recommendations",
                    "description": "Obtener recomendaciones de platillos",
                    "parameters": {
                        "preferences": "string (optional)",
                        "occasion": "string (optional)"
                    },
                    "requires_confirmation": false
                },
                {
                    "name": "create_order",
                    "description": "Crear un pedido para recoger en sucursal",
                    "parameters": {
                        "customer_name": "string",
                        "customer_phone": "string",
                        "items": "array of {item_id, quantity, notes}",
                        "pickup_time": "string (HH:MM)",
                        "special_instructions": "string (optional)"
                    },
                    "requires_confirmation": true
                },
                {
                    "name": "get_order_status",
                    "description": "Consultar estado de un pedido",
                    "parameters": {
                        "order_id": "string (optional)",
                        "phone": "string (optional)"
                    },
                    "requires_confirmation": false
                },
                {
                    "name": "get_business_hours",
                    "description": "Obtener horarios del restaurante",
                    "parameters": {},
                    "requires_confirmation": false
                },
                {
                    "name": "transfer_to_human",
                    "description": "Transferir la llamada a un humano",
                    "parameters": {
                        "reason": "string"
                    },
                    "requires_confirmation": true
                }
            ]'::jsonb,
            updated_at = NOW()
        WHERE name = 'rest_standard';

        RAISE NOTICE 'rest_standard actualizado con capacidades de pedidos pickup';
    ELSE
        RAISE NOTICE 'rest_standard no existe, sera creado en seed data';
    END IF;
END $$;

-- =====================================================
-- PASO 3: ELIMINAR DENTAL_BASIC Y MIGRAR A DENTAL_STANDARD
-- =====================================================

-- Primero migrar cualquier configuracion que use dental_basic
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voice_assistant_configs') THEN
        -- Actualizar configuraciones que usen dental_basic
        UPDATE public.voice_assistant_configs
        SET assistant_type_id = (
            SELECT id FROM public.voice_assistant_types WHERE name = 'dental_standard' LIMIT 1
        )
        WHERE assistant_type_id IN (
            SELECT id FROM public.voice_assistant_types WHERE name = 'dental_basic'
        );

        RAISE NOTICE 'Configuraciones migradas de dental_basic a dental_standard';
    END IF;
END $$;

-- Desactivar dental_basic (no eliminar para preservar historial)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.voice_assistant_types WHERE name = 'dental_basic') THEN
        UPDATE public.voice_assistant_types
        SET
            is_active = false,
            description = '[DEPRECATED] Migrado a dental_standard. ' || COALESCE(description, ''),
            updated_at = NOW()
        WHERE name = 'dental_basic';

        RAISE NOTICE 'dental_basic marcado como inactivo (deprecated)';
    END IF;
END $$;

-- Actualizar dental_standard con capacidades fusionadas
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.voice_assistant_types WHERE name = 'dental_standard') THEN
        UPDATE public.voice_assistant_types
        SET
            display_name = 'Citas + Servicios',
            description = 'Asistente para citas, horarios, informacion de tratamientos, precios, doctores y preguntas frecuentes.',
            enabled_capabilities = '["appointments", "services_info", "pricing", "dentist_info", "faq", "business_hours", "location_info"]'::jsonb,
            available_tools = '[
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
                    "name": "search_faq",
                    "description": "Buscar en preguntas frecuentes",
                    "parameters": {
                        "query": "string"
                    },
                    "requires_confirmation": false
                },
                {
                    "name": "get_business_hours",
                    "description": "Obtener horarios de la clinica",
                    "parameters": {},
                    "requires_confirmation": false
                },
                {
                    "name": "transfer_to_human",
                    "description": "Transferir la llamada a recepcion",
                    "parameters": {
                        "reason": "string"
                    },
                    "requires_confirmation": true
                }
            ]'::jsonb,
            display_order = 1,
            updated_at = NOW()
        WHERE name = 'dental_standard';

        RAISE NOTICE 'dental_standard actualizado con capacidades fusionadas';
    END IF;
END $$;

-- Actualizar display_order de dental_complete
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.voice_assistant_types WHERE name = 'dental_complete') THEN
        UPDATE public.voice_assistant_types
        SET
            display_order = 2,
            updated_at = NOW()
        WHERE name = 'dental_complete';

        RAISE NOTICE 'dental_complete display_order actualizado a 2';
    END IF;
END $$;

-- =====================================================
-- PASO 4: AGREGAR COLUMNAS ADICIONALES A VOICE_ASSISTANT_TYPES
-- =====================================================

-- Agregar columna tier si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'voice_assistant_types'
        AND column_name = 'tier'
    ) THEN
        ALTER TABLE public.voice_assistant_types
        ADD COLUMN tier VARCHAR(20) CHECK (tier IN ('basic', 'standard', 'complete'));

        -- Actualizar tiers existentes
        UPDATE public.voice_assistant_types SET tier = 'basic' WHERE name LIKE '%_basic';
        UPDATE public.voice_assistant_types SET tier = 'standard' WHERE name LIKE '%_standard';
        UPDATE public.voice_assistant_types SET tier = 'complete' WHERE name LIKE '%_complete';

        RAISE NOTICE 'Columna tier agregada a voice_assistant_types';
    ELSE
        RAISE NOTICE 'Columna tier ya existe en voice_assistant_types';
    END IF;
END $$;

-- Agregar columna is_recommended si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'voice_assistant_types'
        AND column_name = 'is_recommended'
    ) THEN
        ALTER TABLE public.voice_assistant_types
        ADD COLUMN is_recommended BOOLEAN DEFAULT false;

        -- Marcar standard como recomendado
        UPDATE public.voice_assistant_types SET is_recommended = true WHERE tier = 'standard';

        RAISE NOTICE 'Columna is_recommended agregada a voice_assistant_types';
    ELSE
        RAISE NOTICE 'Columna is_recommended ya existe en voice_assistant_types';
    END IF;
END $$;

-- Agregar columna icon si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'voice_assistant_types'
        AND column_name = 'icon'
    ) THEN
        ALTER TABLE public.voice_assistant_types
        ADD COLUMN icon VARCHAR(50);

        -- Actualizar iconos
        UPDATE public.voice_assistant_types SET icon = 'calendar' WHERE name = 'rest_basic';
        UPDATE public.voice_assistant_types SET icon = 'utensils' WHERE name = 'rest_standard';
        UPDATE public.voice_assistant_types SET icon = 'star' WHERE name = 'rest_complete';
        UPDATE public.voice_assistant_types SET icon = 'calendar-check' WHERE name = 'dental_standard';
        UPDATE public.voice_assistant_types SET icon = 'star' WHERE name = 'dental_complete';

        RAISE NOTICE 'Columna icon agregada a voice_assistant_types';
    ELSE
        RAISE NOTICE 'Columna icon ya existe en voice_assistant_types';
    END IF;
END $$;

-- Agregar columna badge_text si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'voice_assistant_types'
        AND column_name = 'badge_text'
    ) THEN
        ALTER TABLE public.voice_assistant_types
        ADD COLUMN badge_text VARCHAR(50);

        -- Actualizar badges
        UPDATE public.voice_assistant_types SET badge_text = 'Recomendado' WHERE is_recommended = true;
        UPDATE public.voice_assistant_types SET badge_text = 'Completo' WHERE tier = 'complete';

        RAISE NOTICE 'Columna badge_text agregada a voice_assistant_types';
    ELSE
        RAISE NOTICE 'Columna badge_text ya existe en voice_assistant_types';
    END IF;
END $$;

-- =====================================================
-- PASO 5: CREAR TABLA MESSAGING_ASSISTANT_TYPES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.messaging_assistant_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificador unico del tipo (inmutable, igual que voice)
    name VARCHAR(50) NOT NULL UNIQUE,

    -- Nombre para mostrar en UI
    display_name VARCHAR(100) NOT NULL,

    -- Descripcion del tipo de asistente
    description TEXT,

    -- Vertical (industria)
    vertical VARCHAR(50) NOT NULL CHECK (vertical IN (
        'restaurant',
        'dental',
        'medical',
        'general'
    )),

    -- Tier/nivel de funcionalidad
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('basic', 'standard', 'complete')),

    -- Capacidades habilitadas para este tipo
    enabled_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Tools disponibles para este tipo de asistente
    available_tools JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Configuracion por defecto
    default_personality VARCHAR(50) DEFAULT 'professional_friendly' CHECK (default_personality IN (
        'professional',
        'professional_friendly',
        'formal'
    )),

    -- Template de prompt a usar
    prompt_template_name VARCHAR(100) NOT NULL,

    -- Version del template
    template_version INTEGER DEFAULT 1,

    -- Estado
    is_active BOOLEAN DEFAULT true,
    is_recommended BOOLEAN DEFAULT false,

    -- UI metadata
    display_order INTEGER DEFAULT 0,
    icon VARCHAR(50),
    badge_text VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para messaging_assistant_types
CREATE INDEX IF NOT EXISTS idx_messaging_assistant_types_vertical
    ON public.messaging_assistant_types(vertical);

CREATE INDEX IF NOT EXISTS idx_messaging_assistant_types_tier
    ON public.messaging_assistant_types(tier);

CREATE INDEX IF NOT EXISTS idx_messaging_assistant_types_active
    ON public.messaging_assistant_types(is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_messaging_assistant_types_vertical_active
    ON public.messaging_assistant_types(vertical, is_active)
    WHERE is_active = true;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_messaging_assistant_types_updated_at ON public.messaging_assistant_types;
CREATE TRIGGER update_messaging_assistant_types_updated_at
    BEFORE UPDATE ON public.messaging_assistant_types
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para messaging_assistant_types
ALTER TABLE public.messaging_assistant_types ENABLE ROW LEVEL SECURITY;

-- Policy: Todos pueden leer tipos activos (tabla de catalogo global)
DROP POLICY IF EXISTS "messaging_assistant_types_select_policy" ON public.messaging_assistant_types;
CREATE POLICY "messaging_assistant_types_select_policy"
    ON public.messaging_assistant_types
    FOR SELECT
    USING (is_active = true);

-- Policy: Solo service role puede modificar
DROP POLICY IF EXISTS "messaging_assistant_types_service_role_policy" ON public.messaging_assistant_types;
CREATE POLICY "messaging_assistant_types_service_role_policy"
    ON public.messaging_assistant_types
    FOR ALL
    USING (current_setting('role', true) = 'service_role')
    WITH CHECK (current_setting('role', true) = 'service_role');

COMMENT ON TABLE public.messaging_assistant_types IS
'Catalogo de tipos de asistente para canal de mensajeria (WhatsApp, Instagram, etc).
Unificado con voice_assistant_types para garantizar consistencia entre canales.

Tipos por vertical:
- RESTAURANT: rest_basic, rest_standard (recomendado), rest_complete
- DENTAL: dental_standard (recomendado), dental_complete

Nota: El tipo dental_basic fue eliminado por ser demasiado limitado.';

-- =====================================================
-- PASO 6: SEED DATA PARA MESSAGING_ASSISTANT_TYPES
-- =====================================================

-- Restaurant Basic
INSERT INTO public.messaging_assistant_types (
    name, display_name, description, vertical, tier,
    enabled_capabilities, available_tools,
    default_personality, prompt_template_name, template_version,
    is_active, is_recommended, display_order, icon, badge_text
) VALUES (
    'rest_basic',
    'Reservaciones',
    'Asistente basico para manejo de reservaciones de mesa y consultas de horarios.',
    'restaurant',
    'basic',
    '["reservations", "business_hours", "location_info"]'::jsonb,
    '[
        {"name": "check_reservation_availability", "description": "Verificar disponibilidad para reservacion"},
        {"name": "create_reservation", "description": "Crear nueva reservacion"},
        {"name": "modify_reservation", "description": "Modificar reservacion existente"},
        {"name": "cancel_reservation", "description": "Cancelar reservacion"},
        {"name": "get_business_hours", "description": "Consultar horarios"},
        {"name": "get_business_info", "description": "Informacion del negocio"},
        {"name": "transfer_to_human", "description": "Transferir a humano"}
    ]'::jsonb,
    'professional_friendly',
    'rest_basic',
    1,
    true,
    false,
    1,
    'calendar',
    NULL
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    enabled_capabilities = EXCLUDED.enabled_capabilities,
    available_tools = EXCLUDED.available_tools,
    is_recommended = EXCLUDED.is_recommended,
    display_order = EXCLUDED.display_order,
    icon = EXCLUDED.icon,
    badge_text = EXCLUDED.badge_text,
    updated_at = NOW();

-- Restaurant Standard
INSERT INTO public.messaging_assistant_types (
    name, display_name, description, vertical, tier,
    enabled_capabilities, available_tools,
    default_personality, prompt_template_name, template_version,
    is_active, is_recommended, display_order, icon, badge_text
) VALUES (
    'rest_standard',
    'Reservaciones + Menu',
    'Asistente para reservaciones, consultas de menu, precios, recomendaciones y pedidos para recoger en sucursal.',
    'restaurant',
    'standard',
    '["reservations", "orders", "menu_info", "recommendations", "business_hours", "location_info"]'::jsonb,
    '[
        {"name": "check_reservation_availability", "description": "Verificar disponibilidad para reservacion"},
        {"name": "create_reservation", "description": "Crear nueva reservacion"},
        {"name": "modify_reservation", "description": "Modificar reservacion existente"},
        {"name": "cancel_reservation", "description": "Cancelar reservacion"},
        {"name": "get_menu", "description": "Obtener menu completo o por categoria"},
        {"name": "search_menu", "description": "Buscar platillos especificos"},
        {"name": "get_recommendations", "description": "Obtener recomendaciones"},
        {"name": "create_order", "description": "Crear pedido para recoger"},
        {"name": "get_order_status", "description": "Consultar estado de pedido"},
        {"name": "get_business_hours", "description": "Consultar horarios"},
        {"name": "get_business_info", "description": "Informacion del negocio"},
        {"name": "get_promotions", "description": "Promociones activas"},
        {"name": "transfer_to_human", "description": "Transferir a humano"}
    ]'::jsonb,
    'professional_friendly',
    'rest_standard',
    1,
    true,
    true,
    2,
    'utensils',
    'Recomendado'
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    enabled_capabilities = EXCLUDED.enabled_capabilities,
    available_tools = EXCLUDED.available_tools,
    is_recommended = EXCLUDED.is_recommended,
    display_order = EXCLUDED.display_order,
    icon = EXCLUDED.icon,
    badge_text = EXCLUDED.badge_text,
    updated_at = NOW();

-- Restaurant Complete
INSERT INTO public.messaging_assistant_types (
    name, display_name, description, vertical, tier,
    enabled_capabilities, available_tools,
    default_personality, prompt_template_name, template_version,
    is_active, is_recommended, display_order, icon, badge_text
) VALUES (
    'rest_complete',
    'Servicio Completo',
    'Asistente completo: reservaciones, menu, pedidos pickup, delivery (si habilitado), promociones y captura de leads.',
    'restaurant',
    'complete',
    '["reservations", "orders", "delivery", "menu_info", "recommendations", "promotions", "leads", "faq", "human_transfer", "business_hours", "location_info"]'::jsonb,
    '[
        {"name": "check_reservation_availability", "description": "Verificar disponibilidad para reservacion"},
        {"name": "create_reservation", "description": "Crear nueva reservacion"},
        {"name": "modify_reservation", "description": "Modificar reservacion existente"},
        {"name": "cancel_reservation", "description": "Cancelar reservacion"},
        {"name": "get_menu", "description": "Obtener menu completo o por categoria"},
        {"name": "search_menu", "description": "Buscar platillos especificos"},
        {"name": "get_recommendations", "description": "Obtener recomendaciones"},
        {"name": "create_order", "description": "Crear pedido para recoger o delivery"},
        {"name": "modify_order", "description": "Modificar pedido existente"},
        {"name": "cancel_order", "description": "Cancelar pedido"},
        {"name": "get_order_status", "description": "Consultar estado de pedido"},
        {"name": "calculate_delivery_time", "description": "Calcular tiempo y costo de delivery"},
        {"name": "get_business_hours", "description": "Consultar horarios"},
        {"name": "get_business_info", "description": "Informacion del negocio"},
        {"name": "get_promotions", "description": "Promociones activas"},
        {"name": "capture_lead", "description": "Capturar informacion de lead"},
        {"name": "handle_objection", "description": "Manejar objeciones de venta"},
        {"name": "transfer_to_human", "description": "Transferir a humano"}
    ]'::jsonb,
    'professional_friendly',
    'rest_complete',
    1,
    true,
    false,
    3,
    'star',
    'Completo'
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    enabled_capabilities = EXCLUDED.enabled_capabilities,
    available_tools = EXCLUDED.available_tools,
    is_recommended = EXCLUDED.is_recommended,
    display_order = EXCLUDED.display_order,
    icon = EXCLUDED.icon,
    badge_text = EXCLUDED.badge_text,
    updated_at = NOW();

-- Dental Standard (fusiona basic + standard original)
INSERT INTO public.messaging_assistant_types (
    name, display_name, description, vertical, tier,
    enabled_capabilities, available_tools,
    default_personality, prompt_template_name, template_version,
    is_active, is_recommended, display_order, icon, badge_text
) VALUES (
    'dental_standard',
    'Citas + Servicios',
    'Asistente para citas, horarios, informacion de tratamientos, precios, doctores y preguntas frecuentes.',
    'dental',
    'standard',
    '["appointments", "services_info", "pricing", "dentist_info", "faq", "business_hours", "location_info"]'::jsonb,
    '[
        {"name": "check_appointment_availability", "description": "Verificar disponibilidad de citas"},
        {"name": "create_appointment", "description": "Agendar nueva cita"},
        {"name": "modify_appointment", "description": "Modificar cita existente"},
        {"name": "cancel_appointment", "description": "Cancelar cita"},
        {"name": "get_services", "description": "Listar servicios disponibles"},
        {"name": "get_service_info", "description": "Informacion detallada de un servicio"},
        {"name": "get_service_prices", "description": "Precios de servicios"},
        {"name": "get_doctors", "description": "Listar doctores"},
        {"name": "get_doctor_info", "description": "Informacion de un doctor especifico"},
        {"name": "get_business_hours", "description": "Consultar horarios"},
        {"name": "get_business_info", "description": "Informacion de la clinica"},
        {"name": "get_faq", "description": "Preguntas frecuentes"},
        {"name": "transfer_to_human", "description": "Transferir a recepcion"}
    ]'::jsonb,
    'professional_friendly',
    'dental_standard',
    1,
    true,
    true,
    1,
    'calendar-check',
    'Recomendado'
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    enabled_capabilities = EXCLUDED.enabled_capabilities,
    available_tools = EXCLUDED.available_tools,
    is_recommended = EXCLUDED.is_recommended,
    display_order = EXCLUDED.display_order,
    icon = EXCLUDED.icon,
    badge_text = EXCLUDED.badge_text,
    updated_at = NOW();

-- Dental Complete
INSERT INTO public.messaging_assistant_types (
    name, display_name, description, vertical, tier,
    enabled_capabilities, available_tools,
    default_personality, prompt_template_name, template_version,
    is_active, is_recommended, display_order, icon, badge_text
) VALUES (
    'dental_complete',
    'Servicio Completo',
    'Asistente completo: citas, servicios, manejo de seguros, urgencias, captura de leads y manejo de objeciones.',
    'dental',
    'complete',
    '["appointments", "services_info", "pricing", "dentist_info", "faq", "insurance_info", "emergency_triage", "leads", "human_transfer", "business_hours", "location_info"]'::jsonb,
    '[
        {"name": "check_appointment_availability", "description": "Verificar disponibilidad de citas"},
        {"name": "create_appointment", "description": "Agendar nueva cita"},
        {"name": "modify_appointment", "description": "Modificar cita existente"},
        {"name": "cancel_appointment", "description": "Cancelar cita"},
        {"name": "get_services", "description": "Listar servicios disponibles"},
        {"name": "get_service_info", "description": "Informacion detallada de un servicio"},
        {"name": "get_service_prices", "description": "Precios de servicios"},
        {"name": "get_doctors", "description": "Listar doctores"},
        {"name": "get_doctor_info", "description": "Informacion de un doctor especifico"},
        {"name": "get_insurance_info", "description": "Informacion de seguros aceptados"},
        {"name": "check_insurance_coverage", "description": "Verificar cobertura de seguro"},
        {"name": "handle_emergency", "description": "Manejar solicitudes de emergencia"},
        {"name": "get_business_hours", "description": "Consultar horarios"},
        {"name": "get_business_info", "description": "Informacion de la clinica"},
        {"name": "get_faq", "description": "Preguntas frecuentes"},
        {"name": "capture_lead", "description": "Capturar informacion de lead"},
        {"name": "handle_objection", "description": "Manejar objeciones"},
        {"name": "send_reminder", "description": "Enviar recordatorio"},
        {"name": "transfer_to_human", "description": "Transferir a recepcion"}
    ]'::jsonb,
    'professional_friendly',
    'dental_complete',
    1,
    true,
    false,
    2,
    'star',
    'Completo'
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    enabled_capabilities = EXCLUDED.enabled_capabilities,
    available_tools = EXCLUDED.available_tools,
    is_recommended = EXCLUDED.is_recommended,
    display_order = EXCLUDED.display_order,
    icon = EXCLUDED.icon,
    badge_text = EXCLUDED.badge_text,
    updated_at = NOW();

-- =====================================================
-- PASO 7: CREAR FUNCION GET_UNIFIED_ASSISTANT_TYPES
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_unified_assistant_types(
    p_vertical VARCHAR DEFAULT NULL,
    p_channel VARCHAR DEFAULT 'both' -- 'voice', 'messaging', 'both'
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    display_name VARCHAR,
    description TEXT,
    vertical VARCHAR,
    tier VARCHAR,
    enabled_capabilities JSONB,
    available_tools JSONB,
    default_personality VARCHAR,
    prompt_template_name VARCHAR,
    is_active BOOLEAN,
    is_recommended BOOLEAN,
    display_order INTEGER,
    icon VARCHAR,
    badge_text VARCHAR,
    available_channels TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH voice_types AS (
        SELECT
            vat.id,
            vat.name,
            vat.display_name,
            vat.description,
            vat.vertical,
            vat.tier,
            vat.enabled_capabilities,
            vat.available_tools,
            vat.default_personality,
            vat.prompt_template_name,
            vat.is_active,
            COALESCE(vat.is_recommended, false) as is_recommended,
            vat.display_order,
            vat.icon,
            vat.badge_text,
            'voice'::TEXT as channel
        FROM public.voice_assistant_types vat
        WHERE vat.is_active = true
          AND (p_vertical IS NULL OR vat.vertical = p_vertical)
          AND (p_channel IN ('voice', 'both'))
    ),
    messaging_types AS (
        SELECT
            mat.id,
            mat.name,
            mat.display_name,
            mat.description,
            mat.vertical,
            mat.tier,
            mat.enabled_capabilities,
            mat.available_tools,
            mat.default_personality,
            mat.prompt_template_name,
            mat.is_active,
            mat.is_recommended,
            mat.display_order,
            mat.icon,
            mat.badge_text,
            'messaging'::TEXT as channel
        FROM public.messaging_assistant_types mat
        WHERE mat.is_active = true
          AND (p_vertical IS NULL OR mat.vertical = p_vertical)
          AND (p_channel IN ('messaging', 'both'))
    ),
    combined AS (
        SELECT * FROM voice_types
        UNION ALL
        SELECT * FROM messaging_types
    )
    SELECT
        c.id,
        c.name,
        c.display_name,
        c.description,
        c.vertical,
        c.tier,
        c.enabled_capabilities,
        c.available_tools,
        c.default_personality,
        c.prompt_template_name,
        c.is_active,
        c.is_recommended,
        c.display_order,
        c.icon,
        c.badge_text,
        array_agg(DISTINCT c.channel ORDER BY c.channel) as available_channels
    FROM combined c
    GROUP BY
        c.id, c.name, c.display_name, c.description, c.vertical, c.tier,
        c.enabled_capabilities, c.available_tools, c.default_personality,
        c.prompt_template_name, c.is_active, c.is_recommended,
        c.display_order, c.icon, c.badge_text
    ORDER BY c.vertical, c.display_order;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.get_unified_assistant_types TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_assistant_types TO service_role;

COMMENT ON FUNCTION public.get_unified_assistant_types IS
'Retorna los tipos de asistente unificados entre Voice y Messaging.
Parametros:
- p_vertical: Filtrar por vertical (restaurant, dental, etc.) o NULL para todos
- p_channel: Filtrar por canal (voice, messaging, both)

Uso:
  SELECT * FROM get_unified_assistant_types(''restaurant'', ''both'');
  SELECT * FROM get_unified_assistant_types(NULL, ''messaging'');';

-- =====================================================
-- PASO 8: CREAR FUNCION GET_ASSISTANT_TYPE_BY_KEY
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_assistant_type_by_key(
    p_type_key VARCHAR,
    p_channel VARCHAR DEFAULT 'messaging' -- 'voice' o 'messaging'
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    display_name VARCHAR,
    description TEXT,
    vertical VARCHAR,
    tier VARCHAR,
    enabled_capabilities JSONB,
    available_tools JSONB,
    default_personality VARCHAR,
    prompt_template_name VARCHAR,
    is_recommended BOOLEAN,
    icon VARCHAR,
    badge_text VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_channel = 'voice' THEN
        RETURN QUERY
        SELECT
            vat.id,
            vat.name,
            vat.display_name,
            vat.description,
            vat.vertical,
            vat.tier,
            vat.enabled_capabilities,
            vat.available_tools,
            vat.default_personality,
            vat.prompt_template_name,
            COALESCE(vat.is_recommended, false),
            vat.icon,
            vat.badge_text
        FROM public.voice_assistant_types vat
        WHERE vat.name = p_type_key AND vat.is_active = true;
    ELSE
        RETURN QUERY
        SELECT
            mat.id,
            mat.name,
            mat.display_name,
            mat.description,
            mat.vertical,
            mat.tier,
            mat.enabled_capabilities,
            mat.available_tools,
            mat.default_personality,
            mat.prompt_template_name,
            mat.is_recommended,
            mat.icon,
            mat.badge_text
        FROM public.messaging_assistant_types mat
        WHERE mat.name = p_type_key AND mat.is_active = true;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_assistant_type_by_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assistant_type_by_key TO service_role;

COMMENT ON FUNCTION public.get_assistant_type_by_key IS
'Obtiene un tipo de asistente por su key (name) y canal.
Uso: SELECT * FROM get_assistant_type_by_key(''rest_standard'', ''messaging'');';

-- =====================================================
-- PASO 9: VERIFICACION DE MIGRACION
-- =====================================================

DO $$
DECLARE
    v_voice_count INTEGER;
    v_messaging_count INTEGER;
    v_dental_basic_active BOOLEAN;
BEGIN
    -- Contar tipos de voz activos
    SELECT COUNT(*) INTO v_voice_count
    FROM public.voice_assistant_types
    WHERE is_active = true;

    -- Contar tipos de messaging
    SELECT COUNT(*) INTO v_messaging_count
    FROM public.messaging_assistant_types
    WHERE is_active = true;

    -- Verificar que dental_basic esta inactivo
    SELECT is_active INTO v_dental_basic_active
    FROM public.voice_assistant_types
    WHERE name = 'dental_basic';

    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'VERIFICACION MIGRACION 155 - UNIFIED ASSISTANT TYPES';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Voice assistant types activos: %', v_voice_count;
    RAISE NOTICE 'Messaging assistant types activos: %', v_messaging_count;
    RAISE NOTICE 'dental_basic activo: %', COALESCE(v_dental_basic_active::TEXT, 'NO EXISTE');
    RAISE NOTICE '=====================================================';

    -- Validaciones
    IF v_voice_count < 5 THEN
        RAISE WARNING 'Se esperaban al menos 5 tipos de voz activos, se encontraron %', v_voice_count;
    END IF;

    IF v_messaging_count < 5 THEN
        RAISE WARNING 'Se esperaban al menos 5 tipos de messaging, se encontraron %', v_messaging_count;
    END IF;

    IF v_dental_basic_active = true THEN
        RAISE WARNING 'dental_basic deberia estar inactivo pero esta activo';
    END IF;

    RAISE NOTICE 'Migracion 155 completada exitosamente';
END $$;

-- =====================================================
-- FIN MIGRACION 155
-- =====================================================

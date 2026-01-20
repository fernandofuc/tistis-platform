-- =====================================================
-- TIS TIS PLATFORM - VOICE AGENT v2.0
-- Migration: 142_VOICE_ASSISTANT_TYPES.sql
-- Date: January 2025
-- Version: 2.0
--
-- PURPOSE: Crear tabla de tipos de asistente de voz
-- para definir diferentes configuraciones segun vertical
-- (restaurant/dental) y nivel de funcionalidad.
--
-- PARTE DE: Voice Agent v2.0 - FASE 01 - MICROFASE 1.1
-- =====================================================

-- =====================================================
-- TABLA: voice_assistant_types
-- Define los tipos de asistente disponibles por vertical
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_assistant_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificador unico del tipo (inmutable)
    name VARCHAR(50) NOT NULL UNIQUE,

    -- Nombre para mostrar en UI
    display_name VARCHAR(100) NOT NULL,

    -- Descripcion del tipo de asistente
    description TEXT,

    -- Vertical (industria)
    vertical VARCHAR(50) NOT NULL CHECK (vertical IN (
        'restaurant',
        'dental',
        'generic'
    )),

    -- Capacidades habilitadas para este tipo
    -- Ejemplos: reservations, orders, appointments, faq, human_transfer
    enabled_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Tools disponibles para este tipo de asistente
    -- Cada tool tiene: name, description, requires_confirmation
    available_tools JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Configuracion de voz por defecto
    default_voice_id VARCHAR(100),

    -- Personalidad por defecto
    default_personality VARCHAR(50) DEFAULT 'professional_friendly' CHECK (default_personality IN (
        'professional',
        'professional_friendly',
        'casual',
        'formal',
        'warm',
        'energetic'
    )),

    -- Template de prompt a usar (referencia a sistema de templates)
    prompt_template_name VARCHAR(100) NOT NULL,

    -- Version del template
    template_version INTEGER DEFAULT 1,

    -- Duracion maxima de llamada en segundos
    max_call_duration_seconds INTEGER DEFAULT 600 CHECK (
        max_call_duration_seconds >= 60 AND
        max_call_duration_seconds <= 1800
    ),

    -- Estado activo
    is_active BOOLEAN DEFAULT true,

    -- Orden de display en UI
    display_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDICES
-- =====================================================

-- Indice por vertical para filtrar tipos por industria
CREATE INDEX idx_voice_assistant_types_vertical
    ON public.voice_assistant_types(vertical);

-- Indice por estado activo
CREATE INDEX idx_voice_assistant_types_active
    ON public.voice_assistant_types(is_active)
    WHERE is_active = true;

-- Indice por nombre para busquedas rapidas
CREATE INDEX idx_voice_assistant_types_name
    ON public.voice_assistant_types(name);

-- Indice compuesto para queries comunes
CREATE INDEX idx_voice_assistant_types_vertical_active
    ON public.voice_assistant_types(vertical, is_active)
    WHERE is_active = true;

-- =====================================================
-- TRIGGER: Actualizar updated_at automaticamente
-- =====================================================

CREATE TRIGGER update_voice_assistant_types_updated_at
    BEFORE UPDATE ON public.voice_assistant_types
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.voice_assistant_types ENABLE ROW LEVEL SECURITY;

-- Policy: Todos pueden leer tipos activos (tabla de configuracion global)
-- Esta es una tabla de catatalogo, no contiene datos sensibles de tenant
CREATE POLICY "voice_assistant_types_select_policy"
    ON public.voice_assistant_types
    FOR SELECT
    USING (is_active = true);

-- Policy: Solo admin del sistema puede insertar/actualizar/eliminar
-- (se maneja via service role, no usuarios directos)
CREATE POLICY "voice_assistant_types_admin_all"
    ON public.voice_assistant_types
    FOR ALL
    USING (
        -- Solo permite via service role (backend)
        current_setting('role', true) = 'service_role'
    )
    WITH CHECK (
        current_setting('role', true) = 'service_role'
    );

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE public.voice_assistant_types IS
'Catalogo de tipos de asistente de voz disponibles. Define las capacidades, tools y configuracion por defecto para cada tipo de asistente segun la vertical (restaurant, dental).';

COMMENT ON COLUMN public.voice_assistant_types.name IS
'Identificador unico del tipo (ej: rest_basic, dental_complete). Usado internamente.';

COMMENT ON COLUMN public.voice_assistant_types.enabled_capabilities IS
'Array JSON de capacidades habilitadas. Ej: ["reservations", "orders", "faq"]';

COMMENT ON COLUMN public.voice_assistant_types.available_tools IS
'Array JSON de tools disponibles con schema: [{name, description, parameters, requires_confirmation}]';

COMMENT ON COLUMN public.voice_assistant_types.prompt_template_name IS
'Nombre del template Handlebars a usar para generar el system prompt.';

-- =====================================================
-- VALIDACION
-- =====================================================

-- Funcion para validar estructura de capabilities
CREATE OR REPLACE FUNCTION validate_voice_assistant_type_capabilities()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar que enabled_capabilities sea un array JSON
    IF jsonb_typeof(NEW.enabled_capabilities) != 'array' THEN
        RAISE EXCEPTION 'enabled_capabilities debe ser un array JSON';
    END IF;

    -- Validar que available_tools sea un array JSON
    IF jsonb_typeof(NEW.available_tools) != 'array' THEN
        RAISE EXCEPTION 'available_tools debe ser un array JSON';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_voice_assistant_type_before_insert_update
    BEFORE INSERT OR UPDATE ON public.voice_assistant_types
    FOR EACH ROW
    EXECUTE FUNCTION validate_voice_assistant_type_capabilities();

-- =====================================================
-- FIN MIGRACION 142
-- =====================================================

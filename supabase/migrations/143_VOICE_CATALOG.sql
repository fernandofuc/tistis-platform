-- =====================================================
-- TIS TIS PLATFORM - VOICE AGENT v2.0
-- Migration: 143_VOICE_CATALOG.sql
-- Date: January 2025
-- Version: 2.0
--
-- PURPOSE: Crear catalogo de voces disponibles
-- para la seleccion de voz del asistente.
-- Soporta multiples proveedores (ElevenLabs, Azure, etc.)
--
-- PARTE DE: Voice Agent v2.0 - FASE 01 - MICROFASE 1.2
-- =====================================================

-- =====================================================
-- TABLA: voice_catalog
-- Catalogo de voces disponibles por proveedor
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Proveedor de la voz
    provider VARCHAR(50) NOT NULL CHECK (provider IN (
        'elevenlabs',
        'azure',
        'google',
        'openai',
        'deepgram'
    )),

    -- ID de la voz en el proveedor
    voice_id VARCHAR(100) NOT NULL,

    -- Nombre interno (para referencia en codigo)
    name VARCHAR(100) NOT NULL,

    -- Nombre para mostrar en UI
    display_name VARCHAR(100) NOT NULL,

    -- Genero de la voz
    gender VARCHAR(20) NOT NULL CHECK (gender IN (
        'male',
        'female',
        'neutral'
    )),

    -- Acento/variante regional
    accent VARCHAR(50) DEFAULT 'neutral',

    -- Idioma principal
    language VARCHAR(10) NOT NULL DEFAULT 'es',

    -- Idiomas soportados adicionales
    supported_languages TEXT[] DEFAULT ARRAY['es'],

    -- Tags de personalidad para matching
    -- Ejemplos: ["calida", "profesional", "energetica", "calmada"]
    personality_tags JSONB DEFAULT '[]'::jsonb,

    -- URL de preview de la voz (audio sample)
    preview_url TEXT,

    -- Costo por minuto en USD (para calculo de billing)
    cost_per_minute DECIMAL(10,4) DEFAULT 0.0000,

    -- Configuracion de voz recomendada por proveedor
    recommended_settings JSONB DEFAULT '{}'::jsonb,

    -- Velocidad por defecto (1.0 = normal)
    default_speed DECIMAL(3,2) DEFAULT 1.00 CHECK (
        default_speed >= 0.5 AND default_speed <= 2.0
    ),

    -- Estabilidad por defecto (solo ElevenLabs)
    default_stability DECIMAL(3,2) DEFAULT 0.50 CHECK (
        default_stability >= 0 AND default_stability <= 1
    ),

    -- Similarity boost (solo ElevenLabs)
    default_similarity_boost DECIMAL(3,2) DEFAULT 0.75 CHECK (
        default_similarity_boost >= 0 AND default_similarity_boost <= 1
    ),

    -- Verticales recomendadas para esta voz
    recommended_verticals TEXT[] DEFAULT ARRAY['restaurant', 'dental'],

    -- Orden de display en selector
    display_order INTEGER DEFAULT 0,

    -- Estado activo
    is_active BOOLEAN DEFAULT true,

    -- Es voz premium (requiere plan especial)
    is_premium BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: combinacion unica de provider + voice_id
    UNIQUE(provider, voice_id)
);

-- =====================================================
-- INDICES
-- =====================================================

-- Indice por proveedor
CREATE INDEX idx_voice_catalog_provider
    ON public.voice_catalog(provider);

-- Indice por idioma
CREATE INDEX idx_voice_catalog_language
    ON public.voice_catalog(language);

-- Indice por genero
CREATE INDEX idx_voice_catalog_gender
    ON public.voice_catalog(gender);

-- Indice por estado activo
CREATE INDEX idx_voice_catalog_active
    ON public.voice_catalog(is_active)
    WHERE is_active = true;

-- Indice compuesto para filtros comunes
CREATE INDEX idx_voice_catalog_provider_language_active
    ON public.voice_catalog(provider, language, is_active)
    WHERE is_active = true;

-- Indice GIN para busqueda en personality_tags
CREATE INDEX idx_voice_catalog_personality_tags
    ON public.voice_catalog USING GIN (personality_tags);

-- Indice para busqueda por verticales recomendadas
CREATE INDEX idx_voice_catalog_recommended_verticals
    ON public.voice_catalog USING GIN (recommended_verticals);

-- =====================================================
-- TRIGGER: Actualizar updated_at automaticamente
-- =====================================================

CREATE TRIGGER update_voice_catalog_updated_at
    BEFORE UPDATE ON public.voice_catalog
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.voice_catalog ENABLE ROW LEVEL SECURITY;

-- Policy: Todos pueden leer voces activas (tabla de catalogo global)
CREATE POLICY "voice_catalog_select_policy"
    ON public.voice_catalog
    FOR SELECT
    USING (is_active = true);

-- Policy: Solo admin del sistema puede modificar (via service role)
CREATE POLICY "voice_catalog_admin_all"
    ON public.voice_catalog
    FOR ALL
    USING (
        current_setting('role', true) = 'service_role'
    )
    WITH CHECK (
        current_setting('role', true) = 'service_role'
    );

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON TABLE public.voice_catalog IS
'Catalogo de voces disponibles para el Voice Agent. Incluye voces de ElevenLabs, Azure, Google y otros proveedores con sus configuraciones recomendadas.';

COMMENT ON COLUMN public.voice_catalog.voice_id IS
'ID de la voz en el proveedor. Para ElevenLabs es el voice_id, para Azure es el voice name.';

COMMENT ON COLUMN public.voice_catalog.personality_tags IS
'Tags de personalidad para ayudar en la seleccion. Ej: ["calida", "profesional", "mexicana"]';

COMMENT ON COLUMN public.voice_catalog.recommended_settings IS
'Configuracion recomendada especifica del proveedor. Ej: {"model": "eleven_turbo_v2_5", "style": 0}';

COMMENT ON COLUMN public.voice_catalog.cost_per_minute IS
'Costo por minuto en USD para calculo de billing interno.';

-- =====================================================
-- FUNCION: Buscar voces por criterios
-- =====================================================

CREATE OR REPLACE FUNCTION get_available_voices(
    p_provider VARCHAR DEFAULT NULL,
    p_language VARCHAR DEFAULT 'es',
    p_gender VARCHAR DEFAULT NULL,
    p_vertical VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    provider VARCHAR,
    voice_id VARCHAR,
    name VARCHAR,
    display_name VARCHAR,
    gender VARCHAR,
    accent VARCHAR,
    language VARCHAR,
    personality_tags JSONB,
    preview_url TEXT,
    recommended_settings JSONB,
    is_premium BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vc.id,
        vc.provider,
        vc.voice_id,
        vc.name,
        vc.display_name,
        vc.gender,
        vc.accent,
        vc.language,
        vc.personality_tags,
        vc.preview_url,
        vc.recommended_settings,
        vc.is_premium
    FROM public.voice_catalog vc
    WHERE vc.is_active = true
        AND (p_provider IS NULL OR vc.provider = p_provider)
        AND (p_language IS NULL OR vc.language = p_language OR p_language = ANY(vc.supported_languages))
        AND (p_gender IS NULL OR vc.gender = p_gender)
        AND (p_vertical IS NULL OR p_vertical = ANY(vc.recommended_verticals))
    ORDER BY vc.display_order, vc.display_name;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_available_voices IS
'Obtiene voces disponibles filtradas por proveedor, idioma, genero y vertical.';

-- =====================================================
-- FIN MIGRACION 143
-- =====================================================

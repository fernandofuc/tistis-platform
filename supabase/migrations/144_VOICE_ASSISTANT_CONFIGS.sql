-- =====================================================
-- TIS TIS PLATFORM - VOICE AGENT v2.0
-- Migration: 144_VOICE_ASSISTANT_CONFIGS.sql
-- Date: January 2025
-- Version: 2.0
--
-- PURPOSE: Crear tabla de configuraciones de asistente
-- por business/tenant. Esta es la tabla principal que
-- conecta tipos de asistente, voces y configuraciones
-- personalizadas por cliente.
--
-- PARTE DE: Voice Agent v2.0 - FASE 01 - MICROFASE 1.3
-- =====================================================

-- =====================================================
-- TABLA: voice_assistant_configs
-- Configuracion de asistente de voz por business
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_assistant_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relacion con tenant/business
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

    -- Tipo de asistente (FK a voice_assistant_types)
    assistant_type_id UUID NOT NULL REFERENCES public.voice_assistant_types(id) ON DELETE RESTRICT,

    -- Integracion con VAPI
    vapi_assistant_id VARCHAR(100), -- ID del asistente en VAPI (si aplica)
    vapi_squad_id VARCHAR(100),     -- ID del squad en VAPI (si aplica)

    -- Numero de telefono asignado
    phone_number_id UUID REFERENCES public.voice_phone_numbers(id) ON DELETE SET NULL,
    phone_number VARCHAR(20),       -- E.164 format: +526311234567

    -- Configuracion de voz
    voice_id UUID REFERENCES public.voice_catalog(id) ON DELETE SET NULL,
    voice_speed DECIMAL(3,2) DEFAULT 1.00 CHECK (
        voice_speed >= 0.5 AND voice_speed <= 2.0
    ),

    -- Personalidad (puede override el default del tipo)
    personality_type VARCHAR(50) DEFAULT 'professional_friendly' CHECK (personality_type IN (
        'professional',
        'professional_friendly',
        'casual',
        'formal',
        'warm',
        'energetic'
    )),

    -- Nombre del asistente para saludos
    assistant_name VARCHAR(100) DEFAULT 'Asistente',

    -- Instrucciones especiales del cliente
    -- Se agregan al prompt base del tipo de asistente
    special_instructions TEXT,

    -- Override de capacidades (JSONB, null = usar default del tipo)
    enabled_capabilities_override JSONB,

    -- Override de tools (JSONB, null = usar default del tipo)
    available_tools_override JSONB,

    -- Version del template de prompt
    template_version INTEGER DEFAULT 1,

    -- Configuracion de llamada
    max_call_duration_seconds INTEGER DEFAULT 600 CHECK (
        max_call_duration_seconds >= 60 AND max_call_duration_seconds <= 1800
    ),
    silence_timeout_seconds INTEGER DEFAULT 30 CHECK (
        silence_timeout_seconds >= 10 AND silence_timeout_seconds <= 60
    ),

    -- Configuracion de primer mensaje
    first_message TEXT,
    first_message_mode VARCHAR(30) DEFAULT 'assistant_speaks_first' CHECK (first_message_mode IN (
        'assistant_speaks_first',
        'wait_for_user'
    )),

    -- Frases de relleno para naturalidad
    filler_phrases TEXT[] DEFAULT ARRAY[
        'Mmm...',
        'Bueno...',
        'Claro...',
        'Dejame ver...',
        'Un momento...'
    ],
    use_filler_phrases BOOLEAN DEFAULT true,

    -- Frases para terminar llamada
    end_call_phrases TEXT[] DEFAULT ARRAY[
        'adios',
        'hasta luego',
        'gracias, bye',
        'eso es todo',
        'goodbye',
        'bye bye'
    ],

    -- Configuracion de grabacion
    recording_enabled BOOLEAN DEFAULT true,
    transcription_stored BOOLEAN DEFAULT true,

    -- Compliance
    hipaa_enabled BOOLEAN DEFAULT false,
    pci_enabled BOOLEAN DEFAULT false,

    -- Estado del asistente
    is_active BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft',          -- En configuracion
        'pending_review', -- Esperando revision
        'active',         -- Activo y funcionando
        'suspended',      -- Suspendido
        'error'           -- Error de configuracion
    )),
    status_message TEXT,  -- Mensaje de estado/error

    -- Prompt generado (cache del prompt compilado)
    compiled_prompt TEXT,
    compiled_prompt_hash VARCHAR(64),
    compiled_prompt_at TIMESTAMPTZ,

    -- Metadata de configuracion
    last_configured_at TIMESTAMPTZ,
    last_configured_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    configuration_version INTEGER DEFAULT 1,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_phone_number UNIQUE(phone_number),
    CONSTRAINT unique_business_branch UNIQUE(business_id, branch_id)
);

-- =====================================================
-- INDICES
-- =====================================================

-- Indice por tenant
CREATE INDEX idx_voice_assistant_configs_tenant
    ON public.voice_assistant_configs(tenant_id);

-- Indice por business
CREATE INDEX idx_voice_assistant_configs_business
    ON public.voice_assistant_configs(business_id);

-- Indice por numero de telefono (para lookup rapido en webhooks)
CREATE INDEX idx_voice_assistant_configs_phone
    ON public.voice_assistant_configs(phone_number)
    WHERE phone_number IS NOT NULL;

-- Indice por estado activo
CREATE INDEX idx_voice_assistant_configs_active
    ON public.voice_assistant_configs(is_active)
    WHERE is_active = true;

-- Indice por tipo de asistente
CREATE INDEX idx_voice_assistant_configs_type
    ON public.voice_assistant_configs(assistant_type_id);

-- Indice por VAPI assistant ID
CREATE INDEX idx_voice_assistant_configs_vapi
    ON public.voice_assistant_configs(vapi_assistant_id)
    WHERE vapi_assistant_id IS NOT NULL;

-- Indice compuesto para busquedas comunes
CREATE INDEX idx_voice_assistant_configs_tenant_active
    ON public.voice_assistant_configs(tenant_id, is_active)
    WHERE is_active = true;

-- =====================================================
-- TRIGGER: Actualizar updated_at automaticamente
-- =====================================================

CREATE TRIGGER update_voice_assistant_configs_updated_at
    BEFORE UPDATE ON public.voice_assistant_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TRIGGER: Incrementar version de configuracion
-- =====================================================

CREATE OR REPLACE FUNCTION increment_voice_config_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo incrementar si cambiaron campos de configuracion significativos
    IF (
        OLD.assistant_type_id IS DISTINCT FROM NEW.assistant_type_id OR
        OLD.voice_id IS DISTINCT FROM NEW.voice_id OR
        OLD.special_instructions IS DISTINCT FROM NEW.special_instructions OR
        OLD.enabled_capabilities_override IS DISTINCT FROM NEW.enabled_capabilities_override OR
        OLD.available_tools_override IS DISTINCT FROM NEW.available_tools_override OR
        OLD.template_version IS DISTINCT FROM NEW.template_version
    ) THEN
        NEW.configuration_version := OLD.configuration_version + 1;
        NEW.last_configured_at := NOW();
        -- Invalidar prompt compilado
        NEW.compiled_prompt := NULL;
        NEW.compiled_prompt_hash := NULL;
        NEW.compiled_prompt_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_voice_assistant_config_version
    BEFORE UPDATE ON public.voice_assistant_configs
    FOR EACH ROW
    EXECUTE FUNCTION increment_voice_config_version();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.voice_assistant_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios pueden ver configs de su tenant
CREATE POLICY "voice_assistant_configs_select_own"
    ON public.voice_assistant_configs
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()
        )
    );

-- Policy: Usuarios pueden insertar configs en su tenant
CREATE POLICY "voice_assistant_configs_insert_own"
    ON public.voice_assistant_configs
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()
        )
    );

-- Policy: Usuarios pueden actualizar configs de su tenant
CREATE POLICY "voice_assistant_configs_update_own"
    ON public.voice_assistant_configs
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()
        )
    );

-- Policy: Usuarios pueden eliminar configs de su tenant
CREATE POLICY "voice_assistant_configs_delete_own"
    ON public.voice_assistant_configs
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.staff WHERE user_id = auth.uid()
        )
    );

-- Policy: Service role tiene acceso total
CREATE POLICY "voice_assistant_configs_service_role"
    ON public.voice_assistant_configs
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

COMMENT ON TABLE public.voice_assistant_configs IS
'Configuracion de asistente de voz por business. Contiene la relacion con tipo de asistente, voz seleccionada, instrucciones especiales y estado del asistente.';

COMMENT ON COLUMN public.voice_assistant_configs.vapi_assistant_id IS
'ID del asistente en VAPI. Se crea cuando se activa el asistente.';

COMMENT ON COLUMN public.voice_assistant_configs.special_instructions IS
'Instrucciones especiales del cliente que se agregan al prompt base.';

COMMENT ON COLUMN public.voice_assistant_configs.enabled_capabilities_override IS
'Override de capacidades del tipo base. NULL = usar capacidades del tipo.';

COMMENT ON COLUMN public.voice_assistant_configs.compiled_prompt IS
'Cache del prompt compilado con Handlebars. Se regenera cuando cambia la config.';

-- =====================================================
-- FUNCION: Obtener configuracion completa por telefono
-- =====================================================

CREATE OR REPLACE FUNCTION get_voice_config_by_phone(p_phone_number VARCHAR)
RETURNS TABLE (
    config_id UUID,
    tenant_id UUID,
    business_id UUID,
    assistant_type_name VARCHAR,
    assistant_type_vertical VARCHAR,
    voice_provider VARCHAR,
    voice_id VARCHAR,
    voice_settings JSONB,
    enabled_capabilities JSONB,
    available_tools JSONB,
    special_instructions TEXT,
    personality_type VARCHAR,
    assistant_name VARCHAR,
    max_call_duration_seconds INTEGER,
    first_message TEXT,
    compiled_prompt TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vac.id as config_id,
        vac.tenant_id,
        vac.business_id,
        vat.name as assistant_type_name,
        vat.vertical as assistant_type_vertical,
        vc.provider as voice_provider,
        vc.voice_id,
        jsonb_build_object(
            'speed', vac.voice_speed,
            'stability', vc.default_stability,
            'similarity_boost', vc.default_similarity_boost
        ) as voice_settings,
        COALESCE(vac.enabled_capabilities_override, vat.enabled_capabilities) as enabled_capabilities,
        COALESCE(vac.available_tools_override, vat.available_tools) as available_tools,
        vac.special_instructions,
        vac.personality_type,
        vac.assistant_name,
        vac.max_call_duration_seconds,
        vac.first_message,
        vac.compiled_prompt,
        vac.is_active
    FROM public.voice_assistant_configs vac
    JOIN public.voice_assistant_types vat ON vac.assistant_type_id = vat.id
    LEFT JOIN public.voice_catalog vc ON vac.voice_id = vc.id
    WHERE vac.phone_number = p_phone_number
        AND vac.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_voice_config_by_phone IS
'Obtiene la configuracion completa del asistente de voz por numero de telefono. Usado en webhooks de llamadas entrantes.';

-- =====================================================
-- FIN MIGRACION 144
-- =====================================================

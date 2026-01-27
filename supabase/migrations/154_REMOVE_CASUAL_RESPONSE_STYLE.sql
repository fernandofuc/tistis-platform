-- =====================================================
-- TIS TIS PLATFORM - REMOVE CASUAL RESPONSE STYLE
-- Migration 154: Eliminar estilo de respuesta "casual"
-- =====================================================
--
-- PROPÓSITO:
-- Eliminar el estilo de respuesta "casual" del sistema.
-- Un negocio no debería querer que el modelo comunique de manera casual.
-- Los estilos válidos ahora son: professional, professional_friendly, formal
--
-- CAMBIOS:
-- 1. Migrar registros existentes con 'casual' a 'professional_friendly'
-- 2. Actualizar CHECK constraints en todas las tablas afectadas
--
-- TABLAS AFECTADAS:
-- - agent_profiles.response_style
-- - channel_connections.ai_personality_override
-- - ai_tenant_config.ai_personality
-- - voice_agent_config.ai_personality
-- - voice_assistant_config.personality
-- - voice_assistant_types.personality
--
-- =====================================================

-- =====================================================
-- PASO 1: MIGRAR DATOS EXISTENTES
-- =====================================================
-- NOTA: Verificamos existencia de COLUMNA, no solo tabla

-- Actualizar agent_profiles.response_style si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agent_profiles' AND column_name = 'response_style'
    ) THEN
        UPDATE agent_profiles SET response_style = 'professional_friendly' WHERE response_style = 'casual';
    END IF;
END $$;

-- Actualizar channel_connections.ai_personality_override si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'channel_connections' AND column_name = 'ai_personality_override'
    ) THEN
        UPDATE channel_connections SET ai_personality_override = 'professional_friendly' WHERE ai_personality_override = 'casual';
    END IF;
END $$;

-- Actualizar ai_tenant_config.ai_personality si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ai_tenant_config' AND column_name = 'ai_personality'
    ) THEN
        UPDATE ai_tenant_config SET ai_personality = 'professional_friendly' WHERE ai_personality = 'casual';
    END IF;
END $$;

-- Actualizar voice_agent_config.ai_personality si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'voice_agent_config' AND column_name = 'ai_personality'
    ) THEN
        UPDATE voice_agent_config SET ai_personality = 'professional_friendly' WHERE ai_personality = 'casual';
    END IF;
END $$;

-- Actualizar voice_assistant_config.personality si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'voice_assistant_config' AND column_name = 'personality'
    ) THEN
        UPDATE voice_assistant_config SET personality = 'professional_friendly' WHERE personality = 'casual';
    END IF;
END $$;

-- Actualizar voice_assistant_types.personality si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'voice_assistant_types' AND column_name = 'personality'
    ) THEN
        UPDATE voice_assistant_types SET personality = 'professional_friendly' WHERE personality = 'casual';
    END IF;
END $$;

-- =====================================================
-- PASO 2: ACTUALIZAR CONSTRAINTS - agent_profiles
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agent_profiles' AND column_name = 'response_style'
    ) THEN
        -- Eliminar constraint existente
        ALTER TABLE agent_profiles DROP CONSTRAINT IF EXISTS agent_profiles_response_style_check;
        -- Crear nuevo constraint sin 'casual'
        ALTER TABLE agent_profiles ADD CONSTRAINT agent_profiles_response_style_check
            CHECK (response_style IN ('professional', 'professional_friendly', 'formal'));
    END IF;
END $$;

-- =====================================================
-- PASO 3: ACTUALIZAR CONSTRAINTS - channel_connections
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'channel_connections' AND column_name = 'ai_personality_override'
    ) THEN
        -- Eliminar constraint existente
        ALTER TABLE channel_connections DROP CONSTRAINT IF EXISTS channel_connections_ai_personality_override_check;
        -- Crear nuevo constraint sin 'casual'
        ALTER TABLE channel_connections ADD CONSTRAINT channel_connections_ai_personality_override_check
            CHECK (ai_personality_override IN ('professional', 'professional_friendly', 'formal'));
    END IF;
END $$;

-- =====================================================
-- PASO 4: ACTUALIZAR CONSTRAINTS - ai_tenant_config
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ai_tenant_config' AND column_name = 'ai_personality'
    ) THEN
        -- Eliminar constraint existente
        ALTER TABLE ai_tenant_config DROP CONSTRAINT IF EXISTS ai_tenant_config_ai_personality_check;
        -- Crear nuevo constraint sin 'casual'
        ALTER TABLE ai_tenant_config ADD CONSTRAINT ai_tenant_config_ai_personality_check
            CHECK (ai_personality IN ('professional', 'professional_friendly', 'formal'));
    END IF;
END $$;

-- =====================================================
-- PASO 5: ACTUALIZAR CONSTRAINTS - voice_agent_config
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'voice_agent_config' AND column_name = 'ai_personality'
    ) THEN
        -- Eliminar constraint existente
        EXECUTE 'ALTER TABLE voice_agent_config DROP CONSTRAINT IF EXISTS voice_agent_config_ai_personality_check';
        -- Crear nuevo constraint sin 'casual'
        EXECUTE 'ALTER TABLE voice_agent_config ADD CONSTRAINT voice_agent_config_ai_personality_check CHECK (ai_personality IN (''professional'', ''professional_friendly'', ''formal''))';
    END IF;
END $$;

-- =====================================================
-- PASO 6: ACTUALIZAR CONSTRAINTS - voice_assistant_config
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'voice_assistant_config' AND column_name = 'personality'
    ) THEN
        -- Eliminar constraint existente
        EXECUTE 'ALTER TABLE voice_assistant_config DROP CONSTRAINT IF EXISTS voice_assistant_config_personality_check';
        -- Crear nuevo constraint sin 'casual'
        EXECUTE 'ALTER TABLE voice_assistant_config ADD CONSTRAINT voice_assistant_config_personality_check CHECK (personality IN (''professional'', ''professional_friendly'', ''formal''))';
    END IF;
END $$;

-- =====================================================
-- PASO 7: ACTUALIZAR CONSTRAINTS - voice_assistant_types
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'voice_assistant_types' AND column_name = 'personality'
    ) THEN
        -- Eliminar constraint existente
        EXECUTE 'ALTER TABLE voice_assistant_types DROP CONSTRAINT IF EXISTS voice_assistant_types_personality_check';
        -- Crear nuevo constraint sin 'casual'
        EXECUTE 'ALTER TABLE voice_assistant_types ADD CONSTRAINT voice_assistant_types_personality_check CHECK (personality IN (''professional'', ''professional_friendly'', ''formal''))';
    END IF;
END $$;

-- =====================================================
-- PASO 8: ACTUALIZAR FUNCIONES RELACIONADAS
-- =====================================================

-- Actualizar función get_channel_ai_config para que el default sea professional_friendly
CREATE OR REPLACE FUNCTION public.get_channel_ai_config(
    p_channel_connection_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_channel_connection RECORD;
    v_tenant_config RECORD;
    v_result JSONB;
BEGIN
    -- Get channel connection
    SELECT * INTO v_channel_connection
    FROM public.channel_connections
    WHERE id = p_channel_connection_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Get tenant AI config
    SELECT * INTO v_tenant_config
    FROM public.ai_tenant_config
    WHERE tenant_id = v_channel_connection.tenant_id;

    -- Build merged config (channel overrides tenant)
    -- Note: 'casual' has been removed - valid values: professional, professional_friendly, formal
    v_result := jsonb_build_object(
        'channel_id', v_channel_connection.id,
        'channel', v_channel_connection.channel,
        'account_number', v_channel_connection.account_number,
        'account_name', v_channel_connection.account_name,
        'is_personal_brand', v_channel_connection.is_personal_brand,
        'ai_enabled', v_channel_connection.ai_enabled,
        -- Use channel override if set, otherwise tenant default
        'ai_personality', COALESCE(
            v_channel_connection.ai_personality_override,
            v_tenant_config.ai_personality,
            'professional_friendly'
        ),
        'first_message_delay_seconds', COALESCE(
            v_channel_connection.first_message_delay_seconds,
            v_tenant_config.default_first_message_delay,
            0
        ),
        'subsequent_message_delay_seconds', COALESCE(
            v_channel_connection.subsequent_message_delay_seconds,
            v_tenant_config.default_subsequent_message_delay,
            0
        ),
        'custom_instructions', COALESCE(
            v_channel_connection.custom_instructions_override,
            v_tenant_config.custom_instructions
        ),
        'use_emojis', COALESCE(v_tenant_config.use_emojis, false),
        -- Tenant-level settings (no override)
        'ai_temperature', v_tenant_config.ai_temperature,
        'max_tokens', v_tenant_config.max_tokens,
        'escalation_keywords', v_tenant_config.escalation_keywords,
        'max_turns_before_escalation', v_tenant_config.max_turns_before_escalation,
        'supported_languages', v_tenant_config.supported_languages,
        'default_language', v_tenant_config.default_language
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_channel_ai_config IS
'Returns merged AI configuration for a specific channel account.
Channel-specific settings override tenant defaults.
Valid personality values: professional, professional_friendly, formal (casual removed).';

-- =====================================================
-- PASO 9: ACTUALIZAR VIEW v_channel_accounts
-- =====================================================

-- DROP primero porque CREATE OR REPLACE no permite cambiar orden/nombre de columnas
DROP VIEW IF EXISTS public.v_channel_accounts;

CREATE VIEW public.v_channel_accounts AS
SELECT
    cc.id,
    cc.tenant_id,
    cc.branch_id,
    cc.channel,
    cc.account_number,
    cc.account_name,
    cc.is_personal_brand,
    cc.status,
    cc.ai_enabled,
    -- Effective AI personality (casual removed, default is professional_friendly)
    COALESCE(cc.ai_personality_override, atc.ai_personality, 'professional_friendly') as effective_personality,
    -- Delay settings
    COALESCE(cc.first_message_delay_seconds, atc.default_first_message_delay, 0) as first_message_delay,
    COALESCE(cc.subsequent_message_delay_seconds, atc.default_subsequent_message_delay, 0) as subsequent_message_delay,
    -- Stats
    cc.messages_received,
    cc.messages_sent,
    cc.last_message_at,
    -- Channel-specific identifiers for display
    CASE cc.channel
        WHEN 'whatsapp' THEN cc.whatsapp_phone_number_id
        WHEN 'instagram' THEN cc.instagram_username
        WHEN 'facebook' THEN cc.facebook_page_name
        WHEN 'tiktok' THEN cc.tiktok_open_id
        ELSE NULL
    END as channel_identifier,
    cc.created_at,
    cc.updated_at
FROM public.channel_connections cc
LEFT JOIN public.ai_tenant_config atc ON atc.tenant_id = cc.tenant_id
ORDER BY cc.tenant_id, cc.channel, cc.account_number;

COMMENT ON VIEW public.v_channel_accounts IS
'View combining channel connections with their effective AI settings.
Valid personality values: professional, professional_friendly, formal (casual removed).';

-- =====================================================
-- PASO 10: DOCUMENTACIÓN DE CAMBIOS
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agent_profiles' AND column_name = 'response_style'
    ) THEN
        COMMENT ON COLUMN agent_profiles.response_style IS
        'Estilo de respuesta del agente. Valores válidos: professional, professional_friendly, formal.
El estilo casual fue removido - un negocio no debe comunicarse de manera casual.';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'channel_connections' AND column_name = 'ai_personality_override'
    ) THEN
        COMMENT ON COLUMN channel_connections.ai_personality_override IS
        'Override de personalidad AI por canal. Valores válidos: professional, professional_friendly, formal.
NULL = usar default del tenant.';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ai_tenant_config' AND column_name = 'ai_personality'
    ) THEN
        COMMENT ON COLUMN ai_tenant_config.ai_personality IS
        'Personalidad AI default del tenant. Valores válidos: professional, professional_friendly, formal.';
    END IF;
END $$;

-- =====================================================
-- FIN DE MIGRACIÓN 154
-- =====================================================

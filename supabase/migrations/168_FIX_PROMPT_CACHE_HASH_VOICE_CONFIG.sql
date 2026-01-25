-- =====================================================
-- TIS TIS PLATFORM - Fix Prompt Cache Hash for Voice Config
-- Migración: 075_FIX_PROMPT_CACHE_HASH_VOICE_CONFIG.sql
-- Fecha: 2024-12-26
-- =====================================================
--
-- PROPÓSITO:
-- Corrige la función calculate_source_data_hash para incluir
-- datos de voice_agent_config (use_filler_phrases, filler_phrases,
-- assistant_personality, etc.) en el hash de detección de cambios.
--
-- PROBLEMA ORIGINAL:
-- La función no incluía datos de voice_agent_config, lo que causaba
-- que check_prompt_needs_regeneration no detectara cambios en la
-- configuración de Voice (muletillas, personalidad, etc.)
--
-- SOLUCIÓN:
-- Actualizar la función para incluir todos los campos relevantes
-- de voice_agent_config en el cálculo del hash.
-- =====================================================

-- =====================================================
-- 1. FUNCIÓN ACTUALIZADA: calculate_source_data_hash
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_source_data_hash(p_tenant_id UUID)
RETURNS VARCHAR(64)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_combined_data TEXT;
    v_hash VARCHAR(64);
BEGIN
    -- Concatenar todos los datos relevantes en un string
    -- Incluye: servicios, FAQs, instrucciones, políticas, artículos,
    -- ai_config, branches, Y AHORA voice_agent_config
    SELECT INTO v_combined_data
        -- Servicios
        COALESCE(
            (SELECT string_agg(
                COALESCE(name, '') || COALESCE(description, '') || COALESCE(ai_description, '') ||
                COALESCE(price_min::text, '') || COALESCE(price_max::text, '') ||
                COALESCE(special_instructions, ''), '|')
            FROM services WHERE tenant_id = p_tenant_id AND active = true), ''
        ) || '###' ||
        -- FAQs
        COALESCE(
            (SELECT string_agg(
                COALESCE(question, '') || COALESCE(answer, ''), '|')
            FROM faqs WHERE tenant_id = p_tenant_id AND active = true), ''
        ) || '###' ||
        -- Instrucciones personalizadas
        COALESCE(
            (SELECT string_agg(
                COALESCE(type, '') || COALESCE(title, '') || COALESCE(instruction, ''), '|')
            FROM ai_custom_instructions WHERE tenant_id = p_tenant_id AND active = true), ''
        ) || '###' ||
        -- Políticas de negocio
        COALESCE(
            (SELECT string_agg(
                COALESCE(type, '') || COALESCE(policy_text, ''), '|')
            FROM ai_business_policies WHERE tenant_id = p_tenant_id AND active = true), ''
        ) || '###' ||
        -- Artículos de conocimiento
        COALESCE(
            (SELECT string_agg(
                COALESCE(category, '') || COALESCE(content, ''), '|')
            FROM ai_knowledge_articles WHERE tenant_id = p_tenant_id AND active = true), ''
        ) || '###' ||
        -- AI tenant config (custom_instructions del sistema)
        COALESCE(
            (SELECT custom_instructions FROM ai_tenant_config WHERE tenant_id = p_tenant_id), ''
        ) || '###' ||
        -- Sucursales
        COALESCE(
            (SELECT string_agg(
                COALESCE(name, '') || COALESCE(address, ''), '|')
            FROM branches WHERE tenant_id = p_tenant_id AND active = true), ''
        ) || '###' ||
        -- =====================================================
        -- NUEVO: Voice Agent Config (crítico para prompts de voz)
        -- =====================================================
        COALESCE(
            (SELECT
                COALESCE(assistant_name, '') || '|' ||
                COALESCE(assistant_personality, '') || '|' ||
                COALESCE(use_filler_phrases::text, 'true') || '|' ||
                COALESCE(array_to_string(filler_phrases, ','), '') || '|' ||
                COALESCE(custom_instructions, '') || '|' ||
                COALESCE(first_message, '') || '|' ||
                COALESCE(goodbye_message, '') || '|' ||
                COALESCE(escalation_enabled::text, 'true') || '|' ||
                COALESCE(escalation_phone, '')
            FROM voice_agent_config WHERE tenant_id = p_tenant_id), ''
        );

    -- Calcular hash SHA256
    v_hash := encode(sha256(v_combined_data::bytea), 'hex');

    RETURN v_hash;
END;
$$;

-- =====================================================
-- 2. COMENTARIO EXPLICATIVO
-- =====================================================
COMMENT ON FUNCTION calculate_source_data_hash(UUID) IS
'Calcula hash SHA256 de todos los datos del negocio que afectan la generación de prompts.
Incluye: servicios, FAQs, instrucciones, políticas, artículos, ai_config, branches,
Y voice_agent_config (assistant_name, personality, use_filler_phrases, filler_phrases, etc.).
Si el hash cambia, significa que los datos fueron modificados y el prompt debe regenerarse.
Actualizado en migración 075 para incluir voice_agent_config.';

-- =====================================================
-- 3. VERIFICACIÓN (solo para logging, no afecta la migración)
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Migración 075: calculate_source_data_hash actualizada para incluir voice_agent_config';
END $$;

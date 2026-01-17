-- =====================================================
-- TIS TIS PLATFORM - Fix Prompt Cache Constraint
-- Migration 132: Add unique constraint for upsert operations
-- =====================================================
-- PROBLEMA: El código TypeScript usa .upsert() con
-- onConflict: 'tenant_id,channel' pero el constraint
-- fue eliminado en migración 124 y reemplazado por un
-- índice único que incluye profile_id.
--
-- ERROR: "there is no unique or exclusion constraint
-- matching the ON CONFLICT specification"
--
-- SOLUCIÓN: Crear constraint que permita upsert sin profile_id
-- =====================================================

-- =====================================================
-- 1. RECREAR CONSTRAINT PARA COMPATIBILIDAD
-- =====================================================

-- Primero verificamos si existe el índice y lo eliminamos para recrearlo como constraint
DROP INDEX IF EXISTS idx_ai_generated_prompts_tenant_channel_profile;

-- Crear constraint único que soporte ambos casos:
-- 1. Registros sin profile_id (NULL) - para cache general
-- 2. Registros con profile_id - para cache por perfil específico

-- Para registros sin profile_id, usamos un constraint parcial
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_tenant_channel_no_profile
ON ai_generated_prompts(tenant_id, channel)
WHERE profile_id IS NULL;

-- Para registros con profile_id específico
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_tenant_channel_with_profile
ON ai_generated_prompts(tenant_id, channel, profile_id)
WHERE profile_id IS NOT NULL;

-- =====================================================
-- 2. ACTUALIZAR CÓDIGO DE UPSERT (vía RPC)
-- =====================================================
-- Crear RPC que maneje el upsert correctamente

CREATE OR REPLACE FUNCTION upsert_minimal_prompt(
    p_tenant_id UUID,
    p_channel TEXT,
    p_prompt TEXT,
    p_source_hash TEXT,
    p_token_estimate INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Intentar actualizar primero
    UPDATE ai_generated_prompts
    SET
        generated_prompt = p_prompt,
        system_prompt = p_prompt,
        source_data_hash = p_source_hash,
        generator_model = 'minimal-v6',
        tokens_estimated = p_token_estimate,
        prompt_version = COALESCE(prompt_version, 0) + 1,
        status = 'active',
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND channel = p_channel
      AND profile_id IS NULL
    RETURNING id INTO v_id;

    -- Si no actualizó, insertar
    IF v_id IS NULL THEN
        INSERT INTO ai_generated_prompts (
            tenant_id,
            channel,
            profile_id,
            generated_prompt,
            system_prompt,
            source_data_hash,
            generator_model,
            tokens_estimated,
            prompt_version,
            status,
            created_at,
            updated_at
        ) VALUES (
            p_tenant_id,
            p_channel,
            NULL, -- Sin profile_id para cache general
            p_prompt,
            p_prompt,
            p_source_hash,
            'minimal-v6',
            p_token_estimate,
            1,
            'active',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION upsert_minimal_prompt(UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_minimal_prompt(UUID, TEXT, TEXT, TEXT, INTEGER) TO service_role;

-- =====================================================
-- 3. LOG DE MIGRACIÓN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 132 completed: Fixed prompt cache constraint for upsert operations';
    RAISE NOTICE 'Created partial unique indices for tenant_id + channel (with/without profile_id)';
    RAISE NOTICE 'Created RPC upsert_minimal_prompt for safe cache updates';
END $$;

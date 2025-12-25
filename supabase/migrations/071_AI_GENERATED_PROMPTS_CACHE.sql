-- =====================================================
-- TIS TIS PLATFORM - AI Generated Prompts Cache System
-- Migración: 071_AI_GENERATED_PROMPTS_CACHE.sql
-- Fecha: 2024-12-25
-- =====================================================
--
-- PROPÓSITO:
-- Sistema de caché de prompts pre-generados por Gemini/OpenRouter.
-- Los prompts se generan UNA VEZ cuando el usuario guarda cambios
-- en Business IA, y se reutilizan en cada mensaje/llamada.
--
-- BENEFICIOS:
-- 1. Reducción de tokens por request (de ~5000 a ~1500)
-- 2. Prompts optimizados por canal (voice vs chat)
-- 3. Menor latencia en respuestas
-- 4. Costo reducido por mensaje
-- =====================================================

-- =====================================================
-- 1. TABLA PRINCIPAL: ai_generated_prompts
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_generated_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Canal para el cual se generó el prompt
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('voice', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'webchat')),

    -- El prompt generado por Gemini (optimizado y estructurado)
    generated_prompt TEXT NOT NULL,

    -- Prompt específico para el system message del LLM
    system_prompt TEXT NOT NULL,

    -- Metadatos del prompt
    prompt_version INTEGER NOT NULL DEFAULT 1,
    tokens_estimated INTEGER, -- Estimación de tokens del prompt

    -- Hash de los datos fuente para detectar cambios
    -- Si el hash cambia, significa que hay datos nuevos y debe regenerarse
    source_data_hash VARCHAR(64) NOT NULL,

    -- Configuración usada para generar
    generation_config JSONB DEFAULT '{}'::jsonb,

    -- Modelo usado para generar el prompt
    generator_model VARCHAR(100) DEFAULT 'gemini-2.0-flash-exp',

    -- Estado del prompt
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'generating', 'failed', 'archived')),

    -- Errores si falló la generación
    last_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ, -- Última vez que se usó en un request

    -- Estadísticas de uso
    usage_count INTEGER DEFAULT 0,

    -- Constraint único: un prompt por tenant+channel
    UNIQUE(tenant_id, channel)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ai_generated_prompts_tenant_channel
    ON ai_generated_prompts(tenant_id, channel)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ai_generated_prompts_hash
    ON ai_generated_prompts(tenant_id, source_data_hash);

-- =====================================================
-- 2. TABLA DE HISTORIAL: ai_prompt_generation_history
-- =====================================================
-- Mantiene historial de todas las generaciones para auditoría
CREATE TABLE IF NOT EXISTS ai_prompt_generation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,

    -- Prompt que se generó
    generated_prompt TEXT NOT NULL,
    system_prompt TEXT NOT NULL,

    -- Datos de la generación
    source_data_hash VARCHAR(64) NOT NULL,
    generator_model VARCHAR(100),
    tokens_used INTEGER, -- Tokens consumidos en la generación
    generation_time_ms INTEGER, -- Tiempo de generación en ms

    -- Resultado
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,

    -- Quién/qué triggereó la generación
    triggered_by VARCHAR(50), -- 'user_save', 'api_call', 'cron', 'manual'
    triggered_by_user_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para consultar historial por tenant
CREATE INDEX IF NOT EXISTS idx_ai_prompt_history_tenant
    ON ai_prompt_generation_history(tenant_id, created_at DESC);

-- =====================================================
-- 3. FUNCIÓN: get_cached_prompt
-- =====================================================
-- Obtiene el prompt cacheado para un tenant+channel
CREATE OR REPLACE FUNCTION get_cached_prompt(
    p_tenant_id UUID,
    p_channel VARCHAR(50)
)
RETURNS TABLE (
    prompt_id UUID,
    generated_prompt TEXT,
    system_prompt TEXT,
    prompt_version INTEGER,
    source_data_hash VARCHAR(64),
    last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Actualizar estadísticas de uso
    UPDATE ai_generated_prompts
    SET
        last_used_at = NOW(),
        usage_count = usage_count + 1
    WHERE tenant_id = p_tenant_id
      AND channel = p_channel
      AND status = 'active';

    -- Retornar el prompt
    RETURN QUERY
    SELECT
        agp.id,
        agp.generated_prompt,
        agp.system_prompt,
        agp.prompt_version,
        agp.source_data_hash,
        agp.updated_at
    FROM ai_generated_prompts agp
    WHERE agp.tenant_id = p_tenant_id
      AND agp.channel = p_channel
      AND agp.status = 'active'
    LIMIT 1;
END;
$$;

-- =====================================================
-- 4. FUNCIÓN: calculate_source_data_hash
-- =====================================================
-- Calcula hash de los datos fuente para detectar cambios
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
    SELECT INTO v_combined_data
        COALESCE(
            (SELECT string_agg(
                COALESCE(name, '') || COALESCE(description, '') || COALESCE(ai_description, '') ||
                COALESCE(price_min::text, '') || COALESCE(price_max::text, '') ||
                COALESCE(special_instructions, ''), '|')
            FROM services WHERE tenant_id = p_tenant_id AND active = true), ''
        ) || '###' ||
        COALESCE(
            (SELECT string_agg(
                COALESCE(question, '') || COALESCE(answer, ''), '|')
            FROM faqs WHERE tenant_id = p_tenant_id AND active = true), ''
        ) || '###' ||
        COALESCE(
            (SELECT string_agg(
                COALESCE(type, '') || COALESCE(title, '') || COALESCE(instruction, ''), '|')
            FROM ai_custom_instructions WHERE tenant_id = p_tenant_id AND active = true), ''
        ) || '###' ||
        COALESCE(
            (SELECT string_agg(
                COALESCE(type, '') || COALESCE(policy_text, ''), '|')
            FROM ai_business_policies WHERE tenant_id = p_tenant_id AND active = true), ''
        ) || '###' ||
        COALESCE(
            (SELECT string_agg(
                COALESCE(category, '') || COALESCE(content, ''), '|')
            FROM ai_knowledge_articles WHERE tenant_id = p_tenant_id AND active = true), ''
        ) || '###' ||
        COALESCE(
            (SELECT custom_instructions FROM ai_tenant_config WHERE tenant_id = p_tenant_id), ''
        ) || '###' ||
        COALESCE(
            (SELECT string_agg(
                COALESCE(name, '') || COALESCE(address, ''), '|')
            FROM branches WHERE tenant_id = p_tenant_id AND active = true), ''
        );

    -- Calcular hash SHA256
    v_hash := encode(sha256(v_combined_data::bytea), 'hex');

    RETURN v_hash;
END;
$$;

-- =====================================================
-- 5. FUNCIÓN: check_prompt_needs_regeneration
-- =====================================================
-- Verifica si el prompt necesita regenerarse (datos cambiaron)
CREATE OR REPLACE FUNCTION check_prompt_needs_regeneration(
    p_tenant_id UUID,
    p_channel VARCHAR(50)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_hash VARCHAR(64);
    v_cached_hash VARCHAR(64);
BEGIN
    -- Calcular hash actual de los datos
    v_current_hash := calculate_source_data_hash(p_tenant_id);

    -- Obtener hash del prompt cacheado
    SELECT source_data_hash INTO v_cached_hash
    FROM ai_generated_prompts
    WHERE tenant_id = p_tenant_id
      AND channel = p_channel
      AND status = 'active';

    -- Si no hay prompt cacheado, necesita generarse
    IF v_cached_hash IS NULL THEN
        RETURN true;
    END IF;

    -- Comparar hashes
    RETURN v_current_hash != v_cached_hash;
END;
$$;

-- =====================================================
-- 6. FUNCIÓN: upsert_generated_prompt
-- =====================================================
-- Inserta o actualiza un prompt generado
CREATE OR REPLACE FUNCTION upsert_generated_prompt(
    p_tenant_id UUID,
    p_channel VARCHAR(50),
    p_generated_prompt TEXT,
    p_system_prompt TEXT,
    p_source_data_hash VARCHAR(64),
    p_generator_model VARCHAR(100) DEFAULT 'gemini-2.0-flash-exp',
    p_tokens_estimated INTEGER DEFAULT NULL,
    p_generation_config JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prompt_id UUID;
    v_new_version INTEGER;
BEGIN
    -- Obtener versión actual
    SELECT COALESCE(MAX(prompt_version), 0) + 1 INTO v_new_version
    FROM ai_generated_prompts
    WHERE tenant_id = p_tenant_id AND channel = p_channel;

    -- Upsert del prompt
    INSERT INTO ai_generated_prompts (
        tenant_id,
        channel,
        generated_prompt,
        system_prompt,
        prompt_version,
        tokens_estimated,
        source_data_hash,
        generator_model,
        generation_config,
        status,
        updated_at
    )
    VALUES (
        p_tenant_id,
        p_channel,
        p_generated_prompt,
        p_system_prompt,
        v_new_version,
        p_tokens_estimated,
        p_source_data_hash,
        p_generator_model,
        p_generation_config,
        'active',
        NOW()
    )
    ON CONFLICT (tenant_id, channel)
    DO UPDATE SET
        generated_prompt = EXCLUDED.generated_prompt,
        system_prompt = EXCLUDED.system_prompt,
        prompt_version = v_new_version,
        tokens_estimated = EXCLUDED.tokens_estimated,
        source_data_hash = EXCLUDED.source_data_hash,
        generator_model = EXCLUDED.generator_model,
        generation_config = EXCLUDED.generation_config,
        status = 'active',
        last_error = NULL,
        updated_at = NOW()
    RETURNING id INTO v_prompt_id;

    -- Registrar en historial
    INSERT INTO ai_prompt_generation_history (
        tenant_id,
        channel,
        generated_prompt,
        system_prompt,
        source_data_hash,
        generator_model,
        triggered_by
    )
    VALUES (
        p_tenant_id,
        p_channel,
        p_generated_prompt,
        p_system_prompt,
        p_source_data_hash,
        p_generator_model,
        'api_call'
    );

    RETURN v_prompt_id;
END;
$$;

-- =====================================================
-- 7. RLS POLICIES
-- =====================================================
ALTER TABLE ai_generated_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompt_generation_history ENABLE ROW LEVEL SECURITY;

-- Policy para ai_generated_prompts
CREATE POLICY "ai_generated_prompts_tenant_isolation" ON ai_generated_prompts
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
        )
    );

-- Policy para historial
CREATE POLICY "ai_prompt_history_tenant_isolation" ON ai_prompt_generation_history
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- 8. GRANTS
-- =====================================================
GRANT SELECT, INSERT, UPDATE ON ai_generated_prompts TO authenticated;
GRANT SELECT, INSERT ON ai_prompt_generation_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_cached_prompt TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_source_data_hash TO authenticated;
GRANT EXECUTE ON FUNCTION check_prompt_needs_regeneration TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_generated_prompt TO authenticated;

-- =====================================================
-- 9. COMENTARIOS
-- =====================================================
COMMENT ON TABLE ai_generated_prompts IS
'Cache de prompts pre-generados por Gemini. Se regeneran solo cuando cambian los datos del negocio.';

COMMENT ON TABLE ai_prompt_generation_history IS
'Historial de todas las generaciones de prompts para auditoría y debugging.';

COMMENT ON FUNCTION get_cached_prompt IS
'Obtiene el prompt cacheado para un tenant y canal. Actualiza estadísticas de uso.';

COMMENT ON FUNCTION calculate_source_data_hash IS
'Calcula un hash SHA256 de todos los datos del negocio para detectar cambios.';

COMMENT ON FUNCTION check_prompt_needs_regeneration IS
'Verifica si el prompt necesita regenerarse comparando hashes.';

COMMENT ON FUNCTION upsert_generated_prompt IS
'Inserta o actualiza un prompt generado, registrando en historial.';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================

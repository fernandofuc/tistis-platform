-- =====================================================
-- TIS TIS PLATFORM - Minimal Prompt Architecture v6
-- Migration 126: Support for Minimal Prompt + Dynamic Tools
-- =====================================================
-- Esta migración implementa la arquitectura v6 donde:
-- 1. El prompt inicial es MÍNIMO (~1,200-1,500 tokens)
-- 2. Los datos del negocio se obtienen via Tools dinámicamente
-- 3. Solo instrucciones críticas van en el prompt inicial
-- =====================================================

-- =====================================================
-- 1. AGREGAR COLUMNA include_in_prompt A ai_custom_instructions
-- =====================================================
-- Esta columna determina si una instrucción debe incluirse
-- directamente en el prompt inicial (true) o accederse via RAG (false)

ALTER TABLE ai_custom_instructions
ADD COLUMN IF NOT EXISTS include_in_prompt BOOLEAN DEFAULT false;

COMMENT ON COLUMN ai_custom_instructions.include_in_prompt IS
'Si es true, esta instrucción se incluye directamente en el prompt inicial del agente (máximo 5 por tenant).
Si es false, se accede via Tool Calling / RAG cuando sea relevante.';

-- Índice para consultas rápidas de instrucciones críticas
CREATE INDEX IF NOT EXISTS idx_ai_instructions_include_prompt
ON ai_custom_instructions(tenant_id, include_in_prompt, priority DESC)
WHERE is_active = true AND include_in_prompt = true;

-- =====================================================
-- 2. FUNCIÓN PARA VALIDAR LÍMITE DE include_in_prompt
-- =====================================================
-- Máximo 5 instrucciones con include_in_prompt = true por tenant
-- Esto asegura que el prompt inicial no se sature

CREATE OR REPLACE FUNCTION check_include_in_prompt_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
BEGIN
    -- Solo validar si se está activando include_in_prompt
    IF NEW.include_in_prompt = true AND NEW.is_active = true THEN
        -- Contar instrucciones actuales con include_in_prompt = true
        SELECT COUNT(*) INTO current_count
        FROM ai_custom_instructions
        WHERE tenant_id = NEW.tenant_id
          AND is_active = true
          AND include_in_prompt = true
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

        -- Límite de 5 instrucciones críticas
        IF current_count >= 5 THEN
            RAISE EXCEPTION 'Límite alcanzado: máximo 5 instrucciones pueden tener "Incluir en Prompt" activado. Desactiva alguna existente primero.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar en INSERT y UPDATE
DROP TRIGGER IF EXISTS trigger_check_include_in_prompt_limit ON ai_custom_instructions;
CREATE TRIGGER trigger_check_include_in_prompt_limit
    BEFORE INSERT OR UPDATE ON ai_custom_instructions
    FOR EACH ROW
    EXECUTE FUNCTION check_include_in_prompt_limit();

-- =====================================================
-- 3. FUNCIÓN PARA OBTENER INSTRUCCIONES CRÍTICAS
-- =====================================================
-- Esta función es usada por generateMinimalPrompt()

CREATE OR REPLACE FUNCTION get_critical_instructions(p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    instruction_type TEXT,
    title TEXT,
    instruction TEXT,
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ci.id,
        ci.instruction_type,
        ci.title,
        ci.instruction,
        ci.priority
    FROM ai_custom_instructions ci
    WHERE ci.tenant_id = p_tenant_id
      AND ci.is_active = true
      AND ci.include_in_prompt = true
    ORDER BY ci.priority DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_critical_instructions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_critical_instructions(UUID) TO service_role;

-- =====================================================
-- 4. AGREGAR CAMPO prompt_architecture_version A ai_generated_prompts
-- =====================================================
-- Permite identificar qué versión de arquitectura se usó para generar el prompt

ALTER TABLE ai_generated_prompts
ADD COLUMN IF NOT EXISTS architecture_version TEXT DEFAULT 'legacy';

COMMENT ON COLUMN ai_generated_prompts.architecture_version IS
'Versión de arquitectura: "legacy" (prompt completo) o "minimal-v6" (prompt mínimo + tools)';

-- =====================================================
-- 5. VISTA PARA ESTADÍSTICAS DE INSTRUCCIONES CRÍTICAS
-- =====================================================

CREATE OR REPLACE VIEW v_critical_instructions_stats AS
SELECT
    tenant_id,
    COUNT(*) FILTER (WHERE include_in_prompt = true AND is_active = true) as critical_count,
    COUNT(*) FILTER (WHERE is_active = true) as total_active,
    5 - COUNT(*) FILTER (WHERE include_in_prompt = true AND is_active = true) as slots_available,
    CASE
        WHEN COUNT(*) FILTER (WHERE include_in_prompt = true AND is_active = true) >= 5
        THEN false
        ELSE true
    END as can_add_critical
FROM ai_custom_instructions
GROUP BY tenant_id;

-- =====================================================
-- 6. COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE ai_custom_instructions IS
'Instrucciones personalizadas para el agente AI.
Con include_in_prompt=true, van directamente al prompt inicial (máx 5).
Con include_in_prompt=false, se acceden via Tool Calling/RAG.';

-- =====================================================
-- 7. MIGRAR INSTRUCCIONES EXISTENTES DE ALTA PRIORIDAD
-- =====================================================
-- Las instrucciones con prioridad >= 8 se marcan como críticas
-- (máximo 5 por tenant)

WITH ranked_instructions AS (
    SELECT
        id,
        tenant_id,
        ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY priority DESC) as rn
    FROM ai_custom_instructions
    WHERE is_active = true
      AND priority >= 8
)
UPDATE ai_custom_instructions ci
SET include_in_prompt = true
FROM ranked_instructions ri
WHERE ci.id = ri.id
  AND ri.rn <= 5;

-- =====================================================
-- 8. FEATURE FLAG: use_minimal_prompt_v6 EN ai_tenant_config
-- =====================================================
-- Este flag permite habilitar la arquitectura v6 por tenant

ALTER TABLE ai_tenant_config
ADD COLUMN IF NOT EXISTS use_minimal_prompt_v6 BOOLEAN DEFAULT false;

COMMENT ON COLUMN ai_tenant_config.use_minimal_prompt_v6 IS
'Si es true, usa la arquitectura v6 (prompt minimal ~1,200 tokens + tools dinámicos).
Si es false, usa el prompt legacy completo (~4,000 tokens).
Default: false para rollout gradual.';

-- =====================================================
-- 9. LOG DE MIGRACIÓN
-- =====================================================
DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count
    FROM ai_custom_instructions
    WHERE include_in_prompt = true;

    RAISE NOTICE 'Migración 126 completada: % instrucciones marcadas como críticas (include_in_prompt=true)', migrated_count;
END $$;

-- =====================================================
-- TIS TIS PLATFORM - UPDATE DEFAULT AI MODEL
-- Migration: 017_update_default_ai_model.sql
-- Date: December 13, 2024
-- Version: 1.0
--
-- PURPOSE: Cambiar el modelo por defecto de Haiku a Sonnet 3.5
-- y agregar los modelos más recientes de Claude.
--
-- CHANGES:
-- 1. Actualizar CHECK constraint para incluir modelos nuevos
-- 2. Cambiar default de haiku a claude-3-5-sonnet-20241022
-- =====================================================

-- =====================================================
-- PASO 1: ACTUALIZAR CHECK CONSTRAINT DE AI_MODEL
-- =====================================================

-- Primero eliminamos el constraint existente
ALTER TABLE public.ai_tenant_config
    DROP CONSTRAINT IF EXISTS ai_tenant_config_ai_model_check;

-- Creamos nuevo constraint con todos los modelos disponibles
ALTER TABLE public.ai_tenant_config
    ADD CONSTRAINT ai_tenant_config_ai_model_check
    CHECK (ai_model IN (
        -- Claude 3 (legacy pero todavía funcionales)
        'claude-3-haiku-20240307',
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
        -- Claude 3.5 (recomendados)
        'claude-3-5-haiku-20241022',
        'claude-3-5-sonnet-20241022',
        -- Claude 4.5 (más recientes - si disponibles)
        'claude-opus-4-5-20251101',
        -- OpenAI (alternativa si el cliente prefiere)
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-4-turbo'
    ));

-- =====================================================
-- PASO 2: CAMBIAR DEFAULT A SONNET 3.5
-- =====================================================

ALTER TABLE public.ai_tenant_config
    ALTER COLUMN ai_model SET DEFAULT 'claude-3-5-sonnet-20241022';

-- =====================================================
-- PASO 3: AGREGAR COMENTARIOS
-- =====================================================

COMMENT ON COLUMN public.ai_tenant_config.ai_model IS
'Modelo de AI a usar. Default: claude-3-5-sonnet-20241022 (mejor balance costo/calidad).
Opciones recomendadas por caso de uso:
- Haiku 3.5: Alto volumen, respuestas rápidas, bajo costo
- Sonnet 3.5: Balance ideal (RECOMENDADO para mayoría)
- Opus 4.5: Máxima calidad, razonamiento complejo, alto costo';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

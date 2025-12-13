-- =====================================================
-- TIS TIS PLATFORM - CONFIGURACION DE MODELOS AI
-- Migration: 017_update_default_ai_model.sql
-- Date: December 13, 2024
-- Version: 3.0
--
-- MODELOS SELECCIONADOS POR CASO DE USO:
-- =====================================================
-- | Caso de Uso          | Modelo Principal | Alternativo        |
-- |---------------------|------------------|-------------------|
-- | Chat Bar Discovery  | gpt-5-nano       | gpt-4.1-nano      |
-- | Mensajes Auto       | gpt-5-mini       | claude-haiku-4-5  |
-- | Voz VAPI            | gpt-4o           | gpt-4o-mini       |
-- | Tareas Complejas    | gpt-5            | claude-sonnet-4-5 |
-- =====================================================
--
-- RAZONAMIENTO:
-- - GPT-5 Nano: $0.05/$0.40 MTok - Perfecto para chat discovery (barato + rapido)
-- - GPT-5 Mini: $0.25/$2.00 MTok - Balance calidad/precio para mensajes
-- - GPT-4o: $5/$15 MTok - Disenado para voz/video, ya probado en VAPI
-- - Los clientes NO eligen modelo, TIS TIS lo gestiona
-- =====================================================

-- =====================================================
-- PASO 1: ELIMINAR CONSTRAINT ANTERIOR
-- =====================================================

ALTER TABLE public.ai_tenant_config
    DROP CONSTRAINT IF EXISTS ai_tenant_config_ai_model_check;

-- =====================================================
-- PASO 2: CREAR CONSTRAINT CON MODELOS MODERNOS
-- Incluimos todos los modelos que podriamos necesitar
-- =====================================================

ALTER TABLE public.ai_tenant_config
    ADD CONSTRAINT ai_tenant_config_ai_model_check
    CHECK (ai_model IN (
        -- GPT-5 Family (Diciembre 2025) - PRINCIPALES
        'gpt-5-nano',           -- Chat Discovery ($0.05/$0.40)
        'gpt-5-mini',           -- Mensajes Auto ($0.25/$2.00) - DEFAULT
        'gpt-5',                -- Tareas complejas ($1.25/$10.00)

        -- GPT-5.x (Latest)
        'gpt-5.1',
        'gpt-5.2',

        -- GPT-4.1 Family (Backup economico)
        'gpt-4.1-nano',         -- Alternativa Discovery ($0.10/$0.40)
        'gpt-4.1-mini',
        'gpt-4.1',

        -- GPT-4o Family (Para VOZ/VAPI)
        'gpt-4o',               -- VAPI Voice ($5/$15) - Recomendado voz
        'gpt-4o-mini',          -- VAPI economico ($0.15/$0.60)

        -- Claude 4.5 (Alternativas premium)
        'claude-haiku-4-5-20251001',   -- Alternativa mensajes ($1/$5)
        'claude-sonnet-4-5-20250929',  -- Tareas complejas ($3/$15)
        'claude-opus-4-5-20251101'     -- Premium ($5/$25)
    ));

-- =====================================================
-- PASO 3: ESTABLECER GPT-5-MINI COMO DEFAULT
-- (Para mensajes automatizados - caso de uso principal)
-- =====================================================

ALTER TABLE public.ai_tenant_config
    ALTER COLUMN ai_model SET DEFAULT 'gpt-5-mini';

-- =====================================================
-- PASO 4: ACTUALIZAR REGISTROS EXISTENTES
-- Migrar modelos viejos al nuevo default
-- =====================================================

UPDATE public.ai_tenant_config
SET ai_model = 'gpt-5-mini'
WHERE ai_model IN (
    -- Modelos Claude legacy
    'claude-3-haiku-20240307',
    'claude-3-sonnet-20240229',
    'claude-3-opus-20240229',
    'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet-20241022',
    -- Modelos OpenAI legacy
    'gpt-4-turbo',
    'gpt-3.5-turbo'
);

-- =====================================================
-- PASO 5: AGREGAR COLUMNA PARA TIPO DE USO
-- Permite configurar modelo por tipo de tarea
-- =====================================================

DO $$
BEGIN
    -- Columna para modelo de chat (discovery/web)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_tenant_config' AND column_name = 'chat_model') THEN
        ALTER TABLE public.ai_tenant_config ADD COLUMN chat_model VARCHAR(100) DEFAULT 'gpt-5-nano';
    END IF;

    -- Columna para modelo de mensajes (WhatsApp/IG/FB/TikTok)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_tenant_config' AND column_name = 'messaging_model') THEN
        ALTER TABLE public.ai_tenant_config ADD COLUMN messaging_model VARCHAR(100) DEFAULT 'gpt-5-mini';
    END IF;

    -- Columna para modelo de voz (VAPI)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_tenant_config' AND column_name = 'voice_model') THEN
        ALTER TABLE public.ai_tenant_config ADD COLUMN voice_model VARCHAR(100) DEFAULT 'gpt-4o';
    END IF;
END $$;

-- =====================================================
-- PASO 6: DOCUMENTACION
-- =====================================================

COMMENT ON COLUMN public.ai_tenant_config.ai_model IS
'Modelo AI principal (legacy). Default: gpt-5-mini. Ver chat_model, messaging_model, voice_model para config por tipo.';

COMMENT ON COLUMN public.ai_tenant_config.chat_model IS
'Modelo para chat web/discovery. Default: gpt-5-nano ($0.05/$0.40 MTok). Ultra rapido y economico.';

COMMENT ON COLUMN public.ai_tenant_config.messaging_model IS
'Modelo para mensajes automatizados (WhatsApp/IG/FB/TikTok). Default: gpt-5-mini ($0.25/$2.00 MTok). Balance calidad/precio.';

COMMENT ON COLUMN public.ai_tenant_config.voice_model IS
'Modelo para asistente de voz VAPI. Default: gpt-4o ($5/$15 MTok). Optimizado para audio I/O.';

-- =====================================================
-- FIN DE LA MIGRACION
-- =====================================================

-- =====================================================
-- TIS TIS PLATFORM - FIX MULTI-CHANNEL SCHEMA
-- Migration: 016_fix_multichannel_schema.sql
-- Date: December 13, 2024
-- Version: 1.0
--
-- PURPOSE: Corregir el schema de channel_connections
-- para soportar correctamente todos los canales con
-- campos específicos por plataforma.
--
-- FIXES:
-- 1. Agregar campos específicos por canal (Instagram, Facebook, TikTok)
-- 2. Agregar campos de identificación social a leads
-- 3. Agregar job_types faltantes a job_queue CHECK constraint
-- 4. Crear función helper para increment_message_count
-- =====================================================

-- =====================================================
-- PARTE A: AGREGAR COLUMNAS A CHANNEL_CONNECTIONS
-- Campos específicos por plataforma de mensajería
-- =====================================================

DO $$
BEGIN
    -- Instagram - campos específicos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'instagram_page_id') THEN
        ALTER TABLE public.channel_connections ADD COLUMN instagram_page_id VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'instagram_account_id') THEN
        ALTER TABLE public.channel_connections ADD COLUMN instagram_account_id VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'instagram_username') THEN
        ALTER TABLE public.channel_connections ADD COLUMN instagram_username VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'instagram_access_token') THEN
        ALTER TABLE public.channel_connections ADD COLUMN instagram_access_token TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'instagram_verify_token') THEN
        ALTER TABLE public.channel_connections ADD COLUMN instagram_verify_token VARCHAR(255);
    END IF;

    -- Facebook - campos específicos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'facebook_page_id') THEN
        ALTER TABLE public.channel_connections ADD COLUMN facebook_page_id VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'facebook_page_name') THEN
        ALTER TABLE public.channel_connections ADD COLUMN facebook_page_name VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'facebook_access_token') THEN
        ALTER TABLE public.channel_connections ADD COLUMN facebook_access_token TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'facebook_verify_token') THEN
        ALTER TABLE public.channel_connections ADD COLUMN facebook_verify_token VARCHAR(255);
    END IF;

    -- TikTok - campos específicos (diferentes de la estructura original)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'tiktok_client_key') THEN
        ALTER TABLE public.channel_connections ADD COLUMN tiktok_client_key VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'tiktok_client_secret') THEN
        ALTER TABLE public.channel_connections ADD COLUMN tiktok_client_secret TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'tiktok_access_token') THEN
        ALTER TABLE public.channel_connections ADD COLUMN tiktok_access_token TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'tiktok_refresh_token') THEN
        ALTER TABLE public.channel_connections ADD COLUMN tiktok_refresh_token TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'tiktok_open_id') THEN
        ALTER TABLE public.channel_connections ADD COLUMN tiktok_open_id VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'tiktok_verify_token') THEN
        ALTER TABLE public.channel_connections ADD COLUMN tiktok_verify_token VARCHAR(255);
    END IF;

    -- Campo genérico para access_token (compatibilidad con código existente)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'channel_connections' AND column_name = 'access_token') THEN
        ALTER TABLE public.channel_connections ADD COLUMN access_token TEXT;
    END IF;

END $$;

-- Crear índices para los nuevos campos
CREATE INDEX IF NOT EXISTS idx_channel_connections_instagram
    ON public.channel_connections(instagram_page_id)
    WHERE channel = 'instagram';

CREATE INDEX IF NOT EXISTS idx_channel_connections_facebook
    ON public.channel_connections(facebook_page_id)
    WHERE channel = 'facebook';

CREATE INDEX IF NOT EXISTS idx_channel_connections_tiktok
    ON public.channel_connections(tiktok_client_key)
    WHERE channel = 'tiktok';

COMMENT ON COLUMN public.channel_connections.instagram_page_id IS 'ID de la página de Instagram conectada';
COMMENT ON COLUMN public.channel_connections.facebook_page_id IS 'ID de la página de Facebook conectada';
COMMENT ON COLUMN public.channel_connections.tiktok_client_key IS 'Client Key de la aplicación TikTok';

-- =====================================================
-- PARTE B: AGREGAR COLUMNAS SOCIALES A LEADS
-- Para identificar leads en cada plataforma
-- =====================================================

DO $$
BEGIN
    -- Instagram PSID (Page-Scoped ID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'instagram_psid') THEN
        ALTER TABLE public.leads ADD COLUMN instagram_psid VARCHAR(255);
    END IF;

    -- Instagram username (para referencia)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'instagram_username') THEN
        ALTER TABLE public.leads ADD COLUMN instagram_username VARCHAR(255);
    END IF;

    -- Facebook PSID (Page-Scoped ID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'facebook_psid') THEN
        ALTER TABLE public.leads ADD COLUMN facebook_psid VARCHAR(255);
    END IF;

    -- TikTok Open ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'tiktok_open_id') THEN
        ALTER TABLE public.leads ADD COLUMN tiktok_open_id VARCHAR(255);
    END IF;

    -- URL de imagen de perfil (de cualquier plataforma)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'profile_image_url') THEN
        ALTER TABLE public.leads ADD COLUMN profile_image_url TEXT;
    END IF;

END $$;

-- Crear índices para búsqueda rápida por ID social
CREATE INDEX IF NOT EXISTS idx_leads_instagram_psid
    ON public.leads(tenant_id, instagram_psid)
    WHERE instagram_psid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_facebook_psid
    ON public.leads(tenant_id, facebook_psid)
    WHERE facebook_psid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tiktok_open_id
    ON public.leads(tenant_id, tiktok_open_id)
    WHERE tiktok_open_id IS NOT NULL;

COMMENT ON COLUMN public.leads.instagram_psid IS 'Page-Scoped ID de Instagram para este lead';
COMMENT ON COLUMN public.leads.facebook_psid IS 'Page-Scoped ID de Facebook para este lead';
COMMENT ON COLUMN public.leads.tiktok_open_id IS 'Open ID de TikTok para este lead';

-- =====================================================
-- PARTE C: ACTUALIZAR JOB_QUEUE CHECK CONSTRAINT
-- Agregar tipos de job faltantes para envío de mensajes
-- =====================================================

-- Eliminar constraint existente y crear una nueva más completa
DO $$
BEGIN
    -- Intentar eliminar el constraint existente
    ALTER TABLE public.job_queue DROP CONSTRAINT IF EXISTS job_queue_job_type_check;

    -- Crear nuevo constraint con todos los job types
    ALTER TABLE public.job_queue ADD CONSTRAINT job_queue_job_type_check
        CHECK (job_type IN (
            -- Respuesta AI
            'ai_response',
            -- Envío de mensajes por canal
            'send_message',           -- Genérico (legacy)
            'send_whatsapp',          -- WhatsApp específico
            'send_instagram',         -- Instagram DM específico
            'send_facebook',          -- Facebook Messenger específico
            'send_tiktok',            -- TikTok DM específico
            -- Scoring y escalación
            'update_lead_score',
            'escalate_conversation',
            -- Recordatorios y notificaciones
            'send_reminder',
            'send_notification',
            -- Reportes
            'daily_report',
            'weekly_report',
            -- Sincronización
            'sync_contact',
            -- Media
            'process_media',
            'download_media',
            -- Otros
            'cleanup_old_jobs',
            'refresh_token'
        ));
EXCEPTION
    WHEN OTHERS THEN
        -- Si falla, probablemente el constraint no existe o tiene otro nombre
        RAISE NOTICE 'Could not update job_type constraint: %', SQLERRM;
END $$;

-- =====================================================
-- PARTE D: FUNCIONES HELPER FALTANTES
-- =====================================================

-- Función para incrementar contador de mensajes en conversación
-- (Usada en saveIncomingMessage)
CREATE OR REPLACE FUNCTION public.increment_conversation_message_count(
    p_conversation_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.conversations
    SET message_count = COALESCE(message_count, 0) + 1,
        last_message_at = NOW(),
        updated_at = NOW()
    WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.increment_conversation_message_count IS
'Incrementa el contador de mensajes de una conversación de forma atómica';

-- Función alternativa que acepta el valor actual como parámetro
CREATE OR REPLACE FUNCTION public.increment_count(current_value INTEGER DEFAULT 0)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(current_value, 0) + 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PARTE E: AGREGAR COLUMNAS A MESSAGES
-- Para mejor tracking de errores
-- =====================================================

DO $$
BEGIN
    -- Mensaje de error si el envío falla
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'messages' AND column_name = 'error_message') THEN
        ALTER TABLE public.messages ADD COLUMN error_message TEXT;
    END IF;

    -- ID externo (WhatsApp message ID, Meta message ID, etc.)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'messages' AND column_name = 'external_id') THEN
        ALTER TABLE public.messages ADD COLUMN external_id VARCHAR(255);
    END IF;

    -- Timestamp de envío exitoso
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'messages' AND column_name = 'sent_at') THEN
        ALTER TABLE public.messages ADD COLUMN sent_at TIMESTAMPTZ;
    END IF;

END $$;

CREATE INDEX IF NOT EXISTS idx_messages_external_id
    ON public.messages(external_id)
    WHERE external_id IS NOT NULL;

-- =====================================================
-- PARTE F: AGREGAR CAMPO message_count A CONVERSATIONS
-- Si no existe
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conversations' AND column_name = 'message_count') THEN
        ALTER TABLE public.conversations ADD COLUMN message_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

COMMENT ON SCHEMA public IS
'TIS TIS Platform - Schema con correcciones multi-canal. Migration 016.';

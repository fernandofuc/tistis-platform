-- =====================================================
-- TIS TIS PLATFORM - Lead Cross-Channel Identity System
-- Migration 113: Unificar leads entre canales
-- =====================================================
-- PROBLEMA:
-- Un mismo cliente puede contactar por WhatsApp, Instagram,
-- Facebook, TikTok y cada canal crea un lead separado.
-- Esto fragmenta los puntos de loyalty, historial, etc.
--
-- SOLUCIÓN:
-- 1. Función para vincular identidad de canal a lead existente
-- 2. Búsqueda inteligente por múltiples identificadores
-- 3. Merge de balances de loyalty al vincular
-- =====================================================

-- =====================================================
-- 0. PREREQUISITOS: Asegurar columnas en leads
-- =====================================================
-- Estas columnas pueden no existir si migraciones anteriores no se ejecutaron

-- Instagram PSID
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'instagram_psid') THEN
        ALTER TABLE public.leads ADD COLUMN instagram_psid VARCHAR(255);
    END IF;
END $$;

-- Instagram username
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'instagram_username') THEN
        ALTER TABLE public.leads ADD COLUMN instagram_username VARCHAR(255);
    END IF;
END $$;

-- Facebook PSID
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'facebook_psid') THEN
        ALTER TABLE public.leads ADD COLUMN facebook_psid VARCHAR(255);
    END IF;
END $$;

-- TikTok open_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'tiktok_open_id') THEN
        ALTER TABLE public.leads ADD COLUMN tiktok_open_id VARCHAR(255);
    END IF;
END $$;

-- Profile image URL
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'profile_image_url') THEN
        ALTER TABLE public.leads ADD COLUMN profile_image_url TEXT;
    END IF;
END $$;

-- last_interaction_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'last_interaction_at') THEN
        ALTER TABLE public.leads ADD COLUMN last_interaction_at TIMESTAMPTZ;
    END IF;
END $$;

-- first_contact_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'first_contact_at') THEN
        ALTER TABLE public.leads ADD COLUMN first_contact_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- name (alias for display)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'name') THEN
        ALTER TABLE public.leads ADD COLUMN name VARCHAR(255);
    END IF;
END $$;

-- deleted_at (for soft deletes)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.leads ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- =====================================================
-- 1. FUNCIÓN: link_lead_channel_identity
-- Vincula una nueva identidad de canal a un lead existente
-- =====================================================

CREATE OR REPLACE FUNCTION public.link_lead_channel_identity(
    p_lead_id UUID,
    p_channel TEXT,  -- 'whatsapp', 'instagram', 'facebook', 'tiktok'
    p_identifier TEXT,  -- phone_normalized, psid, or open_id
    p_extra_data JSONB DEFAULT NULL  -- username, profile_pic, etc.
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_field_name TEXT;
    v_existing_lead_id UUID;
BEGIN
    -- Get lead's tenant
    SELECT tenant_id INTO v_tenant_id
    FROM leads WHERE id = p_lead_id;

    IF v_tenant_id IS NULL THEN
        RETURN QUERY SELECT false, 'Lead no encontrado'::TEXT;
        RETURN;
    END IF;

    -- Determine field name based on channel
    CASE p_channel
        WHEN 'whatsapp' THEN v_field_name := 'phone_normalized';
        WHEN 'instagram' THEN v_field_name := 'instagram_psid';
        WHEN 'facebook' THEN v_field_name := 'facebook_psid';
        WHEN 'tiktok' THEN v_field_name := 'tiktok_open_id';
        ELSE
            RETURN QUERY SELECT false, 'Canal no soportado'::TEXT;
            RETURN;
    END CASE;

    -- Check if identifier already linked to another lead
    EXECUTE format(
        'SELECT id FROM leads WHERE tenant_id = $1 AND %I = $2 AND deleted_at IS NULL',
        v_field_name
    ) INTO v_existing_lead_id USING v_tenant_id, p_identifier;

    IF v_existing_lead_id IS NOT NULL AND v_existing_lead_id != p_lead_id THEN
        -- Another lead has this identifier - need merge
        RETURN QUERY SELECT false,
            format('Identificador ya asociado a otro lead (%s). Use merge_leads para unificar.', v_existing_lead_id)::TEXT;
        RETURN;
    END IF;

    -- Update the lead with the new channel identity
    EXECUTE format(
        'UPDATE leads SET %I = $1, updated_at = NOW() WHERE id = $2',
        v_field_name
    ) USING p_identifier, p_lead_id;

    -- Update extra data if provided
    IF p_extra_data IS NOT NULL THEN
        -- Instagram username
        IF p_channel = 'instagram' AND p_extra_data->>'username' IS NOT NULL THEN
            UPDATE leads SET instagram_username = p_extra_data->>'username'
            WHERE id = p_lead_id;
        END IF;

        -- Profile image (any channel)
        IF p_extra_data->>'profile_pic' IS NOT NULL THEN
            UPDATE leads SET profile_image_url = p_extra_data->>'profile_pic'
            WHERE id = p_lead_id AND profile_image_url IS NULL;
        END IF;

        -- Phone (from social profile)
        IF p_extra_data->>'phone' IS NOT NULL AND p_channel != 'whatsapp' THEN
            UPDATE leads SET phone = p_extra_data->>'phone'
            WHERE id = p_lead_id AND phone IS NULL;
        END IF;

        -- Email (from social profile)
        IF p_extra_data->>'email' IS NOT NULL THEN
            UPDATE leads SET email = p_extra_data->>'email'
            WHERE id = p_lead_id AND email IS NULL;
        END IF;
    END IF;

    RETURN QUERY SELECT true, 'Identidad vinculada exitosamente'::TEXT;
END;
$$;

-- =====================================================
-- 2. FUNCIÓN: find_lead_by_any_identity
-- Busca un lead por cualquier identificador conocido
-- =====================================================

CREATE OR REPLACE FUNCTION public.find_lead_by_any_identity(
    p_tenant_id UUID,
    p_phone_normalized TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_instagram_psid TEXT DEFAULT NULL,
    p_facebook_psid TEXT DEFAULT NULL,
    p_tiktok_open_id TEXT DEFAULT NULL
)
RETURNS TABLE(
    lead_id UUID,
    lead_name TEXT,
    match_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Priority 1: Phone (most reliable identifier)
    IF p_phone_normalized IS NOT NULL THEN
        RETURN QUERY
        SELECT l.id, COALESCE(l.full_name, l.name, 'Desconocido'), 'phone'::TEXT
        FROM leads l
        WHERE l.tenant_id = p_tenant_id
          AND l.phone_normalized = p_phone_normalized
          AND l.deleted_at IS NULL
        LIMIT 1;

        IF FOUND THEN RETURN; END IF;
    END IF;

    -- Priority 2: Email (very reliable)
    IF p_email IS NOT NULL THEN
        RETURN QUERY
        SELECT l.id, COALESCE(l.full_name, l.name, 'Desconocido'), 'email'::TEXT
        FROM leads l
        WHERE l.tenant_id = p_tenant_id
          AND LOWER(l.email) = LOWER(p_email)
          AND l.deleted_at IS NULL
        LIMIT 1;

        IF FOUND THEN RETURN; END IF;
    END IF;

    -- Priority 3: Instagram PSID
    IF p_instagram_psid IS NOT NULL THEN
        RETURN QUERY
        SELECT l.id, COALESCE(l.full_name, l.name, 'Desconocido'), 'instagram'::TEXT
        FROM leads l
        WHERE l.tenant_id = p_tenant_id
          AND l.instagram_psid = p_instagram_psid
          AND l.deleted_at IS NULL
        LIMIT 1;

        IF FOUND THEN RETURN; END IF;
    END IF;

    -- Priority 4: Facebook PSID
    IF p_facebook_psid IS NOT NULL THEN
        RETURN QUERY
        SELECT l.id, COALESCE(l.full_name, l.name, 'Desconocido'), 'facebook'::TEXT
        FROM leads l
        WHERE l.tenant_id = p_tenant_id
          AND l.facebook_psid = p_facebook_psid
          AND l.deleted_at IS NULL
        LIMIT 1;

        IF FOUND THEN RETURN; END IF;
    END IF;

    -- Priority 5: TikTok Open ID
    IF p_tiktok_open_id IS NOT NULL THEN
        RETURN QUERY
        SELECT l.id, COALESCE(l.full_name, l.name, 'Desconocido'), 'tiktok'::TEXT
        FROM leads l
        WHERE l.tenant_id = p_tenant_id
          AND l.tiktok_open_id = p_tiktok_open_id
          AND l.deleted_at IS NULL
        LIMIT 1;

        IF FOUND THEN RETURN; END IF;
    END IF;

    -- No match found
    RETURN;
END;
$$;

-- =====================================================
-- 3. FUNCIÓN: merge_leads
-- Une dos leads en uno, consolidando todos los datos
-- =====================================================

CREATE OR REPLACE FUNCTION public.merge_leads(
    p_primary_lead_id UUID,   -- Lead que se mantiene (target)
    p_secondary_lead_id UUID, -- Lead que se fusiona (source, será soft-deleted)
    p_merge_loyalty BOOLEAN DEFAULT true,
    p_merged_by UUID DEFAULT NULL  -- Usuario que ejecuta el merge
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    conversations_moved INTEGER,
    messages_moved INTEGER,
    loyalty_merged BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_primary_tenant UUID;
    v_secondary_tenant UUID;
    v_conversations_moved INTEGER := 0;
    v_messages_moved INTEGER := 0;
    v_loyalty_merged BOOLEAN := false;
    v_primary_balance_id UUID;
    v_secondary_balance_id UUID;
    v_secondary_balance INTEGER;
    v_secondary_earned INTEGER;
    v_secondary_spent INTEGER;
    v_lock_key BIGINT;
    v_program_id UUID;  -- Used in loyalty balance merge loop
BEGIN
    -- CRITICAL: Advisory lock to prevent concurrent merges of same leads
    -- Use smaller of two IDs to ensure consistent lock ordering
    IF p_primary_lead_id < p_secondary_lead_id THEN
        v_lock_key := hashtext(p_primary_lead_id::TEXT || ':' || p_secondary_lead_id::TEXT);
    ELSE
        v_lock_key := hashtext(p_secondary_lead_id::TEXT || ':' || p_primary_lead_id::TEXT);
    END IF;
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Validate both leads exist and belong to same tenant
    SELECT tenant_id INTO v_primary_tenant FROM leads WHERE id = p_primary_lead_id AND deleted_at IS NULL;
    SELECT tenant_id INTO v_secondary_tenant FROM leads WHERE id = p_secondary_lead_id AND deleted_at IS NULL;

    IF v_primary_tenant IS NULL THEN
        RETURN QUERY SELECT false, 'Lead primario no encontrado'::TEXT, 0, 0, false;
        RETURN;
    END IF;

    IF v_secondary_tenant IS NULL THEN
        RETURN QUERY SELECT false, 'Lead secundario no encontrado'::TEXT, 0, 0, false;
        RETURN;
    END IF;

    IF v_primary_tenant != v_secondary_tenant THEN
        RETURN QUERY SELECT false, 'Los leads pertenecen a diferentes tenants'::TEXT, 0, 0, false;
        RETURN;
    END IF;

    IF p_primary_lead_id = p_secondary_lead_id THEN
        RETURN QUERY SELECT false, 'No se puede fusionar un lead consigo mismo'::TEXT, 0, 0, false;
        RETURN;
    END IF;

    -- 1. Move conversations to primary lead
    UPDATE conversations
    SET lead_id = p_primary_lead_id, updated_at = NOW()
    WHERE lead_id = p_secondary_lead_id;
    GET DIAGNOSTICS v_conversations_moved = ROW_COUNT;

    -- 2. Move messages to primary lead
    UPDATE messages
    SET lead_id = p_primary_lead_id
    WHERE lead_id = p_secondary_lead_id;
    GET DIAGNOSTICS v_messages_moved = ROW_COUNT;

    -- 3. Move appointments to primary lead
    UPDATE appointments
    SET lead_id = p_primary_lead_id, updated_at = NOW()
    WHERE lead_id = p_secondary_lead_id;

    -- 4. Merge loyalty balances if requested
    -- NOTE: A lead can have multiple balances (one per program_id)
    IF p_merge_loyalty THEN
        -- For each balance the secondary lead has, merge with primary's balance for same program
        FOR v_secondary_balance_id, v_secondary_balance, v_secondary_earned, v_secondary_spent IN
            SELECT id, current_balance, total_earned, total_spent
            FROM loyalty_balances
            WHERE lead_id = p_secondary_lead_id
        LOOP
            -- Get the program_id for this balance
            SELECT program_id INTO v_program_id
            FROM loyalty_balances WHERE id = v_secondary_balance_id;

            -- Check if primary lead has a balance for the same program
            SELECT id INTO v_primary_balance_id
            FROM loyalty_balances
            WHERE lead_id = p_primary_lead_id AND program_id = v_program_id;

            IF v_primary_balance_id IS NOT NULL THEN
                -- Both have balances for same program: add secondary to primary
                UPDATE loyalty_balances
                SET
                    current_balance = current_balance + COALESCE(v_secondary_balance, 0),
                    total_earned = total_earned + COALESCE(v_secondary_earned, 0),
                    total_spent = total_spent + COALESCE(v_secondary_spent, 0),
                    updated_at = NOW()
                WHERE id = v_primary_balance_id;

                -- Move transactions from secondary balance to primary balance
                UPDATE loyalty_transactions
                SET balance_id = v_primary_balance_id, updated_at = NOW()
                WHERE balance_id = v_secondary_balance_id;

                -- Delete the secondary balance (now empty)
                DELETE FROM loyalty_balances WHERE id = v_secondary_balance_id;
            ELSE
                -- Only secondary has balance for this program: move it to primary lead
                UPDATE loyalty_balances
                SET lead_id = p_primary_lead_id, updated_at = NOW()
                WHERE id = v_secondary_balance_id;
            END IF;

            v_loyalty_merged := true;
        END LOOP;

        -- Move ALL loyalty redemptions to primary lead (regardless of program)
        UPDATE loyalty_redemptions
        SET lead_id = p_primary_lead_id, updated_at = NOW()
        WHERE lead_id = p_secondary_lead_id;

        -- Move ALL loyalty memberships to primary lead
        UPDATE loyalty_memberships
        SET lead_id = p_primary_lead_id, updated_at = NOW()
        WHERE lead_id = p_secondary_lead_id;
    END IF;

    -- 5. Copy channel identities from secondary to primary (if primary doesn't have them)
    UPDATE leads
    SET
        phone_normalized = COALESCE(phone_normalized, (SELECT phone_normalized FROM leads WHERE id = p_secondary_lead_id)),
        phone = COALESCE(phone, (SELECT phone FROM leads WHERE id = p_secondary_lead_id)),
        email = COALESCE(email, (SELECT email FROM leads WHERE id = p_secondary_lead_id)),
        instagram_psid = COALESCE(instagram_psid, (SELECT instagram_psid FROM leads WHERE id = p_secondary_lead_id)),
        instagram_username = COALESCE(instagram_username, (SELECT instagram_username FROM leads WHERE id = p_secondary_lead_id)),
        facebook_psid = COALESCE(facebook_psid, (SELECT facebook_psid FROM leads WHERE id = p_secondary_lead_id)),
        tiktok_open_id = COALESCE(tiktok_open_id, (SELECT tiktok_open_id FROM leads WHERE id = p_secondary_lead_id)),
        profile_image_url = COALESCE(profile_image_url, (SELECT profile_image_url FROM leads WHERE id = p_secondary_lead_id)),
        updated_at = NOW()
    WHERE id = p_primary_lead_id;

    -- 6. Soft-delete the secondary lead
    UPDATE leads
    SET
        deleted_at = NOW(),
        status = 'merged',
        notes = COALESCE(notes, '') || E'\n[MERGED] Fusionado con lead ' || p_primary_lead_id::TEXT || ' el ' || NOW()::TEXT
    WHERE id = p_secondary_lead_id;

    -- 7. Log the merge (only if audit_logs table exists)
    -- NOTE: audit_logs table uses 'metadata' column, not 'details'
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
        INSERT INTO public.audit_logs (tenant_id, action, entity_type, entity_id, metadata, user_id, created_at)
        VALUES (
            v_primary_tenant,
            'lead_merged',
            'lead',
            p_primary_lead_id,
            jsonb_build_object(
                'primary_lead_id', p_primary_lead_id,
                'secondary_lead_id', p_secondary_lead_id,
                'conversations_moved', v_conversations_moved,
                'messages_moved', v_messages_moved,
                'loyalty_merged', v_loyalty_merged
            ),
            p_merged_by,
            NOW()
        );
    END IF;

    RETURN QUERY SELECT
        true,
        format('Leads fusionados exitosamente. Conversaciones: %s, Mensajes: %s', v_conversations_moved, v_messages_moved)::TEXT,
        v_conversations_moved,
        v_messages_moved,
        v_loyalty_merged;
END;
$$;

-- =====================================================
-- 4. FUNCIÓN MEJORADA: find_or_create_lead_smart
-- Versión inteligente que busca por múltiples identidades
-- antes de crear un nuevo lead
-- =====================================================

CREATE OR REPLACE FUNCTION public.find_or_create_lead_smart(
    p_tenant_id UUID,
    p_branch_id UUID,
    p_channel TEXT,           -- 'whatsapp', 'instagram', 'facebook', 'tiktok'
    p_identifier TEXT,        -- primary identifier for this channel
    p_contact_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL  -- phone if known from profile
)
RETURNS TABLE(
    lead_id UUID,
    lead_name TEXT,
    is_new BOOLEAN,
    was_linked BOOLEAN,       -- true if existing lead was linked to new channel
    match_type TEXT,          -- 'direct', 'cross_channel_linked', 'new'
    matched_channel TEXT      -- channel that matched (for cross_channel_linked)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lead_id UUID;
    v_lead_name TEXT;
    v_is_new BOOLEAN := false;
    v_was_linked BOOLEAN := false;
    v_match_type TEXT := 'new';
    v_matched_channel TEXT := NULL;
    v_lock_key BIGINT;
    v_field_name TEXT;
    v_phone_normalized TEXT;
    v_match_result RECORD;
BEGIN
    -- Normalize phone if provided
    IF p_phone IS NOT NULL THEN
        v_phone_normalized := regexp_replace(p_phone, '[^0-9+]', '', 'g');
    END IF;

    -- Determine field name based on channel
    CASE p_channel
        WHEN 'whatsapp' THEN
            v_field_name := 'phone_normalized';
            v_phone_normalized := regexp_replace(p_identifier, '[^0-9+]', '', 'g');
        WHEN 'instagram' THEN v_field_name := 'instagram_psid';
        WHEN 'facebook' THEN v_field_name := 'facebook_psid';
        WHEN 'tiktok' THEN v_field_name := 'tiktok_open_id';
        ELSE
            RAISE EXCEPTION 'Canal no soportado: %', p_channel;
    END CASE;

    -- Generate lock key
    v_lock_key := hashtext(p_tenant_id::TEXT || ':' || p_channel || ':' || p_identifier);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- First: Try to find by the channel-specific identifier
    EXECUTE format(
        'SELECT id, COALESCE(full_name, name, ''Desconocido'') FROM leads
         WHERE tenant_id = $1 AND %I = $2 AND deleted_at IS NULL LIMIT 1',
        v_field_name
    ) INTO v_lead_id, v_lead_name USING p_tenant_id, p_identifier;

    IF v_lead_id IS NOT NULL THEN
        -- Found by direct channel match - update last interaction
        UPDATE leads SET last_interaction_at = NOW() WHERE id = v_lead_id;
        RETURN QUERY SELECT v_lead_id, v_lead_name, false, false, 'direct'::TEXT, p_channel::TEXT;
        RETURN;
    END IF;

    -- Second: Try to find by phone or email (cross-channel match)
    SELECT * INTO v_match_result FROM find_lead_by_any_identity(
        p_tenant_id,
        v_phone_normalized,
        p_email,
        CASE WHEN p_channel = 'instagram' THEN p_identifier ELSE NULL END,
        CASE WHEN p_channel = 'facebook' THEN p_identifier ELSE NULL END,
        CASE WHEN p_channel = 'tiktok' THEN p_identifier ELSE NULL END
    );

    IF v_match_result.lead_id IS NOT NULL THEN
        -- Found existing lead by another identity - link this channel
        v_lead_id := v_match_result.lead_id;
        v_lead_name := v_match_result.lead_name;
        v_matched_channel := v_match_result.match_type;  -- 'phone', 'email', 'instagram', etc.

        -- Link the new channel identity to existing lead
        EXECUTE format(
            'UPDATE leads SET %I = $1, updated_at = NOW(), last_interaction_at = NOW() WHERE id = $2',
            v_field_name
        ) USING p_identifier, v_lead_id;

        v_was_linked := true;
        v_match_type := 'cross_channel_linked';

        RAISE NOTICE '[Lead Smart] Linked % identity to existing lead % (matched by %)',
            p_channel, v_lead_id, v_matched_channel;

        RETURN QUERY SELECT v_lead_id, v_lead_name, false, true, v_match_type, v_matched_channel;
        RETURN;
    END IF;

    -- Third: No match found - create new lead
    INSERT INTO leads (
        tenant_id,
        branch_id,
        phone,
        phone_normalized,
        email,
        full_name,
        name,
        source,
        status,
        classification,
        score,
        first_contact_at,
        last_interaction_at,
        created_at
    ) VALUES (
        p_tenant_id,
        p_branch_id,
        CASE WHEN p_channel = 'whatsapp' THEN p_identifier ELSE p_phone END,
        v_phone_normalized,
        p_email,
        COALESCE(p_contact_name, 'Desconocido'),
        COALESCE(p_contact_name, 'Desconocido'),
        p_channel,
        'new',
        'warm',
        50,
        NOW(),
        NOW(),
        NOW()
    )
    RETURNING id, COALESCE(full_name, name) INTO v_lead_id, v_lead_name;

    -- Set channel-specific identifier
    IF p_channel != 'whatsapp' THEN
        EXECUTE format(
            'UPDATE leads SET %I = $1 WHERE id = $2',
            v_field_name
        ) USING p_identifier, v_lead_id;
    END IF;

    v_is_new := true;
    v_match_type := 'new';

    RETURN QUERY SELECT v_lead_id, v_lead_name, true, false, v_match_type, NULL::TEXT;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION link_lead_channel_identity TO authenticated;
GRANT EXECUTE ON FUNCTION link_lead_channel_identity TO service_role;
GRANT EXECUTE ON FUNCTION find_lead_by_any_identity TO authenticated;
GRANT EXECUTE ON FUNCTION find_lead_by_any_identity TO service_role;
GRANT EXECUTE ON FUNCTION merge_leads TO authenticated;
GRANT EXECUTE ON FUNCTION merge_leads TO service_role;
GRANT EXECUTE ON FUNCTION find_or_create_lead_smart TO authenticated;
GRANT EXECUTE ON FUNCTION find_or_create_lead_smart TO service_role;

-- =====================================================
-- 5. ASEGURAR COLUMNAS EN audit_logs
-- =====================================================
-- La tabla audit_logs puede haber sido creada en 001_initial_schema.sql sin tenant_id
-- Agregar columnas faltantes si no existen

-- Agregar tenant_id si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
          AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN tenant_id UUID;
        CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
    END IF;
END $$;

-- Agregar staff_id si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
          AND column_name = 'staff_id'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN staff_id UUID;
    END IF;
END $$;

-- Agregar status si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
          AND column_name = 'status'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN status VARCHAR(20) DEFAULT 'success';
    END IF;
END $$;

-- Agregar request_id si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
          AND column_name = 'request_id'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN request_id VARCHAR(100);
    END IF;
END $$;

-- Agregar error_message si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'audit_logs'
          AND column_name = 'error_message'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN error_message TEXT;
    END IF;
END $$;

-- =====================================================
-- 6. ÍNDICES PARA BÚSQUEDAS CROSS-CHANNEL
-- Optimizan find_lead_by_any_identity y find_or_create_lead_smart
-- =====================================================

-- Index for phone lookups (most common cross-channel identifier)
CREATE INDEX IF NOT EXISTS idx_leads_phone_normalized_tenant
    ON leads(tenant_id, phone_normalized)
    WHERE deleted_at IS NULL AND phone_normalized IS NOT NULL;

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_leads_email_tenant
    ON leads(tenant_id, LOWER(email))
    WHERE deleted_at IS NULL AND email IS NOT NULL;

-- Index for Instagram PSID lookups
CREATE INDEX IF NOT EXISTS idx_leads_instagram_psid_tenant
    ON leads(tenant_id, instagram_psid)
    WHERE deleted_at IS NULL AND instagram_psid IS NOT NULL;

-- Index for Facebook PSID lookups
CREATE INDEX IF NOT EXISTS idx_leads_facebook_psid_tenant
    ON leads(tenant_id, facebook_psid)
    WHERE deleted_at IS NULL AND facebook_psid IS NOT NULL;

-- Index for TikTok open_id lookups
CREATE INDEX IF NOT EXISTS idx_leads_tiktok_open_id_tenant
    ON leads(tenant_id, tiktok_open_id)
    WHERE deleted_at IS NULL AND tiktok_open_id IS NOT NULL;

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION link_lead_channel_identity IS
'Vincula una nueva identidad de canal (phone, psid, etc.) a un lead existente.
Útil cuando el agente obtiene el teléfono de un cliente de Instagram.';

COMMENT ON FUNCTION find_lead_by_any_identity IS
'Busca un lead por cualquier identificador conocido (phone, email, psid).
Prioridad: phone > email > instagram > facebook > tiktok.';

COMMENT ON FUNCTION merge_leads IS
'Fusiona dos leads en uno, moviendo conversaciones, mensajes, citas y loyalty.
El lead secundario queda marcado como "merged" (soft-delete).';

COMMENT ON FUNCTION find_or_create_lead_smart IS
'Versión inteligente de find_or_create_lead que busca por múltiples identidades
antes de crear un nuevo lead. Detecta si un cliente de Instagram ya existe
por su teléfono de WhatsApp y los vincula automáticamente.';

-- =====================================================
-- MIGRACIÓN COMPLETADA
-- =====================================================

SELECT 'Migration 113: Lead Cross-Channel Identity System - COMPLETED' as status;

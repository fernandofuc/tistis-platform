-- =====================================================
-- TIS TIS PLATFORM - Fix Messages Role/Sender Type Sync
-- Migration: 184_FIX_MESSAGES_ROLE_SENDER_TYPE_SYNC.sql
-- Date: January 31, 2026
-- Version: 1.0
--
-- PURPOSE: Synchronize 'role' and 'sender_type' fields in messages table
--
-- CONTEXT:
-- - Migration 012 created messages.role as NOT NULL with values: user, assistant, system, staff
-- - Migration 110 added messages.sender_type with values: lead, ai, staff, system
-- - Some code inserts only sender_type (RPCs) while other code inserts only role
-- - Inbox page.tsx reads 'role' field to determine message sender
-- - This caused messages to not appear correctly in Inbox
--
-- MAPPING:
-- - role='user' ↔ sender_type='lead' (incoming message from lead/customer)
-- - role='assistant' ↔ sender_type='ai' (AI response)
-- - role='staff' ↔ sender_type='staff' (staff message)
-- - role='system' ↔ sender_type='system' (system message)
--
-- SOLUTION:
-- 1. Create trigger to auto-sync both fields on INSERT/UPDATE
-- 2. Backfill existing messages that have sender_type but NULL role
-- 3. Update save_incoming_message RPC to include role field
-- =====================================================

BEGIN;

-- =====================================================
-- PART 1: CREATE SYNC FUNCTION
-- Keeps role and sender_type synchronized on INSERT/UPDATE
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_message_role_sender_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If role is set but sender_type is not, derive sender_type from role
    IF NEW.role IS NOT NULL AND (NEW.sender_type IS NULL OR NEW.sender_type = 'user') THEN
        NEW.sender_type := CASE NEW.role
            WHEN 'user' THEN 'lead'
            WHEN 'assistant' THEN 'ai'
            WHEN 'staff' THEN 'staff'
            WHEN 'system' THEN 'system'
            ELSE 'lead'  -- Default fallback
        END;
    END IF;

    -- If sender_type is set but role is not, derive role from sender_type
    IF NEW.sender_type IS NOT NULL AND NEW.role IS NULL THEN
        NEW.role := CASE NEW.sender_type
            WHEN 'lead' THEN 'user'
            WHEN 'ai' THEN 'assistant'
            WHEN 'staff' THEN 'staff'
            WHEN 'system' THEN 'system'
            ELSE 'user'  -- Default fallback
        END;
    END IF;

    -- Ensure both are always set (defensive programming)
    IF NEW.role IS NULL THEN
        NEW.role := 'user';
    END IF;
    IF NEW.sender_type IS NULL THEN
        NEW.sender_type := 'lead';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_message_role_sender_type IS
'Synchronizes role and sender_type fields in messages table.
Mapping: user↔lead, assistant↔ai, staff↔staff, system↔system';

-- =====================================================
-- PART 2: CREATE TRIGGER
-- Fires BEFORE INSERT OR UPDATE to ensure sync
-- =====================================================

-- Drop existing trigger if exists (idempotent)
DROP TRIGGER IF EXISTS trigger_sync_message_role_sender_type ON public.messages;

-- Create new trigger
CREATE TRIGGER trigger_sync_message_role_sender_type
    BEFORE INSERT OR UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION sync_message_role_sender_type();

-- Log success (must be inside DO block)
DO $$
BEGIN
    RAISE NOTICE 'Created trigger: trigger_sync_message_role_sender_type';
END $$;

-- =====================================================
-- PART 3: BACKFILL EXISTING MESSAGES
-- Fix messages that have sender_type but missing/wrong role
-- =====================================================

-- Update messages where sender_type is set but role doesn't match
UPDATE public.messages
SET role = CASE sender_type
    WHEN 'lead' THEN 'user'
    WHEN 'ai' THEN 'assistant'
    WHEN 'staff' THEN 'staff'
    WHEN 'system' THEN 'system'
    ELSE 'user'
END
WHERE (
    -- Messages with sender_type='ai' but role not 'assistant'
    (sender_type = 'ai' AND (role IS NULL OR role != 'assistant'))
    OR
    -- Messages with sender_type='lead' but role not 'user'
    (sender_type = 'lead' AND (role IS NULL OR role != 'user'))
    OR
    -- Messages with sender_type='staff' but role not 'staff'
    (sender_type = 'staff' AND (role IS NULL OR role != 'staff'))
    OR
    -- Messages with sender_type='system' but role not 'system'
    (sender_type = 'system' AND (role IS NULL OR role != 'system'))
);

-- Also sync sender_type for messages that have role but default sender_type
UPDATE public.messages
SET sender_type = CASE role
    WHEN 'user' THEN 'lead'
    WHEN 'assistant' THEN 'ai'
    WHEN 'staff' THEN 'staff'
    WHEN 'system' THEN 'system'
    ELSE 'lead'
END
WHERE (
    -- Messages with role='assistant' but sender_type='user' (wrong default)
    (role = 'assistant' AND sender_type = 'user')
    OR
    -- Messages with role='staff' but sender_type='user' (wrong default)
    (role = 'staff' AND sender_type = 'user')
    OR
    -- Messages with role='system' but sender_type='user' (wrong default)
    (role = 'system' AND sender_type = 'user')
);

-- =====================================================
-- PART 4: UPDATE SAVE_INCOMING_MESSAGE RPC
-- Add role field to ensure compatibility
-- =====================================================

CREATE OR REPLACE FUNCTION public.save_incoming_message(
    p_conversation_id UUID,
    p_lead_id UUID,
    p_content TEXT,
    p_message_type TEXT DEFAULT 'text',
    p_channel TEXT DEFAULT 'whatsapp',
    p_media_url TEXT DEFAULT NULL,
    p_whatsapp_message_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(
    message_id UUID,
    is_duplicate BOOLEAN,
    conversation_reopened BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_message_id UUID;
    v_is_duplicate BOOLEAN := false;
    v_conversation_reopened BOOLEAN := false;
    v_conversation_status TEXT;
    v_full_metadata JSONB;
BEGIN
    -- Build full metadata
    v_full_metadata := COALESCE(p_metadata, '{}'::JSONB);
    IF p_whatsapp_message_id IS NOT NULL THEN
        v_full_metadata := v_full_metadata || jsonb_build_object('whatsapp_message_id', p_whatsapp_message_id);
    END IF;

    -- Check for duplicate message (same whatsapp_message_id)
    IF p_whatsapp_message_id IS NOT NULL THEN
        SELECT id INTO v_message_id
        FROM messages
        WHERE metadata->>'whatsapp_message_id' = p_whatsapp_message_id
        LIMIT 1;

        IF v_message_id IS NOT NULL THEN
            -- Duplicate detected - return existing message
            v_is_duplicate := true;
            RETURN QUERY SELECT v_message_id, v_is_duplicate, v_conversation_reopened;
            RETURN;
        END IF;
    END IF;

    -- Check conversation status and auto-reopen if needed
    SELECT status INTO v_conversation_status
    FROM conversations
    WHERE id = p_conversation_id
    FOR UPDATE;  -- Lock to prevent race condition

    IF v_conversation_status IN ('resolved', 'archived') THEN
        UPDATE conversations
        SET status = 'active',
            updated_at = NOW()
        WHERE id = p_conversation_id;
        v_conversation_reopened := true;
    END IF;

    -- Insert the message with BOTH role and sender_type for compatibility
    -- Note: The trigger will also sync these, but explicit is better
    INSERT INTO messages (
        conversation_id,
        role,           -- ADDED: Required by migration 012
        sender_type,
        sender_id,
        content,
        message_type,
        channel,
        media_url,
        status,
        metadata,
        created_at
    ) VALUES (
        p_conversation_id,
        'user',         -- ADDED: Maps to sender_type='lead'
        'lead',
        p_lead_id,
        p_content,
        p_message_type,
        p_channel,
        p_media_url,
        'received',
        v_full_metadata,
        NOW()
    )
    RETURNING id INTO v_message_id;

    -- Increment conversation message count
    PERFORM increment_conversation_message_count(p_conversation_id);

    RETURN QUERY SELECT v_message_id, v_is_duplicate, v_conversation_reopened;
END;
$$;

COMMENT ON FUNCTION save_incoming_message IS
'Saves an incoming message with duplicate detection and conversation auto-reopen.
Fixed in migration 184 to include both role and sender_type fields.';

GRANT EXECUTE ON FUNCTION save_incoming_message TO authenticated;
GRANT EXECUTE ON FUNCTION save_incoming_message TO service_role;

-- =====================================================
-- PART 5: VERIFICATION QUERIES
-- =====================================================

DO $$
DECLARE
    v_mismatched_count INTEGER;
    v_trigger_exists BOOLEAN;
BEGIN
    -- Check for any remaining mismatched records
    SELECT COUNT(*) INTO v_mismatched_count
    FROM public.messages
    WHERE (
        (role = 'user' AND sender_type != 'lead')
        OR (role = 'assistant' AND sender_type != 'ai')
        OR (role = 'staff' AND sender_type != 'staff')
        OR (role = 'system' AND sender_type != 'system')
    );

    IF v_mismatched_count > 0 THEN
        RAISE WARNING 'Found % messages with mismatched role/sender_type', v_mismatched_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All messages have synchronized role/sender_type';
    END IF;

    -- Check trigger exists
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_sync_message_role_sender_type'
    ) INTO v_trigger_exists;

    IF v_trigger_exists THEN
        RAISE NOTICE 'SUCCESS: Sync trigger is active';
    ELSE
        RAISE WARNING 'FAILED: Sync trigger not found';
    END IF;
END $$;

-- =====================================================
-- SUMMARY
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Migration 184_FIX_MESSAGES_ROLE_SENDER_TYPE_SYNC completed';
    RAISE NOTICE '';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '1. Created sync_message_role_sender_type() function';
    RAISE NOTICE '2. Created BEFORE INSERT/UPDATE trigger on messages';
    RAISE NOTICE '3. Backfilled existing messages with correct role values';
    RAISE NOTICE '4. Updated save_incoming_message RPC with role field';
    RAISE NOTICE '';
    RAISE NOTICE 'Mapping: user↔lead, assistant↔ai, staff↔staff, system↔system';
    RAISE NOTICE '=====================================================';
END $$;

COMMIT;

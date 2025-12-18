-- =====================================================
-- TIS TIS PLATFORM - MULTI-CHANNEL ACCOUNTS SYSTEM
-- Migration: 060_multi_channel_accounts.sql
-- Date: December 18, 2024
-- Version: 1.0
--
-- PURPOSE: Enable multiple accounts per channel type
-- (e.g., 2 WhatsApps, 2 Instagrams per tenant)
-- with individual AI personality and response delay settings.
--
-- CHANGES:
-- 1. Add account_number and account_name to channel_connections
-- 2. Add AI override settings per channel account
-- 3. Add response delay configuration
-- 4. Update unique constraint
-- =====================================================

-- =====================================================
-- STEP 1: Add new columns to channel_connections
-- =====================================================

-- Account identification
ALTER TABLE public.channel_connections
ADD COLUMN IF NOT EXISTS account_number INTEGER DEFAULT 1 CHECK (account_number IN (1, 2));

ALTER TABLE public.channel_connections
ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);

-- AI personality override (NULL = use tenant default)
ALTER TABLE public.channel_connections
ADD COLUMN IF NOT EXISTS ai_personality_override VARCHAR(50) CHECK (ai_personality_override IN (
    'professional',
    'professional_friendly',
    'casual',
    'formal'
));

-- Response delay settings
-- first_message_delay_seconds: Delay for the FIRST message in a conversation
--   0 = immediate response
--   480 = 8 minutes (recommended for natural feel)
ALTER TABLE public.channel_connections
ADD COLUMN IF NOT EXISTS first_message_delay_seconds INTEGER DEFAULT 0 CHECK (first_message_delay_seconds >= 0 AND first_message_delay_seconds <= 1800);

-- subsequent_message_delay_seconds: Delay for messages after the first
-- Usually 0 for immediate follow-up responses
ALTER TABLE public.channel_connections
ADD COLUMN IF NOT EXISTS subsequent_message_delay_seconds INTEGER DEFAULT 0 CHECK (subsequent_message_delay_seconds >= 0 AND subsequent_message_delay_seconds <= 300);

-- Custom instructions specific to this channel account
ALTER TABLE public.channel_connections
ADD COLUMN IF NOT EXISTS custom_instructions_override TEXT;

-- Track if this is the "personal brand" account vs business account
ALTER TABLE public.channel_connections
ADD COLUMN IF NOT EXISTS is_personal_brand BOOLEAN DEFAULT false;

-- =====================================================
-- STEP 2: Drop and recreate unique constraint
-- Allow 2 accounts per channel type
-- =====================================================

-- Drop old constraint if exists
ALTER TABLE public.channel_connections
DROP CONSTRAINT IF EXISTS channel_connections_tenant_id_branch_id_channel_key;

-- Create new constraint allowing account_number differentiation
ALTER TABLE public.channel_connections
ADD CONSTRAINT channel_connections_tenant_branch_channel_account_unique
UNIQUE(tenant_id, branch_id, channel, account_number);

-- =====================================================
-- STEP 3: Create index for efficient querying
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_channel_connections_account
ON public.channel_connections(tenant_id, channel, account_number);

CREATE INDEX IF NOT EXISTS idx_channel_connections_personal_brand
ON public.channel_connections(tenant_id, is_personal_brand)
WHERE is_personal_brand = true;

-- =====================================================
-- STEP 4: Update ai_tenant_config with delay defaults
-- =====================================================

-- Add default delay settings at tenant level (can be overridden per channel)
ALTER TABLE public.ai_tenant_config
ADD COLUMN IF NOT EXISTS default_first_message_delay INTEGER DEFAULT 0 CHECK (default_first_message_delay >= 0 AND default_first_message_delay <= 1800);

ALTER TABLE public.ai_tenant_config
ADD COLUMN IF NOT EXISTS default_subsequent_message_delay INTEGER DEFAULT 0 CHECK (default_subsequent_message_delay >= 0 AND default_subsequent_message_delay <= 300);

-- Add emoji setting (important for professional tone)
ALTER TABLE public.ai_tenant_config
ADD COLUMN IF NOT EXISTS use_emojis BOOLEAN DEFAULT false;

-- =====================================================
-- STEP 5: Create helper function to get effective AI config
-- Returns merged config (tenant defaults + channel overrides)
-- =====================================================

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
Channel-specific settings override tenant defaults.';

-- =====================================================
-- STEP 6: Create view for easy channel management
-- =====================================================

CREATE OR REPLACE VIEW public.v_channel_accounts AS
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
    -- Effective AI personality
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
Use this to display channel accounts in the UI.';

-- =====================================================
-- STEP 7: Update existing records with defaults
-- =====================================================

-- Set account_number = 1 for existing connections
UPDATE public.channel_connections
SET account_number = 1
WHERE account_number IS NULL;

-- Set account_name based on channel for existing
UPDATE public.channel_connections
SET account_name = CASE channel
    WHEN 'whatsapp' THEN 'WhatsApp Principal'
    WHEN 'instagram' THEN 'Instagram Principal'
    WHEN 'facebook' THEN 'Facebook Principal'
    WHEN 'tiktok' THEN 'TikTok Principal'
    ELSE channel || ' Principal'
END
WHERE account_name IS NULL;

-- =====================================================
-- STEP 8: RLS Policies for new view
-- =====================================================

-- Enable RLS on channel_connections if not already
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;

-- Policy for tenant members to view their channels
DROP POLICY IF EXISTS channel_connections_select_policy ON public.channel_connections;
CREATE POLICY channel_connections_select_policy ON public.channel_connections
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    );

-- Policy for admins to manage channels
DROP POLICY IF EXISTS channel_connections_all_policy ON public.channel_connections;
CREATE POLICY channel_connections_all_policy ON public.channel_connections
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- =====================================================
-- DONE
-- =====================================================

COMMENT ON COLUMN public.channel_connections.account_number IS
'Account number within channel type: 1 = Primary, 2 = Secondary.
Allows having 2 WhatsApps, 2 Instagrams, etc. per tenant.';

COMMENT ON COLUMN public.channel_connections.account_name IS
'Human-friendly name for this account (e.g., "Clinica ESVA", "Dr. Estrella Personal")';

COMMENT ON COLUMN public.channel_connections.first_message_delay_seconds IS
'Delay in seconds before responding to the FIRST message in a new conversation.
0 = immediate, 480 = 8 minutes (more natural). Subsequent messages use subsequent_message_delay.';

COMMENT ON COLUMN public.channel_connections.is_personal_brand IS
'TRUE if this is a personal brand account (e.g., doctor''s personal Instagram).
Useful for routing and analytics.';

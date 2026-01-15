-- =====================================================
-- TIS TIS PLATFORM - CHANNEL PROFILE CONNECTION
-- Migration 125: Link channels to specific agent profiles
-- =====================================================
--
-- PURPOSE:
-- Each channel connection can now be linked to a specific agent profile
-- This allows WhatsApp 1 to use Business profile while WhatsApp 2 uses Personal profile
--
-- CHANGES:
-- 1. Add profile_id column to channel_connections
-- 2. Add foreign key constraint
-- 3. Create index for performance
-- 4. Migrate existing data based on is_personal_brand
--

-- ======================
-- ADD PROFILE_ID COLUMN
-- ======================

ALTER TABLE channel_connections
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL;

-- Create index for better join performance
CREATE INDEX IF NOT EXISTS idx_channel_connections_profile_id
ON channel_connections(profile_id)
WHERE profile_id IS NOT NULL;

-- ======================
-- MIGRATE EXISTING DATA
-- ======================

-- Set profile_id based on existing is_personal_brand boolean
-- This ensures backwards compatibility with existing channels

-- For channels marked as personal brand -> link to personal profile
UPDATE channel_connections cc
SET profile_id = ap.id
FROM agent_profiles ap
WHERE cc.tenant_id = ap.tenant_id
  AND cc.is_personal_brand = true
  AND ap.profile_type = 'personal'
  AND cc.profile_id IS NULL;

-- For channels NOT marked as personal brand -> link to business profile
UPDATE channel_connections cc
SET profile_id = ap.id
FROM agent_profiles ap
WHERE cc.tenant_id = ap.tenant_id
  AND cc.is_personal_brand = false
  AND ap.profile_type = 'business'
  AND cc.profile_id IS NULL;

-- ======================
-- COMMENT FOR DOCUMENTATION
-- ======================

COMMENT ON COLUMN channel_connections.profile_id IS
'Links this channel to a specific agent profile. Allows each channel to use different AI personality settings.';

-- ======================
-- VERIFICATION
-- ======================

-- Log the migration results (will show in Supabase logs)
DO $$
DECLARE
  total_channels INTEGER;
  linked_channels INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_channels FROM channel_connections;
  SELECT COUNT(*) INTO linked_channels FROM channel_connections WHERE profile_id IS NOT NULL;

  RAISE NOTICE 'Migration 125 complete: % of % channels now linked to profiles', linked_channels, total_channels;
END $$;

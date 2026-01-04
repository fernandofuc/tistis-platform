-- =====================================================
-- TIS TIS PLATFORM - Invoicing Conversation State
-- Migration: 097_INVOICING_CONVERSATION_STATE.sql
-- Purpose: Track invoicing conversation state for WhatsApp flow
-- =====================================================

-- ======================
-- CONVERSATION METADATA TABLE
-- Stores transient state for multi-turn conversations
-- ======================
CREATE TABLE IF NOT EXISTS conversation_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Invoicing state (JSONB for flexibility)
    invoicing_state JSONB,

    -- Other conversation metadata can be added here
    context_data JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_conversation_metadata UNIQUE (conversation_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_conversation_metadata_conv ON conversation_metadata(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_metadata_updated ON conversation_metadata(updated_at DESC);

-- RLS
ALTER TABLE conversation_metadata ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_all_conversation_metadata" ON conversation_metadata
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tenant isolation
CREATE POLICY "tenant_select_conversation_metadata" ON conversation_metadata FOR SELECT TO authenticated
    USING (conversation_id IN (
        SELECT id FROM conversations
        WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true)
    ));

-- Auto-update timestamp
CREATE TRIGGER trigger_update_conversation_metadata_timestamp
    BEFORE UPDATE ON conversation_metadata
    FOR EACH ROW EXECUTE FUNCTION update_invoice_timestamp();

-- ======================
-- ADD DOMICILIO_FISCAL TO CONFIG
-- ======================
ALTER TABLE restaurant_invoice_config
ADD COLUMN IF NOT EXISTS domicilio_fiscal TEXT;

-- ======================
-- COMMENTS
-- ======================
COMMENT ON TABLE conversation_metadata IS 'Stores transient metadata for conversations, including invoicing state';
COMMENT ON COLUMN conversation_metadata.invoicing_state IS 'JSON state for multi-turn invoicing conversations via WhatsApp';

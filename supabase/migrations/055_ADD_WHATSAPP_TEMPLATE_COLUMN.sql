-- =====================================================
-- MIGRATION: Add whatsapp_template column to loyalty_message_templates
-- Purpose: Allow separate customization of WhatsApp messages
-- =====================================================

-- Add column for WhatsApp-specific message template
-- This allows users to have a different message for WhatsApp vs email
ALTER TABLE loyalty_message_templates
ADD COLUMN IF NOT EXISTS whatsapp_template TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN loyalty_message_templates.whatsapp_template IS 'Optional WhatsApp-specific message. If NULL, template_content is used.';

-- Update existing templates to copy template_content to whatsapp_template
-- This ensures backward compatibility - existing templates will work as before
-- Users can then customize the WhatsApp message separately if they want
UPDATE loyalty_message_templates
SET whatsapp_template = template_content
WHERE whatsapp_template IS NULL;

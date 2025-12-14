-- =====================================================
-- 022_whatsapp_notifications.sql
-- =====================================================
-- Adds WhatsApp notification support to notification_preferences
-- Enables users to receive critical notifications via WhatsApp

-- =====================================================
-- ALTER TABLE: notification_preferences
-- Add WhatsApp columns
-- =====================================================

-- Add enable_whatsapp column
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS enable_whatsapp BOOLEAN DEFAULT FALSE;

-- Add whatsapp_number column for storing the notification number
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON COLUMN public.notification_preferences.enable_whatsapp IS 'Enable WhatsApp notifications for critical alerts';
COMMENT ON COLUMN public.notification_preferences.whatsapp_number IS 'Phone number for receiving WhatsApp notifications (with country code)';

-- =====================================================
-- UPDATE FUNCTION: create_notification
-- Add WhatsApp notification trigger (placeholder for future webhook)
-- =====================================================

-- Note: The actual WhatsApp sending will be handled by:
-- 1. An edge function that listens to notification inserts
-- 2. Checks if user has enable_whatsapp = true
-- 3. Sends via WhatsApp Business API (Twilio, Meta, etc.)

-- For now, we just ensure the preferences are stored correctly.
-- The backend service will query these preferences when sending notifications.

-- =====================================================
-- INDEX for WhatsApp enabled users
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_notification_preferences_whatsapp
ON public.notification_preferences(enable_whatsapp)
WHERE enable_whatsapp = TRUE;

-- =====================================================
-- MIGRATION LOG
-- =====================================================
-- This migration adds WhatsApp notification support.
-- To complete the integration:
-- 1. Configure WhatsApp Business API credentials
-- 2. Create edge function or webhook for sending notifications
-- 3. Test with sandbox number before production

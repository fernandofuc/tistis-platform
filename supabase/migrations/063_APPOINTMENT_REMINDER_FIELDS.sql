-- =====================================================
-- TIS TIS PLATFORM - Appointment Reminder Fields
-- Add fields for 1-week and 4-hour reminders
-- =====================================================

-- Add reminder fields if they don't exist
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS reminder_1week_sent BOOLEAN DEFAULT false;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS reminder_4h_sent BOOLEAN DEFAULT false;

-- Rename reminder_2h_sent to reminder_4h_sent if it exists (migration safety)
-- We'll use reminder_4h_sent going forward
DO $$
BEGIN
    -- Check if reminder_2h_sent exists and reminder_4h_sent doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments'
        AND column_name = 'reminder_2h_sent'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments'
        AND column_name = 'reminder_4h_sent'
    ) THEN
        -- Copy values from reminder_2h_sent to reminder_4h_sent
        ALTER TABLE public.appointments RENAME COLUMN reminder_2h_sent TO reminder_4h_sent;
    END IF;
END $$;

-- Add index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_1week
ON public.appointments(scheduled_at, reminder_1week_sent)
WHERE status IN ('scheduled', 'confirmed') AND reminder_1week_sent = false;

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_24h
ON public.appointments(scheduled_at, reminder_24h_sent)
WHERE status IN ('scheduled', 'confirmed') AND reminder_24h_sent = false;

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_4h
ON public.appointments(scheduled_at, reminder_4h_sent)
WHERE status IN ('scheduled', 'confirmed') AND reminder_4h_sent = false;

COMMENT ON COLUMN public.appointments.reminder_1week_sent IS 'True if 1-week reminder was sent';
COMMENT ON COLUMN public.appointments.reminder_24h_sent IS 'True if 24-hour reminder was sent';
COMMENT ON COLUMN public.appointments.reminder_4h_sent IS 'True if 4-hour reminder was sent';

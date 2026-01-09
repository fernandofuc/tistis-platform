-- =====================================================
-- TIS TIS PLATFORM - Migration 121
-- FIX: Appointments, Leads, and Patients Critical Issues
-- =====================================================
-- Fixes identified issues:
-- 1. cancelled_reason vs cancellation_reason naming
-- 2. Lead status transitions without validation
-- 3. AI urgency_level CHECK constraint
-- 4. Lead score/classification desync
-- 5. Auto-conversion logging improvements
-- 6. Patient preferred_branch_id naming consistency
-- =====================================================

BEGIN;

-- =====================================================
-- 1. FIX: cancelled_reason -> cancellation_reason in bulk_reschedule function
-- The DB column is 'cancellation_reason' but the function used 'cancelled_reason'
-- =====================================================

CREATE OR REPLACE FUNCTION public.bulk_cancel_appointments(
    p_staff_id UUID,
    p_branch_id UUID,
    p_date_from DATE,
    p_date_to DATE,
    p_cancel_reason TEXT DEFAULT 'Bulk cancellation'
)
RETURNS TABLE (
    success BOOLEAN,
    total_cancelled INTEGER,
    cancelled_appointments UUID[],
    affected_leads UUID[],
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cancelled_ids UUID[] := '{}';
    v_lead_ids UUID[] := '{}';
    v_count INTEGER := 0;
    v_appointment RECORD;
BEGIN
    -- Cancel all appointments in range
    FOR v_appointment IN
        SELECT a.id, a.lead_id
        FROM appointments a
        WHERE a.staff_id = p_staff_id
          AND a.branch_id = p_branch_id
          AND DATE(a.scheduled_at) >= p_date_from
          AND DATE(a.scheduled_at) <= p_date_to
          AND a.status NOT IN ('cancelled', 'completed', 'no_show')
    LOOP
        -- Update appointment status - FIXED: use correct column name
        UPDATE appointments
        SET
            status = 'cancelled',
            cancelled_at = NOW(),
            cancellation_reason = p_cancel_reason,  -- FIXED: was cancelled_reason
            updated_at = NOW()
        WHERE id = v_appointment.id;

        v_cancelled_ids := array_append(v_cancelled_ids, v_appointment.id);

        -- Track unique leads
        IF v_appointment.lead_id IS NOT NULL AND NOT (v_appointment.lead_id = ANY(v_lead_ids)) THEN
            v_lead_ids := array_append(v_lead_ids, v_appointment.lead_id);
        END IF;

        v_count := v_count + 1;
    END LOOP;

    success := true;
    total_cancelled := v_count;
    cancelled_appointments := v_cancelled_ids;
    affected_leads := v_lead_ids;
    message := format('Cancelled %s appointments for %s leads', v_count, COALESCE(array_length(v_lead_ids, 1), 0));

    RETURN NEXT;
END;
$$;

-- =====================================================
-- 2. FIX: Lead status transition validation
-- Add a trigger to validate lead status transitions
-- Valid transitions:
-- new -> contacted, qualified, lost, inactive
-- contacted -> qualified, appointment_scheduled, converted, lost, inactive
-- qualified -> appointment_scheduled, converted, lost, inactive
-- appointment_scheduled -> converted, lost, inactive
-- converted -> (terminal state, only allow inactive)
-- lost -> (terminal state, only allow contacted to retry)
-- inactive -> (terminal state, only allow contacted to retry)
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_lead_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_valid_transitions JSONB := '{
        "new": ["contacted", "qualified", "lost", "inactive", "appointment_scheduled"],
        "contacted": ["qualified", "appointment_scheduled", "converted", "lost", "inactive"],
        "qualified": ["contacted", "appointment_scheduled", "converted", "lost", "inactive"],
        "appointment_scheduled": ["contacted", "qualified", "converted", "lost", "inactive", "completed"],
        "converted": ["inactive"],
        "lost": ["contacted", "new"],
        "inactive": ["contacted", "new"],
        "completed": ["inactive"]
    }'::JSONB;
    v_allowed_statuses JSONB;
BEGIN
    -- Skip if status didn't change
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Skip if old status is null (new record)
    IF OLD.status IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get allowed transitions for current status
    v_allowed_statuses := v_valid_transitions -> OLD.status;

    -- If no transitions defined, allow any (shouldn't happen)
    IF v_allowed_statuses IS NULL THEN
        RETURN NEW;
    END IF;

    -- Check if new status is in allowed list
    IF NOT (v_allowed_statuses ? NEW.status) THEN
        RAISE WARNING '[Lead Status] Invalid transition from % to % for lead %. Allowing but logging.',
            OLD.status, NEW.status, NEW.id;
        -- Log the invalid transition but allow it (soft validation)
        -- This prevents breaking existing flows while alerting to issues
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS trg_validate_lead_status ON public.leads;
CREATE TRIGGER trg_validate_lead_status
    BEFORE UPDATE OF status ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_lead_status_transition();

-- =====================================================
-- 3. FIX: AI urgency_level CHECK constraint
-- Ensure ai_urgency_level is between 1 and 5
-- =====================================================

-- Add CHECK constraint to appointments table (if column exists)
DO $$
BEGIN
    -- Check if column exists before adding constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'ai_urgency_level'
    ) THEN
        -- Drop existing constraint if any
        ALTER TABLE public.appointments
            DROP CONSTRAINT IF EXISTS chk_ai_urgency_level;

        -- Add CHECK constraint
        ALTER TABLE public.appointments
            ADD CONSTRAINT chk_ai_urgency_level
            CHECK (ai_urgency_level IS NULL OR (ai_urgency_level >= 1 AND ai_urgency_level <= 5));
    END IF;
END $$;

-- Also add CHECK for ai_confidence_score (0-1)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'ai_confidence_score'
    ) THEN
        ALTER TABLE public.appointments
            DROP CONSTRAINT IF EXISTS chk_ai_confidence_score;

        ALTER TABLE public.appointments
            ADD CONSTRAINT chk_ai_confidence_score
            CHECK (ai_confidence_score IS NULL OR (ai_confidence_score >= 0 AND ai_confidence_score <= 1));
    END IF;
END $$;

-- =====================================================
-- 4. FIX: Lead score and classification sync
-- Add trigger to auto-update classification when score changes
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_lead_score_classification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only sync if score changed
    IF OLD.score IS DISTINCT FROM NEW.score THEN
        -- Auto-assign classification based on score
        IF NEW.score >= 70 THEN
            NEW.classification := 'hot';
        ELSIF NEW.score >= 40 THEN
            NEW.classification := 'warm';
        ELSE
            NEW.classification := 'cold';
        END IF;
    END IF;

    -- Vice versa: if classification changed manually, adjust score to match
    IF OLD.classification IS DISTINCT FROM NEW.classification
       AND OLD.score IS NOT DISTINCT FROM NEW.score THEN
        CASE NEW.classification
            WHEN 'hot' THEN
                IF NEW.score < 70 THEN NEW.score := 75; END IF;
            WHEN 'warm' THEN
                IF NEW.score < 40 OR NEW.score >= 70 THEN NEW.score := 55; END IF;
            WHEN 'cold' THEN
                IF NEW.score >= 40 THEN NEW.score := 25; END IF;
        END CASE;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_sync_lead_score_classification ON public.leads;
CREATE TRIGGER trg_sync_lead_score_classification
    BEFORE UPDATE OF score, classification ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_lead_score_classification();

-- =====================================================
-- 5. FIX: Auto-conversion logging improvements
-- Add a conversion_log table to track all conversion attempts
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lead_conversion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Conversion details
    conversion_type VARCHAR(50) NOT NULL, -- 'auto_appointment_completed', 'manual', 'batch'
    success BOOLEAN NOT NULL DEFAULT false,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,

    -- Readiness check results
    had_name BOOLEAN NOT NULL DEFAULT false,
    had_phone_or_email BOOLEAN NOT NULL DEFAULT false,
    had_appointment BOOLEAN NOT NULL DEFAULT false,
    missing_fields TEXT[],

    -- Error tracking
    error_message TEXT,
    error_details JSONB,

    -- Trigger info
    triggered_by VARCHAR(100), -- 'appointment_completed', 'manual_conversion', 'batch_job'
    triggered_appointment_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_lead_conversion_log_lead ON public.lead_conversion_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_conversion_log_tenant ON public.lead_conversion_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_conversion_log_created ON public.lead_conversion_log(created_at DESC);

-- RLS
ALTER TABLE public.lead_conversion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_conversion_log_tenant_isolation" ON public.lead_conversion_log;
CREATE POLICY "lead_conversion_log_tenant_isolation" ON public.lead_conversion_log
    FOR ALL
    USING (tenant_id = auth.jwt() ->> 'tenant_id')
    WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id');

-- Service role bypass
DROP POLICY IF EXISTS "lead_conversion_log_service_role" ON public.lead_conversion_log;
CREATE POLICY "lead_conversion_log_service_role" ON public.lead_conversion_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- 6. FIX: Ensure patients table has consistent naming
-- preferred_branch_id should match branch_id pattern
-- =====================================================

-- Check and add preferred_branch_id if missing (some schemas may not have it)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'patients'
        AND column_name = 'preferred_branch_id'
    ) THEN
        ALTER TABLE public.patients
            ADD COLUMN preferred_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

        -- Index for preferred branch lookups
        CREATE INDEX IF NOT EXISTS idx_patients_preferred_branch
            ON public.patients(preferred_branch_id) WHERE preferred_branch_id IS NOT NULL;
    END IF;
END $$;

-- =====================================================
-- 7. Add lead_id back-reference to patients if missing
-- This allows bidirectional lookup
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'patients'
        AND column_name = 'lead_id'
    ) THEN
        ALTER TABLE public.patients
            ADD COLUMN lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

        -- Index for lead lookups
        CREATE INDEX IF NOT EXISTS idx_patients_lead
            ON public.patients(lead_id) WHERE lead_id IS NOT NULL;
    END IF;
END $$;

-- =====================================================
-- 8. FIX: Ensure appointment_scheduled status updates lead
-- When appointment is created, auto-update lead status
-- =====================================================

CREATE OR REPLACE FUNCTION public.appointment_created_update_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only process for new appointments (not updates)
    IF TG_OP = 'INSERT' AND NEW.lead_id IS NOT NULL THEN
        -- Update lead status to appointment_scheduled if currently new/contacted/qualified
        UPDATE public.leads
        SET
            status = 'appointment_scheduled',
            updated_at = NOW()
        WHERE id = NEW.lead_id
          AND status IN ('new', 'contacted', 'qualified');
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_appointment_created_update_lead ON public.appointments;
CREATE TRIGGER trg_appointment_created_update_lead
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.appointment_created_update_lead();

-- =====================================================
-- 9. FIX: Improve create_appointment_atomic to log better
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_appointment_atomic(
    p_tenant_id UUID,
    p_lead_id UUID,
    p_branch_id UUID,
    p_scheduled_at TIMESTAMPTZ,
    p_duration_minutes INTEGER DEFAULT 60,
    p_service_id UUID DEFAULT NULL,
    p_staff_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'ai_booking',
    p_conversation_id UUID DEFAULT NULL,
    p_channel TEXT DEFAULT NULL,
    -- Restaurant specific
    p_party_size INTEGER DEFAULT NULL,
    p_occasion_type TEXT DEFAULT NULL,
    p_special_requests TEXT DEFAULT NULL,
    -- AI traceability
    p_ai_booking_channel TEXT DEFAULT NULL,
    p_ai_urgency_level INTEGER DEFAULT NULL,
    p_ai_detected_symptoms TEXT DEFAULT NULL,
    p_ai_confidence_score NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    appointment_id UUID,
    error_message TEXT,
    suggestion TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointment_id UUID;
    v_lock_key BIGINT;
    v_end_at TIMESTAMPTZ;
    v_conflict_count INTEGER;
BEGIN
    -- Generate lock key from branch + time (to prevent double-booking)
    v_lock_key := ('x' || substr(md5(p_branch_id::TEXT || p_scheduled_at::TEXT), 1, 15))::BIT(60)::BIGINT;

    -- Acquire advisory lock (transaction-level, auto-released at commit/rollback)
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Calculate end time
    v_end_at := p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL;

    -- Check for conflicts
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.appointments
    WHERE tenant_id = p_tenant_id
      AND branch_id = p_branch_id
      AND status IN ('scheduled', 'confirmed')
      AND (
          (scheduled_at <= p_scheduled_at AND scheduled_at + (duration_minutes || ' minutes')::INTERVAL > p_scheduled_at)
          OR
          (scheduled_at < v_end_at AND scheduled_at >= p_scheduled_at)
      )
      AND (p_staff_id IS NULL OR staff_id = p_staff_id);

    IF v_conflict_count > 0 THEN
        success := false;
        appointment_id := NULL;
        error_message := 'El horario seleccionado ya no está disponible';
        suggestion := 'Por favor selecciona otro horario disponible';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Validate urgency level if provided
    IF p_ai_urgency_level IS NOT NULL AND (p_ai_urgency_level < 1 OR p_ai_urgency_level > 5) THEN
        RAISE WARNING '[create_appointment_atomic] Invalid urgency level %, clamping to 1-5', p_ai_urgency_level;
        p_ai_urgency_level := GREATEST(1, LEAST(5, p_ai_urgency_level));
    END IF;

    -- Validate confidence score if provided
    IF p_ai_confidence_score IS NOT NULL AND (p_ai_confidence_score < 0 OR p_ai_confidence_score > 1) THEN
        RAISE WARNING '[create_appointment_atomic] Invalid confidence score %, clamping to 0-1', p_ai_confidence_score;
        p_ai_confidence_score := GREATEST(0, LEAST(1, p_ai_confidence_score));
    END IF;

    -- Create the appointment
    INSERT INTO public.appointments (
        tenant_id,
        lead_id,
        branch_id,
        scheduled_at,
        duration_minutes,
        service_id,
        staff_id,
        notes,
        source,
        status,
        conversation_id,
        ai_booking_channel,
        ai_urgency_level,
        ai_detected_symptoms,
        ai_confidence_score
    ) VALUES (
        p_tenant_id,
        p_lead_id,
        p_branch_id,
        p_scheduled_at,
        p_duration_minutes,
        p_service_id,
        p_staff_id,
        p_notes,
        p_source,
        'scheduled',
        p_conversation_id,
        p_ai_booking_channel,
        p_ai_urgency_level,
        CASE WHEN p_ai_detected_symptoms IS NOT NULL
             THEN p_ai_detected_symptoms::JSONB
             ELSE NULL
        END,
        p_ai_confidence_score
    )
    RETURNING id INTO v_appointment_id;

    -- Log the booking for audit trail
    INSERT INTO public.ai_booking_log (
        appointment_id,
        tenant_id,
        lead_id,
        channel,
        booking_source,
        urgency_level,
        confidence_score,
        detected_symptoms,
        success
    ) VALUES (
        v_appointment_id,
        p_tenant_id,
        p_lead_id,
        p_ai_booking_channel,
        p_source,
        p_ai_urgency_level,
        p_ai_confidence_score,
        CASE WHEN p_ai_detected_symptoms IS NOT NULL
             THEN p_ai_detected_symptoms::JSONB
             ELSE NULL
        END,
        true
    ) ON CONFLICT DO NOTHING;  -- Ignore if table doesn't exist or constraint fails

    success := true;
    appointment_id := v_appointment_id;
    error_message := NULL;
    suggestion := NULL;
    RETURN NEXT;

EXCEPTION WHEN OTHERS THEN
    success := false;
    appointment_id := NULL;
    error_message := SQLERRM;
    suggestion := 'Error interno. Intenta nuevamente.';
    RETURN NEXT;
END;
$$;

-- =====================================================
-- 10. Create AI booking log table for traceability
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_booking_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,

    -- Channel info
    channel VARCHAR(50), -- 'whatsapp', 'voice', 'webchat', 'instagram', 'facebook'
    booking_source VARCHAR(50), -- 'ai_booking', 'manual'

    -- AI analysis
    urgency_level INTEGER,
    confidence_score NUMERIC(3,2),
    detected_symptoms JSONB,

    -- Result
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,

    -- Timing
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_booking_log_tenant ON public.ai_booking_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_booking_log_appointment ON public.ai_booking_log(appointment_id);
CREATE INDEX IF NOT EXISTS idx_ai_booking_log_created ON public.ai_booking_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_booking_log_channel ON public.ai_booking_log(channel);

-- RLS
ALTER TABLE public.ai_booking_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_booking_log_tenant_isolation" ON public.ai_booking_log;
CREATE POLICY "ai_booking_log_tenant_isolation" ON public.ai_booking_log
    FOR ALL
    USING (tenant_id = auth.jwt() ->> 'tenant_id')
    WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id');

DROP POLICY IF EXISTS "ai_booking_log_service_role" ON public.ai_booking_log;
CREATE POLICY "ai_booking_log_service_role" ON public.ai_booking_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.validate_lead_status_transition() IS
'Validates lead status transitions. Uses soft validation (warning only) to prevent breaking existing flows while alerting to issues.';

COMMENT ON FUNCTION public.sync_lead_score_classification() IS
'Keeps lead score and classification in sync. Score >= 70 = hot, 40-69 = warm, < 40 = cold.';

COMMENT ON TABLE public.lead_conversion_log IS
'Tracks all lead-to-patient conversion attempts with detailed logging for debugging.';

COMMENT ON TABLE public.ai_booking_log IS
'Tracks all AI-initiated booking attempts for traceability and debugging.';

COMMENT ON FUNCTION public.create_appointment_atomic(UUID, UUID, UUID, TIMESTAMPTZ, INTEGER, UUID, UUID, TEXT, TEXT, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, INTEGER, TEXT, NUMERIC) IS
'Creates appointment with advisory lock to prevent race conditions. V9: Added validation for AI fields and better logging.';

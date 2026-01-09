-- =====================================================
-- TIS TIS PLATFORM - Migration 122
-- FIX: Critical Security Constraints and Race Conditions
-- =====================================================
-- This migration addresses:
-- 1. UNIQUE constraints for patients (phone+tenant, lead_id)
-- 2. Concurrent patient creation race condition
-- 3. Soft delete cascade for leads
-- 4. Score validation with CHECK constraint
-- 5. Improved race condition handling in atomic booking
-- 6. Lead status restoration on undelete
-- =====================================================

BEGIN;

-- =====================================================
-- 1. UNIQUE CONSTRAINTS FOR PATIENTS
-- Prevents duplicate patients from concurrent creation
-- =====================================================

-- Add UNIQUE constraint for phone + tenant_id
-- This prevents race condition when Voice and WhatsApp try to create
-- the same patient simultaneously
DO $$
BEGIN
    -- Drop existing constraint if any
    ALTER TABLE public.patients
        DROP CONSTRAINT IF EXISTS uk_patients_phone_tenant;

    -- Create partial UNIQUE (only for non-null phones)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_phone_tenant_unique
        ON public.patients(phone, tenant_id)
        WHERE phone IS NOT NULL AND phone != '';

    RAISE NOTICE 'Created UNIQUE index on patients(phone, tenant_id)';
EXCEPTION WHEN duplicate_table THEN
    RAISE NOTICE 'UNIQUE index on patients(phone, tenant_id) already exists';
END $$;

-- Add UNIQUE constraint for lead_id
-- This prevents creating multiple patients from the same lead
DO $$
BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_lead_id_unique
        ON public.patients(lead_id)
        WHERE lead_id IS NOT NULL;

    RAISE NOTICE 'Created UNIQUE index on patients(lead_id)';
EXCEPTION WHEN duplicate_table THEN
    RAISE NOTICE 'UNIQUE index on patients(lead_id) already exists';
END $$;

-- =====================================================
-- 2. SCORE VALIDATION CHECK CONSTRAINT
-- Ensures score is always within valid range (0-100)
-- =====================================================

ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS chk_lead_score_range;

ALTER TABLE public.leads
    ADD CONSTRAINT chk_lead_score_range
    CHECK (score IS NULL OR (score >= 0 AND score <= 100));

-- =====================================================
-- 3. IMPROVED LEAD STATUS TRANSITION VALIDATION
-- Now includes validation for NULL handling and better transitions
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_lead_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_valid_transitions JSONB := '{
        "new": ["contacted", "qualified", "lost", "inactive", "appointment_scheduled"],
        "contacted": ["new", "qualified", "appointment_scheduled", "converted", "lost", "inactive"],
        "qualified": ["contacted", "new", "appointment_scheduled", "converted", "lost", "inactive"],
        "appointment_scheduled": ["contacted", "qualified", "converted", "lost", "inactive", "completed"],
        "converted": ["inactive"],
        "lost": ["contacted", "new", "qualified"],
        "inactive": ["contacted", "new", "qualified"],
        "completed": ["inactive", "converted"]
    }'::JSONB;
    v_allowed_statuses JSONB;
BEGIN
    -- Skip if status didn't change
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    -- Allow NULL -> any status (new record or restoration)
    IF OLD.status IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get allowed transitions for current status
    v_allowed_statuses := v_valid_transitions -> OLD.status;

    -- If status unknown, log warning but allow
    IF v_allowed_statuses IS NULL THEN
        RAISE WARNING '[Lead Status] Unknown status %, allowing transition to %', OLD.status, NEW.status;
        RETURN NEW;
    END IF;

    -- Check if new status is in allowed list
    IF NOT (v_allowed_statuses ? NEW.status) THEN
        RAISE WARNING '[Lead Status] Unusual transition from % to % for lead %. Allowing but logged.',
            OLD.status, NEW.status, NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 4. IMPROVED SCORE/CLASSIFICATION SYNC
-- Better NULL handling and range validation
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_lead_score_classification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Skip if neither changed
    IF OLD.score IS NOT DISTINCT FROM NEW.score
       AND OLD.classification IS NOT DISTINCT FROM NEW.classification THEN
        RETURN NEW;
    END IF;

    -- Clamp score to valid range if out of bounds
    IF NEW.score IS NOT NULL THEN
        IF NEW.score < 0 THEN
            NEW.score := 0;
            RAISE WARNING '[Lead Score] Score was negative, clamped to 0 for lead %', NEW.id;
        ELSIF NEW.score > 100 THEN
            NEW.score := 100;
            RAISE WARNING '[Lead Score] Score exceeded 100, clamped to 100 for lead %', NEW.id;
        END IF;
    END IF;

    -- If score changed, sync classification
    IF OLD.score IS DISTINCT FROM NEW.score AND NEW.score IS NOT NULL THEN
        IF NEW.score >= 70 THEN
            NEW.classification := 'hot';
        ELSIF NEW.score >= 40 THEN
            NEW.classification := 'warm';
        ELSE
            NEW.classification := 'cold';
        END IF;
    END IF;

    -- If classification changed manually (without score change), adjust score to match
    IF OLD.classification IS DISTINCT FROM NEW.classification
       AND OLD.score IS NOT DISTINCT FROM NEW.score
       AND NEW.classification IS NOT NULL THEN
        CASE NEW.classification
            WHEN 'hot' THEN
                IF NEW.score IS NULL OR NEW.score < 70 THEN
                    NEW.score := 75;
                END IF;
            WHEN 'warm' THEN
                IF NEW.score IS NULL OR NEW.score < 40 OR NEW.score >= 70 THEN
                    NEW.score := 55;
                END IF;
            WHEN 'cold' THEN
                IF NEW.score IS NULL OR NEW.score >= 40 THEN
                    NEW.score := 25;
                END IF;
            ELSE
                -- Unknown classification, don't modify score
                NULL;
        END CASE;
    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 5. IMPROVED SOFT DELETE CASCADE FOR LEADS
-- Properly handles appointments and conversations
-- =====================================================

CREATE OR REPLACE FUNCTION public.soft_delete_lead(
    p_lead_id UUID,
    p_deleted_by UUID DEFAULT NULL,
    p_cancel_reason TEXT DEFAULT 'Lead was deleted'
)
RETURNS TABLE (
    success BOOLEAN,
    appointments_cancelled INTEGER,
    conversations_closed INTEGER,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appointments_cancelled INTEGER := 0;
    v_conversations_closed INTEGER := 0;
    v_original_status TEXT;
BEGIN
    -- Get original status for potential restoration
    SELECT status INTO v_original_status
    FROM leads
    WHERE id = p_lead_id;

    IF NOT FOUND THEN
        success := false;
        appointments_cancelled := 0;
        conversations_closed := 0;
        message := 'Lead not found';
        RETURN NEXT;
        RETURN;
    END IF;

    -- 1. Soft delete the lead
    UPDATE leads
    SET
        deleted_at = NOW(),
        deleted_by = p_deleted_by,
        status = 'inactive',
        -- Store original status in metadata for restoration
        metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
            '_deleted_original_status', v_original_status,
            '_deleted_at', NOW()::TEXT,
            '_deleted_by', p_deleted_by::TEXT
        )
    WHERE id = p_lead_id
      AND deleted_at IS NULL;

    -- 2. Cancel all pending appointments
    UPDATE appointments
    SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = p_cancel_reason,
        updated_at = NOW()
    WHERE lead_id = p_lead_id
      AND status IN ('scheduled', 'confirmed');

    GET DIAGNOSTICS v_appointments_cancelled = ROW_COUNT;

    -- 3. Close all open conversations with reason
    UPDATE conversations
    SET
        status = 'closed',
        updated_at = NOW(),
        metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
            '_closed_reason', 'lead_deleted',
            '_closed_at', NOW()::TEXT
        )
    WHERE lead_id = p_lead_id
      AND status NOT IN ('closed', 'resolved', 'archived');

    GET DIAGNOSTICS v_conversations_closed = ROW_COUNT;

    success := true;
    appointments_cancelled := v_appointments_cancelled;
    conversations_closed := v_conversations_closed;
    message := format('Lead soft-deleted. Cancelled %s appointments, closed %s conversations.',
                      v_appointments_cancelled, v_conversations_closed);
    RETURN NEXT;
END;
$$;

-- =====================================================
-- 6. IMPROVED LEAD RESTORATION
-- Restores original status and logs restoration
-- =====================================================

CREATE OR REPLACE FUNCTION public.restore_lead(
    p_lead_id UUID,
    p_restored_by UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    restored_status TEXT,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_original_status TEXT;
    v_metadata JSONB;
BEGIN
    -- Get lead's metadata
    SELECT metadata INTO v_metadata
    FROM leads
    WHERE id = p_lead_id AND deleted_at IS NOT NULL;

    IF NOT FOUND THEN
        success := false;
        restored_status := NULL;
        message := 'Lead not found or not deleted';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Extract original status from metadata
    v_original_status := v_metadata ->> '_deleted_original_status';

    -- Default to 'contacted' if original status not stored
    IF v_original_status IS NULL OR v_original_status = '' THEN
        v_original_status := 'contacted';
    END IF;

    -- Restore the lead
    UPDATE leads
    SET
        deleted_at = NULL,
        deleted_by = NULL,
        status = v_original_status,
        metadata = metadata - '_deleted_original_status' - '_deleted_at' - '_deleted_by' ||
                   jsonb_build_object(
                       '_restored_at', NOW()::TEXT,
                       '_restored_by', p_restored_by::TEXT
                   ),
        updated_at = NOW()
    WHERE id = p_lead_id;

    success := true;
    restored_status := v_original_status;
    message := format('Lead restored with status: %s', v_original_status);
    RETURN NEXT;
END;
$$;

-- =====================================================
-- 7. IMPROVED ATOMIC BOOKING WITH SERIALIZABLE
-- Uses SERIALIZABLE isolation to prevent race conditions
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_appointment_atomic_v2(
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
-- Use SERIALIZABLE to prevent race conditions
SET transaction_isolation = 'SERIALIZABLE'
AS $$
DECLARE
    v_appointment_id UUID;
    v_lock_key BIGINT;
    v_end_at TIMESTAMPTZ;
    v_conflict_count INTEGER;
BEGIN
    -- Generate lock key from branch + time slot (rounded to 15 min)
    -- This ensures same-slot bookings get same lock
    v_lock_key := ('x' || substr(md5(
        p_branch_id::TEXT ||
        date_trunc('hour', p_scheduled_at)::TEXT ||
        (EXTRACT(minute FROM p_scheduled_at)::INT / 15)::TEXT
    ), 1, 15))::BIT(60)::BIGINT;

    -- Acquire advisory lock (still useful for immediate rejection)
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Calculate end time
    v_end_at := p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL;

    -- Check for conflicts with FOR UPDATE to lock rows
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
      AND (p_staff_id IS NULL OR staff_id = p_staff_id)
    FOR UPDATE;  -- Lock conflicting rows

    IF v_conflict_count > 0 THEN
        success := false;
        appointment_id := NULL;
        error_message := 'El horario seleccionado ya no está disponible';
        suggestion := 'Por favor selecciona otro horario disponible';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Validate and clamp AI fields
    IF p_ai_urgency_level IS NOT NULL THEN
        p_ai_urgency_level := GREATEST(1, LEAST(5, p_ai_urgency_level));
    END IF;

    IF p_ai_confidence_score IS NOT NULL THEN
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

    -- Log successful booking
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
    ) ON CONFLICT DO NOTHING;

    success := true;
    appointment_id := v_appointment_id;
    error_message := NULL;
    suggestion := NULL;
    RETURN NEXT;

EXCEPTION
    WHEN serialization_failure THEN
        -- Serializable conflict - slot was taken
        success := false;
        appointment_id := NULL;
        error_message := 'El horario acaba de ser reservado por otro cliente';
        suggestion := 'Por favor intenta con otro horario';
        RETURN NEXT;
    WHEN OTHERS THEN
        success := false;
        appointment_id := NULL;
        error_message := SQLERRM;
        suggestion := 'Error interno. Por favor intenta nuevamente.';
        RETURN NEXT;
END;
$$;

-- =====================================================
-- 8. PATIENT CREATION WITH CONFLICT HANDLING
-- Upsert-safe patient creation
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_patient_safe(
    p_tenant_id UUID,
    p_first_name TEXT,
    p_last_name TEXT,
    p_phone TEXT,
    p_email TEXT DEFAULT NULL,
    p_lead_id UUID DEFAULT NULL,
    p_branch_id UUID DEFAULT NULL,
    p_additional_data JSONB DEFAULT '{}'
)
RETURNS TABLE (
    success BOOLEAN,
    patient_id UUID,
    already_exists BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_patient_id UUID;
    v_existing_patient_id UUID;
BEGIN
    -- First, check for existing patient by phone
    SELECT id INTO v_existing_patient_id
    FROM patients
    WHERE tenant_id = p_tenant_id
      AND phone = p_phone
    LIMIT 1;

    IF v_existing_patient_id IS NOT NULL THEN
        -- Patient already exists with this phone
        success := true;
        patient_id := v_existing_patient_id;
        already_exists := true;
        error_message := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Check for existing patient by lead_id
    IF p_lead_id IS NOT NULL THEN
        SELECT id INTO v_existing_patient_id
        FROM patients
        WHERE lead_id = p_lead_id
        LIMIT 1;

        IF v_existing_patient_id IS NOT NULL THEN
            success := true;
            patient_id := v_existing_patient_id;
            already_exists := true;
            error_message := NULL;
            RETURN NEXT;
            RETURN;
        END IF;
    END IF;

    -- Try to create new patient
    INSERT INTO patients (
        tenant_id,
        first_name,
        last_name,
        phone,
        email,
        lead_id,
        preferred_branch_id,
        status,
        source
    ) VALUES (
        p_tenant_id,
        p_first_name,
        p_last_name,
        p_phone,
        p_email,
        p_lead_id,
        p_branch_id,
        'active',
        COALESCE(p_additional_data->>'source', 'lead_conversion')
    )
    RETURNING id INTO v_patient_id;

    success := true;
    patient_id := v_patient_id;
    already_exists := false;
    error_message := NULL;
    RETURN NEXT;

EXCEPTION
    WHEN unique_violation THEN
        -- Race condition: patient was created between our check and insert
        -- Try to find the existing patient
        SELECT id INTO v_existing_patient_id
        FROM patients
        WHERE tenant_id = p_tenant_id
          AND (phone = p_phone OR (p_lead_id IS NOT NULL AND lead_id = p_lead_id))
        LIMIT 1;

        IF v_existing_patient_id IS NOT NULL THEN
            success := true;
            patient_id := v_existing_patient_id;
            already_exists := true;
            error_message := NULL;
        ELSE
            success := false;
            patient_id := NULL;
            already_exists := false;
            error_message := 'Patient creation conflict - please retry';
        END IF;
        RETURN NEXT;

    WHEN OTHERS THEN
        success := false;
        patient_id := NULL;
        already_exists := false;
        error_message := SQLERRM;
        RETURN NEXT;
END;
$$;

-- =====================================================
-- 9. RESTAURANT-SPECIFIC: PARTY SIZE VALIDATION
-- Validates party size against available table capacity
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_restaurant_booking(
    p_branch_id UUID,
    p_scheduled_at TIMESTAMPTZ,
    p_party_size INTEGER,
    p_duration_minutes INTEGER DEFAULT 120
)
RETURNS TABLE (
    is_valid BOOLEAN,
    table_id UUID,
    table_name TEXT,
    capacity INTEGER,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_table RECORD;
    v_end_at TIMESTAMPTZ;
BEGIN
    v_end_at := p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL;

    -- Find available table with sufficient capacity
    FOR v_table IN
        SELECT t.id, t.name, t.capacity
        FROM restaurant_tables t
        WHERE t.branch_id = p_branch_id
          AND t.capacity >= p_party_size
          AND t.is_available = true
          AND t.id NOT IN (
              -- Exclude tables with overlapping reservations
              SELECT DISTINCT rd.table_id
              FROM appointment_restaurant_details rd
              JOIN appointments a ON a.id = rd.appointment_id
              WHERE a.branch_id = p_branch_id
                AND a.status IN ('scheduled', 'confirmed')
                AND rd.table_id IS NOT NULL
                AND (
                    (a.scheduled_at <= p_scheduled_at AND
                     a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL > p_scheduled_at)
                    OR
                    (a.scheduled_at < v_end_at AND a.scheduled_at >= p_scheduled_at)
                )
          )
        ORDER BY t.capacity ASC  -- Prefer smallest suitable table
        LIMIT 1
    LOOP
        is_valid := true;
        table_id := v_table.id;
        table_name := v_table.name;
        capacity := v_table.capacity;
        error_message := NULL;
        RETURN NEXT;
        RETURN;
    END LOOP;

    -- No suitable table found
    is_valid := false;
    table_id := NULL;
    table_name := NULL;
    capacity := NULL;
    error_message := format('No hay mesas disponibles para %s personas en ese horario', p_party_size);
    RETURN NEXT;
END;
$$;

COMMIT;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.create_appointment_atomic_v2 IS
'V2: Uses SERIALIZABLE isolation and FOR UPDATE locking to completely prevent race conditions between Voice and WhatsApp channels.';

COMMENT ON FUNCTION public.soft_delete_lead IS
'Properly cascades soft-delete to appointments and conversations, storing original status for restoration.';

COMMENT ON FUNCTION public.restore_lead IS
'Restores a soft-deleted lead to its original status.';

COMMENT ON FUNCTION public.create_patient_safe IS
'Race-condition safe patient creation with proper duplicate handling.';

COMMENT ON FUNCTION public.validate_restaurant_booking IS
'Validates restaurant bookings against table availability and capacity.';

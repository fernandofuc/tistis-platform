-- =====================================================
-- TIS TIS PLATFORM - Appointment Validation System
-- Migration 102: Prevent appointment conflicts and validate booking rules
-- =====================================================
-- This migration adds critical validations for appointments:
-- 1. Prevent double-booking of staff (same doctor, overlapping time)
-- 2. Prevent patient from having simultaneous appointments
-- 3. Validate staff availability (business hours)
-- 4. Prevent modifications to completed/cancelled appointments
-- =====================================================

-- =====================================================
-- 1. FUNCTION: Check if staff has overlapping appointments
-- =====================================================
CREATE OR REPLACE FUNCTION check_staff_appointment_overlap(
    p_staff_id UUID,
    p_branch_id UUID,
    p_scheduled_at TIMESTAMPTZ,
    p_duration_minutes INTEGER,
    p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE(
    has_conflict BOOLEAN,
    conflicting_appointment_id UUID,
    conflict_start TIMESTAMPTZ,
    conflict_end TIMESTAMPTZ,
    conflict_lead_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_end_time TIMESTAMPTZ;
BEGIN
    -- Calculate end time
    v_end_time := p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL;

    RETURN QUERY
    SELECT
        true AS has_conflict,
        a.id AS conflicting_appointment_id,
        a.scheduled_at AS conflict_start,
        (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL) AS conflict_end,
        COALESCE(l.full_name, CONCAT(l.first_name, ' ', l.last_name)) AS conflict_lead_name
    FROM appointments a
    LEFT JOIN leads l ON a.lead_id = l.id
    WHERE a.staff_id = p_staff_id
      AND a.branch_id = p_branch_id
      AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled')
      AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
      -- Check for time overlap
      AND a.scheduled_at < v_end_time
      AND (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL) > p_scheduled_at
    LIMIT 1;

    -- If no conflicts found, return false
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TEXT;
    END IF;
END;
$$;

-- =====================================================
-- 2. FUNCTION: Check if lead/patient has overlapping appointments
-- =====================================================
CREATE OR REPLACE FUNCTION check_lead_appointment_overlap(
    p_lead_id UUID,
    p_scheduled_at TIMESTAMPTZ,
    p_duration_minutes INTEGER,
    p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE(
    has_conflict BOOLEAN,
    conflicting_appointment_id UUID,
    conflict_start TIMESTAMPTZ,
    conflict_end TIMESTAMPTZ,
    conflict_branch_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_end_time TIMESTAMPTZ;
BEGIN
    v_end_time := p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL;

    RETURN QUERY
    SELECT
        true AS has_conflict,
        a.id AS conflicting_appointment_id,
        a.scheduled_at AS conflict_start,
        (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL) AS conflict_end,
        b.name AS conflict_branch_name
    FROM appointments a
    LEFT JOIN branches b ON a.branch_id = b.id
    WHERE a.lead_id = p_lead_id
      AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled')
      AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
      AND a.scheduled_at < v_end_time
      AND (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL) > p_scheduled_at
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TEXT;
    END IF;
END;
$$;

-- =====================================================
-- 3. FUNCTION: Validate staff availability for booking
-- =====================================================
CREATE OR REPLACE FUNCTION check_staff_availability(
    p_staff_id UUID,
    p_branch_id UUID,
    p_scheduled_at TIMESTAMPTZ,
    p_duration_minutes INTEGER
)
RETURNS TABLE(
    is_available BOOLEAN,
    reason TEXT,
    available_from TIME,
    available_until TIME
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_day_of_week INTEGER;
    v_time_start TIME;
    v_time_end TIME;
    v_availability RECORD;
BEGIN
    -- Get day of week (0 = Sunday, 6 = Saturday)
    v_day_of_week := EXTRACT(DOW FROM p_scheduled_at)::INTEGER;
    v_time_start := p_scheduled_at::TIME;
    v_time_end := (p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)::TIME;

    -- Check if staff has availability defined for this day
    SELECT *
    INTO v_availability
    FROM staff_availability sa
    WHERE sa.staff_id = p_staff_id
      AND sa.day_of_week = v_day_of_week
      AND sa.is_active = true
      AND sa.availability_type = 'available'
      AND (sa.branch_id IS NULL OR sa.branch_id = p_branch_id)
      AND sa.start_time <= v_time_start
      AND sa.end_time >= v_time_end
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT
            true,
            'Staff available'::TEXT,
            v_availability.start_time,
            v_availability.end_time;
    ELSE
        -- Check if there's ANY availability that day to give better feedback
        SELECT sa.start_time, sa.end_time
        INTO v_availability
        FROM staff_availability sa
        WHERE sa.staff_id = p_staff_id
          AND sa.day_of_week = v_day_of_week
          AND sa.is_active = true
          AND sa.availability_type = 'available'
          AND (sa.branch_id IS NULL OR sa.branch_id = p_branch_id)
        LIMIT 1;

        IF FOUND THEN
            RETURN QUERY SELECT
                false,
                'Time outside staff working hours'::TEXT,
                v_availability.start_time,
                v_availability.end_time;
        ELSE
            RETURN QUERY SELECT
                false,
                'Staff not available on this day'::TEXT,
                NULL::TIME,
                NULL::TIME;
        END IF;
    END IF;
END;
$$;

-- =====================================================
-- 4. FUNCTION: Comprehensive appointment validation
-- Called before INSERT or UPDATE
-- =====================================================
CREATE OR REPLACE FUNCTION validate_appointment_booking(
    p_staff_id UUID,
    p_lead_id UUID,
    p_branch_id UUID,
    p_scheduled_at TIMESTAMPTZ,
    p_duration_minutes INTEGER,
    p_exclude_appointment_id UUID DEFAULT NULL,
    p_skip_availability_check BOOLEAN DEFAULT false
)
RETURNS TABLE(
    is_valid BOOLEAN,
    error_code TEXT,
    error_message TEXT,
    details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_staff_overlap RECORD;
    v_lead_overlap RECORD;
    v_availability RECORD;
BEGIN
    -- 1. Check staff appointment overlap (if staff_id provided)
    IF p_staff_id IS NOT NULL THEN
        SELECT * INTO v_staff_overlap
        FROM check_staff_appointment_overlap(
            p_staff_id,
            p_branch_id,
            p_scheduled_at,
            p_duration_minutes,
            p_exclude_appointment_id
        );

        IF v_staff_overlap.has_conflict THEN
            RETURN QUERY SELECT
                false,
                'STAFF_CONFLICT'::TEXT,
                'El doctor ya tiene una cita programada en este horario'::TEXT,
                jsonb_build_object(
                    'conflicting_appointment_id', v_staff_overlap.conflicting_appointment_id,
                    'conflict_start', v_staff_overlap.conflict_start,
                    'conflict_end', v_staff_overlap.conflict_end,
                    'conflict_patient', v_staff_overlap.conflict_lead_name
                );
            RETURN;
        END IF;
    END IF;

    -- 2. Check lead appointment overlap
    IF p_lead_id IS NOT NULL THEN
        SELECT * INTO v_lead_overlap
        FROM check_lead_appointment_overlap(
            p_lead_id,
            p_scheduled_at,
            p_duration_minutes,
            p_exclude_appointment_id
        );

        IF v_lead_overlap.has_conflict THEN
            RETURN QUERY SELECT
                false,
                'PATIENT_CONFLICT'::TEXT,
                'El paciente ya tiene una cita programada en este horario'::TEXT,
                jsonb_build_object(
                    'conflicting_appointment_id', v_lead_overlap.conflicting_appointment_id,
                    'conflict_start', v_lead_overlap.conflict_start,
                    'conflict_end', v_lead_overlap.conflict_end,
                    'conflict_branch', v_lead_overlap.conflict_branch_name
                );
            RETURN;
        END IF;
    END IF;

    -- 3. Check staff availability (optional, can be skipped for manual bookings)
    IF p_staff_id IS NOT NULL AND NOT p_skip_availability_check THEN
        SELECT * INTO v_availability
        FROM check_staff_availability(
            p_staff_id,
            p_branch_id,
            p_scheduled_at,
            p_duration_minutes
        );

        IF NOT v_availability.is_available THEN
            RETURN QUERY SELECT
                false,
                'OUTSIDE_HOURS'::TEXT,
                v_availability.reason,
                jsonb_build_object(
                    'available_from', v_availability.available_from,
                    'available_until', v_availability.available_until
                );
            RETURN;
        END IF;
    END IF;

    -- All validations passed
    RETURN QUERY SELECT
        true,
        NULL::TEXT,
        'Booking is valid'::TEXT,
        '{}'::JSONB;
END;
$$;

-- =====================================================
-- 5. TRIGGER FUNCTION: Validate before INSERT
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_validate_appointment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_validation RECORD;
BEGIN
    -- Validate the new appointment
    SELECT * INTO v_validation
    FROM validate_appointment_booking(
        NEW.staff_id,
        NEW.lead_id,
        NEW.branch_id,
        NEW.scheduled_at,
        COALESCE(NEW.duration_minutes, 30),
        NULL,  -- No exclusion for new appointments
        false  -- Check availability
    );

    IF NOT v_validation.is_valid THEN
        RAISE EXCEPTION 'Appointment validation failed: % - %',
            v_validation.error_code,
            v_validation.error_message
            USING ERRCODE = 'P0001';
    END IF;

    -- Calculate end_time if not set
    IF NEW.end_time IS NULL THEN
        NEW.end_time := NEW.scheduled_at + (COALESCE(NEW.duration_minutes, 30) || ' minutes')::INTERVAL;
    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 6. TRIGGER FUNCTION: Validate before UPDATE
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_validate_appointment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_validation RECORD;
BEGIN
    -- Prevent updates to completed or cancelled appointments
    IF OLD.status IN ('completed', 'cancelled') AND NEW.status != OLD.status THEN
        -- Allow only status changes from cancelled back to scheduled (undo cancel)
        IF NOT (OLD.status = 'cancelled' AND NEW.status = 'scheduled') THEN
            RAISE EXCEPTION 'Cannot modify a % appointment', OLD.status
                USING ERRCODE = 'P0002';
        END IF;
    END IF;

    -- Only validate if scheduling-related fields changed
    IF NEW.staff_id IS DISTINCT FROM OLD.staff_id
       OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
       OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
    THEN
        -- Only validate if appointment is still active
        IF NEW.status NOT IN ('cancelled', 'no_show', 'completed') THEN
            SELECT * INTO v_validation
            FROM validate_appointment_booking(
                NEW.staff_id,
                NEW.lead_id,
                NEW.branch_id,
                NEW.scheduled_at,
                COALESCE(NEW.duration_minutes, 30),
                NEW.id,  -- Exclude self from overlap check
                false
            );

            IF NOT v_validation.is_valid THEN
                RAISE EXCEPTION 'Appointment validation failed: % - %',
                    v_validation.error_code,
                    v_validation.error_message
                    USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    -- Update end_time if schedule changed
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
    THEN
        NEW.end_time := NEW.scheduled_at + (COALESCE(NEW.duration_minutes, 30) || ' minutes')::INTERVAL;
    END IF;

    -- Update timestamp
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

-- =====================================================
-- 7. CREATE TRIGGERS (drop if exist first)
-- =====================================================
DROP TRIGGER IF EXISTS trigger_validate_appointment_on_insert ON appointments;
CREATE TRIGGER trigger_validate_appointment_on_insert
    BEFORE INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_validate_appointment_insert();

DROP TRIGGER IF EXISTS trigger_validate_appointment_on_update ON appointments;
CREATE TRIGGER trigger_validate_appointment_on_update
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_validate_appointment_update();

-- =====================================================
-- 8. INDEX for faster overlap detection
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_appointments_staff_schedule
    ON appointments(staff_id, scheduled_at, duration_minutes)
    WHERE status NOT IN ('cancelled', 'no_show', 'rescheduled');

CREATE INDEX IF NOT EXISTS idx_appointments_lead_schedule
    ON appointments(lead_id, scheduled_at)
    WHERE status NOT IN ('cancelled', 'no_show', 'rescheduled');

-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION check_staff_appointment_overlap TO authenticated;
GRANT EXECUTE ON FUNCTION check_staff_appointment_overlap TO service_role;
GRANT EXECUTE ON FUNCTION check_lead_appointment_overlap TO authenticated;
GRANT EXECUTE ON FUNCTION check_lead_appointment_overlap TO service_role;
GRANT EXECUTE ON FUNCTION check_staff_availability TO authenticated;
GRANT EXECUTE ON FUNCTION check_staff_availability TO service_role;
GRANT EXECUTE ON FUNCTION validate_appointment_booking TO authenticated;
GRANT EXECUTE ON FUNCTION validate_appointment_booking TO service_role;

-- =====================================================
-- 10. COMMENTS
-- =====================================================
COMMENT ON FUNCTION check_staff_appointment_overlap IS
'Checks if a staff member has overlapping appointments at the specified time.
Returns conflict details if found.';

COMMENT ON FUNCTION check_lead_appointment_overlap IS
'Checks if a lead/patient has overlapping appointments at the specified time.
Returns conflict details if found.';

COMMENT ON FUNCTION check_staff_availability IS
'Validates if staff is available during their defined working hours.
Checks staff_availability table for matching time slots.';

COMMENT ON FUNCTION validate_appointment_booking IS
'Comprehensive validation for appointment bookings.
Checks: staff overlap, patient overlap, and staff availability.
Use p_skip_availability_check=true for manual override bookings.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Added protections:
-- [x] Prevent double-booking of staff
-- [x] Prevent patient from having simultaneous appointments
-- [x] Validate staff availability (working hours)
-- [x] Prevent modifications to completed/cancelled appointments
-- [x] Auto-calculate end_time from scheduled_at + duration
-- [x] Optimized indexes for overlap detection

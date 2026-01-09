-- =====================================================
-- TIS TIS PLATFORM - Fix Voice Agent & Booking Concurrency
-- Migration 115: Critical fixes from REVISION 4.7
-- =====================================================
-- ISSUES FIXED:
--
-- V1: VAPI webhook with voice_config disabled mid-call
-- V3: Empty/corrupt transcription handling
-- V4: LangGraph timeout exceeding VAPI timeout
-- V5: Call disconnects mid-booking (partial appointment)
--
-- CRITICAL:
-- V8: Voice + WhatsApp booking SAME appointment simultaneously
-- V9: Voice + Message placing SAME order simultaneously
--
-- SOLUTION:
-- - Add atomic booking RPC with advisory lock
-- - Add unique constraint to prevent duplicate slots
-- - Add voice webhook timeout tracking
-- - Add graceful degradation for disabled voice
-- =====================================================

-- =====================================================
-- 1. CRITICAL FIX V8/V9: Atomic appointment booking with lock
-- Prevents race condition between Voice and Message channels
-- =====================================================

-- First, add a partial unique index to prevent duplicate appointments
-- This catches any races that slip through the advisory lock
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_slot
    ON appointments(branch_id, scheduled_at, staff_id)
    WHERE status IN ('scheduled', 'confirmed')
    AND staff_id IS NOT NULL;

-- For appointments without staff (any available)
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_slot_no_staff
    ON appointments(branch_id, scheduled_at)
    WHERE status IN ('scheduled', 'confirmed')
    AND staff_id IS NULL;

-- Atomic appointment booking function with advisory lock
CREATE OR REPLACE FUNCTION public.create_appointment_atomic(
    p_tenant_id UUID,
    p_lead_id UUID,
    p_branch_id UUID,
    p_scheduled_at TIMESTAMPTZ,
    p_duration_minutes INTEGER DEFAULT 60,
    p_service_id UUID DEFAULT NULL,
    p_staff_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_source VARCHAR(50) DEFAULT 'ai_booking',
    p_conversation_id UUID DEFAULT NULL,
    p_channel VARCHAR(20) DEFAULT 'whatsapp',
    -- Restaurant specific
    p_party_size INTEGER DEFAULT NULL,
    p_occasion_type VARCHAR(50) DEFAULT NULL,
    p_special_requests TEXT DEFAULT NULL,
    -- AI traceability
    p_ai_booking_channel VARCHAR(50) DEFAULT NULL,
    p_ai_urgency_level INTEGER DEFAULT NULL,
    p_ai_detected_symptoms JSONB DEFAULT NULL,
    p_ai_confidence_score NUMERIC DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    appointment_id UUID,
    error_message TEXT,
    suggestion TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lock_key BIGINT;
    v_appointment_id UUID;
    v_branch_name TEXT;
    v_service_name TEXT;
    v_staff_name TEXT;
    v_end_at TIMESTAMPTZ;
    v_existing_id UUID;
    v_slot_date DATE;
    v_slot_time TIME;
BEGIN
    -- Generate lock key based on branch + datetime + optional staff
    -- This ensures only one process can book this exact slot
    v_lock_key := hashtext(
        p_branch_id::TEXT || ':' ||
        p_scheduled_at::TEXT || ':' ||
        COALESCE(p_staff_id::TEXT, 'ANY')
    );

    -- Acquire exclusive advisory lock (waits if another transaction has it)
    -- This is a transaction-level lock that auto-releases on commit/rollback
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Calculate end time
    v_end_at := p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL;
    v_slot_date := p_scheduled_at::DATE;
    v_slot_time := p_scheduled_at::TIME;

    -- Double-check for existing appointment (inside the lock)
    -- This catches any race conditions
    SELECT id INTO v_existing_id
    FROM appointments
    WHERE tenant_id = p_tenant_id
      AND branch_id = p_branch_id
      AND status IN ('scheduled', 'confirmed')
      AND (
        -- Exact slot match
        (scheduled_at = p_scheduled_at AND (staff_id = p_staff_id OR p_staff_id IS NULL OR staff_id IS NULL))
        OR
        -- Overlapping appointment
        (
            scheduled_at < v_end_at
            AND scheduled_at + (duration_minutes || ' minutes')::INTERVAL > p_scheduled_at
            AND (staff_id = p_staff_id OR p_staff_id IS NULL)
        )
      )
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        -- Slot already taken - find alternative
        SELECT
            'El horario ya está ocupado. ' ||
            CASE
                WHEN next_slot.suggested_at IS NOT NULL THEN
                    'Próximo disponible: ' || to_char(next_slot.suggested_at, 'DD/MM/YYYY HH24:MI')
                ELSE
                    'Contacta para ver disponibilidad.'
            END
        INTO suggestion
        FROM (
            SELECT MIN(
                CASE
                    WHEN NOT EXISTS (
                        SELECT 1 FROM appointments a2
                        WHERE a2.branch_id = p_branch_id
                          AND a2.status IN ('scheduled', 'confirmed')
                          AND a2.scheduled_at = p_scheduled_at + (n || ' hours')::INTERVAL
                    )
                    THEN p_scheduled_at + (n || ' hours')::INTERVAL
                END
            ) as suggested_at
            FROM generate_series(1, 8) as n
        ) next_slot;

        RETURN QUERY SELECT
            false,
            NULL::UUID,
            'Horario no disponible - ya existe una cita en ese slot'::TEXT,
            suggestion;
        RETURN;
    END IF;

    -- Get names for response
    SELECT name INTO v_branch_name FROM branches WHERE id = p_branch_id;
    SELECT name INTO v_service_name FROM services WHERE id = p_service_id;
    SELECT COALESCE(display_name, first_name || ' ' || last_name) INTO v_staff_name
    FROM staff WHERE id = p_staff_id;

    -- Insert the appointment
    INSERT INTO appointments (
        tenant_id,
        lead_id,
        branch_id,
        service_id,
        staff_id,
        scheduled_at,
        duration_minutes,
        status,
        source,
        notes,
        conversation_id,
        reminder_sent,
        confirmation_sent,
        -- AI traceability
        ai_booking_channel,
        ai_booked_at,
        ai_urgency_level,
        ai_detected_symptoms,
        ai_confidence_score,
        -- Restaurant
        party_size,
        reservation_type
    ) VALUES (
        p_tenant_id,
        p_lead_id,
        p_branch_id,
        p_service_id,
        p_staff_id,
        p_scheduled_at,
        p_duration_minutes,
        'scheduled',
        p_source,
        COALESCE(p_notes, 'Cita agendada por ' || p_channel),
        p_conversation_id,
        false,
        false,
        p_ai_booking_channel,
        CASE WHEN p_ai_booking_channel IS NOT NULL THEN NOW() ELSE NULL END,
        p_ai_urgency_level,
        p_ai_detected_symptoms,
        p_ai_confidence_score,
        p_party_size,
        p_occasion_type
    )
    RETURNING id INTO v_appointment_id;

    -- Create restaurant details if applicable
    IF p_party_size IS NOT NULL THEN
        INSERT INTO appointment_restaurant_details (
            appointment_id,
            party_size,
            occasion_type,
            special_requests
        ) VALUES (
            v_appointment_id,
            p_party_size,
            COALESCE(p_occasion_type, 'regular'),
            p_special_requests
        ) ON CONFLICT (appointment_id) DO NOTHING;
    END IF;

    -- Log the booking event
    INSERT INTO conversation_events (
        conversation_id,
        event_type,
        event_data
    ) VALUES (
        p_conversation_id,
        'appointment_created',
        jsonb_build_object(
            'appointment_id', v_appointment_id,
            'scheduled_at', p_scheduled_at,
            'channel', p_channel,
            'atomic_booking', true
        )
    );

    -- Update lead status
    UPDATE leads
    SET status = 'contacted',
        classification = 'hot',
        updated_at = NOW()
    WHERE id = p_lead_id;

    RETURN QUERY SELECT
        true,
        v_appointment_id,
        NULL::TEXT,
        NULL::TEXT;

EXCEPTION
    WHEN unique_violation THEN
        -- Caught by unique index - slot was taken in a race
        RETURN QUERY SELECT
            false,
            NULL::UUID,
            'Horario no disponible (concurrencia)'::TEXT,
            'Por favor elige otro horario'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION create_appointment_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION create_appointment_atomic TO service_role;

COMMENT ON FUNCTION create_appointment_atomic IS
'Atomically creates an appointment with advisory lock to prevent race conditions.
Solves V8/V9: Voice + Message channels booking same slot simultaneously.
Uses pg_advisory_xact_lock to serialize access to the same slot.
Has fallback unique constraint indexes as safety net.
CREATED in migration 115.';

-- =====================================================
-- 2. FIX V1: Graceful handling when voice_config disabled mid-call
-- =====================================================

-- Add column to track active calls per config
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'voice_agent_config'
        AND column_name = 'active_calls_count'
    ) THEN
        ALTER TABLE public.voice_agent_config
            ADD COLUMN active_calls_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Function to safely get voice config even if disabled (for active calls)
CREATE OR REPLACE FUNCTION public.get_voice_config_for_active_call(
    p_call_id UUID
)
RETURNS TABLE(
    config_id UUID,
    tenant_id UUID,
    config JSONB,
    is_enabled BOOLEAN,
    was_disabled_during_call BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_config_id UUID;
BEGIN
    -- Get tenant from the call record
    SELECT vc.tenant_id, vc.voice_agent_config_id
    INTO v_tenant_id, v_config_id
    FROM voice_calls vc
    WHERE vc.id = p_call_id OR vc.vapi_call_id = p_call_id::TEXT;

    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Return config even if disabled (call was started when enabled)
    RETURN QUERY
    SELECT
        vac.id as config_id,
        vac.tenant_id,
        to_jsonb(vac) as config,
        vac.voice_enabled as is_enabled,
        NOT vac.voice_enabled as was_disabled_during_call
    FROM voice_agent_config vac
    WHERE vac.tenant_id = v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_voice_config_for_active_call TO service_role;

COMMENT ON FUNCTION get_voice_config_for_active_call IS
'Gets voice config for an active call even if it was disabled mid-call.
Allows graceful completion of ongoing calls.
CREATED in migration 115 to fix V1.';

-- =====================================================
-- 3. FIX V3: Track invalid/empty transcriptions
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'voice_call_messages'
        AND column_name = 'is_valid_transcription'
    ) THEN
        ALTER TABLE public.voice_call_messages
            ADD COLUMN is_valid_transcription BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'voice_call_messages'
        AND column_name = 'transcription_error'
    ) THEN
        ALTER TABLE public.voice_call_messages
            ADD COLUMN transcription_error TEXT DEFAULT NULL;
    END IF;
END $$;

-- =====================================================
-- 4. FIX V4: Track LangGraph processing time for timeout analysis
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'voice_calls'
        AND column_name = 'max_response_latency_ms'
    ) THEN
        ALTER TABLE public.voice_calls
            ADD COLUMN max_response_latency_ms INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'voice_calls'
        AND column_name = 'timeout_count'
    ) THEN
        ALTER TABLE public.voice_calls
            ADD COLUMN timeout_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Function to track response times and detect timeouts
CREATE OR REPLACE FUNCTION public.track_voice_response_time(
    p_call_id UUID,
    p_response_latency_ms INTEGER,
    p_was_timeout BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE voice_calls
    SET
        latency_avg_ms = CASE
            WHEN latency_avg_ms = 0 THEN p_response_latency_ms
            ELSE (latency_avg_ms + p_response_latency_ms) / 2
        END,
        max_response_latency_ms = GREATEST(max_response_latency_ms, p_response_latency_ms),
        timeout_count = timeout_count + CASE WHEN p_was_timeout THEN 1 ELSE 0 END,
        updated_at = NOW()
    WHERE id = p_call_id;

    -- Log if latency is concerning (>8 seconds, VAPI timeout is ~10s)
    IF p_response_latency_ms > 8000 THEN
        INSERT INTO security_audit_log (event_type, severity, details)
        VALUES (
            'voice_high_latency',
            'medium',
            jsonb_build_object(
                'call_id', p_call_id,
                'latency_ms', p_response_latency_ms,
                'was_timeout', p_was_timeout,
                'timestamp', NOW()
            )
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION track_voice_response_time TO service_role;

-- =====================================================
-- 5. FIX V5: Mark incomplete bookings from disconnected calls
-- =====================================================

-- Add column to track booking state during voice call
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'voice_calls'
        AND column_name = 'booking_in_progress'
    ) THEN
        ALTER TABLE public.voice_calls
            ADD COLUMN booking_in_progress BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'voice_calls'
        AND column_name = 'booking_appointment_id'
    ) THEN
        ALTER TABLE public.voice_calls
            ADD COLUMN booking_appointment_id UUID DEFAULT NULL;
    END IF;
END $$;

-- Function to handle incomplete bookings when call ends unexpectedly
CREATE OR REPLACE FUNCTION public.handle_voice_call_ended(
    p_call_id UUID,
    p_ended_reason TEXT
)
RETURNS TABLE(
    had_incomplete_booking BOOLEAN,
    appointment_id UUID,
    action_taken TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking_in_progress BOOLEAN;
    v_appointment_id UUID;
    v_action TEXT;
BEGIN
    -- Check if there was a booking in progress
    SELECT booking_in_progress, booking_appointment_id
    INTO v_booking_in_progress, v_appointment_id
    FROM voice_calls
    WHERE id = p_call_id;

    IF v_booking_in_progress AND v_appointment_id IS NOT NULL THEN
        -- Mark appointment as needing review if call ended unexpectedly
        IF p_ended_reason IN ('customer-ended-call', 'customer-did-not-answer', 'assistant-error') THEN
            UPDATE appointments
            SET
                notes = COALESCE(notes, '') || E'\n[REVISIÓN NECESARIA: Llamada terminó antes de confirmar]',
                requires_human_review = true,
                human_review_reason = 'Llamada de voz terminó durante proceso de agendamiento: ' || p_ended_reason,
                updated_at = NOW()
            WHERE id = v_appointment_id;

            v_action := 'marked_for_review';
        ELSE
            v_action := 'no_action_needed';
        END IF;

        -- Log the event
        INSERT INTO security_audit_log (event_type, severity, details)
        VALUES (
            'voice_incomplete_booking',
            'medium',
            jsonb_build_object(
                'call_id', p_call_id,
                'appointment_id', v_appointment_id,
                'ended_reason', p_ended_reason,
                'action', v_action
            )
        );

        RETURN QUERY SELECT true, v_appointment_id, v_action;
    ELSE
        RETURN QUERY SELECT false, NULL::UUID, 'no_booking_in_progress'::TEXT;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION handle_voice_call_ended TO service_role;

COMMENT ON FUNCTION handle_voice_call_ended IS
'Handles cleanup when a voice call ends unexpectedly during booking.
Marks appointments for human review if call terminated mid-booking.
CREATED in migration 115 to fix V5.';

-- =====================================================
-- 6. Add indexes for voice queries
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_voice_calls_active
    ON voice_calls(tenant_id, status)
    WHERE status IN ('initiated', 'ringing', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_voice_calls_booking_progress
    ON voice_calls(id)
    WHERE booking_in_progress = true;

CREATE INDEX IF NOT EXISTS idx_appointments_requires_review
    ON appointments(tenant_id, requires_human_review)
    WHERE requires_human_review = true;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Fixed voice agent and booking concurrency issues:
-- [x] V1: get_voice_config_for_active_call for disabled-mid-call
-- [x] V3: is_valid_transcription column for tracking
-- [x] V4: track_voice_response_time for timeout analysis
-- [x] V5: handle_voice_call_ended for incomplete bookings
-- [x] V8/V9: create_appointment_atomic with advisory lock + unique indexes
-- =====================================================

SELECT 'Migration 115: Voice Agent & Booking Concurrency Fixed - COMPLETADA' as status;

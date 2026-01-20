-- =====================================================
-- TIS TIS PLATFORM - VOICE AGENT v2.0
-- Migration: 150_VOICE_AGENT_V2_FIXES.sql
-- Date: January 2025
-- Version: 2.0.1
--
-- PURPOSE: Correcciones criticas para Voice Agent v2.0
-- basadas en analisis exhaustivo de compatibilidad con
-- el schema existente.
--
-- FIXES:
-- 1. Constraint unique_business_branch con NULL handling
-- 2. Funciones corregidas para schema real de voice_calls
-- 3. Funciones corregidas para schema real de leads/appointments
-- 4. Validacion de phone_number E.164
-- 5. Indice faltante para vapi_squad_id
-- 6. Funcion para reset de ventana de circuit breaker
-- =====================================================

-- =====================================================
-- FIX 1: Corregir CONSTRAINT unique_business_branch
-- El constraint original no maneja NULL correctamente
-- =====================================================

-- Eliminar constraint problemático
ALTER TABLE public.voice_assistant_configs
    DROP CONSTRAINT IF EXISTS unique_business_branch;

-- Crear indice unico parcial que maneja NULL correctamente
-- Un business sin branch solo puede tener UNA config
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_assistant_configs_business_no_branch
    ON public.voice_assistant_configs(business_id)
    WHERE branch_id IS NULL;

-- Un business con branch especifico solo puede tener UNA config por branch
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_assistant_configs_business_with_branch
    ON public.voice_assistant_configs(business_id, branch_id)
    WHERE branch_id IS NOT NULL;

-- =====================================================
-- FIX 2: Agregar CHECK constraint para E.164 format
-- =====================================================

ALTER TABLE public.voice_assistant_configs
    DROP CONSTRAINT IF EXISTS phone_number_e164_format;

ALTER TABLE public.voice_assistant_configs
    ADD CONSTRAINT phone_number_e164_format
    CHECK (
        phone_number IS NULL OR
        phone_number ~ '^\+[1-9]\d{6,14}$'
    );

-- =====================================================
-- FIX 3: Agregar indice faltante para vapi_squad_id
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_voice_assistant_configs_vapi_squad
    ON public.voice_assistant_configs(vapi_squad_id)
    WHERE vapi_squad_id IS NOT NULL;

-- =====================================================
-- FIX 4: Reemplazar aggregate_voice_metrics con version
-- compatible con schema real de voice_calls
-- =====================================================

CREATE OR REPLACE FUNCTION aggregate_voice_metrics(
    p_business_id UUID,
    p_period_type VARCHAR,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_config_id UUID;
    v_metric_id UUID;
    v_metrics RECORD;
BEGIN
    -- Obtener tenant_id y config_id
    SELECT tenant_id, id INTO v_tenant_id, v_config_id
    FROM public.voice_assistant_configs
    WHERE business_id = p_business_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        -- Intentar obtener de business directamente
        SELECT tenant_id INTO v_tenant_id
        FROM public.businesses
        WHERE id = p_business_id;
    END IF;

    -- Si no hay tenant_id, no podemos continuar
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Business ID % not found', p_business_id;
    END IF;

    -- Calcular metricas agregadas desde voice_calls
    -- NOTA: Usamos el schema REAL de voice_calls (067_VOICE_AGENT_SYSTEM.sql)
    SELECT
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE vc.status = 'completed') as successful_calls,
        COUNT(*) FILTER (WHERE vc.status = 'failed') as failed_calls,
        COUNT(*) FILTER (WHERE vc.status IN ('canceled', 'no_answer')) as abandoned_calls,
        COUNT(*) FILTER (WHERE vc.status = 'escalated') as transferred_calls,
        COALESCE(SUM(vc.duration_seconds), 0) as total_duration,
        COALESCE(AVG(vc.duration_seconds), 0) as avg_duration,
        COALESCE(MIN(vc.duration_seconds), 0) as min_duration,
        COALESCE(MAX(vc.duration_seconds), 0) as max_duration,
        -- latency_avg_ms existe en voice_usage_logs, no en voice_calls directamente
        0 as avg_latency,
        0 as p50_latency,
        0 as p95_latency,
        0 as p99_latency,
        -- Contar reservaciones/citas desde analysis JSONB
        COUNT(*) FILTER (WHERE vc.outcome = 'appointment_booked') as appointments_created,
        COUNT(*) FILTER (WHERE vc.analysis->>'reservation_created' = 'true') as reservations_created,
        COUNT(*) FILTER (WHERE vc.analysis->>'order_created' = 'true') as orders_created,
        COUNT(*) FILTER (WHERE vc.status = 'escalated') as human_transfers
    INTO v_metrics
    FROM public.voice_calls vc
    JOIN public.voice_agent_config vac ON vc.voice_agent_config_id = vac.id
    JOIN public.businesses b ON vac.tenant_id = b.tenant_id
    WHERE b.id = p_business_id
        AND vc.started_at >= p_start_date
        AND vc.started_at < p_end_date;

    -- Insertar o actualizar metricas
    INSERT INTO public.voice_assistant_metrics (
        tenant_id,
        business_id,
        config_id,
        period_type,
        period_start,
        period_end,
        total_calls,
        successful_calls,
        failed_calls,
        abandoned_calls,
        transferred_calls,
        total_duration_seconds,
        avg_duration_seconds,
        min_duration_seconds,
        max_duration_seconds,
        avg_latency_ms,
        p50_latency_ms,
        p95_latency_ms,
        p99_latency_ms,
        reservations_created,
        appointments_created,
        orders_created,
        human_transfers,
        is_aggregated,
        aggregated_at
    )
    VALUES (
        v_tenant_id,
        p_business_id,
        v_config_id,
        p_period_type,
        p_start_date,
        p_end_date,
        COALESCE(v_metrics.total_calls, 0),
        COALESCE(v_metrics.successful_calls, 0),
        COALESCE(v_metrics.failed_calls, 0),
        COALESCE(v_metrics.abandoned_calls, 0),
        COALESCE(v_metrics.transferred_calls, 0),
        COALESCE(v_metrics.total_duration, 0),
        COALESCE(v_metrics.avg_duration, 0),
        COALESCE(v_metrics.min_duration, 0),
        COALESCE(v_metrics.max_duration, 0),
        COALESCE(v_metrics.avg_latency, 0),
        COALESCE(v_metrics.p50_latency, 0),
        COALESCE(v_metrics.p95_latency, 0),
        COALESCE(v_metrics.p99_latency, 0),
        COALESCE(v_metrics.reservations_created, 0),
        COALESCE(v_metrics.appointments_created, 0),
        COALESCE(v_metrics.orders_created, 0),
        COALESCE(v_metrics.human_transfers, 0),
        true,
        NOW()
    )
    ON CONFLICT (business_id, config_id, period_type, period_start)
    DO UPDATE SET
        total_calls = EXCLUDED.total_calls,
        successful_calls = EXCLUDED.successful_calls,
        failed_calls = EXCLUDED.failed_calls,
        abandoned_calls = EXCLUDED.abandoned_calls,
        transferred_calls = EXCLUDED.transferred_calls,
        total_duration_seconds = EXCLUDED.total_duration_seconds,
        avg_duration_seconds = EXCLUDED.avg_duration_seconds,
        min_duration_seconds = EXCLUDED.min_duration_seconds,
        max_duration_seconds = EXCLUDED.max_duration_seconds,
        avg_latency_ms = EXCLUDED.avg_latency_ms,
        p50_latency_ms = EXCLUDED.p50_latency_ms,
        p95_latency_ms = EXCLUDED.p95_latency_ms,
        p99_latency_ms = EXCLUDED.p99_latency_ms,
        reservations_created = EXCLUDED.reservations_created,
        appointments_created = EXCLUDED.appointments_created,
        orders_created = EXCLUDED.orders_created,
        human_transfers = EXCLUDED.human_transfers,
        is_aggregated = true,
        aggregated_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_metric_id;

    RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIX 5: Reemplazar create_voice_appointment con version
-- compatible con schema real de appointments
-- =====================================================

CREATE OR REPLACE FUNCTION create_voice_appointment(
    p_business_id UUID,
    p_call_id UUID,
    p_customer_name VARCHAR,
    p_customer_phone VARCHAR,
    p_date DATE,
    p_time TIME,
    p_service_id UUID DEFAULT NULL,
    p_staff_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_branch_id UUID;
    v_lead_id UUID;
    v_appointment_id UUID;
    v_duration INTEGER := 30;
    v_scheduled_at TIMESTAMPTZ;
    v_name_parts TEXT[];
BEGIN
    -- Obtener tenant_id y branch_id del business
    SELECT b.tenant_id, br.id INTO v_tenant_id, v_branch_id
    FROM public.businesses b
    LEFT JOIN public.branches br ON br.tenant_id = b.tenant_id
    WHERE b.id = p_business_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Business not found'
        );
    END IF;

    -- appointments.branch_id es NOT NULL, necesitamos un branch
    IF v_branch_id IS NULL THEN
        -- Intentar obtener el primer branch del tenant
        SELECT id INTO v_branch_id
        FROM public.branches
        WHERE tenant_id = v_tenant_id
        LIMIT 1;

        IF v_branch_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'No branch found for this business. Cannot create appointment.'
            );
        END IF;
    END IF;

    -- Parsear nombre en first_name y last_name
    v_name_parts := string_to_array(p_customer_name, ' ');

    -- Obtener o crear lead (usando schema real de leads)
    -- NOTA: El constraint UNIQUE es en (tenant_id, phone_normalized)
    INSERT INTO public.leads (
        tenant_id,
        branch_id,
        phone,
        phone_normalized,
        first_name,
        last_name,
        full_name,
        source,
        status
    )
    VALUES (
        v_tenant_id,
        v_branch_id,
        p_customer_phone,
        regexp_replace(p_customer_phone, '[^0-9]', '', 'g'),
        COALESCE(v_name_parts[1], 'Cliente'),
        COALESCE(array_to_string(v_name_parts[2:], ' '), ''),
        p_customer_name,
        'phone',
        'appointment_scheduled'
    )
    ON CONFLICT (tenant_id, phone_normalized)
    DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, leads.full_name),
        status = 'appointment_scheduled',
        updated_at = NOW()
    RETURNING id INTO v_lead_id;

    -- Obtener duracion del servicio si se especifico
    IF p_service_id IS NOT NULL THEN
        SELECT duration_minutes INTO v_duration
        FROM public.services
        WHERE id = p_service_id;
        v_duration := COALESCE(v_duration, 30);
    END IF;

    -- Construir scheduled_at (schema real usa TIMESTAMPTZ, no date+time separados)
    v_scheduled_at := (p_date || ' ' || p_time)::TIMESTAMPTZ;

    -- Crear cita (usando schema real de appointments)
    INSERT INTO public.appointments (
        tenant_id,
        branch_id,
        lead_id,
        staff_id,
        service_id,
        scheduled_at,
        duration_minutes,
        end_time,
        status,
        notes,
        booking_source
    )
    VALUES (
        v_tenant_id,
        v_branch_id,
        v_lead_id,
        p_staff_id,
        p_service_id,
        v_scheduled_at,
        v_duration,
        v_scheduled_at + (v_duration || ' minutes')::interval,
        'confirmed',
        COALESCE(p_notes, '') || E'\n[Creado via Voice Agent - Call ID: ' || p_call_id || ']',
        'phone'
    )
    RETURNING id INTO v_appointment_id;

    RETURN jsonb_build_object(
        'success', true,
        'appointment_id', v_appointment_id,
        'lead_id', v_lead_id,
        'scheduled_at', v_scheduled_at,
        'duration_minutes', v_duration
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIX 6: Reemplazar create_voice_reservation
-- Nota: La tabla reservations puede no existir en todos
-- los tenants. Usamos insercion condicional.
-- =====================================================

CREATE OR REPLACE FUNCTION create_voice_reservation(
    p_business_id UUID,
    p_call_id UUID,
    p_customer_name VARCHAR,
    p_customer_phone VARCHAR,
    p_date DATE,
    p_time TIME,
    p_party_size INTEGER,
    p_special_requests TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_branch_id UUID;
    v_lead_id UUID;
    v_reservation_id UUID;
    v_name_parts TEXT[];
    v_has_reservations_table BOOLEAN;
BEGIN
    -- Verificar si existe tabla de reservaciones
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'reservations'
    ) INTO v_has_reservations_table;

    -- Obtener tenant_id y branch_id
    SELECT b.tenant_id, br.id INTO v_tenant_id, v_branch_id
    FROM public.businesses b
    LEFT JOIN public.branches br ON br.tenant_id = b.tenant_id
    WHERE b.id = p_business_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Business not found'
        );
    END IF;

    -- Parsear nombre
    v_name_parts := string_to_array(p_customer_name, ' ');

    -- Obtener o crear lead
    -- NOTA: El constraint UNIQUE es en (tenant_id, phone_normalized)
    INSERT INTO public.leads (
        tenant_id,
        branch_id,
        phone,
        phone_normalized,
        first_name,
        last_name,
        full_name,
        source,
        status
    )
    VALUES (
        v_tenant_id,
        v_branch_id,
        p_customer_phone,
        regexp_replace(p_customer_phone, '[^0-9]', '', 'g'),
        COALESCE(v_name_parts[1], 'Cliente'),
        COALESCE(array_to_string(v_name_parts[2:], ' '), ''),
        p_customer_name,
        'phone',
        'converted'
    )
    ON CONFLICT (tenant_id, phone_normalized)
    DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, leads.full_name),
        status = 'converted',
        updated_at = NOW()
    RETURNING id INTO v_lead_id;

    -- Si existe tabla de reservaciones, crear reservacion
    IF v_has_reservations_table THEN
        EXECUTE format(
            'INSERT INTO public.reservations (
                tenant_id, branch_id, lead_id, reservation_date, reservation_time,
                party_size, status, special_requests, source, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id'
        )
        USING
            v_tenant_id,
            v_branch_id,
            v_lead_id,
            p_date,
            p_time,
            p_party_size,
            'confirmed',
            p_special_requests,
            'phone',
            'Creado via Voice Agent - Call ID: ' || p_call_id
        INTO v_reservation_id;

        RETURN jsonb_build_object(
            'success', true,
            'reservation_id', v_reservation_id,
            'lead_id', v_lead_id,
            'date', p_date,
            'time', p_time,
            'party_size', p_party_size
        );
    ELSE
        -- Si no hay tabla de reservaciones, solo retornar el lead creado
        -- y notificar que la reservacion debe manejarse manualmente
        RETURN jsonb_build_object(
            'success', true,
            'reservation_id', NULL,
            'lead_id', v_lead_id,
            'date', p_date,
            'time', p_time,
            'party_size', p_party_size,
            'warning', 'Reservations table not found - lead created only'
        );
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIX 7: Reemplazar check_voice_availability
-- Compatible con schema real de appointments
-- NOTA: Usa ai_tenant_config para business_hours (no existe tabla business_hours)
-- =====================================================

CREATE OR REPLACE FUNCTION check_voice_availability(
    p_business_id UUID,
    p_date DATE,
    p_time TIME,
    p_duration_minutes INTEGER DEFAULT 60,
    p_staff_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_branch_id UUID;
    v_scheduled_at TIMESTAMPTZ;
    v_end_at TIMESTAMPTZ;
    v_is_available BOOLEAN := true;
    v_reason TEXT;
    v_alternatives JSONB := '[]'::jsonb;
    v_day_of_week INTEGER;
    -- Variables para business hours desde ai_tenant_config
    v_bh_start TIME;
    v_bh_end TIME;
    v_bh_days INTEGER[];
BEGIN
    -- Obtener tenant y branch
    SELECT b.tenant_id, br.id INTO v_tenant_id, v_branch_id
    FROM public.businesses b
    LEFT JOIN public.branches br ON br.tenant_id = b.tenant_id
    WHERE b.id = p_business_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object(
            'available', false,
            'reason', 'Business not found'
        );
    END IF;

    v_scheduled_at := (p_date || ' ' || p_time)::TIMESTAMPTZ;
    v_end_at := v_scheduled_at + (p_duration_minutes || ' minutes')::interval;
    -- PostgreSQL DOW: 0=Sunday, 1=Monday, ..., 6=Saturday
    -- ai_tenant_config usa: 1=Monday, ..., 7=Sunday
    v_day_of_week := EXTRACT(DOW FROM p_date)::INTEGER;
    IF v_day_of_week = 0 THEN
        v_day_of_week := 7; -- Convertir domingo de 0 a 7
    END IF;

    -- Verificar horario de negocio desde ai_tenant_config
    -- (NO existe tabla business_hours, los horarios estan en ai_tenant_config)
    SELECT
        COALESCE(atc.business_hours_start, '09:00'::TIME),
        COALESCE(atc.business_hours_end, '18:00'::TIME),
        COALESCE(atc.business_hours_days, ARRAY[1,2,3,4,5])
    INTO v_bh_start, v_bh_end, v_bh_days
    FROM public.ai_tenant_config atc
    WHERE atc.tenant_id = v_tenant_id;

    -- Si no hay config, usar defaults
    IF v_bh_start IS NULL THEN
        v_bh_start := '09:00'::TIME;
        v_bh_end := '18:00'::TIME;
        v_bh_days := ARRAY[1,2,3,4,5];
    END IF;

    -- Verificar si el dia esta dentro de los dias laborales
    IF NOT (v_day_of_week = ANY(v_bh_days)) THEN
        v_is_available := false;
        v_reason := 'El negocio no abre ese dia de la semana';
    -- Verificar si la hora esta dentro del horario de apertura
    ELSIF p_time < v_bh_start OR (p_time + (p_duration_minutes || ' minutes')::interval)::TIME > v_bh_end THEN
        v_is_available := false;
        v_reason := 'El negocio no esta abierto en ese horario. Horario: ' || v_bh_start::TEXT || ' - ' || v_bh_end::TEXT;
    END IF;

    -- Verificar conflictos con citas existentes (usando scheduled_at)
    IF v_is_available AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.tenant_id = v_tenant_id
            AND (v_branch_id IS NULL OR a.branch_id = v_branch_id)
            AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled')
            AND (p_staff_id IS NULL OR a.staff_id = p_staff_id)
            AND (
                -- Nueva cita empieza durante una existente
                (v_scheduled_at >= a.scheduled_at AND v_scheduled_at < COALESCE(a.end_time, a.scheduled_at + interval '30 minutes'))
                OR
                -- Nueva cita termina durante una existente
                (v_end_at > a.scheduled_at AND v_end_at <= COALESCE(a.end_time, a.scheduled_at + interval '30 minutes'))
                OR
                -- Nueva cita envuelve una existente
                (v_scheduled_at <= a.scheduled_at AND v_end_at >= COALESCE(a.end_time, a.scheduled_at + interval '30 minutes'))
            )
    ) THEN
        v_is_available := false;
        v_reason := 'Ya existe una cita en ese horario';

        -- Buscar alternativas cercanas (proximas 5 horas, cada 30 min)
        WITH slots AS (
            SELECT generate_series(
                v_scheduled_at - interval '2 hours',
                v_scheduled_at + interval '3 hours',
                interval '30 minutes'
            ) AS slot_time
        )
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'date', slot_time::DATE,
                'time', slot_time::TIME
            )
        ), '[]'::jsonb)
        INTO v_alternatives
        FROM slots s
        WHERE s.slot_time > NOW()
            AND NOT EXISTS (
                SELECT 1 FROM public.appointments a
                WHERE a.tenant_id = v_tenant_id
                    AND (v_branch_id IS NULL OR a.branch_id = v_branch_id)
                    AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled')
                    AND s.slot_time >= a.scheduled_at
                    AND s.slot_time < COALESCE(a.end_time, a.scheduled_at + interval '30 minutes')
            )
        LIMIT 5;
    END IF;

    RETURN jsonb_build_object(
        'available', v_is_available,
        'reason', v_reason,
        'requested_date', p_date,
        'requested_time', p_time,
        'alternatives', v_alternatives,
        'business_hours', jsonb_build_object(
            'start', v_bh_start,
            'end', v_bh_end,
            'days', v_bh_days
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FIX 8: Reemplazar get_voice_call_history
-- Compatible con schema real de voice_calls
-- =====================================================

CREATE OR REPLACE FUNCTION get_voice_call_history(
    p_business_id UUID,
    p_phone_number VARCHAR DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_calls JSONB;
BEGIN
    -- Obtener tenant_id del business
    SELECT tenant_id INTO v_tenant_id
    FROM public.businesses
    WHERE id = p_business_id;

    IF v_tenant_id IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Usar schema real: caller_phone (no caller_phone_number)
    -- analysis (no analysis_data), outcome existe, no hay call_summary ni end_reason directo
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'call_id', vc.id,
            'started_at', vc.started_at,
            'ended_at', vc.ended_at,
            'duration_seconds', vc.duration_seconds,
            'status', vc.status,
            'outcome', vc.outcome,
            'caller_phone', vc.caller_phone,
            'analysis', vc.analysis,
            'primary_intent', vc.primary_intent
        )
        ORDER BY vc.started_at DESC
    ), '[]'::jsonb)
    INTO v_calls
    FROM public.voice_calls vc
    WHERE vc.tenant_id = v_tenant_id
        AND (p_phone_number IS NULL OR vc.caller_phone = p_phone_number)
    LIMIT p_limit;

    RETURN v_calls;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FIX 9: Agregar funcion para reset de ventana de
-- tiempo del circuit breaker (faltante)
-- =====================================================

CREATE OR REPLACE FUNCTION reset_circuit_breaker_window(
    p_business_id UUID,
    p_service_name VARCHAR DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.voice_circuit_breaker_state
    SET
        window_start = NOW(),
        window_failure_count = 0,
        window_success_count = 0,
        window_total_count = 0
    WHERE business_id = p_business_id
        AND (p_service_name IS NULL OR service_name = p_service_name);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_circuit_breaker_window IS
'Resetea la ventana de tiempo del circuit breaker. Se debe llamar cada 5 minutos via cron.';

-- =====================================================
-- FIX 10: Corregir get_voice_business_context
-- Compatible con schema real
-- NOTA: Usa ai_tenant_config para business_hours (no existe tabla business_hours)
-- =====================================================

CREATE OR REPLACE FUNCTION get_voice_business_context(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_tenant_id UUID;
    v_staff JSONB := '[]'::jsonb;
    v_services JSONB := '[]'::jsonb;
    v_hours JSONB := '{}'::jsonb;
    v_branch_id UUID;
    -- Variables para business hours desde ai_tenant_config
    v_bh_start TIME;
    v_bh_end TIME;
    v_bh_days INTEGER[];
BEGIN
    -- Obtener informacion basica del negocio
    SELECT jsonb_build_object(
        'business_name', b.name,
        'phone', b.phone,
        'email', b.email,
        'address', b.address,
        'city', b.city,
        'state', b.state,
        'country', b.country,
        'timezone', COALESCE(b.timezone, 'America/Mexico_City'),
        'vertical', t.vertical,
        'settings', b.settings
    ), br.id, t.id
    INTO v_result, v_branch_id, v_tenant_id
    FROM public.businesses b
    JOIN public.tenants t ON b.tenant_id = t.id
    LEFT JOIN public.branches br ON br.tenant_id = t.id
    WHERE b.id = p_business_id;

    IF v_result IS NULL THEN
        RETURN jsonb_build_object('error', 'Business not found');
    END IF;

    -- Obtener staff activo
    -- NOTA: staff NO tiene branch_id directo. La relación es via staff_branches (many-to-many)
    -- Schema: staff tiene tenant_id, y staff_branches conecta staff_id con branch_id
    BEGIN
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', s.id,
                'name', COALESCE(s.display_name, s.first_name || ' ' || COALESCE(s.last_name, '')),
                'role', s.role,
                'specialty', s.specialty
            )
        ), '[]'::jsonb)
        INTO v_staff
        FROM public.staff s
        WHERE s.tenant_id = v_tenant_id
            AND s.is_active = true
            AND (
                v_branch_id IS NULL
                OR EXISTS (
                    SELECT 1 FROM public.staff_branches sb
                    WHERE sb.staff_id = s.id AND sb.branch_id = v_branch_id
                )
            );
    EXCEPTION WHEN undefined_column THEN
        v_staff := '[]'::jsonb;
    END;

    -- Obtener servicios (si existe la tabla)
    -- NOTA: services usa tenant_id, NO branch_id (schema 012_CONSOLIDATED_SCHEMA.sql)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'services') THEN
        BEGIN
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', svc.id,
                    'name', svc.name,
                    'description', svc.description,
                    'price_min', svc.price_min,
                    'price_max', svc.price_max,
                    'duration_minutes', svc.duration_minutes,
                    'category', svc.category
                )
            ), '[]'::jsonb)
            INTO v_services
            FROM public.services svc
            WHERE svc.tenant_id = v_tenant_id
                AND svc.is_active = true;
        EXCEPTION WHEN undefined_column THEN
            v_services := '[]'::jsonb;
        END;
    END IF;

    -- Obtener horarios desde ai_tenant_config (NO existe tabla business_hours)
    SELECT
        COALESCE(atc.business_hours_start, '09:00'::TIME),
        COALESCE(atc.business_hours_end, '18:00'::TIME),
        COALESCE(atc.business_hours_days, ARRAY[1,2,3,4,5])
    INTO v_bh_start, v_bh_end, v_bh_days
    FROM public.ai_tenant_config atc
    WHERE atc.tenant_id = v_tenant_id;

    -- Construir JSON de horarios
    v_hours := jsonb_build_object(
        'start', COALESCE(v_bh_start, '09:00'::TIME),
        'end', COALESCE(v_bh_end, '18:00'::TIME),
        'days', COALESCE(v_bh_days, ARRAY[1,2,3,4,5]),
        'days_formatted', CASE
            WHEN v_bh_days IS NULL OR v_bh_days = ARRAY[1,2,3,4,5] THEN 'Lunes a Viernes'
            WHEN v_bh_days = ARRAY[1,2,3,4,5,6] THEN 'Lunes a Sabado'
            WHEN v_bh_days = ARRAY[1,2,3,4,5,6,7] THEN 'Todos los dias'
            ELSE 'Dias selectos'
        END
    );

    -- Combinar todo
    v_result := v_result || jsonb_build_object(
        'staff', v_staff,
        'services', v_services,
        'business_hours', v_hours
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- FIX 11: Agregar SECURITY DEFINER a get_available_voices
-- para que pueda acceder a datos con RLS
-- =====================================================

DROP FUNCTION IF EXISTS get_available_voices(VARCHAR, VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION get_available_voices(
    p_provider VARCHAR DEFAULT NULL,
    p_language VARCHAR DEFAULT 'es',
    p_gender VARCHAR DEFAULT NULL,
    p_vertical VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    provider VARCHAR,
    voice_id VARCHAR,
    name VARCHAR,
    display_name VARCHAR,
    gender VARCHAR,
    accent VARCHAR,
    language VARCHAR,
    personality_tags JSONB,
    preview_url TEXT,
    recommended_settings JSONB,
    is_premium BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        vc.id,
        vc.provider,
        vc.voice_id,
        vc.name,
        vc.display_name,
        vc.gender,
        vc.accent,
        vc.language,
        vc.personality_tags,
        vc.preview_url,
        vc.recommended_settings,
        vc.is_premium
    FROM public.voice_catalog vc
    WHERE vc.is_active = true
        AND (p_provider IS NULL OR vc.provider = p_provider)
        AND (p_language IS NULL OR vc.language = p_language OR p_language = ANY(vc.supported_languages))
        AND (p_gender IS NULL OR vc.gender = p_gender)
        AND (p_vertical IS NULL OR p_vertical = ANY(vc.recommended_verticals))
    ORDER BY vc.display_order, vc.display_name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- VERIFICACION DE FIXES
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VOICE AGENT v2.0 - FIXES APLICADOS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FIX 1: Constraint unique_business_branch corregido';
    RAISE NOTICE 'FIX 2: CHECK constraint E.164 agregado';
    RAISE NOTICE 'FIX 3: Indice vapi_squad_id agregado';
    RAISE NOTICE 'FIX 4: aggregate_voice_metrics compatible con schema real';
    RAISE NOTICE 'FIX 5: create_voice_appointment compatible con schema real';
    RAISE NOTICE 'FIX 6: create_voice_reservation con manejo de tabla opcional';
    RAISE NOTICE 'FIX 7: check_voice_availability compatible con scheduled_at';
    RAISE NOTICE 'FIX 8: get_voice_call_history compatible con schema real';
    RAISE NOTICE 'FIX 9: reset_circuit_breaker_window agregado';
    RAISE NOTICE 'FIX 10: get_voice_business_context con manejo de errores';
    RAISE NOTICE 'FIX 11: get_available_voices con SECURITY DEFINER';
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- FIN MIGRACION 150
-- =====================================================

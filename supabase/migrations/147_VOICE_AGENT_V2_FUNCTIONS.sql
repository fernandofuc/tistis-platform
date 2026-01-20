-- =====================================================
-- TIS TIS PLATFORM - VOICE AGENT v2.0
-- Migration: 147_VOICE_AGENT_V2_FUNCTIONS.sql
-- Date: January 2025
-- Version: 2.0
--
-- PURPOSE: Funciones SQL helper para el Voice Agent v2.
-- Incluye funciones para obtener configuraciones,
-- manejar llamadas y generar contexto.
--
-- PARTE DE: Voice Agent v2.0 - FASE 01 - MICROFASE 1.6
-- =====================================================

-- =====================================================
-- FUNCION: Obtener configuracion completa para llamada
-- Esta es la funcion principal usada en webhooks
-- =====================================================

CREATE OR REPLACE FUNCTION get_voice_config_for_call(p_phone_number VARCHAR)
RETURNS JSONB AS $$
DECLARE
    v_config RECORD;
    v_business RECORD;
    v_result JSONB;
BEGIN
    -- Buscar configuracion por numero de telefono
    SELECT
        vac.*,
        vat.name as type_name,
        vat.display_name as type_display_name,
        vat.vertical,
        vat.enabled_capabilities as type_capabilities,
        vat.available_tools as type_tools,
        vat.prompt_template_name,
        vat.max_call_duration_seconds as type_max_duration,
        vc.provider as voice_provider,
        vc.voice_id as voice_provider_id,
        vc.name as voice_name,
        vc.recommended_settings as voice_settings,
        vc.default_stability,
        vc.default_similarity_boost
    INTO v_config
    FROM public.voice_assistant_configs vac
    JOIN public.voice_assistant_types vat ON vac.assistant_type_id = vat.id
    LEFT JOIN public.voice_catalog vc ON vac.voice_id = vc.id
    WHERE vac.phone_number = p_phone_number
        AND vac.is_active = true
    LIMIT 1;

    -- Si no hay config, retornar null
    IF v_config IS NULL THEN
        RETURN NULL;
    END IF;

    -- Obtener datos del business
    SELECT
        b.name as business_name,
        b.phone,
        b.email,
        b.address,
        b.city,
        b.settings,
        t.name as tenant_name
    INTO v_business
    FROM public.businesses b
    JOIN public.tenants t ON b.tenant_id = t.id
    WHERE b.id = v_config.business_id;

    -- Construir resultado JSON
    v_result := jsonb_build_object(
        'config_id', v_config.id,
        'tenant_id', v_config.tenant_id,
        'business_id', v_config.business_id,
        'business_name', v_business.business_name,
        'business_phone', v_business.phone,
        'business_email', v_business.email,
        'business_address', v_business.address,
        'business_city', v_business.city,
        'assistant_type', jsonb_build_object(
            'name', v_config.type_name,
            'display_name', v_config.type_display_name,
            'vertical', v_config.vertical,
            'template_name', v_config.prompt_template_name
        ),
        'voice', jsonb_build_object(
            'provider', v_config.voice_provider,
            'voice_id', v_config.voice_provider_id,
            'name', v_config.voice_name,
            'speed', v_config.voice_speed,
            'stability', v_config.default_stability,
            'similarity_boost', v_config.default_similarity_boost,
            'settings', v_config.voice_settings
        ),
        'capabilities', COALESCE(v_config.enabled_capabilities_override, v_config.type_capabilities),
        'tools', COALESCE(v_config.available_tools_override, v_config.type_tools),
        'personality', v_config.personality_type,
        'assistant_name', v_config.assistant_name,
        'special_instructions', v_config.special_instructions,
        'first_message', v_config.first_message,
        'first_message_mode', v_config.first_message_mode,
        'max_call_duration_seconds', COALESCE(v_config.max_call_duration_seconds, v_config.type_max_duration),
        'silence_timeout_seconds', v_config.silence_timeout_seconds,
        'filler_phrases', v_config.filler_phrases,
        'use_filler_phrases', v_config.use_filler_phrases,
        'end_call_phrases', v_config.end_call_phrases,
        'recording_enabled', v_config.recording_enabled,
        'transcription_stored', v_config.transcription_stored,
        'hipaa_enabled', v_config.hipaa_enabled,
        'compiled_prompt', v_config.compiled_prompt,
        'template_version', v_config.template_version,
        'configuration_version', v_config.configuration_version
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_voice_config_for_call IS
'Obtiene la configuracion completa del asistente de voz para una llamada entrante. Usado en el webhook de VAPI.';

-- =====================================================
-- FUNCION: Obtener contexto del negocio para prompts
-- =====================================================

CREATE OR REPLACE FUNCTION get_voice_business_context(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_staff JSONB;
    v_services JSONB;
    v_hours JSONB;
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
        'timezone', b.timezone,
        'vertical', t.vertical,
        'settings', b.settings
    )
    INTO v_result
    FROM public.businesses b
    JOIN public.tenants t ON b.tenant_id = t.id
    WHERE b.id = p_business_id;

    -- Obtener staff activo (para reservaciones/citas)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'role', s.role,
            'specialties', s.specialties
        )
    ), '[]'::jsonb)
    INTO v_staff
    FROM public.staff s
    WHERE s.business_id = p_business_id
        AND s.is_active = true
        AND s.role IN ('dentist', 'hygienist', 'waiter', 'chef');

    -- Obtener servicios/menu (segun vertical)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', svc.id,
            'name', svc.name,
            'description', svc.description,
            'price', svc.price,
            'duration_minutes', svc.duration_minutes,
            'category', svc.category
        )
    ), '[]'::jsonb)
    INTO v_services
    FROM public.services svc
    WHERE svc.business_id = p_business_id
        AND svc.is_active = true;

    -- Obtener horarios de operacion
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'day', bh.day_of_week,
            'open', bh.open_time,
            'close', bh.close_time
        )
    ), '[]'::jsonb)
    INTO v_hours
    FROM public.business_hours bh
    WHERE bh.business_id = p_business_id;

    -- Combinar todo
    v_result := v_result || jsonb_build_object(
        'staff', v_staff,
        'services', v_services,
        'business_hours', v_hours
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_voice_business_context IS
'Obtiene el contexto completo del negocio para generar prompts de voz.';

-- =====================================================
-- FUNCION: Verificar disponibilidad para cita/reservacion
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
    v_end_time TIME;
    v_is_available BOOLEAN := true;
    v_reason TEXT;
    v_alternatives JSONB := '[]'::jsonb;
BEGIN
    v_end_time := p_time + (p_duration_minutes || ' minutes')::interval;

    -- Verificar que el negocio esta abierto ese dia/hora
    IF NOT EXISTS (
        SELECT 1 FROM public.business_hours bh
        WHERE bh.business_id = p_business_id
            AND bh.day_of_week = EXTRACT(DOW FROM p_date)::INTEGER
            AND bh.open_time <= p_time
            AND bh.close_time >= v_end_time
    ) THEN
        v_is_available := false;
        v_reason := 'El negocio no esta abierto en ese horario';
    END IF;

    -- Verificar conflictos con citas existentes
    IF v_is_available AND EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.business_id = p_business_id
            AND a.date = p_date
            AND a.status NOT IN ('cancelled', 'no_show')
            AND (p_staff_id IS NULL OR a.staff_id = p_staff_id)
            AND (
                (a.time <= p_time AND (a.time + (a.duration_minutes || ' minutes')::interval) > p_time)
                OR (a.time < v_end_time AND a.time >= p_time)
            )
    ) THEN
        v_is_available := false;
        v_reason := 'Ya existe una cita en ese horario';

        -- Buscar alternativas cercanas
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'date', p_date,
                'time', slot
            )
        ), '[]'::jsonb)
        INTO v_alternatives
        FROM generate_series(
            p_time - interval '2 hours',
            p_time + interval '2 hours',
            interval '30 minutes'
        ) slot
        WHERE NOT EXISTS (
            SELECT 1 FROM public.appointments a
            WHERE a.business_id = p_business_id
                AND a.date = p_date
                AND a.status NOT IN ('cancelled', 'no_show')
                AND a.time = slot
        )
        LIMIT 5;
    END IF;

    RETURN jsonb_build_object(
        'available', v_is_available,
        'reason', v_reason,
        'requested_date', p_date,
        'requested_time', p_time,
        'alternatives', v_alternatives
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION check_voice_availability IS
'Verifica disponibilidad para cita/reservacion. Retorna alternativas si no hay disponibilidad.';

-- =====================================================
-- FUNCION: Crear cita desde llamada de voz
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
    v_lead_id UUID;
    v_appointment_id UUID;
    v_duration INTEGER := 60;
BEGIN
    -- Obtener tenant_id
    SELECT tenant_id INTO v_tenant_id
    FROM public.businesses
    WHERE id = p_business_id;

    -- Obtener o crear lead
    INSERT INTO public.leads (
        tenant_id, business_id, name, phone, source, status
    )
    VALUES (
        v_tenant_id, p_business_id, p_customer_name, p_customer_phone, 'voice_call', 'converted'
    )
    ON CONFLICT (business_id, phone) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, leads.name),
        updated_at = NOW()
    RETURNING id INTO v_lead_id;

    -- Obtener duracion del servicio si se especifico
    IF p_service_id IS NOT NULL THEN
        SELECT duration_minutes INTO v_duration
        FROM public.services
        WHERE id = p_service_id;
    END IF;

    -- Crear cita
    INSERT INTO public.appointments (
        tenant_id,
        business_id,
        lead_id,
        staff_id,
        service_id,
        date,
        time,
        duration_minutes,
        status,
        notes,
        source,
        created_via,
        metadata
    )
    VALUES (
        v_tenant_id,
        p_business_id,
        v_lead_id,
        p_staff_id,
        p_service_id,
        p_date,
        p_time,
        v_duration,
        'confirmed',
        p_notes,
        'voice_call',
        'voice_agent',
        jsonb_build_object('voice_call_id', p_call_id)
    )
    RETURNING id INTO v_appointment_id;

    RETURN jsonb_build_object(
        'success', true,
        'appointment_id', v_appointment_id,
        'lead_id', v_lead_id,
        'date', p_date,
        'time', p_time,
        'duration_minutes', v_duration
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_voice_appointment IS
'Crea una cita desde una llamada de voz. Tambien crea/actualiza el lead.';

-- =====================================================
-- FUNCION: Crear reservacion desde llamada de voz
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
    v_lead_id UUID;
    v_reservation_id UUID;
BEGIN
    -- Obtener tenant_id
    SELECT tenant_id INTO v_tenant_id
    FROM public.businesses
    WHERE id = p_business_id;

    -- Obtener o crear lead
    INSERT INTO public.leads (
        tenant_id, business_id, name, phone, source, status
    )
    VALUES (
        v_tenant_id, p_business_id, p_customer_name, p_customer_phone, 'voice_call', 'converted'
    )
    ON CONFLICT (business_id, phone) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, leads.name),
        updated_at = NOW()
    RETURNING id INTO v_lead_id;

    -- Crear reservacion
    INSERT INTO public.reservations (
        tenant_id,
        business_id,
        lead_id,
        date,
        time,
        party_size,
        status,
        special_requests,
        source,
        created_via,
        metadata
    )
    VALUES (
        v_tenant_id,
        p_business_id,
        v_lead_id,
        p_date,
        p_time,
        p_party_size,
        'confirmed',
        p_special_requests,
        'voice_call',
        'voice_agent',
        jsonb_build_object('voice_call_id', p_call_id)
    )
    RETURNING id INTO v_reservation_id;

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'lead_id', v_lead_id,
        'date', p_date,
        'time', p_time,
        'party_size', p_party_size
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_voice_reservation IS
'Crea una reservacion de restaurante desde una llamada de voz.';

-- =====================================================
-- FUNCION: Obtener historial de llamadas recientes
-- =====================================================

CREATE OR REPLACE FUNCTION get_voice_call_history(
    p_business_id UUID,
    p_phone_number VARCHAR DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS JSONB AS $$
DECLARE
    v_calls JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'call_id', vc.id,
            'started_at', vc.started_at,
            'ended_at', vc.ended_at,
            'duration_seconds', vc.duration_seconds,
            'status', vc.status,
            'end_reason', vc.end_reason,
            'caller_phone', vc.caller_phone_number,
            'summary', vc.call_summary,
            'outcome', vc.analysis_data->'outcome'
        )
        ORDER BY vc.started_at DESC
    ), '[]'::jsonb)
    INTO v_calls
    FROM public.voice_calls vc
    WHERE vc.business_id = p_business_id
        AND (p_phone_number IS NULL OR vc.caller_phone_number = p_phone_number)
    LIMIT p_limit;

    RETURN v_calls;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_voice_call_history IS
'Obtiene el historial de llamadas recientes para un business o cliente.';

-- =====================================================
-- FUNCION: Actualizar prompt compilado
-- =====================================================

CREATE OR REPLACE FUNCTION update_voice_compiled_prompt(
    p_config_id UUID,
    p_compiled_prompt TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.voice_assistant_configs
    SET
        compiled_prompt = p_compiled_prompt,
        compiled_prompt_hash = encode(sha256(p_compiled_prompt::bytea), 'hex'),
        compiled_prompt_at = NOW()
    WHERE id = p_config_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_voice_compiled_prompt IS
'Actualiza el prompt compilado en cache para una configuracion.';

-- =====================================================
-- FIN MIGRACION 147
-- =====================================================

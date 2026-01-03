-- =====================================================
-- TIS TIS PLATFORM - AI Booking Dental Traceability
-- Migration 093: AI Traceability for Dental Appointments
-- =====================================================
-- Esta migración agrega campos de trazabilidad AI para citas
-- dentales, siguiendo el patrón de 092_AI_ORDERING_INTEGRATION
-- para restaurant_orders.
-- =====================================================

-- =====================================================
-- PARTE 1: AGREGAR CAMPOS AI A APPOINTMENTS
-- =====================================================

-- Agregar columna conversation_id para rastrear qué conversación creó la cita
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id);

-- Agregar columna para indicar la fuente de la cita (ai, manual, web, etc.)
-- Nota: booking_source ya existe, pero vamos a agregar ai_booking_source
-- para más granularidad sobre el canal AI
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS ai_booking_channel VARCHAR(20) CHECK (ai_booking_channel IN (
    'ai_whatsapp',  -- Agendada por IA vía WhatsApp
    'ai_voice',     -- Agendada por IA vía llamada de voz (VAPI)
    'ai_webchat',   -- Agendada por IA vía webchat
    'ai_instagram', -- Agendada por IA vía Instagram DM
    'ai_facebook',  -- Agendada por IA vía Facebook Messenger
    NULL            -- No fue agendada por IA
));

-- Agregar score de confianza del AI (0-1)
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(3, 2) CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 1);

-- Agregar flag para indicar si requiere revisión humana
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS requires_human_review BOOLEAN DEFAULT false;

-- Agregar razón de la revisión humana requerida
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS human_review_reason TEXT;

-- Agregar síntomas detectados por IA (para dental)
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS ai_detected_symptoms JSONB DEFAULT '[]';

-- Agregar nivel de urgencia detectado por IA (1-5, donde 5 es emergencia)
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS ai_urgency_level INTEGER CHECK (ai_urgency_level >= 1 AND ai_urgency_level <= 5);

-- Agregar timestamp de cuándo el AI agendó
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS ai_booked_at TIMESTAMPTZ;


-- =====================================================
-- PARTE 2: ÍNDICES PARA BÚSQUEDAS EFICIENTES
-- =====================================================

-- Índice para buscar citas por conversación
CREATE INDEX IF NOT EXISTS idx_appointments_conversation
    ON public.appointments(conversation_id)
    WHERE conversation_id IS NOT NULL;

-- Índice para buscar citas creadas por AI
CREATE INDEX IF NOT EXISTS idx_appointments_ai_channel
    ON public.appointments(tenant_id, ai_booking_channel)
    WHERE ai_booking_channel IS NOT NULL;

-- Índice para citas que requieren revisión
CREATE INDEX IF NOT EXISTS idx_appointments_requires_review
    ON public.appointments(tenant_id, requires_human_review)
    WHERE requires_human_review = true;

-- Índice para citas urgentes
CREATE INDEX IF NOT EXISTS idx_appointments_urgency
    ON public.appointments(tenant_id, ai_urgency_level)
    WHERE ai_urgency_level >= 4;


-- =====================================================
-- PARTE 3: AGREGAR CAMPOS AI A APPOINTMENT_DENTAL_DETAILS
-- =====================================================

-- Verificar que la tabla existe y agregar campos
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'appointment_dental_details'
    ) THEN
        -- Agregar texto original del paciente para auditoría
        ALTER TABLE public.appointment_dental_details
        ADD COLUMN IF NOT EXISTS patient_original_complaint TEXT;

        -- Agregar síntomas extraídos por IA
        ALTER TABLE public.appointment_dental_details
        ADD COLUMN IF NOT EXISTS ai_extracted_symptoms TEXT[];

        -- Agregar procedimiento sugerido por IA
        ALTER TABLE public.appointment_dental_details
        ADD COLUMN IF NOT EXISTS ai_suggested_procedure VARCHAR(100);

        -- Agregar confianza en el diagnóstico preliminar
        ALTER TABLE public.appointment_dental_details
        ADD COLUMN IF NOT EXISTS ai_diagnosis_confidence DECIMAL(3, 2)
        CHECK (ai_diagnosis_confidence >= 0 AND ai_diagnosis_confidence <= 1);

        -- Agregar flag de paciente nuevo vs recurrente
        ALTER TABLE public.appointment_dental_details
        ADD COLUMN IF NOT EXISTS is_new_patient BOOLEAN;

        -- Agregar urgencia específica dental
        ALTER TABLE public.appointment_dental_details
        ADD COLUMN IF NOT EXISTS dental_urgency_type VARCHAR(30) CHECK (dental_urgency_type IN (
            'routine',           -- Chequeo regular
            'preventive',        -- Limpieza preventiva
            'restorative',       -- Restauración programada
            'pain_mild',         -- Dolor leve
            'pain_moderate',     -- Dolor moderado
            'pain_severe',       -- Dolor severo
            'trauma',            -- Trauma dental
            'swelling',          -- Hinchazón
            'bleeding',          -- Sangrado
            'emergency'          -- Emergencia (diente caído, absceso)
        ));
    END IF;
END $$;


-- =====================================================
-- PARTE 4: FUNCIÓN PARA NOTIFICAR RECEPCIÓN DE CITA AI
-- =====================================================

-- Esta función notifica cuando una cita AI es creada
-- Similar a notify_kitchen_new_order pero para dental
CREATE OR REPLACE FUNCTION public.notify_reception_ai_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Solo notificar para citas creadas por AI
    IF NEW.ai_booking_channel IS NOT NULL THEN
        -- Notificar vía Postgres NOTIFY (para suscriptores real-time)
        PERFORM pg_notify(
            'reception_ai_appointment',
            json_build_object(
                'appointment_id', NEW.id,
                'branch_id', NEW.branch_id,
                'scheduled_at', NEW.scheduled_at,
                'ai_channel', NEW.ai_booking_channel,
                'urgency_level', COALESCE(NEW.ai_urgency_level, 1),
                'requires_review', NEW.requires_human_review,
                'lead_id', NEW.lead_id
            )::text
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Crear trigger para notificar recepción
DROP TRIGGER IF EXISTS trigger_notify_reception_ai_appointment ON public.appointments;
CREATE TRIGGER trigger_notify_reception_ai_appointment
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    WHEN (NEW.ai_booking_channel IS NOT NULL)
    EXECUTE FUNCTION notify_reception_ai_appointment();


-- =====================================================
-- PARTE 5: FUNCIÓN PARA DETECTAR URGENCIA (usada por IA)
-- =====================================================

-- Esta función analiza síntomas y retorna nivel de urgencia
-- Puede ser llamada desde el agente AI para determinar prioridad
CREATE OR REPLACE FUNCTION public.calculate_dental_urgency(
    p_symptoms TEXT[],
    p_has_pain BOOLEAN DEFAULT false,
    p_pain_level INTEGER DEFAULT 0,  -- 0-10
    p_has_swelling BOOLEAN DEFAULT false,
    p_has_bleeding BOOLEAN DEFAULT false,
    p_is_trauma BOOLEAN DEFAULT false
)
RETURNS TABLE(
    urgency_level INTEGER,
    urgency_type VARCHAR(30),
    recommended_timeframe VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_urgency INTEGER := 1;
    v_type VARCHAR(30) := 'routine';
    v_timeframe VARCHAR(50) := 'Próximas 2 semanas';
BEGIN
    -- Trauma = máxima urgencia
    IF p_is_trauma THEN
        v_urgency := 5;
        v_type := 'emergency';
        v_timeframe := 'Inmediato';
        RETURN QUERY SELECT v_urgency, v_type, v_timeframe;
        RETURN;
    END IF;

    -- Sangrado activo
    IF p_has_bleeding THEN
        v_urgency := 4;
        v_type := 'bleeding';
        v_timeframe := 'Hoy';
    END IF;

    -- Hinchazón (posible absceso)
    IF p_has_swelling THEN
        IF v_urgency < 4 THEN
            v_urgency := 4;
            v_type := 'swelling';
            v_timeframe := 'Hoy';
        END IF;
    END IF;

    -- Dolor según nivel
    IF p_has_pain THEN
        IF p_pain_level >= 8 THEN
            v_urgency := 4;
            v_type := 'pain_severe';
            v_timeframe := 'Hoy';
        ELSIF p_pain_level >= 5 THEN
            IF v_urgency < 3 THEN
                v_urgency := 3;
                v_type := 'pain_moderate';
                v_timeframe := 'Próximos 2-3 días';
            END IF;
        ELSIF p_pain_level >= 1 THEN
            IF v_urgency < 2 THEN
                v_urgency := 2;
                v_type := 'pain_mild';
                v_timeframe := 'Próxima semana';
            END IF;
        END IF;
    END IF;

    -- Analizar síntomas específicos
    IF p_symptoms IS NOT NULL THEN
        FOR i IN 1..array_length(p_symptoms, 1) LOOP
            CASE lower(p_symptoms[i])
                WHEN 'diente caído', 'diente roto', 'fractura' THEN
                    v_urgency := 5;
                    v_type := 'trauma';
                    v_timeframe := 'Inmediato';
                WHEN 'absceso', 'pus', 'infección' THEN
                    IF v_urgency < 4 THEN
                        v_urgency := 4;
                        v_type := 'swelling';
                        v_timeframe := 'Hoy';
                    END IF;
                WHEN 'sensibilidad', 'molestia' THEN
                    IF v_urgency < 2 THEN
                        v_urgency := 2;
                        v_type := 'pain_mild';
                        v_timeframe := 'Próxima semana';
                    END IF;
                ELSE
                    -- Síntoma no reconocido, mantener nivel actual
            END CASE;
        END LOOP;
    END IF;

    RETURN QUERY SELECT v_urgency, v_type, v_timeframe;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_dental_urgency(TEXT[], BOOLEAN, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_dental_urgency(TEXT[], BOOLEAN, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN) TO service_role;


-- =====================================================
-- PARTE 6: VISTAS ANALÍTICAS PARA DENTAL
-- =====================================================

-- Vista de citas de hoy (similar a v_today_reservations de restaurant)
CREATE OR REPLACE VIEW public.v_today_dental_appointments AS
SELECT
    a.id,
    a.tenant_id,
    a.branch_id,
    a.lead_id,
    a.scheduled_at,
    a.duration_minutes,
    a.status,
    a.notes,
    a.ai_booking_channel,
    a.ai_confidence_score,
    a.ai_urgency_level,
    a.requires_human_review,
    a.human_review_reason,
    add.procedure_type,
    add.dental_urgency_type,
    add.is_new_patient,
    add.ai_extracted_symptoms,
    l.full_name as patient_name,
    l.phone as patient_phone,
    l.email as patient_email,
    ldp.insurance_provider,
    ldp.last_visit_date,
    s.name as service_name,
    st.display_name as doctor_name,
    b.name as branch_name
FROM appointments a
LEFT JOIN appointment_dental_details add ON add.appointment_id = a.id
LEFT JOIN leads l ON a.lead_id = l.id
LEFT JOIN lead_dental_profile ldp ON ldp.lead_id = l.id
LEFT JOIN services s ON a.service_id = s.id
LEFT JOIN staff st ON a.staff_id = st.id
LEFT JOIN branches b ON a.branch_id = b.id
WHERE a.scheduled_at::DATE = CURRENT_DATE
AND a.status NOT IN ('cancelled', 'no_show')
ORDER BY a.scheduled_at;


-- Vista de citas urgentes pendientes
CREATE OR REPLACE VIEW public.v_urgent_dental_appointments AS
SELECT
    a.id,
    a.tenant_id,
    a.branch_id,
    a.scheduled_at,
    a.status,
    a.ai_urgency_level,
    a.ai_detected_symptoms,
    add.dental_urgency_type,
    add.patient_original_complaint,
    l.full_name as patient_name,
    l.phone as patient_phone,
    b.name as branch_name,
    CASE
        WHEN a.ai_urgency_level = 5 THEN 'EMERGENCIA'
        WHEN a.ai_urgency_level = 4 THEN 'URGENTE'
        WHEN a.ai_urgency_level = 3 THEN 'PRIORITARIO'
        ELSE 'NORMAL'
    END as priority_label
FROM appointments a
LEFT JOIN appointment_dental_details add ON add.appointment_id = a.id
LEFT JOIN leads l ON a.lead_id = l.id
LEFT JOIN branches b ON a.branch_id = b.id
WHERE a.ai_urgency_level >= 3
AND a.status IN ('scheduled', 'confirmed')
AND a.scheduled_at >= NOW()
ORDER BY a.ai_urgency_level DESC, a.scheduled_at;


-- Vista de citas que requieren revisión humana
CREATE OR REPLACE VIEW public.v_appointments_pending_review AS
SELECT
    a.id,
    a.tenant_id,
    a.branch_id,
    a.scheduled_at,
    a.ai_booking_channel,
    a.ai_confidence_score,
    a.requires_human_review,
    a.human_review_reason,
    a.ai_detected_symptoms,
    l.full_name as patient_name,
    l.phone as patient_phone,
    s.name as service_name,
    b.name as branch_name,
    a.created_at as booked_at
FROM appointments a
LEFT JOIN leads l ON a.lead_id = l.id
LEFT JOIN services s ON a.service_id = s.id
LEFT JOIN branches b ON a.branch_id = b.id
WHERE a.requires_human_review = true
AND a.status IN ('scheduled', 'confirmed')
ORDER BY a.scheduled_at;


-- Vista de pacientes que necesitan seguimiento
CREATE OR REPLACE VIEW public.v_patients_needing_followup AS
SELECT
    l.id as lead_id,
    l.full_name,
    l.phone,
    l.email,
    ldp.last_visit_date,
    ldp.next_checkup_due,
    ldp.treatment_plan_status,
    ldp.pending_treatments,
    t.name as tenant_name,
    CASE
        WHEN ldp.next_checkup_due < CURRENT_DATE THEN 'VENCIDO'
        WHEN ldp.next_checkup_due <= CURRENT_DATE + INTERVAL '7 days' THEN 'ESTA SEMANA'
        WHEN ldp.next_checkup_due <= CURRENT_DATE + INTERVAL '30 days' THEN 'ESTE MES'
        ELSE 'PROGRAMADO'
    END as followup_status
FROM leads l
JOIN lead_dental_profile ldp ON ldp.lead_id = l.id
JOIN tenants t ON t.id = l.tenant_id
WHERE t.vertical = 'dental'
AND t.status = 'active'
AND (
    ldp.next_checkup_due <= CURRENT_DATE + INTERVAL '30 days'
    OR ldp.treatment_plan_status = 'in_progress'
)
ORDER BY ldp.next_checkup_due;


-- =====================================================
-- PARTE 7: ESTADÍSTICAS DE AI BOOKING
-- =====================================================

-- Función para obtener estadísticas de booking AI por tenant
CREATE OR REPLACE FUNCTION public.get_ai_booking_stats(
    p_tenant_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    total_ai_bookings INTEGER,
    by_channel JSONB,
    avg_confidence DECIMAL,
    requiring_review INTEGER,
    urgency_distribution JSONB,
    conversion_rate DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        -- Total de citas agendadas por AI
        COUNT(*)::INTEGER as total_ai_bookings,

        -- Distribución por canal
        jsonb_object_agg(
            COALESCE(a.ai_booking_channel, 'manual'),
            channel_count
        ) as by_channel,

        -- Confianza promedio
        ROUND(AVG(a.ai_confidence_score), 2) as avg_confidence,

        -- Cuántas requirieron revisión
        COUNT(*) FILTER (WHERE a.requires_human_review = true)::INTEGER as requiring_review,

        -- Distribución de urgencia
        jsonb_build_object(
            'level_1', COUNT(*) FILTER (WHERE a.ai_urgency_level = 1),
            'level_2', COUNT(*) FILTER (WHERE a.ai_urgency_level = 2),
            'level_3', COUNT(*) FILTER (WHERE a.ai_urgency_level = 3),
            'level_4', COUNT(*) FILTER (WHERE a.ai_urgency_level = 4),
            'level_5', COUNT(*) FILTER (WHERE a.ai_urgency_level = 5)
        ) as urgency_distribution,

        -- Tasa de conversión (completed / total)
        ROUND(
            COUNT(*) FILTER (WHERE a.status = 'completed')::DECIMAL /
            NULLIF(COUNT(*), 0),
            2
        ) as conversion_rate

    FROM appointments a
    LEFT JOIN LATERAL (
        SELECT ai_booking_channel, COUNT(*) as channel_count
        FROM appointments
        WHERE tenant_id = p_tenant_id
        AND ai_booking_channel IS NOT NULL
        AND created_at::DATE BETWEEN p_start_date AND p_end_date
        GROUP BY ai_booking_channel
    ) channels ON true
    WHERE a.tenant_id = p_tenant_id
    AND a.ai_booking_channel IS NOT NULL
    AND a.created_at::DATE BETWEEN p_start_date AND p_end_date
    GROUP BY channels.ai_booking_channel, channels.channel_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_ai_booking_stats(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_booking_stats(UUID, DATE, DATE) TO service_role;


-- =====================================================
-- PARTE 8: COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON COLUMN public.appointments.conversation_id IS 'ID de la conversación que originó esta cita (si fue agendada por IA)';
COMMENT ON COLUMN public.appointments.ai_booking_channel IS 'Canal a través del cual la IA agendó esta cita';
COMMENT ON COLUMN public.appointments.ai_confidence_score IS 'Nivel de confianza (0-1) que tuvo la IA al interpretar la solicitud de cita';
COMMENT ON COLUMN public.appointments.requires_human_review IS 'Indica si un humano debe revisar esta cita antes de confirmarla';
COMMENT ON COLUMN public.appointments.ai_urgency_level IS 'Nivel de urgencia detectado por IA (1-5, donde 5 es emergencia)';
COMMENT ON COLUMN public.appointments.ai_detected_symptoms IS 'Síntomas que la IA detectó en la conversación con el paciente';

COMMENT ON VIEW public.v_today_dental_appointments IS 'Vista de citas dentales del día actual con información completa del paciente y AI';
COMMENT ON VIEW public.v_urgent_dental_appointments IS 'Vista de citas urgentes pendientes ordenadas por nivel de urgencia';
COMMENT ON VIEW public.v_appointments_pending_review IS 'Vista de citas agendadas por AI que requieren revisión humana';
COMMENT ON VIEW public.v_patients_needing_followup IS 'Vista de pacientes dentales que necesitan seguimiento o tienen cita próxima';

COMMENT ON FUNCTION public.calculate_dental_urgency IS 'Calcula el nivel de urgencia dental basado en síntomas, dolor, hinchazón, etc. Retorna nivel (1-5), tipo, y timeframe recomendado.';
COMMENT ON FUNCTION public.get_ai_booking_stats IS 'Retorna estadísticas de citas agendadas por AI para un tenant en un rango de fechas.';


-- =====================================================
-- MIGRACIÓN COMPLETADA
-- =====================================================

SELECT 'Migration 093: AI Booking Dental Traceability - COMPLETADA' as status;

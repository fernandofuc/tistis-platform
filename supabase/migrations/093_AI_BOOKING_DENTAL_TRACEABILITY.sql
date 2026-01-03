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
-- NOTA: Se agrega SIN foreign key para evitar error si tabla conversations no existe
-- La integridad se maneja a nivel de aplicación
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'appointments'
                   AND column_name = 'conversation_id') THEN
        ALTER TABLE public.appointments ADD COLUMN conversation_id UUID;
    END IF;
END $$;

-- Agregar columna para indicar la fuente de la cita (ai, manual, web, etc.)
-- Nota: booking_source ya existe, pero vamos a agregar ai_booking_source
-- para más granularidad sobre el canal AI
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'appointments'
                   AND column_name = 'ai_booking_channel') THEN
        ALTER TABLE public.appointments
        ADD COLUMN ai_booking_channel VARCHAR(20) CHECK (ai_booking_channel IN (
            'ai_whatsapp',  -- Agendada por IA vía WhatsApp
            'ai_voice',     -- Agendada por IA vía llamada de voz (VAPI)
            'ai_webchat',   -- Agendada por IA vía webchat
            'ai_instagram', -- Agendada por IA vía Instagram DM
            'ai_facebook'   -- Agendada por IA vía Facebook Messenger
        ));
    END IF;
END $$;

-- Agregar score de confianza del AI (0-1)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'appointments'
                   AND column_name = 'ai_confidence_score') THEN
        ALTER TABLE public.appointments
        ADD COLUMN ai_confidence_score DECIMAL(3, 2) CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 1);
    END IF;
END $$;

-- Agregar flag para indicar si requiere revisión humana
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'appointments'
                   AND column_name = 'requires_human_review') THEN
        ALTER TABLE public.appointments ADD COLUMN requires_human_review BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Agregar razón de la revisión humana requerida
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'appointments'
                   AND column_name = 'human_review_reason') THEN
        ALTER TABLE public.appointments ADD COLUMN human_review_reason TEXT;
    END IF;
END $$;

-- Agregar síntomas detectados por IA (para dental)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'appointments'
                   AND column_name = 'ai_detected_symptoms') THEN
        ALTER TABLE public.appointments ADD COLUMN ai_detected_symptoms JSONB DEFAULT '[]';
    END IF;
END $$;

-- Agregar nivel de urgencia detectado por IA (1-5, donde 5 es emergencia)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'appointments'
                   AND column_name = 'ai_urgency_level') THEN
        ALTER TABLE public.appointments
        ADD COLUMN ai_urgency_level INTEGER CHECK (ai_urgency_level >= 1 AND ai_urgency_level <= 5);
    END IF;
END $$;

-- Agregar timestamp de cuándo el AI agendó
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'appointments'
                   AND column_name = 'ai_booked_at') THEN
        ALTER TABLE public.appointments ADD COLUMN ai_booked_at TIMESTAMPTZ;
    END IF;
END $$;


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
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'appointment_dental_details'
                       AND column_name = 'patient_original_complaint') THEN
            ALTER TABLE public.appointment_dental_details
            ADD COLUMN patient_original_complaint TEXT;
        END IF;

        -- Agregar síntomas extraídos por IA
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'appointment_dental_details'
                       AND column_name = 'ai_extracted_symptoms') THEN
            ALTER TABLE public.appointment_dental_details
            ADD COLUMN ai_extracted_symptoms TEXT[];
        END IF;

        -- Agregar procedimiento sugerido por IA
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'appointment_dental_details'
                       AND column_name = 'ai_suggested_procedure') THEN
            ALTER TABLE public.appointment_dental_details
            ADD COLUMN ai_suggested_procedure VARCHAR(100);
        END IF;

        -- Agregar confianza en el diagnóstico preliminar
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'appointment_dental_details'
                       AND column_name = 'ai_diagnosis_confidence') THEN
            ALTER TABLE public.appointment_dental_details
            ADD COLUMN ai_diagnosis_confidence DECIMAL(3, 2)
            CHECK (ai_diagnosis_confidence >= 0 AND ai_diagnosis_confidence <= 1);
        END IF;

        -- Agregar flag de paciente nuevo vs recurrente
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'appointment_dental_details'
                       AND column_name = 'is_new_patient') THEN
            ALTER TABLE public.appointment_dental_details
            ADD COLUMN is_new_patient BOOLEAN;
        END IF;

        -- Agregar urgencia específica dental
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'appointment_dental_details'
                       AND column_name = 'dental_urgency_type') THEN
            ALTER TABLE public.appointment_dental_details
            ADD COLUMN dental_urgency_type VARCHAR(30) CHECK (dental_urgency_type IN (
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

        RAISE NOTICE 'Columns added to appointment_dental_details';
    ELSE
        RAISE NOTICE 'Table appointment_dental_details does not exist, skipping PARTE 3';
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
    IF p_symptoms IS NOT NULL AND array_length(p_symptoms, 1) > 0 THEN
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
-- NOTA: Estas vistas usan solo tablas existentes (appointments, leads, services, staff, branches)
-- Las tablas appointment_dental_details y lead_dental_profile no existen actualmente

-- Vista de citas de hoy para dental
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
    a.ai_detected_symptoms,
    a.requires_human_review,
    a.human_review_reason,
    l.full_name as patient_name,
    l.phone as patient_phone,
    l.email as patient_email,
    s.name as service_name,
    st.display_name as doctor_name,
    b.name as branch_name
FROM appointments a
LEFT JOIN leads l ON a.lead_id = l.id
LEFT JOIN services s ON a.service_id = s.id
LEFT JOIN staff st ON a.staff_id = st.id
LEFT JOIN branches b ON a.branch_id = b.id
JOIN tenants t ON a.tenant_id = t.id
WHERE a.scheduled_at::DATE = CURRENT_DATE
AND a.status NOT IN ('cancelled', 'no_show')
AND t.vertical = 'dental'
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


-- Vista de pacientes que necesitan seguimiento (basada en última cita completada)
CREATE OR REPLACE VIEW public.v_patients_needing_followup AS
SELECT
    l.id as lead_id,
    l.tenant_id,
    l.full_name,
    l.phone,
    l.email,
    MAX(a.scheduled_at) as last_visit_date,
    t.name as tenant_name,
    CASE
        WHEN MAX(a.scheduled_at) < CURRENT_DATE - INTERVAL '6 months' THEN 'VENCIDO'
        WHEN MAX(a.scheduled_at) < CURRENT_DATE - INTERVAL '5 months' THEN 'PROXIMO'
        ELSE 'AL DIA'
    END as followup_status
FROM leads l
JOIN tenants t ON t.id = l.tenant_id
LEFT JOIN appointments a ON a.lead_id = l.id AND a.status = 'completed'
WHERE t.vertical = 'dental'
AND t.status = 'active'
GROUP BY l.id, l.tenant_id, l.full_name, l.phone, l.email, t.name
HAVING MAX(a.scheduled_at) IS NULL
    OR MAX(a.scheduled_at) < CURRENT_DATE - INTERVAL '5 months'
ORDER BY MAX(a.scheduled_at) NULLS FIRST;


-- =====================================================
-- PARTE 7: ESTADÍSTICAS DE AI BOOKING (CORREGIDA)
-- =====================================================

-- Función para obtener estadísticas de booking AI por tenant
-- NOTA: Reescrita completamente para evitar errores de SQL
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
DECLARE
    v_total INTEGER;
    v_by_channel JSONB;
    v_avg_confidence DECIMAL;
    v_requiring_review INTEGER;
    v_urgency_dist JSONB;
    v_conversion DECIMAL;
BEGIN
    -- Total de citas agendadas por AI
    SELECT COUNT(*)::INTEGER INTO v_total
    FROM appointments
    WHERE tenant_id = p_tenant_id
    AND ai_booking_channel IS NOT NULL
    AND created_at::DATE BETWEEN p_start_date AND p_end_date;

    -- Distribución por canal
    SELECT COALESCE(jsonb_object_agg(channel, cnt), '{}'::jsonb) INTO v_by_channel
    FROM (
        SELECT ai_booking_channel as channel, COUNT(*) as cnt
        FROM appointments
        WHERE tenant_id = p_tenant_id
        AND ai_booking_channel IS NOT NULL
        AND created_at::DATE BETWEEN p_start_date AND p_end_date
        GROUP BY ai_booking_channel
    ) channels;

    -- Confianza promedio
    SELECT ROUND(AVG(ai_confidence_score), 2) INTO v_avg_confidence
    FROM appointments
    WHERE tenant_id = p_tenant_id
    AND ai_booking_channel IS NOT NULL
    AND ai_confidence_score IS NOT NULL
    AND created_at::DATE BETWEEN p_start_date AND p_end_date;

    -- Cuántas requirieron revisión
    SELECT COUNT(*)::INTEGER INTO v_requiring_review
    FROM appointments
    WHERE tenant_id = p_tenant_id
    AND ai_booking_channel IS NOT NULL
    AND requires_human_review = true
    AND created_at::DATE BETWEEN p_start_date AND p_end_date;

    -- Distribución de urgencia
    SELECT jsonb_build_object(
        'level_1', COUNT(*) FILTER (WHERE ai_urgency_level = 1),
        'level_2', COUNT(*) FILTER (WHERE ai_urgency_level = 2),
        'level_3', COUNT(*) FILTER (WHERE ai_urgency_level = 3),
        'level_4', COUNT(*) FILTER (WHERE ai_urgency_level = 4),
        'level_5', COUNT(*) FILTER (WHERE ai_urgency_level = 5),
        'unset', COUNT(*) FILTER (WHERE ai_urgency_level IS NULL)
    ) INTO v_urgency_dist
    FROM appointments
    WHERE tenant_id = p_tenant_id
    AND ai_booking_channel IS NOT NULL
    AND created_at::DATE BETWEEN p_start_date AND p_end_date;

    -- Tasa de conversión (completed / total)
    SELECT ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL /
        NULLIF(COUNT(*), 0),
        2
    ) INTO v_conversion
    FROM appointments
    WHERE tenant_id = p_tenant_id
    AND ai_booking_channel IS NOT NULL
    AND created_at::DATE BETWEEN p_start_date AND p_end_date;

    RETURN QUERY SELECT
        COALESCE(v_total, 0),
        COALESCE(v_by_channel, '{}'::jsonb),
        COALESCE(v_avg_confidence, 0.0),
        COALESCE(v_requiring_review, 0),
        COALESCE(v_urgency_dist, '{}'::jsonb),
        COALESCE(v_conversion, 0.0);
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

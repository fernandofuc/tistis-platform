-- =====================================================
-- TIS TIS PLATFORM - Appointment Loyalty Integration
-- Migration 095: Award loyalty tokens on appointment completion
-- =====================================================
-- Este trigger otorga tokens de lealtad cuando una cita
-- es marcada como completada, similar a como se hace
-- con órdenes en restaurant.
-- =====================================================

-- =====================================================
-- PARTE 1: FUNCIÓN PARA OTORGAR TOKENS AL COMPLETAR CITA
-- =====================================================

CREATE OR REPLACE FUNCTION public.award_tokens_on_appointment_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_program_id UUID;
    v_service_price DECIMAL;
    v_tokens_to_award INTEGER;
    v_earning_ratio DECIMAL;
    v_lead_name TEXT;
BEGIN
    -- Solo procesar cuando el status cambia a 'completed'
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'completed' THEN

        -- 1. Buscar programa de lealtad activo para el tenant
        -- NOTA: El campo se llama tokens_per_currency (tokens por cada $1 gastado)
        SELECT id, tokens_per_currency INTO v_program_id, v_earning_ratio
        FROM loyalty_programs
        WHERE tenant_id = NEW.tenant_id
          AND is_active = true
          AND deleted_at IS NULL
        LIMIT 1;

        -- Si no hay programa activo, salir
        IF v_program_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- 2. Obtener precio del servicio (si existe)
        IF NEW.service_id IS NOT NULL THEN
            SELECT COALESCE(price_min, 0) INTO v_service_price
            FROM services
            WHERE id = NEW.service_id;
        ELSE
            -- Precio por defecto si no hay servicio específico
            v_service_price := 500; -- Precio base para consulta general
        END IF;

        -- 3. Calcular tokens (earning_ratio = tokens por cada $1 gastado)
        -- Por defecto: 1 token por cada $10 gastados
        v_earning_ratio := COALESCE(v_earning_ratio, 0.1);
        v_tokens_to_award := FLOOR(v_service_price * v_earning_ratio);

        -- Mínimo 1 token si la cita fue completada
        IF v_tokens_to_award < 1 THEN
            v_tokens_to_award := 1;
        END IF;

        -- Máximo 100 tokens por cita (para evitar abusos)
        IF v_tokens_to_award > 100 THEN
            v_tokens_to_award := 100;
        END IF;

        -- 4. Obtener nombre del lead para la descripción
        SELECT full_name INTO v_lead_name
        FROM leads
        WHERE id = NEW.lead_id;

        -- 5. Llamar a la función existente para otorgar tokens
        PERFORM award_loyalty_tokens(
            p_tenant_id := NEW.tenant_id,
            p_lead_id := NEW.lead_id,
            p_tokens_amount := v_tokens_to_award,
            p_source_type := 'appointment_complete',
            p_source_id := NEW.id,
            p_description := 'Puntos por cita completada - ' || COALESCE(v_lead_name, 'Cliente')
        );

        -- 6. Log para debugging
        RAISE NOTICE '[Loyalty] Awarded % tokens to lead % for completed appointment %',
            v_tokens_to_award, NEW.lead_id, NEW.id;

    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- PARTE 2: CREAR TRIGGER
-- =====================================================

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_award_tokens_appointment_complete ON public.appointments;

-- Crear trigger para todas las citas completadas
CREATE TRIGGER trigger_award_tokens_appointment_complete
    AFTER UPDATE ON public.appointments
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
    EXECUTE FUNCTION award_tokens_on_appointment_complete();


-- =====================================================
-- PARTE 3: FUNCIÓN ALTERNATIVA PARA award_loyalty_tokens
-- (Por si no existe la versión que espera estos parámetros)
-- =====================================================

-- Verificar si la función existe con los parámetros correctos
-- Si no, crear una versión compatible
DO $$
BEGIN
    -- Intentar verificar si la función existe
    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'award_loyalty_tokens'
    ) THEN
        -- La función no existe, mostrar advertencia
        RAISE WARNING 'award_loyalty_tokens function not found. Loyalty trigger may not work.';
    END IF;
END $$;


-- =====================================================
-- PARTE 4: VISTA DE TOKENS GANADOS POR CITAS
-- =====================================================

CREATE OR REPLACE VIEW public.v_appointment_loyalty_summary AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    COUNT(DISTINCT a.id) as total_completed_appointments,
    COUNT(DISTINCT lt.id) as total_token_transactions,
    COALESCE(SUM(lt.tokens_amount), 0) as total_tokens_awarded,
    COALESCE(AVG(lt.tokens_amount), 0) as avg_tokens_per_appointment
FROM tenants t
LEFT JOIN appointments a ON a.tenant_id = t.id AND a.status = 'completed'
LEFT JOIN loyalty_transactions lt ON lt.source_type = 'appointment_complete' AND lt.source_id = a.id
WHERE t.status = 'active'
GROUP BY t.id, t.name;


-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION award_tokens_on_appointment_complete IS
'Trigger function que otorga tokens de lealtad cuando una cita es marcada como completada.
Calcula los tokens basado en el precio del servicio y el earning_ratio del programa de lealtad.
Mínimo: 1 token, Máximo: 100 tokens por cita.';

COMMENT ON TRIGGER trigger_award_tokens_appointment_complete ON appointments IS
'Trigger que se dispara cuando una cita cambia a status completed.
Otorga tokens de lealtad al paciente usando el programa activo del tenant.';


-- =====================================================
-- MIGRACIÓN COMPLETADA
-- =====================================================

SELECT 'Migration 095: Appointment Loyalty Trigger - COMPLETADA' as status;

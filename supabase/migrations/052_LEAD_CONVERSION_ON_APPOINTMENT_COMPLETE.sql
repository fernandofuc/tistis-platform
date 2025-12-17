-- =====================================================
-- Migration 052: LEAD CONVERSION ON APPOINTMENT COMPLETE
-- =====================================================
-- Mejora el trigger de conversión para que también se ejecute
-- cuando una cita cambia a estado 'completed'
-- =====================================================

-- Función mejorada que convierte lead a patient
-- Se ejecuta cuando se crea una cita O cuando se marca como completada
CREATE OR REPLACE FUNCTION public.auto_create_patient_from_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_patient_id UUID;
  v_name_parts TEXT[];
BEGIN
  -- Solo procesar si hay un lead_id
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Solo ejecutar en INSERT o cuando status cambia a 'completed' o 'confirmed'
  IF TG_OP = 'UPDATE' THEN
    -- Solo continuar si el status cambió a completed/confirmed
    IF NOT (NEW.status IN ('completed', 'confirmed') AND
            (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'confirmed'))) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Verificar si ya existe un paciente para este lead
  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE lead_id = NEW.lead_id
  AND tenant_id = NEW.tenant_id;

  -- Si ya existe, asegurar que esté vinculado y actualizar lead
  IF v_patient_id IS NOT NULL THEN
    -- Vincular la cita al paciente existente
    NEW.patient_id := v_patient_id;

    -- Actualizar status del lead
    UPDATE public.leads
    SET status = 'converted',
        converted_at = COALESCE(converted_at, NOW()),
        patient_id = v_patient_id
    WHERE id = NEW.lead_id
    AND (status != 'converted' OR patient_id IS NULL);

    RETURN NEW;
  END IF;

  -- Obtener datos del lead
  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = NEW.lead_id;

  IF v_lead IS NULL THEN
    RETURN NEW;
  END IF;

  -- Extraer nombre y apellido
  IF v_lead.first_name IS NOT NULL THEN
    -- Usar first_name/last_name si existen
    NULL; -- Ya tenemos los datos
  ELSIF v_lead.full_name IS NOT NULL AND v_lead.full_name != '' THEN
    -- Parsear full_name
    v_name_parts := string_to_array(v_lead.full_name, ' ');
  ELSE
    -- Default
    v_name_parts := ARRAY['Cliente', ''];
  END IF;

  -- Crear el paciente con los datos del lead
  INSERT INTO public.patients (
    tenant_id,
    lead_id,
    first_name,
    last_name,
    phone,
    email,
    preferred_branch_id,
    status,
    notes
  ) VALUES (
    NEW.tenant_id,
    NEW.lead_id,
    COALESCE(
      v_lead.first_name,
      CASE WHEN v_name_parts IS NOT NULL AND array_length(v_name_parts, 1) > 0
           THEN v_name_parts[1]
           ELSE 'Cliente'
      END
    ),
    COALESCE(
      v_lead.last_name,
      CASE WHEN v_name_parts IS NOT NULL AND array_length(v_name_parts, 1) > 1
           THEN array_to_string(v_name_parts[2:], ' ')
           ELSE ''
      END
    ),
    COALESCE(v_lead.phone_normalized, v_lead.phone),
    v_lead.email,
    COALESCE(NEW.branch_id, v_lead.branch_id),
    'active',
    CASE
      WHEN TG_OP = 'INSERT' THEN 'Paciente creado automáticamente desde cita agendada'
      ELSE 'Paciente creado automáticamente al completar cita'
    END
  )
  RETURNING id INTO v_patient_id;

  -- Vincular cita al nuevo paciente
  NEW.patient_id := v_patient_id;

  -- Actualizar lead con referencia al paciente
  UPDATE public.leads
  SET status = 'converted',
      converted_at = NOW(),
      patient_id = v_patient_id
  WHERE id = NEW.lead_id;

  RETURN NEW;
END;
$$;

-- Recrear trigger para INSERT y UPDATE
DROP TRIGGER IF EXISTS trg_auto_create_patient ON public.appointments;

CREATE TRIGGER trg_auto_create_patient
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_patient_from_appointment();

-- =====================================================
-- FUNCIÓN: Convertir leads calificados existentes
-- =====================================================
-- Función para convertir manualmente leads que cumplen criterios

CREATE OR REPLACE FUNCTION public.batch_convert_qualified_leads(
  p_tenant_id UUID,
  p_only_with_appointments BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
  lead_id UUID,
  patient_id UUID,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_patient_id UUID;
  v_name_parts TEXT[];
BEGIN
  FOR v_lead IN
    SELECT l.*
    FROM public.leads l
    WHERE l.tenant_id = p_tenant_id
    AND l.patient_id IS NULL
    AND l.status != 'lost'
    AND (
      NOT p_only_with_appointments
      OR EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.lead_id = l.id
        AND a.status IN ('scheduled', 'confirmed', 'completed')
      )
    )
    ORDER BY l.created_at
  LOOP
    -- Verificar si ya existe paciente por teléfono o email
    SELECT p.id INTO v_patient_id
    FROM public.patients p
    WHERE p.tenant_id = p_tenant_id
    AND (
      (v_lead.phone_normalized IS NOT NULL AND p.phone = v_lead.phone_normalized)
      OR (v_lead.email IS NOT NULL AND p.email = v_lead.email)
    )
    LIMIT 1;

    IF v_patient_id IS NOT NULL THEN
      -- Vincular a paciente existente
      UPDATE public.leads
      SET patient_id = v_patient_id,
          status = 'converted',
          converted_at = COALESCE(converted_at, NOW())
      WHERE id = v_lead.id;

      lead_id := v_lead.id;
      patient_id := v_patient_id;
      status := 'linked_to_existing';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Parsear nombre
    IF v_lead.full_name IS NOT NULL AND v_lead.full_name != '' THEN
      v_name_parts := string_to_array(v_lead.full_name, ' ');
    ELSE
      v_name_parts := ARRAY['Cliente', ''];
    END IF;

    -- Crear nuevo paciente
    INSERT INTO public.patients (
      tenant_id,
      lead_id,
      first_name,
      last_name,
      phone,
      email,
      preferred_branch_id,
      status,
      notes
    ) VALUES (
      p_tenant_id,
      v_lead.id,
      COALESCE(
        v_lead.first_name,
        CASE WHEN array_length(v_name_parts, 1) > 0 THEN v_name_parts[1] ELSE 'Cliente' END
      ),
      COALESCE(
        v_lead.last_name,
        CASE WHEN array_length(v_name_parts, 1) > 1
             THEN array_to_string(v_name_parts[2:], ' ')
             ELSE ''
        END
      ),
      COALESCE(v_lead.phone_normalized, v_lead.phone),
      v_lead.email,
      v_lead.branch_id,
      'active',
      'Paciente convertido desde lead calificado'
    )
    RETURNING id INTO v_patient_id;

    -- Actualizar lead
    UPDATE public.leads
    SET patient_id = v_patient_id,
        status = 'converted',
        converted_at = NOW()
    WHERE id = v_lead.id;

    -- Vincular citas existentes
    UPDATE public.appointments
    SET patient_id = v_patient_id
    WHERE lead_id = v_lead.id
    AND patient_id IS NULL;

    lead_id := v_lead.id;
    patient_id := v_patient_id;
    status := 'created_new';
    RETURN NEXT;
  END LOOP;
END;
$$;

-- =====================================================
-- Agregar columna patient_id a leads si no existe
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'leads'
    AND column_name = 'patient_id'
  ) THEN
    ALTER TABLE public.leads
    ADD COLUMN patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- Crear índice para búsqueda rápida
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_leads_patient_id ON public.leads(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_lead_id ON public.patients(lead_id);

-- =====================================================
-- LISTO!
-- =====================================================

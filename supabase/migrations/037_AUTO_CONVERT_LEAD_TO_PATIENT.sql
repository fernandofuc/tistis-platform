-- =====================================================
-- Migration 037: AUTO CONVERT LEAD TO PATIENT
-- =====================================================
-- Cuando se crea una cita (appointment), automáticamente
-- se crea un registro en patients si no existe
-- =====================================================

-- Función que convierte lead a patient
CREATE OR REPLACE FUNCTION public.auto_create_patient_from_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_patient_id UUID;
BEGIN
  -- Solo procesar si hay un lead_id
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar si ya existe un paciente para este lead
  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE lead_id = NEW.lead_id
  AND tenant_id = NEW.tenant_id;

  -- Si ya existe, no hacer nada
  IF v_patient_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener datos del lead
  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = NEW.lead_id;

  IF v_lead IS NULL THEN
    RETURN NEW;
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
    COALESCE(v_lead.first_name, SPLIT_PART(COALESCE(v_lead.full_name, 'Sin nombre'), ' ', 1)),
    COALESCE(v_lead.last_name, NULLIF(SPLIT_PART(COALESCE(v_lead.full_name, ''), ' ', 2), '')),
    v_lead.phone,
    v_lead.email,
    COALESCE(NEW.branch_id, v_lead.preferred_branch_id),
    'active',
    'Paciente creado automáticamente desde cita agendada'
  );

  RETURN NEW;
END;
$$;

-- Crear trigger en appointments
DROP TRIGGER IF EXISTS trg_auto_create_patient ON public.appointments;

CREATE TRIGGER trg_auto_create_patient
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_patient_from_appointment();

-- =====================================================
-- OPCIONAL: Convertir leads existentes que ya tienen citas
-- =====================================================
-- Esto convierte todos los leads que ya tienen citas pero
-- no están en la tabla patients

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
)
SELECT DISTINCT ON (l.id)
  l.tenant_id,
  l.id as lead_id,
  COALESCE(l.first_name, SPLIT_PART(COALESCE(l.full_name, 'Sin nombre'), ' ', 1)) as first_name,
  COALESCE(l.last_name, NULLIF(SPLIT_PART(COALESCE(l.full_name, ''), ' ', 2), '')) as last_name,
  l.phone,
  l.email,
  COALESCE(a.branch_id, l.preferred_branch_id) as preferred_branch_id,
  'active' as status,
  'Paciente migrado desde citas existentes' as notes
FROM public.leads l
INNER JOIN public.appointments a ON a.lead_id = l.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.patients p
  WHERE p.lead_id = l.id AND p.tenant_id = l.tenant_id
)
AND a.deleted_at IS NULL
ORDER BY l.id, a.created_at ASC;

-- =====================================================
-- LISTO!
-- =====================================================

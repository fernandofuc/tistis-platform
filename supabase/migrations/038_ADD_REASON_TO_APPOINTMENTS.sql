-- =====================================================
-- Migration 038: ADD REASON FIELD TO APPOINTMENTS
-- =====================================================
-- Agrega campo "reason" (motivo de consulta) a appointments
-- Separado de "notes" que son notas internas
-- =====================================================

-- Agregar columna reason si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments'
    AND column_name = 'reason'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.appointments
    ADD COLUMN reason TEXT;

    COMMENT ON COLUMN public.appointments.reason IS 'Motivo de la consulta/cita del paciente';
  END IF;
END $$;

-- =====================================================
-- LISTO!
-- =====================================================

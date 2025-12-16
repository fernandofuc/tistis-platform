-- =====================================================
-- Migration 036: ADD PREFERRED_BRANCH_ID TO PATIENTS
-- =====================================================
-- El código intenta insertar preferred_branch_id pero
-- la columna no existe en la tabla patients
-- =====================================================

-- Agregar columna preferred_branch_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients'
    AND column_name = 'preferred_branch_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.patients
    ADD COLUMN preferred_branch_id uuid REFERENCES public.branches(id);

    COMMENT ON COLUMN public.patients.preferred_branch_id IS 'Sucursal preferida del paciente';
  END IF;
END $$;

-- =====================================================
-- LISTO!
-- =====================================================

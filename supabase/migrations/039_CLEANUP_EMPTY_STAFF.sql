-- =====================================================
-- Migration 039: CLEANUP EMPTY STAFF RECORDS
-- =====================================================
-- Elimina registros de staff que no tienen nombre valido
-- y no estan vinculados a un usuario activo
-- =====================================================

-- Primero ver cuantos hay (para logging)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.staff
  WHERE (
    (first_name IS NULL OR TRIM(first_name) = '')
    AND (last_name IS NULL OR TRIM(last_name) = '')
    AND (display_name IS NULL OR TRIM(display_name) = '')
  );

  RAISE NOTICE 'Found % empty staff records to clean up', v_count;
END $$;

-- Eliminar staff_branches de los staff vacios primero (FK constraint)
DELETE FROM public.staff_branches
WHERE staff_id IN (
  SELECT id FROM public.staff
  WHERE (
    (first_name IS NULL OR TRIM(first_name) = '')
    AND (last_name IS NULL OR TRIM(last_name) = '')
    AND (display_name IS NULL OR TRIM(display_name) = '')
  )
);

-- Eliminar user_roles que referencian staff vacios
UPDATE public.user_roles
SET staff_id = NULL
WHERE staff_id IN (
  SELECT id FROM public.staff
  WHERE (
    (first_name IS NULL OR TRIM(first_name) = '')
    AND (last_name IS NULL OR TRIM(last_name) = '')
    AND (display_name IS NULL OR TRIM(display_name) = '')
  )
);

-- Ahora eliminar los staff vacios
DELETE FROM public.staff
WHERE (
  (first_name IS NULL OR TRIM(first_name) = '')
  AND (last_name IS NULL OR TRIM(last_name) = '')
  AND (display_name IS NULL OR TRIM(display_name) = '')
);

-- =====================================================
-- LISTO!
-- =====================================================

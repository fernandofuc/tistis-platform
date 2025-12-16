-- =====================================================
-- Migration 040: AGGRESSIVE CLEANUP EMPTY STAFF RECORDS
-- =====================================================
-- Elimina registros de staff que:
-- - No tienen nombre válido (null, empty, whitespace only)
-- - Tienen solo espacios en blanco
-- - Tienen el valor literal 'null' o 'undefined'
-- =====================================================

-- Primero ver cuántos hay (para logging)
DO $$
DECLARE
  v_count INTEGER;
  v_details TEXT;
BEGIN
  -- Count staff that are "empty" by various definitions
  SELECT COUNT(*) INTO v_count
  FROM public.staff
  WHERE (
    -- Traditional empty checks
    (first_name IS NULL OR TRIM(first_name) = '' OR first_name = 'null' OR first_name = 'undefined')
    AND (last_name IS NULL OR TRIM(last_name) = '' OR last_name = 'null' OR last_name = 'undefined')
    AND (display_name IS NULL OR TRIM(display_name) = '' OR display_name = 'null' OR display_name = 'undefined')
  );

  -- Get sample of empty records for debugging
  SELECT string_agg(id::text || ' (role: ' || COALESCE(role, 'NULL') || ', tenant: ' || tenant_id::text || ')', ', ')
  INTO v_details
  FROM (
    SELECT id, role, tenant_id
    FROM public.staff
    WHERE (
      (first_name IS NULL OR TRIM(first_name) = '' OR first_name = 'null' OR first_name = 'undefined')
      AND (last_name IS NULL OR TRIM(last_name) = '' OR last_name = 'null' OR last_name = 'undefined')
      AND (display_name IS NULL OR TRIM(display_name) = '' OR display_name = 'null' OR display_name = 'undefined')
    )
    LIMIT 5
  ) sample;

  RAISE NOTICE '🔍 Found % empty staff records to clean up', v_count;
  IF v_details IS NOT NULL THEN
    RAISE NOTICE '📋 Sample empty records: %', v_details;
  END IF;
END $$;

-- =====================================================
-- STEP 1: Remove from staff_branches (FK constraint)
-- =====================================================
DELETE FROM public.staff_branches
WHERE staff_id IN (
  SELECT id FROM public.staff
  WHERE (
    (first_name IS NULL OR TRIM(first_name) = '' OR first_name = 'null' OR first_name = 'undefined')
    AND (last_name IS NULL OR TRIM(last_name) = '' OR last_name = 'null' OR last_name = 'undefined')
    AND (display_name IS NULL OR TRIM(display_name) = '' OR display_name = 'null' OR display_name = 'undefined')
  )
);

-- =====================================================
-- STEP 2: Nullify staff_id in user_roles (FK reference)
-- =====================================================
UPDATE public.user_roles
SET staff_id = NULL
WHERE staff_id IN (
  SELECT id FROM public.staff
  WHERE (
    (first_name IS NULL OR TRIM(first_name) = '' OR first_name = 'null' OR first_name = 'undefined')
    AND (last_name IS NULL OR TRIM(last_name) = '' OR last_name = 'null' OR last_name = 'undefined')
    AND (display_name IS NULL OR TRIM(display_name) = '' OR display_name = 'null' OR display_name = 'undefined')
  )
);

-- =====================================================
-- STEP 3: Nullify staff_id in appointments (if exists)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'staff_id') THEN
    UPDATE public.appointments
    SET staff_id = NULL
    WHERE staff_id IN (
      SELECT id FROM public.staff
      WHERE (
        (first_name IS NULL OR TRIM(first_name) = '' OR first_name = 'null' OR first_name = 'undefined')
        AND (last_name IS NULL OR TRIM(last_name) = '' OR last_name = 'null' OR last_name = 'undefined')
        AND (display_name IS NULL OR TRIM(display_name) = '' OR display_name = 'null' OR display_name = 'undefined')
      )
    );
    RAISE NOTICE '✅ Cleaned up appointments.staff_id references';
  END IF;
END $$;

-- =====================================================
-- STEP 4: Delete the empty staff records
-- =====================================================
DELETE FROM public.staff
WHERE (
  (first_name IS NULL OR TRIM(first_name) = '' OR first_name = 'null' OR first_name = 'undefined')
  AND (last_name IS NULL OR TRIM(last_name) = '' OR last_name = 'null' OR last_name = 'undefined')
  AND (display_name IS NULL OR TRIM(display_name) = '' OR display_name = 'null' OR display_name = 'undefined')
);

-- =====================================================
-- STEP 5: Also delete staff with only whitespace names
-- =====================================================
DELETE FROM public.staff_branches
WHERE staff_id IN (
  SELECT id FROM public.staff
  WHERE (
    COALESCE(REGEXP_REPLACE(first_name, '\s+', '', 'g'), '') = ''
    AND COALESCE(REGEXP_REPLACE(last_name, '\s+', '', 'g'), '') = ''
    AND COALESCE(REGEXP_REPLACE(display_name, '\s+', '', 'g'), '') = ''
  )
);

UPDATE public.user_roles
SET staff_id = NULL
WHERE staff_id IN (
  SELECT id FROM public.staff
  WHERE (
    COALESCE(REGEXP_REPLACE(first_name, '\s+', '', 'g'), '') = ''
    AND COALESCE(REGEXP_REPLACE(last_name, '\s+', '', 'g'), '') = ''
    AND COALESCE(REGEXP_REPLACE(display_name, '\s+', '', 'g'), '') = ''
  )
);

DELETE FROM public.staff
WHERE (
  COALESCE(REGEXP_REPLACE(first_name, '\s+', '', 'g'), '') = ''
  AND COALESCE(REGEXP_REPLACE(last_name, '\s+', '', 'g'), '') = ''
  AND COALESCE(REGEXP_REPLACE(display_name, '\s+', '', 'g'), '') = ''
);

-- =====================================================
-- VERIFICATION: Count remaining staff
-- =====================================================
DO $$
DECLARE
  v_remaining INTEGER;
  v_by_tenant TEXT;
BEGIN
  SELECT COUNT(*) INTO v_remaining FROM public.staff;

  -- Count by tenant
  SELECT string_agg(tenant_id::text || ': ' || cnt::text, ', ')
  INTO v_by_tenant
  FROM (
    SELECT tenant_id, COUNT(*) as cnt
    FROM public.staff
    GROUP BY tenant_id
    ORDER BY cnt DESC
    LIMIT 5
  ) t;

  RAISE NOTICE '✅ Cleanup complete. % total staff records remaining', v_remaining;
  RAISE NOTICE '📊 Staff by tenant (top 5): %', COALESCE(v_by_tenant, 'none');
END $$;

-- =====================================================
-- DONE!
-- =====================================================

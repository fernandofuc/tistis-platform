-- =====================================================
-- 009_critical_fixes.sql
-- =====================================================
-- Correcciones críticas identificadas en revisión de código
-- Fecha: 8 de Diciembre, 2024

-- =====================================================
-- FIX 1: Race condition en generate_patient_number()
-- Problema: Sin lock, múltiples inserts simultáneos pueden generar el mismo número
-- =====================================================
CREATE OR REPLACE FUNCTION generate_patient_number()
RETURNS TRIGGER AS $$
DECLARE
  tenant_prefix VARCHAR(10);
  next_number INTEGER;
  new_patient_number VARCHAR(50);
BEGIN
  -- Get tenant prefix con validación
  SELECT COALESCE(UPPER(LEFT(NULLIF(name, ''), 3)), 'UNK') INTO tenant_prefix
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  IF tenant_prefix IS NULL THEN
    RAISE EXCEPTION 'Tenant % not found', NEW.tenant_id;
  END IF;

  -- CRÍTICO: Usar advisory lock para prevenir race conditions
  -- El lock es a nivel de tenant para no bloquear otros tenants
  PERFORM pg_advisory_xact_lock(hashtext('patient_number_' || NEW.tenant_id::text));

  -- Get next patient number para este tenant
  SELECT COALESCE(MAX(
    CASE
      WHEN patient_number ~ ('^' || tenant_prefix || '-[0-9]+$')
      THEN CAST(SUBSTRING(patient_number FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_number
  FROM public.patients
  WHERE tenant_id = NEW.tenant_id;

  -- Generate new patient number: PREFIX-000001
  new_patient_number := tenant_prefix || '-' || LPAD(next_number::TEXT, 6, '0');

  NEW.patient_number := new_patient_number;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FIX 2: Race condition en generate_quote_number()
-- =====================================================
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
DECLARE
  tenant_prefix VARCHAR(10);
  next_number INTEGER;
  new_quote_number VARCHAR(50);
BEGIN
  -- Get tenant prefix con validación
  SELECT COALESCE(UPPER(LEFT(NULLIF(name, ''), 3)), 'UNK') INTO tenant_prefix
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  IF tenant_prefix IS NULL THEN
    RAISE EXCEPTION 'Tenant % not found', NEW.tenant_id;
  END IF;

  -- CRÍTICO: Usar advisory lock para prevenir race conditions
  PERFORM pg_advisory_xact_lock(hashtext('quote_number_' || NEW.tenant_id::text));

  -- Get next quote number para este tenant
  SELECT COALESCE(MAX(
    CASE
      WHEN quote_number ~ ('^QUO-' || tenant_prefix || '-[0-9]+$')
      THEN CAST(SUBSTRING(quote_number FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_number
  FROM public.quotes
  WHERE tenant_id = NEW.tenant_id;

  -- Generate new quote number: QUO-PREFIX-000001
  new_quote_number := 'QUO-' || tenant_prefix || '-' || LPAD(next_number::TEXT, 6, '0');

  NEW.quote_number := new_quote_number;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FIX 3: Constraint para patient_id XOR lead_id en quotes
-- Problema: Puede tener ambos o ninguno simultáneamente
-- =====================================================
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS chk_quotes_single_client;

ALTER TABLE public.quotes
ADD CONSTRAINT chk_quotes_single_client
CHECK (
  -- Debe tener exactamente uno: patient_id OR lead_id
  (patient_id IS NOT NULL AND lead_id IS NULL) OR
  (patient_id IS NULL AND lead_id IS NOT NULL) OR
  -- O ninguno (draft sin asignar)
  (patient_id IS NULL AND lead_id IS NULL AND status = 'draft')
);

-- =====================================================
-- FIX 4: Validación de fechas lógicas en quotes
-- =====================================================
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS chk_quotes_valid_until;

ALTER TABLE public.quotes
ADD CONSTRAINT chk_quotes_valid_until
CHECK (valid_until IS NULL OR valid_until >= DATE(created_at));

-- =====================================================
-- FIX 5: Mejorar calculate_quote_totals()
-- Problema: Usa NEW.id pero está en quote_items, debe usar quote_id
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  target_quote_id UUID;
  quote_subtotal DECIMAL(12, 2);
  quote_discount DECIMAL(12, 2);
  quote_tax DECIMAL(12, 2);
  quote_total DECIMAL(12, 2);
  current_discount_pct DECIMAL(5, 2);
  current_discount_amt DECIMAL(12, 2);
  current_tax_pct DECIMAL(5, 2);
BEGIN
  -- Determinar el quote_id correcto según el evento
  IF TG_OP = 'DELETE' THEN
    target_quote_id := OLD.quote_id;
  ELSE
    target_quote_id := NEW.quote_id;
  END IF;

  -- Obtener configuración actual de la quote con lock
  SELECT discount_percentage, discount_amount, tax_percentage
  INTO current_discount_pct, current_discount_amt, current_tax_pct
  FROM public.quotes
  WHERE id = target_quote_id
  FOR UPDATE;

  -- Calculate subtotal from items
  SELECT COALESCE(SUM(subtotal), 0)
  INTO quote_subtotal
  FROM public.quote_items
  WHERE quote_id = target_quote_id;

  -- Calculate discount (priorizar percentage sobre amount fijo)
  IF COALESCE(current_discount_pct, 0) > 0 THEN
    quote_discount := ROUND(quote_subtotal * (current_discount_pct / 100), 2);
  ELSE
    quote_discount := COALESCE(current_discount_amt, 0);
  END IF;

  -- Calculate tax (after discount)
  quote_tax := ROUND((quote_subtotal - quote_discount) * (COALESCE(current_tax_pct, 0) / 100), 2);

  -- Calculate total
  quote_total := quote_subtotal - quote_discount + quote_tax;

  -- Update quote
  UPDATE public.quotes
  SET
    subtotal = quote_subtotal,
    discount_amount = quote_discount,
    tax_amount = quote_tax,
    total = quote_total,
    updated_at = NOW()
  WHERE id = target_quote_id;

  -- AFTER trigger retorna NULL
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Consolidar triggers en uno solo
DROP TRIGGER IF EXISTS trg_recalculate_quote_totals_insert ON public.quote_items;
DROP TRIGGER IF EXISTS trg_recalculate_quote_totals_update ON public.quote_items;
DROP TRIGGER IF EXISTS trg_recalculate_quote_totals_delete ON public.quote_items;
DROP TRIGGER IF EXISTS trg_recalculate_quote_totals ON public.quote_items;

CREATE TRIGGER trg_recalculate_quote_totals
AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
FOR EACH ROW
EXECUTE FUNCTION calculate_quote_totals();

-- =====================================================
-- FIX 6: Trigger para validar y calcular quote_items subtotal
-- =====================================================
CREATE OR REPLACE FUNCTION validate_quote_item_subtotal()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular discount_amount si hay percentage
  IF COALESCE(NEW.discount_percentage, 0) > 0 THEN
    NEW.discount_amount := ROUND(NEW.quantity * NEW.unit_price * (NEW.discount_percentage / 100), 2);
  END IF;

  -- Calcular subtotal
  NEW.subtotal := (NEW.quantity * NEW.unit_price) - COALESCE(NEW.discount_amount, 0);

  -- Validar que sea positivo
  IF NEW.subtotal < 0 THEN
    RAISE EXCEPTION 'Quote item subtotal cannot be negative (got %)', NEW.subtotal;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_quote_item_subtotal ON public.quote_items;

CREATE TRIGGER trg_validate_quote_item_subtotal
BEFORE INSERT OR UPDATE ON public.quote_items
FOR EACH ROW
EXECUTE FUNCTION validate_quote_item_subtotal();

-- =====================================================
-- FIX 7: Índice único para email por tenant (evitar duplicados)
-- =====================================================
DROP INDEX IF EXISTS idx_patients_email_unique;

CREATE UNIQUE INDEX idx_patients_email_unique
ON public.patients(LOWER(email), tenant_id)
WHERE email IS NOT NULL;

-- =====================================================
-- FIX 8: Índice compuesto para notificaciones (optimizar queries)
-- =====================================================
DROP INDEX IF EXISTS idx_notifications_user_unread;
DROP INDEX IF EXISTS idx_notifications_user_unread_active;

CREATE INDEX idx_notifications_user_unread_active
ON public.notifications(user_id, created_at DESC)
WHERE read = FALSE AND archived = FALSE;

-- =====================================================
-- FIX 9: Mejorar RLS policy para crear notificaciones
-- Problema: Cualquier usuario autenticado podía crear notificaciones para otros
-- =====================================================
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Staff can create notifications for own tenant users"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
  -- Super admin puede crear para cualquiera
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
  )
  OR
  -- Admin/Staff solo puede crear para usuarios de su mismo tenant
  EXISTS (
    SELECT 1
    FROM public.user_roles ur_creator
    JOIN public.user_roles ur_target ON ur_target.tenant_id = ur_creator.tenant_id
    WHERE ur_creator.user_id = auth.uid()
      AND ur_target.user_id = notifications.user_id
      AND ur_creator.role IN ('admin', 'receptionist', 'dentist', 'specialist')
  )
);

-- =====================================================
-- FIX 10: Mejorar cleanup_temp_uploads con límite
-- Problema: Sin límite puede ser muy lento con muchos archivos
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_temp_uploads()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete files older than 24 hours (max 1000 per run para evitar timeout)
  WITH deleted AS (
    DELETE FROM storage.objects
    WHERE bucket_id = 'temp-uploads'
      AND created_at < NOW() - INTERVAL '24 hours'
      AND id IN (
        SELECT id
        FROM storage.objects
        WHERE bucket_id = 'temp-uploads'
          AND created_at < NOW() - INTERVAL '24 hours'
        LIMIT 1000
      )
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_count FROM deleted;

  RAISE NOTICE 'Cleaned up % temp files', v_deleted_count;

  RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIX 11: Mejorar cleanup_old_notifications con límite
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS TABLE(archived_count INTEGER, deleted_count INTEGER) AS $$
DECLARE
  v_archived INTEGER;
  v_deleted INTEGER;
BEGIN
  -- Archive expired notifications (limit 10000 per run)
  WITH archived AS (
    UPDATE public.notifications
    SET archived = TRUE
    WHERE expires_at < NOW()
      AND archived = FALSE
      AND id IN (
        SELECT id FROM public.notifications
        WHERE expires_at < NOW() AND archived = FALSE
        LIMIT 10000
      )
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_archived FROM archived;

  -- Delete archived notifications older than 90 days (limit 5000 per run)
  WITH deleted AS (
    DELETE FROM public.notifications
    WHERE archived = TRUE
      AND created_at < NOW() - INTERVAL '90 days'
      AND id IN (
        SELECT id FROM public.notifications
        WHERE archived = TRUE AND created_at < NOW() - INTERVAL '90 days'
        LIMIT 5000
      )
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted FROM deleted;

  RAISE NOTICE 'Archived % notifications, deleted %', v_archived, v_deleted;

  RETURN QUERY SELECT v_archived, v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIX 12: Validación básica de dental_chart JSON
-- =====================================================
ALTER TABLE public.clinical_history DROP CONSTRAINT IF EXISTS chk_dental_chart_valid;

ALTER TABLE public.clinical_history
ADD CONSTRAINT chk_dental_chart_valid
CHECK (
  dental_chart IS NULL OR
  jsonb_typeof(dental_chart) = 'object'
);

-- =====================================================
-- FIX 13: Agregar columna converted_at a leads
-- Para trackear cuando un lead se convirtió en paciente
-- =====================================================
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON FUNCTION generate_patient_number() IS 'Genera número único de paciente con advisory lock para prevenir race conditions';
COMMENT ON FUNCTION generate_quote_number() IS 'Genera número único de cotización con advisory lock para prevenir race conditions';
COMMENT ON FUNCTION calculate_quote_totals() IS 'Recalcula totales de cotización cuando se modifican items - CORREGIDO';
COMMENT ON FUNCTION validate_quote_item_subtotal() IS 'Valida y calcula subtotal de items de cotización';
COMMENT ON FUNCTION cleanup_temp_uploads() IS 'Limpia archivos temporales mayores a 24h (max 1000 por ejecución)';
COMMENT ON FUNCTION cleanup_old_notifications() IS 'Archiva/elimina notificaciones antiguas (con límites por ejecución)';

-- =====================================================
-- FIX 14: Mejorar storage policies con validación de tenant
-- Problema: Staff de un tenant puede acceder a archivos de otro
-- Solución: Verificar tenant_id en path o tabla patient_files
-- =====================================================

-- Eliminar políticas existentes para reemplazarlas
DROP POLICY IF EXISTS "Staff can upload patient files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read patient files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete patient files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload quotes PDF" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read quotes PDF" ON storage.objects;

-- Nueva política: Staff puede subir archivos solo si path incluye tenant_id
-- Path esperado: {tenant_id}/{patient_id}/{filename}
CREATE POLICY "Staff can upload patient files with tenant validation"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'patient-files'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'receptionist', 'dentist', 'specialist', 'super_admin')
      AND (
        -- Super admin puede subir a cualquier tenant
        ur.role = 'super_admin'
        OR
        -- Otros staff solo pueden subir a su tenant (primer segmento del path)
        ur.tenant_id::text = split_part(name, '/', 1)
      )
  )
);

-- Nueva política: Staff puede leer archivos solo de su tenant
CREATE POLICY "Staff can read patient files with tenant validation"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'receptionist', 'dentist', 'specialist', 'super_admin')
      AND (
        ur.role = 'super_admin'
        OR
        ur.tenant_id::text = split_part(name, '/', 1)
      )
  )
);

-- Nueva política: Solo admin/super_admin pueden eliminar de su tenant
CREATE POLICY "Admin can delete patient files with tenant validation"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'patient-files'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
      AND (
        ur.role = 'super_admin'
        OR
        ur.tenant_id::text = split_part(name, '/', 1)
      )
  )
);

-- Quotes PDF con validación de tenant
-- Path esperado: {tenant_id}/{quote_id}.pdf
CREATE POLICY "Staff can upload quotes PDF with tenant validation"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quotes-pdf'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'receptionist', 'dentist', 'specialist', 'super_admin')
      AND (
        ur.role = 'super_admin'
        OR
        ur.tenant_id::text = split_part(name, '/', 1)
      )
  )
);

CREATE POLICY "Staff can read quotes PDF with tenant validation"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'quotes-pdf'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'receptionist', 'dentist', 'specialist', 'super_admin')
      AND (
        ur.role = 'super_admin'
        OR
        ur.tenant_id::text = split_part(name, '/', 1)
      )
  )
);

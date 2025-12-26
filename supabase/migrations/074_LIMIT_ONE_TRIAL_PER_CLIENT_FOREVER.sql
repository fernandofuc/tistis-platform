-- =====================================================
-- Migration 074: LIMIT ONE TRIAL PER CLIENT (FOREVER)
-- =====================================================
-- PROBLEMA: Actualmente un cliente puede activar múltiples trials
-- (uno tras otro, después de que expire el anterior)
--
-- SOLUCIÓN: Limitar a UN trial por cliente PARA SIEMPRE
-- =====================================================

-- ======================
-- PASO 1: VERIFICAR Y LIMPIAR DATOS EXISTENTES
-- ======================

-- CRÍTICO: Antes de crear UNIQUE INDEX, debemos verificar que no existan
-- clientes con múltiples trials (violación de la nueva regla).
-- Si existen, necesitamos decidir qué hacer con ellos.

-- Crear tabla temporal para registrar clientes con múltiples trials
CREATE TEMP TABLE IF NOT EXISTS clients_with_multiple_trials AS
SELECT
  client_id,
  COUNT(*) as trial_count,
  ARRAY_AGG(id ORDER BY created_at) as subscription_ids,
  ARRAY_AGG(trial_status ORDER BY created_at) as trial_statuses
FROM public.subscriptions
WHERE trial_status IS NOT NULL
GROUP BY client_id
HAVING COUNT(*) > 1;

-- Verificar si hay clientes con múltiples trials
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM clients_with_multiple_trials;

  IF v_count > 0 THEN
    RAISE WARNING 'ATENCIÓN: Se encontraron % clientes con múltiples trials. Ver tabla temporal clients_with_multiple_trials para detalles.', v_count;
    RAISE NOTICE 'Para ver los clientes afectados, ejecuta: SELECT * FROM clients_with_multiple_trials;';
  ELSE
    RAISE NOTICE 'OK: No se encontraron clientes con múltiples trials. Procediendo con la migration.';
  END IF;
END $$;

-- DECISIÓN: Si existen múltiples trials, solo conservamos el MÁS RECIENTE
-- Los trials anteriores se marcan como inválidos (para auditoría) pero se excluyen del constraint

-- PASO 1.5: CREAR BACKUP DE TRIALS QUE SERÁN MODIFICADOS (para posible rollback)
CREATE TABLE IF NOT EXISTS public.trial_migration_backup_074 (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  trial_status VARCHAR(50),
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  backed_up_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.trial_migration_backup_074 IS
'Backup de trials que fueron modificados en Migration 074 (para rollback manual si es necesario)';

-- Guardar trials que serán modificados
INSERT INTO public.trial_migration_backup_074 (id, client_id, trial_status, trial_start, trial_end, created_at)
SELECT s.id, s.client_id, s.trial_status, s.trial_start, s.trial_end, s.created_at
FROM public.subscriptions s
WHERE id IN (
  SELECT UNNEST(subscription_ids[1:array_length(subscription_ids, 1)-1])
  FROM clients_with_multiple_trials
);

-- Actualizar trials antiguos para que no violen el UNIQUE INDEX
-- (marcamos con trial_status = NULL SOLO los trials que NO son el más reciente)
UPDATE public.subscriptions s
SET trial_status = NULL
WHERE id IN (
  SELECT UNNEST(subscription_ids[1:array_length(subscription_ids, 1)-1])
  FROM clients_with_multiple_trials
);

-- Registrar cuántos fueron modificados
DO $$
DECLARE
  v_modified_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_modified_count FROM trial_migration_backup_074;

  IF v_modified_count > 0 THEN
    RAISE NOTICE 'BACKUP CREADO: % trials antiguos fueron respaldados en trial_migration_backup_074 y marcados como NULL', v_modified_count;
  END IF;
END $$;

-- ======================
-- PASO 2: ELIMINAR ÍNDICE REDUNDANTE Y CREAR NUEVO
-- ======================

-- IMPORTANTE: Migration 073 creó idx_one_active_trial_per_client que solo prevenía
-- trials ACTIVOS simultáneos. Ahora necesitamos prevenir trials MÚLTIPLES (siempre).
-- El índice anterior es redundante, así que lo eliminamos primero.

-- Eliminar índice anterior (redundante)
DROP INDEX IF EXISTS public.idx_one_active_trial_per_client;

-- Crear nuevo índice que previene múltiples trials por cliente (EVER)
-- Cubre TODOS los estados de trial (active, ended, converted)
-- NOTA: Ahora puede crearse sin error porque limpiamos los datos anteriormente
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_trial_per_client_ever
ON public.subscriptions(client_id)
WHERE trial_status IS NOT NULL;

COMMENT ON INDEX idx_one_trial_per_client_ever IS
'Garantiza que un cliente solo puede tener UN trial en toda su vida (previene abuso de trials múltiples). REEMPLAZA a idx_one_active_trial_per_client de Migration 073.';

-- ======================
-- PASO 3: MEJORAR activate_free_trial - Validación Explícita
-- ======================

CREATE OR REPLACE FUNCTION public.activate_free_trial(
  p_client_id UUID,
  p_plan VARCHAR(50) DEFAULT 'starter'
)
RETURNS public.subscriptions AS $$
DECLARE
  v_subscription public.subscriptions;
  v_trial_start TIMESTAMPTZ;
  v_trial_end TIMESTAMPTZ;
  v_existing_trial_count INTEGER;
BEGIN
  -- Validar que solo plan starter puede tener trial
  IF p_plan != 'starter' THEN
    RAISE EXCEPTION 'Solo el plan Starter puede tener prueba gratuita';
  END IF;

  -- NUEVO: Verificar que cliente NUNCA ha tenido un trial antes
  -- (previene abuse de múltiples trials)
  SELECT COUNT(*) INTO v_existing_trial_count
  FROM public.subscriptions
  WHERE client_id = p_client_id
    AND trial_status IS NOT NULL; -- Cualquier trial (active, ended, converted)

  IF v_existing_trial_count > 0 THEN
    RAISE EXCEPTION 'Este cliente ya utilizó su prueba gratuita. Solo se permite un trial por cliente.';
  END IF;

  -- Calcular fechas del trial (CON timezone explícito de México)
  v_trial_start := NOW() AT TIME ZONE 'America/Mexico_City';
  v_trial_end := v_trial_start + INTERVAL '10 days';

  -- Crear suscripción en modo trial
  -- NOTA: El UNIQUE INDEX idx_one_trial_per_client_ever previene múltiples trials
  -- Si dos requests simultáneas llegan, la segunda fallará con duplicate key error
  BEGIN
    INSERT INTO public.subscriptions (
      client_id,
      plan,
      monthly_amount,
      currency,
      status,
      trial_start,
      trial_end,
      trial_status,
      will_convert_to_paid,
      current_period_start,
      current_period_end
    ) VALUES (
      p_client_id,
      p_plan,
      3490.00, -- Precio plan starter
      'MXN',
      'trialing',
      v_trial_start,
      v_trial_end,
      'active',
      true, -- Por defecto, se convertirá a pago
      v_trial_start,
      v_trial_end
    )
    RETURNING * INTO v_subscription;

  EXCEPTION
    WHEN unique_violation THEN
      -- Error unificado (mismo mensaje que validación explícita)
      RAISE EXCEPTION 'Este cliente ya utilizó su prueba gratuita. Solo se permite un trial por cliente.';
  END;

  RETURN v_subscription;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.activate_free_trial IS
'Activa prueba gratuita de 10 días (LIMITADO: Un trial por cliente para siempre)';

-- ======================
-- PASO 4: VISTA MEJORADA - Incluir Historial de Trials
-- ======================

-- Vista para ver TODOS los trials de un cliente (histórico completo)
CREATE OR REPLACE VIEW public.v_client_trial_history AS
SELECT
  c.id AS client_id,
  c.business_name,
  c.contact_email,
  s.id AS subscription_id,
  s.trial_start,
  s.trial_end,
  s.trial_status,
  s.status AS subscription_status,
  s.will_convert_to_paid,
  s.created_at,
  s.cancelled_at,
  CASE
    WHEN s.trial_status = 'active' THEN 'Trial activo'
    WHEN s.trial_status = 'converted' THEN 'Convertido a pago'
    WHEN s.trial_status = 'ended' THEN 'Trial finalizado sin conversión'
    ELSE 'Desconocido'
  END AS status_description
FROM public.clients c
LEFT JOIN public.subscriptions s ON s.client_id = c.id AND s.trial_status IS NOT NULL
ORDER BY c.business_name, s.created_at DESC;

COMMENT ON VIEW public.v_client_trial_history IS
'Historial completo de trials por cliente (para verificar que solo tienen uno)';

-- ======================
-- PASO 5: FUNCIÓN DE VERIFICACIÓN
-- ======================

-- Función helper para verificar si cliente ya usó su trial
CREATE OR REPLACE FUNCTION public.client_has_used_trial(
  p_client_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_trial_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_trial_count
  FROM public.subscriptions
  WHERE client_id = p_client_id
    AND trial_status IS NOT NULL;

  RETURN v_trial_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.client_has_used_trial IS
'Verifica si un cliente ya utilizó su prueba gratuita (retorna true si ya la usó)';

-- ======================
-- PASO 6: GRANTS
-- ======================

-- CRÍTICO: Migration 074 debe ser self-contained
-- Aunque Migration 073 ya otorgó estos permisos, 074 los re-otorga
-- para garantizar que funciona standalone

-- Funciones de trial lifecycle
GRANT EXECUTE ON FUNCTION public.activate_free_trial(UUID, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_trial(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_trial(UUID) TO service_role;

-- Funciones de procesamiento (cron job)
GRANT EXECUTE ON FUNCTION public.get_trials_expiring_today() TO service_role;
GRANT EXECUTE ON FUNCTION public.convert_trial_to_paid(UUID, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.end_trial_without_conversion(UUID) TO service_role;

-- Funciones auxiliares
GRANT EXECUTE ON FUNCTION public.client_has_used_trial(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_trial_action(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB) TO service_role;

-- Vistas de auditoría
GRANT SELECT ON public.v_client_trial_history TO service_role;

-- =====================================================
-- LISTO! Limitación implementada:
-- =====================================================
-- ✅ UNIQUE INDEX previene múltiples trials por cliente
-- ✅ activate_free_trial valida explícitamente
-- ✅ Error message claro para usuario
-- ✅ Vista de historial para auditoría
-- ✅ Función helper para verificar trial usado
-- =====================================================

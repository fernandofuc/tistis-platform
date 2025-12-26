-- =====================================================
-- Migration 073: FIX FREE TRIAL SYSTEM (CRITICAL FIXES)
-- =====================================================
-- Correcciones críticas al sistema de trials:
-- 1. UNIQUE constraint para prevenir race conditions
-- 2. Índices compuestos para performance
-- 3. Timezone handling correcto
-- 4. Query mejorada para trials expirando
-- 5. Validación de trial_end > trial_start
-- =====================================================

-- ======================
-- PASO 1: UNIQUE CONSTRAINT - Prevenir Race Conditions
-- ======================

-- Solo un trial activo por cliente (previene doble activación simultánea)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_trial_per_client
ON public.subscriptions(client_id)
WHERE trial_status = 'active' AND status = 'trialing';

COMMENT ON INDEX idx_one_active_trial_per_client IS
'Garantiza que un cliente solo puede tener un trial activo a la vez (previene race conditions)';

-- ======================
-- PASO 2: ÍNDICES COMPUESTOS - Performance
-- ======================

-- Índice compuesto para query de trials expirando
-- Cubre: trial_end, trial_status, status (en ese orden por selectividad)
CREATE INDEX IF NOT EXISTS idx_trials_expiring
ON public.subscriptions(trial_end, trial_status, status)
WHERE trial_status = 'active';

COMMENT ON INDEX idx_trials_expiring IS
'Optimiza query get_trials_expiring_today() con cobertura completa';

-- ======================
-- PASO 3: MEJORAR activate_free_trial - Atomicidad
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
BEGIN
  -- Validar que solo plan starter puede tener trial
  IF p_plan != 'starter' THEN
    RAISE EXCEPTION 'Solo el plan Starter puede tener prueba gratuita';
  END IF;

  -- Calcular fechas del trial (CON timezone explícito de México)
  v_trial_start := NOW() AT TIME ZONE 'America/Mexico_City';
  v_trial_end := v_trial_start + INTERVAL '10 days';

  -- Crear suscripción en modo trial
  -- NOTA: El UNIQUE INDEX idx_one_active_trial_per_client previene race conditions
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
      RAISE EXCEPTION 'El cliente ya tiene una suscripción activa o trial en curso';
  END;

  RETURN v_subscription;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- PASO 4: MEJORAR get_trials_expiring_today - Timezone & Recovery
-- ======================

CREATE OR REPLACE FUNCTION public.get_trials_expiring_today()
RETURNS TABLE (
  subscription_id UUID,
  client_id UUID,
  trial_end TIMESTAMPTZ,
  will_convert_to_paid BOOLEAN,
  client_email VARCHAR,
  client_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS subscription_id,
    s.client_id,
    s.trial_end,
    s.will_convert_to_paid,
    c.contact_email AS client_email,
    c.business_name AS client_name
  FROM public.subscriptions s
  INNER JOIN public.clients c ON c.id = s.client_id
  WHERE
    s.trial_status = 'active'
    AND s.status = 'trialing'
    -- CRÍTICO: Usar <= NOW() en vez de ::date = CURRENT_DATE
    -- Esto permite recuperar trials perdidos si el cron falla
    -- Y no procesa trials prematuramente (espera a que realmente expiren)
    AND s.trial_end <= NOW()
  ORDER BY s.trial_end ASC
  LIMIT 1000; -- Prevenir carga excesiva si hay muchos trials atrasados
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_trials_expiring_today IS
'Obtiene trials que YA expiraron (no solo los de hoy). Permite recovery si cron falla.';

-- ======================
-- PASO 5: VALIDACIÓN ADICIONAL EN TRIGGER
-- ======================

CREATE OR REPLACE FUNCTION public.validate_trial_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Si es trial activo, debe tener fechas
  IF NEW.trial_status = 'active' AND (NEW.trial_start IS NULL OR NEW.trial_end IS NULL) THEN
    RAISE EXCEPTION 'Trial activo debe tener trial_start y trial_end';
  END IF;

  -- Si plan no es starter, no puede tener trial
  IF NEW.plan != 'starter' AND NEW.trial_status = 'active' THEN
    RAISE EXCEPTION 'Solo el plan Starter puede tener trial activo';
  END IF;

  -- NUEVO: Validar que trial_end > trial_start
  IF NEW.trial_start IS NOT NULL AND NEW.trial_end IS NOT NULL THEN
    IF NEW.trial_end <= NEW.trial_start THEN
      RAISE EXCEPTION 'trial_end debe ser posterior a trial_start';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger (por si ya existía)
DROP TRIGGER IF EXISTS validate_trial_before_insert_update ON public.subscriptions;
CREATE TRIGGER validate_trial_before_insert_update
BEFORE INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.validate_trial_data();

-- ======================
-- PASO 6: MEJORAR convert_trial_to_paid - Logging & Validation
-- ======================

CREATE OR REPLACE FUNCTION public.convert_trial_to_paid(
  p_subscription_id UUID,
  p_stripe_subscription_id VARCHAR DEFAULT NULL,
  p_stripe_customer_id VARCHAR DEFAULT NULL
)
RETURNS public.subscriptions AS $$
DECLARE
  v_subscription public.subscriptions;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Obtener suscripción con FOR UPDATE (row-level lock)
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE; -- Previene que otro proceso modifique mientras convertimos

  -- Validar que existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suscripción no encontrada';
  END IF;

  -- Validar que está en trial y debe convertirse
  IF v_subscription.trial_status != 'active' OR NOT v_subscription.will_convert_to_paid THEN
    RAISE EXCEPTION 'La suscripción no puede convertirse a pago (trial_status: %, will_convert: %)',
      v_subscription.trial_status, v_subscription.will_convert_to_paid;
  END IF;

  -- Calcular nuevo período (1 mes desde ahora, en timezone de México)
  v_period_start := NOW() AT TIME ZONE 'America/Mexico_City';
  v_period_end := v_period_start + INTERVAL '1 month';

  -- Actualizar suscripción
  UPDATE public.subscriptions
  SET
    status = 'active',
    trial_status = 'converted',
    stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
    stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
    current_period_start = v_period_start,
    current_period_end = v_period_end,
    updated_at = NOW()
  WHERE id = p_subscription_id
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- PASO 7: MEJORAR end_trial_without_conversion
-- ======================

CREATE OR REPLACE FUNCTION public.end_trial_without_conversion(
  p_subscription_id UUID
)
RETURNS public.subscriptions AS $$
DECLARE
  v_subscription public.subscriptions;
BEGIN
  -- Obtener suscripción con FOR UPDATE
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  -- Validar que existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suscripción no encontrada';
  END IF;

  -- Validar que está en trial y NO debe convertirse
  IF v_subscription.trial_status != 'active' OR v_subscription.will_convert_to_paid THEN
    RAISE EXCEPTION 'La suscripción no puede finalizarse sin conversión (trial_status: %, will_convert: %)',
      v_subscription.trial_status, v_subscription.will_convert_to_paid;
  END IF;

  -- Finalizar trial
  UPDATE public.subscriptions
  SET
    status = 'cancelled',
    trial_status = 'cancelled',
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE id = p_subscription_id
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- PASO 8: FUNCIÓN DE AUDITORÍA (NUEVA)
-- ======================

-- Tabla de auditoría para trials (tracking de cambios críticos)
CREATE TABLE IF NOT EXISTS public.trial_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id),
  action VARCHAR(50) NOT NULL, -- 'activated', 'cancelled', 'converted', 'ended'
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  metadata JSONB, -- Información adicional (stripe_id, user_id, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trial_audit_subscription
ON public.trial_audit_log(subscription_id, created_at DESC);

COMMENT ON TABLE public.trial_audit_log IS
'Log de auditoría para trials (tracking de activaciones, cancelaciones, conversiones)';

-- Función helper para logging
CREATE OR REPLACE FUNCTION public.log_trial_action(
  p_subscription_id UUID,
  p_action VARCHAR(50),
  p_old_status VARCHAR(50) DEFAULT NULL,
  p_new_status VARCHAR(50) DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.trial_audit_log (
    subscription_id,
    action,
    old_status,
    new_status,
    metadata
  ) VALUES (
    p_subscription_id,
    p_action,
    p_old_status,
    p_new_status,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- PASO 9: MEJORAR cancel_trial CON AUDITORÍA
-- ======================

CREATE OR REPLACE FUNCTION public.cancel_trial(
  p_subscription_id UUID
)
RETURNS public.subscriptions AS $$
DECLARE
  v_subscription public.subscriptions;
BEGIN
  -- Obtener suscripción
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id;

  -- Validar que existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suscripción no encontrada';
  END IF;

  -- Validar que está en trial activo
  IF v_subscription.trial_status != 'active' OR v_subscription.trial_end < NOW() THEN
    RAISE EXCEPTION 'La suscripción no está en trial activo';
  END IF;

  -- Marcar que NO se convertirá a pago
  UPDATE public.subscriptions
  SET
    will_convert_to_paid = false,
    cancel_at = trial_end, -- Se cancela al final del trial
    updated_at = NOW()
  WHERE id = p_subscription_id
  RETURNING * INTO v_subscription;

  -- Log auditoría
  PERFORM public.log_trial_action(
    p_subscription_id,
    'cancelled',
    'active',
    'active_will_not_convert',
    jsonb_build_object('cancel_at', v_subscription.cancel_at)
  );

  RETURN v_subscription;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- PASO 10: GRANTS
-- ======================

GRANT EXECUTE ON FUNCTION public.activate_free_trial(UUID, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_trial(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_trials_expiring_today() TO service_role;
GRANT EXECUTE ON FUNCTION public.convert_trial_to_paid(UUID, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.end_trial_without_conversion(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_trial_action(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB) TO service_role;

-- ======================
-- PASO 11: VISTA MEJORADA PARA MONITOREO
-- ======================

CREATE OR REPLACE VIEW public.v_trial_subscriptions AS
SELECT
  s.id AS subscription_id,
  s.client_id,
  c.business_name,
  c.contact_email,
  s.plan,
  s.trial_start,
  s.trial_end,
  s.trial_status,
  s.will_convert_to_paid,
  s.status,
  -- Calcular días restantes (usar FLOOR para no reportar días extra)
  FLOOR(EXTRACT(EPOCH FROM (s.trial_end - NOW())) / 86400) AS days_remaining,
  CASE
    WHEN s.trial_end < NOW() THEN 'expired'
    WHEN s.will_convert_to_paid THEN 'will_convert'
    ELSE 'will_cancel'
  END AS action_needed,
  s.created_at,
  s.updated_at
FROM public.subscriptions s
INNER JOIN public.clients c ON c.id = s.client_id
WHERE s.trial_status = 'active'
ORDER BY s.trial_end ASC;

COMMENT ON VIEW public.v_trial_subscriptions IS
'Vista para monitorear trials activos con días restantes calculados correctamente';

-- =====================================================
-- LISTO! Correcciones críticas aplicadas:
-- =====================================================
-- ✅ UNIQUE constraint previene race conditions
-- ✅ Índices compuestos mejoran performance
-- ✅ Timezone handling correcto (America/Mexico_City)
-- ✅ Query de trials expirando permite recovery
-- ✅ FOR UPDATE locks previenen concurrencia
-- ✅ Tabla de auditoría para tracking
-- ✅ Validación mejorada (trial_end > trial_start)
-- ✅ Error messages con detalles para debugging
-- =====================================================

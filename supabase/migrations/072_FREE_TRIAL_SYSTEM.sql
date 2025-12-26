-- =====================================================
-- Migration 072: FREE TRIAL SYSTEM FOR STARTER PLAN
-- =====================================================
-- Implementa sistema de prueba gratuita de 10 días para plan Starter
--
-- REGLAS DE NEGOCIO:
-- 1. Usuario activa prueba de 10 días en plan Starter
-- 2. Al día 11 → Se cobra automáticamente la suscripción
-- 3. Si cancela DURANTE los 10 días → Sigue usando hasta que expire, pero NO se cobra después
-- 4. Si cancela DESPUÉS de los 10 días → Sigue el flujo normal de cancelación
-- =====================================================

-- PASO 1: Añadir campos a tabla subscriptions
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_status VARCHAR(50) CHECK (trial_status IN ('active', 'ended', 'converted', 'cancelled')),
ADD COLUMN IF NOT EXISTS will_convert_to_paid BOOLEAN DEFAULT true;

-- PASO 2: Añadir índices para performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end ON public.subscriptions(trial_end) WHERE trial_status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_status ON public.subscriptions(trial_status);

-- PASO 3: Añadir comentarios para documentación
COMMENT ON COLUMN public.subscriptions.trial_start IS 'Fecha de inicio de la prueba gratuita (solo para plan Starter)';
COMMENT ON COLUMN public.subscriptions.trial_end IS 'Fecha de fin de la prueba gratuita (trial_start + 10 días)';
COMMENT ON COLUMN public.subscriptions.trial_status IS 'Estado del trial: active (usando prueba), ended (expiró), converted (se convirtió a pago), cancelled (canceló durante trial)';
COMMENT ON COLUMN public.subscriptions.will_convert_to_paid IS 'Si true, se cobrará automáticamente al finalizar trial. Si false, no se cobrará (usuario canceló durante trial)';

-- PASO 4: Función para activar prueba gratuita
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

  -- Verificar que el cliente no tenga ya una suscripción activa o trial activo
  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE client_id = p_client_id
    AND (
      status IN ('active', 'trialing')
      OR (trial_status = 'active' AND trial_end > NOW())
    )
  ) THEN
    RAISE EXCEPTION 'El cliente ya tiene una suscripción activa o trial en curso';
  END IF;

  -- Calcular fechas del trial
  v_trial_start := NOW();
  v_trial_end := NOW() + INTERVAL '10 days';

  -- Crear suscripción en modo trial
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

  RETURN v_subscription;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 5: Función para cancelar trial (mantiene acceso pero no cobra)
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

  RETURN v_subscription;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 6: Función para obtener trials que expiran hoy (para cron job)
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
    AND s.trial_end::date = CURRENT_DATE
    AND s.status = 'trialing'
  ORDER BY s.trial_end ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASO 7: Función para convertir trial a suscripción paga
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
  -- Obtener suscripción
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id;

  -- Validar que existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suscripción no encontrada';
  END IF;

  -- Validar que está en trial y debe convertirse
  IF v_subscription.trial_status != 'active' OR NOT v_subscription.will_convert_to_paid THEN
    RAISE EXCEPTION 'La suscripción no puede convertirse a pago';
  END IF;

  -- Calcular nuevo período (1 mes desde hoy)
  v_period_start := NOW();
  v_period_end := NOW() + INTERVAL '1 month';

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

-- PASO 8: Función para finalizar trial sin convertir (cuando usuario canceló)
CREATE OR REPLACE FUNCTION public.end_trial_without_conversion(
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

  -- Validar que está en trial y NO debe convertirse
  IF v_subscription.trial_status != 'active' OR v_subscription.will_convert_to_paid THEN
    RAISE EXCEPTION 'La suscripción no puede finalizarse sin conversión';
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

-- PASO 9: Trigger para verificar coherencia de datos
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_trial_before_insert_update
BEFORE INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.validate_trial_data();

-- PASO 10: Vista para monitoreo de trials
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
  EXTRACT(DAY FROM (s.trial_end - NOW())) AS days_remaining,
  CASE
    WHEN s.trial_end < NOW() THEN 'expired'
    WHEN s.will_convert_to_paid THEN 'will_convert'
    ELSE 'will_cancel'
  END AS action_needed
FROM public.subscriptions s
INNER JOIN public.clients c ON c.id = s.client_id
WHERE s.trial_status = 'active'
ORDER BY s.trial_end ASC;

COMMENT ON VIEW public.v_trial_subscriptions IS 'Vista para monitorear trials activos y acciones necesarias';

-- =====================================================
-- GRANTS (opcional - ajustar según tus necesidades)
-- =====================================================

-- Permitir que service role ejecute las funciones
GRANT EXECUTE ON FUNCTION public.activate_free_trial(UUID, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_trial(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_trials_expiring_today() TO service_role;
GRANT EXECUTE ON FUNCTION public.convert_trial_to_paid(UUID, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.end_trial_without_conversion(UUID) TO service_role;

-- =====================================================
-- LISTO!
-- =====================================================
-- Sistema de Free Trial implementado:
--
-- FUNCIONES DISPONIBLES:
-- 1. activate_free_trial(client_id, 'starter') - Activa trial de 10 días
-- 2. cancel_trial(subscription_id) - Cancela trial (mantiene acceso, no cobra)
-- 3. get_trials_expiring_today() - Obtiene trials que expiran hoy
-- 4. convert_trial_to_paid(subscription_id) - Convierte trial a suscripción paga
-- 5. end_trial_without_conversion(subscription_id) - Finaliza trial sin cobrar
--
-- PRÓXIMOS PASOS:
-- 1. Crear cron job que ejecute get_trials_expiring_today() diariamente
-- 2. Para cada trial que expira:
--    - Si will_convert_to_paid = true → Cobrar con Stripe → convert_trial_to_paid()
--    - Si will_convert_to_paid = false → end_trial_without_conversion()
-- 3. Integrar UI para mostrar días restantes del trial
-- 4. Crear email notifications para días 7, 3, 1 antes de expirar
-- =====================================================

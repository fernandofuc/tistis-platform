-- =====================================================
-- TIS TIS PLATFORM - Secure Booking System
-- Migration: 167_SECURE_BOOKING_SYSTEM
-- Sistema de reservaciones seguro con penalizaciones,
-- bloqueo de clientes, holds temporales y confirmación
-- bidireccional.
-- =====================================================

-- =====================================================
-- PARTE 0: FUNCIÓN HELPER IMMUTABLE PARA GENERATED COLUMNS
-- =====================================================
-- PostgreSQL requiere expresiones IMMUTABLE para columnas generadas.
-- La operación timestamptz + interval no es inmutable debido a zonas horarias,
-- pero para minutos es seguro marcarlo como IMMUTABLE.

CREATE OR REPLACE FUNCTION public.add_minutes_immutable(
  p_datetime timestamptz,
  p_minutes int
)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT p_datetime + (p_minutes * INTERVAL '1 minute')
$$;

-- =====================================================
-- PARTE 1: TABLA booking_holds (Reservas Temporales)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.booking_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,

  -- Slot info
  slot_datetime timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30,
  end_datetime timestamptz GENERATED ALWAYS AS (add_minutes_immutable(slot_datetime, duration_minutes)) STORED,

  -- Hold metadata
  hold_type text NOT NULL CHECK (hold_type IN ('voice_call', 'chat_session', 'manual')),
  session_id text NOT NULL, -- call_id o conversation_id
  customer_phone text,
  customer_name text,

  -- Optional associations
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,

  -- Status tracking
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'expired', 'released')),
  expires_at timestamptz NOT NULL,
  converted_to_id uuid, -- appointment_id o order_id una vez convertido
  converted_at timestamptz,
  released_at timestamptz,
  release_reason text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_hold_duration CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Índices para booking_holds
CREATE INDEX IF NOT EXISTS idx_booking_holds_slot ON public.booking_holds(tenant_id, branch_id, slot_datetime, end_datetime)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_booking_holds_expiry ON public.booking_holds(expires_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_booking_holds_session ON public.booking_holds(session_id);
CREATE INDEX IF NOT EXISTS idx_booking_holds_tenant ON public.booking_holds(tenant_id);

-- =====================================================
-- PARTE 2: TABLA customer_trust_scores (Puntaje de Confianza)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.customer_trust_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Score principal (0-100)
  trust_score int NOT NULL DEFAULT 80 CHECK (trust_score >= 0 AND trust_score <= 100),

  -- Contadores de violaciones
  no_shows int DEFAULT 0,
  no_pickups int DEFAULT 0,
  late_cancellations int DEFAULT 0,
  confirmed_no_response int DEFAULT 0,

  -- Contadores positivos
  total_bookings int DEFAULT 0,
  completed_bookings int DEFAULT 0,
  on_time_pickups int DEFAULT 0,

  -- Estado especial
  is_vip boolean DEFAULT false,
  vip_reason text,
  vip_set_at timestamptz,
  vip_set_by uuid REFERENCES auth.users(id),

  -- Bloqueo (cache de customer_blocks)
  is_blocked boolean DEFAULT false,
  block_reason text,
  blocked_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT unique_tenant_lead UNIQUE (tenant_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_trust_scores_tenant ON public.customer_trust_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_blocked ON public.customer_trust_scores(tenant_id, is_blocked)
  WHERE is_blocked = true;
CREATE INDEX IF NOT EXISTS idx_trust_scores_low ON public.customer_trust_scores(tenant_id, trust_score)
  WHERE trust_score < 30;
CREATE INDEX IF NOT EXISTS idx_trust_scores_vip ON public.customer_trust_scores(tenant_id, is_vip)
  WHERE is_vip = true;

-- =====================================================
-- PARTE 3: TABLA customer_penalties (Registro de Penalizaciones)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.customer_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  phone_number text, -- Para clientes sin lead

  -- Violación
  violation_type text NOT NULL CHECK (violation_type IN (
    'no_show',            -- No llegó a la cita
    'no_pickup',          -- No recogió pedido
    'late_cancellation',  -- Canceló tarde (<24h)
    'no_confirmation',    -- No confirmó
    'abuse',              -- Comportamiento abusivo
    'fraud',              -- Intento de fraude
    'other'               -- Otro
  )),

  -- Referencia al booking
  reference_type text NOT NULL CHECK (reference_type IN ('appointment', 'order', 'reservation')),
  reference_id uuid NOT NULL,

  -- Severidad (1-5)
  severity int NOT NULL DEFAULT 3 CHECK (severity >= 1 AND severity <= 5),

  -- Strike tracking
  strike_count int DEFAULT 1,
  description text,

  -- Resolución
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  resolution_notes text,
  expires_at timestamptz, -- Algunas penalizaciones expiran

  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_penalties_tenant ON public.customer_penalties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_penalties_lead ON public.customer_penalties(tenant_id, lead_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_penalties_phone ON public.customer_penalties(tenant_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_penalties_active ON public.customer_penalties(tenant_id, expires_at)
  WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_penalties_type ON public.customer_penalties(tenant_id, violation_type);

-- =====================================================
-- PARTE 4: TABLA customer_blocks (Bloqueos de Clientes)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.customer_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  phone_number text NOT NULL, -- Siempre guardar teléfono para bloquear aunque no tenga lead

  -- Razón del bloqueo
  block_reason text NOT NULL CHECK (block_reason IN (
    'auto_no_shows',           -- Automático por no-shows
    'auto_no_pickups',         -- Automático por no pickups
    'auto_late_cancellations', -- Automático por cancelaciones tardías
    'auto_low_trust',          -- Automático por trust score muy bajo
    'manual_abuse',            -- Manual por abuso
    'manual_fraud',            -- Manual por fraude
    'manual_other'             -- Manual otro motivo
  )),
  block_details text,

  -- Quién bloqueó
  blocked_by_type text NOT NULL DEFAULT 'system' CHECK (blocked_by_type IN ('system', 'staff')),
  blocked_by_user_id uuid REFERENCES auth.users(id),

  -- Estado y expiración
  is_active boolean DEFAULT true,
  unblock_at timestamptz, -- Desbloqueo automático programado (NULL = permanente)
  unblocked_at timestamptz,
  unblocked_by uuid REFERENCES auth.users(id),
  unblock_reason text,

  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- UNIQUE INDEX parcial para bloqueos activos (permite múltiples históricos)
-- Esto asegura solo un bloqueo activo por tenant+phone
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_block
  ON public.customer_blocks(tenant_id, phone_number)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_blocks_tenant ON public.customer_blocks(tenant_id);
-- NOTA: idx_blocks_active removido porque es redundante con idx_unique_active_block
CREATE INDEX IF NOT EXISTS idx_blocks_lead ON public.customer_blocks(tenant_id, lead_id)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_blocks_unblock_at ON public.customer_blocks(unblock_at)
  WHERE is_active = true AND unblock_at IS NOT NULL;

-- =====================================================
-- PARTE 5: TABLA booking_confirmations (Confirmaciones Bidireccionales)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.booking_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Reference (polymorphic)
  reference_type text NOT NULL CHECK (reference_type IN ('appointment', 'order', 'reservation')),
  reference_id uuid NOT NULL,

  -- Tipo de confirmación
  confirmation_type text NOT NULL CHECK (confirmation_type IN (
    'voice_to_message',  -- Después de llamada de voz
    'reminder_24h',      -- Recordatorio 24h antes
    'reminder_2h',       -- Recordatorio 2h antes
    'deposit_required',  -- Requiere depósito
    'custom'             -- Personalizado
  )),

  -- Canal de envío
  sent_via text NOT NULL CHECK (sent_via IN ('whatsapp', 'sms', 'email')),

  -- Estado del mensaje
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Pendiente de envío
    'sent',       -- Enviado
    'delivered',  -- Entregado
    'read',       -- Leído
    'responded',  -- Respondido
    'expired',    -- Expirado sin respuesta
    'failed'      -- Falló envío
  )),

  -- Timestamps de estado
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz NOT NULL,

  -- Respuesta del cliente
  response text CHECK (response IN ('confirmed', 'cancelled', 'need_change', 'other')),
  response_raw text, -- Texto original de la respuesta

  -- WhatsApp tracking
  whatsapp_message_id text,
  whatsapp_template_name text,
  conversation_id uuid,

  -- Auto-action on expire
  auto_action_on_expire text DEFAULT 'notify_staff'
    CHECK (auto_action_on_expire IN ('cancel', 'keep', 'notify_staff')),
  auto_action_executed boolean DEFAULT false,
  auto_action_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_confirmations_tenant ON public.booking_confirmations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_pending ON public.booking_confirmations(reference_type, reference_id)
  WHERE status NOT IN ('responded', 'expired');
CREATE INDEX IF NOT EXISTS idx_confirmations_expiry ON public.booking_confirmations(expires_at)
  WHERE status IN ('sent', 'delivered', 'read');
CREATE INDEX IF NOT EXISTS idx_confirmations_whatsapp ON public.booking_confirmations(whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

-- =====================================================
-- PARTE 6: TABLA vertical_booking_policies (Políticas por Vertical)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.vertical_booking_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Policy scope
  vertical text NOT NULL, -- 'dental', 'restaurant', 'medical', 'beauty', etc.
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE, -- NULL = aplica a todo el tenant

  -- Trust score thresholds
  trust_threshold_confirmation int DEFAULT 80, -- Debajo de esto requiere confirmación
  trust_threshold_deposit int DEFAULT 30,      -- Debajo de esto requiere depósito
  trust_threshold_block int DEFAULT 15,        -- Debajo de esto auto-bloquear

  -- Penalización scores (cuánto restar)
  penalty_no_show int DEFAULT 25,
  penalty_no_pickup int DEFAULT 30,
  penalty_late_cancel int DEFAULT 15,
  penalty_no_confirmation int DEFAULT 10,

  -- Reward scores (cuánto sumar)
  reward_completed int DEFAULT 5,
  reward_on_time int DEFAULT 3,

  -- Auto-block rules
  auto_block_no_shows int DEFAULT 3,           -- Bloquear después de N no-shows
  auto_block_no_pickups int DEFAULT 2,         -- Bloquear después de N no-pickups
  auto_block_duration_hours int DEFAULT 720,   -- 30 días por defecto

  -- Hold configuration
  hold_duration_minutes int DEFAULT 15,        -- Duración del hold
  hold_buffer_minutes int DEFAULT 5,           -- Buffer adicional

  -- Confirmation requirements
  require_confirmation_below_trust boolean DEFAULT true,
  confirmation_timeout_hours int DEFAULT 2,
  confirmation_reminder_hours int DEFAULT 24,

  -- Deposit configuration
  require_deposit_below_trust boolean DEFAULT true,
  deposit_amount_cents int DEFAULT 10000,      -- $100 MXN
  deposit_percent_of_service int,              -- Alternativa: % del servicio

  -- Active/Default
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,            -- Una por vertical

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT unique_tenant_vertical_branch UNIQUE (tenant_id, vertical, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_policies_tenant ON public.vertical_booking_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_vertical ON public.vertical_booking_policies(tenant_id, vertical, is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_policies_default ON public.vertical_booking_policies(tenant_id, vertical, is_default)
  WHERE is_default = true;

-- =====================================================
-- PARTE 7: TABLA booking_deposits (Depósitos con Stripe)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.booking_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Reference
  reference_type text NOT NULL CHECK (reference_type IN ('appointment', 'order', 'reservation')),
  reference_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Stripe info (siguiendo stripe-best-practices)
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_charge_id text,
  stripe_customer_id text,              -- Para asociar cliente de Stripe
  stripe_refund_id text,                -- Para rastrear reembolsos
  idempotency_key text,                 -- Para prevenir pagos duplicados
  webhook_event_id text,                -- Para rastrear qué eventos de Stripe se procesaron

  -- Amounts
  amount_cents int NOT NULL,
  refund_amount_cents int,              -- Para reembolsos parciales
  currency text DEFAULT 'mxn' CHECK (currency IN ('mxn', 'usd', 'eur')),

  -- Metadata (para datos adicionales de Stripe)
  stripe_metadata jsonb DEFAULT '{}',

  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Esperando pago
    'paid',       -- Pagado
    'refunded',   -- Reembolsado
    'forfeited',  -- Perdido (por no-show)
    'applied',    -- Aplicado al servicio
    'failed',     -- Falló el pago
    'expired'     -- Link expiró
  )),

  -- Payment link
  payment_link_url text,
  payment_link_expires_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  processed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deposits_tenant ON public.booking_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deposits_reference ON public.booking_deposits(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.booking_deposits(tenant_id, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_deposits_stripe ON public.booking_deposits(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deposits_stripe_customer ON public.booking_deposits(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deposits_idempotency ON public.booking_deposits(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- =====================================================
-- PARTE 8: MODIFICAR TABLA appointments (Nuevos campos)
-- =====================================================

DO $$
BEGIN
  -- Hold reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'appointments'
    AND column_name = 'created_from_hold_id'
  ) THEN
    ALTER TABLE public.appointments
    ADD COLUMN created_from_hold_id uuid REFERENCES public.booking_holds(id);
  END IF;

  -- Customer trust at time of booking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'appointments'
    AND column_name = 'customer_trust_score_at_booking'
  ) THEN
    ALTER TABLE public.appointments
    ADD COLUMN customer_trust_score_at_booking int;
  END IF;

  -- Confirmation status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'appointments'
    AND column_name = 'confirmation_status'
  ) THEN
    ALTER TABLE public.appointments
    ADD COLUMN confirmation_status text DEFAULT 'not_required'
      CHECK (confirmation_status IN ('not_required', 'pending', 'confirmed', 'expired'));
  END IF;

  -- Deposit status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'appointments'
    AND column_name = 'deposit_status'
  ) THEN
    ALTER TABLE public.appointments
    ADD COLUMN deposit_status text DEFAULT 'not_required'
      CHECK (deposit_status IN ('not_required', 'required', 'pending', 'paid', 'forfeited', 'refunded', 'applied'));
  END IF;

  -- Deposit amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'appointments'
    AND column_name = 'deposit_amount_cents'
  ) THEN
    ALTER TABLE public.appointments
    ADD COLUMN deposit_amount_cents int;
  END IF;
END $$;

-- Índice para citas pendientes de confirmación
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_pending
  ON public.appointments(tenant_id, confirmation_status)
  WHERE confirmation_status = 'pending';

-- =====================================================
-- PARTE 9: MODIFICAR TABLA restaurant_orders (Nuevos campos)
-- =====================================================

DO $$
BEGIN
  -- Hold reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'restaurant_orders'
    AND column_name = 'created_from_hold_id'
  ) THEN
    ALTER TABLE public.restaurant_orders
    ADD COLUMN created_from_hold_id uuid REFERENCES public.booking_holds(id);
  END IF;

  -- Customer trust at time of order
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'restaurant_orders'
    AND column_name = 'customer_trust_score_at_order'
  ) THEN
    ALTER TABLE public.restaurant_orders
    ADD COLUMN customer_trust_score_at_order int;
  END IF;

  -- Pickup deadline for takeout orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'restaurant_orders'
    AND column_name = 'pickup_deadline'
  ) THEN
    ALTER TABLE public.restaurant_orders
    ADD COLUMN pickup_deadline timestamptz;
  END IF;

  -- No pickup flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'restaurant_orders'
    AND column_name = 'is_no_pickup'
  ) THEN
    ALTER TABLE public.restaurant_orders
    ADD COLUMN is_no_pickup boolean DEFAULT false;
  END IF;

  -- Confirmation status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'restaurant_orders'
    AND column_name = 'confirmation_status'
  ) THEN
    ALTER TABLE public.restaurant_orders
    ADD COLUMN confirmation_status text DEFAULT 'not_required'
      CHECK (confirmation_status IN ('not_required', 'pending', 'confirmed', 'expired'));
  END IF;
END $$;

-- Índice para órdenes pendientes de pickup
CREATE INDEX IF NOT EXISTS idx_orders_pickup_pending
  ON public.restaurant_orders(tenant_id, branch_id, pickup_deadline)
  WHERE order_type = 'takeout' AND status = 'ready' AND is_no_pickup = false;

-- =====================================================
-- PARTE 10: ROW LEVEL SECURITY
-- =====================================================

-- booking_holds
ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_booking_holds" ON public.booking_holds
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "tenant_booking_holds" ON public.booking_holds
  FOR ALL TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  );

-- customer_trust_scores
ALTER TABLE public.customer_trust_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_trust_scores" ON public.customer_trust_scores
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "tenant_trust_scores" ON public.customer_trust_scores
  FOR ALL TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  );

-- customer_penalties
ALTER TABLE public.customer_penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_penalties" ON public.customer_penalties
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "tenant_view_penalties" ON public.customer_penalties
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "tenant_manage_penalties" ON public.customer_penalties
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner', 'manager')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner', 'manager')
    )
  );

-- customer_blocks
ALTER TABLE public.customer_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_blocks" ON public.customer_blocks
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "tenant_view_blocks" ON public.customer_blocks
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "tenant_manage_blocks" ON public.customer_blocks
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner', 'manager')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner', 'manager')
    )
  );

-- booking_confirmations
ALTER TABLE public.booking_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_confirmations" ON public.booking_confirmations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "tenant_confirmations" ON public.booking_confirmations
  FOR ALL TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  );

-- vertical_booking_policies
ALTER TABLE public.vertical_booking_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_policies" ON public.vertical_booking_policies
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "tenant_view_policies" ON public.vertical_booking_policies
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "tenant_manage_policies" ON public.vertical_booking_policies
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner')
    )
  );

-- booking_deposits
ALTER TABLE public.booking_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_deposits" ON public.booking_deposits
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "tenant_deposits" ON public.booking_deposits
  FOR ALL TO authenticated
  USING (
    tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true)
  );

-- =====================================================
-- PARTE 11: FUNCIONES RPC CON ADVISORY LOCKS
-- =====================================================

-- FUNCIÓN HELPER: Validar que el usuario tiene acceso al tenant
-- Esta función previene que usuarios autenticados manipulen datos de otros tenants
-- cuando llaman directamente a las funciones RPC desde el cliente
CREATE OR REPLACE FUNCTION public.validate_user_tenant_access(
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si es service_role, siempre permitir (llamadas desde backend)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN true;
  END IF;

  -- Si es authenticated, verificar que el usuario pertenece al tenant
  IF auth.uid() IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND tenant_id = p_tenant_id
        AND is_active = true
    );
  END IF;

  -- Si no hay usuario autenticado, denegar
  RETURN false;
END;
$$;

-- Función: Crear hold temporal con advisory lock para evitar race conditions
CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_slot_datetime timestamptz,
  p_duration_minutes int,
  p_hold_type text,
  p_session_id text,
  p_customer_phone text DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL,
  p_hold_minutes int DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold_id uuid;
  v_expires_at timestamptz;
  v_existing_hold uuid;
  v_existing_appointment uuid;
  v_end_datetime timestamptz;
  v_lock_key bigint;
BEGIN
  -- SEGURIDAD: Validar que el usuario tiene acceso al tenant
  IF NOT validate_user_tenant_access(p_tenant_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', 'No tienes acceso a este tenant'
    );
  END IF;

  -- Validar que slot_datetime es futuro (edge case)
  IF p_slot_datetime <= now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_datetime',
      'message', 'La fecha y hora debe ser en el futuro'
    );
  END IF;

  -- Calcular end_datetime
  v_end_datetime := p_slot_datetime + (p_duration_minutes || ' minutes')::interval;

  -- Calcular expiración del hold
  v_expires_at := now() + (p_hold_minutes || ' minutes')::interval;

  -- ADVISORY LOCK: Prevenir race conditions
  -- Generar key único para el slot basado en tenant, branch, y datetime
  v_lock_key := hashtext(p_tenant_id::text || COALESCE(p_branch_id::text, 'null') || p_slot_datetime::text);

  -- Intentar obtener lock exclusivo (no espera, retorna false si ocupado)
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'slot_being_processed',
      'message', 'Este horario está siendo procesado por otra operación, intente de nuevo en unos segundos'
    );
  END IF;

  -- Verificar si ya hay un hold activo para este slot
  SELECT id INTO v_existing_hold
  FROM booking_holds
  WHERE tenant_id = p_tenant_id
    AND (branch_id = p_branch_id OR (branch_id IS NULL AND p_branch_id IS NULL))
    AND status = 'active'
    AND (
      -- OVERLAPS: (start1, end1) OVERLAPS (start2, end2)
      -- Usar columnas de la tabla para el primer par y variables para el segundo
      (slot_datetime, end_datetime) OVERLAPS
      (p_slot_datetime, v_end_datetime)
    )
  LIMIT 1;

  IF v_existing_hold IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'slot_held',
      'message', 'Este horario ya está siendo reservado por otra persona',
      'existing_hold_id', v_existing_hold
    );
  END IF;

  -- Verificar si ya hay una cita en ese horario
  SELECT id INTO v_existing_appointment
  FROM appointments
  WHERE tenant_id = p_tenant_id
    AND (branch_id = p_branch_id OR (branch_id IS NULL AND p_branch_id IS NULL))
    AND status NOT IN ('cancelled', 'rescheduled')
    AND (
      (scheduled_at, scheduled_at + (duration_minutes || ' minutes')::interval) OVERLAPS
      (p_slot_datetime, v_end_datetime)
    )
  LIMIT 1;

  IF v_existing_appointment IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'slot_booked',
      'message', 'Este horario ya está ocupado',
      'existing_appointment_id', v_existing_appointment
    );
  END IF;

  -- Crear hold
  INSERT INTO booking_holds (
    tenant_id, branch_id, slot_datetime, duration_minutes,
    hold_type, session_id, customer_phone, customer_name,
    lead_id, service_id, staff_id, expires_at
  ) VALUES (
    p_tenant_id, p_branch_id, p_slot_datetime, p_duration_minutes,
    p_hold_type, p_session_id, p_customer_phone, p_customer_name,
    p_lead_id, p_service_id, p_staff_id, v_expires_at
  )
  RETURNING id INTO v_hold_id;

  RETURN jsonb_build_object(
    'success', true,
    'hold_id', v_hold_id,
    'expires_at', v_expires_at
  );
END;
$$;

-- Función: Verificar si cliente está bloqueado
CREATE OR REPLACE FUNCTION public.check_customer_blocked(
  p_tenant_id uuid,
  p_phone_number text,
  p_lead_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_block record;
BEGIN
  -- SEGURIDAD: Validar que el usuario tiene acceso al tenant
  IF NOT validate_user_tenant_access(p_tenant_id) THEN
    RETURN jsonb_build_object(
      'is_blocked', false,
      'error', 'unauthorized'
    );
  END IF;

  -- Buscar bloqueo activo por teléfono o lead_id
  SELECT * INTO v_block
  FROM customer_blocks
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND (
      phone_number = p_phone_number
      OR (p_lead_id IS NOT NULL AND lead_id = p_lead_id)
    )
    AND (unblock_at IS NULL OR unblock_at > now())
  LIMIT 1;

  IF v_block IS NOT NULL THEN
    RETURN jsonb_build_object(
      'is_blocked', true,
      'block_reason', v_block.block_reason,
      'block_details', v_block.block_details,
      'blocked_at', v_block.created_at,
      'unblock_at', v_block.unblock_at
    );
  END IF;

  RETURN jsonb_build_object(
    'is_blocked', false
  );
END;
$$;

-- Función: Obtener trust score (crea uno nuevo si no existe)
CREATE OR REPLACE FUNCTION public.get_customer_trust_score(
  p_tenant_id uuid,
  p_lead_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score record;
BEGIN
  -- SEGURIDAD: Validar que el usuario tiene acceso al tenant
  IF NOT validate_user_tenant_access(p_tenant_id) THEN
    RETURN jsonb_build_object(
      'trust_score', 0,
      'error', 'unauthorized'
    );
  END IF;

  SELECT * INTO v_score
  FROM customer_trust_scores
  WHERE tenant_id = p_tenant_id
    AND lead_id = p_lead_id;

  IF v_score IS NULL THEN
    -- Crear score inicial con valor de 80
    INSERT INTO customer_trust_scores (tenant_id, lead_id, trust_score)
    VALUES (p_tenant_id, p_lead_id, 80)
    RETURNING * INTO v_score;
  END IF;

  RETURN jsonb_build_object(
    'trust_score', v_score.trust_score,
    'is_blocked', v_score.is_blocked,
    'is_vip', v_score.is_vip,
    'no_shows', v_score.no_shows,
    'no_pickups', v_score.no_pickups,
    'total_bookings', v_score.total_bookings,
    'completed_bookings', v_score.completed_bookings,
    'requires_confirmation', v_score.trust_score < 80 AND NOT v_score.is_vip,
    'requires_deposit', v_score.trust_score < 30 AND NOT v_score.is_vip
  );
END;
$$;

-- Función: Registrar penalización
CREATE OR REPLACE FUNCTION public.record_customer_penalty(
  p_tenant_id uuid,
  p_lead_id uuid,
  p_phone_number text,
  p_violation_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_severity int DEFAULT 3,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_penalty_id uuid;
  v_strike_count int;
  v_score_change int;
  v_should_block boolean := false;
  v_policy record;
  v_current_score int;
  v_is_vip boolean := false;
BEGIN
  -- SEGURIDAD: Validar que el usuario tiene acceso al tenant
  IF NOT validate_user_tenant_access(p_tenant_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized',
      'message', 'No tienes acceso a este tenant'
    );
  END IF;

  -- Verificar si el cliente es VIP (bypass de penalizaciones)
  IF p_lead_id IS NOT NULL THEN
    SELECT is_vip INTO v_is_vip
    FROM customer_trust_scores
    WHERE tenant_id = p_tenant_id AND lead_id = p_lead_id;

    -- Los clientes VIP no reciben penalizaciones automáticas
    IF v_is_vip = true THEN
      RETURN jsonb_build_object(
        'success', true,
        'penalty_id', NULL,
        'vip_bypass', true,
        'message', 'Cliente VIP - penalización no aplicada'
      );
    END IF;
  END IF;

  -- Obtener política del tenant
  SELECT * INTO v_policy
  FROM vertical_booking_policies
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND is_default = true
  LIMIT 1;

  -- Contar strikes previos no resueltos del mismo tipo
  SELECT COUNT(*) + 1 INTO v_strike_count
  FROM customer_penalties
  WHERE tenant_id = p_tenant_id
    AND (lead_id = p_lead_id OR phone_number = p_phone_number)
    AND violation_type = p_violation_type
    AND is_resolved = false
    AND (expires_at IS NULL OR expires_at > now());

  -- Crear penalty
  INSERT INTO customer_penalties (
    tenant_id, lead_id, phone_number, violation_type,
    reference_type, reference_id, severity, strike_count,
    description, expires_at
  ) VALUES (
    p_tenant_id, p_lead_id, p_phone_number, p_violation_type,
    p_reference_type, p_reference_id, p_severity, v_strike_count,
    p_description, now() + INTERVAL '90 days'
  )
  RETURNING id INTO v_penalty_id;

  -- Calcular cambio de score basado en policy o defaults
  v_score_change := CASE p_violation_type
    WHEN 'no_show' THEN -COALESCE(v_policy.penalty_no_show, 25)
    WHEN 'no_pickup' THEN -COALESCE(v_policy.penalty_no_pickup, 30)
    WHEN 'late_cancellation' THEN -COALESCE(v_policy.penalty_late_cancel, 15)
    WHEN 'no_confirmation' THEN -COALESCE(v_policy.penalty_no_confirmation, 10)
    ELSE -10
  END;

  -- Actualizar trust score si hay lead
  IF p_lead_id IS NOT NULL THEN
    UPDATE customer_trust_scores
    SET
      trust_score = GREATEST(0, trust_score + v_score_change),
      no_shows = CASE WHEN p_violation_type = 'no_show' THEN no_shows + 1 ELSE no_shows END,
      no_pickups = CASE WHEN p_violation_type = 'no_pickup' THEN no_pickups + 1 ELSE no_pickups END,
      late_cancellations = CASE WHEN p_violation_type = 'late_cancellation' THEN late_cancellations + 1 ELSE late_cancellations END,
      updated_at = now()
    WHERE tenant_id = p_tenant_id AND lead_id = p_lead_id
    RETURNING trust_score INTO v_current_score;

    -- Si no existía, crear
    IF NOT FOUND THEN
      INSERT INTO customer_trust_scores (tenant_id, lead_id, trust_score, no_shows, no_pickups, late_cancellations)
      VALUES (
        p_tenant_id, p_lead_id,
        GREATEST(0, 80 + v_score_change),
        CASE WHEN p_violation_type = 'no_show' THEN 1 ELSE 0 END,
        CASE WHEN p_violation_type = 'no_pickup' THEN 1 ELSE 0 END,
        CASE WHEN p_violation_type = 'late_cancellation' THEN 1 ELSE 0 END
      )
      RETURNING trust_score INTO v_current_score;
    END IF;

    -- Verificar si debe auto-bloquearse
    IF v_current_score < COALESCE(v_policy.trust_threshold_block, 15) THEN
      v_should_block := true;
    ELSIF p_violation_type = 'no_show' AND v_strike_count >= COALESCE(v_policy.auto_block_no_shows, 3) THEN
      v_should_block := true;
    ELSIF p_violation_type = 'no_pickup' AND v_strike_count >= COALESCE(v_policy.auto_block_no_pickups, 2) THEN
      v_should_block := true;
    END IF;
  END IF;

  -- Auto-bloquear si necesario
  IF v_should_block AND p_phone_number IS NOT NULL THEN
    INSERT INTO customer_blocks (
      tenant_id, lead_id, phone_number, block_reason,
      block_details, blocked_by_type,
      unblock_at
    ) VALUES (
      p_tenant_id, p_lead_id, p_phone_number,
      -- Mapear violation_type a block_reason válido según CHECK constraint
      CASE p_violation_type
        WHEN 'no_show' THEN 'auto_no_shows'
        WHEN 'no_pickup' THEN 'auto_no_pickups'
        WHEN 'late_cancellation' THEN 'auto_late_cancellations'
        ELSE 'auto_low_trust' -- Para no_confirmation, abuse, fraud, other
      END,
      'Bloqueado automáticamente por ' || v_strike_count || ' violación(es) de tipo: ' || p_violation_type,
      'system',
      now() + (COALESCE(v_policy.auto_block_duration_hours, 720) || ' hours')::interval
    )
    -- ON CONFLICT con el índice único parcial (tenant_id, phone_number) WHERE is_active = true
    ON CONFLICT (tenant_id, phone_number) WHERE is_active = true DO NOTHING;

    -- Marcar trust score como bloqueado
    IF p_lead_id IS NOT NULL THEN
      UPDATE customer_trust_scores
      SET
        is_blocked = true,
        block_reason = CASE p_violation_type
          WHEN 'no_show' THEN 'auto_no_shows'
          WHEN 'no_pickup' THEN 'auto_no_pickups'
          WHEN 'late_cancellation' THEN 'auto_late_cancellations'
          ELSE 'auto_low_trust'
        END,
        blocked_at = now()
      WHERE tenant_id = p_tenant_id AND lead_id = p_lead_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'penalty_id', v_penalty_id,
    'strike_count', v_strike_count,
    'score_change', v_score_change,
    'new_score', v_current_score,
    'auto_blocked', v_should_block
  );
END;
$$;

-- Función: Convertir hold a appointment
CREATE OR REPLACE FUNCTION public.convert_hold_to_appointment(
  p_hold_id uuid,
  p_appointment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Obtener tenant_id del hold para validación de seguridad
  SELECT tenant_id INTO v_tenant_id
  FROM booking_holds
  WHERE id = p_hold_id;

  -- SEGURIDAD: Validar que el usuario tiene acceso al tenant del hold
  IF v_tenant_id IS NULL OR NOT validate_user_tenant_access(v_tenant_id) THEN
    RETURN false;
  END IF;

  UPDATE booking_holds
  SET
    status = 'converted',
    converted_to_id = p_appointment_id,
    converted_at = now(),
    updated_at = now()
  WHERE id = p_hold_id AND status = 'active';

  RETURN FOUND;
END;
$$;

-- Función: Liberar hold manualmente
CREATE OR REPLACE FUNCTION public.release_booking_hold(
  p_hold_id uuid,
  p_reason text DEFAULT 'manual_release'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Obtener tenant_id del hold para validación de seguridad
  SELECT tenant_id INTO v_tenant_id
  FROM booking_holds
  WHERE id = p_hold_id;

  -- SEGURIDAD: Validar que el usuario tiene acceso al tenant del hold
  IF v_tenant_id IS NULL OR NOT validate_user_tenant_access(v_tenant_id) THEN
    RETURN false;
  END IF;

  UPDATE booking_holds
  SET
    status = 'released',
    released_at = now(),
    release_reason = p_reason,
    updated_at = now()
  WHERE id = p_hold_id AND status = 'active';

  RETURN FOUND;
END;
$$;

-- Función: Liberar holds expirados (para CRON)
CREATE OR REPLACE FUNCTION public.cleanup_expired_holds()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE booking_holds
  SET
    status = 'expired',
    released_at = now(),
    release_reason = 'auto_expired',
    updated_at = now()
  WHERE status = 'active' AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Función: Actualizar trust score manualmente
CREATE OR REPLACE FUNCTION public.update_trust_score(
  p_tenant_id uuid,
  p_lead_id uuid,
  p_score_change int,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_score int;
BEGIN
  -- SEGURIDAD: Validar que el usuario tiene acceso al tenant
  IF NOT validate_user_tenant_access(p_tenant_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unauthorized'
    );
  END IF;

  UPDATE customer_trust_scores
  SET
    trust_score = GREATEST(0, LEAST(100, trust_score + p_score_change)),
    updated_at = now()
  WHERE tenant_id = p_tenant_id AND lead_id = p_lead_id
  RETURNING trust_score INTO v_new_score;

  IF NOT FOUND THEN
    INSERT INTO customer_trust_scores (tenant_id, lead_id, trust_score)
    VALUES (p_tenant_id, p_lead_id, GREATEST(0, LEAST(100, 80 + p_score_change)))
    RETURNING trust_score INTO v_new_score;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_score', v_new_score
  );
END;
$$;

-- Función: Desbloquear cliente automáticamente expirado (para CRON)
-- Optimizada con CTEs para mejor performance (O(1) vs O(2n))
-- LIMIT 1000 para prevenir timeouts en serverless (vercel-best-practices)
CREATE OR REPLACE FUNCTION public.unblock_expired_customers(
  p_batch_limit int DEFAULT 1000
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Usar CTE para hacer ambas operaciones en queries eficientes
  -- LIMIT para batch processing y prevenir timeouts en serverless
  WITH expired_blocks AS (
    -- Obtener bloqueos expirados con LIMIT para batch processing
    SELECT id, tenant_id, lead_id
    FROM customer_blocks
    WHERE is_active = true
      AND unblock_at IS NOT NULL
      AND unblock_at <= now()
    ORDER BY unblock_at ASC
    LIMIT p_batch_limit
  ),
  updated_blocks AS (
    -- Desactivar todos los bloqueos expirados en una sola operación
    UPDATE customer_blocks cb
    SET
      is_active = false,
      unblocked_at = now(),
      unblock_reason = 'auto_expired',
      updated_at = now()
    FROM expired_blocks eb
    WHERE cb.id = eb.id
    RETURNING cb.id
  ),
  updated_scores AS (
    -- Actualizar trust_scores para todos los leads afectados
    UPDATE customer_trust_scores cts
    SET
      is_blocked = false,
      block_reason = NULL,
      blocked_at = NULL,
      -- Restaurar score a 50 (neutral) para dar segunda oportunidad
      trust_score = 50,
      updated_at = now()
    FROM expired_blocks eb
    WHERE cts.tenant_id = eb.tenant_id
      AND cts.lead_id = eb.lead_id
      AND eb.lead_id IS NOT NULL
    RETURNING cts.id
  )
  SELECT COUNT(*) INTO v_count FROM updated_blocks;

  RETURN v_count;
END;
$$;

-- =====================================================
-- PARTE 12: TRIGGERS
-- =====================================================

-- Trigger: Actualizar trust score cuando appointment se completa o no_show
CREATE OR REPLACE FUNCTION public.update_trust_on_appointment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo procesar si el status cambió
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Si se completó, incrementar score
  IF NEW.status = 'completed' AND NEW.lead_id IS NOT NULL THEN
    UPDATE customer_trust_scores
    SET
      trust_score = LEAST(100, trust_score + 5),
      total_bookings = total_bookings + 1,
      completed_bookings = completed_bookings + 1,
      updated_at = now()
    WHERE tenant_id = NEW.tenant_id AND lead_id = NEW.lead_id;

    -- Crear si no existe
    IF NOT FOUND THEN
      INSERT INTO customer_trust_scores (tenant_id, lead_id, trust_score, total_bookings, completed_bookings)
      VALUES (NEW.tenant_id, NEW.lead_id, 85, 1, 1);
    END IF;
  END IF;

  -- Si es no_show, registrar penalización (la función record_customer_penalty maneja todo)
  IF NEW.status = 'no_show' AND NEW.lead_id IS NOT NULL THEN
    PERFORM record_customer_penalty(
      NEW.tenant_id,
      NEW.lead_id,
      (SELECT phone FROM leads WHERE id = NEW.lead_id),
      'no_show',
      'appointment',
      NEW.id,
      4, -- severity
      'No se presentó a la cita programada'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_trust_on_appointment ON public.appointments;
CREATE TRIGGER trigger_update_trust_on_appointment
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_trust_on_appointment_status();

-- Trigger: Actualizar trust score cuando order se completa o no_pickup
CREATE OR REPLACE FUNCTION public.update_trust_on_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_changed boolean := OLD.status IS DISTINCT FROM NEW.status;
  v_no_pickup_changed boolean := OLD.is_no_pickup IS DISTINCT FROM NEW.is_no_pickup;
BEGIN
  -- Solo procesar si hubo cambios relevantes (status o is_no_pickup)
  IF NOT v_status_changed AND NOT v_no_pickup_changed THEN
    RETURN NEW;
  END IF;

  -- Si se completó, incrementar score (solo si el status cambió a completed)
  IF v_status_changed AND NEW.status = 'completed' AND NEW.customer_id IS NOT NULL THEN
    UPDATE customer_trust_scores
    SET
      trust_score = LEAST(100, trust_score + 3),
      total_bookings = total_bookings + 1,
      completed_bookings = completed_bookings + 1,
      on_time_pickups = CASE WHEN NEW.order_type = 'takeout' THEN on_time_pickups + 1 ELSE on_time_pickups END,
      updated_at = now()
    WHERE tenant_id = NEW.tenant_id AND lead_id = NEW.customer_id;

    IF NOT FOUND THEN
      INSERT INTO customer_trust_scores (tenant_id, lead_id, trust_score, total_bookings, completed_bookings, on_time_pickups)
      VALUES (NEW.tenant_id, NEW.customer_id, 83, 1, 1, CASE WHEN NEW.order_type = 'takeout' THEN 1 ELSE 0 END);
    END IF;
  END IF;

  -- Si marcado como no_pickup (cuando cambia de false/NULL a true)
  IF v_no_pickup_changed AND NEW.is_no_pickup = true AND NEW.customer_id IS NOT NULL THEN
    PERFORM record_customer_penalty(
      NEW.tenant_id,
      NEW.customer_id,
      -- Obtener phone del lead para poder crear el bloqueo
      (SELECT phone FROM leads WHERE id = NEW.customer_id),
      'no_pickup',
      'order',
      NEW.id,
      5, -- severity alta
      'No recogió el pedido para llevar'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_trust_on_order ON public.restaurant_orders;
CREATE TRIGGER trigger_update_trust_on_order
  AFTER UPDATE OF status, is_no_pickup ON public.restaurant_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_trust_on_order_status();

-- Trigger: Actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_secure_booking_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_booking_holds_updated_at ON public.booking_holds;
CREATE TRIGGER trigger_booking_holds_updated_at
  BEFORE UPDATE ON public.booking_holds
  FOR EACH ROW EXECUTE FUNCTION update_secure_booking_updated_at();

DROP TRIGGER IF EXISTS trigger_customer_trust_scores_updated_at ON public.customer_trust_scores;
CREATE TRIGGER trigger_customer_trust_scores_updated_at
  BEFORE UPDATE ON public.customer_trust_scores
  FOR EACH ROW EXECUTE FUNCTION update_secure_booking_updated_at();

DROP TRIGGER IF EXISTS trigger_customer_blocks_updated_at ON public.customer_blocks;
CREATE TRIGGER trigger_customer_blocks_updated_at
  BEFORE UPDATE ON public.customer_blocks
  FOR EACH ROW EXECUTE FUNCTION update_secure_booking_updated_at();

DROP TRIGGER IF EXISTS trigger_booking_confirmations_updated_at ON public.booking_confirmations;
CREATE TRIGGER trigger_booking_confirmations_updated_at
  BEFORE UPDATE ON public.booking_confirmations
  FOR EACH ROW EXECUTE FUNCTION update_secure_booking_updated_at();

DROP TRIGGER IF EXISTS trigger_vertical_booking_policies_updated_at ON public.vertical_booking_policies;
CREATE TRIGGER trigger_vertical_booking_policies_updated_at
  BEFORE UPDATE ON public.vertical_booking_policies
  FOR EACH ROW EXECUTE FUNCTION update_secure_booking_updated_at();

DROP TRIGGER IF EXISTS trigger_booking_deposits_updated_at ON public.booking_deposits;
CREATE TRIGGER trigger_booking_deposits_updated_at
  BEFORE UPDATE ON public.booking_deposits
  FOR EACH ROW EXECUTE FUNCTION update_secure_booking_updated_at();

-- =====================================================
-- PARTE 13: GRANT PERMISSIONS
-- =====================================================

-- Helper function para validación de seguridad
GRANT EXECUTE ON FUNCTION public.validate_user_tenant_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_user_tenant_access(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.create_booking_hold(uuid, uuid, timestamptz, int, text, text, text, text, uuid, uuid, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(uuid, uuid, timestamptz, int, text, text, text, text, uuid, uuid, uuid, int) TO service_role;

GRANT EXECUTE ON FUNCTION public.check_customer_blocked(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_customer_blocked(uuid, text, uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_customer_trust_score(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_trust_score(uuid, uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.record_customer_penalty(uuid, uuid, text, text, text, uuid, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_penalty(uuid, uuid, text, text, text, uuid, int, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.convert_hold_to_appointment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_hold_to_appointment(uuid, uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.release_booking_hold(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_booking_hold(uuid, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_holds() TO service_role;

GRANT EXECUTE ON FUNCTION public.update_trust_score(uuid, uuid, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_trust_score(uuid, uuid, int, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.unblock_expired_customers(int) TO service_role;

-- =====================================================
-- PARTE 14: DEFAULT POLICIES (Seed Data)
-- =====================================================

-- Insertar políticas por defecto para cada vertical
INSERT INTO public.vertical_booking_policies (
  tenant_id, vertical, is_default,
  trust_threshold_confirmation, trust_threshold_deposit, trust_threshold_block,
  penalty_no_show, penalty_no_pickup, penalty_late_cancel, penalty_no_confirmation,
  reward_completed, reward_on_time,
  auto_block_no_shows, auto_block_no_pickups, auto_block_duration_hours,
  hold_duration_minutes, hold_buffer_minutes,
  require_confirmation_below_trust, confirmation_timeout_hours, confirmation_reminder_hours,
  require_deposit_below_trust, deposit_amount_cents
)
SELECT
  t.id as tenant_id,
  t.vertical,
  true as is_default,
  -- Dental: más estricto
  CASE WHEN t.vertical = 'dental' THEN 80 ELSE 75 END,
  CASE WHEN t.vertical = 'dental' THEN 30 ELSE 25 END,
  15,
  -- Penalties
  25, -- no_show
  CASE WHEN t.vertical = 'restaurant' THEN 30 ELSE 20 END, -- no_pickup
  15, -- late_cancel
  10, -- no_confirmation
  -- Rewards
  5, 3,
  -- Auto-block
  3, -- no_shows
  CASE WHEN t.vertical = 'restaurant' THEN 2 ELSE 3 END, -- no_pickups (restaurantes más estrictos)
  720, -- 30 días
  -- Hold config
  CASE WHEN t.vertical = 'dental' THEN 20 ELSE 15 END,
  5,
  -- Confirmation
  true, 2, 24,
  -- Deposit
  true,
  CASE WHEN t.vertical = 'dental' THEN 30000 ELSE 10000 END -- $300 o $100 MXN
FROM tenants t
WHERE t.status = 'active'
ON CONFLICT (tenant_id, vertical, branch_id) DO NOTHING;

-- =====================================================
-- PARTE 15: REAL-TIME SUBSCRIPTIONS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'booking_holds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE booking_holds;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'booking_confirmations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE booking_confirmations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'customer_blocks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE customer_blocks;
  END IF;
END $$;

-- =====================================================
-- PARTE 16: COMMENTS (Documentación)
-- =====================================================

COMMENT ON TABLE public.booking_holds IS
  'Reservas temporales para prevenir doble booking durante llamadas/chats activos';

COMMENT ON TABLE public.customer_trust_scores IS
  'Puntaje de confianza del cliente basado en historial de comportamiento (0-100)';

COMMENT ON TABLE public.customer_penalties IS
  'Registro de penalizaciones por no_show, no_pickup, late_cancellation, etc.';

COMMENT ON TABLE public.customer_blocks IS
  'Clientes bloqueados manual o automáticamente con fecha opcional de desbloqueo';

COMMENT ON TABLE public.booking_confirmations IS
  'Sistema de confirmación bidireccional (voz → WhatsApp)';

COMMENT ON TABLE public.vertical_booking_policies IS
  'Políticas de reservación configurables por vertical/tenant';

COMMENT ON TABLE public.booking_deposits IS
  'Depósitos requeridos para clientes con bajo trust score';

COMMENT ON FUNCTION public.create_booking_hold IS
  'Crea un hold temporal con advisory lock para prevenir race conditions';

COMMENT ON FUNCTION public.check_customer_blocked IS
  'Verifica si un cliente está bloqueado por teléfono o lead_id';

COMMENT ON FUNCTION public.get_customer_trust_score IS
  'Obtiene o crea el trust score de un cliente';

COMMENT ON FUNCTION public.record_customer_penalty IS
  'Registra una penalización y auto-bloquea si necesario';

COMMENT ON FUNCTION public.cleanup_expired_holds IS
  'Libera holds expirados (llamar desde CRON cada 5 minutos)';

COMMENT ON FUNCTION public.unblock_expired_customers(int) IS
  'Desbloquea clientes cuyo bloqueo temporal expiró (llamar desde CRON cada hora). Parámetro p_batch_limit para batch processing en serverless.';

COMMENT ON FUNCTION public.validate_user_tenant_access(uuid) IS
  'Valida que el usuario autenticado tiene acceso al tenant_id especificado. Previene manipulación de datos de otros tenants.';

-- =====================================================
-- MIGRACIÓN COMPLETADA
-- =====================================================

SELECT 'Migration 167: Secure Booking System - COMPLETADA' as status;

-- =====================================================
-- TIS TIS PLATFORM - LOYALTY SYSTEM
-- Migration: 053_LOYALTY_SYSTEM.sql
-- Description: Complete loyalty system with tokens, memberships,
--              rewards, and AI-powered reactivation messaging
-- =====================================================

-- =====================================================
-- 1. LOYALTY PROGRAMS (Configuración principal por tenant)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Configuración general
    program_name TEXT NOT NULL DEFAULT 'Programa de Lealtad',
    program_description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Qué sistemas están habilitados
    tokens_enabled BOOLEAN NOT NULL DEFAULT true,
    membership_enabled BOOLEAN NOT NULL DEFAULT true,

    -- Configuración de tokens
    tokens_name TEXT NOT NULL DEFAULT 'Puntos', -- "Puntos", "Estrellas", "Coins", etc.
    tokens_name_plural TEXT NOT NULL DEFAULT 'Puntos',
    tokens_icon TEXT DEFAULT 'star', -- Icono para mostrar
    tokens_per_currency DECIMAL(10,4) NOT NULL DEFAULT 1.0, -- Tokens por cada $X gastado
    tokens_currency_threshold DECIMAL(10,2) NOT NULL DEFAULT 100.0, -- Mínimo gastado para ganar tokens
    tokens_expiry_days INTEGER NOT NULL DEFAULT 365, -- 0 = no expiran

    -- Configuración de reactivación AI
    reactivation_enabled BOOLEAN NOT NULL DEFAULT true,
    reactivation_days_inactive INTEGER NOT NULL DEFAULT 365, -- Días sin visita = inactivo
    reactivation_message_template TEXT DEFAULT 'Hola {nombre}, ha pasado tiempo desde tu última visita. {oferta_personalizada}',
    reactivation_offer_type TEXT DEFAULT 'discount_percent', -- Tipo de oferta
    reactivation_offer_value DECIMAL(10,2) DEFAULT 20.0, -- Valor de la oferta (ej: 20%)
    reactivation_max_attempts INTEGER NOT NULL DEFAULT 1, -- Máx intentos de contacto

    -- Metadatos
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id)
);

-- =====================================================
-- 2. LOYALTY TOKEN RULES (Reglas para ganar tokens)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_token_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

    -- Tipo de acción
    action_type TEXT NOT NULL, -- 'purchase', 'referral', 'appointment_completed', 'review', 'checkin', 'birthday', 'signup', 'custom'
    action_name TEXT NOT NULL, -- Nombre visible: "Por cada cita completada"
    action_description TEXT,

    -- Tokens otorgados
    tokens_amount INTEGER NOT NULL DEFAULT 10,
    tokens_multiplier DECIMAL(5,2) DEFAULT 1.0, -- Para compras: multiplicador sobre el monto

    -- Límites
    max_per_period INTEGER, -- NULL = ilimitado
    period_type TEXT DEFAULT 'month', -- 'day', 'week', 'month', 'year', 'lifetime'

    -- Condiciones (JSON para flexibilidad)
    conditions JSONB DEFAULT '{}', -- Ej: {"min_purchase": 500, "service_ids": ["uuid1", "uuid2"]}

    -- Estado
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 3. LOYALTY REWARDS (Recompensas canjeables)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

    -- Información de la recompensa
    reward_name TEXT NOT NULL, -- "10% de descuento", "Limpieza gratis"
    reward_description TEXT,
    image_url TEXT,

    -- Costo en tokens
    tokens_required INTEGER NOT NULL,

    -- Tipo de recompensa
    reward_type TEXT NOT NULL, -- 'discount_percentage', 'discount_fixed', 'free_service', 'gift', 'upgrade', 'custom'
    discount_type TEXT, -- 'percentage', 'fixed'
    discount_value DECIMAL(10,2), -- Valor del descuento

    -- Restricciones
    service_id UUID REFERENCES services(id) ON DELETE SET NULL, -- Si aplica a servicio específico
    applicable_services UUID[] DEFAULT '{}', -- Lista de servicios donde aplica
    min_purchase DECIMAL(10,2), -- Compra mínima para aplicar
    terms_conditions TEXT, -- Términos y condiciones

    -- Stock
    stock_limit INTEGER, -- NULL = ilimitado
    stock_used INTEGER NOT NULL DEFAULT 0,

    -- Disponibilidad
    max_redemptions_total INTEGER, -- NULL = ilimitado
    max_redemptions_per_user INTEGER DEFAULT 1, -- Por usuario
    valid_days INTEGER NOT NULL DEFAULT 30, -- Días de validez después de canjear

    -- Estado
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false, -- Mostrar destacado
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Fechas de vigencia
    available_from TIMESTAMPTZ,
    available_until TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 4. LOYALTY MEMBERSHIP PLANS (Planes de membresía)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

    -- Información del plan
    plan_name TEXT NOT NULL, -- "Plan Básico", "Plan Premium", "Plan VIP"
    plan_description TEXT,
    color TEXT DEFAULT '#3B82F6', -- Color para UI
    icon TEXT DEFAULT 'crown',

    -- Precios
    price_monthly DECIMAL(10,2) NOT NULL,
    price_annual DECIMAL(10,2), -- Con descuento, NULL = no disponible anual

    -- Beneficios configurables (JSON para flexibilidad)
    benefits JSONB NOT NULL DEFAULT '[]',
    -- Ejemplo: [
    --   {"type": "discount_percent", "value": 10, "description": "10% en todos los servicios"},
    --   {"type": "free_service", "service_id": "uuid", "frequency": "monthly", "description": "1 limpieza gratis al mes"},
    --   {"type": "priority_booking", "value": true, "description": "Reserva prioritaria"},
    --   {"type": "tokens_multiplier", "value": 2, "description": "Gana el doble de puntos"}
    -- ]

    -- Descuento general en servicios (adicional a beneficios)
    discount_percent DECIMAL(5,2) DEFAULT 0,

    -- Servicios gratuitos incluidos
    free_services JSONB DEFAULT '[]', -- [{service_id, frequency: "monthly"|"annual", quantity: 1}]

    -- Características especiales
    priority_booking BOOLEAN NOT NULL DEFAULT false,
    tokens_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.0, -- Multiplicador de tokens

    -- Límites
    max_members INTEGER, -- NULL = ilimitado
    current_members INTEGER NOT NULL DEFAULT 0,

    -- Estado
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 5. LOYALTY BALANCES (Balance de tokens por lead/paciente)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

    -- Balance actual
    current_balance INTEGER NOT NULL DEFAULT 0,

    -- Estadísticas históricas
    total_earned INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0,
    lifetime_value DECIMAL(10,2) NOT NULL DEFAULT 0,

    -- Nivel/Tier (calculado o asignado)
    tier TEXT DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'
    tier_updated_at TIMESTAMPTZ,

    -- Último movimiento
    last_earn_at TIMESTAMPTZ,
    last_redeem_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(lead_id, program_id)
);

-- =====================================================
-- 6. LOYALTY TRANSACTIONS (Historial de tokens)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balance_id UUID NOT NULL REFERENCES loyalty_balances(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

    -- Tipo de transacción
    transaction_type TEXT NOT NULL, -- 'earn', 'redeem', 'expire', 'adjust', 'transfer_in', 'transfer_out'

    -- Monto (positivo = ganar, negativo = gastar/expirar)
    tokens INTEGER NOT NULL,
    balance_after INTEGER NOT NULL, -- Balance después de la transacción

    -- Origen de la transacción
    source_type TEXT NOT NULL, -- 'purchase', 'action', 'referral', 'admin', 'expiry', 'redemption', 'membership_bonus'
    source_id UUID, -- ID de la cita, regla, reward, etc.
    source_reference TEXT, -- Referencia legible: "Cita #1234", "Regla: Por referido"

    -- Descripción
    description TEXT NOT NULL,

    -- Expiración de estos tokens específicos
    expires_at TIMESTAMPTZ,

    -- Metadata adicional
    metadata JSONB DEFAULT '{}',

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES staff(id) ON DELETE SET NULL
);

-- =====================================================
-- 7. LOYALTY MEMBERSHIPS (Membresías activas de pacientes)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES loyalty_membership_plans(id) ON DELETE RESTRICT,

    -- Estado
    status TEXT NOT NULL DEFAULT 'pending_payment', -- 'active', 'pending_payment', 'cancelled', 'expired', 'paused'

    -- Fechas
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    next_billing_at TIMESTAMPTZ,

    -- Facturación
    billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'annual'
    payment_amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MXN',

    -- Stripe
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    payment_method_last4 TEXT,
    payment_method_brand TEXT,

    -- Renovación
    auto_renew BOOLEAN NOT NULL DEFAULT true,

    -- Cancelación
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,

    -- Beneficios usados (tracking)
    benefits_used JSONB DEFAULT '{}', -- {"free_cleanings_used": 2, "last_priority_booking": "2024-01-15"}

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un lead solo puede tener una membresía activa por programa
    UNIQUE(lead_id, plan_id)
);

-- =====================================================
-- 8. LOYALTY REDEMPTIONS (Canjes de recompensas)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balance_id UUID NOT NULL REFERENCES loyalty_balances(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES loyalty_rewards(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

    -- Tokens gastados
    tokens_used INTEGER NOT NULL,

    -- Estado del canje
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'used', 'expired', 'cancelled'

    -- Código único de canje
    redemption_code TEXT NOT NULL UNIQUE,

    -- Validez
    valid_until TIMESTAMPTZ NOT NULL,

    -- Uso
    used_at TIMESTAMPTZ,
    used_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    used_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,

    -- Valor al momento del canje (snapshot)
    reward_snapshot JSONB NOT NULL, -- Copia del reward al momento del canje

    -- Notas
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 9. LOYALTY REACTIVATION LOGS (Registro de mensajes de reactivación)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_reactivation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

    -- Mensaje enviado
    message_content TEXT NOT NULL,
    message_channel TEXT NOT NULL, -- 'whatsapp', 'sms', 'email'

    -- Oferta incluida
    offer_type TEXT,
    offer_value DECIMAL(10,2),
    offer_code TEXT, -- Código de descuento generado
    offer_valid_until TIMESTAMPTZ,

    -- Estado
    status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'responded', 'converted', 'failed'

    -- Resultado
    responded_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ, -- Si agendó cita
    conversion_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

    -- Contexto del mensaje (qué detectó la AI)
    ai_context JSONB DEFAULT '{}', -- {"last_service": "Limpieza", "days_inactive": 380, "interests": ["blanqueamiento"]}

    -- Metadata
    external_message_id TEXT, -- ID del mensaje en WhatsApp/SMS
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 10. LOYALTY AI MESSAGE TEMPLATES (Plantillas de mensajes configurables)
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,

    -- Tipo de mensaje
    message_type TEXT NOT NULL, -- 'reactivation', 'membership_reminder', 'membership_expired', 'tokens_earned', 'tokens_expiring', 'reward_available', 'welcome', 'birthday'

    -- Contenido
    name TEXT NOT NULL, -- Nombre interno
    subject TEXT, -- Para emails
    template_content TEXT NOT NULL, -- Mensaje con placeholders: {nombre}, {tokens}, {oferta}, etc.

    -- Configuración de envío
    send_days_before INTEGER, -- Para recordatorios (ej: 7 días antes de vencer)
    send_time_preference TEXT DEFAULT 'morning', -- 'morning', 'afternoon', 'evening'

    -- Canales habilitados
    channels TEXT[] NOT NULL DEFAULT ARRAY['whatsapp'], -- ['whatsapp', 'sms', 'email']

    -- Estado
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(program_id, message_type)
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Loyalty Programs
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_tenant ON loyalty_programs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_active ON loyalty_programs(tenant_id) WHERE is_active = true;

-- Token Rules
CREATE INDEX IF NOT EXISTS idx_loyalty_token_rules_program ON loyalty_token_rules(program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_token_rules_active ON loyalty_token_rules(program_id) WHERE is_active = true;

-- Rewards
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_program ON loyalty_rewards(program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_active ON loyalty_rewards(program_id) WHERE is_active = true;

-- Membership Plans
CREATE INDEX IF NOT EXISTS idx_loyalty_membership_plans_program ON loyalty_membership_plans(program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_membership_plans_active ON loyalty_membership_plans(program_id) WHERE is_active = true;

-- Balances
CREATE INDEX IF NOT EXISTS idx_loyalty_balances_tenant ON loyalty_balances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_balances_lead ON loyalty_balances(lead_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_balances_program ON loyalty_balances(program_id);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_balance ON loyalty_transactions(balance_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_tenant ON loyalty_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_program ON loyalty_transactions(program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created ON loyalty_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_expires ON loyalty_transactions(expires_at) WHERE expires_at IS NOT NULL;

-- Memberships
CREATE INDEX IF NOT EXISTS idx_loyalty_memberships_tenant ON loyalty_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_memberships_program ON loyalty_memberships(program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_memberships_lead ON loyalty_memberships(lead_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_memberships_status ON loyalty_memberships(status);
CREATE INDEX IF NOT EXISTS idx_loyalty_memberships_end_date ON loyalty_memberships(end_date);
CREATE INDEX IF NOT EXISTS idx_loyalty_memberships_billing ON loyalty_memberships(next_billing_at) WHERE status = 'active';

-- Redemptions
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_balance ON loyalty_redemptions(balance_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_tenant ON loyalty_redemptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_program ON loyalty_redemptions(program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_code ON loyalty_redemptions(redemption_code);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_status ON loyalty_redemptions(status);

-- Reactivation Logs
CREATE INDEX IF NOT EXISTS idx_loyalty_reactivation_tenant ON loyalty_reactivation_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_reactivation_lead ON loyalty_reactivation_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_reactivation_status ON loyalty_reactivation_logs(status);

-- Message Templates
CREATE INDEX IF NOT EXISTS idx_loyalty_message_templates_program ON loyalty_message_templates(program_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_token_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_reactivation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_message_templates ENABLE ROW LEVEL SECURITY;

-- NOTE: get_user_tenant_id() function already exists from previous migrations (011, 031-033)
-- We reuse the existing function for RLS policies

-- Loyalty Programs Policies
CREATE POLICY "Users can view their tenant loyalty program"
    ON loyalty_programs FOR SELECT
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage loyalty program"
    ON loyalty_programs FOR ALL
    USING (tenant_id = get_user_tenant_id())
    WITH CHECK (tenant_id = get_user_tenant_id());

-- Token Rules Policies
CREATE POLICY "Users can view token rules"
    ON loyalty_token_rules FOR SELECT
    USING (program_id IN (SELECT id FROM loyalty_programs WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Admins can manage token rules"
    ON loyalty_token_rules FOR ALL
    USING (program_id IN (SELECT id FROM loyalty_programs WHERE tenant_id = get_user_tenant_id()))
    WITH CHECK (program_id IN (SELECT id FROM loyalty_programs WHERE tenant_id = get_user_tenant_id()));

-- Rewards Policies
CREATE POLICY "Users can view rewards"
    ON loyalty_rewards FOR SELECT
    USING (program_id IN (SELECT id FROM loyalty_programs WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Admins can manage rewards"
    ON loyalty_rewards FOR ALL
    USING (program_id IN (SELECT id FROM loyalty_programs WHERE tenant_id = get_user_tenant_id()))
    WITH CHECK (program_id IN (SELECT id FROM loyalty_programs WHERE tenant_id = get_user_tenant_id()));

-- Membership Plans Policies
CREATE POLICY "Users can view membership plans"
    ON loyalty_membership_plans FOR SELECT
    USING (program_id IN (SELECT id FROM loyalty_programs WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Admins can manage membership plans"
    ON loyalty_membership_plans FOR ALL
    USING (program_id IN (SELECT id FROM loyalty_programs WHERE tenant_id = get_user_tenant_id()))
    WITH CHECK (program_id IN (SELECT id FROM loyalty_programs WHERE tenant_id = get_user_tenant_id()));

-- Balances Policies
CREATE POLICY "Users can view balances"
    ON loyalty_balances FOR SELECT
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can manage balances"
    ON loyalty_balances FOR ALL
    USING (tenant_id = get_user_tenant_id())
    WITH CHECK (tenant_id = get_user_tenant_id());

-- Transactions Policies
CREATE POLICY "Users can view transactions"
    ON loyalty_transactions FOR SELECT
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can insert transactions"
    ON loyalty_transactions FOR INSERT
    WITH CHECK (tenant_id = get_user_tenant_id());

-- Memberships Policies
CREATE POLICY "Users can view memberships"
    ON loyalty_memberships FOR SELECT
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage memberships"
    ON loyalty_memberships FOR ALL
    USING (tenant_id = get_user_tenant_id())
    WITH CHECK (tenant_id = get_user_tenant_id());

-- Redemptions Policies
CREATE POLICY "Users can view redemptions"
    ON loyalty_redemptions FOR SELECT
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can manage redemptions"
    ON loyalty_redemptions FOR ALL
    USING (tenant_id = get_user_tenant_id())
    WITH CHECK (tenant_id = get_user_tenant_id());

-- Reactivation Logs Policies
CREATE POLICY "Users can view reactivation logs"
    ON loyalty_reactivation_logs FOR SELECT
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can insert reactivation logs"
    ON loyalty_reactivation_logs FOR INSERT
    WITH CHECK (tenant_id = get_user_tenant_id());

-- Message Templates Policies
CREATE POLICY "Users can view message templates"
    ON loyalty_message_templates FOR SELECT
    USING (program_id IN (SELECT id FROM loyalty_programs WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Admins can manage message templates"
    ON loyalty_message_templates FOR ALL
    USING (program_id IN (SELECT id FROM loyalty_programs WHERE tenant_id = get_user_tenant_id()))
    WITH CHECK (program_id IN (SELECT id FROM loyalty_programs WHERE tenant_id = get_user_tenant_id()));

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_loyalty_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_loyalty_programs_updated_at
    BEFORE UPDATE ON loyalty_programs
    FOR EACH ROW EXECUTE FUNCTION update_loyalty_updated_at();

CREATE TRIGGER update_loyalty_token_rules_updated_at
    BEFORE UPDATE ON loyalty_token_rules
    FOR EACH ROW EXECUTE FUNCTION update_loyalty_updated_at();

CREATE TRIGGER update_loyalty_rewards_updated_at
    BEFORE UPDATE ON loyalty_rewards
    FOR EACH ROW EXECUTE FUNCTION update_loyalty_updated_at();

CREATE TRIGGER update_loyalty_membership_plans_updated_at
    BEFORE UPDATE ON loyalty_membership_plans
    FOR EACH ROW EXECUTE FUNCTION update_loyalty_updated_at();

CREATE TRIGGER update_loyalty_balances_updated_at
    BEFORE UPDATE ON loyalty_balances
    FOR EACH ROW EXECUTE FUNCTION update_loyalty_updated_at();

CREATE TRIGGER update_loyalty_memberships_updated_at
    BEFORE UPDATE ON loyalty_memberships
    FOR EACH ROW EXECUTE FUNCTION update_loyalty_updated_at();

CREATE TRIGGER update_loyalty_message_templates_updated_at
    BEFORE UPDATE ON loyalty_message_templates
    FOR EACH ROW EXECUTE FUNCTION update_loyalty_updated_at();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Generate unique redemption code
CREATE OR REPLACE FUNCTION generate_redemption_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to award tokens to a lead
CREATE OR REPLACE FUNCTION award_loyalty_tokens(
    p_tenant_id UUID,
    p_lead_id UUID,
    p_tokens_amount INTEGER,
    p_source_type TEXT,
    p_source_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_expires_in_days INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_program_id UUID;
    v_balance_id UUID;
    v_new_balance INTEGER;
    v_transaction_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_expiry_days INTEGER;
BEGIN
    -- Get the loyalty program
    SELECT id, tokens_expiry_days INTO v_program_id, v_expiry_days
    FROM loyalty_programs
    WHERE tenant_id = p_tenant_id AND is_active = true AND tokens_enabled = true
    LIMIT 1;

    IF v_program_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Get or create balance
    SELECT id INTO v_balance_id
    FROM loyalty_balances
    WHERE lead_id = p_lead_id AND program_id = v_program_id;

    IF v_balance_id IS NULL THEN
        INSERT INTO loyalty_balances (tenant_id, lead_id, program_id, current_balance, total_earned)
        VALUES (p_tenant_id, p_lead_id, v_program_id, 0, 0)
        RETURNING id INTO v_balance_id;
    END IF;

    -- Calculate expiration
    IF p_expires_in_days IS NOT NULL THEN
        v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
    ELSIF v_expiry_days > 0 THEN
        v_expires_at := NOW() + (v_expiry_days || ' days')::INTERVAL;
    END IF;

    -- Update balance
    UPDATE loyalty_balances
    SET current_balance = current_balance + p_tokens_amount,
        total_earned = total_earned + p_tokens_amount,
        last_earn_at = NOW()
    WHERE id = v_balance_id
    RETURNING current_balance INTO v_new_balance;

    -- Create transaction
    INSERT INTO loyalty_transactions (
        balance_id, tenant_id, program_id, transaction_type, tokens, balance_after,
        source_type, source_id, description, expires_at
    ) VALUES (
        v_balance_id, p_tenant_id, v_program_id, 'earn', p_tokens_amount, v_new_balance,
        p_source_type, p_source_id, COALESCE(p_description, 'Tokens ganados'), v_expires_at
    )
    RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to redeem tokens for a reward
CREATE OR REPLACE FUNCTION redeem_loyalty_reward(
    p_tenant_id UUID,
    p_lead_id UUID,
    p_reward_id UUID
)
RETURNS TABLE(success BOOLEAN, redemption_code TEXT, error_message TEXT) AS $$
DECLARE
    v_program_id UUID;
    v_balance_id UUID;
    v_current_balance INTEGER;
    v_reward RECORD;
    v_new_balance INTEGER;
    v_code TEXT;
    v_valid_until TIMESTAMPTZ;
BEGIN
    -- Get reward details
    SELECT r.*, p.tenant_id as program_tenant_id
    INTO v_reward
    FROM loyalty_rewards r
    JOIN loyalty_programs p ON p.id = r.program_id
    WHERE r.id = p_reward_id AND r.is_active = true;

    IF v_reward IS NULL THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Recompensa no encontrada o no activa'::TEXT;
        RETURN;
    END IF;

    IF v_reward.program_tenant_id != p_tenant_id THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Recompensa no pertenece a este negocio'::TEXT;
        RETURN;
    END IF;

    -- Get balance
    SELECT id, current_balance INTO v_balance_id, v_current_balance
    FROM loyalty_balances
    WHERE lead_id = p_lead_id AND program_id = v_reward.program_id;

    IF v_balance_id IS NULL OR v_current_balance < v_reward.tokens_required THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Puntos insuficientes'::TEXT;
        RETURN;
    END IF;

    -- Generate unique code
    LOOP
        v_code := generate_redemption_code();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM loyalty_redemptions WHERE redemption_code = v_code);
    END LOOP;

    v_valid_until := NOW() + (v_reward.valid_days || ' days')::INTERVAL;

    -- Deduct tokens
    UPDATE loyalty_balances
    SET current_balance = current_balance - v_reward.tokens_required,
        total_spent = total_spent + v_reward.tokens_required,
        last_redeem_at = NOW()
    WHERE id = v_balance_id
    RETURNING current_balance INTO v_new_balance;

    -- Create transaction
    INSERT INTO loyalty_transactions (
        balance_id, tenant_id, program_id, transaction_type, tokens, balance_after,
        source_type, source_id, description
    ) VALUES (
        v_balance_id, p_tenant_id, v_reward.program_id, 'redeem', -v_reward.tokens_required, v_new_balance,
        'redemption', p_reward_id, 'Canje: ' || v_reward.reward_name
    );

    -- Create redemption
    INSERT INTO loyalty_redemptions (
        balance_id, reward_id, tenant_id, program_id, tokens_used, redemption_code,
        valid_until, reward_snapshot
    ) VALUES (
        v_balance_id, p_reward_id, p_tenant_id, v_reward.program_id, v_reward.tokens_required, v_code,
        v_valid_until, to_jsonb(v_reward)
    );

    RETURN QUERY SELECT true, v_code, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DEFAULT MESSAGE TEMPLATES FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_loyalty_templates(p_program_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Reactivation message
    INSERT INTO loyalty_message_templates (program_id, message_type, name, template_content, channels)
    VALUES (
        p_program_id,
        'reactivation',
        'Mensaje de reactivación',
        'Hola {nombre}, ha pasado tiempo desde tu última visita en {negocio}. Tu salud dental es importante para nosotros. Como paciente especial, te ofrecemos {oferta} en tu próxima cita. ¿Te gustaría agendar?',
        ARRAY['whatsapp']
    ) ON CONFLICT (program_id, message_type) DO NOTHING;

    -- Membership reminder
    INSERT INTO loyalty_message_templates (program_id, message_type, name, template_content, send_days_before, channels)
    VALUES (
        p_program_id,
        'membership_reminder',
        'Recordatorio de renovación',
        'Hola {nombre}, tu membresía {plan_nombre} vence en {dias} días. Renueva ahora para seguir disfrutando de tus beneficios exclusivos.',
        7,
        ARRAY['whatsapp']
    ) ON CONFLICT (program_id, message_type) DO NOTHING;

    -- Membership expired
    INSERT INTO loyalty_message_templates (program_id, message_type, name, template_content, channels)
    VALUES (
        p_program_id,
        'membership_expired',
        'Membresía vencida',
        'Hola {nombre}, tu membresía {plan_nombre} ha vencido. Te extrañamos. Renueva hoy y recupera todos tus beneficios.',
        ARRAY['whatsapp']
    ) ON CONFLICT (program_id, message_type) DO NOTHING;

    -- Tokens earned
    INSERT INTO loyalty_message_templates (program_id, message_type, name, template_content, channels)
    VALUES (
        p_program_id,
        'tokens_earned',
        'Puntos ganados',
        '¡Felicidades {nombre}! Acabas de ganar {tokens_ganados} {tokens_nombre} por tu visita. Tu balance actual es de {tokens_balance} {tokens_nombre}.',
        ARRAY['whatsapp']
    ) ON CONFLICT (program_id, message_type) DO NOTHING;

    -- Tokens expiring
    INSERT INTO loyalty_message_templates (program_id, message_type, name, template_content, send_days_before, channels)
    VALUES (
        p_program_id,
        'tokens_expiring',
        'Puntos por vencer',
        'Hola {nombre}, tienes {tokens_por_vencer} {tokens_nombre} que vencen en {dias} días. ¡Canjéalos antes de que expiren!',
        30,
        ARRAY['whatsapp']
    ) ON CONFLICT (program_id, message_type) DO NOTHING;

    -- Reward available
    INSERT INTO loyalty_message_templates (program_id, message_type, name, template_content, channels)
    VALUES (
        p_program_id,
        'reward_available',
        'Recompensa disponible',
        '¡{nombre}, ya puedes canjear una recompensa! Con tus {tokens_balance} {tokens_nombre} puedes obtener: {recompensa_nombre}. ¿Te gustaría canjearlo?',
        ARRAY['whatsapp']
    ) ON CONFLICT (program_id, message_type) DO NOTHING;

    -- Welcome
    INSERT INTO loyalty_message_templates (program_id, message_type, name, template_content, channels)
    VALUES (
        p_program_id,
        'welcome',
        'Bienvenida al programa',
        '¡Bienvenido al programa de lealtad de {negocio}, {nombre}! A partir de ahora ganarás {tokens_nombre} con cada visita que podrás canjear por increíbles recompensas.',
        ARRAY['whatsapp']
    ) ON CONFLICT (program_id, message_type) DO NOTHING;

    -- Birthday
    INSERT INTO loyalty_message_templates (program_id, message_type, name, template_content, channels)
    VALUES (
        p_program_id,
        'birthday',
        'Feliz cumpleaños',
        '¡Feliz cumpleaños {nombre}! Como regalo especial, te obsequiamos {tokens_regalo} {tokens_nombre}. ¡Que tengas un excelente día!',
        ARRAY['whatsapp']
    ) ON CONFLICT (program_id, message_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- AUTO-CREATE PROGRAM ON TENANT CREATION (Optional trigger)
-- =====================================================
-- Note: This can be enabled if you want automatic program creation
-- CREATE OR REPLACE FUNCTION auto_create_loyalty_program()
-- RETURNS TRIGGER AS $$
-- DECLARE
--     v_program_id UUID;
-- BEGIN
--     INSERT INTO loyalty_programs (tenant_id)
--     VALUES (NEW.id)
--     RETURNING id INTO v_program_id;
--
--     PERFORM create_default_loyalty_templates(v_program_id);
--
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

COMMENT ON TABLE loyalty_programs IS 'Configuración principal del programa de lealtad por tenant';
COMMENT ON TABLE loyalty_token_rules IS 'Reglas para ganar tokens (por compra, acciones, etc.)';
COMMENT ON TABLE loyalty_rewards IS 'Recompensas canjeables con tokens';
COMMENT ON TABLE loyalty_membership_plans IS 'Planes de membresía con sus beneficios';
COMMENT ON TABLE loyalty_balances IS 'Balance de tokens por lead/paciente';
COMMENT ON TABLE loyalty_transactions IS 'Historial de todas las transacciones de tokens';
COMMENT ON TABLE loyalty_memberships IS 'Membresías activas de pacientes';
COMMENT ON TABLE loyalty_redemptions IS 'Canjes de recompensas realizados';
COMMENT ON TABLE loyalty_reactivation_logs IS 'Registro de mensajes de reactivación enviados';
COMMENT ON TABLE loyalty_message_templates IS 'Plantillas de mensajes configurables por tipo';

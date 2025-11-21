-- ============================================
-- TIS TIS - Initial Database Schema
-- Version: 1.0
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. CORE TABLES
-- ============================================

-- Clients (businesses using TIS TIS)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Business info
    business_name VARCHAR(255),
    business_type VARCHAR(100), -- restaurant, clinic, factory
    contact_name VARCHAR(255),
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),

    -- Address
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_state VARCHAR(100),
    address_zip VARCHAR(20),

    -- Configuration
    vertical VARCHAR(50) DEFAULT 'restaurant',
    legacy_system VARCHAR(100),
    locations_count INT DEFAULT 1,
    employees_count VARCHAR(50),

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, active, suspended, cancelled
    onboarding_completed BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discovery Sessions (chat conversations)
CREATE TABLE IF NOT EXISTS public.discovery_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    -- Chat data
    initial_message TEXT,
    chat_messages JSONB DEFAULT '[]'::jsonb,

    -- Questionnaire answers
    questionnaire_answers JSONB DEFAULT '{}'::jsonb,

    -- AI Analysis result
    ai_analysis JSONB,

    -- Status
    status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, completed, abandoned

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Proposals (generated recommendations)
CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discovery_session_id UUID REFERENCES public.discovery_sessions(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    -- Recommendation
    recommended_plan VARCHAR(50) NOT NULL, -- starter, essentials, growth, scale
    recommended_addons TEXT[] DEFAULT '{}',
    recommended_especialidad VARCHAR(100),

    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    addons_price DECIMAL(10,2) DEFAULT 0,
    total_monthly_price DECIMAL(10,2) NOT NULL,
    activation_fee DECIMAL(10,2) DEFAULT 2500,

    -- ROI Projection
    roi_projection JSONB,

    -- AI reasoning
    reasoning TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, viewed, accepted, rejected, expired

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    viewed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Subscriptions (active plans)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES public.proposals(id),

    -- Stripe info
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    stripe_price_id VARCHAR(255),

    -- Plan details
    plan VARCHAR(50) NOT NULL,
    addons TEXT[] DEFAULT '{}',
    branches INT DEFAULT 1,

    -- Billing
    monthly_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'MXN',

    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, past_due, cancelled, paused

    -- Dates
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding Data (post-payment setup info)
CREATE TABLE IF NOT EXISTS public.onboarding_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    -- Business details
    business_name VARCHAR(255),
    business_description TEXT,

    -- Contact
    whatsapp_number VARCHAR(50),

    -- Operations
    operating_hours JSONB, -- {"mon": {"open": "09:00", "close": "18:00"}, ...}

    -- Legacy system credentials (encrypted reference)
    legacy_system_type VARCHAR(100),
    legacy_credentials_key VARCHAR(255), -- Reference to encrypted credentials

    -- Preferences
    notification_preferences JSONB DEFAULT '{"email": true, "whatsapp": true, "sms": false}'::jsonb,

    -- Status
    completed BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. PLANS & PRICING (Reference Data)
-- ============================================

CREATE TABLE IF NOT EXISTS public.plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Pricing
    monthly_price DECIMAL(10,2) NOT NULL,
    activation_fee DECIMAL(10,2) DEFAULT 2500,

    -- Stripe
    stripe_price_id VARCHAR(255),

    -- Limits
    max_locations INT DEFAULT 1,
    max_users INT DEFAULT 5,

    -- Features (JSON array of feature keys)
    features JSONB DEFAULT '[]'::jsonb,

    -- Display
    is_popular BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Addons
CREATE TABLE IF NOT EXISTS public.addons (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Pricing
    monthly_price DECIMAL(10,2) NOT NULL,

    -- Stripe
    stripe_price_id VARCHAR(255),

    -- Compatibility
    compatible_plans TEXT[] DEFAULT '{}',
    compatible_verticals TEXT[] DEFAULT '{}',

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. AUDIT & LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Action details
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,

    -- Data
    old_data JSONB,
    new_data JSONB,
    metadata JSONB,

    -- Request info
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. INDEXES
-- ============================================

-- Clients
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_vertical ON public.clients(vertical);

-- Discovery Sessions
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_client_id ON public.discovery_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_status ON public.discovery_sessions(status);
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_created_at ON public.discovery_sessions(created_at DESC);

-- Proposals
CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON public.proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_discovery_session_id ON public.proposals(discovery_session_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON public.subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_client_id ON public.audit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Clients: Users can only see their own client record
CREATE POLICY "Users can view own client" ON public.clients
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own client" ON public.clients
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own client" ON public.clients
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Discovery Sessions: Users can only see their own sessions
CREATE POLICY "Users can view own discovery sessions" ON public.discovery_sessions
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert own discovery sessions" ON public.discovery_sessions
    FOR INSERT WITH CHECK (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update own discovery sessions" ON public.discovery_sessions
    FOR UPDATE USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- Proposals: Users can only see their own proposals
CREATE POLICY "Users can view own proposals" ON public.proposals
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update own proposals" ON public.proposals
    FOR UPDATE USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- Subscriptions: Users can only see their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- Onboarding Data: Users can manage their own onboarding
CREATE POLICY "Users can view own onboarding" ON public.onboarding_data
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert own onboarding" ON public.onboarding_data
    FOR INSERT WITH CHECK (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update own onboarding" ON public.onboarding_data
    FOR UPDATE USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- Plans & Addons: Everyone can read (public pricing)
CREATE POLICY "Anyone can view plans" ON public.plans
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view addons" ON public.addons
    FOR SELECT USING (true);

-- Audit Logs: Users can only see their own logs
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- ============================================
-- 7. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_data_updated_at
    BEFORE UPDATE ON public.onboarding_data
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create client after user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.clients (user_id, contact_email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-create client on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 8. SEED DATA - Plans & Addons
-- ============================================

-- Insert default plans
INSERT INTO public.plans (id, name, description, monthly_price, activation_fee, max_locations, max_users, features, is_popular, display_order) VALUES
('starter', 'Starter', 'Para negocios que inician su transformación digital', 799, 2500, 1, 3,
 '["dashboard_basico", "chat_soporte", "reportes_semanales", "1_integracion"]'::jsonb,
 false, 1),

('essentials', 'Essentials', 'Todo lo necesario para operar eficientemente', 1499, 2500, 2, 10,
 '["dashboard_completo", "inventario_basico", "alertas_stock", "integraciones_ilimitadas", "soporte_prioritario", "reportes_diarios"]'::jsonb,
 true, 2),

('growth', 'Growth', 'Para negocios en expansión que necesitan escalar', 2999, 2500, 5, 25,
 '["todo_essentials", "prediccion_demanda", "multi_sucursal", "reportes_avanzados", "api_access", "analytics_avanzado"]'::jsonb,
 false, 3),

('scale', 'Scale', 'Solución enterprise con automatización completa', 5999, 5000, 999, 999,
 '["todo_growth", "automatizacion_completa", "soporte_dedicado", "sla_garantizado", "integraciones_custom", "white_label"]'::jsonb,
 false, 4)
ON CONFLICT (id) DO UPDATE SET
    monthly_price = EXCLUDED.monthly_price,
    features = EXCLUDED.features;

-- Insert default addons
INSERT INTO public.addons (id, name, description, monthly_price, compatible_plans, compatible_verticals) VALUES
('whatsapp-business', 'WhatsApp Business', 'Notificaciones y chat automatizado por WhatsApp', 299,
 '{"starter", "essentials", "growth", "scale"}', '{"restaurant", "clinic", "factory"}'),

('advanced-reports', 'Reportes Avanzados', 'Analytics detallado y reportes personalizados', 499,
 '{"starter", "essentials"}', '{"restaurant", "clinic", "factory"}'),

('multi-location', 'Multi-Sucursal', 'Gestión de múltiples ubicaciones', 799,
 '{"starter", "essentials"}', '{"restaurant", "clinic", "factory"}'),

('ai-predictions', 'Predicciones IA', 'Predicción de demanda e inventario inteligente', 999,
 '{"essentials", "growth"}', '{"restaurant", "factory"}'),

('telemedicine', 'Telemedicina', 'Consultas por videollamada integradas', 599,
 '{"essentials", "growth", "scale"}', '{"clinic"}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Function to get client by user_id
CREATE OR REPLACE FUNCTION public.get_client_by_user(p_user_id UUID)
RETURNS public.clients AS $$
    SELECT * FROM public.clients WHERE user_id = p_user_id LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to get active subscription
CREATE OR REPLACE FUNCTION public.get_active_subscription(p_client_id UUID)
RETURNS public.subscriptions AS $$
    SELECT * FROM public.subscriptions
    WHERE client_id = p_client_id AND status = 'active'
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- DONE!
-- ============================================
-- Next steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Enable Email Auth in Supabase Dashboard
-- 3. Configure Stripe webhook endpoint
-- ============================================

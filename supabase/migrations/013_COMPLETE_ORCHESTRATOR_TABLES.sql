-- =====================================================
-- TIS TIS PLATFORM - TABLAS DEL ORQUESTADOR COMPLETAS
-- Version: 1.0
-- Migration: 013_COMPLETE_ORCHESTRATOR_TABLES.sql
-- Date: December 11, 2024
--
-- PURPOSE: Este SQL agrega las tablas del orquestador TIS TIS
-- que son necesarias ANTES de ejecutar 012_CONSOLIDATED_SCHEMA.sql
-- porque 012 tiene REFERENCES a estas tablas.
--
-- ORDEN DE EJECUCIÓN:
-- 1. PRIMERO ejecutar este archivo (013)
-- 2. LUEGO ejecutar 012_CONSOLIDATED_SCHEMA.sql
--
-- TABLAS QUE CREA:
-- - clients (empresas que usan TIS TIS)
-- - discovery_sessions (conversaciones de discovery)
-- - proposals (propuestas generadas)
-- - subscriptions (suscripciones Stripe)
-- - onboarding_data (datos post-pago)
-- - plans (catálogo de planes)
-- - addons (catálogo de addons)
-- - audit_logs (logs de auditoría)
-- =====================================================

-- =====================================================
-- 1. EXTENSIONES
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- 2. FUNCIÓN HELPER PARA UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. TABLAS DEL ORQUESTADOR TIS TIS
-- =====================================================

-- 3.1: Clients (Negocios que usan TIS TIS)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Usuario vinculado (owner del client)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Vinculación con tenant (después de provisioning)
    tenant_id UUID, -- FK se agregará después de crear tenants

    -- Información del negocio
    business_name VARCHAR(255),
    business_type VARCHAR(100), -- restaurant, clinic, factory
    contact_name VARCHAR(255),
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),

    -- Dirección
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_state VARCHAR(100),
    address_zip VARCHAR(20),
    address_country VARCHAR(50) DEFAULT 'Mexico',

    -- Configuración
    vertical VARCHAR(50) DEFAULT 'services' CHECK (vertical IN (
        'dental', 'restaurant', 'pharmacy', 'retail', 'medical', 'services', 'other'
    )),
    legacy_system VARCHAR(100),
    locations_count INT DEFAULT 1,
    employees_count VARCHAR(50),

    -- Estado
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'discovery', 'proposal', 'checkout', 'active', 'suspended', 'cancelled'
    )),
    onboarding_completed BOOLEAN DEFAULT FALSE,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para clients
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_vertical ON public.clients(vertical);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(contact_email);

-- 3.2: Discovery Sessions (Conversaciones de discovery)
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
    ai_recommended_plan VARCHAR(50),
    ai_recommended_vertical VARCHAR(50),
    ai_confidence_score DECIMAL(3, 2),

    -- Estado
    status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN (
        'in_progress', 'completed', 'abandoned', 'expired'
    )),

    -- Metadata
    browser_info JSONB DEFAULT '{}',
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Índices para discovery_sessions
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_client_id ON public.discovery_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_status ON public.discovery_sessions(status);
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_created_at ON public.discovery_sessions(created_at DESC);

-- 3.3: Proposals (Propuestas generadas)
CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discovery_session_id UUID REFERENCES public.discovery_sessions(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    -- Recomendación
    recommended_plan VARCHAR(50) NOT NULL CHECK (recommended_plan IN (
        'starter', 'essentials', 'growth', 'scale'
    )),
    recommended_addons TEXT[] DEFAULT '{}',
    recommended_vertical VARCHAR(50) CHECK (recommended_vertical IN (
        'dental', 'restaurant', 'pharmacy', 'retail', 'medical', 'services', 'other'
    )),

    -- Pricing
    base_price DECIMAL(10,2) NOT NULL,
    addons_price DECIMAL(10,2) DEFAULT 0,
    branches_price DECIMAL(10,2) DEFAULT 0,
    total_monthly_price DECIMAL(10,2) NOT NULL,
    activation_fee DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'MXN',

    -- ROI Projection
    roi_projection JSONB,
    payback_months INTEGER,
    annual_savings DECIMAL(12,2),

    -- AI reasoning
    reasoning TEXT,
    confidence_score DECIMAL(3, 2),

    -- Estado
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'viewed', 'accepted', 'rejected', 'expired', 'converted'
    )),

    -- Tracking
    view_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    viewed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para proposals
CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON public.proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_discovery_session_id ON public.proposals(discovery_session_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_recommended_plan ON public.proposals(recommended_plan);

-- 3.4: Plans (Catálogo de planes TIS TIS)
CREATE TABLE IF NOT EXISTS public.plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    tagline VARCHAR(255),

    -- Pricing (MXN)
    monthly_price DECIMAL(10,2) NOT NULL,
    annual_price DECIMAL(10,2), -- Precio anual con descuento
    activation_fee DECIMAL(10,2) DEFAULT 0,
    price_per_extra_branch DECIMAL(10,2) DEFAULT 1500, -- $1,500 MXN por sucursal extra

    -- Stripe
    stripe_price_id VARCHAR(255),
    stripe_annual_price_id VARCHAR(255),
    stripe_product_id VARCHAR(255),

    -- Limits
    max_locations INT DEFAULT 1,
    max_users INT DEFAULT 5,
    max_conversations_per_month INT DEFAULT 500,
    max_ai_queries_per_month INT,

    -- Features (JSON array of feature keys)
    features JSONB DEFAULT '[]'::jsonb,
    features_highlight JSONB DEFAULT '[]'::jsonb, -- Features destacadas para UI

    -- Módulos incluidos
    modules_included TEXT[] DEFAULT '{}',

    -- Display
    is_popular BOOLEAN DEFAULT FALSE,
    is_recommended BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5: Addons (Catálogo de addons)
CREATE TABLE IF NOT EXISTS public.addons (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    short_description VARCHAR(255),

    -- Pricing
    monthly_price DECIMAL(10,2) NOT NULL,
    setup_fee DECIMAL(10,2) DEFAULT 0,

    -- Stripe
    stripe_price_id VARCHAR(255),
    stripe_product_id VARCHAR(255),

    -- Compatibility
    compatible_plans TEXT[] DEFAULT '{}',
    compatible_verticals TEXT[] DEFAULT '{}',
    requires_addons TEXT[] DEFAULT '{}', -- Addons que requiere

    -- Features
    features JSONB DEFAULT '[]'::jsonb,

    -- Display
    icon VARCHAR(50),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.6: Subscriptions (Suscripciones activas)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,

    -- Stripe info
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_price_id VARCHAR(255),

    -- Plan details
    plan VARCHAR(50) NOT NULL CHECK (plan IN (
        'starter', 'essentials', 'growth', 'scale'
    )),
    addons TEXT[] DEFAULT '{}',
    branches INT DEFAULT 1,

    -- Vertical del cliente
    vertical VARCHAR(50),

    -- Billing
    monthly_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'MXN',
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN (
        'monthly', 'annual'
    )),

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'active', 'past_due', 'paused', 'cancelled', 'trialing'
    )),

    -- Dates
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON public.subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON public.subscriptions(plan);

-- 3.7: Onboarding Data (Datos post-pago)
CREATE TABLE IF NOT EXISTS public.onboarding_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

    -- Business details
    business_name VARCHAR(255),
    business_description TEXT,
    business_logo_url TEXT,

    -- Contact
    whatsapp_number VARCHAR(50),
    whatsapp_verified BOOLEAN DEFAULT FALSE,

    -- Operations
    operating_hours JSONB DEFAULT '{}'::jsonb,

    -- Legacy system credentials (encrypted reference)
    legacy_system_type VARCHAR(100),
    legacy_credentials_key VARCHAR(255), -- Reference to encrypted credentials

    -- Preferences
    notification_preferences JSONB DEFAULT '{"email": true, "whatsapp": true, "sms": false}'::jsonb,
    language VARCHAR(10) DEFAULT 'es',
    timezone VARCHAR(50) DEFAULT 'America/Mexico_City',

    -- Steps completed
    steps_completed JSONB DEFAULT '[]'::jsonb,
    current_step VARCHAR(50) DEFAULT 'welcome',

    -- Status
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Único por client
    UNIQUE(client_id)
);

-- Índice para onboarding_data
CREATE INDEX IF NOT EXISTS idx_onboarding_data_client_id ON public.onboarding_data(client_id);

-- 3.8: Audit Logs (Logs de auditoría)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Contexto
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    tenant_id UUID, -- FK se agregará después
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    staff_id UUID, -- FK se agregará después

    -- Action details
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,

    -- Data
    old_data JSONB,
    new_data JSONB,
    metadata JSONB DEFAULT '{}',

    -- Request info
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100),

    -- Resultado
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN (
        'success', 'failure', 'error'
    )),
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_client_id ON public.audit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Clients: Users can only see their own client record
DROP POLICY IF EXISTS "Users can view own client" ON public.clients;
CREATE POLICY "Users can view own client" ON public.clients
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own client" ON public.clients;
CREATE POLICY "Users can update own client" ON public.clients
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own client" ON public.clients;
CREATE POLICY "Users can insert own client" ON public.clients
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Discovery Sessions
DROP POLICY IF EXISTS "Users can view own discovery sessions" ON public.discovery_sessions;
CREATE POLICY "Users can view own discovery sessions" ON public.discovery_sessions
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Anyone can insert discovery sessions" ON public.discovery_sessions;
CREATE POLICY "Anyone can insert discovery sessions" ON public.discovery_sessions
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own discovery sessions" ON public.discovery_sessions;
CREATE POLICY "Users can update own discovery sessions" ON public.discovery_sessions
    FOR UPDATE USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
        OR client_id IS NULL
    );

-- Proposals
DROP POLICY IF EXISTS "Users can view own proposals" ON public.proposals;
CREATE POLICY "Users can view own proposals" ON public.proposals
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update own proposals" ON public.proposals;
CREATE POLICY "Users can update own proposals" ON public.proposals
    FOR UPDATE USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- Subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- Onboarding Data
DROP POLICY IF EXISTS "Users can view own onboarding" ON public.onboarding_data;
CREATE POLICY "Users can view own onboarding" ON public.onboarding_data
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can insert own onboarding" ON public.onboarding_data;
CREATE POLICY "Users can insert own onboarding" ON public.onboarding_data
    FOR INSERT WITH CHECK (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update own onboarding" ON public.onboarding_data;
CREATE POLICY "Users can update own onboarding" ON public.onboarding_data
    FOR UPDATE USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- Plans & Addons: Everyone can read (public pricing)
DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
CREATE POLICY "Anyone can view plans" ON public.plans
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view addons" ON public.addons;
CREATE POLICY "Anyone can view addons" ON public.addons
    FOR SELECT USING (true);

-- Audit Logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- Service role full access (para APIs)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN VALUES
        ('clients'), ('discovery_sessions'), ('proposals'),
        ('subscriptions'), ('onboarding_data'), ('plans'),
        ('addons'), ('audit_logs')
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS "Service role full access %I" ON public.%I;
            CREATE POLICY "Service role full access %I" ON public.%I
            FOR ALL TO service_role USING (true) WITH CHECK (true);
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END $$;

-- =====================================================
-- 5. TRIGGERS DE UPDATED_AT
-- =====================================================

CREATE OR REPLACE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_discovery_sessions_updated_at
    BEFORE UPDATE ON public.discovery_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_proposals_updated_at
    BEFORE UPDATE ON public.proposals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_onboarding_data_updated_at
    BEFORE UPDATE ON public.onboarding_data
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON public.plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_addons_updated_at
    BEFORE UPDATE ON public.addons
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 6. SEED DATA - PLANES TIS TIS (Precios Correctos)
-- =====================================================

INSERT INTO public.plans (
    id, name, description, tagline,
    monthly_price, annual_price, activation_fee, price_per_extra_branch,
    max_locations, max_users, max_conversations_per_month,
    features, features_highlight, modules_included,
    is_popular, is_recommended, display_order
) VALUES
    (
        'starter',
        'Starter',
        'Para negocios que inician su transformación digital con IA',
        'Empieza a automatizar hoy',
        3490, 34900, 0, 1500,
        1, 3, 500,
        '["dashboard_basico", "asistente_ia_24_7", "chat_whatsapp", "reportes_semanales", "1_integracion", "soporte_email"]'::jsonb,
        '["Asistente IA 24/7", "500 conversaciones/mes", "1 sucursal", "Dashboard básico"]'::jsonb,
        '{"leads", "appointments", "conversations", "dashboard"}'::text[],
        false, false, 1
    ),
    (
        'essentials',
        'Essentials',
        'Todo lo necesario para operar eficientemente con automatización completa',
        'La opción más popular',
        7490, 74900, 0, 1500,
        2, 10, 2000,
        '["dashboard_completo", "asistente_ia_24_7", "whatsapp_multicanal", "inventario_basico", "alertas_stock", "integraciones_ilimitadas", "soporte_prioritario", "reportes_diarios", "analytics_basico"]'::jsonb,
        '["Hasta 2,000 conversaciones/mes", "Dashboard completo", "2 sucursales incluidas", "Soporte prioritario", "Integraciones ilimitadas"]'::jsonb,
        '{"leads", "appointments", "patients", "conversations", "quotes", "analytics", "dashboard"}'::text[],
        true, true, 2
    ),
    (
        'growth',
        'Growth',
        'Para negocios en expansión que necesitan escalar sin límites',
        'Escala tu negocio',
        12490, 124900, 0, 1500,
        5, 25, 10000,
        '["todo_essentials", "conversaciones_ilimitadas", "prediccion_demanda", "multi_sucursal", "reportes_avanzados", "api_access", "analytics_avanzado", "automatizaciones_custom", "soporte_24_7"]'::jsonb,
        '["Conversaciones ilimitadas", "Multi-canal (WhatsApp, Web, Email)", "5 sucursales incluidas", "Analytics avanzado", "API Access", "Soporte 24/7"]'::jsonb,
        '{"leads", "appointments", "patients", "clinical_history", "conversations", "quotes", "analytics", "inventory", "dashboard"}'::text[],
        false, false, 3
    ),
    (
        'scale',
        'Scale',
        'Solución enterprise con automatización completa y equipo dedicado',
        'Para grandes operaciones',
        19990, 199900, 0, 1000,
        999, 999, -1, -- -1 = ilimitado
        '["todo_growth", "ia_entrenada_personalizada", "integraciones_enterprise", "equipo_dedicado", "sla_garantizado", "white_label", "onboarding_premium", "reportes_custom", "data_export"]'::jsonb,
        '["Todo ilimitado", "IA entrenada con tus datos", "Equipo dedicado", "SLA garantizado", "White label disponible"]'::jsonb,
        '{"leads", "appointments", "patients", "clinical_history", "conversations", "quotes", "analytics", "inventory", "reports", "api", "dashboard"}'::text[],
        false, false, 4
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    tagline = EXCLUDED.tagline,
    monthly_price = EXCLUDED.monthly_price,
    annual_price = EXCLUDED.annual_price,
    activation_fee = EXCLUDED.activation_fee,
    price_per_extra_branch = EXCLUDED.price_per_extra_branch,
    max_locations = EXCLUDED.max_locations,
    max_users = EXCLUDED.max_users,
    max_conversations_per_month = EXCLUDED.max_conversations_per_month,
    features = EXCLUDED.features,
    features_highlight = EXCLUDED.features_highlight,
    modules_included = EXCLUDED.modules_included,
    is_popular = EXCLUDED.is_popular,
    is_recommended = EXCLUDED.is_recommended,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- =====================================================
-- 7. SEED DATA - ADDONS TIS TIS
-- =====================================================

INSERT INTO public.addons (
    id, name, description, short_description,
    monthly_price, setup_fee,
    compatible_plans, compatible_verticals,
    features, icon, display_order, is_featured
) VALUES
    (
        'whatsapp-business-extra',
        'WhatsApp Business Extra',
        'Número adicional de WhatsApp Business para campañas o sucursales',
        'Número WhatsApp adicional',
        1490, 0,
        '{"starter", "essentials", "growth", "scale"}'::text[],
        '{"dental", "restaurant", "medical", "services", "retail", "pharmacy"}'::text[],
        '["numero_whatsapp_adicional", "configuracion_automatica", "qr_propio"]'::jsonb,
        'message-circle',
        1, true
    ),
    (
        'advanced-analytics',
        'Analytics Avanzado',
        'Dashboards personalizados, reportes automatizados y predicciones con IA',
        'Reportes y predicciones IA',
        1990, 0,
        '{"starter", "essentials"}'::text[],
        '{"dental", "restaurant", "medical", "services", "retail", "pharmacy"}'::text[],
        '["dashboards_custom", "reportes_automaticos", "predicciones_ia", "export_data"]'::jsonb,
        'bar-chart-2',
        2, true
    ),
    (
        'multi-location',
        'Multi-Sucursal',
        'Gestión centralizada de múltiples ubicaciones con reportes consolidados',
        'Gestión de sucursales',
        2490, 0,
        '{"starter", "essentials"}'::text[],
        '{"dental", "restaurant", "medical", "services", "retail", "pharmacy"}'::text[],
        '["hasta_5_sucursales", "reportes_consolidados", "gestion_centralizada", "permisos_por_sucursal"]'::jsonb,
        'map-pin',
        3, false
    ),
    (
        'ai-training',
        'Entrenamiento IA Personalizado',
        'Entrena la IA con tus datos, FAQs personalizadas y respuestas específicas',
        'IA entrenada para tu negocio',
        3990, 4990,
        '{"essentials", "growth"}'::text[],
        '{"dental", "restaurant", "medical", "services"}'::text[],
        '["entrenamiento_datos_propios", "faqs_personalizadas", "tono_de_voz_custom", "actualizaciones_mensuales"]'::jsonb,
        'brain',
        4, true
    ),
    (
        'telemedicine',
        'Telemedicina',
        'Consultas por videollamada integradas con agenda y recordatorios',
        'Videoconsultas integradas',
        1490, 0,
        '{"essentials", "growth", "scale"}'::text[],
        '{"dental", "medical"}'::text[],
        '["videollamadas_hd", "sala_espera_virtual", "grabacion_opcional", "integracion_expediente"]'::jsonb,
        'video',
        5, false
    ),
    (
        'inventory-pro',
        'Inventario Pro',
        'Gestión avanzada de inventario con alertas, predicción y proveedores',
        'Control total de inventario',
        1990, 0,
        '{"starter", "essentials", "growth"}'::text[],
        '{"restaurant", "pharmacy", "retail"}'::text[],
        '["alertas_stock", "prediccion_demanda", "gestion_proveedores", "ordenes_automaticas"]'::jsonb,
        'package',
        6, false
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    short_description = EXCLUDED.short_description,
    monthly_price = EXCLUDED.monthly_price,
    setup_fee = EXCLUDED.setup_fee,
    compatible_plans = EXCLUDED.compatible_plans,
    compatible_verticals = EXCLUDED.compatible_verticals,
    features = EXCLUDED.features,
    icon = EXCLUDED.icon,
    display_order = EXCLUDED.display_order,
    is_featured = EXCLUDED.is_featured,
    updated_at = NOW();

-- =====================================================
-- 8. FUNCIÓN HELPER - Get or Create Lead (para n8n)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_or_create_lead(
    p_tenant_id UUID,
    p_phone TEXT,
    p_source TEXT DEFAULT 'whatsapp',
    p_external_id TEXT DEFAULT NULL,
    p_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_lead_id UUID;
    v_first_name TEXT;
    v_last_name TEXT;
BEGIN
    -- Normalizar teléfono
    p_phone := regexp_replace(p_phone, '[^0-9+]', '', 'g');

    -- Buscar lead existente
    SELECT id INTO v_lead_id
    FROM public.leads
    WHERE tenant_id = p_tenant_id
    AND (phone = p_phone OR phone_normalized = p_phone)
    LIMIT 1;

    -- Si no existe, crear
    IF v_lead_id IS NULL THEN
        -- Parsear nombre si viene
        IF p_name IS NOT NULL THEN
            v_first_name := split_part(p_name, ' ', 1);
            v_last_name := CASE
                WHEN position(' ' in p_name) > 0
                THEN substring(p_name from position(' ' in p_name) + 1)
                ELSE NULL
            END;
        END IF;

        INSERT INTO public.leads (
            tenant_id,
            phone,
            phone_normalized,
            first_name,
            last_name,
            source,
            status,
            classification,
            score
        ) VALUES (
            p_tenant_id,
            p_phone,
            p_phone,
            v_first_name,
            v_last_name,
            COALESCE(p_source, 'whatsapp'),
            'new',
            'warm',
            50
        )
        RETURNING id INTO v_lead_id;
    END IF;

    RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. FUNCIÓN - Provision Tenant (para auto-provisioning)
-- =====================================================

CREATE OR REPLACE FUNCTION public.provision_tenant_for_client(
    p_client_id UUID,
    p_vertical TEXT DEFAULT 'services',
    p_plan TEXT DEFAULT 'essentials',
    p_branches_count INT DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    v_client RECORD;
    v_tenant_id UUID;
    v_branch_id UUID;
    v_slug TEXT;
    v_result JSONB;
BEGIN
    -- Obtener datos del client
    SELECT * INTO v_client
    FROM public.clients
    WHERE id = p_client_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Client not found'
        );
    END IF;

    -- Generar slug único
    v_slug := lower(regexp_replace(
        COALESCE(v_client.business_name, 'tenant-' || substring(p_client_id::text, 1, 8)),
        '[^a-zA-Z0-9]+', '-', 'g'
    ));

    -- Asegurar slug único
    WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) LOOP
        v_slug := v_slug || '-' || substring(md5(random()::text), 1, 4);
    END LOOP;

    -- Crear tenant
    INSERT INTO public.tenants (
        client_id,
        name,
        slug,
        vertical,
        plan,
        primary_contact_name,
        primary_contact_email,
        primary_contact_phone,
        status,
        plan_started_at
    ) VALUES (
        p_client_id,
        COALESCE(v_client.business_name, 'Mi Negocio'),
        v_slug,
        p_vertical,
        p_plan,
        v_client.contact_name,
        v_client.contact_email,
        v_client.contact_phone,
        'active',
        NOW()
    )
    RETURNING id INTO v_tenant_id;

    -- Crear branch principal
    INSERT INTO public.branches (
        tenant_id,
        name,
        slug,
        city,
        state,
        phone,
        is_headquarters,
        is_active
    ) VALUES (
        v_tenant_id,
        'Sucursal Principal',
        'principal',
        COALESCE(v_client.address_city, 'Ciudad'),
        COALESCE(v_client.address_state, 'Estado'),
        v_client.contact_phone,
        true,
        true
    )
    RETURNING id INTO v_branch_id;

    -- Actualizar client con tenant_id
    UPDATE public.clients
    SET tenant_id = v_tenant_id,
        status = 'active',
        updated_at = NOW()
    WHERE id = p_client_id;

    -- Retornar resultado
    v_result := jsonb_build_object(
        'success', true,
        'tenant_id', v_tenant_id,
        'tenant_slug', v_slug,
        'branch_id', v_branch_id,
        'vertical', p_vertical,
        'plan', p_plan
    );

    -- Log de auditoría
    INSERT INTO public.audit_logs (
        client_id, tenant_id, action, entity_type, entity_id, new_data
    ) VALUES (
        p_client_id, v_tenant_id, 'tenant_provisioned', 'tenant', v_tenant_id, v_result
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIN
-- =====================================================

SELECT '
=====================================================
TABLAS DEL ORQUESTADOR CREADAS EXITOSAMENTE
=====================================================

TABLAS CREADAS:
- clients (negocios que usan TIS TIS)
- discovery_sessions (conversaciones discovery)
- proposals (propuestas generadas)
- subscriptions (suscripciones Stripe)
- onboarding_data (datos post-pago)
- plans (catálogo de planes)
- addons (catálogo de addons)
- audit_logs (logs de auditoría)

PLANES CON PRECIOS CORRECTOS:
- Starter: $3,490 MXN/mes
- Essentials: $7,490 MXN/mes (más popular)
- Growth: $12,490 MXN/mes
- Scale: $19,990 MXN/mes
- Sucursal extra: $1,500 MXN/mes

FUNCIONES HELPER:
- get_or_create_lead(tenant_id, phone, source, external_id, name)
- provision_tenant_for_client(client_id, vertical, plan, branches)

PRÓXIMO PASO:
Ahora ejecutar 012_CONSOLIDATED_SCHEMA.sql
=====================================================
' as resultado;

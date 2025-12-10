-- ============================================
-- TIS TIS - Assembly Engine Tables
-- Version: 1.0
-- Migration: 010_assembly_engine.sql
-- Purpose: Component Registry, Deployment Log, Feature Flags
-- ============================================

-- ============================================
-- 1. COMPONENT REGISTRY TABLE
-- The catalog of all available modular components
-- ============================================

CREATE TABLE IF NOT EXISTS public.component_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identification
    component_name TEXT NOT NULL UNIQUE,
    component_display_name TEXT NOT NULL,
    component_description TEXT NOT NULL,

    -- Classification
    component_type TEXT NOT NULL CHECK (component_type IN (
        'core',           -- Always included
        'plan_feature',   -- Based on plan
        'vertical_module',-- Based on vertical
        'addon',          -- Extra purchase
        'integration'     -- Legacy system sync
    )),

    -- Applicability filters
    vertical_applicable TEXT[], -- NULL = all verticals
    min_plan_required TEXT CHECK (min_plan_required IN (
        'starter', 'essentials', 'growth', 'scale', 'enterprise'
    )),

    -- Files and dependencies
    workflow_file TEXT, -- Path to n8n workflow
    dependencies TEXT[] DEFAULT '{}',

    -- Configuration
    config_template JSONB NOT NULL DEFAULT '{
        "required_vars": [],
        "optional_vars": []
    }'::jsonb,

    -- Feature flags this component enables
    feature_flags TEXT[] DEFAULT '{}',

    -- Dashboard
    dashboard_widgets JSONB DEFAULT '[]'::jsonb,

    -- Setup
    setup_instructions TEXT,
    estimated_setup_minutes INTEGER DEFAULT 5,

    -- State
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deprecated BOOLEAN NOT NULL DEFAULT false,

    -- Deployment order (lower = deploy first)
    deployment_order INTEGER DEFAULT 100,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. DEPLOYMENT LOG TABLE
-- Tracks all deployment plans generated and executed
-- ============================================

CREATE TABLE IF NOT EXISTS public.deployment_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- References
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES public.proposals(id),
    subscription_id UUID REFERENCES public.subscriptions(id),

    -- The deployment plan (full JSON structure)
    deployment_plan JSONB NOT NULL,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Waiting to be executed
        'in_progress',  -- Currently being deployed
        'completed',    -- Successfully deployed
        'failed',       -- Deployment failed
        'cancelled',    -- Cancelled by user/system
        'partial'       -- Partially completed
    )),

    -- Progress
    components_count INTEGER NOT NULL DEFAULT 0,
    components_completed INTEGER DEFAULT 0,
    current_step INTEGER DEFAULT 0,

    -- Timing
    estimated_duration_minutes INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Error tracking
    error_message TEXT,
    error_details JSONB,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. CLIENT FEATURE FLAGS TABLE
-- Per-client feature flags
-- ============================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    -- Flag info
    feature_key TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,

    -- Source component that provided this flag
    source_component TEXT,

    -- Override reason if manually changed
    override_reason TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint per client
    UNIQUE(client_id, feature_key)
);

-- ============================================
-- 4. NOTIFICATION QUEUE TABLE
-- For internal team notifications
-- ============================================

CREATE TABLE IF NOT EXISTS public.notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Type of notification
    type TEXT NOT NULL,

    -- Recipient
    recipient_type TEXT NOT NULL DEFAULT 'internal', -- internal, client
    recipient_id TEXT NOT NULL,

    -- Payload
    payload JSONB NOT NULL,

    -- Priority
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN (
        'low', 'normal', 'high', 'urgent'
    )),

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'failed', 'cancelled'
    )),

    -- Processing
    sent_at TIMESTAMPTZ,
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5. INDEXES
-- ============================================

-- Component registry indexes
CREATE INDEX IF NOT EXISTS idx_component_registry_type ON public.component_registry(component_type);
CREATE INDEX IF NOT EXISTS idx_component_registry_active ON public.component_registry(is_active);
CREATE INDEX IF NOT EXISTS idx_component_registry_vertical ON public.component_registry USING GIN(vertical_applicable);

-- Deployment log indexes
CREATE INDEX IF NOT EXISTS idx_deployment_log_client_id ON public.deployment_log(client_id);
CREATE INDEX IF NOT EXISTS idx_deployment_log_status ON public.deployment_log(status);
CREATE INDEX IF NOT EXISTS idx_deployment_log_created_at ON public.deployment_log(created_at DESC);

-- Feature flags indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_client_id ON public.feature_flags(client_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(feature_key);

-- Notification queue indexes
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON public.notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_priority ON public.notification_queue(priority);

-- ============================================
-- 6. RLS POLICIES
-- ============================================

ALTER TABLE public.component_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Component registry: Public read (anyone can see available components)
CREATE POLICY "Anyone can view active components" ON public.component_registry
    FOR SELECT USING (is_active = true);

-- Deployment log: Users can only see their own deployments
CREATE POLICY "Users can view own deployments" ON public.deployment_log
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- Feature flags: Users can see their own flags
CREATE POLICY "Users can view own feature flags" ON public.feature_flags
    FOR SELECT USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- ============================================
-- 7. TRIGGERS
-- ============================================

CREATE TRIGGER update_component_registry_updated_at
    BEFORE UPDATE ON public.component_registry
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deployment_log_updated_at
    BEFORE UPDATE ON public.deployment_log
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON public.feature_flags
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 8. SEED DATA - CORE COMPONENTS
-- ============================================

INSERT INTO public.component_registry (
    component_name, component_display_name, component_description,
    component_type, vertical_applicable, min_plan_required,
    workflow_file, dependencies, config_template, feature_flags,
    dashboard_widgets, setup_instructions, estimated_setup_minutes,
    deployment_order
) VALUES
-- CORE COMPONENTS (always included)
(
    'auth_system',
    'Sistema de Autenticación',
    'Manejo de login, sesiones, permisos y JWT tokens',
    'core', NULL, NULL,
    'core/auth_system.n8n.json',
    '{}',
    '{"required_vars": ["CLIENT_ID", "SUPABASE_URL", "SUPABASE_ANON_KEY"], "optional_vars": ["SESSION_DURATION_HOURS"]}'::jsonb,
    '{"auth_enabled"}',
    '[]'::jsonb,
    'Configuración automática',
    0,
    10
),
(
    'notification_engine',
    'Motor de Notificaciones',
    'Sistema unificado para WhatsApp, Email y SMS',
    'core', NULL, NULL,
    'core/notification_engine.n8n.json',
    '{}',
    '{"required_vars": ["CLIENT_ID", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"], "optional_vars": ["SENDGRID_API_KEY"]}'::jsonb,
    '{"notifications_enabled", "whatsapp_enabled", "email_enabled"}',
    '[{"widget_id": "notifications_sent", "widget_name": "Notificaciones Enviadas", "widget_type": "counter", "size": "small"}]'::jsonb,
    'Configurar credenciales de Twilio',
    10,
    20
),
(
    'dashboard_sync',
    'Sincronización de Dashboard',
    'Actualiza métricas y datos del dashboard en tiempo real',
    'core', NULL, NULL,
    'core/dashboard_sync.n8n.json',
    '{"auth_system"}',
    '{"required_vars": ["CLIENT_ID"], "optional_vars": ["SYNC_INTERVAL_MINUTES"]}'::jsonb,
    '{"dashboard_enabled"}',
    '[]'::jsonb,
    'Configuración automática',
    0,
    30
),
-- PLAN FEATURES - Starter
(
    'chatbot_basic',
    'Chatbot Básico',
    'Chatbot con respuestas predefinidas para WhatsApp y Web',
    'plan_feature', NULL, 'starter',
    'features/chatbot_basic.n8n.json',
    '{"notification_engine"}',
    '{"required_vars": ["CLIENT_ID", "BUSINESS_NAME"], "optional_vars": ["WELCOME_MESSAGE"]}'::jsonb,
    '{"chatbot_enabled"}',
    '[]'::jsonb,
    'Configurar mensajes de bienvenida',
    10,
    100
),
(
    'alerts_basic',
    'Alertas Básicas',
    'Alertas de stock bajo y eventos importantes',
    'plan_feature', NULL, 'starter',
    'features/alerts_basic.n8n.json',
    '{"notification_engine"}',
    '{"required_vars": ["CLIENT_ID"], "optional_vars": ["ALERT_RECIPIENTS"]}'::jsonb,
    '{"alerts_enabled"}',
    '[]'::jsonb,
    'Configurar destinatarios de alertas',
    5,
    110
),
-- PLAN FEATURES - Essentials
(
    'crm_basic',
    'CRM Básico',
    'Gestión básica de clientes y leads',
    'plan_feature', NULL, 'essentials',
    'features/crm_basic.n8n.json',
    '{"notification_engine"}',
    '{"required_vars": ["CLIENT_ID"], "optional_vars": ["LEAD_SOURCES"]}'::jsonb,
    '{"crm_enabled"}',
    '[]'::jsonb,
    'Configurar fuentes de leads',
    10,
    120
),
-- PLAN FEATURES - Growth
(
    'chatbot_ai',
    'Chatbot con IA',
    'Chatbot conversacional con Claude API',
    'plan_feature', NULL, 'growth',
    'features/chatbot_ai.n8n.json',
    '{"chatbot_basic", "notification_engine"}',
    '{"required_vars": ["CLIENT_ID", "ANTHROPIC_API_KEY"], "optional_vars": ["CHATBOT_PERSONALITY"]}'::jsonb,
    '{"chatbot_enabled", "ai_chat_enabled"}',
    '[]'::jsonb,
    'Configurar API key de Anthropic',
    15,
    130
),
(
    'analytics_advanced',
    'Analytics Avanzados',
    'Dashboard con métricas avanzadas y tendencias',
    'plan_feature', NULL, 'growth',
    'features/analytics_advanced.n8n.json',
    '{"dashboard_sync"}',
    '{"required_vars": ["CLIENT_ID"], "optional_vars": []}'::jsonb,
    '{"analytics_advanced_enabled"}',
    '[{"widget_id": "trends_chart", "widget_name": "Tendencias", "widget_type": "chart", "size": "large"}]'::jsonb,
    'Configuración automática',
    5,
    140
),
-- VERTICAL MODULES - Clinic (Dental)
(
    'appointments_mgmt',
    'Gestión de Citas',
    'Sistema de citas con recordatorios automáticos',
    'vertical_module', '{"clinic", "dental"}', 'starter',
    'verticals/clinic/appointments_mgmt.n8n.json',
    '{"notification_engine"}',
    '{"required_vars": ["CLIENT_ID"], "optional_vars": ["DEFAULT_DURATION_MINUTES"]}'::jsonb,
    '{"appointments_enabled"}',
    '[{"widget_id": "today_appointments", "widget_name": "Citas de Hoy", "widget_type": "list", "size": "medium"}]'::jsonb,
    'Configurar duración de citas',
    15,
    200
),
(
    'patient_records',
    'Expedientes de Pacientes',
    'Gestión de expedientes clínicos',
    'vertical_module', '{"clinic", "dental"}', 'starter',
    'verticals/clinic/patient_records.n8n.json',
    '{"auth_system"}',
    '{"required_vars": ["CLIENT_ID"], "optional_vars": []}'::jsonb,
    '{"patient_records_enabled"}',
    '[]'::jsonb,
    'Configuración automática',
    10,
    210
),
(
    'treatment_plans',
    'Planes de Tratamiento',
    'Seguimiento de tratamientos con progreso',
    'vertical_module', '{"clinic", "dental"}', 'essentials',
    'verticals/clinic/treatment_plans.n8n.json',
    '{"patient_records", "notification_engine"}',
    '{"required_vars": ["CLIENT_ID"], "optional_vars": []}'::jsonb,
    '{"treatment_plans_enabled"}',
    '[]'::jsonb,
    'Configuración automática',
    10,
    220
),
(
    'quotes_mgmt',
    'Gestión de Presupuestos',
    'Creación y seguimiento de presupuestos dentales',
    'vertical_module', '{"dental"}', 'starter',
    'verticals/dental/quotes_mgmt.n8n.json',
    '{"patient_records"}',
    '{"required_vars": ["CLIENT_ID"], "optional_vars": []}'::jsonb,
    '{"quotes_enabled"}',
    '[{"widget_id": "pending_quotes", "widget_name": "Presupuestos Pendientes", "widget_type": "list", "size": "medium"}]'::jsonb,
    'Configuración automática',
    10,
    230
)
ON CONFLICT (component_name) DO UPDATE SET
    component_display_name = EXCLUDED.component_display_name,
    component_description = EXCLUDED.component_description,
    updated_at = NOW();

-- ============================================
-- DONE!
-- ============================================

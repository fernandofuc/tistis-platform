-- =====================================================
-- TIS TIS PLATFORM - DATABASE SCHEMA v2.0
-- Vertical: Dental (ESVA Clinic)
--
-- ARQUITECTURA: Multi-tenant ready
-- FILOSOFIA: Tablas genericas + extensiones por vertical
--
-- INSTRUCCIONES:
-- 1. Ejecutar en Supabase SQL Editor
-- 2. Ejecutar 004_esva_seed_data.sql despues
-- =====================================================

-- =====================================================
-- EXTENSIONES
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para busqueda fuzzy

-- =====================================================
-- PARTE 1: CORE TIS TIS (Reutilizable para cualquier vertical)
-- =====================================================

-- -----------------------------------------------------
-- TABLA: tenants (Clientes de TIS TIS)
-- El corazon del multi-tenant
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identificacion
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    legal_name VARCHAR(255),

    -- Categorizacion
    vertical VARCHAR(50) NOT NULL CHECK (vertical IN (
        'dental',
        'restaurant',
        'pharmacy',
        'retail',
        'medical',
        'services',
        'other'
    )),

    -- Plan TIS TIS
    plan VARCHAR(50) DEFAULT 'starter' CHECK (plan IN (
        'starter',
        'essentials',
        'growth',
        'scale'
    )),
    plan_started_at TIMESTAMPTZ,
    plan_expires_at TIMESTAMPTZ,

    -- Configuracion
    settings JSONB DEFAULT '{}',
    features_enabled JSONB DEFAULT '[]',

    -- Contacto principal
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(20),

    -- Estado
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
        'trial',
        'active',
        'suspended',
        'cancelled'
    )),

    -- Metadatos
    onboarded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_vertical ON tenants(vertical);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;

-- -----------------------------------------------------
-- TABLA: branches (Sucursales - Generica)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Identificacion
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    branch_code VARCHAR(20),

    -- Ubicacion
    address TEXT,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(2) DEFAULT 'MX',
    zip_code VARCHAR(10),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    google_maps_url TEXT,

    -- Contacto
    phone VARCHAR(20),
    phone_secondary VARCHAR(20),
    whatsapp_number VARCHAR(20),
    email VARCHAR(255),

    -- Zona horaria
    timezone VARCHAR(50) DEFAULT 'America/Hermosillo',

    -- Horarios de operacion
    operating_hours JSONB DEFAULT '{
        "monday": {"open": "09:00", "close": "18:00", "enabled": true},
        "tuesday": {"open": "09:00", "close": "18:00", "enabled": true},
        "wednesday": {"open": "09:00", "close": "18:00", "enabled": true},
        "thursday": {"open": "09:00", "close": "18:00", "enabled": true},
        "friday": {"open": "09:00", "close": "18:00", "enabled": true},
        "saturday": {"open": "09:00", "close": "14:00", "enabled": true},
        "sunday": {"open": null, "close": null, "enabled": false}
    }',

    -- Excepciones de horario
    holiday_exceptions JSONB DEFAULT '[]',

    -- Configuracion de citas
    appointment_duration_default INTEGER DEFAULT 60,
    appointment_buffer_minutes INTEGER DEFAULT 0,
    max_appointments_per_slot INTEGER DEFAULT 1,
    advance_booking_days INTEGER DEFAULT 30,

    -- Estado
    is_active BOOLEAN DEFAULT true,
    is_headquarters BOOLEAN DEFAULT false,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- Constraints
    UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_branches_city ON branches(city);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(tenant_id, is_active) WHERE deleted_at IS NULL;

-- -----------------------------------------------------
-- TABLA: staff (Personal - Generica)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID,

    -- Informacion personal
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    whatsapp_number VARCHAR(20),

    -- Avatar/foto
    avatar_url TEXT,

    -- Rol
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'owner',
        'admin',
        'manager',
        'specialist',
        'staff',
        'receptionist',
        'assistant'
    )),
    role_title VARCHAR(100),

    -- Notificaciones
    receive_notifications BOOLEAN DEFAULT true,
    notification_preferences JSONB DEFAULT '{
        "channels": ["whatsapp", "email"],
        "types": {
            "hot_leads": true,
            "new_appointments": true,
            "cancellations": true,
            "escalations": true,
            "daily_report": true,
            "weekly_report": false
        },
        "quiet_hours": {"start": "22:00", "end": "07:00", "enabled": true}
    }',

    -- Horario de trabajo
    work_schedule JSONB,

    -- Estado
    is_active BOOLEAN DEFAULT true,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- Constraints
    UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(tenant_id, role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_notifications ON staff(tenant_id, receive_notifications)
    WHERE deleted_at IS NULL AND is_active = true;

-- -----------------------------------------------------
-- TABLA: staff_branches (Relacion N:N staff-branches)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

    is_primary BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(staff_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_branches_staff ON staff_branches(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_branches_branch ON staff_branches(branch_id);

-- -----------------------------------------------------
-- TABLA: leads (Prospectos - Generica)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Informacion de contacto
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255) GENERATED ALWAYS AS (
        COALESCE(first_name, '') ||
        CASE WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN ' ' ELSE '' END ||
        COALESCE(last_name, '')
    ) STORED,
    phone VARCHAR(20),
    phone_normalized VARCHAR(20),
    email VARCHAR(255),

    -- Demografia
    date_of_birth DATE,
    gender VARCHAR(20),
    country VARCHAR(2) DEFAULT 'MX',
    city VARCHAR(100),
    zip_code VARCHAR(10),

    -- Idioma preferido
    preferred_language VARCHAR(10) DEFAULT 'es',

    -- Origen del lead
    source VARCHAR(50) NOT NULL DEFAULT 'whatsapp' CHECK (source IN (
        'whatsapp',
        'instagram',
        'facebook',
        'tiktok',
        'phone',
        'website',
        'walk_in',
        'referral',
        'google_ads',
        'meta_ads',
        'organic',
        'other'
    )),
    source_detail VARCHAR(255),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),

    -- Sucursal preferida
    preferred_branch_id UUID REFERENCES branches(id),

    -- Lead scoring
    score INTEGER DEFAULT 50 CHECK (score >= 0 AND score <= 100),
    classification VARCHAR(10) DEFAULT 'WARM' CHECK (classification IN ('HOT', 'WARM', 'COLD')),
    scoring_signals JSONB DEFAULT '[]',
    last_score_update TIMESTAMPTZ DEFAULT NOW(),

    -- Estado del lead
    status VARCHAR(50) DEFAULT 'NEW' CHECK (status IN (
        'NEW',
        'CONTACTED',
        'ENGAGED',
        'QUALIFIED',
        'APPOINTMENT_BOOKED',
        'APPOINTMENT_COMPLETED',
        'QUOTE_SENT',
        'NEGOTIATING',
        'CONVERTED',
        'LOST',
        'NURTURING',
        'REACTIVATED'
    )),
    status_reason VARCHAR(255),

    -- Control de conversacion
    conversation_active BOOLEAN DEFAULT true,
    escalated_to_human BOOLEAN DEFAULT false,
    escalated_at TIMESTAMPTZ,
    escalation_reason VARCHAR(255),
    assigned_to UUID REFERENCES staff(id),
    assigned_at TIMESTAMPTZ,

    -- Referidos
    is_referral BOOLEAN DEFAULT false,
    referred_by_lead_id UUID REFERENCES leads(id),
    referral_code VARCHAR(50),

    -- IDs externos
    external_id VARCHAR(255),
    external_ids JSONB DEFAULT '{}',

    -- Timing
    first_contact_at TIMESTAMPTZ DEFAULT NOW(),
    last_contact_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_direction VARCHAR(10) DEFAULT 'inbound',
    last_response_time_seconds INTEGER,

    -- Contadores
    total_messages INTEGER DEFAULT 0,
    total_appointments INTEGER DEFAULT 0,

    -- Notas
    notes TEXT,
    internal_notes TEXT,
    tags TEXT[],

    -- Valor estimado
    estimated_value DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Mejor momento para contactar
    preferred_contact_time VARCHAR(50),
    preferred_contact_days TEXT[],

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- Constraints
    UNIQUE(tenant_id, phone_normalized)
);

-- Indices optimizados para queries comunes
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(tenant_id, phone_normalized) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(tenant_id, email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_external ON leads(tenant_id, external_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_classification ON leads(tenant_id, classification) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(tenant_id, source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_branch ON leads(tenant_id, preferred_branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(tenant_id, assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(tenant_id, score DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(tenant_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_last_contact ON leads(tenant_id, last_contact_at DESC) WHERE deleted_at IS NULL;

-- Indices compuestos para queries complejos
CREATE INDEX IF NOT EXISTS idx_leads_hot_pending ON leads(tenant_id, preferred_branch_id, last_contact_at DESC)
    WHERE deleted_at IS NULL AND classification = 'HOT' AND status IN ('NEW', 'CONTACTED', 'QUALIFIED');
CREATE INDEX IF NOT EXISTS idx_leads_escalated ON leads(tenant_id, escalated_at DESC)
    WHERE deleted_at IS NULL AND escalated_to_human = true;

-- Indice para busqueda de texto
CREATE INDEX IF NOT EXISTS idx_leads_name_search ON leads USING gin(full_name gin_trgm_ops);

-- -----------------------------------------------------
-- TABLA: conversations (Historial de mensajes)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

    -- Informacion del mensaje
    channel VARCHAR(50) NOT NULL CHECK (channel IN (
        'whatsapp',
        'instagram',
        'facebook',
        'messenger',
        'sms',
        'email',
        'phone',
        'vapi',
        'webchat',
        'telegram'
    )),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN (
        'text',
        'image',
        'audio',
        'video',
        'document',
        'location',
        'contact',
        'sticker',
        'reaction',
        'system'
    )),

    -- Contenido
    message_content TEXT NOT NULL,
    media_url TEXT,
    media_mime_type VARCHAR(100),
    media_filename VARCHAR(255),

    -- Metadatos de IA
    ai_generated BOOLEAN DEFAULT false,
    ai_model VARCHAR(50),
    ai_tokens_used INTEGER,
    ai_cost_usd DECIMAL(10, 6),

    -- Analisis del mensaje
    intent_detected VARCHAR(100),
    intent_confidence DECIMAL(3, 2),
    entities_extracted JSONB DEFAULT '{}',
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
    sentiment_score DECIMAL(3, 2),
    language_detected VARCHAR(10),

    -- Scoring
    score_change INTEGER DEFAULT 0,
    signals_detected JSONB DEFAULT '[]',

    -- IDs externos
    external_message_id VARCHAR(255),
    external_conversation_id VARCHAR(255),
    reply_to_message_id VARCHAR(255),

    -- Estado de entrega
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN (
        'pending',
        'sent',
        'delivered',
        'read',
        'failed',
        'deleted'
    )),
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_code VARCHAR(50),
    error_message TEXT,

    -- Tiempo de respuesta
    response_time_seconds INTEGER,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(tenant_id, channel);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_external ON conversations(external_message_id);
CREATE INDEX IF NOT EXISTS idx_conversations_ai ON conversations(tenant_id, ai_generated) WHERE ai_generated = true;

-- -----------------------------------------------------
-- TABLA: appointments (Citas - Generica)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id),
    branch_id UUID NOT NULL REFERENCES branches(id),

    -- Informacion de la cita
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    end_time TIME,
    duration_minutes INTEGER DEFAULT 60,

    -- Tipo
    appointment_type VARCHAR(50) DEFAULT 'CONSULTATION',
    appointment_subtype VARCHAR(100),

    -- Estado
    status VARCHAR(50) DEFAULT 'CONFIRMED' CHECK (status IN (
        'PENDING',
        'CONFIRMED',
        'CHECKED_IN',
        'IN_PROGRESS',
        'COMPLETED',
        'RESCHEDULED',
        'CANCELLED',
        'NO_SHOW'
    )),
    status_history JSONB DEFAULT '[]',

    -- Detalles
    reason TEXT,
    notes TEXT,
    internal_notes TEXT,

    -- Asignacion
    assigned_staff_id UUID REFERENCES staff(id),

    -- Recordatorios
    reminder_24h_sent BOOLEAN DEFAULT false,
    reminder_24h_sent_at TIMESTAMPTZ,
    reminder_2h_sent BOOLEAN DEFAULT false,
    reminder_2h_sent_at TIMESTAMPTZ,
    confirmation_received BOOLEAN DEFAULT false,
    confirmation_received_at TIMESTAMPTZ,

    -- Canal de reserva
    booked_via VARCHAR(50) DEFAULT 'ai_whatsapp' CHECK (booked_via IN (
        'ai_whatsapp',
        'ai_instagram',
        'ai_facebook',
        'ai_phone',
        'ai_vapi',
        'ai_webchat',
        'manual',
        'website',
        'phone',
        'walk_in'
    )),
    booked_by UUID REFERENCES staff(id),

    -- Cancelacion/Reprogramacion
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES staff(id),
    cancellation_reason TEXT,
    rescheduled_from UUID REFERENCES appointments(id),
    rescheduled_to UUID,
    reschedule_count INTEGER DEFAULT 0,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_lead ON appointments(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_branch_date ON appointments(branch_id, appointment_date, appointment_time)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(tenant_id, appointment_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_staff ON appointments(assigned_staff_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_availability ON appointments(branch_id, appointment_date, status)
    WHERE deleted_at IS NULL AND status NOT IN ('CANCELLED', 'NO_SHOW');
CREATE INDEX IF NOT EXISTS idx_appointments_reminders ON appointments(appointment_date, reminder_24h_sent, reminder_2h_sent)
    WHERE deleted_at IS NULL AND status = 'CONFIRMED';

-- -----------------------------------------------------
-- TABLA: services (Servicios/Productos - Generica)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Identificacion
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    sku VARCHAR(50),

    -- Descripcion
    description TEXT,
    short_description VARCHAR(500),

    -- Categorizacion
    category VARCHAR(100),
    subcategory VARCHAR(100),
    tags TEXT[],

    -- Precios
    price_min DECIMAL(12, 2),
    price_max DECIMAL(12, 2),
    price_unit VARCHAR(50) DEFAULT 'per_service',
    currency VARCHAR(3) DEFAULT 'USD',

    -- Variantes de precio
    price_variants JSONB DEFAULT '[]',

    -- Duracion
    duration_minutes INTEGER DEFAULT 60,
    sessions_required INTEGER DEFAULT 1,

    -- Configuracion
    requires_consultation BOOLEAN DEFAULT true,
    requires_deposit BOOLEAN DEFAULT false,
    deposit_amount DECIMAL(12, 2),
    deposit_percentage DECIMAL(5, 2),

    -- Display
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,

    -- SEO/AI
    keywords TEXT[],
    ai_description TEXT,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_services_category ON services(tenant_id, category) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_services_featured ON services(tenant_id, is_featured) WHERE deleted_at IS NULL AND is_active = true;

-- -----------------------------------------------------
-- TABLA: quotes (Cotizaciones)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id),
    branch_id UUID REFERENCES branches(id),

    -- Identificacion
    quote_number VARCHAR(50) NOT NULL,

    -- Items
    items JSONB NOT NULL DEFAULT '[]',

    -- Totales
    subtotal DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    discount_percentage DECIMAL(5, 2),
    discount_reason VARCHAR(255),
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Validez
    valid_until DATE,

    -- Estado
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT',
        'SENT',
        'VIEWED',
        'ACCEPTED',
        'REJECTED',
        'EXPIRED',
        'REVISED'
    )),

    -- Notas
    notes TEXT,
    terms TEXT,
    internal_notes TEXT,

    -- Tracking
    sent_at TIMESTAMPTZ,
    sent_via VARCHAR(50),
    viewed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Staff
    created_by UUID REFERENCES staff(id),

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    UNIQUE(tenant_id, quote_number)
);

CREATE INDEX IF NOT EXISTS idx_quotes_tenant ON quotes(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_lead ON quotes(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(tenant_id, status) WHERE deleted_at IS NULL;

-- -----------------------------------------------------
-- TABLA: notifications_log (Log de notificaciones)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Destinatario
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('lead', 'staff')),
    recipient_id UUID,
    recipient_contact VARCHAR(255),

    -- Tipo y canal
    channel VARCHAR(50) NOT NULL CHECK (channel IN (
        'whatsapp',
        'sms',
        'email',
        'push',
        'vapi'
    )),
    notification_type VARCHAR(100) NOT NULL,

    -- Contenido
    template_used VARCHAR(100),
    subject VARCHAR(255),
    content TEXT,
    variables JSONB DEFAULT '{}',

    -- Estado
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',
        'QUEUED',
        'SENT',
        'DELIVERED',
        'READ',
        'FAILED',
        'CANCELLED'
    )),

    -- Tracking
    external_id VARCHAR(255),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_code VARCHAR(50),
    error_message TEXT,

    -- Reintentos
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,

    -- Costo
    cost_usd DECIMAL(10, 6),

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications_log(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications_log(status) WHERE status IN ('PENDING', 'QUEUED');
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications_log(tenant_id, notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_retry ON notifications_log(next_retry_at) WHERE status = 'FAILED' AND retry_count < max_retries;

-- -----------------------------------------------------
-- TABLA: faqs (Knowledge Base para AI)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Contenido
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    short_answer VARCHAR(500),

    -- Categorizacion
    category VARCHAR(100),
    subcategory VARCHAR(100),
    tags TEXT[],

    -- Para matching de AI
    keywords TEXT[],
    question_variations TEXT[],

    -- Idioma
    language VARCHAR(10) DEFAULT 'es',

    -- Display
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true,

    -- Analytics
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    helpfulness_score DECIMAL(3, 2),

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_faqs_tenant ON faqs(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(tenant_id, category) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_faqs_keywords ON faqs USING gin(keywords);

-- -----------------------------------------------------
-- TABLA: ai_config (Configuracion del AI Agent)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    config_key VARCHAR(100) NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,

    -- Versionamiento
    version INTEGER DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, config_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_config_tenant ON ai_config(tenant_id);

-- -----------------------------------------------------
-- TABLA: lead_scoring_history (Historial de scoring)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_scoring_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

    -- Cambios
    old_score INTEGER,
    new_score INTEGER,
    score_change INTEGER,
    old_classification VARCHAR(10),
    new_classification VARCHAR(10),

    -- Contexto
    signals_detected JSONB DEFAULT '[]',
    triggered_by VARCHAR(100),
    conversation_id UUID REFERENCES conversations(id),

    -- Metadatos
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scoring_history_lead ON lead_scoring_history(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scoring_history_tenant ON lead_scoring_history(tenant_id, created_at DESC);

-- -----------------------------------------------------
-- TABLA: analytics_daily (Metricas diarias agregadas)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),

    date DATE NOT NULL,

    -- Leads
    new_leads INTEGER DEFAULT 0,
    hot_leads INTEGER DEFAULT 0,
    warm_leads INTEGER DEFAULT 0,
    cold_leads INTEGER DEFAULT 0,

    -- Por fuente
    leads_whatsapp INTEGER DEFAULT 0,
    leads_instagram INTEGER DEFAULT 0,
    leads_facebook INTEGER DEFAULT 0,
    leads_phone INTEGER DEFAULT 0,
    leads_website INTEGER DEFAULT 0,
    leads_referral INTEGER DEFAULT 0,
    leads_other INTEGER DEFAULT 0,

    -- Conversiones
    appointments_booked INTEGER DEFAULT 0,
    appointments_completed INTEGER DEFAULT 0,
    appointments_cancelled INTEGER DEFAULT 0,
    appointments_no_show INTEGER DEFAULT 0,

    -- Cotizaciones
    quotes_sent INTEGER DEFAULT 0,
    quotes_accepted INTEGER DEFAULT 0,
    quotes_value_total DECIMAL(12, 2) DEFAULT 0,

    -- Mensajes
    messages_received INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_ai INTEGER DEFAULT 0,
    avg_response_time_seconds INTEGER,

    -- Scores
    avg_lead_score DECIMAL(5, 2),
    conversion_rate DECIMAL(5, 2),

    -- Costos
    ai_cost_usd DECIMAL(10, 4) DEFAULT 0,
    notification_cost_usd DECIMAL(10, 4) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, branch_id, date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_tenant_date ON analytics_daily(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_branch_date ON analytics_daily(branch_id, date DESC);

-- -----------------------------------------------------
-- TABLA: audit_log (Auditoria de cambios)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),

    -- Actor
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('system', 'ai', 'staff', 'lead', 'webhook')),
    actor_id UUID,
    actor_name VARCHAR(255),

    -- Accion
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,

    -- Cambios
    old_values JSONB,
    new_values JSONB,
    changes JSONB,

    -- Contexto
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100),

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_type, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, created_at DESC);


-- =====================================================
-- PARTE 2: EXTENSIONES VERTICALES (Dental)
-- =====================================================

-- -----------------------------------------------------
-- TABLA: lead_dental_profile (Extension dental para leads)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_dental_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,

    -- Historial dental
    dental_history TEXT,
    last_dental_visit DATE,
    current_dentist VARCHAR(255),

    -- Situacion actual
    reason_for_visit TEXT,
    treatment_interest TEXT[],
    current_pain BOOLEAN DEFAULT false,
    pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
    pain_description TEXT,
    urgency_level VARCHAR(20) DEFAULT 'normal' CHECK (urgency_level IN (
        'low',
        'normal',
        'high',
        'emergency'
    )),

    -- Condiciones medicas relevantes
    medical_conditions TEXT[],
    allergies TEXT[],
    medications TEXT[],
    is_pregnant BOOLEAN,
    has_dental_anxiety BOOLEAN DEFAULT false,

    -- Estetica
    smile_concerns TEXT[],
    desired_outcome TEXT,

    -- Dental tourism
    is_dental_tourist BOOLEAN DEFAULT false,
    home_country VARCHAR(2),
    travel_dates JSONB,
    accommodation_needed BOOLEAN DEFAULT false,

    -- Diseno Digital de Sonrisa
    dsd_completed BOOLEAN DEFAULT false,
    dsd_approved BOOLEAN DEFAULT false,
    dsd_photos_url TEXT,
    dsd_video_url TEXT,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_dental_lead ON lead_dental_profile(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_dental_urgency ON lead_dental_profile(urgency_level) WHERE current_pain = true;
CREATE INDEX IF NOT EXISTS idx_lead_dental_tourist ON lead_dental_profile(is_dental_tourist) WHERE is_dental_tourist = true;

-- -----------------------------------------------------
-- TABLA: appointment_dental_details (Extension dental para citas)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_dental_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,

    -- Tipo de procedimiento dental
    procedure_type VARCHAR(50) CHECK (procedure_type IN (
        'VALORACION',
        'CONSULTA_ESTETICA',
        'LIMPIEZA',
        'BLANQUEAMIENTO',
        'CARILLAS_PREP',
        'CARILLAS_COLOCACION',
        'IMPLANTE_CONSULTA',
        'IMPLANTE_CIRUGIA',
        'IMPLANTE_CORONA',
        'ORTODONCIA_INICIO',
        'ORTODONCIA_CONTROL',
        'EMERGENCIA',
        'SEGUIMIENTO',
        'OTRO'
    )),

    -- Dientes involucrados
    teeth_involved INTEGER[],
    quadrants_involved INTEGER[],

    -- Servicio especifico
    service_id UUID REFERENCES services(id),
    service_tier VARCHAR(50),

    -- Doctor asignado
    doctor_id UUID REFERENCES staff(id),

    -- Notas clinicas
    clinical_notes TEXT,
    treatment_plan TEXT,

    -- Post-procedimiento
    post_care_instructions TEXT,
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_days INTEGER,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_dental ON appointment_dental_details(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_dental_procedure ON appointment_dental_details(procedure_type);

-- -----------------------------------------------------
-- TABLA: staff_dental_profile (Extension dental para staff)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_dental_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL UNIQUE REFERENCES staff(id) ON DELETE CASCADE,

    -- Credenciales
    license_number VARCHAR(100),
    license_state VARCHAR(100),
    license_expiry DATE,

    -- Especialidad
    specialty VARCHAR(100),
    sub_specialties TEXT[],

    -- Educacion
    dental_school VARCHAR(255),
    graduation_year INTEGER,
    certifications TEXT[],

    -- Bio para pacientes
    bio TEXT,
    bio_short VARCHAR(500),

    -- Servicios que realiza
    services_offered UUID[],

    -- Tier (para carillas ESVA)
    service_tier VARCHAR(50),

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_dental ON staff_dental_profile(staff_id);


-- =====================================================
-- PARTE 3: FUNCIONES Y TRIGGERS
-- =====================================================

-- Funcion para normalizar telefonos
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT)
RETURNS TEXT AS $$
DECLARE
    cleaned TEXT;
BEGIN
    -- Remover todo excepto digitos
    cleaned := regexp_replace(phone, '[^0-9]', '', 'g');

    -- Si empieza con 1 y tiene 11 digitos (USA), anadir +
    IF length(cleaned) = 11 AND left(cleaned, 1) = '1' THEN
        RETURN '+' || cleaned;
    END IF;

    -- Si tiene 10 digitos (Mexico sin codigo), anadir +52
    IF length(cleaned) = 10 THEN
        RETURN '+52' || cleaned;
    END IF;

    -- Si ya tiene codigo de pais
    IF length(cleaned) >= 11 THEN
        RETURN '+' || cleaned;
    END IF;

    RETURN cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger para normalizar telefono en leads
CREATE OR REPLACE FUNCTION normalize_lead_phone()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.phone IS NOT NULL THEN
        NEW.phone_normalized := normalize_phone(NEW.phone);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_normalize_lead_phone ON leads;
CREATE TRIGGER trigger_normalize_lead_phone
    BEFORE INSERT OR UPDATE OF phone ON leads
    FOR EACH ROW EXECUTE FUNCTION normalize_lead_phone();

-- Funcion para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger updated_at a todas las tablas relevantes
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'tenants', 'branches', 'staff', 'leads', 'appointments',
            'services', 'quotes', 'faqs', 'ai_config',
            'lead_dental_profile', 'appointment_dental_details', 'staff_dental_profile'
        ])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
        EXECUTE format('
            CREATE TRIGGER update_%s_updated_at
            BEFORE UPDATE ON %s
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        ', t, t);
    END LOOP;
END $$;

-- Funcion para actualizar last_contact_at del lead
CREATE OR REPLACE FUNCTION update_lead_last_contact()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE leads
    SET
        last_contact_at = NOW(),
        last_message_direction = NEW.direction,
        total_messages = total_messages + 1
    WHERE id = NEW.lead_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lead_contact ON conversations;
CREATE TRIGGER trigger_update_lead_contact
    AFTER INSERT ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_lead_last_contact();

-- Funcion para calcular end_time de cita
CREATE OR REPLACE FUNCTION calculate_appointment_end_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.end_time := NEW.appointment_time + (NEW.duration_minutes || ' minutes')::INTERVAL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_appointment_end_time ON appointments;
CREATE TRIGGER trigger_appointment_end_time
    BEFORE INSERT OR UPDATE OF appointment_time, duration_minutes ON appointments
    FOR EACH ROW EXECUTE FUNCTION calculate_appointment_end_time();

-- Funcion para auto-clasificar leads basado en score
CREATE OR REPLACE FUNCTION auto_classify_lead()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.score >= 80 THEN
        NEW.classification := 'HOT';
    ELSIF NEW.score >= 40 THEN
        NEW.classification := 'WARM';
    ELSE
        NEW.classification := 'COLD';
    END IF;

    NEW.last_score_update := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_classify_lead ON leads;
CREATE TRIGGER trigger_auto_classify_lead
    BEFORE UPDATE OF score ON leads
    FOR EACH ROW
    WHEN (OLD.score IS DISTINCT FROM NEW.score)
    EXECUTE FUNCTION auto_classify_lead();

-- Funcion para crear perfil dental automaticamente
CREATE OR REPLACE FUNCTION create_dental_profile_for_lead()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo crear si el tenant es dental
    IF EXISTS (SELECT 1 FROM tenants WHERE id = NEW.tenant_id AND vertical = 'dental') THEN
        INSERT INTO lead_dental_profile (lead_id)
        VALUES (NEW.id)
        ON CONFLICT (lead_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_dental_profile ON leads;
CREATE TRIGGER trigger_create_dental_profile
    AFTER INSERT ON leads
    FOR EACH ROW EXECUTE FUNCTION create_dental_profile_for_lead();


-- =====================================================
-- PARTE 4: VIEWS UTILES
-- =====================================================

-- Vista de leads activos con proxima cita
CREATE OR REPLACE VIEW v_active_leads AS
SELECT
    l.*,
    b.name as branch_name,
    b.city as branch_city,
    b.slug as branch_slug,
    ldp.treatment_interest,
    ldp.current_pain,
    ldp.urgency_level,
    ldp.is_dental_tourist,
    a.id as next_appointment_id,
    a.appointment_date as next_appointment_date,
    a.appointment_time as next_appointment_time,
    a.status as appointment_status,
    a.appointment_type
FROM leads l
LEFT JOIN branches b ON l.preferred_branch_id = b.id
LEFT JOIN lead_dental_profile ldp ON ldp.lead_id = l.id
LEFT JOIN LATERAL (
    SELECT * FROM appointments
    WHERE lead_id = l.id
    AND appointment_date >= CURRENT_DATE
    AND status NOT IN ('CANCELLED', 'COMPLETED', 'NO_SHOW')
    AND deleted_at IS NULL
    ORDER BY appointment_date, appointment_time
    LIMIT 1
) a ON true
WHERE l.status NOT IN ('LOST', 'CONVERTED')
AND l.deleted_at IS NULL;

-- Vista de leads HOT que requieren atencion
CREATE OR REPLACE VIEW v_hot_leads AS
SELECT
    l.*,
    b.name as branch_name,
    ldp.current_pain,
    ldp.urgency_level,
    ldp.is_dental_tourist,
    (
        SELECT COUNT(*) FROM conversations c
        WHERE c.lead_id = l.id
        AND c.direction = 'inbound'
        AND c.created_at > NOW() - INTERVAL '24 hours'
    ) as messages_last_24h,
    (
        SELECT MAX(created_at) FROM conversations c
        WHERE c.lead_id = l.id
    ) as last_message_at
FROM leads l
LEFT JOIN branches b ON l.preferred_branch_id = b.id
LEFT JOIN lead_dental_profile ldp ON ldp.lead_id = l.id
WHERE l.classification = 'HOT'
AND l.status IN ('NEW', 'CONTACTED', 'ENGAGED', 'QUALIFIED')
AND l.escalated_to_human = false
AND l.deleted_at IS NULL
ORDER BY
    CASE WHEN ldp.current_pain = true THEN 0 ELSE 1 END,
    l.score DESC,
    l.last_contact_at DESC;

-- Vista de citas de hoy
CREATE OR REPLACE VIEW v_today_appointments AS
SELECT
    a.*,
    l.full_name as lead_name,
    l.phone as lead_phone,
    l.email as lead_email,
    l.classification as lead_classification,
    l.score as lead_score,
    b.name as branch_name,
    b.slug as branch_slug,
    add.procedure_type,
    add.service_tier,
    s.display_name as staff_name
FROM appointments a
JOIN leads l ON a.lead_id = l.id
JOIN branches b ON a.branch_id = b.id
LEFT JOIN appointment_dental_details add ON add.appointment_id = a.id
LEFT JOIN staff s ON a.assigned_staff_id = s.id
WHERE a.appointment_date = CURRENT_DATE
AND a.status NOT IN ('CANCELLED')
AND a.deleted_at IS NULL
ORDER BY a.appointment_time;

-- Vista de citas pendientes de recordatorio
CREATE OR REPLACE VIEW v_pending_reminders AS
SELECT
    a.*,
    l.full_name as lead_name,
    l.phone as lead_phone,
    l.preferred_language,
    b.name as branch_name,
    b.address as branch_address,
    b.google_maps_url
FROM appointments a
JOIN leads l ON a.lead_id = l.id
JOIN branches b ON a.branch_id = b.id
WHERE a.status = 'CONFIRMED'
AND a.deleted_at IS NULL
AND (
    (a.reminder_24h_sent = false AND a.appointment_date = CURRENT_DATE + INTERVAL '1 day')
    OR
    (a.reminder_2h_sent = false
     AND a.appointment_date = CURRENT_DATE
     AND a.appointment_time BETWEEN CURRENT_TIME + INTERVAL '2 hours' AND CURRENT_TIME + INTERVAL '3 hours')
);

-- Vista de metricas diarias
CREATE OR REPLACE VIEW v_daily_metrics AS
SELECT
    l.tenant_id,
    DATE(l.created_at) as date,
    l.preferred_branch_id as branch_id,
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE l.classification = 'HOT') as hot_leads,
    COUNT(*) FILTER (WHERE l.classification = 'WARM') as warm_leads,
    COUNT(*) FILTER (WHERE l.classification = 'COLD') as cold_leads,
    COUNT(*) FILTER (WHERE l.status = 'APPOINTMENT_BOOKED') as appointments_booked,
    COUNT(*) FILTER (WHERE l.source = 'whatsapp') as from_whatsapp,
    COUNT(*) FILTER (WHERE l.source = 'instagram') as from_instagram,
    COUNT(*) FILTER (WHERE l.source = 'facebook') as from_facebook,
    COUNT(*) FILTER (WHERE ldp.is_dental_tourist = true) as dental_tourists,
    ROUND(AVG(l.score), 1) as avg_score
FROM leads l
LEFT JOIN lead_dental_profile ldp ON ldp.lead_id = l.id
WHERE l.deleted_at IS NULL
GROUP BY l.tenant_id, DATE(l.created_at), l.preferred_branch_id
ORDER BY date DESC;

-- Vista de staff con notificaciones activas
CREATE OR REPLACE VIEW v_staff_for_notifications AS
SELECT
    s.*,
    sb.branch_id,
    b.name as branch_name
FROM staff s
JOIN staff_branches sb ON sb.staff_id = s.id
JOIN branches b ON b.id = sb.branch_id
WHERE s.is_active = true
AND s.receive_notifications = true
AND s.deleted_at IS NULL
AND b.is_active = true
AND b.deleted_at IS NULL;


-- =====================================================
-- PARTE 5: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas con tenant_id
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scoring_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_dental_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_dental_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_dental_profile ENABLE ROW LEVEL SECURITY;

-- Politicas para service_role (n8n, backend) - acceso completo
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'tenants', 'branches', 'staff', 'staff_branches', 'leads',
            'conversations', 'appointments', 'services', 'quotes',
            'notifications_log', 'faqs', 'ai_config', 'lead_scoring_history',
            'analytics_daily', 'audit_log', 'lead_dental_profile',
            'appointment_dental_details', 'staff_dental_profile'
        ])
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS "service_role_all_%s" ON %s;
            CREATE POLICY "service_role_all_%s" ON %s
            FOR ALL TO service_role USING (true) WITH CHECK (true)
        ', t, t, t, t);
    END LOOP;
END $$;

-- Policy para leads con authenticated
DROP POLICY IF EXISTS "authenticated_tenant_leads" ON leads;
CREATE POLICY "authenticated_tenant_leads" ON leads
    FOR ALL TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);


-- =====================================================
-- PARTE 6: REAL-TIME SUBSCRIPTIONS
-- =====================================================

-- Habilitar real-time para tablas clave
DO $$
BEGIN
    -- Verificar si las tablas ya estan en la publicacion
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'leads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE leads;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications_log'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications_log;
    END IF;
END $$;


-- =====================================================
-- PARTE 7: FUNCIONES HELPER PARA n8n
-- =====================================================

-- Funcion para obtener o crear lead por telefono
CREATE OR REPLACE FUNCTION get_or_create_lead(
    p_tenant_id UUID,
    p_phone TEXT,
    p_source VARCHAR DEFAULT 'whatsapp',
    p_external_id VARCHAR DEFAULT NULL,
    p_name VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_lead_id UUID;
    v_phone_normalized TEXT;
BEGIN
    v_phone_normalized := normalize_phone(p_phone);

    -- Buscar lead existente
    SELECT id INTO v_lead_id
    FROM leads
    WHERE tenant_id = p_tenant_id
    AND phone_normalized = v_phone_normalized
    AND deleted_at IS NULL;

    -- Si no existe, crear nuevo
    IF v_lead_id IS NULL THEN
        INSERT INTO leads (tenant_id, phone, source, external_id, first_name)
        VALUES (p_tenant_id, p_phone, p_source, p_external_id, p_name)
        RETURNING id INTO v_lead_id;
    ELSE
        -- Actualizar external_id si se proporciona
        IF p_external_id IS NOT NULL THEN
            UPDATE leads SET external_id = p_external_id WHERE id = v_lead_id;
        END IF;
    END IF;

    RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql;

-- Funcion para actualizar score del lead
CREATE OR REPLACE FUNCTION update_lead_score(
    p_lead_id UUID,
    p_score_change INTEGER,
    p_signals JSONB DEFAULT '[]',
    p_triggered_by VARCHAR DEFAULT 'conversation',
    p_conversation_id UUID DEFAULT NULL
)
RETURNS TABLE(new_score INTEGER, new_classification VARCHAR) AS $$
DECLARE
    v_old_score INTEGER;
    v_old_classification VARCHAR;
    v_new_score INTEGER;
    v_new_classification VARCHAR;
    v_tenant_id UUID;
BEGIN
    -- Obtener valores actuales
    SELECT score, classification, tenant_id
    INTO v_old_score, v_old_classification, v_tenant_id
    FROM leads WHERE id = p_lead_id;

    -- Calcular nuevo score (mantener entre 0 y 100)
    v_new_score := GREATEST(0, LEAST(100, v_old_score + p_score_change));

    -- Actualizar lead (el trigger auto-clasifica)
    UPDATE leads SET score = v_new_score WHERE id = p_lead_id;

    -- Obtener nueva clasificacion
    SELECT classification INTO v_new_classification FROM leads WHERE id = p_lead_id;

    -- Guardar en historial
    INSERT INTO lead_scoring_history (
        tenant_id, lead_id, old_score, new_score, score_change,
        old_classification, new_classification, signals_detected,
        triggered_by, conversation_id
    ) VALUES (
        v_tenant_id, p_lead_id, v_old_score, v_new_score, p_score_change,
        v_old_classification, v_new_classification, p_signals,
        p_triggered_by, p_conversation_id
    );

    RETURN QUERY SELECT v_new_score, v_new_classification;
END;
$$ LANGUAGE plpgsql;

-- Funcion para obtener slots disponibles
CREATE OR REPLACE FUNCTION get_available_slots(
    p_branch_id UUID,
    p_date DATE,
    p_duration_minutes INTEGER DEFAULT 60
)
RETURNS TABLE(slot_time TIME, slot_end TIME) AS $$
DECLARE
    v_operating_hours JSONB;
    v_day_name TEXT;
    v_open_time TIME;
    v_close_time TIME;
    v_slot_interval INTERVAL;
    v_current_slot TIME;
BEGIN
    -- Obtener dia de la semana
    v_day_name := lower(to_char(p_date, 'Day'));
    v_day_name := trim(v_day_name);

    -- Obtener horarios de operacion
    SELECT operating_hours INTO v_operating_hours
    FROM branches WHERE id = p_branch_id;

    -- Verificar si esta abierto ese dia
    IF NOT (v_operating_hours -> v_day_name ->> 'enabled')::BOOLEAN THEN
        RETURN;
    END IF;

    v_open_time := (v_operating_hours -> v_day_name ->> 'open')::TIME;
    v_close_time := (v_operating_hours -> v_day_name ->> 'close')::TIME;
    v_slot_interval := (p_duration_minutes || ' minutes')::INTERVAL;

    -- Generar slots
    v_current_slot := v_open_time;

    WHILE v_current_slot + v_slot_interval <= v_close_time LOOP
        -- Verificar si el slot esta disponible
        IF NOT EXISTS (
            SELECT 1 FROM appointments
            WHERE branch_id = p_branch_id
            AND appointment_date = p_date
            AND status NOT IN ('CANCELLED', 'NO_SHOW')
            AND deleted_at IS NULL
            AND (
                (appointment_time <= v_current_slot AND end_time > v_current_slot)
                OR
                (appointment_time < v_current_slot + v_slot_interval AND appointment_time >= v_current_slot)
            )
        ) THEN
            slot_time := v_current_slot;
            slot_end := v_current_slot + v_slot_interval;
            RETURN NEXT;
        END IF;

        v_current_slot := v_current_slot + INTERVAL '30 minutes';
    END LOOP;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- FIN DEL SCHEMA v2.0
-- =====================================================

SELECT 'Schema TIS TIS v2.0 creado exitosamente!' as status;

-- =====================================================
-- TIS TIS PLATFORM - INTEGRATION HUB SYSTEM
-- Migration: 078_INTEGRATION_HUB.sql
-- Date: December 27, 2024
-- Version: 1.0
--
-- PURPOSE: Sistema universal de integraciones para conectar
-- CRMs, POS, software dental y otros sistemas externos.
-- Permite sincronización bidireccional con deduplicación
-- inteligente de contactos.
--
-- ARCHITECTURE:
-- - integration_connections: Conexiones de sistemas externos
-- - external_contacts: Contactos sincronizados (con dedup)
-- - external_appointments: Citas de otros sistemas
-- - external_inventory: Inventario (restaurantes/retail)
-- - external_products: Productos/servicios externos
-- - integration_sync_logs: Auditoría de sincronizaciones
-- - integration_actions: Acciones bidireccionales configuradas
--
-- CRITICAL: Tablas external_* son aisladas de tablas core.
-- Solo linked_* FKs conectan con leads/patients/appointments.
-- =====================================================

-- =====================================================
-- STEP 1: FUNCTION - Normalización de teléfono para deduplicación
-- =====================================================
-- NOTA: La función normalize_phone() ya existe en 003_esva_schema_v2.sql
-- Creamos normalize_phone_number() como alias con la misma lógica robusta
-- que incluye prefijos de país para consistencia entre tablas leads y external_contacts.

CREATE OR REPLACE FUNCTION public.normalize_phone_number(phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    cleaned TEXT;
BEGIN
    -- Remove all non-digit characters
    cleaned := regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g');

    -- Return empty string for null/empty inputs
    IF cleaned IS NULL OR cleaned = '' THEN
        RETURN '';
    END IF;

    -- Si empieza con 1 y tiene 11 dígitos (USA), retornar con +
    IF length(cleaned) = 11 AND left(cleaned, 1) = '1' THEN
        RETURN '+' || cleaned;
    END IF;

    -- Si tiene 10 dígitos (México sin código), añadir +52
    IF length(cleaned) = 10 THEN
        RETURN '+52' || cleaned;
    END IF;

    -- Si ya tiene código de país (>=11 dígitos)
    IF length(cleaned) >= 11 THEN
        RETURN '+' || cleaned;
    END IF;

    -- Fallback: retornar limpio
    RETURN cleaned;
END;
$$;

COMMENT ON FUNCTION public.normalize_phone_number IS
'Normaliza un número de teléfono para deduplicación.
Añade prefijos de país (+52 México, +1 USA) según la longitud.
Compatible con normalize_phone() de 003_esva_schema_v2.sql.';

-- =====================================================
-- STEP 2: TABLE - integration_connections
-- Conexiones de sistemas externos (similar a channel_connections)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.integration_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

    -- Tipo de integración
    integration_type VARCHAR(50) NOT NULL CHECK (integration_type IN (
        -- CRMs
        'hubspot', 'salesforce', 'zoho_crm', 'pipedrive', 'freshsales',
        -- Dental Software
        'dentrix', 'open_dental', 'eaglesoft', 'curve_dental',
        -- POS Systems
        'square', 'toast', 'clover', 'lightspeed', 'softrestaurant_import',
        -- Calendar
        'google_calendar', 'calendly', 'acuity',
        -- Medical
        'epic', 'cerner', 'athenahealth',
        -- Generic (para cualquier sistema)
        'webhook_incoming', 'csv_import', 'api_custom'
    )),

    -- Estado de la conexión
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending',       -- Esperando configuración
        'configuring',   -- En proceso de configuración
        'connected',     -- Conectado y funcionando
        'syncing',       -- Sincronizando datos
        'paused',        -- Pausado por usuario
        'error',         -- Error de conexión
        'disconnected'   -- Desconectado
    )),

    -- Nombre amigable de la conexión
    connection_name VARCHAR(255),

    -- =====================================================
    -- AUTHENTICATION CREDENTIALS (encrypted)
    -- =====================================================
    auth_type VARCHAR(50) DEFAULT 'oauth2' CHECK (auth_type IN (
        'oauth2',        -- OAuth 2.0 (HubSpot, Salesforce, etc.)
        'api_key',       -- API Key simple
        'basic_auth',    -- Usuario + contraseña
        'webhook_secret' -- Secret para validar webhooks
    )),

    -- OAuth2 credentials
    access_token TEXT,                    -- OAuth access token (encrypted)
    refresh_token TEXT,                   -- OAuth refresh token (encrypted)
    token_expires_at TIMESTAMPTZ,         -- Token expiry
    oauth_scope TEXT,                     -- Scopes autorizados

    -- API Key auth
    api_key TEXT,                         -- API key (encrypted)
    api_secret TEXT,                      -- API secret (encrypted)

    -- Webhook configuration
    webhook_url TEXT,                     -- URL generada para recibir webhooks
    webhook_secret TEXT,                  -- Secret para validar firmas HMAC

    -- =====================================================
    -- SYNC CONFIGURATION
    -- =====================================================
    sync_enabled BOOLEAN DEFAULT true,
    sync_direction VARCHAR(20) DEFAULT 'bidirectional' CHECK (sync_direction IN (
        'inbound',       -- External → TIS TIS (solo lectura)
        'outbound',      -- TIS TIS → External (solo escritura)
        'bidirectional'  -- Ambas direcciones
    )),
    sync_frequency_minutes INTEGER DEFAULT 60 CHECK (sync_frequency_minutes >= 5),
    last_sync_at TIMESTAMPTZ,
    next_sync_at TIMESTAMPTZ,

    -- What data to sync
    sync_contacts BOOLEAN DEFAULT true,
    sync_appointments BOOLEAN DEFAULT true,
    sync_products BOOLEAN DEFAULT false,
    sync_inventory BOOLEAN DEFAULT false,
    sync_orders BOOLEAN DEFAULT false,

    -- =====================================================
    -- FIELD MAPPING CONFIGURATION
    -- =====================================================
    field_mapping JSONB DEFAULT '{}',
    -- Example: {
    --   "contacts": {"crm_first_name": "name", "crm_email": "email"},
    --   "appointments": {"crm_date": "scheduled_at"}
    -- }

    -- =====================================================
    -- EXTERNAL ACCOUNT INFO
    -- =====================================================
    external_account_id VARCHAR(255),     -- Account ID in external system
    external_account_name VARCHAR(255),   -- Account name in external system
    external_api_base_url TEXT,           -- Base URL for API calls

    -- =====================================================
    -- STATS & ERROR TRACKING
    -- =====================================================
    records_synced_total INTEGER DEFAULT 0,
    records_synced_today INTEGER DEFAULT 0,
    last_error_at TIMESTAMPTZ,
    last_error_message TEXT,
    error_count INTEGER DEFAULT 0,
    consecutive_errors INTEGER DEFAULT 0,

    -- =====================================================
    -- METADATA & TIMESTAMPS
    -- =====================================================
    metadata JSONB DEFAULT '{}',
    connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, integration_type, external_account_id)
);

-- Add comments
COMMENT ON TABLE public.integration_connections IS
'Conexiones de sistemas externos (CRM, POS, dental software).
Similar a channel_connections pero para integraciones de datos.';

COMMENT ON COLUMN public.integration_connections.webhook_url IS
'URL única generada para que sistemas externos envíen datos via webhook.
Formato: /api/integrations/webhook/{tenantSlug}/{connectionId}';

-- =====================================================
-- STEP 3: TABLE - external_contacts
-- Contactos sincronizados de CRMs con deduplicación
-- =====================================================

CREATE TABLE IF NOT EXISTS public.external_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- External IDs for tracking
    external_id VARCHAR(255) NOT NULL,    -- ID in source system (HubSpot ID, etc.)
    external_source VARCHAR(50) NOT NULL, -- hubspot, salesforce, csv_import, etc.

    -- =====================================================
    -- LINKED TIS TIS ENTITIES (deduplicación)
    -- NULL si no se ha vinculado aún con un lead/patient existente
    -- =====================================================
    linked_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    linked_patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,

    -- Deduplication status
    dedup_status VARCHAR(20) DEFAULT 'pending' CHECK (dedup_status IN (
        'pending',      -- No se ha intentado deduplicar
        'matched',      -- Se encontró match, linked_lead_id poblado
        'no_match',     -- No se encontró match, es contacto nuevo
        'manual_review' -- Múltiples matches, requiere revisión manual
    )),
    dedup_checked_at TIMESTAMPTZ,
    dedup_match_confidence DECIMAL(3,2), -- 0.00 a 1.00

    -- =====================================================
    -- CONTACT DATA (normalized from external system)
    -- =====================================================
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    full_name VARCHAR(500),
    email VARCHAR(255),
    phone VARCHAR(50),
    phone_normalized VARCHAR(50), -- For deduplication matching

    -- Additional data
    company VARCHAR(255),
    job_title VARCHAR(255),
    address_line1 VARCHAR(255),
    address_city VARCHAR(100),
    address_state VARCHAR(100),
    address_postal_code VARCHAR(20),
    address_country VARCHAR(100),

    -- External system scoring/status
    external_score INTEGER,
    external_status VARCHAR(100),         -- lead status in CRM
    external_stage VARCHAR(100),          -- pipeline stage
    external_owner VARCHAR(255),          -- Owner in external system

    -- Tags and custom fields
    external_tags TEXT[],
    custom_fields JSONB DEFAULT '{}',

    -- =====================================================
    -- RAW DATA & SYNC METADATA
    -- =====================================================
    raw_data JSONB DEFAULT '{}',          -- Complete raw record from source
    first_synced_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash VARCHAR(64),                -- Hash for change detection
    sync_version INTEGER DEFAULT 1,

    -- External timestamps
    external_created_at TIMESTAMPTZ,
    external_updated_at TIMESTAMPTZ,

    UNIQUE(integration_id, external_id)
);

-- Add trigger to auto-normalize phone
CREATE OR REPLACE FUNCTION public.normalize_external_contact_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.phone_normalized := public.normalize_phone_number(NEW.phone);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_external_contact_phone
    BEFORE INSERT OR UPDATE OF phone ON public.external_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_external_contact_phone();

COMMENT ON TABLE public.external_contacts IS
'Contactos sincronizados de sistemas externos (CRM, POS, etc.).
Incluye lógica de deduplicación para evitar duplicados con leads existentes.
linked_lead_id vincula con leads de TIS TIS si se encuentra match.';

-- =====================================================
-- STEP 4: TABLE - external_appointments
-- Citas de otros sistemas (calendarios externos, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.external_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- External IDs
    external_id VARCHAR(255) NOT NULL,
    external_source VARCHAR(50) NOT NULL,

    -- Linked TIS TIS entities
    linked_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    linked_contact_id UUID REFERENCES public.external_contacts(id) ON DELETE SET NULL,

    -- Appointment data (normalized)
    scheduled_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
    )),

    -- Service info
    service_name VARCHAR(255),
    service_external_id VARCHAR(255),

    -- Provider info
    provider_name VARCHAR(255),
    provider_external_id VARCHAR(255),

    -- Location
    location_name VARCHAR(255),
    location_external_id VARCHAR(255),
    location_address TEXT,

    -- Contact info (denormalized for quick access)
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Raw data & sync metadata
    raw_data JSONB DEFAULT '{}',
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash VARCHAR(64),

    external_created_at TIMESTAMPTZ,
    external_updated_at TIMESTAMPTZ,

    UNIQUE(integration_id, external_id)
);

COMMENT ON TABLE public.external_appointments IS
'Citas sincronizadas de sistemas externos (Calendly, Google Calendar, etc.).
linked_appointment_id vincula con citas de TIS TIS si corresponde.';

-- =====================================================
-- STEP 5: TABLE - external_inventory
-- Inventario de POS/sistemas externos (para restaurantes)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.external_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- External IDs
    external_id VARCHAR(255) NOT NULL,
    external_source VARCHAR(50) NOT NULL,

    -- Item identification
    sku VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(255),

    -- Stock levels
    quantity_on_hand INTEGER DEFAULT 0,
    quantity_reserved INTEGER DEFAULT 0,
    quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    reorder_point INTEGER,               -- Alert when below this
    reorder_quantity INTEGER,            -- Suggested order quantity

    -- Pricing
    unit_cost DECIMAL(10, 2),            -- Cost per unit
    unit_price DECIMAL(10, 2),           -- Sale price per unit
    price_currency VARCHAR(3) DEFAULT 'MXN',

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_low_stock BOOLEAN GENERATED ALWAYS AS (quantity_on_hand <= COALESCE(reorder_point, 0)) STORED,

    -- Location
    warehouse_name VARCHAR(255),
    warehouse_external_id VARCHAR(255),

    -- Sync metadata
    raw_data JSONB DEFAULT '{}',
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash VARCHAR(64),

    external_updated_at TIMESTAMPTZ,

    UNIQUE(integration_id, external_id)
);

COMMENT ON TABLE public.external_inventory IS
'Inventario sincronizado de POS/sistemas de inventario.
is_low_stock se calcula automáticamente para alertas proactivas.';

-- =====================================================
-- STEP 6: TABLE - external_products
-- Productos/servicios de POS (menús, catálogos)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.external_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- External IDs
    external_id VARCHAR(255) NOT NULL,
    external_source VARCHAR(50) NOT NULL,

    -- Linked TIS TIS entity
    linked_service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,

    -- Product data (normalized)
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(255),
    subcategory VARCHAR(255),

    -- Pricing
    price DECIMAL(10, 2),
    compare_at_price DECIMAL(10, 2),     -- Original price (for discounts)
    price_currency VARCHAR(3) DEFAULT 'MXN',

    -- For restaurants
    is_available BOOLEAN DEFAULT true,
    preparation_time_minutes INTEGER,
    calories INTEGER,
    allergens TEXT[],                     -- ['gluten', 'dairy', 'nuts']

    -- Images
    image_url TEXT,
    image_urls TEXT[],

    -- Modifiers/variants
    has_variants BOOLEAN DEFAULT false,
    variants JSONB DEFAULT '[]',          -- [{name, price, sku}]
    modifiers JSONB DEFAULT '[]',         -- [{name, options, required}]

    -- Sync metadata
    raw_data JSONB DEFAULT '{}',
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash VARCHAR(64),

    external_updated_at TIMESTAMPTZ,

    UNIQUE(integration_id, external_id)
);

COMMENT ON TABLE public.external_products IS
'Productos/servicios sincronizados de POS (menús, catálogos).
Para restaurantes incluye tiempo de preparación, alérgenos, etc.';

-- =====================================================
-- STEP 7: TABLE - integration_sync_logs
-- Auditoría de sincronizaciones
-- =====================================================

CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- Sync info
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN (
        'contacts', 'appointments', 'products', 'inventory', 'orders', 'full'
    )),
    sync_direction VARCHAR(20) NOT NULL CHECK (sync_direction IN (
        'inbound', 'outbound'
    )),
    sync_trigger VARCHAR(20) DEFAULT 'scheduled' CHECK (sync_trigger IN (
        'scheduled',  -- Cron job
        'manual',     -- Usuario hizo click en "Sync Now"
        'webhook',    -- Triggered by incoming webhook
        'realtime'    -- Cambio detectado en tiempo real
    )),

    -- Results
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'started', 'in_progress', 'completed', 'partial', 'failed', 'cancelled'
    )),
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,    -- Deduplicados o sin cambios
    records_failed INTEGER DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Error details
    error_message TEXT,
    error_details JSONB,
    failed_records JSONB DEFAULT '[]',    -- IDs of records that failed

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-calculate duration on completion
CREATE OR REPLACE FUNCTION public.calculate_sync_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
        NEW.duration_ms := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_sync_duration
    BEFORE UPDATE OF completed_at ON public.integration_sync_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_sync_duration();

COMMENT ON TABLE public.integration_sync_logs IS
'Auditoría de todas las sincronizaciones de integraciones.
Incluye estadísticas de registros procesados, errores, duración.';

-- =====================================================
-- STEP 8: TABLE - integration_actions
-- Acciones bidireccionales configuradas
-- =====================================================

CREATE TABLE IF NOT EXISTS public.integration_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- Action definition
    action_name VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'create', 'update', 'delete', 'sync', 'notify', 'custom'
    )),

    -- Trigger configuration
    trigger_event VARCHAR(100) NOT NULL,  -- 'lead_created', 'appointment_confirmed', etc.
    trigger_conditions JSONB DEFAULT '{}', -- {"lead_score": {"gte": 80}}

    -- Direction
    direction VARCHAR(20) NOT NULL CHECK (direction IN (
        'tistis_to_external',  -- TIS TIS cambio → acción en sistema externo
        'external_to_tistis'   -- Sistema externo cambio → acción en TIS TIS
    )),

    -- Action details
    action_config JSONB DEFAULT '{}',     -- Configuration for the action
    field_mapping JSONB DEFAULT '{}',     -- Field mapping for this specific action

    -- Status
    is_enabled BOOLEAN DEFAULT true,

    -- Stats
    executions_total INTEGER DEFAULT 0,
    executions_success INTEGER DEFAULT 0,
    executions_failed INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    last_error_message TEXT,

    -- Metadata
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(integration_id, action_name)
);

COMMENT ON TABLE public.integration_actions IS
'Configuración de acciones bidireccionales.
Ejemplo: Cuando lead.score >= 80 → crear Contact en HubSpot
Ejemplo: Cuando stock < 10% → alertar al owner via WhatsApp';

-- =====================================================
-- STEP 9: INDEXES for performance
-- =====================================================

-- integration_connections indexes
CREATE INDEX IF NOT EXISTS idx_integration_connections_tenant
    ON public.integration_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status
    ON public.integration_connections(status) WHERE status = 'connected';
CREATE INDEX IF NOT EXISTS idx_integration_connections_next_sync
    ON public.integration_connections(next_sync_at)
    WHERE sync_enabled = true AND status = 'connected';
CREATE INDEX IF NOT EXISTS idx_integration_connections_type
    ON public.integration_connections(tenant_id, integration_type);

-- external_contacts indexes (critical for deduplication)
CREATE INDEX IF NOT EXISTS idx_external_contacts_tenant
    ON public.external_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_external_contacts_phone_normalized
    ON public.external_contacts(tenant_id, phone_normalized)
    WHERE phone_normalized IS NOT NULL AND phone_normalized != '';
CREATE INDEX IF NOT EXISTS idx_external_contacts_email
    ON public.external_contacts(tenant_id, LOWER(email))
    WHERE email IS NOT NULL AND email != '';
CREATE INDEX IF NOT EXISTS idx_external_contacts_linked_lead
    ON public.external_contacts(linked_lead_id)
    WHERE linked_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_contacts_dedup_status
    ON public.external_contacts(tenant_id, dedup_status)
    WHERE dedup_status = 'pending';

-- external_appointments indexes
CREATE INDEX IF NOT EXISTS idx_external_appointments_tenant
    ON public.external_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_external_appointments_scheduled
    ON public.external_appointments(tenant_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_external_appointments_status
    ON public.external_appointments(status)
    WHERE status IN ('scheduled', 'confirmed');

-- external_inventory indexes
CREATE INDEX IF NOT EXISTS idx_external_inventory_tenant
    ON public.external_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_external_inventory_low_stock
    ON public.external_inventory(tenant_id, is_low_stock)
    WHERE is_low_stock = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_external_inventory_sku
    ON public.external_inventory(tenant_id, sku)
    WHERE sku IS NOT NULL;

-- external_products indexes
CREATE INDEX IF NOT EXISTS idx_external_products_tenant
    ON public.external_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_external_products_available
    ON public.external_products(tenant_id, is_available)
    WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_external_products_category
    ON public.external_products(tenant_id, category);

-- integration_sync_logs indexes
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_integration
    ON public.integration_sync_logs(integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_status
    ON public.integration_sync_logs(status)
    WHERE status IN ('started', 'in_progress');

-- integration_actions indexes
CREATE INDEX IF NOT EXISTS idx_integration_actions_integration
    ON public.integration_actions(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_actions_trigger
    ON public.integration_actions(trigger_event)
    WHERE is_enabled = true;

-- =====================================================
-- STEP 10: RLS POLICIES
-- =====================================================

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_actions ENABLE ROW LEVEL SECURITY;

-- Helper function for RLS (reuse pattern from channel_connections)
CREATE OR REPLACE FUNCTION public.user_has_integration_access(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND tenant_id = p_tenant_id
        AND role IN ('owner', 'admin')
    );
$$;

-- integration_connections policies
DROP POLICY IF EXISTS integration_connections_select ON public.integration_connections;
CREATE POLICY integration_connections_select ON public.integration_connections
    FOR SELECT
    USING (public.user_has_integration_access(tenant_id));

DROP POLICY IF EXISTS integration_connections_insert ON public.integration_connections;
CREATE POLICY integration_connections_insert ON public.integration_connections
    FOR INSERT
    WITH CHECK (public.user_has_integration_access(tenant_id));

DROP POLICY IF EXISTS integration_connections_update ON public.integration_connections;
CREATE POLICY integration_connections_update ON public.integration_connections
    FOR UPDATE
    USING (public.user_has_integration_access(tenant_id));

DROP POLICY IF EXISTS integration_connections_delete ON public.integration_connections;
CREATE POLICY integration_connections_delete ON public.integration_connections
    FOR DELETE
    USING (public.user_has_integration_access(tenant_id));

-- Apply same pattern to all external_* tables
-- external_contacts
DROP POLICY IF EXISTS external_contacts_tenant_isolation ON public.external_contacts;
CREATE POLICY external_contacts_tenant_isolation ON public.external_contacts
    FOR ALL
    USING (public.user_has_integration_access(tenant_id));

-- external_appointments
DROP POLICY IF EXISTS external_appointments_tenant_isolation ON public.external_appointments;
CREATE POLICY external_appointments_tenant_isolation ON public.external_appointments
    FOR ALL
    USING (public.user_has_integration_access(tenant_id));

-- external_inventory
DROP POLICY IF EXISTS external_inventory_tenant_isolation ON public.external_inventory;
CREATE POLICY external_inventory_tenant_isolation ON public.external_inventory
    FOR ALL
    USING (public.user_has_integration_access(tenant_id));

-- external_products
DROP POLICY IF EXISTS external_products_tenant_isolation ON public.external_products;
CREATE POLICY external_products_tenant_isolation ON public.external_products
    FOR ALL
    USING (public.user_has_integration_access(tenant_id));

-- integration_sync_logs
DROP POLICY IF EXISTS integration_sync_logs_tenant_isolation ON public.integration_sync_logs;
CREATE POLICY integration_sync_logs_tenant_isolation ON public.integration_sync_logs
    FOR ALL
    USING (public.user_has_integration_access(tenant_id));

-- integration_actions
DROP POLICY IF EXISTS integration_actions_tenant_isolation ON public.integration_actions;
CREATE POLICY integration_actions_tenant_isolation ON public.integration_actions
    FOR ALL
    USING (public.user_has_integration_access(tenant_id));

-- Service role bypass for all tables (needed for webhooks and cron jobs)
DROP POLICY IF EXISTS integration_connections_service_role ON public.integration_connections;
CREATE POLICY integration_connections_service_role ON public.integration_connections
    FOR ALL
    TO service_role
    USING (true);

DROP POLICY IF EXISTS external_contacts_service_role ON public.external_contacts;
CREATE POLICY external_contacts_service_role ON public.external_contacts
    FOR ALL
    TO service_role
    USING (true);

DROP POLICY IF EXISTS external_appointments_service_role ON public.external_appointments;
CREATE POLICY external_appointments_service_role ON public.external_appointments
    FOR ALL
    TO service_role
    USING (true);

DROP POLICY IF EXISTS external_inventory_service_role ON public.external_inventory;
CREATE POLICY external_inventory_service_role ON public.external_inventory
    FOR ALL
    TO service_role
    USING (true);

DROP POLICY IF EXISTS external_products_service_role ON public.external_products;
CREATE POLICY external_products_service_role ON public.external_products
    FOR ALL
    TO service_role
    USING (true);

DROP POLICY IF EXISTS integration_sync_logs_service_role ON public.integration_sync_logs;
CREATE POLICY integration_sync_logs_service_role ON public.integration_sync_logs
    FOR ALL
    TO service_role
    USING (true);

DROP POLICY IF EXISTS integration_actions_service_role ON public.integration_actions;
CREATE POLICY integration_actions_service_role ON public.integration_actions
    FOR ALL
    TO service_role
    USING (true);

-- =====================================================
-- STEP 11: RPC - Find matching lead for deduplication
-- =====================================================

CREATE OR REPLACE FUNCTION public.find_matching_lead_for_dedup(
    p_tenant_id UUID,
    p_phone TEXT,
    p_email TEXT
)
RETURNS TABLE(
    lead_id UUID,
    match_type TEXT,
    confidence DECIMAL(3,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_phone_normalized TEXT;
BEGIN
    -- Normalize input phone using the same logic as leads table
    v_phone_normalized := public.normalize_phone_number(p_phone);

    RETURN QUERY
    WITH matches AS (
        SELECT
            l.id,
            CASE
                -- Exact phone match = highest confidence
                -- OPTIMIZACIÓN: Usar phone_normalized de leads (pre-calculado) en lugar
                -- de llamar normalize_phone_number(l.phone) en cada fila
                WHEN l.phone_normalized IS NOT NULL
                     AND l.phone_normalized = v_phone_normalized
                     AND v_phone_normalized != ''
                THEN 'phone'
                -- Exact email match = high confidence
                WHEN l.email IS NOT NULL
                     AND LOWER(l.email) = LOWER(p_email)
                     AND p_email IS NOT NULL
                     AND p_email != ''
                THEN 'email'
                ELSE NULL
            END as match_type,
            CASE
                -- Phone matches are most reliable
                WHEN l.phone_normalized IS NOT NULL
                     AND l.phone_normalized = v_phone_normalized
                     AND v_phone_normalized != ''
                THEN 0.95::DECIMAL(3,2)
                -- Email matches are also very reliable
                WHEN l.email IS NOT NULL
                     AND LOWER(l.email) = LOWER(p_email)
                     AND p_email IS NOT NULL
                     AND p_email != ''
                THEN 0.90::DECIMAL(3,2)
                ELSE 0.00::DECIMAL(3,2)
            END as confidence
        FROM public.leads l
        WHERE l.tenant_id = p_tenant_id
          AND l.deleted_at IS NULL  -- No buscar en leads eliminados
          AND (
              -- Match by normalized phone (usando índice en phone_normalized)
              (v_phone_normalized != '' AND l.phone_normalized = v_phone_normalized)
              OR
              -- Match by email (case insensitive)
              (p_email IS NOT NULL AND p_email != '' AND LOWER(l.email) = LOWER(p_email))
          )
    )
    SELECT
        m.id as lead_id,
        m.match_type,
        m.confidence
    FROM matches m
    WHERE m.match_type IS NOT NULL
    ORDER BY m.confidence DESC
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.find_matching_lead_for_dedup IS
'Busca un lead existente que coincida con phone o email para deduplicación.
Retorna el lead_id con mayor confianza de match.
Phone match = 0.95, Email match = 0.90';

-- =====================================================
-- STEP 12: RPC - Get tenant external data for AI
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_tenant_external_data(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_has_integrations BOOLEAN;
BEGIN
    -- Quick check if tenant has any active integrations
    SELECT EXISTS (
        SELECT 1 FROM public.integration_connections
        WHERE tenant_id = p_tenant_id
        AND status = 'connected'
        AND sync_enabled = true
    ) INTO v_has_integrations;

    -- If no integrations, return null quickly
    IF NOT v_has_integrations THEN
        RETURN NULL;
    END IF;

    -- Build external data object
    v_result := jsonb_build_object(
        'has_integrations', true,

        -- Source systems connected
        'source_systems', COALESCE((
            SELECT jsonb_agg(DISTINCT integration_type)
            FROM public.integration_connections
            WHERE tenant_id = p_tenant_id AND status = 'connected'
        ), '[]'::jsonb),

        -- Low stock alerts (for restaurants/retail)
        'low_stock_items', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'name', ei.name,
                'sku', ei.sku,
                'quantity', ei.quantity_on_hand,
                'reorder_point', ei.reorder_point,
                'category', ei.category
            ))
            FROM public.external_inventory ei
            WHERE ei.tenant_id = p_tenant_id
              AND ei.is_low_stock = true
              AND ei.is_active = true
            LIMIT 10
        ), '[]'::jsonb),

        -- Products/menu items available
        'external_products', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'name', ep.name,
                'price', ep.price,
                'category', ep.category,
                'is_available', ep.is_available,
                'preparation_time', ep.preparation_time_minutes
            ))
            FROM public.external_products ep
            WHERE ep.tenant_id = p_tenant_id
              AND ep.is_available = true
            ORDER BY ep.category, ep.name
            LIMIT 50
        ), '[]'::jsonb),

        -- Upcoming external appointments (next 7 days)
        'external_appointments_count', COALESCE((
            SELECT COUNT(*)::INTEGER
            FROM public.external_appointments ea
            WHERE ea.tenant_id = p_tenant_id
              AND ea.scheduled_at >= NOW()
              AND ea.scheduled_at < NOW() + INTERVAL '7 days'
              AND ea.status IN ('scheduled', 'confirmed')
        ), 0),

        -- Last sync timestamp
        'last_sync_at', (
            SELECT MAX(last_sync_at)
            FROM public.integration_connections
            WHERE tenant_id = p_tenant_id AND status = 'connected'
        )
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_tenant_external_data IS
'Retorna datos externos para el contexto del AI.
Se llama en paralelo con get_tenant_ai_context() para no bloquear.
Incluye: sistemas conectados, alertas de stock bajo, productos externos.';

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_tenant_external_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_external_data(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_matching_lead_for_dedup(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_matching_lead_for_dedup(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.normalize_phone_number(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_phone_number(TEXT) TO service_role;

-- =====================================================
-- STEP 13: Updated_at triggers
-- =====================================================

-- Reuse existing trigger function if available, or create
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_integration_connections
    BEFORE UPDATE ON public.integration_connections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_integration_actions
    BEFORE UPDATE ON public.integration_actions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- DONE
-- =====================================================

COMMENT ON SCHEMA public IS
'TIS TIS Platform schema - Integration Hub added in migration 078.
New tables: integration_connections, external_contacts, external_appointments,
external_inventory, external_products, integration_sync_logs, integration_actions.
RPC functions: get_tenant_external_data(), find_matching_lead_for_dedup().';

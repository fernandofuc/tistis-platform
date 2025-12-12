-- =====================================================
-- TIS TIS PLATFORM - SCHEMA CONSOLIDADO COMPLETO
-- Version: 1.0
-- Migration: 012_CONSOLIDATED_SCHEMA.sql
-- Date: December 11, 2024
--
-- PURPOSE: Schema unificado que incluye:
-- - Orquestador TIS TIS (clients, proposals, assembly)
-- - Micro-apps multi-tenant (tenants, leads, appointments)
-- - Precios actualizados ($3,490 - $19,990 MXN)
-- - RLS completo y funciones helper
--
-- INSTRUCCIONES:
-- Ejecutar SOLO en Supabase de TIS TIS que tiene schema básico
-- Este SQL agrega todo lo que falta sin romper lo existente
-- =====================================================

-- =====================================================
-- PARTE A: EXTENSIONES Y PREPARACIÓN
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Función helper para updated_at (si no existe)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PARTE B: TABLAS DEL ORQUESTADOR TIS TIS
-- (Algunas ya existen, usamos IF NOT EXISTS)
-- =====================================================

-- B1: Actualizar tabla plans con precios correctos
-- Primero actualizamos los precios existentes
UPDATE public.plans SET
    monthly_price = 3490,
    activation_fee = 0
WHERE id = 'starter' AND monthly_price < 3000;

UPDATE public.plans SET
    monthly_price = 7490,
    activation_fee = 0
WHERE id = 'essentials' AND monthly_price < 7000;

UPDATE public.plans SET
    monthly_price = 12490,
    activation_fee = 0
WHERE id = 'growth' AND monthly_price < 12000;

UPDATE public.plans SET
    monthly_price = 19990,
    activation_fee = 0
WHERE id = 'scale' AND monthly_price < 19000;

-- Si no existen los planes, insertarlos
INSERT INTO public.plans (id, name, description, monthly_price, activation_fee, max_locations, max_users, features, is_popular, display_order)
VALUES
    ('starter', 'Starter', 'Para negocios que inician su transformación digital', 3490, 0, 1, 3,
     '["dashboard_basico", "chat_soporte", "reportes_semanales", "1_integracion"]'::jsonb, false, 1),
    ('essentials', 'Essentials', 'Todo lo necesario para operar eficientemente', 7490, 0, 2, 10,
     '["dashboard_completo", "inventario_basico", "alertas_stock", "integraciones_ilimitadas", "soporte_prioritario", "reportes_diarios"]'::jsonb, true, 2),
    ('growth', 'Growth', 'Para negocios en expansión que necesitan escalar', 12490, 0, 5, 25,
     '["todo_essentials", "prediccion_demanda", "multi_sucursal", "reportes_avanzados", "api_access", "analytics_avanzado"]'::jsonb, false, 3),
    ('scale', 'Scale', 'Solución enterprise con automatización completa', 19990, 0, 999, 999,
     '["todo_growth", "automatizacion_completa", "soporte_dedicado", "sla_garantizado", "integraciones_custom", "white_label"]'::jsonb, false, 4)
ON CONFLICT (id) DO UPDATE SET
    monthly_price = EXCLUDED.monthly_price,
    activation_fee = EXCLUDED.activation_fee,
    features = EXCLUDED.features;

-- B2: Component Registry (Assembly Engine)
CREATE TABLE IF NOT EXISTS public.component_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_name TEXT NOT NULL UNIQUE,
    component_display_name TEXT NOT NULL,
    component_description TEXT NOT NULL,
    component_type TEXT NOT NULL CHECK (component_type IN (
        'core', 'plan_feature', 'vertical_module', 'addon', 'integration'
    )),
    vertical_applicable TEXT[],
    min_plan_required TEXT CHECK (min_plan_required IN (
        'starter', 'essentials', 'growth', 'scale', 'enterprise'
    )),
    workflow_file TEXT,
    dependencies TEXT[] DEFAULT '{}',
    config_template JSONB NOT NULL DEFAULT '{"required_vars": [], "optional_vars": []}'::jsonb,
    feature_flags TEXT[] DEFAULT '{}',
    dashboard_widgets JSONB DEFAULT '[]'::jsonb,
    setup_instructions TEXT,
    estimated_setup_minutes INTEGER DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_deprecated BOOLEAN NOT NULL DEFAULT false,
    deployment_order INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- B3: Deployment Log
CREATE TABLE IF NOT EXISTS public.deployment_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES public.proposals(id),
    subscription_id UUID REFERENCES public.subscriptions(id),
    deployment_plan JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_progress', 'completed', 'failed', 'cancelled', 'partial'
    )),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    components_count INTEGER NOT NULL DEFAULT 0,
    components_completed INTEGER DEFAULT 0,
    current_step INTEGER DEFAULT 0,
    estimated_duration_minutes INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    error_details JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- B4: Feature Flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    source_component TEXT,
    override_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(client_id, feature_key)
);

-- B5: Notification Queue (interno TIS TIS)
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'new_subscription', 'deployment_complete', 'deployment_failed',
        'payment_received', 'payment_failed', 'support_ticket', 'system_alert'
    )),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('internal_team', 'client', 'both')),
    recipient_emails TEXT[],
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- B6: Vertical Configs (qué módulos por vertical)
CREATE TABLE IF NOT EXISTS public.vertical_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical VARCHAR(50) NOT NULL UNIQUE CHECK (vertical IN (
        'dental', 'restaurant', 'pharmacy', 'retail', 'medical', 'services', 'other'
    )),
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'building',
    primary_color VARCHAR(7) DEFAULT '#667eea',
    modules_enabled JSONB NOT NULL DEFAULT '[]',
    sidebar_config JSONB NOT NULL DEFAULT '[]',
    dashboard_widgets JSONB DEFAULT '[]',
    default_services JSONB DEFAULT '[]',
    onboarding_steps JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar configuraciones de verticales
INSERT INTO public.vertical_configs (vertical, display_name, description, icon, modules_enabled, sidebar_config)
VALUES
    ('dental', 'Clínica Dental', 'Gestión completa para clínicas dentales', 'tooth',
     '["leads", "appointments", "patients", "clinical_history", "quotes", "conversations", "analytics"]'::jsonb,
     '[{"id": "dashboard", "label": "Dashboard", "icon": "LayoutDashboard", "href": "/dashboard"},
       {"id": "leads", "label": "Leads", "icon": "Users", "href": "/dashboard/leads"},
       {"id": "calendario", "label": "Calendario", "icon": "Calendar", "href": "/dashboard/calendario"},
       {"id": "patients", "label": "Pacientes", "icon": "UserCheck", "href": "/dashboard/patients"},
       {"id": "inbox", "label": "Inbox", "icon": "MessageSquare", "href": "/dashboard/inbox"},
       {"id": "quotes", "label": "Cotizaciones", "icon": "FileText", "href": "/dashboard/quotes"},
       {"id": "analytics", "label": "Analytics", "icon": "BarChart3", "href": "/dashboard/analytics"},
       {"id": "settings", "label": "Configuración", "icon": "Settings", "href": "/dashboard/settings"}]'::jsonb),
    ('restaurant', 'Restaurante', 'Gestión para restaurantes y servicios de comida', 'utensils',
     '["orders", "inventory", "menu", "reservations", "delivery", "analytics"]'::jsonb,
     '[{"id": "dashboard", "label": "Dashboard", "icon": "LayoutDashboard", "href": "/dashboard"},
       {"id": "orders", "label": "Órdenes", "icon": "ShoppingBag", "href": "/dashboard/orders"},
       {"id": "menu", "label": "Menú", "icon": "BookOpen", "href": "/dashboard/menu"},
       {"id": "inventory", "label": "Inventario", "icon": "Package", "href": "/dashboard/inventory"},
       {"id": "reservations", "label": "Reservaciones", "icon": "Calendar", "href": "/dashboard/reservations"},
       {"id": "analytics", "label": "Analytics", "icon": "BarChart3", "href": "/dashboard/analytics"},
       {"id": "settings", "label": "Configuración", "icon": "Settings", "href": "/dashboard/settings"}]'::jsonb),
    ('medical', 'Clínica Médica', 'Gestión para consultorios y clínicas médicas', 'stethoscope',
     '["leads", "appointments", "patients", "clinical_history", "prescriptions", "analytics"]'::jsonb,
     '[{"id": "dashboard", "label": "Dashboard", "icon": "LayoutDashboard", "href": "/dashboard"},
       {"id": "patients", "label": "Pacientes", "icon": "Users", "href": "/dashboard/patients"},
       {"id": "calendario", "label": "Citas", "icon": "Calendar", "href": "/dashboard/calendario"},
       {"id": "analytics", "label": "Analytics", "icon": "BarChart3", "href": "/dashboard/analytics"},
       {"id": "settings", "label": "Configuración", "icon": "Settings", "href": "/dashboard/settings"}]'::jsonb),
    ('services', 'Servicios Generales', 'Gestión para negocios de servicios', 'briefcase',
     '["leads", "appointments", "quotes", "conversations", "analytics"]'::jsonb,
     '[{"id": "dashboard", "label": "Dashboard", "icon": "LayoutDashboard", "href": "/dashboard"},
       {"id": "leads", "label": "Leads", "icon": "Users", "href": "/dashboard/leads"},
       {"id": "calendario", "label": "Citas", "icon": "Calendar", "href": "/dashboard/calendario"},
       {"id": "inbox", "label": "Inbox", "icon": "MessageSquare", "href": "/dashboard/inbox"},
       {"id": "analytics", "label": "Analytics", "icon": "BarChart3", "href": "/dashboard/analytics"},
       {"id": "settings", "label": "Configuración", "icon": "Settings", "href": "/dashboard/settings"}]'::jsonb)
ON CONFLICT (vertical) DO UPDATE SET
    modules_enabled = EXCLUDED.modules_enabled,
    sidebar_config = EXCLUDED.sidebar_config;

COMMENT ON TABLE public.vertical_configs IS 'Configuración de módulos y sidebar por tipo de negocio';

-- =====================================================
-- PARTE C: TABLAS DE MICRO-APPS (Multi-tenant)
-- =====================================================

-- C1: Tenants (Clientes activos de TIS TIS)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Vinculación con client de TIS TIS
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,

    -- Identificación
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    legal_name VARCHAR(255),

    -- Categorización
    vertical VARCHAR(50) NOT NULL CHECK (vertical IN (
        'dental', 'restaurant', 'pharmacy', 'retail', 'medical', 'services', 'other'
    )),

    -- Plan TIS TIS
    plan VARCHAR(50) DEFAULT 'starter' CHECK (plan IN (
        'starter', 'essentials', 'growth', 'scale'
    )),
    plan_started_at TIMESTAMPTZ,
    plan_expires_at TIMESTAMPTZ,

    -- Configuración
    settings JSONB DEFAULT '{}',
    features_enabled JSONB DEFAULT '[]',

    -- Branding
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#667eea',

    -- Contacto principal
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(20),

    -- Estado
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
        'trial', 'active', 'suspended', 'cancelled'
    )),

    -- Timestamps
    onboarded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_client_id ON public.tenants(client_id);
CREATE INDEX IF NOT EXISTS idx_tenants_vertical ON public.tenants(vertical);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status) WHERE deleted_at IS NULL;

-- C2: Branches (Sucursales)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Identificación
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    branch_code VARCHAR(20),

    -- Ubicación
    address TEXT,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    country VARCHAR(50) DEFAULT 'Mexico',
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    google_maps_url TEXT,

    -- Contacto
    phone VARCHAR(20),
    whatsapp_number VARCHAR(20),
    email VARCHAR(255),

    -- Operación
    timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
    operating_hours JSONB DEFAULT '{}'::jsonb,
    is_headquarters BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    -- Configuración de citas
    appointment_duration_default INTEGER DEFAULT 30,
    advance_booking_days INTEGER DEFAULT 30,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branches_tenant_id ON public.branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branches_slug ON public.branches(tenant_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_tenant_slug ON public.branches(tenant_id, slug);

-- C3: Staff (Personal)
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Usuario vinculado
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Información personal
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    whatsapp_number VARCHAR(20),
    avatar_url TEXT,

    -- Rol
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'owner', 'admin', 'manager', 'dentist', 'specialist',
        'receptionist', 'assistant', 'staff'
    )),
    role_title VARCHAR(100),

    -- Especialidad (para médicos/dentistas)
    specialty VARCHAR(100),
    license_number VARCHAR(50),

    -- Estado
    is_active BOOLEAN DEFAULT true,

    -- Configuración
    notification_preferences JSONB DEFAULT '{"email": true, "whatsapp": true, "sms": false}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_tenant_id ON public.staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff(tenant_id, role);

-- C4: Staff-Branch Assignment
CREATE TABLE IF NOT EXISTS public.staff_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, branch_id)
);

-- C5: User Roles (Multi-tenant access control)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'super_admin', 'admin', 'owner', 'manager', 'dentist',
        'specialist', 'receptionist', 'staff', 'assistant'
    )),
    staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON public.user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- =====================================================
-- PARTE D: LEADS Y APPOINTMENTS
-- =====================================================

-- D1: Leads (Prospectos)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

    -- Contacto
    phone VARCHAR(20) NOT NULL,
    phone_normalized VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255),
    email VARCHAR(255),

    -- Origen
    source VARCHAR(50) DEFAULT 'whatsapp' CHECK (source IN (
        'whatsapp', 'instagram', 'facebook', 'website', 'referral',
        'walk_in', 'phone', 'google', 'tiktok', 'other'
    )),
    source_details JSONB DEFAULT '{}',
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),

    -- Clasificación
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN (
        'new', 'contacted', 'qualified', 'appointment_scheduled',
        'converted', 'lost', 'inactive'
    )),
    classification VARCHAR(20) DEFAULT 'warm' CHECK (classification IN (
        'hot', 'warm', 'cold'
    )),
    score INTEGER DEFAULT 50 CHECK (score >= 0 AND score <= 100),

    -- Intereses
    interested_services TEXT[] DEFAULT '{}',
    notes TEXT,
    tags TEXT[] DEFAULT '{}',

    -- Asignación
    assigned_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,

    -- Seguimiento
    last_contact_at TIMESTAMPTZ,
    next_followup_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_classification ON public.leads(tenant_id, classification);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_staff ON public.leads(assigned_staff_id) WHERE assigned_staff_id IS NOT NULL;

-- D2: Services (Catálogo de servicios)
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Identificación
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    sku VARCHAR(50),
    description TEXT,
    short_description VARCHAR(500),

    -- Categorización
    category VARCHAR(100),
    subcategory VARCHAR(100),

    -- Precios
    price_min DECIMAL(10, 2),
    price_max DECIMAL(10, 2),
    price_unit VARCHAR(50) DEFAULT 'per_service' CHECK (price_unit IN (
        'per_service', 'per_hour', 'per_session', 'per_tooth', 'per_unit'
    )),
    currency VARCHAR(3) DEFAULT 'MXN',
    price_variants JSONB DEFAULT '[]',

    -- Duración
    duration_minutes INTEGER DEFAULT 60,
    sessions_required INTEGER DEFAULT 1,

    -- Configuración
    requires_consultation BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,

    -- SEO/AI
    keywords TEXT[] DEFAULT '{}',
    ai_description TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON public.services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(tenant_id, is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_tenant_slug ON public.services(tenant_id, slug);

-- D3: Appointments (Citas)
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    patient_id UUID, -- Se referenciará después de crear patients

    -- Personal asignado
    staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,

    -- Programación
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    end_time TIMESTAMPTZ,

    -- Estado
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'confirmed', 'in_progress', 'completed',
        'cancelled', 'no_show', 'rescheduled'
    )),

    -- Recordatorios
    confirmation_sent BOOLEAN DEFAULT false,
    reminder_24h_sent BOOLEAN DEFAULT false,
    reminder_2h_sent BOOLEAN DEFAULT false,

    -- Notas
    notes TEXT,
    cancellation_reason TEXT,
    internal_notes TEXT,

    -- Reagendamiento
    rescheduled_from_id UUID REFERENCES public.appointments(id),
    rescheduled_to_id UUID,

    -- Creación
    created_by_staff_id UUID REFERENCES public.staff(id),
    booking_source VARCHAR(50) DEFAULT 'manual' CHECK (booking_source IN (
        'manual', 'whatsapp', 'website', 'phone', 'walk_in'
    )),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON public.appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_branch_id ON public.appointments(branch_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON public.appointments(tenant_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON public.appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_id ON public.appointments(staff_id);
-- Nota: Índice para citas de hoy removido porque CURRENT_DATE no es inmutable
-- Se usa índice general idx_appointments_scheduled_at en su lugar

-- =====================================================
-- PARTE E: PATIENTS Y CONVERSATIONS
-- =====================================================

-- E1: Patients (Pacientes/Clientes)
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

    -- Información personal
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_say')),

    -- Contacto
    email VARCHAR(255),
    phone VARCHAR(20),
    phone_secondary VARCHAR(20),
    whatsapp_number VARCHAR(20),

    -- Dirección
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),

    -- Identificación
    government_id VARCHAR(50),
    government_id_type VARCHAR(20),

    -- Médico/Dental específico
    blood_type VARCHAR(5),
    allergies TEXT[] DEFAULT '{}',
    medical_conditions TEXT[] DEFAULT '{}',
    current_medications TEXT[] DEFAULT '{}',
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),

    -- Seguro
    insurance_provider VARCHAR(100),
    insurance_policy_number VARCHAR(50),
    insurance_group_number VARCHAR(50),

    -- Estado
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
        'active', 'inactive', 'archived'
    )),

    -- Notas
    notes TEXT,
    internal_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_tenant_id ON public.patients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patients_lead_id ON public.patients(lead_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_patients_email ON public.patients(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_patients_name ON public.patients(tenant_id, last_name, first_name);

-- Agregar referencia de appointments a patients (solo si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_appointments_patient'
        AND table_name = 'appointments'
    ) THEN
        ALTER TABLE public.appointments
        ADD CONSTRAINT fk_appointments_patient
        FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;
    END IF;
END $$;

-- E2: Clinical History (Historial Clínico)
CREATE TABLE IF NOT EXISTS public.clinical_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,

    -- Registro
    record_type VARCHAR(50) NOT NULL CHECK (record_type IN (
        'consultation', 'treatment', 'diagnosis', 'prescription',
        'lab_result', 'imaging', 'procedure', 'note', 'follow_up'
    )),
    record_date TIMESTAMPTZ DEFAULT NOW(),

    -- Contenido
    chief_complaint TEXT,
    diagnosis TEXT,
    treatment_performed TEXT,
    treatment_plan TEXT,
    notes TEXT,

    -- Dental específico
    teeth_involved TEXT[] DEFAULT '{}',
    procedures_performed JSONB DEFAULT '[]',

    -- Archivos
    attachments JSONB DEFAULT '[]',

    -- Staff
    created_by_staff_id UUID REFERENCES public.staff(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_history_patient ON public.clinical_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_history_tenant ON public.clinical_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clinical_history_date ON public.clinical_history(patient_id, record_date DESC);

-- E3: Conversations (WhatsApp/Chat)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

    -- Canal
    channel VARCHAR(50) DEFAULT 'whatsapp' CHECK (channel IN (
        'whatsapp', 'instagram', 'facebook', 'webchat', 'sms'
    )),
    channel_conversation_id VARCHAR(255),

    -- Estado
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
        'active', 'waiting_response', 'escalated', 'resolved', 'archived'
    )),

    -- IA
    ai_handling BOOLEAN DEFAULT true,
    current_intent VARCHAR(100),
    context JSONB DEFAULT '{}',

    -- Escalación
    escalated_at TIMESTAMPTZ,
    escalated_to_staff_id UUID REFERENCES public.staff(id),
    escalation_reason TEXT,

    -- Resolución
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,

    -- Métricas
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    first_response_time_seconds INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON public.conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead ON public.conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON public.conversations(tenant_id, channel);

-- E4: Messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,

    -- Mensaje
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'staff')),
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text' CHECK (content_type IN (
        'text', 'image', 'audio', 'video', 'document', 'location', 'template'
    )),

    -- IDs externos
    channel_message_id VARCHAR(255),
    whatsapp_message_id VARCHAR(255),

    -- Staff que envió (si aplica)
    sent_by_staff_id UUID REFERENCES public.staff(id),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Estado
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN (
        'pending', 'sent', 'delivered', 'read', 'failed'
    )),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(conversation_id, created_at DESC);

-- =====================================================
-- PARTE F: QUOTES, FAQs, NOTIFICATIONS
-- =====================================================

-- F1: Quotes (Cotizaciones)
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

    -- Número de cotización
    quote_number VARCHAR(50) NOT NULL,

    -- Estado
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted'
    )),

    -- Montos
    subtotal DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    discount_reason TEXT,
    tax_rate DECIMAL(5, 2) DEFAULT 16.00,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    total DECIMAL(12, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'MXN',

    -- Validez
    valid_until DATE,
    expires_at TIMESTAMPTZ,

    -- Notas
    notes TEXT,
    terms_and_conditions TEXT,
    internal_notes TEXT,

    -- Tracking
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Staff
    created_by_staff_id UUID REFERENCES public.staff(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_tenant ON public.quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_lead ON public.quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotes_patient ON public.quotes(patient_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_number ON public.quotes(tenant_id, quote_number);

-- F2: Quote Items
CREATE TABLE IF NOT EXISTS public.quote_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,

    -- Descripción
    description TEXT NOT NULL,
    service_name VARCHAR(255),

    -- Cantidades
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL,

    -- Dental específico
    teeth_involved TEXT[] DEFAULT '{}',

    -- Orden
    display_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON public.quote_items(quote_id);

-- F3: Quote Payment Plans
CREATE TABLE IF NOT EXISTS public.quote_payment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,

    -- Plan
    plan_name VARCHAR(100) NOT NULL,
    installments INTEGER NOT NULL,
    installment_amount DECIMAL(12, 2) NOT NULL,
    down_payment DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) DEFAULT 0,

    -- Estado
    is_selected BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_payment_plans_quote ON public.quote_payment_plans(quote_id);

-- F4: FAQs (Base de conocimiento para IA)
CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Contenido
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    short_answer VARCHAR(500),

    -- Categorización
    category VARCHAR(100),
    subcategory VARCHAR(100),

    -- SEO/AI
    keywords TEXT[] DEFAULT '{}',
    question_variations TEXT[] DEFAULT '{}',

    -- Idioma
    language VARCHAR(10) DEFAULT 'es',

    -- Estado
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,

    -- Métricas
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    helpfulness_score DECIMAL(3, 2) DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_tenant ON public.faqs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_faqs_category ON public.faqs(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_faqs_active ON public.faqs(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_faqs_keywords ON public.faqs USING gin(keywords);

-- F5: Tenant Notifications (Notificaciones de la micro-app)
CREATE TABLE IF NOT EXISTS public.tenant_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

    -- Tipo
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'hot_lead', 'new_appointment', 'appointment_reminder',
        'cancellation', 'escalation', 'new_message', 'payment_received',
        'daily_report', 'weekly_report', 'system_alert'
    )),

    -- Destinatario
    recipient_staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),

    -- Contenido
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    action_url TEXT,
    metadata JSONB DEFAULT '{}',

    -- Prioridad
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN (
        'low', 'normal', 'high', 'urgent'
    )),

    -- Canal
    channel VARCHAR(20) DEFAULT 'in_app' CHECK (channel IN (
        'in_app', 'email', 'whatsapp', 'sms', 'push'
    )),

    -- Estado
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'delivered', 'read', 'failed'
    )),

    -- Tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    error_message TEXT,

    -- Referencias
    related_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    related_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    related_conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_notifications_tenant ON public.tenant_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_notifications_recipient ON public.tenant_notifications(recipient_staff_id);
CREATE INDEX IF NOT EXISTS idx_tenant_notifications_status ON public.tenant_notifications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_notifications_type ON public.tenant_notifications(tenant_id, notification_type);

-- F6: Patient Files (Archivos de pacientes)
CREATE TABLE IF NOT EXISTS public.patient_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,

    -- Archivo
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER,
    storage_path TEXT NOT NULL,
    storage_bucket VARCHAR(100) DEFAULT 'patient-files',

    -- Categorización
    category VARCHAR(50) CHECK (category IN (
        'xray', 'photo', 'document', 'lab_result', 'consent_form',
        'insurance', 'prescription', 'other'
    )),
    description TEXT,

    -- Referencias
    clinical_history_id UUID REFERENCES public.clinical_history(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Staff
    uploaded_by_staff_id UUID REFERENCES public.staff(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_files_patient ON public.patient_files(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_tenant ON public.patient_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_files_category ON public.patient_files(patient_id, category);

-- =====================================================
-- PARTE G: VIEWS ÚTILES
-- =====================================================

-- G1: Vista de leads activos con detalles
CREATE OR REPLACE VIEW public.active_leads_view AS
SELECT
    l.id,
    l.tenant_id,
    l.phone,
    l.full_name,
    l.email,
    l.classification,
    l.score,
    l.status,
    l.source,
    l.interested_services,
    l.created_at,
    l.last_contact_at,
    b.name as branch_name,
    s.first_name || ' ' || s.last_name as assigned_staff_name,
    (SELECT COUNT(*) FROM public.appointments a WHERE a.lead_id = l.id) as appointments_count,
    (SELECT COUNT(*) FROM public.conversations c WHERE c.lead_id = l.id) as conversations_count
FROM public.leads l
LEFT JOIN public.branches b ON l.branch_id = b.id
LEFT JOIN public.staff s ON l.assigned_staff_id = s.id
WHERE l.status NOT IN ('converted', 'lost', 'inactive');

-- G2: Vista de citas de hoy
CREATE OR REPLACE VIEW public.today_appointments_view AS
SELECT
    a.id,
    a.tenant_id,
    a.branch_id,
    a.scheduled_at,
    a.duration_minutes,
    a.status,
    a.notes,
    b.name as branch_name,
    COALESCE(p.full_name, l.full_name, 'Sin nombre') as patient_name,
    COALESCE(p.phone, l.phone) as patient_phone,
    s.first_name || ' ' || s.last_name as staff_name,
    sv.name as service_name
FROM public.appointments a
LEFT JOIN public.branches b ON a.branch_id = b.id
LEFT JOIN public.patients p ON a.patient_id = p.id
LEFT JOIN public.leads l ON a.lead_id = l.id
LEFT JOIN public.staff s ON a.staff_id = s.id
LEFT JOIN public.services sv ON a.service_id = sv.id
WHERE a.scheduled_at >= CURRENT_DATE
  AND a.scheduled_at < CURRENT_DATE + INTERVAL '1 day';

-- G3: Vista de cotizaciones con detalles
CREATE OR REPLACE VIEW public.quotes_full_view AS
SELECT
    q.id,
    q.tenant_id,
    q.quote_number,
    q.status,
    q.subtotal,
    q.discount_amount,
    q.tax_amount,
    q.total,
    q.currency,
    q.valid_until,
    q.created_at,
    COALESCE(p.full_name, l.full_name) as client_name,
    COALESCE(p.phone, l.phone) as client_phone,
    COALESCE(p.email, l.email) as client_email,
    s.first_name || ' ' || s.last_name as created_by_name,
    (SELECT COUNT(*) FROM public.quote_items qi WHERE qi.quote_id = q.id) as items_count
FROM public.quotes q
LEFT JOIN public.patients p ON q.patient_id = p.id
LEFT JOIN public.leads l ON q.lead_id = l.id
LEFT JOIN public.staff s ON q.created_by_staff_id = s.id;

-- G4: Vista staff_members (compatibilidad)
CREATE OR REPLACE VIEW public.staff_members AS
SELECT * FROM public.staff;

-- =====================================================
-- PARTE H: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas multi-tenant
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertical_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- H1: FUNCIÓN HELPER - Obtener tenant_id del usuario
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT tenant_id INTO v_tenant_id
    FROM public.user_roles
    WHERE user_id = v_user_id
    AND is_active = true
    LIMIT 1;

    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- H2: FUNCIÓN HELPER - Verificar si es super_admin
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_user_id
        AND role = 'super_admin'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- H3: FUNCIÓN HELPER - Verificar acceso a tenant
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_tenant_access(p_tenant_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Super admin tiene acceso a todo
    IF public.is_super_admin(v_user_id) THEN
        RETURN TRUE;
    END IF;

    -- Verificar si tiene rol activo en ese tenant
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_user_id
        AND tenant_id = p_tenant_id
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- H4: POLÍTICAS RLS - Tablas del Orquestador TIS TIS
-- =====================================================

-- Vertical Configs: Todos pueden leer
DROP POLICY IF EXISTS "Anyone can view vertical_configs" ON public.vertical_configs;
CREATE POLICY "Anyone can view vertical_configs" ON public.vertical_configs
    FOR SELECT USING (true);

-- Component Registry: Todos pueden leer
DROP POLICY IF EXISTS "Anyone can view component_registry" ON public.component_registry;
CREATE POLICY "Anyone can view component_registry" ON public.component_registry
    FOR SELECT USING (true);

-- Deployment Log: Solo super_admin o dueño del client
DROP POLICY IF EXISTS "Users can view own deployment_log" ON public.deployment_log;
CREATE POLICY "Users can view own deployment_log" ON public.deployment_log
    FOR SELECT USING (
        public.is_super_admin() OR
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- Feature Flags: Solo super_admin o dueño del client
DROP POLICY IF EXISTS "Users can view own feature_flags" ON public.feature_flags;
CREATE POLICY "Users can view own feature_flags" ON public.feature_flags
    FOR SELECT USING (
        public.is_super_admin() OR
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

-- Notification Queue: Solo super_admin
DROP POLICY IF EXISTS "Super admin can manage notification_queue" ON public.notification_queue;
CREATE POLICY "Super admin can manage notification_queue" ON public.notification_queue
    FOR ALL USING (public.is_super_admin());

-- =====================================================
-- H5: POLÍTICAS RLS - Tablas Multi-tenant
-- =====================================================

-- Tenants
DROP POLICY IF EXISTS "Users can view tenants they have access to" ON public.tenants;
CREATE POLICY "Users can view tenants they have access to" ON public.tenants
    FOR SELECT USING (public.has_tenant_access(id));

DROP POLICY IF EXISTS "Super admin can manage all tenants" ON public.tenants;
CREATE POLICY "Super admin can manage all tenants" ON public.tenants
    FOR ALL USING (public.is_super_admin());

-- User Roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Admins can manage tenant user_roles" ON public.user_roles;
CREATE POLICY "Admins can manage tenant user_roles" ON public.user_roles
    FOR ALL USING (
        public.is_super_admin() OR
        (tenant_id IN (
            SELECT ur.tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'owner')
            AND ur.is_active = true
        ))
    );

-- Branches
DROP POLICY IF EXISTS "Users can view tenant branches" ON public.branches;
CREATE POLICY "Users can view tenant branches" ON public.branches
    FOR SELECT USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;
CREATE POLICY "Admins can manage branches" ON public.branches
    FOR ALL USING (
        public.is_super_admin() OR
        (tenant_id IN (
            SELECT ur.tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'owner', 'manager')
            AND ur.is_active = true
        ))
    );

-- Staff
DROP POLICY IF EXISTS "Users can view tenant staff" ON public.staff;
CREATE POLICY "Users can view tenant staff" ON public.staff
    FOR SELECT USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Admins can manage staff" ON public.staff;
CREATE POLICY "Admins can manage staff" ON public.staff
    FOR ALL USING (
        public.is_super_admin() OR
        (tenant_id IN (
            SELECT ur.tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'owner')
            AND ur.is_active = true
        ))
    );

-- Leads
DROP POLICY IF EXISTS "Users can view tenant leads" ON public.leads;
CREATE POLICY "Users can view tenant leads" ON public.leads
    FOR SELECT USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Staff can manage leads" ON public.leads;
CREATE POLICY "Staff can manage leads" ON public.leads
    FOR ALL USING (public.has_tenant_access(tenant_id));

-- Services
DROP POLICY IF EXISTS "Users can view tenant services" ON public.services;
CREATE POLICY "Users can view tenant services" ON public.services
    FOR SELECT USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
CREATE POLICY "Admins can manage services" ON public.services
    FOR ALL USING (
        public.is_super_admin() OR
        (tenant_id IN (
            SELECT ur.tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'owner', 'manager')
            AND ur.is_active = true
        ))
    );

-- Appointments
DROP POLICY IF EXISTS "Users can view tenant appointments" ON public.appointments;
CREATE POLICY "Users can view tenant appointments" ON public.appointments
    FOR SELECT USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Staff can manage appointments" ON public.appointments;
CREATE POLICY "Staff can manage appointments" ON public.appointments
    FOR ALL USING (public.has_tenant_access(tenant_id));

-- Patients
DROP POLICY IF EXISTS "Users can view tenant patients" ON public.patients;
CREATE POLICY "Users can view tenant patients" ON public.patients
    FOR SELECT USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Staff can manage patients" ON public.patients;
CREATE POLICY "Staff can manage patients" ON public.patients
    FOR ALL USING (public.has_tenant_access(tenant_id));

-- Clinical History
DROP POLICY IF EXISTS "Users can view tenant clinical_history" ON public.clinical_history;
CREATE POLICY "Users can view tenant clinical_history" ON public.clinical_history
    FOR SELECT USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Medical staff can manage clinical_history" ON public.clinical_history;
CREATE POLICY "Medical staff can manage clinical_history" ON public.clinical_history
    FOR ALL USING (
        tenant_id IN (
            SELECT ur.tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'owner', 'dentist', 'specialist', 'manager')
            AND ur.is_active = true
        )
    );

-- Conversations
DROP POLICY IF EXISTS "Users can view tenant conversations" ON public.conversations;
CREATE POLICY "Users can view tenant conversations" ON public.conversations
    FOR SELECT USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Staff can manage conversations" ON public.conversations;
CREATE POLICY "Staff can manage conversations" ON public.conversations
    FOR ALL USING (public.has_tenant_access(tenant_id));

-- Messages
DROP POLICY IF EXISTS "Users can view conversation messages" ON public.messages;
CREATE POLICY "Users can view conversation messages" ON public.messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT id FROM public.conversations
            WHERE public.has_tenant_access(tenant_id)
        )
    );

DROP POLICY IF EXISTS "Staff can manage messages" ON public.messages;
CREATE POLICY "Staff can manage messages" ON public.messages
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM public.conversations
            WHERE public.has_tenant_access(tenant_id)
        )
    );

-- Quotes
DROP POLICY IF EXISTS "Users can view tenant quotes" ON public.quotes;
CREATE POLICY "Users can view tenant quotes" ON public.quotes
    FOR SELECT USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Staff can manage quotes" ON public.quotes;
CREATE POLICY "Staff can manage quotes" ON public.quotes
    FOR ALL USING (public.has_tenant_access(tenant_id));

-- Quote Items
DROP POLICY IF EXISTS "Users can view quote items" ON public.quote_items;
CREATE POLICY "Users can view quote items" ON public.quote_items
    FOR SELECT USING (
        quote_id IN (SELECT id FROM public.quotes WHERE public.has_tenant_access(tenant_id))
    );

DROP POLICY IF EXISTS "Staff can manage quote items" ON public.quote_items;
CREATE POLICY "Staff can manage quote items" ON public.quote_items
    FOR ALL USING (
        quote_id IN (SELECT id FROM public.quotes WHERE public.has_tenant_access(tenant_id))
    );

-- FAQs
DROP POLICY IF EXISTS "Users can view tenant faqs" ON public.faqs;
CREATE POLICY "Users can view tenant faqs" ON public.faqs
    FOR SELECT USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Admins can manage faqs" ON public.faqs;
CREATE POLICY "Admins can manage faqs" ON public.faqs
    FOR ALL USING (
        public.is_super_admin() OR
        (tenant_id IN (
            SELECT ur.tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'owner')
            AND ur.is_active = true
        ))
    );

-- Tenant Notifications
DROP POLICY IF EXISTS "Users can view their notifications" ON public.tenant_notifications;
CREATE POLICY "Users can view their notifications" ON public.tenant_notifications
    FOR SELECT USING (
        public.has_tenant_access(tenant_id) AND
        (recipient_staff_id IS NULL OR recipient_staff_id IN (
            SELECT s.id FROM public.staff s
            WHERE s.user_id = auth.uid()
        ))
    );

-- Patient Files
DROP POLICY IF EXISTS "Users can view tenant patient_files" ON public.patient_files;
CREATE POLICY "Users can view tenant patient_files" ON public.patient_files
    FOR SELECT USING (public.has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Staff can manage patient_files" ON public.patient_files;
CREATE POLICY "Staff can manage patient_files" ON public.patient_files
    FOR ALL USING (public.has_tenant_access(tenant_id));

-- =====================================================
-- H6: POLÍTICAS SERVICE ROLE (para APIs)
-- =====================================================

-- Service role puede hacer todo en todas las tablas
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS "Service role full access %I" ON public.%I;
            CREATE POLICY "Service role full access %I" ON public.%I
            FOR ALL TO service_role USING (true) WITH CHECK (true);
        ', table_name, table_name, table_name, table_name);
    END LOOP;
END $$;

-- =====================================================
-- PARTE I: TRIGGERS DE UPDATED_AT Y CAMPOS CALCULADOS
-- =====================================================

-- Función para calcular full_name en leads
CREATE OR REPLACE FUNCTION public.calculate_lead_full_name()
RETURNS TRIGGER AS $$
BEGIN
    NEW.full_name := COALESCE(NEW.first_name, '') ||
        CASE WHEN NEW.first_name IS NOT NULL AND NEW.last_name IS NOT NULL THEN ' ' ELSE '' END ||
        COALESCE(NEW.last_name, '');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular full_name en patients
CREATE OR REPLACE FUNCTION public.calculate_patient_full_name()
RETURNS TRIGGER AS $$
BEGIN
    NEW.full_name := NEW.first_name || ' ' || NEW.last_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular end_time en appointments
CREATE OR REPLACE FUNCTION public.calculate_appointment_end_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.end_time := NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::INTERVAL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para leads full_name
DROP TRIGGER IF EXISTS trigger_calculate_lead_full_name ON public.leads;
CREATE TRIGGER trigger_calculate_lead_full_name
    BEFORE INSERT OR UPDATE OF first_name, last_name ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.calculate_lead_full_name();

-- Trigger para patients full_name
DROP TRIGGER IF EXISTS trigger_calculate_patient_full_name ON public.patients;
CREATE TRIGGER trigger_calculate_patient_full_name
    BEFORE INSERT OR UPDATE OF first_name, last_name ON public.patients
    FOR EACH ROW EXECUTE FUNCTION public.calculate_patient_full_name();

-- Trigger para appointments end_time
DROP TRIGGER IF EXISTS trigger_calculate_appointment_end_time ON public.appointments;
CREATE TRIGGER trigger_calculate_appointment_end_time
    BEFORE INSERT OR UPDATE OF scheduled_at, duration_minutes ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.calculate_appointment_end_time();

-- Crear triggers para todas las tablas con updated_at (excluyendo views)
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables tb
            ON c.table_name = tb.table_name
            AND c.table_schema = tb.table_schema
        WHERE c.table_schema = 'public'
        AND c.column_name = 'updated_at'
        AND tb.table_type = 'BASE TABLE'  -- Solo tablas, no views
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I;
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON public.%I
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END $$;

-- =====================================================
-- PARTE J: SEED DATA - ESVA como primer tenant
-- =====================================================

-- Insertar ESVA como tenant (si no existe)
INSERT INTO public.tenants (
    id,
    name,
    slug,
    legal_name,
    vertical,
    plan,
    primary_contact_name,
    primary_contact_email,
    primary_contact_phone,
    status,
    settings
)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'ESVA Dental Clinic',
    'esva',
    'ESVA Especialistas en Salud Visual y Auditiva S.A. de C.V.',
    'dental',
    'growth',
    'Dr. Roberto García',
    'contacto@esvadental.com',
    '+52 614 123 4567',
    'active',
    '{
        "branding": {
            "primary_color": "#667eea",
            "secondary_color": "#764ba2"
        },
        "ai": {
            "personality": "profesional y empático",
            "response_style": "conciso"
        }
    }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    vertical = EXCLUDED.vertical,
    plan = EXCLUDED.plan;

-- Insertar sucursal principal de ESVA
INSERT INTO public.branches (
    id,
    tenant_id,
    name,
    slug,
    city,
    state,
    country,
    address,
    phone,
    whatsapp_number,
    is_headquarters,
    is_active,
    operating_hours
)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'ESVA Centro',
    'centro',
    'Chihuahua',
    'Chihuahua',
    'Mexico',
    'Av. Universidad 1234, Col. Centro',
    '+52 614 123 4567',
    '+52 614 123 4567',
    true,
    true,
    '{
        "monday": {"open": "09:00", "close": "19:00", "enabled": true},
        "tuesday": {"open": "09:00", "close": "19:00", "enabled": true},
        "wednesday": {"open": "09:00", "close": "19:00", "enabled": true},
        "thursday": {"open": "09:00", "close": "19:00", "enabled": true},
        "friday": {"open": "09:00", "close": "19:00", "enabled": true},
        "saturday": {"open": "09:00", "close": "14:00", "enabled": true},
        "sunday": {"enabled": false}
    }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    operating_hours = EXCLUDED.operating_hours;

-- =====================================================
-- FIN DEL SCHEMA CONSOLIDADO
-- =====================================================

SELECT '
=====================================================
SCHEMA CONSOLIDADO EJECUTADO EXITOSAMENTE
=====================================================

TABLAS CREADAS/ACTUALIZADAS:
- Orquestador: clients, proposals, subscriptions, plans, addons
- Assembly: component_registry, deployment_log, feature_flags, notification_queue
- Config: vertical_configs, user_roles
- Multi-tenant: tenants, branches, staff, staff_branches
- Operaciones: leads, services, appointments
- Pacientes: patients, clinical_history, patient_files
- Comunicación: conversations, messages
- Cotizaciones: quotes, quote_items, quote_payment_plans
- Otros: faqs, tenant_notifications

FUNCIONES HELPER:
- get_user_tenant_id()
- is_super_admin()
- has_tenant_access()

RLS HABILITADO EN TODAS LAS TABLAS

SEED DATA:
- ESVA Dental como tenant inicial (id: a0000000-0000-0000-0000-000000000001)
- Sucursal ESVA Centro (id: b0000000-0000-0000-0000-000000000001)

PRECIOS ACTUALIZADOS:
- Starter: $3,490 MXN
- Essentials: $7,490 MXN
- Growth: $12,490 MXN
- Scale: $19,990 MXN
- Activation Fee: $0

PRÓXIMOS PASOS:
1. Ejecutar este SQL en Supabase de TIS TIS
2. Crear usuario admin en auth.users
3. Insertar user_role para el admin
=====================================================
' as resultado;

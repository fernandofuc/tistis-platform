-- =====================================================
-- TIS TIS PLATFORM - MASTER CORRECTION MIGRATION
-- Version: 1.0
-- Migration: 011_master_correction.sql
-- Date: December 2024
--
-- PURPOSE: Corrige todos los problemas críticos identificados
-- en la auditoría de migraciones 001-010
-- =====================================================

-- =====================================================
-- PARTE 1: CREAR TABLA user_roles (CRÍTICO)
-- Esta tabla es referenciada por RLS policies pero no existía
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relaciones
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Rol del usuario
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'super_admin',      -- Admin de TIS TIS (puede ver todo)
        'admin',            -- Admin del tenant
        'owner',            -- Dueño del negocio
        'manager',          -- Gerente
        'dentist',          -- Doctor/Dentista
        'specialist',       -- Especialista
        'receptionist',     -- Recepcionista
        'staff',            -- Staff general
        'assistant'         -- Asistente
    )),

    -- Staff vinculado (opcional - para vincular con tabla staff)
    staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,

    -- Permisos adicionales
    permissions JSONB DEFAULT '{}',

    -- Estado
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Un usuario puede tener un solo rol por tenant
    UNIQUE(user_id, tenant_id)
);

-- Indexes para user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON public.user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_staff_id ON public.user_roles(staff_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON public.user_roles(user_id, is_active) WHERE is_active = true;

-- RLS para user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Super admin puede ver todo
CREATE POLICY "Super admin full access to user_roles"
ON public.user_roles FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
        AND ur.is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
        AND ur.is_active = true
    )
);

-- Admin puede ver/gestionar roles de su tenant
CREATE POLICY "Admin can manage tenant user_roles"
ON public.user_roles FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'owner')
        AND ur.is_active = true
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'owner')
        AND ur.is_active = true
    )
);

-- Usuarios pueden ver su propio rol
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role tiene acceso completo
CREATE POLICY "Service role full access user_roles"
ON public.user_roles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- PARTE 2: CREAR VIEW staff_members (ALIAS DE staff)
-- Las migraciones 005, 006 referencian staff_members pero no existe
-- =====================================================

CREATE OR REPLACE VIEW public.staff_members AS
SELECT
    id,
    tenant_id,
    user_id,
    first_name,
    last_name,
    display_name,
    email,
    phone,
    whatsapp_number,
    avatar_url,
    role,
    role_title,
    receive_notifications,
    notification_preferences,
    work_schedule,
    is_active,
    metadata,
    created_at,
    updated_at,
    deleted_at
FROM public.staff;

COMMENT ON VIEW public.staff_members IS 'Alias de la tabla staff para compatibilidad con código existente';

-- =====================================================
-- PARTE 3: ACTUALIZAR TABLA plans CON PRECIOS CORRECTOS
-- Eliminar activation_fee y actualizar precios
-- =====================================================

-- Primero, actualizar la columna activation_fee para permitir NULL
ALTER TABLE public.plans
    ALTER COLUMN activation_fee DROP DEFAULT,
    ALTER COLUMN activation_fee DROP NOT NULL;

-- Actualizar los planes con precios correctos (SIN CUOTA DE ACTIVACIÓN)
UPDATE public.plans SET
    monthly_price = 3490,
    activation_fee = 0,
    max_locations = 1,
    max_users = 5,
    description = 'Para negocios que inician su transformación digital con IA',
    features = '[
        "Cerebro Digital 24/7 en WhatsApp",
        "Hasta 500 conversaciones/mes",
        "Respuestas automáticas inteligentes",
        "Dashboard básico con métricas",
        "1 sucursal incluida",
        "Soporte por email",
        "Configuración guiada"
    ]'::jsonb,
    is_popular = false,
    display_order = 1
WHERE id = 'starter';

UPDATE public.plans SET
    monthly_price = 7490,
    activation_fee = 0,
    max_locations = 3,
    max_users = 15,
    description = 'Todo lo necesario para operar eficientemente con automatización',
    features = '[
        "Todo lo de Starter",
        "Hasta 2,000 conversaciones/mes",
        "Integración con sistemas existentes",
        "Automatización de procesos",
        "Multi-sucursal (hasta 3)",
        "Soporte prioritario",
        "Reportes semanales automáticos",
        "Gestión de leads inteligente"
    ]'::jsonb,
    is_popular = true,
    display_order = 2
WHERE id = 'essentials';

UPDATE public.plans SET
    monthly_price = 12490,
    activation_fee = 0,
    max_locations = 10,
    max_users = 50,
    description = 'Para negocios en expansión que necesitan escalar con IA avanzada',
    features = '[
        "Todo lo de Essentials",
        "Conversaciones ilimitadas",
        "Automatizaciones complejas personalizadas",
        "Multi-canal (WhatsApp, Instagram, Web)",
        "Analytics avanzado con predicciones",
        "Soporte 24/7",
        "Call mensual de optimización",
        "Facturación automática incluida",
        "Asistente de voz IA incluido",
        "Multi-sucursal (hasta 10)"
    ]'::jsonb,
    is_popular = false,
    display_order = 3
WHERE id = 'growth';

UPDATE public.plans SET
    monthly_price = 19990,
    activation_fee = 0,
    max_locations = 999,
    max_users = 999,
    description = 'Solución enterprise con automatización completa y soporte dedicado',
    features = '[
        "Todo lo de Growth",
        "Sucursales ilimitadas",
        "IA entrenada con tus datos específicos",
        "Integraciones custom ilimitadas",
        "Equipo dedicado de soporte",
        "SLA garantizado 99.9%",
        "Consultoría estratégica mensual",
        "White-label disponible",
        "API completa"
    ]'::jsonb,
    is_popular = false,
    display_order = 4
WHERE id = 'scale';

-- =====================================================
-- PARTE 4: ACTUALIZAR ADDONS CON PRECIOS CORRECTOS
-- =====================================================

-- Eliminar addons antiguos y crear nuevos
DELETE FROM public.addons;

INSERT INTO public.addons (id, name, description, monthly_price, compatible_plans, compatible_verticals, is_active) VALUES
-- Add-ons Esenciales
('facturacion', 'Sistema de Facturación Automática',
 'Genera facturas automáticamente desde cotizaciones aprobadas',
 1990,
 '{"starter", "essentials"}',
 '{"dental", "clinic", "restaurant", "retail", "services"}',
 true),

('cotizaciones', 'Cotizaciones Automáticas',
 'Genera cotizaciones profesionales en segundos con IA',
 1990,
 '{"starter", "essentials"}',
 '{"dental", "clinic", "restaurant", "retail", "services"}',
 true),

('analytics-pro', 'Reportes Diarios Automatizados',
 'Recibe reportes diarios de tu negocio en WhatsApp',
 2990,
 '{"starter", "essentials"}',
 '{"dental", "clinic", "restaurant", "retail", "services"}',
 true),

('campanas-wa', 'Marketing Personalizado',
 'Envía campañas personalizadas sin spam a tus clientes',
 1490,
 '{"starter", "essentials", "growth", "scale"}',
 '{"dental", "clinic", "restaurant", "retail", "services"}',
 true),

('voz-basico', 'Asistente de Voz IA 24/7',
 'Atiende llamadas con IA cuando no puedes contestar',
 2290,
 '{"starter", "essentials"}',
 '{"dental", "clinic", "restaurant", "retail", "services"}',
 true),

('digitalizador', 'Documentación Automática',
 'Digitaliza documentos y expedientes en segundos',
 4490,
 '{"starter", "essentials", "growth", "scale"}',
 '{"dental", "clinic", "medical"}',
 true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price,
    compatible_plans = EXCLUDED.compatible_plans,
    compatible_verticals = EXCLUDED.compatible_verticals,
    is_active = EXCLUDED.is_active;

-- =====================================================
-- PARTE 5: CORREGIR RLS POLICIES PROBLEMÁTICAS
-- Las policies originales asumían tenant_id en JWT (no existe)
-- =====================================================

-- Eliminar policy problemática de leads
DROP POLICY IF EXISTS "authenticated_tenant_leads" ON public.leads;

-- Nueva policy usando user_roles
CREATE POLICY "Users can access tenant leads"
ON public.leads FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
);

-- Policy para appointments
DROP POLICY IF EXISTS "authenticated_tenant_appointments" ON public.appointments;

CREATE POLICY "Users can access tenant appointments"
ON public.appointments FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
);

-- Policy para branches
DROP POLICY IF EXISTS "authenticated_tenant_branches" ON public.branches;

CREATE POLICY "Users can access tenant branches"
ON public.branches FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
);

-- Policy para staff
DROP POLICY IF EXISTS "authenticated_tenant_staff" ON public.staff;

CREATE POLICY "Users can access tenant staff"
ON public.staff FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
);

-- Policy para services
DROP POLICY IF EXISTS "authenticated_tenant_services" ON public.services;

CREATE POLICY "Users can access tenant services"
ON public.services FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
);

-- Policy para conversations
DROP POLICY IF EXISTS "authenticated_tenant_conversations" ON public.conversations;

CREATE POLICY "Users can access tenant conversations"
ON public.conversations FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
);

-- Policy para faqs
DROP POLICY IF EXISTS "authenticated_tenant_faqs" ON public.faqs;

CREATE POLICY "Users can access tenant faqs"
ON public.faqs FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
);

-- =====================================================
-- PARTE 6: CORREGIR VIEW quotes_full (usaba l.name incorrecto)
-- =====================================================

DROP VIEW IF EXISTS public.quotes_full;

CREATE OR REPLACE VIEW public.quotes_full AS
SELECT
    q.*,
    CASE
        WHEN q.patient_id IS NOT NULL THEN p.first_name || ' ' || p.last_name
        WHEN q.lead_id IS NOT NULL THEN l.full_name  -- Corregido: era l.name
        ELSE 'Sin asignar'
    END as client_name,
    CASE
        WHEN q.patient_id IS NOT NULL THEN p.phone
        WHEN q.lead_id IS NOT NULL THEN l.phone
        ELSE NULL
    END as client_phone,
    CASE
        WHEN q.patient_id IS NOT NULL THEN p.email
        WHEN q.lead_id IS NOT NULL THEN l.email
        ELSE NULL
    END as client_email,
    b.name as branch_name,
    s.display_name as created_by_name,
    (SELECT COUNT(*) FROM public.quote_items qi WHERE qi.quote_id = q.id) as items_count,
    (SELECT COUNT(*) FROM public.quote_payment_plans qpp WHERE qpp.quote_id = q.id) as payment_plans_count
FROM public.quotes q
LEFT JOIN public.patients p ON q.patient_id = p.id
LEFT JOIN public.leads l ON q.lead_id = l.id
LEFT JOIN public.branches b ON q.branch_id = b.id
LEFT JOIN public.staff s ON q.created_by_staff_id = s.id;

-- =====================================================
-- PARTE 7: FUNCIÓN HELPER PARA OBTENER TENANT DEL USUARIO
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_tenant_id(p_user_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
BEGIN
    -- Si no se proporciona user_id, usar el del contexto de auth
    v_user_id := COALESCE(p_user_id, auth.uid());

    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Buscar tenant del usuario
    SELECT tenant_id INTO v_tenant_id
    FROM public.user_roles
    WHERE user_id = v_user_id
    AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- PARTE 8: FUNCIÓN PARA AUTO-CREAR user_role DESDE staff
-- Cuando se crea un staff, auto-crear su user_role si tiene user_id
-- =====================================================

CREATE OR REPLACE FUNCTION sync_staff_to_user_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo si el staff tiene user_id
    IF NEW.user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, tenant_id, role, staff_id, is_active)
        VALUES (
            NEW.user_id,
            NEW.tenant_id,
            NEW.role,
            NEW.id,
            NEW.is_active
        )
        ON CONFLICT (user_id, tenant_id) DO UPDATE SET
            role = EXCLUDED.role,
            staff_id = EXCLUDED.staff_id,
            is_active = EXCLUDED.is_active,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_staff_user_role ON public.staff;

CREATE TRIGGER trigger_sync_staff_user_role
AFTER INSERT OR UPDATE ON public.staff
FOR EACH ROW
EXECUTE FUNCTION sync_staff_to_user_role();

-- =====================================================
-- PARTE 9: VINCULAR STAFF EXISTENTE DE ESVA CON user_roles
-- Crear user_roles para el staff de ESVA si tienen email
-- =====================================================

-- Nota: Esto se ejecutará pero no creará registros si no hay usuarios en auth.users
-- con los mismos emails. Es seguro ejecutar.
INSERT INTO public.user_roles (user_id, tenant_id, role, staff_id, is_active)
SELECT
    au.id as user_id,
    s.tenant_id,
    s.role,
    s.id as staff_id,
    s.is_active
FROM public.staff s
JOIN auth.users au ON LOWER(au.email) = LOWER(s.email)
WHERE s.deleted_at IS NULL
ON CONFLICT (user_id, tenant_id) DO UPDATE SET
    role = EXCLUDED.role,
    staff_id = EXCLUDED.staff_id,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- =====================================================
-- PARTE 10: CREAR TABLA vertical_configs
-- Configuración de módulos por vertical
-- =====================================================

CREATE TABLE IF NOT EXISTS public.vertical_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificación del vertical
    vertical VARCHAR(50) NOT NULL UNIQUE CHECK (vertical IN (
        'dental',
        'restaurant',
        'pharmacy',
        'retail',
        'medical',
        'services',
        'industrial',
        'other'
    )),

    -- Nombre display
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'Building',

    -- Módulos habilitados para este vertical
    enabled_modules JSONB NOT NULL DEFAULT '[]',

    -- Configuración del sidebar
    sidebar_config JSONB NOT NULL DEFAULT '[]',

    -- Features específicas
    features JSONB DEFAULT '{}',

    -- Tablas de extensión requeridas
    extension_tables TEXT[] DEFAULT '{}',

    -- Estado
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_vertical_configs_vertical ON public.vertical_configs(vertical);

-- RLS
ALTER TABLE public.vertical_configs ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer los configs de verticales
CREATE POLICY "Anyone can view vertical configs"
ON public.vertical_configs FOR SELECT
USING (is_active = true);

-- Solo service_role puede modificar
CREATE POLICY "Service role can manage vertical configs"
ON public.vertical_configs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- PARTE 11: SEED DATA - CONFIGURACIÓN DE VERTICALES
-- =====================================================

INSERT INTO public.vertical_configs (vertical, display_name, description, icon, enabled_modules, sidebar_config, extension_tables) VALUES
(
    'dental',
    'Clínica Dental',
    'Configuración para clínicas y consultorios dentales',
    'Smile',
    '["dashboard", "leads", "patients", "appointments", "quotes", "inbox", "analytics", "settings"]'::jsonb,
    '[
        {"name": "Dashboard", "icon": "Home", "path": "/dashboard", "order": 1},
        {"name": "Leads", "icon": "Users", "path": "/dashboard/leads", "order": 2},
        {"name": "Pacientes", "icon": "UserCheck", "path": "/dashboard/patients", "order": 3},
        {"name": "Calendario", "icon": "Calendar", "path": "/dashboard/calendario", "order": 4},
        {"name": "Cotizaciones", "icon": "FileText", "path": "/dashboard/quotes", "order": 5},
        {"name": "Inbox", "icon": "MessageSquare", "path": "/dashboard/inbox", "order": 6},
        {"name": "Analytics", "icon": "BarChart", "path": "/dashboard/analytics", "order": 7},
        {"name": "Configuración", "icon": "Settings", "path": "/dashboard/settings", "order": 99}
    ]'::jsonb,
    ARRAY['lead_dental_profile', 'appointment_dental_details', 'staff_dental_profile', 'patients', 'clinical_history']
),
(
    'restaurant',
    'Restaurante',
    'Configuración para restaurantes y servicios de comida',
    'Utensils',
    '["dashboard", "leads", "orders", "menu", "reservations", "inventory", "inbox", "analytics", "settings"]'::jsonb,
    '[
        {"name": "Dashboard", "icon": "Home", "path": "/dashboard", "order": 1},
        {"name": "Leads", "icon": "Users", "path": "/dashboard/leads", "order": 2},
        {"name": "Pedidos", "icon": "ShoppingBag", "path": "/dashboard/orders", "order": 3},
        {"name": "Menú", "icon": "BookOpen", "path": "/dashboard/menu", "order": 4},
        {"name": "Reservas", "icon": "Calendar", "path": "/dashboard/reservations", "order": 5},
        {"name": "Inventario", "icon": "Package", "path": "/dashboard/inventory", "order": 6},
        {"name": "Inbox", "icon": "MessageSquare", "path": "/dashboard/inbox", "order": 7},
        {"name": "Analytics", "icon": "BarChart", "path": "/dashboard/analytics", "order": 8},
        {"name": "Configuración", "icon": "Settings", "path": "/dashboard/settings", "order": 99}
    ]'::jsonb,
    ARRAY['menu_items', 'orders', 'reservations', 'inventory']
),
(
    'medical',
    'Clínica Médica',
    'Configuración para clínicas médicas generales',
    'Stethoscope',
    '["dashboard", "leads", "patients", "appointments", "inbox", "analytics", "settings"]'::jsonb,
    '[
        {"name": "Dashboard", "icon": "Home", "path": "/dashboard", "order": 1},
        {"name": "Leads", "icon": "Users", "path": "/dashboard/leads", "order": 2},
        {"name": "Pacientes", "icon": "UserCheck", "path": "/dashboard/patients", "order": 3},
        {"name": "Calendario", "icon": "Calendar", "path": "/dashboard/calendario", "order": 4},
        {"name": "Inbox", "icon": "MessageSquare", "path": "/dashboard/inbox", "order": 5},
        {"name": "Analytics", "icon": "BarChart", "path": "/dashboard/analytics", "order": 6},
        {"name": "Configuración", "icon": "Settings", "path": "/dashboard/settings", "order": 99}
    ]'::jsonb,
    ARRAY['patients', 'clinical_history']
),
(
    'retail',
    'Tienda / Retail',
    'Configuración para tiendas y comercios',
    'Store',
    '["dashboard", "leads", "inventory", "orders", "inbox", "analytics", "settings"]'::jsonb,
    '[
        {"name": "Dashboard", "icon": "Home", "path": "/dashboard", "order": 1},
        {"name": "Leads", "icon": "Users", "path": "/dashboard/leads", "order": 2},
        {"name": "Inventario", "icon": "Package", "path": "/dashboard/inventory", "order": 3},
        {"name": "Pedidos", "icon": "ShoppingBag", "path": "/dashboard/orders", "order": 4},
        {"name": "Inbox", "icon": "MessageSquare", "path": "/dashboard/inbox", "order": 5},
        {"name": "Analytics", "icon": "BarChart", "path": "/dashboard/analytics", "order": 6},
        {"name": "Configuración", "icon": "Settings", "path": "/dashboard/settings", "order": 99}
    ]'::jsonb,
    ARRAY['inventory', 'orders']
),
(
    'services',
    'Servicios Profesionales',
    'Configuración para empresas de servicios',
    'Briefcase',
    '["dashboard", "leads", "appointments", "quotes", "inbox", "analytics", "settings"]'::jsonb,
    '[
        {"name": "Dashboard", "icon": "Home", "path": "/dashboard", "order": 1},
        {"name": "Leads", "icon": "Users", "path": "/dashboard/leads", "order": 2},
        {"name": "Calendario", "icon": "Calendar", "path": "/dashboard/calendario", "order": 3},
        {"name": "Cotizaciones", "icon": "FileText", "path": "/dashboard/quotes", "order": 4},
        {"name": "Inbox", "icon": "MessageSquare", "path": "/dashboard/inbox", "order": 5},
        {"name": "Analytics", "icon": "BarChart", "path": "/dashboard/analytics", "order": 6},
        {"name": "Configuración", "icon": "Settings", "path": "/dashboard/settings", "order": 99}
    ]'::jsonb,
    ARRAY[]
)
ON CONFLICT (vertical) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    enabled_modules = EXCLUDED.enabled_modules,
    sidebar_config = EXCLUDED.sidebar_config,
    extension_tables = EXCLUDED.extension_tables,
    updated_at = NOW();

-- =====================================================
-- PARTE 12: ACTUALIZAR TABLA proposals (ELIMINAR activation_fee del default)
-- =====================================================

ALTER TABLE public.proposals
    ALTER COLUMN activation_fee SET DEFAULT 0;

UPDATE public.proposals SET activation_fee = 0 WHERE activation_fee > 0;

-- =====================================================
-- PARTE 13: TRIGGER PARA updated_at EN NUEVAS TABLAS
-- =====================================================

CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vertical_configs_updated_at
    BEFORE UPDATE ON public.vertical_configs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PARTE 14: CREAR TABLA audit_logs (FALTANTE)
-- Usada por /api/assemble para logging de eventos
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Contexto
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Acción
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,

    -- Datos
    old_data JSONB,
    new_data JSONB,

    -- Metadata
    ip_address VARCHAR(50),
    user_agent TEXT,
    request_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_client_id ON public.audit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- RLS para audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admin puede ver todos los logs
CREATE POLICY "Super admin can view all audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
        AND ur.is_active = true
    )
);

-- Service role puede insertar y ver logs (para APIs)
CREATE POLICY "Service role full access audit logs"
ON public.audit_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- PARTE 15.1: AGREGAR COLUMNA progress_percentage A deployment_log
-- Usada por /api/onboarding/status
-- =====================================================

ALTER TABLE public.deployment_log
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100);

-- =====================================================
-- PARTE 16: COMENTARIOS
-- =====================================================

COMMENT ON TABLE public.user_roles IS 'Vincula usuarios de auth.users con tenants y roles. Permite multi-tenant.';
COMMENT ON TABLE public.vertical_configs IS 'Configuración de módulos y sidebar por tipo de negocio (vertical)';
COMMENT ON TABLE public.audit_logs IS 'Registro de auditoría para todas las acciones del sistema';
COMMENT ON VIEW public.staff_members IS 'Vista de compatibilidad - alias de tabla staff';
COMMENT ON FUNCTION get_user_tenant_id IS 'Obtiene el tenant_id del usuario actual o especificado';
COMMENT ON FUNCTION sync_staff_to_user_role IS 'Sincroniza registros de staff con user_roles automáticamente';

-- =====================================================
-- FIN MASTER CORRECTION MIGRATION
-- =====================================================

SELECT 'Migration 011_master_correction.sql ejecutada exitosamente!' as status;

-- =====================================================
-- TIS TIS PLATFORM - RESTAURANT VERTICAL SCHEMA
-- Migration 088: Complete Restaurant Vertical Support
-- =====================================================
-- Esta migración implementa el soporte completo para la
-- vertical de restaurantes, siguiendo el patrón establecido
-- por dental (lead_dental_profile, appointment_dental_details)
-- =====================================================

-- =====================================================
-- PARTE 1: TABLA DE MESAS (Restaurant Tables)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Identificación
    table_number VARCHAR(20) NOT NULL,
    name VARCHAR(100), -- "Mesa VIP 1", "Terraza Norte", etc.

    -- Capacidad
    min_capacity INTEGER DEFAULT 1,
    max_capacity INTEGER NOT NULL DEFAULT 4,

    -- Ubicación
    zone VARCHAR(50) DEFAULT 'main', -- main, terrace, private, bar, etc.
    floor INTEGER DEFAULT 1,
    position_x INTEGER, -- Para mapa visual
    position_y INTEGER,

    -- Características
    is_outdoor BOOLEAN DEFAULT false,
    is_accessible BOOLEAN DEFAULT true, -- Accesible para sillas de ruedas
    is_high_top BOOLEAN DEFAULT false, -- Mesa alta/bar
    has_power_outlet BOOLEAN DEFAULT false,
    features TEXT[] DEFAULT '{}', -- ['window_view', 'booth', 'quiet_corner']

    -- Combinación de mesas
    can_combine BOOLEAN DEFAULT true,
    combinable_with UUID[], -- IDs de mesas que pueden combinarse

    -- Estado
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN (
        'available',
        'occupied',
        'reserved',
        'unavailable',
        'maintenance'
    )),

    -- Prioridad para asignación automática
    priority INTEGER DEFAULT 0, -- Mayor = se asigna primero

    -- Display
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    -- Constraints
    UNIQUE(branch_id, table_number)
);

-- Índices para restaurant_tables
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_tenant
    ON public.restaurant_tables(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_branch
    ON public.restaurant_tables(branch_id) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status
    ON public.restaurant_tables(branch_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_capacity
    ON public.restaurant_tables(branch_id, max_capacity) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_zone
    ON public.restaurant_tables(branch_id, zone) WHERE deleted_at IS NULL;


-- =====================================================
-- PARTE 2: EXTENSIÓN DE LEADS PARA RESTAURANT
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lead_restaurant_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,

    -- Preferencias gastronómicas
    dietary_restrictions TEXT[], -- ['vegetarian', 'vegan', 'gluten_free', 'kosher', 'halal']
    food_allergies TEXT[], -- ['nuts', 'shellfish', 'dairy', 'eggs']
    cuisine_preferences TEXT[], -- ['italian', 'mexican', 'asian', 'seafood']
    spice_tolerance VARCHAR(20) CHECK (spice_tolerance IN ('none', 'mild', 'medium', 'hot', 'extra_hot')),

    -- Preferencias de servicio
    preferred_seating VARCHAR(50), -- 'indoor', 'outdoor', 'bar', 'private', 'window'
    preferred_table_size INTEGER,
    accessibility_needs TEXT[],
    high_chair_needed BOOLEAN DEFAULT false,

    -- Historial y valor
    total_visits INTEGER DEFAULT 0,
    total_spent DECIMAL(12, 2) DEFAULT 0,
    average_party_size DECIMAL(3, 1),
    average_spend_per_visit DECIMAL(10, 2),
    favorite_dishes TEXT[],
    last_visit_date DATE,

    -- Programa de lealtad
    loyalty_points INTEGER DEFAULT 0,
    loyalty_tier VARCHAR(20) DEFAULT 'standard' CHECK (loyalty_tier IN (
        'standard',
        'silver',
        'gold',
        'platinum',
        'vip'
    )),
    loyalty_tier_expires_at DATE,

    -- Ocasiones especiales
    birthday DATE,
    anniversary DATE,
    special_occasions JSONB DEFAULT '[]', -- [{date, type, notes}]

    -- Eventos y celebraciones
    interested_in_events BOOLEAN DEFAULT false,
    preferred_event_types TEXT[], -- ['wine_tasting', 'chef_table', 'private_dining']

    -- Comunicación
    preferred_contact_method VARCHAR(20) DEFAULT 'whatsapp',
    marketing_consent BOOLEAN DEFAULT true,
    review_requested BOOLEAN DEFAULT false,
    last_review_request_at TIMESTAMPTZ,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para lead_restaurant_profile
CREATE INDEX IF NOT EXISTS idx_lead_restaurant_lead ON public.lead_restaurant_profile(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_restaurant_loyalty ON public.lead_restaurant_profile(loyalty_tier)
    WHERE loyalty_tier IN ('gold', 'platinum', 'vip');
CREATE INDEX IF NOT EXISTS idx_lead_restaurant_birthday ON public.lead_restaurant_profile(birthday);
CREATE INDEX IF NOT EXISTS idx_lead_restaurant_visits ON public.lead_restaurant_profile(total_visits DESC);


-- =====================================================
-- PARTE 3: EXTENSIÓN DE CITAS/RESERVACIONES PARA RESTAURANT
-- =====================================================

CREATE TABLE IF NOT EXISTS public.appointment_restaurant_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,

    -- Información de la reservación
    party_size INTEGER NOT NULL DEFAULT 2,

    -- Mesa asignada
    table_id UUID REFERENCES public.restaurant_tables(id),
    table_preferences TEXT[], -- ['window', 'quiet', 'outdoor']
    seating_area VARCHAR(50), -- Zona preferida

    -- Tipo de ocasión
    occasion_type VARCHAR(50) CHECK (occasion_type IN (
        'regular',
        'birthday',
        'anniversary',
        'business',
        'date_night',
        'family_gathering',
        'celebration',
        'proposal',
        'graduation',
        'other'
    )),
    occasion_details TEXT,

    -- Solicitudes especiales
    special_requests TEXT,
    dietary_notes TEXT,
    allergies_confirmed TEXT[],
    high_chair_count INTEGER DEFAULT 0,
    kids_menu_needed BOOLEAN DEFAULT false,

    -- Pre-orden
    pre_order_items JSONB DEFAULT '[]', -- [{item_id, quantity, notes}]
    pre_order_total DECIMAL(10, 2),
    wine_pre_selection JSONB,

    -- Decoración/Extras
    decoration_requested BOOLEAN DEFAULT false,
    decoration_type VARCHAR(50), -- 'birthday', 'anniversary', 'flowers', etc.
    decoration_notes TEXT,
    extra_services JSONB DEFAULT '[]', -- [{service, price}]

    -- Depósito
    deposit_required BOOLEAN DEFAULT false,
    deposit_amount DECIMAL(10, 2),
    deposit_paid BOOLEAN DEFAULT false,
    deposit_paid_at TIMESTAMPTZ,
    deposit_method VARCHAR(50),

    -- Estado de llegada
    arrival_status VARCHAR(20) DEFAULT 'pending' CHECK (arrival_status IN (
        'pending',
        'confirmed',
        'en_route',
        'arrived',
        'seated',
        'dining',
        'finished',
        'no_show'
    )),
    arrived_at TIMESTAMPTZ,
    seated_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,

    -- Feedback post-visita
    service_rating INTEGER CHECK (service_rating >= 1 AND service_rating <= 5),
    food_rating INTEGER CHECK (food_rating >= 1 AND food_rating <= 5),
    ambiance_rating INTEGER CHECK (ambiance_rating >= 1 AND ambiance_rating <= 5),
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    feedback_notes TEXT,
    would_recommend BOOLEAN,

    -- Facturación
    final_bill_amount DECIMAL(12, 2),
    tip_amount DECIMAL(10, 2),
    payment_method VARCHAR(50),
    invoice_requested BOOLEAN DEFAULT false,
    invoice_data JSONB,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para appointment_restaurant_details
CREATE INDEX IF NOT EXISTS idx_appointment_restaurant ON public.appointment_restaurant_details(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_restaurant_table ON public.appointment_restaurant_details(table_id);
CREATE INDEX IF NOT EXISTS idx_appointment_restaurant_occasion ON public.appointment_restaurant_details(occasion_type);
CREATE INDEX IF NOT EXISTS idx_appointment_restaurant_arrival ON public.appointment_restaurant_details(arrival_status);


-- =====================================================
-- PARTE 4: EXTENSIÓN DE STAFF PARA RESTAURANT
-- =====================================================

CREATE TABLE IF NOT EXISTS public.staff_restaurant_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL UNIQUE REFERENCES public.staff(id) ON DELETE CASCADE,

    -- Rol específico
    restaurant_role VARCHAR(50) CHECK (restaurant_role IN (
        'chef',
        'sous_chef',
        'line_cook',
        'pastry_chef',
        'sommelier',
        'bartender',
        'host',
        'server',
        'busser',
        'manager',
        'owner'
    )),

    -- Certificaciones
    food_handler_cert BOOLEAN DEFAULT false,
    food_handler_cert_expiry DATE,
    alcohol_service_cert BOOLEAN DEFAULT false,
    alcohol_service_cert_expiry DATE,
    sommelier_level VARCHAR(20), -- 'intro', 'certified', 'advanced', 'master'
    certifications TEXT[],

    -- Especialidades
    cuisine_specialties TEXT[],
    cocktail_specialties TEXT[],
    languages_spoken TEXT[] DEFAULT ARRAY['es'],

    -- Performance
    average_rating DECIMAL(3, 2),
    total_tables_served INTEGER DEFAULT 0,
    total_tips_received DECIMAL(12, 2) DEFAULT 0,

    -- Asignación
    assigned_sections TEXT[], -- Secciones del restaurante
    max_tables INTEGER DEFAULT 5,

    -- Bio para clientes
    bio TEXT,
    bio_short VARCHAR(500),

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para staff_restaurant_profile
CREATE INDEX IF NOT EXISTS idx_staff_restaurant ON public.staff_restaurant_profile(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_restaurant_role ON public.staff_restaurant_profile(restaurant_role);


-- =====================================================
-- PARTE 5: MENÚ Y CATEGORÍAS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.restaurant_menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id), -- NULL = aplica a todas las sucursales

    -- Identificación
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    description TEXT,

    -- Jerarquía
    parent_id UUID REFERENCES public.restaurant_menu_categories(id),

    -- Disponibilidad
    available_times JSONB DEFAULT '{"all_day": true}', -- O específico por horario
    available_days TEXT[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],

    -- Display
    icon VARCHAR(50),
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_tenant ON public.restaurant_menu_categories(tenant_id)
    WHERE deleted_at IS NULL;


CREATE TABLE IF NOT EXISTS public.restaurant_menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.restaurant_menu_categories(id) ON DELETE CASCADE,

    -- Identificación
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),

    -- Precios
    price DECIMAL(10, 2) NOT NULL,
    price_lunch DECIMAL(10, 2), -- Precio especial almuerzo
    price_happy_hour DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'MXN',

    -- Variantes
    variants JSONB DEFAULT '[]', -- [{name, price, description}]
    sizes JSONB DEFAULT '[]', -- [{name: 'small', price: x}, {name: 'large', price: y}]
    add_ons JSONB DEFAULT '[]', -- [{name, price, max_qty}]

    -- Información nutricional
    calories INTEGER,
    protein_g DECIMAL(5, 1),
    carbs_g DECIMAL(5, 1),
    fat_g DECIMAL(5, 1),
    allergens TEXT[], -- ['gluten', 'nuts', 'dairy', 'shellfish', 'eggs', 'soy']

    -- Etiquetas
    is_vegetarian BOOLEAN DEFAULT false,
    is_vegan BOOLEAN DEFAULT false,
    is_gluten_free BOOLEAN DEFAULT false,
    is_spicy BOOLEAN DEFAULT false,
    spice_level INTEGER CHECK (spice_level >= 0 AND spice_level <= 5),
    is_house_special BOOLEAN DEFAULT false,
    is_chef_recommendation BOOLEAN DEFAULT false,
    is_new BOOLEAN DEFAULT false,

    -- Preparación
    prep_time_minutes INTEGER,
    cooking_instructions TEXT,

    -- Imágenes
    image_url TEXT,
    image_gallery TEXT[],

    -- Disponibilidad
    is_available BOOLEAN DEFAULT true,
    available_quantity INTEGER, -- NULL = unlimited
    out_of_stock_until TIMESTAMPTZ,

    -- Display
    display_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,

    -- Popularidad
    times_ordered INTEGER DEFAULT 0,
    average_rating DECIMAL(3, 2),

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_menu_items_tenant ON public.restaurant_menu_items(tenant_id)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.restaurant_menu_items(category_id)
    WHERE deleted_at IS NULL AND is_available = true;
CREATE INDEX IF NOT EXISTS idx_menu_items_featured ON public.restaurant_menu_items(tenant_id, is_featured)
    WHERE deleted_at IS NULL AND is_available = true;
CREATE INDEX IF NOT EXISTS idx_menu_items_popular ON public.restaurant_menu_items(tenant_id, times_ordered DESC)
    WHERE deleted_at IS NULL;


-- =====================================================
-- PARTE 6: TRIGGERS Y FUNCIONES
-- =====================================================

-- Trigger para crear perfil restaurant automáticamente para nuevos leads
CREATE OR REPLACE FUNCTION public.create_restaurant_profile_for_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Solo crear si el tenant es restaurant
    IF EXISTS (SELECT 1 FROM tenants WHERE id = NEW.tenant_id AND vertical = 'restaurant') THEN
        INSERT INTO lead_restaurant_profile (lead_id)
        VALUES (NEW.id)
        ON CONFLICT (lead_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_restaurant_profile ON leads;
CREATE TRIGGER trigger_create_restaurant_profile
    AFTER INSERT ON leads
    FOR EACH ROW EXECUTE FUNCTION create_restaurant_profile_for_lead();


-- Función para obtener mesas disponibles
CREATE OR REPLACE FUNCTION public.get_available_tables(
    p_branch_id UUID,
    p_date DATE,
    p_time TIME,
    p_party_size INTEGER,
    p_duration_minutes INTEGER DEFAULT 120
)
RETURNS TABLE(
    table_id UUID,
    table_number VARCHAR,
    table_name VARCHAR,
    max_capacity INTEGER,
    zone VARCHAR,
    features TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id as table_id,
        t.table_number,
        t.name as table_name,
        t.max_capacity,
        t.zone,
        t.features
    FROM restaurant_tables t
    WHERE t.branch_id = p_branch_id
    AND t.is_active = true
    AND t.deleted_at IS NULL
    AND t.max_capacity >= p_party_size
    AND NOT EXISTS (
        -- Verificar que no haya reservaciones que se superpongan
        SELECT 1
        FROM appointments a
        JOIN appointment_restaurant_details ard ON ard.appointment_id = a.id
        WHERE ard.table_id = t.id
        AND a.scheduled_at::DATE = p_date
        AND a.status NOT IN ('cancelled', 'no_show')
        AND (
            -- Check time overlap using scheduled_at and duration_minutes
            (a.scheduled_at::TIME <= p_time
             AND (a.scheduled_at + (COALESCE(a.duration_minutes, 60) || ' minutes')::INTERVAL)::TIME > p_time)
            OR (a.scheduled_at::TIME < p_time + (p_duration_minutes || ' minutes')::INTERVAL
                AND a.scheduled_at::TIME >= p_time)
        )
    )
    ORDER BY
        t.priority DESC,
        t.max_capacity ASC, -- Preferir mesas más pequeñas que cumplan requisito
        t.display_order;
END;
$$;


-- Función para actualizar estadísticas del cliente después de visita
CREATE OR REPLACE FUNCTION public.update_restaurant_customer_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lead_id UUID;
    v_party_size INTEGER;
    v_bill_amount DECIMAL;
BEGIN
    -- Solo ejecutar cuando cambia a 'finished'
    IF NEW.arrival_status = 'finished' AND OLD.arrival_status != 'finished' THEN
        -- Obtener lead_id de la cita
        SELECT a.lead_id INTO v_lead_id
        FROM appointments a
        WHERE a.id = NEW.appointment_id;

        IF v_lead_id IS NOT NULL THEN
            v_party_size := NEW.party_size;
            v_bill_amount := COALESCE(NEW.final_bill_amount, 0);

            -- Actualizar perfil del cliente
            UPDATE lead_restaurant_profile
            SET
                total_visits = total_visits + 1,
                total_spent = total_spent + v_bill_amount,
                last_visit_date = CURRENT_DATE,
                average_party_size = (
                    (COALESCE(average_party_size, v_party_size) * COALESCE(total_visits - 1, 0) + v_party_size)
                    / total_visits
                ),
                average_spend_per_visit = (total_spent + v_bill_amount) / total_visits,
                updated_at = NOW()
            WHERE lead_id = v_lead_id;

            -- Actualizar tier de lealtad basado en visitas
            UPDATE lead_restaurant_profile
            SET loyalty_tier = CASE
                WHEN total_visits >= 50 THEN 'vip'
                WHEN total_visits >= 25 THEN 'platinum'
                WHEN total_visits >= 10 THEN 'gold'
                WHEN total_visits >= 5 THEN 'silver'
                ELSE 'standard'
            END
            WHERE lead_id = v_lead_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_customer_stats ON appointment_restaurant_details;
CREATE TRIGGER trigger_update_customer_stats
    AFTER UPDATE OF arrival_status ON appointment_restaurant_details
    FOR EACH ROW EXECUTE FUNCTION update_restaurant_customer_stats();


-- Actualizar updated_at en nuevas tablas
CREATE TRIGGER update_restaurant_tables_updated_at
    BEFORE UPDATE ON restaurant_tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_restaurant_profile_updated_at
    BEFORE UPDATE ON lead_restaurant_profile
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointment_restaurant_details_updated_at
    BEFORE UPDATE ON appointment_restaurant_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_restaurant_profile_updated_at
    BEFORE UPDATE ON staff_restaurant_profile
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_menu_categories_updated_at
    BEFORE UPDATE ON restaurant_menu_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_menu_items_updated_at
    BEFORE UPDATE ON restaurant_menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- PARTE 7: ROW LEVEL SECURITY
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_restaurant_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_restaurant_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_restaurant_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Políticas para service_role (acceso completo)
-- =====================================================
CREATE POLICY "service_role_all_restaurant_tables" ON public.restaurant_tables
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_lead_restaurant_profile" ON public.lead_restaurant_profile
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_appointment_restaurant_details" ON public.appointment_restaurant_details
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_staff_restaurant_profile" ON public.staff_restaurant_profile
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_restaurant_menu_categories" ON public.restaurant_menu_categories
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_restaurant_menu_items" ON public.restaurant_menu_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);


-- =====================================================
-- Políticas para usuarios autenticados (by tenant)
-- =====================================================

-- restaurant_tables: Usuarios pueden ver/gestionar mesas de su tenant
CREATE POLICY "tenant_select_restaurant_tables" ON public.restaurant_tables
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "tenant_manage_restaurant_tables" ON public.restaurant_tables
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'admin', 'manager')
        )
    );

-- lead_restaurant_profile: Usuarios pueden ver perfiles de leads de su tenant
CREATE POLICY "tenant_select_lead_restaurant_profile" ON public.lead_restaurant_profile
    FOR SELECT TO authenticated
    USING (
        lead_id IN (
            SELECT id FROM public.leads
            WHERE tenant_id IN (
                SELECT tenant_id FROM public.user_roles
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

CREATE POLICY "tenant_manage_lead_restaurant_profile" ON public.lead_restaurant_profile
    FOR ALL TO authenticated
    USING (
        lead_id IN (
            SELECT id FROM public.leads
            WHERE tenant_id IN (
                SELECT tenant_id FROM public.user_roles
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

-- appointment_restaurant_details: Usuarios pueden ver/gestionar detalles de citas de su tenant
CREATE POLICY "tenant_select_appointment_restaurant_details" ON public.appointment_restaurant_details
    FOR SELECT TO authenticated
    USING (
        appointment_id IN (
            SELECT id FROM public.appointments
            WHERE tenant_id IN (
                SELECT tenant_id FROM public.user_roles
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

CREATE POLICY "tenant_manage_appointment_restaurant_details" ON public.appointment_restaurant_details
    FOR ALL TO authenticated
    USING (
        appointment_id IN (
            SELECT id FROM public.appointments
            WHERE tenant_id IN (
                SELECT tenant_id FROM public.user_roles
                WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

-- staff_restaurant_profile: Staff puede ver su propio perfil, admins pueden gestionar
CREATE POLICY "staff_select_own_restaurant_profile" ON public.staff_restaurant_profile
    FOR SELECT TO authenticated
    USING (
        staff_id IN (
            SELECT id FROM public.staff
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "tenant_admin_manage_staff_restaurant_profile" ON public.staff_restaurant_profile
    FOR ALL TO authenticated
    USING (
        staff_id IN (
            SELECT s.id FROM public.staff s
            JOIN public.user_roles ur ON ur.tenant_id = s.tenant_id
            WHERE ur.user_id = auth.uid() AND ur.is_active = true
            AND ur.role IN ('owner', 'admin')
        )
    );

-- restaurant_menu_categories: Usuarios pueden ver categorías, admins gestionan
CREATE POLICY "tenant_select_menu_categories" ON public.restaurant_menu_categories
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "tenant_admin_manage_menu_categories" ON public.restaurant_menu_categories
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'admin', 'manager')
        )
    );

-- restaurant_menu_items: Usuarios pueden ver items, admins gestionan
CREATE POLICY "tenant_select_menu_items" ON public.restaurant_menu_items
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "tenant_admin_manage_menu_items" ON public.restaurant_menu_items
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'admin', 'manager')
        )
    );


-- =====================================================
-- PARTE 8: CAMPOS ADICIONALES EN APPOINTMENTS
-- =====================================================

-- Agregar campo para tamaño del grupo en appointments (usado por restaurant)
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS party_size INTEGER DEFAULT 1;

-- Agregar campo para tipo de reservación
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS reservation_type VARCHAR(50);

-- Agregar campo para paciente (ya existe patient_id, pero aseguramos)
-- Este campo permite vincular citas a pacientes/clientes directamente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'patient_id'
    ) THEN
        ALTER TABLE public.appointments
        ADD COLUMN patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Agregar campo scheduled_at si no existe (timestamp completo)
-- NOTE: scheduled_at column already exists in appointments table
-- No sync trigger needed - the app uses scheduled_at directly


-- =====================================================
-- PARTE 9: VISTAS ÚTILES PARA RESTAURANT
-- =====================================================

-- Vista de reservaciones de hoy
CREATE OR REPLACE VIEW public.v_today_reservations AS
SELECT
    a.id,
    a.tenant_id,
    a.branch_id,
    a.lead_id,
    a.scheduled_at,
    a.duration_minutes,
    a.status,
    a.notes,
    a.party_size as appointment_party_size,
    ard.party_size,
    ard.table_id,
    ard.occasion_type,
    ard.special_requests,
    ard.arrival_status,
    ard.deposit_paid,
    rt.table_number,
    rt.zone as table_zone,
    l.full_name as guest_name,
    l.phone as guest_phone,
    l.email as guest_email,
    lrp.loyalty_tier,
    lrp.dietary_restrictions,
    lrp.food_allergies,
    b.name as branch_name
FROM appointments a
LEFT JOIN appointment_restaurant_details ard ON ard.appointment_id = a.id
LEFT JOIN restaurant_tables rt ON rt.id = ard.table_id
LEFT JOIN leads l ON a.lead_id = l.id
LEFT JOIN lead_restaurant_profile lrp ON lrp.lead_id = l.id
LEFT JOIN branches b ON a.branch_id = b.id
WHERE a.scheduled_at::DATE = CURRENT_DATE
AND a.status NOT IN ('cancelled')
ORDER BY a.scheduled_at;


-- Vista de disponibilidad de mesas
CREATE OR REPLACE VIEW public.v_table_availability AS
SELECT
    rt.id as table_id,
    rt.branch_id,
    rt.table_number,
    rt.name as table_name,
    rt.max_capacity,
    rt.zone,
    rt.status,
    rt.features,
    b.name as branch_name,
    (
        SELECT json_agg(json_build_object(
            'date', a.scheduled_at::DATE,
            'time', a.scheduled_at::TIME,
            'end_time', (a.scheduled_at + (COALESCE(a.duration_minutes, 60) || ' minutes')::INTERVAL)::TIME,
            'guest_name', l.full_name,
            'party_size', ard.party_size,
            'status', a.status
        ) ORDER BY a.scheduled_at)
        FROM appointments a
        JOIN appointment_restaurant_details ard ON ard.appointment_id = a.id
        LEFT JOIN leads l ON a.lead_id = l.id
        WHERE ard.table_id = rt.id
        AND a.scheduled_at::DATE >= CURRENT_DATE
        AND a.scheduled_at::DATE <= CURRENT_DATE + INTERVAL '7 days'
        AND a.status NOT IN ('cancelled', 'no_show')
    ) as upcoming_reservations
FROM restaurant_tables rt
JOIN branches b ON b.id = rt.branch_id
WHERE rt.is_active = true
AND rt.deleted_at IS NULL;


-- Vista de clientes VIP
CREATE OR REPLACE VIEW public.v_vip_customers AS
SELECT
    l.id as lead_id,
    l.full_name,
    l.phone,
    l.email,
    lrp.loyalty_tier,
    lrp.total_visits,
    lrp.total_spent,
    lrp.average_spend_per_visit,
    lrp.loyalty_points,
    lrp.birthday,
    lrp.anniversary,
    lrp.dietary_restrictions,
    lrp.food_allergies,
    lrp.favorite_dishes,
    t.name as tenant_name,
    (
        SELECT a.scheduled_at::DATE
        FROM appointments a
        WHERE a.lead_id = l.id
        AND a.scheduled_at::DATE > CURRENT_DATE
        AND a.status NOT IN ('cancelled', 'no_show')
        ORDER BY a.scheduled_at
        LIMIT 1
    ) as next_reservation
FROM leads l
JOIN lead_restaurant_profile lrp ON lrp.lead_id = l.id
JOIN tenants t ON t.id = l.tenant_id
WHERE t.vertical = 'restaurant'
AND lrp.loyalty_tier IN ('gold', 'platinum', 'vip')
-- leads table doesn't have deleted_at, using tenant status check instead
AND t.status = 'active'
ORDER BY lrp.total_spent DESC;


-- =====================================================
-- PARTE 10: REAL-TIME
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_tables'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'appointment_restaurant_details'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE appointment_restaurant_details;
    END IF;
END $$;


-- =====================================================
-- FIN DE LA MIGRACIÓN 088
-- =====================================================

SELECT 'Migration 088: Restaurant Vertical Schema - COMPLETADA' as status;

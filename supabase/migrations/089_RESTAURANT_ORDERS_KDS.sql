-- =====================================================
-- TIS TIS PLATFORM - RESTAURANT ORDERS & KDS SCHEMA
-- Migration 089: Orders and Kitchen Display System
-- =====================================================
-- Esta migración implementa el sistema de órdenes y
-- Kitchen Display System (KDS) para restaurantes
-- =====================================================

-- =====================================================
-- PARTE 1: RESTAURANT ORDERS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.restaurant_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Número de orden (secuencial por branch)
    order_number SERIAL,
    display_number VARCHAR(20) NOT NULL, -- "001", "A-001", etc.

    -- Tipo de orden
    order_type VARCHAR(20) NOT NULL DEFAULT 'dine_in' CHECK (order_type IN (
        'dine_in',      -- Para comer en el restaurante
        'takeout',      -- Para llevar
        'delivery',     -- Entrega a domicilio
        'drive_thru',   -- Drive-thru
        'catering'      -- Servicio de catering
    )),

    -- Referencias
    table_id UUID REFERENCES public.restaurant_tables(id),
    server_id UUID REFERENCES public.staff(id), -- Mesero asignado
    customer_id UUID REFERENCES public.leads(id), -- Cliente (opcional)
    appointment_id UUID REFERENCES public.appointments(id), -- Reservación asociada

    -- Estado de la orden
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Recién creada
        'confirmed',    -- Confirmada
        'preparing',    -- En preparación
        'ready',        -- Lista para servir/recoger
        'served',       -- Servida
        'completed',    -- Completada y pagada
        'cancelled'     -- Cancelada
    )),

    -- Prioridad (1-5, 5 es más urgente)
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),

    -- Tiempos
    ordered_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    started_preparing_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    -- Tiempo estimado (minutos)
    estimated_prep_time INTEGER,
    actual_prep_time INTEGER, -- Calculado al completar

    -- Totales
    subtotal DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    discount_reason VARCHAR(255),
    tip_amount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(12, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'MXN',

    -- Pago
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN (
        'unpaid',
        'partial',
        'paid',
        'refunded'
    )),
    payment_method VARCHAR(50),
    paid_at TIMESTAMPTZ,

    -- Delivery info (si aplica)
    delivery_address JSONB,
    delivery_instructions TEXT,
    delivery_fee DECIMAL(10, 2),
    driver_id UUID REFERENCES public.staff(id),

    -- Notas
    customer_notes TEXT,
    kitchen_notes TEXT,
    internal_notes TEXT,

    -- Cancelación
    cancel_reason VARCHAR(255),
    cancelled_by UUID REFERENCES auth.users(id),

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Índices para restaurant_orders
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_tenant
    ON public.restaurant_orders(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_branch
    ON public.restaurant_orders(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_status
    ON public.restaurant_orders(branch_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_table
    ON public.restaurant_orders(table_id) WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_date
    ON public.restaurant_orders(branch_id, ordered_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_type
    ON public.restaurant_orders(branch_id, order_type) WHERE deleted_at IS NULL;


-- =====================================================
-- PARTE 2: RESTAURANT ORDER ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.restaurant_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,

    -- Item del menú
    menu_item_id UUID REFERENCES public.restaurant_menu_items(id),
    menu_item_name VARCHAR(255) NOT NULL, -- Snapshot del nombre al momento de ordenar

    -- Cantidad y precio
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,

    -- Variaciones
    variant_name VARCHAR(100),
    variant_price DECIMAL(10, 2) DEFAULT 0,
    size_name VARCHAR(50),
    size_price DECIMAL(10, 2) DEFAULT 0,

    -- Add-ons/Modificadores
    add_ons JSONB DEFAULT '[]', -- [{name, price, quantity}]
    modifiers JSONB DEFAULT '[]', -- [{type: 'remove' | 'extra', item}]

    -- Estado del item
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- En cola
        'preparing',    -- En preparación
        'ready',        -- Listo
        'served',       -- Servido
        'cancelled'     -- Cancelado
    )),

    -- Estación de cocina (para KDS)
    kitchen_station VARCHAR(50) DEFAULT 'main', -- main, grill, fry, salad, dessert, bar

    -- Tiempos
    started_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ,

    -- Cocinero asignado
    prepared_by UUID REFERENCES public.staff(id),

    -- Notas especiales
    special_instructions TEXT,
    allergen_notes TEXT,

    -- Orden dentro de la orden
    display_order INTEGER DEFAULT 0,

    -- Si es cortesía
    is_complimentary BOOLEAN DEFAULT false,
    complimentary_reason VARCHAR(255),

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para restaurant_order_items
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order
    ON public.restaurant_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_status
    ON public.restaurant_order_items(order_id, status);
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_station
    ON public.restaurant_order_items(kitchen_station, status)
    WHERE status IN ('pending', 'preparing');
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_menu
    ON public.restaurant_order_items(menu_item_id);


-- =====================================================
-- PARTE 3: KITCHEN STATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.kitchen_stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Identificación
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Tipo de estación
    station_type VARCHAR(30) DEFAULT 'prep' CHECK (station_type IN (
        'grill',        -- Parrilla
        'fry',          -- Freidora
        'salad',        -- Ensaladas/Fríos
        'sushi',        -- Sushi/Preparaciones frías
        'pizza',        -- Pizza
        'dessert',      -- Postres
        'bar',          -- Bebidas
        'expeditor',    -- Expedidor (organiza órdenes)
        'prep',         -- Preparación general
        'assembly'      -- Ensamblaje final
    )),

    -- Categorías de menú que maneja
    handles_categories UUID[] DEFAULT '{}',

    -- Impresora asociada
    printer_name VARCHAR(100),
    printer_ip VARCHAR(50),

    -- Display
    display_color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,

    -- Staff asignado por defecto
    default_staff_ids UUID[] DEFAULT '{}',

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    UNIQUE(branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_stations_branch
    ON public.kitchen_stations(branch_id) WHERE deleted_at IS NULL AND is_active = true;


-- =====================================================
-- PARTE 4: KDS ACTIVITY LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS public.kds_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Referencias
    order_id UUID REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES public.restaurant_order_items(id) ON DELETE CASCADE,
    station_id UUID REFERENCES public.kitchen_stations(id),

    -- Acción
    action VARCHAR(30) NOT NULL CHECK (action IN (
        'order_received',
        'item_started',
        'item_ready',
        'item_served',
        'item_cancelled',
        'order_bumped',
        'order_recalled',
        'priority_changed',
        'station_assigned',
        'note_added'
    )),

    -- Usuario que realizó la acción
    performed_by UUID REFERENCES auth.users(id),
    staff_id UUID REFERENCES public.staff(id),

    -- Detalles
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    notes TEXT,

    -- Timestamp
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kds_activity_order
    ON public.kds_activity_log(order_id);
CREATE INDEX IF NOT EXISTS idx_kds_activity_date
    ON public.kds_activity_log(branch_id, performed_at DESC);


-- =====================================================
-- PARTE 5: TRIGGERS Y FUNCIONES
-- =====================================================

-- Función para calcular totales de orden
CREATE OR REPLACE FUNCTION public.calculate_order_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subtotal DECIMAL(12, 2);
BEGIN
    -- Calcular subtotal de items
    SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
    FROM restaurant_order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
    AND status != 'cancelled';

    -- Actualizar la orden
    UPDATE restaurant_orders
    SET
        subtotal = v_subtotal,
        total = v_subtotal + COALESCE(tax_amount, 0) - COALESCE(discount_amount, 0) + COALESCE(tip_amount, 0) + COALESCE(delivery_fee, 0),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_calculate_order_totals ON restaurant_order_items;
CREATE TRIGGER trigger_calculate_order_totals
    AFTER INSERT OR UPDATE OF quantity, unit_price, subtotal, status OR DELETE
    ON restaurant_order_items
    FOR EACH ROW EXECUTE FUNCTION calculate_order_totals();


-- Función para generar número de orden
CREATE OR REPLACE FUNCTION public.generate_order_display_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_prefix VARCHAR(2);
BEGIN
    -- Obtener conteo de órdenes del día para esta sucursal
    SELECT COUNT(*) + 1 INTO v_count
    FROM restaurant_orders
    WHERE branch_id = NEW.branch_id
    AND DATE(ordered_at) = CURRENT_DATE;

    -- Prefijo según tipo
    v_prefix := CASE NEW.order_type
        WHEN 'dine_in' THEN 'M'
        WHEN 'takeout' THEN 'L'
        WHEN 'delivery' THEN 'D'
        WHEN 'drive_thru' THEN 'T'
        WHEN 'catering' THEN 'C'
        ELSE 'X'
    END;

    NEW.display_number := v_prefix || '-' || LPAD(v_count::TEXT, 3, '0');

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_order_number ON restaurant_orders;
CREATE TRIGGER trigger_generate_order_number
    BEFORE INSERT ON restaurant_orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_display_number();


-- Función para actualizar tiempos de orden
CREATE OR REPLACE FUNCTION public.update_order_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Actualizar timestamps según el nuevo estado
    IF NEW.status != OLD.status THEN
        CASE NEW.status
            WHEN 'confirmed' THEN
                NEW.confirmed_at := NOW();
            WHEN 'preparing' THEN
                NEW.started_preparing_at := NOW();
            WHEN 'ready' THEN
                NEW.ready_at := NOW();
                -- Calcular tiempo de preparación
                IF NEW.started_preparing_at IS NOT NULL THEN
                    NEW.actual_prep_time := EXTRACT(EPOCH FROM (NOW() - NEW.started_preparing_at)) / 60;
                END IF;
            WHEN 'served' THEN
                NEW.served_at := NOW();
            WHEN 'completed' THEN
                NEW.completed_at := NOW();
            WHEN 'cancelled' THEN
                NEW.cancelled_at := NOW();
        END CASE;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_order_timestamps ON restaurant_orders;
CREATE TRIGGER trigger_update_order_timestamps
    BEFORE UPDATE OF status ON restaurant_orders
    FOR EACH ROW EXECUTE FUNCTION update_order_timestamps();


-- Trigger updated_at
CREATE TRIGGER update_restaurant_orders_updated_at
    BEFORE UPDATE ON restaurant_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_order_items_updated_at
    BEFORE UPDATE ON restaurant_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kitchen_stations_updated_at
    BEFORE UPDATE ON kitchen_stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- PARTE 6: ROW LEVEL SECURITY
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kds_activity_log ENABLE ROW LEVEL SECURITY;

-- Políticas para service_role
CREATE POLICY "service_role_all_restaurant_orders" ON public.restaurant_orders
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_restaurant_order_items" ON public.restaurant_order_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_kitchen_stations" ON public.kitchen_stations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_kds_activity_log" ON public.kds_activity_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Políticas para usuarios autenticados
CREATE POLICY "tenant_select_restaurant_orders" ON public.restaurant_orders
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "tenant_manage_restaurant_orders" ON public.restaurant_orders
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "tenant_select_restaurant_order_items" ON public.restaurant_order_items
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "tenant_manage_restaurant_order_items" ON public.restaurant_order_items
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "tenant_select_kitchen_stations" ON public.kitchen_stations
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "tenant_manage_kitchen_stations" ON public.kitchen_stations
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

CREATE POLICY "tenant_select_kds_activity_log" ON public.kds_activity_log
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "tenant_insert_kds_activity_log" ON public.kds_activity_log
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles
            WHERE user_id = auth.uid() AND is_active = true
        )
    );


-- =====================================================
-- PARTE 7: VISTAS PARA KDS
-- =====================================================

-- Vista de órdenes activas para KDS
CREATE OR REPLACE VIEW public.v_kds_active_orders AS
SELECT
    ro.id as order_id,
    ro.tenant_id,
    ro.branch_id,
    ro.display_number,
    ro.order_type,
    ro.status as order_status,
    ro.priority,
    ro.ordered_at,
    ro.estimated_prep_time,
    ro.table_id,
    rt.table_number,
    ro.customer_notes,
    ro.kitchen_notes,
    (
        SELECT json_agg(json_build_object(
            'id', roi.id,
            'menu_item_name', roi.menu_item_name,
            'quantity', roi.quantity,
            'variant_name', roi.variant_name,
            'size_name', roi.size_name,
            'add_ons', roi.add_ons,
            'modifiers', roi.modifiers,
            'status', roi.status,
            'kitchen_station', roi.kitchen_station,
            'special_instructions', roi.special_instructions,
            'allergen_notes', roi.allergen_notes,
            'started_at', roi.started_at,
            'ready_at', roi.ready_at
        ) ORDER BY roi.display_order, roi.created_at)
        FROM restaurant_order_items roi
        WHERE roi.order_id = ro.id
        AND roi.status != 'cancelled'
    ) as items,
    EXTRACT(EPOCH FROM (NOW() - ro.ordered_at)) / 60 as minutes_elapsed
FROM restaurant_orders ro
LEFT JOIN restaurant_tables rt ON rt.id = ro.table_id
WHERE ro.status IN ('pending', 'confirmed', 'preparing', 'ready')
AND ro.deleted_at IS NULL
ORDER BY
    ro.priority DESC,
    ro.ordered_at ASC;


-- Vista de items por estación
CREATE OR REPLACE VIEW public.v_kds_items_by_station AS
SELECT
    roi.id as item_id,
    roi.tenant_id,
    roi.order_id,
    ro.branch_id,
    ro.display_number as order_number,
    ro.order_type,
    ro.priority as order_priority,
    roi.menu_item_name,
    roi.quantity,
    roi.variant_name,
    roi.size_name,
    roi.add_ons,
    roi.modifiers,
    roi.status as item_status,
    roi.kitchen_station,
    roi.special_instructions,
    roi.allergen_notes,
    roi.started_at,
    roi.ready_at,
    roi.created_at as ordered_at,
    rt.table_number,
    EXTRACT(EPOCH FROM (NOW() - roi.created_at)) / 60 as minutes_waiting
FROM restaurant_order_items roi
JOIN restaurant_orders ro ON ro.id = roi.order_id
LEFT JOIN restaurant_tables rt ON rt.id = ro.table_id
WHERE roi.status IN ('pending', 'preparing')
AND ro.status NOT IN ('completed', 'cancelled')
AND ro.deleted_at IS NULL
ORDER BY
    ro.priority DESC,
    roi.created_at ASC;


-- =====================================================
-- PARTE 8: REAL-TIME
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_orders;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_order_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_order_items;
    END IF;
END $$;


-- =====================================================
-- FIN DE LA MIGRACIÓN 089
-- =====================================================

SELECT 'Migration 089: Restaurant Orders & KDS Schema - COMPLETADA' as status;

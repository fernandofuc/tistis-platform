-- =====================================================
-- TIS TIS PLATFORM - RESTAURANT INVENTORY SCHEMA
-- Migration 090: Inventory Management System
-- =====================================================
-- Esta migración implementa el sistema de inventario
-- para restaurantes: ingredientes, stock y recetas
-- =====================================================

-- =====================================================
-- PARTE 1: INVENTORY CATEGORIES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inventory_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id), -- NULL = todas las sucursales

    -- Identificación
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES public.inventory_categories(id),

    -- Display
    icon VARCHAR(50),
    color VARCHAR(7) DEFAULT '#64748B',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_inventory_categories_tenant
    ON public.inventory_categories(tenant_id) WHERE deleted_at IS NULL;


-- =====================================================
-- PARTE 2: INVENTORY ITEMS (Ingredients/Products)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id), -- NULL = todas las sucursales
    category_id UUID REFERENCES public.inventory_categories(id),

    -- Identificación
    sku VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Tipo de item
    item_type VARCHAR(20) DEFAULT 'ingredient' CHECK (item_type IN (
        'ingredient',   -- Ingrediente para recetas
        'supply',       -- Suministros (servilletas, etc.)
        'equipment',    -- Equipo
        'packaging'     -- Empaque para llevar
    )),

    -- Unidades
    unit VARCHAR(20) NOT NULL DEFAULT 'unit', -- kg, g, l, ml, unit, box, etc.
    unit_cost DECIMAL(10, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'MXN',

    -- Stock
    current_stock DECIMAL(12, 3) DEFAULT 0,
    minimum_stock DECIMAL(12, 3) DEFAULT 0, -- Punto de reorden
    maximum_stock DECIMAL(12, 3), -- Capacidad máxima
    reorder_quantity DECIMAL(12, 3), -- Cantidad a pedir

    -- Almacenamiento
    storage_location VARCHAR(100), -- Ubicación en bodega
    storage_type VARCHAR(20) DEFAULT 'dry' CHECK (storage_type IN (
        'dry',          -- Almacén seco
        'refrigerated', -- Refrigerado
        'frozen',       -- Congelado
        'ambient'       -- Temperatura ambiente
    )),

    -- Caducidad
    is_perishable BOOLEAN DEFAULT true,
    default_shelf_life_days INTEGER, -- Días de vida útil
    track_expiration BOOLEAN DEFAULT true,

    -- Proveedor preferido
    preferred_supplier_id UUID,
    supplier_sku VARCHAR(50),

    -- Imágenes
    image_url TEXT,

    -- Alérgenos
    allergens TEXT[] DEFAULT '{}',

    -- Estado
    is_active BOOLEAN DEFAULT true,
    is_trackable BOOLEAN DEFAULT true, -- Si se rastrea en inventario

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant
    ON public.inventory_items(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_category
    ON public.inventory_items(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock
    ON public.inventory_items(tenant_id, current_stock, minimum_stock)
    WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku
    ON public.inventory_items(tenant_id, sku) WHERE deleted_at IS NULL;


-- =====================================================
-- PARTE 3: INVENTORY STOCK BATCHES (Lotes)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inventory_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,

    -- Identificación del lote
    batch_number VARCHAR(50),
    lot_number VARCHAR(50),

    -- Cantidades
    initial_quantity DECIMAL(12, 3) NOT NULL,
    current_quantity DECIMAL(12, 3) NOT NULL,
    reserved_quantity DECIMAL(12, 3) DEFAULT 0, -- Reservado para órdenes

    -- Costos
    unit_cost DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(12, 2) NOT NULL,

    -- Fechas
    received_at TIMESTAMPTZ DEFAULT NOW(),
    expiration_date DATE,
    manufactured_date DATE,

    -- Proveedor
    supplier_id UUID,
    purchase_order_id UUID,
    invoice_number VARCHAR(50),

    -- Estado
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN (
        'available',    -- Disponible
        'reserved',     -- Reservado
        'expired',      -- Expirado
        'damaged',      -- Dañado
        'consumed'      -- Consumido completamente
    )),

    -- Notas
    notes TEXT,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_item
    ON public.inventory_batches(item_id, branch_id)
    WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiration
    ON public.inventory_batches(branch_id, expiration_date)
    WHERE status = 'available' AND expiration_date IS NOT NULL;


-- =====================================================
-- PARTE 4: INVENTORY MOVEMENTS (Movimientos)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.inventory_batches(id),

    -- Tipo de movimiento
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN (
        'purchase',     -- Compra/Recepción
        'sale',         -- Venta
        'consumption',  -- Consumo en producción
        'waste',        -- Merma/Desperdicio
        'adjustment',   -- Ajuste de inventario
        'transfer_in',  -- Transferencia entrante
        'transfer_out', -- Transferencia saliente
        'return',       -- Devolución
        'production'    -- Producción (recetas)
    )),

    -- Cantidades
    quantity DECIMAL(12, 3) NOT NULL, -- Positivo = entrada, Negativo = salida
    previous_stock DECIMAL(12, 3) NOT NULL,
    new_stock DECIMAL(12, 3) NOT NULL,

    -- Costo
    unit_cost DECIMAL(10, 2),
    total_cost DECIMAL(12, 2),

    -- Referencias
    reference_type VARCHAR(50), -- order, recipe, purchase_order, count, etc.
    reference_id UUID, -- ID del documento relacionado

    -- Responsable
    performed_by UUID REFERENCES auth.users(id),
    staff_id UUID REFERENCES public.staff(id),

    -- Notas
    reason VARCHAR(255),
    notes TEXT,

    -- Timestamp
    performed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Metadatos
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item
    ON public.inventory_movements(item_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date
    ON public.inventory_movements(branch_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type
    ON public.inventory_movements(branch_id, movement_type);


-- =====================================================
-- PARTE 5: RECIPES (Recetas - Ingredientes por platillo)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.menu_item_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES public.restaurant_menu_items(id) ON DELETE CASCADE,

    -- Yield (porciones producidas)
    yield_quantity DECIMAL(10, 2) DEFAULT 1, -- Cuántas porciones produce
    yield_unit VARCHAR(20) DEFAULT 'portion',

    -- Costo calculado
    total_cost DECIMAL(10, 2) DEFAULT 0,
    cost_per_portion DECIMAL(10, 2) DEFAULT 0,

    -- Estado
    is_active BOOLEAN DEFAULT true,

    -- Notas
    preparation_notes TEXT,
    storage_notes TEXT,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_menu_item_recipes_menu
    ON public.menu_item_recipes(menu_item_id) WHERE deleted_at IS NULL;


-- =====================================================
-- PARTE 6: RECIPE INGREDIENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES public.menu_item_recipes(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,

    -- Cantidad
    quantity DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,

    -- Costo
    unit_cost DECIMAL(10, 2) DEFAULT 0,
    total_cost DECIMAL(10, 2) DEFAULT 0,

    -- Notas
    preparation_notes TEXT,
    is_optional BOOLEAN DEFAULT false,

    -- Display
    display_order INTEGER DEFAULT 0,

    -- Metadatos
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
    ON public.recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item
    ON public.recipe_ingredients(inventory_item_id);


-- =====================================================
-- PARTE 7: SUPPLIERS (Proveedores)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inventory_suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Información básica
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    tax_id VARCHAR(50), -- RFC

    -- Contacto
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    website TEXT,

    -- Dirección
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'México',

    -- Términos comerciales
    payment_terms VARCHAR(50), -- 'net_30', 'immediate', etc.
    credit_limit DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'MXN',

    -- Categorías que provee
    categories TEXT[] DEFAULT '{}',

    -- Calificación
    rating DECIMAL(3, 2),
    notes TEXT,

    -- Estado
    is_active BOOLEAN DEFAULT true,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inventory_suppliers_tenant
    ON public.inventory_suppliers(tenant_id) WHERE deleted_at IS NULL AND is_active = true;


-- =====================================================
-- PARTE 8: INVENTORY COUNTS (Conteos físicos)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inventory_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Información del conteo
    count_number VARCHAR(50),
    count_date DATE NOT NULL DEFAULT CURRENT_DATE,
    count_type VARCHAR(20) DEFAULT 'full' CHECK (count_type IN (
        'full',         -- Conteo completo
        'partial',      -- Conteo parcial
        'cycle',        -- Conteo cíclico
        'spot'          -- Conteo puntual
    )),

    -- Categorías incluidas (si es parcial)
    categories UUID[] DEFAULT '{}',

    -- Estado
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft',        -- Borrador
        'in_progress',  -- En progreso
        'completed',    -- Completado
        'approved',     -- Aprobado
        'cancelled'     -- Cancelado
    )),

    -- Responsables
    counted_by UUID REFERENCES public.staff(id),
    approved_by UUID REFERENCES public.staff(id),

    -- Tiempos
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,

    -- Resultados
    total_items INTEGER DEFAULT 0,
    items_with_variance INTEGER DEFAULT 0,
    total_variance_value DECIMAL(12, 2) DEFAULT 0,

    -- Notas
    notes TEXT,

    -- Metadatos
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_counts_branch
    ON public.inventory_counts(branch_id, count_date DESC);


-- =====================================================
-- PARTE 9: INVENTORY COUNT ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inventory_count_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    count_id UUID NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id),

    -- Cantidades
    expected_quantity DECIMAL(12, 3) NOT NULL, -- Según sistema
    counted_quantity DECIMAL(12, 3), -- Conteo físico
    variance DECIMAL(12, 3), -- Diferencia

    -- Costos
    unit_cost DECIMAL(10, 2),
    variance_value DECIMAL(10, 2),

    -- Notas
    notes TEXT,

    -- Timestamp
    counted_at TIMESTAMPTZ,

    -- Metadatos
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_inventory_count_items_count
    ON public.inventory_count_items(count_id);


-- =====================================================
-- PARTE 10: TRIGGERS Y FUNCIONES
-- =====================================================

-- Función para actualizar stock de item
CREATE OR REPLACE FUNCTION public.update_inventory_item_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Actualizar stock del item
    UPDATE inventory_items
    SET
        current_stock = current_stock + NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.item_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_item_stock ON inventory_movements;
CREATE TRIGGER trigger_update_item_stock
    AFTER INSERT ON inventory_movements
    FOR EACH ROW EXECUTE FUNCTION update_inventory_item_stock();


-- Función para calcular costo de receta
CREATE OR REPLACE FUNCTION public.calculate_recipe_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_cost DECIMAL(10, 2);
    v_yield DECIMAL(10, 2);
BEGIN
    -- Calcular costo total de ingredientes
    SELECT COALESCE(SUM(total_cost), 0) INTO v_total_cost
    FROM recipe_ingredients
    WHERE recipe_id = COALESCE(NEW.recipe_id, OLD.recipe_id);

    -- Obtener yield
    SELECT yield_quantity INTO v_yield
    FROM menu_item_recipes
    WHERE id = COALESCE(NEW.recipe_id, OLD.recipe_id);

    -- Actualizar costos en receta
    UPDATE menu_item_recipes
    SET
        total_cost = v_total_cost,
        cost_per_portion = CASE WHEN v_yield > 0 THEN v_total_cost / v_yield ELSE v_total_cost END,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.recipe_id, OLD.recipe_id);

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_calculate_recipe_cost ON recipe_ingredients;
CREATE TRIGGER trigger_calculate_recipe_cost
    AFTER INSERT OR UPDATE OR DELETE ON recipe_ingredients
    FOR EACH ROW EXECUTE FUNCTION calculate_recipe_cost();


-- Triggers updated_at
CREATE TRIGGER update_inventory_categories_updated_at
    BEFORE UPDATE ON inventory_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_batches_updated_at
    BEFORE UPDATE ON inventory_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_item_recipes_updated_at
    BEFORE UPDATE ON menu_item_recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipe_ingredients_updated_at
    BEFORE UPDATE ON recipe_ingredients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_suppliers_updated_at
    BEFORE UPDATE ON inventory_suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_counts_updated_at
    BEFORE UPDATE ON inventory_counts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- PARTE 11: ROW LEVEL SECURITY
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;

-- Políticas para service_role
CREATE POLICY "service_role_all_inventory_categories" ON public.inventory_categories
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_inventory_items" ON public.inventory_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_inventory_batches" ON public.inventory_batches
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_inventory_movements" ON public.inventory_movements
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_menu_item_recipes" ON public.menu_item_recipes
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_recipe_ingredients" ON public.recipe_ingredients
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_inventory_suppliers" ON public.inventory_suppliers
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_inventory_counts" ON public.inventory_counts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_inventory_count_items" ON public.inventory_count_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Políticas para usuarios autenticados (tenant-based)
CREATE POLICY "tenant_access_inventory_categories" ON public.inventory_categories
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_access_inventory_items" ON public.inventory_items
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_access_inventory_batches" ON public.inventory_batches
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_access_inventory_movements" ON public.inventory_movements
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_access_menu_item_recipes" ON public.menu_item_recipes
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_access_recipe_ingredients" ON public.recipe_ingredients
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_access_inventory_suppliers" ON public.inventory_suppliers
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_access_inventory_counts" ON public.inventory_counts
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "tenant_access_inventory_count_items" ON public.inventory_count_items
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true))
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND is_active = true));


-- =====================================================
-- PARTE 12: VISTAS ÚTILES
-- =====================================================

-- Vista de items con stock bajo
CREATE OR REPLACE VIEW public.v_low_stock_items AS
SELECT
    i.id,
    i.tenant_id,
    i.branch_id,
    i.sku,
    i.name,
    i.category_id,
    ic.name as category_name,
    i.current_stock,
    i.minimum_stock,
    i.unit,
    i.unit_cost,
    i.is_perishable,
    i.storage_type,
    (i.minimum_stock - i.current_stock) as shortage,
    CASE
        WHEN i.current_stock <= 0 THEN 'out_of_stock'
        WHEN i.current_stock <= i.minimum_stock * 0.5 THEN 'critical'
        ELSE 'low'
    END as stock_status
FROM inventory_items i
LEFT JOIN inventory_categories ic ON ic.id = i.category_id
WHERE i.is_active = true
AND i.deleted_at IS NULL
AND i.current_stock <= i.minimum_stock;


-- Vista de lotes próximos a expirar
CREATE OR REPLACE VIEW public.v_expiring_batches AS
SELECT
    b.id as batch_id,
    b.tenant_id,
    b.branch_id,
    b.item_id,
    i.name as item_name,
    i.sku,
    b.batch_number,
    b.current_quantity,
    b.unit_cost,
    b.expiration_date,
    (b.expiration_date - CURRENT_DATE) as days_until_expiration,
    CASE
        WHEN b.expiration_date <= CURRENT_DATE THEN 'expired'
        WHEN b.expiration_date <= CURRENT_DATE + 3 THEN 'critical'
        WHEN b.expiration_date <= CURRENT_DATE + 7 THEN 'warning'
        ELSE 'ok'
    END as expiration_status
FROM inventory_batches b
JOIN inventory_items i ON i.id = b.item_id
WHERE b.status = 'available'
AND b.current_quantity > 0
AND b.expiration_date IS NOT NULL
AND b.expiration_date <= CURRENT_DATE + 14
ORDER BY b.expiration_date;


-- =====================================================
-- FIN DE LA MIGRACIÓN 090
-- =====================================================

SELECT 'Migration 090: Restaurant Inventory Schema - COMPLETADA' as status;

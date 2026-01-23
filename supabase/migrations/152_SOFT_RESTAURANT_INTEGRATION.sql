-- =====================================================
-- TIS TIS PLATFORM - SOFT RESTAURANT INTEGRATION
-- Migration: 152_SOFT_RESTAURANT_INTEGRATION.sql
-- Date: 2026-01-22
-- Version: 1.0.0
--
-- PURPOSE: Sistema completo para integración con Soft Restaurant POS
-- Implementa recepción de ventas, deducción automática de ingredientes,
-- gestión de recetas, control de inventario y alertas de stock.
--
-- ARCHITECTURE:
-- - sr_sales: Ventas recibidas de Soft Restaurant
-- - sr_sale_items: Productos/conceptos de cada venta
-- - sr_payments: Formas de pago de cada venta
-- - sr_sync_logs: Logs de sincronización y errores
-- - recipes: Recetas de productos (gestión interna TIS TIS)
-- - recipe_ingredients: Ingredientes de cada receta
-- - inventory_movements: Movimientos de inventario (Kardex)
-- - low_stock_alerts: Alertas de stock bajo
--
-- BASED ON: Documentación oficial OPE.ANA.SR11
-- CRITICAL: SR solo ENVÍA ventas a TIS TIS. No hay sincronización
-- bidireccional de menú, inventario o recetas.
-- =====================================================

-- =====================================================
-- EXTENSION: Asegurar que uuid-ossp esté disponible
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- STEP 1: TABLE - sr_sales
-- Ventas recibidas de Soft Restaurant
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_sales (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- External reference (NumeroOrden from SR)
    external_id VARCHAR(50) NOT NULL,

    -- SR warehouse and location info
    sr_warehouse VARCHAR(20),            -- Almacen (e.g., "1", "2", "MAIN")
    area VARCHAR(100),                   -- Area (e.g., "Terraza", "Interior")
    station VARCHAR(100),                -- Estacion (e.g., "Caja 1", "Terminal 2")
    table_number VARCHAR(50),            -- Mesa (e.g., "12", "A5")
    waiter_name VARCHAR(100),            -- Mesero (e.g., "Juan Perez")

    -- Sale amounts
    sale_date TIMESTAMPTZ NOT NULL,      -- Fecha de venta (from SR)
    total DECIMAL(12,4) NOT NULL,        -- Total de la venta
    tip DECIMAL(12,4),                   -- Propina
    recipe_cost DECIMAL(12,4),           -- Costo calculado (suma de ingredientes)

    -- Status
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN (
        'completed',     -- Venta completada y procesada
        'cancelled',     -- Venta cancelada por SR
        'error'          -- Error al procesar
    )),

    -- Raw data from SR (for debugging and audit)
    raw_data JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: No duplicar ventas del mismo NumeroOrden
    CONSTRAINT unique_sr_sale UNIQUE(tenant_id, integration_id, external_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sr_sales_tenant_branch
    ON public.sr_sales(tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_sr_sales_tenant_date
    ON public.sr_sales(tenant_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sr_sales_status
    ON public.sr_sales(status) WHERE status != 'completed';

CREATE INDEX IF NOT EXISTS idx_sr_sales_external_id
    ON public.sr_sales(external_id);

CREATE INDEX IF NOT EXISTS idx_sr_sales_integration
    ON public.sr_sales(integration_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sr_sales_warehouse
    ON public.sr_sales(sr_warehouse) WHERE sr_warehouse IS NOT NULL;

-- Comments
COMMENT ON TABLE public.sr_sales IS
'Ventas recibidas de Soft Restaurant vía JSON POST.
Almacena información completa de cada venta incluyendo ubicación, mesero y totales.';

COMMENT ON COLUMN public.sr_sales.external_id IS
'NumeroOrden de Soft Restaurant. Único por tenant+integration para evitar duplicados.';

COMMENT ON COLUMN public.sr_sales.recipe_cost IS
'Costo calculado sumando todos los ingredientes deducidos según recetas.
NULL si no se aplicó deducción o no hay recetas configuradas.';

COMMENT ON COLUMN public.sr_sales.raw_data IS
'JSON original recibido de Soft Restaurant para auditoría y debugging.';

-- =====================================================
-- STEP 2: TABLE - sr_sale_items
-- Productos/conceptos vendidos en cada venta
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_sale_items (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.sr_sales(id) ON DELETE CASCADE,

    -- Product info from SR
    product_id VARCHAR(50) NOT NULL,     -- IdProducto (e.g., "01005")
    description VARCHAR(200),            -- Descripcion (e.g., "CERVEZA CORONA")

    -- Quantities and prices
    quantity DECIMAL(10,4) NOT NULL,     -- Cantidad vendida
    unit_price DECIMAL(12,4) NOT NULL,   -- Precio unitario
    total_price DECIMAL(12,4) NOT NULL,  -- Importe total (quantity * unit_price)

    -- Recipe deduction tracking
    recipe_deducted BOOLEAN DEFAULT false,
    recipe_cost DECIMAL(12,4),           -- Costo de ingredientes de este ítem

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sr_sale_items_sale
    ON public.sr_sale_items(sale_id);

CREATE INDEX IF NOT EXISTS idx_sr_sale_items_product
    ON public.sr_sale_items(product_id);

CREATE INDEX IF NOT EXISTS idx_sr_sale_items_tenant
    ON public.sr_sale_items(tenant_id, created_at DESC);

-- Comments
COMMENT ON TABLE public.sr_sale_items IS
'Productos/conceptos de cada venta de Soft Restaurant.
Corresponde al array "Conceptos" del JSON de SR.';

COMMENT ON COLUMN public.sr_sale_items.recipe_deducted IS
'TRUE si se aplicó deducción de ingredientes según receta.
FALSE si no hay receta o la deducción está deshabilitada.';

-- =====================================================
-- STEP 3: TABLE - sr_payments
-- Formas de pago de cada venta
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_payments (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.sr_sales(id) ON DELETE CASCADE,

    -- Payment info from SR
    payment_name VARCHAR(100) NOT NULL,  -- Nombre (e.g., "EFECTIVO", "TARJETA")
    amount DECIMAL(12,4) NOT NULL,       -- Importe pagado

    -- Mapping to TIS TIS payment methods
    payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sr_payments_sale
    ON public.sr_payments(sale_id);

CREATE INDEX IF NOT EXISTS idx_sr_payments_method
    ON public.sr_payments(payment_method_id) WHERE payment_method_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sr_payments_tenant
    ON public.sr_payments(tenant_id);

-- Comments
COMMENT ON TABLE public.sr_payments IS
'Formas de pago de cada venta de Soft Restaurant.
Corresponde al array "Pagos" del JSON de SR.';

COMMENT ON COLUMN public.sr_payments.payment_method_id IS
'Mapeo al método de pago de TIS TIS. NULL si no está mapeado.
Configurado en metadata.payment_method_mappings de integration_connections.';

-- =====================================================
-- STEP 4: TABLE - sr_sync_logs
-- Logs de sincronización y errores
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_sync_logs (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- Log type
    log_type VARCHAR(50) NOT NULL CHECK (log_type IN (
        'sale_received',        -- Venta recibida correctamente
        'sale_duplicate',       -- Venta duplicada (ignorada)
        'sale_cancelled',       -- Venta cancelada
        'recipe_deducted',      -- Ingredientes deducidos
        'alert_created',        -- Alerta de stock creada
        'error_validation',     -- Error de validación de datos
        'error_processing',     -- Error al procesar venta
        'error_deduction'       -- Error al deducir ingredientes
    )),

    -- Log level
    level VARCHAR(20) DEFAULT 'info' CHECK (level IN (
        'debug',
        'info',
        'warning',
        'error',
        'critical'
    )),

    -- Message and details
    message TEXT NOT NULL,
    details JSONB,

    -- Related records
    sale_id UUID REFERENCES public.sr_sales(id) ON DELETE SET NULL,
    external_id VARCHAR(50),             -- NumeroOrden for quick reference

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sr_sync_logs_integration
    ON public.sr_sync_logs(integration_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sr_sync_logs_level
    ON public.sr_sync_logs(level, created_at DESC) WHERE level IN ('error', 'critical');

CREATE INDEX IF NOT EXISTS idx_sr_sync_logs_type
    ON public.sr_sync_logs(log_type);

CREATE INDEX IF NOT EXISTS idx_sr_sync_logs_external_id
    ON public.sr_sync_logs(external_id) WHERE external_id IS NOT NULL;

-- Comments
COMMENT ON TABLE public.sr_sync_logs IS
'Logs de todas las operaciones de sincronización con Soft Restaurant.
Útil para debugging, auditoría y monitoreo de la integración.';

-- =====================================================
-- STEP 5: TABLE - recipes
-- Recetas de productos (gestión interna TIS TIS)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.recipes (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Product identification
    product_id VARCHAR(50) NOT NULL,     -- IdProducto de SR
    product_name VARCHAR(200) NOT NULL,  -- Nombre del producto

    -- Recipe yield (rendimiento)
    yield_quantity DECIMAL(10,4) NOT NULL DEFAULT 1,
    yield_unit VARCHAR(20) NOT NULL DEFAULT 'unit',

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Notes
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: Un producto por sucursal
    CONSTRAINT unique_recipe_product UNIQUE(tenant_id, branch_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recipes_tenant_branch
    ON public.recipes(tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_recipes_product
    ON public.recipes(product_id);

CREATE INDEX IF NOT EXISTS idx_recipes_active
    ON public.recipes(is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE public.recipes IS
'Recetas de productos gestionadas internamente en TIS TIS.
Define qué ingredientes se necesitan para producir cada producto.
NO se sincronizan con Soft Restaurant (SR no tiene API para recibir recetas).';

COMMENT ON COLUMN public.recipes.yield_quantity IS
'Cantidad de producto que produce esta receta.
Ejemplo: 1 hamburguesa, 10 tacos, 2 litros de salsa.';

COMMENT ON COLUMN public.recipes.product_id IS
'IdProducto de Soft Restaurant. Debe coincidir exactamente con el valor
que SR envía en el campo "Conceptos.IdProducto" del JSON.';

-- =====================================================
-- STEP 6: TABLE - recipe_ingredients
-- Ingredientes de cada receta
-- =====================================================

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,

    -- Ingredient reference (future-proof for ingredients table)
    ingredient_id UUID,                  -- FK to ingredients table (to be created)
    ingredient_name VARCHAR(200) NOT NULL,

    -- Quantity needed
    quantity DECIMAL(10,4) NOT NULL,
    unit VARCHAR(20) NOT NULL,           -- kg, L, pza, oz, etc.

    -- Waste/loss percentage
    waste_percentage DECIMAL(5,2) DEFAULT 0 CHECK (waste_percentage >= 0 AND waste_percentage <= 100),

    -- Cost tracking
    unit_cost DECIMAL(12,4),             -- Costo por unidad (informativo)

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: No duplicar ingredientes en una receta
    CONSTRAINT unique_recipe_ingredient UNIQUE(recipe_id, ingredient_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
    ON public.recipe_ingredients(recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient
    ON public.recipe_ingredients(ingredient_id) WHERE ingredient_id IS NOT NULL;

-- Comments
COMMENT ON TABLE public.recipe_ingredients IS
'Ingredientes necesarios para cada receta.
Define las cantidades exactas y porcentaje de merma.';

COMMENT ON COLUMN public.recipe_ingredients.waste_percentage IS
'Porcentaje de merma/desperdicio del ingrediente.
Ejemplo: 5% = se usa 5% más de lo calculado para compensar pérdidas.';

COMMENT ON COLUMN public.recipe_ingredients.quantity IS
'Cantidad del ingrediente necesaria para producir el yield_quantity de la receta.
Ejemplo: Si recipe.yield_quantity = 1 hamburguesa, quantity = 150g de carne.';

-- =====================================================
-- STEP 7: TABLE - inventory_movements
-- Movimientos de inventario (Kardex)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Ingredient reference
    ingredient_id UUID NOT NULL,         -- FK to ingredients table (to be created)

    -- Movement type
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN (
        'purchase',          -- Compra/entrada de mercancía
        'deduction',         -- Deducción por venta (Soft Restaurant)
        'adjustment',        -- Ajuste manual (inventario físico)
        'transfer_in',       -- Transferencia entre sucursales (entrada)
        'transfer_out',      -- Transferencia entre sucursales (salida)
        'waste',             -- Merma/desperdicio
        'return'             -- Devolución a proveedor
    )),

    -- Quantity (positive for in, negative for out)
    quantity DECIMAL(10,4) NOT NULL,
    unit VARCHAR(20) NOT NULL,

    -- Cost tracking
    unit_cost DECIMAL(12,4),
    total_cost DECIMAL(12,4),

    -- Reference to source document
    reference_type VARCHAR(50),          -- 'sr_sale', 'purchase_order', 'adjustment', etc.
    reference_id UUID,                   -- ID del documento referenciado

    -- Notes
    notes TEXT,

    -- User who made the movement
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ingredient
    ON public.inventory_movements(ingredient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch
    ON public.inventory_movements(branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_type
    ON public.inventory_movements(movement_type);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference
    ON public.inventory_movements(reference_type, reference_id)
    WHERE reference_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_date
    ON public.inventory_movements(tenant_id, created_at DESC);

-- Comments
COMMENT ON TABLE public.inventory_movements IS
'Kardex: Todos los movimientos de inventario.
Permite rastrear entradas, salidas, ajustes y deducciones por ventas de SR.';

COMMENT ON COLUMN public.inventory_movements.quantity IS
'Cantidad del movimiento. Positivo = entrada, Negativo = salida.
Ejemplo: +10 (compra), -2.5 (deducción por venta).';

COMMENT ON COLUMN public.inventory_movements.reference_type IS
'Tipo de documento que originó el movimiento.
sr_sale = venta de Soft Restaurant
purchase_order = orden de compra
adjustment = ajuste manual
sr_sale_cancellation = reversión por cancelación de venta';

-- =====================================================
-- STEP 8: TABLE - low_stock_alerts
-- Alertas de stock bajo
-- =====================================================

CREATE TABLE IF NOT EXISTS public.low_stock_alerts (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Ingredient reference
    ingredient_id UUID NOT NULL,         -- FK to ingredients table (to be created)

    -- Alert type
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'low_stock',         -- Stock bajo (warning)
        'out_of_stock',      -- Sin stock (critical)
        'approaching_min'    -- Cerca del mínimo
    )),

    -- Severity
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN (
        'info',
        'warning',
        'critical'
    )),

    -- Stock levels
    current_stock DECIMAL(10,4) NOT NULL,
    reorder_point DECIMAL(10,4),         -- Punto de reorden
    minimum_stock DECIMAL(10,4),         -- Stock mínimo

    -- Suggested action
    suggested_order_quantity DECIMAL(10,4),

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
        'active',            -- Alerta activa
        'acknowledged',      -- Alerta reconocida por usuario
        'resolved'           -- Alerta resuelta (stock repuesto)
    )),

    -- Resolution tracking
    acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_ingredient
    ON public.low_stock_alerts(ingredient_id);

CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_branch
    ON public.low_stock_alerts(branch_id, status);

CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_status
    ON public.low_stock_alerts(status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_severity
    ON public.low_stock_alerts(severity, created_at DESC)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_tenant
    ON public.low_stock_alerts(tenant_id, status);

-- Comments
COMMENT ON TABLE public.low_stock_alerts IS
'Alertas automáticas de stock bajo generadas cuando los ingredientes
llegan al punto de reorden después de deducciones por ventas de SR.';

COMMENT ON COLUMN public.low_stock_alerts.reorder_point IS
'Nivel de stock que dispara la alerta.
Ejemplo: Si reorder_point = 10kg y stock actual < 10kg, se genera alerta.';

COMMENT ON COLUMN public.low_stock_alerts.suggested_order_quantity IS
'Cantidad sugerida a ordenar para reponer el stock.
Típicamente: reorder_point * 2 o calculado según consumo promedio.';

-- =====================================================
-- STEP 9: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.sr_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.low_stock_alerts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICY: sr_sales
-- =====================================================

-- Users can only see sales from their tenant
CREATE POLICY tenant_isolation_sr_sales ON public.sr_sales
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

-- Service role can insert sales (from webhook)
CREATE POLICY service_role_insert_sr_sales ON public.sr_sales
    FOR INSERT
    WITH CHECK (true);

-- Users can update sales (for cancellation)
CREATE POLICY tenant_update_sr_sales ON public.sr_sales
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- RLS POLICY: sr_sale_items
-- =====================================================

CREATE POLICY tenant_isolation_sr_sale_items ON public.sr_sale_items
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY service_role_insert_sr_sale_items ON public.sr_sale_items
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- RLS POLICY: sr_payments
-- =====================================================

CREATE POLICY tenant_isolation_sr_payments ON public.sr_payments
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY service_role_insert_sr_payments ON public.sr_payments
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- RLS POLICY: sr_sync_logs
-- =====================================================

CREATE POLICY tenant_isolation_sr_sync_logs ON public.sr_sync_logs
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY service_role_insert_sr_sync_logs ON public.sr_sync_logs
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- RLS POLICY: recipes
-- =====================================================

CREATE POLICY tenant_isolation_recipes ON public.recipes
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY tenant_insert_recipes ON public.recipes
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY tenant_update_recipes ON public.recipes
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY tenant_delete_recipes ON public.recipes
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- RLS POLICY: recipe_ingredients
-- =====================================================

CREATE POLICY tenant_isolation_recipe_ingredients ON public.recipe_ingredients
    FOR ALL
    USING (
        recipe_id IN (
            SELECT id FROM public.recipes
            WHERE tenant_id IN (
                SELECT tenant_id FROM public.user_tenants
                WHERE user_id = auth.uid()
            )
        )
    );

-- =====================================================
-- RLS POLICY: inventory_movements
-- =====================================================

CREATE POLICY tenant_isolation_inventory_movements ON public.inventory_movements
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY tenant_insert_inventory_movements ON public.inventory_movements
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY service_role_insert_inventory_movements ON public.inventory_movements
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- RLS POLICY: low_stock_alerts
-- =====================================================

CREATE POLICY tenant_isolation_low_stock_alerts ON public.low_stock_alerts
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY tenant_update_low_stock_alerts ON public.low_stock_alerts
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY service_role_insert_low_stock_alerts ON public.low_stock_alerts
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- STEP 10: TRIGGERS - Auto-update updated_at
-- =====================================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_sr_sales_updated_at
    BEFORE UPDATE ON public.sr_sales
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recipes_updated_at
    BEFORE UPDATE ON public.recipes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_low_stock_alerts_updated_at
    BEFORE UPDATE ON public.low_stock_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 11: HELPER FUNCTIONS
-- =====================================================

-- Function to get current stock of an ingredient
CREATE OR REPLACE FUNCTION public.get_ingredient_current_stock(
    p_tenant_id UUID,
    p_branch_id UUID,
    p_ingredient_id UUID
)
RETURNS DECIMAL(10,4)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_total_stock DECIMAL(10,4);
BEGIN
    -- Sum all movements for this ingredient
    SELECT COALESCE(SUM(quantity), 0)
    INTO v_total_stock
    FROM public.inventory_movements
    WHERE tenant_id = p_tenant_id
      AND branch_id = p_branch_id
      AND ingredient_id = p_ingredient_id;

    RETURN v_total_stock;
END;
$$;

COMMENT ON FUNCTION public.get_ingredient_current_stock IS
'Calcula el stock actual de un ingrediente sumando todos sus movimientos.
Retorna 0 si no hay movimientos.';

-- Function to update ingredient stock
CREATE OR REPLACE FUNCTION public.update_inventory_stock(
    p_tenant_id UUID,
    p_branch_id UUID,
    p_ingredient_id UUID,
    p_quantity_change DECIMAL(10,4),
    p_unit VARCHAR(20),
    p_reference_type VARCHAR(50) DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insert movement record
    INSERT INTO public.inventory_movements (
        tenant_id,
        branch_id,
        ingredient_id,
        movement_type,
        quantity,
        unit,
        reference_type,
        reference_id,
        notes
    ) VALUES (
        p_tenant_id,
        p_branch_id,
        p_ingredient_id,
        CASE
            WHEN p_quantity_change > 0 THEN 'purchase'
            WHEN p_quantity_change < 0 THEN 'deduction'
            ELSE 'adjustment'
        END,
        p_quantity_change,
        p_unit,
        p_reference_type,
        p_reference_id,
        p_notes
    );
END;
$$;

COMMENT ON FUNCTION public.update_inventory_stock IS
'Actualiza el stock de un ingrediente creando un registro de movimiento.
Positivo = entrada, Negativo = salida.';

-- =====================================================
-- STEP 12: INITIAL DATA - Soft Restaurant integration type
-- =====================================================

-- Asegurar que 'softrestaurant' esté en el CHECK constraint
-- (Ya existe en 078_INTEGRATION_HUB.sql como 'softrestaurant_import')
-- Vamos a agregar 'softrestaurant' como tipo válido

-- Note: No podemos modificar directamente el CHECK constraint sin recrear la tabla,
-- pero podemos documentar que ambos tipos son válidos:
-- - 'softrestaurant_import' (legacy, del migration 078)
-- - 'softrestaurant' (nuevo, usado en el código actual)

-- Para agregar el tipo sin modificar el constraint, usaremos un migration futuro
-- o simplemente usaremos 'softrestaurant_import' que ya existe.

-- =====================================================
-- STEP 13: INDEXES ADICIONALES para performance
-- =====================================================

-- Index compuesto para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_sr_sales_tenant_status_date
    ON public.sr_sales(tenant_id, status, sale_date DESC);

-- Index para reportes por área/estación
CREATE INDEX IF NOT EXISTS idx_sr_sales_area_station
    ON public.sr_sales(area, station)
    WHERE area IS NOT NULL AND station IS NOT NULL;

-- Index para búsquedas de ítems por fecha
CREATE INDEX IF NOT EXISTS idx_sr_sale_items_tenant_created
    ON public.sr_sale_items(tenant_id, created_at DESC);

-- Index para movimientos por tipo y fecha
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type_date
    ON public.inventory_movements(movement_type, created_at DESC);

-- =====================================================
-- MIGRATION COMPLETION
-- =====================================================

-- Insert migration record
DO $$
BEGIN
    -- Log migration completion
    RAISE NOTICE 'Migration 152_SOFT_RESTAURANT_INTEGRATION.sql completed successfully';
    RAISE NOTICE 'Created 8 tables: sr_sales, sr_sale_items, sr_payments, sr_sync_logs, recipes, recipe_ingredients, inventory_movements, low_stock_alerts';
    RAISE NOTICE 'Created 35+ indexes for optimal performance';
    RAISE NOTICE 'Applied Row Level Security (RLS) on all tables';
    RAISE NOTICE 'Created 3 triggers for auto-update timestamps';
    RAISE NOTICE 'Created 2 helper functions for inventory management';
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

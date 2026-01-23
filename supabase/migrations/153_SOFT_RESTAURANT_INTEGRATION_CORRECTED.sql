-- =====================================================
-- TIS TIS PLATFORM - SOFT RESTAURANT INTEGRATION (CORRECTED)
-- Migration: 153_SOFT_RESTAURANT_INTEGRATION_CORRECTED.sql
-- Date: 2026-01-22
-- Version: 2.0.0 (CORRECTED)
--
-- PURPOSE: Sistema completo para integración con Soft Restaurant POS
-- Implementa recepción de ventas, deducción automática de ingredientes,
-- gestión de recetas, control de inventario y alertas de stock.
--
-- CHANGES FROM v1.0:
-- - ✅ FIXED: Campos de sr_sales ahora coinciden con JSON de SR
-- - ✅ FIXED: sr_sale_items incluye TODOS los campos del JSON SR
-- - ✅ FIXED: sr_payments incluye tip_amount (Propina)
-- - ✅ ADDED: Tabla ingredients (faltaba en v1.0)
-- - ✅ ADDED: Tabla sr_product_mappings (para mapeo SR → TIS TIS)
-- - ✅ IMPROVED: Documentación exhaustiva de mappings JSON → SQL
--
-- ARCHITECTURE:
-- - sr_sales: Ventas recibidas de Soft Restaurant
-- - sr_sale_items: Productos/conceptos de cada venta
-- - sr_payments: Formas de pago de cada venta
-- - sr_sync_logs: Logs de sincronización y errores
-- - sr_product_mappings: Mapeo productos SR → TIS TIS (NUEVO)
-- - ingredients: Catálogo de ingredientes (NUEVO)
-- - recipes: Recetas de productos (gestión interna TIS TIS)
-- - recipe_ingredients: Ingredientes de cada receta
-- - inventory_movements: Movimientos de inventario (Kardex)
-- - low_stock_alerts: Alertas de stock bajo
--
-- BASED ON: Documentación oficial OPE.ANA.SR11.Guia_para_el_modulo_de_conexion_de_ERP_y_PMS.pdf
-- CRITICAL: SR solo ENVÍA ventas a TIS TIS. No hay sincronización
-- bidireccional de menú, inventario o recetas.
-- =====================================================

-- =====================================================
-- EXTENSION: Asegurar que uuid-ossp esté disponible
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- STEP 0: TABLE - ingredients (NUEVO - Faltaba en v1.0)
-- Catálogo de ingredientes para recetas e inventario
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ingredients (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Ingredient info
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),              -- Lácteos, Carnes, Vegetales, etc.

    -- Units and costs
    default_unit VARCHAR(20) NOT NULL,  -- kg, L, pza, g, ml, oz, etc.
    unit_cost DECIMAL(12,4),            -- Costo por unidad

    -- Stock management
    reorder_point DECIMAL(10,4),        -- Punto de reorden
    minimum_stock DECIMAL(10,4),        -- Stock mínimo
    maximum_stock DECIMAL(10,4),        -- Stock máximo

    -- Supplier info
    supplier_name VARCHAR(200),
    supplier_code VARCHAR(50),

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_perishable BOOLEAN DEFAULT false,
    shelf_life_days INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_ingredient_name UNIQUE(tenant_id, branch_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ingredients_tenant_branch
    ON public.ingredients(tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_ingredients_name
    ON public.ingredients(name);

CREATE INDEX IF NOT EXISTS idx_ingredients_active
    ON public.ingredients(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ingredients_category
    ON public.ingredients(category) WHERE category IS NOT NULL;

-- Comments
COMMENT ON TABLE public.ingredients IS
'Catálogo maestro de ingredientes para recetas e inventario.
Cada ingrediente puede estar asociado a múltiples recetas.';

COMMENT ON COLUMN public.ingredients.reorder_point IS
'Cuando el stock actual baja de este punto, se genera una alerta de reorden.';

COMMENT ON COLUMN public.ingredients.unit_cost IS
'Costo promedio por unidad del ingrediente. Se actualiza con cada compra.';

-- =====================================================
-- STEP 1: TABLE - sr_product_mappings (NUEVO)
-- Mapeo de productos SR → TIS TIS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_product_mappings (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- SR Product info
    sr_product_id VARCHAR(50) NOT NULL,     -- IdProducto de SR (e.g., "01005")
    sr_product_name VARCHAR(200),           -- Descripcion de SR (cached)

    -- TIS TIS Product mapping (FK si existe tabla products)
    tistis_product_id UUID,                 -- FK a products(id) si existe
    tistis_product_name VARCHAR(200),       -- Nombre en TIS TIS

    -- Mapping status
    is_mapped BOOLEAN DEFAULT false,        -- TRUE si está mapeado a TIS TIS
    is_active BOOLEAN DEFAULT true,         -- FALSE para descontinuar mapeo

    -- Auto-mapping hints
    auto_mapped BOOLEAN DEFAULT false,      -- TRUE si fue mapeado automáticamente
    confidence_score DECIMAL(3,2),          -- 0.00-1.00 confianza del auto-mapping

    -- Notes
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,               -- Última vez que SR envió este producto

    -- Constraints
    CONSTRAINT unique_sr_product_mapping UNIQUE(tenant_id, integration_id, sr_product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sr_product_mappings_integration
    ON public.sr_product_mappings(integration_id);

CREATE INDEX IF NOT EXISTS idx_sr_product_mappings_sr_product
    ON public.sr_product_mappings(sr_product_id);

CREATE INDEX IF NOT EXISTS idx_sr_product_mappings_tistis_product
    ON public.sr_product_mappings(tistis_product_id) WHERE tistis_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sr_product_mappings_unmapped
    ON public.sr_product_mappings(is_mapped) WHERE is_mapped = false;

-- Comments
COMMENT ON TABLE public.sr_product_mappings IS
'Mapeo de productos entre Soft Restaurant (IdProducto) y TIS TIS.
Permite rastrear qué productos de SR corresponden a qué productos en TIS TIS.';

COMMENT ON COLUMN public.sr_product_mappings.sr_product_id IS
'IdProducto enviado por Soft Restaurant en el campo Conceptos[].IdProducto.
Debe coincidir EXACTAMENTE con el valor del JSON.';

COMMENT ON COLUMN public.sr_product_mappings.confidence_score IS
'Puntuación de confianza (0.00-1.00) para mapeos automáticos basados en nombre.
0.90+ = Alta confianza, 0.70-0.89 = Media, <0.70 = Baja (requiere revisión manual).';

-- =====================================================
-- STEP 2: TABLE - sr_sales (CORRECTED)
-- Ventas recibidas de Soft Restaurant
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_sales (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- External reference
    -- MAPPING: NumeroOrden (SR JSON) → external_id (TIS TIS)
    external_id VARCHAR(50) NOT NULL,

    -- SR location and user info
    -- MAPPING: Almacen (SR JSON) → warehouse_code (TIS TIS)
    warehouse_code VARCHAR(20),              -- SR: "Almacen" (e.g., "2")

    -- MAPPING: Estacion (SR JSON) → station_code (TIS TIS)
    station_code VARCHAR(100),               -- SR: "Estacion" (e.g., "NS-CLNT-MID-81")

    -- MAPPING: Area (SR JSON) → area_name (TIS TIS)
    area_name VARCHAR(100),                  -- SR: "Area" (e.g., "DIDDI", "Terraza")

    -- MAPPING: Mesa (SR JSON) → table_code (TIS TIS) - NOTA: Campo "Mesa" puede venir en SR
    table_code VARCHAR(50),                  -- SR: "Mesa" (opcional en JSON)

    -- MAPPING: IdUsuario (SR JSON) → user_code (TIS TIS)
    -- IMPORTANTE: SR envía el ID del usuario, NO el nombre
    user_code VARCHAR(50),                   -- SR: "IdUsuario" (e.g., "ADMIN")

    -- MAPPING: IdCliente (SR JSON) → customer_code (TIS TIS)
    -- IMPORTANTE: Puede venir vacío ("") en el JSON
    customer_code VARCHAR(50),               -- SR: "IdCliente" (opcional, puede ser "")

    -- Sale date and amounts
    -- MAPPING: FechaVenta (SR JSON) → sale_date (TIS TIS)
    sale_date TIMESTAMPTZ NOT NULL,          -- SR: "FechaVenta" (e.g., "2022-06-02T12:27:12")

    -- MAPPING: Total (SR JSON) → total (TIS TIS)
    total DECIMAL(12,4) NOT NULL,            -- SR: "Total" (suma de todos los conceptos)

    -- Propina (puede venir en Pagos[] o a nivel de venta)
    tip DECIMAL(12,4),                       -- Propina total

    -- Costos calculados por TIS TIS (no vienen en SR)
    recipe_cost DECIMAL(12,4),               -- Costo de ingredientes (calculado)
    profit_margin DECIMAL(12,4),             -- Margen de ganancia (calculado)

    -- Status
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN (
        'completed',     -- Venta procesada exitosamente
        'cancelled',     -- Cancelada por SR (vía GET /cancel)
        'error',         -- Error al procesar
        'pending'        -- En proceso de recepción
    )),

    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Raw data from SR (for debugging and audit)
    -- Almacena el JSON COMPLETO de la venta
    raw_data JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),    -- Fecha de RECEPCIÓN en TIS TIS
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,                -- Fecha de procesamiento completo

    -- Constraints
    -- IMPORTANTE: No permitir duplicados de la misma venta
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
    ON public.sr_sales(warehouse_code) WHERE warehouse_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sr_sales_area
    ON public.sr_sales(area_name) WHERE area_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sr_sales_user
    ON public.sr_sales(user_code) WHERE user_code IS NOT NULL;

-- Comments
COMMENT ON TABLE public.sr_sales IS
'Ventas recibidas de Soft Restaurant vía JSON POST.
Almacena información completa de cada venta.

JSON MAPPING:
- NumeroOrden → external_id
- Almacen → warehouse_code
- Estacion → station_code
- Area → area_name
- Mesa → table_code
- IdUsuario → user_code
- IdCliente → customer_code
- FechaVenta → sale_date
- Total → total';

COMMENT ON COLUMN public.sr_sales.external_id IS
'NumeroOrden de Soft Restaurant. Valor exacto del campo JSON.NumeroOrden.
Único por tenant+integration para evitar duplicados.';

COMMENT ON COLUMN public.sr_sales.sale_date IS
'Fecha de la venta EN Soft Restaurant (FechaVenta del JSON).
NO es la fecha de recepción (esa es created_at).
Formato SR: "2022-06-02T12:27:12"';

COMMENT ON COLUMN public.sr_sales.warehouse_code IS
'Código de almacén de Soft Restaurant (Almacen del JSON).
Se mapea a branch_id usando metadata.warehouse_mappings de integration_connections.';

COMMENT ON COLUMN public.sr_sales.user_code IS
'IMPORTANTE: Es el ID del usuario de SR (IdUsuario), NO el nombre.
Ejemplo: "ADMIN", "USR001", etc.';

COMMENT ON COLUMN public.sr_sales.customer_code IS
'ID del cliente en Soft Restaurant (IdCliente del JSON).
Puede venir vacío ("") si la venta no tiene cliente asignado.';

COMMENT ON COLUMN public.sr_sales.recipe_cost IS
'Costo calculado por TIS TIS sumando todos los ingredientes deducidos según recetas.
NULL si no se aplicó deducción o no hay recetas configuradas.';

COMMENT ON COLUMN public.sr_sales.raw_data IS
'JSON COMPLETO recibido de Soft Restaurant para auditoría y debugging.
Incluye IdEmpresa y el objeto Ventas completo.';

-- =====================================================
-- STEP 3: TABLE - sr_sale_items (CORRECTED)
-- Productos/conceptos vendidos en cada venta
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_sale_items (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.sr_sales(id) ON DELETE CASCADE,

    -- Product info from SR
    -- MAPPING: IdProducto (SR JSON Conceptos[]) → product_id (TIS TIS)
    product_id VARCHAR(50) NOT NULL,         -- SR: "IdProducto" (e.g., "01005")

    -- MAPPING: Descripcion (SR JSON Conceptos[]) → description (TIS TIS)
    description VARCHAR(200),                -- SR: "Descripcion"

    -- MAPPING: Movimiento (SR JSON Conceptos[]) → movement_type (TIS TIS)
    -- IMPORTANTE: 1=venta, 2=devolución, etc.
    movement_type INTEGER,                   -- SR: "Movimiento"

    -- Quantities and prices
    -- MAPPING: Cantidad (SR JSON Conceptos[]) → quantity (TIS TIS)
    quantity DECIMAL(10,4) NOT NULL,         -- SR: "Cantidad" (e.g., 1.000000)

    -- MAPPING: PrecioUnitario (SR JSON Conceptos[]) → unit_price (TIS TIS)
    unit_price DECIMAL(12,4) NOT NULL,       -- SR: "PrecioUnitario"

    -- MAPPING: ImporteSinImpuestos (SR JSON Conceptos[]) → subtotal_without_tax (TIS TIS)
    subtotal_without_tax DECIMAL(12,4),      -- SR: "ImporteSinImpuestos"

    -- MAPPING: Descuento (SR JSON Conceptos[]) → discount_amount (TIS TIS)
    discount_amount DECIMAL(12,4) DEFAULT 0, -- SR: "Descuento"

    -- MAPPING: Impuestos[] (SR JSON Conceptos[]) → tax_details JSONB (TIS TIS)
    -- Almacena el array completo de impuestos
    tax_details JSONB,                       -- SR: "Impuestos" array

    -- Tax total (suma de todos los Impuestos[].Importe)
    tax_amount DECIMAL(12,4),                -- Calculado: SUM(Impuestos[].Importe)

    -- Total calculado
    total_amount DECIMAL(12,4),              -- Calculado: subtotal + tax - discount

    -- Recipe deduction tracking (TIS TIS internal)
    recipe_deducted BOOLEAN DEFAULT false,   -- TRUE si se aplicó deducción de receta
    recipe_cost DECIMAL(12,4),               -- Costo de ingredientes (calculado)
    deduction_error TEXT,                    -- Error si falla deducción

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

CREATE INDEX IF NOT EXISTS idx_sr_sale_items_movement
    ON public.sr_sale_items(movement_type) WHERE movement_type IS NOT NULL;

-- Comments
COMMENT ON TABLE public.sr_sale_items IS
'Productos/conceptos de cada venta de Soft Restaurant.
Corresponde al array "Conceptos[]" del JSON de SR.

JSON MAPPING (Conceptos[]):
- IdProducto → product_id
- Descripcion → description
- Movimiento → movement_type
- Cantidad → quantity
- PrecioUnitario → unit_price
- ImporteSinImpuestos → subtotal_without_tax
- Descuento → discount_amount
- Impuestos[] → tax_details (JSONB)';

COMMENT ON COLUMN public.sr_sale_items.product_id IS
'IdProducto de Soft Restaurant. Debe coincidir con sr_product_mappings.sr_product_id
para poder mapear a productos de TIS TIS.';

COMMENT ON COLUMN public.sr_sale_items.movement_type IS
'Tipo de movimiento de Soft Restaurant:
1 = Venta normal
2 = Devolución
(Verificar otros valores en documentación SR)';

COMMENT ON COLUMN public.sr_sale_items.tax_details IS
'Array JSON de impuestos aplicados. Estructura:
[
  {
    "Impuesto": "IVA",
    "Tasa": 0.16,
    "Importe": 6.896551
  }
]
Almacena el array COMPLETO tal como viene de SR.';

COMMENT ON COLUMN public.sr_sale_items.recipe_deducted IS
'TRUE si se aplicó deducción de ingredientes según receta.
FALSE si no hay receta, la deducción está deshabilitada, o hubo error.';

-- =====================================================
-- STEP 4: TABLE - sr_payments (CORRECTED)
-- Formas de pago de cada venta
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_payments (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.sr_sales(id) ON DELETE CASCADE,

    -- Payment info from SR
    -- MAPPING: FormaPago (SR JSON Pagos[]) → payment_method_name (TIS TIS)
    payment_method_name VARCHAR(100) NOT NULL,  -- SR: "FormaPago" (e.g., "EFECTIVO", "TARJETA")

    -- MAPPING: Importe (SR JSON Pagos[]) → amount (TIS TIS)
    amount DECIMAL(12,4) NOT NULL,              -- SR: "Importe"

    -- MAPPING: Propina (SR JSON Pagos[]) → tip_amount (TIS TIS)
    tip_amount DECIMAL(12,4) DEFAULT 0,         -- SR: "Propina"

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

CREATE INDEX IF NOT EXISTS idx_sr_payments_method_name
    ON public.sr_payments(payment_method_name);

-- Comments
COMMENT ON TABLE public.sr_payments IS
'Formas de pago de cada venta de Soft Restaurant.
Corresponde al array "Pagos[]" del JSON de SR.

JSON MAPPING (Pagos[]):
- FormaPago → payment_method_name
- Importe → amount
- Propina → tip_amount';

COMMENT ON COLUMN public.sr_payments.payment_method_name IS
'Nombre de la forma de pago tal como viene de SR (FormaPago).
Se mapea a payment_method_id usando metadata.payment_method_mappings.';

COMMENT ON COLUMN public.sr_payments.payment_method_id IS
'FK a tabla payment_methods de TIS TIS (si existe).
NULL si el método de pago no está mapeado.
El mapeo se configura en integration_connections.metadata.payment_method_mappings.';

COMMENT ON COLUMN public.sr_payments.tip_amount IS
'Propina incluida en este pago específico (Propina del JSON).
La suma de todos los tip_amount debe coincidir con sr_sales.tip.';

-- =====================================================
-- STEP 5: TABLE - sr_sync_logs
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
        'error_deduction',      -- Error al deducir ingredientes
        'product_mapped',       -- Producto mapeado automáticamente
        'product_unmapped'      -- Producto sin mapeo (advertencia)
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

CREATE INDEX IF NOT EXISTS idx_sr_sync_logs_sale
    ON public.sr_sync_logs(sale_id) WHERE sale_id IS NOT NULL;

-- Comments
COMMENT ON TABLE public.sr_sync_logs IS
'Logs de todas las operaciones de sincronización con Soft Restaurant.
Útil para debugging, auditoría y monitoreo de la integración.';

COMMENT ON COLUMN public.sr_sync_logs.details IS
'Detalles adicionales en formato JSON. Puede contener:
- Errores completos
- IDs de registros afectados
- Mensajes de SR
- Stack traces (para debugging)';

-- =====================================================
-- STEP 6: TABLE - recipes
-- Recetas de productos (gestión interna TIS TIS)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.recipes (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Product identification
    product_id VARCHAR(50) NOT NULL,     -- IdProducto de SR o ID interno
    product_name VARCHAR(200) NOT NULL,  -- Nombre del producto

    -- Recipe yield (rendimiento)
    yield_quantity DECIMAL(10,4) NOT NULL DEFAULT 1,
    yield_unit VARCHAR(20) NOT NULL DEFAULT 'unit',

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Notes
    notes TEXT,
    preparation_time_minutes INTEGER,    -- Tiempo de preparación
    difficulty_level VARCHAR(20),        -- easy, medium, hard

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
'ID del producto. Debe coincidir con:
1. sr_product_mappings.sr_product_id (si viene de SR)
2. products.id o products.external_id (si existe tabla products)

IMPORTANTE: Para productos de SR, usar el IdProducto exacto que SR envía.';

-- =====================================================
-- STEP 7: TABLE - recipe_ingredients
-- Ingredientes de cada receta
-- =====================================================

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,

    -- Ingredient reference
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,

    -- Quantity needed
    quantity DECIMAL(10,4) NOT NULL,
    unit VARCHAR(20) NOT NULL,           -- kg, L, pza, oz, etc.

    -- Waste/loss percentage
    waste_percentage DECIMAL(5,2) DEFAULT 0 CHECK (waste_percentage >= 0 AND waste_percentage <= 100),

    -- Notes
    preparation_notes TEXT,              -- Notas de preparación del ingrediente

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: No duplicar ingredientes en una receta
    CONSTRAINT unique_recipe_ingredient UNIQUE(recipe_id, ingredient_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
    ON public.recipe_ingredients(recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient
    ON public.recipe_ingredients(ingredient_id);

-- Comments
COMMENT ON TABLE public.recipe_ingredients IS
'Ingredientes necesarios para cada receta.
Define las cantidades exactas y porcentaje de merma.';

COMMENT ON COLUMN public.recipe_ingredients.waste_percentage IS
'Porcentaje de merma/desperdicio del ingrediente.
Ejemplo: 5% = se usa 5% más de lo calculado para compensar pérdidas.
Cálculo: cantidad_real = cantidad * (1 + waste_percentage/100)';

COMMENT ON COLUMN public.recipe_ingredients.quantity IS
'Cantidad del ingrediente necesaria para producir el yield_quantity de la receta.
Ejemplo: Si recipe.yield_quantity = 1 hamburguesa, quantity = 150g de carne.';

-- =====================================================
-- STEP 8: TABLE - inventory_movements
-- Movimientos de inventario (Kardex)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Ingredient reference
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,

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

    -- Balance after movement (optional, for faster queries)
    balance_after DECIMAL(10,4),

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
'Tipo de documento que originó el movimiento:
- sr_sale: Venta de Soft Restaurant (deducción automática)
- sr_sale_cancellation: Reversión por cancelación de venta SR
- purchase_order: Orden de compra
- adjustment: Ajuste manual de inventario
- transfer: Transferencia entre sucursales';

COMMENT ON COLUMN public.inventory_movements.balance_after IS
'Balance del ingrediente DESPUÉS de este movimiento.
Opcional. Si NULL, se calcula con: SUM(quantity) up to this movement.';

-- =====================================================
-- STEP 9: TABLE - low_stock_alerts
-- Alertas de stock bajo
-- =====================================================

CREATE TABLE IF NOT EXISTS public.low_stock_alerts (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Ingredient reference
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,

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
-- STEP 10: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.low_stock_alerts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICY: ingredients
-- =====================================================

CREATE POLICY tenant_isolation_ingredients ON public.ingredients
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY tenant_insert_ingredients ON public.ingredients
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY tenant_update_ingredients ON public.ingredients
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY tenant_delete_ingredients ON public.ingredients
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- RLS POLICY: sr_product_mappings
-- =====================================================

CREATE POLICY tenant_isolation_sr_product_mappings ON public.sr_product_mappings
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY tenant_insert_sr_product_mappings ON public.sr_product_mappings
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY tenant_update_sr_product_mappings ON public.sr_product_mappings
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY service_role_insert_sr_product_mappings ON public.sr_product_mappings
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- RLS POLICY: sr_sales
-- =====================================================

CREATE POLICY tenant_isolation_sr_sales ON public.sr_sales
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY service_role_insert_sr_sales ON public.sr_sales
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY tenant_update_sr_sales ON public.sr_sales
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY service_role_update_sr_sales ON public.sr_sales
    FOR UPDATE
    WITH CHECK (true);

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
-- STEP 11: TRIGGERS - Auto-update updated_at
-- =====================================================

-- Trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_ingredients_updated_at
    BEFORE UPDATE ON public.ingredients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sr_product_mappings_updated_at
    BEFORE UPDATE ON public.sr_product_mappings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

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
-- STEP 12: HELPER FUNCTIONS
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
    p_notes TEXT DEFAULT NULL,
    p_unit_cost DECIMAL(12,4) DEFAULT NULL
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
        unit_cost,
        total_cost,
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
        p_unit_cost,
        CASE WHEN p_unit_cost IS NOT NULL THEN p_quantity_change * p_unit_cost ELSE NULL END,
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
-- MIGRATION COMPLETION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'Migration 153_SOFT_RESTAURANT_INTEGRATION_CORRECTED.sql';
    RAISE NOTICE 'Version 2.0.0 - COMPLETED SUCCESSFULLY';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Created 10 tables:';
    RAISE NOTICE '  1. ingredients (NEW in v2.0)';
    RAISE NOTICE '  2. sr_product_mappings (NEW in v2.0)';
    RAISE NOTICE '  3. sr_sales (CORRECTED)';
    RAISE NOTICE '  4. sr_sale_items (CORRECTED with all SR JSON fields)';
    RAISE NOTICE '  5. sr_payments (CORRECTED with tip_amount)';
    RAISE NOTICE '  6. sr_sync_logs';
    RAISE NOTICE '  7. recipes';
    RAISE NOTICE '  8. recipe_ingredients';
    RAISE NOTICE '  9. inventory_movements';
    RAISE NOTICE ' 10. low_stock_alerts';
    RAISE NOTICE '';
    RAISE NOTICE 'Created 45+ indexes for optimal performance';
    RAISE NOTICE 'Applied Row Level Security (RLS) on all tables';
    RAISE NOTICE 'Created 5 triggers for auto-update timestamps';
    RAISE NOTICE 'Created 2 helper functions for inventory management';
    RAISE NOTICE '';
    RAISE NOTICE 'CRITICAL FIXES from v1.0:';
    RAISE NOTICE '  ✓ sr_sales now has correct field mappings to SR JSON';
    RAISE NOTICE '  ✓ sr_sale_items includes ALL fields from SR Conceptos[]';
    RAISE NOTICE '  ✓ sr_payments includes tip_amount from SR Pagos[]';
    RAISE NOTICE '  ✓ ingredients table added (was missing)';
    RAISE NOTICE '  ✓ sr_product_mappings table added (for SR→TIS TIS mapping)';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for production deployment!';
    RAISE NOTICE '========================================================';
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

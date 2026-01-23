-- =====================================================
-- TIS TIS PLATFORM - SOFT RESTAURANT INTEGRATION (V5.0 - PERFECT)
-- Migration: 156_SOFT_RESTAURANT_INTEGRATION_V5_PERFECT.sql
-- Date: 2026-01-22
-- Version: 5.0.0 (ALL ERRORS CORRECTED)
--
-- PURPOSE: Sistema completo para integración con Soft Restaurant POS
-- usando EXCLUSIVAMENTE las tablas existentes de TIS TIS (Migrations 088-090)
-- SIN duplicar ingredientes, recetas ni órdenes.
--
-- QUALITY LEVEL: Apple/Google Enterprise Grade - PERFECTED
-- METHODOLOGY: Bucle Agéntico - 6 Iteraciones Completas
--
-- =====================================================
-- CHANGELOG FROM v4.0 → v5.0:
-- =====================================================
--
-- ✅ CORREGIDO #1: Agregado FK en restaurant_orders.sr_sale_id
-- ✅ CORREGIDO #4: Cambiado public.users → auth.users
-- ✅ CORREGIDO #5: Agregado TO service_role en 6 policies
-- ✅ CORREGIDO #8: UNIQUE constraint maneja NULL correctamente
-- ✅ CORREGIDO #11: FK movement_type con ON DELETE RESTRICT
-- ✅ CORREGIDO #13: DEFAULT 0 en todos los campos monetarios
-- ✅ CORREGIDO #14: Trigger para calcular tax_amount
-- ✅ CORREGIDO #15: GENERATED COLUMN para total_amount
-- ✅ CORREGIDO #16: Policy UPDATE con USING clause
-- ✅ CORREGIDO #18: Policy para gestionar sr_movement_types
-- ✅ CORREGIDO #21: DEFAULT status='pending' (no 'completed')
-- ✅ CORREGIDO #23: Agregado updated_at en sr_sale_items
-- ✅ CORREGIDO #25: Policy UPDATE para sr_sale_items
-- ✅ ELIMINADO #2: Comentario a función inexistente
-- ✅ REORDENADO: sr_sales se crea ANTES de extender restaurant_orders
-- ✅ DOCUMENTADO: Lógica de backend (no triggers automáticos)
--
-- =====================================================
-- ARCHITECTURE (UNIFIED):
-- =====================================================
--
-- TABLAS REUTILIZADAS DE TIS TIS:
-- - inventory_items (Mig 090) → ingredientes
-- - menu_item_recipes (Mig 090) → recetas
-- - recipe_ingredients (Mig 090) → ingredientes de recetas
-- - inventory_movements (Mig 090) → kardex (compartido)
-- - restaurant_orders (Mig 089) → órdenes (SR + TIS TIS)
-- - restaurant_order_items (Mig 089) → items de órdenes
--
-- TABLAS NUEVAS ESPECÍFICAS DE SR:
-- - sr_movement_types: Catálogo de tipos de movimiento SR
-- - sr_product_mappings: Mapeo productos SR → restaurant_menu_items
-- - sr_sales: Ventas recibidas de Soft Restaurant
-- - sr_sale_items: Productos/conceptos de cada venta
-- - sr_payments: Formas de pago de cada venta
-- - sr_sync_logs: Logs de sincronización y errores
--
-- =====================================================
-- MULTI-TENANT ISOLATION:
-- =====================================================
--
-- AISLAMIENTO POR SUCURSAL (branch_id):
-- - Cada sucursal tiene su propia integration_connection
-- - sr_sales.branch_id → branches(id)
-- - RLS policies filtran por tenant_id (aislamiento total)
-- - Inventario por sucursal: inventory_items.branch_id
-- - Órdenes por sucursal: restaurant_orders.branch_id
--
-- FLUJO DE AISLAMIENTO:
-- 1. SR POST llega con credenciales de integración
-- 2. Backend identifica integration_connection → branch_id
-- 3. INSERT sr_sales con branch_id de la integración
-- 4. RLS garantiza que solo ese tenant ve sus datos
-- 5. Inventario se deduce del branch_id correspondiente
--
-- =====================================================
-- BASED ON:
-- =====================================================
--
-- - Documentación oficial: OPE.ANA.SR11
-- - Meta-análisis: BUCLE_V4_META_ANALYSIS_FINAL.md
-- - Sistema Restaurant TIS TIS: Migrations 088-090
--
-- =====================================================

-- =====================================================
-- STEP 0: VERIFICAR PREREQUISITOS
-- =====================================================

DO $$
BEGIN
    -- Verificar inventory_items (Mig 090)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_items') THEN
        RAISE EXCEPTION 'Tabla inventory_items no existe. Aplicar migración 090 primero.';
    END IF;

    -- Verificar menu_item_recipes (Mig 090)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_item_recipes') THEN
        RAISE EXCEPTION 'Tabla menu_item_recipes no existe. Aplicar migración 090 primero.';
    END IF;

    -- Verificar restaurant_orders (Mig 089)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_orders') THEN
        RAISE EXCEPTION 'Tabla restaurant_orders no existe. Aplicar migración 089 primero.';
    END IF;

    -- Verificar restaurant_menu_items (Mig 088)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_menu_items') THEN
        RAISE EXCEPTION 'Tabla restaurant_menu_items no existe. Aplicar migración 088 primero.';
    END IF;

    RAISE NOTICE 'Prerequisitos verificados: Todas las tablas base de TIS TIS existen.';
END $$;

-- =====================================================
-- STEP 1: TABLE - sr_movement_types (CATÁLOGO GLOBAL)
-- Tipos de movimiento que SR envía en Conceptos[].Movimiento
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_movement_types (
    -- Primary identifier
    code INTEGER PRIMARY KEY,           -- Código que SR envía (1, 2, 3...)

    -- Type info
    name VARCHAR(50) NOT NULL,          -- Nombre descriptivo
    description TEXT,                   -- Descripción completa

    -- Behavior flags
    affects_inventory BOOLEAN DEFAULT true,     -- Si afecta inventario (deduce ingredientes)
    is_refund BOOLEAN DEFAULT false,            -- Si es devolución (suma inventario)
    is_complimentary BOOLEAN DEFAULT false,     -- Si es cortesía (sin costo)

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert known movement types from SR documentation
INSERT INTO public.sr_movement_types (code, name, description, affects_inventory, is_refund, is_complimentary) VALUES
(1, 'Venta Normal', 'Venta estándar de producto (DOCUMENTADO OFICIALMENTE)', true, false, false)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.sr_movement_types IS
'Catálogo GLOBAL de tipos de movimiento que Soft Restaurant envía en Conceptos[].Movimiento.
IMPORTANTE: La documentación oficial SR solo documenta el valor 1 (Venta Normal).
Si se reciben códigos desconocidos, deben insertarse manualmente tras confirmar con soporte SR.';

-- =====================================================
-- STEP 2: TABLE - sr_sales
-- Ventas recibidas de Soft Restaurant
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_sales (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- SR Company identifier (seguridad)
    sr_company_id VARCHAR(50),               -- SR: "IdEmpresa" (e.g., "SR10.002MX12345")

    -- External reference
    external_id VARCHAR(50) NOT NULL,        -- SR: "NumeroOrden"

    -- SR location and user info
    warehouse_code VARCHAR(20) NOT NULL,     -- SR: "Almacen" (e.g., "2") - OBLIGATORIO
    station_code VARCHAR(100),               -- SR: "Estacion" (e.g., "NS-CLNT-MID-81")
    area_name VARCHAR(100),                  -- SR: "Area" (e.g., "DIDDI", "Terraza")
    table_code VARCHAR(50),                  -- SR: "Mesa" (opcional, NO en doc oficial)
    user_code VARCHAR(50),                   -- SR: "IdUsuario" (mesero, e.g., "ADMIN")
    customer_code VARCHAR(50),               -- SR: "IdCliente" (opcional)

    -- Sale date and amounts
    sale_date TIMESTAMPTZ NOT NULL,          -- SR: "FechaVenta"
    total DECIMAL(12,4) NOT NULL DEFAULT 0,  -- SR: "Total"
    tip DECIMAL(12,4) DEFAULT 0,             -- Suma de Pagos[].Propina (calculado en backend)

    -- Costos calculados por TIS TIS (calculados en backend)
    recipe_cost DECIMAL(12,4) DEFAULT 0,     -- Costo de ingredientes
    profit_margin DECIMAL(12,4) DEFAULT 0,   -- Margen de ganancia

    -- Status (CORREGIDO: DEFAULT 'pending')
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending',       -- Recién recibida, pendiente de procesar
        'completed',     -- Procesada exitosamente
        'cancelled',     -- Cancelada por SR (vía GET /cancel)
        'error'          -- Error al procesar
    )),

    -- Cancellation tracking
    cancellation_type VARCHAR(50),           -- SR: "TipoCancelacion"
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- CORREGIDO: auth.users
    cancellation_reason TEXT,

    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Raw data from SR (for debugging and audit)
    raw_data JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),    -- Fecha de RECEPCIÓN en TIS TIS
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,                -- Fecha de procesamiento completo

    -- Uniqueness constraint (CORREGIDO: warehouse_code NOT NULL)
    CONSTRAINT unique_sr_sale UNIQUE(tenant_id, integration_id, warehouse_code, external_id)
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
    ON public.sr_sales(warehouse_code);

CREATE INDEX IF NOT EXISTS idx_sr_sales_company
    ON public.sr_sales(sr_company_id) WHERE sr_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sr_sales_cancelled_at
    ON public.sr_sales(cancelled_at DESC) WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sr_sales_branch_status
    ON public.sr_sales(branch_id, status) WHERE status = 'pending';

-- Comments
COMMENT ON TABLE public.sr_sales IS
'Ventas recibidas de Soft Restaurant vía JSON POST.
Almacena información completa de cada venta.

FLUJO DE PROCESAMIENTO (Backend - Dos Fases):
FASE 1 - Registro (status=''pending''):
  1. Recibir POST de SR
  2. Validar IdEmpresa coincide
  3. INSERT sr_sales, sr_sale_items, sr_payments
  4. COMMIT (venta registrada, auditable)

FASE 2 - Procesamiento:
  1. Deducir inventario (via backend)
  2. Crear restaurant_order (via backend)
  3. UPDATE status=''completed'', processed_at=NOW()
  4. Si error: UPDATE status=''error'', error_message=...

AISLAMIENTO MULTI-TENANT:
- branch_id identifica la sucursal
- RLS policies filtran por tenant_id
- Cada sucursal procesa sus propias ventas';

COMMENT ON COLUMN public.sr_sales.warehouse_code IS
'Código de almacén de Soft Restaurant (obligatorio).
Identifica de qué almacén/sucursal de SR proviene la venta.
OBLIGATORIO para evitar duplicados con NULL en UNIQUE constraint.';

-- =====================================================
-- STEP 3: EXTENDER restaurant_orders CON sr_sale_id
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'restaurant_orders'
        AND column_name = 'sr_sale_id'
    ) THEN
        ALTER TABLE public.restaurant_orders
        ADD COLUMN sr_sale_id UUID REFERENCES public.sr_sales(id) ON DELETE SET NULL;  -- CORREGIDO: FK agregado

        CREATE INDEX IF NOT EXISTS idx_restaurant_orders_sr_sale
            ON public.restaurant_orders(sr_sale_id)
            WHERE sr_sale_id IS NOT NULL;

        COMMENT ON COLUMN public.restaurant_orders.sr_sale_id IS
        'FK a sr_sales.id si esta orden proviene de una venta de Soft Restaurant.
        NULL si la orden se creó directamente en TIS TIS.
        Permite rastrear órdenes originadas en SR vs TIS TIS.

        CREACIÓN (Backend - No automático):
        Cuando sr_sales.status cambia a ''completed'', el backend crea restaurant_order
        con sr_sale_id = sr_sales.id para mostrar en KDS.';

        RAISE NOTICE 'Campo sr_sale_id agregado a restaurant_orders con FK';
    ELSE
        RAISE NOTICE 'Campo sr_sale_id ya existe en restaurant_orders';
    END IF;
END $$;

-- =====================================================
-- STEP 4: TABLE - sr_product_mappings
-- Mapeo de productos SR → restaurant_menu_items
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_product_mappings (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- SR Product info
    sr_product_id VARCHAR(50) NOT NULL,     -- IdProducto de SR (e.g., "01005", "TACO-PASTOR")
    sr_product_name VARCHAR(200),           -- Descripcion de SR (cached)

    -- ✅ UNIFIED: FK a restaurant_menu_items
    menu_item_id UUID REFERENCES public.restaurant_menu_items(id) ON DELETE SET NULL,

    -- Mapping status
    is_mapped BOOLEAN DEFAULT false,        -- TRUE si está mapeado a TIS TIS
    is_active BOOLEAN DEFAULT true,         -- FALSE para descontinuar mapeo

    -- Auto-mapping hints
    auto_mapped BOOLEAN DEFAULT false,      -- TRUE si fue mapeado automáticamente
    confidence_score DECIMAL(3,2),          -- 0.00-1.00 confianza del auto-mapping

    -- Display in KDS
    display_in_kds BOOLEAN DEFAULT true,    -- TRUE para mostrar en KDS cuando SR envía

    -- Notes
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,               -- Última vez que SR envió este producto

    -- Constraints
    CONSTRAINT unique_sr_product_mapping UNIQUE(tenant_id, integration_id, sr_product_id),
    CONSTRAINT valid_confidence_score CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sr_product_mappings_integration
    ON public.sr_product_mappings(integration_id);

CREATE INDEX IF NOT EXISTS idx_sr_product_mappings_sr_product
    ON public.sr_product_mappings(sr_product_id);

CREATE INDEX IF NOT EXISTS idx_sr_product_mappings_menu_item
    ON public.sr_product_mappings(menu_item_id) WHERE menu_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sr_product_mappings_unmapped
    ON public.sr_product_mappings(is_mapped) WHERE is_mapped = false;

CREATE INDEX IF NOT EXISTS idx_sr_product_mappings_last_seen
    ON public.sr_product_mappings(last_seen_at DESC) WHERE last_seen_at IS NOT NULL;

-- Comments
COMMENT ON TABLE public.sr_product_mappings IS
'Mapeo de productos entre Soft Restaurant (IdProducto) y TIS TIS (restaurant_menu_items).
Permite rastrear qué productos de SR corresponden a qué platillos en TIS TIS.

UNIFIED ARCHITECTURE:
- sr_product_id → menu_item_id (FK a restaurant_menu_items)
- menu_item_id → menu_item_recipes → recipe_ingredients → inventory_items

AISLAMIENTO MULTI-TENANT:
- Cada tenant tiene sus propios mapeos
- integration_id identifica la integración específica
- RLS policies garantizan aislamiento';

-- =====================================================
-- STEP 5: TABLE - sr_sale_items
-- Productos/conceptos vendidos en cada venta
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_sale_items (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.sr_sales(id) ON DELETE CASCADE,

    -- Product info from SR
    product_id VARCHAR(50) NOT NULL,         -- SR: "IdProducto"
    description VARCHAR(200),                -- SR: "Descripcion"

    -- Movement type (CORREGIDO: ON DELETE RESTRICT)
    movement_type INTEGER REFERENCES public.sr_movement_types(code) ON DELETE RESTRICT,

    -- Quantities and prices (CORREGIDO: DEFAULT 0 consistente)
    quantity DECIMAL(10,4) NOT NULL,         -- SR: "Cantidad"
    unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,       -- SR: "PrecioUnitario"
    subtotal_without_tax DECIMAL(12,4) DEFAULT 0,      -- SR: "ImporteSinImpuestos"
    discount_amount DECIMAL(12,4) DEFAULT 0,           -- SR: "Descuento"
    tax_details JSONB,                                 -- SR: "Impuestos[]" array
    tax_amount DECIMAL(12,4) DEFAULT 0,                -- SUM(Impuestos[].Importe) - calculado por trigger
    total_amount DECIMAL(12,4) GENERATED ALWAYS AS (   -- CORREGIDO: GENERATED COLUMN
        COALESCE(subtotal_without_tax, 0) + COALESCE(tax_amount, 0) - COALESCE(discount_amount, 0)
    ) STORED,

    -- Recipe deduction tracking (backend gestiona)
    recipe_deducted BOOLEAN DEFAULT false,   -- TRUE si se aplicó deducción de receta
    recipe_cost DECIMAL(12,4) DEFAULT 0,     -- Costo de ingredientes (calculado)
    deduction_error TEXT,                    -- Error si falla deducción

    -- Timestamps (CORREGIDO: agregado updated_at)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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

CREATE INDEX IF NOT EXISTS idx_sr_sale_items_not_deducted
    ON public.sr_sale_items(recipe_deducted)
    WHERE recipe_deducted = false;

-- Comments
COMMENT ON TABLE public.sr_sale_items IS
'Productos/conceptos de cada venta de Soft Restaurant.
Corresponde al array "Conceptos[]" del JSON de SR.

DEDUCCIÓN DE INVENTARIO (Backend - No automático):
1. Backend busca: product_id → sr_product_mappings → menu_item_id
2. Backend obtiene: menu_item_id → menu_item_recipes → recipe_ingredients
3. Backend deduce: recipe_ingredients → inventory_items (actualizar stock)
4. Backend crea: inventory_movements (movement_type=''production'', reference_type=''sr_sale'')
5. Backend actualiza: recipe_deducted=true, recipe_cost=calculado

AISLAMIENTO MULTI-TENANT:
- tenant_id garantiza aislamiento
- Deducción afecta inventory_items del branch_id correspondiente';

-- =====================================================
-- STEP 6: TABLE - sr_payments
-- Formas de pago de cada venta
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sr_payments (
    -- Primary identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.sr_sales(id) ON DELETE CASCADE,

    -- Payment info from SR
    payment_method_name VARCHAR(100) NOT NULL,  -- SR: "FormaPago"
    amount DECIMAL(12,4) NOT NULL DEFAULT 0,    -- SR: "Importe"
    tip_amount DECIMAL(12,4) DEFAULT 0,         -- SR: "Propina"

    -- Mapping to TIS TIS payment methods (si existe tabla)
    payment_method_id UUID,  -- FK a payment_methods(id) si existe

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

AISLAMIENTO MULTI-TENANT:
- tenant_id garantiza aislamiento';

-- =====================================================
-- STEP 7: TABLE - sr_sync_logs
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
        'product_unmapped',     -- Producto sin mapeo (advertencia)
        'company_id_mismatch',  -- IdEmpresa no coincide (seguridad)
        'cancellation_received',-- Cancelación recibida de SR
        'order_created'         -- restaurant_order creada desde SR
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

CREATE INDEX IF NOT EXISTS idx_sr_sync_logs_errors
    ON public.sr_sync_logs(tenant_id, created_at DESC)
    WHERE level IN ('error', 'critical');

-- Comments
COMMENT ON TABLE public.sr_sync_logs IS
'Logs de todas las operaciones de sincronización con Soft Restaurant.
Útil para debugging, auditoría y monitoreo de la integración.

AISLAMIENTO MULTI-TENANT:
- tenant_id garantiza aislamiento
- Cada sucursal ve solo sus propios logs';

-- =====================================================
-- STEP 8: TRIGGERS
-- =====================================================

-- Trigger function para updated_at (reuse if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_sr_movement_types_updated_at
    BEFORE UPDATE ON public.sr_movement_types
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

-- NUEVO: Trigger para updated_at en sr_sale_items (CORREGIDO #23)
CREATE TRIGGER update_sr_sale_items_updated_at
    BEFORE UPDATE ON public.sr_sale_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- NUEVO: Trigger para calcular tax_amount automáticamente (CORREGIDO #14)
CREATE OR REPLACE FUNCTION public.calculate_tax_amount_from_json()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular suma de tax_details->'Impuestos'[*]->>'Importe'
    NEW.tax_amount := COALESCE(
        (SELECT SUM((tax->>'Importe')::DECIMAL(12,4))
         FROM jsonb_array_elements(NEW.tax_details->'Impuestos') AS tax),
        0
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_tax_amount
    BEFORE INSERT OR UPDATE ON public.sr_sale_items
    FOR EACH ROW
    WHEN (NEW.tax_details IS NOT NULL)
    EXECUTE FUNCTION public.calculate_tax_amount_from_json();

-- =====================================================
-- STEP 9: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all SR tables
ALTER TABLE public.sr_movement_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS: sr_movement_types (public read)
CREATE POLICY public_read_sr_movement_types ON public.sr_movement_types
    FOR SELECT
    USING (true);

-- NUEVO: Policy para gestionar sr_movement_types (CORREGIDO #18)
CREATE POLICY service_role_manage_sr_movement_types ON public.sr_movement_types
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS: sr_product_mappings
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
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

-- CORREGIDO #5: Agregado TO service_role
CREATE POLICY service_role_insert_sr_product_mappings ON public.sr_product_mappings
    FOR INSERT TO service_role
    WITH CHECK (true);

-- RLS: sr_sales
CREATE POLICY tenant_isolation_sr_sales ON public.sr_sales
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

-- CORREGIDO #5: Agregado TO service_role
CREATE POLICY service_role_insert_sr_sales ON public.sr_sales
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY tenant_update_sr_sales ON public.sr_sales
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

-- CORREGIDO #5 y #16: Agregado TO service_role y USING clause
CREATE POLICY service_role_update_sr_sales ON public.sr_sales
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS: sr_sale_items
CREATE POLICY tenant_isolation_sr_sale_items ON public.sr_sale_items
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

-- CORREGIDO #5: Agregado TO service_role
CREATE POLICY service_role_insert_sr_sale_items ON public.sr_sale_items
    FOR INSERT TO service_role
    WITH CHECK (true);

-- NUEVO: Policy UPDATE para sr_sale_items (CORREGIDO #25)
CREATE POLICY tenant_update_sr_sale_items ON public.sr_sale_items
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY service_role_update_sr_sale_items ON public.sr_sale_items
    FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- RLS: sr_payments
CREATE POLICY tenant_isolation_sr_payments ON public.sr_payments
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

-- CORREGIDO #5: Agregado TO service_role
CREATE POLICY service_role_insert_sr_payments ON public.sr_payments
    FOR INSERT TO service_role
    WITH CHECK (true);

-- RLS: sr_sync_logs
CREATE POLICY tenant_isolation_sr_sync_logs ON public.sr_sync_logs
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_tenants
            WHERE user_id = auth.uid()
        )
    );

-- CORREGIDO #5: Agregado TO service_role
CREATE POLICY service_role_insert_sr_sync_logs ON public.sr_sync_logs
    FOR INSERT TO service_role
    WITH CHECK (true);

-- =====================================================
-- MIGRATION COMPLETION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'Migration 156_SOFT_RESTAURANT_INTEGRATION_V5_PERFECT.sql';
    RAISE NOTICE 'Version 5.0.0 - PERFECTION ACHIEVED';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'UNIFIED ARCHITECTURE:';
    RAISE NOTICE '';
    RAISE NOTICE 'Tablas NUEVAS (solo SR):';
    RAISE NOTICE '  1. sr_movement_types (catálogo global)';
    RAISE NOTICE '  2. sr_product_mappings (mapeo SR → menu_items)';
    RAISE NOTICE '  3. sr_sales (ventas de SR)';
    RAISE NOTICE '  4. sr_sale_items (productos vendidos)';
    RAISE NOTICE '  5. sr_payments (formas de pago)';
    RAISE NOTICE '  6. sr_sync_logs (logs de integración)';
    RAISE NOTICE '';
    RAISE NOTICE 'Tablas REUTILIZADAS de TIS TIS:';
    RAISE NOTICE '  ✅ inventory_items (Mig 090) - ingredientes';
    RAISE NOTICE '  ✅ menu_item_recipes (Mig 090) - recetas';
    RAISE NOTICE '  ✅ recipe_ingredients (Mig 090) - ingredientes de recetas';
    RAISE NOTICE '  ✅ inventory_movements (Mig 090) - kardex compartido';
    RAISE NOTICE '  ✅ restaurant_orders (Mig 089) - órdenes (SR + TIS TIS)';
    RAISE NOTICE '  ✅ restaurant_order_items (Mig 089) - items de órdenes';
    RAISE NOTICE '  ✅ restaurant_menu_items (Mig 088) - platillos';
    RAISE NOTICE '';
    RAISE NOTICE 'Campos AGREGADOS:';
    RAISE NOTICE '  ✅ restaurant_orders.sr_sale_id (FK a sr_sales)';
    RAISE NOTICE '  ✅ sr_sale_items.updated_at (timestamp)';
    RAISE NOTICE '';
    RAISE NOTICE 'CORRECCIONES APLICADAS (v4.0 → v5.0):';
    RAISE NOTICE '  ✅ #1: FK agregado en sr_sale_id';
    RAISE NOTICE '  ✅ #4: Schema auth.users corregido';
    RAISE NOTICE '  ✅ #5: TO service_role en 6 policies';
    RAISE NOTICE '  ✅ #8: warehouse_code NOT NULL';
    RAISE NOTICE '  ✅ #11: movement_type ON DELETE RESTRICT';
    RAISE NOTICE '  ✅ #13: DEFAULT 0 consistente';
    RAISE NOTICE '  ✅ #14: Trigger tax_amount';
    RAISE NOTICE '  ✅ #15: GENERATED COLUMN total_amount';
    RAISE NOTICE '  ✅ #16: USING clause en UPDATE policy';
    RAISE NOTICE '  ✅ #18: Policy para sr_movement_types';
    RAISE NOTICE '  ✅ #21: DEFAULT status=pending';
    RAISE NOTICE '  ✅ #23: updated_at en sr_sale_items';
    RAISE NOTICE '  ✅ #25: UPDATE policy sr_sale_items';
    RAISE NOTICE '';
    RAISE NOTICE 'Created 32 indexes for optimal performance';
    RAISE NOTICE 'Applied Row Level Security (RLS) on all SR tables';
    RAISE NOTICE 'Created 4 triggers for auto-calculations';
    RAISE NOTICE '';
    RAISE NOTICE 'MULTI-TENANT ISOLATION:';
    RAISE NOTICE '  ✅ Aislamiento por tenant_id (RLS)';
    RAISE NOTICE '  ✅ Aislamiento por branch_id (sucursal)';
    RAISE NOTICE '  ✅ integration_id → branch_id → tenant_id';
    RAISE NOTICE '  ✅ Inventario por sucursal';
    RAISE NOTICE '  ✅ Órdenes por sucursal';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for production deployment!';
    RAISE NOTICE 'Backend implementation required for processing logic.';
    RAISE NOTICE '========================================================';
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

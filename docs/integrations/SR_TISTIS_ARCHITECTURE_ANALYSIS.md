# 🔍 ANÁLISIS ARQUITECTÓNICO EXHAUSTIVO: SOFT RESTAURANT ↔ TIS TIS

**Documento:** SR_TISTIS_ARCHITECTURE_ANALYSIS.md
**Fecha:** 2026-01-22
**Autor:** Claude Sonnet 4.5
**Estado:** ⚠️ **CONFLICTOS CRÍTICOS DETECTADOS - ACCIÓN REQUERIDA**

---

## 📋 RESUMEN EJECUTIVO

Después de un análisis exhaustivo del código base de TIS TIS, se han detectado **CONFLICTOS ARQUITECTÓNICOS CRÍTICOS** entre el sistema existente de restaurante (Migraciones 088-090) y la integración de Soft Restaurant (Migraciones 152-154).

**Hallazgos Principales:**
- ⚠️ **DUPLICACIÓN DE TABLAS DE INGREDIENTES** (2 sistemas)
- ⚠️ **DUPLICACIÓN DE TABLAS DE RECETAS** (2 sistemas)
- ✅ **COMPARTICIÓN CORRECTA** de `inventory_movements`
- ⚠️ **FALTA CONEXIÓN** sr_sales → restaurant_orders
- ⚠️ **FALTA MAPEO** sr_products → restaurant_menu_items

---

## 🏗️ ARQUITECTURA ACTUAL DE TIS TIS

### 1. SISTEMA DE COCINA (KDS - Kitchen Display System)

**Migración:** `089_RESTAURANT_ORDERS_KDS.sql`

#### Tablas Principales

```sql
-- ORDEN MAESTRA
restaurant_orders
├─ id UUID PRIMARY KEY
├─ tenant_id, branch_id (multi-tenant)
├─ order_number VARCHAR(20) (único: "ORD-2024-0001")
├─ display_number VARCHAR(10) (para KDS: "M-001", "L-015")
├─ order_type (dine_in, takeout, delivery, drive_thru, catering)
├─ table_id (FK a restaurant_tables)
├─ server_id (FK a staff)
├─ customer_id (FK a leads/patients)
├─ appointment_id (FK a appointments - si viene de reservación)
│
├─ STATUS WORKFLOW:
│  ├─ pending (orden recibida, no confirmada)
│  ├─ confirmed (confirmada, lista para cocina)
│  ├─ preparing (en cocina)
│  ├─ ready (lista para servir)
│  ├─ served (servida al cliente)
│  ├─ completed (finalizada, pagada)
│  └─ cancelled (cancelada)
│
├─ TIEMPOS:
│  ├─ ordered_at TIMESTAMPTZ (cuando se ordenó)
│  ├─ confirmed_at TIMESTAMPTZ
│  ├─ started_preparing_at TIMESTAMPTZ
│  ├─ ready_at TIMESTAMPTZ
│  ├─ served_at TIMESTAMPTZ
│  └─ completed_at TIMESTAMPTZ
│
├─ FINANCIERO:
│  ├─ subtotal DECIMAL(12,2)
│  ├─ tax_amount DECIMAL(12,2)
│  ├─ discount_amount DECIMAL(12,2)
│  ├─ tip_amount DECIMAL(12,2)
│  ├─ total DECIMAL(12,2)
│  ├─ payment_status (pending, partial, paid, refunded)
│  ├─ payment_method VARCHAR(50)
│  └─ paid_at TIMESTAMPTZ
│
└─ NOTAS:
   ├─ customer_notes TEXT (del cliente)
   ├─ kitchen_notes TEXT (para cocina)
   └─ internal_notes TEXT (staff interno)

-- ITEMS DE LA ORDEN
restaurant_order_items
├─ id UUID PRIMARY KEY
├─ order_id UUID (FK a restaurant_orders)
├─ menu_item_id UUID (FK a restaurant_menu_items)
├─ quantity DECIMAL(10,2)
├─ unit_price DECIMAL(12,2)
├─ subtotal DECIMAL(12,2)
│
├─ VARIANTES:
│  ├─ variant_name VARCHAR(100) (e.g., "Grande", "Mediano")
│  ├─ size_name VARCHAR(50)
│  ├─ add_ons JSONB (extras agregados)
│  └─ modifiers JSONB (modificaciones)
│
├─ STATUS POR ITEM:
│  ├─ status (pending, preparing, ready, served, cancelled)
│  ├─ started_at TIMESTAMPTZ
│  ├─ ready_at TIMESTAMPTZ
│  └─ served_at TIMESTAMPTZ
│
├─ ESTACIÓN DE COCINA:
│  ├─ kitchen_station VARCHAR(50) (main, grill, fry, salad, dessert, bar, pastry)
│  └─ prepared_by UUID (FK a staff)
│
└─ NOTAS:
   ├─ special_instructions TEXT
   ├─ allergen_notes TEXT
   ├─ is_complimentary BOOLEAN
   └─ complimentary_reason TEXT

-- ESTACIONES DE COCINA
kitchen_stations
├─ id UUID PRIMARY KEY
├─ tenant_id, branch_id
├─ name VARCHAR(100) (e.g., "Parrilla Principal", "Barra de Bebidas")
├─ code VARCHAR(20) (grill, fry, salad, dessert, bar, pastry, main)
├─ color VARCHAR(7) (hex color para UI)
├─ position INTEGER (orden de display)
├─ is_active BOOLEAN
└─ avg_prep_time_minutes INTEGER

-- LOG DE ACTIVIDAD KDS
kds_activity_log
├─ id UUID PRIMARY KEY
├─ order_id UUID (FK a restaurant_orders)
├─ order_item_id UUID (FK a restaurant_order_items, NULL si es orden completa)
├─ action VARCHAR(50) (created, confirmed, started, item_ready, served, cancelled)
├─ old_status VARCHAR(20)
├─ new_status VARCHAR(20)
├─ performed_by UUID (FK a users)
├─ station VARCHAR(50)
├─ notes TEXT
└─ created_at TIMESTAMPTZ
```

#### Flujo de KDS

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CLIENTE ORDENA (Mesero o App)                            │
└─────────────────────────────────────────────────────────────┘
   INSERT restaurant_orders { status='pending' }
   INSERT restaurant_order_items (múltiples items)
   → ordered_at = NOW()

┌─────────────────────────────────────────────────────────────┐
│ 2. CONFIRMACIÓN                                              │
└─────────────────────────────────────────────────────────────┘
   UPDATE restaurant_orders SET status='confirmed'
   → confirmed_at = NOW()
   → Notificación a kitchen_stations

┌─────────────────────────────────────────────────────────────┐
│ 3. COCINA COMIENZA                                           │
└─────────────────────────────────────────────────────────────┘
   UPDATE restaurant_orders SET status='preparing'
   → started_preparing_at = NOW()

   Para cada item en estaciones:
     UPDATE restaurant_order_items SET
       status='preparing',
       started_at=NOW(),
       prepared_by=<chef_id>

┌─────────────────────────────────────────────────────────────┐
│ 4. ITEMS LISTOS                                              │
└─────────────────────────────────────────────────────────────┘
   UPDATE restaurant_order_items SET
     status='ready',
     ready_at=NOW()

   Si ALL items are ready:
     UPDATE restaurant_orders SET
       status='ready',
       ready_at=NOW()

┌─────────────────────────────────────────────────────────────┐
│ 5. SERVIDO                                                   │
└─────────────────────────────────────────────────────────────┘
   UPDATE restaurant_orders SET
     status='served',
     served_at=NOW()

┌─────────────────────────────────────────────────────────────┐
│ 6. PAGADO Y COMPLETADO                                       │
└─────────────────────────────────────────────────────────────┘
   UPDATE restaurant_orders SET
     status='completed',
     payment_status='paid',
     paid_at=NOW(),
     completed_at=NOW()
```

---

### 2. SISTEMA DE INVENTARIO

**Migración:** `090_RESTAURANT_INVENTORY.sql`

#### Tablas de Inventario (Sistema Completo)

```sql
-- CATEGORÍAS DE INVENTARIO
inventory_categories
├─ id UUID PRIMARY KEY
├─ tenant_id, branch_id
├─ name VARCHAR(100) (e.g., "Lácteos", "Carnes", "Vegetales")
├─ description TEXT
├─ parent_id UUID (jerarquía de categorías)
├─ is_perishable BOOLEAN
└─ expected_shelf_life_days INTEGER

-- ITEMS DE INVENTARIO (INGREDIENTES)
inventory_items
├─ id UUID PRIMARY KEY
├─ tenant_id, branch_id
├─ category_id UUID (FK a inventory_categories)
├─ name VARCHAR(200) (e.g., "Leche Entera Lala 1L")
├─ description TEXT
├─ sku VARCHAR(50) (código interno)
├─ barcode VARCHAR(100) (código de barras)
│
├─ UNIDADES:
│  ├─ unit_of_measure VARCHAR(20) (kg, L, pza, g, ml, oz, lb)
│  ├─ minimum_stock DECIMAL(10,2)
│  ├─ maximum_stock DECIMAL(10,2)
│  ├─ reorder_point DECIMAL(10,2)
│  └─ reorder_quantity DECIMAL(10,2)
│
├─ COSTOS:
│  ├─ current_unit_cost DECIMAL(12,4)
│  ├─ average_cost DECIMAL(12,4)
│  └─ last_purchase_cost DECIMAL(12,4)
│
├─ PROPERTIES:
│  ├─ is_perishable BOOLEAN
│  ├─ is_active BOOLEAN
│  ├─ allergen_info JSONB
│  └─ nutritional_info JSONB
│
└─ SUPPLIER (default):
   ├─ default_supplier_id UUID (FK a inventory_suppliers)
   └─ supplier_item_code VARCHAR(50)

-- LOTES DE INVENTARIO
inventory_batches
├─ id UUID PRIMARY KEY
├─ inventory_item_id UUID (FK a inventory_items)
├─ batch_number VARCHAR(50)
├─ quantity DECIMAL(10,2)
├─ unit_cost DECIMAL(12,4)
├─ purchase_date DATE
├─ expiration_date DATE
├─ supplier_id UUID (FK a inventory_suppliers)
├─ is_active BOOLEAN
└─ notes TEXT

-- MOVIMIENTOS DE INVENTARIO (KARDEX)
inventory_movements
├─ id UUID PRIMARY KEY
├─ tenant_id, branch_id
├─ inventory_item_id UUID (FK a inventory_items)
├─ batch_id UUID (FK a inventory_batches, NULL si no aplica)
│
├─ TIPO DE MOVIMIENTO:
│  └─ movement_type VARCHAR(50) CHECK (
│       'purchase',       -- Compra/Recepción
│       'sale',           -- Venta directa
│       'consumption',    -- Consumo en producción
│       'waste',          -- Merma/Desperdicio
│       'adjustment',     -- Ajuste manual
│       'transfer_in',    -- Transferencia entrada
│       'transfer_out',   -- Transferencia salida
│       'return',         -- Devolución
│       'production'      -- Deducción por receta (SR)
│     )
│
├─ CANTIDAD:
│  ├─ quantity DECIMAL(10,2) (positivo=entrada, negativo=salida)
│  ├─ unit_cost DECIMAL(12,4)
│  └─ total_cost DECIMAL(12,4)
│
├─ REFERENCIA:
│  ├─ reference_type VARCHAR(50) (sr_sale, restaurant_order, purchase_order, count)
│  ├─ reference_id UUID
│  └─ reference_number VARCHAR(50)
│
├─ NOTAS:
│  ├─ notes TEXT
│  └─ reason TEXT
│
└─ USUARIO:
   ├─ performed_by UUID (FK a users)
   └─ created_at TIMESTAMPTZ

-- PROVEEDORES
inventory_suppliers
├─ id UUID PRIMARY KEY
├─ tenant_id
├─ name VARCHAR(200)
├─ contact_name VARCHAR(100)
├─ email VARCHAR(100)
├─ phone VARCHAR(20)
├─ address TEXT
├─ payment_terms VARCHAR(50)
├─ lead_time_days INTEGER
└─ is_active BOOLEAN

-- CONTEOS FÍSICOS
inventory_counts
├─ id UUID PRIMARY KEY
├─ tenant_id, branch_id
├─ count_number VARCHAR(50)
├─ count_date DATE
├─ count_type VARCHAR(50) (full, partial, cycle)
├─ status VARCHAR(20) (draft, in_progress, completed, cancelled)
├─ counted_by UUID (FK a users)
├─ approved_by UUID (FK a users)
├─ notes TEXT
└─ created_at, completed_at TIMESTAMPTZ

inventory_count_items
├─ id UUID PRIMARY KEY
├─ count_id UUID (FK a inventory_counts)
├─ inventory_item_id UUID (FK a inventory_items)
├─ batch_id UUID (FK a inventory_batches)
├─ expected_quantity DECIMAL(10,2) (del sistema)
├─ actual_quantity DECIMAL(10,2) (conteo físico)
├─ variance DECIMAL(10,2) (diferencia)
├─ variance_cost DECIMAL(12,4)
├─ notes TEXT
└─ counted_at TIMESTAMPTZ
```

#### Cálculo de Stock Actual

```sql
-- Stock Actual = SUM(inventory_movements.quantity) WHERE inventory_item_id = X
SELECT
  inventory_item_id,
  SUM(quantity) AS current_stock
FROM inventory_movements
WHERE tenant_id = <tenant>
  AND branch_id = <branch>
  AND inventory_item_id = <item_id>
GROUP BY inventory_item_id;
```

---

### 3. SISTEMA DE MENÚ Y RECETAS

**Migración:** `088_RESTAURANT_VERTICAL_SCHEMA.sql`

#### Tablas de Menú

```sql
-- CATEGORÍAS DE MENÚ
restaurant_menu_categories
├─ id UUID PRIMARY KEY
├─ tenant_id, branch_id
├─ name VARCHAR(100) (e.g., "Entradas", "Platos Fuertes", "Bebidas")
├─ slug VARCHAR(100)
├─ description TEXT
├─ parent_id UUID (categorías anidadas)
├─ position INTEGER (orden de display)
│
├─ DISPONIBILIDAD:
│  ├─ available_times JSONB (breakfast, lunch, dinner, all_day)
│  ├─ available_days JSONB (monday-sunday)
│  ├─ is_active BOOLEAN
│  └─ is_featured BOOLEAN
│
└─ IMAGE:
   └─ image_url TEXT

-- ITEMS DE MENÚ (PLATILLOS)
restaurant_menu_items
├─ id UUID PRIMARY KEY
├─ tenant_id, branch_id
├─ category_id UUID (FK a restaurant_menu_categories)
├─ name VARCHAR(200) (e.g., "Tacos al Pastor")
├─ slug VARCHAR(200)
├─ description TEXT
├─ price DECIMAL(10,2)
│
├─ VARIANTES:
│  ├─ variants JSONB (tamaños, tipos: [{name, price_modifier}])
│  ├─ sizes JSONB (chico, mediano, grande)
│  └─ add_ons JSONB (extras disponibles)
│
├─ PROPIEDADES:
│  ├─ allergens JSONB (array de alergenos)
│  ├─ is_vegetarian BOOLEAN
│  ├─ is_vegan BOOLEAN
│  ├─ is_gluten_free BOOLEAN
│  ├─ spice_level INTEGER (0-5)
│  └─ calories INTEGER
│
├─ OPERACIÓN:
│  ├─ prep_time_minutes INTEGER
│  ├─ is_available BOOLEAN
│  ├─ is_featured BOOLEAN
│  ├─ position INTEGER
│  └─ available_times JSONB
│
├─ ANALYTICS:
│  ├─ times_ordered INTEGER
│  ├─ average_rating DECIMAL(3,2)
│  └─ review_count INTEGER
│
└─ MEDIA:
   └─ image_url TEXT

-- RECETAS DE MENÚ
menu_item_recipes
├─ id UUID PRIMARY KEY
├─ menu_item_id UUID (FK a restaurant_menu_items) UNIQUE
├─ name VARCHAR(200)
├─ description TEXT
├─ yield_quantity DECIMAL(10,2) (cuántas porciones produce)
├─ yield_unit VARCHAR(20) (porciones, pzas)
├─ preparation_time_minutes INTEGER
├─ instructions TEXT
├─ is_active BOOLEAN
└─ notes TEXT

-- INGREDIENTES DE RECETA
recipe_ingredients
├─ id UUID PRIMARY KEY
├─ recipe_id UUID (FK a menu_item_recipes)
├─ inventory_item_id UUID (FK a inventory_items) ⬅️ CONEXIÓN CRÍTICA
├─ quantity DECIMAL(10,4)
├─ unit VARCHAR(20)
├─ waste_percentage DECIMAL(5,2) (e.g., 5% de merma)
├─ is_optional BOOLEAN
└─ preparation_notes TEXT

-- CONSTRAINT:
CONSTRAINT unique_recipe_ingredient UNIQUE(recipe_id, inventory_item_id)
```

#### Flujo de Deducción de Inventario

```
┌─────────────────────────────────────────────────────────────┐
│ ORDEN CONFIRMADA → DEDUCIR INGREDIENTES                     │
└─────────────────────────────────────────────────────────────┘

1. restaurant_order_items { menu_item_id, quantity }
     ↓
2. menu_item_recipes { menu_item_id → recipe_id }
     ↓
3. recipe_ingredients { recipe_id → múltiples ingredientes }
     ↓
   Para cada ingrediente:
     - cantidad_a_deducir = quantity * recipe_ingredient.quantity * (1 + waste_percentage/100)
     - inventory_item_id
     ↓
4. INSERT inventory_movements {
     movement_type = 'consumption',
     quantity = -cantidad_a_deducir,
     reference_type = 'restaurant_order',
     reference_id = order_id
   }
     ↓
5. Verificar stock:
   Si current_stock < reorder_point:
     → Generar alerta de reorden
```

---

### 4. SISTEMA DE MESAS Y RESERVACIONES

**Migración:** `088_RESTAURANT_VERTICAL_SCHEMA.sql`

```sql
-- MESAS DE RESTAURANTE
restaurant_tables
├─ id UUID PRIMARY KEY
├─ tenant_id, branch_id
├─ table_number VARCHAR(20) (e.g., "1", "VIP-A")
├─ name VARCHAR(100) (e.g., "Mesa VIP Terraza")
│
├─ CAPACIDAD:
│  ├─ min_capacity INTEGER
│  └─ max_capacity INTEGER
│
├─ UBICACIÓN:
│  ├─ zone VARCHAR(50) (main, terrace, private, bar, outdoor)
│  ├─ floor INTEGER
│  ├─ position_x INTEGER (para mapa visual)
│  └─ position_y INTEGER
│
├─ CARACTERÍSTICAS:
│  ├─ is_outdoor BOOLEAN
│  ├─ is_accessible BOOLEAN (accesibilidad)
│  ├─ is_high_top BOOLEAN (mesa alta)
│  └─ features JSONB (window_view, booth, quiet_corner)
│
├─ COMBINACIÓN:
│  ├─ can_combine BOOLEAN
│  └─ combinable_with UUID[] (array de table_ids)
│
├─ ESTADO:
│  ├─ status VARCHAR(20) CHECK (
│       'available',
│       'occupied',
│       'reserved',
│       'unavailable',
│       'maintenance'
│     )
│  └─ priority INTEGER (para asignación automática)
│
└─ QR CODE:
   └─ qr_code_url TEXT (para menú digital)

-- RESERVACIONES (reutiliza tabla appointments)
appointments
├─ id UUID PRIMARY KEY
├─ tenant_id, branch_id
├─ service_id UUID (FK a services - tipo "Restaurant")
├─ lead_id UUID (FK a leads)
├─ staff_id UUID (mesero asignado)
├─ appointment_date DATE
├─ start_time TIME
├─ end_time TIME
├─ duration_minutes INTEGER
├─ status VARCHAR(20)
└─ notes TEXT

-- DETALLES ESPECÍFICOS DE RESTAURANTE
appointment_restaurant_details
├─ id UUID PRIMARY KEY
├─ appointment_id UUID (FK a appointments) UNIQUE
│
├─ MESA:
│  ├─ table_id UUID (FK a restaurant_tables)
│  └─ table_preferences TEXT
│
├─ PARTY:
│  ├─ party_size INTEGER
│  ├─ occasion_type VARCHAR(50) (regular, birthday, business, date_night, anniversary)
│  ├─ special_requests TEXT
│  ├─ dietary_notes TEXT
│  └─ allergies_confirmed BOOLEAN
│
├─ PRE-ORDER:
│  ├─ pre_order_items JSONB (platillos pre-ordenados)
│  └─ wine_pre_selection JSONB
│
├─ DEPÓSITO:
│  ├─ deposit_required BOOLEAN
│  ├─ deposit_amount DECIMAL(10,2)
│  └─ deposit_paid BOOLEAN
│
├─ LLEGADA:
│  ├─ arrival_status VARCHAR(20) (pending, confirmed, en_route, arrived, seated, dining, finished, no_show)
│  ├─ arrival_time TIMESTAMPTZ
│  └─ seated_at TIMESTAMPTZ
│
└─ CUENTA FINAL:
   ├─ final_bill_amount DECIMAL(12,2)
   ├─ tip_amount DECIMAL(12,2)
   ├─ payment_method VARCHAR(50)
   └─ service_rating, food_rating, ambiance_rating INTEGER
```

---

## 🔗 INTEGRACIÓN SOFT RESTAURANT

### 5. TABLAS DE SOFT RESTAURANT (v3.0)

**Migración:** `154_SOFT_RESTAURANT_INTEGRATION_V3_PERFECT.sql`

```sql
-- VENTAS DE SOFT RESTAURANT
sr_sales
├─ id UUID PRIMARY KEY
├─ tenant_id, branch_id, integration_id
├─ sr_company_id VARCHAR(50) ⬅️ IdEmpresa de SR
├─ external_id VARCHAR(50) ⬅️ NumeroOrden de SR
├─ warehouse_code VARCHAR(20) ⬅️ Almacen de SR
├─ station_code VARCHAR(100) ⬅️ Estacion de SR
├─ area_name VARCHAR(100) ⬅️ Area de SR
├─ table_code VARCHAR(50) ⬅️ Mesa (opcional)
├─ user_code VARCHAR(50) ⬅️ IdUsuario (mesero SR)
├─ customer_code VARCHAR(50) ⬅️ IdCliente (opcional)
├─ sale_date TIMESTAMPTZ ⬅️ FechaVenta
├─ total DECIMAL(12,4) ⬅️ Total
├─ tip DECIMAL(12,4) DEFAULT 0
│
├─ STATUS:
│  └─ status VARCHAR(20) CHECK (completed, cancelled, error, pending)
│
├─ CANCELACIÓN:
│  ├─ cancellation_type VARCHAR(50)
│  ├─ cancelled_at TIMESTAMPTZ
│  ├─ cancelled_by UUID
│  └─ cancellation_reason TEXT
│
├─ COSTOS CALCULADOS (TIS TIS):
│  ├─ recipe_cost DECIMAL(12,4)
│  └─ profit_margin DECIMAL(12,4)
│
└─ AUDIT:
   ├─ raw_data JSONB (JSON completo de SR)
   ├─ error_message TEXT
   ├─ retry_count INTEGER
   └─ processed_at TIMESTAMPTZ

CONSTRAINT unique_sr_sale UNIQUE(tenant_id, integration_id, warehouse_code, external_id)

-- ITEMS DE VENTA SR
sr_sale_items
├─ id UUID PRIMARY KEY
├─ tenant_id
├─ sale_id UUID (FK a sr_sales)
├─ product_id VARCHAR(50) ⬅️ IdProducto de SR
├─ description VARCHAR(200) ⬅️ Descripcion
├─ movement_type INTEGER ⬅️ FK a sr_movement_types
├─ quantity DECIMAL(10,4) ⬅️ Cantidad
├─ unit_price DECIMAL(12,4) ⬅️ PrecioUnitario
├─ subtotal_without_tax DECIMAL(12,4) ⬅️ ImporteSinImpuestos
├─ discount_amount DECIMAL(12,4) DEFAULT 0 ⬅️ Descuento
├─ tax_details JSONB ⬅️ Impuestos[] array
├─ tax_amount DECIMAL(12,4) DEFAULT 0
├─ total_amount DECIMAL(12,4)
│
└─ DEDUCCIÓN DE RECETA:
   ├─ recipe_deducted BOOLEAN DEFAULT false
   ├─ recipe_cost DECIMAL(12,4)
   └─ deduction_error TEXT

-- PAGOS DE VENTA SR
sr_payments
├─ id UUID PRIMARY KEY
├─ tenant_id
├─ sale_id UUID (FK a sr_sales)
├─ payment_method_name VARCHAR(100) ⬅️ FormaPago
├─ amount DECIMAL(12,4) ⬅️ Importe
├─ tip_amount DECIMAL(12,4) DEFAULT 0 ⬅️ Propina
└─ payment_method_id UUID (FK a payment_methods, si está mapeado)

-- MAPEO DE PRODUCTOS SR → TIS TIS
sr_product_mappings
├─ id UUID PRIMARY KEY
├─ tenant_id, integration_id
│
├─ SR PRODUCT:
│  ├─ sr_product_id VARCHAR(50) ⬅️ IdProducto (e.g., "01005")
│  └─ sr_product_name VARCHAR(200) ⬅️ Descripcion (cached)
│
├─ TIS TIS PRODUCT:
│  ├─ tistis_product_id UUID ⬅️ FK a restaurant_menu_items.id
│  └─ tistis_product_name VARCHAR(200)
│
├─ MAPPING STATUS:
│  ├─ is_mapped BOOLEAN DEFAULT false
│  ├─ is_active BOOLEAN DEFAULT true
│  ├─ auto_mapped BOOLEAN DEFAULT false
│  └─ confidence_score DECIMAL(3,2) (0.00-1.00)
│
└─ TIMESTAMPS:
   └─ last_seen_at TIMESTAMPTZ

CONSTRAINT unique_sr_product_mapping UNIQUE(tenant_id, integration_id, sr_product_id)

-- CATÁLOGO DE TIPOS DE MOVIMIENTO SR
sr_movement_types
├─ code INTEGER PRIMARY KEY (1, 2, 3...)
├─ name VARCHAR(50) (Venta Normal, Devolución, Cortesía)
├─ description TEXT
├─ affects_inventory BOOLEAN DEFAULT true
├─ is_refund BOOLEAN DEFAULT false
└─ is_complimentary BOOLEAN DEFAULT false

INSERT INTO sr_movement_types VALUES
  (1, 'Venta Normal', 'Venta estándar', true, false, false),
  (2, 'Devolución', 'Devolución de producto', true, true, false),
  (3, 'Cortesía', 'Producto sin cargo', true, false, true);

-- LOGS DE SINCRONIZACIÓN
sr_sync_logs
├─ id UUID PRIMARY KEY
├─ tenant_id, integration_id
├─ log_type VARCHAR(50) CHECK (
│    sale_received, sale_duplicate, sale_cancelled,
│    recipe_deducted, alert_created,
│    error_validation, error_processing, error_deduction,
│    product_mapped, product_unmapped,
│    company_id_mismatch, cancellation_received
│  )
├─ level VARCHAR(20) CHECK (debug, info, warning, error, critical)
├─ message TEXT
├─ details JSONB
├─ sale_id UUID (FK a sr_sales)
├─ external_id VARCHAR(50) (NumeroOrden, para búsqueda rápida)
└─ created_at TIMESTAMPTZ

-- ALERTAS DE STOCK BAJO
low_stock_alerts
├─ id UUID PRIMARY KEY
├─ tenant_id, branch_id
├─ ingredient_id UUID (FK a inventory_items) ⬅️ NOTA: debería ser inventory_items
├─ alert_type VARCHAR(50) (low_stock, out_of_stock, approaching_min)
├─ severity VARCHAR(20) (info, warning, critical)
├─ current_stock DECIMAL(10,4)
├─ reorder_point DECIMAL(10,4)
├─ minimum_stock DECIMAL(10,4)
├─ suggested_order_quantity DECIMAL(10,4)
├─ status VARCHAR(20) (active, acknowledged, resolved)
├─ acknowledged_by UUID (FK a users)
├─ acknowledged_at TIMESTAMPTZ
├─ resolved_at TIMESTAMPTZ
└─ resolution_notes TEXT
```

---

## ⚠️ CONFLICTOS ARQUITECTÓNICOS DETECTADOS

### CONFLICTO #1: DUPLICACIÓN DE TABLAS DE INGREDIENTES

**Problema:**
Existen **DOS tablas de ingredientes** con propósitos similares:

| Tabla | Migración | Campos | Propósito | FK |
|-------|-----------|--------|-----------|---|
| `ingredients` | 154 (SR v3.0) | id, name, unit_cost, reorder_point | Simple, solo para SR | `recipe_ingredients.ingredient_id` |
| `inventory_items` | 090 (Restaurant) | id, name, sku, barcode, current_unit_cost, average_cost, allergen_info, nutritional_info, supplier_id | Completo, sistema restaurant | `recipe_ingredients.inventory_item_id` |

**Impacto:**
- ❌ Dos sistemas de ingredientes separados
- ❌ Datos duplicados
- ❌ Confusión en `recipe_ingredients` (¿cuál FK usar?)
- ❌ Stock en dos lugares diferentes
- ❌ Reportes inconsistentes

**Solución Recomendada:**
```sql
-- ELIMINAR tabla `ingredients` de migración 154
DROP TABLE IF EXISTS public.ingredients CASCADE;

-- USAR exclusivamente `inventory_items` de migración 090

-- MIGRAR FKs en recipe_ingredients (si existen datos):
UPDATE public.recipe_ingredients
SET inventory_item_id = (
  SELECT ii.id
  FROM inventory_items ii
  JOIN ingredients i ON i.name = ii.name
  WHERE recipe_ingredients.ingredient_id = i.id
)
WHERE ingredient_id IS NOT NULL;

-- ELIMINAR columna antigua:
ALTER TABLE public.recipe_ingredients DROP COLUMN ingredient_id;
```

---

### CONFLICTO #2: DUPLICACIÓN DE TABLAS DE RECETAS

**Problema:**
Existen **DOS tablas de recetas**:

| Tabla | Migración | Para Qué | Ingredientes Desde |
|-------|-----------|----------|-------------------|
| `recipes` | 154 (SR v3.0) | Recetas de productos SR | `recipe_ingredients` → `ingredients` |
| `menu_item_recipes` | 090 (Restaurant) | Recetas de platillos restaurant | `recipe_ingredients` → `inventory_items` |

**Impacto:**
- ⚠️ Dos sistemas de recetas
- ⚠️ `recipe_ingredients` referencia AMBAS (confuso)
- ⚠️ Al deducir inventario por SR, ¿qué receta usar?

**Solución Recomendada:**
```sql
-- USAR `menu_item_recipes` como tabla única de recetas

-- MAPEAR productos SR a menu_items:
sr_product_mappings.sr_product_id → sr_product_mappings.tistis_product_id
   ↓
restaurant_menu_items.id
   ↓
menu_item_recipes (receta del platillo)
   ↓
recipe_ingredients (ingredientes a deducir)
   ↓
inventory_items (ingredientes)

-- DEPRECAR tabla `recipes` (mantener solo para legacy si es necesario)
-- O eliminar si no hay datos:
DROP TABLE IF EXISTS public.recipes CASCADE;
```

---

### CONFLICTO #3: TABLA `recipe_ingredients` AMBIGUA

**Problema:**
La tabla `recipe_ingredients` tiene **DOS definiciones**:

**Definición en Mig 090 (Restaurant):**
```sql
recipe_ingredients
├─ recipe_id UUID (FK a menu_item_recipes)
├─ inventory_item_id UUID (FK a inventory_items)
└─ quantity, unit, waste_percentage
```

**Definición en Mig 154 (SR v3.0):**
```sql
recipe_ingredients
├─ recipe_id UUID (FK a recipes)
├─ ingredient_id UUID (FK a ingredients)
└─ quantity, unit, waste_percentage
```

**Impacto:**
- ❌ ¿Cuál es la tabla real?
- ❌ Si se ejecutan ambas migraciones, habrá conflicto
- ❌ FKs apuntan a tablas diferentes

**Solución Recomendada:**
```sql
-- USAR definición de Mig 090 (más completa)
-- ELIMINAR definición de Mig 154

-- Estructura final:
recipe_ingredients
├─ id UUID PRIMARY KEY
├─ recipe_id UUID (FK a menu_item_recipes) ⬅️ ÚNICO
├─ inventory_item_id UUID (FK a inventory_items) ⬅️ ÚNICO
├─ quantity DECIMAL(10,4)
├─ unit VARCHAR(20)
├─ waste_percentage DECIMAL(5,2)
├─ is_optional BOOLEAN
└─ preparation_notes TEXT

CONSTRAINT unique_recipe_ingredient UNIQUE(recipe_id, inventory_item_id)
```

---

### CONFLICTO #4: FALTA CONEXIÓN sr_sales → restaurant_orders

**Problema:**
Las ventas de SR (`sr_sales`) **NO se conectan automáticamente** con las órdenes de TIS TIS (`restaurant_orders`).

**Escenarios:**
1. **Venta dine_in en SR** → ¿Se crea `restaurant_order`?
2. **Venta takeout en SR** → ¿Se crea `restaurant_order`?
3. **¿Aparece en KDS?** → NO, porque no hay orden en TIS TIS

**Impacto:**
- ❌ Ventas de SR no aparecen en KDS
- ❌ Dashboard de cocina no muestra ventas de SR
- ❌ Reportes de TIS TIS no incluyen ventas de SR
- ❌ Dos sistemas de órdenes desconectados

**Solución Recomendada:**
```sql
-- AGREGAR columna en restaurant_orders:
ALTER TABLE public.restaurant_orders
ADD COLUMN sr_sale_id UUID REFERENCES public.sr_sales(id) ON DELETE SET NULL;

-- Crear índice:
CREATE INDEX idx_restaurant_orders_sr_sale
  ON public.restaurant_orders(sr_sale_id) WHERE sr_sale_id IS NOT NULL;

-- LÓGICA EN BACKEND:
Cuando SR envía venta:
  1. INSERT INTO sr_sales { ... }
  2. Si order_type requiere KDS (dine_in, takeout):
     INSERT INTO restaurant_orders {
       sr_sale_id = sr_sales.id,
       display_number = auto-generated,
       status = 'completed', ⬅️ Ya está finalizada
       total, tax_amount, tip_amount (desde sr_sales),
       payment_status = 'paid',
       ordered_at = sr_sales.sale_date,
       completed_at = NOW()
     }
  3. Para cada sr_sale_item:
     INSERT INTO restaurant_order_items {
       order_id,
       menu_item_id (via sr_product_mappings),
       quantity, unit_price,
       status = 'completed'
     }
```

---

### CONFLICTO #5: FALTA MAPEO sr_product_id → menu_item_id

**Problema:**
La tabla `sr_product_mappings` tiene el campo `tistis_product_id` pero **NO hay FK explícita** a `restaurant_menu_items`.

**Impacto:**
- ⚠️ No hay integridad referencial
- ⚠️ Podría mapearse a producto inexistente
- ⚠️ No se puede hacer JOIN directo

**Solución Recomendada:**
```sql
-- AGREGAR FK a restaurant_menu_items:
ALTER TABLE public.sr_product_mappings
ADD CONSTRAINT fk_sr_product_mappings_menu_item
FOREIGN KEY (tistis_product_id)
REFERENCES public.restaurant_menu_items(id)
ON DELETE SET NULL;

-- Crear índice:
CREATE INDEX idx_sr_product_mappings_menu_item
  ON public.sr_product_mappings(tistis_product_id)
  WHERE tistis_product_id IS NOT NULL;

-- Comentario:
COMMENT ON COLUMN public.sr_product_mappings.tistis_product_id IS
'FK a restaurant_menu_items.id. NULL si el producto SR no está mapeado.
CRÍTICO: Debe existir en restaurant_menu_items para poder deducir receta.';
```

---

## 🔄 FLUJO COMPLETO CORRECTO: SR → TIS TIS

### Flujo End-to-End (CORREGIDO)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SOFT RESTAURANT ENVÍA VENTA                                   │
└─────────────────────────────────────────────────────────────────┘
   POST /api/webhook/softrestaurant
   {
     "IdEmpresa": "SR10.002MX12345",
     "Ventas": [{
       "NumeroOrden": "12345",
       "Almacen": "2",
       "Area": "DIDDI",
       "Mesa": "5",
       "IdUsuario": "MESERO01",
       "IdCliente": "CLI001",
       "FechaVenta": "2026-01-22T19:30:00",
       "Total": 580.00,
       "Conceptos": [{
         "IdProducto": "TACO-PASTOR",
         "Descripcion": "Tacos al Pastor x3",
         "Movimiento": 1,
         "Cantidad": 1,
         "PrecioUnitario": 120.00,
         "ImporteSinImpuestos": 103.45,
         "Descuento": 0,
         "Impuestos": [{
           "Impuesto": "IVA",
           "Tasa": 0.16,
           "Importe": 16.55
         }]
       }, {
         "IdProducto": "CERVEZA-CORONA",
         "Descripcion": "Cerveza Corona 355ml",
         "Movimiento": 1,
         "Cantidad": 2,
         "PrecioUnitario": 50.00,
         "ImporteSinImpuestos": 86.21,
         "Descuento": 0,
         "Impuestos": [{
           "Impuesto": "IVA",
           "Tasa": 0.16,
           "Importe": 13.79
         }]
       }],
       "Pagos": [{
         "FormaPago": "EFECTIVO",
         "Importe": 600.00,
         "Propina": 50.00
       }]
     }]
   }

┌─────────────────────────────────────────────────────────────────┐
│ 2. VALIDACIÓN Y SEGURIDAD                                        │
└─────────────────────────────────────────────────────────────────┘
   a) Validar webhook secret
   b) Validar IdEmpresa = sr_company_id esperado
   c) Verificar duplicado (unique constraint)
   d) Validar totales: SUM(Conceptos) = Total

┌─────────────────────────────────────────────────────────────────┐
│ 3. ALMACENAR SR_SALES                                            │
└─────────────────────────────────────────────────────────────────┘
   BEGIN TRANSACTION;

   INSERT INTO sr_sales {
     tenant_id, branch_id, integration_id,
     sr_company_id = "SR10.002MX12345",
     external_id = "12345",
     warehouse_code = "2",
     station_code = NULL,
     area_name = "DIDDI",
     table_code = "5",
     user_code = "MESERO01",
     customer_code = "CLI001",
     sale_date = "2026-01-22T19:30:00",
     total = 580.00,
     tip = 50.00,
     status = "completed",
     raw_data = <JSON completo>
   } RETURNING id AS sr_sale_id;

   -- Items
   INSERT INTO sr_sale_items {
     sale_id = sr_sale_id,
     product_id = "TACO-PASTOR",
     description = "Tacos al Pastor x3",
     movement_type = 1,
     quantity = 1,
     unit_price = 120.00,
     subtotal_without_tax = 103.45,
     discount_amount = 0,
     tax_details = [{"Impuesto":"IVA","Tasa":0.16,"Importe":16.55}],
     tax_amount = 16.55,
     total_amount = 120.00
   };

   INSERT INTO sr_sale_items {
     sale_id = sr_sale_id,
     product_id = "CERVEZA-CORONA",
     description = "Cerveza Corona 355ml",
     movement_type = 1,
     quantity = 2,
     unit_price = 50.00,
     subtotal_without_tax = 86.21,
     discount_amount = 0,
     tax_details = [{"Impuesto":"IVA","Tasa":0.16,"Importe":13.79}],
     tax_amount = 13.79,
     total_amount = 100.00
   };

   -- Pagos
   INSERT INTO sr_payments {
     sale_id = sr_sale_id,
     payment_method_name = "EFECTIVO",
     amount = 600.00,
     tip_amount = 50.00
   };

   COMMIT;

┌─────────────────────────────────────────────────────────────────┐
│ 4. MAPEAR PRODUCTOS SR → MENU ITEMS                             │
└─────────────────────────────────────────────────────────────────┘
   Para cada sr_sale_item:

   -- Buscar mapeo
   SELECT tistis_product_id, is_mapped
   FROM sr_product_mappings
   WHERE sr_product_id = "TACO-PASTOR";

   -- Si NO existe:
   INSERT INTO sr_product_mappings {
     sr_product_id = "TACO-PASTOR",
     sr_product_name = "Tacos al Pastor x3",
     is_mapped = false,
     last_seen_at = NOW()
   };

   INSERT INTO sr_sync_logs {
     log_type = "product_unmapped",
     level = "warning",
     message = "Producto SR sin mapeo: TACO-PASTOR",
     sale_id = sr_sale_id
   };

   → SKIP deducción de inventario
   → Notificar admin para configurar mapeo

   -- Si SÍ existe y is_mapped = true:
   tistis_product_id = <UUID del menu_item>
   → Continuar a deducción

┌─────────────────────────────────────────────────────────────────┐
│ 5. OBTENER RECETA DEL PRODUCTO                                  │
└─────────────────────────────────────────────────────────────────┘
   SELECT r.id AS recipe_id
   FROM menu_item_recipes r
   WHERE r.menu_item_id = tistis_product_id
     AND r.is_active = true;

   -- Si NO hay receta:
   INSERT INTO sr_sync_logs {
     log_type = "error_deduction",
     level = "warning",
     message = "Producto sin receta configurada",
     sale_id = sr_sale_id
   };

   UPDATE sr_sale_items
   SET deduction_error = "Producto sin receta"
   WHERE id = sale_item_id;

   → SKIP deducción

   -- Si SÍ hay receta:
   SELECT
     ri.inventory_item_id,
     ri.quantity,
     ri.unit,
     ri.waste_percentage
   FROM recipe_ingredients ri
   WHERE ri.recipe_id = recipe_id;

┌─────────────────────────────────────────────────────────────────┐
│ 6. DEDUCIR INGREDIENTES DEL INVENTARIO                          │
└─────────────────────────────────────────────────────────────────┘
   Para cada ingrediente en recipe_ingredients:

   -- Calcular cantidad a deducir
   cantidad_a_deducir =
     sr_sale_item.quantity *
     recipe_ingredient.quantity *
     (1 + recipe_ingredient.waste_percentage / 100)

   -- Ejemplo:
   -- sr_sale_item.quantity = 1 (orden de 1x tacos)
   -- recipe_ingredient.quantity = 0.3 (300g de carne)
   -- waste_percentage = 5% (merma)
   -- cantidad_a_deducir = 1 * 0.3 * 1.05 = 0.315 kg

   -- Verificar stock actual
   current_stock = get_ingredient_current_stock(
     tenant_id,
     branch_id,
     inventory_item_id
   );

   -- Si stock insuficiente:
   IF current_stock < cantidad_a_deducir THEN
     INSERT INTO sr_sync_logs {
       log_type = "error_deduction",
       level = "error",
       message = "Stock insuficiente para deducir",
       details = {
         item: inventory_item.name,
         required: cantidad_a_deducir,
         available: current_stock
       }
     };

     UPDATE sr_sale_items
     SET deduction_error = "Stock insuficiente"
     WHERE id = sale_item_id;

     → CONTINUAR (no bloquear venta)
     → Generar alerta crítica
   END IF;

   -- Si stock OK:
   INSERT INTO inventory_movements {
     tenant_id,
     branch_id,
     inventory_item_id,
     movement_type = 'production', ⬅️ Deducción por receta SR
     quantity = -cantidad_a_deducir, ⬅️ Negativo
     unit = recipe_ingredient.unit,
     reference_type = 'sr_sale',
     reference_id = sr_sale_id,
     notes = "Deducción automática por venta SR: 12345"
   };

   UPDATE sr_sale_items
   SET recipe_deducted = true
   WHERE id = sale_item_id;

┌─────────────────────────────────────────────────────────────────┐
│ 7. GENERAR ALERTAS DE STOCK BAJO                                │
└─────────────────────────────────────────────────────────────────┘
   Para cada inventory_item deducido:

   nuevo_stock = get_ingredient_current_stock(...);

   IF nuevo_stock < inventory_item.reorder_point THEN
     INSERT INTO low_stock_alerts {
       ingredient_id = inventory_item_id,
       alert_type = (
         CASE
           WHEN nuevo_stock <= 0 THEN 'out_of_stock'
           WHEN nuevo_stock < minimum_stock THEN 'low_stock'
           ELSE 'approaching_min'
         END
       ),
       severity = (
         CASE
           WHEN nuevo_stock <= 0 THEN 'critical'
           WHEN nuevo_stock < minimum_stock THEN 'warning'
           ELSE 'info'
         END
       ),
       current_stock = nuevo_stock,
       reorder_point = inventory_item.reorder_point,
       minimum_stock = inventory_item.minimum_stock,
       suggested_order_quantity = (
         inventory_item.maximum_stock - nuevo_stock
       ),
       status = 'active'
     };

     INSERT INTO sr_sync_logs {
       log_type = "alert_created",
       level = "warning",
       message = "Alerta de stock bajo generada",
       sale_id = sr_sale_id
     };
   END IF;

┌─────────────────────────────────────────────────────────────────┐
│ 8. CREAR ORDEN EN RESTAURANT_ORDERS (OPCIONAL)                  │
└─────────────────────────────────────────────────────────────────┘
   -- Solo si es necesario para KDS/reportes:

   INSERT INTO restaurant_orders {
     tenant_id, branch_id,
     sr_sale_id = sr_sale_id, ⬅️ CONEXIÓN
     order_number = "SR-12345",
     display_number = auto_generated(), -- "M-042"
     order_type = (
       CASE
         WHEN sr_sales.table_code IS NOT NULL THEN 'dine_in'
         ELSE 'takeout'
       END
     ),
     table_id = (
       SELECT id FROM restaurant_tables
       WHERE table_number = sr_sales.table_code
       LIMIT 1
     ),
     customer_id = (
       SELECT lead_id FROM leads
       WHERE external_customer_code = sr_sales.customer_code
       LIMIT 1
     ),
     status = 'completed', ⬅️ Ya está finalizada
     ordered_at = sr_sales.sale_date,
     completed_at = NOW(),
     paid_at = NOW(),
     payment_status = 'paid',
     subtotal = sr_sales.total - sr_sales.tip,
     tax_amount = SUM(sr_sale_items.tax_amount),
     tip_amount = sr_sales.tip,
     total = sr_sales.total
   } RETURNING id AS order_id;

   -- Items
   Para cada sr_sale_item:
     INSERT INTO restaurant_order_items {
       order_id,
       menu_item_id = sr_product_mappings.tistis_product_id,
       quantity = sr_sale_item.quantity,
       unit_price = sr_sale_item.unit_price,
       subtotal = sr_sale_item.total_amount,
       status = 'completed', ⬅️ Ya listo
       kitchen_station = (
         SELECT default_station
         FROM restaurant_menu_items
         WHERE id = tistis_product_id
       )
     };

┌─────────────────────────────────────────────────────────────────┐
│ 9. LOGS Y NOTIFICACIONES                                         │
└─────────────────────────────────────────────────────────────────┘
   INSERT INTO sr_sync_logs {
     log_type = "sale_received",
     level = "info",
     message = "Venta procesada exitosamente",
     sale_id = sr_sale_id,
     external_id = "12345"
   };

   -- Notificar vía WebSocket (si KDS está activo):
   broadcast({
     type: "new_sr_sale",
     order_id: order_id,
     display_number: "M-042",
     items: [...],
     total: 580.00
   });

┌─────────────────────────────────────────────────────────────────┐
│ 10. RESPUESTA A SOFT RESTAURANT                                  │
└─────────────────────────────────────────────────────────────────┘
   HTTP 200 OK
   {
     "success": true,
     "message": "Venta procesada exitosamente",
     "order_id": "<UUID>",
     "details": {
       "items_processed": 2,
       "items_deducted": 2,
       "alerts_generated": 1,
       "total_cost": 245.50,
       "profit_margin": 334.50
     }
   }
```

---

## 📋 RECOMENDACIONES DE IMPLEMENTACIÓN

### Prioridad CRÍTICA (Implementar ANTES de producción)

1. **UNIFICAR TABLAS DE INGREDIENTES**
   ```sql
   -- Eliminar tabla `ingredients` de Mig 154
   -- Usar exclusivamente `inventory_items` de Mig 090
   -- Migrar FKs en recipe_ingredients
   ```

2. **UNIFICAR TABLAS DE RECETAS**
   ```sql
   -- Usar `menu_item_recipes` como único sistema
   -- Mapear SR products vía sr_product_mappings → restaurant_menu_items
   -- Deprecar/eliminar tabla `recipes`
   ```

3. **AGREGAR FK sr_sale_id EN restaurant_orders**
   ```sql
   ALTER TABLE restaurant_orders
   ADD COLUMN sr_sale_id UUID REFERENCES sr_sales(id);
   ```

4. **AGREGAR FK tistis_product_id → restaurant_menu_items**
   ```sql
   ALTER TABLE sr_product_mappings
   ADD CONSTRAINT fk_sr_product_mappings_menu_item
   FOREIGN KEY (tistis_product_id)
   REFERENCES restaurant_menu_items(id);
   ```

5. **CREAR INTERFAZ DE MAPEO DE PRODUCTOS**
   - Settings → Integrations → Soft Restaurant → Product Mapping
   - Mostrar tabla sr_product_mappings
   - Drag-drop o search para mapear SR → Menu Items
   - Validar que menu_item tiene receta antes de permitir mapeo

### Prioridad ALTA (Implementar en FASE 2)

6. **ENDPOINT POST /api/webhook/softrestaurant**
   - Recibir JSON de SR
   - Validar IdEmpresa + webhook secret
   - Procesamiento transaccional completo
   - Rate limiting: 100 req/min

7. **ENDPOINT GET /api/webhook/softrestaurant/cancel**
   - Recibir cancelación de SR
   - Revertir inventory_movements
   - Actualizar sr_sales.status = 'cancelled'

8. **SISTEMA DE LOGS Y MONITOREO**
   - Dashboard de sr_sync_logs
   - Alertas en tiempo real
   - Métricas de integración (success rate, avg time, etc.)

### Prioridad MEDIA (Mejoras futuras)

9. **AUTO-MAPPING DE PRODUCTOS**
   - Algoritmo de similitud de nombres
   - Confidence score basado en Levenshtein distance
   - Sugerencias automáticas

10. **DASHBOARD DE INTEGRACIÓN SR**
    - Ventas recibidas hoy
    - Productos sin mapear
    - Alertas de stock generadas
    - Errores de deducción

---

## 🎯 CHECKLIST DE VALIDACIÓN

Antes de lanzar a producción:

- [ ] Tabla `ingredients` eliminada o deprecada
- [ ] Tabla `recipes` eliminada o deprecada
- [ ] `recipe_ingredients` usa solo `inventory_items`
- [ ] `sr_product_mappings` tiene FK a `restaurant_menu_items`
- [ ] `restaurant_orders` tiene campo `sr_sale_id`
- [ ] Webhook `/api/webhook/softrestaurant` implementado
- [ ] Validación de `IdEmpresa` funciona
- [ ] Deducción de inventario funciona
- [ ] Alertas de stock funcionan
- [ ] Interfaz de mapeo de productos creada
- [ ] Tests E2E completos
- [ ] Documentación de configuración lista

---

**Este análisis identifica TODOS los conflictos arquitectónicos y proporciona un plan claro de corrección antes de implementar la integración de Soft Restaurant en producción.**

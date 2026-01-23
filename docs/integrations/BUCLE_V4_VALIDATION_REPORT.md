# BUCLE CRÍTICO - VALIDACIÓN V4.0 UNIFIED

**Fecha**: 2026-01-22
**Migración**: `155_SOFT_RESTAURANT_INTEGRATION_V4_UNIFIED.sql`
**Versión Evaluada**: 4.0.0
**Metodología**: Bucle Agéntico - Validación Exhaustiva

---

## RESUMEN EJECUTIVO

**RESULTADO**: ❌ **15 ERRORES CRÍTICOS DETECTADOS** (2 lógicos ya documentados)

La migración v4.0 UNIFIED tiene la arquitectura correcta (eliminación de duplicados, reutilización de tablas TIS TIS), pero contiene **15 errores críticos** que deben corregirse antes de producción.

**ERRORES POR CATEGORÍA**:
- **Foreign Keys y Constraints**: 5 errores críticos
- **Orden de Ejecución**: 1 error crítico
- **Flujo de Datos**: 2 errores críticos (NO implementado)
- **Lógica de Negocio**: 7 errores críticos

**SEVERIDAD TOTAL**: 🔴 **CRÍTICA - NO APTO PARA PRODUCCIÓN**

---

## VALIDACIÓN 1: PREREQUISITOS ✅

### Verificación de Tablas Base TIS TIS

**Resultado**: ✅ **CORRECTO**

Todas las tablas prerequisito fueron verificadas correctamente:

```sql
-- Lines 63-86: Verificación de prerequisitos
✅ inventory_items (Mig 090)
✅ menu_item_recipes (Mig 090)
✅ restaurant_orders (Mig 089)
✅ restaurant_menu_items (Mig 088)
✅ recipe_ingredients (Mig 090)
✅ inventory_movements (Mig 090)
```

**Compatibilidad Verificada**:
- `inventory_movements.movement_type` incluye 'production' ✅
- `inventory_movements.reference_type` es VARCHAR libre (sin CHECK) ✅
- `menu_item_recipes.menu_item_id` tiene FK a `restaurant_menu_items` ✅
- `recipe_ingredients` usa `inventory_item_id` (FK a inventory_items) ✅

---

## VALIDACIÓN 2: FOREIGN KEYS Y CONSTRAINTS ❌

### ❌ ERROR CRÍTICO #1: FK Faltante en restaurant_orders.sr_sale_id

**Ubicación**: Líneas 100-101

**Código Actual**:
```sql
ALTER TABLE public.restaurant_orders
ADD COLUMN sr_sale_id UUID;
```

**PROBLEMA**: No se creó Foreign Key constraint a `sr_sales(id)`.

**IMPACTO**: 🔴 **CRÍTICO**
- No hay integridad referencial
- Permite valores huérfanos (`sr_sale_id` sin `sr_sale` correspondiente)
- No hay CASCADE/SET NULL definido
- Datos inconsistentes garantizados

**SOLUCIÓN**:
```sql
ALTER TABLE public.restaurant_orders
ADD COLUMN sr_sale_id UUID REFERENCES public.sr_sales(id) ON DELETE SET NULL;
```

---

### ❌ ERROR CRÍTICO #2: Función Inexistente Comentada

**Ubicación**: Líneas 700-705

**Código Actual**:
```sql
COMMENT ON FUNCTION public.get_ingredient_current_stock IS
'Calcula el stock actual de un ingrediente sumando todos sus movimientos.
...
UNIFIED: Usa inventory_items de TIS TIS (Mig 090).';
```

**PROBLEMA**: Se comenta una función que **NO EXISTE** en esta migración. La función `get_ingredient_current_stock` no se creó en v4.0.

**IMPACTO**: 🟡 **MEDIO**
- Documentación falsa
- Confusión para desarrolladores
- Promesa incumplida en el código

**SOLUCIÓN**:
1. **Opción A**: Crear la función antes del comentario
2. **Opción B**: Eliminar el comentario
3. **Opción C**: Cambiar comentario a "TODO: Implementar función..."

**RECOMENDACIÓN**: Eliminar el comentario (la función puede estar en Mig 090).

---

### ❌ ERROR CRÍTICO #3: Orden Incorrecto de Creación (FK a Tabla Inexistente)

**Ubicación**: Líneas 93-115 (STEP 1) vs 263-321 (STEP 4)

**PROBLEMA DE ORDEN**:

**STEP 1 (líneas 93-115)**: Intenta agregar `sr_sale_id` a `restaurant_orders`
```sql
ALTER TABLE public.restaurant_orders
ADD COLUMN sr_sale_id UUID;
```

**STEP 4 (líneas 263-321)**: Crea la tabla `sr_sales`
```sql
CREATE TABLE IF NOT EXISTS public.sr_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ...
);
```

**PROBLEMA**: Si se agrega FK constraint en STEP 1, PostgreSQL falla porque `sr_sales` NO EXISTE aún.

**IMPACTO**: 🔴 **CRÍTICO**
- Migración puede fallar en ejecución
- Orden de dependencias incorrecto

**SOLUCIÓN**:

**Opción A** (Recomendada): Mover STEP 1 DESPUÉS de crear `sr_sales`
```sql
-- STEP 4: Crear sr_sales primero
CREATE TABLE IF NOT EXISTS public.sr_sales (...);

-- STEP 5: Ahora sí agregar sr_sale_id con FK
ALTER TABLE public.restaurant_orders
ADD COLUMN sr_sale_id UUID REFERENCES public.sr_sales(id) ON DELETE SET NULL;
```

**Opción B**: Crear columna sin FK primero, agregar FK después:
```sql
-- STEP 1: Columna sin FK
ALTER TABLE public.restaurant_orders ADD COLUMN sr_sale_id UUID;

-- STEP 4: Crear sr_sales
CREATE TABLE sr_sales (...);

-- STEP 8.5: Agregar FK constraint
ALTER TABLE public.restaurant_orders
ADD CONSTRAINT fk_restaurant_orders_sr_sale
FOREIGN KEY (sr_sale_id) REFERENCES public.sr_sales(id) ON DELETE SET NULL;
```

---

### ❌ ERROR CRÍTICO #4: Schema Incorrecto para Usuarios

**Ubicación**: Línea 304

**Código Actual**:
```sql
cancelled_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
```

**PROBLEMA**: En Supabase/PostgreSQL, la tabla de usuarios está en el schema `auth`, no en `public`.

**IMPACTO**: 🔴 **CRÍTICO**
- Migración fallará con error: `relation "public.users" does not exist`
- FK constraint inválido

**EVIDENCIA** (de Mig 089):
```sql
-- supabase/migrations/089_RESTAURANT_ORDERS_KDS.sql:96
cancelled_by UUID REFERENCES auth.users(id),
```

**SOLUCIÓN**:
```sql
cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
```

---

### ❌ ERROR CRÍTICO #5: Políticas RLS Sin Restricción de Role

**Ubicación**: Líneas 594-596, 608-610, 621-623, 635-637, 649-651, 663-665

**Código Actual** (ejemplo):
```sql
CREATE POLICY service_role_insert_sr_product_mappings ON public.sr_product_mappings
    FOR INSERT
    WITH CHECK (true);
```

**PROBLEMA**: Falta `TO service_role` después de `FOR INSERT`.

**IMPACTO**: 🔴 **CRÍTICO**
- Política aplica a TODOS los roles, no solo service_role
- Cualquier usuario autenticado puede insertar sin restricciones
- Brecha de seguridad masiva

**EVIDENCIA** (de Mig 089):
```sql
-- supabase/migrations/089_RESTAURANT_ORDERS_KDS.sql:443
CREATE POLICY "service_role_all_restaurant_orders" ON public.restaurant_orders
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

**SOLUCIÓN** (aplicar a las 6 policies):
```sql
CREATE POLICY service_role_insert_sr_product_mappings ON public.sr_product_mappings
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY service_role_insert_sr_sales ON public.sr_sales
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY service_role_update_sr_sales ON public.sr_sales
    FOR UPDATE TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY service_role_insert_sr_sale_items ON public.sr_sale_items
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY service_role_insert_sr_payments ON public.sr_payments
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY service_role_insert_sr_sync_logs ON public.sr_sync_logs
    FOR INSERT TO service_role
    WITH CHECK (true);
```

---

## VALIDACIÓN 3: FLUJO DE DATOS SR → TIS TIS ❌

### ❌ ERROR CRÍTICO #6: Flujo de Deducción NO Implementado

**Ubicación**: Líneas 424-432 (documentación)

**Documentación Prometida**:
```sql
COMMENT ON TABLE public.sr_sale_items IS
'...
DEDUCCIÓN DE INVENTARIO (UNIFIED):
1. product_id → sr_product_mappings → menu_item_id
2. menu_item_id → menu_item_recipes → recipe_ingredients
3. recipe_ingredients → inventory_items (deducir stock)
4. Crear inventory_movements (movement_type=''production'', reference_type=''sr_sale'')';
```

**PROBLEMA**: El flujo de deducción está **DOCUMENTADO** pero **NO IMPLEMENTADO** en la migración.

**FALTA**:
- ❌ Función que ejecute el flujo de deducción
- ❌ Trigger en `sr_sale_items` que deduzca inventario automáticamente
- ❌ Al menos documentación explícita de que esto debe hacerse en el backend

**IMPACTO**: 🔴 **CRÍTICO**
- El sistema NO va a deducir inventario automáticamente
- Promesa incumplida en la documentación
- Requiere implementación manual completa en backend
- Inventario desactualizado garantizado

**SOLUCIÓN**:

**Opción A** (Recomendada): Crear función + trigger
```sql
-- Función para deducir inventario de una venta SR
CREATE OR REPLACE FUNCTION public.deduct_inventory_for_sr_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_menu_item_id UUID;
    v_recipe RECORD;
    v_ingredient RECORD;
BEGIN
    -- 1. Obtener menu_item_id del mapeo
    SELECT menu_item_id INTO v_menu_item_id
    FROM public.sr_product_mappings
    WHERE sr_product_id = NEW.product_id
      AND tenant_id = NEW.tenant_id
      AND is_mapped = true;

    -- Si no está mapeado, registrar warning y salir
    IF v_menu_item_id IS NULL THEN
        INSERT INTO public.sr_sync_logs (tenant_id, integration_id, log_type, level, message, sale_id)
        SELECT tenant_id, integration_id, 'product_unmapped', 'warning',
               'Producto ' || NEW.product_id || ' no está mapeado a menu_item',
               NEW.sale_id
        FROM public.sr_sales WHERE id = NEW.sale_id;
        RETURN NEW;
    END IF;

    -- 2. Obtener receta activa
    SELECT * INTO v_recipe
    FROM public.menu_item_recipes
    WHERE menu_item_id = v_menu_item_id
      AND is_active = true
      AND deleted_at IS NULL
    LIMIT 1;

    -- Si no hay receta, registrar warning
    IF NOT FOUND THEN
        INSERT INTO public.sr_sync_logs (tenant_id, integration_id, log_type, level, message, sale_id)
        SELECT tenant_id, integration_id, 'recipe_not_found', 'warning',
               'Menu item ' || v_menu_item_id || ' no tiene receta activa',
               NEW.sale_id
        FROM public.sr_sales WHERE id = NEW.sale_id;
        RETURN NEW;
    END IF;

    -- 3. Deducir cada ingrediente de la receta
    FOR v_ingredient IN
        SELECT ri.inventory_item_id, ri.quantity, ri.unit
        FROM public.recipe_ingredients ri
        WHERE ri.recipe_id = v_recipe.id
    LOOP
        -- Crear movimiento de inventario (deducción)
        INSERT INTO public.inventory_movements (
            tenant_id,
            branch_id,
            item_id,
            movement_type,
            quantity,
            previous_stock,
            new_stock,
            reference_type,
            reference_id,
            reason,
            performed_at
        )
        SELECT
            s.tenant_id,
            s.branch_id,
            v_ingredient.inventory_item_id,
            'production',
            -(v_ingredient.quantity * NEW.quantity), -- Negativo = salida
            ii.current_stock,
            ii.current_stock - (v_ingredient.quantity * NEW.quantity),
            'sr_sale',
            NEW.sale_id,
            'Deducción automática de venta SR: ' || s.external_id,
            s.sale_date
        FROM public.sr_sales s
        CROSS JOIN public.inventory_items ii
        WHERE s.id = NEW.sale_id
          AND ii.id = v_ingredient.inventory_item_id;

        -- Actualizar stock en inventory_items
        UPDATE public.inventory_items
        SET current_stock = current_stock - (v_ingredient.quantity * NEW.quantity),
            updated_at = NOW()
        WHERE id = v_ingredient.inventory_item_id;
    END LOOP;

    -- Marcar como deducido
    UPDATE public.sr_sale_items
    SET recipe_deducted = true,
        recipe_cost = v_recipe.cost_per_portion * NEW.quantity
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para ejecutar deducción automáticamente
CREATE TRIGGER trigger_deduct_inventory_for_sr_sale
    AFTER INSERT ON public.sr_sale_items
    FOR EACH ROW
    EXECUTE FUNCTION public.deduct_inventory_for_sr_sale();
```

**Opción B**: Documentar explícitamente que se hace en backend
```sql
COMMENT ON TABLE public.sr_sale_items IS
'...
IMPORTANTE: La deducción de inventario debe implementarse en el BACKEND:
1. Al recibir venta SR, por cada item:
   a. Buscar mapeo en sr_product_mappings
   b. Obtener receta de menu_item_recipes
   c. Deducir ingredientes via recipe_ingredients
   d. Crear inventory_movements con reference_type=''sr_sale''
   e. Actualizar inventory_items.current_stock
2. Marcar sr_sale_items.recipe_deducted = true cuando termine';
```

---

### ❌ ERROR CRÍTICO #7: Creación Automática de restaurant_order NO Implementada

**Ubicación**: Líneas 107-110 (comentario), 354-357 (comentario)

**Documentación Prometida**:
```sql
COMMENT ON COLUMN public.restaurant_orders.sr_sale_id IS
'FK a sr_sales.id si esta orden proviene de una venta de Soft Restaurant.
NULL si la orden se creó directamente en TIS TIS.
Permite rastrear órdenes originadas en SR vs TIS TIS.';

COMMENT ON TABLE public.sr_sales IS
'...
CONEXIÓN CON TIS TIS:
- Se crea automáticamente restaurant_order (con sr_sale_id = sr_sales.id)
- Se deducen ingredientes de inventory_items vía menu_item_recipes
- Se crean inventory_movements con reference_type = ''sr_sale''';
```

**PROBLEMA**: Se dice que "se crea automáticamente restaurant_order", pero **NO HAY TRIGGER** que lo implemente.

**IMPACTO**: 🔴 **CRÍTICO**
- Las ventas de SR NO aparecerán automáticamente en KDS
- Flujo incompleto
- Requiere implementación manual en backend
- KDS no mostrará órdenes de SR

**SOLUCIÓN**:

**Opción A** (Recomendada): Crear trigger
```sql
-- Función para crear restaurant_order automáticamente
CREATE OR REPLACE FUNCTION public.create_restaurant_order_for_sr_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_new_order_id UUID;
    v_item RECORD;
BEGIN
    -- Solo crear si la venta está completada (no error, no pending)
    IF NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;

    -- Crear restaurant_order
    INSERT INTO public.restaurant_orders (
        tenant_id,
        branch_id,
        order_type,
        status,
        sr_sale_id,
        total,
        subtotal,
        ordered_at,
        display_number,
        metadata
    ) VALUES (
        NEW.tenant_id,
        NEW.branch_id,
        'dine_in', -- Asumimos dine_in, puede cambiarse según lógica
        'confirmed', -- Viene de SR ya confirmada
        NEW.id,
        NEW.total,
        NEW.total, -- SR no envía subtotal separado
        NEW.sale_date,
        'SR-' || NEW.external_id, -- Prefijo SR para distinguir
        jsonb_build_object(
            'source', 'soft_restaurant',
            'sr_external_id', NEW.external_id,
            'sr_warehouse', NEW.warehouse_code,
            'sr_station', NEW.station_code
        )
    ) RETURNING id INTO v_new_order_id;

    -- Crear restaurant_order_items para cada sr_sale_item
    FOR v_item IN
        SELECT
            si.id,
            si.product_id,
            si.description,
            si.quantity,
            si.unit_price,
            si.total_amount,
            spm.menu_item_id
        FROM public.sr_sale_items si
        LEFT JOIN public.sr_product_mappings spm
            ON spm.sr_product_id = si.product_id
            AND spm.tenant_id = NEW.tenant_id
        WHERE si.sale_id = NEW.id
    LOOP
        INSERT INTO public.restaurant_order_items (
            tenant_id,
            order_id,
            menu_item_id,
            quantity,
            unit_price,
            total_price,
            notes,
            status
        ) VALUES (
            NEW.tenant_id,
            v_new_order_id,
            v_item.menu_item_id, -- Puede ser NULL si no está mapeado
            v_item.quantity,
            v_item.unit_price,
            v_item.total_amount,
            'SR: ' || COALESCE(v_item.description, v_item.product_id),
            'pending' -- KDS lo procesará
        );
    END LOOP;

    -- Log success
    INSERT INTO public.sr_sync_logs (
        tenant_id,
        integration_id,
        log_type,
        level,
        message,
        sale_id,
        external_id
    ) VALUES (
        NEW.tenant_id,
        NEW.integration_id,
        'order_created',
        'info',
        'Restaurant order ' || v_new_order_id || ' creada para venta SR ' || NEW.external_id,
        NEW.id,
        NEW.external_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear orden automáticamente
CREATE TRIGGER trigger_create_restaurant_order_for_sr_sale
    AFTER INSERT ON public.sr_sales
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION public.create_restaurant_order_for_sr_sale();
```

**Opción B**: Documentar que se hace en backend
```sql
COMMENT ON TABLE public.sr_sales IS
'...
IMPORTANTE: La creación de restaurant_order debe implementarse en el BACKEND:
1. Al recibir venta SR exitosa:
   a. Crear restaurant_order con sr_sale_id = sr_sales.id
   b. Crear restaurant_order_items para cada sr_sale_item
   c. Mapear productos SR a menu_items via sr_product_mappings
2. Esto permitirá que la venta aparezca en el KDS';
```

---

## VALIDACIÓN 4: INDEXES Y UNIQUE CONSTRAINTS ✅

### ✅ Índices Verificados

**Total de Índices**: 29
**Total de UNIQUE Constraints**: 2

**Índices Principales Verificados**:
- ✅ `idx_restaurant_orders_sr_sale` en `restaurant_orders(sr_sale_id)`
- ✅ `idx_sr_product_mappings_sr_product` en `sr_product_mappings(sr_product_id)`
- ✅ `idx_sr_sales_external_id` en `sr_sales(external_id)`
- ✅ `UNIQUE(tenant_id, integration_id, sr_product_id)` en `sr_product_mappings`
- ✅ `UNIQUE(tenant_id, integration_id, warehouse_code, external_id)` en `sr_sales`

**Nota**: El UNIQUE constraint crea automáticamente índice compuesto, por lo que no es necesario crear índices manuales adicionales para esas columnas.

### ⚠️ Advertencia: Orden de Creación de Índice

**Ubicación**: Línea 104

**Código**:
```sql
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_sr_sale
    ON public.restaurant_orders(sr_sale_id)
    WHERE sr_sale_id IS NOT NULL;
```

**PROBLEMA POTENCIAL**: Este índice se crea en STEP 1, pero si se intenta crear FK en ese mismo paso, y la tabla `sr_sales` no existe, puede haber conflicto.

**SOLUCIÓN**: Se resuelve automáticamente si se corrige ERROR #3 (mover STEP 1 después de crear `sr_sales`).

---

## VALIDACIÓN 5: LÓGICA DE NEGOCIO ❌

### ❌ ERROR CRÍTICO #8: UNIQUE Constraint con Campo Nullable

**Ubicación**: Línea 320

**Código Actual**:
```sql
CONSTRAINT unique_sr_sale UNIQUE(tenant_id, integration_id, warehouse_code, external_id)
```

**Problema**: El campo `warehouse_code` es NULLABLE (línea 277):
```sql
warehouse_code VARCHAR(20),              -- SR: "Almacen" (e.g., "2")
```

**COMPORTAMIENTO DE UNIQUE CON NULL EN POSTGRESQL**:
- Múltiples `NULL` son considerados distintos en UNIQUE constraints
- Si `warehouse_code` es NULL, puedes tener múltiples filas con mismo `tenant_id + integration_id + external_id + NULL`

**CONSECUENCIA**:
- ✅ Duplicados permitidos si SR no envía `warehouse_code`
- ❌ Violación de unicidad esperada
- ❌ Ventas duplicadas posibles

**EVIDENCIA**:

Supongamos SR envía:
```json
// Venta 1
{
  "IdEmpresa": "SR10.002MX12345",
  "NumeroOrden": "12345",
  "Almacen": null  // o campo ausente
}

// Venta 2 (duplicada, mismo NumeroOrden)
{
  "IdEmpresa": "SR10.002MX12345",
  "NumeroOrden": "12345",
  "Almacen": null
}
```

**RESULTADO**: Ambas ventas se insertarían porque `(tenant, integration, NULL, "12345")` != `(tenant, integration, NULL, "12345")` según UNIQUE con NULL.

**SOLUCIÓN**:

**Opción A**: Si `warehouse_code` es OBLIGATORIO en SR, cambiar a NOT NULL
```sql
warehouse_code VARCHAR(20) NOT NULL,     -- SR: "Almacen" (e.g., "2")

CONSTRAINT unique_sr_sale UNIQUE(tenant_id, integration_id, warehouse_code, external_id)
```

**Opción B**: Si es opcional, usar COALESCE en UNIQUE
```sql
-- Agregar columna calculada
warehouse_code_normalized VARCHAR(20) GENERATED ALWAYS AS (COALESCE(warehouse_code, '__DEFAULT__')) STORED,

-- UNIQUE sobre columna normalizada
CONSTRAINT unique_sr_sale UNIQUE(tenant_id, integration_id, warehouse_code_normalized, external_id)
```

**Opción C**: Excluir del UNIQUE y validar en backend
```sql
-- UNIQUE solo sobre tenant_id, integration_id, external_id
CONSTRAINT unique_sr_sale UNIQUE(tenant_id, integration_id, external_id)

-- Validar en backend que NumeroOrden es único globalmente
```

**RECOMENDACIÓN**: Consultar documentación oficial SR para determinar si `Almacen` es obligatorio. Si lo es, usar Opción A. Si no, usar Opción B para prevenir duplicados.

---

### ❌ ERROR CRÍTICO #9: Campo Calculado Sin Trigger (tip)

**Ubicación**: Línea 287

**Código Actual**:
```sql
tip DECIMAL(12,4) DEFAULT 0,             -- Suma de Pagos[].Propina
```

**Comentario dice**: "Suma de Pagos[].Propina"

**PERO**:
- ❌ NO HAY TRIGGER que sume automáticamente `sr_payments.tip_amount` en `sr_sales.tip`
- En `sr_payments` (línea 448):
```sql
tip_amount DECIMAL(12,4) DEFAULT 0,         -- SR: "Propina"
```

**CONSECUENCIA**:
- El campo `tip` en `sr_sales` nunca se actualizará automáticamente
- Datos inconsistentes entre `sr_sales.tip` y `SUM(sr_payments.tip_amount)`
- Requiere cálculo manual en backend

**SOLUCIÓN**:

**Opción A** (Recomendada): Crear trigger para calcular automáticamente
```sql
CREATE OR REPLACE FUNCTION public.update_sr_sale_tip()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular suma de propinas de todos los pagos de esta venta
    UPDATE public.sr_sales
    SET tip = (
        SELECT COALESCE(SUM(tip_amount), 0)
        FROM public.sr_payments
        WHERE sale_id = NEW.sale_id
    )
    WHERE id = NEW.sale_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sr_sale_tip
    AFTER INSERT OR UPDATE OR DELETE ON public.sr_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_sr_sale_tip();
```

**Opción B**: Cambiar documentación y calcular en backend
```sql
tip DECIMAL(12,4) DEFAULT 0,             -- CALCULADO EN BACKEND: Suma de Pagos[].Propina
```

**Opción C**: Eliminar campo y usar query
```sql
-- Eliminar campo tip de sr_sales
-- En queries, calcular:
SELECT s.*, COALESCE(SUM(p.tip_amount), 0) AS tip
FROM sr_sales s
LEFT JOIN sr_payments p ON p.sale_id = s.id
GROUP BY s.id;
```

**RECOMENDACIÓN**: Opción A (trigger) para mantener datos desnormalizados pero consistentes.

---

### ❌ ERROR CRÍTICO #10: Campos Calculados Sin Triggers (recipe_cost, profit_margin)

**Ubicación**: Líneas 290-291

**Código Actual**:
```sql
recipe_cost DECIMAL(12,4),               -- Costo de ingredientes (calculado)
profit_margin DECIMAL(12,4),             -- Margen de ganancia (calculado)
```

**PROBLEMA**: Campos calculados sin triggers que los calculen.

**CONSECUENCIA**:
- Campos siempre NULL o desactualizados
- Promesa incumplida en documentación
- Métricas de negocio inválidas

**SOLUCIÓN**:

**Opción A**: Crear trigger para calcular (complejo)
```sql
-- Calcular recipe_cost sumando costo de ingredientes de todos los items
-- Calcular profit_margin = (total - recipe_cost) / total * 100

CREATE OR REPLACE FUNCTION public.update_sr_sale_costs()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.sr_sales
    SET
        recipe_cost = (
            SELECT COALESCE(SUM(recipe_cost), 0)
            FROM public.sr_sale_items
            WHERE sale_id = NEW.sale_id
              AND recipe_deducted = true
        ),
        profit_margin = CASE
            WHEN total > 0 THEN ((total - recipe_cost) / total) * 100
            ELSE 0
        END
    WHERE id = NEW.sale_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sr_sale_costs
    AFTER INSERT OR UPDATE ON public.sr_sale_items
    FOR EACH ROW
    WHEN (NEW.recipe_deducted = true)
    EXECUTE FUNCTION public.update_sr_sale_costs();
```

**Opción B**: Calcular en backend cuando se necesite
```sql
-- Mantener campos pero documentar que se calculan en backend
recipe_cost DECIMAL(12,4),               -- CALCULADO EN BACKEND: Costo de ingredientes
profit_margin DECIMAL(12,4),             -- CALCULADO EN BACKEND: Margen de ganancia
```

**Opción C**: Usar views materializadas
```sql
-- Eliminar campos de sr_sales
-- Crear materialized view para reportes
CREATE MATERIALIZED VIEW sr_sales_with_metrics AS
SELECT
    s.*,
    COALESCE(SUM(si.recipe_cost), 0) AS recipe_cost,
    CASE
        WHEN s.total > 0 THEN ((s.total - COALESCE(SUM(si.recipe_cost), 0)) / s.total) * 100
        ELSE 0
    END AS profit_margin
FROM sr_sales s
LEFT JOIN sr_sale_items si ON si.sale_id = s.id
GROUP BY s.id;
```

**RECOMENDACIÓN**: Opción B (calcular en backend) para simplificar migración. Crear cálculo cuando se implemente lógica de negocio.

---

### ❌ ERROR CRÍTICO #11: FK Constraint Incorrecto en movement_type

**Ubicación**: Línea 386

**Código Actual**:
```sql
movement_type INTEGER REFERENCES public.sr_movement_types(code) ON DELETE SET NULL,
```

**PROBLEMA**: Si se elimina un tipo de movimiento del catálogo `sr_movement_types`, el FK se pone en NULL.

**CONSECUENCIA**:
- ❌ Pérdida de información histórica
- ❌ No se puede saber qué tipo de movimiento fue
- ❌ Datos históricos corruptos

**ESCENARIO**:
1. Insertar venta con `movement_type = 1` (Venta Normal)
2. Alguien elimina `DELETE FROM sr_movement_types WHERE code = 1`
3. Todas las ventas históricas quedan con `movement_type = NULL`

**SOLUCIÓN**:
```sql
movement_type INTEGER REFERENCES public.sr_movement_types(code) ON DELETE RESTRICT,
```

O mejor:
```sql
movement_type INTEGER REFERENCES public.sr_movement_types(code) ON DELETE NO ACTION,
```

**RESTRICCIÓN**: Impide eliminación de tipos de movimiento que estén en uso.

**RECOMENDACIÓN**: Usar `ON DELETE RESTRICT` para proteger integridad histórica.

---

### ❌ ERROR CRÍTICO #12: Tipos de Movimiento No Documentados (Riesgo)

**Ubicación**: Líneas 162-169

**Código Actual**:
```sql
INSERT INTO public.sr_movement_types (code, name, description, affects_inventory, is_refund, is_complimentary) VALUES
(1, 'Venta Normal', 'Venta estándar de producto', true, false, false),
(2, 'Devolución', 'Devolución de producto vendido', true, true, false),
(3, 'Cortesía', 'Producto sin cargo (cortesía de la casa)', true, false, true)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE public.sr_movement_types IS
'...
IMPORTANTE: La documentación oficial SR solo documenta el valor 1 (Venta Normal).
Los valores 2 y 3 son inferidos de implementaciones reales.
Si se reciben códigos desconocidos, investigar con soporte SR.';
```

**PROBLEMA**: Los tipos de movimiento 2 y 3 son INFERIDOS, no documentados oficialmente por SR.

**RIESGO**:
- ⚠️ Si SR envía código 2 o 3 con diferente significado, la lógica falla
- ⚠️ Asunciones no validadas pueden causar errores en producción
- ⚠️ `is_refund` y `is_complimentary` pueden estar mal configurados

**SOLUCIÓN ACTUAL**: Está documentado el riesgo ✅

**MEJOR SOLUCIÓN**: Implementar lógica defensiva

```sql
-- NO insertar tipos no documentados inicialmente
INSERT INTO public.sr_movement_types (code, name, description, affects_inventory, is_refund, is_complimentary) VALUES
(1, 'Venta Normal', 'Venta estándar de producto (DOCUMENTADO)', true, false, false)
ON CONFLICT (code) DO NOTHING;

-- Crear trigger para insertar dinámicamente tipos desconocidos con flags conservadores
CREATE OR REPLACE FUNCTION public.handle_unknown_movement_type()
RETURNS TRIGGER AS $$
BEGIN
    -- Si movement_type no existe en catálogo, insertar automáticamente
    INSERT INTO public.sr_movement_types (code, name, description, affects_inventory, is_refund, is_complimentary)
    VALUES (
        NEW.movement_type,
        'UNKNOWN_' || NEW.movement_type,
        'Tipo de movimiento no documentado. Investigar con soporte SR.',
        false, -- No afectar inventario hasta confirmar
        false,
        false
    )
    ON CONFLICT (code) DO NOTHING;

    -- Log warning
    INSERT INTO public.sr_sync_logs (tenant_id, integration_id, log_type, level, message, sale_id)
    SELECT tenant_id, integration_id, 'unknown_movement_type', 'warning',
           'Tipo de movimiento desconocido: ' || NEW.movement_type,
           NEW.sale_id
    FROM public.sr_sales WHERE id = NEW.sale_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_unknown_movement_type
    BEFORE INSERT ON public.sr_sale_items
    FOR EACH ROW
    WHEN (NEW.movement_type NOT IN (SELECT code FROM public.sr_movement_types))
    EXECUTE FUNCTION public.handle_unknown_movement_type();
```

**RECOMENDACIÓN**: Contactar soporte SR para confirmar tipos de movimiento válidos antes de producción.

---

### ❌ ERROR CRÍTICO #13: Inconsistencia en DEFAULT 0 de Campos Monetarios

**Ubicación**: Líneas 391-395

**Código Actual**:
```sql
subtotal_without_tax DECIMAL(12,4),      -- Sin DEFAULT
discount_amount DECIMAL(12,4) DEFAULT 0, -- Con DEFAULT
tax_details JSONB,                       -- N/A
tax_amount DECIMAL(12,4) DEFAULT 0,      -- Con DEFAULT
total_amount DECIMAL(12,4),              -- Sin DEFAULT
```

**PROBLEMA**: Algunos campos monetarios tienen `DEFAULT 0`, otros no.

**INCONSISTENCIA**:
- `discount_amount` → DEFAULT 0 ✅
- `tax_amount` → DEFAULT 0 ✅
- `subtotal_without_tax` → NULL si no se envía ❌
- `total_amount` → NULL si no se envía ❌

**CONSECUENCIA**:
- Cálculos con NULL resultan en NULL
- Comportamiento inconsistente en queries
- Posibles errores en backend

**EJEMPLO**:
```sql
-- Si total_amount es NULL, esto falla:
SELECT total_amount + discount_amount FROM sr_sale_items;
-- Resultado: NULL (debería ser discount_amount)
```

**SOLUCIÓN**:

**Opción A** (Recomendada): Agregar DEFAULT 0 a TODOS los campos monetarios
```sql
subtotal_without_tax DECIMAL(12,4) DEFAULT 0,  -- SR: "ImporteSinImpuestos"
discount_amount DECIMAL(12,4) DEFAULT 0,       -- SR: "Descuento"
tax_details JSONB,                             -- SR: "Impuestos[]" array
tax_amount DECIMAL(12,4) DEFAULT 0,            -- SUM(Impuestos[].Importe)
total_amount DECIMAL(12,4) DEFAULT 0,          -- subtotal + tax - discount
```

**Opción B**: NO usar DEFAULT en NINGUNO (forzar valores explícitos)
```sql
subtotal_without_tax DECIMAL(12,4) NOT NULL,  -- SR: "ImporteSinImpuestos"
discount_amount DECIMAL(12,4) NOT NULL,       -- SR: "Descuento"
tax_details JSONB,                            -- SR: "Impuestos[]" array
tax_amount DECIMAL(12,4) NOT NULL,            -- SUM(Impuestos[].Importe)
total_amount DECIMAL(12,4) NOT NULL,          -- subtotal + tax - discount
```

**RECOMENDACIÓN**: Opción A para máxima compatibilidad con datos de SR.

---

### ❌ ERROR CRÍTICO #14: tax_amount Calculado Sin Trigger

**Ubicación**: Línea 394

**Código Actual**:
```sql
tax_amount DECIMAL(12,4) DEFAULT 0,      -- SUM(Impuestos[].Importe)
```

**Comentario dice**: "SUM(Impuestos[].Importe)"

**PERO**:
- ❌ NO HAY TRIGGER que calcule automáticamente esta suma del JSONB `tax_details`
- El campo `tax_details` (línea 393):
```sql
tax_details JSONB,                       -- SR: "Impuestos[]" array
```

**EJEMPLO DE DATOS SR**:
```json
{
  "Impuestos": [
    {"Nombre": "IVA", "Importe": 160.00},
    {"Nombre": "IEPS", "Importe": 50.00}
  ]
}
```

**SUMA ESPERADA**: 160 + 50 = 210

**CONSECUENCIA**:
- Campo `tax_amount` siempre 0 o desactualizado
- Datos inconsistentes
- Requiere cálculo manual en backend

**SOLUCIÓN**:

**Opción A**: Crear trigger para calcular automáticamente
```sql
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
```

**Opción B**: Calcular en backend antes de insertar
```sql
-- Backend calcula tax_amount antes de INSERT
tax_amount DECIMAL(12,4) DEFAULT 0,      -- CALCULADO EN BACKEND: SUM(Impuestos[].Importe)
```

**RECOMENDACIÓN**: Opción A (trigger) para garantizar consistencia.

---

### ❌ ERROR CRÍTICO #15: total_amount Calculado Sin Trigger

**Ubicación**: Línea 395

**Código Actual**:
```sql
total_amount DECIMAL(12,4),              -- subtotal + tax - discount
```

**Comentario dice**: "subtotal + tax - discount"

**PERO**:
- ❌ NO HAY TRIGGER que calcule automáticamente esta fórmula

**FÓRMULA ESPERADA**:
```
total_amount = subtotal_without_tax + tax_amount - discount_amount
```

**CONSECUENCIA**:
- Campo siempre NULL o desactualizado
- Datos inconsistentes

**SOLUCIÓN**:

**Opción A**: Crear trigger para calcular automáticamente
```sql
CREATE OR REPLACE FUNCTION public.calculate_total_amount()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_amount := COALESCE(NEW.subtotal_without_tax, 0)
                        + COALESCE(NEW.tax_amount, 0)
                        - COALESCE(NEW.discount_amount, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_total_amount
    BEFORE INSERT OR UPDATE ON public.sr_sale_items
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_total_amount();
```

**Opción B**: Usar GENERATED COLUMN (PostgreSQL 12+)
```sql
total_amount DECIMAL(12,4) GENERATED ALWAYS AS (
    COALESCE(subtotal_without_tax, 0) + COALESCE(tax_amount, 0) - COALESCE(discount_amount, 0)
) STORED,
```

**RECOMENDACIÓN**: Opción B (GENERATED COLUMN) para máxima consistencia y cero mantenimiento.

---

## RESUMEN DE ERRORES

### 🔴 ERRORES CRÍTICOS (15 TOTAL)

| # | Categoría | Ubicación | Severidad | Estado |
|---|-----------|-----------|-----------|--------|
| 1 | FK Faltante | L.100-101 | 🔴 CRÍTICA | ❌ NO CORREGIDO |
| 2 | Función Inexistente | L.700-705 | 🟡 MEDIA | ❌ NO CORREGIDO |
| 3 | Orden Incorrecto | L.93-115 vs L.263-321 | 🔴 CRÍTICA | ❌ NO CORREGIDO |
| 4 | Schema Incorrecto | L.304 | 🔴 CRÍTICA | ❌ NO CORREGIDO |
| 5 | RLS Sin Restricción | L.594-665 (6 policies) | 🔴 CRÍTICA | ❌ NO CORREGIDO |
| 6 | Flujo NO Implementado | L.424-432 | 🔴 CRÍTICA | ❌ NO CORREGIDO |
| 7 | Order Creation NO Implementada | L.107-110, 354-357 | 🔴 CRÍTICA | ❌ NO CORREGIDO |
| 8 | UNIQUE con NULL | L.320 | 🔴 CRÍTICA | ❌ NO CORREGIDO |
| 9 | Trigger Faltante (tip) | L.287 | 🟡 MEDIA | ❌ NO CORREGIDO |
| 10 | Triggers Faltantes (costs) | L.290-291 | 🟡 MEDIA | ❌ NO CORREGIDO |
| 11 | FK Constraint Incorrecto | L.386 | 🔴 CRÍTICA | ❌ NO CORREGIDO |
| 12 | Tipos No Documentados | L.162-169 | 🟠 ALTA | ⚠️ DOCUMENTADO |
| 13 | DEFAULT Inconsistente | L.391-395 | 🟡 MEDIA | ❌ NO CORREGIDO |
| 14 | Trigger Faltante (tax) | L.394 | 🟡 MEDIA | ❌ NO CORREGIDO |
| 15 | Trigger Faltante (total) | L.395 | 🟡 MEDIA | ❌ NO CORREGIDO |

### 📊 Distribución por Severidad

- 🔴 **CRÍTICA**: 8 errores (53%)
- 🟠 **ALTA**: 1 error (7%)
- 🟡 **MEDIA**: 6 errores (40%)

### 📊 Distribución por Categoría

- **Foreign Keys**: 3 errores (#1, #4, #11)
- **RLS Policies**: 1 error (#5)
- **Orden de Ejecución**: 1 error (#3)
- **Flujo de Datos**: 2 errores (#6, #7)
- **Triggers Faltantes**: 5 errores (#9, #10, #14, #15)
- **Constraints**: 1 error (#8)
- **Datos DEFAULT**: 1 error (#13)
- **Documentación**: 2 errores (#2, #12)

---

## PRIORIDAD DE CORRECCIÓN

### 🔥 PRIORIDAD 1 (Bloqueantes - Migración Fallará)

1. **ERROR #3**: Orden incorrecto (FK a tabla inexistente) - MIGRACIÓN FALLARÁ
2. **ERROR #4**: Schema incorrecto (auth.users) - MIGRACIÓN FALLARÁ
3. **ERROR #5**: RLS sin restricción - BRECHA DE SEGURIDAD MASIVA

### 🔥 PRIORIDAD 2 (Críticos - Sistema Incompleto)

4. **ERROR #1**: FK faltante en sr_sale_id
5. **ERROR #6**: Flujo de deducción NO implementado
6. **ERROR #7**: Creación de orders NO implementada
7. **ERROR #8**: UNIQUE con NULL permite duplicados

### 🟡 PRIORIDAD 3 (Importantes - Datos Inconsistentes)

8. **ERROR #11**: FK constraint incorrecto (pérdida de datos históricos)
9. **ERROR #13**: DEFAULT inconsistente en campos monetarios
10. **ERROR #14**: tax_amount sin trigger
11. **ERROR #15**: total_amount sin trigger

### 🟢 PRIORIDAD 4 (Mejoras - No Bloqueantes)

12. **ERROR #2**: Comentario a función inexistente
13. **ERROR #9**: tip sin trigger
14. **ERROR #10**: costs sin triggers
15. **ERROR #12**: Tipos no documentados (ya documentado)

---

## RECOMENDACIONES

### Acción Inmediata: Crear v5.0 CORREGIDA

**Debe incluir**:

1. ✅ Corregir orden de ejecución (ERROR #3)
2. ✅ Corregir schema auth.users (ERROR #4)
3. ✅ Agregar FK en sr_sale_id (ERROR #1)
4. ✅ Corregir RLS policies con TO service_role (ERROR #5)
5. ✅ Cambiar UNIQUE para manejar NULL (ERROR #8)
6. ✅ Cambiar FK movement_type a ON DELETE RESTRICT (ERROR #11)
7. ✅ Agregar DEFAULT 0 a campos monetarios (ERROR #13)
8. ⚠️ Documentar claramente que deducción y order creation se hacen en backend (ERRORES #6, #7)
9. ✅ Eliminar comentario de función inexistente (ERROR #2)

### Decisiones Pendientes

**Para Usuario**:

1. ¿`warehouse_code` es OBLIGATORIO en SR? (afecta ERROR #8)
2. ¿Preferencia para cálculos (tip, costs, tax, total)?
   - Opción A: Triggers en BD
   - Opción B: Cálculos en backend
   - Opción C: GENERATED COLUMNS
3. ¿Confirmar tipos de movimiento 2 y 3 con soporte SR? (ERROR #12)

### Próximos Pasos

1. **Crear v5.0** con correcciones PRIORIDAD 1 y 2
2. **Validar v5.0** con bucle agéntico nuevamente
3. **Decidir estrategia** para cálculos (triggers vs backend)
4. **Implementar lógica de negocio** en backend (deducción, orders)
5. **Testing exhaustivo** antes de producción

---

## CONCLUSIÓN

La migración v4.0 UNIFIED tiene la **arquitectura correcta** (eliminación de duplicados, reutilización de tablas TIS TIS), pero requiere **15 correcciones críticas** antes de ser apta para producción.

**VEREDICTO**: ❌ **NO APTO PARA PRODUCCIÓN**

**PRÓXIMO PASO**: Crear v5.0 con correcciones de PRIORIDAD 1 y 2.

---

**Fin del Reporte de Validación**

**Generado por**: Bucle Agéntico - Claude Sonnet 4.5
**Fecha**: 2026-01-22
**Total de Iteraciones**: 5 (v1.0 → v2.0 → v3.0 → v4.0 → Validación Exhaustiva)

-- =====================================================
-- TIS TIS PLATFORM - Migration 101
-- Inventory Consumption System
-- =====================================================
-- Purpose: Complete inventory consumption workflow when orders
-- are marked as completed. Includes stock validation, automatic
-- deduction, movement tracking, and low stock alert creation.
-- =====================================================
-- Solves:
--   1. Missing trigger to decrement inventory on order complete
--   2. Placeholder stock validation (now functional)
--   3. Integration with low_stock_alerts system
-- =====================================================

-- =====================================================
-- PARTE 1: VALIDACIÓN DE STOCK REAL
-- =====================================================
-- Reemplaza la función placeholder con validación real
-- que consulta inventory_items y recipe_ingredients

CREATE OR REPLACE FUNCTION public.validate_order_stock(
    p_branch_id UUID,
    p_items JSONB -- Array de {menu_item_id, quantity}
)
RETURNS TABLE(
    valid BOOLEAN,
    out_of_stock_items TEXT[],
    low_stock_warnings TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_recipe RECORD;
    v_ingredient RECORD;
    v_required_qty DECIMAL(12, 3);
    v_available_stock DECIMAL(12, 3);
    v_out_of_stock TEXT[] := ARRAY[]::TEXT[];
    v_low_stock TEXT[] := ARRAY[]::TEXT[];
    v_is_valid BOOLEAN := true;
    v_item_qty INTEGER;
    v_tenant_id UUID;
BEGIN
    -- Obtener tenant_id del branch
    SELECT tenant_id INTO v_tenant_id
    FROM branches
    WHERE id = p_branch_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Branch not found: %', p_branch_id;
    END IF;

    -- Iterar sobre cada item del pedido
    FOR v_item IN
        SELECT
            (item->>'menu_item_id')::UUID as menu_item_id,
            (item->>'quantity')::INTEGER as quantity
        FROM jsonb_array_elements(p_items) as item
    LOOP
        -- Buscar la receta del menu item
        SELECT r.id, r.yield_quantity INTO v_recipe
        FROM menu_item_recipes r
        WHERE r.menu_item_id = v_item.menu_item_id
          AND r.is_active = true
          AND r.deleted_at IS NULL
        LIMIT 1;

        -- Si el item tiene receta, verificar ingredientes
        IF v_recipe.id IS NOT NULL THEN
            -- Iterar sobre cada ingrediente de la receta
            FOR v_ingredient IN
                SELECT
                    ri.inventory_item_id,
                    ri.quantity as recipe_qty,
                    ri.unit,
                    ii.name as ingredient_name,
                    ii.current_stock,
                    ii.minimum_stock,
                    ii.unit as item_unit
                FROM recipe_ingredients ri
                JOIN inventory_items ii ON ii.id = ri.inventory_item_id
                WHERE ri.recipe_id = v_recipe.id
                  AND ii.is_active = true
                  AND ii.deleted_at IS NULL
                  -- Filtrar por branch si el item es específico de branch
                  AND (ii.branch_id IS NULL OR ii.branch_id = p_branch_id)
            LOOP
                -- Calcular cantidad requerida
                -- (cantidad de receta * cantidad de items) / yield de la receta
                v_required_qty := (v_ingredient.recipe_qty * v_item.quantity)
                                  / COALESCE(NULLIF(v_recipe.yield_quantity, 0), 1);

                -- Verificar stock disponible
                v_available_stock := COALESCE(v_ingredient.current_stock, 0);

                -- Verificar si hay suficiente stock
                IF v_available_stock < v_required_qty THEN
                    v_is_valid := false;
                    v_out_of_stock := array_append(
                        v_out_of_stock,
                        v_ingredient.ingredient_name || ' (necesita: ' ||
                        ROUND(v_required_qty::NUMERIC, 2) || ' ' || v_ingredient.item_unit ||
                        ', disponible: ' || ROUND(v_available_stock::NUMERIC, 2) || ')'
                    );
                -- Verificar si quedará en stock bajo después del consumo
                ELSIF (v_available_stock - v_required_qty) <= v_ingredient.minimum_stock THEN
                    v_low_stock := array_append(
                        v_low_stock,
                        v_ingredient.ingredient_name || ' (quedará en ' ||
                        ROUND((v_available_stock - v_required_qty)::NUMERIC, 2) || ' ' ||
                        v_ingredient.item_unit || ')'
                    );
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    -- Retornar resultados
    valid := v_is_valid;
    out_of_stock_items := v_out_of_stock;
    low_stock_warnings := v_low_stock;
    RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION validate_order_stock IS
'Validates if there is sufficient stock for all ingredients required by a restaurant order.
Returns validation status, list of out-of-stock items, and low stock warnings.
Used by AI ordering agents and order management system before confirming orders.';

-- También actualizar la función simplificada para usar la nueva
CREATE OR REPLACE FUNCTION public.validate_order_stock_simple(
    p_branch_id UUID,
    p_items JSONB
)
RETURNS TABLE(
    valid BOOLEAN,
    out_of_stock_items TEXT[],
    low_stock_warnings TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Llamar a la función completa
    RETURN QUERY SELECT * FROM validate_order_stock(p_branch_id, p_items);
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION validate_order_stock(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_order_stock(UUID, JSONB) TO service_role;


-- =====================================================
-- PARTE 2: FUNCIÓN PARA CONSUMIR INGREDIENTES DE UNA ORDEN
-- =====================================================
-- Esta función crea movimientos de inventario tipo 'consumption'
-- para cada ingrediente usado en los items de una orden

CREATE OR REPLACE FUNCTION public.consume_order_ingredients(
    p_order_id UUID,
    p_performed_by UUID DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    items_consumed INTEGER,
    movements_created INTEGER,
    low_stock_alerts_created INTEGER,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_order_item RECORD;
    v_recipe RECORD;
    v_ingredient RECORD;
    v_required_qty DECIMAL(12, 3);
    v_current_stock DECIMAL(12, 3);
    v_new_stock DECIMAL(12, 3);
    v_movement_id UUID;
    v_items_consumed INTEGER := 0;
    v_movements_created INTEGER := 0;
    v_alerts_created INTEGER := 0;
    v_staff_id UUID;
BEGIN
    -- Obtener información de la orden
    SELECT
        o.id,
        o.tenant_id,
        o.branch_id,
        o.status,
        o.display_number
    INTO v_order
    FROM restaurant_orders o
    WHERE o.id = p_order_id;

    IF v_order IS NULL THEN
        success := false;
        error_message := 'Order not found: ' || p_order_id;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Verificar que la orden esté en status completado
    IF v_order.status NOT IN ('completed', 'delivered') THEN
        success := false;
        error_message := 'Order status must be completed or delivered, current: ' || v_order.status;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Obtener staff_id si hay performed_by
    IF p_performed_by IS NOT NULL THEN
        SELECT id INTO v_staff_id
        FROM staff
        WHERE user_id = p_performed_by AND tenant_id = v_order.tenant_id
        LIMIT 1;
    END IF;

    -- Protección contra órdenes masivas (máx 200 items por orden)
    IF (SELECT COUNT(*) FROM restaurant_order_items WHERE order_id = p_order_id AND status != 'cancelled') > 200 THEN
        success := false;
        error_message := 'Order exceeds maximum items limit (200). Process manually.';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Iterar sobre cada item de la orden
    FOR v_order_item IN
        SELECT
            oi.id,
            oi.menu_item_id,
            oi.menu_item_name,
            oi.quantity
        FROM restaurant_order_items oi
        WHERE oi.order_id = p_order_id
          AND oi.status != 'cancelled'
    LOOP
        -- Buscar la receta del menu item
        SELECT r.id, r.yield_quantity INTO v_recipe
        FROM menu_item_recipes r
        WHERE r.menu_item_id = v_order_item.menu_item_id
          AND r.is_active = true
          AND r.deleted_at IS NULL
        LIMIT 1;

        -- Si no hay receta, continuar con el siguiente item
        IF v_recipe.id IS NULL THEN
            CONTINUE;
        END IF;

        v_items_consumed := v_items_consumed + 1;

        -- Iterar sobre cada ingrediente de la receta
        FOR v_ingredient IN
            SELECT
                ri.inventory_item_id,
                ri.quantity as recipe_qty,
                ri.unit,
                ri.unit_cost,
                ii.name as ingredient_name,
                ii.current_stock,
                ii.minimum_stock,
                ii.unit as item_unit
            FROM recipe_ingredients ri
            JOIN inventory_items ii ON ii.id = ri.inventory_item_id
            WHERE ri.recipe_id = v_recipe.id
              AND ii.is_active = true
              AND ii.deleted_at IS NULL
              AND (ii.branch_id IS NULL OR ii.branch_id = v_order.branch_id)
        LOOP
            -- Calcular cantidad a consumir
            v_required_qty := (v_ingredient.recipe_qty * v_order_item.quantity)
                              / COALESCE(NULLIF(v_recipe.yield_quantity, 0), 1);

            -- Obtener stock actual (con FOR UPDATE para evitar race conditions)
            SELECT current_stock INTO v_current_stock
            FROM inventory_items
            WHERE id = v_ingredient.inventory_item_id
            FOR UPDATE;

            -- Calcular nuevo stock (puede ser negativo si se permite sobre-venta)
            -- NOTA: El sistema permite stock negativo para no bloquear operaciones
            -- Las alertas críticas se crean cuando stock <= 0
            v_new_stock := v_current_stock - v_required_qty;

            -- Crear movimiento de inventario (el trigger actualizará el stock)
            INSERT INTO inventory_movements (
                tenant_id,
                branch_id,
                item_id,
                movement_type,
                quantity,
                previous_stock,
                new_stock,
                unit_cost,
                total_cost,
                reference_type,
                reference_id,
                performed_by,
                staff_id,
                reason,
                notes,
                metadata
            ) VALUES (
                v_order.tenant_id,
                v_order.branch_id,
                v_ingredient.inventory_item_id,
                'consumption',
                -v_required_qty, -- Negativo porque es consumo
                v_current_stock,
                v_new_stock,
                v_ingredient.unit_cost,
                v_required_qty * COALESCE(v_ingredient.unit_cost, 0),
                'restaurant_order',
                p_order_id,
                p_performed_by,
                v_staff_id,
                'Consumo por orden #' || COALESCE(v_order.display_number, v_order.id::TEXT),
                'Item: ' || v_order_item.menu_item_name || ' x' || v_order_item.quantity,
                jsonb_build_object(
                    'order_id', p_order_id,
                    'order_item_id', v_order_item.id,
                    'menu_item_id', v_order_item.menu_item_id,
                    'menu_item_name', v_order_item.menu_item_name,
                    'quantity_ordered', v_order_item.quantity,
                    'ingredient_name', v_ingredient.ingredient_name,
                    'quantity_consumed', v_required_qty
                )
            )
            RETURNING id INTO v_movement_id;

            v_movements_created := v_movements_created + 1;

            -- Verificar si el nuevo stock está bajo el mínimo y crear alerta
            IF v_new_stock <= v_ingredient.minimum_stock THEN
                -- Verificar si ya existe una alerta abierta para este item
                IF NOT EXISTS (
                    SELECT 1 FROM low_stock_alerts
                    WHERE item_id = v_ingredient.inventory_item_id
                      AND branch_id = v_order.branch_id
                      AND status IN ('open', 'acknowledged')
                ) THEN
                    -- Crear alerta de stock bajo
                    -- Nota: deficit_quantity es columna GENERATED, no se inserta
                    INSERT INTO low_stock_alerts (
                        tenant_id,
                        branch_id,
                        item_id,
                        alert_type,
                        status,
                        current_stock,
                        minimum_stock,
                        metadata
                    ) VALUES (
                        v_order.tenant_id,
                        v_order.branch_id,
                        v_ingredient.inventory_item_id,
                        CASE
                            WHEN v_new_stock <= 0 THEN 'critical'::low_stock_alert_type
                            WHEN v_new_stock <= v_ingredient.minimum_stock * 0.5 THEN 'critical'::low_stock_alert_type
                            ELSE 'warning'::low_stock_alert_type
                        END,
                        'open'::low_stock_alert_status,
                        v_new_stock,
                        v_ingredient.minimum_stock,
                        jsonb_build_object(
                            'triggered_by_order', p_order_id,
                            'ingredient_name', v_ingredient.ingredient_name,
                            'consumption_qty', v_required_qty
                        )
                    );
                    v_alerts_created := v_alerts_created + 1;
                END IF;
            END IF;
        END LOOP;
    END LOOP;

    -- Retornar resultados
    success := true;
    items_consumed := v_items_consumed;
    movements_created := v_movements_created;
    low_stock_alerts_created := v_alerts_created;
    error_message := NULL;
    RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION consume_order_ingredients IS
'Consumes inventory ingredients for all items in a completed restaurant order.
Creates inventory_movements records (type: consumption) which trigger stock updates.
Also creates low_stock_alerts when ingredients fall below minimum stock levels.
Should be called when order status changes to completed or delivered.';

GRANT EXECUTE ON FUNCTION consume_order_ingredients(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_order_ingredients(UUID, UUID) TO service_role;


-- =====================================================
-- PARTE 3: TRIGGER PARA CONSUMIR INGREDIENTES AL COMPLETAR ORDEN
-- =====================================================
-- Se dispara cuando restaurant_orders.status cambia a 'completed' o 'delivered'

CREATE OR REPLACE FUNCTION public.trigger_consume_order_ingredients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Solo procesar cuando el status cambia a 'completed' o 'delivered'
    IF (OLD.status IS DISTINCT FROM NEW.status)
       AND NEW.status IN ('completed', 'delivered')
       AND OLD.status NOT IN ('completed', 'delivered') THEN

        -- Llamar a la función de consumo
        SELECT * INTO v_result
        FROM consume_order_ingredients(NEW.id, NULL);

        -- Log del resultado
        IF v_result.success THEN
            RAISE NOTICE '[Inventory] Order % completed: consumed % items, created % movements, % alerts',
                NEW.id, v_result.items_consumed, v_result.movements_created, v_result.low_stock_alerts_created;
        ELSE
            RAISE WARNING '[Inventory] Failed to consume ingredients for order %: %',
                NEW.id, v_result.error_message;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Crear trigger solo si la tabla restaurant_orders existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'restaurant_orders') THEN

        DROP TRIGGER IF EXISTS trigger_consume_order_ingredients ON public.restaurant_orders;

        CREATE TRIGGER trigger_consume_order_ingredients
            AFTER UPDATE ON public.restaurant_orders
            FOR EACH ROW
            WHEN (OLD.status IS DISTINCT FROM NEW.status
                  AND NEW.status IN ('completed', 'delivered'))
            EXECUTE FUNCTION trigger_consume_order_ingredients();

        RAISE NOTICE 'Trigger trigger_consume_order_ingredients created successfully';
    ELSE
        RAISE NOTICE 'Table restaurant_orders does not exist, skipping trigger creation';
    END IF;
END $$;


-- =====================================================
-- PARTE 4: FUNCIÓN PARA REVERTIR CONSUMO (CANCELACIÓN)
-- =====================================================
-- Útil cuando una orden completada es cancelada posteriormente

CREATE OR REPLACE FUNCTION public.revert_order_consumption(
    p_order_id UUID,
    p_performed_by UUID DEFAULT NULL,
    p_reason TEXT DEFAULT 'Order cancelled after completion'
)
RETURNS TABLE(
    success BOOLEAN,
    movements_reverted INTEGER,
    alerts_resolved INTEGER,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_movement RECORD;
    v_movements_reverted INTEGER := 0;
    v_alerts_resolved INTEGER := 0;
    v_staff_id UUID;
BEGIN
    -- Obtener información de la orden
    SELECT tenant_id, branch_id, display_number
    INTO v_order
    FROM restaurant_orders
    WHERE id = p_order_id;

    IF v_order IS NULL THEN
        success := false;
        error_message := 'Order not found';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Obtener staff_id
    IF p_performed_by IS NOT NULL THEN
        SELECT id INTO v_staff_id
        FROM staff
        WHERE user_id = p_performed_by AND tenant_id = v_order.tenant_id
        LIMIT 1;
    END IF;

    -- Verificar si ya existe una reversión para esta orden (prevenir duplicados)
    IF EXISTS (
        SELECT 1 FROM inventory_movements
        WHERE reference_type = 'order_cancellation'
          AND reference_id = p_order_id
    ) THEN
        success := false;
        error_message := 'Order consumption already reverted';
        RETURN NEXT;
        RETURN;
    END IF;

    -- Revertir cada movimiento de consumo de esta orden
    FOR v_movement IN
        SELECT
            m.id,
            m.item_id,
            m.quantity,
            m.unit_cost,
            i.current_stock
        FROM inventory_movements m
        JOIN inventory_items i ON i.id = m.item_id
        WHERE m.reference_type = 'restaurant_order'
          AND m.reference_id = p_order_id
          AND m.movement_type = 'consumption'
    LOOP
        -- Crear movimiento de reversión (ajuste positivo)
        INSERT INTO inventory_movements (
            tenant_id,
            branch_id,
            item_id,
            movement_type,
            quantity,
            previous_stock,
            new_stock,
            unit_cost,
            total_cost,
            reference_type,
            reference_id,
            performed_by,
            staff_id,
            reason,
            notes,
            metadata
        ) VALUES (
            v_order.tenant_id,
            v_order.branch_id,
            v_movement.item_id,
            'adjustment',
            ABS(v_movement.quantity), -- Positivo para revertir
            v_movement.current_stock,
            v_movement.current_stock + ABS(v_movement.quantity),
            v_movement.unit_cost,
            ABS(v_movement.quantity) * COALESCE(v_movement.unit_cost, 0),
            'order_cancellation',
            p_order_id,
            p_performed_by,
            v_staff_id,
            p_reason,
            'Reversión de consumo por orden #' || COALESCE(v_order.display_number, p_order_id::TEXT),
            jsonb_build_object(
                'original_movement_id', v_movement.id,
                'order_id', p_order_id
            )
        );

        v_movements_reverted := v_movements_reverted + 1;
    END LOOP;

    -- Resolver alertas que fueron creadas por esta orden
    UPDATE low_stock_alerts
    SET
        status = 'resolved'::low_stock_alert_status,
        resolved_at = NOW(),
        metadata = metadata || jsonb_build_object('resolved_by_order_cancellation', p_order_id)
    WHERE metadata->>'triggered_by_order' = p_order_id::TEXT
      AND status IN ('open', 'acknowledged');

    GET DIAGNOSTICS v_alerts_resolved = ROW_COUNT;

    success := true;
    movements_reverted := v_movements_reverted;
    alerts_resolved := v_alerts_resolved;
    error_message := NULL;
    RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION revert_order_consumption IS
'Reverts inventory consumption for an order that was cancelled after completion.
Creates adjustment movements to restore stock and resolves related alerts.';

GRANT EXECUTE ON FUNCTION revert_order_consumption(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION revert_order_consumption(UUID, UUID, TEXT) TO service_role;


-- =====================================================
-- PARTE 5: TRIGGER PARA REVERTIR CONSUMO AL CANCELAR
-- =====================================================

CREATE OR REPLACE FUNCTION public.trigger_revert_order_consumption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Solo procesar cuando el status cambia de completed/delivered a cancelled
    IF (OLD.status IN ('completed', 'delivered'))
       AND NEW.status = 'cancelled' THEN

        SELECT * INTO v_result
        FROM revert_order_consumption(NEW.id, NULL, 'Order cancelled');

        IF v_result.success THEN
            RAISE NOTICE '[Inventory] Order % cancelled: reverted % movements, resolved % alerts',
                NEW.id, v_result.movements_reverted, v_result.alerts_resolved;
        ELSE
            RAISE WARNING '[Inventory] Failed to revert consumption for order %: %',
                NEW.id, v_result.error_message;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'restaurant_orders') THEN

        DROP TRIGGER IF EXISTS trigger_revert_order_consumption ON public.restaurant_orders;

        CREATE TRIGGER trigger_revert_order_consumption
            AFTER UPDATE ON public.restaurant_orders
            FOR EACH ROW
            WHEN (OLD.status IN ('completed', 'delivered') AND NEW.status = 'cancelled')
            EXECUTE FUNCTION trigger_revert_order_consumption();

        RAISE NOTICE 'Trigger trigger_revert_order_consumption created successfully';
    END IF;
END $$;


-- =====================================================
-- PARTE 6: VISTA DE CONSUMO POR ORDEN
-- =====================================================

CREATE OR REPLACE VIEW public.v_order_consumption_summary AS
SELECT
    o.id as order_id,
    o.tenant_id,
    o.branch_id,
    o.display_number,
    o.status,
    o.ordered_at,
    o.completed_at,
    COUNT(DISTINCT m.item_id) as ingredients_consumed,
    COUNT(m.id) as total_movements,
    COALESCE(SUM(ABS(m.total_cost)), 0) as total_consumption_cost,
    ARRAY_AGG(DISTINCT ii.name) FILTER (WHERE ii.name IS NOT NULL) as ingredient_names
FROM restaurant_orders o
LEFT JOIN inventory_movements m ON m.reference_id = o.id
    AND m.reference_type = 'restaurant_order'
    AND m.movement_type = 'consumption'
LEFT JOIN inventory_items ii ON ii.id = m.item_id
WHERE o.status IN ('completed', 'delivered')
GROUP BY o.id, o.tenant_id, o.branch_id, o.display_number, o.status, o.ordered_at, o.completed_at;

COMMENT ON VIEW v_order_consumption_summary IS
'Summary of inventory consumption for completed restaurant orders.
Shows ingredients consumed, total movements, and consumption cost per order.';


-- =====================================================
-- PARTE 7: FUNCIÓN AUXILIAR PARA VERIFICAR STOCK DE UN ITEM
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_item_stock_status(
    p_item_id UUID,
    p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE(
    item_id UUID,
    item_name TEXT,
    current_stock DECIMAL,
    minimum_stock DECIMAL,
    maximum_stock DECIMAL,
    status TEXT,
    deficit DECIMAL,
    unit TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ii.id,
        ii.name::TEXT,
        ii.current_stock,
        ii.minimum_stock,
        ii.maximum_stock,
        CASE
            WHEN ii.current_stock <= 0 THEN 'out_of_stock'
            WHEN ii.current_stock <= ii.minimum_stock * 0.25 THEN 'critical'
            WHEN ii.current_stock <= ii.minimum_stock * 0.5 THEN 'very_low'
            WHEN ii.current_stock <= ii.minimum_stock THEN 'low'
            WHEN ii.maximum_stock IS NOT NULL AND ii.current_stock >= ii.maximum_stock THEN 'overstocked'
            ELSE 'normal'
        END::TEXT,
        GREATEST(0, ii.minimum_stock - ii.current_stock),
        ii.unit::TEXT
    FROM inventory_items ii
    WHERE ii.id = p_item_id
      AND ii.is_active = true
      AND ii.deleted_at IS NULL
      AND (p_branch_id IS NULL OR ii.branch_id IS NULL OR ii.branch_id = p_branch_id);
END;
$$;

GRANT EXECUTE ON FUNCTION check_item_stock_status(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_item_stock_status(UUID, UUID) TO service_role;


-- =====================================================
-- PARTE 8: ÍNDICES ADICIONALES PARA PERFORMANCE
-- =====================================================

-- Índice para búsqueda rápida de movimientos por referencia
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference
    ON public.inventory_movements(reference_type, reference_id)
    WHERE reference_type IS NOT NULL;

-- Índice para alertas abiertas por item
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_open_item
    ON public.low_stock_alerts(item_id, branch_id)
    WHERE status IN ('open', 'acknowledged');

-- Índice para órdenes completadas recientes (para reportes)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'restaurant_orders') THEN
        CREATE INDEX IF NOT EXISTS idx_restaurant_orders_completed
            ON public.restaurant_orders(branch_id, completed_at DESC)
            WHERE status IN ('completed', 'delivered') AND deleted_at IS NULL;
    END IF;
END $$;


-- =====================================================
-- MIGRACIÓN COMPLETADA
-- =====================================================

SELECT 'Migration 101: Inventory Consumption System - COMPLETADA' as status;

-- Resumen de lo implementado:
-- ✅ validate_order_stock() - Validación real de stock con recetas
-- ✅ consume_order_ingredients() - Función para consumir ingredientes
-- ✅ trigger_consume_order_ingredients - Auto-consume al completar orden
-- ✅ revert_order_consumption() - Reversión al cancelar orden completada
-- ✅ trigger_revert_order_consumption - Auto-revert al cancelar
-- ✅ v_order_consumption_summary - Vista de resumen de consumo
-- ✅ check_item_stock_status() - Verificación de estado de stock
-- ✅ Índices optimizados para las nuevas consultas
-- ✅ Creación automática de low_stock_alerts al detectar bajo stock

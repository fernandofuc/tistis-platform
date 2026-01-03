-- =====================================================
-- TIS TIS PLATFORM - AI Ordering Integration
-- Migration 092: AI Traceability for Restaurant Orders
-- =====================================================
-- Esta migración agrega campos para trazabilidad de órdenes
-- creadas por el agente de IA (conversation_id, confidence, etc.)
-- =====================================================

-- =====================================================
-- PARTE 1: AGREGAR CAMPOS AI A RESTAURANT_ORDERS
-- =====================================================

-- Agregar columna conversation_id para rastrear qué conversación creó la orden
ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id);

-- Agregar columna para indicar la fuente de la orden (ai, pos, web, manual)
ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS order_source VARCHAR(20) DEFAULT 'manual' CHECK (order_source IN (
    'ai_whatsapp',  -- Creada por IA vía WhatsApp
    'ai_voice',     -- Creada por IA vía llamada de voz
    'ai_webchat',   -- Creada por IA vía webchat
    'pos',          -- Creada desde el punto de venta
    'web',          -- Creada desde la web del restaurante
    'app',          -- Creada desde la app móvil
    'third_party',  -- UberEats, Rappi, DiDi Food, etc.
    'manual'        -- Creada manualmente por staff
));

-- Agregar score de confianza del AI (0-1)
ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(3, 2) CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 1);

-- Agregar items que el AI detectó pero no pudo confirmar con 100% certeza
ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS ai_unconfirmed_items JSONB DEFAULT '[]';

-- Agregar flag para indicar si requiere revisión humana
ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS requires_human_review BOOLEAN DEFAULT false;

-- Agregar razón de la revisión humana requerida
ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS human_review_reason TEXT;

-- Índice para buscar órdenes por conversación
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_conversation
    ON public.restaurant_orders(conversation_id)
    WHERE conversation_id IS NOT NULL;

-- Índice para buscar órdenes creadas por AI
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_source_ai
    ON public.restaurant_orders(tenant_id, order_source)
    WHERE order_source IN ('ai_whatsapp', 'ai_voice', 'ai_webchat');


-- =====================================================
-- PARTE 2: AGREGAR CAMPOS AI A RESTAURANT_ORDER_ITEMS
-- =====================================================

-- Agregar confianza del AI en el match del item
ALTER TABLE public.restaurant_order_items
ADD COLUMN IF NOT EXISTS ai_match_confidence DECIMAL(3, 2) CHECK (ai_match_confidence >= 0 AND ai_match_confidence <= 1);

-- Agregar el texto original que el cliente dijo (para auditoría y mejora)
ALTER TABLE public.restaurant_order_items
ADD COLUMN IF NOT EXISTS customer_original_text TEXT;

-- Agregar alternativas que el AI consideró
ALTER TABLE public.restaurant_order_items
ADD COLUMN IF NOT EXISTS ai_alternatives_considered JSONB DEFAULT '[]';


-- =====================================================
-- PARTE 3: ACTUALIZAR EL METADATA SCHEMA
-- =====================================================

-- Comentario explicando la estructura esperada del metadata
COMMENT ON COLUMN public.restaurant_orders.metadata IS 'JSON con metadata adicional. Para órdenes AI incluye: {source: string, conversation_id: uuid, ai_confidence_score: number, created_via: string}';

COMMENT ON COLUMN public.restaurant_order_items.ai_alternatives_considered IS 'Array de items del menú que el AI consideró como alternativas: [{id, name, confidence}]';


-- =====================================================
-- PARTE 4: FUNCIÓN PARA ENVIAR ORDEN A COCINA (KDS)
-- =====================================================

-- Esta función se llama cuando una orden creada por AI es confirmada
-- Notifica al sistema de cocina (KDS) que hay una nueva orden
CREATE OR REPLACE FUNCTION public.notify_kitchen_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Solo notificar cuando el status cambia a 'confirmed' o 'preparing'
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status IN ('confirmed', 'preparing') THEN
        -- Notificar vía Postgres NOTIFY (para suscriptores real-time)
        PERFORM pg_notify(
            'kitchen_new_order',
            json_build_object(
                'order_id', NEW.id,
                'branch_id', NEW.branch_id,
                'order_number', NEW.display_number,
                'order_type', NEW.order_type,
                'priority', NEW.priority,
                'estimated_prep_time', NEW.estimated_prep_time,
                'source', NEW.order_source
            )::text
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Crear trigger para notificar cocina
DROP TRIGGER IF EXISTS trigger_notify_kitchen_new_order ON public.restaurant_orders;
CREATE TRIGGER trigger_notify_kitchen_new_order
    AFTER UPDATE ON public.restaurant_orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_kitchen_new_order();


-- =====================================================
-- PARTE 5: FUNCIÓN PARA VALIDAR STOCK ANTES DE CREAR ORDEN
-- =====================================================

-- Función que valida si hay stock suficiente para los items de una orden
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
    v_out_of_stock TEXT[] := ARRAY[]::TEXT[];
    v_low_stock TEXT[] := ARRAY[]::TEXT[];
    v_item RECORD;
    v_current_stock INTEGER;
    v_reorder_point INTEGER;
    v_item_name TEXT;
    v_required_qty INTEGER;
BEGIN
    -- Iterar sobre cada item del pedido
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(menu_item_id UUID, quantity INTEGER)
    LOOP
        -- Buscar el inventario del item (si está enlazado a un inventory_item)
        SELECT
            ii.current_stock,
            ii.reorder_point,
            mi.name
        INTO v_current_stock, v_reorder_point, v_item_name
        FROM restaurant_menu_items mi
        LEFT JOIN restaurant_inventory_items ii ON ii.menu_item_id = mi.id AND ii.branch_id = p_branch_id
        WHERE mi.id = v_item.menu_item_id;

        v_required_qty := v_item.quantity;

        -- Si tiene inventario enlazado, verificar stock
        IF v_current_stock IS NOT NULL THEN
            -- Sin stock suficiente
            IF v_current_stock < v_required_qty THEN
                v_out_of_stock := array_append(v_out_of_stock, v_item_name);
            -- Stock bajo (pero suficiente)
            ELSIF v_current_stock - v_required_qty <= COALESCE(v_reorder_point, 5) THEN
                v_low_stock := array_append(v_low_stock, v_item_name);
            END IF;
        END IF;
    END LOOP;

    -- Retornar resultado
    valid := (array_length(v_out_of_stock, 1) IS NULL OR array_length(v_out_of_stock, 1) = 0);
    out_of_stock_items := v_out_of_stock;
    low_stock_warnings := v_low_stock;

    RETURN NEXT;
END;
$$;


-- =====================================================
-- PARTE 6: FUNCIÓN PARA DECREMENTAR STOCK AL CONFIRMAR ORDEN
-- =====================================================

-- Función que decrementa el stock cuando una orden es confirmada
CREATE OR REPLACE FUNCTION public.decrement_order_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- Solo decrementar cuando pasa a 'confirmed' o 'preparing'
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status IN ('confirmed', 'preparing') THEN
        -- Decrementar stock para cada item de la orden
        FOR v_item IN
            SELECT
                oi.menu_item_id,
                oi.quantity
            FROM restaurant_order_items oi
            WHERE oi.order_id = NEW.id
        LOOP
            -- Decrementar si hay inventario enlazado
            UPDATE restaurant_inventory_items
            SET
                current_stock = current_stock - v_item.quantity,
                updated_at = NOW()
            WHERE menu_item_id = v_item.menu_item_id
            AND branch_id = NEW.branch_id
            AND current_stock >= v_item.quantity;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

-- Crear trigger para decrementar stock
DROP TRIGGER IF EXISTS trigger_decrement_order_stock ON public.restaurant_orders;
CREATE TRIGGER trigger_decrement_order_stock
    AFTER UPDATE ON public.restaurant_orders
    FOR EACH ROW
    EXECUTE FUNCTION decrement_order_stock();


-- =====================================================
-- PARTE 7: RLS POLICIES (para órdenes AI)
-- =====================================================

-- Las órdenes creadas por AI deben ser visibles para el staff del tenant
-- Las políticas existentes deberían cubrir esto, pero agreguemos una específica

-- Permitir al service role insertar órdenes (para el agente AI)
CREATE POLICY IF NOT EXISTS "Service role can insert orders"
    ON public.restaurant_orders
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Permitir al service role actualizar órdenes (para confirmar desde AI)
CREATE POLICY IF NOT EXISTS "Service role can update orders"
    ON public.restaurant_orders
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);


-- =====================================================
-- PARTE 8: ÍNDICES ADICIONALES PARA PERFORMANCE
-- =====================================================

-- Índice para buscar items por menú y branch (para validación de stock)
CREATE INDEX IF NOT EXISTS idx_inventory_items_menu_branch
    ON public.restaurant_inventory_items(menu_item_id, branch_id)
    WHERE deleted_at IS NULL;

-- Índice para órdenes pendientes de revisión
CREATE INDEX IF NOT EXISTS idx_orders_requires_review
    ON public.restaurant_orders(tenant_id, requires_human_review)
    WHERE requires_human_review = true AND deleted_at IS NULL;


-- =====================================================
-- MIGRACIÓN COMPLETADA
-- =====================================================

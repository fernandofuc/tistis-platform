-- =====================================================
-- TIS TIS PLATFORM - AI Ordering Integration
-- Migration 092: AI Traceability for Restaurant Orders
-- =====================================================
-- Esta migración agrega campos para trazabilidad de órdenes
-- creadas por el agente de IA (conversation_id, confidence, etc.)
-- NOTA: Solo aplica si las tablas de restaurant existen
-- =====================================================

-- =====================================================
-- PARTE 1: VERIFICAR Y AGREGAR CAMPOS AI A RESTAURANT_ORDERS
-- =====================================================

DO $$
BEGIN
    -- Solo ejecutar si la tabla restaurant_orders existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_orders') THEN

        -- Agregar columna conversation_id para rastrear qué conversación creó la orden
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_orders' AND column_name = 'conversation_id') THEN
            ALTER TABLE public.restaurant_orders ADD COLUMN conversation_id UUID;
        END IF;

        -- Agregar columna para indicar la fuente de la orden
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_orders' AND column_name = 'order_source') THEN
            ALTER TABLE public.restaurant_orders ADD COLUMN order_source VARCHAR(20) DEFAULT 'manual';
        END IF;

        -- Agregar score de confianza del AI (0-1)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_orders' AND column_name = 'ai_confidence_score') THEN
            ALTER TABLE public.restaurant_orders ADD COLUMN ai_confidence_score DECIMAL(3, 2);
        END IF;

        -- Agregar items que el AI detectó pero no pudo confirmar
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_orders' AND column_name = 'ai_unconfirmed_items') THEN
            ALTER TABLE public.restaurant_orders ADD COLUMN ai_unconfirmed_items JSONB DEFAULT '[]';
        END IF;

        -- Agregar flag para indicar si requiere revisión humana
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_orders' AND column_name = 'requires_human_review') THEN
            ALTER TABLE public.restaurant_orders ADD COLUMN requires_human_review BOOLEAN DEFAULT false;
        END IF;

        -- Agregar razón de la revisión humana requerida
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_orders' AND column_name = 'human_review_reason') THEN
            ALTER TABLE public.restaurant_orders ADD COLUMN human_review_reason TEXT;
        END IF;

        RAISE NOTICE 'Columns added to restaurant_orders';
    ELSE
        RAISE NOTICE 'Table restaurant_orders does not exist, skipping PARTE 1';
    END IF;
END $$;


-- =====================================================
-- PARTE 2: ÍNDICES PARA RESTAURANT_ORDERS (si existe)
-- =====================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_orders') THEN
        -- Índice para buscar órdenes por conversación
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_restaurant_orders_conversation') THEN
            CREATE INDEX idx_restaurant_orders_conversation ON public.restaurant_orders(conversation_id) WHERE conversation_id IS NOT NULL;
        END IF;

        -- Índice para buscar órdenes creadas por AI
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_restaurant_orders_source_ai') THEN
            CREATE INDEX idx_restaurant_orders_source_ai ON public.restaurant_orders(tenant_id, order_source) WHERE order_source LIKE 'ai_%';
        END IF;

        RAISE NOTICE 'Indexes created for restaurant_orders';
    END IF;
END $$;


-- =====================================================
-- PARTE 3: AGREGAR CAMPOS AI A RESTAURANT_ORDER_ITEMS (si existe)
-- =====================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_order_items') THEN

        -- Agregar confianza del AI en el match del item
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_order_items' AND column_name = 'ai_match_confidence') THEN
            ALTER TABLE public.restaurant_order_items ADD COLUMN ai_match_confidence DECIMAL(3, 2);
        END IF;

        -- Agregar el texto original que el cliente dijo
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_order_items' AND column_name = 'customer_original_text') THEN
            ALTER TABLE public.restaurant_order_items ADD COLUMN customer_original_text TEXT;
        END IF;

        -- Agregar alternativas que el AI consideró
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_order_items' AND column_name = 'ai_alternatives_considered') THEN
            ALTER TABLE public.restaurant_order_items ADD COLUMN ai_alternatives_considered JSONB DEFAULT '[]';
        END IF;

        RAISE NOTICE 'Columns added to restaurant_order_items';
    ELSE
        RAISE NOTICE 'Table restaurant_order_items does not exist, skipping PARTE 3';
    END IF;
END $$;


-- =====================================================
-- PARTE 4: FUNCIÓN PARA ENVIAR ORDEN A COCINA (KDS)
-- =====================================================

-- Esta función se llama cuando una orden creada por AI es confirmada
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
                'order_number', COALESCE(NEW.display_number, NEW.id::text),
                'order_type', COALESCE(NEW.order_type, 'pickup'),
                'priority', COALESCE(NEW.priority, 1),
                'source', COALESCE(NEW.order_source, 'manual')
            )::text
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Crear trigger solo si la tabla existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_orders') THEN
        DROP TRIGGER IF EXISTS trigger_notify_kitchen_new_order ON public.restaurant_orders;
        CREATE TRIGGER trigger_notify_kitchen_new_order
            AFTER UPDATE ON public.restaurant_orders
            FOR EACH ROW
            EXECUTE FUNCTION notify_kitchen_new_order();
        RAISE NOTICE 'Kitchen notification trigger created';
    END IF;
END $$;


-- =====================================================
-- PARTE 5: FUNCIÓN PARA VALIDAR STOCK (SIMPLIFICADA)
-- =====================================================
-- Nota: Esta es una versión simplificada que no depende de
-- tablas de inventario específicas

CREATE OR REPLACE FUNCTION public.validate_order_stock_simple(
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
BEGIN
    -- Por ahora, siempre retorna válido
    -- Se puede expandir cuando las tablas de inventario estén disponibles
    valid := true;
    out_of_stock_items := ARRAY[]::TEXT[];
    low_stock_warnings := ARRAY[]::TEXT[];
    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_order_stock_simple(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_order_stock_simple(UUID, JSONB) TO service_role;


-- =====================================================
-- PARTE 6: RLS POLICIES (para órdenes AI, si la tabla existe)
-- =====================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_orders') THEN
        -- Verificar si RLS está habilitado
        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'restaurant_orders' AND rowsecurity = true) THEN
            -- Permitir al service role insertar órdenes
            DROP POLICY IF EXISTS "Service role can insert orders" ON public.restaurant_orders;
            CREATE POLICY "Service role can insert orders"
                ON public.restaurant_orders
                FOR INSERT
                TO service_role
                WITH CHECK (true);

            -- Permitir al service role actualizar órdenes
            DROP POLICY IF EXISTS "Service role can update orders" ON public.restaurant_orders;
            CREATE POLICY "Service role can update orders"
                ON public.restaurant_orders
                FOR UPDATE
                TO service_role
                USING (true)
                WITH CHECK (true);

            RAISE NOTICE 'RLS policies created for restaurant_orders';
        ELSE
            RAISE NOTICE 'RLS not enabled on restaurant_orders, skipping policies';
        END IF;
    END IF;
END $$;


-- =====================================================
-- MIGRACIÓN COMPLETADA
-- =====================================================

SELECT 'Migration 092: AI Ordering Integration - COMPLETADA' as status;

-- =====================================================
-- TIS TIS PLATFORM - DELIVERY SYSTEM
-- Migration: 156_DELIVERY_SYSTEM.sql
-- Date: January 2026
-- Version: 1.0
--
-- PURPOSE:
-- 1. Agregar sistema completo de delivery para restaurantes
-- 2. Tracking de estados de delivery
-- 3. Asignacion de repartidores
-- 4. Calculo de tiempos y zonas de entrega
-- 5. Historial de eventos de delivery
--
-- DEPENDENCIAS:
-- - 089_RESTAURANT_ORDERS_KDS.sql (tabla restaurant_orders)
-- - 155_UNIFIED_ASSISTANT_TYPES.sql (service_options en tenants)
--
-- PARTE DE: Sistema de Delivery v1.0
-- =====================================================

-- =====================================================
-- PASO 1: AGREGAR COLUMNAS DE DELIVERY A RESTAURANT_ORDERS
-- =====================================================

-- Estado de delivery (separado del status de orden)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'restaurant_orders'
        AND column_name = 'delivery_status'
    ) THEN
        ALTER TABLE public.restaurant_orders
        ADD COLUMN delivery_status VARCHAR(30) CHECK (delivery_status IN (
            'pending_assignment', -- Esperando asignacion de repartidor
            'driver_assigned',    -- Repartidor asignado
            'driver_arrived',     -- Repartidor llego al restaurante
            'picked_up',          -- Pedido recogido por repartidor
            'in_transit',         -- En camino al cliente
            'arriving',           -- Llegando al destino
            'delivered',          -- Entregado exitosamente
            'failed',             -- Entrega fallida
            'returned'            -- Devuelto al restaurante
        ));

        COMMENT ON COLUMN public.restaurant_orders.delivery_status IS
        'Estado especifico del delivery:
        - pending_assignment: Esperando asignacion de repartidor
        - driver_assigned: Repartidor asignado, pendiente pickup
        - driver_arrived: Repartidor llego al restaurante
        - picked_up: Pedido recogido de cocina
        - in_transit: En camino al cliente
        - arriving: Llegando al destino (< 2 min)
        - delivered: Entregado exitosamente
        - failed: Entrega fallida (cliente no disponible, direccion incorrecta, etc)
        - returned: Devuelto al restaurante';

        RAISE NOTICE 'Columna delivery_status agregada a restaurant_orders';
    END IF;
END $$;

-- Tiempo estimado de entrega
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'restaurant_orders'
        AND column_name = 'estimated_delivery_at'
    ) THEN
        ALTER TABLE public.restaurant_orders
        ADD COLUMN estimated_delivery_at TIMESTAMPTZ;

        COMMENT ON COLUMN public.restaurant_orders.estimated_delivery_at IS
        'Timestamp estimado de entrega al cliente. Calculado al crear la orden.';

        RAISE NOTICE 'Columna estimated_delivery_at agregada';
    END IF;
END $$;

-- Tiempo real de entrega
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'restaurant_orders'
        AND column_name = 'actual_delivery_at'
    ) THEN
        ALTER TABLE public.restaurant_orders
        ADD COLUMN actual_delivery_at TIMESTAMPTZ;

        COMMENT ON COLUMN public.restaurant_orders.actual_delivery_at IS
        'Timestamp real de entrega. Se establece cuando delivery_status = delivered.';

        RAISE NOTICE 'Columna actual_delivery_at agregada';
    END IF;
END $$;

-- Distancia de delivery en km
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'restaurant_orders'
        AND column_name = 'delivery_distance_km'
    ) THEN
        ALTER TABLE public.restaurant_orders
        ADD COLUMN delivery_distance_km DECIMAL(6,2);

        COMMENT ON COLUMN public.restaurant_orders.delivery_distance_km IS
        'Distancia en kilometros desde la sucursal hasta la direccion de entrega.';

        RAISE NOTICE 'Columna delivery_distance_km agregada';
    END IF;
END $$;

-- Razon de fallo de delivery
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'restaurant_orders'
        AND column_name = 'delivery_failure_reason'
    ) THEN
        ALTER TABLE public.restaurant_orders
        ADD COLUMN delivery_failure_reason VARCHAR(255);

        COMMENT ON COLUMN public.restaurant_orders.delivery_failure_reason IS
        'Razon si delivery_status = failed o returned.';

        RAISE NOTICE 'Columna delivery_failure_reason agregada';
    END IF;
END $$;

-- =====================================================
-- PASO 2: TABLA DE REPARTIDORES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.delivery_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Vinculo con staff (opcional - puede ser repartidor externo)
    staff_id UUID REFERENCES public.staff(id),

    -- Informacion del repartidor
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),

    -- Vehiculo
    vehicle_type VARCHAR(30) NOT NULL CHECK (vehicle_type IN (
        'motorcycle',  -- Moto
        'bicycle',     -- Bicicleta
        'car',         -- Auto
        'scooter',     -- Scooter electrico
        'walking'      -- A pie (para distancias cortas)
    )),
    vehicle_plate VARCHAR(20),     -- Placa del vehiculo
    vehicle_description VARCHAR(100), -- Ej: "Moto roja Honda"

    -- Estado
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN (
        'available',   -- Disponible para asignacion
        'busy',        -- En una entrega
        'offline',     -- No disponible
        'break'        -- En descanso
    )),

    -- Ubicacion actual (GPS)
    current_location JSONB,
    -- { "lat": 31.3108, "lng": -110.9442, "updated_at": "2026-01-24T10:30:00Z" }

    -- Metricas
    total_deliveries INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 5.00,

    -- Configuracion
    max_distance_km INTEGER DEFAULT 10,
    accepts_cash BOOLEAN DEFAULT true,

    -- Estado activo
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_tenant
    ON public.delivery_drivers(tenant_id);

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_status
    ON public.delivery_drivers(tenant_id, status)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_available
    ON public.delivery_drivers(tenant_id)
    WHERE status = 'available' AND is_active = true;

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_delivery_drivers_updated_at ON public.delivery_drivers;
CREATE TRIGGER update_delivery_drivers_updated_at
    BEFORE UPDATE ON public.delivery_drivers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_drivers_tenant_policy" ON public.delivery_drivers;
CREATE POLICY "delivery_drivers_tenant_policy" ON public.delivery_drivers
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "delivery_drivers_service_role_policy" ON public.delivery_drivers;
CREATE POLICY "delivery_drivers_service_role_policy" ON public.delivery_drivers
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

COMMENT ON TABLE public.delivery_drivers IS
'Repartidores para el sistema de delivery.
Puede estar vinculado a un staff o ser externo.
Trackea ubicacion, metricas y disponibilidad.';

-- =====================================================
-- PASO 3: TABLA DE ZONAS DE DELIVERY
-- =====================================================

CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Informacion de la zona
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Tipo de zona
    zone_type VARCHAR(20) NOT NULL CHECK (zone_type IN (
        'radius',       -- Radio desde la sucursal
        'polygon',      -- Poligono definido por coordenadas
        'postal_codes'  -- Lista de codigos postales
    )),

    -- Definicion de la zona
    zone_definition JSONB NOT NULL,
    -- Para radius: { "center_lat": 31.31, "center_lng": -110.94, "radius_km": 5 }
    -- Para polygon: { "coordinates": [[lat, lng], [lat, lng], ...] }
    -- Para postal_codes: { "codes": ["84000", "84010", "84020"] }

    -- Pricing
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    minimum_order_amount DECIMAL(10,2) DEFAULT 0,
    free_delivery_threshold DECIMAL(10,2), -- Si pedido >= este monto, delivery gratis

    -- Tiempos
    estimated_time_minutes INTEGER NOT NULL DEFAULT 30,

    -- Disponibilidad
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1, -- Para resolver conflictos entre zonas

    -- Horarios especificos (si difiere del horario general)
    operating_hours JSONB,
    -- { "monday": { "open": "10:00", "close": "22:00" }, ... }

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_delivery_zones_tenant_branch
    ON public.delivery_zones(tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_active
    ON public.delivery_zones(tenant_id, branch_id)
    WHERE is_active = true;

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_delivery_zones_updated_at ON public.delivery_zones;
CREATE TRIGGER update_delivery_zones_updated_at
    BEFORE UPDATE ON public.delivery_zones
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_zones_tenant_policy" ON public.delivery_zones;
CREATE POLICY "delivery_zones_tenant_policy" ON public.delivery_zones
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "delivery_zones_service_role_policy" ON public.delivery_zones;
CREATE POLICY "delivery_zones_service_role_policy" ON public.delivery_zones
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

COMMENT ON TABLE public.delivery_zones IS
'Zonas de cobertura de delivery por sucursal.
Permite definir diferentes tarifas y tiempos por zona.
Soporta radio, poligono o codigos postales.';

-- =====================================================
-- PASO 4: TABLA DE TRACKING DE DELIVERY
-- =====================================================

CREATE TABLE IF NOT EXISTS public.delivery_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.delivery_drivers(id),

    -- Estado del evento
    status VARCHAR(30) NOT NULL CHECK (status IN (
        'pending_assignment',
        'driver_assigned',
        'driver_arrived',
        'picked_up',
        'in_transit',
        'arriving',
        'delivered',
        'failed',
        'returned'
    )),

    -- Ubicacion del repartidor al momento del evento
    driver_location JSONB,
    -- { "lat": 31.3108, "lng": -110.9442, "accuracy": 10 }

    -- Notas del evento
    notes TEXT,

    -- Evidencia (foto de entrega, etc)
    evidence_url TEXT,

    -- Metadata adicional
    metadata JSONB DEFAULT '{}',
    -- { "failure_reason": "...", "signature_captured": true, etc }

    -- Auditoria
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order
    ON public.delivery_tracking(order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_tenant_order
    ON public.delivery_tracking(tenant_id, order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_driver
    ON public.delivery_tracking(driver_id)
    WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_created
    ON public.delivery_tracking(created_at DESC);

-- RLS
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_tracking_tenant_policy" ON public.delivery_tracking;
CREATE POLICY "delivery_tracking_tenant_policy" ON public.delivery_tracking
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "delivery_tracking_service_role_policy" ON public.delivery_tracking;
CREATE POLICY "delivery_tracking_service_role_policy" ON public.delivery_tracking
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

COMMENT ON TABLE public.delivery_tracking IS
'Historial de eventos de delivery. Cada cambio de estado genera un registro
para trazabilidad completa del pedido. Incluye ubicacion GPS del repartidor.';

-- =====================================================
-- PASO 5: AGREGAR COLUMNA delivery_driver_id A restaurant_orders
-- =====================================================
-- NOTA: La columna driver_id ya existe y referencia a staff(id)
-- para identificar quien tomo el pedido en mostrador.
-- Creamos delivery_driver_id para el repartidor de delivery.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'restaurant_orders'
        AND column_name = 'delivery_driver_id'
    ) THEN
        ALTER TABLE public.restaurant_orders
        ADD COLUMN delivery_driver_id UUID REFERENCES public.delivery_drivers(id);

        COMMENT ON COLUMN public.restaurant_orders.delivery_driver_id IS
        'ID del repartidor asignado para entregas delivery. Diferente de driver_id que es staff en mostrador.';

        RAISE NOTICE 'Columna delivery_driver_id agregada a restaurant_orders';
    END IF;
END $$;

-- Indice para busquedas por repartidor
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_delivery_driver
    ON public.restaurant_orders(delivery_driver_id)
    WHERE delivery_driver_id IS NOT NULL;

-- =====================================================
-- PASO 6: FUNCION PARA CALCULAR DELIVERY
-- =====================================================

CREATE OR REPLACE FUNCTION public.calculate_delivery_details(
    p_tenant_id UUID,
    p_branch_id UUID,
    p_delivery_address JSONB
)
RETURNS TABLE (
    is_within_zone BOOLEAN,
    zone_id UUID,
    zone_name VARCHAR,
    distance_km DECIMAL,
    estimated_minutes INTEGER,
    delivery_fee DECIMAL,
    minimum_order DECIMAL,
    free_delivery_threshold DECIMAL,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_service_options JSONB;
    v_delivery_enabled BOOLEAN;
    v_branch_lat DECIMAL;
    v_branch_lng DECIMAL;
    v_customer_lat DECIMAL;
    v_customer_lng DECIMAL;
    v_distance DECIMAL;
    v_zone RECORD;
    v_max_radius DECIMAL;
BEGIN
    -- Obtener service_options del tenant
    SELECT service_options INTO v_service_options
    FROM public.tenants
    WHERE id = p_tenant_id;

    -- Verificar si delivery esta habilitado
    v_delivery_enabled := COALESCE((v_service_options->>'delivery_enabled')::BOOLEAN, false);

    IF NOT v_delivery_enabled THEN
        RETURN QUERY SELECT
            false::BOOLEAN,
            NULL::UUID,
            NULL::VARCHAR,
            NULL::DECIMAL,
            NULL::INTEGER,
            NULL::DECIMAL,
            NULL::DECIMAL,
            NULL::DECIMAL,
            'El servicio de delivery no esta habilitado para este negocio.'::TEXT;
        RETURN;
    END IF;

    -- Obtener coordenadas de la sucursal
    SELECT
        COALESCE((settings->>'latitude')::DECIMAL, 0),
        COALESCE((settings->>'longitude')::DECIMAL, 0)
    INTO v_branch_lat, v_branch_lng
    FROM public.branches
    WHERE id = p_branch_id;

    IF v_branch_lat = 0 OR v_branch_lng = 0 THEN
        RETURN QUERY SELECT
            false::BOOLEAN,
            NULL::UUID,
            NULL::VARCHAR,
            NULL::DECIMAL,
            NULL::INTEGER,
            NULL::DECIMAL,
            NULL::DECIMAL,
            NULL::DECIMAL,
            'La sucursal no tiene coordenadas configuradas.'::TEXT;
        RETURN;
    END IF;

    -- Obtener coordenadas del cliente
    v_customer_lat := COALESCE((p_delivery_address->'coordinates'->>'lat')::DECIMAL, 0);
    v_customer_lng := COALESCE((p_delivery_address->'coordinates'->>'lng')::DECIMAL, 0);

    -- Si no hay coordenadas del cliente, intentar usar el codigo postal
    -- Por ahora asumimos que las coordenadas vienen en el address

    IF v_customer_lat = 0 OR v_customer_lng = 0 THEN
        -- Fallback: usar radio maximo configurado como distancia promedio
        v_max_radius := COALESCE((v_service_options->'delivery_config'->>'max_radius_km')::DECIMAL, 5);
        v_distance := v_max_radius * 0.6; -- Distancia promedio estimada
    ELSE
        -- Calcular distancia usando formula de Haversine simplificada
        -- Para distancias cortas (< 50km) esto es suficientemente preciso
        v_distance := SQRT(
            POWER((v_customer_lat - v_branch_lat) * 111, 2) +
            POWER((v_customer_lng - v_branch_lng) * 111 * COS(RADIANS(v_branch_lat)), 2)
        );
    END IF;

    -- Buscar zona de delivery aplicable
    -- Prioridad: zona especifica > zona por radio general
    FOR v_zone IN
        SELECT
            dz.id,
            dz.name,
            dz.zone_type,
            dz.zone_definition,
            dz.delivery_fee,
            dz.minimum_order_amount,
            dz.free_delivery_threshold,
            dz.estimated_time_minutes,
            dz.priority
        FROM public.delivery_zones dz
        WHERE dz.tenant_id = p_tenant_id
          AND dz.branch_id = p_branch_id
          AND dz.is_active = true
        ORDER BY dz.priority DESC, dz.id
    LOOP
        -- Verificar si la direccion esta en esta zona
        IF v_zone.zone_type = 'radius' THEN
            -- Zona por radio
            IF v_distance <= (v_zone.zone_definition->>'radius_km')::DECIMAL THEN
                RETURN QUERY SELECT
                    true::BOOLEAN,
                    v_zone.id,
                    v_zone.name::VARCHAR,
                    ROUND(v_distance, 2),
                    v_zone.estimated_time_minutes,
                    v_zone.delivery_fee,
                    v_zone.minimum_order_amount,
                    v_zone.free_delivery_threshold,
                    NULL::TEXT;
                RETURN;
            END IF;
        ELSIF v_zone.zone_type = 'postal_codes' THEN
            -- Zona por codigo postal
            IF (p_delivery_address->>'postal_code') = ANY(
                SELECT jsonb_array_elements_text(v_zone.zone_definition->'codes')
            ) THEN
                RETURN QUERY SELECT
                    true::BOOLEAN,
                    v_zone.id,
                    v_zone.name::VARCHAR,
                    ROUND(v_distance, 2),
                    v_zone.estimated_time_minutes,
                    v_zone.delivery_fee,
                    v_zone.minimum_order_amount,
                    v_zone.free_delivery_threshold,
                    NULL::TEXT;
                RETURN;
            END IF;
        -- Para poligonos se requiere logica mas compleja (PostGIS)
        -- Por ahora usamos el radio como fallback
        END IF;
    END LOOP;

    -- Si no hay zonas configuradas, usar config general de service_options
    v_max_radius := COALESCE((v_service_options->'delivery_config'->>'max_radius_km')::DECIMAL, 5);

    IF v_distance <= v_max_radius THEN
        RETURN QUERY SELECT
            true::BOOLEAN,
            NULL::UUID,
            'Zona General'::VARCHAR,
            ROUND(v_distance, 2),
            COALESCE((v_service_options->'delivery_config'->>'estimated_time_minutes')::INTEGER, 30) +
                (v_distance * 3)::INTEGER, -- +3 min por km
            COALESCE((v_service_options->'delivery_config'->>'delivery_fee')::DECIMAL, 0),
            COALESCE((v_service_options->'delivery_config'->>'minimum_order_amount')::DECIMAL, 0),
            NULL::DECIMAL,
            NULL::TEXT;
        RETURN;
    END IF;

    -- Fuera de zona de cobertura
    RETURN QUERY SELECT
        false::BOOLEAN,
        NULL::UUID,
        NULL::VARCHAR,
        ROUND(v_distance, 2),
        NULL::INTEGER,
        NULL::DECIMAL,
        NULL::DECIMAL,
        NULL::DECIMAL,
        FORMAT('Lo sentimos, la direccion esta fuera de nuestra zona de cobertura (%.1f km, maximo %.1f km).',
               v_distance, v_max_radius)::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_delivery_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_delivery_details TO service_role;

COMMENT ON FUNCTION public.calculate_delivery_details IS
'Calcula detalles de delivery para una direccion:
- Verifica si esta dentro de zona de cobertura
- Calcula distancia
- Determina tarifa y tiempo estimado
- Retorna zona aplicable si existe

Parametros:
- p_tenant_id: ID del tenant
- p_branch_id: ID de la sucursal
- p_delivery_address: JSONB con direccion y coordenadas

Uso:
SELECT * FROM calculate_delivery_details(
  ''uuid-tenant'',
  ''uuid-branch'',
  ''{"street": "Calle X", "coordinates": {"lat": 31.31, "lng": -110.94}}''
);';

-- =====================================================
-- PASO 7: FUNCION PARA ASIGNAR REPARTIDOR
-- =====================================================

CREATE OR REPLACE FUNCTION public.assign_delivery_driver(
    p_order_id UUID,
    p_driver_id UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    driver_id UUID,
    driver_name VARCHAR,
    driver_phone VARCHAR,
    estimated_arrival_minutes INTEGER,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_driver RECORD;
    v_tenant_id UUID;
    v_branch_id UUID;
BEGIN
    -- Obtener info de la orden
    SELECT
        ro.id,
        ro.tenant_id,
        ro.branch_id,
        ro.order_type,
        ro.delivery_status,
        ro.delivery_driver_id as current_driver_id,
        ro.delivery_address
    INTO v_order
    FROM public.restaurant_orders ro
    WHERE ro.id = p_order_id;

    IF v_order IS NULL THEN
        RETURN QUERY SELECT
            false::BOOLEAN,
            NULL::UUID,
            NULL::VARCHAR,
            NULL::VARCHAR,
            NULL::INTEGER,
            'Orden no encontrada.'::TEXT;
        RETURN;
    END IF;

    IF v_order.order_type != 'delivery' THEN
        RETURN QUERY SELECT
            false::BOOLEAN,
            NULL::UUID,
            NULL::VARCHAR,
            NULL::VARCHAR,
            NULL::INTEGER,
            'Esta orden no es de tipo delivery.'::TEXT;
        RETURN;
    END IF;

    -- Si se especifica driver_id, asignar ese
    IF p_driver_id IS NOT NULL THEN
        SELECT * INTO v_driver
        FROM public.delivery_drivers
        WHERE id = p_driver_id
          AND tenant_id = v_order.tenant_id
          AND is_active = true;

        IF v_driver IS NULL THEN
            RETURN QUERY SELECT
                false::BOOLEAN,
                NULL::UUID,
                NULL::VARCHAR,
                NULL::VARCHAR,
                NULL::INTEGER,
                'Repartidor no encontrado o no esta activo.'::TEXT;
            RETURN;
        END IF;
    ELSE
        -- Auto-asignar repartidor disponible
        SELECT * INTO v_driver
        FROM public.delivery_drivers
        WHERE tenant_id = v_order.tenant_id
          AND is_active = true
          AND status = 'available'
        ORDER BY
            total_deliveries ASC, -- Preferir repartidores con menos entregas (balanceo)
            average_rating DESC   -- Luego por mejor rating
        LIMIT 1;

        IF v_driver IS NULL THEN
            RETURN QUERY SELECT
                false::BOOLEAN,
                NULL::UUID,
                NULL::VARCHAR,
                NULL::VARCHAR,
                NULL::INTEGER,
                'No hay repartidores disponibles en este momento.'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Actualizar la orden
    UPDATE public.restaurant_orders
    SET
        delivery_driver_id = v_driver.id,
        delivery_status = 'driver_assigned',
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Actualizar estado del repartidor
    UPDATE public.delivery_drivers
    SET
        status = 'busy',
        updated_at = NOW()
    WHERE id = v_driver.id;

    -- Registrar en tracking
    INSERT INTO public.delivery_tracking (
        tenant_id,
        order_id,
        driver_id,
        status,
        notes,
        created_by
    ) VALUES (
        v_order.tenant_id,
        p_order_id,
        v_driver.id,
        'driver_assigned',
        FORMAT('Repartidor %s asignado', v_driver.full_name),
        auth.uid()
    );

    RETURN QUERY SELECT
        true::BOOLEAN,
        v_driver.id,
        v_driver.full_name::VARCHAR,
        v_driver.phone::VARCHAR,
        15::INTEGER, -- Tiempo estimado de llegada al restaurante
        NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_delivery_driver TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_delivery_driver TO service_role;

COMMENT ON FUNCTION public.assign_delivery_driver IS
'Asigna un repartidor a una orden de delivery.
Si no se especifica driver_id, auto-asigna uno disponible.

Parametros:
- p_order_id: ID de la orden
- p_driver_id: (Opcional) ID del repartidor especifico

Retorna:
- success: Si la asignacion fue exitosa
- driver_id, driver_name, driver_phone: Info del repartidor
- estimated_arrival_minutes: Tiempo estimado de llegada al restaurante
- message: Mensaje de error si aplica';

-- =====================================================
-- PASO 8: TRIGGER PARA TRACKING AUTOMATICO
-- =====================================================

CREATE OR REPLACE FUNCTION public.track_delivery_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo para ordenes de delivery
    IF NEW.order_type != 'delivery' THEN
        RETURN NEW;
    END IF;

    -- Si cambio el estado de delivery
    IF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status AND NEW.delivery_status IS NOT NULL THEN
        -- Registrar en tracking
        INSERT INTO public.delivery_tracking (
            tenant_id,
            order_id,
            driver_id,
            status,
            notes,
            created_by
        ) VALUES (
            NEW.tenant_id,
            NEW.id,
            NEW.delivery_driver_id,
            NEW.delivery_status,
            CASE NEW.delivery_status
                WHEN 'pending_assignment' THEN 'Orden creada, pendiente de asignar repartidor'
                WHEN 'driver_assigned' THEN 'Repartidor asignado'
                WHEN 'driver_arrived' THEN 'Repartidor llego al restaurante'
                WHEN 'picked_up' THEN 'Pedido recogido por repartidor'
                WHEN 'in_transit' THEN 'En camino al cliente'
                WHEN 'arriving' THEN 'Llegando al destino'
                WHEN 'delivered' THEN 'Entregado exitosamente'
                WHEN 'failed' THEN COALESCE('Entrega fallida: ' || NEW.delivery_failure_reason, 'Entrega fallida')
                WHEN 'returned' THEN COALESCE('Devuelto: ' || NEW.delivery_failure_reason, 'Devuelto al restaurante')
                ELSE 'Estado actualizado'
            END,
            auth.uid()
        );

        -- Si se entrego, actualizar timestamps y metricas
        IF NEW.delivery_status = 'delivered' AND NEW.actual_delivery_at IS NULL THEN
            NEW.actual_delivery_at := NOW();

            -- Actualizar metricas del repartidor
            IF NEW.delivery_driver_id IS NOT NULL THEN
                UPDATE public.delivery_drivers
                SET
                    total_deliveries = total_deliveries + 1,
                    successful_deliveries = successful_deliveries + 1,
                    status = 'available',
                    updated_at = NOW()
                WHERE id = NEW.delivery_driver_id;
            END IF;
        END IF;

        -- Si fallo o fue devuelto, liberar repartidor
        IF NEW.delivery_status IN ('failed', 'returned') AND NEW.delivery_driver_id IS NOT NULL THEN
            UPDATE public.delivery_drivers
            SET
                total_deliveries = total_deliveries + 1,
                status = 'available',
                updated_at = NOW()
            WHERE id = NEW.delivery_driver_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_track_delivery_status ON public.restaurant_orders;
CREATE TRIGGER trigger_track_delivery_status
    BEFORE UPDATE ON public.restaurant_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.track_delivery_status_change();

-- =====================================================
-- PASO 9: FUNCION PARA ACTUALIZAR ESTADO DE DELIVERY
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_delivery_status(
    p_order_id UUID,
    p_status VARCHAR(30),
    p_driver_location JSONB DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_failure_reason VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    order_id UUID,
    new_status VARCHAR,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_valid_transitions TEXT[];
BEGIN
    -- Obtener orden actual
    SELECT
        ro.id,
        ro.tenant_id,
        ro.order_type,
        ro.delivery_status,
        ro.delivery_driver_id
    INTO v_order
    FROM public.restaurant_orders ro
    WHERE ro.id = p_order_id;

    IF v_order IS NULL THEN
        RETURN QUERY SELECT
            false::BOOLEAN,
            NULL::UUID,
            NULL::VARCHAR,
            'Orden no encontrada.'::TEXT;
        RETURN;
    END IF;

    IF v_order.order_type != 'delivery' THEN
        RETURN QUERY SELECT
            false::BOOLEAN,
            NULL::UUID,
            NULL::VARCHAR,
            'Esta orden no es de tipo delivery.'::TEXT;
        RETURN;
    END IF;

    -- Validar transiciones de estado permitidas
    v_valid_transitions := CASE v_order.delivery_status
        WHEN 'pending_assignment' THEN ARRAY['driver_assigned', 'failed']
        WHEN 'driver_assigned' THEN ARRAY['driver_arrived', 'picked_up', 'failed']
        WHEN 'driver_arrived' THEN ARRAY['picked_up', 'failed']
        WHEN 'picked_up' THEN ARRAY['in_transit', 'failed', 'returned']
        WHEN 'in_transit' THEN ARRAY['arriving', 'delivered', 'failed', 'returned']
        WHEN 'arriving' THEN ARRAY['delivered', 'failed', 'returned']
        WHEN 'delivered' THEN ARRAY[]::TEXT[] -- Estado final
        WHEN 'failed' THEN ARRAY['pending_assignment']::TEXT[] -- Puede reintentar
        WHEN 'returned' THEN ARRAY[]::TEXT[] -- Estado final
        ELSE ARRAY[]::TEXT[]
    END;

    IF NOT (p_status = ANY(v_valid_transitions)) THEN
        RETURN QUERY SELECT
            false::BOOLEAN,
            v_order.id,
            v_order.delivery_status::VARCHAR,
            FORMAT('Transicion no valida: %s -> %s', v_order.delivery_status, p_status)::TEXT;
        RETURN;
    END IF;

    -- Actualizar orden
    UPDATE public.restaurant_orders
    SET
        delivery_status = p_status,
        delivery_failure_reason = CASE
            WHEN p_status IN ('failed', 'returned') THEN p_failure_reason
            ELSE NULL
        END,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Si hay ubicacion del repartidor, guardar en tracking con mas detalle
    IF p_driver_location IS NOT NULL THEN
        INSERT INTO public.delivery_tracking (
            tenant_id,
            order_id,
            driver_id,
            status,
            driver_location,
            notes,
            created_by
        ) VALUES (
            v_order.tenant_id,
            p_order_id,
            v_order.delivery_driver_id,
            p_status,
            p_driver_location,
            p_notes,
            auth.uid()
        );
    END IF;

    RETURN QUERY SELECT
        true::BOOLEAN,
        p_order_id,
        p_status::VARCHAR,
        NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_delivery_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_delivery_status TO service_role;

COMMENT ON FUNCTION public.update_delivery_status IS
'Actualiza el estado de delivery de una orden.
Valida transiciones de estado permitidas.

Parametros:
- p_order_id: ID de la orden
- p_status: Nuevo estado de delivery
- p_driver_location: (Opcional) Ubicacion GPS del repartidor
- p_notes: (Opcional) Notas adicionales
- p_failure_reason: (Requerido si status = failed/returned) Razon del fallo

Estados y transiciones validas:
pending_assignment -> driver_assigned, failed
driver_assigned -> driver_arrived, picked_up, failed
driver_arrived -> picked_up, failed
picked_up -> in_transit, failed, returned
in_transit -> arriving, delivered, failed, returned
arriving -> delivered, failed, returned
delivered -> (final)
failed -> pending_assignment (reintentar)
returned -> (final)';

-- =====================================================
-- PASO 10: INDICES ADICIONALES PARA PERFORMANCE
-- =====================================================

-- Ordenes de delivery pendientes por tenant
CREATE INDEX IF NOT EXISTS idx_orders_delivery_pending
    ON public.restaurant_orders(tenant_id, created_at DESC)
    WHERE order_type = 'delivery'
      AND delivery_status IN ('pending_assignment', 'driver_assigned');

-- Ordenes de delivery en transito por driver
CREATE INDEX IF NOT EXISTS idx_orders_delivery_by_driver
    ON public.restaurant_orders(delivery_driver_id, delivery_status)
    WHERE delivery_driver_id IS NOT NULL
      AND delivery_status IN ('driver_assigned', 'picked_up', 'in_transit', 'arriving');

-- =====================================================
-- PASO 11: VISTAS UTILES
-- =====================================================

-- Vista de ordenes de delivery activas
CREATE OR REPLACE VIEW public.v_active_delivery_orders AS
SELECT
    ro.id,
    ro.tenant_id,
    ro.branch_id,
    ro.display_number,
    ro.order_type,
    ro.status as order_status,
    ro.delivery_status,
    ro.delivery_address,
    ro.delivery_fee,
    ro.delivery_distance_km,
    ro.estimated_delivery_at,
    ro.total,
    ro.customer_notes,
    ro.delivery_instructions,
    ro.created_at,
    ro.ordered_at,
    -- Info del repartidor
    dd.id as delivery_driver_id,
    dd.full_name as driver_name,
    dd.phone as driver_phone,
    dd.vehicle_type,
    dd.current_location as driver_location,
    -- Sucursal
    b.name as branch_name
FROM public.restaurant_orders ro
LEFT JOIN public.delivery_drivers dd ON ro.delivery_driver_id = dd.id
LEFT JOIN public.branches b ON ro.branch_id = b.id
WHERE ro.order_type = 'delivery'
  AND ro.delivery_status NOT IN ('delivered', 'failed', 'returned')
  AND ro.status != 'cancelled';

COMMENT ON VIEW public.v_active_delivery_orders IS
'Vista de ordenes de delivery en proceso.
Incluye info del repartidor y sucursal.
Excluye ordenes completadas, fallidas o canceladas.';

-- =====================================================
-- PASO 12: VERIFICACION DE MIGRACION
-- =====================================================

DO $$
DECLARE
    v_column_count INTEGER;
    v_table_count INTEGER;
    v_function_count INTEGER;
BEGIN
    -- Verificar columnas nuevas en restaurant_orders
    SELECT COUNT(*) INTO v_column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurant_orders'
      AND column_name IN ('delivery_status', 'estimated_delivery_at', 'actual_delivery_at',
                          'delivery_distance_km', 'delivery_failure_reason', 'delivery_driver_id');

    -- Verificar tablas nuevas
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('delivery_drivers', 'delivery_zones', 'delivery_tracking');

    -- Verificar funciones
    SELECT COUNT(*) INTO v_function_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN ('calculate_delivery_details', 'assign_delivery_driver',
                           'update_delivery_status', 'track_delivery_status_change');

    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'VERIFICACION MIGRACION 156 - DELIVERY SYSTEM';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Columnas nuevas en restaurant_orders: %/6', v_column_count;
    RAISE NOTICE 'Tablas nuevas: %/3', v_table_count;
    RAISE NOTICE 'Funciones nuevas: %/4', v_function_count;
    RAISE NOTICE '=====================================================';

    IF v_column_count < 6 OR v_table_count < 3 OR v_function_count < 4 THEN
        RAISE WARNING 'Migracion incompleta. Revisar errores anteriores.';
    ELSE
        RAISE NOTICE 'Migracion 156 completada exitosamente.';
    END IF;
END $$;

-- =====================================================
-- FIN MIGRACION 156
-- =====================================================

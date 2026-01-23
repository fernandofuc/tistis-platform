-- =====================================================
-- TIS TIS PLATFORM - SOFT RESTAURANT INTEGRATION
-- Migration: 152_SR_CONSOLIDATED_FINAL.sql
-- Date: 2026-01-23
-- Version: FINAL CONSOLIDATED (CORREGIDO)
--
-- PURPOSE: Sistema completo para integración con Soft Restaurant POS
-- - Recepción de ventas via webhook
-- - Deducción automática de inventario
-- - Cola de procesamiento asíncrono
-- - Alertas de stock bajo
--
-- CONSOLIDATES: Migrations 159, 160, 161 (all iterations 152-158 were drafts)
--
-- ARCHITECTURE:
-- - sr_sales: Ventas recibidas de Soft Restaurant
-- - sr_sale_items: Productos de cada venta
-- - sr_payments: Pagos de cada venta
-- - sr_product_mappings: Mapeo productos SR → TIS TIS (en 156, preservado)
--
-- CORRECCION: Usa get_user_tenant_id() en lugar de user_tenants
-- =====================================================

-- =====================================================
-- PART 1: CORE TABLES
-- =====================================================

-- Verificar que no hay datos existentes antes de recrear
DO $$
DECLARE
    v_sales_exist BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'sr_sales'
    ) INTO v_sales_exist;

    IF v_sales_exist THEN
        DECLARE
            v_count INTEGER;
        BEGIN
            EXECUTE 'SELECT COUNT(*) FROM public.sr_sales' INTO v_count;
            IF v_count > 0 THEN
                RAISE EXCEPTION 'sr_sales contains % records. Backup data before running this migration.', v_count;
            END IF;
        EXCEPTION
            WHEN undefined_table THEN
                NULL;
        END;
    END IF;

    RAISE NOTICE 'Pre-flight check passed. Safe to proceed.';
END $$;

-- Drop existing tables if empty (CASCADE handles dependencies)
DROP TABLE IF EXISTS public.sr_payments CASCADE;
DROP TABLE IF EXISTS public.sr_sale_items CASCADE;
DROP TABLE IF EXISTS public.sr_sales CASCADE;

-- =====================================================
-- TABLE: sr_sales
-- Ventas recibidas de SoftRestaurant via webhook
-- =====================================================

CREATE TABLE public.sr_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,

    -- SR identifiers
    folio_venta VARCHAR(100) NOT NULL,
    store_code VARCHAR(50),
    customer_code VARCHAR(50),

    -- Table and server
    table_number VARCHAR(50),
    user_code VARCHAR(50),

    -- Timing
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,

    -- Totals
    subtotal_without_tax DECIMAL(12,4) NOT NULL DEFAULT 0,
    total_tax DECIMAL(12,4) NOT NULL DEFAULT 0,
    total_discounts DECIMAL(12,4) DEFAULT 0,
    total_tips DECIMAL(12,4) DEFAULT 0,
    total DECIMAL(12,4) NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'MXN',

    -- Guest info
    guest_count INTEGER,
    sale_type VARCHAR(50),
    notes TEXT,

    -- Processing status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'queued', 'processing', 'processed', 'failed', 'dead_letter', 'duplicate'
    )),
    processed_at TIMESTAMPTZ,
    restaurant_order_id UUID REFERENCES public.restaurant_orders(id) ON DELETE SET NULL,

    -- Queue processing fields
    queued_at TIMESTAMPTZ,
    processing_started_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,

    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Metadata
    raw_payload JSONB,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Uniqueness constraint
    CONSTRAINT unique_sr_sale_folio UNIQUE(tenant_id, integration_id, folio_venta)
);

-- Indexes for sr_sales
CREATE INDEX idx_sr_sales_tenant_branch ON public.sr_sales(tenant_id, branch_id);
CREATE INDEX idx_sr_sales_status ON public.sr_sales(status) WHERE status IN ('pending', 'failed');
CREATE INDEX idx_sr_sales_folio ON public.sr_sales(folio_venta);
CREATE INDEX idx_sr_sales_integration ON public.sr_sales(integration_id);
CREATE INDEX idx_sr_sales_created_at ON public.sr_sales(created_at DESC);
CREATE INDEX idx_sr_sales_queue_priority ON public.sr_sales (status, next_retry_at, created_at)
    WHERE status IN ('queued', 'pending');
CREATE INDEX idx_sr_sales_dead_letter ON public.sr_sales (tenant_id, created_at DESC)
    WHERE status = 'dead_letter';
CREATE INDEX idx_sr_sales_processing_timeout ON public.sr_sales (processing_started_at)
    WHERE status = 'processing';

-- RLS for sr_sales (CORREGIDO: usa get_user_tenant_id())
ALTER TABLE public.sr_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_sr_sales ON public.sr_sales
    FOR ALL
    USING (tenant_id = public.get_user_tenant_id())
    WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY service_role_sr_sales ON public.sr_sales
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.sr_sales IS
'Ventas recibidas de SoftRestaurant POS via webhook.
PROCESSING FLOW: pending -> queued -> processing -> processed/failed/dead_letter';

-- =====================================================
-- TABLE: sr_sale_items
-- Items individuales de cada venta SR
-- =====================================================

CREATE TABLE public.sr_sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sr_sales(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Product identification
    product_code VARCHAR(100) NOT NULL,
    product_name VARCHAR(500) NOT NULL,

    -- Quantities and pricing
    quantity DECIMAL(10,4) NOT NULL,
    unit_price DECIMAL(12,4) NOT NULL,
    subtotal_without_tax DECIMAL(12,4) NOT NULL,
    discount_amount DECIMAL(12,4) DEFAULT 0,
    tax_amount DECIMAL(12,4) DEFAULT 0,

    -- Tax details
    tax_details JSONB,

    -- Modifications
    modifiers TEXT[],
    notes TEXT,

    -- Server tracking
    user_code VARCHAR(50),
    item_timestamp TIMESTAMPTZ,

    -- Mapping to TIS TIS menu
    mapped_menu_item_id UUID REFERENCES public.restaurant_menu_items(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sr_sale_items
CREATE INDEX idx_sr_sale_items_sale ON public.sr_sale_items(sale_id);
CREATE INDEX idx_sr_sale_items_product_code ON public.sr_sale_items(product_code);
CREATE INDEX idx_sr_sale_items_mapped ON public.sr_sale_items(mapped_menu_item_id)
    WHERE mapped_menu_item_id IS NOT NULL;

-- RLS for sr_sale_items (CORREGIDO)
ALTER TABLE public.sr_sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_sr_sale_items ON public.sr_sale_items
    FOR ALL
    USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY service_role_sr_sale_items ON public.sr_sale_items
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.sr_sale_items IS 'Items individuales de ventas SR.';

-- =====================================================
-- TABLE: sr_payments
-- Pagos de cada venta SR
-- =====================================================

CREATE TABLE public.sr_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sr_sales(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,

    -- Payment details
    payment_method VARCHAR(100) NOT NULL,
    amount DECIMAL(12,4) NOT NULL,
    currency VARCHAR(10) DEFAULT 'MXN',

    -- References
    payment_reference VARCHAR(200),
    card_last_four VARCHAR(4),

    -- Tips
    tip_amount DECIMAL(12,4) DEFAULT 0,
    payment_timestamp TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for sr_payments
CREATE INDEX idx_sr_payments_sale ON public.sr_payments(sale_id);
CREATE INDEX idx_sr_payments_method ON public.sr_payments(payment_method);

-- RLS for sr_payments (CORREGIDO)
ALTER TABLE public.sr_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_sr_payments ON public.sr_payments
    FOR ALL
    USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY service_role_sr_payments ON public.sr_payments
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.sr_payments IS 'Pagos de ventas SR.';

-- =====================================================
-- PART 2: VALIDATION TRIGGERS
-- =====================================================

-- Trigger: Validate branch_id match with integration
CREATE OR REPLACE FUNCTION public.validate_sr_sale_branch_match()
RETURNS TRIGGER AS $$
DECLARE
    v_integration_branch_id UUID;
BEGIN
    SELECT branch_id INTO v_integration_branch_id
    FROM public.integration_connections
    WHERE id = NEW.integration_id;

    IF v_integration_branch_id IS NULL THEN
        RAISE EXCEPTION 'integration_connections.branch_id is NULL for integration_id %', NEW.integration_id;
    END IF;

    IF NEW.branch_id != v_integration_branch_id THEN
        RAISE EXCEPTION 'sr_sales.branch_id (%) does not match integration_connections.branch_id (%)',
            NEW.branch_id, v_integration_branch_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_sr_sale_branch_match ON public.sr_sales;
CREATE TRIGGER trigger_validate_sr_sale_branch_match
    BEFORE INSERT OR UPDATE ON public.sr_sales
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_sr_sale_branch_match();

-- Trigger: Validate sale_items branch/tenant match
CREATE OR REPLACE FUNCTION public.validate_sr_sale_item_branch_match()
RETURNS TRIGGER AS $$
DECLARE
    v_sale_branch_id UUID;
    v_sale_tenant_id UUID;
BEGIN
    SELECT branch_id, tenant_id INTO v_sale_branch_id, v_sale_tenant_id
    FROM public.sr_sales
    WHERE id = NEW.sale_id;

    IF NEW.branch_id != v_sale_branch_id THEN
        RAISE EXCEPTION 'sr_sale_items.branch_id must match sr_sales.branch_id';
    END IF;

    IF NEW.tenant_id != v_sale_tenant_id THEN
        RAISE EXCEPTION 'sr_sale_items.tenant_id must match sr_sales.tenant_id';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_sr_sale_item_branch ON public.sr_sale_items;
CREATE TRIGGER trigger_validate_sr_sale_item_branch
    BEFORE INSERT OR UPDATE ON public.sr_sale_items
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_sr_sale_item_branch_match();

-- Trigger: Validate payment branch/tenant match
CREATE OR REPLACE FUNCTION public.validate_sr_payment_branch_match()
RETURNS TRIGGER AS $$
DECLARE
    v_sale_branch_id UUID;
    v_sale_tenant_id UUID;
BEGIN
    SELECT branch_id, tenant_id INTO v_sale_branch_id, v_sale_tenant_id
    FROM public.sr_sales
    WHERE id = NEW.sale_id;

    IF NEW.branch_id != v_sale_branch_id THEN
        RAISE EXCEPTION 'sr_payments.branch_id must match sr_sales.branch_id';
    END IF;

    IF NEW.tenant_id != v_sale_tenant_id THEN
        RAISE EXCEPTION 'sr_payments.tenant_id must match sr_sales.tenant_id';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_sr_payment_branch ON public.sr_payments;
CREATE TRIGGER trigger_validate_sr_payment_branch
    BEFORE INSERT OR UPDATE ON public.sr_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_sr_payment_branch_match();

-- Trigger: Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_sr_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sr_sales_updated_at ON public.sr_sales;
CREATE TRIGGER trigger_sr_sales_updated_at
    BEFORE UPDATE ON public.sr_sales
    FOR EACH ROW
    EXECUTE FUNCTION public.update_sr_sales_updated_at();

DROP TRIGGER IF EXISTS trigger_sr_sale_items_updated_at ON public.sr_sale_items;
CREATE TRIGGER trigger_sr_sale_items_updated_at
    BEFORE UPDATE ON public.sr_sale_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_sr_sales_updated_at();

-- Trigger: Calculate tax_amount from JSONB
CREATE OR REPLACE FUNCTION public.calculate_tax_amount_from_json()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tax_amount := COALESCE(
        (SELECT SUM((tax->>'Importe')::DECIMAL(12,4))
         FROM jsonb_array_elements(NEW.tax_details->'Impuestos') AS tax),
        0
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_tax_amount ON public.sr_sale_items;
CREATE TRIGGER trigger_calculate_tax_amount
    BEFORE INSERT OR UPDATE ON public.sr_sale_items
    FOR EACH ROW
    WHEN (NEW.tax_details IS NOT NULL)
    EXECUTE FUNCTION public.calculate_tax_amount_from_json();

-- Trigger: Queue timestamps
CREATE OR REPLACE FUNCTION public.trigger_sr_sales_queue_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'queued' AND (OLD.status IS NULL OR OLD.status != 'queued') THEN
        NEW.queued_at := COALESCE(NEW.queued_at, NOW());
    END IF;

    IF NEW.status = 'processing' AND (OLD.status IS NULL OR OLD.status != 'processing') THEN
        NEW.processing_started_at := COALESCE(NEW.processing_started_at, NOW());
    END IF;

    IF NEW.status NOT IN ('queued', 'failed') THEN
        NEW.next_retry_at := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sr_sales_queue_timestamps ON public.sr_sales;
CREATE TRIGGER trigger_sr_sales_queue_timestamps
    BEFORE UPDATE ON public.sr_sales
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_sr_sales_queue_timestamps();

-- =====================================================
-- PART 3: HELPER FUNCTIONS
-- =====================================================

-- Function: Set session branch_id for RLS
CREATE OR REPLACE FUNCTION public.set_session_branch_id(p_branch_id UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_branch_id', p_branch_id::TEXT, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.set_session_branch_id(UUID) IS
'Sets the session variable app.current_branch_id for RLS branch isolation.';

-- Function: Increment product mapping stats
CREATE OR REPLACE FUNCTION public.increment_sr_product_mapping_stats(
    p_tenant_id UUID,
    p_branch_id UUID,
    p_integration_id UUID,
    p_product_code TEXT
)
RETURNS void AS $$
BEGIN
    UPDATE public.sr_product_mappings
    SET
        times_sold = times_sold + 1,
        last_sold_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND branch_id = p_branch_id
      AND integration_id = p_integration_id
      AND sr_product_code = p_product_code;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.increment_sr_product_mapping_stats IS
'Atomically increments times_sold for SR product mapping.';

-- Function: Get pending SR sales count
CREATE OR REPLACE FUNCTION public.get_pending_sr_sales_count(
    p_tenant_id UUID,
    p_branch_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF p_branch_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count
        FROM public.sr_sales
        WHERE tenant_id = p_tenant_id
          AND branch_id = p_branch_id
          AND status = 'pending';
    ELSE
        SELECT COUNT(*) INTO v_count
        FROM public.sr_sales
        WHERE tenant_id = p_tenant_id
          AND status = 'pending';
    END IF;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_pending_sr_sales_count IS
'Returns count of pending SR sales for a tenant/branch.';

-- Function: Get unmapped SR products
CREATE OR REPLACE FUNCTION public.get_unmapped_sr_products(
    p_tenant_id UUID,
    p_branch_id UUID,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    sr_product_code TEXT,
    sr_product_name TEXT,
    times_sold INTEGER,
    last_sold_at TIMESTAMPTZ,
    total_revenue DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.sr_product_code,
        m.sr_product_name,
        m.times_sold,
        m.last_sold_at,
        COALESCE(SUM(i.subtotal_without_tax + i.tax_amount - i.discount_amount), 0) AS total_revenue
    FROM public.sr_product_mappings m
    LEFT JOIN public.sr_sale_items i ON i.product_code = m.sr_product_code
        AND i.tenant_id = m.tenant_id
        AND i.branch_id = m.branch_id
    WHERE m.tenant_id = p_tenant_id
      AND m.branch_id = p_branch_id
      AND m.menu_item_id IS NULL
      AND m.is_active = false
    GROUP BY m.sr_product_code, m.sr_product_name, m.times_sold, m.last_sold_at
    ORDER BY m.times_sold DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_unmapped_sr_products IS
'Returns list of SR products that need manual mapping.';

-- =====================================================
-- PART 4: QUEUE PROCESSING FUNCTIONS
-- =====================================================

-- Function: Atomic batch claim for queue processing
CREATE OR REPLACE FUNCTION public.claim_sr_sales_batch(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        SELECT sr.id
        FROM public.sr_sales sr
        WHERE sr.status IN ('queued', 'pending')
          AND (sr.next_retry_at IS NULL OR sr.next_retry_at <= NOW())
        ORDER BY
            CASE sr.status
                WHEN 'queued' THEN 0
                WHEN 'pending' THEN 1
            END,
            sr.created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.sr_sales s
    SET
        status = 'processing',
        processing_started_at = NOW()
    FROM claimed c
    WHERE s.id = c.id
    RETURNING s.id;
END;
$$;

COMMENT ON FUNCTION public.claim_sr_sales_batch IS
'Atomic claim para procesar ventas SR en batch. Usa SELECT FOR UPDATE SKIP LOCKED.';

-- Function: Get queue statistics
CREATE OR REPLACE FUNCTION public.get_sr_queue_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
    pending_count BIGINT,
    queued_count BIGINT,
    processing_count BIGINT,
    processed_today BIGINT,
    failed_today BIGINT,
    dead_letter_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
        COUNT(*) FILTER (WHERE status = 'queued') AS queued_count,
        COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
        COUNT(*) FILTER (WHERE status = 'processed' AND processed_at >= v_today_start) AS processed_today,
        COUNT(*) FILTER (WHERE status = 'failed' AND updated_at >= v_today_start) AS failed_today,
        COUNT(*) FILTER (WHERE status = 'dead_letter') AS dead_letter_count
    FROM public.sr_sales
    WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
END;
$$;

COMMENT ON FUNCTION public.get_sr_queue_stats IS 'Obtiene estadísticas de la cola de procesamiento SR.';

-- Function: Recover stale processing jobs
CREATE OR REPLACE FUNCTION public.recover_stale_sr_sales(
    p_timeout_minutes INTEGER DEFAULT 5
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recovered INTEGER;
BEGIN
    WITH recovered AS (
        UPDATE public.sr_sales
        SET
            status = 'queued',
            processing_started_at = NULL,
            error_message = 'Recovered from stale processing state after ' || p_timeout_minutes || ' minutes'
        WHERE status = 'processing'
          AND processing_started_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_recovered FROM recovered;

    IF v_recovered > 0 THEN
        RAISE NOTICE '[SR Queue] Recovered % stale sales from processing state', v_recovered;
    END IF;

    RETURN v_recovered;
END;
$$;

COMMENT ON FUNCTION public.recover_stale_sr_sales IS 'Recupera ventas atascadas en estado processing.';

-- =====================================================
-- PART 5: PERMISSIONS
-- =====================================================

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.set_session_branch_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_sr_product_mapping_stats(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_sr_sales_count(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unmapped_sr_products(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sr_sales_batch(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sr_queue_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stale_sr_sales(INTEGER) TO authenticated;

-- Service role gets full access
GRANT EXECUTE ON FUNCTION public.set_session_branch_id(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_sr_product_mapping_stats(UUID, UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_sr_sales_count(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_unmapped_sr_products(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_sr_sales_batch(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sr_queue_stats(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_stale_sr_sales(INTEGER) TO service_role;

-- =====================================================
-- COMPLETION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '======================================================';
    RAISE NOTICE 'Migration 152_SR_CONSOLIDATED_FINAL.sql COMPLETED';
    RAISE NOTICE '======================================================';
    RAISE NOTICE 'TABLES: sr_sales, sr_sale_items, sr_payments';
    RAISE NOTICE 'FUNCTIONS: claim_sr_sales_batch, get_sr_queue_stats, recover_stale_sr_sales';
    RAISE NOTICE 'RLS: Enabled with get_user_tenant_id()';
    RAISE NOTICE '======================================================';
END $$;

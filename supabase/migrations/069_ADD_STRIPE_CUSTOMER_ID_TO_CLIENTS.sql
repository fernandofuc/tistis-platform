-- =====================================================
-- MIGRATION 069: Add stripe_customer_id to clients table
-- Fixes: Error al crear información de facturación
-- =====================================================

-- Add stripe_customer_id column to clients if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clients'
        AND column_name = 'stripe_customer_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.clients ADD COLUMN stripe_customer_id VARCHAR(255);
        RAISE NOTICE '✅ Added stripe_customer_id column to clients table';
    ELSE
        RAISE NOTICE '✅ stripe_customer_id column already exists in clients table';
    END IF;
END $$;

-- Create index on stripe_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer_id ON public.clients(stripe_customer_id);

-- Create unique index to prevent duplicate Stripe customers per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_tenant_stripe_unique
ON public.clients(tenant_id, stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- Grant necessary permissions to service role
GRANT SELECT, INSERT, UPDATE ON public.clients TO service_role;

-- Verification
DO $$
DECLARE
    v_has_stripe_customer_id BOOLEAN;
    v_has_tenant_id BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clients'
        AND column_name = 'stripe_customer_id'
        AND table_schema = 'public'
    ) INTO v_has_stripe_customer_id;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clients'
        AND column_name = 'tenant_id'
        AND table_schema = 'public'
    ) INTO v_has_tenant_id;

    RAISE NOTICE '✅ Migration 069 completed';
    RAISE NOTICE '   - clients.stripe_customer_id exists: %', v_has_stripe_customer_id;
    RAISE NOTICE '   - clients.tenant_id exists: %', v_has_tenant_id;
END $$;

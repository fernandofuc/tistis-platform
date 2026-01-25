-- =====================================================
-- TIS TIS PLATFORM - Migration 157
-- Add UNIQUE constraint on clients.contact_email for UPSERT support
-- =====================================================
-- PURPOSE: Enable atomic UPSERT operations in Stripe webhook
-- to prevent race condition duplicates
--
-- STRATEGY:
-- 1. Handle existing duplicates by keeping most recent
-- 2. Create partial unique index for clients WITHOUT tenant_id
-- 3. Create composite unique index for clients WITH tenant_id
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Check and handle existing duplicates
-- Keep the most recently updated record for each email
-- =====================================================

DO $$
DECLARE
    v_duplicate_count INTEGER;
BEGIN
    -- Count duplicates for clients without tenant_id
    SELECT COUNT(*) INTO v_duplicate_count
    FROM (
        SELECT LOWER(contact_email) as email, COUNT(*) as cnt
        FROM public.clients
        WHERE tenant_id IS NULL
        GROUP BY LOWER(contact_email)
        HAVING COUNT(*) > 1
    ) dups;

    IF v_duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate email groups (without tenant_id). Cleaning up...', v_duplicate_count;

        -- Delete duplicates, keeping the most recent (by updated_at, then created_at, then id)
        DELETE FROM public.clients c1
        WHERE c1.tenant_id IS NULL
        AND EXISTS (
            SELECT 1 FROM public.clients c2
            WHERE c2.tenant_id IS NULL
            AND LOWER(c2.contact_email) = LOWER(c1.contact_email)
            AND c2.id != c1.id
            AND (
                c2.updated_at > c1.updated_at
                OR (c2.updated_at = c1.updated_at AND c2.created_at > c1.created_at)
                OR (c2.updated_at = c1.updated_at AND c2.created_at = c1.created_at AND c2.id > c1.id)
            )
        );

        RAISE NOTICE 'Duplicate cleanup completed';
    ELSE
        RAISE NOTICE 'No duplicates found for clients without tenant_id';
    END IF;

    -- Count duplicates for clients WITH tenant_id
    SELECT COUNT(*) INTO v_duplicate_count
    FROM (
        SELECT tenant_id, LOWER(contact_email) as email, COUNT(*) as cnt
        FROM public.clients
        WHERE tenant_id IS NOT NULL
        GROUP BY tenant_id, LOWER(contact_email)
        HAVING COUNT(*) > 1
    ) dups;

    IF v_duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate email groups (with tenant_id). Cleaning up...', v_duplicate_count;

        -- Delete duplicates within same tenant, keeping most recent
        DELETE FROM public.clients c1
        WHERE c1.tenant_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.clients c2
            WHERE c2.tenant_id = c1.tenant_id
            AND LOWER(c2.contact_email) = LOWER(c1.contact_email)
            AND c2.id != c1.id
            AND (
                c2.updated_at > c1.updated_at
                OR (c2.updated_at = c1.updated_at AND c2.created_at > c1.created_at)
                OR (c2.updated_at = c1.updated_at AND c2.created_at = c1.created_at AND c2.id > c1.id)
            )
        );

        RAISE NOTICE 'Duplicate cleanup completed';
    ELSE
        RAISE NOTICE 'No duplicates found for clients with tenant_id';
    END IF;
END $$;

-- =====================================================
-- STEP 2: Drop existing indexes if they exist
-- =====================================================

DROP INDEX IF EXISTS idx_clients_email_unique_no_tenant;
DROP INDEX IF EXISTS idx_clients_tenant_email_unique;
DROP INDEX IF EXISTS idx_clients_contact_email_lower;

-- =====================================================
-- STEP 3: Create case-insensitive index on contact_email
-- For faster lookups regardless of case
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_clients_contact_email_lower
ON public.clients (LOWER(contact_email));

-- =====================================================
-- STEP 4: Create PARTIAL UNIQUE index for clients WITHOUT tenant_id
-- This ensures unique emails during initial signup (before provisioning)
-- NOTE: Using contact_email directly (not LOWER) because we enforce
-- lowercase at application level. This allows Supabase UPSERT to work.
-- =====================================================

CREATE UNIQUE INDEX idx_clients_email_unique_no_tenant
ON public.clients (contact_email)
WHERE tenant_id IS NULL;

COMMENT ON INDEX idx_clients_email_unique_no_tenant IS
'Ensures unique email addresses for clients not yet assigned to a tenant (during signup/checkout). Emails must be stored lowercase.';

-- =====================================================
-- STEP 5: Create COMPOSITE UNIQUE index for clients WITH tenant_id
-- This allows the same email to exist in different tenants
-- but prevents duplicates within the same tenant
-- =====================================================

CREATE UNIQUE INDEX idx_clients_tenant_email_unique
ON public.clients (tenant_id, contact_email)
WHERE tenant_id IS NOT NULL;

COMMENT ON INDEX idx_clients_tenant_email_unique IS
'Ensures unique email addresses per tenant for multi-tenant isolation';

-- =====================================================
-- STEP 6: Verify indexes were created
-- =====================================================

DO $$
DECLARE
    v_idx1_exists BOOLEAN;
    v_idx2_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_clients_email_unique_no_tenant'
    ) INTO v_idx1_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_clients_tenant_email_unique'
    ) INTO v_idx2_exists;

    IF v_idx1_exists AND v_idx2_exists THEN
        RAISE NOTICE 'SUCCESS: Both unique indexes created successfully';
    ELSE
        RAISE EXCEPTION 'FAILED: One or more indexes were not created';
    END IF;
END $$;

COMMIT;

-- =====================================================
-- VERIFICATION QUERY (run after migration)
-- =====================================================
--
-- SELECT
--     indexname,
--     indexdef
-- FROM pg_indexes
-- WHERE tablename = 'clients'
-- AND indexname LIKE '%email%';
-- =====================================================

-- =====================================================
-- MIGRATION 077: Fix Duplicate Subscriptions
--
-- Prevents duplicate subscriptions by:
-- 1. Adding UNIQUE constraint on stripe_subscription_id
-- 2. Adding UNIQUE constraint on (client_id, status) for active subs
-- 3. Cleaning up existing duplicates
-- =====================================================

-- Step 1: Identify and log duplicates before cleanup
DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count
    FROM (
        SELECT stripe_subscription_id, COUNT(*) as cnt
        FROM subscriptions
        WHERE stripe_subscription_id IS NOT NULL
        GROUP BY stripe_subscription_id
        HAVING COUNT(*) > 1
    ) duplicates;

    IF dup_count > 0 THEN
        RAISE NOTICE '⚠️ Found % duplicate stripe_subscription_ids - will keep only the oldest', dup_count;
    ELSE
        RAISE NOTICE '✅ No duplicate stripe_subscription_ids found';
    END IF;
END $$;

-- Step 2: Remove duplicate subscriptions (keep the oldest one)
-- This deletes newer duplicates, keeping the original
DELETE FROM subscriptions
WHERE id IN (
    SELECT id FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY stripe_subscription_id
                ORDER BY created_at ASC
            ) as rn
        FROM subscriptions
        WHERE stripe_subscription_id IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- Step 3: Add UNIQUE constraint on stripe_subscription_id
-- This prevents future duplicates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'subscriptions_stripe_subscription_id_unique'
    ) THEN
        ALTER TABLE subscriptions
        ADD CONSTRAINT subscriptions_stripe_subscription_id_unique
        UNIQUE (stripe_subscription_id);
        RAISE NOTICE '✅ Added UNIQUE constraint on stripe_subscription_id';
    ELSE
        RAISE NOTICE '✅ UNIQUE constraint already exists on stripe_subscription_id';
    END IF;
END $$;

-- Step 4: Create partial unique index to prevent multiple active subs per client
-- Only one active subscription per client is allowed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_subscriptions_one_active_per_client'
    ) THEN
        CREATE UNIQUE INDEX idx_subscriptions_one_active_per_client
        ON subscriptions (client_id)
        WHERE status IN ('active', 'trialing');
        RAISE NOTICE '✅ Added unique index for one active subscription per client';
    ELSE
        RAISE NOTICE '✅ Unique index for active subscriptions already exists';
    END IF;
END $$;

-- Step 5: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id
ON subscriptions(stripe_subscription_id);

-- Verification
DO $$
DECLARE
    remaining_dups INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_dups
    FROM (
        SELECT stripe_subscription_id, COUNT(*) as cnt
        FROM subscriptions
        WHERE stripe_subscription_id IS NOT NULL
        GROUP BY stripe_subscription_id
        HAVING COUNT(*) > 1
    ) duplicates;

    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  Migration 077: Fix Duplicate Subscriptions';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  - Duplicate subscriptions remaining: %', remaining_dups;
    RAISE NOTICE '  - UNIQUE constraint on stripe_subscription_id: Added';
    RAISE NOTICE '  - Partial unique index for active subs: Added';
    RAISE NOTICE '=====================================================';
END $$;

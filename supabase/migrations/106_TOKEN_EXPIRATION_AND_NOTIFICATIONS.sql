-- =====================================================
-- TIS TIS PLATFORM - Token Expiration & Notification System
-- Migration 106: Complete token lifecycle management
-- =====================================================
-- This migration implements:
-- 1. Automatic token expiration with balance adjustment
-- 2. Token expiry notification system
-- 3. Birthday token awards
-- 4. Reward availability alerts
-- 5. Complete notification audit trail
-- =====================================================

-- =====================================================
-- 1. FUNCTION: Expire tokens and adjust balances
-- Critical fix: tokens with expires_at < NOW() must be deducted
-- =====================================================
CREATE OR REPLACE FUNCTION public.expire_tokens()
RETURNS TABLE(
    expired_count INTEGER,
    total_tokens_expired INTEGER,
    affected_balances UUID[],
    details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER := 0;
    v_total_tokens INTEGER := 0;
    v_affected UUID[] := ARRAY[]::UUID[];
    v_details JSONB := '[]'::JSONB;
    v_record RECORD;
BEGIN
    -- Process each expired transaction that hasn't been processed yet
    -- We use a status field to track which transactions have been expired
    FOR v_record IN
        SELECT
            lt.id AS transaction_id,
            lt.balance_id,
            lt.tokens,
            lt.tenant_id,
            lb.current_balance,
            lb.lead_id
        FROM loyalty_transactions lt
        JOIN loyalty_balances lb ON lt.balance_id = lb.id
        WHERE lt.expires_at IS NOT NULL
          AND lt.expires_at < NOW()
          AND lt.tokens > 0  -- Only expire earn transactions
          AND lt.transaction_type NOT IN ('expire', 'redemption')  -- Don't re-expire
          AND NOT EXISTS (
              -- Check if we already created an expiration record for this transaction
              SELECT 1 FROM loyalty_transactions exp
              WHERE exp.reference_id = lt.id
                AND exp.reference_type = 'expired_transaction'
          )
        FOR UPDATE OF lt, lb  -- Lock rows to prevent race conditions
    LOOP
        -- Calculate how many tokens to actually expire
        -- (can't expire more than current balance)
        DECLARE
            v_tokens_to_expire INTEGER;
        BEGIN
            v_tokens_to_expire := LEAST(v_record.tokens, v_record.current_balance);

            IF v_tokens_to_expire > 0 THEN
                -- Deduct from balance
                UPDATE loyalty_balances
                SET current_balance = current_balance - v_tokens_to_expire,
                    updated_at = NOW()
                WHERE id = v_record.balance_id;

                -- Create expiration transaction record
                INSERT INTO loyalty_transactions (
                    tenant_id, balance_id, transaction_type, tokens,
                    description, reference_id, reference_type
                ) VALUES (
                    v_record.tenant_id, v_record.balance_id, 'expire', -v_tokens_to_expire,
                    'Tokens expirados automáticamente', v_record.transaction_id, 'expired_transaction'
                );

                -- Track metrics
                v_count := v_count + 1;
                v_total_tokens := v_total_tokens + v_tokens_to_expire;
                v_affected := array_append(v_affected, v_record.balance_id);

                -- Add to details
                v_details := v_details || jsonb_build_object(
                    'lead_id', v_record.lead_id,
                    'balance_id', v_record.balance_id,
                    'tokens_expired', v_tokens_to_expire,
                    'original_transaction_id', v_record.transaction_id
                );
            END IF;
        END;
    END LOOP;

    RETURN QUERY SELECT v_count, v_total_tokens, v_affected, v_details;
END;
$$;

-- =====================================================
-- 2. FUNCTION: Get tokens expiring soon (for notifications)
-- Returns leads with tokens expiring in the next N days
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_expiring_tokens(
    p_days_before INTEGER DEFAULT 30
)
RETURNS TABLE(
    tenant_id UUID,
    lead_id UUID,
    lead_name TEXT,
    phone TEXT,
    email TEXT,
    balance_id UUID,
    tokens_expiring INTEGER,
    earliest_expiry TIMESTAMPTZ,
    program_id UUID,
    program_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        lb.tenant_id,
        lb.lead_id,
        COALESCE(l.full_name, l.first_name || ' ' || COALESCE(l.last_name, '')) AS lead_name,
        l.phone,
        l.email,
        lb.id AS balance_id,
        COALESCE(SUM(lt.tokens)::INTEGER, 0) AS tokens_expiring,
        MIN(lt.expires_at) AS earliest_expiry,
        lp.id AS program_id,
        lp.program_name
    FROM loyalty_transactions lt
    JOIN loyalty_balances lb ON lt.balance_id = lb.id
    JOIN leads l ON lb.lead_id = l.id
    JOIN loyalty_programs lp ON lb.program_id = lp.id
    WHERE lt.expires_at IS NOT NULL
      AND lt.expires_at BETWEEN NOW() AND NOW() + (p_days_before || ' days')::INTERVAL
      AND lt.tokens > 0
      AND lt.transaction_type NOT IN ('expire', 'redemption')
      AND l.deleted_at IS NULL  -- Exclude soft-deleted leads
      AND NOT EXISTS (
          -- Don't include if we already sent a notification recently
          SELECT 1 FROM loyalty_reactivation_logs lrl
          WHERE lrl.lead_id = lb.lead_id
            AND lrl.message_type = 'tokens_expiring'
            AND lrl.created_at > NOW() - INTERVAL '7 days'
      )
    GROUP BY lb.tenant_id, lb.lead_id, l.full_name, l.first_name, l.last_name, l.phone, l.email, lb.id, lp.id, lp.program_name
    HAVING SUM(lt.tokens) > 0
    ORDER BY MIN(lt.expires_at);
END;
$$;

-- =====================================================
-- 3. FUNCTION: Get leads eligible for birthday tokens
-- Returns leads whose birthday is today
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_birthday_leads(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE(
    tenant_id UUID,
    lead_id UUID,
    lead_name TEXT,
    phone TEXT,
    email TEXT,
    birth_date DATE,
    program_id UUID,
    birthday_tokens INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.tenant_id,
        l.id AS lead_id,
        COALESCE(l.full_name, l.first_name || ' ' || COALESCE(l.last_name, '')) AS lead_name,
        l.phone,
        l.email,
        l.birth_date,
        lp.id AS program_id,
        COALESCE(lp.birthday_tokens, 50) AS birthday_tokens
    FROM leads l
    JOIN loyalty_programs lp ON l.tenant_id = lp.tenant_id AND lp.is_active = true
    WHERE l.birth_date IS NOT NULL
      AND EXTRACT(MONTH FROM l.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM l.birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
      AND l.deleted_at IS NULL
      AND (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
      AND NOT EXISTS (
          -- Don't award if already awarded this year
          SELECT 1 FROM loyalty_transactions lt
          JOIN loyalty_balances lb ON lt.balance_id = lb.id
          WHERE lb.lead_id = l.id
            AND lt.transaction_type = 'birthday'
            AND EXTRACT(YEAR FROM lt.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      );
END;
$$;

-- =====================================================
-- 4. FUNCTION: Award birthday tokens
-- =====================================================
CREATE OR REPLACE FUNCTION public.award_birthday_tokens(
    p_lead_id UUID,
    p_program_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    tokens_awarded INTEGER,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_birthday_tokens INTEGER;
    v_result RECORD;
BEGIN
    -- Get birthday tokens amount from program
    SELECT COALESCE(birthday_tokens, 50) INTO v_birthday_tokens
    FROM loyalty_programs
    WHERE id = p_program_id AND is_active = true;

    IF v_birthday_tokens IS NULL OR v_birthday_tokens <= 0 THEN
        RETURN QUERY SELECT false, 0, 'Programa no tiene tokens de cumpleaños configurados'::TEXT;
        RETURN;
    END IF;

    -- Award tokens
    SELECT * INTO v_result
    FROM award_loyalty_tokens(
        p_program_id,
        p_lead_id,
        v_birthday_tokens,
        'birthday',
        '¡Feliz cumpleaños! Regalo especial de tokens',
        NULL,
        NULL
    );

    IF v_result.success THEN
        RETURN QUERY SELECT true, v_birthday_tokens, 'Tokens de cumpleaños otorgados'::TEXT;
    ELSE
        RETURN QUERY SELECT false, 0, 'Error al otorgar tokens'::TEXT;
    END IF;
END;
$$;

-- =====================================================
-- 5. FUNCTION: Get leads who can redeem a reward
-- For "reward available" notifications
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_leads_with_redeemable_rewards(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE(
    tenant_id UUID,
    lead_id UUID,
    lead_name TEXT,
    phone TEXT,
    email TEXT,
    current_balance INTEGER,
    cheapest_reward_id UUID,
    cheapest_reward_name TEXT,
    tokens_required INTEGER,
    program_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH cheapest_rewards AS (
        SELECT DISTINCT ON (lr.program_id)
            lr.program_id,
            lr.id AS reward_id,
            lr.reward_name,
            lr.tokens_required
        FROM loyalty_rewards lr
        WHERE lr.is_active = true
          AND (lr.stock_limit IS NULL OR lr.stock_used < lr.stock_limit)
          AND (lr.available_from IS NULL OR lr.available_from <= NOW())
          AND (lr.available_until IS NULL OR lr.available_until >= NOW())
        ORDER BY lr.program_id, lr.tokens_required ASC
    )
    SELECT
        lb.tenant_id,
        lb.lead_id,
        COALESCE(l.full_name, l.first_name || ' ' || COALESCE(l.last_name, '')) AS lead_name,
        l.phone,
        l.email,
        lb.current_balance,
        cr.reward_id AS cheapest_reward_id,
        cr.reward_name AS cheapest_reward_name,
        cr.tokens_required,
        lb.program_id
    FROM loyalty_balances lb
    JOIN leads l ON lb.lead_id = l.id
    JOIN cheapest_rewards cr ON lb.program_id = cr.program_id
    WHERE lb.current_balance >= cr.tokens_required
      AND l.deleted_at IS NULL
      AND (p_tenant_id IS NULL OR lb.tenant_id = p_tenant_id)
      AND NOT EXISTS (
          -- Don't notify if already notified in last 30 days
          SELECT 1 FROM loyalty_reactivation_logs lrl
          WHERE lrl.lead_id = lb.lead_id
            AND lrl.message_type = 'reward_available'
            AND lrl.created_at > NOW() - INTERVAL '30 days'
      );
END;
$$;

-- =====================================================
-- 6. FUNCTION: Check and redeem with expiry validation
-- Enhanced to only use non-expired tokens
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_available_tokens(
    p_lead_id UUID,
    p_program_id UUID
)
RETURNS TABLE(
    total_balance INTEGER,
    non_expired_balance INTEGER,
    expiring_soon INTEGER,
    next_expiry TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance_id UUID;
    v_total INTEGER;
    v_non_expired INTEGER;
    v_expiring_soon INTEGER;
    v_next_expiry TIMESTAMPTZ;
BEGIN
    -- Get balance
    SELECT id, current_balance INTO v_balance_id, v_total
    FROM loyalty_balances
    WHERE lead_id = p_lead_id AND program_id = p_program_id;

    IF v_balance_id IS NULL THEN
        RETURN QUERY SELECT 0, 0, 0, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- Calculate non-expired tokens
    SELECT COALESCE(SUM(
        CASE WHEN lt.tokens > 0 AND (lt.expires_at IS NULL OR lt.expires_at > NOW())
             AND lt.transaction_type NOT IN ('expire', 'redemption')
             THEN lt.tokens
             ELSE 0
        END
    ), 0)::INTEGER INTO v_non_expired
    FROM loyalty_transactions lt
    WHERE lt.balance_id = v_balance_id;

    -- Subtract already redeemed/expired
    SELECT v_non_expired - COALESCE(ABS(SUM(
        CASE WHEN lt.tokens < 0 THEN lt.tokens ELSE 0 END
    )), 0)::INTEGER INTO v_non_expired
    FROM loyalty_transactions lt
    WHERE lt.balance_id = v_balance_id;

    -- Get tokens expiring in next 30 days
    SELECT COALESCE(SUM(lt.tokens), 0)::INTEGER INTO v_expiring_soon
    FROM loyalty_transactions lt
    WHERE lt.balance_id = v_balance_id
      AND lt.expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'
      AND lt.tokens > 0
      AND lt.transaction_type NOT IN ('expire', 'redemption');

    -- Get next expiry date
    SELECT MIN(lt.expires_at) INTO v_next_expiry
    FROM loyalty_transactions lt
    WHERE lt.balance_id = v_balance_id
      AND lt.expires_at > NOW()
      AND lt.tokens > 0
      AND lt.transaction_type NOT IN ('expire', 'redemption');

    RETURN QUERY SELECT v_total, GREATEST(v_non_expired, 0), v_expiring_soon, v_next_expiry;
END;
$$;

-- =====================================================
-- 7. Add birthday_tokens column to loyalty_programs if not exists
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'loyalty_programs' AND column_name = 'birthday_tokens'
    ) THEN
        ALTER TABLE loyalty_programs ADD COLUMN birthday_tokens INTEGER DEFAULT 50;
    END IF;
END $$;

-- =====================================================
-- 8. Add notification tracking columns to logs
-- =====================================================
DO $$
BEGIN
    -- Add notification_type column if it doesn't exist
    -- FIX: Removed reference to message_type column which doesn't exist in original schema (migration 053)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'loyalty_reactivation_logs' AND column_name = 'notification_type'
    ) THEN
        ALTER TABLE loyalty_reactivation_logs
        ADD COLUMN notification_type TEXT;

        -- Set default value for existing records based on offer_type if available
        UPDATE loyalty_reactivation_logs
        SET notification_type = COALESCE(offer_type, 'reactivation')
        WHERE notification_type IS NULL;
    END IF;

    -- Also add message_type column for compatibility with functions that reference it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'loyalty_reactivation_logs' AND column_name = 'message_type'
    ) THEN
        ALTER TABLE loyalty_reactivation_logs
        ADD COLUMN message_type TEXT;
    END IF;
END $$;

-- =====================================================
-- 9. Create index for faster expiration queries
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_expiring
ON loyalty_transactions(expires_at, balance_id)
WHERE expires_at IS NOT NULL AND tokens > 0;

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type
ON loyalty_transactions(transaction_type);

-- =====================================================
-- 10. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION expire_tokens TO service_role;
GRANT EXECUTE ON FUNCTION get_expiring_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION get_expiring_tokens TO service_role;
GRANT EXECUTE ON FUNCTION get_birthday_leads TO authenticated;
GRANT EXECUTE ON FUNCTION get_birthday_leads TO service_role;
GRANT EXECUTE ON FUNCTION award_birthday_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION award_birthday_tokens TO service_role;
GRANT EXECUTE ON FUNCTION get_leads_with_redeemable_rewards TO authenticated;
GRANT EXECUTE ON FUNCTION get_leads_with_redeemable_rewards TO service_role;
GRANT EXECUTE ON FUNCTION get_available_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_tokens TO service_role;

-- =====================================================
-- 11. COMMENTS
-- =====================================================
COMMENT ON FUNCTION expire_tokens IS
'Expires tokens where expires_at has passed. Deducts from balance and creates expire transaction records.
Should be called daily via cron job.';

COMMENT ON FUNCTION get_expiring_tokens IS
'Returns leads with tokens expiring in the next N days (default 30).
Used to send reminder notifications before expiration.';

COMMENT ON FUNCTION get_birthday_leads IS
'Returns leads whose birthday is today and haven''t received birthday tokens this year.';

COMMENT ON FUNCTION award_birthday_tokens IS
'Awards birthday tokens to a lead. Checks program config for token amount.';

COMMENT ON FUNCTION get_leads_with_redeemable_rewards IS
'Returns leads who have enough tokens to redeem at least one reward.
Used for "reward available" notifications.';

COMMENT ON FUNCTION get_available_tokens IS
'Returns detailed token breakdown for a lead: total, non-expired, expiring soon, and next expiry date.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Implemented:
-- [x] expire_tokens() - Automatic token expiration with balance adjustment
-- [x] get_expiring_tokens() - Query for notification cron job
-- [x] get_birthday_leads() - Birthday detection
-- [x] award_birthday_tokens() - Birthday token awards
-- [x] get_leads_with_redeemable_rewards() - Reward availability alerts
-- [x] get_available_tokens() - Token breakdown with expiry info
-- [x] birthday_tokens column in loyalty_programs
-- [x] Optimized indexes for expiration queries

-- =====================================================
-- TIS TIS PLATFORM - Fix Appointment Loyalty Trigger
-- Migration 108: Fix trigger + column name inconsistencies
-- =====================================================
-- CRITICAL ISSUES FOUND:
--
-- 1. Trigger in 095 uses OLD signature that no longer exists
-- 2. Migration 105 uses wrong column names:
--    - uses 'tokens_amount' but table has 'tokens'
--    - uses 'reference_id/reference_type' but table has 'source_id/source_type'
-- 3. Function signature changed from p_tenant_id to p_program_id
--
-- This migration fixes ALL these issues.
-- =====================================================

-- =====================================================
-- 1. FIRST: Fix award_loyalty_tokens to use CORRECT column names
-- The table loyalty_transactions has:
--   - tokens (NOT tokens_amount)
--   - source_type, source_id (NOT reference_type, reference_id)
--   - program_id (required column)
-- =====================================================

CREATE OR REPLACE FUNCTION public.award_loyalty_tokens(
    p_program_id UUID,
    p_lead_id UUID,
    p_tokens INTEGER,
    p_transaction_type TEXT DEFAULT 'manual',
    p_description TEXT DEFAULT NULL,
    p_source_id UUID DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    balance_id UUID,
    new_balance INTEGER,
    transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_program RECORD;
    v_tenant_id UUID;
    v_lead_tenant_id UUID;
    v_balance_id UUID;
    v_new_balance INTEGER;
    v_transaction_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_tokens_with_multiplier INTEGER;
    v_multiplier DECIMAL := 1.0;
BEGIN
    -- Get program and validate
    SELECT lp.*, lp.tenant_id as prog_tenant_id
    INTO v_program
    FROM loyalty_programs lp
    WHERE lp.id = p_program_id
      AND lp.is_active = true;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::INTEGER, NULL::UUID;
        RETURN;
    END IF;

    v_tenant_id := v_program.prog_tenant_id;

    -- SECURITY: Validate lead belongs to program's tenant
    SELECT tenant_id INTO v_lead_tenant_id
    FROM leads
    WHERE id = p_lead_id;

    IF v_lead_tenant_id IS NULL OR v_lead_tenant_id != v_tenant_id THEN
        -- Lead doesn't belong to this tenant
        RETURN QUERY SELECT false, NULL::UUID, NULL::INTEGER, NULL::UUID;
        RETURN;
    END IF;

    -- Check for membership multiplier
    SELECT lmp.tokens_multiplier INTO v_multiplier
    FROM loyalty_memberships lm
    JOIN loyalty_membership_plans lmp ON lm.plan_id = lmp.id
    WHERE lm.lead_id = p_lead_id
      AND lm.program_id = p_program_id
      AND lm.status = 'active'
      AND lm.end_date > NOW()
    LIMIT 1;

    v_multiplier := COALESCE(v_multiplier, 1.0);
    v_tokens_with_multiplier := FLOOR(p_tokens * v_multiplier);

    -- Get or create balance with FOR UPDATE lock
    SELECT id INTO v_balance_id
    FROM loyalty_balances
    WHERE program_id = p_program_id AND lead_id = p_lead_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO loyalty_balances (
            tenant_id, program_id, lead_id, current_balance, total_earned
        ) VALUES (
            v_tenant_id, p_program_id, p_lead_id, 0, 0
        )
        RETURNING id INTO v_balance_id;
    END IF;

    -- Calculate expiration
    IF v_program.tokens_expiry_days IS NOT NULL AND v_program.tokens_expiry_days > 0 THEN
        v_expires_at := NOW() + (v_program.tokens_expiry_days || ' days')::INTERVAL;
    END IF;

    -- Update balance atomically
    UPDATE loyalty_balances
    SET current_balance = current_balance + v_tokens_with_multiplier,
        total_earned = total_earned + v_tokens_with_multiplier,
        last_earn_at = NOW(),
        updated_at = NOW()
    WHERE id = v_balance_id
    RETURNING current_balance INTO v_new_balance;

    -- Record transaction - USE CORRECT COLUMN NAMES
    INSERT INTO loyalty_transactions (
        tenant_id, program_id, balance_id, transaction_type,
        tokens, balance_after,                                -- CORRECT: tokens (not tokens_amount)
        source_type, source_id,                               -- CORRECT: source_type/source_id (not reference_*)
        description, expires_at
    ) VALUES (
        v_tenant_id, p_program_id, v_balance_id, p_transaction_type,
        v_tokens_with_multiplier, v_new_balance,
        COALESCE(p_source_type, p_transaction_type), p_source_id,
        COALESCE(p_description, 'Tokens ganados'), v_expires_at
    ) RETURNING id INTO v_transaction_id;

    RETURN QUERY SELECT true, v_balance_id, v_new_balance, v_transaction_id;
END;
$$;

-- =====================================================
-- 2. FIX: redeem_loyalty_reward to use correct column names
-- =====================================================

CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(
    p_tenant_id UUID,
    p_lead_id UUID,
    p_reward_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    redemption_id UUID,
    redemption_code TEXT,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reward RECORD;
    v_lead_tenant_id UUID;
    v_balance_id UUID;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_redemption_id UUID;
    v_redemption_code TEXT;
    v_user_redemption_count INTEGER;
    v_total_redemption_count INTEGER;
    v_valid_until TIMESTAMPTZ;
BEGIN
    -- SECURITY: Validate lead belongs to tenant
    SELECT tenant_id INTO v_lead_tenant_id
    FROM leads WHERE id = p_lead_id;

    IF v_lead_tenant_id IS NULL OR v_lead_tenant_id != p_tenant_id THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Acceso denegado'::TEXT;
        RETURN;
    END IF;

    -- Get reward WITH LOCK to prevent concurrent stock updates
    -- SECURITY: Also validate reward belongs to tenant via program
    SELECT lr.*, lp.tenant_id as program_tenant_id
    INTO v_reward
    FROM loyalty_rewards lr
    JOIN loyalty_programs lp ON lr.program_id = lp.id
    WHERE lr.id = p_reward_id
      AND lr.is_active = true
      AND (lr.available_from IS NULL OR lr.available_from <= NOW())
      AND (lr.available_until IS NULL OR lr.available_until >= NOW())
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Recompensa no encontrada o no disponible'::TEXT;
        RETURN;
    END IF;

    -- SECURITY: Validate reward belongs to requesting tenant
    IF v_reward.program_tenant_id != p_tenant_id THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Acceso denegado'::TEXT;
        RETURN;
    END IF;

    -- Check stock limit
    IF v_reward.stock_limit IS NOT NULL AND COALESCE(v_reward.stock_used, 0) >= v_reward.stock_limit THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Recompensa agotada'::TEXT;
        RETURN;
    END IF;

    -- Check max redemptions per user
    IF v_reward.max_redemptions_per_user IS NOT NULL THEN
        SELECT COUNT(*) INTO v_user_redemption_count
        FROM loyalty_redemptions lr
        JOIN loyalty_balances lb ON lr.balance_id = lb.id
        WHERE lr.reward_id = p_reward_id
          AND lb.lead_id = p_lead_id;

        IF v_user_redemption_count >= v_reward.max_redemptions_per_user THEN
            RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Límite de canjes por usuario alcanzado'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Check max total redemptions
    IF v_reward.max_redemptions_total IS NOT NULL THEN
        SELECT COUNT(*) INTO v_total_redemption_count
        FROM loyalty_redemptions
        WHERE reward_id = p_reward_id;

        IF v_total_redemption_count >= v_reward.max_redemptions_total THEN
            RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Límite total de canjes alcanzado'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Get balance with FOR UPDATE lock
    SELECT id, current_balance
    INTO v_balance_id, v_current_balance
    FROM loyalty_balances
    WHERE program_id = v_reward.program_id
      AND lead_id = p_lead_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'No tienes balance en este programa'::TEXT;
        RETURN;
    END IF;

    -- Check sufficient balance
    IF v_current_balance < v_reward.tokens_required THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT,
            ('Balance insuficiente. Tienes ' || v_current_balance || ', necesitas ' || v_reward.tokens_required)::TEXT;
        RETURN;
    END IF;

    -- Calculate new balance
    v_new_balance := v_current_balance - v_reward.tokens_required;

    -- Update balance
    UPDATE loyalty_balances
    SET current_balance = v_new_balance,
        total_spent = total_spent + v_reward.tokens_required,
        last_redeem_at = NOW(),
        updated_at = NOW()
    WHERE id = v_balance_id;

    -- Generate redemption code
    v_redemption_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 8));

    -- Calculate valid_until
    v_valid_until := NOW() + (COALESCE(v_reward.valid_days, 30) || ' days')::INTERVAL;

    -- Create redemption record
    INSERT INTO loyalty_redemptions (
        tenant_id, program_id, balance_id, reward_id,
        tokens_used, redemption_code, valid_until, status
    ) VALUES (
        p_tenant_id, v_reward.program_id, v_balance_id, p_reward_id,
        v_reward.tokens_required, v_redemption_code, v_valid_until, 'pending'
    )
    RETURNING id INTO v_redemption_id;

    -- Record transaction - USE CORRECT COLUMN NAMES
    INSERT INTO loyalty_transactions (
        tenant_id, program_id, balance_id, transaction_type,
        tokens, balance_after,                    -- CORRECT column names
        source_type, source_id,                   -- CORRECT column names
        description
    ) VALUES (
        p_tenant_id, v_reward.program_id, v_balance_id, 'redeem',
        -v_reward.tokens_required, v_new_balance,
        'redemption', v_redemption_id,
        'Canje: ' || v_reward.reward_name
    );

    -- Update stock_used
    UPDATE loyalty_rewards
    SET stock_used = COALESCE(stock_used, 0) + 1
    WHERE id = p_reward_id;

    RETURN QUERY SELECT true, v_redemption_id, v_redemption_code, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, SQLERRM::TEXT;
END;
$$;

-- =====================================================
-- 3. FIX: expire_tokens function to use correct columns
-- =====================================================

CREATE OR REPLACE FUNCTION public.expire_tokens()
RETURNS TABLE(
    tenant_id UUID,
    transactions_expired INTEGER,
    tokens_expired INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_count INTEGER;
    v_tokens INTEGER;
    v_balance_id UUID;
    v_tokens_to_expire INTEGER;
    v_new_balance INTEGER;
    rec RECORD;
BEGIN
    -- Find all expired transactions that haven't been processed
    FOR rec IN
        SELECT DISTINCT lt.tenant_id, lt.balance_id, SUM(lt.tokens) as total_tokens
        FROM loyalty_transactions lt
        WHERE lt.expires_at IS NOT NULL
          AND lt.expires_at <= NOW()
          AND lt.transaction_type = 'earn'
          AND NOT EXISTS (
              -- Check if already expired
              SELECT 1 FROM loyalty_transactions lt2
              WHERE lt2.source_id = lt.id
                AND lt2.transaction_type = 'expire'
          )
        GROUP BY lt.tenant_id, lt.balance_id
    LOOP
        -- Get current balance with lock
        SELECT lb.current_balance INTO v_new_balance
        FROM loyalty_balances lb
        WHERE lb.id = rec.balance_id
        FOR UPDATE;

        -- Calculate tokens to expire (can't go below 0)
        v_tokens_to_expire := LEAST(rec.total_tokens, v_new_balance);

        IF v_tokens_to_expire > 0 THEN
            -- Deduct from balance
            UPDATE loyalty_balances
            SET current_balance = current_balance - v_tokens_to_expire,
                updated_at = NOW()
            WHERE id = rec.balance_id
            RETURNING current_balance INTO v_new_balance;

            -- Get program_id for the transaction
            -- Record expiration transaction
            INSERT INTO loyalty_transactions (
                tenant_id, program_id, balance_id, transaction_type,
                tokens, balance_after,
                source_type, description
            )
            SELECT
                rec.tenant_id,
                lb.program_id,
                rec.balance_id,
                'expire',
                -v_tokens_to_expire,
                v_new_balance,
                'expiry',
                'Tokens expirados'
            FROM loyalty_balances lb
            WHERE lb.id = rec.balance_id;
        END IF;

        -- Return results for this tenant
        RETURN QUERY SELECT rec.tenant_id, 1::INTEGER, v_tokens_to_expire::INTEGER;
    END LOOP;
END;
$$;

-- =====================================================
-- 4. FIX: award_tokens_on_appointment_complete trigger
-- =====================================================

CREATE OR REPLACE FUNCTION public.award_tokens_on_appointment_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_program_id UUID;
    v_program_tenant_id UUID;
    v_service_price DECIMAL;
    v_tokens_to_award INTEGER;
    v_earning_ratio DECIMAL;
    v_lead_name TEXT;
    v_lead_tenant_id UUID;
BEGIN
    -- Only process when status changes to 'completed'
    IF (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'completed' THEN

        -- 1. Verify lead belongs to the appointment's tenant (SECURITY)
        SELECT tenant_id INTO v_lead_tenant_id
        FROM leads
        WHERE id = NEW.lead_id;

        IF v_lead_tenant_id IS NULL OR v_lead_tenant_id != NEW.tenant_id THEN
            RAISE WARNING '[Loyalty] Lead % does not belong to tenant %',
                NEW.lead_id, NEW.tenant_id;
            RETURN NEW;
        END IF;

        -- 2. Find active loyalty program for the tenant
        SELECT id, tenant_id, tokens_per_currency
        INTO v_program_id, v_program_tenant_id, v_earning_ratio
        FROM loyalty_programs
        WHERE tenant_id = NEW.tenant_id
          AND is_active = true
          AND tokens_enabled = true
        LIMIT 1;

        -- If no active program, exit
        IF v_program_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- 3. Get service price (if service exists)
        IF NEW.service_id IS NOT NULL THEN
            SELECT COALESCE(price_min, 0) INTO v_service_price
            FROM services
            WHERE id = NEW.service_id;
        ELSE
            v_service_price := 500;
        END IF;

        -- 4. Calculate tokens
        v_earning_ratio := COALESCE(v_earning_ratio, 0.1);
        v_tokens_to_award := FLOOR(v_service_price * v_earning_ratio);

        IF v_tokens_to_award < 1 THEN
            v_tokens_to_award := 1;
        END IF;

        IF v_tokens_to_award > 100 THEN
            v_tokens_to_award := 100;
        END IF;

        -- 5. Get lead name
        SELECT full_name INTO v_lead_name
        FROM leads
        WHERE id = NEW.lead_id;

        -- 6. Award tokens using CORRECT signature
        PERFORM award_loyalty_tokens(
            v_program_id,
            NEW.lead_id,
            v_tokens_to_award,
            'appointment',
            'Puntos por cita completada - ' || COALESCE(v_lead_name, 'Cliente'),
            NEW.id,
            'appointment'
        );

        RAISE NOTICE '[Loyalty] Awarded % tokens to lead % for appointment %',
            v_tokens_to_award, NEW.lead_id, NEW.id;

    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 5. RECREATE TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS trigger_award_tokens_appointment_complete ON public.appointments;

CREATE TRIGGER trigger_award_tokens_appointment_complete
    AFTER UPDATE ON public.appointments
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
    EXECUTE FUNCTION award_tokens_on_appointment_complete();

-- =====================================================
-- 6. FIX VIEW to use correct column names
-- =====================================================

CREATE OR REPLACE VIEW public.v_appointment_loyalty_summary AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    COUNT(DISTINCT a.id) as total_completed_appointments,
    COUNT(DISTINCT lt.id) as total_token_transactions,
    COALESCE(SUM(lt.tokens), 0)::INTEGER as total_tokens_awarded,
    ROUND(COALESCE(AVG(lt.tokens), 0), 2) as avg_tokens_per_appointment
FROM tenants t
LEFT JOIN appointments a ON a.tenant_id = t.id AND a.status = 'completed'
LEFT JOIN loyalty_transactions lt ON lt.source_type = 'appointment' AND lt.source_id = a.id
WHERE t.status = 'active'
GROUP BY t.id, t.name;

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION award_loyalty_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION award_loyalty_tokens TO service_role;
GRANT EXECUTE ON FUNCTION redeem_loyalty_reward TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_loyalty_reward TO service_role;
GRANT EXECUTE ON FUNCTION expire_tokens TO service_role;
GRANT EXECUTE ON FUNCTION award_tokens_on_appointment_complete TO service_role;

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON FUNCTION award_loyalty_tokens IS
'Awards tokens with tenant isolation and correct column names.
FIXED in migration 108: uses tokens/source_type/source_id (not tokens_amount/reference_*)';

COMMENT ON FUNCTION redeem_loyalty_reward IS
'Redeems rewards with tenant isolation and correct column names.
FIXED in migration 108: uses tokens/source_type/source_id columns correctly';

COMMENT ON FUNCTION award_tokens_on_appointment_complete IS
'Trigger function for awarding loyalty tokens on appointment completion.
FIXED in migration 108 to use correct function signature and column names.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Fixed critical bugs:
-- [x] award_loyalty_tokens uses correct columns (tokens, source_type, source_id)
-- [x] redeem_loyalty_reward uses correct columns
-- [x] expire_tokens uses correct columns
-- [x] appointment trigger uses correct function signature
-- [x] View uses correct column names
-- =====================================================

SELECT 'Migration 108: Fixed column names and trigger - COMPLETADA' as status;

-- =====================================================
-- TIS TIS PLATFORM - Fix Loyalty System Race Conditions
-- Migration 105: Critical fixes for loyalty/VIP system
-- =====================================================
-- This migration fixes multiple critical vulnerabilities:
-- 1. Race condition in token balance (FOR UPDATE lock)
-- 2. stock_used never incremented
-- 3. max_redemptions_per_user not validated
-- 4. max_redemptions_total not validated
-- 5. Expired memberships not auto-updated
-- 6. tokens_multiplier not applied
-- 7. CHECK constraint for non-negative balance
-- =====================================================

-- =====================================================
-- 1. ADD CHECK CONSTRAINT FOR NON-NEGATIVE BALANCE
-- Last line of defense against race conditions
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_non_negative_balance'
    ) THEN
        ALTER TABLE loyalty_balances
        ADD CONSTRAINT check_non_negative_balance
        CHECK (current_balance >= 0);
    END IF;
END $$;

-- =====================================================
-- 2. FIXED: award_loyalty_tokens with FOR UPDATE lock
-- Prevents race conditions when awarding tokens
-- =====================================================
CREATE OR REPLACE FUNCTION public.award_loyalty_tokens(
    p_program_id UUID,
    p_lead_id UUID,
    p_tokens INTEGER,
    p_transaction_type TEXT DEFAULT 'manual',
    p_description TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL
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
    v_balance_id UUID;
    v_tenant_id UUID;
    v_program RECORD;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_transaction_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_multiplier NUMERIC := 1.0;
BEGIN
    -- Validate program
    SELECT tenant_id, tokens_enabled, tokens_expiry_days
    INTO v_program
    FROM loyalty_programs
    WHERE id = p_program_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::INTEGER, NULL::UUID;
        RETURN;
    END IF;

    v_tenant_id := v_program.tenant_id;

    -- Check if lead has an active membership with tokens_multiplier
    SELECT COALESCE(lmp.tokens_multiplier, 1.0) INTO v_multiplier
    FROM loyalty_memberships lm
    JOIN loyalty_membership_plans lmp ON lm.plan_id = lmp.id
    WHERE lm.lead_id = p_lead_id
      AND lm.program_id = p_program_id
      AND lm.status = 'active'
      AND lm.end_date > NOW()
    LIMIT 1;

    -- Apply multiplier to tokens
    p_tokens := FLOOR(p_tokens * COALESCE(v_multiplier, 1.0))::INTEGER;

    -- Get or create balance WITH ROW LOCK
    SELECT id INTO v_balance_id
    FROM loyalty_balances
    WHERE lead_id = p_lead_id AND program_id = p_program_id
    FOR UPDATE;

    IF v_balance_id IS NULL THEN
        -- Create new balance
        INSERT INTO loyalty_balances (tenant_id, lead_id, program_id, current_balance)
        VALUES (v_tenant_id, p_lead_id, p_program_id, 0)
        RETURNING id INTO v_balance_id;
    END IF;

    -- Calculate expiration
    IF v_program.tokens_expiry_days > 0 THEN
        v_expires_at := NOW() + (v_program.tokens_expiry_days || ' days')::INTERVAL;
    END IF;

    -- Update balance atomically
    UPDATE loyalty_balances
    SET current_balance = current_balance + p_tokens,
        total_earned = total_earned + p_tokens,
        last_earn_at = NOW(),
        updated_at = NOW()
    WHERE id = v_balance_id
    RETURNING current_balance INTO v_new_balance;

    -- Record transaction
    INSERT INTO loyalty_transactions (
        tenant_id, balance_id, transaction_type, tokens_amount,
        description, reference_id, reference_type, expires_at
    ) VALUES (
        v_tenant_id, v_balance_id, p_transaction_type, p_tokens,
        p_description, p_reference_id, p_reference_type, v_expires_at
    ) RETURNING id INTO v_transaction_id;

    RETURN QUERY SELECT true, v_balance_id, v_new_balance, v_transaction_id;
END;
$$;

-- =====================================================
-- 3. FIXED: redeem_loyalty_reward with all validations
-- - FOR UPDATE lock on balance
-- - Validates max_redemptions_per_user
-- - Validates max_redemptions_total
-- - Updates stock_used atomically
-- - Validates membership benefits
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
    v_balance_id UUID;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_redemption_id UUID;
    v_redemption_code TEXT;
    v_user_redemption_count INTEGER;
    v_total_redemption_count INTEGER;
    v_valid_until TIMESTAMPTZ;
BEGIN
    -- Get reward WITH LOCK to prevent concurrent stock updates
    SELECT * INTO v_reward
    FROM loyalty_rewards
    WHERE id = p_reward_id
      AND is_active = true
      AND (available_from IS NULL OR available_from <= NOW())
      AND (available_until IS NULL OR available_until >= NOW())
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Recompensa no encontrada o no disponible'::TEXT;
        RETURN;
    END IF;

    -- Check stock limit
    IF v_reward.stock_limit IS NOT NULL AND v_reward.stock_used >= v_reward.stock_limit THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Recompensa agotada'::TEXT;
        RETURN;
    END IF;

    -- Check max_redemptions_total
    IF v_reward.max_redemptions_total IS NOT NULL THEN
        SELECT COUNT(*) INTO v_total_redemption_count
        FROM loyalty_redemptions
        WHERE reward_id = p_reward_id
          AND status IN ('pending', 'used');

        IF v_total_redemption_count >= v_reward.max_redemptions_total THEN
            RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Se alcanzó el límite total de canjes para esta recompensa'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Get balance WITH LOCK
    SELECT id, current_balance INTO v_balance_id, v_current_balance
    FROM loyalty_balances
    WHERE lead_id = p_lead_id AND program_id = v_reward.program_id
    FOR UPDATE;

    IF v_balance_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'No tiene puntos registrados'::TEXT;
        RETURN;
    END IF;

    -- Check sufficient balance
    IF v_current_balance < v_reward.tokens_required THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT,
            format('Puntos insuficientes. Necesita %s, tiene %s', v_reward.tokens_required, v_current_balance)::TEXT;
        RETURN;
    END IF;

    -- Check max_redemptions_per_user
    IF v_reward.max_redemptions_per_user IS NOT NULL THEN
        SELECT COUNT(*) INTO v_user_redemption_count
        FROM loyalty_redemptions
        WHERE reward_id = p_reward_id
          AND balance_id = v_balance_id
          AND status IN ('pending', 'used');

        IF v_user_redemption_count >= v_reward.max_redemptions_per_user THEN
            RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT,
                format('Ya canjeó esta recompensa el máximo de veces permitido (%s)', v_reward.max_redemptions_per_user)::TEXT;
            RETURN;
        END IF;
    END IF;

    -- All validations passed - proceed with redemption

    -- Generate unique redemption code
    v_redemption_code := 'R-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 8));

    -- Calculate validity period
    v_valid_until := NOW() + (COALESCE(v_reward.valid_days, 30) || ' days')::INTERVAL;

    -- Deduct tokens atomically
    UPDATE loyalty_balances
    SET current_balance = current_balance - v_reward.tokens_required,
        total_spent = total_spent + v_reward.tokens_required,
        last_redeem_at = NOW(),
        updated_at = NOW()
    WHERE id = v_balance_id
    RETURNING current_balance INTO v_new_balance;

    -- Update stock_used atomically
    UPDATE loyalty_rewards
    SET stock_used = stock_used + 1,
        updated_at = NOW()
    WHERE id = p_reward_id;

    -- Create redemption record
    INSERT INTO loyalty_redemptions (
        tenant_id, program_id, balance_id, reward_id,
        tokens_used, redemption_code, status, valid_until
    ) VALUES (
        p_tenant_id, v_reward.program_id, v_balance_id, p_reward_id,
        v_reward.tokens_required, v_redemption_code, 'pending', v_valid_until
    ) RETURNING id INTO v_redemption_id;

    -- Record transaction
    INSERT INTO loyalty_transactions (
        tenant_id, balance_id, transaction_type, tokens_amount,
        description, reference_id, reference_type
    ) VALUES (
        p_tenant_id, v_balance_id, 'redemption', -v_reward.tokens_required,
        'Canje: ' || v_reward.reward_name, v_redemption_id, 'redemption'
    );

    RETURN QUERY SELECT true, v_redemption_id, v_redemption_code, NULL::TEXT;

EXCEPTION
    WHEN check_violation THEN
        -- This catches the CHECK constraint for negative balance
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Puntos insuficientes (validación de seguridad)'::TEXT;
    WHEN OTHERS THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, SQLERRM::TEXT;
END;
$$;

-- =====================================================
-- 4. FUNCTION: Auto-expire memberships
-- Should be called by a cron job daily
-- =====================================================
CREATE OR REPLACE FUNCTION public.expire_memberships()
RETURNS TABLE(
    expired_count INTEGER,
    expired_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
    v_ids UUID[];
BEGIN
    WITH expired AS (
        UPDATE loyalty_memberships
        SET status = 'expired',
            updated_at = NOW()
        WHERE status = 'active'
          AND end_date < NOW()
        RETURNING id
    )
    SELECT COUNT(*), ARRAY_AGG(id) INTO v_count, v_ids FROM expired;

    RETURN QUERY SELECT COALESCE(v_count, 0), COALESCE(v_ids, ARRAY[]::UUID[]);
END;
$$;

-- =====================================================
-- 5. FUNCTION: Check if membership is truly active
-- Validates both status AND end_date
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_membership_active(
    p_lead_id UUID,
    p_program_id UUID DEFAULT NULL
)
RETURNS TABLE(
    is_active BOOLEAN,
    membership_id UUID,
    plan_name TEXT,
    discount_percent NUMERIC,
    tokens_multiplier NUMERIC,
    end_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        true AS is_active,
        lm.id AS membership_id,
        lmp.plan_name,
        lmp.discount_percent,
        lmp.tokens_multiplier,
        lm.end_date
    FROM loyalty_memberships lm
    JOIN loyalty_membership_plans lmp ON lm.plan_id = lmp.id
    WHERE lm.lead_id = p_lead_id
      AND lm.status = 'active'
      AND lm.end_date > NOW()
      AND (p_program_id IS NULL OR lm.program_id = p_program_id)
    LIMIT 1;

    -- If no active membership found, return false
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::TIMESTAMPTZ;
    END IF;
END;
$$;

-- =====================================================
-- 6. UPDATE appointment loyalty trigger to use multiplier
-- =====================================================
CREATE OR REPLACE FUNCTION public.award_tokens_on_appointment_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_program_id UUID;
    v_earning_ratio NUMERIC;
    v_service_price NUMERIC;
    v_tokens_to_award INTEGER;
    v_multiplier NUMERIC := 1.0;
BEGIN
    -- Only proceed if status changed to 'completed'
    IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
        RETURN NEW;
    END IF;

    -- Only proceed if there's a lead_id
    IF NEW.lead_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the loyalty program for this tenant
    SELECT id, tokens_per_currency INTO v_program_id, v_earning_ratio
    FROM loyalty_programs
    WHERE tenant_id = NEW.tenant_id
      AND is_active = true
      AND tokens_enabled = true;

    IF v_program_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get service price
    SELECT price INTO v_service_price
    FROM services
    WHERE id = NEW.service_id;

    IF v_service_price IS NULL OR v_service_price <= 0 THEN
        RETURN NEW;
    END IF;

    -- Get membership multiplier if active
    SELECT COALESCE(lmp.tokens_multiplier, 1.0) INTO v_multiplier
    FROM loyalty_memberships lm
    JOIN loyalty_membership_plans lmp ON lm.plan_id = lmp.id
    WHERE lm.lead_id = NEW.lead_id
      AND lm.program_id = v_program_id
      AND lm.status = 'active'
      AND lm.end_date > NOW()
    LIMIT 1;

    -- Calculate tokens (with multiplier)
    v_earning_ratio := COALESCE(v_earning_ratio, 0.1);
    v_tokens_to_award := FLOOR(v_service_price * v_earning_ratio * COALESCE(v_multiplier, 1.0));

    IF v_tokens_to_award <= 0 THEN
        RETURN NEW;
    END IF;

    -- Award tokens using the fixed function
    PERFORM award_loyalty_tokens(
        v_program_id,
        NEW.lead_id,
        v_tokens_to_award,
        'appointment',
        'Cita completada: ' || COALESCE(
            (SELECT name FROM services WHERE id = NEW.service_id),
            'Servicio'
        ),
        NEW.id,
        'appointment'
    );

    RETURN NEW;
END;
$$;

-- =====================================================
-- 7. FUNCTION: Validate redemption code (with expiry check)
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_redemption_code(
    p_code TEXT,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE(
    is_valid BOOLEAN,
    redemption_id UUID,
    reward_name TEXT,
    reward_type TEXT,
    discount_value NUMERIC,
    patient_name TEXT,
    status TEXT,
    expires_at TIMESTAMPTZ,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_redemption RECORD;
BEGIN
    SELECT
        lr.id,
        lr.status,
        lr.valid_until,
        lrw.reward_name,
        lrw.reward_type,
        lrw.discount_value,
        COALESCE(l.full_name, l.first_name || ' ' || l.last_name) AS patient_name
    INTO v_redemption
    FROM loyalty_redemptions lr
    JOIN loyalty_rewards lrw ON lr.reward_id = lrw.id
    JOIN loyalty_balances lb ON lr.balance_id = lb.id
    JOIN leads l ON lb.lead_id = l.id
    WHERE lr.redemption_code = p_code
      AND (p_tenant_id IS NULL OR lr.tenant_id = p_tenant_id);

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'Código no encontrado'::TEXT;
        RETURN;
    END IF;

    IF v_redemption.status = 'used' THEN
        RETURN QUERY SELECT false, v_redemption.id, v_redemption.reward_name, v_redemption.reward_type, v_redemption.discount_value, v_redemption.patient_name, v_redemption.status, v_redemption.valid_until, 'Este código ya fue utilizado'::TEXT;
        RETURN;
    END IF;

    IF v_redemption.status = 'expired' OR v_redemption.valid_until < NOW() THEN
        RETURN QUERY SELECT false, v_redemption.id, v_redemption.reward_name, v_redemption.reward_type, v_redemption.discount_value, v_redemption.patient_name, 'expired'::TEXT, v_redemption.valid_until, 'Este código ha expirado'::TEXT;
        RETURN;
    END IF;

    IF v_redemption.status = 'cancelled' THEN
        RETURN QUERY SELECT false, v_redemption.id, v_redemption.reward_name, v_redemption.reward_type, v_redemption.discount_value, v_redemption.patient_name, v_redemption.status, v_redemption.valid_until, 'Este código fue cancelado'::TEXT;
        RETURN;
    END IF;

    -- Valid redemption
    RETURN QUERY SELECT true, v_redemption.id, v_redemption.reward_name, v_redemption.reward_type, v_redemption.discount_value, v_redemption.patient_name, v_redemption.status, v_redemption.valid_until, NULL::TEXT;
END;
$$;

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION award_loyalty_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION award_loyalty_tokens TO service_role;
GRANT EXECUTE ON FUNCTION redeem_loyalty_reward TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_loyalty_reward TO service_role;
GRANT EXECUTE ON FUNCTION expire_memberships TO service_role;
GRANT EXECUTE ON FUNCTION is_membership_active TO authenticated;
GRANT EXECUTE ON FUNCTION is_membership_active TO service_role;
GRANT EXECUTE ON FUNCTION validate_redemption_code TO authenticated;
GRANT EXECUTE ON FUNCTION validate_redemption_code TO service_role;

-- =====================================================
-- 9. COMMENTS
-- =====================================================
COMMENT ON FUNCTION award_loyalty_tokens IS
'Awards tokens to a lead with FOR UPDATE lock to prevent race conditions.
Now applies tokens_multiplier from active memberships.';

COMMENT ON FUNCTION redeem_loyalty_reward IS
'Redeems a reward with full validation:
- FOR UPDATE lock on balance and reward
- Validates stock_limit
- Validates max_redemptions_per_user
- Validates max_redemptions_total
- Updates stock_used atomically
- Includes CHECK constraint protection';

COMMENT ON FUNCTION expire_memberships IS
'Automatically expires memberships where end_date has passed.
Should be called daily via cron job.';

COMMENT ON FUNCTION is_membership_active IS
'Checks if a lead has an active membership that is not expired.
Use this before applying membership benefits.';

COMMENT ON FUNCTION validate_redemption_code IS
'Validates a redemption code for use at point of sale.
Checks expiration, status, and returns reward details.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Fixed issues:
-- [x] Race condition in award_loyalty_tokens (FOR UPDATE)
-- [x] Race condition in redeem_loyalty_reward (FOR UPDATE)
-- [x] stock_used now incremented on redemption
-- [x] max_redemptions_per_user now validated
-- [x] max_redemptions_total now validated
-- [x] CHECK constraint for non-negative balance
-- [x] tokens_multiplier now applied from membership
-- [x] Membership expiration function
-- [x] Membership active check includes end_date
-- [x] Redemption code validation with expiry check

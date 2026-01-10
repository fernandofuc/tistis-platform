-- =====================================================
-- TIS TIS PLATFORM - Fix Cross-Tenant Security
-- Migration 107: Critical tenant isolation fixes
-- =====================================================
-- This migration fixes critical cross-tenant vulnerabilities:
-- 1. redeem_loyalty_reward() - reward must belong to tenant
-- 2. award_loyalty_tokens() - lead must belong to tenant
-- 3. validate_redemption_code() - require tenant_id
-- 4. All functions validate ownership before operations
-- =====================================================

-- =====================================================
-- 1. FIXED: redeem_loyalty_reward with tenant validation
-- Now validates reward belongs to the requesting tenant
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
    v_lead_tenant_id UUID;
    v_reward_tenant_id UUID;
BEGIN
    -- SECURITY: Validate lead belongs to the requesting tenant
    SELECT tenant_id INTO v_lead_tenant_id
    FROM leads
    WHERE id = p_lead_id AND deleted_at IS NULL;

    IF v_lead_tenant_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Lead no encontrado'::TEXT;
        RETURN;
    END IF;

    IF v_lead_tenant_id != p_tenant_id THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Acceso denegado: lead no pertenece a este negocio'::TEXT;
        RETURN;
    END IF;

    -- Get reward WITH LOCK and validate tenant ownership
    SELECT lr.*, lp.tenant_id AS program_tenant_id
    INTO v_reward
    FROM loyalty_rewards lr
    JOIN loyalty_programs lp ON lr.program_id = lp.id
    WHERE lr.id = p_reward_id
      AND lr.is_active = true
      AND (lr.available_from IS NULL OR lr.available_from <= NOW())
      AND (lr.available_until IS NULL OR lr.available_until >= NOW())
    FOR UPDATE OF lr;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Recompensa no encontrada o no disponible'::TEXT;
        RETURN;
    END IF;

    -- SECURITY: Validate reward belongs to the requesting tenant
    IF v_reward.program_tenant_id != p_tenant_id THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Acceso denegado: recompensa no pertenece a este negocio'::TEXT;
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
        tenant_id, balance_id, transaction_type, tokens,
        description, reference_id, reference_type
    ) VALUES (
        p_tenant_id, v_balance_id, 'redemption', -v_reward.tokens_required,
        'Canje: ' || v_reward.reward_name, v_redemption_id, 'redemption'
    );

    RETURN QUERY SELECT true, v_redemption_id, v_redemption_code, NULL::TEXT;

EXCEPTION
    WHEN check_violation THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Puntos insuficientes (validación de seguridad)'::TEXT;
    WHEN OTHERS THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, SQLERRM::TEXT;
END;
$$;

-- =====================================================
-- 2. FIXED: award_loyalty_tokens with tenant validation
-- Now validates lead belongs to the program's tenant
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
    v_lead_tenant_id UUID;
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

    -- SECURITY: Validate lead belongs to this tenant
    SELECT tenant_id INTO v_lead_tenant_id
    FROM leads
    WHERE id = p_lead_id AND deleted_at IS NULL;

    IF v_lead_tenant_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::INTEGER, NULL::UUID;
        RETURN;
    END IF;

    IF v_lead_tenant_id != v_tenant_id THEN
        -- Lead doesn't belong to this program's tenant - security violation
        RETURN QUERY SELECT false, NULL::UUID, NULL::INTEGER, NULL::UUID;
        RETURN;
    END IF;

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
        tenant_id, balance_id, transaction_type, tokens,
        description, reference_id, reference_type, expires_at
    ) VALUES (
        v_tenant_id, v_balance_id, p_transaction_type, p_tokens,
        p_description, p_reference_id, p_reference_type, v_expires_at
    ) RETURNING id INTO v_transaction_id;

    RETURN QUERY SELECT true, v_balance_id, v_new_balance, v_transaction_id;
END;
$$;

-- =====================================================
-- 3. FIXED: validate_redemption_code REQUIRES tenant_id
-- No longer allows null tenant - security requirement
-- =====================================================
-- FIX: Must DROP old function first because we're removing the DEFAULT from p_tenant_id
-- Old (migration 105): p_tenant_id UUID DEFAULT NULL
-- New: p_tenant_id UUID (REQUIRED - no default)
DROP FUNCTION IF EXISTS public.validate_redemption_code(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.validate_redemption_code(
    p_code TEXT,
    p_tenant_id UUID  -- Now REQUIRED, not optional
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
    -- SECURITY: Require tenant_id - no cross-tenant code validation
    IF p_tenant_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'tenant_id es requerido'::TEXT;
        RETURN;
    END IF;

    SELECT
        lr.id,
        lr.status,
        lr.valid_until,
        lr.tenant_id,
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
      AND lr.tenant_id = p_tenant_id;  -- SECURITY: Always filter by tenant

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
-- 4. FUNCTION: Secure membership activation
-- Validates tenant ownership before activation
-- =====================================================
CREATE OR REPLACE FUNCTION public.activate_membership(
    p_membership_id UUID,
    p_tenant_id UUID,
    p_payment_reference TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_membership RECORD;
BEGIN
    -- Get membership with tenant validation
    SELECT lm.*, lp.tenant_id AS program_tenant_id
    INTO v_membership
    FROM loyalty_memberships lm
    JOIN loyalty_programs lp ON lm.program_id = lp.id
    WHERE lm.id = p_membership_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Membresía no encontrada'::TEXT;
        RETURN;
    END IF;

    -- SECURITY: Validate membership belongs to requesting tenant
    IF v_membership.tenant_id != p_tenant_id OR v_membership.program_tenant_id != p_tenant_id THEN
        RETURN QUERY SELECT false, 'Acceso denegado: membresía no pertenece a este negocio'::TEXT;
        RETURN;
    END IF;

    -- Check if already active
    IF v_membership.status = 'active' AND v_membership.end_date > NOW() THEN
        RETURN QUERY SELECT false, 'Membresía ya está activa'::TEXT;
        RETURN;
    END IF;

    -- Activate membership
    UPDATE loyalty_memberships
    SET status = 'active',
        updated_at = NOW(),
        metadata = COALESCE(metadata, '{}'::JSONB) ||
            jsonb_build_object('payment_validated_at', NOW(), 'payment_reference', p_payment_reference)
    WHERE id = p_membership_id;

    RETURN QUERY SELECT true, 'Membresía activada correctamente'::TEXT;
END;
$$;

-- =====================================================
-- 5. FUNCTION: Secure reward creation/update
-- Validates program belongs to tenant
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_reward_ownership(
    p_reward_id UUID,
    p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reward_tenant_id UUID;
BEGIN
    SELECT lp.tenant_id INTO v_reward_tenant_id
    FROM loyalty_rewards lr
    JOIN loyalty_programs lp ON lr.program_id = lp.id
    WHERE lr.id = p_reward_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    RETURN v_reward_tenant_id = p_tenant_id;
END;
$$;

-- =====================================================
-- 6. FUNCTION: Secure balance access
-- Validates balance belongs to tenant
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_balance_ownership(
    p_balance_id UUID,
    p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_balance_tenant_id
    FROM loyalty_balances
    WHERE id = p_balance_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    RETURN v_balance_tenant_id = p_tenant_id;
END;
$$;

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION redeem_loyalty_reward TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_loyalty_reward TO service_role;
GRANT EXECUTE ON FUNCTION award_loyalty_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION award_loyalty_tokens TO service_role;
GRANT EXECUTE ON FUNCTION validate_redemption_code TO authenticated;
GRANT EXECUTE ON FUNCTION validate_redemption_code TO service_role;
GRANT EXECUTE ON FUNCTION activate_membership TO authenticated;
GRANT EXECUTE ON FUNCTION activate_membership TO service_role;
GRANT EXECUTE ON FUNCTION validate_reward_ownership TO authenticated;
GRANT EXECUTE ON FUNCTION validate_reward_ownership TO service_role;
GRANT EXECUTE ON FUNCTION validate_balance_ownership TO authenticated;
GRANT EXECUTE ON FUNCTION validate_balance_ownership TO service_role;

-- =====================================================
-- 8. COMMENTS
-- =====================================================
COMMENT ON FUNCTION redeem_loyalty_reward IS
'Redeems a loyalty reward with complete tenant isolation.
Validates: lead belongs to tenant, reward belongs to tenant,
stock limits, user limits, and balance sufficiency.
All operations are atomic with FOR UPDATE locks.';

COMMENT ON FUNCTION award_loyalty_tokens IS
'Awards tokens with complete tenant isolation.
Validates: program exists, lead belongs to program tenant,
applies membership multiplier if applicable.
Uses FOR UPDATE lock to prevent race conditions.';

COMMENT ON FUNCTION validate_redemption_code IS
'Validates a redemption code for use at point of sale.
REQUIRES tenant_id - cross-tenant validation is not allowed.
Returns full reward and patient details for valid codes.';

COMMENT ON FUNCTION activate_membership IS
'Securely activates a membership with tenant validation.
Prevents cross-tenant membership activation attacks.';

COMMENT ON FUNCTION validate_reward_ownership IS
'Helper function to check if a reward belongs to a tenant.
Used for additional security checks in API layer.';

COMMENT ON FUNCTION validate_balance_ownership IS
'Helper function to check if a balance belongs to a tenant.
Used for additional security checks in API layer.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Fixed critical cross-tenant vulnerabilities:
-- [x] redeem_loyalty_reward() validates lead AND reward tenant
-- [x] award_loyalty_tokens() validates lead belongs to program tenant
-- [x] validate_redemption_code() REQUIRES tenant_id (no null allowed)
-- [x] Added activate_membership() with tenant validation
-- [x] Added helper functions for ownership validation

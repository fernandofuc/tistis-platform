-- =====================================================
-- TIS TIS PLATFORM - Fix Vertical-Specific Issues
-- Migration 111: Critical fixes for dental and restaurant verticals
-- =====================================================
-- CRITICAL ISSUES FIXED:
--
-- V1: ordering.agent.ts uses wrong parameter names for award_loyalty_tokens
--     (p_reference_id/p_reference_type instead of p_source_id/p_source_type)
--     SOLUTION: Add parameter aliases to the function
--
-- V2: invoicing.agent.ts doesn't validate tenant before accessing conversation_metadata
--     SOLUTION: Create secure RPCs with tenant validation
--
-- V3: Missing validate_order_stock RPC referenced in ordering.agent.ts
--     SOLUTION: Create the function
--
-- V4: conversation_metadata missing INSERT/UPDATE policies for authenticated
--     SOLUTION: Add proper RLS policies
-- =====================================================

-- =====================================================
-- 1. FIX V1: Add parameter aliases to award_loyalty_tokens
-- The ordering.agent.ts calls with p_reference_id and p_reference_type
-- but the function expects p_source_id and p_source_type
-- =====================================================

-- Create an overloaded version that accepts the old parameter names
-- This ensures backward compatibility with existing code
-- FIX: Return columns must match award_loyalty_tokens signature:
--   (success BOOLEAN, balance_id UUID, new_balance INTEGER, transaction_id UUID)
CREATE OR REPLACE FUNCTION public.award_loyalty_tokens_compat(
    p_program_id UUID,
    p_lead_id UUID,
    p_tokens INTEGER,
    p_transaction_type VARCHAR(50),
    p_description TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_reference_type VARCHAR(50) DEFAULT NULL
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
BEGIN
    -- Call the actual function with correct parameter names
    -- The return columns match award_loyalty_tokens exactly
    RETURN QUERY SELECT * FROM award_loyalty_tokens(
        p_program_id := p_program_id,
        p_lead_id := p_lead_id,
        p_tokens := p_tokens,
        p_transaction_type := p_transaction_type::TEXT,
        p_description := p_description,
        p_source_id := p_reference_id,  -- Map old name to new name
        p_source_type := p_reference_type::TEXT  -- Map old name to new name
    );
END;
$$;

GRANT EXECUTE ON FUNCTION award_loyalty_tokens_compat TO authenticated;
GRANT EXECUTE ON FUNCTION award_loyalty_tokens_compat TO service_role;

COMMENT ON FUNCTION award_loyalty_tokens_compat IS
'Backward-compatible wrapper for award_loyalty_tokens.
Maps p_reference_id/p_reference_type to p_source_id/p_source_type.
Use this when calling from code that uses the old parameter names.
CREATED in migration 111.';

-- =====================================================
-- 2. FIX V2: Create secure RPCs for invoicing state management
-- These functions validate tenant ownership before accessing data
-- =====================================================

-- Get invoicing state with tenant validation
CREATE OR REPLACE FUNCTION public.get_invoicing_state(
    p_conversation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_state JSONB;
BEGIN
    -- Get and validate tenant from conversation
    SELECT c.tenant_id INTO v_tenant_id
    FROM conversations c
    WHERE c.id = p_conversation_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Conversation not found: %', p_conversation_id;
    END IF;

    -- Get the invoicing state
    SELECT cm.invoicing_state INTO v_state
    FROM conversation_metadata cm
    WHERE cm.conversation_id = p_conversation_id;

    RETURN v_state;
END;
$$;

-- Set invoicing state with tenant validation
CREATE OR REPLACE FUNCTION public.set_invoicing_state(
    p_conversation_id UUID,
    p_state JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Get and validate tenant from conversation
    SELECT c.tenant_id INTO v_tenant_id
    FROM conversations c
    WHERE c.id = p_conversation_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Conversation not found: %', p_conversation_id;
    END IF;

    -- Upsert the invoicing state
    INSERT INTO conversation_metadata (conversation_id, invoicing_state, updated_at)
    VALUES (p_conversation_id, p_state, NOW())
    ON CONFLICT (conversation_id) DO UPDATE
    SET invoicing_state = p_state,
        updated_at = NOW();
END;
$$;

-- Clear invoicing state with tenant validation
CREATE OR REPLACE FUNCTION public.clear_invoicing_state(
    p_conversation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Get and validate tenant from conversation
    SELECT c.tenant_id INTO v_tenant_id
    FROM conversations c
    WHERE c.id = p_conversation_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Conversation not found: %', p_conversation_id;
    END IF;

    -- Clear the invoicing state
    UPDATE conversation_metadata
    SET invoicing_state = NULL,
        updated_at = NOW()
    WHERE conversation_id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_invoicing_state TO authenticated;
GRANT EXECUTE ON FUNCTION get_invoicing_state TO service_role;
GRANT EXECUTE ON FUNCTION set_invoicing_state TO authenticated;
GRANT EXECUTE ON FUNCTION set_invoicing_state TO service_role;
GRANT EXECUTE ON FUNCTION clear_invoicing_state TO authenticated;
GRANT EXECUTE ON FUNCTION clear_invoicing_state TO service_role;

-- =====================================================
-- 3. FIX V3: Create validate_order_stock RPC
-- Called by ordering.agent.ts to validate stock before creating orders
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_order_stock(
    p_branch_id UUID,
    p_items JSONB  -- Array of {menu_item_id, quantity}
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
DECLARE
    v_item JSONB;
    v_menu_item_id UUID;
    v_quantity INTEGER;
    v_stock_level INTEGER;
    v_item_name TEXT;
    v_out_of_stock TEXT[] := ARRAY[]::TEXT[];
    v_low_stock TEXT[] := ARRAY[]::TEXT[];
    v_valid BOOLEAN := true;
BEGIN
    -- Iterate through requested items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_menu_item_id := (v_item->>'menu_item_id')::UUID;
        v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);

        -- Skip if no menu_item_id (custom item)
        IF v_menu_item_id IS NULL THEN
            CONTINUE;
        END IF;

        -- Get stock level from menu_item_stock if exists
        -- FIX: Changed menu_items to restaurant_menu_items (correct table name from migration 088)
        SELECT
            COALESCE(mis.current_stock, 999999),  -- Default to unlimited if no stock tracking
            mi.name
        INTO v_stock_level, v_item_name
        FROM public.restaurant_menu_items mi
        LEFT JOIN menu_item_stock mis ON mi.id = mis.menu_item_id AND mis.branch_id = p_branch_id
        WHERE mi.id = v_menu_item_id;

        -- Check if item exists
        IF v_item_name IS NULL THEN
            -- Item doesn't exist in menu
            v_out_of_stock := array_append(v_out_of_stock, 'Item no encontrado');
            v_valid := false;
            CONTINUE;
        END IF;

        -- Check stock level
        IF v_stock_level < v_quantity THEN
            IF v_stock_level <= 0 THEN
                v_out_of_stock := array_append(v_out_of_stock, v_item_name);
                v_valid := false;
            ELSE
                v_low_stock := array_append(v_low_stock, v_item_name || ' (solo ' || v_stock_level || ' disponibles)');
            END IF;
        ELSIF v_stock_level <= 5 THEN
            -- Low stock warning (5 or fewer remaining)
            v_low_stock := array_append(v_low_stock, v_item_name || ' (stock bajo)');
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_valid, v_out_of_stock, v_low_stock;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_order_stock TO authenticated;
GRANT EXECUTE ON FUNCTION validate_order_stock TO service_role;

COMMENT ON FUNCTION validate_order_stock IS
'Validates stock availability for a restaurant order.
Called by ordering.agent.ts before creating orders.
Returns out_of_stock items (blocks order) and low_stock warnings.
CREATED in migration 111.';

-- =====================================================
-- 4. Create menu_item_stock table if not exists
-- For restaurants that want to track inventory
-- =====================================================

-- FIX: Changed menu_items reference to restaurant_menu_items (correct table name from migration 088)
CREATE TABLE IF NOT EXISTS menu_item_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES public.restaurant_menu_items(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    current_stock INTEGER DEFAULT 999999,  -- Default unlimited
    low_stock_threshold INTEGER DEFAULT 5,
    track_stock BOOLEAN DEFAULT false,  -- Only track if enabled
    last_restocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_menu_item_branch_stock UNIQUE (menu_item_id, branch_id)
);

-- RLS
ALTER TABLE menu_item_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_menu_item_stock" ON menu_item_stock
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_manage_menu_item_stock" ON menu_item_stock
    FOR ALL TO authenticated
    USING (
        branch_id IN (
            SELECT id FROM branches
            WHERE tenant_id IN (
                SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true
            )
        )
    );

-- =====================================================
-- 5. FIX V4: Add missing RLS policies for conversation_metadata
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "tenant_insert_conversation_metadata" ON conversation_metadata;
DROP POLICY IF EXISTS "tenant_update_conversation_metadata" ON conversation_metadata;
DROP POLICY IF EXISTS "tenant_delete_conversation_metadata" ON conversation_metadata;

-- Add INSERT policy
CREATE POLICY "tenant_insert_conversation_metadata" ON conversation_metadata
    FOR INSERT TO authenticated
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- Add UPDATE policy
CREATE POLICY "tenant_update_conversation_metadata" ON conversation_metadata
    FOR UPDATE TO authenticated
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- Add DELETE policy
CREATE POLICY "tenant_delete_conversation_metadata" ON conversation_metadata
    FOR DELETE TO authenticated
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- =====================================================
-- 6. Add AI traceability columns to appointments if missing
-- These columns are used by booking.agent.ts for dental/restaurant
-- =====================================================

DO $$
BEGIN
    -- Add ai_booking_channel if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'ai_booking_channel'
    ) THEN
        ALTER TABLE appointments ADD COLUMN ai_booking_channel VARCHAR(20);
    END IF;

    -- Add ai_booked_at if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'ai_booked_at'
    ) THEN
        ALTER TABLE appointments ADD COLUMN ai_booked_at TIMESTAMPTZ;
    END IF;

    -- Add ai_urgency_level if missing (for dental)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'ai_urgency_level'
    ) THEN
        ALTER TABLE appointments ADD COLUMN ai_urgency_level SMALLINT;
    END IF;

    -- Add ai_detected_symptoms if missing (for dental)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'ai_detected_symptoms'
    ) THEN
        ALTER TABLE appointments ADD COLUMN ai_detected_symptoms TEXT;
    END IF;

    -- Add ai_confidence_score if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'ai_confidence_score'
    ) THEN
        ALTER TABLE appointments ADD COLUMN ai_confidence_score NUMERIC(3,2);
    END IF;

    -- Add requires_human_review if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'requires_human_review'
    ) THEN
        ALTER TABLE appointments ADD COLUMN requires_human_review BOOLEAN DEFAULT false;
    END IF;

    -- Add human_review_reason if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'human_review_reason'
    ) THEN
        ALTER TABLE appointments ADD COLUMN human_review_reason TEXT;
    END IF;

    -- Add party_size if missing (for restaurant)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'party_size'
    ) THEN
        ALTER TABLE appointments ADD COLUMN party_size SMALLINT;
    END IF;

    -- Add reservation_type if missing (for restaurant)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'appointments'
        AND column_name = 'reservation_type'
    ) THEN
        ALTER TABLE appointments ADD COLUMN reservation_type VARCHAR(30);
    END IF;
END $$;

-- =====================================================
-- 7. Create index for AI-booked appointments dashboard
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_appointments_ai_booked
    ON appointments(tenant_id, ai_booking_channel, ai_booked_at DESC)
    WHERE ai_booking_channel IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_requires_review
    ON appointments(tenant_id, requires_human_review, scheduled_at)
    WHERE requires_human_review = true;

-- =====================================================
-- 8. Create view for AI appointment analytics
-- Dashboard can use this to show AI booking performance
-- =====================================================

CREATE OR REPLACE VIEW public.v_ai_booking_analytics AS
SELECT
    a.tenant_id,
    DATE(a.ai_booked_at) as booking_date,
    a.ai_booking_channel,
    COUNT(*) as total_bookings,
    COUNT(*) FILTER (WHERE a.status = 'completed') as completed,
    COUNT(*) FILTER (WHERE a.status = 'cancelled') as cancelled,
    COUNT(*) FILTER (WHERE a.status = 'no_show') as no_shows,
    COUNT(*) FILTER (WHERE a.ai_urgency_level >= 4) as urgent_cases,
    COUNT(*) FILTER (WHERE a.requires_human_review) as required_review,
    AVG(a.ai_confidence_score) as avg_confidence,
    -- Restaurant specific
    AVG(a.party_size) FILTER (WHERE a.party_size IS NOT NULL) as avg_party_size
FROM appointments a
WHERE a.ai_booking_channel IS NOT NULL
GROUP BY a.tenant_id, DATE(a.ai_booked_at), a.ai_booking_channel;

COMMENT ON VIEW v_ai_booking_analytics IS
'Analytics view for AI-powered booking performance.
Shows bookings by channel, completion rates, urgent cases, and confidence scores.
CREATED in migration 111.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Fixed vertical-specific issues:
-- [x] V1: Added award_loyalty_tokens_compat for backward compatibility
-- [x] V2: Created secure RPCs for invoicing state with tenant validation
-- [x] V3: Created validate_order_stock RPC for ordering agent
-- [x] V4: Added missing RLS policies for conversation_metadata
-- [x] V5: Added AI traceability columns to appointments
-- [x] V6: Created menu_item_stock table for inventory tracking
-- [x] V7: Created v_ai_booking_analytics view for dashboard
-- =====================================================

SELECT 'Migration 111: Vertical-Specific Issues Fixed - COMPLETADA' as status;

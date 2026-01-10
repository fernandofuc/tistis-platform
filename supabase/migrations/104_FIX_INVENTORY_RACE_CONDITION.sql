-- =====================================================
-- TIS TIS PLATFORM - Fix Inventory Race Condition
-- Migration 104: Atomic stock movement with FOR UPDATE lock
-- =====================================================
-- This migration fixes a critical race condition in inventory
-- where two simultaneous requests could read the same stock value
-- and both pass validation, resulting in negative stock.
-- =====================================================

-- =====================================================
-- 1. FUNCTION: Create inventory movement atomically
-- Uses FOR UPDATE to lock the row during read-check-write
-- =====================================================
-- FIX: Reordered parameters - required params first, then optional params with DEFAULT
-- PostgreSQL requires: once a param has DEFAULT, all following params must also have DEFAULT
CREATE OR REPLACE FUNCTION public.create_inventory_movement(
    p_tenant_id UUID,
    p_branch_id UUID,
    p_item_id UUID,
    p_movement_type TEXT,           -- Required: moved before optional params
    p_quantity NUMERIC,             -- Required: moved before optional params
    p_batch_id UUID DEFAULT NULL,   -- Optional: now after required params
    p_unit_cost NUMERIC DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_performed_by UUID DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    movement_id UUID,
    previous_stock NUMERIC,
    new_stock NUMERIC,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_stock NUMERIC;
    v_item_unit_cost NUMERIC;
    v_final_quantity NUMERIC;
    v_new_stock NUMERIC;
    v_total_cost NUMERIC;
    v_movement_id UUID;
    v_outbound_types TEXT[] := ARRAY['sale', 'consumption', 'waste', 'transfer_out'];
BEGIN
    -- Validate movement type
    IF p_movement_type NOT IN ('purchase', 'sale', 'consumption', 'waste', 'adjustment', 'transfer_in', 'transfer_out', 'return', 'production') THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, 'Invalid movement type'::TEXT;
        RETURN;
    END IF;

    -- Get current stock WITH ROW LOCK to prevent race conditions
    SELECT current_stock, unit_cost
    INTO v_current_stock, v_item_unit_cost
    FROM inventory_items
    WHERE id = p_item_id
      AND tenant_id = p_tenant_id
    FOR UPDATE; -- Critical: lock row during transaction

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, 'Item not found'::TEXT;
        RETURN;
    END IF;

    -- Initialize stock if null
    v_current_stock := COALESCE(v_current_stock, 0);

    -- Calculate final quantity (negative for outbound movements)
    IF p_movement_type = ANY(v_outbound_types) THEN
        v_final_quantity := -ABS(p_quantity);
    ELSE
        v_final_quantity := ABS(p_quantity);
    END IF;

    -- Calculate new stock
    v_new_stock := v_current_stock + v_final_quantity;

    -- Prevent negative stock (except for adjustments which may go negative intentionally)
    IF v_new_stock < 0 AND p_movement_type != 'adjustment' THEN
        RETURN QUERY SELECT
            false,
            NULL::UUID,
            v_current_stock,
            v_new_stock,
            format('Insufficient stock. Available: %s, Requested: %s', v_current_stock, ABS(p_quantity))::TEXT;
        RETURN;
    END IF;

    -- Calculate total cost
    v_total_cost := ABS(v_final_quantity) * COALESCE(p_unit_cost, v_item_unit_cost, 0);

    -- Insert movement
    INSERT INTO inventory_movements (
        tenant_id,
        branch_id,
        item_id,
        batch_id,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        unit_cost,
        total_cost,
        reference_type,
        reference_id,
        performed_by,
        reason,
        notes,
        performed_at
    ) VALUES (
        p_tenant_id,
        p_branch_id,
        p_item_id,
        p_batch_id,
        p_movement_type,
        v_final_quantity,
        v_current_stock,
        v_new_stock,
        COALESCE(p_unit_cost, v_item_unit_cost),
        v_total_cost,
        p_reference_type,
        p_reference_id,
        p_performed_by,
        p_reason,
        p_notes,
        NOW()
    )
    RETURNING id INTO v_movement_id;

    -- Note: The trigger update_inventory_item_stock will update current_stock
    -- But we already have the lock, so it's still atomic

    RETURN QUERY SELECT true, v_movement_id, v_current_stock, v_new_stock, NULL::TEXT;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC, SQLERRM::TEXT;
END;
$$;

-- =====================================================
-- 2. FUNCTION: Validate branch is active before scheduling
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_branch_for_appointment(
    p_branch_id UUID
)
RETURNS TABLE(
    is_valid BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch RECORD;
BEGIN
    SELECT id, name, is_active
    INTO v_branch
    FROM branches
    WHERE id = p_branch_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Branch not found'::TEXT;
        RETURN;
    END IF;

    IF NOT v_branch.is_active THEN
        RETURN QUERY SELECT false, format('Branch "%s" is currently inactive and not accepting appointments', v_branch.name)::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

-- =====================================================
-- 3. UPDATE appointment insert trigger to check branch
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_validate_appointment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_validation RECORD;
    v_branch_check RECORD;
BEGIN
    -- First check if branch is active
    SELECT * INTO v_branch_check
    FROM validate_branch_for_appointment(NEW.branch_id);

    IF NOT v_branch_check.is_valid THEN
        RAISE EXCEPTION 'Branch validation failed: %', v_branch_check.error_message
            USING ERRCODE = 'P0003';
    END IF;

    -- Then validate the appointment booking (existing logic)
    SELECT * INTO v_validation
    FROM validate_appointment_booking(
        NEW.staff_id,
        NEW.lead_id,
        NEW.branch_id,
        NEW.scheduled_at,
        COALESCE(NEW.duration_minutes, 30),
        NULL,  -- No exclusion for new appointments
        false  -- Check availability
    );

    IF NOT v_validation.is_valid THEN
        RAISE EXCEPTION 'Appointment validation failed: % - %',
            v_validation.error_code,
            v_validation.error_message
            USING ERRCODE = 'P0001';
    END IF;

    -- Calculate end_time if not set
    IF NEW.end_time IS NULL THEN
        NEW.end_time := NEW.scheduled_at + (COALESCE(NEW.duration_minutes, 30) || ' minutes')::INTERVAL;
    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 4. UPDATE appointment update trigger to check branch
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_validate_appointment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_validation RECORD;
    v_branch_check RECORD;
BEGIN
    -- Prevent updates to completed or cancelled appointments
    IF OLD.status IN ('completed', 'cancelled') AND NEW.status != OLD.status THEN
        IF NOT (OLD.status = 'cancelled' AND NEW.status = 'scheduled') THEN
            RAISE EXCEPTION 'Cannot modify a % appointment', OLD.status
                USING ERRCODE = 'P0002';
        END IF;
    END IF;

    -- Check if branch changed and validate new branch is active
    IF NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
        SELECT * INTO v_branch_check
        FROM validate_branch_for_appointment(NEW.branch_id);

        IF NOT v_branch_check.is_valid THEN
            RAISE EXCEPTION 'Branch validation failed: %', v_branch_check.error_message
                USING ERRCODE = 'P0003';
        END IF;
    END IF;

    -- Only validate if scheduling-related fields changed
    IF NEW.staff_id IS DISTINCT FROM OLD.staff_id
       OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
       OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
    THEN
        IF NEW.status NOT IN ('cancelled', 'no_show', 'completed') THEN
            SELECT * INTO v_validation
            FROM validate_appointment_booking(
                NEW.staff_id,
                NEW.lead_id,
                NEW.branch_id,
                NEW.scheduled_at,
                COALESCE(NEW.duration_minutes, 30),
                NEW.id,
                false
            );

            IF NOT v_validation.is_valid THEN
                RAISE EXCEPTION 'Appointment validation failed: % - %',
                    v_validation.error_code,
                    v_validation.error_message
                    USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    -- Update end_time if schedule changed
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
    THEN
        NEW.end_time := NEW.scheduled_at + (COALESCE(NEW.duration_minutes, 30) || ' minutes')::INTERVAL;
    END IF;

    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

-- =====================================================
-- 5. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION create_inventory_movement TO authenticated;
GRANT EXECUTE ON FUNCTION create_inventory_movement TO service_role;
GRANT EXECUTE ON FUNCTION validate_branch_for_appointment TO authenticated;
GRANT EXECUTE ON FUNCTION validate_branch_for_appointment TO service_role;

-- =====================================================
-- 6. COMMENTS
-- =====================================================
COMMENT ON FUNCTION create_inventory_movement IS
'Creates an inventory movement atomically with FOR UPDATE lock to prevent race conditions.
Returns success status, movement ID, previous stock, new stock, and error message.
Prevents negative stock for all movement types except adjustments.';

COMMENT ON FUNCTION validate_branch_for_appointment IS
'Validates that a branch is active before allowing appointment scheduling.
Returns is_valid and error_message.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Fixed issues:
-- [x] Race condition in inventory movements (FOR UPDATE lock)
-- [x] Branch active validation for appointments (new + update triggers)

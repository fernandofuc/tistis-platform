-- =====================================================
-- TIS TIS PLATFORM - Migration 103
-- Leads Soft Delete + Bulk Appointment Reschedule
-- =====================================================
-- This migration adds:
-- 1. Soft delete capability for leads (prevent accidental data loss)
-- 2. Bulk reschedule function for appointments (doctor sick day scenario)
-- 3. Waste tracking for late cancellations (inventory loss)
-- =====================================================

-- =====================================================
-- PART 1: LEADS SOFT DELETE
-- =====================================================

-- 1.1 Add deleted_at column to leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 1.2 Add deleted_by column to track who deleted
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- 1.3 Create index for efficient filtering of non-deleted leads
CREATE INDEX IF NOT EXISTS idx_leads_not_deleted
ON public.leads(tenant_id, created_at DESC)
WHERE deleted_at IS NULL;

-- 1.4 Create index for deleted leads (for admin recovery)
CREATE INDEX IF NOT EXISTS idx_leads_deleted
ON public.leads(tenant_id, deleted_at DESC)
WHERE deleted_at IS NOT NULL;

-- 1.5 Function to soft delete a lead
CREATE OR REPLACE FUNCTION public.soft_delete_lead(
    p_lead_id UUID,
    p_deleted_by UUID DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    lead_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lead RECORD;
BEGIN
    -- Get lead info
    SELECT id, tenant_id, full_name, deleted_at
    INTO v_lead
    FROM leads
    WHERE id = p_lead_id;

    IF NOT FOUND THEN
        success := false;
        message := 'Lead not found';
        lead_id := p_lead_id;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Check if already deleted
    IF v_lead.deleted_at IS NOT NULL THEN
        success := false;
        message := 'Lead already deleted';
        lead_id := p_lead_id;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Perform soft delete
    UPDATE leads
    SET
        deleted_at = NOW(),
        deleted_by = p_deleted_by,
        status = 'inactive'
    WHERE id = p_lead_id;

    -- Also soft-close any open conversations
    -- FIX: Changed 'closed' to 'resolved' (valid status per CHECK constraint in migration 012)
    -- Valid statuses: 'active', 'waiting_response', 'escalated', 'resolved', 'archived'
    UPDATE conversations
    SET
        status = 'resolved',
        updated_at = NOW()
    WHERE lead_id = p_lead_id
      AND status NOT IN ('resolved', 'archived');

    success := true;
    message := 'Lead deleted successfully';
    lead_id := p_lead_id;
    RETURN NEXT;
END;
$$;

-- 1.6 Function to restore a deleted lead
CREATE OR REPLACE FUNCTION public.restore_lead(
    p_lead_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    lead_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lead RECORD;
BEGIN
    -- Get lead info
    SELECT id, deleted_at
    INTO v_lead
    FROM leads
    WHERE id = p_lead_id;

    IF NOT FOUND THEN
        success := false;
        message := 'Lead not found';
        lead_id := p_lead_id;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Check if not deleted
    IF v_lead.deleted_at IS NULL THEN
        success := false;
        message := 'Lead is not deleted';
        lead_id := p_lead_id;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Restore lead
    UPDATE leads
    SET
        deleted_at = NULL,
        deleted_by = NULL,
        status = 'inactive' -- Set to inactive, admin can reactivate
    WHERE id = p_lead_id;

    success := true;
    message := 'Lead restored successfully';
    lead_id := p_lead_id;
    RETURN NEXT;
END;
$$;

-- 1.7 Grant permissions
GRANT EXECUTE ON FUNCTION soft_delete_lead(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_lead(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION restore_lead(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_lead(UUID) TO service_role;

-- =====================================================
-- PART 2: BULK APPOINTMENT RESCHEDULE
-- =====================================================

-- 2.1 Function to get appointments for a staff member in a date range
CREATE OR REPLACE FUNCTION public.get_staff_appointments_for_reschedule(
    p_staff_id UUID,
    p_branch_id UUID,
    p_date_from DATE,
    p_date_to DATE
)
RETURNS TABLE(
    appointment_id UUID,
    lead_id UUID,
    lead_name TEXT,
    lead_phone TEXT,
    scheduled_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    service_name TEXT,
    status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id AS appointment_id,
        a.lead_id,
        COALESCE(l.full_name, CONCAT(l.first_name, ' ', l.last_name)) AS lead_name,
        l.phone AS lead_phone,
        a.scheduled_at,
        a.duration_minutes,
        s.name AS service_name,
        a.status
    FROM appointments a
    LEFT JOIN leads l ON a.lead_id = l.id
    LEFT JOIN services s ON a.service_id = s.id
    WHERE a.staff_id = p_staff_id
      AND a.branch_id = p_branch_id
      AND DATE(a.scheduled_at) >= p_date_from
      AND DATE(a.scheduled_at) <= p_date_to
      AND a.status NOT IN ('cancelled', 'completed', 'no_show')
    ORDER BY a.scheduled_at;
END;
$$;

-- 2.2 Function to bulk cancel appointments (doctor sick day)
CREATE OR REPLACE FUNCTION public.bulk_cancel_appointments(
    p_staff_id UUID,
    p_branch_id UUID,
    p_date_from DATE,
    p_date_to DATE,
    p_cancel_reason TEXT DEFAULT 'Staff unavailable',
    p_cancelled_by UUID DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    total_cancelled INTEGER,
    cancelled_appointments UUID[],
    affected_leads UUID[],
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cancelled_ids UUID[] := '{}';
    v_lead_ids UUID[] := '{}';
    v_count INTEGER := 0;
    v_appointment RECORD;
BEGIN
    -- Cancel all appointments in range
    FOR v_appointment IN
        SELECT a.id, a.lead_id
        FROM appointments a
        WHERE a.staff_id = p_staff_id
          AND a.branch_id = p_branch_id
          AND DATE(a.scheduled_at) >= p_date_from
          AND DATE(a.scheduled_at) <= p_date_to
          AND a.status NOT IN ('cancelled', 'completed', 'no_show')
    LOOP
        -- Update appointment status
        UPDATE appointments
        SET
            status = 'cancelled',
            cancelled_at = NOW(),
            cancelled_reason = p_cancel_reason,
            updated_at = NOW()
        WHERE id = v_appointment.id;

        v_cancelled_ids := array_append(v_cancelled_ids, v_appointment.id);

        -- Track unique leads
        IF v_appointment.lead_id IS NOT NULL AND NOT (v_appointment.lead_id = ANY(v_lead_ids)) THEN
            v_lead_ids := array_append(v_lead_ids, v_appointment.lead_id);
        END IF;

        v_count := v_count + 1;
    END LOOP;

    success := true;
    total_cancelled := v_count;
    cancelled_appointments := v_cancelled_ids;
    affected_leads := v_lead_ids;
    message := format('Cancelled %s appointments for %s leads', v_count, array_length(v_lead_ids, 1));

    RETURN NEXT;
END;
$$;

-- 2.3 Function to suggest new appointment slots
CREATE OR REPLACE FUNCTION public.suggest_reschedule_slots(
    p_staff_id UUID,
    p_branch_id UUID,
    p_duration_minutes INTEGER,
    p_from_date DATE,
    p_days_ahead INTEGER DEFAULT 7
)
RETURNS TABLE(
    slot_start TIMESTAMPTZ,
    slot_end TIMESTAMPTZ,
    day_of_week INTEGER,
    is_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_date DATE;
    v_day_of_week INTEGER;
    v_availability RECORD;
    v_slot_time TIME;
    v_slot_start TIMESTAMPTZ;
    v_slot_end TIMESTAMPTZ;
BEGIN
    -- Loop through each day in range
    FOR i IN 0..p_days_ahead LOOP
        v_date := p_from_date + i;
        v_day_of_week := EXTRACT(DOW FROM v_date)::INTEGER;

        -- Get staff availability for this day
        FOR v_availability IN
            SELECT sa.start_time, sa.end_time
            FROM staff_availability sa
            WHERE sa.staff_id = p_staff_id
              AND sa.day_of_week = v_day_of_week
              AND sa.is_active = true
              AND sa.availability_type = 'available'
              AND (sa.branch_id IS NULL OR sa.branch_id = p_branch_id)
        LOOP
            -- Generate slots every 30 minutes within availability
            v_slot_time := v_availability.start_time;

            WHILE v_slot_time + (p_duration_minutes || ' minutes')::INTERVAL <= v_availability.end_time LOOP
                v_slot_start := v_date + v_slot_time;
                v_slot_end := v_slot_start + (p_duration_minutes || ' minutes')::INTERVAL;

                -- Check if slot is available (no conflicting appointments)
                slot_start := v_slot_start;
                slot_end := v_slot_end;
                day_of_week := v_day_of_week;
                is_available := NOT EXISTS (
                    SELECT 1 FROM appointments a
                    WHERE a.staff_id = p_staff_id
                      AND a.branch_id = p_branch_id
                      AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled')
                      AND a.scheduled_at < v_slot_end
                      AND (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL) > v_slot_start
                );

                RETURN NEXT;

                v_slot_time := v_slot_time + INTERVAL '30 minutes';
            END LOOP;
        END LOOP;
    END LOOP;
END;
$$;

-- 2.4 Grant permissions for bulk reschedule functions
GRANT EXECUTE ON FUNCTION get_staff_appointments_for_reschedule(UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_staff_appointments_for_reschedule(UUID, UUID, DATE, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION bulk_cancel_appointments(UUID, UUID, DATE, DATE, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_cancel_appointments(UUID, UUID, DATE, DATE, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION suggest_reschedule_slots(UUID, UUID, INTEGER, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION suggest_reschedule_slots(UUID, UUID, INTEGER, DATE, INTEGER) TO service_role;

-- =====================================================
-- PART 3: WASTE TRACKING FOR LATE CANCELLATIONS
-- =====================================================

-- 3.1 Add column to track if order was prepared before cancellation
ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS was_prepared_before_cancel BOOLEAN DEFAULT FALSE;

-- 3.2 Modify the revert function to optionally register as waste
-- This replaces the function in 101_INVENTORY_CONSUMPTION_SYSTEM.sql
-- FIX: Must DROP the old function first because signature is different (3 params vs 4 params)
DROP FUNCTION IF EXISTS public.revert_order_consumption(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.revert_order_consumption(
    p_order_id UUID,
    p_performed_by UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_register_as_waste BOOLEAN DEFAULT FALSE  -- NEW: If true, don't restore stock, register as waste
)
RETURNS TABLE(
    success BOOLEAN,
    error_message TEXT,
    items_reverted INTEGER,
    waste_registered BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_movement RECORD;
    v_staff_id UUID;
    v_items_count INTEGER := 0;
    v_movement_type VARCHAR(20);
BEGIN
    -- Get order info
    SELECT o.*, o.ready_at IS NOT NULL AS was_prepared
    INTO v_order
    FROM restaurant_orders o
    WHERE o.id = p_order_id;

    IF NOT FOUND THEN
        success := false;
        error_message := 'Order not found';
        items_reverted := 0;
        waste_registered := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Get staff_id
    IF p_performed_by IS NOT NULL THEN
        SELECT id INTO v_staff_id
        FROM staff
        WHERE user_id = p_performed_by AND tenant_id = v_order.tenant_id
        LIMIT 1;
    END IF;

    -- Check if already reverted
    IF EXISTS (
        SELECT 1 FROM inventory_movements
        WHERE reference_type IN ('order_cancellation', 'order_waste')
          AND reference_id = p_order_id
    ) THEN
        success := false;
        error_message := 'Order consumption already processed';
        items_reverted := 0;
        waste_registered := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Determine movement type based on whether to register as waste
    -- If food was already prepared (ready_at is set) and p_register_as_waste is true, register as waste
    IF p_register_as_waste OR v_order.was_prepared THEN
        v_movement_type := 'waste';

        -- Mark order as prepared before cancel
        UPDATE restaurant_orders
        SET was_prepared_before_cancel = true
        WHERE id = p_order_id;
    ELSE
        v_movement_type := 'adjustment';
    END IF;

    -- Process each original consumption movement
    FOR v_movement IN
        SELECT
            m.id,
            m.item_id,
            m.quantity,
            m.unit_cost,
            i.current_stock
        FROM inventory_movements m
        JOIN inventory_items i ON i.id = m.item_id
        WHERE m.reference_type = 'order_consumption'
          AND m.reference_id = p_order_id
          AND m.movement_type = 'consumption'
    LOOP
        IF v_movement_type = 'waste' THEN
            -- Register as waste - DO NOT restore stock, just record the loss
            INSERT INTO inventory_movements (
                tenant_id,
                branch_id,
                item_id,
                movement_type,
                quantity,
                previous_stock,
                new_stock,  -- Stock stays the same (already consumed)
                unit_cost,
                total_cost,
                reference_type,
                reference_id,
                performed_by,
                notes
            ) VALUES (
                v_order.tenant_id,
                v_order.branch_id,
                v_movement.item_id,
                'waste',
                v_movement.quantity,  -- Positive number = waste amount
                v_movement.current_stock,
                v_movement.current_stock,  -- No change to stock
                v_movement.unit_cost,
                v_movement.unit_cost * v_movement.quantity,
                'order_waste',
                p_order_id,
                v_staff_id,
                COALESCE(p_notes, 'Late cancellation - food already prepared')
            );
        ELSE
            -- Normal revert - restore stock
            INSERT INTO inventory_movements (
                tenant_id,
                branch_id,
                item_id,
                movement_type,
                quantity,
                previous_stock,
                new_stock,
                unit_cost,
                total_cost,
                reference_type,
                reference_id,
                performed_by,
                notes
            ) VALUES (
                v_order.tenant_id,
                v_order.branch_id,
                v_movement.item_id,
                'adjustment',
                v_movement.quantity,  -- Positive = restore
                v_movement.current_stock,
                v_movement.current_stock + v_movement.quantity,
                v_movement.unit_cost,
                v_movement.unit_cost * v_movement.quantity,
                'order_cancellation',
                p_order_id,
                v_staff_id,
                COALESCE(p_notes, 'Order cancelled - stock restored')
            );

            -- Update inventory stock
            UPDATE inventory_items
            SET current_stock = current_stock + v_movement.quantity
            WHERE id = v_movement.item_id;
        END IF;

        v_items_count := v_items_count + 1;
    END LOOP;

    -- Resolve any alerts triggered by this order
    UPDATE low_stock_alerts
    SET
        status = 'resolved',
        resolved_at = NOW(),
        resolved_by = v_staff_id
    WHERE metadata->>'triggered_by_order' = p_order_id::TEXT
      AND status IN ('open', 'acknowledged');

    success := true;
    error_message := NULL;
    items_reverted := v_items_count;
    waste_registered := (v_movement_type = 'waste');
    RETURN NEXT;
END;
$$;

-- 3.3 View for waste analysis
-- FIX: Changed m.created_at to m.performed_at (correct column name in inventory_movements)
CREATE OR REPLACE VIEW public.v_inventory_waste_summary AS
SELECT
    m.tenant_id,
    m.branch_id,
    b.name as branch_name,
    DATE_TRUNC('day', m.performed_at) as waste_date,
    i.name as item_name,
    i.sku,
    SUM(m.quantity) as total_waste_qty,
    SUM(m.total_cost) as total_waste_cost,
    COUNT(*) as waste_incidents,
    ARRAY_AGG(DISTINCT m.reference_id) as related_orders
FROM inventory_movements m
JOIN inventory_items i ON i.id = m.item_id
LEFT JOIN branches b ON b.id = m.branch_id
WHERE m.movement_type = 'waste'
GROUP BY
    m.tenant_id,
    m.branch_id,
    b.name,
    DATE_TRUNC('day', m.performed_at),
    i.name,
    i.sku
ORDER BY waste_date DESC, total_waste_cost DESC;

-- Grant access to view
GRANT SELECT ON v_inventory_waste_summary TO authenticated;
GRANT SELECT ON v_inventory_waste_summary TO service_role;

-- =====================================================
-- PART 4: COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION soft_delete_lead IS
'Soft deletes a lead by setting deleted_at timestamp.
Preserves all data for potential recovery.
Also closes any open conversations for the lead.';

COMMENT ON FUNCTION restore_lead IS
'Restores a previously soft-deleted lead.
Sets status to inactive so admin can review and reactivate.';

COMMENT ON FUNCTION bulk_cancel_appointments IS
'Cancels all appointments for a staff member in a date range.
Use case: Doctor calls in sick and all appointments need to be cancelled.
Returns list of affected appointments and leads for notification.';

COMMENT ON FUNCTION suggest_reschedule_slots IS
'Suggests available time slots for rescheduling appointments.
Checks staff availability and existing appointments to find free slots.';

COMMENT ON FUNCTION revert_order_consumption(UUID, UUID, TEXT, BOOLEAN) IS
'Reverts inventory consumption for a cancelled order.
If p_register_as_waste=true or order was already prepared (ready_at set),
registers as waste instead of restoring stock.
Use case: Customer cancels after food is prepared = waste, not recoverable stock.
REPLACES version from migration 101 (3 params -> 4 params).';

COMMENT ON VIEW v_inventory_waste_summary IS
'Summary view of inventory waste by date, branch, and item.
Useful for analyzing late cancellation losses and food waste patterns.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Added:
-- [x] Leads soft delete with deleted_at/deleted_by columns
-- [x] soft_delete_lead() function
-- [x] restore_lead() function for admin recovery
-- [x] get_staff_appointments_for_reschedule() function
-- [x] bulk_cancel_appointments() function
-- [x] suggest_reschedule_slots() function
-- [x] Enhanced revert_order_consumption() with waste tracking
-- [x] v_inventory_waste_summary view for loss analysis

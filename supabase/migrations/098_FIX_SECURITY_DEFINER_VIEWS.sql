-- =====================================================
-- TIS TIS PLATFORM - Security Advisor Fixes
-- Migration: 098_FIX_SECURITY_DEFINER_VIEWS.sql
-- Purpose: Convert SECURITY DEFINER views to SECURITY INVOKER
--
-- Issue: Views with SECURITY DEFINER bypass RLS and run
-- with the permissions of the view creator (superuser).
-- Solution: Recreate views with security_invoker = true
--
-- IMPORTANT: This migration copies the EXACT definitions from
-- the original migrations, only adding security_invoker = true
-- =====================================================

-- ======================
-- 1. v_vip_customers (from 088_RESTAURANT_VERTICAL_SCHEMA.sql:903)
-- ======================
DROP VIEW IF EXISTS public.v_vip_customers;
CREATE VIEW public.v_vip_customers
WITH (security_invoker = true)
AS
SELECT
    l.id as lead_id,
    l.full_name,
    l.phone,
    l.email,
    lrp.loyalty_tier,
    lrp.total_visits,
    lrp.total_spent,
    lrp.average_spend_per_visit,
    lrp.loyalty_points,
    lrp.birthday,
    lrp.anniversary,
    lrp.dietary_restrictions,
    lrp.food_allergies,
    lrp.favorite_dishes,
    t.name as tenant_name,
    (
        SELECT a.scheduled_at::DATE
        FROM appointments a
        WHERE a.lead_id = l.id
        AND a.scheduled_at::DATE > CURRENT_DATE
        AND a.status NOT IN ('cancelled', 'no_show')
        ORDER BY a.scheduled_at
        LIMIT 1
    ) as next_reservation
FROM leads l
JOIN lead_restaurant_profile lrp ON lrp.lead_id = l.id
JOIN tenants t ON t.id = l.tenant_id
WHERE t.vertical = 'restaurant'
AND lrp.loyalty_tier IN ('gold', 'platinum', 'vip')
AND t.status = 'active'
ORDER BY lrp.total_spent DESC;

-- ======================
-- 2. v_kds_items_by_station (from 089_RESTAURANT_ORDERS_KDS.sql:600)
-- ======================
DROP VIEW IF EXISTS public.v_kds_items_by_station;
CREATE VIEW public.v_kds_items_by_station
WITH (security_invoker = true)
AS
SELECT
    roi.id as item_id,
    roi.tenant_id,
    roi.order_id,
    ro.branch_id,
    ro.display_number as order_number,
    ro.order_type,
    ro.priority as order_priority,
    roi.menu_item_name,
    roi.quantity,
    roi.variant_name,
    roi.size_name,
    roi.add_ons,
    roi.modifiers,
    roi.status as item_status,
    roi.kitchen_station,
    roi.special_instructions,
    roi.allergen_notes,
    roi.started_at,
    roi.ready_at,
    roi.created_at as ordered_at,
    rt.table_number,
    EXTRACT(EPOCH FROM (NOW() - roi.created_at)) / 60 as minutes_waiting
FROM restaurant_order_items roi
JOIN restaurant_orders ro ON ro.id = roi.order_id
LEFT JOIN restaurant_tables rt ON rt.id = ro.table_id
WHERE roi.status IN ('pending', 'preparing')
AND ro.status NOT IN ('completed', 'cancelled')
AND ro.deleted_at IS NULL
ORDER BY
    ro.priority DESC,
    roi.created_at ASC;

-- ======================
-- 3. v_today_reservations (from 088_RESTAURANT_VERTICAL_SCHEMA.sql:830)
-- ======================
DROP VIEW IF EXISTS public.v_today_reservations;
CREATE VIEW public.v_today_reservations
WITH (security_invoker = true)
AS
SELECT
    a.id,
    a.tenant_id,
    a.branch_id,
    a.lead_id,
    a.scheduled_at,
    a.duration_minutes,
    a.status,
    a.notes,
    a.party_size as appointment_party_size,
    ard.party_size,
    ard.table_id,
    ard.occasion_type,
    ard.special_requests,
    ard.arrival_status,
    ard.deposit_paid,
    rt.table_number,
    rt.zone as table_zone,
    l.full_name as guest_name,
    l.phone as guest_phone,
    l.email as guest_email,
    lrp.loyalty_tier,
    lrp.dietary_restrictions,
    lrp.food_allergies,
    b.name as branch_name
FROM appointments a
LEFT JOIN appointment_restaurant_details ard ON ard.appointment_id = a.id
LEFT JOIN restaurant_tables rt ON rt.id = ard.table_id
LEFT JOIN leads l ON a.lead_id = l.id
LEFT JOIN lead_restaurant_profile lrp ON lrp.lead_id = l.id
LEFT JOIN branches b ON a.branch_id = b.id
WHERE a.scheduled_at::DATE = CURRENT_DATE
AND a.status NOT IN ('cancelled')
ORDER BY a.scheduled_at;

-- ======================
-- 4. v_urgent_dental_appointments (from 093_AI_BOOKING_DENTAL_TRACEABILITY.sql:413)
-- NOTE: Uses appointments table AI columns, NOT lead_dental_profile
-- ======================
DROP VIEW IF EXISTS public.v_urgent_dental_appointments;
CREATE VIEW public.v_urgent_dental_appointments
WITH (security_invoker = true)
AS
SELECT
    a.id,
    a.tenant_id,
    a.branch_id,
    a.scheduled_at,
    a.status,
    a.ai_urgency_level,
    a.ai_detected_symptoms,
    l.full_name as patient_name,
    l.phone as patient_phone,
    b.name as branch_name,
    CASE
        WHEN a.ai_urgency_level = 5 THEN 'EMERGENCIA'
        WHEN a.ai_urgency_level = 4 THEN 'URGENTE'
        WHEN a.ai_urgency_level = 3 THEN 'PRIORITARIO'
        ELSE 'NORMAL'
    END as priority_label
FROM appointments a
LEFT JOIN leads l ON a.lead_id = l.id
LEFT JOIN branches b ON a.branch_id = b.id
WHERE a.ai_urgency_level >= 3
AND a.status IN ('scheduled', 'confirmed')
AND a.scheduled_at >= NOW()
ORDER BY a.ai_urgency_level DESC, a.scheduled_at;

-- ======================
-- 5. v_table_availability (from 088_RESTAURANT_VERTICAL_SCHEMA.sql:868)
-- ======================
DROP VIEW IF EXISTS public.v_table_availability;
CREATE VIEW public.v_table_availability
WITH (security_invoker = true)
AS
SELECT
    rt.id as table_id,
    rt.branch_id,
    rt.table_number,
    rt.name as table_name,
    rt.max_capacity,
    rt.zone,
    rt.status,
    rt.features,
    b.name as branch_name,
    (
        SELECT json_agg(json_build_object(
            'date', a.scheduled_at::DATE,
            'time', a.scheduled_at::TIME,
            'end_time', (a.scheduled_at + (COALESCE(a.duration_minutes, 60) || ' minutes')::INTERVAL)::TIME,
            'guest_name', l.full_name,
            'party_size', ard.party_size,
            'status', a.status
        ) ORDER BY a.scheduled_at)
        FROM appointments a
        JOIN appointment_restaurant_details ard ON ard.appointment_id = a.id
        LEFT JOIN leads l ON a.lead_id = l.id
        WHERE ard.table_id = rt.id
        AND a.scheduled_at::DATE >= CURRENT_DATE
        AND a.scheduled_at::DATE <= CURRENT_DATE + INTERVAL '7 days'
        AND a.status NOT IN ('cancelled', 'no_show')
    ) as upcoming_reservations
FROM restaurant_tables rt
JOIN branches b ON b.id = rt.branch_id
WHERE rt.is_active = true
AND rt.deleted_at IS NULL;

-- ======================
-- 6. v_kds_active_orders (from 089_RESTAURANT_ORDERS_KDS.sql:554)
-- ======================
DROP VIEW IF EXISTS public.v_kds_active_orders;
CREATE VIEW public.v_kds_active_orders
WITH (security_invoker = true)
AS
SELECT
    ro.id as order_id,
    ro.tenant_id,
    ro.branch_id,
    ro.display_number,
    ro.order_type,
    ro.status as order_status,
    ro.priority,
    ro.ordered_at,
    ro.estimated_prep_time,
    ro.table_id,
    rt.table_number,
    ro.customer_notes,
    ro.kitchen_notes,
    (
        SELECT json_agg(json_build_object(
            'id', roi.id,
            'menu_item_name', roi.menu_item_name,
            'quantity', roi.quantity,
            'variant_name', roi.variant_name,
            'size_name', roi.size_name,
            'add_ons', roi.add_ons,
            'modifiers', roi.modifiers,
            'status', roi.status,
            'kitchen_station', roi.kitchen_station,
            'special_instructions', roi.special_instructions,
            'allergen_notes', roi.allergen_notes,
            'started_at', roi.started_at,
            'ready_at', roi.ready_at
        ) ORDER BY roi.display_order, roi.created_at)
        FROM restaurant_order_items roi
        WHERE roi.order_id = ro.id
        AND roi.status != 'cancelled'
    ) as items,
    EXTRACT(EPOCH FROM (NOW() - ro.ordered_at)) / 60 as minutes_elapsed
FROM restaurant_orders ro
LEFT JOIN restaurant_tables rt ON rt.id = ro.table_id
WHERE ro.status IN ('pending', 'confirmed', 'preparing', 'ready')
AND ro.deleted_at IS NULL
ORDER BY
    ro.priority DESC,
    ro.ordered_at ASC;

-- ======================
-- 7. v_patients_needing_followup (from 093_AI_BOOKING_DENTAL_TRACEABILITY.sql:467)
-- NOTE: Uses GROUP BY on leads + appointments, NOT patients table
-- ======================
DROP VIEW IF EXISTS public.v_patients_needing_followup;
CREATE VIEW public.v_patients_needing_followup
WITH (security_invoker = true)
AS
SELECT
    l.id as lead_id,
    l.tenant_id,
    l.full_name,
    l.phone,
    l.email,
    MAX(a.scheduled_at) as last_visit_date,
    t.name as tenant_name,
    CASE
        WHEN MAX(a.scheduled_at) < CURRENT_DATE - INTERVAL '6 months' THEN 'VENCIDO'
        WHEN MAX(a.scheduled_at) < CURRENT_DATE - INTERVAL '5 months' THEN 'PROXIMO'
        ELSE 'AL DIA'
    END as followup_status
FROM leads l
JOIN tenants t ON t.id = l.tenant_id
LEFT JOIN appointments a ON a.lead_id = l.id AND a.status = 'completed'
WHERE t.vertical = 'dental'
AND t.status = 'active'
GROUP BY l.id, l.tenant_id, l.full_name, l.phone, l.email, t.name
HAVING MAX(a.scheduled_at) IS NULL
    OR MAX(a.scheduled_at) < CURRENT_DATE - INTERVAL '5 months'
ORDER BY MAX(a.scheduled_at) NULLS FIRST;

-- ======================
-- 8. v_appointments_pending_review (from 093_AI_BOOKING_DENTAL_TRACEABILITY.sql:441)
-- NOTE: Uses appointments table columns, NOT ai_bookings table
-- ======================
DROP VIEW IF EXISTS public.v_appointments_pending_review;
CREATE VIEW public.v_appointments_pending_review
WITH (security_invoker = true)
AS
SELECT
    a.id,
    a.tenant_id,
    a.branch_id,
    a.scheduled_at,
    a.ai_booking_channel,
    a.ai_confidence_score,
    a.requires_human_review,
    a.human_review_reason,
    a.ai_detected_symptoms,
    l.full_name as patient_name,
    l.phone as patient_phone,
    s.name as service_name,
    b.name as branch_name,
    a.created_at as booked_at
FROM appointments a
LEFT JOIN leads l ON a.lead_id = l.id
LEFT JOIN services s ON a.service_id = s.id
LEFT JOIN branches b ON a.branch_id = b.id
WHERE a.requires_human_review = true
AND a.status IN ('scheduled', 'confirmed')
ORDER BY a.scheduled_at;

-- ======================
-- 9. v_expiring_batches (from 090_RESTAURANT_INVENTORY.sql:671)
-- ======================
DROP VIEW IF EXISTS public.v_expiring_batches;
CREATE VIEW public.v_expiring_batches
WITH (security_invoker = true)
AS
SELECT
    b.id as batch_id,
    b.tenant_id,
    b.branch_id,
    b.item_id,
    i.name as item_name,
    i.sku,
    b.batch_number,
    b.current_quantity,
    b.unit_cost,
    b.expiration_date,
    (b.expiration_date - CURRENT_DATE) as days_until_expiration,
    CASE
        WHEN b.expiration_date <= CURRENT_DATE THEN 'expired'
        WHEN b.expiration_date <= CURRENT_DATE + 3 THEN 'critical'
        WHEN b.expiration_date <= CURRENT_DATE + 7 THEN 'warning'
        ELSE 'ok'
    END as expiration_status
FROM inventory_batches b
JOIN inventory_items i ON i.id = b.item_id
WHERE b.status = 'available'
AND b.current_quantity > 0
AND b.expiration_date IS NOT NULL
AND b.expiration_date <= CURRENT_DATE + 14
ORDER BY b.expiration_date;

-- ======================
-- 10. v_today_dental_appointments (from 093_AI_BOOKING_DENTAL_TRACEABILITY.sql:378)
-- NOTE: Uses appointments table AI columns, NOT lead_dental_profile
-- ======================
DROP VIEW IF EXISTS public.v_today_dental_appointments;
CREATE VIEW public.v_today_dental_appointments
WITH (security_invoker = true)
AS
SELECT
    a.id,
    a.tenant_id,
    a.branch_id,
    a.lead_id,
    a.scheduled_at,
    a.duration_minutes,
    a.status,
    a.notes,
    a.ai_booking_channel,
    a.ai_confidence_score,
    a.ai_urgency_level,
    a.ai_detected_symptoms,
    a.requires_human_review,
    a.human_review_reason,
    l.full_name as patient_name,
    l.phone as patient_phone,
    l.email as patient_email,
    s.name as service_name,
    st.display_name as doctor_name,
    b.name as branch_name
FROM appointments a
LEFT JOIN leads l ON a.lead_id = l.id
LEFT JOIN services s ON a.service_id = s.id
LEFT JOIN staff st ON a.staff_id = st.id
LEFT JOIN branches b ON a.branch_id = b.id
JOIN tenants t ON a.tenant_id = t.id
WHERE a.scheduled_at::DATE = CURRENT_DATE
AND a.status NOT IN ('cancelled', 'no_show')
AND t.vertical = 'dental'
ORDER BY a.scheduled_at;

-- ======================
-- 11. v_appointment_loyalty_summary (from 095_APPOINTMENT_LOYALTY_TRIGGER.sql:139)
-- NOTE: Uses loyalty_transactions.tokens (NOT amount), source_type = 'appointment_complete'
-- ======================
DROP VIEW IF EXISTS public.v_appointment_loyalty_summary;
CREATE VIEW public.v_appointment_loyalty_summary
WITH (security_invoker = true)
AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    COUNT(DISTINCT a.id) as total_completed_appointments,
    COUNT(DISTINCT lt.id) as total_token_transactions,
    COALESCE(SUM(lt.tokens), 0)::INTEGER as total_tokens_awarded,
    ROUND(COALESCE(AVG(lt.tokens), 0), 2) as avg_tokens_per_appointment
FROM tenants t
LEFT JOIN appointments a ON a.tenant_id = t.id AND a.status = 'completed'
LEFT JOIN loyalty_transactions lt ON lt.source_type = 'appointment_complete' AND lt.source_id = a.id
WHERE t.status = 'active'
GROUP BY t.id, t.name;

-- ======================
-- 12. v_low_stock_items (from 090_RESTAURANT_INVENTORY.sql:642)
-- ======================
DROP VIEW IF EXISTS public.v_low_stock_items;
CREATE VIEW public.v_low_stock_items
WITH (security_invoker = true)
AS
SELECT
    i.id,
    i.tenant_id,
    i.branch_id,
    i.sku,
    i.name,
    i.category_id,
    ic.name as category_name,
    i.current_stock,
    i.minimum_stock,
    i.unit,
    i.unit_cost,
    i.is_perishable,
    i.storage_type,
    (i.minimum_stock - i.current_stock) as shortage,
    CASE
        WHEN i.current_stock <= 0 THEN 'out_of_stock'
        WHEN i.current_stock <= i.minimum_stock * 0.5 THEN 'critical'
        ELSE 'low'
    END as stock_status
FROM inventory_items i
LEFT JOIN inventory_categories ic ON ic.id = i.category_id
WHERE i.is_active = true
AND i.deleted_at IS NULL
AND i.current_stock <= i.minimum_stock;

-- ======================
-- COMMENTS
-- ======================
COMMENT ON VIEW public.v_vip_customers IS 'VIP customers with loyalty stats (security_invoker) - Restaurant vertical';
COMMENT ON VIEW public.v_kds_items_by_station IS 'KDS items grouped by station (security_invoker) - Restaurant vertical';
COMMENT ON VIEW public.v_today_reservations IS 'Today restaurant reservations (security_invoker) - Restaurant vertical';
COMMENT ON VIEW public.v_urgent_dental_appointments IS 'Urgent dental appointments (security_invoker) - Dental vertical';
COMMENT ON VIEW public.v_table_availability IS 'Table availability status (security_invoker) - Restaurant vertical';
COMMENT ON VIEW public.v_kds_active_orders IS 'Active KDS orders (security_invoker) - Restaurant vertical';
COMMENT ON VIEW public.v_patients_needing_followup IS 'Patients due for followup (security_invoker) - Dental vertical';
COMMENT ON VIEW public.v_appointments_pending_review IS 'AI appointments pending staff review (security_invoker) - Multi-vertical';
COMMENT ON VIEW public.v_expiring_batches IS 'Inventory batches near expiration (security_invoker) - Restaurant vertical';
COMMENT ON VIEW public.v_today_dental_appointments IS 'Today dental appointments (security_invoker) - Dental vertical';
COMMENT ON VIEW public.v_appointment_loyalty_summary IS 'Loyalty summary by tenant (security_invoker) - Multi-vertical';
COMMENT ON VIEW public.v_low_stock_items IS 'Low stock inventory items (security_invoker) - Restaurant vertical';

-- ======================
-- VERIFICATION
-- ======================
-- After running this migration, the Security Advisor should show
-- 0 errors for "Security Definer View" issues.

-- =====================================================
-- TIS TIS PLATFORM - Security Advisor Fixes
-- Migration: 098_FIX_SECURITY_DEFINER_VIEWS.sql
-- Purpose: Convert SECURITY DEFINER views to SECURITY INVOKER
--
-- Issue: Views with SECURITY DEFINER bypass RLS and run
-- with the permissions of the view creator (superuser).
-- Solution: Recreate views with security_invoker = true
-- =====================================================

-- ======================
-- 1. v_vip_customers (Restaurant)
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
    l.tenant_id,
    l.preferred_branch_id as branch_id,
    rcs.vip_status,
    rcs.total_visits,
    rcs.total_spent,
    rcs.avg_ticket,
    rcs.last_visit_date,
    rcs.favorite_table_id,
    CASE
        WHEN rcs.vip_status = 'platinum' THEN 1
        WHEN rcs.vip_status = 'gold' THEN 2
        WHEN rcs.vip_status = 'silver' THEN 3
        ELSE 4
    END as vip_rank
FROM leads l
JOIN restaurant_customer_stats rcs ON rcs.lead_id = l.id
WHERE rcs.vip_status IS NOT NULL
ORDER BY vip_rank, rcs.total_spent DESC;

-- ======================
-- 2. v_kds_items_by_station (Restaurant KDS)
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
    roi.kds_station,
    roi.menu_item_id,
    mi.name as item_name,
    roi.quantity,
    roi.modifiers,
    roi.special_instructions,
    roi.kds_status,
    roi.started_at,
    roi.completed_at,
    ro.display_number as order_number,
    ro.order_type,
    ro.priority,
    ro.status as order_status,
    ro.created_at as order_created_at,
    EXTRACT(EPOCH FROM (NOW() - roi.started_at)) / 60 as minutes_in_progress
FROM restaurant_order_items roi
JOIN restaurant_orders ro ON ro.id = roi.order_id
LEFT JOIN menu_items mi ON mi.id = roi.menu_item_id
WHERE roi.kds_status IN ('pending', 'in_progress')
ORDER BY ro.priority DESC, ro.created_at ASC;

-- ======================
-- 3. v_today_reservations (Restaurant)
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
    l.full_name as guest_name,
    l.phone as guest_phone,
    a.scheduled_at,
    a.duration_minutes,
    ra.party_size,
    ra.special_requests,
    ra.occasion,
    rt.table_number,
    rt.name as table_name,
    ra.table_id,
    a.status,
    a.notes
FROM appointments a
JOIN leads l ON l.id = a.lead_id
LEFT JOIN restaurant_appointments ra ON ra.appointment_id = a.id
LEFT JOIN restaurant_tables rt ON rt.id = ra.table_id
WHERE a.appointment_type = 'reservation'
  AND DATE(a.scheduled_at AT TIME ZONE 'America/Mexico_City') = CURRENT_DATE
ORDER BY a.scheduled_at ASC;

-- ======================
-- 4. v_urgent_dental_appointments (Dental)
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
    l.full_name as patient_name,
    l.phone as patient_phone,
    da.chief_complaint,
    da.urgency_level,
    da.pain_level,
    da.symptoms,
    da.ai_triage_notes,
    da.requires_immediate_attention
FROM appointments a
JOIN leads l ON l.id = a.lead_id
LEFT JOIN dental_appointments da ON da.appointment_id = a.id
WHERE (da.urgency_level >= 4 OR da.requires_immediate_attention = true)
  AND a.status IN ('scheduled', 'confirmed')
ORDER BY da.urgency_level DESC, a.scheduled_at ASC;

-- ======================
-- 5. v_table_availability (Restaurant)
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
    rt.capacity,
    rt.min_capacity,
    rt.location_zone,
    rt.status as table_status,
    COALESCE(
        (SELECT COUNT(*) FROM appointments a
         JOIN restaurant_appointments ra ON ra.appointment_id = a.id
         WHERE ra.table_id = rt.id
           AND a.status IN ('scheduled', 'confirmed')
           AND DATE(a.scheduled_at AT TIME ZONE 'America/Mexico_City') = CURRENT_DATE
        ), 0
    ) as reservations_today,
    (rt.status = 'available') as is_available
FROM restaurant_tables rt
WHERE rt.is_active = true
ORDER BY rt.location_zone, rt.table_number;

-- ======================
-- 6. v_kds_active_orders (Restaurant KDS)
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
    ro.status,
    ro.priority,
    ro.source_channel,
    ro.table_id,
    rt.table_number,
    ro.customer_name,
    ro.created_at,
    ro.preparation_started_at,
    EXTRACT(EPOCH FROM (NOW() - ro.created_at)) / 60 as minutes_since_created,
    EXTRACT(EPOCH FROM (NOW() - ro.preparation_started_at)) / 60 as minutes_in_preparation,
    (SELECT COUNT(*) FROM restaurant_order_items roi
     WHERE roi.order_id = ro.id AND roi.kds_status = 'pending') as pending_items,
    (SELECT COUNT(*) FROM restaurant_order_items roi
     WHERE roi.order_id = ro.id AND roi.kds_status = 'in_progress') as in_progress_items,
    (SELECT COUNT(*) FROM restaurant_order_items roi
     WHERE roi.order_id = ro.id AND roi.kds_status = 'completed') as completed_items
FROM restaurant_orders ro
LEFT JOIN restaurant_tables rt ON rt.id = ro.table_id
WHERE ro.status IN ('pending', 'preparing', 'ready')
ORDER BY ro.priority DESC, ro.created_at ASC;

-- ======================
-- 7. v_patients_needing_followup (Dental)
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
    p.id as patient_id,
    p.last_appointment_date,
    p.next_recommended_visit,
    p.treatment_plan_active,
    CASE
        WHEN p.next_recommended_visit < CURRENT_DATE THEN 'overdue'
        WHEN p.next_recommended_visit <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
        ELSE 'upcoming'
    END as followup_status,
    (CURRENT_DATE - p.last_appointment_date) as days_since_last_visit
FROM leads l
JOIN patients p ON p.lead_id = l.id
WHERE p.next_recommended_visit IS NOT NULL
  AND p.next_recommended_visit <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY p.next_recommended_visit ASC;

-- ======================
-- 8. v_appointments_pending_review (Dental)
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
    a.status,
    a.created_at,
    l.full_name as patient_name,
    l.phone as patient_phone,
    da.chief_complaint,
    da.ai_triage_notes,
    da.staff_reviewed,
    da.reviewed_by,
    da.reviewed_at,
    ab.booked_by_ai,
    ab.ai_confidence_score
FROM appointments a
JOIN leads l ON l.id = a.lead_id
LEFT JOIN dental_appointments da ON da.appointment_id = a.id
LEFT JOIN ai_bookings ab ON ab.appointment_id = a.id
WHERE ab.booked_by_ai = true
  AND da.staff_reviewed = false
  AND a.status IN ('scheduled', 'confirmed')
ORDER BY a.scheduled_at ASC;

-- ======================
-- 9. v_expiring_batches (Restaurant Inventory)
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
    b.quantity_remaining,
    b.expiration_date,
    b.unit_cost,
    (b.expiration_date - CURRENT_DATE) as days_until_expiration,
    CASE
        WHEN b.expiration_date <= CURRENT_DATE THEN 'expired'
        WHEN b.expiration_date <= CURRENT_DATE + INTERVAL '3 days' THEN 'critical'
        WHEN b.expiration_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'warning'
        ELSE 'ok'
    END as expiration_status
FROM inventory_batches b
JOIN inventory_items i ON i.id = b.item_id
WHERE b.quantity_remaining > 0
  AND b.expiration_date IS NOT NULL
  AND b.expiration_date <= CURRENT_DATE + INTERVAL '14 days'
ORDER BY b.expiration_date ASC;

-- ======================
-- 10. v_today_dental_appointments (Dental)
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
    l.full_name as patient_name,
    l.phone as patient_phone,
    a.scheduled_at,
    a.duration_minutes,
    a.status,
    a.notes,
    da.chief_complaint,
    da.treatment_type,
    da.urgency_level,
    da.pain_level,
    s.full_name as provider_name,
    ab.booked_by_ai,
    ab.ai_confidence_score
FROM appointments a
JOIN leads l ON l.id = a.lead_id
LEFT JOIN dental_appointments da ON da.appointment_id = a.id
LEFT JOIN staff s ON s.id = a.staff_id
LEFT JOIN ai_bookings ab ON ab.appointment_id = a.id
WHERE DATE(a.scheduled_at AT TIME ZONE 'America/Mexico_City') = CURRENT_DATE
ORDER BY a.scheduled_at ASC;

-- ======================
-- 11. v_appointment_loyalty_summary (Loyalty)
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
    COALESCE(SUM(lt.amount) FILTER (WHERE lt.transaction_type = 'earn'), 0) as total_tokens_earned,
    COALESCE(SUM(lt.amount) FILTER (WHERE lt.transaction_type = 'redeem'), 0) as total_tokens_redeemed,
    COUNT(DISTINCT a.lead_id) as unique_patients_rewarded
FROM tenants t
LEFT JOIN appointments a ON a.tenant_id = t.id AND a.status = 'completed'
LEFT JOIN loyalty_transactions lt ON lt.appointment_id = a.id
GROUP BY t.id, t.name;

-- ======================
-- 12. v_low_stock_items (Restaurant Inventory)
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
    i.category,
    i.current_quantity,
    i.reorder_point,
    i.reorder_quantity,
    i.unit,
    i.avg_daily_usage,
    CASE
        WHEN i.current_quantity <= 0 THEN 'out_of_stock'
        WHEN i.current_quantity <= i.reorder_point * 0.5 THEN 'critical'
        WHEN i.current_quantity <= i.reorder_point THEN 'low'
        ELSE 'ok'
    END as stock_status,
    CASE
        WHEN i.avg_daily_usage > 0 THEN
            ROUND(i.current_quantity / i.avg_daily_usage, 1)
        ELSE NULL
    END as days_of_stock_remaining
FROM inventory_items i
WHERE i.is_active = true
  AND i.current_quantity <= i.reorder_point
ORDER BY
    CASE
        WHEN i.current_quantity <= 0 THEN 1
        WHEN i.current_quantity <= i.reorder_point * 0.5 THEN 2
        ELSE 3
    END,
    i.current_quantity ASC;

-- ======================
-- COMMENTS
-- ======================
COMMENT ON VIEW public.v_vip_customers IS 'VIP customers with loyalty stats (security_invoker)';
COMMENT ON VIEW public.v_kds_items_by_station IS 'KDS items grouped by station (security_invoker)';
COMMENT ON VIEW public.v_today_reservations IS 'Today restaurant reservations (security_invoker)';
COMMENT ON VIEW public.v_urgent_dental_appointments IS 'Urgent dental appointments (security_invoker)';
COMMENT ON VIEW public.v_table_availability IS 'Table availability status (security_invoker)';
COMMENT ON VIEW public.v_kds_active_orders IS 'Active KDS orders (security_invoker)';
COMMENT ON VIEW public.v_patients_needing_followup IS 'Patients due for followup (security_invoker)';
COMMENT ON VIEW public.v_appointments_pending_review IS 'AI appointments pending staff review (security_invoker)';
COMMENT ON VIEW public.v_expiring_batches IS 'Inventory batches near expiration (security_invoker)';
COMMENT ON VIEW public.v_today_dental_appointments IS 'Today dental appointments (security_invoker)';
COMMENT ON VIEW public.v_appointment_loyalty_summary IS 'Loyalty summary by tenant (security_invoker)';
COMMENT ON VIEW public.v_low_stock_items IS 'Low stock inventory items (security_invoker)';

-- ======================
-- VERIFICATION
-- ======================
-- After running this migration, the Security Advisor should show
-- 0 errors for "Security Definer View" issues.

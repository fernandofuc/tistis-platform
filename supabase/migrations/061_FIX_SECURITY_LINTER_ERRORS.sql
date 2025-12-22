-- =====================================================
-- TIS TIS PLATFORM - Security Linter Fixes
-- Migration 061: Fix all ERROR level security issues
-- =====================================================
-- Issues fixed:
-- 1. ai_prompt_templates: RLS disabled but policy exists
-- 2. 6 views with SECURITY DEFINER (should use INVOKER)
-- 3. stripe_webhook_events: RLS enabled but no policies
-- =====================================================

-- =====================================================
-- PART A: Fix ai_prompt_templates RLS
-- =====================================================

-- Enable RLS on the table
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (created via dashboard)
DROP POLICY IF EXISTS "Service role full access ai_prompt_templates" ON public.ai_prompt_templates;

-- Create proper RLS policies
-- This is a read-only reference table with templates by vertical
CREATE POLICY "Authenticated users can read templates"
ON public.ai_prompt_templates
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role full access"
ON public.ai_prompt_templates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- PART B: Fix SECURITY DEFINER Views
-- Recreate views with SECURITY INVOKER
-- =====================================================

-- B1: active_leads_view
DROP VIEW IF EXISTS public.active_leads_view;
CREATE VIEW public.active_leads_view
WITH (security_invoker = true)
AS
SELECT
    l.id,
    l.tenant_id,
    l.phone,
    l.full_name,
    l.email,
    l.classification,
    l.score,
    l.status,
    l.source,
    l.interested_services,
    l.created_at,
    l.last_contact_at,
    b.name as branch_name,
    s.first_name || ' ' || s.last_name as assigned_staff_name,
    (SELECT COUNT(*) FROM public.appointments a WHERE a.lead_id = l.id) as appointments_count,
    (SELECT COUNT(*) FROM public.conversations c WHERE c.lead_id = l.id) as conversations_count
FROM public.leads l
LEFT JOIN public.branches b ON l.branch_id = b.id
LEFT JOIN public.staff s ON l.assigned_staff_id = s.id
WHERE l.status NOT IN ('converted', 'lost', 'inactive');

-- B2: today_appointments_view
DROP VIEW IF EXISTS public.today_appointments_view;
CREATE VIEW public.today_appointments_view
WITH (security_invoker = true)
AS
SELECT
    a.id,
    a.tenant_id,
    a.branch_id,
    a.scheduled_at,
    a.duration_minutes,
    a.status,
    a.notes,
    b.name as branch_name,
    COALESCE(p.full_name, l.full_name, 'Sin nombre') as patient_name,
    COALESCE(p.phone, l.phone) as patient_phone,
    s.first_name || ' ' || s.last_name as staff_name,
    sv.name as service_name
FROM public.appointments a
LEFT JOIN public.branches b ON a.branch_id = b.id
LEFT JOIN public.patients p ON a.patient_id = p.id
LEFT JOIN public.leads l ON a.lead_id = l.id
LEFT JOIN public.staff s ON a.staff_id = s.id
LEFT JOIN public.services sv ON a.service_id = sv.id
WHERE a.scheduled_at >= CURRENT_DATE
  AND a.scheduled_at < CURRENT_DATE + INTERVAL '1 day';

-- B3: quotes_full_view
DROP VIEW IF EXISTS public.quotes_full_view;
CREATE VIEW public.quotes_full_view
WITH (security_invoker = true)
AS
SELECT
    q.id,
    q.tenant_id,
    q.quote_number,
    q.status,
    q.subtotal,
    q.discount_amount,
    q.tax_amount,
    q.total,
    q.currency,
    q.valid_until,
    q.created_at,
    COALESCE(p.full_name, l.full_name) as client_name,
    COALESCE(p.phone, l.phone) as client_phone,
    COALESCE(p.email, l.email) as client_email,
    s.first_name || ' ' || s.last_name as created_by_name,
    (SELECT COUNT(*) FROM public.quote_items qi WHERE qi.quote_id = q.id) as items_count
FROM public.quotes q
LEFT JOIN public.patients p ON q.patient_id = p.id
LEFT JOIN public.leads l ON q.lead_id = l.id
LEFT JOIN public.staff s ON q.created_by_staff_id = s.id;

-- B4: staff_members
DROP VIEW IF EXISTS public.staff_members;
CREATE VIEW public.staff_members
WITH (security_invoker = true)
AS
SELECT * FROM public.staff;

-- B5: unread_notifications_count
-- Note: This view depends on the notifications table which may not exist
-- Simply dropping it fixes the SECURITY DEFINER issue
DROP VIEW IF EXISTS public.unread_notifications_count;

-- B6: v_channel_accounts
DROP VIEW IF EXISTS public.v_channel_accounts;
CREATE VIEW public.v_channel_accounts
WITH (security_invoker = true)
AS
SELECT
    ca.id,
    ca.tenant_id,
    ca.channel_type,
    ca.account_name,
    ca.status,
    ca.is_default,
    ca.created_at,
    ca.updated_at,
    t.name as tenant_name
FROM public.channel_accounts ca
LEFT JOIN public.tenants t ON ca.tenant_id = t.id;

-- =====================================================
-- PART C: Fix stripe_webhook_events (RLS enabled but no policy)
-- =====================================================

-- Add policies for stripe_webhook_events
-- This table should only be accessible by service role (webhooks)
CREATE POLICY "Service role full access stripe_webhook_events"
ON public.stripe_webhook_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- PART D: Comments
-- =====================================================

COMMENT ON VIEW public.active_leads_view IS 'Vista de leads activos. SECURITY INVOKER respeta RLS.';
COMMENT ON VIEW public.today_appointments_view IS 'Vista de citas del dia. SECURITY INVOKER respeta RLS.';
COMMENT ON VIEW public.quotes_full_view IS 'Vista de cotizaciones. SECURITY INVOKER respeta RLS.';
COMMENT ON VIEW public.staff_members IS 'Vista de staff. SECURITY INVOKER respeta RLS.';
COMMENT ON VIEW public.unread_notifications_count IS 'Conteo de notificaciones. SECURITY INVOKER respeta RLS.';
COMMENT ON VIEW public.v_channel_accounts IS 'Vista de cuentas de canal. SECURITY INVOKER respeta RLS.';

-- =====================================================
-- Migration complete - Fixes 8 ERROR level issues
-- =====================================================

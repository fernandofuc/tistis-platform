-- =====================================================
-- TIS TIS PLATFORM - DEFINITIVE Security Linter Fixes
-- Migration 062: Fix ALL ERROR level security issues
-- =====================================================
-- This migration fixes all 8 ERROR level security issues:
--
-- 1. ai_prompt_templates: RLS disabled but policy exists → Enable RLS + policies
-- 2. active_leads_view: SECURITY DEFINER → SECURITY INVOKER
-- 3. today_appointments_view: SECURITY DEFINER → SECURITY INVOKER
-- 4. quotes_full_view: SECURITY DEFINER → SECURITY INVOKER
-- 5. staff_members: SECURITY DEFINER → SECURITY INVOKER
-- 6. unread_notifications_count: SECURITY DEFINER → SECURITY INVOKER
-- 7. v_channel_accounts: SECURITY DEFINER → SECURITY INVOKER
-- 8. stripe_webhook_events: RLS enabled but no policies → Add policy
-- =====================================================

-- =====================================================
-- PART A: Fix ai_prompt_templates RLS
-- =====================================================

-- Enable RLS on the table
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies and recreate
DROP POLICY IF EXISTS "Service role full access ai_prompt_templates" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "Authenticated users can read templates" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "Service role full access" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "ai_prompt_templates_select_authenticated" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "ai_prompt_templates_all_service" ON public.ai_prompt_templates;

-- This is a read-only reference table - all authenticated users can read
CREATE POLICY "ai_prompt_templates_select_authenticated"
ON public.ai_prompt_templates
FOR SELECT
TO authenticated
USING (true);

-- Service role has full access
CREATE POLICY "ai_prompt_templates_all_service"
ON public.ai_prompt_templates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- PART B: Fix SECURITY DEFINER Views
-- Drop ALL problematic views first, then recreate with SECURITY INVOKER
-- =====================================================

-- Drop all views that will be recreated
DROP VIEW IF EXISTS public.active_leads_view CASCADE;
DROP VIEW IF EXISTS public.today_appointments_view CASCADE;
DROP VIEW IF EXISTS public.quotes_full_view CASCADE;
DROP VIEW IF EXISTS public.staff_members CASCADE;
DROP VIEW IF EXISTS public.unread_notifications_count CASCADE;
DROP VIEW IF EXISTS public.v_channel_accounts CASCADE;

-- B1: active_leads_view
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

-- B4: staff_members (compatibility view)
CREATE VIEW public.staff_members
WITH (security_invoker = true)
AS
SELECT * FROM public.staff;

-- B5: unread_notifications_count (only if notifications table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'notifications'
    ) THEN
        EXECUTE '
            CREATE VIEW public.unread_notifications_count
            WITH (security_invoker = true)
            AS
            SELECT
                user_id,
                COUNT(*) as unread_count,
                COUNT(*) FILTER (WHERE priority = ''urgent'') as urgent_count,
                COUNT(*) FILTER (WHERE priority = ''high'') as high_priority_count
            FROM public.notifications
            WHERE read = FALSE AND archived = FALSE
            GROUP BY user_id
        ';
        RAISE NOTICE 'Created unread_notifications_count view';
    ELSE
        RAISE NOTICE 'Skipping unread_notifications_count - notifications table does not exist';
    END IF;
END $$;

-- B6: v_channel_accounts (simplified - using only core columns)
CREATE VIEW public.v_channel_accounts
WITH (security_invoker = true)
AS
SELECT
    cc.id,
    cc.tenant_id,
    cc.branch_id,
    cc.channel,
    cc.status,
    cc.ai_enabled,
    cc.connection_name as account_name,
    cc.whatsapp_phone_number_id,
    cc.messages_received,
    cc.messages_sent,
    cc.last_message_at,
    cc.created_at,
    cc.updated_at,
    COALESCE(atc.ai_personality, 'professional_friendly') as effective_personality
FROM public.channel_connections cc
LEFT JOIN public.ai_tenant_config atc ON atc.tenant_id = cc.tenant_id;

-- =====================================================
-- PART C: Fix stripe_webhook_events (RLS enabled but no policy)
-- =====================================================

-- Drop any existing policy first
DROP POLICY IF EXISTS "Service role full access stripe_webhook_events" ON public.stripe_webhook_events;
DROP POLICY IF EXISTS "stripe_webhook_events_service_role" ON public.stripe_webhook_events;

-- This table should ONLY be accessible by service role (webhooks)
CREATE POLICY "stripe_webhook_events_service_role"
ON public.stripe_webhook_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- PART D: Add comments to views
-- =====================================================

COMMENT ON VIEW public.active_leads_view IS 'Vista de leads activos con SECURITY INVOKER (respeta RLS).';
COMMENT ON VIEW public.today_appointments_view IS 'Vista de citas de hoy con SECURITY INVOKER (respeta RLS).';
COMMENT ON VIEW public.quotes_full_view IS 'Vista de cotizaciones con SECURITY INVOKER (respeta RLS).';
COMMENT ON VIEW public.staff_members IS 'Vista de staff (compatibilidad) con SECURITY INVOKER (respeta RLS).';
COMMENT ON VIEW public.v_channel_accounts IS 'Vista de cuentas de canal con SECURITY INVOKER (respeta RLS).';

-- =====================================================
-- PART E: Verification
-- =====================================================

DO $$
DECLARE
    v_errors TEXT := '';
    v_view_count INTEGER;
    v_policy_count INTEGER;
BEGIN
    -- Count views created with security_invoker
    SELECT COUNT(*) INTO v_view_count
    FROM pg_views
    WHERE schemaname = 'public'
    AND viewname IN ('active_leads_view', 'today_appointments_view', 'quotes_full_view', 'staff_members', 'v_channel_accounts');

    -- Count policies on ai_prompt_templates
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = 'ai_prompt_templates' AND schemaname = 'public';

    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Migration 062 - Security Fixes Complete';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Views recreated with SECURITY INVOKER: %', v_view_count;
    RAISE NOTICE 'Policies on ai_prompt_templates: %', v_policy_count;
    RAISE NOTICE '===========================================';

    IF v_view_count < 5 THEN
        RAISE WARNING 'Some views may not have been created. Expected 5, got %', v_view_count;
    END IF;

    IF v_policy_count < 2 THEN
        RAISE WARNING 'ai_prompt_templates should have at least 2 policies. Got %', v_policy_count;
    END IF;
END $$;

-- =====================================================
-- Migration 062 Complete
-- =====================================================

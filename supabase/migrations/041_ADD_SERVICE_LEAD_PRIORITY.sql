-- =====================================================
-- TIS TIS PLATFORM - Service-Based Lead Priority
-- Migration 041: Add lead_priority to services table
-- =====================================================
--
-- PURPOSE: Change lead classification from message-based
-- scoring to service-based priority. Dental services are
-- classified as HOT/WARM/COLD based on treatment value
-- and complexity.
--
-- EXAMPLES:
-- - HOT: Implants, orthodontics, full rehabilitation (high value)
-- - WARM: Endodontics, crowns, whitening (moderate value)
-- - COLD: Cleaning, general checkup (basic services)
--
-- =====================================================

-- =====================================================
-- PARTE A: Add lead_priority column to services
-- =====================================================

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS lead_priority VARCHAR(10)
DEFAULT 'warm'
CHECK (lead_priority IN ('hot', 'warm', 'cold'));

COMMENT ON COLUMN public.services.lead_priority IS
'Priority classification for leads interested in this service. HOT = high-value treatments (implants, ortho), WARM = moderate (crowns, endo), COLD = basic (cleaning, checkup)';

-- Add index for filtering by priority
CREATE INDEX IF NOT EXISTS idx_services_lead_priority
ON public.services(tenant_id, lead_priority)
WHERE is_active = true;

-- =====================================================
-- PARTE B: Update existing services with default priorities
-- Based on common dental service patterns
-- =====================================================

-- HOT priority services (high-value treatments)
UPDATE public.services
SET lead_priority = 'hot'
WHERE is_active = true
  AND (
    -- By name patterns (Spanish and English)
    LOWER(name) LIKE '%implante%'
    OR LOWER(name) LIKE '%implant%'
    OR LOWER(name) LIKE '%ortodoncia%'
    OR LOWER(name) LIKE '%orthodontic%'
    OR LOWER(name) LIKE '%brackets%'
    OR LOWER(name) LIKE '%invisalign%'
    OR LOWER(name) LIKE '%carilla%'
    OR LOWER(name) LIKE '%veneer%'
    OR LOWER(name) LIKE '%rehabilitaci%'
    OR LOWER(name) LIKE '%rehabilitation%'
    OR LOWER(name) LIKE '%all on%'
    OR LOWER(name) LIKE '%cirug%'
    OR LOWER(name) LIKE '%surgery%'
    -- By category patterns
    OR LOWER(category) LIKE '%cirug%'
    OR LOWER(category) LIKE '%implant%'
    OR LOWER(category) LIKE '%est%tica%'
    OR LOWER(category) LIKE '%cosmetic%'
    -- By price threshold (high value = HOT)
    OR (price_min IS NOT NULL AND price_min >= 1000)
    OR (price_max IS NOT NULL AND price_max >= 2000)
  );

-- WARM priority services (moderate-value treatments)
UPDATE public.services
SET lead_priority = 'warm'
WHERE is_active = true
  AND lead_priority = 'warm' -- Don't override HOT
  AND (
    LOWER(name) LIKE '%endodoncia%'
    OR LOWER(name) LIKE '%endodontic%'
    OR LOWER(name) LIKE '%root canal%'
    OR LOWER(name) LIKE '%corona%'
    OR LOWER(name) LIKE '%crown%'
    OR LOWER(name) LIKE '%puente%'
    OR LOWER(name) LIKE '%bridge%'
    OR LOWER(name) LIKE '%blanqueamiento%'
    OR LOWER(name) LIKE '%whitening%'
    OR LOWER(name) LIKE '%extracci%'
    OR LOWER(name) LIKE '%extraction%'
    OR LOWER(name) LIKE '%resina%'
    OR LOWER(name) LIKE '%filling%'
    OR LOWER(name) LIKE '%composite%'
    OR LOWER(name) LIKE '%restauraci%'
    OR LOWER(name) LIKE '%restoration%'
    -- By price threshold (moderate value = WARM)
    OR (price_min IS NOT NULL AND price_min >= 200 AND price_min < 1000)
  );

-- COLD priority services (basic services) - update remaining
UPDATE public.services
SET lead_priority = 'cold'
WHERE is_active = true
  AND (
    LOWER(name) LIKE '%limpieza%'
    OR LOWER(name) LIKE '%cleaning%'
    OR LOWER(name) LIKE '%profilaxis%'
    OR LOWER(name) LIKE '%prophylaxis%'
    OR LOWER(name) LIKE '%chequeo%'
    OR LOWER(name) LIKE '%checkup%'
    OR LOWER(name) LIKE '%check-up%'
    OR LOWER(name) LIKE '%consulta%'
    OR LOWER(name) LIKE '%consultation%'
    OR LOWER(name) LIKE '%valoraci%'
    OR LOWER(name) LIKE '%evaluation%'
    OR LOWER(name) LIKE '%diagn%stico%'
    OR LOWER(name) LIKE '%diagnostic%'
    OR LOWER(name) LIKE '%radiograf%'
    OR LOWER(name) LIKE '%x-ray%'
    OR LOWER(name) LIKE '%xray%'
    -- By price threshold (low value = COLD)
    OR (price_min IS NOT NULL AND price_min < 200)
    OR (price_max IS NOT NULL AND price_max < 300)
  );

-- =====================================================
-- PARTE C: Create function to get lead priority from service
-- This will be used when a lead shows interest in a service
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_service_lead_priority(
    p_service_id UUID
)
RETURNS VARCHAR(10) AS $$
DECLARE
    v_priority VARCHAR(10);
BEGIN
    SELECT lead_priority INTO v_priority
    FROM public.services
    WHERE id = p_service_id
      AND is_active = true;

    -- Default to warm if service not found
    RETURN COALESCE(v_priority, 'warm');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_service_lead_priority IS
'Returns the lead priority classification for a given service. Used to classify leads based on the services they are interested in.';

-- =====================================================
-- PARTE D: Create function to update lead classification by service
-- Called when a lead shows interest in a specific service
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_lead_classification_by_service(
    p_lead_id UUID,
    p_service_id UUID,
    p_source VARCHAR(50) DEFAULT 'service_interest'
)
RETURNS TABLE (
    lead_id UUID,
    previous_classification VARCHAR(20),
    new_classification VARCHAR(20),
    service_name VARCHAR(255),
    service_priority VARCHAR(10)
) AS $$
DECLARE
    v_current_classification VARCHAR(20);
    v_new_classification VARCHAR(20);
    v_service_priority VARCHAR(10);
    v_service_name VARCHAR(255);
    v_current_score INTEGER;
    v_new_score INTEGER;
BEGIN
    -- Get current lead data
    SELECT l.classification, l.score
    INTO v_current_classification, v_current_score
    FROM public.leads l
    WHERE l.id = p_lead_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;

    -- Get service priority and name
    SELECT s.lead_priority, s.name
    INTO v_service_priority, v_service_name
    FROM public.services s
    WHERE s.id = p_service_id
      AND s.is_active = true;

    IF NOT FOUND THEN
        -- Service not found, keep current classification
        RETURN QUERY SELECT
            p_lead_id,
            v_current_classification,
            v_current_classification,
            NULL::VARCHAR(255),
            NULL::VARCHAR(10);
        RETURN;
    END IF;

    -- Determine new classification based on service priority
    -- Only upgrade, never downgrade classification
    v_new_classification := CASE
        -- Service is HOT -> Lead becomes HOT
        WHEN v_service_priority = 'hot' THEN 'hot'
        -- Service is WARM -> Lead becomes WARM (unless already HOT)
        WHEN v_service_priority = 'warm' AND v_current_classification = 'cold' THEN 'warm'
        WHEN v_service_priority = 'warm' AND v_current_classification IN ('warm', 'hot') THEN v_current_classification
        -- Service is COLD -> Keep current classification
        ELSE v_current_classification
    END;

    -- Calculate new score based on classification
    v_new_score := CASE v_new_classification
        WHEN 'hot' THEN GREATEST(80, v_current_score)
        WHEN 'warm' THEN GREATEST(50, LEAST(79, v_current_score))
        ELSE v_current_score
    END;

    -- Update lead if classification changed
    IF v_new_classification != v_current_classification THEN
        UPDATE public.leads
        SET classification = v_new_classification,
            score = v_new_score,
            score_updated_at = NOW(),
            updated_at = NOW()
        WHERE id = p_lead_id;

        -- Record in score history
        INSERT INTO public.lead_score_history (
            lead_id,
            previous_score,
            new_score,
            score_change,
            previous_classification,
            new_classification,
            change_source,
            signal_name,
            reason,
            metadata
        ) VALUES (
            p_lead_id,
            v_current_score,
            v_new_score,
            v_new_score - v_current_score,
            v_current_classification,
            v_new_classification,
            p_source,
            'service_interest',
            format('Interest in service: %s (priority: %s)', v_service_name, v_service_priority),
            jsonb_build_object(
                'service_id', p_service_id,
                'service_name', v_service_name,
                'service_priority', v_service_priority
            )
        );
    END IF;

    -- Return result
    RETURN QUERY SELECT
        p_lead_id,
        v_current_classification,
        v_new_classification,
        v_service_name,
        v_service_priority;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_lead_classification_by_service IS
'Updates lead classification based on the priority of a service they are interested in. Only upgrades classification (cold->warm->hot), never downgrades.';

-- =====================================================
-- PARTE E: Add interested_service_id to leads table
-- Track the primary service the lead is interested in
-- =====================================================

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS primary_service_id UUID
REFERENCES public.services(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leads.primary_service_id IS
'Primary service the lead is interested in. Used for classification based on service priority.';

CREATE INDEX IF NOT EXISTS idx_leads_primary_service
ON public.leads(tenant_id, primary_service_id)
WHERE primary_service_id IS NOT NULL;

-- =====================================================
-- PARTE F: Update ai_scoring_rules to use service priority
-- Add new rule that triggers when lead mentions a service
-- =====================================================

-- Disable the old high_value_treatment rule (we'll use service-based instead)
UPDATE public.ai_scoring_rules
SET is_active = false,
    signal_description = '[DEPRECATED] Replaced by service-based lead priority. See migration 041.'
WHERE signal_name = 'high_value_treatment'
  AND is_global = true;

-- Add new service-based scoring rule
INSERT INTO public.ai_scoring_rules (
    tenant_id,
    is_global,
    signal_name,
    signal_display_name,
    signal_description,
    points,
    detection_type,
    detection_config,
    category,
    evaluation_order,
    is_active
) VALUES (
    NULL,
    true,
    'service_interest_detected',
    'Interés en Servicio',
    'Lead muestra interés en un servicio específico. La clasificación se actualiza según la prioridad del servicio (HOT/WARM/COLD).',
    0, -- Points are now managed by service priority, not fixed
    'intent',
    '{"type": "service_mention", "update_classification": true}'::jsonb,
    'intent',
    15, -- Evaluate early to classify lead quickly
    true
) ON CONFLICT (tenant_id, signal_name) DO UPDATE SET
    signal_display_name = EXCLUDED.signal_display_name,
    signal_description = EXCLUDED.signal_description,
    detection_config = EXCLUDED.detection_config,
    updated_at = NOW();

-- =====================================================
-- FIN DE LA MIGRACION
-- =====================================================

COMMENT ON SCHEMA public IS
'TIS TIS Platform - Schema with service-based lead priority. Migration 041.';

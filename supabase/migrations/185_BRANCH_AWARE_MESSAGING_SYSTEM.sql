-- =====================================================
-- TIS TIS PLATFORM - Branch-Aware Messaging System
-- Migration: 185_BRANCH_AWARE_MESSAGING_SYSTEM.sql
-- Date: January 31, 2026
-- Version: 4.9.0
--
-- PURPOSE: Enable intelligent branch detection and routing for multi-branch businesses
--
-- FEATURES:
-- 1. RPC to get tenant context filtered by branch
-- 2. RPC to detect branch mentions in messages
-- 3. RPC to get branch disambiguation options
-- 4. Tool support for asking "Which branch?"
-- 5. Automatic branch persistence in lead profile
--
-- ARCHITECTURE:
-- - Supervisor Agent detects branch mention in message
-- - If no branch detected and multiple branches exist, agent asks
-- - Detected/selected branch persists to lead.preferred_branch_id
-- - All subsequent operations use the branch context
-- =====================================================

BEGIN;

-- =====================================================
-- PART 1: BRANCH DETECTION FUNCTION
-- Analyzes message text to detect branch mentions
-- Returns matched branch or NULL
-- =====================================================

CREATE OR REPLACE FUNCTION public.detect_branch_from_message(
    p_tenant_id UUID,
    p_message TEXT
)
RETURNS TABLE(
    branch_id UUID,
    branch_name TEXT,
    match_type TEXT,       -- 'exact', 'partial', 'alias', 'address'
    confidence FLOAT       -- 0.0 to 1.0
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_message_lower TEXT;
    v_branch RECORD;
    v_match_found BOOLEAN := false;
BEGIN
    -- Normalize message
    v_message_lower := LOWER(TRIM(p_message));

    -- Remove common articles and prepositions for better matching
    v_message_lower := REGEXP_REPLACE(v_message_lower, '\b(el|la|los|las|de|del|en|al|a)\b', ' ', 'g');
    v_message_lower := REGEXP_REPLACE(v_message_lower, '\s+', ' ', 'g');

    -- Iterate through tenant's branches
    FOR v_branch IN
        SELECT
            b.id,
            b.name,
            LOWER(b.name) as name_lower,
            LOWER(COALESCE(b.address, '')) as address_lower,
            LOWER(COALESCE(b.city, '')) as city_lower,
            COALESCE(b.metadata->>'aliases', '[]')::JSONB as aliases
        FROM branches b
        WHERE b.tenant_id = p_tenant_id
          AND b.is_active = true
        ORDER BY b.is_headquarters DESC, b.name
    LOOP
        -- EXACT MATCH: Full branch name
        IF v_message_lower LIKE '%' || v_branch.name_lower || '%' THEN
            branch_id := v_branch.id;
            branch_name := v_branch.name;
            match_type := 'exact';
            confidence := 1.0;
            RETURN NEXT;
            v_match_found := true;
            EXIT; -- Return first exact match
        END IF;

        -- PARTIAL MATCH: Key words from branch name (at least 2 consecutive words)
        IF LENGTH(v_branch.name_lower) > 5 AND
           v_message_lower ~ ('\m' || SUBSTRING(v_branch.name_lower FROM 1 FOR 5) || '\M') THEN
            branch_id := v_branch.id;
            branch_name := v_branch.name;
            match_type := 'partial';
            confidence := 0.7;
            RETURN NEXT;
            v_match_found := true;
            -- Don't exit, keep looking for better matches
        END IF;

        -- CITY MATCH: Mentions city name
        IF v_branch.city_lower != '' AND
           v_message_lower LIKE '%' || v_branch.city_lower || '%' THEN
            branch_id := v_branch.id;
            branch_name := v_branch.name;
            match_type := 'city';
            confidence := 0.6;
            RETURN NEXT;
            v_match_found := true;
        END IF;

        -- ALIAS MATCH: Check aliases from metadata
        IF jsonb_array_length(v_branch.aliases) > 0 THEN
            DECLARE
                v_alias TEXT;
            BEGIN
                FOR v_alias IN SELECT LOWER(jsonb_array_elements_text(v_branch.aliases))
                LOOP
                    IF v_message_lower LIKE '%' || v_alias || '%' THEN
                        branch_id := v_branch.id;
                        branch_name := v_branch.name;
                        match_type := 'alias';
                        confidence := 0.9;
                        RETURN NEXT;
                        v_match_found := true;
                        EXIT;
                    END IF;
                END LOOP;
            END;
        END IF;

        -- ADDRESS KEYWORDS: Common location terms
        IF v_branch.address_lower != '' THEN
            -- Check for street numbers or common address patterns
            DECLARE
                v_address_keywords TEXT[];
                v_keyword TEXT;
            BEGIN
                -- Extract first significant word from address
                v_address_keywords := STRING_TO_ARRAY(
                    REGEXP_REPLACE(v_branch.address_lower, '[^a-z0-9 ]', '', 'g'),
                    ' '
                );

                FOREACH v_keyword IN ARRAY v_address_keywords
                LOOP
                    IF LENGTH(v_keyword) >= 4 AND v_message_lower LIKE '%' || v_keyword || '%' THEN
                        branch_id := v_branch.id;
                        branch_name := v_branch.name;
                        match_type := 'address';
                        confidence := 0.5;
                        RETURN NEXT;
                        v_match_found := true;
                        EXIT;
                    END IF;
                END LOOP;
            END;
        END IF;
    END LOOP;

    -- If no matches, return empty result
    IF NOT v_match_found THEN
        RETURN;
    END IF;
END;
$$;

COMMENT ON FUNCTION detect_branch_from_message IS
'Analyzes a message to detect branch mentions. Returns matched branches with confidence scores.
Match types: exact (1.0), alias (0.9), partial (0.7), city (0.6), address (0.5)';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION detect_branch_from_message TO authenticated;
GRANT EXECUTE ON FUNCTION detect_branch_from_message TO service_role;

-- =====================================================
-- PART 2: GET BRANCH DISAMBIGUATION OPTIONS
-- Returns branches for user selection when no branch detected
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_branch_disambiguation_options(
    p_tenant_id UUID,
    p_lead_id UUID DEFAULT NULL
)
RETURNS TABLE(
    branch_id UUID,
    branch_name TEXT,
    branch_address TEXT,
    branch_city TEXT,
    branch_phone TEXT,
    operating_hours JSONB,
    is_headquarters BOOLEAN,
    is_lead_preferred BOOLEAN,
    distance_hint TEXT           -- For future: geo-based sorting
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lead_preferred_branch UUID;
BEGIN
    -- Get lead's preferred branch if lead_id provided
    IF p_lead_id IS NOT NULL THEN
        SELECT preferred_branch_id INTO v_lead_preferred_branch
        FROM leads
        WHERE id = p_lead_id AND tenant_id = p_tenant_id;
    END IF;

    RETURN QUERY
    SELECT
        b.id AS branch_id,
        b.name AS branch_name,
        b.address AS branch_address,
        b.city AS branch_city,
        b.phone AS branch_phone,
        b.operating_hours,
        b.is_headquarters,
        (b.id = v_lead_preferred_branch) AS is_lead_preferred,
        NULL::TEXT AS distance_hint  -- Placeholder for geo features
    FROM branches b
    WHERE b.tenant_id = p_tenant_id
      AND b.is_active = true
    ORDER BY
        -- Preferred branch first
        (b.id = v_lead_preferred_branch) DESC,
        -- Then headquarters
        b.is_headquarters DESC,
        -- Then alphabetically
        b.name ASC;
END;
$$;

COMMENT ON FUNCTION get_branch_disambiguation_options IS
'Returns active branches for a tenant, sorted by preference (lead preferred, headquarters, alphabetical).
Used when agent needs to ask user which branch they prefer.';

GRANT EXECUTE ON FUNCTION get_branch_disambiguation_options TO authenticated;
GRANT EXECUTE ON FUNCTION get_branch_disambiguation_options TO service_role;

-- =====================================================
-- PART 3: GET TENANT AI CONTEXT FOR BRANCH
-- Filtered version of get_tenant_ai_context
-- Only returns data relevant to specific branch
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_tenant_ai_context_for_branch(
    p_tenant_id UUID,
    p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
    v_tenant RECORD;
    v_ai_config JSONB;
    v_branches JSONB;
    v_services JSONB;
    v_staff JSONB;
    v_faqs JSONB;
    v_custom_instructions JSONB;
    v_business_policies JSONB;
    v_knowledge_articles JSONB;
    v_response_templates JSONB;
    v_competitor_handling JSONB;
    v_branch_filter UUID;
BEGIN
    -- If no branch specified, return all (fallback to original behavior)
    v_branch_filter := p_branch_id;

    -- Get tenant info
    SELECT * INTO v_tenant
    FROM tenants
    WHERE id = p_tenant_id AND status = 'active';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Tenant not found or inactive');
    END IF;

    -- Get AI config
    SELECT jsonb_build_object(
        'system_prompt', COALESCE(system_prompt, ''),
        'model', COALESCE(model, 'gpt-4o-mini'),
        'temperature', COALESCE(temperature, 0.7),
        'response_style', COALESCE(response_style, 'professional_friendly'),
        'max_response_length', COALESCE(max_response_length, 300),
        'enable_scoring', COALESCE(enable_scoring, true),
        'auto_escalate_keywords', COALESCE(auto_escalate_keywords, '[]'::JSONB),
        'max_turns_before_escalation', COALESCE(max_turns_before_escalation, 5),
        'escalate_on_hot_lead', COALESCE(escalate_on_hot_lead, true),
        'business_hours', COALESCE(business_hours, '{}'::JSONB)
    ) INTO v_ai_config
    FROM ai_tenant_config
    WHERE tenant_id = p_tenant_id;

    IF v_ai_config IS NULL THEN
        v_ai_config := jsonb_build_object(
            'model', 'gpt-4o-mini',
            'temperature', 0.7,
            'max_response_length', 300
        );
    END IF;

    -- Get branches (if branch specified, only return that one)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', b.id,
            'name', b.name,
            'address', b.address,
            'city', b.city,
            'phone', b.phone,
            'whatsapp_number', b.whatsapp_number,
            'google_maps_url', b.google_maps_url,
            'is_headquarters', b.is_headquarters,
            'operating_hours', b.operating_hours
        ) ORDER BY b.is_headquarters DESC, b.name
    ), '[]'::JSONB) INTO v_branches
    FROM branches b
    WHERE b.tenant_id = p_tenant_id
      AND b.is_active = true
      AND (v_branch_filter IS NULL OR b.id = v_branch_filter);

    -- Get services (all services are tenant-wide for now)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'description', COALESCE(s.description, ''),
            'ai_description', s.ai_description,
            'price_min', COALESCE(s.price_min, 0),
            'price_max', COALESCE(s.price_max, 0),
            'price_note', s.price_note,
            'duration_minutes', COALESCE(s.duration_minutes, 30),
            'category', COALESCE(s.category, 'general'),
            'special_instructions', s.special_instructions,
            'requires_consultation', COALESCE(s.requires_consultation, false),
            'promotion_active', COALESCE(s.promotion_active, false),
            'promotion_text', s.promotion_text
        ) ORDER BY s.category, s.name
    ), '[]'::JSONB) INTO v_services
    FROM services s
    WHERE s.tenant_id = p_tenant_id
      AND s.is_active = true;

    -- Get staff (filtered by branch if specified)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', st.id,
            'name', COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, ''),
            'role_title', st.role_title,
            'specialty', CASE
                WHEN v_tenant.vertical = 'dental' THEN sdp.specialty
                ELSE NULL
            END,
            'branch_ids', COALESCE((
                SELECT jsonb_agg(sb.branch_id)
                FROM staff_branches sb
                WHERE sb.staff_id = st.id
            ), '[]'::JSONB),
            'bio', CASE
                WHEN v_tenant.vertical = 'dental' THEN sdp.bio
                ELSE NULL
            END
        ) ORDER BY st.first_name
    ), '[]'::JSONB) INTO v_staff
    FROM staff st
    LEFT JOIN staff_dental_profile sdp ON sdp.staff_id = st.id
    WHERE st.tenant_id = p_tenant_id
      AND st.is_active = true
      AND (v_branch_filter IS NULL OR EXISTS (
          SELECT 1 FROM staff_branches sb
          WHERE sb.staff_id = st.id AND sb.branch_id = v_branch_filter
      ));

    -- Get FAQs (all FAQs are tenant-wide)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'question', f.question,
            'answer', f.answer,
            'category', COALESCE(f.category, 'general')
        ) ORDER BY f.category, f.question
    ), '[]'::JSONB) INTO v_faqs
    FROM faqs f
    WHERE f.tenant_id = p_tenant_id
      AND f.is_active = true;

    -- Get custom instructions (filter by branch_id if specified)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'type', ci.instruction_type,
            'title', ci.title,
            'instruction', ci.instruction,
            'examples', ci.examples,
            'branch_id', ci.branch_id,
            'priority', ci.priority
        ) ORDER BY ci.priority DESC, ci.created_at
    ), '[]'::JSONB) INTO v_custom_instructions
    FROM ai_custom_instructions ci
    WHERE ci.tenant_id = p_tenant_id
      AND ci.is_active = true
      AND ci.include_in_prompt = true
      AND (ci.branch_id IS NULL OR ci.branch_id = v_branch_filter)
    LIMIT 10;  -- Limit to prevent token overflow

    -- Get business policies (all policies are tenant-wide)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'type', bp.policy_type,
            'title', bp.title,
            'policy', bp.policy_text,
            'short_version', bp.short_version
        ) ORDER BY bp.policy_type
    ), '[]'::JSONB) INTO v_business_policies
    FROM ai_business_policies bp
    WHERE bp.tenant_id = p_tenant_id
      AND bp.is_active = true;

    -- Get knowledge articles (filter by branch_id if specified)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'category', ka.category,
            'title', ka.title,
            'content', ka.content,
            'summary', ka.summary,
            'branch_id', ka.branch_id
        ) ORDER BY ka.display_order, ka.title
    ), '[]'::JSONB) INTO v_knowledge_articles
    FROM ai_knowledge_articles ka
    WHERE ka.tenant_id = p_tenant_id
      AND ka.is_active = true
      AND (ka.branch_id IS NULL OR ka.branch_id = v_branch_filter)
    LIMIT 20;  -- Limit to prevent token overflow

    -- Get response templates (filter by branch_id if specified)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'trigger', rt.trigger_type,
            'name', rt.name,
            'template', rt.template_text,
            'variables', rt.variables_available,
            'branch_id', rt.branch_id
        ) ORDER BY rt.trigger_type, rt.name
    ), '[]'::JSONB) INTO v_response_templates
    FROM ai_response_templates rt
    WHERE rt.tenant_id = p_tenant_id
      AND rt.is_active = true
      AND (rt.branch_id IS NULL OR rt.branch_id = v_branch_filter)
    LIMIT 10;  -- Limit to prevent token overflow

    -- Get competitor handling (all competitors are tenant-wide)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'competitor', ch.competitor_name,
            'aliases', ch.competitor_aliases,
            'strategy', ch.response_strategy,
            'talking_points', ch.talking_points,
            'avoid_saying', ch.avoid_saying
        ) ORDER BY ch.competitor_name
    ), '[]'::JSONB) INTO v_competitor_handling
    FROM ai_competitor_handling ch
    WHERE ch.tenant_id = p_tenant_id
      AND ch.is_active = true;

    -- Build final result
    v_result := jsonb_build_object(
        'tenant_id', v_tenant.id,
        'tenant_name', v_tenant.name,
        'vertical', v_tenant.vertical,
        'timezone', COALESCE(v_tenant.timezone, 'America/Mexico_City'),
        'ai_config', v_ai_config,
        'services', v_services,
        'branches', v_branches,
        'staff', v_staff,
        'faqs', v_faqs,
        'custom_instructions', v_custom_instructions,
        'business_policies', v_business_policies,
        'knowledge_articles', v_knowledge_articles,
        'response_templates', v_response_templates,
        'competitor_handling', v_competitor_handling,
        -- Metadata about filtering
        'context_filtered_by_branch', (v_branch_filter IS NOT NULL),
        'branch_filter_id', v_branch_filter
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_tenant_ai_context_for_branch IS
'Returns tenant AI context filtered by branch. If branch_id is NULL, returns all context.
Used by LangGraph agents to get branch-specific knowledge base and configuration.';

GRANT EXECUTE ON FUNCTION get_tenant_ai_context_for_branch TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_ai_context_for_branch TO service_role;

-- =====================================================
-- PART 4: UPDATE LEAD PREFERRED BRANCH
-- Sets the preferred branch for a lead
-- Called after branch detection/selection
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_lead_preferred_branch(
    p_lead_id UUID,
    p_branch_id UUID,
    p_source TEXT DEFAULT 'ai_detected'  -- 'ai_detected', 'user_selected', 'manual', 'channel_default'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_old_branch_id UUID;
    v_branch_name TEXT;
BEGIN
    -- Get lead info
    SELECT tenant_id, preferred_branch_id
    INTO v_tenant_id, v_old_branch_id
    FROM leads
    WHERE id = p_lead_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Lead not found'
        );
    END IF;

    -- Validate branch belongs to same tenant
    SELECT name INTO v_branch_name
    FROM branches
    WHERE id = p_branch_id
      AND tenant_id = v_tenant_id
      AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Branch not found or does not belong to tenant'
        );
    END IF;

    -- Update lead
    UPDATE leads
    SET
        preferred_branch_id = p_branch_id,
        updated_at = NOW(),
        metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
            'branch_preference_source', p_source,
            'branch_preference_updated_at', NOW()
        )
    WHERE id = p_lead_id;

    RETURN jsonb_build_object(
        'success', true,
        'lead_id', p_lead_id,
        'branch_id', p_branch_id,
        'branch_name', v_branch_name,
        'previous_branch_id', v_old_branch_id,
        'source', p_source
    );
END;
$$;

COMMENT ON FUNCTION update_lead_preferred_branch IS
'Updates the preferred branch for a lead. Called after AI detects or user selects a branch.
Source can be: ai_detected, user_selected, manual, channel_default';

GRANT EXECUTE ON FUNCTION update_lead_preferred_branch TO authenticated;
GRANT EXECUTE ON FUNCTION update_lead_preferred_branch TO service_role;

-- =====================================================
-- PART 5: GET CONVERSATION BRANCH CONTEXT
-- Gets branch info for a conversation, with fallbacks
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_conversation_branch_context(
    p_conversation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conversation RECORD;
    v_branch RECORD;
    v_lead_preferred_branch_id UUID;
    v_channel_connection_branch_id UUID;
    v_effective_branch_id UUID;
    v_branch_source TEXT;
BEGIN
    -- Get conversation details
    SELECT c.*, l.preferred_branch_id as lead_preferred_branch_id
    INTO v_conversation
    FROM conversations c
    LEFT JOIN leads l ON l.id = c.lead_id
    WHERE c.id = p_conversation_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Conversation not found'
        );
    END IF;

    -- Get channel connection's branch if available
    IF v_conversation.channel_connection_id IS NOT NULL THEN
        SELECT branch_id INTO v_channel_connection_branch_id
        FROM channel_connections
        WHERE id = v_conversation.channel_connection_id;
    END IF;

    -- Determine effective branch (priority order)
    -- 1. Conversation's own branch_id (if set)
    IF v_conversation.branch_id IS NOT NULL THEN
        v_effective_branch_id := v_conversation.branch_id;
        v_branch_source := 'conversation';
    -- 2. Lead's preferred branch (if set)
    ELSIF v_conversation.lead_preferred_branch_id IS NOT NULL THEN
        v_effective_branch_id := v_conversation.lead_preferred_branch_id;
        v_branch_source := 'lead_preference';
    -- 3. Channel connection's branch (if set)
    ELSIF v_channel_connection_branch_id IS NOT NULL THEN
        v_effective_branch_id := v_channel_connection_branch_id;
        v_branch_source := 'channel_connection';
    -- 4. No branch determined
    ELSE
        v_effective_branch_id := NULL;
        v_branch_source := 'none';
    END IF;

    -- Get branch details if we have one
    IF v_effective_branch_id IS NOT NULL THEN
        SELECT * INTO v_branch
        FROM branches
        WHERE id = v_effective_branch_id;

        RETURN jsonb_build_object(
            'success', true,
            'has_branch', true,
            'branch_id', v_branch.id,
            'branch_name', v_branch.name,
            'branch_address', v_branch.address,
            'branch_city', v_branch.city,
            'branch_phone', v_branch.phone,
            'branch_operating_hours', v_branch.operating_hours,
            'is_headquarters', v_branch.is_headquarters,
            'source', v_branch_source,
            'conversation_id', p_conversation_id,
            'tenant_id', v_conversation.tenant_id
        );
    END IF;

    -- No branch - return info about available branches
    RETURN jsonb_build_object(
        'success', true,
        'has_branch', false,
        'source', 'none',
        'conversation_id', p_conversation_id,
        'tenant_id', v_conversation.tenant_id,
        'needs_branch_selection', (
            SELECT COUNT(*) > 1
            FROM branches
            WHERE tenant_id = v_conversation.tenant_id AND is_active = true
        ),
        'available_branches_count', (
            SELECT COUNT(*)
            FROM branches
            WHERE tenant_id = v_conversation.tenant_id AND is_active = true
        )
    );
END;
$$;

COMMENT ON FUNCTION get_conversation_branch_context IS
'Gets the branch context for a conversation with fallback logic.
Priority: conversation.branch_id > lead.preferred_branch_id > channel_connection.branch_id';

GRANT EXECUTE ON FUNCTION get_conversation_branch_context TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_branch_context TO service_role;

-- =====================================================
-- PART 6: ADD BRANCH ALIASES SUPPORT TO BRANCHES
-- Allows tenants to configure alternative names for branches
-- =====================================================

-- Add metadata column for branch aliases if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'branches'
          AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.branches
        ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;

        COMMENT ON COLUMN branches.metadata IS
        'JSON metadata including aliases array for branch detection. Example: {"aliases": ["centro", "downtown", "principal"]}';
    END IF;
END $$;

-- =====================================================
-- PART 7: TRIGGER TO PROPAGATE BRANCH TO CONVERSATION
-- When conversation is created, sets branch_id from channel or lead
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_conversation_branch_on_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lead_preferred_branch_id UUID;
    v_channel_branch_id UUID;
BEGIN
    -- Only run if branch_id is not already set
    IF NEW.branch_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Try to get from lead's preferred branch
    IF NEW.lead_id IS NOT NULL THEN
        SELECT preferred_branch_id INTO v_lead_preferred_branch_id
        FROM leads
        WHERE id = NEW.lead_id;

        IF v_lead_preferred_branch_id IS NOT NULL THEN
            NEW.branch_id := v_lead_preferred_branch_id;
            RETURN NEW;
        END IF;
    END IF;

    -- Try to get from channel connection
    IF NEW.channel_connection_id IS NOT NULL THEN
        SELECT branch_id INTO v_channel_branch_id
        FROM channel_connections
        WHERE id = NEW.channel_connection_id;

        IF v_channel_branch_id IS NOT NULL THEN
            NEW.branch_id := v_channel_branch_id;
            RETURN NEW;
        END IF;
    END IF;

    -- Leave NULL if no branch source found
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_set_conversation_branch ON public.conversations;

-- Create trigger
CREATE TRIGGER trigger_set_conversation_branch
    BEFORE INSERT ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION set_conversation_branch_on_create();

-- =====================================================
-- PART 8: INDEX OPTIMIZATIONS
-- =====================================================

-- Index for branch detection queries
CREATE INDEX IF NOT EXISTS idx_branches_tenant_active_name
    ON branches(tenant_id, name)
    WHERE is_active = true;

-- Index for lead preferred branch queries
CREATE INDEX IF NOT EXISTS idx_leads_preferred_branch_active
    ON leads(tenant_id, preferred_branch_id)
    WHERE deleted_at IS NULL AND preferred_branch_id IS NOT NULL;

-- Index for conversation branch queries
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_branch_active
    ON conversations(tenant_id, branch_id)
    WHERE branch_id IS NOT NULL;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
    v_function_count INTEGER;
BEGIN
    -- Count new functions
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
          'detect_branch_from_message',
          'get_branch_disambiguation_options',
          'get_tenant_ai_context_for_branch',
          'update_lead_preferred_branch',
          'get_conversation_branch_context',
          'set_conversation_branch_on_create'
      );

    IF v_function_count >= 6 THEN
        RAISE NOTICE 'SUCCESS: All Branch-Aware Messaging functions created (% functions)', v_function_count;
    ELSE
        RAISE WARNING 'PARTIAL: Only % of 6 functions found', v_function_count;
    END IF;

    -- Check trigger exists
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_set_conversation_branch'
    ) THEN
        RAISE NOTICE 'SUCCESS: Conversation branch trigger active';
    ELSE
        RAISE WARNING 'FAILED: Conversation branch trigger not found';
    END IF;
END $$;

-- =====================================================
-- SUMMARY
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Migration 185_BRANCH_AWARE_MESSAGING_SYSTEM completed';
    RAISE NOTICE '';
    RAISE NOTICE 'New RPCs available:';
    RAISE NOTICE '1. detect_branch_from_message(tenant_id, message)';
    RAISE NOTICE '2. get_branch_disambiguation_options(tenant_id, lead_id?)';
    RAISE NOTICE '3. get_tenant_ai_context_for_branch(tenant_id, branch_id?)';
    RAISE NOTICE '4. update_lead_preferred_branch(lead_id, branch_id, source)';
    RAISE NOTICE '5. get_conversation_branch_context(conversation_id)';
    RAISE NOTICE '';
    RAISE NOTICE 'Triggers:';
    RAISE NOTICE '- trigger_set_conversation_branch (on conversations INSERT)';
    RAISE NOTICE '';
    RAISE NOTICE 'Usage Flow:';
    RAISE NOTICE '1. Supervisor calls detect_branch_from_message()';
    RAISE NOTICE '2. If no match, call get_branch_disambiguation_options()';
    RAISE NOTICE '3. Ask user: "A cual sucursal te gustaria acudir?"';
    RAISE NOTICE '4. On selection, call update_lead_preferred_branch()';
    RAISE NOTICE '5. Get branch context with get_tenant_ai_context_for_branch()';
    RAISE NOTICE '=====================================================';
END $$;

COMMIT;

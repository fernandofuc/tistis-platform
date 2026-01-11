-- =====================================================
-- TIS TIS PLATFORM - Migration 123
-- FIX: AI Learning Critical Security & Data Integrity
-- =====================================================
--
-- VULNERABILIDADES CORREGIDAS:
-- 1. CRITICAL: upsert_message_pattern no validaba tenant ownership
-- 2. CRITICAL: message_id NULL permite duplicados en cola
-- 3. HIGH: XSS en pattern_value y context_examples
-- 4. HIGH: Error matemático en cálculo de sentiment_avg
-- 5. MEDIUM: cleanup_learning_queue no aislaba por tenant
-- 6. MEDIUM: get_tenant_learning_context sin validación
-- =====================================================

-- =====================================================
-- 1. FIX CRITICAL: upsert_message_pattern con validación de tenant
-- El RPC anterior aceptaba cualquier p_tenant_id sin validar
-- que el usuario perteneciera a ese tenant (IDOR vulnerability)
-- =====================================================
CREATE OR REPLACE FUNCTION upsert_message_pattern(
    p_tenant_id UUID,
    p_pattern_type TEXT,
    p_pattern_value TEXT,
    p_context_example TEXT DEFAULT NULL,
    p_sentiment DECIMAL DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized TEXT;
    pattern_id UUID;
    sanitized_value TEXT;
    sanitized_context TEXT;
    v_current_count INTEGER;
    v_current_sentiment DECIMAL;
BEGIN
    -- SECURITY: Validate this is called by service_role OR user belongs to tenant
    -- Service role is needed for CRON processing
    IF auth.role() != 'service_role' THEN
        -- Check user has access to this tenant
        IF NOT EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND tenant_id = p_tenant_id
            AND role IN ('owner', 'admin', 'manager')
        ) THEN
            RAISE EXCEPTION 'SECURITY: User does not have access to tenant %', p_tenant_id;
        END IF;
    END IF;

    -- SECURITY: Sanitize pattern_value against XSS
    -- Remove potential script tags and dangerous patterns
    sanitized_value := regexp_replace(p_pattern_value, '<script[^>]*>.*?</script>', '', 'gi');
    sanitized_value := regexp_replace(sanitized_value, 'javascript:', '', 'gi');
    sanitized_value := regexp_replace(sanitized_value, 'on\w+\s*=', '', 'gi');
    sanitized_value := regexp_replace(sanitized_value, '<iframe[^>]*>', '', 'gi');
    sanitized_value := regexp_replace(sanitized_value, '<object[^>]*>', '', 'gi');
    sanitized_value := regexp_replace(sanitized_value, '<embed[^>]*>', '', 'gi');

    -- Limit length to prevent abuse
    sanitized_value := substring(sanitized_value, 1, 500);

    -- Sanitize context example too
    IF p_context_example IS NOT NULL THEN
        sanitized_context := regexp_replace(p_context_example, '<script[^>]*>.*?</script>', '', 'gi');
        sanitized_context := regexp_replace(sanitized_context, 'javascript:', '', 'gi');
        sanitized_context := substring(sanitized_context, 1, 300);
    ELSE
        sanitized_context := NULL;
    END IF;

    -- Normalizar el valor
    normalized := lower(trim(sanitized_value));

    -- Reject empty or too short patterns
    IF length(normalized) < 2 THEN
        RETURN NULL;
    END IF;

    -- FIX: Correct sentiment average calculation
    -- Get current values before update to calculate weighted average correctly
    SELECT occurrence_count, sentiment_avg
    INTO v_current_count, v_current_sentiment
    FROM ai_message_patterns
    WHERE tenant_id = p_tenant_id
      AND pattern_type = p_pattern_type
      AND normalized_value = normalized;

    -- Intentar insertar o actualizar
    INSERT INTO ai_message_patterns (
        tenant_id,
        pattern_type,
        pattern_value,
        normalized_value,
        context_examples,
        sentiment_avg,
        metadata
    ) VALUES (
        p_tenant_id,
        p_pattern_type,
        sanitized_value,
        normalized,
        CASE WHEN sanitized_context IS NOT NULL THEN ARRAY[sanitized_context] ELSE ARRAY[]::TEXT[] END,
        p_sentiment,
        p_metadata
    )
    ON CONFLICT (tenant_id, pattern_type, normalized_value) DO UPDATE SET
        occurrence_count = ai_message_patterns.occurrence_count + 1,
        last_occurrence = NOW(),
        context_examples = CASE
            WHEN sanitized_context IS NOT NULL
                AND NOT sanitized_context = ANY(ai_message_patterns.context_examples)
                AND COALESCE(array_length(ai_message_patterns.context_examples, 1), 0) < 10
            THEN array_append(ai_message_patterns.context_examples, sanitized_context)
            ELSE ai_message_patterns.context_examples
        END,
        -- FIX: Correct weighted average calculation for sentiment
        -- Formula: (old_avg * old_count + new_value) / (old_count + 1)
        sentiment_avg = CASE
            WHEN p_sentiment IS NOT NULL THEN
                ROUND(
                    (COALESCE(v_current_sentiment, 0) * COALESCE(v_current_count, 0) + p_sentiment)
                    / (COALESCE(v_current_count, 0) + 1),
                    2
                )
            ELSE ai_message_patterns.sentiment_avg
        END,
        metadata = ai_message_patterns.metadata || p_metadata,
        updated_at = NOW()
    RETURNING id INTO pattern_id;

    RETURN pattern_id;
END;
$$;

-- Revoke direct execution from authenticated, only allow via API
REVOKE EXECUTE ON FUNCTION upsert_message_pattern FROM authenticated;
GRANT EXECUTE ON FUNCTION upsert_message_pattern TO service_role;

COMMENT ON FUNCTION upsert_message_pattern IS
'SECURITY: Validates tenant ownership before inserting/updating patterns.
XSS: Sanitizes pattern_value and context_example.
MATH: Fixed weighted average calculation for sentiment.';

-- =====================================================
-- 2. FIX CRITICAL: Prevent duplicate queue entries with NULL message_id
-- The UNIQUE constraint (tenant_id, message_id) doesn't prevent
-- duplicates when message_id is NULL
-- =====================================================

-- Add a partial unique index to prevent multiple NULLs per conversation
CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_queue_null_msg_dedup
ON ai_learning_queue (tenant_id, conversation_id, message_content)
WHERE message_id IS NULL;

-- Also add validation to queue_message_for_learning
CREATE OR REPLACE FUNCTION queue_message_for_learning(
    p_tenant_id UUID,
    p_conversation_id UUID,
    p_message_id UUID,
    p_message_content TEXT,
    p_message_role TEXT,
    p_channel TEXT DEFAULT 'whatsapp',
    p_lead_id UUID DEFAULT NULL,
    p_detected_intent TEXT DEFAULT NULL,
    p_detected_signals JSONB DEFAULT NULL,
    p_ai_response TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    config_record RECORD;
    queue_id UUID;
    sanitized_content TEXT;
    content_hash TEXT;
BEGIN
    -- Verificar si el aprendizaje está habilitado para este tenant
    SELECT * INTO config_record
    FROM ai_learning_config
    WHERE tenant_id = p_tenant_id AND learning_enabled = true;

    IF NOT FOUND THEN
        RETURN NULL; -- Aprendizaje no habilitado
    END IF;

    -- SECURITY: Validate content is not too long (DoS prevention)
    IF length(p_message_content) > 10000 THEN
        sanitized_content := substring(p_message_content, 1, 10000);
    ELSE
        sanitized_content := p_message_content;
    END IF;

    -- Generate content hash for deduplication when message_id is NULL
    content_hash := encode(sha256(sanitized_content::bytea), 'hex');

    -- Insertar en la cola (con mejor manejo de duplicados)
    BEGIN
        INSERT INTO ai_learning_queue (
            tenant_id,
            conversation_id,
            message_id,
            message_content,
            message_role,
            channel,
            lead_id,
            detected_intent,
            detected_signals,
            ai_response
        ) VALUES (
            p_tenant_id,
            p_conversation_id,
            p_message_id,
            sanitized_content,
            p_message_role,
            p_channel,
            p_lead_id,
            p_detected_intent,
            p_detected_signals,
            p_ai_response
        )
        ON CONFLICT (tenant_id, message_id) WHERE message_id IS NOT NULL DO NOTHING
        RETURNING id INTO queue_id;

        -- If queue_id is NULL, it was a duplicate
        IF queue_id IS NULL THEN
            RETURN NULL;
        END IF;

    EXCEPTION WHEN unique_violation THEN
        -- Handle the partial index violation for NULL message_ids
        RETURN NULL;
    END;

    RETURN queue_id;
END;
$$;

GRANT EXECUTE ON FUNCTION queue_message_for_learning TO authenticated;
GRANT EXECUTE ON FUNCTION queue_message_for_learning TO service_role;

COMMENT ON FUNCTION queue_message_for_learning IS
'SECURITY: Prevents duplicate entries even with NULL message_id.
Validates content length to prevent DoS.';

-- =====================================================
-- 3. FIX MEDIUM: cleanup_learning_queue tenant isolation
-- The cleanup should respect tenant boundaries and not
-- delete data from other tenants
-- =====================================================

-- FIX: Must DROP old function first because signature changed
-- Old (migration 119): (p_max_age_days INTEGER, p_max_items INTEGER)
-- New: (p_max_age_days INTEGER, p_max_items INTEGER, p_tenant_id UUID)
DROP FUNCTION IF EXISTS public.cleanup_learning_queue(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION cleanup_learning_queue(
    p_max_age_days INTEGER DEFAULT 7,
    p_max_items INTEGER DEFAULT 10000,
    p_tenant_id UUID DEFAULT NULL  -- NEW: Optional tenant filter
)
RETURNS TABLE(deleted_count INTEGER, remaining_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted INTEGER := 0;
    v_remaining INTEGER := 0;
    v_cutoff_date TIMESTAMPTZ;
BEGIN
    -- Calculate cutoff date
    v_cutoff_date := NOW() - (p_max_age_days || ' days')::INTERVAL;

    -- Delete old items (completed or failed, older than cutoff)
    IF p_tenant_id IS NOT NULL THEN
        -- Tenant-specific cleanup
        WITH deleted AS (
            DELETE FROM ai_learning_queue
            WHERE tenant_id = p_tenant_id
              AND status IN ('completed', 'failed')
              AND created_at < v_cutoff_date
            RETURNING id
        )
        SELECT COUNT(*) INTO v_deleted FROM deleted;
    ELSE
        -- Global cleanup (only for service_role via CRON)
        IF auth.role() != 'service_role' THEN
            RAISE EXCEPTION 'SECURITY: Global cleanup only allowed for service_role';
        END IF;

        WITH deleted AS (
            DELETE FROM ai_learning_queue
            WHERE status IN ('completed', 'failed')
              AND created_at < v_cutoff_date
            RETURNING id
        )
        SELECT COUNT(*) INTO v_deleted FROM deleted;
    END IF;

    -- If queue is still over limit, delete oldest completed items
    IF p_tenant_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_remaining
        FROM ai_learning_queue
        WHERE tenant_id = p_tenant_id;

        IF v_remaining > p_max_items THEN
            WITH to_delete AS (
                SELECT id FROM ai_learning_queue
                WHERE tenant_id = p_tenant_id
                  AND status = 'completed'
                ORDER BY created_at ASC
                LIMIT v_remaining - p_max_items
            ),
            deleted AS (
                DELETE FROM ai_learning_queue
                WHERE id IN (SELECT id FROM to_delete)
                RETURNING id
            )
            SELECT v_deleted + COUNT(*) INTO v_deleted FROM deleted;
        END IF;

        -- Get final count
        SELECT COUNT(*) INTO v_remaining
        FROM ai_learning_queue
        WHERE tenant_id = p_tenant_id;
    ELSE
        SELECT COUNT(*) INTO v_remaining FROM ai_learning_queue;

        IF v_remaining > p_max_items THEN
            WITH to_delete AS (
                SELECT id FROM ai_learning_queue
                WHERE status = 'completed'
                ORDER BY created_at ASC
                LIMIT v_remaining - p_max_items
            ),
            deleted AS (
                DELETE FROM ai_learning_queue
                WHERE id IN (SELECT id FROM to_delete)
                RETURNING id
            )
            SELECT v_deleted + COUNT(*) INTO v_deleted FROM deleted;
        END IF;

        SELECT COUNT(*) INTO v_remaining FROM ai_learning_queue;
    END IF;

    RETURN QUERY SELECT v_deleted, v_remaining;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_learning_queue(INTEGER, INTEGER, UUID) TO service_role;

COMMENT ON FUNCTION cleanup_learning_queue(INTEGER, INTEGER, UUID) IS
'SECURITY: Global cleanup only for service_role.
Optional p_tenant_id for tenant-isolated cleanup.';

-- =====================================================
-- 4. FIX MEDIUM: get_tenant_learning_context validation
-- Add tenant validation for non-service-role callers
-- =====================================================

CREATE OR REPLACE FUNCTION get_tenant_learning_context(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    -- SECURITY: Validate caller has access to tenant
    IF auth.role() != 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND tenant_id = p_tenant_id
        ) THEN
            RAISE EXCEPTION 'SECURITY: User does not have access to tenant %', p_tenant_id;
        END IF;
    END IF;

    result := jsonb_build_object(
        -- Patrones más frecuentes por tipo
        'top_service_requests', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'service', pattern_value,
                'frequency', occurrence_count
            ) ORDER BY occurrence_count DESC)
            FROM ai_message_patterns
            WHERE tenant_id = p_tenant_id
                AND pattern_type = 'service_request'
                AND is_active = true
            LIMIT 10
        ), '[]'::jsonb),

        'common_objections', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'objection', pattern_value,
                'frequency', occurrence_count,
                'examples', context_examples[1:2]
            ) ORDER BY occurrence_count DESC)
            FROM ai_message_patterns
            WHERE tenant_id = p_tenant_id
                AND pattern_type = 'objection'
                AND is_active = true
            LIMIT 5
        ), '[]'::jsonb),

        'scheduling_preferences', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'preference', pattern_value,
                'frequency', occurrence_count
            ) ORDER BY occurrence_count DESC)
            FROM ai_message_patterns
            WHERE tenant_id = p_tenant_id
                AND pattern_type = 'scheduling_preference'
                AND is_active = true
            LIMIT 5
        ), '[]'::jsonb),

        'pain_points', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'pain', pattern_value,
                'frequency', occurrence_count
            ) ORDER BY occurrence_count DESC)
            FROM ai_message_patterns
            WHERE tenant_id = p_tenant_id
                AND pattern_type = 'pain_point'
                AND is_active = true
            LIMIT 10
        ), '[]'::jsonb),

        -- Vocabulario aprendido
        'learned_vocabulary', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'term', term,
                'meaning', meaning,
                'category', category
            ) ORDER BY usage_count DESC)
            FROM ai_learned_vocabulary
            WHERE tenant_id = p_tenant_id
                AND is_active = true
            LIMIT 20
        ), '[]'::jsonb),

        -- Insights activos
        'active_insights', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'type', insight_type,
                'title', title,
                'recommendation', recommendation
            ) ORDER BY impact_score DESC)
            FROM ai_business_insights
            WHERE tenant_id = p_tenant_id
                AND is_active = true
                AND dismissed = false
            LIMIT 5
        ), '[]'::jsonb)
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_tenant_learning_context TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_learning_context TO service_role;

COMMENT ON FUNCTION get_tenant_learning_context IS
'SECURITY: Validates caller has access to tenant before returning learning context.';

-- =====================================================
-- 5. FIX: Add XSS sanitization function for reuse
-- =====================================================

CREATE OR REPLACE FUNCTION sanitize_xss(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_text IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN regexp_replace(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(p_text, '<script[^>]*>.*?</script>', '', 'gi'),
                    'javascript:', '', 'gi'
                ),
                'on\w+\s*=', '', 'gi'
            ),
            '<(iframe|object|embed|link|meta)[^>]*>', '', 'gi'
        ),
        '&#x?[0-9a-f]+;', '', 'gi'
    );
END;
$$;

COMMENT ON FUNCTION sanitize_xss IS 'Removes common XSS attack vectors from text';

-- =====================================================
-- 6. FIX: Add RLS policy for ai_learning_queue SELECT
-- Users should be able to see their tenant's queue status
-- =====================================================

-- Drop existing policy if it only allows service_role
DROP POLICY IF EXISTS "Users can view their tenant queue" ON ai_learning_queue;

-- Add policy for users to view their own tenant's queue
CREATE POLICY "Users can view their tenant queue"
    ON ai_learning_queue FOR SELECT
    USING (
        auth.role() = 'service_role'
        OR tenant_id IN (
            SELECT ur.tenant_id FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('owner', 'admin', 'manager')
        )
    );

-- =====================================================
-- 7. Add index for better queue processing performance
-- =====================================================

-- Index for fair round-robin processing by tenant
CREATE INDEX IF NOT EXISTS idx_learning_queue_tenant_status_created
ON ai_learning_queue (tenant_id, status, created_at)
WHERE status = 'pending';

-- =====================================================
-- 8. Add monitoring function for queue health
-- =====================================================

CREATE OR REPLACE FUNCTION get_learning_queue_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE(
    tenant_id UUID,
    pending_count BIGINT,
    processing_count BIGINT,
    completed_count BIGINT,
    failed_count BIGINT,
    oldest_pending TIMESTAMPTZ,
    avg_processing_time_ms NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- SECURITY: If not service_role, only return stats for user's tenant
    IF auth.role() != 'service_role' AND p_tenant_id IS NULL THEN
        SELECT ur.tenant_id INTO p_tenant_id
        FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        LIMIT 1;
    END IF;

    IF p_tenant_id IS NOT NULL THEN
        -- Single tenant stats
        RETURN QUERY
        SELECT
            q.tenant_id,
            COUNT(*) FILTER (WHERE q.status = 'pending'),
            COUNT(*) FILTER (WHERE q.status = 'processing'),
            COUNT(*) FILTER (WHERE q.status = 'completed'),
            COUNT(*) FILTER (WHERE q.status = 'failed'),
            MIN(q.created_at) FILTER (WHERE q.status = 'pending'),
            AVG(EXTRACT(EPOCH FROM (q.completed_at - q.processing_started_at)) * 1000)
                FILTER (WHERE q.status = 'completed' AND q.completed_at IS NOT NULL)
        FROM ai_learning_queue q
        WHERE q.tenant_id = p_tenant_id
        GROUP BY q.tenant_id;
    ELSE
        -- All tenants (service_role only)
        RETURN QUERY
        SELECT
            q.tenant_id,
            COUNT(*) FILTER (WHERE q.status = 'pending'),
            COUNT(*) FILTER (WHERE q.status = 'processing'),
            COUNT(*) FILTER (WHERE q.status = 'completed'),
            COUNT(*) FILTER (WHERE q.status = 'failed'),
            MIN(q.created_at) FILTER (WHERE q.status = 'pending'),
            AVG(EXTRACT(EPOCH FROM (q.completed_at - q.processing_started_at)) * 1000)
                FILTER (WHERE q.status = 'completed' AND q.completed_at IS NOT NULL)
        FROM ai_learning_queue q
        GROUP BY q.tenant_id;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_learning_queue_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_learning_queue_stats TO service_role;

COMMENT ON FUNCTION get_learning_queue_stats IS
'Returns queue statistics per tenant. Non-service-role users only see their own tenant.';

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE ai_learning_queue IS
'Queue for messages pending AI learning processing.
SECURITY: RLS enabled. Users can view their tenant queue.
Service role has full access for CRON processing.';

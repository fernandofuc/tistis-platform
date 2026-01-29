-- =====================================================
-- Migration 179: Embedding Cache Invalidation System
-- =====================================================
-- Purpose: Automatically invalidate embedding caches when
-- knowledge base content is updated
-- =====================================================

-- Create embedding invalidation log table
-- Tracks when embeddings need to be regenerated
CREATE TABLE IF NOT EXISTS embedding_invalidation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('knowledge_article', 'faq', 'policy', 'service', 'chunk')),
  source_id UUID NOT NULL,
  invalidation_reason TEXT NOT NULL,
  priority INTEGER DEFAULT 0, -- 0=normal, 1=high (user-facing), 2=critical
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(source_type, source_id, status)
);

-- Index for processing pending invalidations
CREATE INDEX IF NOT EXISTS idx_embedding_invalidation_pending
ON embedding_invalidation_queue(status, priority DESC, created_at)
WHERE status = 'pending';

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_embedding_invalidation_processed
ON embedding_invalidation_queue(processed_at)
WHERE status IN ('completed', 'failed');

-- RLS
ALTER TABLE embedding_invalidation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages embedding invalidation"
ON embedding_invalidation_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =====================================================
-- FUNCTION: Enqueue embedding invalidation
-- =====================================================
CREATE OR REPLACE FUNCTION enqueue_embedding_invalidation(
  p_tenant_id UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_reason TEXT DEFAULT 'content_updated',
  p_priority INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Upsert: if pending already exists, update priority if higher
  INSERT INTO embedding_invalidation_queue (
    tenant_id,
    source_type,
    source_id,
    invalidation_reason,
    priority,
    status
  ) VALUES (
    p_tenant_id,
    p_source_type,
    p_source_id,
    p_reason,
    p_priority,
    'pending'
  )
  ON CONFLICT (source_type, source_id, status)
  DO UPDATE SET
    priority = GREATEST(embedding_invalidation_queue.priority, EXCLUDED.priority),
    invalidation_reason = EXCLUDED.invalidation_reason,
    created_at = NOW()
  WHERE embedding_invalidation_queue.status = 'pending'
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION enqueue_embedding_invalidation TO service_role;

-- =====================================================
-- FUNCTION: Get pending invalidations for processing
-- =====================================================
CREATE OR REPLACE FUNCTION get_pending_embedding_invalidations(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  source_type TEXT,
  source_id UUID,
  invalidation_reason TEXT,
  priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE embedding_invalidation_queue eq
  SET status = 'processing'
  WHERE eq.id IN (
    SELECT eq2.id
    FROM embedding_invalidation_queue eq2
    WHERE eq2.status = 'pending'
    ORDER BY eq2.priority DESC, eq2.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    eq.id,
    eq.tenant_id,
    eq.source_type,
    eq.source_id,
    eq.invalidation_reason,
    eq.priority;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_embedding_invalidations TO service_role;

-- =====================================================
-- FUNCTION: Mark invalidation as completed
-- =====================================================
CREATE OR REPLACE FUNCTION complete_embedding_invalidation(
  p_id UUID,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_success THEN
    UPDATE embedding_invalidation_queue
    SET status = 'completed',
        processed_at = NOW()
    WHERE id = p_id;
  ELSE
    UPDATE embedding_invalidation_queue
    SET retry_count = retry_count + 1,
        error_message = p_error_message,
        status = CASE
          WHEN retry_count + 1 >= max_retries THEN 'failed'
          ELSE 'pending'
        END,
        processed_at = CASE
          WHEN retry_count + 1 >= max_retries THEN NOW()
          ELSE NULL
        END
    WHERE id = p_id;
  END IF;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_embedding_invalidation TO service_role;

-- =====================================================
-- TRIGGER: Auto-invalidate on knowledge_article update
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_invalidate_article_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only invalidate if content changed
  IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
    PERFORM enqueue_embedding_invalidation(
      NEW.tenant_id,
      'knowledge_article',
      NEW.id,
      'content_updated',
      1 -- high priority
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_article_embedding ON ai_knowledge_articles;
CREATE TRIGGER trg_invalidate_article_embedding
  AFTER UPDATE ON ai_knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_invalidate_article_embedding();

-- =====================================================
-- TRIGGER: Auto-invalidate on FAQ update
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_invalidate_faq_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only invalidate if content changed
  IF OLD.question IS DISTINCT FROM NEW.question OR OLD.answer IS DISTINCT FROM NEW.answer THEN
    PERFORM enqueue_embedding_invalidation(
      NEW.tenant_id,
      'faq',
      NEW.id,
      'content_updated',
      1 -- high priority
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_faq_embedding ON faqs;
CREATE TRIGGER trg_invalidate_faq_embedding
  AFTER UPDATE ON faqs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_invalidate_faq_embedding();

-- =====================================================
-- TRIGGER: Auto-invalidate on service update
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_invalidate_service_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only invalidate if content changed
  IF OLD.name IS DISTINCT FROM NEW.name OR OLD.description IS DISTINCT FROM NEW.description THEN
    PERFORM enqueue_embedding_invalidation(
      NEW.tenant_id,
      'service',
      NEW.id,
      'content_updated',
      1 -- high priority
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_service_embedding ON services;
CREATE TRIGGER trg_invalidate_service_embedding
  AFTER UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION trigger_invalidate_service_embedding();

-- =====================================================
-- CLEANUP: Remove old completed/failed entries
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_invalidations(
  p_days_to_keep INTEGER DEFAULT 7
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM embedding_invalidation_queue
  WHERE status IN ('completed', 'failed')
    AND processed_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_invalidations TO service_role;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE embedding_invalidation_queue IS
'Queue for tracking embedding invalidations. When content is updated,
entries are added here and processed by cron job to regenerate embeddings.';

COMMENT ON FUNCTION enqueue_embedding_invalidation IS
'Enqueue a source for embedding regeneration. Called by triggers when content is updated.';

COMMENT ON FUNCTION get_pending_embedding_invalidations IS
'Get pending invalidations for processing by cron job. Uses FOR UPDATE SKIP LOCKED for concurrency.';

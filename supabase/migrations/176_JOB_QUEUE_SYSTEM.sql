-- =====================================================
-- TIS TIS PLATFORM - Job Queue System
-- Migration: 176_JOB_QUEUE_SYSTEM.sql
-- Purpose: Background job processing for async operations
-- =====================================================

-- ======================
-- JOB STATUS ENUM
-- ======================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
  END IF;
END$$;

-- ======================
-- JOB PRIORITY ENUM
-- ======================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_priority') THEN
    CREATE TYPE job_priority AS ENUM ('low', 'normal', 'high', 'urgent');
  END IF;
END$$;

-- ======================
-- JOB QUEUE TABLE
-- ======================
CREATE TABLE IF NOT EXISTS public.job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job definition
  type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',

  -- Status tracking
  status job_status NOT NULL DEFAULT 'pending',
  priority job_priority NOT NULL DEFAULT 'normal',

  -- Retry configuration
  retries INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 300000,

  -- Results
  error TEXT,
  result JSONB,
  progress INTEGER CHECK (progress >= 0 AND progress <= 100),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ
);

-- ======================
-- INDEXES FOR PERFORMANCE
-- ======================

-- Index for fetching pending jobs by priority
CREATE INDEX IF NOT EXISTS idx_job_queue_pending_priority
  ON public.job_queue (priority DESC, created_at ASC)
  WHERE status = 'pending';

-- Index for job type filtering
CREATE INDEX IF NOT EXISTS idx_job_queue_type
  ON public.job_queue (type);

-- Index for scheduled jobs
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled
  ON public.job_queue (scheduled_for)
  WHERE status = 'pending' AND scheduled_for IS NOT NULL;

-- Index for cleanup of old completed jobs
CREATE INDEX IF NOT EXISTS idx_job_queue_cleanup
  ON public.job_queue (completed_at)
  WHERE status IN ('completed', 'failed', 'cancelled');

-- ======================
-- AUTO-UPDATE TIMESTAMP
-- ======================
CREATE OR REPLACE FUNCTION update_job_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_queue_updated_at ON public.job_queue;
CREATE TRIGGER trg_job_queue_updated_at
  BEFORE UPDATE ON public.job_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_job_queue_updated_at();

-- ======================
-- RLS POLICIES
-- ======================
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "job_queue_service_role" ON public.job_queue
  FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

-- ======================
-- CLEANUP FUNCTION
-- ======================
-- Cleans up old completed/failed jobs (call via cron)
CREATE OR REPLACE FUNCTION cleanup_old_jobs(days_to_keep INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.job_queue
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND completed_at < NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- STATS FUNCTION
-- ======================
CREATE OR REPLACE FUNCTION get_job_queue_stats(p_type VARCHAR DEFAULT NULL)
RETURNS TABLE (
  status job_status,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT jq.status, COUNT(*)::BIGINT
  FROM public.job_queue jq
  WHERE (p_type IS NULL OR jq.type = p_type)
  GROUP BY jq.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- COMMENTS
-- ======================
COMMENT ON TABLE public.job_queue IS 'Background job queue for async processing (KB embeddings, bulk operations)';
COMMENT ON COLUMN public.job_queue.type IS 'Job type identifier (e.g., kb:generate_embedding)';
COMMENT ON COLUMN public.job_queue.payload IS 'JSON payload with job-specific data';
COMMENT ON COLUMN public.job_queue.timeout_ms IS 'Maximum execution time in milliseconds';
COMMENT ON COLUMN public.job_queue.progress IS 'Execution progress 0-100';
COMMENT ON COLUMN public.job_queue.scheduled_for IS 'Optional future execution time';

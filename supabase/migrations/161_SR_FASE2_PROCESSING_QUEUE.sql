-- =====================================================
-- TIS TIS PLATFORM - SOFT RESTAURANT FASE 2 PROCESSING QUEUE
-- Migration: 161_SR_FASE2_PROCESSING_QUEUE.sql
-- Date: 2026-01-22
-- Purpose: Add queue-based processing infrastructure for SR sales
--
-- FASE 2 Implementation:
-- - Extended status transitions (pending → queued → processing → processed/dead_letter)
-- - Atomic claim function with SKIP LOCKED
-- - Processing tracking fields
--
-- Pattern Reference: job-processor.service.ts, claim_next_job RPC
-- =====================================================

-- =====================================================
-- STEP 1: Add new status values and processing fields
-- =====================================================

-- Drop old constraint and create new one with extended states
ALTER TABLE public.sr_sales
DROP CONSTRAINT IF EXISTS sr_sales_status_check;

ALTER TABLE public.sr_sales
ADD CONSTRAINT sr_sales_status_check CHECK (status IN (
    'pending',        -- Recién registrado por webhook
    'queued',         -- Encolado para procesamiento
    'processing',     -- Siendo procesado actualmente
    'processed',      -- Procesado exitosamente
    'failed',         -- Falló (pendiente reintento si retry_count < 3)
    'dead_letter',    -- Falló 3+ veces, requiere atención manual
    'duplicate'       -- Duplicado detectado (legacy support)
));

-- Add processing queue fields
ALTER TABLE public.sr_sales
ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- =====================================================
-- STEP 2: Create optimized index for queue processing
-- =====================================================

-- Drop old index if exists and create optimized one
DROP INDEX IF EXISTS idx_sr_sales_queue_priority;

-- Composite index for efficient batch claiming
-- Covers: status filter, next_retry_at filter, created_at ordering
CREATE INDEX idx_sr_sales_queue_priority
ON public.sr_sales (status, next_retry_at, created_at)
WHERE status IN ('queued', 'pending');

-- Index for dead letter monitoring
CREATE INDEX IF NOT EXISTS idx_sr_sales_dead_letter
ON public.sr_sales (tenant_id, created_at DESC)
WHERE status = 'dead_letter';

-- Index for processing timeout detection
CREATE INDEX IF NOT EXISTS idx_sr_sales_processing_timeout
ON public.sr_sales (processing_started_at)
WHERE status = 'processing';

-- =====================================================
-- STEP 3: Create atomic claim function
-- Pattern: claim_next_job RPC with SELECT FOR UPDATE SKIP LOCKED
-- =====================================================

CREATE OR REPLACE FUNCTION public.claim_sr_sales_batch(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Atomic claim using CTE with FOR UPDATE SKIP LOCKED
    -- This prevents race conditions between multiple workers
    RETURN QUERY
    WITH claimed AS (
        SELECT sr.id
        FROM public.sr_sales sr
        WHERE sr.status IN ('queued', 'pending')
          -- Only claim if not scheduled for later (backoff)
          AND (sr.next_retry_at IS NULL OR sr.next_retry_at <= NOW())
        ORDER BY
            -- Priority: queued first (explicitly enqueued), then pending (backup recovery)
            CASE sr.status
                WHEN 'queued' THEN 0
                WHEN 'pending' THEN 1
            END,
            -- Then by created_at (FIFO)
            sr.created_at ASC
        LIMIT p_limit
        -- SKIP LOCKED: Don't wait for locked rows, skip them
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.sr_sales s
    SET
        status = 'processing',
        processing_started_at = NOW()
    FROM claimed c
    WHERE s.id = c.id
    RETURNING s.id;
END;
$$;

COMMENT ON FUNCTION public.claim_sr_sales_batch IS
'Atomic claim para procesar ventas SR en batch.
Usa SELECT FOR UPDATE SKIP LOCKED para evitar race conditions.
Pattern: Similar a claim_next_job en job-processor.service.ts.

Parámetros:
  p_limit: Número máximo de ventas a reclamar (default: 10)

Retorno:
  Tabla de UUIDs de ventas reclamadas (ya marcadas como processing)

Uso:
  SELECT * FROM claim_sr_sales_batch(20);';

-- =====================================================
-- STEP 4: Create helper functions for queue management
-- =====================================================

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION public.get_sr_queue_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
    pending_count BIGINT,
    queued_count BIGINT,
    processing_count BIGINT,
    processed_today BIGINT,
    failed_today BIGINT,
    dead_letter_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
        COUNT(*) FILTER (WHERE status = 'queued') AS queued_count,
        COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
        COUNT(*) FILTER (WHERE status = 'processed' AND processed_at >= v_today_start) AS processed_today,
        COUNT(*) FILTER (WHERE status = 'failed' AND updated_at >= v_today_start) AS failed_today,
        COUNT(*) FILTER (WHERE status = 'dead_letter') AS dead_letter_count
    FROM public.sr_sales
    WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
END;
$$;

COMMENT ON FUNCTION public.get_sr_queue_stats IS
'Obtiene estadísticas de la cola de procesamiento SR.
Pattern: Similar a JobProcessor.getQueueStats()';

-- Function to recover stale processing jobs (timeout detection)
CREATE OR REPLACE FUNCTION public.recover_stale_sr_sales(
    p_timeout_minutes INTEGER DEFAULT 5
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recovered INTEGER;
BEGIN
    -- Recover sales stuck in 'processing' for more than timeout
    -- This handles cases where worker crashed mid-processing
    WITH recovered AS (
        UPDATE public.sr_sales
        SET
            status = 'queued',
            processing_started_at = NULL,
            error_message = 'Recovered from stale processing state after ' || p_timeout_minutes || ' minutes'
        WHERE status = 'processing'
          AND processing_started_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_recovered FROM recovered;

    IF v_recovered > 0 THEN
        RAISE NOTICE '[SR Queue] Recovered % stale sales from processing state', v_recovered;
    END IF;

    RETURN v_recovered;
END;
$$;

COMMENT ON FUNCTION public.recover_stale_sr_sales IS
'Recupera ventas atascadas en estado processing.
Útil para manejar crashes de workers o timeouts.
Default: 5 minutos de timeout.';

-- =====================================================
-- STEP 5: Add trigger to auto-set queued_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.trigger_sr_sales_queue_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    -- Set queued_at when transitioning to 'queued'
    IF NEW.status = 'queued' AND (OLD.status IS NULL OR OLD.status != 'queued') THEN
        NEW.queued_at := COALESCE(NEW.queued_at, NOW());
    END IF;

    -- Set processing_started_at when transitioning to 'processing'
    IF NEW.status = 'processing' AND (OLD.status IS NULL OR OLD.status != 'processing') THEN
        NEW.processing_started_at := COALESCE(NEW.processing_started_at, NOW());
    END IF;

    -- Clear next_retry_at when not in retry state
    IF NEW.status NOT IN ('queued', 'failed') THEN
        NEW.next_retry_at := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sr_sales_queue_timestamps ON public.sr_sales;

CREATE TRIGGER trigger_sr_sales_queue_timestamps
    BEFORE UPDATE ON public.sr_sales
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_sr_sales_queue_timestamps();

-- =====================================================
-- STEP 6: Grant permissions
-- =====================================================

-- Grant execute to authenticated users (needed for service role)
GRANT EXECUTE ON FUNCTION public.claim_sr_sales_batch(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sr_queue_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stale_sr_sales(INTEGER) TO authenticated;

-- Service role gets full access (for cron jobs)
GRANT EXECUTE ON FUNCTION public.claim_sr_sales_batch(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sr_queue_stats(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_stale_sr_sales(INTEGER) TO service_role;

-- =====================================================
-- COMPLETION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '======================================================';
    RAISE NOTICE 'Migration 161_SR_FASE2_PROCESSING_QUEUE.sql';
    RAISE NOTICE 'FASE 2 Processing Infrastructure';
    RAISE NOTICE '======================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'STATUS TRANSITIONS:';
    RAISE NOTICE '  pending → queued → processing → processed';
    RAISE NOTICE '                                ↘ failed → queued (retry)';
    RAISE NOTICE '                                ↘ dead_letter (max retries)';
    RAISE NOTICE '';
    RAISE NOTICE 'NEW COLUMNS:';
    RAISE NOTICE '  ✅ queued_at: Timestamp when sale was queued';
    RAISE NOTICE '  ✅ processing_started_at: Timestamp when processing began';
    RAISE NOTICE '  ✅ next_retry_at: Scheduled retry time (backoff)';
    RAISE NOTICE '';
    RAISE NOTICE 'NEW FUNCTIONS:';
    RAISE NOTICE '  ✅ claim_sr_sales_batch(limit): Atomic batch claim';
    RAISE NOTICE '  ✅ get_sr_queue_stats(tenant_id): Queue statistics';
    RAISE NOTICE '  ✅ recover_stale_sr_sales(timeout): Timeout recovery';
    RAISE NOTICE '';
    RAISE NOTICE 'NEW INDEXES:';
    RAISE NOTICE '  ✅ idx_sr_sales_queue_priority: Optimized for claiming';
    RAISE NOTICE '  ✅ idx_sr_sales_dead_letter: For monitoring';
    RAISE NOTICE '  ✅ idx_sr_sales_processing_timeout: For recovery';
    RAISE NOTICE '';
    RAISE NOTICE 'Pattern: job-processor.service.ts + claim_next_job RPC';
    RAISE NOTICE '======================================================';
END $$;

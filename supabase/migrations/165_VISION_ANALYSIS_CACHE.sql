-- =====================================================
-- TIS TIS PLATFORM - Vision Analysis Cache
-- Migration: 165_VISION_ANALYSIS_CACHE
-- Caches image analysis results to reduce API costs
-- =====================================================

-- =====================================================
-- CACHE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS vision_analysis_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  image_hash text NOT NULL,
  context text NOT NULL,
  analysis jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  hit_count int DEFAULT 0,

  -- Unique constraint for upsert
  CONSTRAINT vision_cache_unique
    UNIQUE (tenant_id, image_hash, context)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Tenant lookup (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_vision_cache_tenant
  ON vision_analysis_cache(tenant_id);

-- Hash lookup within tenant
CREATE INDEX IF NOT EXISTS idx_vision_cache_hash
  ON vision_analysis_cache(tenant_id, image_hash);

-- Expiration cleanup
CREATE INDEX IF NOT EXISTS idx_vision_cache_expires
  ON vision_analysis_cache(expires_at)
  WHERE expires_at IS NOT NULL;

-- Hit count for analytics
CREATE INDEX IF NOT EXISTS idx_vision_cache_hits
  ON vision_analysis_cache(tenant_id, hit_count DESC);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE vision_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by backend)
CREATE POLICY "service_role_vision_cache_access" ON vision_analysis_cache
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- HIT COUNT INCREMENT FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION increment_vision_cache_hits(cache_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE vision_analysis_cache
  SET hit_count = hit_count + 1
  WHERE id = cache_id;
END;
$$;

-- =====================================================
-- AUTO-CLEANUP FUNCTION
-- Removes expired entries periodically
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_vision_cache()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count int;
BEGIN
  DELETE FROM vision_analysis_cache
  WHERE expires_at < now();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE vision_analysis_cache IS
  'Caches Gemini vision analysis results to reduce API costs';

COMMENT ON COLUMN vision_analysis_cache.image_hash IS
  'SHA-256 hash of image content (truncated to 32 chars)';

COMMENT ON COLUMN vision_analysis_cache.context IS
  'Analysis context: menu, services, promotion, general';

COMMENT ON COLUMN vision_analysis_cache.analysis IS
  'Cached VisionAnalysis result from Gemini';

COMMENT ON COLUMN vision_analysis_cache.hit_count IS
  'Number of times this cache entry was accessed';

-- =====================================================
-- TIS TIS PLATFORM - Setup Assistant LangGraph Checkpoints
-- Migration: 164_SETUP_ASSISTANT_CHECKPOINTS
-- Persists LangGraph state for session recovery
-- =====================================================

-- =====================================================
-- CHECKPOINTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS setup_assistant_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL,
  checkpoint_ns text NOT NULL DEFAULT '',
  checkpoint_id text NOT NULL,
  parent_checkpoint_id text,
  checkpoint_data jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Unique constraint for upsert
  CONSTRAINT setup_assistant_checkpoints_unique
    UNIQUE (thread_id, checkpoint_ns, checkpoint_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Thread lookup (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_id
  ON setup_assistant_checkpoints(thread_id);

-- Thread + namespace lookup
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_ns
  ON setup_assistant_checkpoints(thread_id, checkpoint_ns);

-- Most recent checkpoint per thread
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_created
  ON setup_assistant_checkpoints(thread_id, created_at DESC);

-- Parent checkpoint lookup (for history traversal)
CREATE INDEX IF NOT EXISTS idx_checkpoints_parent
  ON setup_assistant_checkpoints(parent_checkpoint_id)
  WHERE parent_checkpoint_id IS NOT NULL;

-- =====================================================
-- RLS POLICIES
-- Note: Checkpoints are accessed by service role only
-- through the checkpointer service, not directly by users
-- =====================================================

ALTER TABLE setup_assistant_checkpoints ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by backend)
CREATE POLICY "service_role_full_access" ON setup_assistant_checkpoints
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- CLEANUP FUNCTION
-- Removes old checkpoints to prevent unbounded growth
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_checkpoints(
  p_thread_id text,
  p_keep_count int DEFAULT 10
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count int := 0;
BEGIN
  -- Delete checkpoints older than the most recent N
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY thread_id, checkpoint_ns
             ORDER BY created_at DESC
           ) as rn
    FROM setup_assistant_checkpoints
    WHERE thread_id = p_thread_id
  ),
  to_delete AS (
    SELECT id FROM ranked WHERE rn > p_keep_count
  )
  DELETE FROM setup_assistant_checkpoints
  WHERE id IN (SELECT id FROM to_delete);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- =====================================================
-- AUTO-CLEANUP TRIGGER
-- Runs after each insert to prevent table bloat
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_cleanup_old_checkpoints()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only cleanup occasionally (1 in 10 inserts)
  IF random() < 0.1 THEN
    PERFORM cleanup_old_checkpoints(NEW.thread_id, 10);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_cleanup_checkpoints ON setup_assistant_checkpoints;
CREATE TRIGGER tr_cleanup_checkpoints
  AFTER INSERT ON setup_assistant_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cleanup_old_checkpoints();

-- =====================================================
-- BULK CLEANUP FUNCTION
-- For periodic maintenance jobs
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_all_old_checkpoints(
  p_keep_count int DEFAULT 10,
  p_max_age interval DEFAULT '30 days'::interval
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count int := 0;
  v_total_deleted int := 0;
  v_thread record;
BEGIN
  -- First, delete very old checkpoints regardless of count
  DELETE FROM setup_assistant_checkpoints
  WHERE created_at < now() - p_max_age;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  v_total_deleted := v_total_deleted + v_deleted_count;

  -- Then, for each thread, keep only the most recent N
  FOR v_thread IN (
    SELECT DISTINCT thread_id FROM setup_assistant_checkpoints
  ) LOOP
    SELECT cleanup_old_checkpoints(v_thread.thread_id, p_keep_count) INTO v_deleted_count;
    v_total_deleted := v_total_deleted + v_deleted_count;
  END LOOP;

  RETURN v_total_deleted;
END;
$$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE setup_assistant_checkpoints IS
  'Stores LangGraph checkpoints for Setup Assistant session recovery';

COMMENT ON COLUMN setup_assistant_checkpoints.thread_id IS
  'Conversation ID - links to setup_assistant_conversations.id';

COMMENT ON COLUMN setup_assistant_checkpoints.checkpoint_ns IS
  'Namespace for checkpoint isolation (default empty)';

COMMENT ON COLUMN setup_assistant_checkpoints.checkpoint_id IS
  'Unique ID for this checkpoint within the thread';

COMMENT ON COLUMN setup_assistant_checkpoints.checkpoint_data IS
  'Serialized LangGraph checkpoint data (state)';

COMMENT ON COLUMN setup_assistant_checkpoints.metadata IS
  'Checkpoint metadata (step, source node, etc.)';

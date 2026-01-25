// =====================================================
// TIS TIS PLATFORM - LangGraph Checkpointer Service
// Persists graph state to Supabase for session recovery
// =====================================================

import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// TYPES
// =====================================================

interface CheckpointRow {
  id: string;
  thread_id: string;
  checkpoint_ns: string;
  checkpoint_id: string;
  parent_checkpoint_id: string | null;
  checkpoint_data: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

interface CheckpointTuple {
  config: RunnableConfig;
  checkpoint: Checkpoint;
  metadata: CheckpointMetadata;
  parentConfig?: RunnableConfig;
}

type CheckpointListOptions = {
  filter?: Record<string, unknown>;
  before?: RunnableConfig;
  limit?: number;
};

// =====================================================
// SUPABASE CHECKPOINTER CLASS
// =====================================================

/**
 * LangGraph Checkpointer that persists state to Supabase
 * Enables:
 * - Session recovery after browser refresh
 * - Multi-turn conversation continuity
 * - Extracted data persistence
 */
export class SupabaseCheckpointer extends BaseCheckpointSaver {
  private supabase;
  private tableName: string;

  constructor(tableName = 'setup_assistant_checkpoints') {
    super();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured for checkpointer');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.tableName = tableName;
  }

  /**
   * Extract thread_id from RunnableConfig
   */
  private getThreadId(config: RunnableConfig): string {
    const threadId = config.configurable?.thread_id;
    if (!threadId || typeof threadId !== 'string') {
      throw new Error('thread_id is required in config.configurable');
    }
    return threadId;
  }

  /**
   * Extract checkpoint_ns from RunnableConfig (defaults to empty string)
   */
  private getCheckpointNs(config: RunnableConfig): string {
    return config.configurable?.checkpoint_ns ?? '';
  }

  /**
   * Get the latest checkpoint for a thread
   */
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = this.getThreadId(config);
    const checkpointNs = this.getCheckpointNs(config);
    const checkpointId = config.configurable?.checkpoint_id;

    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('thread_id', threadId)
      .eq('checkpoint_ns', checkpointNs);

    // If specific checkpoint requested
    if (checkpointId) {
      query = query.eq('checkpoint_id', checkpointId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return undefined;
    }

    const row = data as CheckpointRow;

    const checkpoint = JSON.parse(row.checkpoint_data) as Checkpoint;
    const metadata = JSON.parse(row.metadata) as CheckpointMetadata;

    const tuple: CheckpointTuple = {
      config: {
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns,
          checkpoint_id: row.checkpoint_id,
        },
      },
      checkpoint,
      metadata,
    };

    // Add parent config if exists
    if (row.parent_checkpoint_id) {
      tuple.parentConfig = {
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns,
          checkpoint_id: row.parent_checkpoint_id,
        },
      };
    }

    return tuple;
  }

  /**
   * List checkpoints for a thread
   */
  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = this.getThreadId(config);
    const checkpointNs = this.getCheckpointNs(config);
    const limit = options?.limit ?? 10;

    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('thread_id', threadId)
      .eq('checkpoint_ns', checkpointNs)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply before filter
    if (options?.before?.configurable?.checkpoint_id) {
      const beforeId = options.before.configurable.checkpoint_id;
      // Get the timestamp of the before checkpoint
      const { data: beforeData } = await this.supabase
        .from(this.tableName)
        .select('created_at')
        .eq('thread_id', threadId)
        .eq('checkpoint_id', beforeId)
        .single();

      if (beforeData) {
        query = query.lt('created_at', beforeData.created_at);
      }
    }

    const { data, error } = await query;

    if (error || !data) {
      return;
    }

    for (const row of data as CheckpointRow[]) {
      const checkpoint = JSON.parse(row.checkpoint_data) as Checkpoint;
      const metadata = JSON.parse(row.metadata) as CheckpointMetadata;

      const tuple: CheckpointTuple = {
        config: {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_ns: row.checkpoint_ns,
            checkpoint_id: row.checkpoint_id,
          },
        },
        checkpoint,
        metadata,
      };

      if (row.parent_checkpoint_id) {
        tuple.parentConfig = {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_ns: row.checkpoint_ns,
            checkpoint_id: row.parent_checkpoint_id,
          },
        };
      }

      yield tuple;
    }
  }

  /**
   * Save a checkpoint
   */
  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig> {
    const threadId = this.getThreadId(config);
    const checkpointNs = this.getCheckpointNs(config);
    const checkpointId = checkpoint.id;

    // Get parent checkpoint ID from config
    const parentCheckpointId = config.configurable?.checkpoint_id ?? null;

    const { error } = await this.supabase
      .from(this.tableName)
      .upsert({
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpointId,
        parent_checkpoint_id: parentCheckpointId,
        checkpoint_data: JSON.stringify(checkpoint),
        metadata: JSON.stringify(metadata),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'thread_id,checkpoint_ns,checkpoint_id',
      });

    if (error) {
      console.error('[Checkpointer] Error saving checkpoint:', error);
      throw new Error(`Failed to save checkpoint: ${error.message}`);
    }

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpointId,
      },
    };
  }

  /**
   * Save writes (channel updates) - required by interface
   */
  async putWrites(
    config: RunnableConfig,
    writes: Array<[string, unknown]>,
    taskId: string
  ): Promise<void> {
    // For simple checkpointing, we don't need to track individual writes
    // The full checkpoint is saved in put()
    // This method exists for more complex checkpointing scenarios
    console.debug('[Checkpointer] putWrites called', { taskId, writesCount: writes.length });
  }

  /**
   * Delete checkpoints for a thread
   */
  async deleteThread(threadId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('thread_id', threadId);

    if (error) {
      console.error('[Checkpointer] Error deleting checkpoints:', error);
      throw new Error(`Failed to delete checkpoints: ${error.message}`);
    }
  }

  /**
   * Clean up old checkpoints (keep only N most recent per thread)
   */
  async cleanup(threadId: string, keepCount = 10): Promise<number> {
    // Get all checkpoints for the thread, ordered by date
    const { data: checkpoints, error: fetchError } = await this.supabase
      .from(this.tableName)
      .select('id, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false });

    if (fetchError || !checkpoints) {
      return 0;
    }

    // If we have more than keepCount, delete the oldest ones
    if (checkpoints.length <= keepCount) {
      return 0;
    }

    const toDelete = checkpoints.slice(keepCount);
    const idsToDelete = toDelete.map(c => c.id);

    const { error: deleteError } = await this.supabase
      .from(this.tableName)
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      console.error('[Checkpointer] Error cleaning up checkpoints:', deleteError);
      return 0;
    }

    return toDelete.length;
  }
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let _checkpointer: SupabaseCheckpointer | null = null;

export function getCheckpointer(): SupabaseCheckpointer {
  if (!_checkpointer) {
    _checkpointer = new SupabaseCheckpointer();
  }
  return _checkpointer;
}

// For testing - allows resetting the singleton
export function resetCheckpointer(): void {
  _checkpointer = null;
}

// =====================================================
// TIS TIS PLATFORM - Job Queue System
// Provides async job processing for background tasks
// Used for: KB embedding generation, bulk operations, etc.
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ======================
// TYPES
// ======================

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface JobDefinition<T = unknown> {
  type: string;
  payload: T;
  priority?: JobPriority;
  maxRetries?: number;
  timeoutMs?: number;
  scheduledFor?: Date;
  metadata?: Record<string, unknown>;
}

export interface Job<T = unknown> {
  id: string;
  type: string;
  payload: T;
  status: JobStatus;
  priority: JobPriority;
  retries: number;
  maxRetries: number;
  timeoutMs: number;
  error?: string;
  result?: unknown;
  progress?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  scheduledFor?: string;
}

export interface JobResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export type JobHandler<T = unknown, R = unknown> = (
  job: Job<T>,
  context: JobContext
) => Promise<JobResult<R>>;

export interface JobContext {
  updateProgress: (progress: number) => Promise<void>;
  log: (message: string, data?: Record<string, unknown>) => void;
  supabase: SupabaseClient;
}

// ======================
// JOB QUEUE IMPLEMENTATION
// ======================

const JOB_TABLE = 'job_queue';

/**
 * Get Supabase admin client for job operations
 */
function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Create a new job in the queue
 */
export async function createJob<T>(
  definition: JobDefinition<T>
): Promise<{ jobId: string; success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from(JOB_TABLE)
      .insert({
        type: definition.type,
        payload: definition.payload,
        status: 'pending',
        priority: definition.priority || 'normal',
        retries: 0,
        max_retries: definition.maxRetries ?? 3,
        timeout_ms: definition.timeoutMs ?? 300000, // 5 minutes default
        metadata: definition.metadata || {},
        scheduled_for: definition.scheduledFor?.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[job-queue] Error creating job:', error);
      return { jobId: '', success: false, error: error.message };
    }

    console.log(`[job-queue] Created job ${data.id} of type ${definition.type}`);
    return { jobId: data.id, success: true };
  } catch (err) {
    console.error('[job-queue] Exception creating job:', err);
    return {
      jobId: '',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get a job by ID
 */
export async function getJob<T>(jobId: string): Promise<Job<T> | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(JOB_TABLE)
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapDbJobToJob<T>(data);
}

/**
 * Get pending jobs for processing
 */
export async function getPendingJobs<T>(
  type?: string,
  limit: number = 10
): Promise<Job<T>[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from(JOB_TABLE)
    .select('*')
    .eq('status', 'pending')
    .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('[job-queue] Error fetching pending jobs:', error);
    return [];
  }

  return data.map((row) => mapDbJobToJob<T>(row));
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  updates?: Partial<{
    error: string;
    result: unknown;
    progress: number;
    startedAt: string;
    completedAt: string;
  }>
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (updates?.error) updateData.error = updates.error;
  if (updates?.result !== undefined) updateData.result = updates.result;
  if (updates?.progress !== undefined) updateData.progress = updates.progress;
  if (updates?.startedAt) updateData.started_at = updates.startedAt;
  if (updates?.completedAt) updateData.completed_at = updates.completedAt;

  const { error } = await supabase
    .from(JOB_TABLE)
    .update(updateData)
    .eq('id', jobId);

  if (error) {
    console.error('[job-queue] Error updating job status:', error);
    return false;
  }

  return true;
}

/**
 * Process a single job
 */
export async function processJob<T, R>(
  job: Job<T>,
  handler: JobHandler<T, R>
): Promise<JobResult<R>> {
  const supabase = getSupabaseAdmin();

  // Mark as processing
  await updateJobStatus(job.id, 'processing', {
    startedAt: new Date().toISOString(),
  });

  const context: JobContext = {
    updateProgress: async (progress: number) => {
      await updateJobStatus(job.id, 'processing', { progress });
    },
    log: (message: string, data?: Record<string, unknown>) => {
      console.log(`[job-queue][${job.id}] ${message}`, data || '');
    },
    supabase,
  };

  try {
    // Execute with timeout
    const result = await Promise.race([
      handler(job, context),
      new Promise<JobResult<R>>((_, reject) =>
        setTimeout(() => reject(new Error('Job timeout')), job.timeoutMs)
      ),
    ]);

    if (result.success) {
      await updateJobStatus(job.id, 'completed', {
        result: result.data,
        completedAt: new Date().toISOString(),
        progress: 100,
      });
    } else {
      // Check if should retry
      const shouldRetry = job.retries < job.maxRetries;

      if (shouldRetry) {
        // Increment retry count and set back to pending
        await supabase
          .from(JOB_TABLE)
          .update({
            status: 'pending',
            retries: job.retries + 1,
            error: result.error,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        console.log(
          `[job-queue] Job ${job.id} failed, retry ${job.retries + 1}/${job.maxRetries}`
        );
      } else {
        await updateJobStatus(job.id, 'failed', {
          error: result.error,
          completedAt: new Date().toISOString(),
        });
      }
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    // Check if should retry
    const shouldRetry = job.retries < job.maxRetries;

    if (shouldRetry) {
      await supabase
        .from(JOB_TABLE)
        .update({
          status: 'pending',
          retries: job.retries + 1,
          error: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    } else {
      await updateJobStatus(job.id, 'failed', {
        error: errorMessage,
        completedAt: new Date().toISOString(),
      });
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  return updateJobStatus(jobId, 'cancelled');
}

/**
 * Get job stats by type
 */
export async function getJobStats(type?: string): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const supabase = getSupabaseAdmin();

  let query = supabase.from(JOB_TABLE).select('status');
  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error || !data) {
    return { pending: 0, processing: 0, completed: 0, failed: 0 };
  }

  return data.reduce(
    (acc, row) => {
      acc[row.status as keyof typeof acc] = (acc[row.status as keyof typeof acc] || 0) + 1;
      return acc;
    },
    { pending: 0, processing: 0, completed: 0, failed: 0 }
  );
}

// ======================
// HELPER FUNCTIONS
// ======================

function mapDbJobToJob<T>(row: Record<string, unknown>): Job<T> {
  return {
    id: row.id as string,
    type: row.type as string,
    payload: row.payload as T,
    status: row.status as JobStatus,
    priority: row.priority as JobPriority,
    retries: row.retries as number,
    maxRetries: row.max_retries as number,
    timeoutMs: row.timeout_ms as number,
    error: row.error as string | undefined,
    result: row.result as unknown,
    progress: row.progress as number | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    startedAt: row.started_at as string | undefined,
    completedAt: row.completed_at as string | undefined,
    scheduledFor: row.scheduled_for as string | undefined,
  };
}

// ======================
// KB-SPECIFIC JOB TYPES
// ======================

export interface KBEmbeddingJobPayload {
  tenantId: string;
  documentId: string;
  documentType: 'article' | 'faq' | 'policy' | 'template' | 'competitor';
  content: string;
  title?: string;
}

export const KB_JOB_TYPES = {
  GENERATE_EMBEDDING: 'kb:generate_embedding',
  PROCESS_DOCUMENT: 'kb:process_document',
  BATCH_EMBEDDINGS: 'kb:batch_embeddings',
  CLEANUP_STALE: 'kb:cleanup_stale',
} as const;

/**
 * Create a KB embedding job
 */
export async function createKBEmbeddingJob(
  payload: KBEmbeddingJobPayload,
  priority: JobPriority = 'normal'
): Promise<{ jobId: string; success: boolean; error?: string }> {
  return createJob({
    type: KB_JOB_TYPES.GENERATE_EMBEDDING,
    payload,
    priority,
    maxRetries: 3,
    timeoutMs: 60000, // 1 minute timeout for single embedding
  });
}

/**
 * Create a batch KB embedding job
 */
export async function createKBBatchJob(
  tenantId: string,
  documents: Array<{ id: string; type: string; content: string; title?: string }>,
  priority: JobPriority = 'normal'
): Promise<{ jobId: string; success: boolean; error?: string }> {
  return createJob({
    type: KB_JOB_TYPES.BATCH_EMBEDDINGS,
    payload: { tenantId, documents },
    priority,
    maxRetries: 3,
    timeoutMs: 300000, // 5 minutes for batch
  });
}

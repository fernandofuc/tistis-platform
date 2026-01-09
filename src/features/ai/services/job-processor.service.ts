// =====================================================
// TIS TIS PLATFORM - Job Processor Service
// Processes AI response jobs from the queue
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import type { AIResponseJobPayload, SendMessageJobPayload } from '@/src/shared/types/whatsapp';

// ======================
// TYPES
// ======================

export interface Job {
  id: string;
  tenant_id: string;
  job_type: 'ai_response' | 'send_whatsapp' | 'send_instagram' | 'update_score';
  payload: AIResponseJobPayload | SendMessageJobPayload;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  max_attempts: number;
  scheduled_for: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  result?: Record<string, unknown>;
}

export interface ProcessResult {
  success: boolean;
  job_id: string;
  result?: Record<string, unknown>;
  error?: string;
}

// ======================
// JOB QUEUE FUNCTIONS
// ======================

/**
 * Obtiene y reclama el próximo trabajo pendiente de la cola
 * Usa claim_next_job RPC que hace SELECT FOR UPDATE SKIP LOCKED atomicamente
 * Esto previene race conditions donde múltiples workers toman el mismo job
 */
export async function getNextPendingJob(): Promise<Job | null> {
  const supabase = createServerClient();

  // Use atomic claim function that selects, locks, and updates in one transaction
  const { data, error } = await supabase.rpc('claim_next_job');

  if (error) {
    console.error('[JobProcessor] Error claiming next job:', error);
    return null;
  }

  // claim_next_job returns the job already marked as 'processing'
  return data as Job | null;
}

/**
 * @deprecated Use getNextPendingJob() which atomically claims the job
 * This function is kept for backwards compatibility but the atomic
 * claim_next_job RPC should be used instead.
 */
export async function markJobProcessing(jobId: string): Promise<boolean> {
  const supabase = createServerClient();

  // Use atomic update to prevent race conditions
  const { error } = await supabase
    .from('job_queue')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      attempts: supabase.rpc('coalesce_increment', { current_val: 0 }) as unknown as number,
    })
    .eq('id', jobId)
    .eq('status', 'pending');

  if (error) {
    console.error('[JobProcessor] Error marking job processing:', error);
    return false;
  }

  return true;
}

/**
 * Marca un trabajo como completado
 */
export async function completeJob(
  jobId: string,
  result?: Record<string, unknown>
): Promise<boolean> {
  const supabase = createServerClient();

  const { error } = await supabase.rpc('complete_job', {
    p_job_id: jobId,
    p_result: result || {},
  });

  if (error) {
    console.error('[JobProcessor] Error completing job:', error);
    return false;
  }

  console.log(`[JobProcessor] Job ${jobId} completed successfully`);
  return true;
}

/**
 * Marca un trabajo como fallido
 */
export async function failJob(jobId: string, errorMessage: string): Promise<boolean> {
  const supabase = createServerClient();

  // Obtener el job actual para verificar intentos
  const { data: job } = await supabase
    .from('job_queue')
    .select('attempts, max_attempts')
    .eq('id', jobId)
    .single();

  if (!job) {
    return false;
  }

  const shouldRetry = job.attempts < job.max_attempts;

  const { error } = await supabase
    .from('job_queue')
    .update({
      status: shouldRetry ? 'pending' : 'failed',
      error_message: errorMessage,
      // Si reintentamos, programar para más tarde (exponential backoff)
      scheduled_for: shouldRetry
        ? new Date(Date.now() + Math.pow(2, job.attempts) * 1000).toISOString()
        : undefined,
      completed_at: shouldRetry ? undefined : new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('[JobProcessor] Error failing job:', error);
    return false;
  }

  console.log(
    `[JobProcessor] Job ${jobId} ${shouldRetry ? 'will retry' : 'failed permanently'}: ${errorMessage}`
  );
  return true;
}

/**
 * Obtiene estadísticas de la cola de trabajos
 */
export async function getQueueStats(tenantId?: string): Promise<{
  pending: number;
  processing: number;
  completed_today: number;
  failed_today: number;
}> {
  const supabase = createServerClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let query = supabase.from('job_queue').select('status, completed_at');

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: jobs, error } = await query;

  if (error || !jobs) {
    return { pending: 0, processing: 0, completed_today: 0, failed_today: 0 };
  }

  const stats = {
    pending: 0,
    processing: 0,
    completed_today: 0,
    failed_today: 0,
  };

  for (const job of jobs) {
    switch (job.status) {
      case 'pending':
        stats.pending++;
        break;
      case 'processing':
        stats.processing++;
        break;
      case 'completed':
        if (job.completed_at && new Date(job.completed_at) >= today) {
          stats.completed_today++;
        }
        break;
      case 'failed':
        if (job.completed_at && new Date(job.completed_at) >= today) {
          stats.failed_today++;
        }
        break;
    }
  }

  return stats;
}

/**
 * Limpia trabajos completados/fallidos antiguos
 */
export async function cleanupOldJobs(daysOld: number = 7): Promise<number> {
  const supabase = createServerClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const { data, error } = await supabase
    .from('job_queue')
    .delete()
    .in('status', ['completed', 'failed'])
    .lt('completed_at', cutoffDate.toISOString())
    .select('id');

  if (error) {
    console.error('[JobProcessor] Error cleaning up jobs:', error);
    return 0;
  }

  const count = data?.length || 0;
  console.log(`[JobProcessor] Cleaned up ${count} old jobs`);
  return count;
}

// ======================
// EXPORTS
// ======================
export const JobProcessor = {
  getNextPendingJob,
  markJobProcessing,
  completeJob,
  failJob,
  getQueueStats,
  cleanupOldJobs,
};

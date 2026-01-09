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

// ======================
// REVISIÓN 5.4 G-I2: RECOVERY OF UNSENT AI MESSAGES
// ======================

/**
 * REVISIÓN 5.4 G-I2: Recupera mensajes AI generados pero no enviados
 *
 * Este escenario ocurre cuando:
 * 1. AI genera respuesta exitosamente (guardada en cached_result)
 * 2. Job se completa
 * 3. Pero el mensaje de envío falla (token expirado, rate limit, etc.)
 *
 * Esta función detecta estos casos y reencola el envío del mensaje.
 *
 * @param maxAgeMinutes - Máxima antigüedad de jobs a revisar (default: 60 min)
 * @returns Número de mensajes recuperados
 */
export async function recoverUnsentAIMessages(maxAgeMinutes: number = 60): Promise<{
  checked: number;
  recovered: number;
  errors: string[];
}> {
  const supabase = createServerClient();
  const result = { checked: 0, recovered: 0, errors: [] as string[] };

  try {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

    // 1. Buscar jobs de AI completados con cached_result en las últimas N minutos
    const { data: completedJobs, error: queryError } = await supabase
      .from('job_queue')
      .select(`
        id,
        tenant_id,
        payload,
        result,
        completed_at
      `)
      .eq('job_type', 'ai_response')
      .eq('status', 'completed')
      .gte('completed_at', cutoffTime)
      .order('completed_at', { ascending: false })
      .limit(100); // Limitar para evitar procesamiento excesivo

    if (queryError) {
      console.error('[G-I2 Recovery] Error querying completed jobs:', queryError);
      result.errors.push(`Query error: ${queryError.message}`);
      return result;
    }

    if (!completedJobs || completedJobs.length === 0) {
      console.log('[G-I2 Recovery] No completed AI jobs to check');
      return result;
    }

    result.checked = completedJobs.length;

    // 2. Para cada job, verificar si el mensaje AI fue realmente enviado
    for (const job of completedJobs) {
      try {
        const payload = job.payload as {
          conversation_id?: string;
          channel?: string;
          lead_id?: string;
          channel_connection_id?: string;
        };
        const jobResult = job.result as {
          response_message_id?: string;
        } | null;

        if (!payload?.conversation_id || !jobResult?.response_message_id) {
          continue; // Job sin datos suficientes
        }

        // 3. Verificar si el mensaje de respuesta AI fue enviado exitosamente
        const { data: aiMessage, error: msgError } = await supabase
          .from('messages')
          .select('id, status, content, external_id')
          .eq('id', jobResult.response_message_id)
          .single();

        if (msgError || !aiMessage) {
          continue; // Mensaje no encontrado
        }

        // 4. Si el mensaje existe pero NO fue enviado (status != 'sent')
        if (aiMessage.status !== 'sent' && aiMessage.status !== 'delivered' && aiMessage.status !== 'read') {
          console.log(
            `[G-I2 Recovery] Found unsent AI message: ${aiMessage.id}, status: ${aiMessage.status}`
          );

          // 5. Verificar que no haya ya un job de envío pendiente
          const { data: existingSendJob } = await supabase
            .from('job_queue')
            .select('id')
            .eq('job_type', `send_${payload.channel || 'whatsapp'}`)
            .in('status', ['pending', 'processing'])
            .limit(1);

          // Filtrar por message_id en payload
          const hasPendingSend = existingSendJob?.some(
            j => (j as { payload?: { message_id?: string } }).payload?.message_id === aiMessage.id
          );

          if (hasPendingSend) {
            console.log(`[G-I2 Recovery] Send job already pending for message ${aiMessage.id}`);
            continue;
          }

          // 6. Obtener info del lead para el envío
          const { data: lead } = await supabase
            .from('leads')
            .select('phone_normalized, instagram_psid, facebook_psid, tiktok_open_id')
            .eq('id', payload.lead_id)
            .single();

          if (!lead) {
            result.errors.push(`Lead not found for message ${aiMessage.id}`);
            continue;
          }

          // 7. Reencolar el mensaje para envío
          const channel = payload.channel || 'whatsapp';
          let enqueueSuccess = false;

          if (channel === 'whatsapp' && lead.phone_normalized) {
            const { error: enqueueError } = await supabase
              .from('job_queue')
              .insert({
                tenant_id: job.tenant_id,
                job_type: 'send_whatsapp',
                payload: {
                  conversation_id: payload.conversation_id,
                  message_id: aiMessage.id,
                  tenant_id: job.tenant_id,
                  channel: 'whatsapp',
                  recipient_phone: lead.phone_normalized,
                  content: aiMessage.content,
                  channel_connection_id: payload.channel_connection_id,
                  recovered_by: 'G-I2',
                },
                status: 'pending',
                priority: 2, // Prioridad alta para recuperación
                max_attempts: 3,
                scheduled_for: new Date().toISOString(),
              });

            enqueueSuccess = !enqueueError;
            if (enqueueError) {
              result.errors.push(`Enqueue error for ${aiMessage.id}: ${enqueueError.message}`);
            }
          }
          // TODO: Agregar soporte para Instagram, Facebook, TikTok

          if (enqueueSuccess) {
            result.recovered++;
            console.log(`[G-I2 Recovery] Recovered message ${aiMessage.id} for resend`);

            // Actualizar el mensaje para indicar que fue recuperado
            await supabase
              .from('messages')
              .update({
                metadata: {
                  recovered_at: new Date().toISOString(),
                  recovered_by: 'G-I2',
                  original_job_id: job.id,
                },
              })
              .eq('id', aiMessage.id);
          }
        }
      } catch (jobError) {
        const errorMsg = jobError instanceof Error ? jobError.message : 'Unknown error';
        result.errors.push(`Job ${job.id}: ${errorMsg}`);
      }
    }

    if (result.recovered > 0) {
      console.log(`[G-I2 Recovery] Summary: checked=${result.checked}, recovered=${result.recovered}`);
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[G-I2 Recovery] Fatal error:', error);
    result.errors.push(`Fatal: ${errorMsg}`);
    return result;
  }
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
  // REVISIÓN 5.4 G-I2
  recoverUnsentAIMessages,
};

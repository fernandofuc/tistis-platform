// =====================================================
// TIS TIS PLATFORM - SR Job Queue Service
// FASE 2: Queue-based processing for Soft Restaurant sales
//
// Pattern Reference:
// - job-processor.service.ts (claim_next_job, exponential backoff)
// - process-dlq/route.ts (status transitions, retry logic)
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ======================
// CONSTANTS
// Aligned with job-processor.service.ts
// ======================

// Cap exponential backoff at 1 hour to prevent infinite delays
const MAX_BACKOFF_MS = 3600000; // 1 hour

// Maximum retry attempts before dead letter
const DEFAULT_MAX_RETRIES = 3;

// Supabase configuration - validated at runtime
const getSupabaseConfig = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      '[SR Queue] Missing required environment variables: ' +
      `NEXT_PUBLIC_SUPABASE_URL=${!!supabaseUrl}, SUPABASE_SERVICE_ROLE_KEY=${!!supabaseServiceKey}`
    );
  }

  return { supabaseUrl, supabaseServiceKey };
};

// ======================
// TYPES
// ======================

export interface SRSaleQueueResult {
  success: boolean;
  saleId?: string;
  error?: string;
}

export interface SRQueueStats {
  pending: number;
  queued: number;
  processing: number;
  processed_today: number;
  failed_today: number;
  dead_letter: number;
}

export interface SRMarkFailedResult {
  shouldRetry: boolean;
  nextRetryAt?: string;
  newRetryCount: number;
}

// ======================
// SERVICE CLASS
// ======================

export class SRJobQueueService {
  private static getSupabase(): SupabaseClient {
    const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
    return createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Encola una venta SR para procesamiento asíncrono
   * Pattern: Similar a WhatsAppService.enqueueSendMessageJob()
   *
   * @param saleId - UUID de la venta en sr_sales
   * @returns Promise<SRSaleQueueResult> - Resultado del encolamiento
   */
  static async queueForProcessing(saleId: string): Promise<SRSaleQueueResult> {
    const supabase = this.getSupabase();

    try {
      // Optimistic lock: Solo actualizar si está en 'pending'
      // Pattern de: process-dlq/route.ts:139-146
      const { data, error } = await supabase
        .from('sr_sales')
        .update({
          status: 'queued',
          queued_at: new Date().toISOString(),
        })
        .eq('id', saleId)
        .eq('status', 'pending')
        .select('id')
        .single();

      if (error || !data) {
        console.warn(`[SR Queue] Failed to queue sale ${saleId}:`, error?.message);
        return {
          success: false,
          error: error?.message || 'Sale not in pending status or not found',
        };
      }

      console.log(`[SR Queue] Sale ${saleId} queued for processing`);
      return { success: true, saleId };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[SR Queue] Exception queueing sale ${saleId}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Obtiene y reclama el siguiente batch de ventas para procesar
   * Pattern: claim_next_job RPC con SELECT FOR UPDATE SKIP LOCKED
   * Referencia: job-processor.service.ts:52-65
   *
   * @param limit - Número máximo de ventas a reclamar (default: 10)
   * @returns Promise<string[]> - Array de UUIDs de ventas reclamadas
   */
  static async claimNextBatch(limit: number = 10): Promise<string[]> {
    const supabase = this.getSupabase();

    try {
      // Usar RPC para atomic claim con SKIP LOCKED
      // Esto previene race conditions entre múltiples workers
      const { data, error } = await supabase.rpc('claim_sr_sales_batch', {
        p_limit: limit,
      });

      if (error) {
        console.error('[SR Queue] Error claiming batch:', error);
        return [];
      }

      const saleIds = (data || []).map((row: { id: string }) => row.id);

      if (saleIds.length > 0) {
        console.log(`[SR Queue] Claimed ${saleIds.length} sales for processing`);
      }

      return saleIds;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[SR Queue] Exception claiming batch:', errorMsg);
      return [];
    }
  }

  /**
   * Marca una venta como procesada exitosamente
   * Pattern: JobProcessor.completeJob()
   *
   * @param saleId - UUID de la venta
   * @param restaurantOrderId - UUID de la orden creada (opcional)
   * @returns Promise<boolean> - true si se actualizó correctamente
   */
  static async markProcessed(
    saleId: string,
    restaurantOrderId?: string
  ): Promise<boolean> {
    const supabase = this.getSupabase();

    try {
      const { error } = await supabase
        .from('sr_sales')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          restaurant_order_id: restaurantOrderId || null,
          error_message: null,
          // Clear processing fields
          processing_started_at: null,
        })
        .eq('id', saleId);

      if (error) {
        console.error(`[SR Queue] Error marking sale ${saleId} as processed:`, error);
        return false;
      }

      console.log(`[SR Queue] Sale ${saleId} marked as processed`);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[SR Queue] Exception marking sale ${saleId} as processed:`, errorMsg);
      return false;
    }
  }

  /**
   * Marca una venta como fallida con exponential backoff
   * Pattern: JobProcessor.failJob() con backoff capped
   * Referencia: job-processor.service.ts:120-163
   *
   * @param saleId - UUID de la venta
   * @param errorMessage - Mensaje de error
   * @param currentRetryCount - Número actual de reintentos
   * @returns Promise<SRMarkFailedResult> - Resultado con información de reintento
   */
  static async markFailed(
    saleId: string,
    errorMessage: string,
    currentRetryCount: number
  ): Promise<SRMarkFailedResult> {
    const supabase = this.getSupabase();

    const newRetryCount = currentRetryCount + 1;
    const shouldRetry = newRetryCount < DEFAULT_MAX_RETRIES;

    // Exponential backoff with cap (igual que job-processor)
    // Formula: min(2^attempts * 1000ms, MAX_BACKOFF_MS)
    // attempt 1: 2s, attempt 2: 4s, attempt 3: 8s, ..., capped at 1 hour
    const backoffMs = Math.min(
      Math.pow(2, newRetryCount) * 1000,
      MAX_BACKOFF_MS
    );

    const nextStatus = shouldRetry ? 'queued' : 'dead_letter';
    const nextRetryAt = shouldRetry
      ? new Date(Date.now() + backoffMs).toISOString()
      : null;

    try {
      const { error } = await supabase
        .from('sr_sales')
        .update({
          status: nextStatus,
          error_message: errorMessage,
          retry_count: newRetryCount,
          next_retry_at: nextRetryAt,
          // Clear processing timestamp
          processing_started_at: null,
        })
        .eq('id', saleId);

      if (error) {
        console.error(`[SR Queue] Error marking sale ${saleId} as failed:`, error);
        return { shouldRetry: false, newRetryCount };
      }

      console.log(
        `[SR Queue] Sale ${saleId} ${shouldRetry ? `will retry at ${nextRetryAt}` : 'sent to dead letter'}: ${errorMessage}`
      );

      return {
        shouldRetry,
        nextRetryAt: nextRetryAt || undefined,
        newRetryCount,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[SR Queue] Exception marking sale ${saleId} as failed:`, errMsg);
      return { shouldRetry: false, newRetryCount };
    }
  }

  /**
   * Obtiene estadísticas de la cola SR
   * Pattern: JobProcessor.getQueueStats()
   *
   * @param tenantId - Filtrar por tenant (opcional)
   * @returns Promise<SRQueueStats> - Estadísticas de la cola
   */
  static async getQueueStats(tenantId?: string): Promise<SRQueueStats> {
    const supabase = this.getSupabase();

    const defaultStats: SRQueueStats = {
      pending: 0,
      queued: 0,
      processing: 0,
      processed_today: 0,
      failed_today: 0,
      dead_letter: 0,
    };

    try {
      // Use RPC function for efficient counting
      const { data, error } = await supabase.rpc('get_sr_queue_stats', {
        p_tenant_id: tenantId || null,
      });

      if (error) {
        console.error('[SR Queue] Error getting stats:', error);
        return defaultStats;
      }

      if (data && data.length > 0) {
        const row = data[0];
        return {
          pending: Number(row.pending_count) || 0,
          queued: Number(row.queued_count) || 0,
          processing: Number(row.processing_count) || 0,
          processed_today: Number(row.processed_today) || 0,
          failed_today: Number(row.failed_today) || 0,
          dead_letter: Number(row.dead_letter_count) || 0,
        };
      }

      return defaultStats;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[SR Queue] Exception getting stats:', errorMsg);
      return defaultStats;
    }
  }

  /**
   * Recupera ventas atascadas en estado 'processing'
   * Útil para manejar crashes de workers o timeouts
   *
   * @param timeoutMinutes - Minutos después de los cuales considerar atascada
   * @returns Promise<number> - Número de ventas recuperadas
   */
  static async recoverStaleSales(timeoutMinutes: number = 5): Promise<number> {
    const supabase = this.getSupabase();

    try {
      const { data, error } = await supabase.rpc('recover_stale_sr_sales', {
        p_timeout_minutes: timeoutMinutes,
      });

      if (error) {
        console.error('[SR Queue] Error recovering stale sales:', error);
        return 0;
      }

      const recovered = Number(data) || 0;
      if (recovered > 0) {
        console.log(`[SR Queue] Recovered ${recovered} stale sales`);
      }

      return recovered;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[SR Queue] Exception recovering stale sales:', errorMsg);
      return 0;
    }
  }

  /**
   * Obtiene información de una venta específica
   *
   * @param saleId - UUID de la venta
   * @returns Promise<{ retry_count: number; status: string } | null>
   */
  static async getSaleInfo(saleId: string): Promise<{
    retry_count: number;
    status: string;
    tenant_id: string;
    branch_id: string;
  } | null> {
    const supabase = this.getSupabase();

    try {
      const { data, error } = await supabase
        .from('sr_sales')
        .select('retry_count, status, tenant_id, branch_id')
        .eq('id', saleId)
        .single();

      if (error || !data) {
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }
}

// ======================
// EXPORTS
// ======================

export default SRJobQueueService;

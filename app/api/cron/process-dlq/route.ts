// =====================================================
// TIS TIS PLATFORM - Process Dead Letter Queue CRON Job
// REVISIÓN 5.4.1: Reintenta webhooks fallidos del DLQ
// =====================================================
// Este endpoint debe ser llamado por un cron job cada 15-30 minutos
// para reintentar webhooks que fallaron durante el procesamiento inicial.
//
// Dead Letter Queue entries son creados cuando:
// - Procesamiento de webhook falla después de responder 200 a Meta
// - Errores de base de datos durante creación de conversación/lead
// - Timeouts en servicios externos
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServerClient } from '@/src/shared/lib/supabase';
import { WhatsAppService } from '@/src/features/messaging/services/whatsapp.service';
import type { WhatsAppWebhookPayload } from '@/src/shared/types/whatsapp';

// Evitar que Next.js cachee esta ruta
export const dynamic = 'force-dynamic';

// Timeout de 60 segundos para procesamiento
export const maxDuration = 60;

// Constantes de configuración
const DEFAULT_MAX_RETRIES = 5;
const MAX_ENTRIES_PER_RUN = 20; // Limitar para evitar timeout
const RETRY_DELAY_MULTIPLIER = 15 * 60 * 1000; // 15 minutos base

/**
 * Verifica el token de autorización para CRON jobs (timing-safe)
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // En desarrollo, permitir sin auth si no hay CRON_SECRET configurado
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRON DLQ] CRON_SECRET not configured in production');
      return false;
    }
    console.warn('[CRON DLQ] Running without authentication in development mode');
    return true;
  }

  // Verificar header de autorización
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);

  // Usar crypto.timingSafeEqual para comparación timing-safe
  try {
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(cronSecret);
    if (tokenBuffer.length !== secretBuffer.length) {
      return false;
    }
    return timingSafeEqual(tokenBuffer, secretBuffer);
  } catch {
    return false;
  }
}

/**
 * GET /api/cron/process-dlq
 *
 * Procesa entradas pendientes del Dead Letter Queue.
 * Llamado automáticamente por el sistema de cron.
 *
 * Headers requeridos:
 * - Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verificar autorización
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('[CRON DLQ] Starting dead letter queue processing');

    const supabase = createServerClient();
    const result = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      permanentlyFailed: 0,
      errors: [] as string[],
    };

    // 1. Obtener entradas pendientes del DLQ
    // Solo las que no han alcanzado max retries y están listas para reintentar
    const { data: dlqEntries, error: fetchError } = await supabase
      .from('webhook_dead_letters')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', DEFAULT_MAX_RETRIES)
      .order('created_at', { ascending: true })
      .limit(MAX_ENTRIES_PER_RUN);

    if (fetchError) {
      console.error('[CRON DLQ] Error fetching DLQ entries:', fetchError);
      return NextResponse.json(
        {
          success: false,
          error: `Fetch error: ${fetchError.message}`,
          processing_time_ms: Date.now() - startTime,
        },
        { status: 500 }
      );
    }

    if (!dlqEntries || dlqEntries.length === 0) {
      console.log('[CRON DLQ] No pending DLQ entries to process');
      return NextResponse.json({
        success: true,
        message: 'No pending entries',
        processing_time_ms: Date.now() - startTime,
      });
    }

    console.log(`[CRON DLQ] Found ${dlqEntries.length} pending entries to process`);

    // 2. Procesar cada entrada
    for (const entry of dlqEntries) {
      result.processed++;

      try {
        // Marcar como procesando para evitar concurrent processing
        const { error: lockError } = await supabase
          .from('webhook_dead_letters')
          .update({
            status: 'processing',
            last_retry_at: new Date().toISOString(),
          })
          .eq('id', entry.id)
          .eq('status', 'pending'); // Optimistic lock

        if (lockError) {
          console.warn(`[CRON DLQ] Failed to lock entry ${entry.id}, may be processed by another worker`);
          continue;
        }

        // Procesar según el canal
        if (entry.channel === 'whatsapp' && entry.tenant_slug) {
          const payload = entry.payload as WhatsAppWebhookPayload;

          try {
            const processResult = await WhatsAppService.processWebhook(
              entry.tenant_slug,
              payload
            );

            if (processResult.errors.length === 0) {
              // Éxito - marcar como completado
              await supabase
                .from('webhook_dead_letters')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  retry_count: entry.retry_count + 1,
                })
                .eq('id', entry.id);

              result.succeeded++;
              console.log(`[CRON DLQ] Successfully processed entry ${entry.id}`);
            } else {
              // Errores parciales - incrementar retry pero mantener pending
              throw new Error(processResult.errors.join('; '));
            }
          } catch (processError) {
            const errorMsg = processError instanceof Error ? processError.message : 'Unknown error';
            const newRetryCount = entry.retry_count + 1;

            if (newRetryCount >= DEFAULT_MAX_RETRIES) {
              // Máximo de reintentos alcanzado
              await supabase
                .from('webhook_dead_letters')
                .update({
                  status: 'failed',
                  error_message: `Max retries reached. Last error: ${errorMsg}`,
                  retry_count: newRetryCount,
                  completed_at: new Date().toISOString(),
                })
                .eq('id', entry.id);

              result.permanentlyFailed++;
              result.errors.push(`Entry ${entry.id}: Permanently failed after ${DEFAULT_MAX_RETRIES} attempts`);
              console.error(`[CRON DLQ] Entry ${entry.id} permanently failed after max retries`);
            } else {
              // Programar próximo reintento con backoff
              const nextRetryAt = new Date(
                Date.now() + (newRetryCount * RETRY_DELAY_MULTIPLIER)
              ).toISOString();

              await supabase
                .from('webhook_dead_letters')
                .update({
                  status: 'pending',
                  error_message: errorMsg,
                  retry_count: newRetryCount,
                  next_retry_at: nextRetryAt,
                })
                .eq('id', entry.id);

              result.failed++;
              console.warn(`[CRON DLQ] Entry ${entry.id} failed, will retry at ${nextRetryAt}`);
            }
          }
        } else {
          // Canal no soportado
          await supabase
            .from('webhook_dead_letters')
            .update({
              status: 'failed',
              error_message: `Unsupported channel: ${entry.channel}`,
              completed_at: new Date().toISOString(),
            })
            .eq('id', entry.id);

          result.permanentlyFailed++;
          result.errors.push(`Entry ${entry.id}: Unsupported channel ${entry.channel}`);
        }
      } catch (entryError) {
        const errorMsg = entryError instanceof Error ? entryError.message : 'Unknown error';
        result.errors.push(`Entry ${entry.id}: ${errorMsg}`);
        console.error(`[CRON DLQ] Error processing entry ${entry.id}:`, entryError);

        // Revertir a pending en caso de error inesperado
        await supabase
          .from('webhook_dead_letters')
          .update({
            status: 'pending',
            error_message: `Unexpected error: ${errorMsg}`,
          })
          .eq('id', entry.id);
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(
      `[CRON DLQ] Completed in ${processingTime}ms. ` +
      `Processed: ${result.processed}, Succeeded: ${result.succeeded}, ` +
      `Failed: ${result.failed}, Permanently Failed: ${result.permanentlyFailed}`
    );

    return NextResponse.json({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      permanently_failed: result.permanentlyFailed,
      errors: result.errors.length > 0 ? result.errors : undefined,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('[CRON DLQ] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/process-dlq
 *
 * Alternativa para webhooks de servicios de cron que usan POST.
 * Funcionalidad idéntica a GET.
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

// =====================================================
// TIS TIS PLATFORM - Process Embeddings CRON Job
// Procesa embeddings pendientes para RAG semántico
// =====================================================
// Este endpoint debe ser llamado por un cron job cada 5-10 minutos
// para generar embeddings de artículos, FAQs, políticas y servicios
// que aún no tienen embedding generado.
//
// Frecuencia recomendada: Cada 5-10 minutos
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { EmbeddingService } from '@/src/features/ai/services/embedding.service';

// Evitar que Next.js cachee esta ruta
export const dynamic = 'force-dynamic';

// Timeout de 120 segundos para procesamiento de embeddings (pueden ser lentos)
export const maxDuration = 120;

// Constantes de configuración
const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;

/**
 * Verifica el token de autorización para CRON jobs (timing-safe)
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // En desarrollo, permitir sin auth si no hay CRON_SECRET configurado
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRON Auth] CRON_SECRET not configured in production');
      return false;
    }
    console.warn('[CRON Auth] Running without authentication in development mode');
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
 * GET /api/cron/process-embeddings
 *
 * Procesa embeddings pendientes para búsqueda semántica RAG.
 * Llamado automáticamente por el sistema de cron.
 *
 * Headers requeridos:
 * - Authorization: Bearer {CRON_SECRET}
 *
 * Query params opcionales:
 * - tenant_id: Procesar solo un tenant específico
 * - batch_size: Tamaño del batch (default: 10, max: 50)
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
    // Obtener parámetros de la query
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id') || undefined;
    const requestedBatchSize = parseInt(searchParams.get('batch_size') || String(DEFAULT_BATCH_SIZE), 10);

    // Validar batch size
    const batchSize = Math.min(
      Math.max(1, isNaN(requestedBatchSize) ? DEFAULT_BATCH_SIZE : requestedBatchSize),
      MAX_BATCH_SIZE
    );

    console.log(`[CRON: Process Embeddings] Starting processing with batch_size: ${batchSize}${tenantId ? `, tenant: ${tenantId}` : ''}`);

    // Verificar que OpenAI API key está configurada
    if (!process.env.OPENAI_API_KEY) {
      console.error('[CRON: Process Embeddings] OPENAI_API_KEY not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API key not configured',
          processing_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Procesar embeddings pendientes
    const result = await EmbeddingService.processPendingEmbeddings(tenantId, batchSize);

    const processingTime = Date.now() - startTime;

    console.log(
      `[CRON: Process Embeddings] Completed in ${processingTime}ms. ` +
      `Processed: ${result.processed}, Errors: ${result.errors}`
    );

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      batch_size: batchSize,
      tenant_id: tenantId || 'all',
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('[CRON: Process Embeddings] Error:', error);

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
 * POST /api/cron/process-embeddings
 *
 * Alternativa para webhooks de servicios de cron que usan POST.
 * Funcionalidad idéntica a GET.
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

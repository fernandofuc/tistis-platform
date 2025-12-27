// =====================================================
// TIS TIS PLATFORM - Process Learning CRON Job
// Procesa la cola de mensajes para aprendizaje automático
// =====================================================
// Este endpoint debe ser llamado por un cron job cada X minutos
// para procesar los mensajes pendientes en la cola de aprendizaje.
//
// Frecuencia recomendada: Cada 5-10 minutos
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { MessageLearningService } from '@/src/features/ai/services/message-learning.service';

// Evitar que Next.js cachee esta ruta
export const dynamic = 'force-dynamic';

// Timeout de 60 segundos para procesamiento
export const maxDuration = 60;

// Constantes de configuración
const MAX_LIMIT = 500; // Límite máximo de mensajes por ejecución
const DEFAULT_LIMIT = 100;

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
 * GET /api/cron/process-learning
 *
 * Procesa la cola de mensajes de aprendizaje.
 * Llamado automáticamente por el sistema de cron.
 *
 * Headers requeridos:
 * - Authorization: Bearer {CRON_SECRET}
 *
 * Query params opcionales:
 * - limit: número máximo de mensajes a procesar (default: 100)
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
    // Obtener límite de la query con validación
    const { searchParams } = new URL(request.url);
    const requestedLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);

    // Validar y limitar el valor
    const limit = Math.min(
      Math.max(1, isNaN(requestedLimit) ? DEFAULT_LIMIT : requestedLimit),
      MAX_LIMIT
    );

    console.log(`[CRON: Process Learning] Starting processing with limit: ${limit}`);

    // Procesar la cola
    const result = await MessageLearningService.processLearningQueue(limit);

    const processingTime = Date.now() - startTime;

    console.log(
      `[CRON: Process Learning] Completed in ${processingTime}ms. ` +
      `Processed: ${result.processed}, Success: ${result.successful}, Failed: ${result.failed}`
    );

    return NextResponse.json({
      success: true,
      processed: result.processed,
      successful: result.successful,
      failed: result.failed,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('[CRON: Process Learning] Error:', error);

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
 * POST /api/cron/process-learning
 *
 * Alternativa para webhooks de servicios de cron que usan POST.
 * Funcionalidad idéntica a GET.
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

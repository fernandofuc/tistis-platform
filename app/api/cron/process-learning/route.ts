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
import { MessageLearningService } from '@/src/features/ai/services/message-learning.service';

// Evitar que Next.js cachee esta ruta
export const dynamic = 'force-dynamic';

// Timeout de 60 segundos para procesamiento
export const maxDuration = 60;

// Constantes de configuración
const MAX_LIMIT = 500; // Límite máximo de mensajes por ejecución
const DEFAULT_LIMIT = 100;

/**
 * Comparación segura de strings para evitar timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verifica el token de autorización para CRON jobs
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');

  // En desarrollo, permitir sin auth si no hay CRON_SECRET configurado
  if (process.env.NODE_ENV === 'development' && !process.env.CRON_SECRET) {
    console.warn('[CRON Auth] Running without authentication in development mode');
    return true;
  }

  // Verificar que exista CRON_SECRET configurado
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CRON Auth] CRON_SECRET not configured');
    return false;
  }

  // Verificar header de autorización
  if (!authHeader) {
    return false;
  }

  const token = authHeader.replace('Bearer ', '');

  // Usar comparación segura contra timing attacks
  return secureCompare(token, cronSecret);
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

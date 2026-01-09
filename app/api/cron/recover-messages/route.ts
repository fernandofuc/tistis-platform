// =====================================================
// TIS TIS PLATFORM - Recover Unsent Messages CRON Job
// REVISIÓN 5.4 G-I2: Recupera mensajes AI no enviados
// =====================================================
// Este endpoint debe ser llamado por un cron job cada 5-10 minutos
// para recuperar mensajes AI generados pero no enviados.
//
// Escenarios cubiertos:
// - Token de WhatsApp expirado después de generar respuesta AI
// - Rate limit alcanzado durante envío
// - Error de red temporal durante envío
// - Channel connection desconectada después de generar AI
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { JobProcessor } from '@/src/features/ai/services/job-processor.service';

// Evitar que Next.js cachee esta ruta
export const dynamic = 'force-dynamic';

// Timeout de 30 segundos para procesamiento
export const maxDuration = 30;

// Constantes de configuración
const DEFAULT_MAX_AGE_MINUTES = 60; // Revisar jobs de la última hora
const MAX_AGE_LIMIT_MINUTES = 240; // Máximo 4 horas hacia atrás

/**
 * Verifica el token de autorización para CRON jobs (timing-safe)
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // En desarrollo, permitir sin auth si no hay CRON_SECRET configurado
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRON Recover] CRON_SECRET not configured in production');
      return false;
    }
    console.warn('[CRON Recover] Running without authentication in development mode');
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
 * GET /api/cron/recover-messages
 *
 * Recupera mensajes AI generados pero no enviados.
 * Llamado automáticamente por el sistema de cron.
 *
 * Headers requeridos:
 * - Authorization: Bearer {CRON_SECRET}
 *
 * Query params opcionales:
 * - max_age: minutos hacia atrás para revisar (default: 60, max: 240)
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
    // Obtener max_age de la query con validación
    const { searchParams } = new URL(request.url);
    const requestedMaxAge = parseInt(searchParams.get('max_age') || String(DEFAULT_MAX_AGE_MINUTES), 10);

    // Validar y limitar el valor
    const maxAgeMinutes = Math.min(
      Math.max(1, isNaN(requestedMaxAge) ? DEFAULT_MAX_AGE_MINUTES : requestedMaxAge),
      MAX_AGE_LIMIT_MINUTES
    );

    console.log(`[CRON Recover] Starting recovery check for last ${maxAgeMinutes} minutes`);

    // Ejecutar recuperación
    const result = await JobProcessor.recoverUnsentAIMessages(maxAgeMinutes);

    const processingTime = Date.now() - startTime;

    console.log(
      `[CRON Recover] Completed in ${processingTime}ms. ` +
      `Checked: ${result.checked}, Recovered: ${result.recovered}, Errors: ${result.errors.length}`
    );

    return NextResponse.json({
      success: true,
      checked: result.checked,
      recovered: result.recovered,
      errors: result.errors.length > 0 ? result.errors : undefined,
      max_age_minutes: maxAgeMinutes,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('[CRON Recover] Error:', error);

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
 * POST /api/cron/recover-messages
 *
 * Alternativa para webhooks de servicios de cron que usan POST.
 * Funcionalidad idéntica a GET.
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

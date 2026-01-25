// =====================================================
// TIS TIS PLATFORM - Voice Agent Usage History API
// GET: Obtener historial de transacciones de minutos
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { MinuteLimitService } from '@/src/features/voice-agent/services/minute-limit.service';
import { VoiceAgentService } from '@/src/features/voice-agent/services/voice-agent.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/voice-agent/usage-history
 *
 * Obtiene el historial de transacciones de minutos
 *
 * Query params:
 * - limit: número de registros (default 50, max 100)
 * - offset: offset para paginación (default 0)
 *
 * Response:
 * {
 *   success: boolean,
 *   transactions: VoiceMinuteTransaction[],
 *   pagination: {
 *     limit: number,
 *     offset: number,
 *     hasMore: boolean
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  const authResult = await getAuthenticatedContext(request);

  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { tenantId } = authResult;

  try {
    // Verificar acceso a Voice Agent
    const access = await VoiceAgentService.canAccessVoiceAgent(tenantId);

    if (!access.canAccess) {
      return NextResponse.json(
        { success: false, error: access.reason },
        { status: 403 }
      );
    }

    // Parsear query params
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);
    const offsetParam = parseInt(searchParams.get('offset') || '0', 10);

    // Validar y sanitizar parámetros
    const limit = Math.min(100, Math.max(1, isNaN(limitParam) ? 50 : limitParam));
    const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam);

    // Obtener historial (pedimos 1 extra para detectar si hay más)
    const transactions = await MinuteLimitService.getUsageHistory(tenantId, limit + 1, offset);

    // Verificar si hay más registros
    const hasMore = transactions.length > limit;
    const result = hasMore ? transactions.slice(0, limit) : transactions;

    // Formatear transacciones para UI
    const formattedTransactions = result.map((t) => ({
      ...t,
      formatted: {
        minutes: MinuteLimitService.formatMinutes(t.minutes_used),
        charge: t.charge_centavos > 0
          ? MinuteLimitService.formatPriceMXN(t.charge_centavos)
          : null,
        date: new Date(t.recorded_at).toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        type: t.is_overage ? 'Excedente' : 'Incluido',
      },
    }));

    return NextResponse.json({
      success: true,
      transactions: formattedTransactions,
      pagination: {
        limit,
        offset,
        hasMore,
        total: hasMore ? undefined : offset + result.length, // Solo conocemos el total si no hay más
      },
    });
  } catch (error) {
    console.error('[Usage History API] Error:', error);

    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

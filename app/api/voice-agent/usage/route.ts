// =====================================================
// TIS TIS PLATFORM - Voice Agent Usage API
// GET: Obtener resumen de uso de minutos
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { MinuteLimitService } from '@/src/features/voice-agent/services/minute-limit.service';
import { VoiceAgentService } from '@/src/features/voice-agent/services/voice-agent.service';
import { createComponentLogger } from '@/src/shared/lib';

export const dynamic = 'force-dynamic';

const logger = createComponentLogger('voice-usage-api');

/**
 * GET /api/voice-agent/usage
 *
 * Obtiene el resumen completo de uso de minutos de Voice Agent
 *
 * Response:
 * {
 *   success: boolean,
 *   usage: MinuteUsageSummary,
 *   limits: VoiceMinuteLimits,
 *   formatted: {
 *     used: string,        // "147 min"
 *     remaining: string,   // "53 min"
 *     percent: string,     // "73.5%"
 *     overageCharges: string // "$0.00 MXN"
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  // 1. Autenticación
  const authResult = await getAuthenticatedContext(request);

  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { tenantId } = authResult;

  try {
    // 2. Verificar acceso a Voice Agent (solo Growth)
    const access = await VoiceAgentService.canAccessVoiceAgent(tenantId);

    if (!access.canAccess) {
      return NextResponse.json(
        {
          success: false,
          error: access.reason || 'Voice Agent no disponible en tu plan',
          plan: access.plan,
        },
        { status: 403 }
      );
    }

    // 3. Obtener resumen de uso
    const usage = await MinuteLimitService.getUsageSummary(tenantId);

    if (!usage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Error al obtener datos de uso',
        },
        { status: 500 }
      );
    }

    // 4. Obtener configuración de límites
    const limits = await MinuteLimitService.getMinuteLimits(tenantId);

    // 5. Formatear para UI
    const formatted = {
      used: MinuteLimitService.formatMinutes(usage.total_minutes_used),
      included_used: MinuteLimitService.formatMinutes(usage.included_minutes_used),
      overage_used: MinuteLimitService.formatMinutes(usage.overage_minutes_used),
      remaining: MinuteLimitService.formatMinutes(usage.remaining_included),
      percent: `${usage.usage_percent}%`,
      overageCharges: MinuteLimitService.formatPriceMXN(usage.overage_charges_centavos),
      overagePrice: MinuteLimitService.formatPriceMXN(usage.overage_price_centavos),
      resetDate: new Date(usage.billing_period_end).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
      }),
    };

    return NextResponse.json({
      success: true,
      usage,
      limits,
      formatted,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Voice usage API error', {
      tenantId,
      error: errorMessage,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}

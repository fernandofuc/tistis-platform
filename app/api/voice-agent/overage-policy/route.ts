// =====================================================
// TIS TIS PLATFORM - Voice Agent Overage Policy API
// GET: Obtener configuración de política de excedentes
// PATCH: Actualizar política de excedentes
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { MinuteLimitService } from '@/src/features/voice-agent/services/minute-limit.service';
import { VoiceAgentService } from '@/src/features/voice-agent/services/voice-agent.service';
import type { OveragePolicy } from '@/src/features/voice-agent/types';

export const dynamic = 'force-dynamic';

// Validación de input
interface UpdatePolicyInput {
  overage_policy?: OveragePolicy;
  max_overage_charge_centavos?: number;
  alert_thresholds?: number[];
  email_alerts_enabled?: boolean;
  push_alerts_enabled?: boolean;
}

const VALID_POLICIES: OveragePolicy[] = ['block', 'charge', 'notify_only'];

/**
 * GET /api/voice-agent/overage-policy
 *
 * Obtiene la configuración actual de política de excedentes
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

    let limits = await MinuteLimitService.getMinuteLimits(tenantId);

    // Si no existen límites, crearlos automáticamente (lazy initialization)
    if (!limits) {
      limits = await MinuteLimitService.createMinuteLimits(tenantId);

      if (!limits) {
        return NextResponse.json(
          { success: false, error: 'Error al crear configuración inicial' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      policy: {
        overage_policy: limits.overage_policy,
        max_overage_charge_centavos: limits.max_overage_charge_centavos,
        max_overage_charge_pesos: limits.max_overage_charge_centavos / 100,
        alert_thresholds: limits.alert_thresholds,
        email_alerts_enabled: limits.email_alerts_enabled,
        push_alerts_enabled: limits.push_alerts_enabled,
        overage_price_centavos: limits.overage_price_centavos,
        overage_price_pesos: limits.overage_price_centavos / 100,
      },
    });
  } catch (error) {
    console.error('[Overage Policy API] GET Error:', error);

    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/voice-agent/overage-policy
 *
 * Actualiza la configuración de política de excedentes
 *
 * Body:
 * {
 *   overage_policy?: 'block' | 'charge' | 'notify_only',
 *   max_overage_charge_centavos?: number,
 *   alert_thresholds?: number[],
 *   email_alerts_enabled?: boolean,
 *   push_alerts_enabled?: boolean
 * }
 */
export async function PATCH(request: NextRequest) {
  const authResult = await getAuthenticatedContext(request);

  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { tenantId, role } = authResult;

  // Solo owner y admin pueden modificar
  if (!['owner', 'admin'].includes(role)) {
    return NextResponse.json(
      {
        success: false,
        error: 'No tienes permisos para modificar esta configuración',
      },
      { status: 403 }
    );
  }

  try {
    // Verificar acceso a Voice Agent
    const access = await VoiceAgentService.canAccessVoiceAgent(tenantId);

    if (!access.canAccess) {
      return NextResponse.json(
        { success: false, error: access.reason },
        { status: 403 }
      );
    }

    // Parsear body
    let body: UpdatePolicyInput;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Body JSON inválido' },
        { status: 400 }
      );
    }

    // Validar overage_policy
    if (body.overage_policy && !VALID_POLICIES.includes(body.overage_policy)) {
      return NextResponse.json(
        {
          success: false,
          error: `Política inválida. Debe ser: ${VALID_POLICIES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validar max_overage_charge_centavos
    if (body.max_overage_charge_centavos !== undefined) {
      if (
        typeof body.max_overage_charge_centavos !== 'number' ||
        body.max_overage_charge_centavos < 0 ||
        body.max_overage_charge_centavos > 1000000 // Max $10,000 MXN
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Límite máximo de cargo inválido (0 - $10,000 MXN)',
          },
          { status: 400 }
        );
      }
    }

    // Validar alert_thresholds
    if (body.alert_thresholds) {
      if (!Array.isArray(body.alert_thresholds)) {
        return NextResponse.json(
          {
            success: false,
            error: 'alert_thresholds debe ser un array',
          },
          { status: 400 }
        );
      }

      const validThresholds = body.alert_thresholds.every(
        (t) => typeof t === 'number' && t >= 0 && t <= 100
      );

      if (!validThresholds || body.alert_thresholds.length > 10) {
        return NextResponse.json(
          {
            success: false,
            error: 'Umbrales de alerta inválidos (0-100, máximo 10)',
          },
          { status: 400 }
        );
      }
    }

    // Verificar que existen los límites (crear si no existen)
    let limits = await MinuteLimitService.getMinuteLimits(tenantId);

    if (!limits) {
      limits = await MinuteLimitService.createMinuteLimits(tenantId);

      if (!limits) {
        return NextResponse.json(
          { success: false, error: 'Error al crear configuración inicial' },
          { status: 500 }
        );
      }
    }

    // Actualizar configuración
    const updated = await MinuteLimitService.updateMinuteLimits(tenantId, body);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Error al actualizar configuración' },
        { status: 500 }
      );
    }

    console.log('[Overage Policy API] Policy updated for tenant:', tenantId);

    return NextResponse.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      policy: {
        overage_policy: updated.overage_policy,
        max_overage_charge_centavos: updated.max_overage_charge_centavos,
        alert_thresholds: updated.alert_thresholds,
        email_alerts_enabled: updated.email_alerts_enabled,
        push_alerts_enabled: updated.push_alerts_enabled,
      },
    });
  } catch (error) {
    console.error('[Overage Policy API] PATCH Error:', error);

    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

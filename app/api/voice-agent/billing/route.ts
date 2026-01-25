// =====================================================
// TIS TIS PLATFORM - Voice Agent Billing API
// GET: Obtener historial de facturación y preview de cargos
// FASE 5.5: Stripe Integration
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { voiceBillingService } from '@/src/features/voice-agent/services/voice-billing.service';
import { VoiceAgentService } from '@/src/features/voice-agent/services/voice-agent.service';
import { createComponentLogger } from '@/src/shared/lib';

export const dynamic = 'force-dynamic';

const logger = createComponentLogger('voice-billing-api');

// ======================
// TYPES
// ======================

interface BillingHistoryResponse {
  success: boolean;
  history?: {
    items: Array<{
      usageId: string;
      periodStart: string;
      periodEnd: string;
      includedMinutesUsed: number;
      overageMinutesUsed: number;
      totalMinutesUsed: number;
      overageChargesCentavos: number;
      overageChargesPesos: number;
      overageChargesFormatted: string;
      totalCalls: number;
      isBilled: boolean;
      stripeInvoiceId: string | null;
      periodLabel: string;
    }>;
    total: number;
  };
  preview?: {
    currentOverageMinutes: number;
    currentOverageAmount: number;
    currentOverageFormatted: string;
    projectedEndOfMonth: number;
    projectedAmount: number;
    projectedFormatted: string;
    daysElapsed: number;
    daysTotal: number;
    daysRemaining: number;
    periodStart: string | null;
    periodEnd: string | null;
  };
  error?: string;
}

// ======================
// HELPERS
// ======================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

function formatPeriodLabel(periodStart: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
  }).format(periodStart);
}

// ======================
// GET HANDLER
// ======================

/**
 * GET /api/voice-agent/billing
 *
 * Obtiene el historial de facturación y preview de cargos pendientes
 *
 * Query params:
 * - limit: number (default: 12)
 * - offset: number (default: 0)
 * - include_preview: boolean (default: true)
 *
 * Response:
 * {
 *   success: boolean,
 *   history: { items: BillingHistoryItem[], total: number },
 *   preview: OveragePreview (if include_preview=true)
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

    // 3. Parse query params with NaN protection
    const searchParams = request.nextUrl.searchParams;
    const parsedLimit = parseInt(searchParams.get('limit') || '12', 10);
    const parsedOffset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(Math.max(1, Number.isNaN(parsedLimit) ? 12 : parsedLimit), 50);
    const offset = Math.max(0, Number.isNaN(parsedOffset) ? 0 : parsedOffset);
    const includePreview = searchParams.get('include_preview') !== 'false';

    // 4. Fetch billing history
    const { items, total } = await voiceBillingService.getBillingHistory(tenantId, { limit, offset });

    // 5. Format history items
    const formattedHistory = items.map((item) => ({
      usageId: item.usageId,
      periodStart: item.periodStart.toISOString(),
      periodEnd: item.periodEnd.toISOString(),
      includedMinutesUsed: item.includedMinutesUsed,
      overageMinutesUsed: item.overageMinutesUsed,
      totalMinutesUsed: item.totalMinutesUsed,
      overageChargesCentavos: item.overageChargesCentavos,
      overageChargesPesos: item.overageChargesPesos,
      overageChargesFormatted: formatCurrency(item.overageChargesPesos),
      totalCalls: item.totalCalls,
      isBilled: item.isBilled,
      stripeInvoiceId: item.stripeInvoiceId,
      periodLabel: formatPeriodLabel(item.periodStart),
    }));

    const response: BillingHistoryResponse = {
      success: true,
      history: {
        items: formattedHistory,
        total,
      },
    };

    // 6. Include preview if requested
    if (includePreview) {
      try {
        const preview = await voiceBillingService.previewUpcomingCharges(tenantId);
        response.preview = {
          currentOverageMinutes: preview.currentOverageMinutes,
          currentOverageAmount: preview.currentOverageAmount,
          currentOverageFormatted: formatCurrency(preview.currentOverageAmount),
          projectedEndOfMonth: preview.projectedEndOfMonth,
          projectedAmount: preview.projectedAmount,
          projectedFormatted: formatCurrency(preview.projectedAmount),
          daysElapsed: preview.daysElapsed,
          daysTotal: preview.daysTotal,
          daysRemaining: preview.daysTotal - preview.daysElapsed,
          periodStart: preview.periodStart?.toISOString() || null,
          periodEnd: preview.periodEnd?.toISOString() || null,
        };
      } catch (previewError) {
        logger.warn('Failed to get billing preview', {
          tenantId,
          error: previewError instanceof Error ? previewError.message : 'Unknown error',
        });
        // Don't fail the request, just skip preview
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Voice billing API error', {
      tenantId,
      error: errorMessage,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener datos de facturación',
      },
      { status: 500 }
    );
  }
}

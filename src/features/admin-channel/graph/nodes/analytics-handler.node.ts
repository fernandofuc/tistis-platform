/**
 * TIS TIS PLATFORM - Admin Channel Analytics Handler
 *
 * Genera reportes y métricas para el usuario.
 * Obtiene datos de analytics y los formatea según el canal.
 *
 * @module admin-channel/graph/nodes/analytics-handler
 */

import type { AdminChannelStateType } from '../state';
import type { AdminAnalyticsReport, AdminIntent, AdminExecutedAction } from '../../types';
import { getAnalyticsService } from '../../services/analytics.service';
import { formatReportForChannel } from '../../utils/report-formatter';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Analytics]';

// Timeout for analytics queries (15 seconds - reports can be slow)
const ANALYTICS_TIMEOUT_MS = 15000;

// =====================================================
// TIMEOUT HELPER
// =====================================================

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
}

// =====================================================
// ANALYTICS HANDLER NODE
// =====================================================

export async function analyticsHandlerNode(
  state: AdminChannelStateType
): Promise<Partial<AdminChannelStateType>> {
  const startTime = Date.now();

  try {
    const { context, detectedIntent, extractedEntities } = state;

    // 1. Determinar período
    const period = getPeriodFromIntent(detectedIntent, extractedEntities);

    // 2. Obtener datos según intent (with timeout protection)
    const analyticsService = getAnalyticsService();
    let report: AdminAnalyticsReport;

    try {
      switch (detectedIntent) {
        case 'analytics_daily_summary':
        case 'analytics_weekly_summary':
        case 'analytics_monthly_summary':
          report = await withTimeout(
            analyticsService.getFullReport(context.tenantId, period, context.vertical),
            ANALYTICS_TIMEOUT_MS,
            'Full report'
          );
          break;

        case 'analytics_sales':
        case 'analytics_revenue':
          report = await withTimeout(
            analyticsService.getSalesReport(context.tenantId, period),
            ANALYTICS_TIMEOUT_MS,
            'Sales report'
          );
          break;

        case 'analytics_leads':
          report = await withTimeout(
            analyticsService.getLeadsReport(context.tenantId, period),
            ANALYTICS_TIMEOUT_MS,
            'Leads report'
          );
          break;

        case 'analytics_orders':
        case 'analytics_appointments':
          report = await withTimeout(
            analyticsService.getOrdersReport(context.tenantId, period),
            ANALYTICS_TIMEOUT_MS,
            'Orders report'
          );
          break;

        case 'analytics_inventory':
          report = await withTimeout(
            analyticsService.getInventoryReport(context.tenantId),
            ANALYTICS_TIMEOUT_MS,
            'Inventory report'
          );
          break;

        case 'analytics_ai_performance':
          report = await withTimeout(
            analyticsService.getAIPerformanceReport(context.tenantId, period),
            ANALYTICS_TIMEOUT_MS,
            'AI performance report'
          );
          break;

        default:
          report = await withTimeout(
            analyticsService.getFullReport(context.tenantId, 'daily', context.vertical),
            ANALYTICS_TIMEOUT_MS,
            'Default report'
          );
      }
    } catch (timeoutError) {
      if (timeoutError instanceof Error && timeoutError.message.includes('timeout')) {
        console.error(`${LOG_PREFIX} Report generation timeout`);
        return {
          response: '⏱️ El reporte está tardando demasiado. Intenta de nuevo en unos momentos.',
          shouldEnd: true,
          error: 'Analytics timeout',
        };
      }
      throw timeoutError; // Re-throw non-timeout errors
    }

    // 3. Formatear respuesta según canal
    const formattedResponse = formatReportForChannel(
      report,
      context.channel,
      context.vertical,
      detectedIntent
    );

    console.log(
      `${LOG_PREFIX} Generated ${detectedIntent} in ${Date.now() - startTime}ms`
    );

    const executedAction: AdminExecutedAction = {
      type: 'analytics_query',
      entityType: detectedIntent,
      success: true,
      executedAt: new Date(),
    };

    return {
      analyticsData: report,
      response: formattedResponse.text,
      keyboard: formattedResponse.keyboard,
      shouldEnd: true,
      executedActions: [executedAction],
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return {
      response: '❌ Error generando el reporte. Intenta de nuevo en unos momentos.',
      shouldEnd: true,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// =====================================================
// PERIOD DETECTION
// =====================================================

function getPeriodFromIntent(
  intent: AdminIntent,
  entities: Record<string, unknown>
): 'daily' | 'weekly' | 'monthly' {
  // Primero revisar entidades extraídas
  if (entities.period === 'week' || entities.period === 'weekly') {
    return 'weekly';
  }
  if (entities.period === 'month' || entities.period === 'monthly') {
    return 'monthly';
  }

  // Luego inferir del intent
  if (intent === 'analytics_weekly_summary') {
    return 'weekly';
  }
  if (intent === 'analytics_monthly_summary') {
    return 'monthly';
  }

  return 'daily';
}

// =====================================================
// EXPORTS
// =====================================================

export { getPeriodFromIntent };

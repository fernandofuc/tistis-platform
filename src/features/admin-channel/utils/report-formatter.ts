/**
 * TIS TIS PLATFORM - Report Formatter
 *
 * Formatea reportes para WhatsApp y Telegram.
 * Adapta el formato según el canal (HTML para Telegram, markdown para WhatsApp).
 *
 * @module admin-channel/utils/report-formatter
 */

import type { AdminAnalyticsReport, AdminIntent, AdminChannelType } from '../types';

// =====================================================
// TYPES
// =====================================================

interface FormattedReport {
  text: string;
  keyboard: Array<Array<{ text: string; callback_data: string }>> | null;
}

// =====================================================
// MAIN FORMATTER
// =====================================================

export function formatReportForChannel(
  report: AdminAnalyticsReport,
  channel: AdminChannelType,
  vertical: string,
  intent: AdminIntent
): FormattedReport {
  switch (intent) {
    case 'analytics_daily_summary':
    case 'analytics_weekly_summary':
    case 'analytics_monthly_summary':
      return formatFullReport(report, channel, vertical);

    case 'analytics_sales':
    case 'analytics_revenue':
      return formatSalesReport(report, channel);

    case 'analytics_leads':
      return formatLeadsReport(report, channel);

    case 'analytics_orders':
    case 'analytics_appointments':
      return formatOrdersReport(report, channel);

    case 'analytics_inventory':
      return formatInventoryReport(report, channel);

    case 'analytics_ai_performance':
      return formatAIReport(report, channel);

    default:
      return formatFullReport(report, channel, vertical);
  }
}

// =====================================================
// FULL REPORT
// =====================================================

function formatFullReport(
  report: AdminAnalyticsReport,
  channel: AdminChannelType,
  _vertical: string
): FormattedReport {
  const periodLabel = getPeriodLabel(report.type);
  const salesTotal = report.sales?.total ?? 0;
  const salesCount = report.sales?.count ?? 0;
  const salesAvgTicket = report.sales?.averageTicket ?? 0;
  const changePercent = report.comparison?.revenueChange ?? 0;

  const changeEmoji = changePercent >= 0 ? '📈' : '📉';
  const changeSign = changePercent >= 0 ? '+' : '';

  const leadsTotal = report.leads?.total ?? 0;
  const leadsNew = report.leads?.new ?? 0;
  const leadsHot = report.leads?.hotLeads ?? 0;
  const leadsConverted = report.leads?.converted ?? 0;
  const conversionRate = report.summary.conversionRate ?? 0;

  const aiConversations = report.aiPerformance?.totalConversations ?? 0;
  const aiMessages = report.aiPerformance?.messagesProcessed ?? 0;
  const aiEscalationRate = report.aiPerformance?.escalationRate ?? 0;

  let text = '';

  if (channel === 'telegram') {
    text = `📊 <b>Resumen ${periodLabel}</b>\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;

    text += `💰 <b>Ventas</b>\n`;
    text += `   Total: <b>${formatCurrency(salesTotal)}</b>\n`;
    text += `   Transacciones: ${salesCount}\n`;
    text += `   Ticket promedio: ${formatCurrency(salesAvgTicket)}\n`;
    text += `   ${changeEmoji} ${changeSign}${changePercent}% vs período anterior\n\n`;

    text += `👥 <b>Leads</b>\n`;
    text += `   Total: ${leadsTotal}\n`;
    text += `   🔥 Calientes: ${leadsHot}\n`;
    text += `   ✅ Convertidos: ${leadsConverted} (${conversionRate}%)\n\n`;

    text += `🤖 <b>IA</b>\n`;
    text += `   Conversaciones: ${aiConversations}\n`;
    text += `   Mensajes: ${aiMessages}\n`;
    text += `   Escalaciones: ${aiEscalationRate}%\n`;

    if (report.appointments) {
      text += `\n📅 <b>Citas</b>\n`;
      text += `   Total: ${report.appointments.total}\n`;
      text += `   Completadas: ${report.appointments.completed}\n`;
    }

    if (report.inventory && report.inventory.lowStockItems > 0) {
      text += `\n⚠️ <b>Alertas Inventario</b>\n`;
      text += `   ${report.inventory.lowStockItems} productos con stock bajo\n`;
    }
  } else {
    // WhatsApp (sin HTML)
    text = `📊 *Resumen ${periodLabel}*\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;

    text += `💰 *Ventas*\n`;
    text += `Total: *${formatCurrency(salesTotal)}*\n`;
    text += `Transacciones: ${salesCount}\n`;
    text += `Ticket promedio: ${formatCurrency(salesAvgTicket)}\n`;
    text += `${changeEmoji} ${changeSign}${changePercent}% vs anterior\n\n`;

    text += `👥 *Leads*\n`;
    text += `Total: ${leadsTotal} | 🔥 ${leadsHot} calientes\n`;
    text += `✅ Convertidos: ${leadsConverted} (${conversionRate}%)\n\n`;

    text += `🤖 *IA*\n`;
    text += `${aiConversations} conversaciones\n`;
    text += `${aiEscalationRate}% escalaciones\n`;

    if (report.appointments) {
      text += `\n📅 *Citas*\n`;
      text += `${report.appointments.total} total | ${report.appointments.completed} completadas\n`;
    }

    if (report.inventory && report.inventory.lowStockItems > 0) {
      text += `\n⚠️ ${report.inventory.lowStockItems} alertas de inventario\n`;
    }
  }

  // Keyboard para Telegram
  const keyboard =
    channel === 'telegram'
      ? [
          [
            { text: '📈 Ver ventas', callback_data: 'analytics_sales' },
            { text: '👥 Ver leads', callback_data: 'analytics_leads' },
          ],
          [{ text: '🤖 Rendimiento IA', callback_data: 'analytics_ai_performance' }],
        ]
      : null;

  return { text, keyboard };
}

// =====================================================
// SALES REPORT
// =====================================================

function formatSalesReport(
  report: AdminAnalyticsReport,
  channel: AdminChannelType
): FormattedReport {
  const periodLabel = getPeriodLabel(report.type);
  const salesTotal = report.sales?.total ?? 0;
  const salesCount = report.sales?.count ?? 0;
  const salesAvgTicket = report.sales?.averageTicket ?? 0;
  const changePercent = report.comparison?.revenueChange ?? 0;

  const changeEmoji = changePercent >= 0 ? '📈' : '📉';
  const changeSign = changePercent >= 0 ? '+' : '';

  let text = '';

  if (channel === 'telegram') {
    text = `💰 <b>Ventas ${periodLabel}</b>\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;
    text += `Total: <b>${formatCurrency(salesTotal)}</b>\n`;
    text += `Transacciones: ${salesCount}\n`;
    text += `Ticket promedio: ${formatCurrency(salesAvgTicket)}\n\n`;
    text += `${changeEmoji} <b>${changeSign}${changePercent}%</b> vs período anterior`;
  } else {
    text = `💰 *Ventas ${periodLabel}*\n\n`;
    text += `Total: *${formatCurrency(salesTotal)}*\n`;
    text += `Transacciones: ${salesCount}\n`;
    text += `Ticket promedio: ${formatCurrency(salesAvgTicket)}\n\n`;
    text += `${changeEmoji} *${changeSign}${changePercent}%* vs anterior`;
  }

  return { text, keyboard: null };
}

// =====================================================
// LEADS REPORT
// =====================================================

function formatLeadsReport(
  report: AdminAnalyticsReport,
  channel: AdminChannelType
): FormattedReport {
  const periodLabel = getPeriodLabel(report.type);
  const leadsTotal = report.leads?.total ?? 0;
  const leadsNew = report.leads?.new ?? 0;
  const leadsHot = report.leads?.hotLeads ?? 0;
  const leadsConverted = report.leads?.converted ?? 0;
  const conversionRate = report.summary.conversionRate ?? 0;

  let text = '';

  if (channel === 'telegram') {
    text = `👥 <b>Leads ${periodLabel}</b>\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;
    text += `Total: <b>${leadsTotal}</b>\n`;
    text += `Nuevos: ${leadsNew}\n\n`;
    text += `Por temperatura:\n`;
    text += `🔥 Calientes: ${leadsHot}\n\n`;
    text += `✅ Convertidos: <b>${leadsConverted}</b>\n`;
    text += `📊 Tasa de conversión: <b>${conversionRate}%</b>`;
  } else {
    text = `👥 *Leads ${periodLabel}*\n\n`;
    text += `Total: *${leadsTotal}*\n`;
    text += `Nuevos: ${leadsNew}\n\n`;
    text += `🔥 Calientes: ${leadsHot}\n\n`;
    text += `✅ Convertidos: *${leadsConverted}*\n`;
    text += `Conversión: *${conversionRate}%*`;
  }

  return { text, keyboard: null };
}

// =====================================================
// ORDERS/APPOINTMENTS REPORT
// =====================================================

function formatOrdersReport(
  report: AdminAnalyticsReport,
  channel: AdminChannelType
): FormattedReport {
  const periodLabel = getPeriodLabel(report.type);
  const total = report.appointments?.total ?? 0;
  const completed = report.appointments?.completed ?? 0;
  const cancelled = report.appointments?.cancelled ?? 0;

  let text = '';

  if (channel === 'telegram') {
    text = `📅 <b>Citas/Pedidos ${periodLabel}</b>\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;
    text += `Total: <b>${total}</b>\n`;
    text += `✅ Completadas: ${completed}\n`;
    text += `❌ Canceladas: ${cancelled}`;
  } else {
    text = `📅 *Citas/Pedidos ${periodLabel}*\n\n`;
    text += `Total: *${total}*\n`;
    text += `✅ Completadas: ${completed}\n`;
    text += `❌ Canceladas: ${cancelled}`;
  }

  return { text, keyboard: null };
}

// =====================================================
// INVENTORY REPORT
// =====================================================

function formatInventoryReport(
  report: AdminAnalyticsReport,
  channel: AdminChannelType
): FormattedReport {
  const lowStock = report.inventory?.lowStockItems ?? 0;
  const outOfStock = report.inventory?.outOfStockItems ?? 0;
  const alerts = report.inventory?.alerts ?? [];

  let text = '';

  if (channel === 'telegram') {
    if (lowStock > 0 || outOfStock > 0) {
      text = `⚠️ <b>Alertas de Inventario</b>\n`;
      text += `━━━━━━━━━━━━━━━\n\n`;
      text += `Stock bajo: <b>${lowStock}</b> productos\n`;
      text += `Sin stock: <b>${outOfStock}</b> productos\n`;

      if (alerts.length > 0) {
        text += `\n<b>Productos críticos:</b>\n`;
        alerts.forEach((alert) => {
          text += `• ${alert.item}: ${alert.current}/${alert.minimum}\n`;
        });
      }
    } else {
      text = `✅ <b>Inventario OK</b>\n\n`;
      text += `No hay alertas de stock bajo.`;
    }
  } else {
    if (lowStock > 0 || outOfStock > 0) {
      text = `⚠️ *Alertas de Inventario*\n\n`;
      text += `Stock bajo: *${lowStock}* productos\n`;
      text += `Sin stock: *${outOfStock}* productos\n`;

      if (alerts.length > 0) {
        text += `\n*Productos críticos:*\n`;
        alerts.forEach((alert) => {
          text += `• ${alert.item}: ${alert.current}/${alert.minimum}\n`;
        });
      }
    } else {
      text = `✅ *Inventario OK*\n\n`;
      text += `Sin alertas de stock.`;
    }
  }

  return { text, keyboard: null };
}

// =====================================================
// AI PERFORMANCE REPORT
// =====================================================

function formatAIReport(
  report: AdminAnalyticsReport,
  channel: AdminChannelType
): FormattedReport {
  const periodLabel = getPeriodLabel(report.type);
  const conversations = report.aiPerformance?.totalConversations ?? 0;
  const messages = report.aiPerformance?.messagesProcessed ?? 0;
  const escalationRate = report.aiPerformance?.escalationRate ?? 0;
  const satisfactionScore = report.aiPerformance?.satisfactionScore ?? 0;

  let text = '';

  if (channel === 'telegram') {
    text = `🤖 <b>Rendimiento IA ${periodLabel}</b>\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;
    text += `Conversaciones: <b>${conversations}</b>\n`;
    text += `Mensajes: ${messages}\n\n`;
    text += `✅ Resolución: <b>${100 - escalationRate}%</b>\n`;
    text += `🙋 Escalaciones: ${escalationRate}%\n`;
    if (satisfactionScore > 0) {
      text += `⭐ Satisfacción: ${satisfactionScore}%`;
    }
  } else {
    text = `🤖 *Rendimiento IA ${periodLabel}*\n\n`;
    text += `*${conversations}* conversaciones\n`;
    text += `${messages} mensajes\n\n`;
    text += `✅ *${100 - escalationRate}%* resueltas\n`;
    text += `🙋 ${escalationRate}% escaladas`;
    if (satisfactionScore > 0) {
      text += `\n⭐ ${satisfactionScore}% satisfacción`;
    }
  }

  return { text, keyboard: null };
}

// =====================================================
// HELPERS
// =====================================================

function getPeriodLabel(period: 'daily' | 'weekly' | 'monthly' | 'custom'): string {
  switch (period) {
    case 'daily':
      return 'de Hoy';
    case 'weekly':
      return 'Semanal';
    case 'monthly':
      return 'Mensual';
    case 'custom':
      return 'Personalizado';
    default:
      return '';
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// =====================================================
// EXPORTS
// =====================================================

export { formatCurrency, getPeriodLabel };
export type { FormattedReport };

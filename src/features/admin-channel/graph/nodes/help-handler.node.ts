/**
 * TIS TIS PLATFORM - Admin Channel Help Handler
 *
 * Muestra ayuda y comandos disponibles.
 * Adapta la ayuda según permisos del usuario y canal.
 *
 * @module admin-channel/graph/nodes/help-handler
 */

import type { AdminChannelStateType } from '../state';
import type { AdminChannelType } from '../../types';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Help]';

// =====================================================
// HELP HANDLER NODE
// =====================================================

export async function helpHandlerNode(
  state: AdminChannelStateType
): Promise<Partial<AdminChannelStateType>> {
  try {
    const { context } = state;
    const channel = context.channel;

    const helpText = generateHelpText(
      channel,
      context.user.canViewAnalytics,
      context.user.canConfigure,
      context.user.canReceiveNotifications
    );

    const keyboard = generateHelpKeyboard(
      context.user.canViewAnalytics,
      context.user.canConfigure,
      channel
    );

    console.log(`${LOG_PREFIX} Help displayed`);

    return {
      response: helpText,
      keyboard,
      shouldEnd: true,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return {
      response: 'Escribe "ayuda" para ver los comandos disponibles.',
      shouldEnd: true,
    };
  }
}

// =====================================================
// HELP TEXT GENERATION
// =====================================================

function generateHelpText(
  channel: AdminChannelType,
  canViewAnalytics: boolean,
  canConfigure: boolean,
  canReceiveNotifications: boolean
): string {
  const isTelegram = channel === 'telegram';
  let help = `📋 <b>Comandos disponibles</b>\n\n`;

  // Analytics
  if (canViewAnalytics) {
    help += `${isTelegram ? '📊 <b>REPORTES</b>' : '📊 REPORTES'}\n`;
    if (isTelegram) {
      help += `/reporte - Resumen del día\n`;
      help += `/ventas - Ventas de hoy\n`;
      help += `/leads - Leads nuevos\n`;
    } else {
      help += `• "reporte" o "resumen del día"\n`;
      help += `• "ventas de hoy"\n`;
      help += `• "leads nuevos"\n`;
    }
    help += `• "reporte semanal"\n`;
    help += `• "reporte mensual"\n`;
    help += `• "inventario bajo"\n\n`;
  }

  // Config
  if (canConfigure) {
    help += `${isTelegram ? '⚙️ <b>CONFIGURACIÓN</b>' : '⚙️ CONFIGURACIÓN'}\n`;
    if (isTelegram) {
      help += `/config - Menú de configuración\n`;
    }
    help += `• "agregar servicio"\n`;
    help += `• "cambiar precio de [servicio]"\n`;
    help += `• "modificar horarios"\n`;
    help += `• "agregar promoción"\n\n`;
  }

  // Notifications
  if (canReceiveNotifications) {
    help += `${isTelegram ? '🔔 <b>NOTIFICACIONES</b>' : '🔔 NOTIFICACIONES'}\n`;
    if (isTelegram) {
      help += `/alertas - Configurar alertas\n`;
      help += `/pausar - Pausar notificaciones\n`;
      help += `/reanudar - Reanudar notificaciones\n`;
    } else {
      help += `• "configurar alertas"\n`;
      help += `• "pausar notificaciones"\n`;
      help += `• "reanudar notificaciones"\n`;
    }
    help += `\n`;
  }

  help += `${isTelegram ? '💬 <b>OTROS</b>' : '💬 OTROS'}\n`;
  help += `• También puedes escribir en lenguaje natural\n`;
  help += `• Ejemplo: "¿cómo van las ventas esta semana?"`;

  // Para WhatsApp, convertir HTML a texto plano
  if (!isTelegram) {
    help = help.replace(/<\/?b>/g, '');
  }

  return help;
}

// =====================================================
// KEYBOARD GENERATION
// =====================================================

function generateHelpKeyboard(
  canViewAnalytics: boolean,
  canConfigure: boolean,
  channel: AdminChannelType
): Array<Array<{ text: string; callback_data: string }>> | null {
  if (channel !== 'telegram') {
    return null;
  }

  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

  if (canViewAnalytics) {
    keyboard.push([
      { text: '📊 Reporte del día', callback_data: 'report_daily' },
    ]);
  }

  if (canConfigure) {
    keyboard.push([{ text: '⚙️ Configurar', callback_data: 'config_menu' }]);
  }

  keyboard.push([{ text: '🔔 Notificaciones', callback_data: 'notification_settings' }]);

  return keyboard.length > 0 ? keyboard : null;
}

// =====================================================
// EXPORTS
// =====================================================

export { generateHelpText, generateHelpKeyboard };

/**
 * TIS TIS PLATFORM - Admin Channel Greeting Handler
 *
 * Maneja saludos y mensajes de bienvenida.
 * Personaliza respuesta según canal y contexto del usuario.
 *
 * @module admin-channel/graph/nodes/greeting-handler
 */

import type { AdminChannelStateType } from '../state';
import type { AdminChannelType } from '../../types';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Greeting]';

// =====================================================
// GREETING HANDLER NODE
// =====================================================

export async function greetingHandlerNode(
  state: AdminChannelStateType
): Promise<Partial<AdminChannelStateType>> {
  try {
    const { context } = state;
    const channel = context.channel;

    // Personalizar saludo según vertical
    const greetingText = generateGreeting(
      context.tenantName,
      context.vertical,
      channel,
      context.user.canViewAnalytics,
      context.user.canConfigure
    );

    // Generar keyboard para acciones rápidas
    const keyboard = generateQuickActionsKeyboard(
      context.user.canViewAnalytics,
      context.user.canConfigure,
      channel
    );

    console.log(`${LOG_PREFIX} Greeting sent for ${context.vertical}`);

    return {
      response: greetingText,
      keyboard,
      shouldEnd: true,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return {
      response: 'Hola! Soy tu asistente administrativo de TIS TIS. ¿En qué puedo ayudarte?',
      shouldEnd: true,
    };
  }
}

// =====================================================
// GREETING GENERATION
// =====================================================

function generateGreeting(
  tenantName: string,
  vertical: string,
  channel: AdminChannelType,
  canViewAnalytics: boolean,
  canConfigure: boolean
): string {
  const verticalGreetings: Record<string, string> = {
    dental: 'consultorio dental',
    clinic: 'clínica',
    restaurant: 'restaurante',
    beauty: 'salón de belleza',
    gym: 'gimnasio',
    veterinary: 'clínica veterinaria',
  };

  const businessType = verticalGreetings[vertical] || 'negocio';
  const isTelegram = channel === 'telegram';

  let greeting = `¡Hola! 👋\n\n`;
  greeting += `Soy tu asistente administrativo de ${tenantName}.\n\n`;
  greeting += `Puedo ayudarte con tu ${businessType}:\n\n`;

  if (canViewAnalytics) {
    greeting += `${isTelegram ? '📊' : '📊'} Ver reportes y métricas\n`;
  }
  if (canConfigure) {
    greeting += `${isTelegram ? '⚙️' : '⚙️'} Configurar servicios y precios\n`;
  }
  greeting += `${isTelegram ? '🔔' : '🔔'} Recibir alertas importantes\n`;
  greeting += `${isTelegram ? '❓' : '❓'} Obtener ayuda rápida\n`;

  greeting += `\n¿Qué te gustaría hacer?`;

  return greeting;
}

// =====================================================
// KEYBOARD GENERATION
// =====================================================

function generateQuickActionsKeyboard(
  canViewAnalytics: boolean,
  canConfigure: boolean,
  channel: AdminChannelType
): Array<Array<{ text: string; callback_data: string }>> | null {
  // Solo generar keyboard para Telegram
  if (channel !== 'telegram') {
    return null;
  }

  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

  if (canViewAnalytics) {
    keyboard.push([
      { text: '📊 Reporte del día', callback_data: 'report_daily' },
      { text: '💰 Ver ventas', callback_data: 'report_sales' },
    ]);
  }

  if (canConfigure) {
    keyboard.push([
      { text: '⚙️ Configurar', callback_data: 'config_menu' },
    ]);
  }

  keyboard.push([{ text: '❓ Ver ayuda', callback_data: 'help_menu' }]);

  return keyboard.length > 0 ? keyboard : null;
}

// =====================================================
// EXPORTS
// =====================================================

export { generateGreeting, generateQuickActionsKeyboard };

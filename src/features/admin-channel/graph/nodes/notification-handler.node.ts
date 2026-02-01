/**
 * TIS TIS PLATFORM - Admin Channel Notification Handler
 *
 * Maneja configuración de notificaciones del usuario.
 * Permite pausar, reanudar y configurar horarios de alertas.
 *
 * @module admin-channel/graph/nodes/notification-handler
 */

import type { AdminChannelStateType } from '../state';
import type { AdminChannelType, AdminExecutedAction } from '../../types';
import { createClient } from '@supabase/supabase-js';
import { validateUUID, withTimeout } from '../../utils/helpers';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Notification]';

// Timeout for database operations
const DB_TIMEOUT_MS = 10000;

// =====================================================
// NOTIFICATION HANDLER NODE
// =====================================================

export async function notificationHandlerNode(
  state: AdminChannelStateType
): Promise<Partial<AdminChannelStateType>> {
  try {
    const { context, detectedIntent } = state;

    // Edge case: context might be missing
    if (!context || !context.user || !context.user.userId) {
      console.error(`${LOG_PREFIX} Missing context or user`);
      return {
        response: '❌ Error de sesión. Por favor, reinicia la conversación.',
        shouldEnd: true,
        error: 'Missing context',
      };
    }

    // P0 Security: Validate userId before any operations
    validateUUID(context.user.userId, 'userId');

    // Verificar permisos
    if (!context.user.canReceiveNotifications) {
      return {
        response:
          '⚠️ No tienes habilitadas las notificaciones.\n\n' +
          'Contacta al administrador para activarlas.',
        shouldEnd: true,
      };
    }

    let result: NotificationResult;

    switch (detectedIntent) {
      case 'notification_pause':
        result = await handlePauseNotifications(context.user.userId);
        break;
      case 'notification_resume':
        result = await handleResumeNotifications(context.user.userId);
        break;
      case 'notification_settings':
        result = await handleNotificationSettings(context.user.userId, context.channel);
        break;
      case 'notification_test':
        result = await handleTestNotification(context.user.userId, context.channel);
        break;
      default:
        result = showNotificationMenu(context.channel);
    }

    const executedAction: AdminExecutedAction = {
      type: 'notification_config',
      entityType: detectedIntent,
      success: result.success,
      executedAt: new Date(),
    };

    console.log(`${LOG_PREFIX} Processed ${detectedIntent}: ${result.success}`);

    return {
      response: result.response,
      keyboard: result.keyboard,
      executedActions: [executedAction],
      shouldEnd: true,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return {
      response: '❌ Error procesando notificaciones. Intenta de nuevo.',
      shouldEnd: true,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// =====================================================
// TYPES
// =====================================================

interface NotificationResult {
  response: string;
  keyboard?: Array<Array<{ text: string; callback_data: string }>> | null;
  success: boolean;
}

// =====================================================
// SUPABASE CLIENT
// =====================================================

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// =====================================================
// HANDLER FUNCTIONS
// =====================================================

function showNotificationMenu(channel: AdminChannelType): NotificationResult {
  const isTelegram = channel === 'telegram';

  const keyboard = isTelegram
    ? [
        [
          { text: '⏸️ Pausar alertas', callback_data: 'notification_pause' },
          { text: '▶️ Reanudar', callback_data: 'notification_resume' },
        ],
        [
          { text: '⚙️ Configurar', callback_data: 'notification_settings' },
          { text: '🔔 Test', callback_data: 'notification_test' },
        ],
      ]
    : null;

  return {
    response:
      `🔔 Configuración de Notificaciones\n\n` +
      `¿Qué deseas hacer?\n\n` +
      `• "pausar alertas" - Silenciar temporalmente\n` +
      `• "reanudar alertas" - Volver a recibir\n` +
      `• "configurar horarios" - Ajustar cuándo recibes\n` +
      `• "test" - Enviar notificación de prueba`,
    keyboard,
    success: true,
  };
}

async function handlePauseNotifications(userId: string): Promise<NotificationResult> {
  try {
    const supabase = getSupabaseClient();

    // Primero obtener metadata actual para hacer merge
    const { data: currentUser, error: fetchError } = await withTimeout(
      supabase
        .from('admin_channel_users')
        .select('metadata')
        .eq('id', userId)
        .single()
        .then((r) => r),
      DB_TIMEOUT_MS,
      'Fetch user metadata'
    );

    if (fetchError) {
      console.error(`${LOG_PREFIX} Fetch user error:`, fetchError);
      return {
        response: '❌ Error obteniendo datos del usuario.',
        success: false,
      };
    }

    // Merge metadata en lugar de sobrescribir
    const updatedMetadata = {
      ...((currentUser?.metadata as Record<string, unknown>) || {}),
      notifications_paused_at: new Date().toISOString(),
    };

    // Actualizar preferencias del usuario
    const { error } = await withTimeout(
      supabase
        .from('admin_channel_users')
        .update({
          can_receive_notifications: false,
          metadata: updatedMetadata,
        })
        .eq('id', userId)
        .then((r) => r),
      DB_TIMEOUT_MS,
      'Update pause notifications'
    );

    if (error) {
      console.error(`${LOG_PREFIX} Pause error:`, error);
      return {
        response: '❌ Error pausando notificaciones. Intenta de nuevo.',
        success: false,
      };
    }

    return {
      response:
        `⏸️ Notificaciones pausadas\n\n` +
        `Ya no recibirás alertas automáticas.\n\n` +
        `Para reanudar, escribe "reanudar alertas"`,
      success: true,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Pause error:`, error);
    return {
      response: '❌ Error pausando notificaciones.',
      success: false,
    };
  }
}

async function handleResumeNotifications(userId: string): Promise<NotificationResult> {
  try {
    const supabase = getSupabaseClient();

    // Primero obtener metadata actual para hacer merge
    const { data: currentUser, error: fetchError } = await withTimeout(
      supabase
        .from('admin_channel_users')
        .select('metadata')
        .eq('id', userId)
        .single()
        .then((r) => r),
      DB_TIMEOUT_MS,
      'Fetch user metadata'
    );

    if (fetchError) {
      console.error(`${LOG_PREFIX} Fetch user error:`, fetchError);
      return {
        response: '❌ Error obteniendo datos del usuario.',
        success: false,
      };
    }

    // Merge metadata en lugar de sobrescribir
    const updatedMetadata = {
      ...((currentUser?.metadata as Record<string, unknown>) || {}),
      notifications_resumed_at: new Date().toISOString(),
    };

    const { error } = await withTimeout(
      supabase
        .from('admin_channel_users')
        .update({
          can_receive_notifications: true,
          metadata: updatedMetadata,
        })
        .eq('id', userId)
        .then((r) => r),
      DB_TIMEOUT_MS,
      'Update resume notifications'
    );

    if (error) {
      console.error(`${LOG_PREFIX} Resume error:`, error);
      return {
        response: '❌ Error reanudando notificaciones. Intenta de nuevo.',
        success: false,
      };
    }

    return {
      response:
        `▶️ Notificaciones reanudadas\n\n` +
        `Volverás a recibir alertas según tu configuración.\n\n` +
        `Recibirás:\n` +
        `• Resumen diario\n` +
        `• Alertas de leads calientes\n` +
        `• Avisos de inventario bajo\n` +
        `• Escalaciones urgentes`,
      success: true,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Resume error:`, error);
    return {
      response: '❌ Error reanudando notificaciones.',
      success: false,
    };
  }
}

async function handleNotificationSettings(
  userId: string,
  channel: AdminChannelType
): Promise<NotificationResult> {
  const isTelegram = channel === 'telegram';

  try {
    const supabase = getSupabaseClient();

    // Obtener configuración actual
    const { data: user, error } = await withTimeout(
      supabase
        .from('admin_channel_users')
        .select('notification_hours_start, notification_hours_end, timezone, can_receive_notifications')
        .eq('id', userId)
        .single()
        .then((r) => r),
      DB_TIMEOUT_MS,
      'Get notification settings'
    );

    if (error || !user) {
      return {
        response: '❌ Error obteniendo configuración.',
        success: false,
      };
    }

    const startHour = user.notification_hours_start || 8;
    const endHour = user.notification_hours_end || 20;
    const isActive = user.can_receive_notifications;

    let response =
      `${isTelegram ? '<b>⚙️ Tu Configuración</b>' : '⚙️ Tu Configuración'}\n\n` +
      `Estado: ${isActive ? '✅ Activas' : '⏸️ Pausadas'}\n` +
      `Horario: ${startHour}:00 - ${endHour}:00\n` +
      `Zona horaria: ${user.timezone || 'America/Mexico_City'}\n\n`;

    response +=
      `Para cambiar horarios:\n` +
      `"alertas de 9 a 18"\n` +
      `"alertas solo en horario laboral"`;

    const keyboard = isTelegram
      ? [
          [
            { text: '🌅 6am-6pm', callback_data: 'set_hours_6_18' },
            { text: '🌆 8am-8pm', callback_data: 'set_hours_8_20' },
          ],
          [{ text: '🌙 24 horas', callback_data: 'set_hours_0_24' }],
        ]
      : null;

    return { response, keyboard, success: true };
  } catch (error) {
    console.error(`${LOG_PREFIX} Settings error:`, error);
    return {
      response: '❌ Error obteniendo configuración.',
      success: false,
    };
  }
}

async function handleTestNotification(
  userId: string,
  channel: AdminChannelType
): Promise<NotificationResult> {
  // En producción, esto enviaría una notificación real
  console.log(`${LOG_PREFIX} Test notification requested for ${userId}`);

  return {
    response:
      `🔔 Notificación de prueba\n\n` +
      `Esta es una notificación de prueba.\n` +
      `Si la estás viendo, las notificaciones funcionan correctamente.\n\n` +
      `Canal: ${channel === 'telegram' ? 'Telegram' : 'WhatsApp'}`,
    success: true,
  };
}

// Exports are inline (export async function)

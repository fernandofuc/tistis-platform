/**
 * TIS TIS PLATFORM - Admin Channel Config Handler
 *
 * Maneja solicitudes de configuración (servicios, precios, horarios).
 * Genera acciones pendientes para confirmación antes de ejecutar cambios.
 *
 * @module admin-channel/graph/nodes/config-handler
 */

import type { AdminChannelStateType } from '../state';
import type { AdminPendingAction, AdminIntent, AdminChannelType } from '../../types';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Config]';

// UUID validation regex for security
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUUID(value: string, fieldName: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid ${fieldName} format: not a valid UUID`);
  }
}

// Expiración de acciones pendientes (5 minutos)
const PENDING_ACTION_EXPIRY_MS = 5 * 60 * 1000;

// =====================================================
// CONFIG HANDLER NODE
// =====================================================

export async function configHandlerNode(
  state: AdminChannelStateType
): Promise<Partial<AdminChannelStateType>> {
  try {
    const { context, detectedIntent, extractedEntities, userMessage } = state;

    // Edge case: context might be missing
    if (!context || !context.tenantId) {
      console.error(`${LOG_PREFIX} Missing context or tenantId`);
      return {
        response: '❌ Error de sesión. Por favor, reinicia la conversación.',
        shouldEnd: true,
        error: 'Missing context',
      };
    }

    // P0 Security: Validate tenantId before any operations
    validateUUID(context.tenantId, 'tenantId');

    // Verificar permisos
    if (!context.user.canConfigure) {
      return {
        response:
          '⚠️ No tienes permisos para modificar la configuración.\n\nContacta al administrador si necesitas realizar cambios.',
        shouldEnd: true,
      };
    }

    // Procesar según intent específico
    let result: ConfigHandlerResult;

    switch (detectedIntent) {
      case 'config_services':
        result = await handleServiceConfig(extractedEntities, userMessage, context.channel);
        break;
      case 'config_prices':
        result = await handlePriceConfig(extractedEntities, userMessage, context.channel);
        break;
      case 'config_hours':
        result = await handleHoursConfig(extractedEntities, userMessage, context.channel);
        break;
      case 'config_staff':
        result = await handleStaffConfig(extractedEntities, userMessage, context.channel);
        break;
      case 'config_ai_settings':
        result = handleAISettingsConfig(context.channel);
        break;
      case 'config_promotions':
        result = await handlePromotionConfig(extractedEntities, userMessage, context.channel);
        break;
      case 'config_notifications':
        result = handleNotificationConfig(context.channel);
        break;
      default:
        result = showConfigMenu(context.channel);
    }

    console.log(`${LOG_PREFIX} Processed ${detectedIntent}`);

    return {
      response: result.response,
      keyboard: result.keyboard,
      pendingAction: result.pendingAction,
      shouldEnd: result.shouldEnd,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return {
      response: '❌ Error procesando la configuración. Intenta de nuevo.',
      shouldEnd: true,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// =====================================================
// TYPES
// =====================================================

interface ConfigHandlerResult {
  response: string;
  keyboard?: Array<Array<{ text: string; callback_data: string }>> | null;
  pendingAction?: AdminPendingAction | null;
  shouldEnd: boolean;
}

// =====================================================
// HANDLER FUNCTIONS
// =====================================================

function showConfigMenu(channel: AdminChannelType): ConfigHandlerResult {
  const isTelegram = channel === 'telegram';

  const response = `${isTelegram ? '<b>⚙️ Menú de Configuración</b>' : '⚙️ Menú de Configuración'}\n\n` +
    `¿Qué te gustaría configurar?\n\n` +
    `• Servicios - agregar, editar o eliminar\n` +
    `• Precios - modificar tarifas\n` +
    `• Horarios - cambiar horas de operación\n` +
    `• Personal - gestionar equipo\n` +
    `• Promociones - crear descuentos\n` +
    `• Notificaciones - configurar alertas\n\n` +
    `Escribe lo que necesitas, por ejemplo:\n` +
    `"agregar servicio limpieza dental $500"`;

  const keyboard = isTelegram
    ? [
        [
          { text: '📋 Servicios', callback_data: 'config_services' },
          { text: '💰 Precios', callback_data: 'config_prices' },
        ],
        [
          { text: '🕐 Horarios', callback_data: 'config_hours' },
          { text: '👥 Personal', callback_data: 'config_staff' },
        ],
        [{ text: '🎁 Promociones', callback_data: 'config_promotions' }],
      ]
    : null;

  return { response, keyboard, shouldEnd: true };
}

async function handleServiceConfig(
  entities: Record<string, unknown>,
  userMessage: string,
  channel: AdminChannelType
): Promise<ConfigHandlerResult> {
  const isTelegram = channel === 'telegram';

  // Detectar acción del mensaje
  const lowerMessage = userMessage.toLowerCase();
  const isCreate = lowerMessage.includes('agregar') || lowerMessage.includes('nuevo');
  const isUpdate = lowerMessage.includes('modificar') || lowerMessage.includes('cambiar');
  const isDelete = lowerMessage.includes('eliminar') || lowerMessage.includes('quitar');

  if (isCreate) {
    // Extraer nombre y precio del mensaje (simplificado)
    const priceMatch = userMessage.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;

    if (!price) {
      return {
        response:
          '📋 Para agregar un servicio, necesito:\n\n' +
          '• Nombre del servicio\n' +
          '• Precio\n\n' +
          'Ejemplo: "agregar servicio Limpieza Dental $500"',
        shouldEnd: true,
      };
    }

    const pendingAction: AdminPendingAction = {
      type: 'confirm_create',
      entityType: 'service',
      data: {
        name: entities.serviceName || 'Nuevo Servicio',
        price,
        rawMessage: userMessage,
      },
      expiresAt: new Date(Date.now() + PENDING_ACTION_EXPIRY_MS),
    };

    const keyboard = isTelegram
      ? [
          [
            { text: '✅ Confirmar', callback_data: 'confirm_create_service' },
            { text: '❌ Cancelar', callback_data: 'cancel_action' },
          ],
        ]
      : null;

    return {
      response:
        `📋 Confirma la creación del servicio:\n\n` +
        `• Precio: $${price.toLocaleString()}\n\n` +
        `¿Deseas crear este servicio?`,
      keyboard,
      pendingAction,
      shouldEnd: false, // Esperamos confirmación
    };
  }

  // Mostrar menú de servicios
  return {
    response:
      `📋 Gestión de Servicios\n\n` +
      `¿Qué deseas hacer?\n\n` +
      `• "agregar servicio [nombre] $[precio]"\n` +
      `• "modificar precio de [servicio]"\n` +
      `• "eliminar servicio [nombre]"\n` +
      `• "ver lista de servicios"`,
    shouldEnd: true,
  };
}

async function handlePriceConfig(
  entities: Record<string, unknown>,
  userMessage: string,
  channel: AdminChannelType
): Promise<ConfigHandlerResult> {
  const isTelegram = channel === 'telegram';

  return {
    response:
      `💰 Modificación de Precios\n\n` +
      `Para cambiar un precio, escribe:\n` +
      `"cambiar precio de [servicio] a $[nuevo precio]"\n\n` +
      `Ejemplo: "cambiar precio de Limpieza Dental a $600"`,
    shouldEnd: true,
  };
}

async function handleHoursConfig(
  entities: Record<string, unknown>,
  userMessage: string,
  channel: AdminChannelType
): Promise<ConfigHandlerResult> {
  return {
    response:
      `🕐 Configuración de Horarios\n\n` +
      `Horarios actuales se mostrarían aquí.\n\n` +
      `Para modificar, escribe:\n` +
      `"cambiar horario de lunes a 9:00-18:00"\n` +
      `"cerrar los domingos"`,
    shouldEnd: true,
  };
}

async function handleStaffConfig(
  entities: Record<string, unknown>,
  userMessage: string,
  channel: AdminChannelType
): Promise<ConfigHandlerResult> {
  return {
    response:
      `👥 Gestión de Personal\n\n` +
      `• "agregar [nombre] como [rol]"\n` +
      `• "ver lista de personal"\n` +
      `• "asignar [nombre] a [servicio]"`,
    shouldEnd: true,
  };
}

function handleAISettingsConfig(channel: AdminChannelType): ConfigHandlerResult {
  return {
    response:
      `🤖 Configuración de IA\n\n` +
      `La configuración de IA se realiza desde el dashboard web.\n\n` +
      `Puedes ajustar:\n` +
      `• Tono de las respuestas\n` +
      `• Instrucciones personalizadas\n` +
      `• Respuestas automáticas\n\n` +
      `Ve a: Dashboard > Configuración > IA`,
    shouldEnd: true,
  };
}

async function handlePromotionConfig(
  entities: Record<string, unknown>,
  userMessage: string,
  channel: AdminChannelType
): Promise<ConfigHandlerResult> {
  const isTelegram = channel === 'telegram';

  return {
    response:
      `🎁 Gestión de Promociones\n\n` +
      `Para crear una promoción:\n` +
      `"crear promoción 20% descuento en [servicio]"\n` +
      `"promoción 2x1 en [servicio] hasta [fecha]"\n\n` +
      `Para ver activas:\n` +
      `"ver promociones activas"`,
    shouldEnd: true,
  };
}

function handleNotificationConfig(channel: AdminChannelType): ConfigHandlerResult {
  const isTelegram = channel === 'telegram';

  const keyboard = isTelegram
    ? [
        [
          { text: '⏸️ Pausar alertas', callback_data: 'pause_notifications' },
          { text: '▶️ Reanudar', callback_data: 'resume_notifications' },
        ],
        [{ text: '⚙️ Configurar horarios', callback_data: 'config_notification_hours' }],
      ]
    : null;

  return {
    response:
      `🔔 Configuración de Notificaciones\n\n` +
      `Alertas disponibles:\n` +
      `• Resumen diario (8:00 AM)\n` +
      `• Leads calientes\n` +
      `• Inventario bajo\n` +
      `• Escalaciones\n\n` +
      `¿Qué deseas hacer?\n` +
      `• "pausar alertas"\n` +
      `• "configurar horario de alertas"`,
    keyboard,
    shouldEnd: true,
  };
}

// configHandlerNode is already exported inline

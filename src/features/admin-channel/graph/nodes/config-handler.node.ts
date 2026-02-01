/**
 * TIS TIS PLATFORM - Admin Channel Config Handler
 *
 * Maneja solicitudes de configuración (servicios, precios, horarios).
 * Ejecuta operaciones REALES en la base de datos via ConfigService.
 *
 * CHANGELOG v4.9.1:
 * - Usa BusinessContext del estado para datos (servicios, sucursales, promociones)
 * - Fallback a ConfigService cuando no hay contexto cacheado
 * - Mejor rendimiento al evitar queries redundantes
 *
 * CHANGELOG v4.9.0:
 * - Integración con ConfigService para operaciones reales
 * - Respuestas con datos actualizados de Supabase
 *
 * @module admin-channel/graph/nodes/config-handler
 */

import type { AdminChannelStateType } from '../state';
import type {
  AdminPendingAction,
  AdminChannelType,
  AdminExecutedAction,
  AdminBusinessContext,
} from '../../types';
import { getConfigService } from '../../services/config.service';
import { validateUUID } from '../../utils/helpers';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Config]';

const PENDING_ACTION_EXPIRY_MS = 5 * 60 * 1000;

// =====================================================
// TYPES
// =====================================================

interface ConfigHandlerResult {
  response: string;
  keyboard?: Array<Array<{ text: string; callback_data: string }>> | null;
  pendingAction?: AdminPendingAction | null;
  executedActions?: AdminExecutedAction[];
  shouldEnd: boolean;
}

// =====================================================
// CONFIG HANDLER NODE
// =====================================================

export async function configHandlerNode(
  state: AdminChannelStateType
): Promise<Partial<AdminChannelStateType>> {
  try {
    const { context, detectedIntent, extractedEntities, userMessage } = state;

    if (!context || !context.tenantId) {
      console.error(`${LOG_PREFIX} Missing context or tenantId`);
      return {
        response: '❌ Error de sesión. Por favor, reinicia la conversación.',
        shouldEnd: true,
        error: 'Missing context',
      };
    }

    validateUUID(context.tenantId, 'tenantId');

    if (!context.user.canConfigure) {
      return {
        response:
          '⚠️ No tienes permisos para modificar la configuración.\n\nContacta al administrador si necesitas realizar cambios.',
        shouldEnd: true,
      };
    }

    let result: ConfigHandlerResult;
    const businessContext = context.businessContext;

    switch (detectedIntent) {
      case 'config_services':
        result = await handleServiceConfig(
          context.tenantId,
          extractedEntities,
          userMessage,
          context.channel,
          businessContext
        );
        break;
      case 'config_prices':
        result = await handlePriceConfig(
          context.tenantId,
          extractedEntities,
          userMessage,
          context.channel,
          businessContext
        );
        break;
      case 'config_hours':
        result = await handleHoursConfig(
          context.tenantId,
          extractedEntities,
          userMessage,
          context.channel,
          businessContext
        );
        break;
      case 'config_staff':
        result = await handleStaffConfig(context.tenantId, context.channel);
        break;
      case 'config_ai_settings':
        result = handleAISettingsConfig(context.channel);
        break;
      case 'config_promotions':
        result = await handlePromotionConfig(
          context.tenantId,
          extractedEntities,
          userMessage,
          context.channel,
          businessContext
        );
        break;
      case 'config_notifications':
        result = handleNotificationConfig(context.channel);
        break;
      default:
        result = await showConfigMenu(context.tenantId, context.channel, businessContext);
    }

    console.log(`${LOG_PREFIX} Processed ${detectedIntent}`);

    return {
      response: result.response,
      keyboard: result.keyboard,
      pendingAction: result.pendingAction,
      executedActions: result.executedActions || [],
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
// MENU
// =====================================================

async function showConfigMenu(
  tenantId: string,
  channel: AdminChannelType,
  businessContext: AdminBusinessContext | null
): Promise<ConfigHandlerResult> {
  const isTelegram = channel === 'telegram';

  // Usar contexto de negocio si está disponible, sino hacer query
  let servicesCount = 0;
  if (businessContext?.services) {
    servicesCount = businessContext.services.filter((s) => s.isActive).length;
  } else {
    const configService = getConfigService();
    const servicesResult = await configService.getServices(tenantId);
    servicesCount =
      servicesResult.success && servicesResult.data?.services
        ? (servicesResult.data.services as unknown[]).length
        : 0;
  }

  const response =
    `${isTelegram ? '<b>⚙️ Menú de Configuración</b>' : '*⚙️ Menú de Configuración*'}\n\n` +
    `Tienes ${servicesCount} servicios activos.\n\n` +
    `¿Qué te gustaría configurar?\n\n` +
    `• Servicios - agregar, editar o eliminar\n` +
    `• Precios - modificar tarifas\n` +
    `• Horarios - cambiar horas de operación\n` +
    `• Promociones - crear descuentos\n\n` +
    `Escribe lo que necesitas, por ejemplo:\n` +
    `"ver lista de servicios"\n` +
    `"cambiar precio de Limpieza a $600"`;

  const keyboard = isTelegram
    ? [
        [
          { text: '📋 Ver servicios', callback_data: 'list_services' },
          { text: '💰 Precios', callback_data: 'config_prices' },
        ],
        [
          { text: '🕐 Horarios', callback_data: 'config_hours' },
          { text: '🎁 Promociones', callback_data: 'config_promotions' },
        ],
      ]
    : null;

  return { response, keyboard, shouldEnd: true };
}

// =====================================================
// SERVICES HANDLER
// =====================================================

async function handleServiceConfig(
  tenantId: string,
  entities: Record<string, unknown>,
  userMessage: string,
  channel: AdminChannelType,
  businessContext: AdminBusinessContext | null
): Promise<ConfigHandlerResult> {
  const isTelegram = channel === 'telegram';
  const configService = getConfigService();
  const lowerMessage = userMessage.toLowerCase();

  // Ver lista de servicios
  if (lowerMessage.includes('ver') || lowerMessage.includes('lista') || lowerMessage.includes('mostrar')) {
    // Usar contexto de negocio si está disponible
    let services: Array<{ name: string; price: number; durationMinutes: number }>;

    if (businessContext?.services && businessContext.services.length > 0) {
      services = businessContext.services
        .filter((s) => s.isActive)
        .map((s) => ({
          name: s.name,
          price: s.price || 0,
          durationMinutes: s.durationMinutes || 60,
        }));
    } else {
      const result = await configService.getServices(tenantId);

      if (!result.success || !result.data?.services) {
        return {
          response: '❌ Error obteniendo servicios. Intenta de nuevo.',
          shouldEnd: true,
        };
      }

      services = (result.data.services as Array<{
        name: string;
        price: number;
        duration_minutes: number;
      }>).map((s) => ({
        name: s.name,
        price: s.price,
        durationMinutes: s.duration_minutes,
      }));
    }

    if (services.length === 0) {
      return {
        response:
          '📋 No tienes servicios configurados.\n\n' +
          'Para agregar uno:\n' +
          '"agregar servicio Consulta General $500"',
        shouldEnd: true,
      };
    }

    const serviceList = services
      .map((s, i) => `${i + 1}. ${s.name} - $${s.price.toLocaleString()} (${s.durationMinutes} min)`)
      .join('\n');

    return {
      response:
        `${isTelegram ? '<b>📋 Tus Servicios</b>' : '*📋 Tus Servicios*'}\n\n` +
        `${serviceList}\n\n` +
        `Para modificar:\n` +
        `• "cambiar precio de [nombre] a $[precio]"\n` +
        `• "eliminar servicio [nombre]"`,
      shouldEnd: true,
    };
  }

  // Agregar servicio
  const isCreate = lowerMessage.includes('agregar') || lowerMessage.includes('nuevo') || lowerMessage.includes('crear');
  if (isCreate) {
    const priceMatch = userMessage.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;

    // Extraer nombre (entre "servicio" y "$")
    const nameMatch = userMessage.match(/servicio\s+([^$]+)\s*\$/i);
    const serviceName = nameMatch ? nameMatch[1].trim() : (entities.serviceName as string) || null;

    if (!price || !serviceName) {
      return {
        response:
          '📋 Para agregar un servicio necesito:\n\n' +
          '• Nombre del servicio\n' +
          '• Precio\n\n' +
          'Ejemplo: "agregar servicio Limpieza Dental $500"',
        shouldEnd: true,
      };
    }

    // Crear el servicio directamente
    const createResult = await configService.upsertService(tenantId, {
      name: serviceName,
      price,
      duration: 60,
    });

    if (!createResult.success) {
      return {
        response: `❌ Error creando servicio: ${createResult.error}`,
        shouldEnd: true,
      };
    }

    const action: AdminExecutedAction = {
      type: 'create',
      entityType: 'service',
      entityId: createResult.entityId,
      success: true,
      executedAt: new Date(),
      resultData: { name: serviceName, price },
    };

    return {
      response:
        `✅ Servicio creado exitosamente:\n\n` +
        `• Nombre: ${serviceName}\n` +
        `• Precio: $${price.toLocaleString()}\n\n` +
        `El servicio ya está disponible para tus clientes.`,
      executedActions: [action],
      shouldEnd: true,
    };
  }

  // Eliminar servicio
  const isDelete = lowerMessage.includes('eliminar') || lowerMessage.includes('quitar') || lowerMessage.includes('borrar');
  if (isDelete) {
    return {
      response:
        '⚠️ Para eliminar un servicio, especifica el nombre exacto.\n\n' +
        'Ejemplo: "eliminar servicio Limpieza Dental"\n\n' +
        'Nota: El servicio no se borrará, solo se desactivará.',
      shouldEnd: true,
    };
  }

  // Menú de servicios
  return {
    response:
      `📋 Gestión de Servicios\n\n` +
      `¿Qué deseas hacer?\n\n` +
      `• "ver lista de servicios"\n` +
      `• "agregar servicio [nombre] $[precio]"\n` +
      `• "cambiar precio de [servicio] a $[precio]"\n` +
      `• "eliminar servicio [nombre]"`,
    shouldEnd: true,
  };
}

// =====================================================
// PRICES HANDLER
// =====================================================

async function handlePriceConfig(
  tenantId: string,
  entities: Record<string, unknown>,
  userMessage: string,
  channel: AdminChannelType,
  businessContext: AdminBusinessContext | null
): Promise<ConfigHandlerResult> {
  const configService = getConfigService();
  const lowerMessage = userMessage.toLowerCase();

  // Detectar cambio de precio
  const priceMatch = userMessage.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  const newPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;

  // Extraer nombre del servicio
  // Patrones: "precio de X a $Y" o "precio de X $Y" o "X a $Y"
  const serviceMatch =
    userMessage.match(/precio\s+de\s+([^$]+?)\s+(?:a\s+)?\$/i) ||
    userMessage.match(/cambiar\s+([^$]+?)\s+(?:a\s+)?\$/i);

  const serviceName = serviceMatch ? serviceMatch[1].trim() : (entities.serviceName as string) || null;

  if (!newPrice || !serviceName) {
    // Mostrar lista de servicios con precios actuales
    // Usar contexto de negocio si está disponible
    let services: Array<{ name: string; price: number }>;

    if (businessContext?.services && businessContext.services.length > 0) {
      services = businessContext.services
        .filter((s) => s.isActive)
        .map((s) => ({
          name: s.name,
          price: s.price || 0,
        }));
    } else {
      const result = await configService.getServices(tenantId);
      services = result.success && result.data?.services
        ? (result.data.services as Array<{ name: string; price: number }>)
        : [];
    }

    const priceList = services.length > 0
      ? services.map((s) => `• ${s.name}: $${s.price.toLocaleString()}`).join('\n')
      : 'No hay servicios configurados.';

    return {
      response:
        `💰 Precios Actuales\n\n` +
        `${priceList}\n\n` +
        `Para cambiar un precio:\n` +
        `"cambiar precio de [servicio] a $[nuevo precio]"\n\n` +
        `Ejemplo: "cambiar precio de Consulta a $600"`,
      shouldEnd: true,
    };
  }

  // Actualizar precio
  const updateResult = await configService.updatePrice(tenantId, serviceName, newPrice);

  if (!updateResult.success) {
    return {
      response: `❌ ${updateResult.error}`,
      shouldEnd: true,
    };
  }

  const previousPrice = updateResult.data?.previousPrice as number;
  const actualName = updateResult.data?.serviceName as string;

  const action: AdminExecutedAction = {
    type: 'update_price',
    entityType: 'service',
    entityId: updateResult.entityId,
    success: true,
    executedAt: new Date(),
    resultData: { serviceName: actualName, previousPrice, newPrice },
  };

  return {
    response:
      `✅ Precio actualizado:\n\n` +
      `• Servicio: ${actualName}\n` +
      `• Anterior: $${previousPrice.toLocaleString()}\n` +
      `• Nuevo: $${newPrice.toLocaleString()}\n\n` +
      `El nuevo precio ya está vigente.`,
    executedActions: [action],
    shouldEnd: true,
  };
}

// =====================================================
// HOURS HANDLER
// =====================================================

async function handleHoursConfig(
  tenantId: string,
  entities: Record<string, unknown>,
  userMessage: string,
  channel: AdminChannelType,
  businessContext: AdminBusinessContext | null
): Promise<ConfigHandlerResult> {
  const isTelegram = channel === 'telegram';
  const configService = getConfigService();
  const lowerMessage = userMessage.toLowerCase();

  // Detectar si quiere cambiar horario
  const dayMatch = lowerMessage.match(
    /(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i
  );
  const timeMatch = userMessage.match(/(\d{1,2}:\d{2})\s*[-a]\s*(\d{1,2}:\d{2})/);

  if (dayMatch && timeMatch) {
    const day = dayMatch[1];
    const openTime = timeMatch[1];
    const closeTime = timeMatch[2];

    const result = await configService.updateHours(tenantId, {
      day,
      openTime,
      closeTime,
      isClosed: false,
    });

    if (!result.success) {
      return {
        response: `❌ ${result.error}`,
        shouldEnd: true,
      };
    }

    const action: AdminExecutedAction = {
      type: 'update_hours',
      entityType: 'branch',
      success: true,
      executedAt: new Date(),
      resultData: { day, openTime, closeTime },
    };

    return {
      response:
        `✅ Horario actualizado:\n\n` +
        `• ${day.charAt(0).toUpperCase() + day.slice(1)}: ${openTime} - ${closeTime}\n\n` +
        `El nuevo horario ya está vigente.`,
      executedActions: [action],
      shouldEnd: true,
    };
  }

  // Detectar si quiere cerrar un día
  const closeMatch = lowerMessage.match(/cerrar\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i);
  if (closeMatch) {
    const day = closeMatch[1];

    const result = await configService.updateHours(tenantId, {
      day,
      openTime: '',
      closeTime: '',
      isClosed: true,
    });

    if (!result.success) {
      return {
        response: `❌ ${result.error}`,
        shouldEnd: true,
      };
    }

    return {
      response: `✅ Se cerró ${day}.\n\nYa no se mostrarán horarios para ese día.`,
      shouldEnd: true,
    };
  }

  // Mostrar horarios actuales
  // Usar contexto de negocio si está disponible (de branches.hours)
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayNamesLower = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  let hoursList = 'No hay horarios configurados.';

  // Intentar obtener horarios del business context primero
  if (businessContext?.branches && businessContext.branches.length > 0) {
    const mainBranch = businessContext.branches.find((b) => b.isMain) || businessContext.branches[0];
    if (mainBranch.hours && Object.keys(mainBranch.hours).length > 0) {
      hoursList = Object.entries(mainBranch.hours)
        .map(([day, h]) => {
          const dayIndex = dayNamesLower.indexOf(day.toLowerCase());
          const dayName = dayIndex >= 0 ? dayNames[dayIndex] : day;
          return `• ${dayName}: ${h.open} - ${h.close}`;
        })
        .join('\n');
    }
  } else {
    // Fallback a query
    const hoursResult = await configService.getHours(tenantId);
    if (hoursResult.success && hoursResult.data?.hours) {
      const hours = hoursResult.data.hours as Array<{
        day_of_week: number;
        open_time: string;
        close_time: string;
        is_closed: boolean;
      }>;

      if (hours.length > 0) {
        hoursList = hours
          .map((h) => {
            const dayName = dayNames[h.day_of_week];
            if (h.is_closed) return `• ${dayName}: Cerrado`;
            return `• ${dayName}: ${h.open_time} - ${h.close_time}`;
          })
          .join('\n');
      }
    }
  }

  return {
    response:
      `${isTelegram ? '<b>🕐 Horarios de Atención</b>' : '*🕐 Horarios de Atención*'}\n\n` +
      `${hoursList}\n\n` +
      `Para modificar:\n` +
      `• "cambiar lunes a 9:00-18:00"\n` +
      `• "cerrar domingo"`,
    shouldEnd: true,
  };
}

// =====================================================
// STAFF HANDLER
// =====================================================

async function handleStaffConfig(
  tenantId: string,
  channel: AdminChannelType
): Promise<ConfigHandlerResult> {
  return {
    response:
      `👥 Gestión de Personal\n\n` +
      `La gestión de personal se realiza desde el dashboard web.\n\n` +
      `Ve a: Dashboard > Configuración > Personal\n\n` +
      `Desde ahí puedes:\n` +
      `• Agregar empleados\n` +
      `• Asignar roles\n` +
      `• Configurar horarios por empleado`,
    shouldEnd: true,
  };
}

// =====================================================
// AI SETTINGS HANDLER
// =====================================================

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

// =====================================================
// PROMOTIONS HANDLER
// =====================================================

async function handlePromotionConfig(
  tenantId: string,
  entities: Record<string, unknown>,
  userMessage: string,
  channel: AdminChannelType,
  businessContext: AdminBusinessContext | null
): Promise<ConfigHandlerResult> {
  const isTelegram = channel === 'telegram';
  const configService = getConfigService();
  const lowerMessage = userMessage.toLowerCase();

  // Ver promociones activas
  if (lowerMessage.includes('ver') || lowerMessage.includes('activas') || lowerMessage.includes('lista')) {
    // Usar contexto de negocio si está disponible
    let promotions: Array<{
      title: string;
      discountType: string;
      discountValue: number;
      validTo: string | null;
    }>;

    if (businessContext?.promotions && businessContext.promotions.length > 0) {
      promotions = businessContext.promotions.map((p) => ({
        title: p.title,
        discountType: p.discountType,
        discountValue: p.discountValue,
        validTo: p.validTo,
      }));
    } else {
      const result = await configService.getActivePromotions(tenantId);

      if (!result.success || !result.data?.promotions) {
        return {
          response: '❌ Error obteniendo promociones.',
          shouldEnd: true,
        };
      }

      promotions = (result.data.promotions as Array<{
        name: string;
        discount_type: string;
        discount_value: number;
        end_date: string;
      }>).map((p) => ({
        title: p.name,
        discountType: p.discount_type,
        discountValue: p.discount_value,
        validTo: p.end_date,
      }));
    }

    if (promotions.length === 0) {
      return {
        response:
          `🎁 No hay promociones activas.\n\n` +
          `Para crear una:\n` +
          `"crear promoción 20% en Consulta"`,
        shouldEnd: true,
      };
    }

    const promoList = promotions
      .map((p) => {
        const discount =
          p.discountType === 'percentage'
            ? `${p.discountValue}%`
            : `$${p.discountValue}`;
        const until = p.validTo
          ? ` (hasta ${new Date(p.validTo).toLocaleDateString()})`
          : '';
        return `• ${p.title}: ${discount} OFF${until}`;
      })
      .join('\n');

    return {
      response:
        `${isTelegram ? '<b>🎁 Promociones Activas</b>' : '*🎁 Promociones Activas*'}\n\n` +
        `${promoList}`,
      shouldEnd: true,
    };
  }

  // Crear promoción
  if (lowerMessage.includes('crear') || lowerMessage.includes('nueva')) {
    const percentMatch = userMessage.match(/(\d+)\s*%/);
    const discount = percentMatch ? parseInt(percentMatch[1]) : null;

    if (!discount) {
      return {
        response:
          `🎁 Para crear una promoción:\n\n` +
          `"crear promoción 20% en [servicio]"\n` +
          `"crear promoción $100 de descuento"`,
        shouldEnd: true,
      };
    }

    const result = await configService.upsertPromotion(tenantId, {
      name: `Promoción ${discount}%`,
      discountType: 'percentage',
      discountValue: discount,
      startDate: new Date().toISOString(),
    });

    if (!result.success) {
      return {
        response: `❌ ${result.error}`,
        shouldEnd: true,
      };
    }

    return {
      response:
        `✅ Promoción creada:\n\n` +
        `• Descuento: ${discount}%\n` +
        `• Estado: Activa\n\n` +
        `La promoción ya está disponible.`,
      shouldEnd: true,
    };
  }

  return {
    response:
      `🎁 Gestión de Promociones\n\n` +
      `• "ver promociones activas"\n` +
      `• "crear promoción 20% en [servicio]"\n` +
      `• "terminar promoción [nombre]"`,
    shouldEnd: true,
  };
}

// =====================================================
// NOTIFICATIONS HANDLER
// =====================================================

function handleNotificationConfig(channel: AdminChannelType): ConfigHandlerResult {
  const isTelegram = channel === 'telegram';

  const keyboard = isTelegram
    ? [
        [
          { text: '⏸️ Pausar alertas', callback_data: 'notification_pause' },
          { text: '▶️ Reanudar', callback_data: 'notification_resume' },
        ],
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
      `• "reanudar alertas"`,
    keyboard,
    shouldEnd: true,
  };
}

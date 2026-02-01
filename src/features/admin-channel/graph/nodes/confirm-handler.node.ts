/**
 * TIS TIS PLATFORM - Admin Channel Confirm Handler
 *
 * Maneja confirmaciones de acciones pendientes.
 * Ejecuta la acción usando ConfigService si hay una pendiente.
 *
 * @module admin-channel/graph/nodes/confirm-handler
 */

import type { AdminChannelStateType } from '../state';
import type { AdminExecutedAction, AdminChannelType } from '../../types';
import { getConfigService } from '../../services/config.service';
import type { ServiceData, StaffData, PromotionData, HoursData } from '../../services/config.service';
import {
  validateUUID,
  extractString,
  extractNumber,
  extractBoolean,
} from '../../utils/helpers';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Confirm]';

// =====================================================
// CONFIRM HANDLER NODE
// =====================================================

export async function confirmHandlerNode(
  state: AdminChannelStateType
): Promise<Partial<AdminChannelStateType>> {
  const startTime = Date.now();

  try {
    const { pendingAction, context } = state;

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

    // No hay acción pendiente
    if (!pendingAction) {
      console.log(`${LOG_PREFIX} No pending action to confirm`);
      return {
        response: 'No hay ninguna acción pendiente de confirmar.\n\n¿Qué te gustaría hacer?',
        shouldEnd: true,
      };
    }

    // Verificar expiración (handle both Date object and ISO string from serialization)
    const expiresAt = pendingAction.expiresAt instanceof Date
      ? pendingAction.expiresAt
      : new Date(pendingAction.expiresAt);

    if (Number.isNaN(expiresAt.getTime())) {
      console.error(`${LOG_PREFIX} Invalid expiresAt date:`, pendingAction.expiresAt);
      return {
        response: '❌ Error de configuración. Por favor, vuelve a solicitar la acción.',
        pendingAction: null,
        shouldEnd: true,
      };
    }

    if (new Date() > expiresAt) {
      console.log(`${LOG_PREFIX} Pending action expired`);
      return {
        response: '⏰ La acción pendiente ha expirado.\n\nPor favor, vuelve a solicitar lo que necesitas.',
        pendingAction: null,
        shouldEnd: true,
      };
    }

    // Obtener ConfigService
    const configService = getConfigService();
    let result: { success: boolean; entityId?: string; error?: string };

    // Ejecutar según tipo de entidad
    switch (pendingAction.entityType) {
      case 'service':
        result = await executeServiceAction(
          configService,
          pendingAction.type,
          pendingAction.data,
          context.tenantId,
          pendingAction.entityId
        );
        break;

      case 'price':
        result = await executePriceAction(
          configService,
          pendingAction.data,
          context.tenantId
        );
        break;

      case 'hours':
        result = await executeHoursAction(
          configService,
          pendingAction.data,
          context.tenantId
        );
        break;

      case 'staff':
        result = await executeStaffAction(
          configService,
          pendingAction.type,
          pendingAction.data,
          context.tenantId,
          pendingAction.entityId
        );
        break;

      case 'promotion':
        result = await executePromotionAction(
          configService,
          pendingAction.type,
          pendingAction.data,
          context.tenantId,
          pendingAction.entityId
        );
        break;

      default:
        result = { success: false, error: 'Tipo de entidad no soportado' };
    }

    // Preparar respuesta
    const executedAction: AdminExecutedAction = {
      type: pendingAction.type,
      entityType: pendingAction.entityType,
      entityId: result.entityId || pendingAction.entityId,
      success: result.success,
      error: result.error,
      executedAt: new Date(),
    };

    let response: string;
    if (result.success) {
      response = getSuccessMessage(pendingAction.type, pendingAction.entityType, context.channel);
    } else {
      response = getErrorMessage(result.error || 'Error desconocido', context.channel);
    }

    console.log(`${LOG_PREFIX} Executed ${pendingAction.type} ${pendingAction.entityType} in ${Date.now() - startTime}ms: ${result.success}`);

    return {
      pendingAction: null,
      response,
      executedActions: [executedAction],
      shouldEnd: true,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return {
      response: '❌ Error ejecutando la acción. Intenta de nuevo.',
      pendingAction: null,
      shouldEnd: true,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// =====================================================
// ACTION EXECUTORS
// =====================================================

async function executeServiceAction(
  configService: ReturnType<typeof getConfigService>,
  actionType: string,
  data: Record<string, unknown>,
  tenantId: string,
  entityId?: string
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  if (actionType === 'confirm_delete' && entityId) {
    return configService.deleteService(tenantId, entityId);
  }

  // Create or Update - use type-safe extractors
  const name = extractString(data.name, 'Servicio sin nombre');
  const price = extractNumber(data.price, 0);

  // Validate required fields
  if (!name || name === 'Servicio sin nombre') {
    return { success: false, error: 'Falta el nombre del servicio' };
  }
  if (price <= 0) {
    return { success: false, error: 'El precio debe ser mayor a 0' };
  }

  const serviceData: ServiceData = {
    name,
    price,
    duration: data.duration !== undefined ? extractNumber(data.duration) : undefined,
    description: data.description !== undefined ? extractString(data.description) : undefined,
  };

  return configService.upsertService(
    tenantId,
    serviceData,
    actionType === 'confirm_update' ? entityId : undefined
  );
}

async function executePriceAction(
  configService: ReturnType<typeof getConfigService>,
  data: Record<string, unknown>,
  tenantId: string
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  // Use type-safe extractors with fallback to both naming conventions
  const serviceName = extractString(data.serviceName) || extractString(data.service_name);
  const newPrice = extractNumber(data.newPrice) || extractNumber(data.new_price);

  if (!serviceName) {
    return { success: false, error: 'Falta el nombre del servicio' };
  }
  if (newPrice <= 0) {
    return { success: false, error: 'El nuevo precio debe ser mayor a 0' };
  }

  return configService.updatePrice(tenantId, serviceName, newPrice);
}

async function executeHoursAction(
  configService: ReturnType<typeof getConfigService>,
  data: Record<string, unknown>,
  tenantId: string
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  // Use type-safe extractors
  const day = extractString(data.day);
  const openTime = extractString(data.openTime) || extractString(data.open_time);
  const closeTime = extractString(data.closeTime) || extractString(data.close_time);
  const isClosed = extractBoolean(data.isClosed) || extractBoolean(data.is_closed);

  if (!day) {
    return { success: false, error: 'Falta el día de la semana' };
  }
  if (!isClosed && (!openTime || !closeTime)) {
    return { success: false, error: 'Faltan horas de apertura o cierre' };
  }

  const hoursData: HoursData = {
    day,
    openTime: openTime || '09:00',
    closeTime: closeTime || '18:00',
    isClosed,
  };

  return configService.updateHours(tenantId, hoursData);
}

async function executeStaffAction(
  configService: ReturnType<typeof getConfigService>,
  actionType: string,
  data: Record<string, unknown>,
  tenantId: string,
  entityId?: string
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  if (actionType === 'confirm_delete' && entityId) {
    return configService.deleteStaff(tenantId, entityId);
  }

  // Use type-safe extractors
  const firstName = extractString(data.firstName) || extractString(data.first_name);

  if (!firstName) {
    return { success: false, error: 'Falta el nombre del empleado' };
  }

  const staffData: StaffData = {
    firstName,
    lastName: extractString(data.lastName) || extractString(data.last_name) || undefined,
    role: extractString(data.role) || undefined,
    email: extractString(data.email) || undefined,
    phone: extractString(data.phone) || undefined,
  };

  return configService.upsertStaff(
    tenantId,
    staffData,
    actionType === 'confirm_update' ? entityId : undefined
  );
}

async function executePromotionAction(
  configService: ReturnType<typeof getConfigService>,
  actionType: string,
  data: Record<string, unknown>,
  tenantId: string,
  entityId?: string
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  if (actionType === 'confirm_delete' && entityId) {
    return configService.deletePromotion(tenantId, entityId);
  }

  // Use type-safe extractors
  const name = extractString(data.name);
  const discountValue = extractNumber(data.discountValue) || extractNumber(data.discount_value);

  if (!name) {
    return { success: false, error: 'Falta el nombre de la promoción' };
  }
  if (discountValue <= 0) {
    return { success: false, error: 'El valor del descuento debe ser mayor a 0' };
  }

  // Extract discount type with validation
  const rawDiscountType = extractString(data.discountType) || extractString(data.discount_type);
  const discountType: 'percentage' | 'fixed' =
    rawDiscountType === 'fixed' ? 'fixed' : 'percentage';

  // Validate percentage is not greater than 100
  if (discountType === 'percentage' && discountValue > 100) {
    return { success: false, error: 'El porcentaje de descuento no puede ser mayor a 100' };
  }

  const promotionData: PromotionData = {
    name,
    description: extractString(data.description) || undefined,
    discountType,
    discountValue,
    startDate: extractString(data.startDate) || extractString(data.start_date) || undefined,
    endDate: extractString(data.endDate) || extractString(data.end_date) || undefined,
  };

  return configService.upsertPromotion(
    tenantId,
    promotionData,
    actionType === 'confirm_update' ? entityId : undefined
  );
}

// =====================================================
// RESPONSE HELPERS
// =====================================================

function getSuccessMessage(
  actionType: string,
  entityType: string,
  channel: AdminChannelType
): string {
  const entityLabels: Record<string, string> = {
    service: 'Servicio',
    price: 'Precio',
    hours: 'Horario',
    staff: 'Empleado',
    promotion: 'Promoción',
  };

  const actionLabels: Record<string, string> = {
    confirm_create: 'creado',
    confirm_update: 'actualizado',
    confirm_delete: 'eliminado',
  };

  const entity = entityLabels[entityType] || entityType;
  const action = actionLabels[actionType] || 'procesado';

  const message = `✅ ${entity} ${action} correctamente.`;

  if (channel === 'telegram') {
    return `<b>${message}</b>\n\nLos cambios ya están activos.\n\n¿Necesitas algo más?`;
  }

  return `*${message}*\n\nLos cambios ya están activos.\n\n¿Necesitas algo más?`;
}

function getErrorMessage(error: string, channel: AdminChannelType): string {
  if (channel === 'telegram') {
    return `❌ <b>Error:</b> ${error}\n\nIntenta de nuevo o contacta soporte.`;
  }

  return `❌ *Error:* ${error}\n\nIntenta de nuevo o contacta soporte.`;
}

// Export inline

/**
 * TIS TIS PLATFORM - Admin Channel Cancel Handler
 *
 * Maneja cancelaciones de acciones pendientes.
 * Limpia el estado y confirma la cancelación.
 *
 * @module admin-channel/graph/nodes/cancel-handler
 */

import type { AdminChannelStateType } from '../state';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Cancel]';

// =====================================================
// CANCEL HANDLER NODE
// =====================================================

export async function cancelHandlerNode(
  state: AdminChannelStateType
): Promise<Partial<AdminChannelStateType>> {
  try {
    const { pendingAction } = state;

    // No hay acción pendiente
    if (!pendingAction) {
      console.log(`${LOG_PREFIX} No pending action to cancel`);
      return {
        response:
          'No hay ninguna acción pendiente que cancelar.\n\n¿En qué más puedo ayudarte?',
        shouldEnd: true,
      };
    }

    // Generar mensaje según tipo de acción cancelada
    const cancelMessage = generateCancelMessage(
      pendingAction.type,
      pendingAction.entityType
    );

    console.log(
      `${LOG_PREFIX} Cancelled ${pendingAction.type} for ${pendingAction.entityType}`
    );

    return {
      response: cancelMessage,
      pendingAction: null, // Limpiar acción pendiente
      shouldEnd: true,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return {
      response: 'Operación cancelada.\n\n¿En qué más puedo ayudarte?',
      pendingAction: null,
      shouldEnd: true,
    };
  }
}

// =====================================================
// MESSAGE GENERATION
// =====================================================

export function generateCancelMessage(type: string, entityType: string): string {
  const entityNames: Record<string, string> = {
    service: 'del servicio',
    price: 'del precio',
    hours: 'de los horarios',
    staff: 'del personal',
    promotion: 'de la promoción',
    notification: 'de la notificación',
    other: 'de la operación',
  };

  const entityName = entityNames[entityType] || 'de la operación';

  const typeMessages: Record<string, string> = {
    confirm_create: `Creación ${entityName} cancelada.`,
    confirm_update: `Actualización ${entityName} cancelada.`,
    confirm_delete: `Eliminación ${entityName} cancelada.`,
    select_option: 'Selección cancelada.',
  };

  const message = typeMessages[type] || 'Operación cancelada.';

  return `✅ ${message}\n\nNo se realizaron cambios.\n\n¿En qué más puedo ayudarte?`;
}

// Exports are inline (export function)

// =====================================================
// TIS TIS PLATFORM - Notification Configuration by Vertical
// Multi-vertical notification options
// =====================================================

import type { VerticalType } from './verticals';
import type { NotificationPreferences } from '@/src/features/settings';

// ======================
// TYPES
// ======================

export interface NotificationOption {
  label: string;
  desc: string;
  key: keyof NotificationPreferences;
}

// ======================
// NOTIFICATION OPTIONS BY VERTICAL
// ======================

/**
 * Configuración de notificaciones específicas por vertical.
 *
 * Las keys deben coincidir con las columnas en notification_preferences:
 * - notify_lead_hot
 * - notify_appointment_created
 * - notify_appointment_cancelled
 * - notify_conversation_escalated
 *
 * Futuras keys para restaurant (requieren migración):
 * - notify_reservation_created
 * - notify_order_received
 * - notify_low_stock
 * - notify_sr_sale_processed
 */

// Notificaciones comunes a todas las verticales
const COMMON_NOTIFICATIONS: NotificationOption[] = [
  {
    label: 'Leads Calientes',
    desc: 'Notificación inmediata cuando llegue un lead HOT',
    key: 'notify_lead_hot',
  },
  {
    label: 'Escalaciones AI',
    desc: 'Cuando el asistente escale una conversación',
    key: 'notify_conversation_escalated',
  },
];

// Notificaciones específicas por vertical
const VERTICAL_SPECIFIC_NOTIFICATIONS: Record<VerticalType, NotificationOption[]> = {
  dental: [
    {
      label: 'Nuevas Citas',
      desc: 'Cuando se agende una nueva cita',
      key: 'notify_appointment_created',
    },
    {
      label: 'Cancelaciones',
      desc: 'Alertar sobre citas canceladas',
      key: 'notify_appointment_cancelled',
    },
  ],

  clinic: [
    {
      label: 'Nuevas Consultas',
      desc: 'Cuando se agende una nueva consulta',
      key: 'notify_appointment_created',
    },
    {
      label: 'Cancelaciones',
      desc: 'Alertar sobre consultas canceladas',
      key: 'notify_appointment_cancelled',
    },
  ],

  restaurant: [
    {
      label: 'Nuevas Reservaciones',
      desc: 'Cuando se realice una nueva reservación',
      key: 'notify_appointment_created', // Reutiliza appointment_created para reservaciones
    },
    {
      label: 'Cancelaciones',
      desc: 'Alertar sobre reservaciones canceladas',
      key: 'notify_appointment_cancelled',
    },
    // TODO FASE 4: Agregar cuando se implemente migración:
    // {
    //   label: 'Pedidos Nuevos',
    //   desc: 'Notificación cuando llegue un nuevo pedido',
    //   key: 'notify_order_received',
    // },
    // {
    //   label: 'Stock Bajo',
    //   desc: 'Alerta cuando un producto esté por agotarse',
    //   key: 'notify_low_stock',
    // },
    // {
    //   label: 'Ventas SR Procesadas',
    //   desc: 'Confirmación cuando una venta de Soft Restaurant se procese',
    //   key: 'notify_sr_sale_processed',
    // },
  ],

  gym: [
    {
      label: 'Nuevas Clases',
      desc: 'Cuando se registre un miembro a una clase',
      key: 'notify_appointment_created',
    },
    {
      label: 'Cancelaciones',
      desc: 'Alertar sobre cancelaciones de clases',
      key: 'notify_appointment_cancelled',
    },
  ],

  beauty: [
    {
      label: 'Nuevas Citas',
      desc: 'Cuando se agende una nueva cita',
      key: 'notify_appointment_created',
    },
    {
      label: 'Cancelaciones',
      desc: 'Alertar sobre citas canceladas',
      key: 'notify_appointment_cancelled',
    },
  ],

  veterinary: [
    {
      label: 'Nuevas Consultas',
      desc: 'Cuando se agende una nueva consulta',
      key: 'notify_appointment_created',
    },
    {
      label: 'Cancelaciones',
      desc: 'Alertar sobre consultas canceladas',
      key: 'notify_appointment_cancelled',
    },
  ],
};

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Obtiene las opciones de notificación para una vertical específica.
 * Combina las notificaciones comunes con las específicas de la vertical.
 *
 * @param vertical - El tipo de vertical del tenant
 * @returns Array de opciones de notificación
 */
export function getNotificationOptionsForVertical(
  vertical: VerticalType | string | undefined | null
): NotificationOption[] {
  // Normalize vertical to lowercase and default to dental if not specified
  const normalizedVertical = vertical?.toLowerCase() as VerticalType;
  const verticalKey = normalizedVertical || 'dental';

  // Get vertical-specific notifications, fallback to dental
  const verticalNotifications =
    VERTICAL_SPECIFIC_NOTIFICATIONS[verticalKey] ||
    VERTICAL_SPECIFIC_NOTIFICATIONS.dental;

  // Combine: common first, then vertical-specific
  return [...COMMON_NOTIFICATIONS, ...verticalNotifications];
}

/**
 * Obtiene las opciones de notificación comunes (disponibles para todas las verticales)
 */
export function getCommonNotificationOptions(): NotificationOption[] {
  return COMMON_NOTIFICATIONS;
}

/**
 * Obtiene solo las opciones de notificación específicas de una vertical
 */
export function getVerticalSpecificNotificationOptions(
  vertical: VerticalType | string | undefined | null
): NotificationOption[] {
  // Normalize vertical to lowercase
  const normalizedVertical = vertical?.toLowerCase() as VerticalType;
  const verticalKey = normalizedVertical || 'dental';
  return VERTICAL_SPECIFIC_NOTIFICATIONS[verticalKey] || VERTICAL_SPECIFIC_NOTIFICATIONS.dental;
}

// ======================
// EXPORTS
// ======================

export { COMMON_NOTIFICATIONS, VERTICAL_SPECIFIC_NOTIFICATIONS };

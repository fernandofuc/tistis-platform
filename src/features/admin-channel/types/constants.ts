/**
 * TIS TIS PLATFORM - Admin Channel Constants
 *
 * Constantes, configuraciones y metadata para el Admin Channel System.
 * Incluye keywords para deteccion de intents y configuraciones por defecto.
 *
 * @module admin-channel/types/constants
 */

import type {
  AdminIntent,
  AdminUserStatus,
  AdminNotificationType,
  AdminNotificationPriority,
  AdminAuditCategory,
  AdminChannelType,
} from './application.types';

import type { AdminChannelErrorCode } from './api.types';

// =====================================================
// RATE LIMITING CONSTANTS
// =====================================================

/** Mensajes maximos por hora */
export const MAX_MESSAGES_PER_HOUR = 30;

/** Mensajes maximos por dia */
export const MAX_MESSAGES_PER_DAY = 100;

/** Duracion del codigo de vinculacion en minutos */
export const LINK_CODE_EXPIRATION_MINUTES = 15;

/** Longitud del codigo de vinculacion */
export const LINK_CODE_LENGTH = 6;

// =====================================================
// INTENT DETECTION KEYWORDS
// =====================================================

/**
 * Palabras clave para detectar intents.
 * Organizadas por intent para facil mantenimiento.
 */
export const INTENT_KEYWORDS: Record<AdminIntent, string[]> = {
  // Analytics
  analytics_daily_summary: [
    'resumen',
    'resumen del dia',
    'como vamos hoy',
    'reporte diario',
    'estadisticas hoy',
    'metricas',
    'numeros de hoy',
  ],
  analytics_weekly_summary: [
    'resumen semanal',
    'esta semana',
    'reporte de la semana',
    'metricas semanales',
    'como fue la semana',
  ],
  analytics_monthly_summary: [
    'resumen mensual',
    'este mes',
    'reporte del mes',
    'metricas mensuales',
    'como fue el mes',
  ],
  analytics_sales: [
    'ventas',
    'cuanto vendimos',
    'ingresos',
    'facturacion',
    'revenue',
    'dinero',
    'ganancias',
  ],
  analytics_leads: [
    'leads',
    'prospectos',
    'nuevos clientes',
    'contactos nuevos',
    'interesados',
    'cuantos leads',
  ],
  analytics_orders: ['pedidos', 'ordenes', 'cuantos pedidos', 'ordenes de hoy', 'comandas'],
  analytics_inventory: [
    'inventario',
    'stock',
    'existencias',
    'que hay en almacen',
    'productos disponibles',
  ],
  analytics_ai_performance: [
    'rendimiento ia',
    'como va el bot',
    'eficiencia del asistente',
    'metricas ia',
    'escalaciones',
  ],
  analytics_appointments: [
    'citas',
    'citas de hoy',
    'agenda',
    'cuantas citas',
    'reservaciones',
    'appointments',
  ],
  analytics_revenue: [
    'ingresos',
    'revenue',
    'facturado',
    'cobrado',
    'total vendido',
    'dinero generado',
  ],

  // Configuration
  config_services: [
    'servicios',
    'cambiar servicio',
    'agregar servicio',
    'editar servicio',
    'lista de servicios',
    'menu',
  ],
  config_prices: [
    'precios',
    'cambiar precio',
    'actualizar precio',
    'cuanto cuesta',
    'tarifa',
    'costo',
  ],
  config_hours: [
    'horarios',
    'cambiar horario',
    'horario de atencion',
    'abrir',
    'cerrar',
    'dias de trabajo',
  ],
  config_staff: [
    'personal',
    'empleados',
    'staff',
    'equipo',
    'agregar empleado',
    'doctores',
    'especialistas',
  ],
  config_ai_settings: [
    'configurar ia',
    'ajustar bot',
    'tono del asistente',
    'personalizar respuestas',
    'configuracion ia',
  ],
  config_promotions: [
    'promociones',
    'ofertas',
    'descuentos',
    'crear promocion',
    'activar oferta',
    'especiales',
  ],
  config_notifications: [
    'configurar alertas',
    'notificaciones',
    'cuando avisar',
    'alertas',
    'avisos',
  ],

  // Operations
  operation_inventory_check: [
    'revisar inventario',
    'que falta',
    'productos bajos',
    'stock bajo',
    'reordenar',
    'pedir mas',
  ],
  operation_pending_orders: [
    'pedidos pendientes',
    'ordenes sin completar',
    'que falta entregar',
    'pendientes',
  ],
  operation_escalations: [
    'escalaciones',
    'problemas',
    'quejas',
    'reclamos',
    'clientes molestos',
    'urgente',
  ],
  operation_appointments_today: [
    'citas de hoy',
    'agenda de hoy',
    'quien viene hoy',
    'pacientes de hoy',
    'reservas de hoy',
  ],
  operation_pending_leads: [
    'leads sin atender',
    'leads pendientes',
    'prospectos sin contactar',
    'seguimiento',
  ],

  // Notifications
  notification_settings: [
    'configurar alertas',
    'que me avises',
    'tipos de alertas',
    'preferencias de notificacion',
  ],
  notification_pause: [
    'pausar alertas',
    'no molestar',
    'silenciar',
    'desactivar notificaciones',
    'parar alertas',
  ],
  notification_resume: [
    'reanudar alertas',
    'activar notificaciones',
    'volver a avisar',
    'reactivar',
  ],
  notification_test: [
    'probar alerta',
    'test notificacion',
    'enviar prueba',
    'verificar alertas',
  ],

  // Meta
  help: [
    'ayuda',
    'help',
    'que puedo hacer',
    'comandos',
    'opciones',
    'como funciona',
    'instrucciones',
  ],
  greeting: [
    'hola',
    'buenos dias',
    'buenas tardes',
    'buenas noches',
    'hi',
    'hey',
    'que tal',
    'como estas',
  ],
  confirm: ['si', 'confirmo', 'ok', 'dale', 'adelante', 'acepto', 'correcto', 'perfecto', 'listo'],
  cancel: ['no', 'cancelar', 'anular', 'no quiero', 'olvidalo', 'nada', 'mejor no'],
  unknown: [],
};

// =====================================================
// STATUS METADATA
// =====================================================

/**
 * Metadata para estados de usuario
 */
export const USER_STATUS_META: Record<
  AdminUserStatus,
  {
    label: string;
    description: string;
    color: string;
    canSendMessages: boolean;
    canReceiveNotifications: boolean;
  }
> = {
  pending: {
    label: 'Pendiente',
    description: 'Esperando vinculacion de cuenta',
    color: 'yellow',
    canSendMessages: false,
    canReceiveNotifications: false,
  },
  active: {
    label: 'Activo',
    description: 'Usuario activo y funcionando normalmente',
    color: 'green',
    canSendMessages: true,
    canReceiveNotifications: true,
  },
  suspended: {
    label: 'Suspendido',
    description: 'Cuenta suspendida temporalmente',
    color: 'orange',
    canSendMessages: false,
    canReceiveNotifications: true,
  },
  blocked: {
    label: 'Bloqueado',
    description: 'Cuenta bloqueada permanentemente',
    color: 'red',
    canSendMessages: false,
    canReceiveNotifications: false,
  },
};

// =====================================================
// NOTIFICATION TYPE METADATA
// =====================================================

/**
 * Metadata para tipos de notificacion
 */
export const NOTIFICATION_TYPE_META: Record<
  AdminNotificationType,
  {
    label: string;
    description: string;
    icon: string;
    defaultPriority: AdminNotificationPriority;
    isScheduled: boolean;
  }
> = {
  daily_summary: {
    label: 'Resumen Diario',
    description: 'Resumen automatico al final del dia',
    icon: 'calendar-day',
    defaultPriority: 'normal',
    isScheduled: true,
  },
  weekly_digest: {
    label: 'Digest Semanal',
    description: 'Resumen semanal de metricas',
    icon: 'calendar-week',
    defaultPriority: 'normal',
    isScheduled: true,
  },
  monthly_report: {
    label: 'Reporte Mensual',
    description: 'Reporte completo del mes',
    icon: 'calendar-month',
    defaultPriority: 'normal',
    isScheduled: true,
  },
  low_inventory: {
    label: 'Inventario Bajo',
    description: 'Alerta cuando un producto esta por agotarse',
    icon: 'box-warning',
    defaultPriority: 'high',
    isScheduled: false,
  },
  hot_lead: {
    label: 'Lead Caliente',
    description: 'Un prospecto con alta probabilidad de conversion',
    icon: 'fire',
    defaultPriority: 'high',
    isScheduled: false,
  },
  escalation: {
    label: 'Escalacion',
    description: 'Un cliente requiere atencion humana',
    icon: 'alert-triangle',
    defaultPriority: 'urgent',
    isScheduled: false,
  },
  appointment_reminder: {
    label: 'Recordatorio de Cita',
    description: 'Recordatorio de citas proximas',
    icon: 'clock',
    defaultPriority: 'normal',
    isScheduled: true,
  },
  payment_received: {
    label: 'Pago Recibido',
    description: 'Notificacion de pago procesado',
    icon: 'credit-card',
    defaultPriority: 'normal',
    isScheduled: false,
  },
  custom: {
    label: 'Personalizada',
    description: 'Notificacion personalizada',
    icon: 'bell',
    defaultPriority: 'normal',
    isScheduled: false,
  },
};

// =====================================================
// PRIORITY METADATA
// =====================================================

/**
 * Metadata para prioridades de notificacion
 */
export const NOTIFICATION_PRIORITY_META: Record<
  AdminNotificationPriority,
  {
    label: string;
    description: string;
    color: string;
    sortOrder: number;
    bypassQuietHours: boolean;
  }
> = {
  low: {
    label: 'Baja',
    description: 'Informativo, puede esperar',
    color: 'gray',
    sortOrder: 1,
    bypassQuietHours: false,
  },
  normal: {
    label: 'Normal',
    description: 'Prioridad estandar',
    color: 'blue',
    sortOrder: 2,
    bypassQuietHours: false,
  },
  high: {
    label: 'Alta',
    description: 'Requiere atencion pronto',
    color: 'orange',
    sortOrder: 3,
    bypassQuietHours: false,
  },
  urgent: {
    label: 'Urgente',
    description: 'Requiere atencion inmediata',
    color: 'red',
    sortOrder: 4,
    bypassQuietHours: true,
  },
};

// =====================================================
// AUDIT CATEGORY METADATA
// =====================================================

/**
 * Metadata para categorias de auditoria
 */
export const AUDIT_CATEGORY_META: Record<
  AdminAuditCategory,
  {
    label: string;
    description: string;
    icon: string;
  }
> = {
  auth: {
    label: 'Autenticacion',
    description: 'Vinculacion y autenticacion de cuentas',
    icon: 'key',
  },
  analytics: {
    label: 'Analytics',
    description: 'Consultas de metricas y reportes',
    icon: 'chart-bar',
  },
  config: {
    label: 'Configuracion',
    description: 'Cambios en servicios, precios, horarios',
    icon: 'cog',
  },
  notification: {
    label: 'Notificaciones',
    description: 'Envio y configuracion de alertas',
    icon: 'bell',
  },
  system: {
    label: 'Sistema',
    description: 'Eventos del sistema y errores',
    icon: 'server',
  },
};

// =====================================================
// CHANNEL METADATA
// =====================================================

/**
 * Metadata para tipos de canal
 */
export const CHANNEL_META: Record<
  AdminChannelType,
  {
    label: string;
    icon: string;
    color: string;
    maxMessageLength: number;
    supportsButtons: boolean;
    supportsLists: boolean;
  }
> = {
  whatsapp: {
    label: 'WhatsApp',
    icon: 'whatsapp',
    color: '#25D366',
    maxMessageLength: 4096,
    supportsButtons: true,
    supportsLists: true,
  },
  telegram: {
    label: 'Telegram',
    icon: 'telegram',
    color: '#0088cc',
    maxMessageLength: 4096,
    supportsButtons: true,
    supportsLists: false,
  },
};

// =====================================================
// ERROR METADATA
// =====================================================

/**
 * Metadata para codigos de error
 */
export const ERROR_META: Record<
  AdminChannelErrorCode,
  {
    message: string;
    httpStatus: number;
    retryable: boolean;
  }
> = {
  INVALID_LINK_CODE: {
    message: 'El codigo de vinculacion es invalido',
    httpStatus: 400,
    retryable: false,
  },
  LINK_CODE_EXPIRED: {
    message: 'El codigo de vinculacion ha expirado',
    httpStatus: 400,
    retryable: false,
  },
  USER_NOT_FOUND: {
    message: 'Usuario no encontrado',
    httpStatus: 404,
    retryable: false,
  },
  USER_NOT_ACTIVE: {
    message: 'La cuenta no esta activa',
    httpStatus: 403,
    retryable: false,
  },
  USER_BLOCKED: {
    message: 'La cuenta ha sido bloqueada',
    httpStatus: 403,
    retryable: false,
  },
  USER_SUSPENDED: {
    message: 'La cuenta esta suspendida temporalmente',
    httpStatus: 403,
    retryable: true,
  },
  RATE_LIMIT_EXCEEDED: {
    message: 'Has excedido el limite de mensajes',
    httpStatus: 429,
    retryable: true,
  },
  INVALID_CHANNEL: {
    message: 'Canal de comunicacion invalido',
    httpStatus: 400,
    retryable: false,
  },
  PERMISSION_DENIED: {
    message: 'No tienes permisos para esta accion',
    httpStatus: 403,
    retryable: false,
  },
  TENANT_NOT_FOUND: {
    message: 'Negocio no encontrado',
    httpStatus: 404,
    retryable: false,
  },
  CONVERSATION_NOT_FOUND: {
    message: 'Conversacion no encontrada',
    httpStatus: 404,
    retryable: false,
  },
  MESSAGE_DELIVERY_FAILED: {
    message: 'Error al enviar mensaje',
    httpStatus: 502,
    retryable: true,
  },
  AI_PROCESSING_ERROR: {
    message: 'Error procesando con IA',
    httpStatus: 500,
    retryable: true,
  },
  NOTIFICATION_FAILED: {
    message: 'Error al enviar notificacion',
    httpStatus: 502,
    retryable: true,
  },
  INVALID_REQUEST: {
    message: 'Solicitud invalida',
    httpStatus: 400,
    retryable: false,
  },
  INTERNAL_ERROR: {
    message: 'Error interno del servidor',
    httpStatus: 500,
    retryable: true,
  },
};

// =====================================================
// INTENT METADATA (for UI display)
// =====================================================

/**
 * Metadata para intents (agrupados por categoria)
 */
export const INTENT_CATEGORIES = {
  analytics: [
    'analytics_daily_summary',
    'analytics_weekly_summary',
    'analytics_monthly_summary',
    'analytics_sales',
    'analytics_leads',
    'analytics_orders',
    'analytics_inventory',
    'analytics_ai_performance',
    'analytics_appointments',
    'analytics_revenue',
  ],
  config: [
    'config_services',
    'config_prices',
    'config_hours',
    'config_staff',
    'config_ai_settings',
    'config_promotions',
    'config_notifications',
  ],
  operations: [
    'operation_inventory_check',
    'operation_pending_orders',
    'operation_escalations',
    'operation_appointments_today',
    'operation_pending_leads',
  ],
  notifications: [
    'notification_settings',
    'notification_pause',
    'notification_resume',
    'notification_test',
  ],
  meta: ['help', 'greeting', 'confirm', 'cancel', 'unknown'],
} as const;

// =====================================================
// DEFAULT VALUES
// =====================================================

/**
 * Valores por defecto para nuevos usuarios
 */
export const DEFAULT_USER_VALUES = {
  preferredLanguage: 'es',
  notificationHoursStart: 8,
  notificationHoursEnd: 22,
  timezone: 'America/Mexico_City',
  canViewAnalytics: true,
  canConfigure: true,
  canReceiveNotifications: true,
} as const;

/**
 * Timezones soportados
 */
export const SUPPORTED_TIMEZONES = [
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
] as const;

/**
 * Idiomas soportados
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'es', label: 'Espanol' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Portugues' },
] as const;

/**
 * TIS TIS PLATFORM - Admin Channel Application Types
 *
 * Tipos de aplicacion (camelCase) para uso en componentes y servicios.
 * Estos tipos se convierten desde/hacia DB Row types usando converters.
 *
 * @module admin-channel/types/application
 */

// =====================================================
// ENUMS (re-exported with cleaner names)
// =====================================================

/** Tipo de canal de comunicacion */
export type AdminChannelType = 'whatsapp' | 'telegram';

/** Estado del usuario en el sistema */
export type AdminUserStatus = 'pending' | 'active' | 'suspended' | 'blocked';

/** Estado de la conversacion */
export type AdminConversationStatus = 'active' | 'resolved' | 'archived';

/** Rol del mensaje */
export type AdminMessageRole = 'user' | 'assistant' | 'system';

/** Estado de entrega del mensaje */
export type AdminMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Tipo de notificacion */
export type AdminNotificationType =
  | 'daily_summary'
  | 'weekly_digest'
  | 'monthly_report'
  | 'low_inventory'
  | 'hot_lead'
  | 'escalation'
  | 'appointment_reminder'
  | 'payment_received'
  | 'custom';

/** Prioridad de notificacion */
export type AdminNotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Categoria de auditoria */
export type AdminAuditCategory = 'auth' | 'analytics' | 'config' | 'notification' | 'system';

/** Tipo de contenido */
export type AdminContentType = 'text' | 'image' | 'document' | 'template';

// =====================================================
// INTENTS (Admin Channel specific)
// =====================================================

/**
 * Intents detectables por el sistema de IA del Admin Channel.
 * Organizados por categoria funcional.
 */
export type AdminIntent =
  // Analytics - Consultas de metricas y reportes
  | 'analytics_daily_summary'
  | 'analytics_weekly_summary'
  | 'analytics_monthly_summary'
  | 'analytics_sales'
  | 'analytics_leads'
  | 'analytics_orders'
  | 'analytics_inventory'
  | 'analytics_ai_performance'
  | 'analytics_appointments'
  | 'analytics_revenue'
  // Configuration - Cambios de configuracion
  | 'config_services'
  | 'config_prices'
  | 'config_hours'
  | 'config_staff'
  | 'config_ai_settings'
  | 'config_promotions'
  | 'config_notifications'
  // Operations - Acciones operativas
  | 'operation_inventory_check'
  | 'operation_pending_orders'
  | 'operation_escalations'
  | 'operation_appointments_today'
  | 'operation_pending_leads'
  // Notifications - Gestion de alertas
  | 'notification_settings'
  | 'notification_pause'
  | 'notification_resume'
  | 'notification_test'
  // Meta - Comandos de control
  | 'help'
  | 'greeting'
  | 'confirm'
  | 'cancel'
  | 'unknown';

// =====================================================
// APPLICATION TYPES (camelCase)
// =====================================================

/**
 * Usuario del canal admin con propiedades camelCase.
 * Representa un cliente B2B vinculado via WhatsApp/Telegram.
 */
export interface AdminChannelUser {
  id: string;
  tenantId: string;
  staffId: string | null;

  // Identificadores de canal
  phoneNormalized: string | null;
  telegramUserId: string | null;
  telegramUsername: string | null;

  // Estado
  status: AdminUserStatus;

  // Vinculacion
  linkCode: string | null;
  linkCodeExpiresAt: Date | null;
  linkedAt: Date | null;

  // Permisos
  canViewAnalytics: boolean;
  canConfigure: boolean;
  canReceiveNotifications: boolean;

  // Rate limiting
  messagesToday: number;
  messagesThisHour: number;
  lastMessageAt: Date | null;
  rateLimitResetAt: Date | null;

  // Preferencias
  preferredLanguage: string;
  notificationHoursStart: number;
  notificationHoursEnd: number;
  timezone: string;

  // Metadata
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Conversacion del canal admin con contexto de LangGraph.
 */
export interface AdminChannelConversation {
  id: string;
  tenantId: string;
  userId: string;

  // Canal
  channel: AdminChannelType;
  channelConversationId: string | null;

  // Estado
  status: AdminConversationStatus;

  // Contexto LangGraph
  currentIntent: AdminIntent | null;
  pendingAction: AdminPendingAction | null;
  context: AdminConversationContext;

  // Metricas
  messageCount: number;
  lastUserMessageAt: Date | null;
  lastBotMessageAt: Date | null;

  // Timestamps
  startedAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mensaje individual del canal admin.
 */
export interface AdminChannelMessage {
  id: string;
  conversationId: string;

  // Mensaje
  role: AdminMessageRole;
  content: string;
  contentType: AdminContentType;

  // Canal
  channelMessageId: string | null;

  // IA
  detectedIntent: AdminIntent | null;
  intentConfidence: number | null;
  extractedData: Record<string, unknown>;

  // Acciones
  actionsExecuted: AdminExecutedAction[];

  // Tokens (para billing)
  inputTokens: number;
  outputTokens: number;

  // Estado
  status: AdminMessageStatus;
  errorMessage: string | null;

  // Timestamps
  createdAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
}

/**
 * Notificacion del canal admin.
 */
export interface AdminChannelNotification {
  id: string;
  tenantId: string;
  userId: string | null;

  // Tipo
  notificationType: AdminNotificationType;

  // Contenido
  title: string | null;
  content: string;
  templateData: Record<string, unknown>;

  // Scheduling
  scheduledFor: Date | null;
  isRecurring: boolean;
  recurrenceRule: string | null;

  // Estado
  status: 'pending' | 'sent' | 'failed' | 'cancelled';

  // Delivery
  channel: AdminChannelType | 'both' | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  errorMessage: string | null;

  // Prioridad
  priority: AdminNotificationPriority;

  // Metadata
  triggerData: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================
// ACTION TYPES
// =====================================================

/**
 * Accion pendiente de confirmacion en una conversacion.
 * Usado para flujos de confirmacion antes de ejecutar cambios.
 */
export interface AdminPendingAction {
  /** Tipo de confirmacion requerida */
  type: 'confirm_create' | 'confirm_update' | 'confirm_delete' | 'select_option';
  /** Tipo de entidad afectada */
  entityType: 'service' | 'price' | 'hours' | 'staff' | 'promotion' | 'notification' | 'other';
  /** ID de la entidad (si aplica) */
  entityId?: string;
  /** Datos de la accion */
  data: Record<string, unknown>;
  /** Opciones para seleccion (si type es select_option) */
  options?: AdminActionOption[];
  /** Cuando expira la accion pendiente */
  expiresAt: Date;
}

/**
 * Opcion para acciones de seleccion multiple.
 */
export interface AdminActionOption {
  label: string;
  value: string;
  description?: string;
}

/**
 * Accion ejecutada y registrada en un mensaje.
 */
export interface AdminExecutedAction {
  /** Tipo de accion ejecutada */
  type: string;
  /** Tipo de entidad afectada */
  entityType: string;
  /** ID de la entidad (si aplica) */
  entityId?: string;
  /** Si la accion fue exitosa */
  success: boolean;
  /** Mensaje de error (si fallo) */
  error?: string;
  /** Datos resultantes */
  resultData?: Record<string, unknown>;
  /** Cuando se ejecuto */
  executedAt: Date;
}

// =====================================================
// CONTEXT TYPES
// =====================================================

/**
 * Contexto de conversacion para LangGraph.
 * Mantiene estado entre mensajes.
 */
export interface AdminConversationContext {
  /** Ultimo intent procesado */
  lastIntent?: AdminIntent;
  /** Entidades mencionadas */
  mentionedEntities?: {
    services?: string[];
    staff?: string[];
    dates?: string[];
    amounts?: number[];
  };
  /** Preferencias temporales del usuario */
  sessionPreferences?: {
    verboseMode?: boolean;
    language?: string;
  };
  /** Datos de negocio cargados */
  businessData?: {
    tenantName?: string;
    vertical?: string;
    branchCount?: number;
  };
  /** Cualquier dato adicional */
  [key: string]: unknown;
}

// =====================================================
// ANALYTICS TYPES (para respuestas del bot)
// =====================================================

/**
 * Resumen diario de analytics.
 */
export interface DailySummary {
  date: string;
  leads: {
    new: number;
    converted: number;
    total: number;
  };
  appointments: {
    scheduled: number;
    completed: number;
    cancelled: number;
  };
  revenue: {
    total: number;
    currency: string;
  };
  aiPerformance: {
    messagesHandled: number;
    escalations: number;
    avgResponseTime: number;
  };
}

/**
 * Datos de inventario bajo.
 */
export interface LowInventoryAlert {
  itemId: string;
  itemName: string;
  currentStock: number;
  minStock: number;
  suggestedReorder: number;
  branchId?: string;
  branchName?: string;
}

/**
 * Lead caliente detectado.
 */
export interface HotLeadAlert {
  leadId: string;
  leadName: string;
  phone: string;
  score: number;
  interestedServices: string[];
  lastInteraction: Date;
  suggestedAction: string;
}

// =====================================================
// SERVICE RESULT TYPES
// =====================================================

/**
 * Resultado de generar codigo de vinculacion.
 */
export interface GenerateLinkCodeResult {
  linkCode: string;
  expiresAt: Date;
  userId: string;
}

/**
 * Resultado de verificar codigo de vinculacion.
 */
export interface VerifyLinkCodeResult {
  success: boolean;
  tenantId: string | null;
  userId: string | null;
  errorMessage: string | null;
}

/**
 * Resultado de verificar rate limit.
 */
export interface RateLimitResult {
  canSend: boolean;
  messagesRemainingHour: number;
  messagesRemainingDay: number;
  resetAt: Date;
}

/**
 * Resultado de obtener/crear conversacion.
 */
export interface GetOrCreateConversationResult {
  conversationId: string;
  isNew: boolean;
  currentIntent: AdminIntent | null;
  pendingAction: AdminPendingAction | null;
  context: AdminConversationContext;
}

/**
 * Usuario con datos de tenant (resultado de get_admin_channel_user).
 */
export interface AdminChannelUserWithTenant {
  userId: string;
  tenantId: string;
  staffId: string | null;
  status: AdminUserStatus;
  canViewAnalytics: boolean;
  canConfigure: boolean;
  canReceiveNotifications: boolean;
  preferredLanguage: string;
  timezone: string;
  tenantName: string;
  tenantVertical: string;
}

// =====================================================
// BUSINESS CONTEXT TYPES (from get_tenant_ai_context RPC)
// =====================================================

/**
 * Información de servicio del negocio.
 */
export interface AdminServiceInfo {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  durationMinutes: number | null;
  category: string | null;
  isPopular: boolean;
  isActive: boolean;
}

/**
 * Información de sucursal del negocio.
 */
export interface AdminBranchInfo {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  hours: Record<string, { open: string; close: string }> | null;
  isMain: boolean;
}

/**
 * FAQ del negocio.
 */
export interface AdminFAQInfo {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

/**
 * Promoción activa del negocio.
 */
export interface AdminPromotionInfo {
  id: string;
  title: string;
  description: string | null;
  discountType: 'percentage' | 'fixed' | 'bundle';
  discountValue: number;
  validFrom: string | null;
  validTo: string | null;
  conditions: string | null;
}

/**
 * Documento de base de conocimiento.
 */
export interface AdminKnowledgeDocInfo {
  id: string;
  title: string;
  content: string;
  type: string;
}

/**
 * Contexto de negocio completo cargado desde get_tenant_ai_context RPC.
 * Proporciona toda la información del negocio a los handlers.
 */
export interface AdminBusinessContext {
  /** Servicios del negocio */
  services: AdminServiceInfo[];
  /** Sucursales */
  branches: AdminBranchInfo[];
  /** FAQs */
  faqs: AdminFAQInfo[];
  /** Promociones activas */
  promotions: AdminPromotionInfo[];
  /** Documentos de conocimiento */
  knowledgeDocs: AdminKnowledgeDocInfo[];
  /** Configuración de IA */
  aiConfig: {
    systemPrompt: string;
    model: string;
    temperature: number;
    responseStyle: string;
    maxResponseLength: number;
    autoEscalateKeywords: string[];
  } | null;
  /** Timestamp de carga */
  loadedAt: Date;
}

// =====================================================
// LANGGRAPH CONTEXT & ANALYTICS TYPES
// =====================================================

/**
 * Contexto completo para el grafo de LangGraph.
 * Contiene toda la información necesaria para procesar mensajes.
 */
export interface AdminChannelContext {
  /** Usuario con datos de tenant */
  user: AdminChannelUserWithTenant;
  /** ID de la conversación activa */
  conversationId: string;
  /** ID del tenant */
  tenantId: string;
  /** Nombre del tenant */
  tenantName: string;
  /** Vertical del negocio */
  vertical: string;
  /** Canal de comunicación */
  channel: AdminChannelType;
  /** Contexto de conversación previo */
  conversationContext: AdminConversationContext | null;
  /** Contexto de negocio (servicios, FAQs, sucursales, promociones) */
  businessContext: AdminBusinessContext | null;
}

/**
 * Reporte de analytics generado.
 */
export interface AdminAnalyticsReport {
  /** Tipo de reporte */
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  /** Período del reporte */
  period: {
    start: Date;
    end: Date;
  };
  /** Resumen de métricas */
  summary: {
    totalRevenue: number;
    totalOrders: number;
    totalLeads: number;
    newCustomers: number;
    conversionRate: number;
  };
  /** Métricas de ventas */
  sales?: {
    total: number;
    count: number;
    averageTicket: number;
    byChannel: Record<string, number>;
    topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  };
  /** Métricas de leads */
  leads?: {
    total: number;
    new: number;
    converted: number;
    bySource: Record<string, number>;
    hotLeads: number;
  };
  /** Métricas de citas/órdenes */
  appointments?: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    upcoming: number;
  };
  /** Métricas de inventario */
  inventory?: {
    lowStockItems: number;
    outOfStockItems: number;
    totalValue: number;
    alerts: Array<{ item: string; current: number; minimum: number }>;
  };
  /** Métricas de IA/Bot */
  aiPerformance?: {
    totalConversations: number;
    messagesProcessed: number;
    averageResponseTime: number;
    escalationRate: number;
    satisfactionScore: number;
  };
  /** Comparación con período anterior */
  comparison?: {
    revenueChange: number;
    ordersChange: number;
    leadsChange: number;
  };
  /** Timestamp de generación */
  generatedAt: Date;
}

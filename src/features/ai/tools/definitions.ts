// =====================================================
// TIS TIS PLATFORM - Tool Definitions
// Definiciones de tools para el sistema de Tool Calling
// =====================================================
//
// Este archivo define las tools disponibles para los agentes.
// Las tools permiten al LLM consultar información en tiempo real
// en lugar de tener toda la información en el contexto.
//
// IMPORTANTE: Las tools son READ-ONLY excepto create_appointment
// y update_lead_info que modifican datos.
// =====================================================

import { z } from 'zod';

// ======================
// TOOL SCHEMAS (ZOD)
// ======================

/**
 * Schema para get_service_info
 * Obtiene información detallada de un servicio específico
 */
export const GetServiceInfoSchema = z.object({
  service_name: z.string().describe('Nombre o parte del nombre del servicio a buscar'),
});

/**
 * Schema para list_services
 * Lista todos los servicios disponibles
 */
export const ListServicesSchema = z.object({
  category: z.string().optional().describe('Categoría para filtrar servicios (opcional)'),
});

/**
 * Schema para get_available_slots
 * Obtiene horarios disponibles para agendar
 */
export const GetAvailableSlotsSchema = z.object({
  date: z.string().optional().describe('Fecha específica en formato YYYY-MM-DD (opcional, default: próximos 7 días)'),
  branch_id: z.string().optional().describe('ID de sucursal para filtrar (opcional)'),
  staff_id: z.string().optional().describe('ID de especialista para filtrar (opcional)'),
  service_id: z.string().optional().describe('ID de servicio para filtrar duración (opcional)'),
});

/**
 * Schema para get_branch_info
 * Obtiene información de una sucursal
 */
export const GetBranchInfoSchema = z.object({
  branch_name: z.string().optional().describe('Nombre de la sucursal (opcional)'),
  branch_id: z.string().optional().describe('ID de la sucursal (opcional)'),
});

/**
 * Schema para get_business_policy
 * Obtiene una política específica del negocio
 */
export const GetBusinessPolicySchema = z.object({
  policy_type: z.enum(['cancellation', 'rescheduling', 'payment', 'warranty', 'refunds', 'general'])
    .describe('Tipo de política a consultar'),
});

/**
 * Schema para search_knowledge_base
 * Busca información en la base de conocimiento (RAG)
 */
export const SearchKnowledgeBaseSchema = z.object({
  query: z.string().describe('Pregunta o tema a buscar en la base de conocimiento'),
  limit: z.number().optional().default(3).describe('Máximo de resultados a retornar (default: 3)'),
});

/**
 * Schema para get_staff_info
 * Obtiene información del equipo/especialistas
 */
export const GetStaffInfoSchema = z.object({
  staff_name: z.string().optional().describe('Nombre del especialista (opcional)'),
  specialty: z.string().optional().describe('Especialidad para filtrar (opcional)'),
});

/**
 * Schema para create_appointment
 * Crea una cita para el cliente
 */
export const CreateAppointmentSchema = z.object({
  date: z.string().describe('Fecha de la cita en formato YYYY-MM-DD'),
  time: z.string().describe('Hora de la cita en formato HH:MM'),
  service_id: z.string().optional().describe('ID del servicio (opcional)'),
  branch_id: z.string().optional().describe('ID de la sucursal (opcional)'),
  staff_id: z.string().optional().describe('ID del especialista (opcional)'),
  notes: z.string().optional().describe('Notas adicionales para la cita (opcional)'),
});

/**
 * Schema para update_lead_info
 * Actualiza información del cliente/lead
 */
export const UpdateLeadInfoSchema = z.object({
  name: z.string().optional().describe('Nombre del cliente'),
  email: z.string().email().optional().describe('Email del cliente'),
  phone: z.string().optional().describe('Teléfono del cliente'),
});

/**
 * Schema para get_operating_hours
 * Obtiene horarios de operación
 */
export const GetOperatingHoursSchema = z.object({
  branch_id: z.string().optional().describe('ID de sucursal específica (opcional)'),
  day: z.string().optional().describe('Día específico (lunes, martes, etc.) (opcional)'),
});

/**
 * Schema para get_faq_answer
 * Obtiene respuesta a una pregunta frecuente
 */
export const GetFaqAnswerSchema = z.object({
  question: z.string().describe('Pregunta o tema a buscar en FAQs'),
});

// ======================
// RESTAURANT-SPECIFIC SCHEMAS
// ======================

/**
 * Schema para get_menu_items
 * Obtiene items del menú de restaurant
 */
export const GetMenuItemsSchema = z.object({
  category_id: z.string().optional().describe('ID de categoría para filtrar (opcional)'),
  search_term: z.string().optional().describe('Término de búsqueda para filtrar items (opcional)'),
  available_only: z.boolean().optional().default(true).describe('Solo mostrar items disponibles (default: true)'),
});

/**
 * Schema para get_menu_categories
 * Obtiene categorías del menú
 */
export const GetMenuCategoriesSchema = z.object({
  active_only: z.boolean().optional().default(true).describe('Solo categorías activas (default: true)'),
});

/**
 * Schema para create_order
 * Crea un pedido de restaurant (pickup/delivery)
 */
export const CreateOrderSchema = z.object({
  order_type: z.enum(['pickup', 'delivery', 'dine_in']).describe('Tipo de pedido'),
  items: z.array(z.object({
    menu_item_id: z.string().describe('ID del item del menú'),
    quantity: z.number().min(1).describe('Cantidad'),
    modifiers: z.array(z.string()).optional().describe('IDs de modificadores seleccionados'),
    special_instructions: z.string().optional().describe('Instrucciones especiales'),
  })).describe('Items del pedido'),
  pickup_time: z.string().optional().describe('Hora de recogida en formato HH:MM (para pickup)'),
  delivery_address: z.string().optional().describe('Dirección de entrega (para delivery)'),
  customer_notes: z.string().optional().describe('Notas generales del cliente'),
});

/**
 * Schema para check_item_availability
 * Verifica disponibilidad de un item del menú
 */
export const CheckItemAvailabilitySchema = z.object({
  menu_item_id: z.string().describe('ID del item del menú'),
  quantity: z.number().optional().default(1).describe('Cantidad a verificar (default: 1)'),
});

/**
 * Schema para get_active_promotions
 * Obtiene promociones activas
 */
export const GetActivePromotionsSchema = z.object({
  vertical: z.enum(['dental', 'restaurant', 'all']).optional().default('all').describe('Vertical para filtrar promociones'),
});

// ======================
// LOYALTY-SPECIFIC SCHEMAS
// REVISIÓN 5.5: Integración Loyalty con AI
// ======================

/**
 * Schema para get_loyalty_balance
 * Obtiene el balance de puntos/tokens del cliente
 */
export const GetLoyaltyBalanceSchema = z.object({
  // No requiere parámetros - usa el lead_id del contexto
});

/**
 * Schema para get_available_rewards
 * Obtiene las recompensas que el cliente puede canjear
 */
export const GetAvailableRewardsSchema = z.object({
  category: z.string().optional().describe('Categoría de recompensas para filtrar (opcional)'),
  max_results: z.number().optional().default(10).describe('Número máximo de resultados (default: 10)'),
});

/**
 * Schema para get_membership_info
 * Obtiene información de la membresía del cliente
 */
export const GetMembershipInfoSchema = z.object({
  include_benefits: z.boolean().optional().default(true).describe('Incluir lista de beneficios (default: true)'),
});

/**
 * Schema para redeem_reward
 * Canjea una recompensa con puntos del cliente
 */
export const RedeemRewardSchema = z.object({
  reward_id: z.string().describe('ID de la recompensa a canjear'),
  notes: z.string().optional().describe('Notas adicionales del canje'),
});

// ======================
// TOOL RESPONSE TYPES
// ======================

export interface ServiceInfo {
  id: string;
  name: string;
  price_min: number;
  price_max: number;
  price_note: string | null;
  duration_minutes: number;
  description: string;
  requires_consultation: boolean;
  promotion_active: boolean;
  promotion_text: string | null;
  category: string | null;
}

export interface ServiceListItem {
  id: string;
  name: string;
  price_range: string;
  category: string;
  duration_minutes: number;
}

export interface AvailableSlot {
  date: string;
  time: string;
  branch_name: string;
  branch_id: string;
  staff_name: string | null;
  staff_id: string | null;
  available: boolean;
}

export interface BranchInfo {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string | null;
  whatsapp: string | null;
  google_maps_url: string | null;
  operating_hours: Record<string, { open: string; close: string }>;
}

export interface PolicyInfo {
  title: string;
  policy: string;
  short_version: string | null;
}

export interface KnowledgeBaseResult {
  title: string;
  content: string;
  category: string;
  relevance_score: number;
}

export interface StaffInfo {
  id: string;
  name: string;
  role: string;
  specialty: string | null;
  branches: string[];
}

export interface AppointmentResult {
  success: boolean;
  appointment_id?: string;
  confirmation_message: string;
  error?: string;
}

export interface LeadUpdateResult {
  success: boolean;
  updated_fields: string[];
  error?: string;
}

export interface OperatingHours {
  branch_name: string;
  hours: Record<string, { open: string; close: string; closed: boolean }>;
}

export interface FaqAnswer {
  question: string;
  answer: string;
  category: string;
  found: boolean;
}

// ======================
// RESTAURANT-SPECIFIC RESPONSE TYPES
// ======================

/**
 * Opción dentro de un modificador
 * Ej: Para modificador "Tamaño", opciones: "Chico", "Mediano", "Grande"
 */
export interface MenuItemModifierOption {
  id: string;
  name: string;
  price_adjustment: number;  // +$0, +$10, +$20, etc.
}

/**
 * Modificador de un item del menú
 * Ej: "Tamaño", "Extras", "Tipo de pan"
 */
export interface MenuItemModifier {
  id: string;
  name: string;
  options: MenuItemModifierOption[];
  is_required: boolean;
  max_selections: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  category_name: string;
  image_url: string | null;
  available: boolean;
  preparation_time_minutes: number;
  modifiers: MenuItemModifier[];
  allergens: string[];
  tags: string[];  // vegetarian, spicy, etc.
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  active: boolean;
  item_count: number;
}

export interface OrderItem {
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  modifiers: string[];
  special_instructions: string | null;
  subtotal: number;
}

export interface OrderResult {
  success: boolean;
  order_id?: string;
  order_number?: string;
  estimated_time_minutes?: number;
  total: number;
  items: OrderItem[];
  confirmation_message: string;
  error?: string;
}

export interface ItemAvailability {
  menu_item_id: string;
  menu_item_name: string;
  available: boolean;
  quantity_available: number | null;  // null = unlimited
  reason_unavailable: string | null;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed' | 'bundle';
  discount_value: number;
  applicable_items: string[];  // menu_item_ids or 'all'
  valid_from: string;
  valid_until: string;
  conditions: string | null;
  active: boolean;
}

// ======================
// LOYALTY-SPECIFIC RESPONSE TYPES
// REVISIÓN 5.5: Integración Loyalty con AI
// ======================

export interface LoyaltyBalance {
  program_name: string;
  tokens_name: string;
  current_balance: number;
  total_earned: number;
  total_redeemed: number;
  tokens_per_currency: number;
  currency_threshold: number;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string;
  category: string;
  tokens_required: number;
  can_redeem: boolean;  // Si el cliente tiene suficientes tokens
  valid_until: string | null;
}

export interface MembershipInfo {
  has_membership: boolean;
  plan_name: string | null;
  tier_level: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  benefits: string[];
  tokens_multiplier: number;
}

export interface RewardRedemptionResult {
  success: boolean;
  redemption_id?: string;
  reward_name: string;
  tokens_used: number;
  new_balance: number;
  confirmation_message: string;
  error?: string;
}

// ======================
// TOOL NAMES (Constants)
// ======================

export const TOOL_NAMES = {
  // Common tools (all verticals)
  GET_SERVICE_INFO: 'get_service_info',
  LIST_SERVICES: 'list_services',
  GET_AVAILABLE_SLOTS: 'get_available_slots',
  GET_BRANCH_INFO: 'get_branch_info',
  GET_BUSINESS_POLICY: 'get_business_policy',
  SEARCH_KNOWLEDGE_BASE: 'search_knowledge_base',
  GET_STAFF_INFO: 'get_staff_info',
  CREATE_APPOINTMENT: 'create_appointment',
  UPDATE_LEAD_INFO: 'update_lead_info',
  GET_OPERATING_HOURS: 'get_operating_hours',
  GET_FAQ_ANSWER: 'get_faq_answer',
  // Restaurant-specific tools
  GET_MENU_ITEMS: 'get_menu_items',
  GET_MENU_CATEGORIES: 'get_menu_categories',
  CREATE_ORDER: 'create_order',
  CHECK_ITEM_AVAILABILITY: 'check_item_availability',
  GET_ACTIVE_PROMOTIONS: 'get_active_promotions',
  // Loyalty-specific tools (REVISIÓN 5.5)
  GET_LOYALTY_BALANCE: 'get_loyalty_balance',
  GET_AVAILABLE_REWARDS: 'get_available_rewards',
  GET_MEMBERSHIP_INFO: 'get_membership_info',
  REDEEM_REWARD: 'redeem_reward',
} as const;

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];

// ======================
// TOOL DESCRIPTIONS
// ======================

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  // Common tools
  [TOOL_NAMES.GET_SERVICE_INFO]: 'Obtiene información detallada de un servicio específico incluyendo precio, duración y descripción. Usa esta tool cuando el cliente pregunte por un servicio en particular.',
  [TOOL_NAMES.LIST_SERVICES]: 'Lista todos los servicios disponibles con sus precios. Usa esta tool cuando el cliente quiera conocer qué servicios ofreces o pida un catálogo.',
  [TOOL_NAMES.GET_AVAILABLE_SLOTS]: 'Obtiene los horarios disponibles para agendar cita. Usa esta tool cuando necesites ofrecer opciones de horario al cliente.',
  [TOOL_NAMES.GET_BRANCH_INFO]: 'Obtiene información de una sucursal (dirección, teléfono, cómo llegar). Usa esta tool cuando pregunten por ubicación.',
  [TOOL_NAMES.GET_BUSINESS_POLICY]: 'Obtiene políticas del negocio (cancelación, pagos, garantías). Usa esta tool cuando pregunten por políticas.',
  [TOOL_NAMES.SEARCH_KNOWLEDGE_BASE]: 'Busca información en la base de conocimiento del negocio. Usa esta tool para preguntas generales que no encajen en otras categorías.',
  [TOOL_NAMES.GET_STAFF_INFO]: 'Obtiene información del equipo o especialistas. Usa esta tool cuando pregunten por doctores, especialistas o staff.',
  [TOOL_NAMES.CREATE_APPOINTMENT]: 'Crea una cita para el cliente. Usa esta tool cuando tengas todos los datos necesarios para agendar.',
  [TOOL_NAMES.UPDATE_LEAD_INFO]: 'Actualiza la información de contacto del cliente. Usa esta tool cuando el cliente proporcione datos de contacto.',
  [TOOL_NAMES.GET_OPERATING_HOURS]: 'Obtiene los horarios de operación del negocio. Usa esta tool cuando pregunten por horarios de atención.',
  [TOOL_NAMES.GET_FAQ_ANSWER]: 'Busca respuestas en las preguntas frecuentes configuradas. Usa esta tool para preguntas comunes.',
  // Restaurant-specific tools
  [TOOL_NAMES.GET_MENU_ITEMS]: 'Obtiene items del menú del restaurante. Usa esta tool cuando el cliente pregunte por platillos, bebidas o cualquier producto del menú.',
  [TOOL_NAMES.GET_MENU_CATEGORIES]: 'Obtiene las categorías del menú (entradas, platos fuertes, bebidas, postres). Usa esta tool para mostrar la estructura del menú.',
  [TOOL_NAMES.CREATE_ORDER]: 'Crea un pedido para el cliente (pickup, delivery o para comer aquí). Usa esta tool cuando el cliente confirme su pedido completo.',
  [TOOL_NAMES.CHECK_ITEM_AVAILABILITY]: 'Verifica si un platillo específico está disponible. Usa esta tool antes de confirmar un pedido o cuando el cliente pregunte si hay algo.',
  [TOOL_NAMES.GET_ACTIVE_PROMOTIONS]: 'Obtiene las promociones activas del negocio. Usa esta tool cuando el cliente pregunte por ofertas, descuentos o promociones.',
  // Loyalty-specific tools (REVISIÓN 5.5)
  [TOOL_NAMES.GET_LOYALTY_BALANCE]: 'Obtiene el balance de puntos/tokens del cliente en el programa de lealtad. Usa esta tool cuando el cliente pregunte cuántos puntos tiene o su balance.',
  [TOOL_NAMES.GET_AVAILABLE_REWARDS]: 'Obtiene las recompensas disponibles para canjear con puntos. Usa esta tool cuando el cliente pregunte qué puede canjear o qué premios hay.',
  [TOOL_NAMES.GET_MEMBERSHIP_INFO]: 'Obtiene información de la membresía del cliente (plan, beneficios, fecha de vencimiento). Usa esta tool cuando pregunten por su membresía.',
  [TOOL_NAMES.REDEEM_REWARD]: 'Canjea una recompensa usando los puntos del cliente. Usa esta tool cuando el cliente confirme que quiere canjear una recompensa específica.',
};

// ======================
// TOOL SET BY AGENT TYPE
// ======================

/**
 * Define qué tools están disponibles para cada tipo de agente
 */
export const TOOLS_BY_AGENT: Record<string, ToolName[]> = {
  // Agentes con acceso completo
  pricing: [
    TOOL_NAMES.GET_SERVICE_INFO,
    TOOL_NAMES.LIST_SERVICES,
    TOOL_NAMES.GET_BUSINESS_POLICY,
    TOOL_NAMES.GET_FAQ_ANSWER,
    TOOL_NAMES.GET_STAFF_INFO, // Para dental: mencionar qué especialista realiza el servicio
  ],

  booking: [
    TOOL_NAMES.GET_SERVICE_INFO,
    TOOL_NAMES.LIST_SERVICES,
    TOOL_NAMES.GET_AVAILABLE_SLOTS,
    TOOL_NAMES.GET_BRANCH_INFO,
    TOOL_NAMES.GET_STAFF_INFO,
    TOOL_NAMES.CREATE_APPOINTMENT,
    TOOL_NAMES.UPDATE_LEAD_INFO,
  ],

  booking_dental: [
    TOOL_NAMES.GET_SERVICE_INFO,
    TOOL_NAMES.LIST_SERVICES,
    TOOL_NAMES.GET_AVAILABLE_SLOTS,
    TOOL_NAMES.GET_BRANCH_INFO,
    TOOL_NAMES.GET_STAFF_INFO,
    TOOL_NAMES.CREATE_APPOINTMENT,
    TOOL_NAMES.UPDATE_LEAD_INFO,
  ],

  booking_restaurant: [
    TOOL_NAMES.GET_AVAILABLE_SLOTS,
    TOOL_NAMES.GET_BRANCH_INFO,
    TOOL_NAMES.CREATE_APPOINTMENT,
    TOOL_NAMES.UPDATE_LEAD_INFO,
  ],

  booking_medical: [
    TOOL_NAMES.GET_SERVICE_INFO,
    TOOL_NAMES.LIST_SERVICES,
    TOOL_NAMES.GET_AVAILABLE_SLOTS,
    TOOL_NAMES.GET_BRANCH_INFO,
    TOOL_NAMES.GET_STAFF_INFO,
    TOOL_NAMES.CREATE_APPOINTMENT,
    TOOL_NAMES.UPDATE_LEAD_INFO,
  ],

  location: [
    TOOL_NAMES.GET_BRANCH_INFO,
    TOOL_NAMES.GET_OPERATING_HOURS,
  ],

  hours: [
    TOOL_NAMES.GET_OPERATING_HOURS,
    TOOL_NAMES.GET_BRANCH_INFO,
  ],

  faq: [
    TOOL_NAMES.GET_FAQ_ANSWER,
    TOOL_NAMES.SEARCH_KNOWLEDGE_BASE,
    TOOL_NAMES.GET_SERVICE_INFO,
    TOOL_NAMES.GET_BUSINESS_POLICY,
    TOOL_NAMES.GET_STAFF_INFO, // Para dental: FAQs sobre doctores
    // Loyalty tools (REVISIÓN 5.5)
    TOOL_NAMES.GET_LOYALTY_BALANCE,
    TOOL_NAMES.GET_AVAILABLE_REWARDS,
    TOOL_NAMES.GET_MEMBERSHIP_INFO,
  ],

  general: [
    TOOL_NAMES.GET_SERVICE_INFO,
    TOOL_NAMES.LIST_SERVICES,
    TOOL_NAMES.GET_BRANCH_INFO,
    TOOL_NAMES.GET_OPERATING_HOURS,
    TOOL_NAMES.GET_FAQ_ANSWER,
    TOOL_NAMES.SEARCH_KNOWLEDGE_BASE,
    TOOL_NAMES.GET_BUSINESS_POLICY,
    TOOL_NAMES.GET_STAFF_INFO, // Para dental: consultas sobre doctores/especialistas
    // Loyalty tools (REVISIÓN 5.5)
    TOOL_NAMES.GET_LOYALTY_BALANCE,
    TOOL_NAMES.GET_AVAILABLE_REWARDS,
    TOOL_NAMES.GET_MEMBERSHIP_INFO,
    TOOL_NAMES.REDEEM_REWARD,
  ],

  greeting: [
    TOOL_NAMES.GET_OPERATING_HOURS,
    TOOL_NAMES.GET_BRANCH_INFO,
    // Loyalty tools (REVISIÓN 5.5) - Mencionar puntos en saludo
    TOOL_NAMES.GET_LOYALTY_BALANCE,
  ],

  escalation: [], // No tools, solo escala

  urgent_care: [
    TOOL_NAMES.GET_AVAILABLE_SLOTS,
    TOOL_NAMES.GET_BRANCH_INFO,
    TOOL_NAMES.CREATE_APPOINTMENT,
  ],

  ordering_restaurant: [
    TOOL_NAMES.GET_MENU_ITEMS,
    TOOL_NAMES.GET_MENU_CATEGORIES,
    TOOL_NAMES.CHECK_ITEM_AVAILABILITY,
    TOOL_NAMES.CREATE_ORDER,
    TOOL_NAMES.GET_ACTIVE_PROMOTIONS,
    TOOL_NAMES.GET_BRANCH_INFO,
    TOOL_NAMES.GET_OPERATING_HOURS,
    // Loyalty tools (REVISIÓN 5.5) - Mostrar puntos ganados al ordenar
    TOOL_NAMES.GET_LOYALTY_BALANCE,
    TOOL_NAMES.GET_AVAILABLE_REWARDS,
  ],

  invoicing_restaurant: [
    TOOL_NAMES.UPDATE_LEAD_INFO, // Para datos de facturación
    TOOL_NAMES.GET_BUSINESS_POLICY,
  ],

  // Restaurant pricing agent
  pricing_restaurant: [
    TOOL_NAMES.GET_MENU_ITEMS,
    TOOL_NAMES.GET_MENU_CATEGORIES,
    TOOL_NAMES.GET_ACTIVE_PROMOTIONS,
    TOOL_NAMES.GET_BUSINESS_POLICY,
    TOOL_NAMES.GET_FAQ_ANSWER,
  ],

  // Restaurant FAQ agent
  faq_restaurant: [
    TOOL_NAMES.GET_FAQ_ANSWER,
    TOOL_NAMES.SEARCH_KNOWLEDGE_BASE,
    TOOL_NAMES.GET_MENU_ITEMS,
    TOOL_NAMES.GET_OPERATING_HOURS,
    TOOL_NAMES.GET_BUSINESS_POLICY,
  ],

  // General restaurant agent
  general_restaurant: [
    TOOL_NAMES.GET_MENU_ITEMS,
    TOOL_NAMES.GET_MENU_CATEGORIES,
    TOOL_NAMES.GET_ACTIVE_PROMOTIONS,
    TOOL_NAMES.GET_BRANCH_INFO,
    TOOL_NAMES.GET_OPERATING_HOURS,
    TOOL_NAMES.GET_FAQ_ANSWER,
    TOOL_NAMES.SEARCH_KNOWLEDGE_BASE,
    TOOL_NAMES.GET_BUSINESS_POLICY,
  ],
};

/**
 * Obtiene las tools disponibles para un agente específico
 */
export function getToolsForAgent(agentName: string): ToolName[] {
  return TOOLS_BY_AGENT[agentName] || [];
}

// ======================
// EXPORTS
// ======================

export default {
  TOOL_NAMES,
  TOOL_DESCRIPTIONS,
  TOOLS_BY_AGENT,
  getToolsForAgent,
  // Common Schemas
  GetServiceInfoSchema,
  ListServicesSchema,
  GetAvailableSlotsSchema,
  GetBranchInfoSchema,
  GetBusinessPolicySchema,
  SearchKnowledgeBaseSchema,
  GetStaffInfoSchema,
  CreateAppointmentSchema,
  UpdateLeadInfoSchema,
  GetOperatingHoursSchema,
  GetFaqAnswerSchema,
  // Restaurant Schemas
  GetMenuItemsSchema,
  GetMenuCategoriesSchema,
  CreateOrderSchema,
  CheckItemAvailabilitySchema,
  GetActivePromotionsSchema,
};

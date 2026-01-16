// =====================================================
// TIS TIS PLATFORM - LangGraph Agent State
// Estado compartido entre todos los agentes del sistema
// =====================================================

import { Annotation, messagesStateReducer } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import type { AIIntent, AISignal } from '@/src/shared/types/whatsapp';

// ======================
// TYPES FOR STATE
// ======================

/**
 * Configuración del Agent Profile integrado
 */
export interface AgentProfileInfo {
  profile_id?: string;
  profile_type: 'business' | 'personal';
  template_key: string;
  response_delay_minutes: number;
  response_delay_first_only: boolean;
  ai_learning_config: {
    learn_patterns: boolean;
    learn_vocabulary: boolean;
    learn_preferences: boolean;
    sync_to_business_ia?: boolean;
  };
}

/**
 * Información del tenant (negocio)
 */
export interface TenantInfo {
  tenant_id: string;
  tenant_name: string;
  // IMPORTANT: Only 'dental' and 'restaurant' are currently active
  // Other verticals are planned for future releases
  vertical: 'dental' | 'restaurant' | 'clinic' | 'gym' | 'beauty' | 'veterinary';
  timezone: string;
  ai_config: {
    system_prompt: string;
    model: string;
    temperature: number;
    response_style: 'professional' | 'professional_friendly' | 'casual' | 'formal';
    max_response_length: number;
    enable_scoring: boolean;
    auto_escalate_keywords: string[];
    business_hours: {
      start: string;
      end: string;
      days: number[];
    };
  };
  // Agent Profile System integration (v4.6)
  agent_profile?: AgentProfileInfo;
  // ARQUITECTURA V6: Indica qué tipo de prompt se usó
  prompt_source?: string;
}

/**
 * Información del lead (cliente potencial)
 */
export interface LeadInfo {
  lead_id: string;
  name: string;
  phone: string;
  email?: string;
  score: number;
  classification: 'cold' | 'warm' | 'hot' | 'converted';
  preferred_contact_method?: 'whatsapp' | 'phone' | 'email';
  preferred_branch_id?: string;
  preferred_staff_id?: string;
  notes?: string;
  tags?: string[];
}

/**
 * Información de lealtad del cliente (v5.5)
 * Contexto de tokens, membresías y recompensas disponibles
 */
export interface LoyaltyInfo {
  /** Si el programa de lealtad está activo para este tenant */
  program_enabled: boolean;

  /** Nombre del programa (ej: "Programa de Puntos") */
  program_name?: string;

  /** Nombre personalizado de los tokens (ej: "Puntos Dentales") */
  tokens_name?: string;

  /** Balance actual de tokens del cliente */
  token_balance: number;

  /** Total de tokens ganados históricamente */
  total_earned: number;

  /** Total de tokens canjeados históricamente */
  total_redeemed: number;

  /** Membresía activa del cliente */
  membership?: {
    plan_name: string;
    tier_level: 'basic' | 'silver' | 'gold' | 'platinum' | 'vip';
    status: 'active' | 'pending' | 'expired' | 'cancelled';
    end_date?: string;
    tokens_multiplier: number;
    benefits?: string[];
  };

  /** Resumen de recompensas disponibles para el cliente */
  available_rewards_summary: {
    total_available: number;
    can_redeem_now: number;
    cheapest_reward_tokens?: number;
    cheapest_reward_name?: string;
  };

  /** Tokens pendientes por otorgar (ej: de una cita que no se ha confirmado) */
  pending_tokens?: number;
}

/**
 * Información de la conversación actual
 */
export interface ConversationInfo {
  conversation_id: string;
  channel: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'webchat' | 'voice';
  status: 'active' | 'escalated' | 'closed';
  ai_handling: boolean;
  message_count: number;
  started_at: string;
  last_message_at: string;
}

/**
 * Datos extraídos del mensaje actual
 */
export interface ExtractedData {
  // Datos personales detectados
  name?: string;
  phone?: string;
  email?: string;

  // Preferencias detectadas
  preferred_date?: string;
  preferred_time?: string;
  preferred_branch?: string;
  preferred_staff?: string;
  is_flexible_schedule?: boolean;

  // Interés en servicios
  service_interest?: {
    service_id?: string;
    service_name: string;
    urgency: 'low' | 'medium' | 'high' | 'urgent';
    price_sensitive: boolean;
  };

  // Síntomas/problemas (para verticales médicas)
  symptoms?: string[];
  pain_level?: 1 | 2 | 3 | 4 | 5;
  duration?: string;

  // Datos de restaurante
  party_size?: number;
  occasion?: string;
  special_requests?: string;
  table_preference?: string;
}

/**
 * Resultado de cita agendada
 */
export interface BookingResult {
  success: boolean;
  appointment_id?: string;
  scheduled_at?: string;
  branch_name?: string;
  branch_address?: string;
  service_name?: string;
  staff_name?: string;
  confirmation_message?: string;
  error?: string;
  suggestion?: string;
}

/**
 * Resultado de orden de restaurante (pickup/delivery)
 */
export interface OrderResult {
  success: boolean;
  order_id?: string;
  order_number?: string;
  order_type: 'pickup' | 'delivery' | 'dine_in';
  items: Array<{
    menu_item_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    modifiers?: string[];
    special_instructions?: string;
  }>;
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  estimated_ready_time?: string;
  pickup_time?: string;
  confirmation_message?: string;
  error?: string;
  /** Nivel de confianza del AI (0-1) en la interpretación del pedido */
  ai_confidence_score?: number;
  /** Alternativas que el AI ofreció al cliente */
  ai_alternatives_offered?: string[];
  /** Tokens de lealtad otorgados por esta orden */
  tokens_awarded?: number;
}

/**
 * Contexto del negocio (servicios, sucursales, etc.)
 * COMPLETO: Incluye todo el Knowledge Base del cliente
 */
export interface BusinessContext {
  // =====================================================
  // DATOS BÁSICOS
  // =====================================================
  services: Array<{
    id: string;
    name: string;
    description: string;
    ai_description?: string;
    price_min: number;
    price_max: number;
    price_note?: string;
    duration_minutes: number;
    category: string;
    special_instructions?: string;
    requires_consultation?: boolean;
    promotion_active?: boolean;
    promotion_text?: string;
  }>;
  branches: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    phone: string;
    whatsapp_number: string;
    google_maps_url: string;
    is_headquarters: boolean;
    operating_hours: Record<string, { open: string; close: string }>;
  }>;
  staff: Array<{
    id: string;
    name: string;
    role_title: string;
    specialty?: string;
    branch_ids: string[];
    bio?: string;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
    category: string;
  }>;
  scoring_rules: Array<{
    signal_name: string;
    points: number;
    keywords: string[];
    category: string;
  }>;

  // =====================================================
  // KNOWLEDGE BASE - Configuraciones personalizadas del cliente
  // =====================================================

  /** Instrucciones personalizadas del cliente (identidad, tono, casos especiales, etc.) */
  custom_instructions?: Array<{
    type: string;
    title: string;
    instruction: string;
    examples?: string;
    branch_id?: string;
  }>;

  /** Políticas del negocio (cancelaciones, pagos, garantías, etc.) */
  business_policies?: Array<{
    type: string;
    title: string;
    policy: string;
    short_version?: string;
  }>;

  /** Artículos de conocimiento (sobre nosotros, certificaciones, tecnología, etc.) */
  knowledge_articles?: Array<{
    category: string;
    title: string;
    content: string;
    summary?: string;
    branch_id?: string;
  }>;

  /** Plantillas de respuesta sugeridas */
  response_templates?: Array<{
    trigger: string;
    name: string;
    template: string;
    variables?: string[];
    branch_id?: string;
  }>;

  /** Estrategias de manejo de competencia */
  competitor_handling?: Array<{
    competitor: string;
    aliases?: string[];
    strategy: string;
    talking_points?: string[];
    avoid_saying?: string[];
  }>;

  // =====================================================
  // MENÚ DE RESTAURANTE (Solo para vertical restaurant)
  // =====================================================

  /** Items del menú disponibles para pedidos */
  menu_items?: Array<{
    id: string;
    name: string;
    description?: string;
    ai_description?: string;
    category_id: string;
    category_name: string;
    base_price: number;
    is_available: boolean;
    preparation_time_minutes?: number;
    allergens?: string[];
    tags?: string[];
    is_popular?: boolean;
    modifiers?: Array<{
      id: string;
      name: string;
      options: Array<{
        id: string;
        name: string;
        price_adjustment: number;
      }>;
      is_required: boolean;
      max_selections?: number;
    }>;
  }>;

  /** Categorías del menú */
  menu_categories?: Array<{
    id: string;
    name: string;
    description?: string;
    display_order: number;
    is_active: boolean;
  }>;

  /** Configuración de pedidos del restaurante */
  ordering_config?: {
    accepts_pickup: boolean;
    accepts_delivery: boolean;
    accepts_dine_in: boolean;
    min_pickup_time_minutes: number;
    min_delivery_time_minutes: number;
    delivery_fee?: number;
    min_order_amount?: number;
    max_order_items?: number;
    special_instructions_enabled: boolean;
  };

  // =====================================================
  // PROMOCIONES (Para todas las verticales)
  // =====================================================

  /** Promociones activas del negocio */
  promotions?: Array<{
    id: string;
    title: string;
    description?: string;
    discount_type: 'percentage' | 'fixed' | 'bundle';
    discount_value: number;
    applicable_items?: string[];
    valid_from?: string;
    valid_until?: string;
    conditions?: string;
    active: boolean;
    vertical?: 'dental' | 'restaurant' | 'all';
  }>;

  // =====================================================
  // DATOS EXTERNOS - De sistemas integrados (CRM, POS, etc.)
  // OPCIONAL: Solo presente si el tenant tiene integraciones activas
  // =====================================================

  /** Datos sincronizados de sistemas externos (CRM, POS, software dental) */
  external_data?: {
    /** Indica si hay integraciones activas */
    has_integrations: boolean;

    /** Sistemas de origen de los datos */
    source_systems: string[];

    /** Productos/servicios externos con stock bajo */
    low_stock_items?: Array<{
      name: string;
      sku?: string;
      quantity: number;
      reorder_point?: number;
      category?: string;
    }>;

    /** Productos externos (menú de restaurante, catálogo, etc.) */
    external_products?: Array<{
      name: string;
      price?: number;
      category?: string;
      is_available: boolean;
      preparation_time?: number;
    }>;

    /** Número de citas externas pendientes */
    external_appointments_count?: number;

    /** Última sincronización exitosa */
    last_sync_at?: string;
  };
}

/**
 * Historial de agentes que han procesado la conversación
 */
export interface AgentTrace {
  agent_name: string;
  timestamp: string;
  input_summary: string;
  output_summary: string;
  decision?: string;
  duration_ms: number;
}

/**
 * Flags de control para el flujo del grafo
 */
export interface ControlFlags {
  // Escalación
  should_escalate: boolean;
  escalation_reason?: string;

  // Booking (citas/reservaciones)
  booking_attempted: boolean;
  booking_successful: boolean;

  // Ordering (pedidos de restaurante)
  ordering_attempted: boolean;
  ordering_successful: boolean;

  // Respuesta
  response_ready: boolean;
  response_sent: boolean;

  // Iteración
  needs_clarification: boolean;
  clarification_question?: string;

  // Límites
  max_iterations_reached: boolean;
  iteration_count: number;
}

// ======================
// LANGGRAPH STATE ANNOTATION
// ======================

/**
 * Estado principal del agente TIS TIS
 *
 * Este es el objeto de estado que fluye a través de todos los nodos
 * del grafo. Cada agente puede leer y modificar este estado.
 *
 * La arquitectura está diseñada para:
 * 1. Supervisor lee el mensaje y decide el vertical
 * 2. Vertical Router enruta al agente especializado
 * 3. Agente especializado procesa y puede hacer handoff
 * 4. Estado se persiste en Supabase para checkpoints
 */
export const TISTISAgentState = Annotation.Root({
  // =====================================================
  // HISTORIAL DE MENSAJES (LangGraph built-in)
  // =====================================================
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // =====================================================
  // CONTEXTO DE LA CONVERSACIÓN
  // =====================================================

  /** Información del tenant (negocio) */
  tenant: Annotation<TenantInfo | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Información del lead (cliente) */
  lead: Annotation<LeadInfo | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Información de la conversación */
  conversation: Annotation<ConversationInfo | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Contexto del negocio (servicios, sucursales, FAQs) */
  business_context: Annotation<BusinessContext | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Información de lealtad del cliente (v5.5) */
  loyalty: Annotation<LoyaltyInfo | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // =====================================================
  // MENSAJE ACTUAL Y ANÁLISIS
  // =====================================================

  /** Mensaje actual del usuario (texto crudo) */
  current_message: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  /** Canal de origen del mensaje */
  channel: Annotation<'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'webchat' | 'voice'>({
    reducer: (_, next) => next,
    default: () => 'whatsapp',
  }),

  /** Intención detectada del mensaje */
  detected_intent: Annotation<AIIntent>({
    reducer: (_, next) => next,
    default: () => 'UNKNOWN',
  }),

  /** Señales de scoring detectadas */
  detected_signals: Annotation<AISignal[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  /** Datos extraídos del mensaje (nombre, fecha, etc.) */
  extracted_data: Annotation<ExtractedData>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // =====================================================
  // ENRUTAMIENTO Y DECISIONES
  // =====================================================

  /** Agente actual que está procesando */
  current_agent: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'supervisor',
  }),

  /** Próximo agente a ejecutar (para routing) */
  next_agent: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Vertical del negocio para routing especializado */
  // IMPORTANT: Only 'dental' and 'restaurant' are currently active
  vertical: Annotation<'dental' | 'restaurant' | 'clinic' | 'gym' | 'beauty' | 'veterinary'>({
    reducer: (_, next) => next,
    default: () => 'dental',
  }),

  /** Razón del routing (para debugging y trazabilidad) */
  routing_reason: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // =====================================================
  // ACCIONES TRANSACCIONALES
  // =====================================================

  /** Resultado del intento de booking (citas/reservaciones) */
  booking_result: Annotation<BookingResult | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Resultado del intento de ordering (pedidos de restaurante) */
  order_result: Annotation<OrderResult | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Cambios al score del lead */
  score_change: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),

  /** Campos del lead actualizados */
  lead_fields_updated: Annotation<string[]>({
    reducer: (prev, next) => Array.from(new Set([...prev, ...next])),
    default: () => [],
  }),

  // =====================================================
  // RESPUESTA FINAL
  // =====================================================

  /** Respuesta generada para el usuario */
  final_response: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  /** Modelo usado para generar la respuesta */
  model_used: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'gpt-5-mini',
  }),

  /** Tokens consumidos */
  tokens_used: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),

  // =====================================================
  // FLAGS DE CONTROL
  // =====================================================

  /** Flags de control del flujo */
  control: Annotation<ControlFlags>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({
      should_escalate: false,
      booking_attempted: false,
      booking_successful: false,
      ordering_attempted: false,
      ordering_successful: false,
      response_ready: false,
      response_sent: false,
      needs_clarification: false,
      max_iterations_reached: false,
      iteration_count: 0,
    }),
  }),

  // =====================================================
  // TRAZABILIDAD Y DEBUGGING
  // =====================================================

  /** Historial de agentes que procesaron */
  agent_trace: Annotation<AgentTrace[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  /** Timestamp de inicio del procesamiento */
  processing_started_at: Annotation<string>({
    reducer: (_, next) => next,
    default: () => new Date().toISOString(),
  }),

  /** Errores encontrados durante el procesamiento */
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // =====================================================
  // METADATA EXTENSIBLE
  // =====================================================

  /**
   * Metadata adicional para pasar información entre agentes
   * Usado por el vertical-router para pasar datos a agentes especializados
   * sin modificar la estructura principal del estado.
   *
   * Ejemplos de uso:
   * - dental_urgency: Información de urgencia detectada para dental
   * - restaurant_context: Contexto especial para restaurantes
   */
  metadata: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // =====================================================
  // REVISIÓN 5.0: SAFETY & RESILIENCE ANALYSIS
  // =====================================================

  /**
   * Resultados del análisis de seguridad y resiliencia
   * Generado por el Supervisor Agent usando SafetyResilienceService
   *
   * P25: Detección de emergencias médicas/dentales
   * P27: Detección de eventos especiales (restaurant)
   * P29: Detección de alergias y safety requirements
   * P23: Validación de configuración incompleta
   */
  safety_analysis: Annotation<{
    // P25: Emergency detection
    emergency_detected: boolean;
    emergency_type: string;
    emergency_severity: number;
    emergency_message?: string;
    // P29: Safety disclaimers
    safety_disclaimer?: string;
    safety_category: string;
    // P27: Special events
    special_event_type: string;
    special_event_requirements: string[];
    // P23: Config completeness
    config_completeness_score: number;
    config_missing_critical: string[];
  } | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

// Tipo inferido del estado
export type TISTISAgentStateType = typeof TISTISAgentState.State;

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Crea un estado inicial vacío
 */
export function createInitialState(): Partial<TISTISAgentStateType> {
  return {
    messages: [],
    tenant: null,
    lead: null,
    conversation: null,
    business_context: null,
    loyalty: null,
    current_message: '',
    channel: 'whatsapp',
    detected_intent: 'UNKNOWN',
    detected_signals: [],
    extracted_data: {},
    current_agent: 'supervisor',
    next_agent: null,
    vertical: 'dental', // Default to dental (active vertical)
    routing_reason: '',
    booking_result: null,
    order_result: null,
    score_change: 0,
    lead_fields_updated: [],
    final_response: '',
    model_used: 'gpt-5-mini',
    tokens_used: 0,
    control: {
      should_escalate: false,
      booking_attempted: false,
      booking_successful: false,
      ordering_attempted: false,
      ordering_successful: false,
      response_ready: false,
      response_sent: false,
      needs_clarification: false,
      max_iterations_reached: false,
      iteration_count: 0,
    },
    agent_trace: [],
    processing_started_at: new Date().toISOString(),
    errors: [],
    metadata: {},
    safety_analysis: null,
  };
}

/**
 * Agrega una traza de agente al estado
 */
export function addAgentTrace(
  state: Partial<TISTISAgentStateType>,
  trace: Omit<AgentTrace, 'timestamp'>
): AgentTrace {
  const fullTrace: AgentTrace = {
    ...trace,
    timestamp: new Date().toISOString(),
  };
  return fullTrace;
}

/**
 * Verifica si el estado requiere escalación
 */
export function shouldEscalate(state: TISTISAgentStateType): boolean {
  // Por intención explícita
  if (state.detected_intent === 'HUMAN_REQUEST') return true;
  if (state.detected_intent === 'PAIN_URGENT') return true;

  // Por flags de control
  if (state.control.should_escalate) return true;

  // Por score muy alto
  if (state.score_change >= 50) return true;

  // Por límite de iteraciones
  if (state.control.iteration_count >= 5) return true;

  return false;
}

/**
 * Calcula el tiempo de procesamiento
 */
export function getProcessingTimeMs(state: TISTISAgentStateType): number {
  const startTime = new Date(state.processing_started_at).getTime();
  return Date.now() - startTime;
}

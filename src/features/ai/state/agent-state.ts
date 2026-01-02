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

  // Booking
  booking_attempted: boolean;
  booking_successful: boolean;

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

  /** Resultado del intento de booking */
  booking_result: Annotation<BookingResult | null>({
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
    score_change: 0,
    lead_fields_updated: [],
    final_response: '',
    model_used: 'gpt-5-mini',
    tokens_used: 0,
    control: {
      should_escalate: false,
      booking_attempted: false,
      booking_successful: false,
      response_ready: false,
      response_sent: false,
      needs_clarification: false,
      max_iterations_reached: false,
      iteration_count: 0,
    },
    agent_trace: [],
    processing_started_at: new Date().toISOString(),
    errors: [],
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

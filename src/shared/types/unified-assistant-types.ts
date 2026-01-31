// =====================================================
// TIS TIS PLATFORM - Unified Assistant Types
// Tipos unificados para Voice Agent y Messaging Agent
// =====================================================
//
// Este archivo es la FUENTE DE VERDAD para tipos de asistente
// en toda la plataforma. Unifica las definiciones entre:
// - Voice Agent (Vapi/ElevenLabs)
// - Messaging Agent (LangGraph/WhatsApp/Meta)
//
// Sincronizado con:
// - SQL: supabase/migrations/155_UNIFIED_ASSISTANT_TYPES.sql
// - Templates: lib/voice-agent/templates/*.hbs
// =====================================================

// ======================
// CHANNEL TYPES
// ======================

/**
 * Canales de comunicación soportados por la plataforma
 */
export type AssistantChannel = 'voice' | 'messaging';

/**
 * Sub-canales de messaging
 */
export type MessagingSubChannel =
  | 'whatsapp'
  | 'instagram'
  | 'messenger'
  | 'webchat'
  | 'tiktok'
  | 'facebook';

/**
 * Array de canales para validación runtime
 */
export const ASSISTANT_CHANNELS: AssistantChannel[] = ['voice', 'messaging'];

/**
 * Array de sub-canales de messaging para validación runtime
 */
export const MESSAGING_SUB_CHANNELS: MessagingSubChannel[] = [
  'whatsapp',
  'instagram',
  'messenger',
  'webchat',
  'tiktok',
  'facebook',
];

// ======================
// VERTICALS
// ======================

/**
 * Verticales de negocio soportadas
 */
export type Vertical = 'restaurant' | 'dental' | 'clinic';

/**
 * Array de verticales para validación runtime
 */
export const VERTICALS: Vertical[] = ['restaurant', 'dental', 'clinic'];

/**
 * Información de display para verticales
 */
export const VERTICAL_INFO: Record<Vertical, { displayName: string; description: string; icon: string }> = {
  restaurant: {
    displayName: 'Restaurante',
    description: 'Reservaciones, pedidos, menú y más',
    icon: 'utensils',
  },
  dental: {
    displayName: 'Dental',
    description: 'Citas, servicios, doctores y emergencias',
    icon: 'tooth',
  },
  clinic: {
    displayName: 'Consultorios',
    description: 'Consultas, pacientes, servicios médicos y estéticos',
    icon: 'stethoscope',
  },
};

// ======================
// ASSISTANT TYPE LEVELS
// ======================

/**
 * Niveles de tipo de asistente
 * NOTA: dental_basic ha sido eliminado, dental solo tiene standard y complete
 */
export type AssistantTypeLevel = 'basic' | 'standard' | 'complete';

/**
 * Array de niveles para validación runtime
 */
export const ASSISTANT_TYPE_LEVELS: AssistantTypeLevel[] = ['basic', 'standard', 'complete'];

/**
 * Información de display para niveles
 */
export const LEVEL_INFO: Record<AssistantTypeLevel, { displayName: string; description: string }> = {
  basic: {
    displayName: 'Básico',
    description: 'Funcionalidad esencial para empezar',
  },
  standard: {
    displayName: 'Estándar',
    description: 'Funcionalidad intermedia, recomendada para la mayoría',
  },
  complete: {
    displayName: 'Completo',
    description: 'Todas las funcionalidades disponibles',
  },
};

// ======================
// UNIFIED ASSISTANT TYPE IDs
// ======================

/**
 * IDs de tipos de asistente activos
 * IMPORTANTE: dental_basic ha sido deprecado y migrado a dental_standard
 */
export type UnifiedAssistantTypeId =
  // Restaurant: 3 niveles
  | 'rest_basic'
  | 'rest_standard'
  | 'rest_complete'
  // Dental: 2 niveles (basic eliminado)
  | 'dental_standard'
  | 'dental_complete'
  // Clinic: 2 niveles (same as dental, medical workflows)
  | 'clinic_standard'
  | 'clinic_complete';

/**
 * Array de IDs activos para validación runtime
 */
export const UNIFIED_ASSISTANT_TYPE_IDS: UnifiedAssistantTypeId[] = [
  'rest_basic',
  'rest_standard',
  'rest_complete',
  'dental_standard',
  'dental_complete',
  'clinic_standard',
  'clinic_complete',
];

/**
 * IDs deprecados (para compatibilidad hacia atrás)
 * @deprecated Usar UNIFIED_ASSISTANT_TYPE_IDS en su lugar
 */
export type DeprecatedAssistantTypeId = 'dental_basic';

/**
 * Array de IDs deprecados
 * @deprecated
 */
export const DEPRECATED_ASSISTANT_TYPE_IDS: DeprecatedAssistantTypeId[] = ['dental_basic'];

/**
 * Mapeo de IDs deprecados a sus reemplazos
 */
export const DEPRECATED_TYPE_MIGRATION: Record<DeprecatedAssistantTypeId, UnifiedAssistantTypeId> = {
  dental_basic: 'dental_standard',
};

// ======================
// CAPABILITIES
// ======================

/**
 * Todas las capacidades posibles del sistema
 * SINCRONIZADO CON: supabase/migrations/155_UNIFIED_ASSISTANT_TYPES.sql
 */
export type Capability =
  // Capacidades compartidas
  | 'business_hours'
  | 'business_info'
  | 'location_info' // Agregado para sincronizar con SQL
  | 'human_transfer'
  | 'faq'
  | 'invoicing'
  // Capacidades de restaurante
  | 'reservations'
  | 'menu_info'
  | 'recommendations'
  | 'orders'
  | 'order_status'
  | 'promotions'
  | 'delivery' // Capacidad de delivery (rest_complete)
  | 'leads' // Captura de leads (complete tiers)
  // Capacidades de dental
  | 'appointments'
  | 'services_info'
  | 'pricing' // Información de precios
  | 'doctor_info'
  | 'dentist_info' // Alias para compatibilidad con SQL
  | 'insurance_info'
  | 'appointment_management'
  | 'emergencies'
  | 'emergency_triage'; // Para dental_complete

/**
 * Capacidades compartidas entre verticales
 */
export type SharedCapability =
  | 'business_hours'
  | 'business_info'
  | 'human_transfer'
  | 'faq'
  | 'invoicing';

/**
 * Capacidades específicas de restaurante
 */
export type RestaurantCapability =
  | SharedCapability
  | 'reservations'
  | 'menu_info'
  | 'recommendations'
  | 'orders'
  | 'order_status'
  | 'promotions';

/**
 * Capacidades específicas de dental
 */
export type DentalCapability =
  | SharedCapability
  | 'appointments'
  | 'services_info'
  | 'doctor_info'
  | 'insurance_info'
  | 'appointment_management'
  | 'emergencies';

/**
 * Array de todas las capacidades para validación runtime
 * SINCRONIZADO CON: supabase/migrations/155_UNIFIED_ASSISTANT_TYPES.sql
 */
export const ALL_CAPABILITIES: Capability[] = [
  // Compartidas
  'business_hours',
  'business_info',
  'location_info',
  'human_transfer',
  'faq',
  'invoicing',
  'leads',
  // Restaurante
  'reservations',
  'menu_info',
  'recommendations',
  'orders',
  'order_status',
  'promotions',
  'delivery',
  // Dental
  'appointments',
  'services_info',
  'pricing',
  'doctor_info',
  'dentist_info',
  'insurance_info',
  'appointment_management',
  'emergencies',
  'emergency_triage',
];

/**
 * Capacidades por vertical
 * SINCRONIZADO CON: supabase/migrations/155_UNIFIED_ASSISTANT_TYPES.sql
 */
export const CAPABILITIES_BY_VERTICAL: Record<Vertical, Capability[]> = {
  restaurant: [
    'business_hours',
    'business_info',
    'location_info',
    'human_transfer',
    'faq',
    'invoicing',
    'leads',
    'reservations',
    'menu_info',
    'recommendations',
    'orders',
    'order_status',
    'promotions',
    'delivery',
  ],
  dental: [
    'business_hours',
    'business_info',
    'location_info',
    'human_transfer',
    'faq',
    'invoicing',
    'leads',
    'appointments',
    'services_info',
    'pricing',
    'doctor_info',
    'dentist_info',
    'insurance_info',
    'appointment_management',
    'emergencies',
    'emergency_triage',
  ],
  clinic: [
    'business_hours',
    'business_info',
    'location_info',
    'human_transfer',
    'faq',
    'invoicing',
    'leads',
    'appointments',
    'services_info',
    'pricing',
    'doctor_info',
    'insurance_info',
    'appointment_management',
    'emergencies',
    'emergency_triage',
  ],
};

// ======================
// TOOLS
// ======================

/**
 * Todas las herramientas disponibles
 * SINCRONIZADO CON: supabase/migrations/155_UNIFIED_ASSISTANT_TYPES.sql
 */
export type Tool =
  // Herramientas compartidas
  | 'get_business_hours'
  | 'get_business_info'
  | 'transfer_to_human'
  | 'request_invoice'
  | 'end_call'
  | 'end_conversation'
  | 'capture_lead' // Para tiers complete
  | 'handle_objection' // Para manejo de objeciones de venta
  // Herramientas de restaurante
  | 'check_availability' // Voice: check_availability
  | 'check_reservation_availability' // Messaging: check_reservation_availability (alias)
  | 'create_reservation'
  | 'modify_reservation'
  | 'cancel_reservation'
  | 'get_menu'
  | 'get_menu_item'
  | 'search_menu'
  | 'get_recommendations'
  | 'create_order'
  | 'modify_order'
  | 'cancel_order'
  | 'get_order_status'
  | 'calculate_delivery_time'
  | 'get_promotions'
  // Herramientas de dental
  | 'check_appointment_availability'
  | 'create_appointment'
  | 'modify_appointment'
  | 'cancel_appointment'
  | 'get_services'
  | 'get_service_info'
  | 'get_service_prices'
  | 'get_service_pricing' // Alias para Voice (SQL usa get_service_pricing)
  | 'get_doctors'
  | 'get_doctor_info'
  | 'get_dentist_info' // Alias para SQL compatibility
  | 'get_insurance_info'
  | 'check_insurance_coverage'
  | 'handle_emergency'
  | 'send_reminder'
  | 'search_faq' // Búsqueda en FAQ
  | 'get_faq'; // Obtener FAQ

/**
 * Array de todas las herramientas para validación runtime
 * SINCRONIZADO CON: supabase/migrations/155_UNIFIED_ASSISTANT_TYPES.sql
 */
export const ALL_TOOLS: Tool[] = [
  // Compartidas
  'get_business_hours',
  'get_business_info',
  'transfer_to_human',
  'request_invoice',
  'end_call',
  'end_conversation',
  'capture_lead',
  'handle_objection',
  // Restaurante
  'check_availability',
  'check_reservation_availability',
  'create_reservation',
  'modify_reservation',
  'cancel_reservation',
  'get_menu',
  'get_menu_item',
  'search_menu',
  'get_recommendations',
  'create_order',
  'modify_order',
  'cancel_order',
  'get_order_status',
  'calculate_delivery_time',
  'get_promotions',
  // Dental
  'check_appointment_availability',
  'create_appointment',
  'modify_appointment',
  'cancel_appointment',
  'get_services',
  'get_service_info',
  'get_service_prices',
  'get_service_pricing',
  'get_doctors',
  'get_doctor_info',
  'get_dentist_info',
  'get_insurance_info',
  'check_insurance_coverage',
  'handle_emergency',
  'send_reminder',
  'search_faq',
  'get_faq',
];

// ======================
// PERSONALITY TYPES
// ======================

/**
 * Tipos de personalidad del asistente
 * SINCRONIZADO CON:
 * - supabase/migrations/142_VOICE_ASSISTANT_TYPES.sql (Voice)
 *   Voice soporta: professional, professional_friendly, casual, formal, warm, energetic
 * - supabase/migrations/155_UNIFIED_ASSISTANT_TYPES.sql (Messaging)
 *   Messaging soporta: professional, professional_friendly, formal
 * - Templates Handlebars usan: professional, friendly, energetic, calm
 */
export type PersonalityType =
  | 'professional'
  | 'professional_friendly' // Default para ambos canales
  | 'friendly'
  | 'energetic'
  | 'calm'
  | 'formal'
  | 'casual' // Usado en SQL Voice
  | 'warm'; // Usado en SQL Voice

/**
 * Array de tipos de personalidad para validación runtime
 */
export const PERSONALITY_TYPES: PersonalityType[] = [
  'professional',
  'professional_friendly',
  'friendly',
  'energetic',
  'calm',
  'formal',
  'casual',
  'warm',
];

/**
 * Información de display para personalidades
 * SINCRONIZADO CON: PersonalityType union
 */
export const PERSONALITY_INFO: Record<PersonalityType, { displayName: string; description: string }> = {
  professional: {
    displayName: 'Profesional',
    description: 'Tono formal y cortés, ideal para consultorios',
  },
  professional_friendly: {
    displayName: 'Profesional Amigable',
    description: 'Balance entre formalidad y cercanía (recomendado)',
  },
  friendly: {
    displayName: 'Amigable',
    description: 'Tono cercano y cálido, ideal para restaurantes',
  },
  energetic: {
    displayName: 'Energético',
    description: 'Tono dinámico y entusiasta',
  },
  calm: {
    displayName: 'Calmado',
    description: 'Tono tranquilo y relajante, ideal para servicios de salud',
  },
  formal: {
    displayName: 'Formal',
    description: 'Tono muy formal, para contextos corporativos',
  },
  casual: {
    displayName: 'Casual',
    description: 'Tono relajado e informal, para negocios casuales',
  },
  warm: {
    displayName: 'Cálido',
    description: 'Tono acogedor y empático, ideal para atención al cliente',
  },
};

// ======================
// TENANT SERVICE OPTIONS
// ======================

/**
 * Opciones de servicio configurables por tenant
 * Sincronizado con columna service_options en tabla tenants
 */
export interface TenantServiceOptions {
  // Servicios de restaurante
  dine_in_enabled: boolean;
  pickup_enabled: boolean;
  delivery_enabled: boolean;

  // Configuración de delivery
  delivery_config: DeliveryConfig;

  // Configuración de pickup
  pickup_config: PickupConfig;

  // Servicios adicionales
  reservations_enabled: boolean;
  catering_enabled: boolean;

  // Actualización
  updated_at?: string;
}

/**
 * Configuración específica de delivery
 */
export interface DeliveryConfig {
  /** ID del proveedor de delivery (UberDirect, Rappi, interno) */
  provider: DeliveryProvider;

  /** Radio máximo de delivery en km */
  max_radius_km: number;

  /** Monto mínimo de pedido para delivery */
  minimum_order_amount: number;

  /** Costo de delivery fijo (si aplica) */
  delivery_fee: number;

  /** Tiempo estimado base en minutos */
  estimated_time_minutes: number;

  /** Zonas de delivery definidas (códigos postales o polígonos) */
  delivery_zones?: DeliveryZoneConfig[];
}

/**
 * Proveedores de delivery soportados
 */
export type DeliveryProvider = 'disabled' | 'internal' | 'uber_direct' | 'rappi' | 'didi_food' | 'custom';

/**
 * Configuración simplificada de zona de delivery para service_options
 * NOTA: Para el tipo completo de zona ver delivery-types.ts DeliveryZone
 */
export interface DeliveryZoneConfig {
  id: string;
  name: string;
  type: 'postal_code' | 'polygon' | 'radius';
  value: string | string[] | number;
  delivery_fee_override?: number;
  estimated_time_override?: number;
  is_active: boolean;
}

/**
 * Configuración específica de pickup
 */
export interface PickupConfig {
  /** Tiempo mínimo de preparación en minutos */
  min_preparation_time: number;

  /** Slots de tiempo disponibles para pickup */
  time_slots_enabled: boolean;

  /** Duración de cada slot en minutos */
  slot_duration_minutes: number;

  /** Instrucciones de pickup para el cliente */
  pickup_instructions?: string;
}

/**
 * Valores por defecto para service_options
 */
export const DEFAULT_SERVICE_OPTIONS: TenantServiceOptions = {
  dine_in_enabled: true,
  pickup_enabled: true,
  delivery_enabled: false,
  delivery_config: {
    provider: 'internal',
    max_radius_km: 5,
    minimum_order_amount: 0,
    delivery_fee: 0,
    estimated_time_minutes: 30,
    delivery_zones: [],
  },
  pickup_config: {
    min_preparation_time: 15,
    time_slots_enabled: false,
    slot_duration_minutes: 15,
    pickup_instructions: undefined,
  },
  reservations_enabled: true,
  catering_enabled: false,
};

// ======================
// UNIFIED ASSISTANT TYPE INTERFACE
// ======================

/**
 * Definición completa de un tipo de asistente unificado
 * Válido tanto para Voice como para Messaging
 */
export interface UnifiedAssistantType {
  /** ID único del tipo (ej: 'rest_standard') */
  id: UnifiedAssistantTypeId;

  /** Nombre interno (igual que id) */
  name: string;

  /** Nombre para mostrar en UI */
  displayName: string;

  /** Descripción larga para UI */
  description: string;

  /** Vertical del negocio */
  vertical: Vertical;

  /** Nivel de funcionalidad */
  level: AssistantTypeLevel;

  /** Canal principal (voice o messaging) */
  channel: AssistantChannel;

  /** Capacidades habilitadas */
  enabledCapabilities: Capability[];

  /** Herramientas disponibles */
  availableTools: ToolDefinition[];

  /** Voice ID por defecto (solo para voice) */
  defaultVoiceId?: string;

  /** Personalidad por defecto */
  defaultPersonality: PersonalityType;

  /** Nombre del template de prompt */
  promptTemplateName: string;

  /** Versión del template */
  templateVersion: string;

  /** Duración máxima de llamada en segundos (solo voice) */
  maxCallDurationSeconds?: number;

  /** Si el tipo está activo */
  isActive: boolean;

  /** Orden de display */
  sortOrder: number;

  /** Si es el tipo recomendado para su vertical */
  isRecommended: boolean;

  /** Nombre del ícono para UI */
  iconName?: string;

  /** Lista de features para mostrar en UI */
  features: string[];

  /** Timestamp de creación */
  createdAt?: string;

  /** Timestamp de última actualización */
  updatedAt?: string;
}

/**
 * Definición de una herramienta
 */
export interface ToolDefinition {
  /** Nombre de la herramienta */
  name: Tool;

  /** Si la herramienta está habilitada */
  enabled: boolean;

  /** Descripción de la herramienta */
  description?: string;

  /** Si la herramienta requiere confirmación del usuario */
  requiresConfirmation?: boolean;

  /** Configuración adicional específica de la herramienta */
  config?: Record<string, unknown>;
}

// ======================
// DATABASE ROW TYPES
// ======================

/**
 * Fila de voice_assistant_types desde la base de datos
 * NOTA: SQL usa 'tier' pero internamente mapeamos a 'level'
 * SINCRONIZADO CON: supabase/migrations/142_VOICE_ASSISTANT_TYPES.sql
 *                   supabase/migrations/155_UNIFIED_ASSISTANT_TYPES.sql (agrega tier, is_recommended, icon, badge_text)
 */
export interface VoiceAssistantTypeRow {
  id: string;
  name: string;
  display_name: string;
  description: string;
  vertical: string;
  tier: string; // SQL usa 'tier' (agregado en 155), se mapea a 'level' en conversión
  enabled_capabilities: string[]; // JSONB array
  available_tools: ToolDefinitionRow[]; // JSONB array
  default_voice_id: string | null;
  default_personality: string;
  prompt_template_name: string;
  template_version: number; // INTEGER en SQL, no string
  max_call_duration_seconds: number;
  is_active: boolean;
  display_order: number; // SQL usa display_order, no sort_order
  is_recommended: boolean; // Agregado en migración 155
  icon: string | null; // SQL usa 'icon', no 'icon_name' (agregado en 155)
  badge_text: string | null; // Agregado en migración 155
  created_at: string;
  updated_at: string;
}

/**
 * Fila de messaging_assistant_types desde la base de datos
 * NOTA: SQL usa 'tier' pero internamente mapeamos a 'level'
 */
export interface MessagingAssistantTypeRow {
  id: string;
  name: string;
  display_name: string;
  description: string;
  vertical: string;
  tier: string; // SQL usa 'tier', se mapea a 'level' en conversión
  enabled_capabilities: string[];
  available_tools: ToolDefinitionRow[];
  default_personality: string;
  prompt_template_name: string;
  template_version: number;
  is_active: boolean;
  display_order: number; // SQL usa display_order, no sort_order
  is_recommended: boolean;
  icon: string | null; // SQL usa 'icon', no 'icon_name'
  badge_text: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Definición de herramienta desde la base de datos (JSON)
 */
export interface ToolDefinitionRow {
  name: string;
  enabled: boolean;
  description?: string;
  requires_confirmation?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Resultado de la función get_unified_assistant_types
 * SINCRONIZADO CON: supabase/migrations/155_UNIFIED_ASSISTANT_TYPES.sql
 */
export interface UnifiedAssistantTypeQueryResult {
  id: string;
  name: string;
  display_name: string;
  description: string;
  vertical: string;
  tier: string; // SQL usa 'tier', se mapea a 'level' en conversión
  enabled_capabilities: string[];
  available_tools: ToolDefinitionRow[];
  default_personality: string;
  prompt_template_name: string;
  is_active: boolean;
  is_recommended: boolean;
  display_order: number;
  icon: string | null;
  badge_text: string | null;
  available_channels: string[];
}

// ======================
// TYPE GUARDS
// ======================

/**
 * Verifica si un string es un Vertical válido
 */
export function isValidVertical(value: string): value is Vertical {
  return VERTICALS.includes(value as Vertical);
}

/**
 * Verifica si un string es un UnifiedAssistantTypeId válido
 */
export function isValidUnifiedAssistantTypeId(value: string): value is UnifiedAssistantTypeId {
  return UNIFIED_ASSISTANT_TYPE_IDS.includes(value as UnifiedAssistantTypeId);
}

/**
 * Verifica si un string es un ID deprecado
 */
export function isDeprecatedAssistantTypeId(value: string): value is DeprecatedAssistantTypeId {
  return DEPRECATED_ASSISTANT_TYPE_IDS.includes(value as DeprecatedAssistantTypeId);
}

/**
 * Verifica si un string es una Capability válida
 */
export function isValidCapability(value: string): value is Capability {
  return ALL_CAPABILITIES.includes(value as Capability);
}

/**
 * Verifica si un string es un Tool válido
 */
export function isValidTool(value: string): value is Tool {
  return ALL_TOOLS.includes(value as Tool);
}

/**
 * Verifica si un string es un PersonalityType válido
 */
export function isValidPersonalityType(value: string): value is PersonalityType {
  return PERSONALITY_TYPES.includes(value as PersonalityType);
}

/**
 * Verifica si un string es un AssistantTypeLevel válido
 */
export function isValidAssistantTypeLevel(value: string): value is AssistantTypeLevel {
  return ASSISTANT_TYPE_LEVELS.includes(value as AssistantTypeLevel);
}

/**
 * Verifica si un string es un AssistantChannel válido
 */
export function isValidAssistantChannel(value: string): value is AssistantChannel {
  return ASSISTANT_CHANNELS.includes(value as AssistantChannel);
}

// ======================
// CONVERTERS
// ======================

/**
 * Convierte una fila de base de datos a UnifiedAssistantType
 * Soporta el resultado de get_unified_assistant_types()
 * NOTA: SQL usa 'tier' pero internamente usamos 'level'
 */
export function rowToUnifiedAssistantType(
  row: UnifiedAssistantTypeQueryResult
): UnifiedAssistantType {
  // Validar campos críticos - usar 'name' como ID ya que es el identificador único
  const typeId = row.name;
  if (!isValidUnifiedAssistantTypeId(typeId) && !isDeprecatedAssistantTypeId(typeId)) {
    throw new Error(`Invalid assistant type ID from database: ${typeId}`);
  }

  if (!isValidVertical(row.vertical)) {
    throw new Error(`Invalid vertical from database: ${row.vertical}`);
  }

  // SQL usa 'tier', mapeamos a 'level'
  if (!isValidAssistantTypeLevel(row.tier)) {
    throw new Error(`Invalid tier/level from database: ${row.tier}`);
  }

  if (!isValidPersonalityType(row.default_personality)) {
    throw new Error(`Invalid personality from database: ${row.default_personality}`);
  }

  // Determinar el canal desde available_channels
  const channel: AssistantChannel = row.available_channels.includes('voice') ? 'voice' : 'messaging';

  // Validar y filtrar capacidades - enabled_capabilities viene como string[] desde JSONB
  const capabilities = Array.isArray(row.enabled_capabilities)
    ? row.enabled_capabilities
    : [];
  const validCapabilities = capabilities.filter(isValidCapability);
  if (validCapabilities.length !== capabilities.length) {
    const invalid = capabilities.filter((c) => !isValidCapability(c));
    console.warn(
      `[rowToUnifiedAssistantType] Invalid capabilities ignored for ${typeId}:`,
      invalid
    );
  }

  // Convertir herramientas - available_tools viene como JSONB array
  const toolsArray = Array.isArray(row.available_tools) ? row.available_tools : [];
  const tools: ToolDefinition[] = toolsArray.map((t) => ({
    name: t.name as Tool,
    enabled: t.enabled !== false, // Default true si no especificado
    description: t.description,
    requiresConfirmation: t.requires_confirmation,
    config: t.config,
  }));

  // Manejar ID deprecado
  const id = isDeprecatedAssistantTypeId(typeId)
    ? DEPRECATED_TYPE_MIGRATION[typeId]
    : (typeId as UnifiedAssistantTypeId);

  return {
    id,
    name: row.name,
    displayName: row.display_name,
    description: row.description ?? '',
    vertical: row.vertical as Vertical,
    level: row.tier as AssistantTypeLevel, // Mapear tier -> level
    channel,
    enabledCapabilities: validCapabilities,
    availableTools: tools,
    defaultVoiceId: undefined, // No viene de get_unified_assistant_types
    defaultPersonality: row.default_personality as PersonalityType,
    promptTemplateName: row.prompt_template_name,
    templateVersion: '1', // Default
    maxCallDurationSeconds: undefined, // No viene de esta función
    isActive: row.is_active,
    sortOrder: row.display_order,
    isRecommended: row.is_recommended,
    iconName: row.icon ?? undefined,
    features: [], // No viene de get_unified_assistant_types
  };
}

/**
 * Convierte UnifiedAssistantType a información de display para UI
 */
export function typeToDisplayInfo(type: UnifiedAssistantType): AssistantTypeDisplayInfo {
  return {
    id: type.id,
    name: type.displayName,
    description: type.description,
    vertical: type.vertical,
    level: type.level,
    channel: type.channel,
    features: type.features,
    recommended: type.isRecommended,
    levelLabel: LEVEL_INFO[type.level].displayName,
    verticalLabel: VERTICAL_INFO[type.vertical].displayName,
    icon: type.iconName,
  };
}

/**
 * Información de display para un tipo de asistente
 */
export interface AssistantTypeDisplayInfo {
  id: UnifiedAssistantTypeId;
  name: string;
  description: string;
  vertical: Vertical;
  level: AssistantTypeLevel;
  channel: AssistantChannel;
  features: string[];
  recommended: boolean;
  levelLabel: string;
  verticalLabel: string;
  icon?: string;
}

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Obtiene los tipos de asistente disponibles para una vertical
 */
export function getAssistantTypesForVertical(
  types: UnifiedAssistantType[],
  vertical: Vertical
): UnifiedAssistantType[] {
  return types
    .filter((t) => t.vertical === vertical && t.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Obtiene los tipos de asistente disponibles para un canal
 */
export function getAssistantTypesForChannel(
  types: UnifiedAssistantType[],
  channel: AssistantChannel
): UnifiedAssistantType[] {
  return types
    .filter((t) => t.channel === channel && t.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Obtiene el tipo recomendado para una vertical y canal
 */
export function getRecommendedType(
  types: UnifiedAssistantType[],
  vertical: Vertical,
  channel: AssistantChannel
): UnifiedAssistantType | undefined {
  return types.find(
    (t) => t.vertical === vertical && t.channel === channel && t.isRecommended && t.isActive
  );
}

/**
 * Verifica si una capacidad está habilitada para un tipo
 */
export function isCapabilityEnabled(
  type: UnifiedAssistantType,
  capability: Capability
): boolean {
  return type.enabledCapabilities.includes(capability);
}

/**
 * Verifica si una herramienta está disponible para un tipo
 */
export function isToolAvailable(type: UnifiedAssistantType, toolName: Tool): boolean {
  return type.availableTools.some((t) => t.name === toolName && t.enabled);
}

/**
 * Obtiene la definición de una herramienta para un tipo
 */
export function getToolDefinition(
  type: UnifiedAssistantType,
  toolName: Tool
): ToolDefinition | undefined {
  return type.availableTools.find((t) => t.name === toolName);
}

/**
 * Compara dos tipos de asistente
 */
export function compareAssistantTypes(
  typeA: UnifiedAssistantType,
  typeB: UnifiedAssistantType
): AssistantTypeComparison {
  const capabilitiesA = new Set(typeA.enabledCapabilities);
  const capabilitiesB = new Set(typeB.enabledCapabilities);

  const toolsA = new Set(typeA.availableTools.filter((t) => t.enabled).map((t) => t.name));
  const toolsB = new Set(typeB.availableTools.filter((t) => t.enabled).map((t) => t.name));

  return {
    typeA: typeA.id,
    typeB: typeB.id,
    capabilitiesOnlyInA: Array.from(capabilitiesA).filter((c) => !capabilitiesB.has(c)),
    capabilitiesOnlyInB: Array.from(capabilitiesB).filter((c) => !capabilitiesA.has(c)),
    sharedCapabilities: Array.from(capabilitiesA).filter((c) => capabilitiesB.has(c)),
    toolsOnlyInA: Array.from(toolsA).filter((t) => !toolsB.has(t)),
    toolsOnlyInB: Array.from(toolsB).filter((t) => !toolsA.has(t)),
    sharedTools: Array.from(toolsA).filter((t) => toolsB.has(t)),
  };
}

/**
 * Resultado de comparación entre tipos
 */
export interface AssistantTypeComparison {
  typeA: UnifiedAssistantTypeId;
  typeB: UnifiedAssistantTypeId;
  capabilitiesOnlyInA: Capability[];
  capabilitiesOnlyInB: Capability[];
  sharedCapabilities: Capability[];
  toolsOnlyInA: Tool[];
  toolsOnlyInB: Tool[];
  sharedTools: Tool[];
}

/**
 * Migra un ID deprecado a su reemplazo
 * @returns El ID migrado o el original si no está deprecado
 */
export function migrateDeprecatedTypeId(
  typeId: string
): UnifiedAssistantTypeId | string {
  if (isDeprecatedAssistantTypeId(typeId)) {
    console.warn(
      `[migrateDeprecatedTypeId] Type '${typeId}' is deprecated, migrating to '${DEPRECATED_TYPE_MIGRATION[typeId]}'`
    );
    return DEPRECATED_TYPE_MIGRATION[typeId];
  }
  return typeId;
}

// ======================
// VALIDATION
// ======================

/**
 * Resultado de validación de configuración de asistente
 */
export interface AssistantTypeValidationResult {
  valid: boolean;
  errors: AssistantTypeValidationError[];
  warnings: string[];
}

/**
 * Error de validación individual
 */
export interface AssistantTypeValidationError {
  field: string;
  message: string;
  code: AssistantTypeErrorCode;
}

/**
 * Códigos de error de validación
 */
export type AssistantTypeErrorCode =
  | 'INVALID_TYPE_ID'
  | 'TYPE_NOT_FOUND'
  | 'TYPE_INACTIVE'
  | 'TYPE_DEPRECATED'
  | 'VERTICAL_MISMATCH'
  | 'CHANNEL_MISMATCH'
  | 'INVALID_CAPABILITY'
  | 'CAPABILITY_NOT_SUPPORTED'
  | 'INVALID_TOOL'
  | 'TOOL_NOT_SUPPORTED'
  | 'INVALID_VOICE_ID'
  | 'INVALID_PERSONALITY'
  | 'INVALID_DURATION'
  | 'SERVICE_NOT_ENABLED';

/**
 * Valida un tipo de asistente contra las opciones de servicio del tenant
 */
export function validateTypeWithServiceOptions(
  type: UnifiedAssistantType,
  serviceOptions: TenantServiceOptions
): AssistantTypeValidationResult {
  const errors: AssistantTypeValidationError[] = [];
  const warnings: string[] = [];

  // Verificar capacidades de orders contra delivery/pickup
  if (isCapabilityEnabled(type, 'orders')) {
    if (!serviceOptions.pickup_enabled && !serviceOptions.delivery_enabled) {
      errors.push({
        field: 'orders',
        message: 'Capacidad de órdenes habilitada pero pickup y delivery están desactivados',
        code: 'SERVICE_NOT_ENABLED',
      });
    }

    if (serviceOptions.delivery_enabled && !serviceOptions.delivery_config.provider) {
      warnings.push('Delivery habilitado pero sin proveedor configurado');
    }
  }

  // Verificar reservaciones
  if (isCapabilityEnabled(type, 'reservations') && !serviceOptions.reservations_enabled) {
    warnings.push('Capacidad de reservaciones habilitada pero servicio de reservaciones está desactivado');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ======================
// EXPORTS FOR BACKWARDS COMPATIBILITY
// ======================

/**
 * @deprecated Usar UnifiedAssistantTypeId en su lugar
 */
export type AssistantTypeId = UnifiedAssistantTypeId | DeprecatedAssistantTypeId;

/**
 * @deprecated Usar UnifiedAssistantType en su lugar
 */
export type AssistantType = UnifiedAssistantType;

/**
 * @deprecated Usar UNIFIED_ASSISTANT_TYPE_IDS en su lugar
 */
export const ASSISTANT_TYPE_IDS: AssistantTypeId[] = [
  ...UNIFIED_ASSISTANT_TYPE_IDS,
  ...DEPRECATED_ASSISTANT_TYPE_IDS,
];

/**
 * TIS TIS Platform - Voice Agent v2.0
 * Assistant Types - Core Types and Interfaces
 *
 * Defines all types for the predefined assistant type system:
 * - AssistantType: Complete definition of an assistant type
 * - Capability: Features available to each type
 * - Tools: Functions the assistant can call
 *
 * Three verticals supported:
 * - Restaurant: rest_basic, rest_standard, rest_complete
 * - Dental: dental_basic, dental_standard, dental_complete
 * - Clinic: clinic_basic, clinic_standard, clinic_complete (medical clinics)
 */

// =====================================================
// VERTICALS
// =====================================================

/**
 * Supported business verticals
 */
export type Vertical = 'restaurant' | 'dental' | 'clinic';

/**
 * Available verticals list (for validation)
 */
export const VERTICALS: Vertical[] = ['restaurant', 'dental', 'clinic'];

// =====================================================
// CAPABILITIES
// =====================================================

/**
 * All possible capabilities across verticals
 */
export type Capability =
  // Shared capabilities
  | 'business_hours'
  | 'business_info'
  | 'human_transfer'
  | 'faq'
  | 'invoicing' // Para facturación (request_invoice tool)
  // Restaurant capabilities
  | 'reservations'
  | 'menu_info'
  | 'recommendations'
  | 'orders'
  | 'order_status'
  | 'promotions'
  | 'delivery' // Added in v2.1 - Migration 156
  // Dental capabilities
  | 'appointments'
  | 'services_info'
  | 'doctor_info'
  | 'insurance_info'
  | 'appointment_management'
  | 'emergencies';

/**
 * Capabilities specific to restaurant vertical
 */
export type RestaurantCapability =
  | 'business_hours'
  | 'business_info'
  | 'human_transfer'
  | 'faq'
  | 'invoicing'
  | 'reservations'
  | 'menu_info'
  | 'recommendations'
  | 'orders'
  | 'order_status'
  | 'promotions'
  | 'delivery'; // Added in v2.1 - Migration 156

/**
 * Capabilities specific to dental vertical
 */
export type DentalCapability =
  | 'business_hours'
  | 'business_info'
  | 'human_transfer'
  | 'faq'
  | 'invoicing'
  | 'appointments'
  | 'services_info'
  | 'doctor_info'
  | 'insurance_info'
  | 'appointment_management'
  | 'emergencies';

// =====================================================
// TOOLS
// =====================================================

/**
 * All available tools across verticals
 */
export type Tool =
  // Shared tools
  | 'get_business_hours'
  | 'get_business_info'
  | 'transfer_to_human'
  | 'request_invoice'
  | 'end_call'
  // Restaurant tools
  | 'check_availability'
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
  // Restaurant - Delivery tools (Added in v2.1 - Migration 156)
  | 'calculate_delivery'
  | 'get_delivery_status'
  // Dental tools
  | 'check_appointment_availability'
  | 'create_appointment'
  | 'modify_appointment'
  | 'cancel_appointment'
  | 'get_services'
  | 'get_service_info'
  | 'get_service_prices'
  | 'get_doctors'
  | 'get_doctor_info'
  | 'get_insurance_info'
  | 'check_insurance_coverage'
  | 'handle_emergency'
  | 'send_reminder';

/**
 * All capabilities as array (for runtime validation)
 */
export const ALL_CAPABILITIES: Capability[] = [
  // Shared
  'business_hours',
  'business_info',
  'human_transfer',
  'faq',
  'invoicing',
  // Restaurant
  'reservations',
  'menu_info',
  'recommendations',
  'orders',
  'order_status',
  'promotions',
  'delivery', // Added in v2.1 - Migration 156
  // Dental
  'appointments',
  'services_info',
  'doctor_info',
  'insurance_info',
  'appointment_management',
  'emergencies',
];

/**
 * All tools as array (for runtime validation)
 */
export const ALL_TOOLS: Tool[] = [
  // Shared
  'get_business_hours',
  'get_business_info',
  'transfer_to_human',
  'request_invoice',
  'end_call',
  // Restaurant
  'check_availability',
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
  // Restaurant - Delivery (Added in v2.1 - Migration 156)
  'calculate_delivery',
  'get_delivery_status',
  // Dental
  'check_appointment_availability',
  'create_appointment',
  'modify_appointment',
  'cancel_appointment',
  'get_services',
  'get_service_info',
  'get_service_prices',
  'get_doctors',
  'get_doctor_info',
  'get_insurance_info',
  'check_insurance_coverage',
  'handle_emergency',
  'send_reminder',
];

/**
 * Check if string is a valid Capability
 */
export function isValidCapability(value: string): value is Capability {
  return ALL_CAPABILITIES.includes(value as Capability);
}

/**
 * Check if string is a valid Tool
 */
export function isValidTool(value: string): value is Tool {
  return ALL_TOOLS.includes(value as Tool);
}

// =====================================================
// PERSONALITY TYPES
// =====================================================

/**
 * Voice personality types
 */
export type PersonalityType = 'professional' | 'friendly' | 'energetic' | 'calm';

/**
 * Personality descriptions for UI
 */
export const PERSONALITY_DESCRIPTIONS: Record<PersonalityType, string> = {
  professional: 'Tono formal y cortés, ideal para consultorios',
  friendly: 'Tono amigable y cercano, ideal para restaurantes',
  energetic: 'Tono dinámico y entusiasta',
  calm: 'Tono tranquilo y relajante, ideal para servicios de salud',
};

// =====================================================
// ASSISTANT TYPE LEVELS
// =====================================================

/**
 * Level of assistant type
 */
export type AssistantTypeLevel = 'basic' | 'standard' | 'complete';

/**
 * Level descriptions for UI
 */
export const LEVEL_DESCRIPTIONS: Record<AssistantTypeLevel, string> = {
  basic: 'Funcionalidad básica para empezar',
  standard: 'Funcionalidad intermedia, recomendada',
  complete: 'Todas las funcionalidades disponibles',
};

// =====================================================
// ASSISTANT TYPE ID
// =====================================================

/**
 * All valid assistant type IDs
 */
export type AssistantTypeId =
  | 'rest_basic'
  | 'rest_standard'
  | 'rest_complete'
  | 'dental_basic'
  | 'dental_standard'
  | 'dental_complete';

/**
 * All valid assistant type IDs as array (for validation)
 */
export const ASSISTANT_TYPE_IDS: AssistantTypeId[] = [
  'rest_basic',
  'rest_standard',
  'rest_complete',
  'dental_basic',
  'dental_standard',
  'dental_complete',
];

// =====================================================
// MAIN ASSISTANT TYPE INTERFACE
// =====================================================

/**
 * Complete definition of an assistant type
 */
export interface AssistantType {
  /** Unique identifier (e.g., 'rest_basic', 'dental_complete') */
  id: AssistantTypeId;

  /** Internal name (same as id) */
  name: string;

  /** Display name for UI (e.g., 'Reservaciones', 'Completo') */
  displayName: string;

  /** Long description for UI */
  description: string;

  /** Business vertical this type belongs to */
  vertical: Vertical;

  /** Level of functionality */
  level: AssistantTypeLevel;

  /** Capabilities enabled for this type */
  enabledCapabilities: Capability[];

  /** Tools available for this type */
  availableTools: Tool[];

  /** Default voice ID for this type */
  defaultVoiceId: string;

  /** Default personality for this type */
  defaultPersonality: PersonalityType;

  /** Prompt template name to use */
  promptTemplateName: string;

  /** Version of the prompt template */
  templateVersion: string;

  /** Maximum call duration in seconds */
  maxCallDurationSeconds: number;

  /** Whether this type is currently active */
  isActive: boolean;

  /** Sort order for UI display */
  sortOrder: number;

  /** Whether this is the recommended type for its vertical */
  isRecommended: boolean;

  /** Icon name for UI (optional) */
  iconName?: string;

  /** Features list for UI display */
  features: string[];

  /** Creation timestamp */
  createdAt?: string;

  /** Last update timestamp */
  updatedAt?: string;
}

// =====================================================
// ASSISTANT TYPE CONFIGURATION
// =====================================================

/**
 * Configuration that can be customized per tenant
 */
export interface AssistantTypeConfig {
  /** Base type being used */
  typeId: AssistantTypeId;

  /** Optional custom voice ID override */
  customVoiceId?: string;

  /** Optional custom personality override */
  customPersonality?: PersonalityType;

  /** Optional custom greeting */
  customGreeting?: string;

  /** Optional custom max duration override */
  customMaxDuration?: number;

  /** Whether to use custom settings */
  useCustomSettings: boolean;
}

/**
 * Resolved configuration (type + customizations)
 */
export interface ResolvedAssistantConfig {
  /** The base type */
  type: AssistantType;

  /** Effective voice ID (custom or default) */
  voiceId: string;

  /** Effective personality (custom or default) */
  personality: PersonalityType;

  /** Effective greeting */
  greeting: string;

  /** Effective max duration */
  maxDurationSeconds: number;
}

// =====================================================
// VALIDATION
// =====================================================

/**
 * Result of validating an assistant type configuration
 */
export interface AssistantTypeValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;

  /** Validation errors if any */
  errors: AssistantTypeValidationError[];

  /** Warnings (valid but not recommended) */
  warnings: string[];
}

/**
 * A single validation error
 */
export interface AssistantTypeValidationError {
  /** Field that has the error */
  field: string;

  /** Error message */
  message: string;

  /** Error code for programmatic handling */
  code: AssistantTypeErrorCode;
}

/**
 * Validation error codes
 */
export type AssistantTypeErrorCode =
  | 'INVALID_TYPE_ID'
  | 'TYPE_NOT_FOUND'
  | 'TYPE_INACTIVE'
  | 'VERTICAL_MISMATCH'
  | 'INVALID_CAPABILITY'
  | 'CAPABILITY_NOT_SUPPORTED'
  | 'INVALID_TOOL'
  | 'TOOL_NOT_SUPPORTED'
  | 'INVALID_VOICE_ID'
  | 'INVALID_PERSONALITY'
  | 'INVALID_DURATION';

// =====================================================
// UI HELPERS
// =====================================================

/**
 * Assistant type formatted for UI display
 */
export interface AssistantTypeDisplayInfo {
  /** Type ID */
  id: AssistantTypeId;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Feature list for bullets */
  features: string[];

  /** Whether this is the recommended option */
  recommended: boolean;

  /** Level label (Básico, Estándar, Completo) */
  levelLabel: string;

  /** Icon name */
  icon?: string;
}

/**
 * Comparison between two assistant types
 */
export interface AssistantTypeComparison {
  /** Type A */
  typeA: AssistantTypeId;

  /** Type B */
  typeB: AssistantTypeId;

  /** Capabilities in A but not in B */
  capabilitiesOnlyInA: Capability[];

  /** Capabilities in B but not in A */
  capabilitiesOnlyInB: Capability[];

  /** Capabilities in both */
  sharedCapabilities: Capability[];

  /** Tools in A but not in B */
  toolsOnlyInA: Tool[];

  /** Tools in B but not in A */
  toolsOnlyInB: Tool[];

  /** Tools in both */
  sharedTools: Tool[];
}

// =====================================================
// DATABASE ROW TYPE
// =====================================================

/**
 * Row format from voice_assistant_types table
 */
export interface AssistantTypeRow {
  id: string;
  name: string;
  display_name: string;
  description: string;
  vertical: string;
  level: string;
  enabled_capabilities: string[];
  available_tools: string[];
  default_voice_id: string;
  default_personality: string;
  prompt_template_name: string;
  template_version: string;
  max_call_duration_seconds: number;
  is_active: boolean;
  sort_order: number;
  is_recommended: boolean;
  icon_name: string | null;
  features: string[];
  created_at: string;
  updated_at: string;
}

// =====================================================
// TYPE GUARDS
// =====================================================

/**
 * Check if string is a valid Vertical
 */
export function isValidVertical(value: string): value is Vertical {
  return VERTICALS.includes(value as Vertical);
}

/**
 * Check if string is a valid AssistantTypeId
 */
export function isValidAssistantTypeId(value: string): value is AssistantTypeId {
  return ASSISTANT_TYPE_IDS.includes(value as AssistantTypeId);
}

/**
 * Check if string is a valid PersonalityType
 */
export function isValidPersonalityType(value: string): value is PersonalityType {
  return ['professional', 'friendly', 'energetic', 'calm'].includes(value);
}

/**
 * Check if string is a valid AssistantTypeLevel
 */
export function isValidAssistantTypeLevel(value: string): value is AssistantTypeLevel {
  return ['basic', 'standard', 'complete'].includes(value);
}

// =====================================================
// CONVERTERS
// =====================================================

/**
 * Convert database row to AssistantType with validation
 * Throws error if data is invalid
 */
export function rowToAssistantType(row: AssistantTypeRow): AssistantType {
  // Validate critical fields
  if (!isValidAssistantTypeId(row.id)) {
    throw new Error(`Invalid assistant type ID from database: ${row.id}`);
  }

  if (!isValidVertical(row.vertical)) {
    throw new Error(`Invalid vertical from database: ${row.vertical}`);
  }

  if (!isValidAssistantTypeLevel(row.level)) {
    throw new Error(`Invalid level from database: ${row.level}`);
  }

  if (!isValidPersonalityType(row.default_personality)) {
    throw new Error(`Invalid personality from database: ${row.default_personality}`);
  }

  // Validate capabilities array
  const validCapabilities = row.enabled_capabilities.filter(isValidCapability);
  if (validCapabilities.length !== row.enabled_capabilities.length) {
    const invalid = row.enabled_capabilities.filter((c) => !isValidCapability(c));
    console.warn(
      `[rowToAssistantType] Invalid capabilities ignored for ${row.id}:`,
      invalid
    );
  }

  // Validate tools array
  const validTools = row.available_tools.filter(isValidTool);
  if (validTools.length !== row.available_tools.length) {
    const invalid = row.available_tools.filter((t) => !isValidTool(t));
    console.warn(
      `[rowToAssistantType] Invalid tools ignored for ${row.id}:`,
      invalid
    );
  }

  return {
    id: row.id as AssistantTypeId,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    vertical: row.vertical as Vertical,
    level: row.level as AssistantTypeLevel,
    enabledCapabilities: validCapabilities,
    availableTools: validTools,
    defaultVoiceId: row.default_voice_id,
    defaultPersonality: row.default_personality as PersonalityType,
    promptTemplateName: row.prompt_template_name,
    templateVersion: row.template_version,
    maxCallDurationSeconds: row.max_call_duration_seconds,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    isRecommended: row.is_recommended,
    iconName: row.icon_name ?? undefined,
    features: row.features ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert AssistantType to display info
 */
export function typeToDisplayInfo(type: AssistantType): AssistantTypeDisplayInfo {
  const levelLabels: Record<AssistantTypeLevel, string> = {
    basic: 'Básico',
    standard: 'Estándar',
    complete: 'Completo',
  };

  return {
    id: type.id,
    name: type.displayName,
    description: type.description,
    features: type.features,
    recommended: type.isRecommended,
    levelLabel: levelLabels[type.level],
    icon: type.iconName,
  };
}

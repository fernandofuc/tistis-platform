// =====================================================
// TIS TIS PLATFORM - Shared Configuration for Agent Messages Module
// Centralized configuration values for all tabs
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

// ======================
// DELAY OPTIONS
// ======================

export interface DelayOption {
  value: number;
  label: string;
  description: string;
  recommended?: boolean;
}

/**
 * Delay options for Business Profile
 * Business profiles typically use shorter/immediate delays
 */
export const BUSINESS_DELAY_OPTIONS: DelayOption[] = [
  { value: 0, label: 'Inmediato', description: 'Responde al instante' },
  { value: 1, label: '1 minuto', description: 'Delay corto' },
  { value: 3, label: '3 minutos', description: 'Delay moderado' },
  { value: 5, label: '5 minutos', description: 'Delay natural' },
];

/**
 * Delay options for Personal Profile
 * Personal profiles use longer delays to appear more human
 */
export const PERSONAL_DELAY_OPTIONS: DelayOption[] = [
  { value: 3, label: '3 minutos', description: 'Delay corto' },
  { value: 5, label: '5 minutos', description: 'Delay natural' },
  { value: 8, label: '8 minutos', description: 'Más humano', recommended: true },
  { value: 15, label: '15 minutos', description: 'Muy ocupado' },
];

// ======================
// PERSONAL ASSISTANT TYPES
// ======================

export interface PersonalAssistantType {
  key: string;
  name: string;
  description: string;
  capabilities: { text: string; enabled: boolean }[];
  recommended?: boolean;
  icon: 'assistantComplete' | 'assistantBrand' | 'redirectOnly';
}

export const PERSONAL_ASSISTANT_TYPES: PersonalAssistantType[] = [
  {
    key: 'personal_complete',
    name: 'Asistente Completo',
    description: 'Citas, precios, leads y FAQ directamente desde tu cuenta personal',
    capabilities: [
      { text: 'Citas', enabled: true },
      { text: 'Precios', enabled: true },
      { text: 'Leads', enabled: true },
      { text: 'FAQ', enabled: true },
    ],
    recommended: true,
    icon: 'assistantComplete',
  },
  {
    key: 'personal_brand',
    name: 'Marca Personal',
    description: 'Contenido educativo y engagement, deriva servicios al negocio',
    capabilities: [
      { text: 'Educativo', enabled: true },
      { text: 'Engagement', enabled: true },
      { text: 'Citas', enabled: false },
      { text: 'Precios', enabled: false },
    ],
    recommended: false,
    icon: 'assistantBrand',
  },
  {
    key: 'personal_redirect',
    name: 'Solo Derivación',
    description: 'Solo redirige al negocio, no responde consultas',
    capabilities: [
      { text: 'Educativo', enabled: false },
      { text: 'Engagement', enabled: false },
      { text: 'Citas', enabled: false },
      { text: 'Precios', enabled: false },
    ],
    recommended: false,
    icon: 'redirectOnly',
  },
];

// ======================
// CAPABILITY LABELS
// ======================

export const CAPABILITY_LABELS: Record<string, string> = {
  booking: 'Citas',
  pricing: 'Precios',
  faq: 'FAQ',
  lead_capture: 'Leads',
  objections: 'Objeciones',
  location: 'Ubicación',
  hours: 'Horarios',
  reservations: 'Reservas',
  ordering: 'Pedidos',
  menu_info: 'Menú',
  redirect_to_clinic: 'Derivar',
  redirect_to_business: 'Derivar',
  basic_info: 'Info',
};

// ======================
// ESCALATION DEFAULTS
// ======================

export const DEFAULT_ESCALATION_KEYWORDS = [
  'queja',
  'molesto',
  'enojado',
  'gerente',
  'supervisor',
  'urgente',
  'emergencia',
];

// ======================
// PREVIEW SCENARIOS
// ======================

export interface PreviewScenario {
  id: string;
  label: string;
  message: string;
}

export const PREVIEW_SCENARIOS: PreviewScenario[] = [
  { id: 'price', label: 'Consulta de precio', message: 'Hola, cuanto cuesta una limpieza dental?' },
  { id: 'appointment', label: 'Agendar cita', message: 'Quiero agendar una cita para manana' },
  { id: 'location', label: 'Ubicacion', message: 'Donde estan ubicados?' },
  { id: 'hours', label: 'Horarios', message: 'A que hora abren?' },
];

// ======================
// TEMPLATE MAPPING UTILITIES
// ======================

/**
 * Maps a template key to its assistant type
 * Uses explicit matching for robustness instead of .includes()
 */
export function getAssistantTypeFromTemplate(templateKey: string): string {
  // Explicit mapping for all known personal templates
  const explicitMappings: Record<string, string> = {
    // Dental
    'dental_personal_complete': 'personal_complete',
    'dental_personal_brand': 'personal_brand',
    'dental_personal_redirect': 'personal_redirect',
    // Restaurant
    'resto_personal_complete': 'personal_complete',
    'resto_personal_brand': 'personal_brand',
    'resto_personal_redirect': 'personal_redirect',
    // General
    'general_personal_complete': 'personal_complete',
    'general_personal_brand': 'personal_brand',
    'general_personal_redirect': 'personal_redirect',
    // Legacy mappings (for backwards compatibility)
    'dental_personal': 'personal_brand',
    'dental_personal_full': 'personal_brand',
    'resto_personal_full': 'personal_brand',
    'general_personal': 'personal_brand',
    'general_personal_full': 'personal_brand',
  };

  // Check explicit mapping first
  if (templateKey in explicitMappings) {
    return explicitMappings[templateKey];
  }

  // Fallback: pattern matching for unknown templates
  if (templateKey.includes('_complete')) return 'personal_complete';
  if (templateKey.includes('_redirect')) return 'personal_redirect';
  if (templateKey.includes('_brand')) return 'personal_brand';

  // Default for new users
  return 'personal_complete';
}

/**
 * Gets the template key for a given vertical and assistant type
 * Handles all vertical types with fallback to 'general' for new/unsupported verticals
 */
export function getTemplateKeyForType(
  vertical: string,
  assistantType: string
): string {
  // Map vertical to template prefix
  const verticalToPrefixMap: Record<string, string> = {
    'dental': 'dental',
    'restaurant': 'resto',
    'medical': 'medical',
    'gym': 'gym',
    'beauty': 'beauty',
    'veterinary': 'veterinary',
    'services': 'services',
    'general': 'general',
  };

  const prefix = verticalToPrefixMap[vertical] || 'general';

  const typeToSuffix: Record<string, string> = {
    'personal_complete': 'personal_complete',
    'personal_brand': 'personal_brand',
    'personal_redirect': 'personal_redirect',
  };

  const suffix = typeToSuffix[assistantType] || 'personal_complete';
  return `${prefix}_${suffix}`;
}

// ======================
// VALIDATION UTILITIES
// ======================

/**
 * Validates that a template key is not empty before saving
 */
export function validateTemplateKey(templateKey: string | undefined | null): {
  isValid: boolean;
  error?: string;
} {
  if (!templateKey || templateKey.trim() === '') {
    return {
      isValid: false,
      error: 'Debes seleccionar un tipo de asistente antes de guardar',
    };
  }
  return { isValid: true };
}

/**
 * Validates profile name
 */
export function validateProfileName(name: string | undefined | null): {
  isValid: boolean;
  error?: string;
} {
  if (!name || name.trim() === '') {
    return {
      isValid: false,
      error: 'El nombre del perfil es requerido',
    };
  }
  if (name.trim().length < 2) {
    return {
      isValid: false,
      error: 'El nombre debe tener al menos 2 caracteres',
    };
  }
  if (name.trim().length > 100) {
    return {
      isValid: false,
      error: 'El nombre no puede exceder 100 caracteres',
    };
  }
  return { isValid: true };
}

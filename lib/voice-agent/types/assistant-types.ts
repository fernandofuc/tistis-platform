/**
 * TIS TIS Platform - Voice Agent v2.0
 * Assistant Type Definitions
 *
 * Complete definitions for all 6 predefined assistant types:
 *
 * Restaurant Vertical:
 * - rest_basic: Reservaciones básicas
 * - rest_standard: Reservaciones + Menú
 * - rest_complete: Todo incluido (+ pedidos)
 *
 * Dental Vertical:
 * - dental_basic: Citas básicas
 * - dental_standard: Citas + Servicios
 * - dental_complete: Todo incluido (+ urgencias)
 */

import type { AssistantType, AssistantTypeId } from './types';
import {
  RESTAURANT_CAPABILITIES,
  RESTAURANT_TOOLS,
  DENTAL_CAPABILITIES,
  DENTAL_TOOLS,
} from './capability-definitions';

// =====================================================
// RESTAURANT TYPES
// =====================================================

/**
 * Restaurant Basic - Reservaciones
 * Solo maneja reservaciones de mesa y consultas básicas
 */
export const REST_BASIC: AssistantType = {
  id: 'rest_basic',
  name: 'rest_basic',
  displayName: 'Reservaciones',
  description:
    'Asistente básico para manejo de reservaciones de mesa y consultas de horarios.',
  vertical: 'restaurant',
  level: 'basic',
  enabledCapabilities: RESTAURANT_CAPABILITIES.basic,
  availableTools: RESTAURANT_TOOLS.basic,
  defaultVoiceId: 'elevenlabs-maria',
  defaultPersonality: 'friendly',
  promptTemplateName: 'rest_basic_v1',
  templateVersion: '1.0',
  maxCallDurationSeconds: 300, // 5 minutes
  isActive: true,
  sortOrder: 1,
  isRecommended: false,
  iconName: 'calendar',
  features: [
    'Verificar disponibilidad de mesas',
    'Crear reservaciones',
    'Modificar o cancelar reservaciones',
    'Consultar horarios de atención',
    'Transferir a un agente humano',
  ],
};

/**
 * Restaurant Standard - Reservaciones + Menú
 * Maneja reservaciones y consultas del menú con recomendaciones
 */
export const REST_STANDARD: AssistantType = {
  id: 'rest_standard',
  name: 'rest_standard',
  displayName: 'Reservaciones + Menú',
  description:
    'Asistente intermedio que maneja reservaciones, consultas de menú, precios y recomendaciones personalizadas.',
  vertical: 'restaurant',
  level: 'standard',
  enabledCapabilities: RESTAURANT_CAPABILITIES.standard,
  availableTools: RESTAURANT_TOOLS.standard,
  defaultVoiceId: 'elevenlabs-maria',
  defaultPersonality: 'friendly',
  promptTemplateName: 'rest_standard_v1',
  templateVersion: '1.0',
  maxCallDurationSeconds: 420, // 7 minutes
  isActive: true,
  sortOrder: 2,
  isRecommended: true,
  iconName: 'utensils',
  features: [
    'Todo de Reservaciones, más:',
    'Consultar menú completo',
    'Buscar platillos específicos',
    'Dar recomendaciones personalizadas',
    'Informar precios y descripciones',
    'Responder preguntas frecuentes',
  ],
};

/**
 * Restaurant Complete - Todo Incluido
 * Incluye pedidos telefónicos, delivery y promociones
 */
export const REST_COMPLETE: AssistantType = {
  id: 'rest_complete',
  name: 'rest_complete',
  displayName: 'Completo',
  description:
    'Asistente completo con todas las funcionalidades: reservaciones, menú, pedidos telefónicos, delivery y promociones.',
  vertical: 'restaurant',
  level: 'complete',
  enabledCapabilities: RESTAURANT_CAPABILITIES.complete,
  availableTools: RESTAURANT_TOOLS.complete,
  defaultVoiceId: 'elevenlabs-maria',
  defaultPersonality: 'friendly',
  promptTemplateName: 'rest_complete_v1',
  templateVersion: '1.0',
  maxCallDurationSeconds: 600, // 10 minutes
  isActive: true,
  sortOrder: 3,
  isRecommended: false,
  iconName: 'star',
  features: [
    'Todo de Reservaciones + Menú, más:',
    'Tomar pedidos telefónicos',
    'Modificar pedidos existentes',
    'Calcular tiempos de entrega',
    'Consultar estado de pedidos',
    'Informar promociones activas',
  ],
};

// =====================================================
// DENTAL TYPES
// =====================================================

/**
 * Dental Basic - Citas
 * Solo maneja agendamiento de citas básicas
 */
export const DENTAL_BASIC: AssistantType = {
  id: 'dental_basic',
  name: 'dental_basic',
  displayName: 'Citas Básico',
  description:
    'Asistente básico para agendamiento de citas dentales y consultas de horarios.',
  vertical: 'dental',
  level: 'basic',
  enabledCapabilities: DENTAL_CAPABILITIES.basic,
  availableTools: DENTAL_TOOLS.basic,
  defaultVoiceId: 'elevenlabs-sofia',
  defaultPersonality: 'professional',
  promptTemplateName: 'dental_basic_v1',
  templateVersion: '1.0',
  maxCallDurationSeconds: 300, // 5 minutes
  isActive: true,
  sortOrder: 1,
  isRecommended: false,
  iconName: 'calendar-check',
  features: [
    'Verificar disponibilidad de citas',
    'Agendar citas nuevas',
    'Consultar horarios de atención',
    'Proporcionar información básica',
    'Transferir a un agente humano',
  ],
};

/**
 * Dental Standard - Citas + Servicios
 * Maneja citas e información de servicios y doctores
 */
export const DENTAL_STANDARD: AssistantType = {
  id: 'dental_standard',
  name: 'dental_standard',
  displayName: 'Citas + Servicios',
  description:
    'Asistente intermedio que maneja citas, información de servicios, precios aproximados y datos de doctores.',
  vertical: 'dental',
  level: 'standard',
  enabledCapabilities: DENTAL_CAPABILITIES.standard,
  availableTools: DENTAL_TOOLS.standard,
  defaultVoiceId: 'elevenlabs-sofia',
  defaultPersonality: 'professional',
  promptTemplateName: 'dental_standard_v1',
  templateVersion: '1.0',
  maxCallDurationSeconds: 420, // 7 minutes
  isActive: true,
  sortOrder: 2,
  isRecommended: true,
  iconName: 'tooth',
  features: [
    'Todo de Citas Básico, más:',
    'Informar sobre servicios disponibles',
    'Proporcionar precios aproximados',
    'Información de doctores y especialidades',
    'Responder preguntas frecuentes',
  ],
};

/**
 * Dental Complete - Todo Incluido
 * Incluye gestión de citas, seguros y urgencias
 */
export const DENTAL_COMPLETE: AssistantType = {
  id: 'dental_complete',
  name: 'dental_complete',
  displayName: 'Completo',
  description:
    'Asistente completo con todas las funcionalidades: citas, servicios, modificaciones, seguros y manejo de urgencias.',
  vertical: 'dental',
  level: 'complete',
  enabledCapabilities: DENTAL_CAPABILITIES.complete,
  availableTools: DENTAL_TOOLS.complete,
  defaultVoiceId: 'elevenlabs-sofia',
  defaultPersonality: 'professional',
  promptTemplateName: 'dental_complete_v1',
  templateVersion: '1.0',
  maxCallDurationSeconds: 600, // 10 minutes
  isActive: true,
  sortOrder: 3,
  isRecommended: false,
  iconName: 'star-of-life',
  features: [
    'Todo de Citas + Servicios, más:',
    'Modificar o cancelar citas',
    'Verificar cobertura de seguros',
    'Manejar urgencias dentales',
    'Enviar recordatorios de citas',
  ],
};

// =====================================================
// TYPE COLLECTION
// =====================================================

/**
 * All assistant types as an array
 */
export const ASSISTANT_TYPES: AssistantType[] = [
  REST_BASIC,
  REST_STANDARD,
  REST_COMPLETE,
  DENTAL_BASIC,
  DENTAL_STANDARD,
  DENTAL_COMPLETE,
];

/**
 * Assistant types indexed by ID for fast lookup
 */
export const ASSISTANT_TYPES_MAP: Record<AssistantTypeId, AssistantType> = {
  rest_basic: REST_BASIC,
  rest_standard: REST_STANDARD,
  rest_complete: REST_COMPLETE,
  dental_basic: DENTAL_BASIC,
  dental_standard: DENTAL_STANDARD,
  dental_complete: DENTAL_COMPLETE,
};

/**
 * Restaurant types only
 */
export const RESTAURANT_TYPES: AssistantType[] = [
  REST_BASIC,
  REST_STANDARD,
  REST_COMPLETE,
];

/**
 * Dental types only
 */
export const DENTAL_TYPES: AssistantType[] = [
  DENTAL_BASIC,
  DENTAL_STANDARD,
  DENTAL_COMPLETE,
];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get an assistant type by ID
 */
export function getAssistantTypeById(
  typeId: AssistantTypeId
): AssistantType | undefined {
  return ASSISTANT_TYPES_MAP[typeId];
}

/**
 * Get all assistant types for a vertical
 * Note: 'clinic' uses DENTAL_TYPES as they share similar medical workflows
 */
export function getTypesForVertical(
  vertical: 'restaurant' | 'dental' | 'clinic'
): AssistantType[] {
  if (vertical === 'restaurant') return RESTAURANT_TYPES;
  // 'dental' and 'clinic' share similar medical assistant types
  return DENTAL_TYPES;
}

/**
 * Get the recommended type for a vertical
 */
export function getRecommendedType(
  vertical: 'restaurant' | 'dental' | 'clinic'
): AssistantType {
  const types = getTypesForVertical(vertical);
  return types.find((t) => t.isRecommended) ?? types[0];
}

/**
 * Get all active types
 */
export function getActiveTypes(): AssistantType[] {
  return ASSISTANT_TYPES.filter((t) => t.isActive);
}

/**
 * Get active types for a vertical
 */
export function getActiveTypesForVertical(
  vertical: 'restaurant' | 'dental' | 'clinic'
): AssistantType[] {
  return getTypesForVertical(vertical).filter((t) => t.isActive);
}

/**
 * Check if a type ID exists
 */
export function typeExists(typeId: string): boolean {
  return typeId in ASSISTANT_TYPES_MAP;
}

/**
 * Get type IDs for a vertical
 */
export function getTypeIdsForVertical(
  vertical: 'restaurant' | 'dental' | 'clinic'
): AssistantTypeId[] {
  return getTypesForVertical(vertical).map((t) => t.id);
}

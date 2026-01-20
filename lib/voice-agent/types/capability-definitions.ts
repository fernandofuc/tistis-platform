/**
 * TIS TIS Platform - Voice Agent v2.0
 * Capability Definitions
 *
 * Defines which capabilities and tools are available for each
 * assistant type level within each vertical.
 *
 * Structure:
 * - Capabilities define WHAT the assistant can do
 * - Tools define HOW it does it (function calls)
 */

import type {
  Capability,
  Tool,
  AssistantTypeId,
  AssistantTypeLevel,
  Vertical,
} from './types';

// =====================================================
// CAPABILITY DESCRIPTIONS
// =====================================================

/**
 * Human-readable descriptions for each capability
 */
export const CAPABILITY_DESCRIPTIONS: Record<Capability, string> = {
  // Shared
  business_hours: 'Consultar horarios de atención',
  business_info: 'Proporcionar información general del negocio',
  human_transfer: 'Transferir a un agente humano',
  faq: 'Responder preguntas frecuentes',
  invoicing: 'Solicitar y gestionar facturas',

  // Restaurant
  reservations: 'Gestionar reservaciones de mesa',
  menu_info: 'Proporcionar información del menú',
  recommendations: 'Dar recomendaciones personalizadas',
  orders: 'Tomar pedidos telefónicos',
  order_status: 'Consultar estado de pedidos',
  promotions: 'Informar sobre promociones activas',

  // Dental
  appointments: 'Gestionar citas',
  services_info: 'Informar sobre servicios disponibles',
  doctor_info: 'Proporcionar información de doctores',
  insurance_info: 'Manejar consultas de seguros',
  appointment_management: 'Modificar y cancelar citas',
  emergencies: 'Manejar urgencias dentales',
};

// =====================================================
// TOOL DESCRIPTIONS
// =====================================================

/**
 * Human-readable descriptions for each tool
 */
export const TOOL_DESCRIPTIONS: Record<Tool, string> = {
  // Shared
  get_business_hours: 'Obtener horarios de atención',
  get_business_info: 'Obtener información del negocio',
  transfer_to_human: 'Transferir llamada a humano',
  request_invoice: 'Solicitar factura fiscal',
  end_call: 'Finalizar la llamada',

  // Restaurant - Reservations
  check_availability: 'Verificar disponibilidad de mesa',
  create_reservation: 'Crear nueva reservación',
  modify_reservation: 'Modificar reservación existente',
  cancel_reservation: 'Cancelar reservación',

  // Restaurant - Menu
  get_menu: 'Obtener menú completo o por categoría',
  get_menu_item: 'Obtener detalles de un platillo',
  search_menu: 'Buscar en el menú',
  get_recommendations: 'Obtener recomendaciones personalizadas',

  // Restaurant - Orders
  create_order: 'Crear pedido telefónico',
  modify_order: 'Modificar pedido existente',
  cancel_order: 'Cancelar pedido',
  get_order_status: 'Consultar estado de pedido',
  calculate_delivery_time: 'Calcular tiempo de entrega',
  get_promotions: 'Obtener promociones activas',

  // Dental - Appointments
  check_appointment_availability: 'Verificar disponibilidad de citas',
  create_appointment: 'Crear nueva cita',
  modify_appointment: 'Modificar cita existente',
  cancel_appointment: 'Cancelar cita',

  // Dental - Services
  get_services: 'Obtener lista de servicios',
  get_service_info: 'Obtener detalles de un servicio',
  get_service_prices: 'Obtener precios de servicios',

  // Dental - Doctors
  get_doctors: 'Obtener lista de doctores',
  get_doctor_info: 'Obtener información de doctor',

  // Dental - Insurance
  get_insurance_info: 'Obtener información de seguros',
  check_insurance_coverage: 'Verificar cobertura de seguro',

  // Dental - Emergency
  handle_emergency: 'Evaluar y manejar urgencias',
  send_reminder: 'Enviar recordatorio de cita',
};

// =====================================================
// RESTAURANT CAPABILITIES BY LEVEL
// =====================================================

/**
 * Capabilities for restaurant vertical by level
 */
export const RESTAURANT_CAPABILITIES: Record<AssistantTypeLevel, Capability[]> = {
  basic: [
    'business_hours',
    'business_info',
    'human_transfer',
    'reservations',
  ],

  standard: [
    'business_hours',
    'business_info',
    'human_transfer',
    'reservations',
    'menu_info',
    'recommendations',
    'faq',
  ],

  complete: [
    'business_hours',
    'business_info',
    'human_transfer',
    'reservations',
    'menu_info',
    'recommendations',
    'orders',
    'order_status',
    'promotions',
    'faq',
  ],
};

/**
 * Tools for restaurant vertical by level
 */
export const RESTAURANT_TOOLS: Record<AssistantTypeLevel, Tool[]> = {
  basic: [
    'get_business_hours',
    'get_business_info',
    'transfer_to_human',
    'check_availability',
    'create_reservation',
    'modify_reservation',
    'cancel_reservation',
  ],

  standard: [
    'get_business_hours',
    'get_business_info',
    'transfer_to_human',
    'check_availability',
    'create_reservation',
    'modify_reservation',
    'cancel_reservation',
    'get_menu',
    'get_menu_item',
    'search_menu',
    'get_recommendations',
  ],

  complete: [
    'get_business_hours',
    'get_business_info',
    'transfer_to_human',
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
  ],
};

// =====================================================
// DENTAL CAPABILITIES BY LEVEL
// =====================================================

/**
 * Capabilities for dental vertical by level
 */
export const DENTAL_CAPABILITIES: Record<AssistantTypeLevel, Capability[]> = {
  basic: [
    'business_hours',
    'business_info',
    'human_transfer',
    'appointments',
  ],

  standard: [
    'business_hours',
    'business_info',
    'human_transfer',
    'appointments',
    'services_info',
    'doctor_info',
    'faq',
  ],

  complete: [
    'business_hours',
    'business_info',
    'human_transfer',
    'appointments',
    'services_info',
    'doctor_info',
    'insurance_info',
    'appointment_management',
    'emergencies',
    'faq',
  ],
};

/**
 * Tools for dental vertical by level
 */
export const DENTAL_TOOLS: Record<AssistantTypeLevel, Tool[]> = {
  basic: [
    'get_business_hours',
    'get_business_info',
    'transfer_to_human',
    'check_appointment_availability',
    'create_appointment',
  ],

  standard: [
    'get_business_hours',
    'get_business_info',
    'transfer_to_human',
    'check_appointment_availability',
    'create_appointment',
    'get_services',
    'get_service_info',
    'get_service_prices',
    'get_doctors',
    'get_doctor_info',
  ],

  complete: [
    'get_business_hours',
    'get_business_info',
    'transfer_to_human',
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
  ],
};

// =====================================================
// CAPABILITY TO TOOLS MAPPING
// =====================================================

/**
 * Maps capabilities to their required tools
 */
export const CAPABILITY_TOOLS: Record<Capability, Tool[]> = {
  // Shared
  business_hours: ['get_business_hours'],
  business_info: ['get_business_info'],
  human_transfer: ['transfer_to_human'],
  faq: [], // FAQ is handled by the prompt, no specific tool
  invoicing: ['request_invoice'],

  // Restaurant
  reservations: [
    'check_availability',
    'create_reservation',
    'modify_reservation',
    'cancel_reservation',
  ],
  menu_info: ['get_menu', 'get_menu_item', 'search_menu'],
  recommendations: ['get_recommendations'],
  orders: ['create_order', 'modify_order', 'cancel_order'],
  order_status: ['get_order_status', 'calculate_delivery_time'],
  promotions: ['get_promotions'],

  // Dental
  appointments: ['check_appointment_availability', 'create_appointment'],
  services_info: ['get_services', 'get_service_info', 'get_service_prices'],
  doctor_info: ['get_doctors', 'get_doctor_info'],
  insurance_info: ['get_insurance_info', 'check_insurance_coverage'],
  appointment_management: ['modify_appointment', 'cancel_appointment'],
  emergencies: ['handle_emergency', 'send_reminder'],
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get capabilities for a vertical and level
 */
export function getCapabilitiesForLevel(
  vertical: Vertical,
  level: AssistantTypeLevel
): Capability[] {
  if (vertical === 'restaurant') {
    return RESTAURANT_CAPABILITIES[level];
  }
  return DENTAL_CAPABILITIES[level];
}

/**
 * Get tools for a vertical and level
 */
export function getToolsForLevel(
  vertical: Vertical,
  level: AssistantTypeLevel
): Tool[] {
  if (vertical === 'restaurant') {
    return RESTAURANT_TOOLS[level];
  }
  return DENTAL_TOOLS[level];
}

/**
 * Get capabilities for a specific assistant type ID
 */
export function getCapabilitiesForTypeId(typeId: AssistantTypeId): Capability[] {
  const mapping: Record<AssistantTypeId, Capability[]> = {
    rest_basic: RESTAURANT_CAPABILITIES.basic,
    rest_standard: RESTAURANT_CAPABILITIES.standard,
    rest_complete: RESTAURANT_CAPABILITIES.complete,
    dental_basic: DENTAL_CAPABILITIES.basic,
    dental_standard: DENTAL_CAPABILITIES.standard,
    dental_complete: DENTAL_CAPABILITIES.complete,
  };
  return mapping[typeId] ?? [];
}

/**
 * Get tools for a specific assistant type ID
 */
export function getToolsForTypeId(typeId: AssistantTypeId): Tool[] {
  const mapping: Record<AssistantTypeId, Tool[]> = {
    rest_basic: RESTAURANT_TOOLS.basic,
    rest_standard: RESTAURANT_TOOLS.standard,
    rest_complete: RESTAURANT_TOOLS.complete,
    dental_basic: DENTAL_TOOLS.basic,
    dental_standard: DENTAL_TOOLS.standard,
    dental_complete: DENTAL_TOOLS.complete,
  };
  return mapping[typeId] ?? [];
}

/**
 * Get vertical from assistant type ID
 */
export function getVerticalFromTypeId(typeId: AssistantTypeId): Vertical {
  if (typeId.startsWith('rest_')) {
    return 'restaurant';
  }
  return 'dental';
}

/**
 * Get level from assistant type ID
 */
export function getLevelFromTypeId(typeId: AssistantTypeId): AssistantTypeLevel {
  if (typeId.endsWith('_basic')) {
    return 'basic';
  }
  if (typeId.endsWith('_standard')) {
    return 'standard';
  }
  return 'complete';
}

/**
 * Check if a capability is valid for a vertical
 */
export function isCapabilityValidForVertical(
  capability: Capability,
  vertical: Vertical
): boolean {
  const allCapabilities = getCapabilitiesForLevel(vertical, 'complete');
  return allCapabilities.includes(capability);
}

/**
 * Check if a tool is valid for a vertical
 */
export function isToolValidForVertical(tool: Tool, vertical: Vertical): boolean {
  const allTools = getToolsForLevel(vertical, 'complete');
  return allTools.includes(tool);
}

/**
 * Get tools required for a capability
 */
export function getToolsForCapability(capability: Capability): Tool[] {
  return CAPABILITY_TOOLS[capability] ?? [];
}

/**
 * Get added capabilities when upgrading from one level to another
 */
export function getAddedCapabilities(
  vertical: Vertical,
  fromLevel: AssistantTypeLevel,
  toLevel: AssistantTypeLevel
): Capability[] {
  const fromCaps = getCapabilitiesForLevel(vertical, fromLevel);
  const toCaps = getCapabilitiesForLevel(vertical, toLevel);
  return toCaps.filter((cap) => !fromCaps.includes(cap));
}

/**
 * Get added tools when upgrading from one level to another
 */
export function getAddedTools(
  vertical: Vertical,
  fromLevel: AssistantTypeLevel,
  toLevel: AssistantTypeLevel
): Tool[] {
  const fromTools = getToolsForLevel(vertical, fromLevel);
  const toTools = getToolsForLevel(vertical, toLevel);
  return toTools.filter((tool) => !fromTools.includes(tool));
}

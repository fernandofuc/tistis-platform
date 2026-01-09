// =====================================================
// TIS TIS PLATFORM - Safety & Resilience Service
// REVISIÓN 5.0 - Sistema Central de Seguridad y Resiliencia
// =====================================================
// Este servicio centraliza:
// 1. Detección de emergencias médicas/dentales (P25)
// 2. Detección de alergias y disclaimers de seguridad (P29)
// 3. Circuit breaker para APIs externas (P34)
// 4. Validación de configuración incompleta (P23)
// 5. Detección de eventos especiales (P27)
// =====================================================

import type { TISTISAgentStateType } from '../state';

// ======================
// TYPES
// ======================

export type EmergencyType =
  | 'dental_emergency'
  | 'medical_emergency'
  | 'severe_pain'
  | 'accident'
  | 'allergic_reaction'
  | 'none';

export type SafetyCategory =
  | 'food_allergy'
  | 'medical_condition'
  | 'dietary_restriction'
  | 'none';

export type ConfigCompleteness = {
  isComplete: boolean;
  missingCritical: string[];
  missingRecommended: string[];
  completenessScore: number; // 0-100
};

export type SpecialEventType =
  | 'birthday'
  | 'anniversary'
  | 'corporate'
  | 'wedding'
  | 'large_group'
  | 'catering'
  | 'vip'
  | 'none';

export interface EmergencyDetectionResult {
  isEmergency: boolean;
  emergencyType: EmergencyType;
  severity: 1 | 2 | 3 | 4 | 5; // 1=low, 5=critical
  keywords: string[];
  recommendedAction: 'escalate_immediate' | 'urgent_care' | 'priority_booking' | 'normal';
  emergencyMessage?: string;
}

export interface SafetyDetectionResult {
  requiresSafetyDisclaimer: boolean;
  category: SafetyCategory;
  detectedItems: string[];
  disclaimer: string;
  shouldEscalateToHuman: boolean;
}

export interface SpecialEventDetectionResult {
  isSpecialEvent: boolean;
  eventType: SpecialEventType;
  groupSize?: number;
  specialRequirements: string[];
  shouldEscalate: boolean;
  escalationReason?: string;
}

// ======================
// EMERGENCY DETECTION PATTERNS
// ======================

const EMERGENCY_PATTERNS = {
  // Dental emergencies
  dental: {
    critical: [
      /diente.*(cay[oó]|rompi[oó]|quebr[oó]|parti[oó])/i,
      /se me (cay[oó]|rompi[oó]|sali[oó]).*(diente|muela|corona)/i,
      /sangr(a|ando|e).*(enc[ií]a|boca|muela)/i,
      /golpe.*(diente|boca|mand[ií]bula)/i,
      /inflamaci[oó]n.*(cara|mejilla|mand[ií]bula)/i,
      /no (puedo|aguanto).*(abrir|cerrar|masticar|comer)/i,
      /abs[ce]eso/i,
      /pus.*(enc[ií]a|muela)/i,
    ],
    severe: [
      /(mucho|fuerte|terrible|horrible|insoportable).*(dolor)/i,
      /dolor.*(muy|demasiado|bastante).*(fuerte|intenso)/i,
      /no (aguanto|soporto|resisto).*(dolor|molestia)/i,
      /llevo.*(d[ií]as?|horas?).*(dolor|molestia)/i,
      /dolor.*(no me deja|impide).*(dormir|comer|trabajar)/i,
      /fiebre.*(muela|diente|boca)/i,
    ],
    moderate: [
      /me duele.*(muela|diente|enc[ií]a)/i,
      /molestia.*(muela|diente)/i,
      /sensibil(idad|e).*(fr[ií]o|caliente|dulce)/i,
      /hincha(do|z[oó]n)/i,
    ],
  },
  // Medical emergencies
  medical: {
    critical: [
      /no (puedo|logro) respirar/i,
      /dolor.*(pecho|coraz[oó]n)/i,
      /desmay[oó]|perdi[oó] el conocimiento/i,
      /convuls(i[oó]n|ionando)/i,
      /sangrado.*(abundante|no para|profuso)/i,
      /fractura|hueso.*(roto|expuesto)/i,
      /quemadura.*(grave|severa|tercer)/i,
      /reacci[oó]n al[eé]rgica.*(grave|severa|anafil)/i,
    ],
    severe: [
      /dolor.*(muy|demasiado|bastante).*(fuerte|intenso)/i,
      /vomit(o|ando).*(sangre)/i,
      /fiebre.*(muy|demasiado|más de 39)/i,
      /mareo.*(fuerte|constante|no se quita)/i,
    ],
    moderate: [
      /me siento mal/i,
      /molestia|malestar/i,
      /dolor (leve|moderado)/i,
    ],
  },
};

// ======================
// SAFETY & ALLERGY PATTERNS
// ======================

const SAFETY_PATTERNS = {
  severeAllergies: [
    /al[eé]rgi(a|co).*(mar(iscos?|iscos)|crust[aá]ceos)/i,
    /al[eé]rgi(a|co).*(man[ií]|cacahuate|nuez|frutos secos)/i,
    /al[eé]rgi(a|co).*(gluten|trigo|celiac)/i,
    /al[eé]rgi(a|co).*(leche|l[aá]cteos)/i,
    /al[eé]rgi(a|co).*(huevo)/i,
    /anafila(xia|ctico)/i,
    /shock al[eé]rgico/i,
    /epipen|epinefrina/i,
  ],
  moderateAllergies: [
    /al[eé]rgi(a|co)/i,
    /intolerancia/i,
    /me (cae|sienta) mal/i,
    /no (puedo|debo) comer/i,
  ],
  dietaryRestrictions: [
    /vegetariano|vegano/i,
    /kosher|halal/i,
    /sin gluten|gluten.?free/i,
    /sin lactosa/i,
    /dieta (especial|m[eé]dica)/i,
    /diabético|diabetes/i,
    /bajo en (sal|sodio)/i,
  ],
  medicalConditions: [
    /embaraz(o|ada)/i,
    /diab(etes|ético)/i,
    /hipertensi[oó]n/i,
    /coraz[oó]n/i,
    /medicamento/i,
    /tratamiento (m[eé]dico|quimio|radio)/i,
  ],
};

// ======================
// SPECIAL EVENT PATTERNS
// ======================

const SPECIAL_EVENT_PATTERNS = {
  birthday: [
    /cumplea[ñn]os/i,
    /fiesta de cumplea[ñn]os/i,
    /celebra(r|ci[oó]n).*(cumplea[ñn]os|a[ñn]os)/i,
    /pastel|velas|sorpresa/i,
  ],
  anniversary: [
    /aniversario/i,
    /a[ñn]os de (casados|novios|relaci[oó]n)/i,
    /celebra(r|ci[oó]n).*(aniversario|boda)/i,
  ],
  corporate: [
    /empresa|corporativo|compa[ñn][ií]a/i,
    /reuni[oó]n de trabajo|junta/i,
    /evento (empresarial|corporativo)/i,
    /comida de negocios/i,
    /factura.*(empresa|corporativo)/i,
  ],
  wedding: [
    /boda|matrimonio/i,
    /despedida de solter/i,
    /pedida de mano/i,
    /compromiso/i,
  ],
  catering: [
    /catering/i,
    /servicio a domicilio.*(evento|fiesta)/i,
    /comida para (evento|fiesta|reuni[oó]n)/i,
    /men[uú] para.*personas/i,
  ],
  vip: [
    /vip|privado/i,
    /sal[oó]n privado/i,
    /reservaci[oó]n especial/i,
    /atenci[oó]n personalizada/i,
  ],
};

// ======================
// CONFIGURATION VALIDATION
// ======================

const CRITICAL_CONFIG_FIELDS = {
  dental: ['services', 'branches', 'staff'],
  restaurant: ['services', 'branches'],
  medical: ['services', 'branches', 'staff'],
  general: ['services', 'branches'],
};

const RECOMMENDED_CONFIG_FIELDS = {
  dental: ['faqs', 'operatingHours', 'customInstructions'],
  restaurant: ['faqs', 'operatingHours', 'menuCategories'],
  medical: ['faqs', 'operatingHours', 'customInstructions'],
  general: ['faqs', 'operatingHours'],
};

// ======================
// CIRCUIT BREAKER
// ======================

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  openedAt: number;
}

const circuitBreakers: Map<string, CircuitBreakerState> = new Map();

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 3,
  resetTimeout: 5 * 60 * 1000, // 5 minutes
  halfOpenRequests: 1,
};

// ======================
// EMERGENCY DETECTION (P25)
// ======================

/**
 * Detecta emergencias médicas/dentales en el mensaje
 * P25 FIX: Sistema robusto de detección de emergencias
 */
export function detectEmergency(
  message: string,
  vertical: string
): EmergencyDetectionResult {
  const result: EmergencyDetectionResult = {
    isEmergency: false,
    emergencyType: 'none',
    severity: 1,
    keywords: [],
    recommendedAction: 'normal',
  };

  const messageLower = message.toLowerCase();

  // Check dental emergencies
  if (vertical === 'dental' || vertical === 'medical') {
    const patterns = vertical === 'dental' ? EMERGENCY_PATTERNS.dental : EMERGENCY_PATTERNS.medical;

    // Check critical patterns first
    for (const pattern of patterns.critical) {
      if (pattern.test(messageLower)) {
        result.isEmergency = true;
        result.emergencyType = vertical === 'dental' ? 'dental_emergency' : 'medical_emergency';
        result.severity = 5;
        result.keywords.push(pattern.source);
        result.recommendedAction = 'escalate_immediate';
        result.emergencyMessage = vertical === 'dental'
          ? 'Detectamos una posible emergencia dental. Un especialista te contactará de inmediato. Si el dolor es insoportable, te recomendamos acudir directamente a urgencias dentales.'
          : 'Detectamos una posible emergencia médica. Si es una emergencia grave, por favor llama al 911 o acude a urgencias inmediatamente.';
        return result;
      }
    }

    // Check severe patterns
    for (const pattern of patterns.severe) {
      if (pattern.test(messageLower)) {
        result.isEmergency = true;
        result.emergencyType = 'severe_pain';
        result.severity = 4;
        result.keywords.push(pattern.source);
        result.recommendedAction = 'urgent_care';
        result.emergencyMessage = 'Entiendo que estás pasando por una situación difícil. Vamos a conseguirte una cita lo antes posible.';
        return result;
      }
    }

    // Check moderate patterns
    for (const pattern of patterns.moderate) {
      if (pattern.test(messageLower)) {
        result.emergencyType = 'severe_pain';
        result.severity = 2;
        result.keywords.push(pattern.source);
        result.recommendedAction = 'priority_booking';
        // Not setting isEmergency = true for moderate cases
      }
    }
  }

  // Check for accident keywords (any vertical)
  if (/accidente|golpe|ca[ií]da|choque/i.test(messageLower)) {
    result.isEmergency = true;
    result.emergencyType = 'accident';
    result.severity = 4;
    result.keywords.push('accidente');
    result.recommendedAction = 'escalate_immediate';
    result.emergencyMessage = 'Si has tenido un accidente, tu seguridad es lo primero. ¿Necesitas atención médica de emergencia?';
    return result;
  }

  return result;
}

// ======================
// SAFETY & ALLERGY DETECTION (P29)
// ======================

/**
 * Detecta menciones de alergias y condiciones de seguridad
 * P29 FIX: Genera disclaimers apropiados para seguridad alimentaria
 */
export function detectSafetyRequirements(
  message: string,
  vertical: string
): SafetyDetectionResult {
  const result: SafetyDetectionResult = {
    requiresSafetyDisclaimer: false,
    category: 'none',
    detectedItems: [],
    disclaimer: '',
    shouldEscalateToHuman: false,
  };

  const messageLower = message.toLowerCase();

  // Only apply food safety for restaurant vertical
  if (vertical === 'restaurant') {
    // Check severe allergies (require human escalation)
    for (const pattern of SAFETY_PATTERNS.severeAllergies) {
      if (pattern.test(messageLower)) {
        const match = messageLower.match(pattern);
        result.requiresSafetyDisclaimer = true;
        result.category = 'food_allergy';
        result.detectedItems.push(match?.[0] || 'alergia severa');
        result.shouldEscalateToHuman = true;
        result.disclaimer = `IMPORTANTE: Para alergias severas, por tu seguridad te recomendamos hablar directamente con nuestro personal. Nuestra cocina maneja diversos ingredientes y no podemos garantizar ausencia de contaminación cruzada al 100%. Un miembro de nuestro equipo te ayudará a seleccionar opciones seguras.`;
        return result;
      }
    }

    // Check moderate allergies
    for (const pattern of SAFETY_PATTERNS.moderateAllergies) {
      if (pattern.test(messageLower)) {
        result.requiresSafetyDisclaimer = true;
        result.category = 'food_allergy';
        result.disclaimer = `Tomamos las alergias muy en serio. Te recomendamos informar a tu mesero al llegar para que te asesore sobre las opciones más seguras. Nuestro personal está capacitado para ayudarte.`;
      }
    }

    // Check dietary restrictions
    for (const pattern of SAFETY_PATTERNS.dietaryRestrictions) {
      if (pattern.test(messageLower)) {
        result.requiresSafetyDisclaimer = true;
        result.category = 'dietary_restriction';
        result.disclaimer = `Contamos con opciones para tu preferencia alimentaria. Te recomendamos confirmarlo con tu mesero al ordenar para asegurar que tu platillo cumpla con tus requerimientos.`;
      }
    }
  }

  // Check medical conditions (for medical/dental verticals)
  if (vertical === 'dental' || vertical === 'medical') {
    for (const pattern of SAFETY_PATTERNS.medicalConditions) {
      if (pattern.test(messageLower)) {
        result.requiresSafetyDisclaimer = true;
        result.category = 'medical_condition';
        result.detectedItems.push('condición médica');
        result.disclaimer = `Es importante que informes sobre tu condición médica durante la consulta. Nuestros especialistas evaluarán el mejor tratamiento considerando tu historial de salud.`;
      }
    }
  }

  return result;
}

// ======================
// SPECIAL EVENT DETECTION (P27)
// ======================

/**
 * Detecta eventos especiales que requieren atención personalizada
 * P27 FIX: Escala eventos complejos a humanos
 */
export function detectSpecialEvent(
  message: string,
  vertical: string
): SpecialEventDetectionResult {
  const result: SpecialEventDetectionResult = {
    isSpecialEvent: false,
    eventType: 'none',
    specialRequirements: [],
    shouldEscalate: false,
  };

  if (vertical !== 'restaurant') {
    return result;
  }

  const messageLower = message.toLowerCase();

  // Extract group size
  const groupSizeMatch = messageLower.match(/(\d+)\s*(personas?|invitados?|comensales?)/i);
  if (groupSizeMatch) {
    result.groupSize = parseInt(groupSizeMatch[1], 10);

    // Large groups (10+) always require special attention
    if (result.groupSize >= 10) {
      result.isSpecialEvent = true;
      result.eventType = 'large_group';
      result.shouldEscalate = true;
      result.escalationReason = `Grupo de ${result.groupSize} personas requiere coordinación especial`;
    }
  }

  // Check event type patterns
  const eventPatterns: Array<{ type: SpecialEventType; patterns: RegExp[] }> = [
    { type: 'birthday', patterns: SPECIAL_EVENT_PATTERNS.birthday },
    { type: 'anniversary', patterns: SPECIAL_EVENT_PATTERNS.anniversary },
    { type: 'corporate', patterns: SPECIAL_EVENT_PATTERNS.corporate },
    { type: 'wedding', patterns: SPECIAL_EVENT_PATTERNS.wedding },
    { type: 'catering', patterns: SPECIAL_EVENT_PATTERNS.catering },
    { type: 'vip', patterns: SPECIAL_EVENT_PATTERNS.vip },
  ];

  for (const { type, patterns } of eventPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(messageLower)) {
        result.isSpecialEvent = true;
        result.eventType = type;

        // Certain event types always need human coordination
        if (['wedding', 'catering', 'corporate', 'vip'].includes(type)) {
          result.shouldEscalate = true;
          result.escalationReason = `Evento de tipo "${type}" requiere atención personalizada`;
        }
        break;
      }
    }
    if (result.isSpecialEvent) break;
  }

  // Detect special requirements
  const requirementPatterns = [
    { pattern: /decoraci[oó]n/i, requirement: 'decoración' },
    { pattern: /men[uú] especial/i, requirement: 'menú especial' },
    { pattern: /pastel|cake/i, requirement: 'pastel' },
    { pattern: /m[uú]sica|mariachi/i, requirement: 'música' },
    { pattern: /sorpresa/i, requirement: 'elemento sorpresa' },
    { pattern: /sal[oó]n privado/i, requirement: 'salón privado' },
    { pattern: /proyector|pantalla/i, requirement: 'equipo audiovisual' },
  ];

  for (const { pattern, requirement } of requirementPatterns) {
    if (pattern.test(messageLower)) {
      result.specialRequirements.push(requirement);
      result.isSpecialEvent = true;
    }
  }

  // If multiple requirements, definitely escalate
  if (result.specialRequirements.length >= 2) {
    result.shouldEscalate = true;
    result.escalationReason = `Múltiples requerimientos especiales: ${result.specialRequirements.join(', ')}`;
  }

  return result;
}

// ======================
// CONFIGURATION VALIDATION (P23)
// ======================

/**
 * Valida que la configuración del negocio esté completa
 * P23 FIX: Detecta configuración incompleta antes de que cause problemas
 */
export function validateBusinessConfiguration(
  businessContext: TISTISAgentStateType['business_context'],
  vertical: string
): ConfigCompleteness {
  const result: ConfigCompleteness = {
    isComplete: true,
    missingCritical: [],
    missingRecommended: [],
    completenessScore: 100,
  };

  const verticalKey = vertical as keyof typeof CRITICAL_CONFIG_FIELDS;
  const criticalFields = CRITICAL_CONFIG_FIELDS[verticalKey] || CRITICAL_CONFIG_FIELDS.general;
  const recommendedFields = RECOMMENDED_CONFIG_FIELDS[verticalKey] || RECOMMENDED_CONFIG_FIELDS.general;

  // Check critical fields
  for (const field of criticalFields) {
    const value = businessContext?.[field as keyof typeof businessContext];
    const isEmpty = !value || (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      result.missingCritical.push(field);
      result.isComplete = false;
    }
  }

  // Check recommended fields
  for (const field of recommendedFields) {
    const value = businessContext?.[field as keyof typeof businessContext];
    const isEmpty = !value || (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      result.missingRecommended.push(field);
    }
  }

  // Calculate completeness score
  const totalFields = criticalFields.length + recommendedFields.length;
  const missingFields = result.missingCritical.length + result.missingRecommended.length;
  result.completenessScore = Math.round(((totalFields - missingFields) / totalFields) * 100);

  // Critical fields have more weight
  if (result.missingCritical.length > 0) {
    result.completenessScore = Math.min(result.completenessScore, 50);
  }

  return result;
}

/**
 * Genera mensaje de fallback cuando la configuración está incompleta
 */
export function generateIncompleteConfigResponse(
  missingFields: string[],
  vertical: string
): string {
  const fieldTranslations: Record<string, string> = {
    services: 'servicios/productos',
    branches: 'sucursales',
    staff: 'personal/especialistas',
    faqs: 'preguntas frecuentes',
    operatingHours: 'horarios de atención',
  };

  const missingTranslated = missingFields
    .slice(0, 2)
    .map((f) => fieldTranslations[f] || f)
    .join(' y ');

  return `Gracias por tu interés. Estamos actualizando nuestra información de ${missingTranslated}. ¿Me permites tu número o correo para que un asesor te contacte con los detalles completos?`;
}

// ======================
// CIRCUIT BREAKER (P34)
// ======================

/**
 * Verifica si el circuit breaker está abierto para un servicio
 */
export function isCircuitOpen(serviceName: string): boolean {
  const state = circuitBreakers.get(serviceName);
  if (!state) return false;

  if (state.isOpen) {
    // Check if reset timeout has passed
    const now = Date.now();
    if (now - state.openedAt >= CIRCUIT_BREAKER_CONFIG.resetTimeout) {
      // Move to half-open state
      state.isOpen = false;
      state.failures = 0;
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Registra un fallo en el circuit breaker
 */
export function recordCircuitFailure(serviceName: string): void {
  let state = circuitBreakers.get(serviceName);

  if (!state) {
    state = {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      openedAt: 0,
    };
    circuitBreakers.set(serviceName, state);
  }

  state.failures++;
  state.lastFailure = Date.now();

  if (state.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    state.isOpen = true;
    state.openedAt = Date.now();
    console.warn(`[CircuitBreaker] Circuit OPEN for ${serviceName} after ${state.failures} failures`);
  }
}

/**
 * Registra un éxito en el circuit breaker (resetea contadores)
 */
export function recordCircuitSuccess(serviceName: string): void {
  const state = circuitBreakers.get(serviceName);
  if (state) {
    state.failures = 0;
    state.isOpen = false;
  }
}

/**
 * Obtiene el estado del circuit breaker para monitoreo
 */
export function getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
  return new Map(circuitBreakers);
}

// ======================
// VOICE CALL RECONNECTION (P37)
// ======================

export interface CallReconnectionContext {
  previousCallId: string;
  partialBooking?: {
    service?: string;
    date?: string;
    time?: string;
    branch?: string;
  };
  lastIntent?: string;
  conversationSummary?: string;
}

/**
 * Genera mensaje de reconexión para llamadas interrumpidas
 */
export function generateReconnectionMessage(context: CallReconnectionContext): string {
  if (context.partialBooking?.service) {
    const parts = [];
    if (context.partialBooking.service) parts.push(`cita de ${context.partialBooking.service}`);
    if (context.partialBooking.date) parts.push(`para ${context.partialBooking.date}`);
    if (context.partialBooking.time) parts.push(`a las ${context.partialBooking.time}`);

    return `¡Hola de nuevo! Parece que se cortó nuestra llamada anterior. Estábamos coordinando tu ${parts.join(' ')}. ¿Continuamos desde donde nos quedamos?`;
  }

  if (context.lastIntent) {
    const intentMessages: Record<string, string> = {
      PRICE_INQUIRY: 'Te estaba dando información de precios',
      BOOK_APPOINTMENT: 'Estábamos agendando tu cita',
      FAQ: 'Te estaba respondiendo una consulta',
      LOCATION: 'Te estaba dando información de ubicación',
    };

    const message = intentMessages[context.lastIntent];
    if (message) {
      return `¡Hola de nuevo! Se cortó la llamada anterior. ${message}. ¿En qué puedo ayudarte?`;
    }
  }

  return '¡Hola de nuevo! Parece que se cortó nuestra llamada anterior. ¿En qué te puedo ayudar?';
}

// ======================
// ESCALATION FALLBACK (P38)
// ======================

export interface EscalationFallbackResult {
  primaryAction: 'transfer' | 'callback' | 'message' | 'alternative';
  fallbackMessage: string;
  shouldCreateTask: boolean;
  taskDescription?: string;
}

/**
 * Genera fallback cuando el escalamiento a humano falla
 */
export function generateEscalationFallback(
  escalationReason: string,
  hasCallbackOption: boolean,
  businessHours?: { isOpen: boolean; nextOpenTime?: string }
): EscalationFallbackResult {
  // If during business hours and callback available
  if (hasCallbackOption && businessHours?.isOpen) {
    return {
      primaryAction: 'callback',
      fallbackMessage: 'Nuestros asesores están atendiendo otras llamadas en este momento. ¿Te gustaría que te devolvamos la llamada en los próximos 15 minutos?',
      shouldCreateTask: true,
      taskDescription: `Callback solicitado - Razón: ${escalationReason}`,
    };
  }

  // Outside business hours
  if (!businessHours?.isOpen) {
    const nextOpen = businessHours?.nextOpenTime || 'mañana';
    return {
      primaryAction: 'message',
      fallbackMessage: `En este momento nuestro equipo no está disponible. Un asesor te contactará ${nextOpen}. ¿Puedo tomar tu mensaje para que estén preparados cuando te llamen?`,
      shouldCreateTask: true,
      taskDescription: `Contacto fuera de horario - Razón: ${escalationReason}`,
    };
  }

  // Default fallback
  return {
    primaryAction: 'alternative',
    fallbackMessage: 'Gracias por tu paciencia. ¿Prefieres que te enviemos la información por mensaje o que un asesor te contacte más tarde?',
    shouldCreateTask: true,
    taskDescription: `Escalamiento pendiente - Razón: ${escalationReason}`,
  };
}

// ======================
// RFC VALIDATION (P30)
// ======================

/**
 * Valida formato de RFC mexicano
 */
export function validateRFC(rfc: string): { valid: boolean; type?: 'moral' | 'fisica'; error?: string } {
  const rfcClean = rfc.toUpperCase().replace(/[\s-]/g, '');

  // RFC Persona Física: 4 letras + 6 dígitos (fecha) + 3 homoclave = 13 caracteres
  const regexFisica = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;

  // RFC Persona Moral: 3 letras + 6 dígitos (fecha) + 3 homoclave = 12 caracteres
  const regexMoral = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/;

  if (regexFisica.test(rfcClean)) {
    // Validate date portion for persona física
    const dateStr = rfcClean.substring(4, 10);
    if (isValidRFCDate(dateStr)) {
      return { valid: true, type: 'fisica' };
    }
    return { valid: false, error: 'La fecha en el RFC no es válida' };
  }

  if (regexMoral.test(rfcClean)) {
    const dateStr = rfcClean.substring(3, 9);
    if (isValidRFCDate(dateStr)) {
      return { valid: true, type: 'moral' };
    }
    return { valid: false, error: 'La fecha en el RFC no es válida' };
  }

  if (rfcClean.length === 12) {
    return { valid: false, error: 'El formato de RFC persona moral debe ser: ABC123456XY1 (3 letras + 6 números + 3 homoclave)' };
  }

  if (rfcClean.length === 13) {
    return { valid: false, error: 'El formato de RFC persona física debe ser: ABCD123456XY1 (4 letras + 6 números + 3 homoclave)' };
  }

  return { valid: false, error: `El RFC debe tener 12 caracteres (persona moral) o 13 caracteres (persona física). El proporcionado tiene ${rfcClean.length} caracteres` };
}

function isValidRFCDate(dateStr: string): boolean {
  const year = parseInt(dateStr.substring(0, 2), 10);
  const month = parseInt(dateStr.substring(2, 4), 10);
  const day = parseInt(dateStr.substring(4, 6), 10);

  // Basic validation
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // More specific validation for days per month
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month - 1]) return false;

  return true;
}

// ======================
// EXPORTS
// ======================

export const SafetyResilienceService = {
  // Emergency detection (P25)
  detectEmergency,

  // Safety & allergy detection (P29)
  detectSafetyRequirements,

  // Special event detection (P27)
  detectSpecialEvent,

  // Configuration validation (P23)
  validateBusinessConfiguration,
  generateIncompleteConfigResponse,

  // Circuit breaker (P34)
  isCircuitOpen,
  recordCircuitFailure,
  recordCircuitSuccess,
  getCircuitBreakerStatus,

  // Voice reconnection (P37)
  generateReconnectionMessage,

  // Escalation fallback (P38)
  generateEscalationFallback,

  // RFC validation (P30)
  validateRFC,
};

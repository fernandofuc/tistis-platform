/**
 * TIS TIS Platform - Voice Agent v2.0
 * Prompt Template Engine Types
 *
 * Types for the Handlebars-based template engine that generates
 * dynamic prompts for voice assistants.
 */

import type {
  AssistantTypeId,
  Capability,
  Tool,
  PersonalityType,
  Vertical,
} from '../types';

// =====================================================
// SUPPORTED LANGUAGES
// =====================================================

/**
 * Supported languages for i18n
 */
export type SupportedLocale = 'es-MX' | 'en-US';

/**
 * Available locales
 */
export const SUPPORTED_LOCALES: SupportedLocale[] = ['es-MX', 'en-US'];

/**
 * Default locale
 */
export const DEFAULT_LOCALE: SupportedLocale = 'es-MX';

// =====================================================
// BUSINESS CONTEXT
// =====================================================

/**
 * Schedule for a single day
 */
export interface DaySchedule {
  /** Day of the week (0-6, Sunday = 0) */
  dayOfWeek: number;
  /** Day name for display */
  dayName: string;
  /** Whether the business is open */
  isOpen: boolean;
  /** Opening time (HH:mm format) */
  openTime?: string;
  /** Closing time (HH:mm format) */
  closeTime?: string;
  /** Break start time if applicable */
  breakStart?: string;
  /** Break end time if applicable */
  breakEnd?: string;
}

/**
 * Weekly schedule
 */
export interface WeeklySchedule {
  /** Schedule for each day */
  days: DaySchedule[];
  /** Timezone */
  timezone: string;
  /** Special schedule notes */
  notes?: string;
}

/**
 * A menu item (for restaurants)
 */
export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  category: string;
  isAvailable: boolean;
  isPopular?: boolean;
  allergens?: string[];
  preparationTime?: number;
}

/**
 * A service (for dental/medical)
 */
export interface ServiceItem {
  id: string;
  name: string;
  description?: string;
  priceFrom?: number;
  priceTo?: number;
  currency: string;
  durationMinutes?: number;
  category: string;
  requiresAppointment: boolean;
}

/**
 * Doctor/Professional info
 */
export interface DoctorInfo {
  id: string;
  name: string;
  title: string;
  specialty: string;
  bio?: string;
  availableDays?: string[];
  languages?: string[];
}

/**
 * Promotion info
 */
export interface PromotionInfo {
  id: string;
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed' | 'special';
  discountValue?: number;
  validUntil?: string;
  conditions?: string;
  code?: string;
}

/**
 * Insurance info (for dental/medical)
 */
export interface InsuranceInfo {
  id: string;
  name: string;
  coverageTypes: string[];
  notes?: string;
}

/**
 * Reservation/Appointment policy
 */
export interface BookingPolicy {
  /** Minimum advance notice in hours */
  minAdvanceHours: number;
  /** Maximum advance days for booking */
  maxAdvanceDays: number;
  /** Cancellation policy text */
  cancellationPolicy: string;
  /** Whether confirmation is required */
  requiresConfirmation: boolean;
  /** Maximum party size (for restaurants) */
  maxPartySize?: number;
  /** Default appointment duration (for dental) */
  defaultDurationMinutes?: number;
}

/**
 * FAQ item
 */
export interface FAQItem {
  question: string;
  answer: string;
  category?: string;
}

/**
 * Complete business context for template rendering
 */
export interface BusinessContext {
  // ===== Basic Info =====
  /** Business ID */
  tenantId: string;
  /** Business name */
  businessName: string;
  /** Business type/vertical */
  vertical: Vertical;
  /** Business address */
  address?: string;
  /** Business phone */
  phone?: string;
  /** Business email */
  email?: string;
  /** Website URL */
  website?: string;

  // ===== Schedule =====
  /** Weekly schedule */
  schedule: WeeklySchedule;
  /** Today's schedule (pre-calculated for convenience) */
  todaySchedule: DaySchedule;
  /** Whether currently open */
  isCurrentlyOpen: boolean;
  /** Next opening time if closed */
  nextOpenTime?: string;

  // ===== Restaurant-specific =====
  /** Menu items */
  menuItems?: MenuItem[];
  /** Menu categories */
  menuCategories?: string[];
  /** Popular items */
  popularItems?: MenuItem[];
  /** Unavailable items today */
  unavailableItems?: string[];

  // ===== Dental-specific =====
  /** Services offered */
  services?: ServiceItem[];
  /** Service categories */
  serviceCategories?: string[];
  /** Doctors/Professionals */
  doctors?: DoctorInfo[];
  /** Accepted insurances */
  acceptedInsurances?: InsuranceInfo[];

  // ===== Shared =====
  /** Active promotions */
  promotions?: PromotionInfo[];
  /** Booking/Reservation policy */
  bookingPolicy: BookingPolicy;
  /** FAQ items */
  faq?: FAQItem[];
  /** Special announcements */
  announcements?: string[];

  // ===== Dynamic Context =====
  /** Current wait time in minutes */
  currentWaitTime?: number;
  /** Today's special items/services */
  todaySpecials?: string[];
  /** Estimated delivery time (restaurants) */
  estimatedDeliveryTime?: number;
}

// =====================================================
// DYNAMIC CONTEXT (Real-time data)
// =====================================================

/**
 * Dynamic context that changes frequently
 */
export interface DynamicContext {
  /** Business ID */
  tenantId: string;
  /** Timestamp when fetched */
  fetchedAt: Date;
  /** Current wait time */
  waitTimeMinutes?: number;
  /** Items/services currently unavailable */
  unavailableItems: string[];
  /** Active promotions (IDs) */
  activePromotionIds: string[];
  /** Special announcements for today */
  todayAnnouncements: string[];
  /** Current occupancy level (0-100) */
  occupancyPercent?: number;
  /** Whether accepting new bookings */
  acceptingBookings: boolean;
  /** Custom message to include */
  customMessage?: string;
}

// =====================================================
// TEMPLATE CONFIGURATION
// =====================================================

/**
 * Configuration for a voice assistant
 */
export interface VoiceAssistantConfig {
  /** Assistant type ID */
  typeId: AssistantTypeId;
  /** Greeting message override */
  customGreeting?: string;
  /** Voice ID */
  voiceId: string;
  /** Personality type */
  personality: PersonalityType;
  /** Enabled capabilities */
  enabledCapabilities: Capability[];
  /** Available tools */
  availableTools: Tool[];
  /** Locale for i18n */
  locale: SupportedLocale;
  /** Max call duration in seconds */
  maxCallDuration: number;
  /** Whether to include FAQ */
  includeFaq: boolean;
  /** Whether to include promotions */
  includePromotions: boolean;
  /** Whether to include transfer capability */
  includeTransfer: boolean;
  /** Custom instructions to append */
  customInstructions?: string;
}

/**
 * Options for rendering
 */
export interface RenderOptions {
  /** Include dynamic context */
  includeDynamicContext?: boolean;
  /** Validate output length */
  validateLength?: boolean;
  /** Maximum prompt length */
  maxLength?: number;
  /** Debug mode (include template name in output) */
  debug?: boolean;
}

// =====================================================
// RENDERED OUTPUT
// =====================================================

/**
 * Result of rendering a prompt
 */
export interface RenderedPrompt {
  /** The rendered prompt text */
  content: string;
  /** Template name used */
  templateName: string;
  /** Template version */
  templateVersion: string;
  /** Personality applied */
  personality: PersonalityType;
  /** Locale used */
  locale: SupportedLocale;
  /** Length of content */
  length: number;
  /** Whether it passed validation */
  isValid: boolean;
  /** Validation errors if any */
  validationErrors: string[];
  /** Capabilities included */
  includedCapabilities: Capability[];
  /** Rendered at timestamp */
  renderedAt: Date;
  /** Metadata for debugging */
  metadata?: Record<string, unknown>;
}

/**
 * Validation result for a rendered prompt
 */
export interface PromptValidationResult {
  /** Whether the prompt is valid */
  valid: boolean;
  /** Validation errors */
  errors: PromptValidationError[];
  /** Warnings (valid but may have issues) */
  warnings: string[];
  /** Prompt length */
  length: number;
  /** Sections found in prompt */
  sectionsFound: string[];
}

/**
 * A single validation error
 */
export interface PromptValidationError {
  /** Error code */
  code: PromptValidationErrorCode;
  /** Error message */
  message: string;
  /** Location in prompt if applicable */
  location?: string;
}

/**
 * Validation error codes
 */
export type PromptValidationErrorCode =
  | 'PROMPT_TOO_LONG'
  | 'PROMPT_TOO_SHORT'
  | 'MISSING_SECTION'
  | 'UNRESOLVED_PLACEHOLDER'
  | 'INVALID_CHARACTER'
  | 'MISSING_IDENTITY'
  | 'MISSING_CAPABILITIES'
  | 'MISSING_STYLE';

// =====================================================
// I18N TYPES
// =====================================================

/**
 * Time of day for greetings
 */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * I18n translations structure
 */
export interface I18nTranslations {
  // Greetings
  greetings: {
    morning: string;
    afternoon: string;
    evening: string;
    night: string;
    generic: string;
  };

  // Days
  days: {
    sunday: string;
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
  };
  daysShort: {
    sunday: string;
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
  };

  // Months
  months: {
    january: string;
    february: string;
    march: string;
    april: string;
    may: string;
    june: string;
    july: string;
    august: string;
    september: string;
    october: string;
    november: string;
    december: string;
  };

  // Time expressions
  time: {
    today: string;
    tomorrow: string;
    yesterday: string;
    now: string;
    inMinutes: string; // "en {n} minutos"
    inHours: string; // "en {n} horas"
    ago: string; // "hace {n}"
    at: string; // "a las"
    from: string; // "de"
    to: string; // "a"
    and: string; // "y"
  };

  // Common phrases
  phrases: {
    welcome: string;
    goodbye: string;
    thanks: string;
    pleaseWait: string;
    oneSecond: string;
    understood: string;
    letMeCheck: string;
    anythingElse: string;
    sorryDidntUnderstand: string;
    transferring: string;
  };

  // Domain terms (restaurant)
  restaurant?: {
    reservation: string;
    table: string;
    menu: string;
    order: string;
    delivery: string;
    takeaway: string;
    persons: string;
  };

  // Domain terms (dental)
  dental?: {
    appointment: string;
    doctor: string;
    service: string;
    treatment: string;
    emergency: string;
    insurance: string;
    coverage: string;
  };

  // Currency
  currency: {
    symbol: string;
    format: string; // "{symbol}{amount}" or "{amount} {symbol}"
    decimal: string;
    thousands: string;
  };
}

// =====================================================
// TEMPLATE HELPERS CONTEXT
// =====================================================

/**
 * Context available to Handlebars helpers
 */
export interface TemplateHelperContext {
  /** Business context */
  business: BusinessContext;
  /** Assistant config */
  config: VoiceAssistantConfig;
  /** I18n translations */
  i18n: I18nTranslations;
  /** Dynamic context if available */
  dynamic?: DynamicContext;
  /** Current date/time */
  now: Date;
  /** Time of day */
  timeOfDay: TimeOfDay;
}

// =====================================================
// TEMPLATE ENGINE CONFIG
// =====================================================

/**
 * Configuration for the template engine
 */
export interface TemplateEngineConfig {
  /** Base path for templates */
  templatesPath: string;
  /** Whether to cache compiled templates */
  cacheTemplates: boolean;
  /** Default locale */
  defaultLocale: SupportedLocale;
  /** Maximum prompt length */
  maxPromptLength: number;
  /** Minimum prompt length */
  minPromptLength: number;
  /** Required sections in prompts */
  requiredSections: string[];
  /** Whether to validate on render */
  validateOnRender: boolean;
}

/**
 * Default template engine configuration
 */
export const DEFAULT_TEMPLATE_ENGINE_CONFIG: TemplateEngineConfig = {
  templatesPath: 'templates',
  cacheTemplates: true,
  defaultLocale: 'es-MX',
  maxPromptLength: 8000,
  minPromptLength: 500,
  requiredSections: ['IDENTIDAD', 'CAPACIDADES', 'ESTILO'],
  validateOnRender: true,
};

// =====================================================
// HELPER TYPES
// =====================================================

/**
 * Schedule formatted for voice output
 */
export interface VoiceScheduleFormat {
  /** Full format: "Lunes a Viernes de 9 a 6, Sábados de 10 a 2" */
  full: string;
  /** Today format: "Hoy abrimos de 9 de la mañana a 6 de la tarde" */
  today: string;
  /** Closed message if applicable */
  closedMessage?: string;
}

/**
 * Price formatted for voice output
 */
export interface VoicePriceFormat {
  /** Full: "ciento cincuenta pesos" */
  spoken: string;
  /** Short: "150 pesos" */
  short: string;
}

/**
 * List formatted for voice output
 */
export interface VoiceListFormat {
  /** "manzanas, peras y naranjas" */
  natural: string;
  /** Count: "3 opciones" */
  count: string;
}

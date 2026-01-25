/**
 * TIS TIS Platform - Voice Agent v2.0
 * Template Prompt Compiler Types
 *
 * Types for the hybrid prompt system that combines:
 * - Handlebars templates (structure)
 * - Business context (data)
 * - Gemini enrichment (Knowledge Base)
 */

import type { PersonalityType, Capability, Tool } from '../types';

// Extended Vertical type that includes all business types
// The core voice-agent types only have 'restaurant' | 'dental' but
// the platform supports more verticals for template fallbacks
export type Vertical = 'restaurant' | 'dental' | 'medical' | 'gym' | 'services' | 'general';

// =====================================================
// COMPILED PROMPT OUTPUT
// =====================================================

/**
 * Result of compiling a base prompt from templates
 */
export interface CompiledBasePrompt {
  /** The compiled prompt text */
  basePrompt: string;
  /** First message for the assistant to say */
  firstMessage: string;
  /** Enabled capabilities from assistant type */
  capabilities: Capability[];
  /** Available tools for this assistant type */
  tools: Tool[];
  /** Template version used */
  templateVersion: string;
  /** When the prompt was compiled */
  compiledAt: string;
  /** Template name used */
  templateName: string;
  /** Personality applied */
  personality: PersonalityType;
}

/**
 * Result of hybrid prompt generation (template + Gemini enrichment)
 */
export interface HybridPromptResult {
  success: boolean;
  /** The final enriched prompt */
  prompt: string;
  /** First message for the assistant */
  firstMessage: string;
  /** Enabled capabilities */
  capabilities: Capability[];
  /** Available tools */
  tools: Tool[];
  /** Generation metadata */
  generatedAt: string;
  /** Model used for enrichment (or 'template-only' if no enrichment) */
  model: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Error message if failed */
  error?: string;
  /** Whether KB enrichment was applied */
  kbEnriched: boolean;
}

// =====================================================
// TEMPLATE VARIABLES
// =====================================================

/**
 * Variables passed to Handlebars templates for compilation
 */
export interface TemplateVariables {
  // === Assistant Identity ===
  /** Name of the assistant (e.g., "Javier") */
  assistantName: string;
  /** Business name (e.g., "Mariscos el Caracol") */
  businessName: string;
  /** Business type in Spanish (e.g., "restaurante", "consultorio dental") */
  businessType: string;
  /** Accent description (e.g., "mexicano") */
  accent?: string;

  // === First Message ===
  /** The greeting message */
  firstMessage: string;

  // === Business Info ===
  /** Business address */
  businessAddress?: string;
  /** Business phone */
  businessPhone?: string;
  /** Operating days description */
  operatingDays?: string;
  /** Operating hours description */
  operatingHours?: string;

  // === Time Context ===
  /** Current date formatted */
  currentDate: string;
  /** Current time formatted */
  currentTime: string;

  // === Booking Policy ===
  /** Booking policy object */
  bookingPolicy?: {
    minAdvanceHours: number;
    maxAdvanceDays: number;
    maxPartySize?: number;
    defaultDurationMinutes?: number;
    cancellationPolicy?: string;
  };

  // === Personality & Style ===
  /** Personality style content (from personality template) */
  personalityStyle?: string;

  // === Special Instructions ===
  /** Custom instructions from the user */
  specialInstructions?: string;

  // === Restaurant-specific ===
  /** Menu highlights for display */
  menuHighlights?: Array<{
    name: string;
    description?: string;
    price?: number;
  }>;
  /** Active promotions */
  promotions?: Array<{
    name: string;
    description: string;
    validUntil?: string;
  }>;

  // === Delivery Configuration (added in v2.1 - Migration 156) ===
  /** Whether delivery is enabled for this tenant */
  deliveryEnabled?: boolean;
  /** Delivery configuration */
  deliveryConfig?: {
    /** Maximum delivery radius in km */
    maxRadiusKm: number;
    /** Delivery fee */
    deliveryFee: number;
    /** Minimum order amount for delivery */
    minimumOrderAmount?: number;
    /** Estimated delivery time in minutes */
    estimatedTimeMinutes: number;
  };
  /** Currency for price formatting */
  currency?: string;

  // === Dental-specific ===
  /** Services offered */
  services?: Array<{
    name: string;
    description?: string;
    priceRange?: string;
  }>;
  /** Doctors/professionals */
  doctors?: Array<{
    title: string;
    name: string;
    specialty?: string;
    availableDays?: string;
  }>;
  /** Accepted insurances */
  insurances?: Array<{
    name: string;
    coverage?: string;
  }>;
}

// =====================================================
// VOICE ASSISTANT CONFIG (from DB)
// =====================================================

/**
 * Voice assistant configuration from voice_assistant_configs table
 */
export interface VoiceAssistantDbConfig {
  id: string;
  tenant_id: string;
  assistant_type_id: string | null;
  assistant_name: string;
  personality_type: PersonalityType;
  special_instructions: string | null;
  use_filler_phrases: boolean;
  filler_phrases: string[] | null;
  end_call_phrases: string[] | null;
  is_active: boolean;
  compiled_prompt: string | null;
  compiled_prompt_at: string | null;
  first_message: string | null;
}

/**
 * Assistant type from voice_assistant_types table
 */
export interface AssistantTypeDbConfig {
  id: string;
  vertical: Vertical;
  name: string;
  display_name: string;
  description: string | null;
  enabled_capabilities: Capability[];
  available_tools: Tool[];
  template_version: number;
  is_default: boolean;
  is_active: boolean;
}

// =====================================================
// BUSINESS CONTEXT FOR TEMPLATES
// =====================================================

/**
 * Business context used for template compilation
 */
export interface TemplateBusinessContext {
  /** Tenant ID */
  tenantId: string;
  /** Business name */
  tenantName: string;
  /** Vertical */
  vertical: Vertical;

  // === Branches ===
  branches: Array<{
    name: string;
    address?: string;
    city?: string;
    phone?: string;
    operatingHours?: Record<string, { open: string; close: string }>;
    isHeadquarters?: boolean;
  }>;

  // === Services ===
  services: Array<{
    name: string;
    description?: string;
    priceMin?: number;
    priceMax?: number;
    durationMinutes?: number;
    category?: string;
  }>;

  // === Delivery Configuration (added in v2.1 - Migration 156) ===
  /** Whether delivery is enabled */
  deliveryEnabled?: boolean;
  /** Delivery configuration from service_options */
  deliveryConfig?: {
    maxRadiusKm: number;
    deliveryFee: number;
    minimumOrderAmount?: number;
    estimatedTimeMinutes: number;
  };

  // === Staff ===
  staff: Array<{
    name: string;
    role?: string;
    specialty?: string;
    title?: string;
  }>;
}

// =====================================================
// COMPILER CONFIGURATION
// =====================================================

/**
 * Configuration for the template prompt compiler
 */
export interface TemplateCompilerConfig {
  /** Path to templates directory */
  templatesPath: string;
  /** Default locale */
  defaultLocale: string;
  /** Whether to validate compiled prompts */
  validateOnCompile: boolean;
  /** Maximum prompt length */
  maxPromptLength: number;
}

/**
 * Default compiler configuration
 */
export const DEFAULT_COMPILER_CONFIG: TemplateCompilerConfig = {
  templatesPath: 'templates/prompts',
  defaultLocale: 'es-MX',
  validateOnCompile: true,
  maxPromptLength: 8000,
};

// =====================================================
// VERTICAL TO BUSINESS TYPE MAPPING
// =====================================================

/**
 * Maps vertical to Spanish business type name
 */
export const VERTICAL_TO_BUSINESS_TYPE: Record<Vertical, string> = {
  dental: 'consultorio dental',
  restaurant: 'restaurante',
  medical: 'consultorio médico',
  gym: 'gimnasio',
  services: 'negocio de servicios',
  general: 'negocio',
};

/**
 * Maps vertical to main task description
 */
export const VERTICAL_TO_MAIN_TASK: Record<Vertical, string> = {
  dental: 'agendar citas dentales',
  restaurant: 'crear reservas',
  medical: 'agendar consultas médicas',
  gym: 'informar sobre membresías y clases',
  services: 'agendar citas de servicio',
  general: 'ayudar a los clientes',
};

// =====================================================
// TEMPLATE NAME MAPPING
// =====================================================

/**
 * Maps assistant type name to template file
 */
export function getTemplateFileName(vertical: Vertical, typeName: string): string {
  // typeName examples: "rest_basic", "dental_standard", "rest_complete"
  // Template files: restaurant/rest_basic.hbs, dental/dental_standard.hbs
  const folder = vertical === 'restaurant' ? 'restaurant' : vertical;
  return `${folder}/${typeName}`;
}

/**
 * Maps personality type to template file
 */
export function getPersonalityFileName(personality: PersonalityType): string {
  return `personalities/${personality}`;
}

/**
 * TIS TIS Platform - Messaging Agent v2.0
 * Template Messaging Compiler Types
 *
 * Types for the hybrid prompt system for MESSAGING channel:
 * - Handlebars templates specialized for WhatsApp/SMS/Chat
 * - Business context (data)
 * - Gemini enrichment (Knowledge Base)
 *
 * DIFERENCIAS CON VOZ:
 * - Emojis funcionales permitidos
 * - Formato markdown (negritas, listas)
 * - Sin muletillas de voz
 * - Respuestas más detalladas
 */

import type { PersonalityType, Capability, Tool } from '@/lib/voice-agent/types';

// Extended Vertical type that includes all business types
export type Vertical = 'restaurant' | 'dental' | 'medical' | 'gym' | 'services' | 'general';

// =====================================================
// COMPILED PROMPT OUTPUT
// =====================================================

/**
 * Result of compiling a messaging prompt from templates
 */
export interface CompiledMessagingPrompt {
  /** The compiled prompt text */
  basePrompt: string;
  /** Initial greeting message (for first contact) */
  greetingMessage: string;
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
  /** Channel type */
  channel: 'messaging';
}

// Note: HybridMessagingPromptResult is defined in
// src/features/ai/services/hybrid-messaging-prompt.service.ts
// because it extends PromptGenerationResult which is defined there

// =====================================================
// TEMPLATE VARIABLES (Messaging-specific)
// =====================================================

/**
 * Variables passed to Handlebars templates for messaging compilation
 */
export interface MessagingTemplateVariables {
  // === Assistant Identity ===
  /** Name of the assistant (e.g., "Javier") */
  assistantName: string;
  /** Business name (e.g., "Mariscos el Caracol") */
  businessName: string;
  /** Business type in Spanish (e.g., "restaurante", "consultorio dental") */
  businessType: string;

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

  // === Personality & Style (Messaging-specific) ===
  /** Personality style content (from messaging personality template) */
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
// MESSAGING ASSISTANT CONFIG (from DB)
// =====================================================

/**
 * Messaging assistant configuration - can come from various sources
 */
export interface MessagingAssistantConfig {
  id: string;
  tenant_id: string;
  assistant_type_id: string | null;
  assistant_name: string;
  personality_type: PersonalityType;
  special_instructions: string | null;
  is_active: boolean;
  compiled_prompt: string | null;
  compiled_prompt_at: string | null;
}

/**
 * Assistant type configuration for messaging
 */
export interface MessagingAssistantTypeConfig {
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
 * Business context used for messaging template compilation
 */
export interface MessagingBusinessContext {
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
 * Configuration for the messaging template compiler
 */
export interface MessagingCompilerConfig {
  /** Path to messaging templates directory */
  templatesPath: string;
  /** Default locale */
  defaultLocale: string;
  /** Whether to validate compiled prompts */
  validateOnCompile: boolean;
  /** Maximum prompt length */
  maxPromptLength: number;
}

/**
 * Default compiler configuration for messaging
 */
export const DEFAULT_MESSAGING_COMPILER_CONFIG: MessagingCompilerConfig = {
  templatesPath: 'templates/prompts/messaging',
  defaultLocale: 'es-MX',
  validateOnCompile: true,
  maxPromptLength: 10000, // Messaging can be more verbose
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
// TEMPLATE NAME MAPPING (Messaging-specific paths)
// =====================================================

/**
 * Maps assistant type name to messaging template file
 * Note: Points to messaging/ subdirectory
 */
export function getMessagingTemplateFileName(vertical: Vertical, typeName: string): string {
  // typeName examples: "rest_basic", "dental_standard", "rest_complete"
  // Template files: restaurant/rest_basic.hbs, dental/dental_standard.hbs
  const folder = vertical === 'restaurant' ? 'restaurant' : vertical;
  return `${folder}/${typeName}`;
}

/**
 * Maps personality type to messaging personality template file
 */
export function getMessagingPersonalityFileName(personality: PersonalityType): string {
  return `personalities/${personality}`;
}

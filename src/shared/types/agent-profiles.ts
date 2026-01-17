// =====================================================
// TIS TIS PLATFORM - Agent Profiles Types
// Tipos TypeScript para el sistema de perfiles de agentes
// =====================================================

import type { ResponseStyle, VerticalType, ProfileType, AgentCapability } from '../config/agent-templates';

// ======================
// DATABASE TYPES
// ======================

/**
 * Perfil de agente como viene de la base de datos
 */
export interface AgentProfile {
  id: string;
  tenant_id: string;
  profile_type: ProfileType;
  profile_name: string;
  profile_description?: string;
  agent_template: string;
  response_style: ResponseStyle;
  response_delay_minutes: number;
  response_delay_first_only: boolean;
  custom_instructions_override?: string;
  ai_learning_enabled: boolean;
  ai_learning_config: AILearningConfig;
  settings: AgentProfileSettings;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

/**
 * Configuración de AI Learning por perfil
 */
export interface AILearningConfig {
  learn_patterns: boolean;
  learn_vocabulary: boolean;
  learn_preferences: boolean;
  sync_to_business_ia: boolean;
}

/**
 * Settings adicionales del perfil
 */
export interface AgentProfileSettings {
  // Variables personalizadas del template
  template_variables?: Record<string, string>;

  // Configuración de canales
  enabled_channels?: string[];

  // Configuración avanzada
  max_response_length?: number;
  out_of_hours_enabled?: boolean;
  out_of_hours_message?: string;

  // Configuración de escalamiento (migrado de Leads y Prioridades)
  escalation_keywords?: string[];
  max_turns_before_escalation?: number;
  escalate_on_hot_lead?: boolean;
}

/**
 * Input para crear/actualizar un perfil
 */
export interface AgentProfileInput {
  profile_name: string;
  profile_description?: string;
  agent_template: string;
  response_style: ResponseStyle;
  response_delay_minutes?: number;
  response_delay_first_only?: boolean;
  custom_instructions_override?: string;
  ai_learning_enabled?: boolean;
  ai_learning_config?: Partial<AILearningConfig>;
  settings?: Partial<AgentProfileSettings>;
  is_active?: boolean;
}

// ======================
// API RESPONSE TYPES
// ======================

/**
 * Respuesta de la API al obtener perfiles
 */
export interface GetProfilesResponse {
  success: boolean;
  data: {
    business: AgentProfileWithChannels | null;
    personal: AgentProfileWithChannels | null;
  };
  error?: string;
}

/**
 * Perfil con información de canales conectados
 */
export interface AgentProfileWithChannels extends AgentProfile {
  channels: ChannelConnection[];
  voice_config?: VoiceConfigSummary;
}

/**
 * Resumen de configuración de voz
 */
export interface VoiceConfigSummary {
  enabled: boolean;
  phone_number?: string;
  voice_id?: string;
  voice_name?: string;
  assistant_name?: string;
}

/**
 * Conexión de canal vinculada a un perfil
 */
export interface ChannelConnection {
  channel_id: string;
  channel_type: 'whatsapp' | 'instagram' | 'messenger' | 'webchat' | 'tiktok' | 'facebook';
  channel_identifier?: string;
  account_name?: string;
  is_connected: boolean;
  account_number: 1 | 2;
  profile_id: string | null;
}

// ======================
// UI COMPONENT TYPES
// ======================

/**
 * Props para el card de perfil
 */
export interface ProfileCardProps {
  profile: AgentProfileWithChannels | null;
  profileType: ProfileType;
  vertical: string;
  tenantName?: string;
  isLoading?: boolean;
  isActivating?: boolean;
  isTogglingActive?: boolean;
  onConfigure: () => void;
  onActivate?: () => void;
  onToggleActive?: (isActive: boolean) => void;
}

/**
 * Props para el modal de configuración
 */
export interface ProfileConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: AgentProfile | AgentProfileWithChannels | null;
  profileType: ProfileType;
  vertical: VerticalType;
  onSave: (data: AgentProfileInput) => Promise<boolean>;
  isSaving?: boolean;
}

/**
 * Estado del formulario de configuración
 */
export interface ProfileFormState {
  // Paso 1: Tipo de asistente
  agent_template: string;

  // Paso 2: Personalización
  profile_name: string;
  response_style: ResponseStyle;

  // Paso 3: Configuración avanzada
  response_delay_minutes: number;
  response_delay_first_only: boolean;
  ai_learning_enabled: boolean;

  // Variables del template
  template_variables: Record<string, string>;

  // Instrucciones extra
  custom_instructions_override: string;
}

/**
 * Tab de configuración
 */
export type ConfigTab = 'general' | 'voice' | 'channels' | 'advanced';

// ======================
// VOICE AGENT TYPES
// ======================

/**
 * Configuración de voz disponible
 */
export interface AvailableVoice {
  id: string;
  name: string;
  gender: 'female' | 'male';
  description: string;
  preview_url?: string;
}

/**
 * Configuración de Voice Agent para perfil
 */
export interface VoiceAgentProfileConfig {
  voice_enabled: boolean;
  voice_id: string;
  assistant_name: string;
  first_message: string;
  phone_number?: string;
  phone_area_code?: string;
}

// ======================
// VALIDATION TYPES
// ======================

/**
 * Resultado de validación
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Error de validación
 */
export interface ValidationError {
  field: string;
  message: string;
}

// ======================
// HELPER TYPE GUARDS
// ======================

export function isBusinessProfile(profile: AgentProfile): boolean {
  return profile.profile_type === 'business';
}

export function isPersonalProfile(profile: AgentProfile): boolean {
  return profile.profile_type === 'personal';
}

export function hasVoiceCapability(profile: AgentProfileWithChannels): boolean {
  return profile.profile_type === 'business' && !!profile.voice_config?.enabled;
}

// ======================
// DEFAULT VALUES
// ======================

export const DEFAULT_AI_LEARNING_CONFIG: AILearningConfig = {
  learn_patterns: true,
  learn_vocabulary: false, // No adoptar jerga de clientes
  learn_preferences: true,
  sync_to_business_ia: true,
};

export const DEFAULT_PROFILE_SETTINGS: AgentProfileSettings = {
  template_variables: {},
  enabled_channels: ['whatsapp'],
  max_response_length: 300,
  out_of_hours_enabled: true,
  // Escalation settings (sincronizados con ai_tenant_config)
  escalation_keywords: ['queja', 'molesto', 'enojado', 'gerente', 'supervisor'],
  max_turns_before_escalation: 15,
  escalate_on_hot_lead: true,
};

export const DEFAULT_BUSINESS_PROFILE: Partial<AgentProfile> = {
  profile_type: 'business',
  response_style: 'professional_friendly',
  response_delay_minutes: 0,
  response_delay_first_only: true,
  ai_learning_enabled: true,
  ai_learning_config: DEFAULT_AI_LEARNING_CONFIG,
  settings: DEFAULT_PROFILE_SETTINGS,
  is_active: true,
};

export const DEFAULT_PERSONAL_PROFILE: Partial<AgentProfile> = {
  profile_type: 'personal',
  response_style: 'professional_friendly',
  response_delay_minutes: 8, // Delay de 8 minutos para simular humano
  response_delay_first_only: true,
  ai_learning_enabled: true,
  ai_learning_config: DEFAULT_AI_LEARNING_CONFIG,
  settings: {
    ...DEFAULT_PROFILE_SETTINGS,
    enabled_channels: ['instagram', 'whatsapp'],
  },
  is_active: false, // Inactivo por defecto, usuario debe activarlo
};

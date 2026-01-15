// =====================================================
// TIS TIS PLATFORM - Channel Types
// Type definitions for multi-channel account system
// =====================================================

// ======================
// ENUMS & CONSTANTS
// ======================

export type ChannelType = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';
export type ConnectionStatus = 'pending' | 'configuring' | 'connected' | 'disconnected' | 'error' | 'suspended';
export type AccountNumber = 1 | 2;
export type AIPersonality = 'professional' | 'professional_friendly' | 'casual' | 'formal';

// ======================
// CHANNEL CONNECTION
// ======================

export interface ChannelConnection {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  channel: ChannelType;
  status: ConnectionStatus;
  ai_enabled: boolean;

  // Multi-account fields (new)
  account_number: AccountNumber;
  account_name: string;
  is_personal_brand: boolean;

  // Profile connection (Migration 125)
  profile_id: string | null;

  // AI override settings (new)
  ai_personality_override: AIPersonality | null;
  first_message_delay_seconds: number;
  subsequent_message_delay_seconds: number;
  custom_instructions_override: string | null;

  // WhatsApp fields
  whatsapp_phone_number_id?: string;
  whatsapp_business_account_id?: string;
  whatsapp_access_token?: string;
  whatsapp_verify_token?: string;

  // Instagram fields
  instagram_page_id?: string;
  instagram_account_id?: string;
  instagram_username?: string;
  instagram_access_token?: string;
  instagram_verify_token?: string;

  // Facebook fields
  facebook_page_id?: string;
  facebook_page_name?: string;
  facebook_access_token?: string;
  facebook_verify_token?: string;

  // TikTok fields
  tiktok_client_key?: string;
  tiktok_client_secret?: string;
  tiktok_access_token?: string;
  tiktok_open_id?: string;
  tiktok_verify_token?: string;

  // Common
  webhook_secret?: string;
  webhook_url?: string;
  error_message?: string;
  messages_received?: number;
  messages_sent?: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;

  // Relations
  branches?: {
    id: string;
    name: string;
    city: string;
    is_headquarters: boolean;
  };
}

// ======================
// EFFECTIVE AI CONFIG
// (Merged: tenant defaults + channel overrides)
// ======================

export interface EffectiveChannelAIConfig {
  channel_id: string;
  channel: ChannelType;
  account_number: AccountNumber;
  account_name: string;
  is_personal_brand: boolean;
  profile_id: string | null;
  ai_enabled: boolean;
  ai_personality: AIPersonality;
  first_message_delay_seconds: number;
  subsequent_message_delay_seconds: number;
  custom_instructions: string | null;
  use_emojis: boolean;
  ai_temperature: number;
  max_tokens: number;
  escalation_keywords: string[];
  max_turns_before_escalation: number;
  supported_languages: string[];
  default_language: string;
}

// ======================
// CHANNEL METADATA
// ======================

export interface ChannelMetadata {
  type: ChannelType;
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
  textColor: string;
  description: string;
  icon: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';
}

export const CHANNEL_METADATA: Record<ChannelType, ChannelMetadata> = {
  whatsapp: {
    type: 'whatsapp',
    name: 'WhatsApp Business',
    shortName: 'WhatsApp',
    color: '#25D366',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    description: 'Mensajería directa con tus clientes',
    icon: 'whatsapp',
  },
  instagram: {
    type: 'instagram',
    name: 'Instagram Direct',
    shortName: 'Instagram',
    color: '#E4405F',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-600',
    description: 'DMs de Instagram integrados',
    icon: 'instagram',
  },
  facebook: {
    type: 'facebook',
    name: 'Facebook Messenger',
    shortName: 'Messenger',
    color: '#1877F2',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    description: 'Messenger de tu página de Facebook',
    icon: 'facebook',
  },
  tiktok: {
    type: 'tiktok',
    name: 'TikTok Messages',
    shortName: 'TikTok',
    color: '#000000',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-900',
    description: 'Mensajes directos de TikTok',
    icon: 'tiktok',
  },
};

// ======================
// PERSONALITY METADATA
// ======================

export interface PersonalityMetadata {
  id: AIPersonality;
  name: string;
  description: string;
  example: string;
  emoji: string;
}

export const PERSONALITY_METADATA: Record<AIPersonality, PersonalityMetadata> = {
  professional: {
    id: 'professional',
    name: 'Profesional',
    description: 'Formal y directo, ideal para comunicaciones corporativas',
    example: 'Estimado paciente, le confirmamos su cita para el día 15 de enero a las 10:00 AM.',
    emoji: '👔',
  },
  professional_friendly: {
    id: 'professional_friendly',
    name: 'Profesional Amigable',
    description: 'Balance perfecto entre profesionalismo y calidez',
    example: '¡Hola! Tu cita está confirmada para el 15 de enero a las 10:00 AM. ¡Te esperamos!',
    emoji: '😊',
  },
  casual: {
    id: 'casual',
    name: 'Casual',
    description: 'Relajado y cercano, ideal para marcas personales',
    example: '¡Hey! Ya quedó tu cita para el 15 a las 10am. Nos vemos pronto 👋',
    emoji: '✌️',
  },
  formal: {
    id: 'formal',
    name: 'Muy Formal',
    description: 'Extremadamente profesional, sin abreviaciones',
    example: 'Distinguido paciente, nos permitimos confirmar su cita programada para el día 15 de enero de 2025 a las 10:00 horas.',
    emoji: '🎩',
  },
};

// ======================
// DELAY PRESETS
// ======================

export interface DelayPreset {
  id: string;
  name: string;
  description: string;
  firstMessageDelay: number;
  subsequentMessageDelay: number;
}

export const DELAY_PRESETS: DelayPreset[] = [
  {
    id: 'immediate',
    name: 'Respuesta Inmediata',
    description: 'Responde al instante (puede parecer bot)',
    firstMessageDelay: 0,
    subsequentMessageDelay: 0,
  },
  {
    id: 'natural',
    name: 'Natural (Recomendado)',
    description: 'Primer mensaje 5-8 min, seguimiento inmediato',
    firstMessageDelay: 480,
    subsequentMessageDelay: 0,
  },
  {
    id: 'busy',
    name: 'Ocupado',
    description: 'Como si estuviera atendiendo otros pacientes',
    firstMessageDelay: 900,
    subsequentMessageDelay: 60,
  },
  {
    id: 'custom',
    name: 'Personalizado',
    description: 'Configura tus propios tiempos',
    firstMessageDelay: 0,
    subsequentMessageDelay: 0,
  },
];

// ======================
// API TYPES
// ======================

export interface CreateChannelRequest {
  channel: ChannelType;
  account_number: AccountNumber;
  account_name?: string;
  branch_id?: string;
  is_personal_brand?: boolean;
  // Channel-specific fields
  [key: string]: unknown;
}

export interface UpdateChannelRequest {
  id: string;
  status?: ConnectionStatus;
  ai_enabled?: boolean;
  account_name?: string;
  is_personal_brand?: boolean;
  branch_id?: string | null;
  // AI settings
  ai_personality_override?: AIPersonality | null;
  first_message_delay_seconds?: number;
  subsequent_message_delay_seconds?: number;
  custom_instructions_override?: string | null;
  // Channel-specific fields
  [key: string]: unknown;
}

// ======================
// GROUPED CHANNELS
// (For UI display: group by channel type)
// ======================

export interface ChannelGroup {
  type: ChannelType;
  metadata: ChannelMetadata;
  accounts: ChannelConnection[];
  canAddMore: boolean;
}

// =====================================================
// TIS TIS PLATFORM - Voice Agent Types
// Tipos para el sistema de AI Agent por Voz
// =====================================================

// =====================================================
// VOICE AGENT CONFIG
// =====================================================

export type VoiceStatus = 'inactive' | 'configuring' | 'active' | 'suspended' | 'error';
export type VoicePersonality = 'professional' | 'professional_friendly' | 'casual' | 'formal';
export type FirstMessageMode = 'assistant_speaks_first' | 'wait_for_user';
export type VoiceProvider = 'elevenlabs' | 'google' | 'azure' | 'openai';
export type TranscriptionProvider = 'deepgram' | 'google' | 'azure' | 'whisper';
export type AIModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'claude-3-5-sonnet-20241022' | 'claude-3-haiku-20240307';
export type TelephonyProvider = 'twilio' | 'vonage' | 'telnyx' | 'bandwidth';

export interface VoiceAgentConfig {
  id: string;
  tenant_id: string;

  // Estado
  voice_enabled: boolean;
  voice_status: VoiceStatus;

  // Asistente
  assistant_name: string;
  assistant_personality: VoicePersonality;

  // Primer mensaje
  first_message: string;
  first_message_mode: FirstMessageMode;

  // Voz (ElevenLabs)
  voice_provider: VoiceProvider;
  voice_id: string;
  voice_model: string;
  voice_stability: number;
  voice_similarity_boost: number;
  voice_style: number;
  voice_use_speaker_boost: boolean;

  // Transcripción (Deepgram)
  transcription_provider: TranscriptionProvider;
  transcription_model: string;
  transcription_language: string;
  transcription_confidence_threshold: number;

  // IA
  ai_model: AIModel;
  ai_temperature: number;
  ai_max_tokens: number;

  // Start Speaking Plan
  wait_seconds: number;
  on_punctuation_seconds: number;
  on_no_punctuation_seconds: number;

  // Llamada
  max_call_duration_seconds: number;
  silence_timeout_seconds: number;
  response_delay_seconds: number;
  interruption_threshold: number;

  // Privacidad
  recording_enabled: boolean;
  transcription_stored: boolean;
  hipaa_enabled: boolean;
  pci_enabled: boolean;

  // Frases
  filler_phrases: string[];
  use_filler_phrases: boolean;
  end_call_phrases: string[];

  // Prompt
  system_prompt: string | null;
  system_prompt_generated_at: string | null;
  custom_instructions: string | null;

  // Metadata
  last_configured_at: string | null;
  last_configured_by: string | null;
  configuration_version: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface VoiceAgentConfigInput {
  assistant_name?: string;
  assistant_personality?: VoicePersonality;
  first_message?: string;
  first_message_mode?: FirstMessageMode;
  voice_id?: string;
  voice_stability?: number;
  voice_similarity_boost?: number;
  ai_model?: AIModel;
  ai_temperature?: number;
  ai_max_tokens?: number;
  max_call_duration_seconds?: number;
  recording_enabled?: boolean;
  use_filler_phrases?: boolean;
  custom_instructions?: string;
}

// =====================================================
// VOICE PHONE NUMBERS
// =====================================================

export type PhoneNumberStatus = 'pending' | 'provisioning' | 'active' | 'suspended' | 'released';

export interface VoicePhoneNumber {
  id: string;
  tenant_id: string;
  voice_agent_config_id: string | null;
  branch_id: string | null;

  // Número
  phone_number: string;
  phone_number_display: string | null;
  area_code: string | null;
  country_code: string;

  // Proveedor
  telephony_provider: TelephonyProvider;
  provider_phone_sid: string | null;

  // Estado
  status: PhoneNumberStatus;

  // Costo
  monthly_cost_usd: number | null;
  per_minute_cost_usd: number | null;

  // Stats
  total_calls: number;
  total_minutes: number;
  last_call_at: string | null;

  // Timestamps
  provisioned_at: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// VOICE CALLS
// =====================================================

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'initiated' | 'ringing' | 'in_progress' | 'completed' | 'busy' | 'no_answer' | 'failed' | 'canceled' | 'escalated';
export type CallOutcome = 'appointment_booked' | 'information_given' | 'escalated_human' | 'callback_requested' | 'not_interested' | 'wrong_number' | 'voicemail' | 'dropped' | 'completed_other';

export interface TranscriptionSegment {
  speaker: 'user' | 'assistant' | 'system';
  text: string;
  start: number;
  end: number;
}

export interface CallAnalysis {
  customer_name?: string;
  customer_phone?: string;
  appointment_requested?: boolean;
  appointment_date?: string;
  appointment_time?: string;
  service_requested?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  urgency?: 'low' | 'medium' | 'high';
  key_topics?: string[];
}

export interface VoiceCall {
  id: string;
  tenant_id: string;
  voice_agent_config_id: string | null;
  phone_number_id: string | null;
  lead_id: string | null;
  conversation_id: string | null;

  // Llamada
  call_direction: CallDirection;
  caller_phone: string;
  called_phone: string;
  provider_call_sid: string | null;
  vapi_call_id: string | null;

  // Estado
  status: CallStatus;

  // Timing
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  billable_seconds: number;

  // Grabación
  recording_url: string | null;
  recording_duration_seconds: number | null;

  // Transcripción
  transcription: string | null;
  transcription_segments: TranscriptionSegment[];

  // Análisis
  analysis: CallAnalysis;
  primary_intent: string | null;
  detected_intents: string[];
  detected_signals: Array<{ signal: string; points: number }>;

  // Resultado
  outcome: CallOutcome | null;
  outcome_notes: string | null;

  // Lead scoring
  lead_score_change: number;

  // Escalación
  escalated: boolean;
  escalated_at: string | null;
  escalated_reason: string | null;
  escalated_to_staff_id: string | null;

  // Costos
  cost_usd: number;
  ai_tokens_used: number;

  // Métricas
  latency_avg_ms: number | null;
  turns_count: number;

  // Error
  error_message: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface VoiceCallMessage {
  id: string;
  call_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  audio_url: string | null;
  start_time_seconds: number | null;
  end_time_seconds: number | null;
  duration_seconds: number | null;
  detected_intent: string | null;
  confidence: number | null;
  response_latency_ms: number | null;
  tokens_used: number;
  sequence_number: number;
  created_at: string;
}

// =====================================================
// VOICE USAGE
// =====================================================

export type UsageType = 'call_minutes' | 'transcription' | 'tts' | 'ai_tokens' | 'recording_storage' | 'phone_number';

export interface VoiceUsageLog {
  id: string;
  tenant_id: string;
  call_id: string | null;
  usage_type: UsageType;
  quantity: number;
  unit: string;
  unit_cost_usd: number;
  total_cost_usd: number;
  provider: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  created_at: string;
}

export interface VoiceUsageSummary {
  total_calls: number;
  total_minutes: number;
  total_cost_usd: number;
  avg_call_duration_seconds: number;
  appointment_booking_rate: number;
  escalation_rate: number;
  by_day: Array<{
    date: string;
    calls: number;
    minutes: number;
    cost_usd: number;
  }>;
}

// =====================================================
// VOICE PROMPT TEMPLATES
// =====================================================

export interface VoicePromptTemplate {
  id: string;
  vertical: string;
  template_key: string;
  template_name: string;
  template_text: string;
  available_variables: string[];
  first_message_template: string;
  recommended_config: Record<string, unknown>;
  is_default: boolean;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// API RESPONSES
// =====================================================

export interface VoiceAgentStatus {
  status: 'blocked' | 'inactive' | 'configuring' | 'active';
  reason?: string;
  plan: string;
  config?: VoiceAgentConfig;
  phone_numbers?: VoicePhoneNumber[];
  usage_summary?: VoiceUsageSummary;
  recent_calls?: VoiceCall[];
}

export interface VoiceAgentContextResponse {
  tenant: {
    id: string;
    name: string;
    slug: string;
    vertical: string;
    plan: string;
  };
  voice_config: VoiceAgentConfig | null;
  phone_numbers: VoicePhoneNumber[];
  branches: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    phone: string;
    operating_hours: Record<string, unknown>;
    is_headquarters: boolean;
  }>;
  staff: Array<{
    id: string;
    display_name: string;
    role: string;
    specialty: string | null;
  }>;
  services: Array<{
    id: string;
    name: string;
    description: string;
    price_min: number;
    price_max: number;
    duration_minutes: number;
    category: string;
  }>;
  generated_prompt: string | null;
  recent_calls_summary: {
    total_today: number;
    total_week: number;
    avg_duration_seconds: number;
    escalation_rate: number;
  };
}

// =====================================================
// TWILIO WEBHOOK TYPES
// =====================================================

export interface TwilioVoiceWebhook {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled';
  ApiVersion: string;
  Direction: 'inbound' | 'outbound-api' | 'outbound-dial';
  ForwardedFrom?: string;
  CallerName?: string;
  ParentCallSid?: string;
  CallDuration?: string;
  RecordingUrl?: string;
  RecordingDuration?: string;
  Digits?: string;
  SpeechResult?: string;
  Confidence?: string;
}

export interface TwilioStatusCallback extends TwilioVoiceWebhook {
  Timestamp: string;
  CallbackSource: string;
  SequenceNumber: string;
}

// =====================================================
// VAPI TYPES (si usamos VAPI)
// =====================================================

export interface VAPIAssistantConfig {
  name: string;
  firstMessage: string;
  firstMessageMode: 'assistant-speaks-first' | 'assistant-waits-for-user';
  model: {
    model: string;
    provider: string;
    temperature: number;
    maxTokens: number;
    messages: Array<{ role: string; content: string }>;
  };
  voice: {
    voiceId: string;
    provider: string;
    model: string;
    stability: number;
    similarityBoost: number;
  };
  transcriber: {
    model: string;
    language: string;
    provider: string;
  };
  startSpeakingPlan: {
    waitSeconds: number;
    onPunctuationSeconds: number;
    onNoPunctuationSeconds: number;
  };
  endCallPhrases: string[];
  recordingEnabled: boolean;
  hipaaEnabled: boolean;
}

// =====================================================
// TEST CALL TYPES
// =====================================================

export interface TestCallRequest {
  tenant_id: string;
  test_mode: 'web' | 'phone';
  phone_number?: string; // Solo si test_mode = 'phone'
}

export interface TestCallSession {
  session_id: string;
  status: 'connecting' | 'connected' | 'ended' | 'error';
  websocket_url?: string;
  messages: VoiceCallMessage[];
  started_at: string;
  ended_at?: string;
}

// =====================================================
// AVAILABLE VOICES
// =====================================================

export interface AvailableVoice {
  id: string;
  name: string;
  provider: VoiceProvider;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  preview_url?: string;
  is_default?: boolean;
}

export const AVAILABLE_VOICES: AvailableVoice[] = [
  // ElevenLabs Spanish Voices
  {
    id: 'LegCbmbXKbT5PUp3QFWv',
    name: 'Javier',
    provider: 'elevenlabs',
    language: 'es',
    gender: 'male',
    accent: 'mexicano',
    is_default: true,
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sofia',
    provider: 'elevenlabs',
    language: 'es',
    gender: 'female',
    accent: 'mexicano',
  },
  {
    id: 'IKne3meq5aSn9XLyUdCD',
    name: 'Carlos',
    provider: 'elevenlabs',
    language: 'es',
    gender: 'male',
    accent: 'neutral',
  },
  {
    id: 'XB0fDUnXU5powFXDhCwa',
    name: 'Maria',
    provider: 'elevenlabs',
    language: 'es',
    gender: 'female',
    accent: 'neutral',
  },
];

// =====================================================
// AREA CODES (LADA) - MEXICO
// =====================================================

export interface AreaCode {
  code: string;
  city: string;
  state: string;
}

export const MEXICO_AREA_CODES: AreaCode[] = [
  { code: '55', city: 'Ciudad de México', state: 'CDMX' },
  { code: '33', city: 'Guadalajara', state: 'Jalisco' },
  { code: '81', city: 'Monterrey', state: 'Nuevo León' },
  { code: '614', city: 'Chihuahua', state: 'Chihuahua' },
  { code: '656', city: 'Ciudad Juárez', state: 'Chihuahua' },
  { code: '631', city: 'Nogales', state: 'Sonora' },
  { code: '662', city: 'Hermosillo', state: 'Sonora' },
  { code: '664', city: 'Tijuana', state: 'Baja California' },
  { code: '686', city: 'Mexicali', state: 'Baja California' },
  { code: '998', city: 'Cancún', state: 'Quintana Roo' },
  { code: '999', city: 'Mérida', state: 'Yucatán' },
  { code: '222', city: 'Puebla', state: 'Puebla' },
  { code: '442', city: 'Querétaro', state: 'Querétaro' },
  { code: '477', city: 'León', state: 'Guanajuato' },
  { code: '449', city: 'Aguascalientes', state: 'Aguascalientes' },
  { code: '871', city: 'Torreón', state: 'Coahuila' },
  { code: '844', city: 'Saltillo', state: 'Coahuila' },
  { code: '229', city: 'Veracruz', state: 'Veracruz' },
  { code: '833', city: 'Tampico', state: 'Tamaulipas' },
  { code: '867', city: 'Nuevo Laredo', state: 'Tamaulipas' },
];

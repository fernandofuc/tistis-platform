/**
 * TIS TIS Platform - Voice Agent v2.0
 * Assistant Request Handler
 *
 * THE MOST CRITICAL HANDLER - Called when a call starts.
 * VAPI sends this event to get the assistant configuration.
 *
 * Arquitectura simplificada - Solo v2 (voice_assistant_configs)
 *
 * Responsibilities:
 * 1. Extract phone number from the call
 * 2. Find tenant/business configuration
 * 3. Load assistant type configuration
 * 4. Render prompt (if using server-side LLM)
 * 5. Return complete assistant configuration to VAPI
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  AssistantRequestPayload,
  AssistantRequestResponse,
  WebhookHandlerContext,
  HandlerResult,
  VapiAssistantConfig,
} from '../types';
import {
  formatAssistantConfig,
  formatAssistantRequestResponse,
  formatAssistantRequestError,
} from '../response-formatters';
import {
  tenantNotFoundError,
  configNotFoundError,
  databaseError,
} from '../error-handler';

// =====================================================
// TYPES
// =====================================================

/**
 * Voice agent configuration from database
 */
interface VoiceAgentConfig {
  id: string;
  tenant_id: string;
  assistant_name: string;
  assistant_type: string;
  first_message: string;
  first_message_mode: string;
  voice_enabled: boolean;
  voice_id: string;
  voice_provider: string;
  voice_model: string;
  voice_stability: number;
  voice_similarity_boost: number;
  transcription_provider: string;
  transcription_model: string;
  transcription_language: string;
  wait_seconds: number;
  on_punctuation_seconds: number;
  on_no_punctuation_seconds: number;
  end_call_phrases: string[];
  end_call_message: string;
  recording_enabled: boolean;
  hipaa_enabled: boolean;
  silence_timeout_seconds: number;
  max_duration_seconds: number;
}

/**
 * Handler options
 */
export interface AssistantRequestHandlerOptions {
  /** Server URL for server-side response mode */
  serverUrl?: string;

  /** Server URL secret */
  serverUrlSecret?: string;

  /** Whether to use server-side response mode */
  useServerSideResponse?: boolean;

  /** Custom Supabase client (for testing) */
  supabaseClient?: SupabaseClient;
}

// =====================================================
// HANDLER FUNCTION
// =====================================================

/**
 * Handle assistant-request event
 *
 * This is the most critical handler - it must respond quickly
 * with the complete assistant configuration.
 */
export async function handleAssistantRequest(
  payload: AssistantRequestPayload,
  context: WebhookHandlerContext,
  options: AssistantRequestHandlerOptions = {}
): Promise<HandlerResult<AssistantRequestResponse>> {
  const supabase = options.supabaseClient || createServiceClient();

  // Extract phone numbers
  const calledNumber = payload.call?.phoneNumber?.number ||
    payload.phoneNumber?.number ||
    '';
  const callerNumber = payload.call?.customer?.number ||
    payload.customer?.number ||
    '';
  const vapiCallId = payload.call?.id || '';

  console.log(
    `[Assistant Request] Processing for call ${vapiCallId}`,
    JSON.stringify({
      calledNumber: maskPhoneNumber(calledNumber),
      callerNumber: maskPhoneNumber(callerNumber),
      requestId: context.requestId,
    })
  );

  try {
    // 1. Get tenant from phone number
    const tenantId = await getTenantFromPhoneNumber(supabase, calledNumber);

    if (!tenantId) {
      console.error(
        `[Assistant Request] No tenant found for number: ${maskPhoneNumber(calledNumber)}`
      );
      return {
        response: formatAssistantRequestError('No assistant configured for this number'),
        statusCode: 404,
        shouldLog: true,
        metadata: { error: 'tenant_not_found', calledNumber: maskPhoneNumber(calledNumber) },
      };
    }

    // Update context with tenant ID
    context.tenantId = tenantId;

    // 2. Get voice configuration
    const voiceConfig = await getVoiceConfig(supabase, tenantId);

    if (!voiceConfig) {
      console.error(`[Assistant Request] Voice config not found for tenant: ${tenantId}`);
      return {
        response: formatAssistantRequestError('Voice agent not enabled'),
        statusCode: 404,
        shouldLog: true,
        metadata: { error: 'config_not_found', tenantId },
      };
    }

    context.voiceConfigId = voiceConfig.id;

    // 3. Create or update call record
    const callId = await createOrUpdateCall(
      supabase,
      vapiCallId,
      tenantId,
      callerNumber,
      calledNumber,
      voiceConfig.id
    );

    context.callId = callId;

    // 4. Build assistant configuration
    const serverUrl = options.useServerSideResponse
      ? options.serverUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/voice-agent/webhook`
      : undefined;

    const assistantConfig = buildAssistantConfig(voiceConfig, {
      serverUrl,
      serverUrlSecret: options.serverUrlSecret,
      useServerSideResponse: options.useServerSideResponse ?? true,
    });

    // 5. Build metadata for tracking
    const metadata = {
      tenant_id: tenantId,
      voice_config_id: voiceConfig.id,
      call_id: callId,
      mode: options.useServerSideResponse ? 'server-side-response' : 'vapi-llm',
    };

    console.log(
      `[Assistant Request] Configuration built successfully`,
      JSON.stringify({
        callId,
        tenantId,
        assistantName: voiceConfig.assistant_name,
        mode: metadata.mode,
        processingTimeMs: Date.now() - context.startTime,
      })
    );

    return {
      response: formatAssistantRequestResponse(assistantConfig, metadata),
      statusCode: 200,
      shouldLog: true,
      metadata: {
        tenantId,
        callId,
        processingTimeMs: Date.now() - context.startTime,
      },
    };
  } catch (error) {
    console.error('[Assistant Request] Error:', error);

    // Return a graceful error response
    return {
      response: formatAssistantRequestError(
        'Unable to configure assistant at this time'
      ),
      statusCode: 500,
      shouldLog: true,
      metadata: {
        error: error instanceof Error ? error.message : 'unknown',
        processingTimeMs: Date.now() - context.startTime,
      },
    };
  }
}

// =====================================================
// DATABASE FUNCTIONS
// =====================================================

/**
 * Create Supabase service client
 */
function createServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Get tenant ID from phone number
 */
async function getTenantFromPhoneNumber(
  supabase: SupabaseClient,
  phoneNumber: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('voice_phone_numbers')
      .select('tenant_id')
      .eq('phone_number', phoneNumber)
      .eq('status', 'active')
      .single();

    if (error) {
      // Not found is expected for unknown numbers
      if (error.code !== 'PGRST116') {
        console.error('[Assistant Request] Error fetching tenant:', error);
      }
      return null;
    }

    return data?.tenant_id || null;
  } catch (error) {
    console.error('[Assistant Request] Exception fetching tenant:', error);
    throw databaseError('getTenantFromPhoneNumber', error instanceof Error ? error : undefined);
  }
}

/**
 * Get voice agent configuration for tenant
 * Usa la tabla voice_assistant_configs (v2)
 */
async function getVoiceConfig(
  supabase: SupabaseClient,
  tenantId: string
): Promise<VoiceAgentConfig | null> {
  try {
    const { data, error } = await supabase
      .from('voice_assistant_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[Assistant Request] Error fetching voice config:', error);
      }
      return null;
    }

    // Get first_message: Use compiled prompt's first_message if available
    // The hybrid system stores first_message when generating the prompt
    let firstMessage = data.first_message;

    // If no custom first_message, generate one based on assistant name and tenant name
    if (!firstMessage || firstMessage.trim() === '') {
      // Try to get tenant name for a better first message
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name, vertical')
        .eq('id', tenantId)
        .single();

      const businessType = tenant?.vertical === 'restaurant' ? 'restaurante' :
                          tenant?.vertical === 'dental' ? 'consultorio dental' : 'negocio';
      const businessName = tenant?.name || 'nuestro negocio';

      firstMessage = `Hola, soy ${data.assistant_name || 'el asistente'} del ${businessType} ${businessName}. ¿Cómo puedo ayudarte el día de hoy?`;
    }

    // Mapear campos de voice_assistant_configs a VoiceAgentConfig
    return {
      id: data.id,
      tenant_id: data.tenant_id,
      assistant_name: data.assistant_name || 'Asistente',
      assistant_type: data.assistant_type_id,
      first_message: firstMessage,
      first_message_mode: data.first_message_mode || 'assistant_speaks_first',
      voice_enabled: data.is_active,
      voice_id: data.voice_id,
      voice_provider: 'elevenlabs',
      voice_model: 'eleven_multilingual_v2',
      voice_stability: 0.5,
      voice_similarity_boost: 0.75,
      transcription_provider: 'deepgram',
      transcription_model: 'nova-2',
      transcription_language: 'es',
      wait_seconds: 0.6,
      on_punctuation_seconds: 0.2,
      on_no_punctuation_seconds: 1.2,
      end_call_phrases: data.end_call_phrases || ['adiós', 'hasta luego', 'bye'],
      end_call_message: '',
      recording_enabled: data.recording_enabled ?? true,
      hipaa_enabled: data.hipaa_enabled ?? false,
      silence_timeout_seconds: data.silence_timeout_seconds || 30,
      max_duration_seconds: data.max_call_duration_seconds || 600,
    } as VoiceAgentConfig;
  } catch (error) {
    console.error('[Assistant Request] Exception fetching voice config:', error);
    throw databaseError('getVoiceConfig', error instanceof Error ? error : undefined);
  }
}

/**
 * Create or update call record
 */
async function createOrUpdateCall(
  supabase: SupabaseClient,
  vapiCallId: string,
  tenantId: string,
  callerPhone: string,
  calledPhone: string,
  voiceConfigId: string
): Promise<string> {
  try {
    // Check for existing call
    const { data: existingCall } = await supabase
      .from('voice_calls')
      .select('id')
      .eq('vapi_call_id', vapiCallId)
      .single();

    if (existingCall) {
      return existingCall.id;
    }

    // Get phone number ID if exists
    const { data: phoneNumber } = await supabase
      .from('voice_phone_numbers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone_number', calledPhone)
      .single();

    // Create new call record
    const { data: newCall, error } = await supabase
      .from('voice_calls')
      .insert({
        tenant_id: tenantId,
        vapi_call_id: vapiCallId,
        caller_phone: callerPhone,
        called_phone: calledPhone,
        call_direction: 'inbound',
        status: 'initiated',
        started_at: new Date().toISOString(),
        voice_agent_config_id: voiceConfigId,
        phone_number_id: phoneNumber?.id || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Assistant Request] Error creating call:', error);
      throw databaseError('createOrUpdateCall', error);
    }

    return newCall.id;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Database error')) {
      throw error;
    }
    console.error('[Assistant Request] Exception in createOrUpdateCall:', error);
    throw databaseError('createOrUpdateCall', error instanceof Error ? error : undefined);
  }
}

// =====================================================
// CONFIGURATION BUILDERS
// =====================================================

/**
 * Build assistant configuration from voice config
 */
function buildAssistantConfig(
  voiceConfig: VoiceAgentConfig,
  options: {
    serverUrl?: string;
    serverUrlSecret?: string;
    useServerSideResponse?: boolean;
  }
): VapiAssistantConfig {
  return formatAssistantConfig(
    {
      assistantName: voiceConfig.assistant_name,
      firstMessage: voiceConfig.first_message,
      firstMessageMode: voiceConfig.first_message_mode,
      voiceId: voiceConfig.voice_id,
      voiceProvider: voiceConfig.voice_provider,
      voiceModel: voiceConfig.voice_model,
      voiceStability: voiceConfig.voice_stability,
      voiceSimilarityBoost: voiceConfig.voice_similarity_boost,
      transcriptionProvider: voiceConfig.transcription_provider,
      transcriptionModel: voiceConfig.transcription_model,
      transcriptionLanguage: voiceConfig.transcription_language,
      waitSeconds: voiceConfig.wait_seconds,
      onPunctuationSeconds: voiceConfig.on_punctuation_seconds,
      onNoPunctuationSeconds: voiceConfig.on_no_punctuation_seconds,
      endCallPhrases: voiceConfig.end_call_phrases,
      endCallMessage: voiceConfig.end_call_message,
      recordingEnabled: voiceConfig.recording_enabled,
      hipaaEnabled: voiceConfig.hipaa_enabled,
      silenceTimeoutSeconds: voiceConfig.silence_timeout_seconds,
      maxDurationSeconds: voiceConfig.max_duration_seconds,
    },
    {
      serverUrl: options.serverUrl,
      serverUrlSecret: options.serverUrlSecret,
      useServerSideResponse: options.useServerSideResponse,
    }
  );
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Mask phone number for logging
 */
function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length <= 4) {
    return '****';
  }
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create an assistant request handler with options
 */
export function createAssistantRequestHandler(
  options: AssistantRequestHandlerOptions = {}
): (
  payload: AssistantRequestPayload,
  context: WebhookHandlerContext
) => Promise<HandlerResult<AssistantRequestResponse>> {
  return (payload, context) => handleAssistantRequest(payload, context, options);
}

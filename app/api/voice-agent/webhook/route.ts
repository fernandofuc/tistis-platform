/**
 * TIS TIS Platform - Voice Agent v2.0
 * VAPI Webhook Endpoint
 *
 * Main entry point for all VAPI webhook events.
 * Implements:
 * - 5-layer Security Gate validation
 * - Event routing to specialized handlers
 * - Consistent error handling
 * - Request/response logging
 *
 * Supports Server-Side Response Mode where TIS TIS generates
 * all responses using LangGraph.
 *
 * @module app/api/voice-agent/webhook
 * @version 2.0.0
 */

import { NextRequest, NextResponse } from 'next/server';

// Security Gate
import {
  createSecurityGate,
  createDevSecurityGate,
} from '@/lib/voice-agent/security';

// Webhook system
import {
  WebhookEventRouter,
  createAssistantRequestHandler,
  createFunctionCallHandler,
  createToolCallsHandler,
  createEndOfCallHandler,
  createTranscriptHandler,
  createStatusUpdateHandler,
  createSpeechUpdateHandler,
  handleWebhookError,
  formatAckResponse,
  formatErrorResponse,
  isValidVapiEventType,
  type VapiWebhookPayload,
  type WebhookHandlerContext,
} from '@/lib/voice-agent/webhooks';

// LangGraph integration
import { VoiceLangGraphService } from '@/src/features/voice-agent/services/voice-langgraph.service';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// =====================================================
// TYPES
// =====================================================

/**
 * Voice configuration from voice_assistant_configs table (DB format)
 * NOTE: TIS TIS uses tenant_id, not business_id
 */
interface VoiceAssistantConfigDB {
  id: string;
  tenant_id: string;
  assistant_type_id: string;
  voice_id: string | null;
  voice_speed: number;
  personality_type: string;
  assistant_name: string;
  special_instructions: string | null;
  max_call_duration_seconds: number;
  first_message: string | null;
  compiled_prompt: string | null;
  is_active: boolean;
  recording_enabled?: boolean;
  hipaa_enabled?: boolean;
  silence_timeout_seconds?: number;
  use_filler_phrases?: boolean;
  filler_phrases?: string[];
  end_call_phrases?: string[];
  escalation_enabled?: boolean;
  escalation_phone?: string | null;
  goodbye_message?: string | null;
  [key: string]: unknown;
}

/**
 * Voice configuration type expected by LangGraph service
 */
interface VoiceAgentConfig {
  id: string;
  tenant_id: string;
  voice_enabled: boolean;
  voice_status: string;
  assistant_name: string;
  assistant_personality: string;
  first_message: string;
  first_message_mode: string;
  voice_provider: string;
  voice_id: string;
  voice_model: string;
  voice_stability: number;
  voice_similarity_boost: number;
  transcription_provider: string;
  transcription_model: string;
  transcription_language: string;
  max_call_duration_seconds: number;
  silence_timeout_seconds: number;
  recording_enabled: boolean;
  hipaa_enabled: boolean;
  use_filler_phrases: boolean;
  filler_phrases: string[];
  end_call_phrases: string[];
  goodbye_message: string | null;
  escalation_enabled: boolean;
  escalation_phone: string | null;
  system_prompt: string | null;
  custom_instructions: string | null;
  [key: string]: unknown;
}

/**
 * Maps DB config to the format expected by LangGraph service
 */
function mapDBConfigToVoiceAgentConfig(dbConfig: VoiceAssistantConfigDB): VoiceAgentConfig {
  return {
    id: dbConfig.id,
    tenant_id: dbConfig.tenant_id,
    voice_enabled: dbConfig.is_active,
    voice_status: dbConfig.is_active ? 'active' : 'inactive',
    assistant_name: dbConfig.assistant_name || 'Asistente',
    assistant_personality: dbConfig.personality_type || 'professional_friendly',
    first_message: dbConfig.first_message || '¡Hola! ¿En qué puedo ayudarte?',
    first_message_mode: 'assistant_speaks_first',
    voice_provider: 'elevenlabs',
    voice_id: dbConfig.voice_id || 'coral',
    voice_model: 'eleven_multilingual_v2',
    voice_stability: 0.5,
    voice_similarity_boost: 0.75,
    transcription_provider: 'deepgram',
    transcription_model: 'nova-2',
    transcription_language: 'es',
    max_call_duration_seconds: dbConfig.max_call_duration_seconds || 600,
    silence_timeout_seconds: dbConfig.silence_timeout_seconds || 30,
    recording_enabled: dbConfig.recording_enabled ?? true,
    hipaa_enabled: dbConfig.hipaa_enabled ?? false,
    use_filler_phrases: dbConfig.use_filler_phrases ?? true,
    filler_phrases: dbConfig.filler_phrases || [],
    end_call_phrases: dbConfig.end_call_phrases || ['adiós', 'hasta luego', 'bye'],
    goodbye_message: dbConfig.goodbye_message || null,
    escalation_enabled: dbConfig.escalation_enabled ?? false,
    escalation_phone: dbConfig.escalation_phone || null,
    system_prompt: dbConfig.compiled_prompt || null,
    custom_instructions: dbConfig.special_instructions || null,
  };
}

// =====================================================
// SECURITY GATE INSTANCE
// =====================================================

const securityGate = process.env.NODE_ENV === 'development'
  ? createDevSecurityGate()
  : createSecurityGate();

// =====================================================
// EVENT ROUTER INSTANCE
// =====================================================

const serverUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/voice-agent/webhook`;
const serverUrlSecret = process.env.VAPI_WEBHOOK_SECRET;

const eventRouter = new WebhookEventRouter(
  {
    'assistant-request': createAssistantRequestHandler({
      serverUrl,
      serverUrlSecret,
      useServerSideResponse: true,
    }),
    'function-call': createFunctionCallHandler(),
    'tool-calls': createToolCallsHandler(),
    'end-of-call-report': createEndOfCallHandler(),
    'transcript': createTranscriptHandler({ logFinal: true, logPartial: false }),
    'status-update': createStatusUpdateHandler(),
    'speech-update': createSpeechUpdateHandler(),
  },
  {
    logEvents: true,
    allowUnknownEvents: true,
  }
);

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate unique request ID for tracing
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `vapi-${timestamp}-${random}`;
}

/**
 * Extract client IP from request headers
 */
function extractClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return '0.0.0.0';
}

/**
 * Create Supabase service client with admin privileges
 */
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Get voice configuration for a tenant/business
 * Uses the v2 voice_assistant_configs table exclusively
 * Returns the config mapped to VoiceAgentConfig format for LangGraph compatibility
 */
async function getVoiceConfig(tenantId: string): Promise<VoiceAgentConfig | null> {
  const supabase = createServiceClient();

  // TIS TIS uses tenant_id, not business_id
  const { data, error } = await supabase
    .from('voice_assistant_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Voice Webhook] Error fetching config:', error);
    return null;
  }

  if (!data) return null;
  return mapDBConfigToVoiceAgentConfig(data as VoiceAssistantConfigDB);
}

/**
 * Get call messages for conversation history
 */
async function getCallMessages(callId: string) {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('voice_call_messages')
    .select('*')
    .eq('call_id', callId)
    .order('sequence_number', { ascending: true });

  return data || [];
}

/**
 * Get message count for a call
 */
async function getMessageCount(callId: string): Promise<number> {
  const supabase = createServiceClient();

  const { count } = await supabase
    .from('voice_call_messages')
    .select('id', { count: 'exact', head: true })
    .eq('call_id', callId);

  return count || 0;
}

// =====================================================
// CONVERSATION UPDATE HANDLER
// =====================================================

/**
 * Handle conversation-update event (Server-Side Response Mode)
 * This is the heart of the voice agent - generates AI responses
 * using LangGraph for intelligent conversation flow.
 */
async function handleConversationUpdate(
  payload: VapiWebhookPayload,
  context: WebhookHandlerContext
) {
  const supabase = createServiceClient();
  const startTime = Date.now();

  // Type assertion for conversation-update payload
  const event = payload as {
    type: 'conversation-update';
    call: { id: string };
    messages: Array<{ role: string; content: string }>;
  };

  console.log(`[Voice Webhook] Conversation update for call: ${event.call.id}`);

  // Get the last user message
  const lastUserMessage = [...event.messages]
    .reverse()
    .find(m => m.role === 'user');

  if (!lastUserMessage) {
    console.log('[Voice Webhook] No user message found, skipping');
    return { status: 'ok' };
  }

  // Validate transcription
  const transcription = lastUserMessage.content?.trim();
  if (!transcription || transcription.length < 2) {
    console.warn('[Voice Webhook] Empty or invalid transcription received');
    return {
      assistantResponse: '¿Podrías repetir eso? No te escuché bien.',
    };
  }

  // Detect corrupted transcription (more than 50% invalid characters)
  const validTextRatio = (transcription.match(/[a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9\s]/g) || []).length / transcription.length;
  if (validTextRatio < 0.5) {
    console.warn('[Voice Webhook] Potentially corrupted transcription');
    return {
      assistantResponse: 'Disculpa, hubo interferencia. ¿Podrías repetir?',
    };
  }

  // Get call from database
  const { data: call } = await supabase
    .from('voice_calls')
    .select('id, tenant_id, caller_phone')
    .eq('vapi_call_id', event.call.id)
    .single();

  if (!call) {
    console.error('[Voice Webhook] Call not found:', event.call.id);
    return {
      assistantResponse: 'Disculpa, hubo un problema técnico. ¿Podrías repetir?',
    };
  }

  // Get voice configuration (v2 only)
  const voiceConfig = await getVoiceConfig(call.tenant_id);

  if (!voiceConfig) {
    console.error('[Voice Webhook] Voice config not found for tenant:', call.tenant_id);
    return {
      assistantResponse: 'En este momento no puedo atenderte. Por favor llama más tarde.',
    };
  }

  // Get conversation history
  const previousMessages = await getCallMessages(call.id);

  try {
    // Process with LangGraph
    // Note: voiceConfig is mapped from voice_assistant_configs (v2) to VoiceAgentConfig format
    const result = await VoiceLangGraphService.processVoiceMessage(
      {
        tenant_id: call.tenant_id,
        voice_config: voiceConfig as any, // Type compatible with LangGraph VoiceAgentConfig
        call_id: call.id,
        caller_phone: call.caller_phone || '',
        conversation_history: previousMessages,
      },
      transcription
    );

    const processingTime = Date.now() - startTime;
    console.log(
      `[Voice Webhook] LangGraph response in ${processingTime}ms`,
      JSON.stringify({
        intent: result.intent,
        escalate: result.should_escalate,
        responseLength: result.response.length,
      })
    );

    // Get message count for sequence numbers
    const msgCount = await getMessageCount(call.id);
    const userSeq = msgCount + 1;
    const assistantSeq = userSeq + 1;

    // Save user message
    await VoiceLangGraphService.saveVoiceMessage(
      call.id,
      'user',
      transcription,
      {
        sequence_number: userSeq,
        detected_intent: result.intent,
      }
    );

    // Save assistant response
    await VoiceLangGraphService.saveVoiceMessage(
      call.id,
      'assistant',
      result.response,
      {
        sequence_number: assistantSeq,
        response_latency_ms: processingTime,
      }
    );

    // Update call state if escalation needed
    if (result.should_escalate) {
      await supabase
        .from('voice_calls')
        .update({
          escalated: true,
          escalated_at: new Date().toISOString(),
          escalated_reason: result.escalation_reason,
          primary_intent: result.intent,
        })
        .eq('id', call.id);
    }

    // Update call if appointment was booked
    if (result.booking_result?.success) {
      await supabase
        .from('voice_calls')
        .update({
          outcome: 'appointment_booked',
          primary_intent: 'BOOK_APPOINTMENT',
          updated_at: new Date().toISOString(),
        })
        .eq('id', call.id);
    }

    // Update call metrics
    await supabase
      .from('voice_calls')
      .update({
        latency_avg_ms: processingTime,
        turns_count: userSeq,
        updated_at: new Date().toISOString(),
      })
      .eq('id', call.id);

    return {
      assistantResponse: result.response,
    };
  } catch (error) {
    console.error('[Voice Webhook] LangGraph error:', error);
    return {
      assistantResponse: 'Disculpa, tuve un problema técnico. ¿Podrías repetir lo que dijiste?',
    };
  }
}

// =====================================================
// MAIN POST HANDLER
// =====================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const clientIp = extractClientIP(request);

  try {
    // ===================================================
    // STEP 1: Security Gate Validation
    // ===================================================

    const bodyText = await request.text();
    const validation = await securityGate.validate(request, bodyText);

    if (!validation.valid) {
      console.warn(
        `[Voice Webhook] Security validation failed`,
        JSON.stringify({
          requestId,
          clientIp,
          failedAt: validation.failedAt,
          reason: validation.reason,
        })
      );

      return NextResponse.json(
        formatErrorResponse('Unauthorized', validation.failedAt, {
          reason: validation.reason,
        }),
        { status: 401 }
      );
    }

    // ===================================================
    // STEP 2: Parse Request Body
    // ===================================================

    let body: VapiWebhookPayload;
    try {
      body = JSON.parse(bodyText);
    } catch {
      console.error('[Voice Webhook] Invalid JSON in request body');
      return NextResponse.json(
        formatErrorResponse('Invalid JSON'),
        { status: 400 }
      );
    }

    // Extract event type - handle both flat and nested formats
    const eventType = body.type || (body as { message?: { type: string } }).message?.type;

    if (!eventType) {
      console.error('[Voice Webhook] Missing event type');
      return NextResponse.json(
        formatErrorResponse('Missing event type'),
        { status: 400 }
      );
    }

    // Normalize payload to flat format if nested
    if (!body.type && (body as { message?: { type: string } }).message?.type) {
      body = {
        ...(body as { message: Record<string, unknown> }).message,
        type: eventType,
      } as VapiWebhookPayload;
    }

    console.log(
      `[Voice Webhook] Received event: ${eventType}`,
      JSON.stringify({
        requestId,
        callId: body.call?.id,
        processingTimeMs: Date.now() - startTime,
      })
    );

    // ===================================================
    // STEP 3: Create Handler Context
    // ===================================================

    const context: WebhookHandlerContext = {
      requestId,
      clientIp,
      startTime,
      tenantId: (validation.metadata as Record<string, unknown> | undefined)?.tenantId as string | undefined,
      callId: body.call?.id,
    };

    // ===================================================
    // STEP 4: Route Event to Handler
    // ===================================================

    let response: unknown;

    if (eventType === 'conversation-update') {
      response = await handleConversationUpdate(body, context);
    } else if (isValidVapiEventType(eventType)) {
      const result = await eventRouter.route(body, context);
      response = result.response;

      if (result.shouldLog) {
        console.log(
          `[Voice Webhook] Event processed: ${eventType}`,
          JSON.stringify({
            requestId,
            statusCode: result.statusCode,
            processingTimeMs: Date.now() - startTime,
            metadata: result.metadata,
          })
        );
      }
    } else {
      console.log(`[Voice Webhook] Unknown event type: ${eventType}`);
      response = formatAckResponse();
    }

    return NextResponse.json(response);
  } catch (error) {
    // ===================================================
    // STEP 5: Error Handling
    // ===================================================

    const context: WebhookHandlerContext = {
      requestId,
      clientIp,
      startTime,
    };

    const errorResult = handleWebhookError(error, context);

    console.error(
      `[Voice Webhook] Error processing request`,
      JSON.stringify({
        requestId,
        error: error instanceof Error ? error.message : 'unknown',
        statusCode: errorResult.statusCode,
        processingTimeMs: Date.now() - startTime,
      })
    );

    return NextResponse.json(
      errorResult.response,
      { status: errorResult.statusCode }
    );
  }
}

// =====================================================
// HEALTH CHECK (GET)
// =====================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'voice-agent-webhook',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    features: {
      securityGate: true,
      eventRouter: true,
      serverSideResponse: true,
      langGraph: true,
    },
  });
}

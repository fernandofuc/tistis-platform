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
 * all responses using LangGraph (Fase 07).
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

// Legacy imports for conversation-update (will be refactored in Fase 07)
import { VoiceLangGraphService } from '@/src/features/voice-agent/services/voice-langgraph.service';
import { createClient } from '@supabase/supabase-js';

// Feature flags for v2 rollout
import { shouldUseVoiceAgentV2Cached } from '@/lib/feature-flags';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

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
    // conversation-update handled separately (legacy integration with LangGraph)
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
 * Generate unique request ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `vapi-${timestamp}-${random}`;
}

/**
 * Extract client IP from request
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
 * Create Supabase service client
 */
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Get voice configuration for a tenant
 * Uses v2 table if feature flag enabled, otherwise v1
 */
async function getVoiceConfig(tenantId: string, useV2: boolean = false) {
  const supabase = createServiceClient();

  if (useV2) {
    // V2: Use new voice_assistant_configs table
    const { data } = await supabase
      .from('voice_assistant_configs')
      .select('*')
      .eq('business_id', tenantId)
      .eq('is_active', true)
      .single();

    return data;
  } else {
    // V1: Use legacy voice_agent_config table
    const { data } = await supabase
      .from('voice_agent_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('voice_enabled', true)
      .single();

    return data;
  }
}

/**
 * Check if tenant should use Voice Agent v2
 */
async function checkV2Status(tenantId: string): Promise<boolean> {
  try {
    return await shouldUseVoiceAgentV2Cached(tenantId);
  } catch (error) {
    console.warn(`[Voice Webhook] Failed to check v2 status for ${tenantId}:`, error);
    return false; // Default to v1 on error
  }
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
// CONVERSATION UPDATE HANDLER (LEGACY - WILL BE REFACTORED)
// =====================================================

/**
 * Handle conversation-update event (Server-Side Response Mode)
 * This is the heart of the voice agent - generates AI responses
 *
 * Note: This will be refactored in Fase 07 to use the new modular system
 * with full LangGraph integration.
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

  // Detect corrupted transcription
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
    .select('id, tenant_id, voice_agent_config_id, caller_phone')
    .eq('vapi_call_id', event.call.id)
    .single();

  if (!call) {
    console.error('[Voice Webhook] Call not found:', event.call.id);
    return {
      assistantResponse: 'Disculpa, hubo un problema técnico. ¿Podrías repetir?',
    };
  }

  // Check if tenant should use V2
  const useV2 = await checkV2Status(call.tenant_id);
  const apiVersion = useV2 ? 'v2' : 'v1';

  console.log(`[Voice Webhook] Using API version ${apiVersion} for tenant ${call.tenant_id}`);

  // Get voice configuration (from v1 or v2 table based on flag)
  const voiceConfig = await getVoiceConfig(call.tenant_id, useV2);

  if (!voiceConfig) {
    console.error(`[Voice Webhook] Voice config not found (${apiVersion})`);
    return {
      assistantResponse: 'En este momento no puedo atenderte. Por favor llama más tarde.',
    };
  }

  // Update call with API version being used
  await supabase
    .from('voice_calls')
    .update({ api_version: apiVersion })
    .eq('id', call.id);

  // Get conversation history
  const previousMessages = await getCallMessages(call.id);

  try {
    // Process with LangGraph
    const result = await VoiceLangGraphService.processVoiceMessage(
      {
        tenant_id: call.tenant_id,
        voice_config: voiceConfig,
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

    // Update call state if needed
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

    // Clone the request to read body for validation
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

    // Handle conversation-update separately (legacy LangGraph integration)
    if (eventType === 'conversation-update') {
      response = await handleConversationUpdate(body, context);
    } else if (isValidVapiEventType(eventType)) {
      // Route through the event router
      const result = await eventRouter.route(body, context);
      response = result.response;

      // Log if needed
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
      // Unknown event type - log and acknowledge
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
  // Get feature flag status for health check
  let v2FlagStatus = { enabled: false, percentage: 0 };
  try {
    const { getVoiceAgentV2Flags } = await import('@/lib/feature-flags');
    const flags = await getVoiceAgentV2Flags();
    v2FlagStatus = { enabled: flags.enabled, percentage: flags.percentage };
  } catch {
    // Ignore errors in health check
  }

  return NextResponse.json({
    status: 'ok',
    service: 'voice-agent-webhook',
    timestamp: new Date().toISOString(),
    features: {
      securityGate: true,
      eventRouter: true,
      serverSideResponse: true,
      v2Rollout: v2FlagStatus,
    },
  });
}

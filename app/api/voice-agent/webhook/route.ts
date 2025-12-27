// =====================================================
// TIS TIS PLATFORM - Voice Agent VAPI Webhook
// Server-Side Response Mode: TIS TIS genera TODAS las respuestas
// VAPI solo hace STT (transcripción) y TTS (síntesis de voz)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { VoiceLangGraphService } from '@/src/features/voice-agent/services/voice-langgraph.service';
import type { VoiceAgentConfig, VoiceCallMessage } from '@/src/features/voice-agent/types';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Timing-safe comparison for webhook secret
function verifyWebhookSecret(authHeader: string | null, webhookSecret: string): boolean {
  if (!authHeader) return false;

  try {
    const authBuffer = Buffer.from(authHeader);
    const secretBuffer = Buffer.from(webhookSecret);
    if (authBuffer.length !== secretBuffer.length) {
      return false;
    }
    return timingSafeEqual(authBuffer, secretBuffer);
  } catch {
    return false;
  }
}

// Create service client
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ======================
// VAPI EVENT TYPES
// ======================

interface VAPIAssistantRequest {
  type: 'assistant-request';
  call: {
    id: string;
    phoneNumber: {
      number: string;
    };
    customer: {
      number: string;
    };
  };
}

interface VAPITranscript {
  type: 'transcript';
  transcript: {
    text: string;
    user: string;
    role: 'user' | 'assistant';
    isFinal: boolean;
  };
  call: {
    id: string;
  };
}

// NUEVO: Conversation Update - VAPI nos envía el turno del usuario y espera nuestra respuesta
interface VAPIConversationUpdate {
  type: 'conversation-update';
  call: {
    id: string;
  };
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
}

interface VAPIFunctionCall {
  type: 'function-call';
  functionCall: {
    name: string;
    parameters: Record<string, unknown>;
  };
  call: {
    id: string;
  };
}

interface VAPIEndOfCallReport {
  type: 'end-of-call-report';
  call: {
    id: string;
  };
  endedReason: string;
  transcript: string;
  summary?: string;
  recordingUrl?: string;
  durationSeconds?: number;
}

interface VAPIStatusUpdate {
  type: 'status-update';
  status: string;
  call: {
    id: string;
  };
}

type VAPIWebhookEvent =
  | VAPIAssistantRequest
  | VAPITranscript
  | VAPIConversationUpdate
  | VAPIFunctionCall
  | VAPIEndOfCallReport
  | VAPIStatusUpdate;

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Obtiene el tenant_id a partir del número de teléfono llamado
 */
async function getTenantFromPhoneNumber(phoneNumber: string): Promise<string | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('voice_phone_numbers')
    .select('tenant_id')
    .eq('phone_number', phoneNumber)
    .eq('status', 'active')
    .single();

  return data?.tenant_id || null;
}

/**
 * Obtiene la configuración de voz del tenant
 */
async function getVoiceConfig(tenantId: string): Promise<VoiceAgentConfig | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('voice_agent_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('voice_enabled', true)
    .single();

  return data;
}

/**
 * Crea o actualiza un registro de llamada
 */
async function createOrUpdateCall(
  vapiCallId: string,
  tenantId: string,
  callerPhone: string,
  calledPhone: string
): Promise<string> {
  const supabase = createServiceClient();

  // Buscar llamada existente
  const { data: existingCall } = await supabase
    .from('voice_calls')
    .select('id')
    .eq('vapi_call_id', vapiCallId)
    .single();

  if (existingCall) {
    return existingCall.id;
  }

  // Obtener voice_agent_config_id para asociar la llamada
  const { data: voiceConfig } = await supabase
    .from('voice_agent_config')
    .select('id')
    .eq('tenant_id', tenantId)
    .single();

  // Obtener phone_number_id si existe
  const { data: phoneNumber } = await supabase
    .from('voice_phone_numbers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone_number', calledPhone)
    .single();

  // Crear nueva llamada
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
      voice_agent_config_id: voiceConfig?.id || null,
      phone_number_id: phoneNumber?.id || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Voice Webhook] Error creating call:', error);
    throw new Error('Failed to create call record');
  }

  return newCall.id;
}

/**
 * Obtiene los mensajes previos de la llamada
 */
async function getCallMessages(callId: string): Promise<VoiceCallMessage[]> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('voice_call_messages')
    .select('*')
    .eq('call_id', callId)
    .order('sequence_number', { ascending: true });

  return data || [];
}

/**
 * Cuenta los mensajes de una llamada
 */
async function getMessageCount(callId: string): Promise<number> {
  const supabase = createServiceClient();

  const { count } = await supabase
    .from('voice_call_messages')
    .select('id', { count: 'exact', head: true })
    .eq('call_id', callId);

  return count || 0;
}

// ======================
// EVENT HANDLERS
// ======================

/**
 * Maneja assistant-request: VAPI pide el asistente a usar
 *
 * SERVER-SIDE RESPONSE MODE:
 * - NO enviamos "model" a VAPI (VAPI no genera respuestas)
 * - Configuramos serverUrl para que VAPI envíe cada turno a nuestro backend
 * - TIS TIS LangGraph genera TODAS las respuestas de IA
 */
async function handleAssistantRequest(event: VAPIAssistantRequest) {
  const calledNumber = event.call.phoneNumber.number;
  const callerNumber = event.call.customer.number;

  console.log(`[Voice Webhook] Assistant request for ${calledNumber} from ${callerNumber}`);
  console.log(`[Voice Webhook] MODE: Server-Side Response (TIS TIS LangGraph genera respuestas)`);

  // Obtener tenant del número llamado
  const tenantId = await getTenantFromPhoneNumber(calledNumber);

  if (!tenantId) {
    console.error('[Voice Webhook] No tenant found for number:', calledNumber);
    return {
      error: 'No assistant configured for this number',
    };
  }

  // Obtener configuración de voz
  const voiceConfig = await getVoiceConfig(tenantId);

  if (!voiceConfig) {
    console.error('[Voice Webhook] Voice agent not enabled for tenant:', tenantId);
    return {
      error: 'Voice agent not enabled',
    };
  }

  // Crear registro de llamada
  const callId = await createOrUpdateCall(event.call.id, tenantId, callerNumber, calledNumber);
  console.log(`[Voice Webhook] Call created/found: ${callId}`);

  // SERVER-SIDE RESPONSE MODE:
  // NO enviamos "model" - VAPI no generará respuestas
  // En su lugar, configuramos serverUrl para recibir cada turno de conversación
  // y responder con el texto generado por LangGraph

  const serverUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/voice-agent/webhook`;

  return {
    assistant: {
      name: voiceConfig.assistant_name,

      // Primer mensaje del asistente
      firstMessage: voiceConfig.first_message,
      firstMessageMode: voiceConfig.first_message_mode === 'assistant_speaks_first'
        ? 'assistant-speaks-first'
        : 'assistant-waits-for-user',

      // ═══════════════════════════════════════════════════════════════
      // SERVER-SIDE RESPONSE: NO enviamos "model" a VAPI
      // VAPI enviará cada turno a serverUrl y esperará nuestra respuesta
      // ═══════════════════════════════════════════════════════════════

      // Configuración de voz (ElevenLabs) - VAPI maneja STT/TTS
      voice: {
        voiceId: voiceConfig.voice_id || 'LegCbmbXKbT5PUp3QFWv', // Javier (default)
        provider: voiceConfig.voice_provider || 'elevenlabs',
        model: voiceConfig.voice_model || 'eleven_multilingual_v2',
        stability: Number(voiceConfig.voice_stability) || 0.5,
        similarityBoost: Number(voiceConfig.voice_similarity_boost) || 0.75,
      },

      // Configuración de transcripción
      transcriber: {
        model: voiceConfig.transcription_model || 'nova-2',
        language: voiceConfig.transcription_language || 'es',
        provider: voiceConfig.transcription_provider || 'deepgram',
      },

      // Timing de respuesta
      startSpeakingPlan: {
        waitSeconds: Number(voiceConfig.wait_seconds) || 0.6,
        onPunctuationSeconds: Number(voiceConfig.on_punctuation_seconds) || 0.2,
        onNoPunctuationSeconds: Number(voiceConfig.on_no_punctuation_seconds) || 1.2,
      },

      // Frases de fin de llamada
      endCallPhrases: voiceConfig.end_call_phrases || [
        'adiós',
        'hasta luego',
        'bye',
        'chao',
        'eso es todo',
        'gracias, eso es todo',
      ],

      // Grabación y privacidad
      recordingEnabled: voiceConfig.recording_enabled ?? true,
      hipaaEnabled: voiceConfig.hipaa_enabled ?? false,

      // ═══════════════════════════════════════════════════════════════
      // SERVER URL: Aquí VAPI enviará cada turno de conversación
      // Nuestro backend procesará con LangGraph y retornará la respuesta
      // ═══════════════════════════════════════════════════════════════
      serverUrl: serverUrl,
      serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET,
    },

    // Metadatos para rastreo (se envían en cada webhook)
    metadata: {
      tenant_id: tenantId,
      voice_config_id: voiceConfig.id,
      call_id: callId,
      mode: 'server-side-response',
    },
  };
}

/**
 * Maneja transcript: Cada mensaje transcrito
 *
 * NOTA: En Server-Side Response Mode, los mensajes se guardan en handleConversationUpdate
 * Este handler solo hace logging para debugging. NO guardamos aquí para evitar duplicados.
 */
async function handleTranscript(event: VAPITranscript) {
  if (!event.transcript.isFinal) {
    // Ignorar transcripciones parciales
    return { status: 'ok' };
  }

  // Solo logging - el guardado se hace en handleConversationUpdate
  const textPreview = event.transcript.text.length > 50
    ? `${event.transcript.text.substring(0, 50)}...`
    : event.transcript.text;

  console.log(`[Voice Webhook] Transcript (${event.transcript.role}): "${textPreview}"`);

  return { status: 'ok' };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NUEVO: Maneja conversation-update - EL CORAZÓN DEL SERVER-SIDE RESPONSE MODE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * VAPI nos envía el mensaje del usuario y ESPERA nuestra respuesta.
 * Aquí procesamos con LangGraph y retornamos el texto que VAPI convertirá a audio.
 */
async function handleConversationUpdate(event: VAPIConversationUpdate) {
  const startTime = Date.now();
  const supabase = createServiceClient();

  console.log(`[Voice Webhook] Conversation update for call: ${event.call.id}`);
  console.log(`[Voice Webhook] Messages count: ${event.messages.length}`);

  // Obtener el último mensaje del usuario
  const lastUserMessage = [...event.messages]
    .reverse()
    .find(m => m.role === 'user');

  if (!lastUserMessage) {
    console.log('[Voice Webhook] No user message found, skipping');
    return { status: 'ok' };
  }

  console.log(`[Voice Webhook] User message: "${lastUserMessage.content.substring(0, 100)}..."`);

  // Obtener la llamada
  const { data: call } = await supabase
    .from('voice_calls')
    .select('id, tenant_id, voice_agent_config_id, caller_phone')
    .eq('vapi_call_id', event.call.id)
    .single();

  if (!call) {
    console.error('[Voice Webhook] Call not found for conversation update:', event.call.id);
    return {
      assistantResponse: 'Disculpa, hubo un problema técnico. ¿Podrías repetir?',
    };
  }

  // Obtener configuración de voz
  const voiceConfig = await getVoiceConfig(call.tenant_id);

  if (!voiceConfig) {
    console.error('[Voice Webhook] Voice config not found for tenant:', call.tenant_id);
    return {
      assistantResponse: 'En este momento no puedo atenderte. Por favor llama más tarde.',
    };
  }

  // Obtener historial de mensajes previos de BD
  const previousMessages = await getCallMessages(call.id);

  try {
    // ═══════════════════════════════════════════════════════════════
    // PROCESAR CON LANGGRAPH - GENERA LA RESPUESTA DE IA
    // ═══════════════════════════════════════════════════════════════
    const result = await VoiceLangGraphService.processVoiceMessage(
      {
        tenant_id: call.tenant_id,
        voice_config: voiceConfig,
        call_id: call.id,
        caller_phone: call.caller_phone || '',
        conversation_history: previousMessages,
      },
      lastUserMessage.content
    );

    const processingTime = Date.now() - startTime;
    console.log(`[Voice Webhook] LangGraph response generated in ${processingTime}ms`);
    console.log(`[Voice Webhook] Intent: ${result.intent}, Escalate: ${result.should_escalate}`);
    console.log(`[Voice Webhook] Response: "${result.response.substring(0, 100)}..."`);

    // Guardar mensaje del usuario en BD
    const userMsgCount = await getMessageCount(call.id);
    await VoiceLangGraphService.saveVoiceMessage(
      call.id,
      'user',
      lastUserMessage.content,
      {
        sequence_number: userMsgCount + 1,
        detected_intent: result.intent,
      }
    );

    // Guardar respuesta del asistente en BD
    const assistantMsgCount = await getMessageCount(call.id);
    await VoiceLangGraphService.saveVoiceMessage(
      call.id,
      'assistant',
      result.response,
      {
        sequence_number: assistantMsgCount + 1,
        response_latency_ms: processingTime,
      }
    );

    // Actualizar estado de la llamada si hay eventos especiales
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

    // Actualizar latencia promedio
    await supabase
      .from('voice_calls')
      .update({
        latency_avg_ms: processingTime,
        turns_count: userMsgCount + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', call.id);

    // ═══════════════════════════════════════════════════════════════
    // RETORNAR RESPUESTA A VAPI - VAPI convertirá esto a audio
    // ═══════════════════════════════════════════════════════════════
    return {
      assistantResponse: result.response,
    };

  } catch (error) {
    console.error('[Voice Webhook] Error processing with LangGraph:', error);

    // Respuesta de fallback en caso de error
    return {
      assistantResponse: 'Disculpa, tuve un problema técnico. ¿Podrías repetir lo que dijiste?',
    };
  }
}

/**
 * Maneja end-of-call-report: Cuando termina la llamada
 */
async function handleEndOfCallReport(event: VAPIEndOfCallReport) {
  const supabase = createServiceClient();

  console.log(`[Voice Webhook] Call ended: ${event.call.id}, reason: ${event.endedReason}`);

  // Obtener la llamada
  const { data: call } = await supabase
    .from('voice_calls')
    .select('id, tenant_id')
    .eq('vapi_call_id', event.call.id)
    .single();

  if (!call) {
    console.warn('[Voice Webhook] Call not found for end report:', event.call.id);
    return { status: 'ok' };
  }

  // Analizar conversación completa
  const analysis = await VoiceLangGraphService.analyzeCallConversation(call.id);

  // Determinar outcome si no está establecido
  let outcome = 'completed_other';
  if (analysis.appointment_requested) {
    outcome = 'information_given'; // Se ajustará si hubo booking exitoso
  }

  // Actualizar llamada con datos finales
  await supabase
    .from('voice_calls')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      duration_seconds: event.durationSeconds || 0,
      recording_url: event.recordingUrl,
      transcription: event.transcript,
      analysis,
      outcome,
      updated_at: new Date().toISOString(),
    })
    .eq('id', call.id);

  // Registrar uso
  if (event.durationSeconds && event.durationSeconds > 0) {
    await supabase.from('voice_usage_logs').insert({
      tenant_id: call.tenant_id,
      call_id: call.id,
      usage_type: 'call_minutes',
      quantity: Math.ceil(event.durationSeconds / 60),
      unit: 'minutes',
      unit_cost_usd: 0.05, // Placeholder - ajustar según pricing real
      total_cost_usd: Math.ceil(event.durationSeconds / 60) * 0.05,
      provider: 'vapi',
    });
  }

  return { status: 'ok' };
}

/**
 * Maneja status-update: Cambios de estado de la llamada
 */
async function handleStatusUpdate(event: VAPIStatusUpdate) {
  const supabase = createServiceClient();

  console.log(`[Voice Webhook] Status update: ${event.call.id} -> ${event.status}`);

  // Mapear status de VAPI a nuestro schema
  const statusMap: Record<string, string> = {
    'queued': 'initiated',
    'ringing': 'ringing',
    'in-progress': 'in_progress',
    'completed': 'completed',
    'busy': 'busy',
    'failed': 'failed',
    'no-answer': 'no_answer',
    'canceled': 'canceled',
  };

  const ourStatus = statusMap[event.status] || event.status;

  await supabase
    .from('voice_calls')
    .update({
      status: ourStatus,
      answered_at: event.status === 'in-progress' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('vapi_call_id', event.call.id);

  return { status: 'ok' };
}

// ======================
// MAIN HANDLER
// ======================

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret (timing-safe)
    const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
    const authHeader = request.headers.get('x-vapi-secret');

    if (webhookSecret) {
      if (!verifyWebhookSecret(authHeader, webhookSecret)) {
        console.warn('[Voice Webhook] Invalid webhook secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      // In production, require webhook secret
      if (process.env.NODE_ENV === 'production') {
        console.error('[Voice Webhook] VAPI_WEBHOOK_SECRET not configured in production');
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
      }
      console.warn('[Voice Webhook] VAPI_WEBHOOK_SECRET not set - skipping verification in development');
    }

    let body: VAPIWebhookEvent;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    console.log(`[Voice Webhook] Received event: ${body.type}`);

    let response;

    switch (body.type) {
      case 'assistant-request':
        response = await handleAssistantRequest(body);
        break;

      case 'transcript':
        response = await handleTranscript(body);
        break;

      // ═══════════════════════════════════════════════════════════════
      // CONVERSATION-UPDATE: El evento más importante en Server-Side Mode
      // VAPI envía el mensaje del usuario y ESPERA nuestra respuesta
      // ═══════════════════════════════════════════════════════════════
      case 'conversation-update':
        response = await handleConversationUpdate(body);
        break;

      case 'end-of-call-report':
        response = await handleEndOfCallReport(body);
        break;

      case 'status-update':
        response = await handleStatusUpdate(body);
        break;

      default:
        console.log(`[Voice Webhook] Unknown event type: ${(body as { type: string }).type}`);
        response = { status: 'ok' };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Voice Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// También soportar GET para health checks
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'voice-agent-webhook',
    timestamp: new Date().toISOString(),
  });
}

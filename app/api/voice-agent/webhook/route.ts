// =====================================================
// TIS TIS PLATFORM - Voice Agent VAPI Webhook
// Recibe eventos de VAPI y procesa con LangGraph
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VoiceLangGraphService } from '@/src/features/voice-agent/services/voice-langgraph.service';
import type { VoiceAgentConfig, VoiceCallMessage, CallAnalysis } from '@/src/features/voice-agent/types';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

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
 */
async function handleAssistantRequest(event: VAPIAssistantRequest) {
  const calledNumber = event.call.phoneNumber.number;
  const callerNumber = event.call.customer.number;

  console.log(`[Voice Webhook] Assistant request for ${calledNumber} from ${callerNumber}`);

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
  await createOrUpdateCall(event.call.id, tenantId, callerNumber, calledNumber);

  // Generar instrucciones de voz específicas
  const voiceInstructions = VoiceLangGraphService.generateVoiceInstructions(voiceConfig);

  // Retornar configuración del asistente para VAPI
  return {
    assistant: {
      name: voiceConfig.assistant_name,
      firstMessage: voiceConfig.first_message,
      firstMessageMode: voiceConfig.first_message_mode === 'assistant_speaks_first'
        ? 'assistant-speaks-first'
        : 'assistant-waits-for-user',
      model: {
        model: voiceConfig.ai_model,
        provider: voiceConfig.ai_model.startsWith('gpt') ? 'openai' : 'anthropic',
        temperature: Number(voiceConfig.ai_temperature),
        maxTokens: voiceConfig.ai_max_tokens,
        messages: [
          {
            role: 'system',
            content: `${voiceConfig.system_prompt || ''}\n\n${voiceInstructions}`,
          },
        ],
      },
      voice: {
        voiceId: voiceConfig.voice_id,
        provider: voiceConfig.voice_provider,
        model: voiceConfig.voice_model,
        stability: Number(voiceConfig.voice_stability),
        similarityBoost: Number(voiceConfig.voice_similarity_boost),
      },
      transcriber: {
        model: voiceConfig.transcription_model,
        language: voiceConfig.transcription_language,
        provider: voiceConfig.transcription_provider,
      },
      startSpeakingPlan: {
        waitSeconds: Number(voiceConfig.wait_seconds),
        onPunctuationSeconds: Number(voiceConfig.on_punctuation_seconds),
        onNoPunctuationSeconds: Number(voiceConfig.on_no_punctuation_seconds),
      },
      endCallPhrases: voiceConfig.end_call_phrases || [
        'adiós',
        'hasta luego',
        'bye',
        'chao',
        'eso es todo',
        'gracias, eso es todo',
      ],
      recordingEnabled: voiceConfig.recording_enabled,
      hipaaEnabled: voiceConfig.hipaa_enabled,
      serverUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/voice-agent/webhook`,
      serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET,
    },
    // Metadatos para rastreo
    metadata: {
      tenant_id: tenantId,
      voice_config_id: voiceConfig.id,
    },
  };
}

/**
 * Maneja transcript: Cada mensaje transcrito
 */
async function handleTranscript(event: VAPITranscript) {
  if (!event.transcript.isFinal) {
    // Ignorar transcripciones parciales
    return { status: 'ok' };
  }

  const supabase = createServiceClient();

  // Obtener la llamada
  const { data: call } = await supabase
    .from('voice_calls')
    .select('id, tenant_id, voice_agent_config_id')
    .eq('vapi_call_id', event.call.id)
    .single();

  if (!call) {
    console.warn('[Voice Webhook] Call not found for VAPI call:', event.call.id);
    return { status: 'ok' };
  }

  // Contar mensajes existentes para sequence_number
  const messageCount = await getMessageCount(call.id);

  // Guardar mensaje
  await VoiceLangGraphService.saveVoiceMessage(
    call.id,
    event.transcript.role,
    event.transcript.text,
    {
      sequence_number: messageCount + 1,
    }
  );

  // Si es mensaje del usuario, procesar con LangGraph para respuesta
  if (event.transcript.role === 'user' && call.voice_agent_config_id) {
    const voiceConfig = await getVoiceConfig(call.tenant_id);

    if (voiceConfig) {
      const previousMessages = await getCallMessages(call.id);

      try {
        const result = await VoiceLangGraphService.processVoiceMessage(
          {
            tenant_id: call.tenant_id,
            voice_config: voiceConfig,
            call_id: call.id,
            caller_phone: '', // Se podría obtener del call
            conversation_history: previousMessages,
          },
          event.transcript.text
        );

        // La respuesta se genera y se envía por VAPI automáticamente
        // pero podemos guardar metadata
        console.log(`[Voice Webhook] Processed: intent=${result.intent}, escalate=${result.should_escalate}`);

        // Actualizar estado si debe escalar
        if (result.should_escalate) {
          await supabase
            .from('voice_calls')
            .update({
              escalated: true,
              escalated_at: new Date().toISOString(),
              escalated_reason: result.escalation_reason,
            })
            .eq('id', call.id);
        }

        // Actualizar si hay booking
        if (result.booking_result?.success) {
          await supabase
            .from('voice_calls')
            .update({
              outcome: 'appointment_booked',
              updated_at: new Date().toISOString(),
            })
            .eq('id', call.id);
        }
      } catch (error) {
        console.error('[Voice Webhook] Error processing message:', error);
      }
    }
  }

  return { status: 'ok' };
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
    // Verificar secret si está configurado
    const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = request.headers.get('x-vapi-secret');
      if (authHeader !== webhookSecret) {
        console.warn('[Voice Webhook] Invalid webhook secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
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

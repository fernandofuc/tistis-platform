// =====================================================
// TIS TIS PLATFORM - Voice LangGraph Integration Service
// Integra el Voice Agent con el sistema LangGraph existente
// =====================================================

import { createClient } from '@supabase/supabase-js';
import {
  executeGraph,
  type GraphExecutionInput,
} from '@/src/features/ai/graph';
import { LangGraphAIService } from '@/src/features/ai/services/langgraph-ai.service';
import type {
  VoiceAgentConfig,
  VoiceCall,
  VoiceCallMessage,
  CallAnalysis,
} from '../types';

// ======================
// TYPES
// ======================

export interface VoiceAgentContext {
  tenant_id: string;
  voice_config: VoiceAgentConfig;
  call_id: string;
  caller_phone: string;
  conversation_history: VoiceCallMessage[];
}

export interface VoiceResponseResult {
  response: string;
  intent: string;
  signals: Array<{ signal: string; points: number }>;
  should_escalate: boolean;
  escalation_reason?: string;
  booking_result?: {
    success: boolean;
    appointment_id?: string;
    scheduled_at?: string;
    service_name?: string;
    branch_name?: string;
    staff_name?: string;
  };
  extracted_info?: {
    customer_name?: string;
    appointment_date?: string;
    appointment_time?: string;
    service_requested?: string;
    urgency?: 'low' | 'medium' | 'high';
  };
  end_call?: boolean;
  end_call_reason?: string;
}

// ======================
// SERVICE CLIENT
// ======================

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ======================
// VOICE-SPECIFIC PROMPT INJECTION
// ======================

/**
 * Genera instrucciones adicionales para el prompt del LLM específicas para voz
 */
function generateVoiceInstructions(config: VoiceAgentConfig): string {
  const fillerPhrasesSection = config.use_filler_phrases
    ? `
## Frases de Relleno Naturales
Usa estas frases para sonar más natural y evitar silencios incómodos:
- Antes de responder: "Mmm...", "Bueno...", "A ver..."
- Para confirmar: "Claro...", "Por supuesto...", "Entendido..."
- Para transiciones: "Entonces...", "Muy bien...", "Perfecto..."
- Al buscar información: "Déjame ver...", "Un momento...", "Voy a revisar..."
`
    : '';

  return `
## Instrucciones Específicas para Llamada de Voz

### Tu Identidad
Eres ${config.assistant_name}, un asistente telefónico virtual de TIS TIS.

### Personalidad: ${config.assistant_personality}
${config.assistant_personality === 'professional' ? 'Mantén un tono serio, formal y directo. Usa usted.' : ''}
${config.assistant_personality === 'professional_friendly' ? 'Sé profesional pero cálido. Puedes usar tú si el cliente lo prefiere.' : ''}
${config.assistant_personality === 'casual' ? 'Sé relajado y conversacional. Usa tú naturalmente.' : ''}
${config.assistant_personality === 'formal' ? 'Máxima formalidad. Siempre use usted y sea muy respetuoso.' : ''}

### Formato de Respuestas para Voz
IMPORTANTE: Estás hablando por TELÉFONO, no escribiendo un chat.
- Respuestas CORTAS y NATURALES (máximo 2-3 oraciones)
- NO uses emojis, bullets, o formato markdown
- NO digas "Escríbeme" o "Envíame un mensaje"
- SÍ di "Dime" o "Cuéntame"
- Habla como si estuvieras en una conversación real

${fillerPhrasesSection}

### Manejo de Turnos de Conversación
- Espera tu turno para hablar
- No interrumpas al cliente a menos que sea necesario
- Si el cliente está pensando, espera pacientemente
- Si hay silencio prolongado, pregunta suavemente: "¿Sigues ahí?"

### Finalizar Llamada
Si el cliente indica que quiere colgar:
- "Gracias por llamar"
- "¿Hay algo más en lo que pueda ayudarte antes de colgar?"
- "Que tengas un excelente día"

Frases que indican fin de llamada: ${config.end_call_phrases?.join(', ') || 'adiós, hasta luego, bye, chao, eso es todo, nada más, muchas gracias'}

### Instrucciones Personalizadas del Negocio
${config.custom_instructions || 'Sin instrucciones adicionales.'}
`;
}

// ======================
// MAIN SERVICE FUNCTION
// ======================

/**
 * Procesa un mensaje de voz usando LangGraph
 *
 * Esta función es el punto de entrada para procesar transcripciones de voz.
 * Integra con el sistema LangGraph existente pero añade contexto específico para voz.
 */
export async function processVoiceMessage(
  context: VoiceAgentContext,
  transcribedMessage: string
): Promise<VoiceResponseResult> {
  const startTime = Date.now();
  console.log(`[Voice LangGraph] Processing voice message for call ${context.call_id}`);

  try {
    // 1. Cargar contextos usando los loaders de LangGraphAIService
    const [tenantContext, businessContext] = await Promise.all([
      LangGraphAIService.loadTenantContext(context.tenant_id),
      LangGraphAIService.loadBusinessContext(context.tenant_id),
    ]);

    if (!tenantContext) {
      throw new Error('Could not load tenant context');
    }

    // 2. Inyectar instrucciones de voz al system prompt
    const voiceInstructions = generateVoiceInstructions(context.voice_config);
    const enhancedTenantContext = {
      ...tenantContext,
      ai_config: {
        ...tenantContext.ai_config,
        system_prompt: `${tenantContext.ai_config.system_prompt}\n\n${voiceInstructions}`,
        max_response_length: 150, // Respuestas más cortas para voz
      },
    };

    // 3. Construir historial de conversación para el grafo
    const conversationHistory = context.conversation_history
      .map((msg) => `${msg.role === 'user' ? 'Cliente' : 'Asistente'}: ${msg.content}`)
      .join('\n');

    // 4. Preparar input para el grafo
    const graphInput: GraphExecutionInput = {
      tenant_id: context.tenant_id,
      conversation_id: context.call_id, // Usamos call_id como conversation_id
      lead_id: '', // Se puede crear lead desde la llamada si es necesario
      current_message: transcribedMessage,
      channel: 'voice', // Nuevo canal: voz
      tenant_context: enhancedTenantContext,
      lead_context: null,
      conversation_context: {
        conversation_id: context.call_id,
        channel: 'voice',
        status: 'active',
        ai_handling: true,
        message_count: context.conversation_history.length,
        started_at: context.conversation_history[0]?.created_at || new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      },
      business_context: businessContext,
    };

    // 5. Ejecutar el grafo
    const result = await executeGraph(graphInput);

    const processingTime = Date.now() - startTime;
    console.log(`[Voice LangGraph] Completed in ${processingTime}ms. Intent: ${result.intent}`);

    // 6. Detectar si debe terminar la llamada
    const endCallPhrases = context.voice_config.end_call_phrases || [
      'adiós', 'hasta luego', 'bye', 'chao', 'eso es todo', 'nada más'
    ];
    const shouldEndCall = endCallPhrases.some((phrase) =>
      transcribedMessage.toLowerCase().includes(phrase.toLowerCase())
    );

    // 7. Extraer información del cliente si es posible
    const extractedInfo = extractCustomerInfo(transcribedMessage, result.response);

    // Mapear booking_result si existe
    const bookingResult = result.booking_result ? {
      success: result.booking_result.success,
      appointment_id: result.booking_result.appointment_id,
      scheduled_at: result.booking_result.scheduled_at,
      service_name: result.booking_result.service_name,
      branch_name: result.booking_result.branch_name,
      staff_name: result.booking_result.staff_name,
    } : undefined;

    return {
      response: result.response,
      intent: result.intent,
      signals: result.signals,
      should_escalate: result.escalated,
      escalation_reason: result.escalation_reason,
      booking_result: bookingResult,
      extracted_info: extractedInfo,
      end_call: shouldEndCall,
      end_call_reason: shouldEndCall ? 'customer_goodbye' : undefined,
    };
  } catch (error) {
    console.error('[Voice LangGraph] Error:', error);

    return {
      response: 'Disculpa, tuve un problema técnico. ¿Podrías repetir lo que dijiste?',
      intent: 'ERROR',
      signals: [],
      should_escalate: false,
      extracted_info: undefined,
    };
  }
}

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Extrae información del cliente de la conversación
 */
function extractCustomerInfo(
  customerMessage: string,
  aiResponse: string
): VoiceResponseResult['extracted_info'] {
  const info: VoiceResponseResult['extracted_info'] = {};

  // Detectar nombre (patrones comunes)
  const namePatterns = [
    /me llamo (\w+)/i,
    /soy (\w+)/i,
    /mi nombre es (\w+)/i,
    /(\w+) (?:hablando|aquí)/i,
  ];
  for (const pattern of namePatterns) {
    const match = customerMessage.match(pattern);
    if (match && match[1]) {
      info.customer_name = match[1];
      break;
    }
  }

  // Detectar urgencia
  const urgentKeywords = ['urgente', 'emergencia', 'dolor', 'ahora mismo', 'hoy'];
  const mediumKeywords = ['pronto', 'esta semana', 'lo antes posible'];

  if (urgentKeywords.some((kw) => customerMessage.toLowerCase().includes(kw))) {
    info.urgency = 'high';
  } else if (mediumKeywords.some((kw) => customerMessage.toLowerCase().includes(kw))) {
    info.urgency = 'medium';
  }

  // Detectar servicio solicitado (basándose en la respuesta del AI que puede mencionarlo)
  const servicePatterns = [
    /(?:quiero|necesito|me interesa) (?:una? )?(\w+(?:\s+\w+)?)/i,
    /(?:agendar|reservar|pedir) (?:una? )?(?:cita (?:de|para) )?(\w+(?:\s+\w+)?)/i,
  ];
  for (const pattern of servicePatterns) {
    const match = customerMessage.match(pattern);
    if (match && match[1]) {
      info.service_requested = match[1];
      break;
    }
  }

  return Object.keys(info).length > 0 ? info : undefined;
}

/**
 * Registra un mensaje en la base de datos de voice_call_messages
 */
export async function saveVoiceMessage(
  callId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata: {
    audio_url?: string;
    duration_seconds?: number;
    detected_intent?: string;
    confidence?: number;
    response_latency_ms?: number;
    tokens_used?: number;
    sequence_number: number;
  }
): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from('voice_call_messages').insert({
    call_id: callId,
    role,
    content,
    audio_url: metadata.audio_url,
    duration_seconds: metadata.duration_seconds,
    detected_intent: metadata.detected_intent,
    confidence: metadata.confidence,
    response_latency_ms: metadata.response_latency_ms,
    tokens_used: metadata.tokens_used || 0,
    sequence_number: metadata.sequence_number,
  });
}

/**
 * Actualiza el análisis de la llamada al finalizar
 */
export async function updateCallAnalysis(
  callId: string,
  analysis: CallAnalysis,
  outcome?: string
): Promise<void> {
  const supabase = createServiceClient();

  await supabase
    .from('voice_calls')
    .update({
      analysis,
      outcome,
      updated_at: new Date().toISOString(),
    })
    .eq('id', callId);
}

/**
 * Analiza toda la conversación al final de la llamada para extraer datos estructurados
 */
export async function analyzeCallConversation(callId: string): Promise<CallAnalysis> {
  const supabase = createServiceClient();

  // Obtener todos los mensajes de la llamada
  const { data: messages } = await supabase
    .from('voice_call_messages')
    .select('*')
    .eq('call_id', callId)
    .order('sequence_number', { ascending: true });

  if (!messages || messages.length === 0) {
    return {};
  }

  const analysis: CallAnalysis = {
    key_topics: [],
  };

  // Analizar mensajes del usuario para extraer info
  const userMessages = messages.filter((m) => m.role === 'user');

  for (const msg of userMessages) {
    const content = msg.content.toLowerCase();

    // Detectar nombre
    if (!analysis.customer_name) {
      const namePatterns = [/me llamo (\w+)/i, /soy (\w+)/i, /mi nombre es (\w+)/i];
      for (const pattern of namePatterns) {
        const match = msg.content.match(pattern);
        if (match && match[1]) {
          analysis.customer_name = match[1];
          break;
        }
      }
    }

    // Detectar intención de cita
    if (content.includes('cita') || content.includes('agendar') || content.includes('reservar')) {
      analysis.appointment_requested = true;
    }

    // Detectar temas clave
    const topics = ['precio', 'horario', 'ubicación', 'servicio', 'doctor', 'cita', 'urgente'];
    for (const topic of topics) {
      if (content.includes(topic) && !analysis.key_topics?.includes(topic)) {
        analysis.key_topics?.push(topic);
      }
    }
  }

  // Analizar sentimiento general
  const positiveWords = ['gracias', 'excelente', 'perfecto', 'genial', 'muy bien'];
  const negativeWords = ['malo', 'horrible', 'pésimo', 'queja', 'problema'];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const msg of userMessages) {
    const content = msg.content.toLowerCase();
    positiveCount += positiveWords.filter((w) => content.includes(w)).length;
    negativeCount += negativeWords.filter((w) => content.includes(w)).length;
  }

  if (positiveCount > negativeCount * 2) {
    analysis.sentiment = 'positive';
  } else if (negativeCount > positiveCount * 2) {
    analysis.sentiment = 'negative';
  } else {
    analysis.sentiment = 'neutral';
  }

  return analysis;
}

// ======================
// EXPORTS
// ======================

export const VoiceLangGraphService = {
  processVoiceMessage,
  saveVoiceMessage,
  updateCallAnalysis,
  analyzeCallConversation,
  generateVoiceInstructions,
};

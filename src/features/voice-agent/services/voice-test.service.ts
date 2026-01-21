// =====================================================
// TIS TIS PLATFORM - Voice Test Service
// Servicio para procesar mensajes de prueba del asistente
// =====================================================
// Este servicio permite probar el asistente de voz por texto,
// usando la misma lógica de LangGraph que se usa en llamadas
// reales pero sin necesidad de VAPI.
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  processVoiceMessage,
  VoiceAgentContext,
  VoiceResponseResult,
} from './voice-langgraph.service';
import type { VoiceAgentConfig, VoiceCallMessage } from '../types';

// ======================
// TYPES
// ======================

export interface TestMessageInput {
  tenantId: string;
  message: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface TestMessageResult {
  response: string;
  toolsUsed?: string[];
  ragContext?: string;
  error?: string;
}

// ======================
// SUPABASE CLIENT
// ======================

function createServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// ======================
// SERVICE CLASS
// ======================

export class VoiceTestService {
  /**
   * Procesa un mensaje de prueba usando la lógica de LangGraph
   *
   * Esta función:
   * 1. Carga la configuración del voice agent
   * 2. Construye el contexto necesario para LangGraph
   * 3. Procesa el mensaje y retorna la respuesta
   *
   * @param input - Mensaje y contexto de la conversación
   * @returns Respuesta del asistente con métricas opcionales
   */
  static async processTestMessage(
    input: TestMessageInput
  ): Promise<TestMessageResult> {
    const { tenantId, message, conversationHistory = [] } = input;

    // Log sin exponer tenantId completo
    console.log('[VoiceTestService] Processing test message:', {
      tenantId: tenantId.substring(0, 8) + '...',
      messageLength: message.length,
      historyLength: conversationHistory.length,
    });

    try {
      // 1. Cargar configuración del voice agent
      const voiceConfig = await this.loadVoiceConfig(tenantId);

      if (!voiceConfig) {
        console.warn('[VoiceTestService] No voice config found, using fallback');
        return {
          response: await this.getFallbackResponse(tenantId, message),
          error: 'Voice config not found - using fallback',
        };
      }

      // 2. Construir historial de conversación en formato VoiceCallMessage
      const callHistory: VoiceCallMessage[] = conversationHistory.map(
        (msg, index) => ({
          id: `test-msg-${index}`,
          call_id: 'test-call',
          role: msg.role,
          content: msg.content,
          audio_url: null,
          start_time_seconds: null,
          end_time_seconds: null,
          duration_seconds: null,
          detected_intent: null,
          confidence: null,
          response_latency_ms: null,
          tokens_used: 0,
          sequence_number: index + 1,
          created_at: new Date().toISOString(),
        })
      );

      // 3. Crear contexto para VoiceLangGraphService
      const context: VoiceAgentContext = {
        tenant_id: tenantId,
        voice_config: voiceConfig,
        call_id: `test-${Date.now()}`, // ID sintético para el test
        caller_phone: '+0000000000', // Número ficticio para test
        conversation_history: callHistory,
      };

      // 4. Procesar con LangGraph
      const result: VoiceResponseResult = await processVoiceMessage(
        context,
        message
      );

      console.log('[VoiceTestService] LangGraph result:', {
        intent: result.intent,
        responseLength: result.response?.length,
        hasError: !!result.escalation_reason,
      });

      // 5. Extraer información de tools usados (si existe)
      const toolsUsed = result.signals
        ? this.extractToolsFromSignals(result.signals)
        : [];

      // 6. Validar que response existe
      const responseText = result.response || 'Lo siento, no pude procesar tu mensaje. ¿Podrías repetirlo?';

      return {
        response: responseText,
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        ragContext: result.extracted_info
          ? JSON.stringify(result.extracted_info)
          : undefined,
      };
    } catch (error) {
      console.error('[VoiceTestService] Error processing message:', error);

      // Retornar respuesta de fallback en caso de error
      return {
        response: await this.getFallbackResponse(tenantId, message),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Carga la configuración del voice agent para el tenant
   */
  private static async loadVoiceConfig(
    tenantId: string
  ): Promise<VoiceAgentConfig | null> {
    const supabase = createServiceClient();

    // Obtener la configuración más reciente
    const { data, error } = await supabase
      .from('voice_assistant_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[VoiceTestService] Error loading voice config:', error);
      return null;
    }

    if (!data) {
      // No exponer tenantId completo en logs
      console.warn('[VoiceTestService] No voice config found for tenant:', tenantId.substring(0, 8) + '...');
      return null;
    }

    // Mapear a VoiceAgentConfig
    return this.mapToVoiceAgentConfig(data);
  }

  /**
   * Mapea los datos de la DB al tipo VoiceAgentConfig
   * Campos de voice_assistant_configs tabla:
   * - is_active, status, assistant_type_id, assistant_name, personality_type
   * - first_message, first_message_mode, voice_id, voice_speed
   * - special_instructions, compiled_prompt, compiled_prompt_at
   * - max_call_duration_seconds, silence_timeout_seconds
   * - filler_phrases, use_filler_phrases, end_call_phrases
   * - recording_enabled, transcription_stored, hipaa_enabled, pci_enabled
   * - last_configured_at, last_configured_by, configuration_version
   */
  private static mapToVoiceAgentConfig(
    data: Record<string, unknown>
  ): VoiceAgentConfig {
    // Validar campos requeridos
    if (!data.id || typeof data.id !== 'string') {
      throw new Error('Invalid voice config: missing id');
    }
    if (!data.tenant_id || typeof data.tenant_id !== 'string') {
      throw new Error('Invalid voice config: missing tenant_id');
    }

    // Mapear status de la BD a voice_status del tipo
    const dbStatus = typeof data.status === 'string' ? data.status : 'inactive';
    let voiceStatus: VoiceAgentConfig['voice_status'] = 'inactive';
    if (dbStatus === 'active') voiceStatus = 'active';
    else if (dbStatus === 'draft' || dbStatus === 'pending_review') voiceStatus = 'configuring';
    else if (dbStatus === 'suspended') voiceStatus = 'suspended';
    else if (dbStatus === 'error') voiceStatus = 'error';

    return {
      id: data.id as string,
      tenant_id: data.tenant_id as string,
      voice_enabled: (data.is_active as boolean) ?? false,
      voice_status: voiceStatus,
      assistant_type_id: (data.assistant_type_id as string) ?? null,
      assistant_name: (data.assistant_name as string) ?? 'Asistente Virtual',
      // BD usa personality_type, no personality
      assistant_personality:
        (data.personality_type as VoiceAgentConfig['assistant_personality']) ??
        'professional_friendly',
      first_message: (data.first_message as string) ?? '',
      first_message_mode:
        (data.first_message_mode as VoiceAgentConfig['first_message_mode']) ??
        'assistant_speaks_first',
      // Defaults para voice - BD almacena voice_id como UUID a voice_catalog
      voice_provider: 'elevenlabs',
      voice_id: (data.voice_id as string) ?? '',
      voice_model: 'eleven_multilingual_v2',
      voice_stability: 0.5,
      voice_similarity_boost: 0.75,
      voice_style: 0.0,
      voice_use_speaker_boost: true,
      // Defaults para transcription
      transcription_provider: 'deepgram',
      transcription_model: 'nova-2',
      transcription_language: 'es',
      transcription_confidence_threshold: 0.7,
      // Defaults para AI
      ai_model: 'gpt-4o',
      ai_temperature: 0.7,
      ai_max_tokens: 500,
      // Defaults para timing
      wait_seconds: 0.4,
      on_punctuation_seconds: 0.1,
      on_no_punctuation_seconds: 1.5,
      // Campos que sí existen en la BD
      max_call_duration_seconds: (data.max_call_duration_seconds as number) ?? 600,
      silence_timeout_seconds: (data.silence_timeout_seconds as number) ?? 30,
      response_delay_seconds: 0.4,
      interruption_threshold: 100,
      recording_enabled: (data.recording_enabled as boolean) ?? true,
      transcription_stored: (data.transcription_stored as boolean) ?? true,
      hipaa_enabled: (data.hipaa_enabled as boolean) ?? false,
      pci_enabled: (data.pci_enabled as boolean) ?? false,
      filler_phrases: (data.filler_phrases as string[]) ?? [],
      use_filler_phrases: (data.use_filler_phrases as boolean) ?? true,
      end_call_phrases: (data.end_call_phrases as string[]) ?? [
        'adiós',
        'hasta luego',
        'bye',
        'chao',
      ],
      goodbye_message: null,
      escalation_enabled: false,
      escalation_phone: null,
      // BD usa compiled_prompt, no system_prompt
      system_prompt: (data.compiled_prompt as string) ?? null,
      system_prompt_generated_at: (data.compiled_prompt_at as string) ?? null,
      // BD usa special_instructions, no custom_instructions
      custom_instructions: (data.special_instructions as string) ?? null,
      last_configured_at: (data.last_configured_at as string) ?? null,
      last_configured_by: (data.last_configured_by as string) ?? null,
      configuration_version: (data.configuration_version as number) ?? 1,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
    };
  }

  /**
   * Extrae los nombres de tools usados de los signals del resultado
   */
  private static extractToolsFromSignals(
    signals: Array<{ signal: string; points: number }>
  ): string[] {
    const toolSignals = signals
      .filter((s) => s.signal.startsWith('tool:') || s.signal.startsWith('TOOL_'))
      .map((s) => s.signal.replace(/^(tool:|TOOL_)/, ''));

    return Array.from(new Set(toolSignals)); // Eliminar duplicados
  }

  /**
   * Genera una respuesta de fallback basada en el mensaje y vertical del tenant
   * Se usa cuando no hay configuración o hay un error
   */
  private static async getFallbackResponse(
    tenantId: string,
    message: string
  ): Promise<string> {
    let supabase: SupabaseClient;
    try {
      supabase = createServiceClient();
    } catch (error) {
      console.error('[VoiceTestService] Failed to create Supabase client for fallback:', error);
      // Retornar respuesta genérica sin acceso a BD
      return 'Entendido. ¿Hay algo más en lo que pueda ayudarte?';
    }

    // Intentar obtener la vertical del tenant (maybeSingle para evitar error si no existe)
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('vertical, name')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError) {
      console.warn('[VoiceTestService] Error fetching tenant for fallback:', tenantError.message);
    }

    const vertical = tenant?.vertical ?? 'general';
    const businessName = tenant?.name ?? 'nuestro negocio';
    const lowerMessage = message.toLowerCase();

    // Respuestas por vertical
    const responses: Record<string, Record<string, string>> = {
      restaurant: {
        hola: `¡Hola! Bienvenido a ${businessName}. ¿En qué puedo ayudarte?`,
        reserv: 'Con gusto te ayudo con una reservación. ¿Para qué día y cuántas personas?',
        mesa: 'Permíteme verificar disponibilidad. ¿Para qué día y hora te gustaría?',
        menu: 'Tenemos una variedad de platillos. ¿Te gustaría conocer nuestras especialidades?',
        horario: 'Puedo informarte sobre nuestros horarios. ¿Hay algo más en que pueda ayudarte?',
        domicilio: 'Sí, contamos con servicio a domicilio. ¿Te gustaría hacer un pedido?',
        gracias: '¡De nada! Fue un placer atenderte. ¡Esperamos verte pronto!',
      },
      dental: {
        hola: `¡Hola! Bienvenido a ${businessName}. ¿En qué puedo ayudarte?`,
        cita: 'Con gusto te ayudo a agendar una cita. ¿Qué día te gustaría venir?',
        disponib: 'Permíteme verificar nuestra agenda. ¿Tienes preferencia de horario?',
        servicio: 'Ofrecemos diversos tratamientos dentales. ¿Hay algo específico que necesites?',
        horario: 'Puedo informarte sobre nuestros horarios de atención. ¿Puedo ayudarte en algo más?',
        precio: 'Los precios varían según el tratamiento. ¿Qué procedimiento te interesa?',
        dolor: 'Entiendo, el dolor dental puede ser muy molesto. Te recomiendo agendar una cita lo antes posible.',
        gracias: '¡De nada! Gracias por contactarnos. ¡Cuida tu sonrisa!',
      },
      general: {
        hola: `¡Hola! Bienvenido a ${businessName}. ¿En qué puedo ayudarte?`,
        cita: 'Con gusto te ayudo a agendar. ¿Qué día te funcionaría mejor?',
        horario: 'Puedo darte información sobre nuestros horarios. ¿Necesitas algo más?',
        precio: 'Los precios varían según el servicio. ¿Qué te interesa conocer?',
        gracias: '¡De nada! Fue un placer ayudarte.',
      },
    };

    // Seleccionar respuestas según vertical
    const verticalResponses = responses[vertical] ?? responses.general;

    // Buscar coincidencia en el mensaje
    for (const [keyword, response] of Object.entries(verticalResponses)) {
      if (lowerMessage.includes(keyword)) {
        return response;
      }
    }

    // Respuesta genérica si no hay coincidencia
    return 'Entendido. ¿Hay algo más en lo que pueda ayudarte?';
  }
}

// ======================
// EXPORTS
// ======================

export default VoiceTestService;

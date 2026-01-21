// =====================================================
// TIS TIS PLATFORM - Voice Agent Service v2.0
// Servicio principal para gestión de Voice Agent
// Arquitectura simplificada - Solo v2 (voice_assistant_configs)
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type {
  VoiceAgentConfig,
  VoiceAgentConfigInput,
  VoicePhoneNumber,
  VoiceCall,
  VoiceAgentContextResponse,
  VoiceUsageSummary,
  VAPIAssistantConfig,
  VoiceStatus,
  VoicePersonality,
  FirstMessageMode,
  VoiceProvider,
  TranscriptionProvider,
  AIModel,
} from '../types';
import { VAPIApiService } from './vapi-api.service';

// =====================================================
// SUPABASE CLIENT
// =====================================================

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// =====================================================
// CONFIGURATION MANAGEMENT
// =====================================================

/**
 * Obtener o crear configuración de Voice Agent
 * Usa la tabla voice_assistant_configs (v2)
 */
export async function getOrCreateVoiceConfig(tenantId: string): Promise<VoiceAgentConfig | null> {
  const supabase = createServerClient();

  // Intentar obtener config existente de voice_assistant_configs
  // Usamos maybeSingle() para manejar el caso de 0 o múltiples resultados sin error
  const { data: existing, error: existingError } = await supabase
    .from('voice_assistant_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error('[Voice Agent] Error fetching existing config:', existingError);
  }

  if (existing) {
    // Mapear campos de voice_assistant_configs a VoiceAgentConfig
    return mapV2ConfigToLegacy(existing);
  }

  // Verificar que el tenant existe
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError) {
    console.error('[Voice Agent] Error fetching tenant:', tenantError);
    return null;
  }

  if (!tenant) {
    console.error('[Voice Agent] No tenant found:', tenantId);
    return null;
  }

  // Buscar tipo de asistente por defecto
  // Primero intentamos con is_default, si no existe la columna o no hay registro,
  // usamos el primer tipo activo ordenado por display_order
  let defaultType: { id: string } | null = null;

  // Intentar obtener por is_default (si la columna existe)
  const { data: defaultByFlag } = await supabase
    .from('voice_assistant_types')
    .select('id')
    .eq('is_default', true)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (defaultByFlag) {
    defaultType = defaultByFlag;
  } else {
    // Fallback: obtener el primer tipo activo ordenado por display_order
    const { data: firstActive } = await supabase
      .from('voice_assistant_types')
      .select('id')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    defaultType = firstActive;
  }

  if (!defaultType) {
    console.error('[Voice Agent] No assistant type found - table may be empty');
    return null;
  }

  // Crear config inicial en voice_assistant_configs
  // NOTA: voice_assistant_configs usa tenant_id directamente, no business_id
  const { data: newConfig, error } = await supabase
    .from('voice_assistant_configs')
    .insert({
      tenant_id: tenantId,
      assistant_type_id: defaultType.id,
      is_active: false,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('[Voice Agent] Error creating config:', error);
    return null;
  }

  return mapV2ConfigToLegacy(newConfig);
}

/**
 * Mapea la configuración v2 (voice_assistant_configs) al tipo legacy VoiceAgentConfig
 * Esto permite compatibilidad mientras se actualiza el resto del código
 */
function mapV2ConfigToLegacy(v2Config: Record<string, unknown>): VoiceAgentConfig {
  return {
    id: v2Config.id as string,
    tenant_id: v2Config.tenant_id as string,

    // Estado
    voice_enabled: (v2Config.is_active as boolean) ?? false,
    voice_status: (v2Config.status as VoiceStatus) || 'inactive',

    // Tipo de Asistente
    assistant_type_id: (v2Config.assistant_type_id as string) || null,

    // Asistente
    assistant_name: (v2Config.assistant_name as string) || 'Asistente',
    assistant_personality: (v2Config.personality_type as VoicePersonality) || 'professional_friendly',

    // Primer mensaje
    first_message: (v2Config.first_message as string) || '¡Hola! ¿En qué puedo ayudarte?',
    first_message_mode: (v2Config.first_message_mode as FirstMessageMode) || 'assistant_speaks_first',

    // Voz (ElevenLabs)
    voice_provider: 'elevenlabs' as VoiceProvider,
    voice_id: (v2Config.voice_id as string) || 'coral',
    voice_model: 'eleven_multilingual_v2',
    voice_stability: (v2Config.voice_stability as number) ?? 0.5,
    voice_similarity_boost: (v2Config.voice_similarity_boost as number) ?? 0.75,
    voice_style: 0,
    voice_use_speaker_boost: true,

    // Transcripción (Deepgram)
    transcription_provider: 'deepgram' as TranscriptionProvider,
    transcription_model: 'nova-2',
    transcription_language: 'es',
    transcription_confidence_threshold: 0.7,

    // IA
    ai_model: 'gpt-4o-mini' as AIModel,
    ai_temperature: 0.7,
    ai_max_tokens: 500,

    // Start Speaking Plan
    wait_seconds: (v2Config.wait_seconds as number) ?? 0.6,
    on_punctuation_seconds: (v2Config.on_punctuation_seconds as number) ?? 0.2,
    on_no_punctuation_seconds: (v2Config.on_no_punctuation_seconds as number) ?? 1.2,

    // Llamada
    max_call_duration_seconds: (v2Config.max_call_duration_seconds as number) || 600,
    silence_timeout_seconds: (v2Config.silence_timeout_seconds as number) || 30,
    response_delay_seconds: 0.4,
    interruption_threshold: 100,

    // Privacidad
    recording_enabled: (v2Config.recording_enabled as boolean) ?? true,
    transcription_stored: true,
    hipaa_enabled: (v2Config.hipaa_enabled as boolean) ?? false,
    pci_enabled: false,

    // Frases
    filler_phrases: (v2Config.filler_phrases as string[]) || [],
    use_filler_phrases: (v2Config.use_filler_phrases as boolean) ?? true,
    end_call_phrases: (v2Config.end_call_phrases as string[]) || ['adiós', 'hasta luego', 'bye'],
    goodbye_message: (v2Config.goodbye_message as string) || null,

    // Escalación
    escalation_enabled: (v2Config.escalation_enabled as boolean) ?? false,
    escalation_phone: (v2Config.escalation_phone as string) || null,

    // Prompt
    system_prompt: (v2Config.compiled_prompt as string) || null,
    system_prompt_generated_at: (v2Config.compiled_prompt_at as string) || null,
    custom_instructions: (v2Config.special_instructions as string) || null,

    // Metadata
    last_configured_at: (v2Config.last_configured_at as string) || null,
    last_configured_by: (v2Config.last_configured_by as string) || null,
    configuration_version: (v2Config.configuration_version as number) || 1,

    // Timestamps
    created_at: v2Config.created_at as string,
    updated_at: v2Config.updated_at as string,
  };
}

/**
 * Actualizar configuración de Voice Agent
 * Usa la tabla voice_assistant_configs (v2)
 */
export async function updateVoiceConfig(
  tenantId: string,
  updates: VoiceAgentConfigInput,
  staffId?: string
): Promise<VoiceAgentConfig | null> {
  const supabase = createServerClient();

  console.log('[Voice Agent Service] updateVoiceConfig called with:', {
    tenantId,
    updates,
    staffId,
  });

  // Mapear campos de VoiceAgentConfigInput a campos v2 (voice_assistant_configs)
  // Solo usamos campos que existen en el tipo VoiceAgentConfigInput
  const v2Updates: Record<string, unknown> = {};

  // Tipo de asistente - si cambia, invalidar prompt para regeneración
  // y actualizar max_call_duration_seconds según el tipo
  if (updates.assistant_type_id !== undefined) {
    v2Updates.assistant_type_id = updates.assistant_type_id;
    // Invalidar prompt para que se regenere con el nuevo tipo
    v2Updates.compiled_prompt = null;
    v2Updates.compiled_prompt_at = null;

    // Actualizar max_call_duration según el tipo de asistente
    // basic = 300s (5min), standard = 420s (7min), complete = 600s (10min)
    const typeLevel = updates.assistant_type_id.includes('basic') ? 'basic'
      : updates.assistant_type_id.includes('complete') ? 'complete'
      : 'standard';
    const durationByLevel = { basic: 300, standard: 420, complete: 600 };
    v2Updates.max_call_duration_seconds = durationByLevel[typeLevel];
  }

  if (updates.assistant_name !== undefined) v2Updates.assistant_name = updates.assistant_name;
  if (updates.assistant_personality !== undefined) v2Updates.personality_type = updates.assistant_personality;
  if (updates.first_message !== undefined) v2Updates.first_message = updates.first_message;
  if (updates.first_message_mode !== undefined) v2Updates.first_message_mode = updates.first_message_mode;
  if (updates.voice_id !== undefined) v2Updates.voice_id = updates.voice_id;
  if (updates.voice_stability !== undefined) v2Updates.voice_stability = updates.voice_stability;
  if (updates.voice_similarity_boost !== undefined) v2Updates.voice_similarity_boost = updates.voice_similarity_boost;
  if (updates.recording_enabled !== undefined) v2Updates.recording_enabled = updates.recording_enabled;
  if (updates.max_call_duration_seconds !== undefined) v2Updates.max_call_duration_seconds = updates.max_call_duration_seconds;
  if (updates.custom_instructions !== undefined) v2Updates.special_instructions = updates.custom_instructions;
  if (updates.use_filler_phrases !== undefined) v2Updates.use_filler_phrases = updates.use_filler_phrases;
  if (updates.escalation_enabled !== undefined) v2Updates.escalation_enabled = updates.escalation_enabled;
  if (updates.escalation_phone !== undefined) v2Updates.escalation_phone = updates.escalation_phone;
  if (updates.goodbye_message !== undefined) v2Updates.goodbye_message = updates.goodbye_message;
  // Timing settings
  if (updates.wait_seconds !== undefined) v2Updates.wait_seconds = updates.wait_seconds;
  if (updates.on_punctuation_seconds !== undefined) v2Updates.on_punctuation_seconds = updates.on_punctuation_seconds;
  if (updates.on_no_punctuation_seconds !== undefined) v2Updates.on_no_punctuation_seconds = updates.on_no_punctuation_seconds;

  // Agregar metadata de configuración
  v2Updates.last_configured_at = new Date().toISOString();
  if (staffId) v2Updates.last_configured_by = staffId;

  console.log('[Voice Agent Service] V2 Update payload:', v2Updates);

  const { data, error } = await supabase
    .from('voice_assistant_configs')
    .update(v2Updates)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    console.error('[Voice Agent Service] Error updating config:', error);
    return null;
  }

  console.log('[Voice Agent Service] Update successful');

  return mapV2ConfigToLegacy(data);
}

/**
 * Activar/Desactivar Voice Agent
 * Usa la tabla voice_assistant_configs (v2)
 */
export async function toggleVoiceAgent(
  tenantId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient();

  // Verificar que tiene al menos un número activo si va a activar
  if (enabled) {
    const { data: numbers } = await supabase
      .from('voice_phone_numbers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(1);

    if (!numbers || numbers.length === 0) {
      return {
        success: false,
        error: 'Necesitas al menos un número de teléfono activo para activar Voice Agent',
      };
    }
  }

  const { error } = await supabase
    .from('voice_assistant_configs')
    .update({
      is_active: enabled,
      status: enabled ? 'active' : 'draft',
    })
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[Voice Agent] Error toggling:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =====================================================
// PROMPT GENERATION
// =====================================================

/**
 * Generar prompt automáticamente basándose en datos del tenant
 */
export async function generatePrompt(tenantId: string): Promise<string | null> {
  const supabase = createServerClient();

  // Usar función de PostgreSQL
  const { data, error } = await supabase.rpc('generate_voice_agent_prompt', {
    p_tenant_id: tenantId,
  });

  if (error) {
    console.error('[Voice Agent] Error generating prompt:', error);
    return null;
  }

  // Guardar prompt generado en config (voice_assistant_configs v2)
  if (data) {
    await supabase
      .from('voice_assistant_configs')
      .update({
        compiled_prompt: data,
        compiled_prompt_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);
  }

  return data;
}

/**
 * Obtener contexto completo para Voice Agent
 */
export async function getVoiceAgentContext(tenantId: string): Promise<VoiceAgentContextResponse | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('get_voice_agent_context', {
    p_tenant_id: tenantId,
  });

  if (error) {
    console.error('[Voice Agent] Error getting context:', error);
    return null;
  }

  return data as VoiceAgentContextResponse;
}

// =====================================================
// PHONE NUMBER MANAGEMENT
// =====================================================

/**
 * Verificar límite de números telefónicos basado en sucursales
 *
 * REGLA: El tenant puede tener MÁXIMO tantos números como sucursales activas
 * Ejemplo: 3 sucursales = máximo 3 números de teléfono
 */
export async function checkPhoneNumberLimit(tenantId: string): Promise<{
  canRequest: boolean;
  currentNumbers: number;
  maxAllowed: number;
  activeBranches: number;
  message?: string;
}> {
  const supabase = createServerClient();

  // 1. Contar sucursales activas del tenant
  const { data: branches, error: branchError } = await supabase
    .from('branches')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (branchError) {
    console.error('[Voice Agent] Error counting branches:', branchError);
    return {
      canRequest: false,
      currentNumbers: 0,
      maxAllowed: 0,
      activeBranches: 0,
      message: 'Error al verificar sucursales',
    };
  }

  const activeBranches = branches?.length || 0;

  // Si no tiene sucursales, no puede tener números
  if (activeBranches === 0) {
    return {
      canRequest: false,
      currentNumbers: 0,
      maxAllowed: 0,
      activeBranches: 0,
      message: 'Necesitas al menos una sucursal activa para adquirir números de teléfono',
    };
  }

  // 2. Contar números del tenant (todos menos liberados)
  // Incluye: active, pending, provisioning, suspended
  const { data: phoneNumbers, error: phoneError } = await supabase
    .from('voice_phone_numbers')
    .select('id')
    .eq('tenant_id', tenantId)
    .neq('status', 'released'); // Excluir solo los liberados

  if (phoneError) {
    console.error('[Voice Agent] Error counting phone numbers:', phoneError);
    return {
      canRequest: false,
      currentNumbers: 0,
      maxAllowed: activeBranches,
      activeBranches,
      message: 'Error al verificar números existentes',
    };
  }

  const currentNumbers = phoneNumbers?.length || 0;
  const maxAllowed = activeBranches;
  const canRequest = currentNumbers < maxAllowed;

  return {
    canRequest,
    currentNumbers,
    maxAllowed,
    activeBranches,
    message: canRequest
      ? undefined
      : `Has alcanzado el límite de ${maxAllowed} número${maxAllowed > 1 ? 's' : ''} de teléfono (${activeBranches} sucursal${activeBranches > 1 ? 'es' : ''} activa${activeBranches > 1 ? 's' : ''})`,
  };
}

/**
 * Obtener números de teléfono del tenant
 *
 * IMPORTANTE: Solo retorna números NO liberados (active, pending, provisioning)
 * Los números 'released' se excluyen para mantener consistencia con el límite
 */
export async function getPhoneNumbers(tenantId: string): Promise<VoicePhoneNumber[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('voice_phone_numbers')
    .select('*')
    .eq('tenant_id', tenantId)
    .neq('status', 'released') // Excluir números liberados
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Voice Agent] Error fetching phone numbers:', error);
    return [];
  }

  return data as VoicePhoneNumber[];
}

/**
 * Solicitar nuevo número de teléfono
 *
 * FLUJO COMPLETO (VAPI Oculto):
 * 1. Verifica plan del tenant
 * 2. Obtiene configuración de voz y datos del tenant
 * 3. Llama a VAPI API para crear asistente + comprar número
 * 4. Guarda los IDs de VAPI en Supabase
 * 5. Retorna el número listo para usar
 *
 * El cliente solo ve: "Click → Número listo"
 */
export async function requestPhoneNumber(
  tenantId: string,
  areaCode: string,
  branchId?: string
): Promise<{ success: boolean; phoneNumber?: VoicePhoneNumber; error?: string }> {
  const supabase = createServerClient();

  console.log('[Voice Agent] Requesting phone number for tenant:', tenantId, 'area code:', areaCode);

  // 1. Verificar plan del tenant (solo Growth+)
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, plan, slug')
    .eq('id', tenantId)
    .single();

  if (!tenant || tenant.plan !== 'growth') {
    return {
      success: false,
      error: 'Voice Agent solo está disponible en el plan Growth',
    };
  }

  // 2. Verificar límite de números por sucursales
  const limitCheck = await checkPhoneNumberLimit(tenantId);

  if (!limitCheck.canRequest) {
    console.log('[Voice Agent] Phone number limit reached:', limitCheck);
    return {
      success: false,
      error: limitCheck.message || `Límite alcanzado: ${limitCheck.currentNumbers}/${limitCheck.maxAllowed} números`,
    };
  }

  // 3. Obtener configuración de voz del tenant (voice_assistant_configs v2)
  const { data: voiceConfig } = await supabase
    .from('voice_assistant_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (!voiceConfig) {
    return {
      success: false,
      error: 'Primero debes configurar tu asistente de voz',
    };
  }

  // 4. Construir webhook URL
  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/voice-agent/webhook`
    : '';

  if (!webhookUrl) {
    console.error('[Voice Agent] NEXT_PUBLIC_APP_URL not configured');
    return {
      success: false,
      error: 'Error de configuración del servidor. Contacta soporte.',
    };
  }

  // 5. Provisionar con VAPI API (asistente + número)
  console.log('[Voice Agent] Provisioning via VAPI API...');

  const provisionResult = await VAPIApiService.provisionPhoneNumberForTenant({
    tenantId,
    tenantName: tenant.name || tenant.slug || 'Negocio',
    areaCode,
    firstMessage: voiceConfig.first_message || '¡Hola! Gracias por llamar. ¿En qué puedo ayudarte?',
    voiceId: voiceConfig.voice_id || undefined,
    webhookUrl,
    webhookSecret: process.env.VAPI_WEBHOOK_SECRET,
  });

  if (!provisionResult.success || !provisionResult.phoneNumber) {
    console.error('[Voice Agent] VAPI provisioning failed:', provisionResult.error);
    return {
      success: false,
      error: provisionResult.error || 'Error al provisionar número. Intenta de nuevo.',
    };
  }

  console.log('[Voice Agent] VAPI provisioning successful:', {
    vapiAssistantId: provisionResult.assistant?.id,
    vapiPhoneNumber: provisionResult.phoneNumber.number,
  });

  // 6. Guardar en Supabase con IDs de VAPI
  const { data: phoneNumber, error: dbError } = await supabase
    .from('voice_phone_numbers')
    .insert({
      tenant_id: tenantId,
      voice_agent_config_id: voiceConfig.id,
      branch_id: branchId || null,
      phone_number: provisionResult.phoneNumber.number,
      phone_number_display: formatPhoneNumber(provisionResult.phoneNumber.number),
      area_code: areaCode,
      country_code: '+52',
      telephony_provider: 'vapi', // Usamos VAPI como provider
      provider_phone_sid: provisionResult.phoneNumber.id, // VAPI phone number ID
      vapi_assistant_id: provisionResult.assistant?.id, // VAPI assistant ID
      status: 'active', // ¡Ya está activo!
      provisioned_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (dbError) {
    console.error('[Voice Agent] Error saving to database:', dbError);

    // Rollback: liberar recursos en VAPI
    if (provisionResult.assistant && provisionResult.phoneNumber) {
      console.log('[Voice Agent] Rolling back VAPI resources...');
      await VAPIApiService.releasePhoneNumberForTenant(
        provisionResult.assistant.id,
        provisionResult.phoneNumber.id
      );
    }

    return {
      success: false,
      error: 'Error al guardar el número. Intenta de nuevo.',
    };
  }

  console.log('[Voice Agent] Phone number provisioned successfully:', phoneNumber.id);

  return { success: true, phoneNumber: phoneNumber as VoicePhoneNumber };
}

/**
 * Formatea un número de teléfono para mostrar
 */
function formatPhoneNumber(number: string): string {
  // Ejemplo: +5255123456789 → +52 55 1234 5678
  const cleaned = number.replace(/\D/g, '');

  if (cleaned.startsWith('52') && cleaned.length >= 12) {
    const country = cleaned.slice(0, 2);
    const area = cleaned.slice(2, 4);
    const part1 = cleaned.slice(4, 8);
    const part2 = cleaned.slice(8, 12);
    return `+${country} ${area} ${part1} ${part2}`;
  }

  return number;
}

/**
 * Liberar un número de teléfono
 *
 * Elimina el número de VAPI y actualiza el registro en Supabase
 */
export async function releasePhoneNumber(
  phoneNumberId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient();

  console.log('[Voice Agent] Releasing phone number:', phoneNumberId);

  // 1. Obtener el registro del número
  const { data: phoneRecord } = await supabase
    .from('voice_phone_numbers')
    .select('id, provider_phone_sid, vapi_assistant_id, status')
    .eq('id', phoneNumberId)
    .eq('tenant_id', tenantId)
    .single();

  if (!phoneRecord) {
    return { success: false, error: 'Número no encontrado' };
  }

  if (phoneRecord.status === 'released') {
    return { success: false, error: 'Este número ya fue liberado' };
  }

  // 2. Liberar en VAPI si tiene IDs
  if (phoneRecord.vapi_assistant_id && phoneRecord.provider_phone_sid) {
    console.log('[Voice Agent] Releasing from VAPI...');

    const releaseResult = await VAPIApiService.releasePhoneNumberForTenant(
      phoneRecord.vapi_assistant_id,
      phoneRecord.provider_phone_sid
    );

    if (!releaseResult.success) {
      console.error('[Voice Agent] VAPI release failed:', releaseResult.error);
      // Continuamos para marcar como liberado en BD de todas formas
    }
  }

  // 3. Marcar como liberado en Supabase
  const { error: updateError } = await supabase
    .from('voice_phone_numbers')
    .update({
      status: 'released',
      updated_at: new Date().toISOString(),
    })
    .eq('id', phoneNumberId);

  if (updateError) {
    console.error('[Voice Agent] Error updating database:', updateError);
    return { success: false, error: 'Error al liberar número' };
  }

  console.log('[Voice Agent] Phone number released successfully');
  return { success: true };
}

// =====================================================
// CALL MANAGEMENT
// =====================================================

/**
 * Obtener llamadas recientes
 */
export async function getRecentCalls(
  tenantId: string,
  limit: number = 20,
  offset: number = 0
): Promise<VoiceCall[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('voice_calls')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Voice Agent] Error fetching calls:', error);
    return [];
  }

  return data as VoiceCall[];
}

/**
 * Obtener detalle de una llamada
 */
export async function getCallDetails(
  callId: string,
  tenantId: string
): Promise<VoiceCall | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('voice_calls')
    .select('*')
    .eq('id', callId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    console.error('[Voice Agent] Error fetching call details:', error);
    return null;
  }

  return data as VoiceCall;
}

/**
 * Obtener mensajes de una llamada
 */
export async function getCallMessages(callId: string): Promise<Array<{
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sequence_number: number;
  created_at: string;
}>> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('voice_call_messages')
    .select('id, role, content, sequence_number, created_at')
    .eq('call_id', callId)
    .order('sequence_number', { ascending: true });

  if (error) {
    console.error('[Voice Agent] Error fetching call messages:', error);
    return [];
  }

  return data;
}

// =====================================================
// USAGE & ANALYTICS
// =====================================================

/**
 * Obtener resumen de uso
 */
export async function getUsageSummary(
  tenantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<VoiceUsageSummary> {
  const supabase = createServerClient();

  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 días atrás
  const end = endDate || new Date();

  // Obtener llamadas del periodo
  const { data: calls } = await supabase
    .from('voice_calls')
    .select('duration_seconds, outcome, escalated, cost_usd, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (!calls || calls.length === 0) {
    return {
      total_calls: 0,
      total_minutes: 0,
      total_cost_usd: 0,
      avg_call_duration_seconds: 0,
      appointment_booking_rate: 0,
      escalation_rate: 0,
      by_day: [],
    };
  }

  const totalCalls = calls.length;
  const totalSeconds = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
  const totalCost = calls.reduce((sum, c) => sum + (c.cost_usd || 0), 0);
  const appointmentsBooked = calls.filter((c) => c.outcome === 'appointment_booked').length;
  const escalated = calls.filter((c) => c.escalated).length;

  // Agrupar por día
  const byDayMap = new Map<string, { calls: number; minutes: number; cost_usd: number }>();
  for (const call of calls) {
    const date = call.created_at.split('T')[0];
    const existing = byDayMap.get(date) || { calls: 0, minutes: 0, cost_usd: 0 };
    byDayMap.set(date, {
      calls: existing.calls + 1,
      minutes: existing.minutes + Math.ceil((call.duration_seconds || 0) / 60),
      cost_usd: existing.cost_usd + (call.cost_usd || 0),
    });
  }

  const byDay = Array.from(byDayMap.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    total_calls: totalCalls,
    total_minutes: Math.ceil(totalSeconds / 60),
    total_cost_usd: Number(totalCost.toFixed(2)),
    avg_call_duration_seconds: Math.round(totalSeconds / totalCalls),
    appointment_booking_rate: Number(((appointmentsBooked / totalCalls) * 100).toFixed(1)),
    escalation_rate: Number(((escalated / totalCalls) * 100).toFixed(1)),
    by_day: byDay,
  };
}

// =====================================================
// VAPI INTEGRATION - Server-Side Response Mode
// =====================================================

/**
 * Generar configuración para VAPI en Server-Side Response Mode
 *
 * IMPORTANTE: NO incluimos "model" - TIS TIS LangGraph genera las respuestas
 * VAPI solo hace STT (transcripción) y TTS (síntesis de voz)
 */
export function generateVAPIConfig(config: VoiceAgentConfig): VAPIAssistantConfig {
  const serverUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/voice-agent/webhook`
    : '/api/voice-agent/webhook';

  return {
    name: config.assistant_name,
    firstMessage: config.first_message,
    firstMessageMode:
      config.first_message_mode === 'assistant_speaks_first'
        ? 'assistant-speaks-first'
        : 'assistant-waits-for-user',

    // ═══════════════════════════════════════════════════════════════
    // SERVER-SIDE RESPONSE MODE: NO incluimos "model"
    // VAPI envía cada turno a serverUrl y retornamos assistantResponse
    // ═══════════════════════════════════════════════════════════════

    voice: {
      voiceId: config.voice_id || 'LegCbmbXKbT5PUp3QFWv',
      provider: config.voice_provider || 'elevenlabs',
      model: config.voice_model || 'eleven_multilingual_v2',
      stability: config.voice_stability ?? 0.5,
      similarityBoost: config.voice_similarity_boost ?? 0.75,
    },
    transcriber: {
      model: config.transcription_model || 'nova-2',
      language: config.transcription_language || 'es',
      provider: config.transcription_provider || 'deepgram',
    },
    startSpeakingPlan: {
      waitSeconds: config.wait_seconds ?? 0.6,
      onPunctuationSeconds: config.on_punctuation_seconds ?? 0.2,
      onNoPunctuationSeconds: config.on_no_punctuation_seconds ?? 1.2,
    },
    endCallPhrases: config.end_call_phrases || [
      'adiós',
      'hasta luego',
      'bye',
      'chao',
      'eso es todo',
    ],
    recordingEnabled: config.recording_enabled ?? true,
    hipaaEnabled: config.hipaa_enabled ?? false,

    // Server URL para recibir conversation-update
    serverUrl,
    serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET,
  };
}

// =====================================================
// PLAN CHECK
// =====================================================

/**
 * Verificar si el tenant tiene acceso a Voice Agent
 */
export async function canAccessVoiceAgent(tenantId: string): Promise<{
  canAccess: boolean;
  reason?: string;
  plan: string;
}> {
  const supabase = createServerClient();

  console.log('[VoiceAgentService] canAccessVoiceAgent - tenantId:', tenantId);

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('plan, status')
    .eq('id', tenantId)
    .single();

  console.log('[VoiceAgentService] Tenant query result:', JSON.stringify({ tenant, error }));

  if (!tenant) {
    return { canAccess: false, reason: 'Tenant no encontrado', plan: 'unknown' };
  }

  console.log('[VoiceAgentService] Tenant plan:', tenant.plan, 'status:', tenant.status);

  if (tenant.status !== 'active') {
    return { canAccess: false, reason: 'Cuenta no activa', plan: tenant.plan };
  }

  // Solo Growth tiene acceso
  if (tenant.plan !== 'growth') {
    console.log('[VoiceAgentService] Plan is NOT growth, blocking access');
    return {
      canAccess: false,
      reason: 'Voice Agent solo está disponible en el plan Growth',
      plan: tenant.plan,
    };
  }

  console.log('[VoiceAgentService] Access granted - plan is growth');
  return { canAccess: true, plan: tenant.plan };
}

// =====================================================
// EXPORTS
// =====================================================

export const VoiceAgentService = {
  // Config
  getOrCreateVoiceConfig,
  updateVoiceConfig,
  toggleVoiceAgent,

  // Prompt
  generatePrompt,
  getVoiceAgentContext,

  // Phone Numbers
  getPhoneNumbers,
  requestPhoneNumber,
  releasePhoneNumber,
  checkPhoneNumberLimit,

  // Calls
  getRecentCalls,
  getCallDetails,
  getCallMessages,

  // Usage
  getUsageSummary,

  // VAPI
  generateVAPIConfig,

  // Access
  canAccessVoiceAgent,
};

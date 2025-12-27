// =====================================================
// TIS TIS PLATFORM - Voice Agent Service
// Servicio principal para gestión de Voice Agent
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
 */
export async function getOrCreateVoiceConfig(tenantId: string): Promise<VoiceAgentConfig | null> {
  const supabase = createServerClient();

  // Intentar obtener config existente
  const { data: existing } = await supabase
    .from('voice_agent_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (existing) {
    return existing as VoiceAgentConfig;
  }

  // Crear config inicial
  const { data: newConfig, error } = await supabase
    .from('voice_agent_config')
    .insert({
      tenant_id: tenantId,
      voice_enabled: false,
      voice_status: 'inactive',
    })
    .select()
    .single();

  if (error) {
    console.error('[Voice Agent] Error creating config:', error);
    return null;
  }

  return newConfig as VoiceAgentConfig;
}

/**
 * Actualizar configuración de Voice Agent
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

  // Primero obtenemos la versión actual para incrementarla
  const { data: currentConfig, error: versionError } = await supabase
    .from('voice_agent_config')
    .select('configuration_version')
    .eq('tenant_id', tenantId)
    .single();

  if (versionError) {
    console.error('[Voice Agent Service] Error getting version:', versionError);
  }

  const nextVersion = (currentConfig?.configuration_version || 0) + 1;

  const updatePayload = {
    ...updates,
    last_configured_at: new Date().toISOString(),
    last_configured_by: staffId || null,
    configuration_version: nextVersion,
  };

  console.log('[Voice Agent Service] Update payload:', updatePayload);

  const { data, error } = await supabase
    .from('voice_agent_config')
    .update(updatePayload)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    console.error('[Voice Agent Service] Error updating config:', error);
    return null;
  }

  console.log('[Voice Agent Service] Update successful, custom_instructions:', data?.custom_instructions?.substring(0, 100));

  return data as VoiceAgentConfig;
}

/**
 * Activar/Desactivar Voice Agent
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
    .from('voice_agent_config')
    .update({
      voice_enabled: enabled,
      voice_status: enabled ? 'active' : 'inactive',
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

  // Guardar prompt generado en config
  if (data) {
    await supabase
      .from('voice_agent_config')
      .update({
        system_prompt: data,
        system_prompt_generated_at: new Date().toISOString(),
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
 * Obtener números de teléfono del tenant
 */
export async function getPhoneNumbers(tenantId: string): Promise<VoicePhoneNumber[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('voice_phone_numbers')
    .select('*')
    .eq('tenant_id', tenantId)
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

  // 2. Obtener configuración de voz del tenant
  const { data: voiceConfig } = await supabase
    .from('voice_agent_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (!voiceConfig) {
    return {
      success: false,
      error: 'Primero debes configurar tu asistente de voz',
    };
  }

  // 3. Construir webhook URL
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

  // 4. Provisionar con VAPI API (asistente + número)
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

  // 5. Guardar en Supabase con IDs de VAPI
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

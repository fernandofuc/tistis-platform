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
 */
export async function requestPhoneNumber(
  tenantId: string,
  areaCode: string,
  branchId?: string
): Promise<{ success: boolean; phoneNumber?: VoicePhoneNumber; error?: string }> {
  const supabase = createServerClient();

  // Verificar plan del tenant (solo Growth+)
  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single();

  if (!tenant || tenant.plan !== 'growth') {
    return {
      success: false,
      error: 'Voice Agent solo está disponible en el plan Growth',
    };
  }

  // Obtener voice_agent_config_id
  const { data: config } = await supabase
    .from('voice_agent_config')
    .select('id')
    .eq('tenant_id', tenantId)
    .single();

  // Crear registro pendiente
  const { data: phoneNumber, error } = await supabase
    .from('voice_phone_numbers')
    .insert({
      tenant_id: tenantId,
      voice_agent_config_id: config?.id,
      branch_id: branchId || null,
      phone_number: `pending_${Date.now()}`, // Temporal hasta provisioning
      area_code: areaCode,
      country_code: '+52',
      telephony_provider: 'twilio',
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[Voice Agent] Error creating phone number request:', error);
    return { success: false, error: error.message };
  }

  // TODO: Disparar job para provisionar número con Twilio
  // await queuePhoneNumberProvisioning(phoneNumber.id, areaCode);

  return { success: true, phoneNumber: phoneNumber as VoicePhoneNumber };
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
// VAPI INTEGRATION
// =====================================================

/**
 * Generar configuración para VAPI
 */
export function generateVAPIConfig(config: VoiceAgentConfig): VAPIAssistantConfig {
  return {
    name: config.assistant_name,
    firstMessage: config.first_message,
    firstMessageMode:
      config.first_message_mode === 'assistant_speaks_first'
        ? 'assistant-speaks-first'
        : 'assistant-waits-for-user',
    model: {
      model: config.ai_model,
      provider: config.ai_model.startsWith('gpt') ? 'openai' : 'anthropic',
      temperature: config.ai_temperature,
      maxTokens: config.ai_max_tokens,
      messages: [
        {
          role: 'system',
          content: config.system_prompt || '',
        },
      ],
    },
    voice: {
      voiceId: config.voice_id,
      provider: '11labs',
      model: config.voice_model,
      stability: config.voice_stability,
      similarityBoost: config.voice_similarity_boost,
    },
    transcriber: {
      model: config.transcription_model,
      language: config.transcription_language,
      provider: config.transcription_provider,
    },
    startSpeakingPlan: {
      waitSeconds: config.wait_seconds,
      onPunctuationSeconds: config.on_punctuation_seconds,
      onNoPunctuationSeconds: config.on_no_punctuation_seconds,
    },
    endCallPhrases: config.end_call_phrases,
    recordingEnabled: config.recording_enabled,
    hipaaEnabled: config.hipaa_enabled,
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

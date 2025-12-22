// =====================================================
// TIS TIS PLATFORM - LangGraph AI Service
// Servicio que integra LangGraph con el sistema existente
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import {
  executeGraph,
  type GraphExecutionInput,
  type GraphExecutionResult,
} from '../graph';
import type {
  TenantInfo,
  LeadInfo,
  ConversationInfo,
  BusinessContext,
} from '../state';
import type { AIProcessingResult } from './ai.service';
import type { AISignal } from '@/src/shared/types/whatsapp';
import { MessageLearningService } from './message-learning.service';

// ======================
// LEARNING INTEGRATION
// ======================

/**
 * Genera un UUID v4 usando crypto
 */
function generateUUID(): string {
  // Usar crypto.randomUUID si está disponible (Node.js 19+, navegadores modernos)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para entornos sin crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Encola un mensaje para procesamiento de aprendizaje
 * Se ejecuta en background para no bloquear la respuesta
 */
async function queueForLearning(
  tenantId: string,
  conversationId: string,
  message: string,
  intent: string,
  signals: AISignal[],
  aiResponse: string,
  leadId?: string
): Promise<void> {
  // Generar un UUID válido para el mensaje
  const messageId = generateUUID();

  await MessageLearningService.queueMessageForLearning(
    tenantId,
    conversationId,
    messageId,
    message,
    'lead', // El mensaje del cliente
    {
      leadId,
      detectedIntent: intent,
      detectedSignals: { signals },
      aiResponse,
    }
  );
}

// ======================
// CONTEXT LOADERS
// ======================

/**
 * Carga el contexto completo del tenant para el grafo
 */
async function loadTenantContext(tenantId: string): Promise<TenantInfo | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('get_tenant_ai_context', {
    p_tenant_id: tenantId,
  });

  if (error || !data) {
    console.error('[LangGraph AI] Error loading tenant context:', error);
    return null;
  }

  // Mapear al formato del estado
  return {
    tenant_id: data.tenant_id,
    tenant_name: data.tenant_name,
    vertical: data.vertical || 'general',
    timezone: data.timezone || 'America/Mexico_City',
    ai_config: {
      system_prompt: data.ai_config?.system_prompt || '',
      model: data.ai_config?.model || 'gpt-5-mini',
      temperature: data.ai_config?.temperature || 0.7,
      response_style: data.ai_config?.response_style || 'professional',
      max_response_length: data.ai_config?.max_response_length || 300,
      enable_scoring: data.ai_config?.enable_scoring ?? true,
      auto_escalate_keywords: data.ai_config?.auto_escalate_keywords || [],
      business_hours: data.ai_config?.business_hours || {
        start: '09:00',
        end: '18:00',
        days: [1, 2, 3, 4, 5],
      },
    },
  };
}

/**
 * Carga el contexto del lead para el grafo
 */
async function loadLeadContext(leadId: string): Promise<LeadInfo | null> {
  const supabase = createServerClient();

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (error || !lead) {
    console.error('[LangGraph AI] Error loading lead context:', error);
    return null;
  }

  return {
    lead_id: lead.id,
    name: lead.name || 'Cliente',
    phone: lead.phone || '',
    email: lead.email,
    score: lead.score || 50,
    classification: lead.classification || 'warm',
    preferred_contact_method: lead.preferred_contact_method,
    preferred_branch_id: lead.preferred_branch_id,
    preferred_staff_id: lead.preferred_staff_id,
    notes: lead.notes,
    tags: lead.tags,
  };
}

/**
 * Carga el contexto de la conversación para el grafo
 */
async function loadConversationContext(
  conversationId: string
): Promise<ConversationInfo | null> {
  const supabase = createServerClient();

  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error || !conversation) {
    console.error('[LangGraph AI] Error loading conversation context:', error);
    return null;
  }

  // Contar mensajes
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId);

  return {
    conversation_id: conversation.id,
    channel: conversation.channel || 'whatsapp',
    status: conversation.status || 'active',
    ai_handling: conversation.ai_handling ?? true,
    message_count: count || 0,
    started_at: conversation.created_at,
    last_message_at: conversation.last_message_at || conversation.created_at,
  };
}

/**
 * Carga el contexto COMPLETO del negocio desde el RPC get_tenant_ai_context
 * Incluye: servicios, sucursales, FAQs, Knowledge Base, políticas, competencia, etc.
 *
 * IMPORTANTE: Usa el RPC que ya tiene toda la lógica de carga optimizada
 */
async function loadBusinessContext(tenantId: string): Promise<BusinessContext | null> {
  const supabase = createServerClient();

  // Usar el RPC que ya trae TODO el contexto en una sola llamada
  const { data, error } = await supabase.rpc('get_tenant_ai_context', {
    p_tenant_id: tenantId,
  });

  if (error || !data) {
    console.error('[LangGraph AI] Error loading business context via RPC:', error);
    return null;
  }

  // Mapear datos del RPC al formato BusinessContext
  return {
    // =====================================================
    // DATOS BÁSICOS
    // =====================================================
    services: (data.services || []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      name: s.name as string,
      description: (s.description as string) || '',
      ai_description: s.ai_description as string | undefined,
      price_min: (s.price_min as number) || 0,
      price_max: (s.price_max as number) || (s.price_min as number) || 0,
      price_note: s.price_note as string | undefined,
      duration_minutes: (s.duration_minutes as number) || 60,
      category: (s.category as string) || 'general',
      special_instructions: s.special_instructions as string | undefined,
      requires_consultation: s.requires_consultation as boolean | undefined,
      promotion_active: s.promotion_active as boolean | undefined,
      promotion_text: s.promotion_text as string | undefined,
    })),
    branches: (data.branches || []).map((b: Record<string, unknown>) => ({
      id: b.id as string,
      name: b.name as string,
      address: (b.address as string) || '',
      city: (b.city as string) || '',
      phone: (b.phone as string) || '',
      whatsapp_number: (b.whatsapp_number as string) || (b.phone as string) || '',
      google_maps_url: (b.google_maps_url as string) || '',
      is_headquarters: (b.is_headquarters as boolean) ?? false,
      operating_hours: (b.operating_hours as Record<string, { open: string; close: string }>) || {},
    })),
    staff: (data.doctors || []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      name: (s.name as string) || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Staff',
      role_title: (s.role_title as string) || (s.role as string) || 'Staff',
      specialty: s.specialty as string | undefined,
      branch_ids: (s.branch_ids as string[]) || [],
      bio: s.bio as string | undefined,
    })),
    faqs: (data.faqs || []).map((f: Record<string, unknown>) => ({
      question: f.question as string,
      answer: f.answer as string,
      category: (f.category as string) || 'general',
    })),
    scoring_rules: (data.scoring_rules || []).map((r: Record<string, unknown>) => ({
      signal_name: r.signal_name as string,
      points: r.points as number,
      keywords: (r.keywords as string[]) || [],
      category: (r.category as string) || 'general',
    })),

    // =====================================================
    // KNOWLEDGE BASE - Datos personalizados del cliente
    // =====================================================
    custom_instructions: (data.custom_instructions || []).map((ci: Record<string, unknown>) => ({
      type: ci.type as string,
      title: ci.title as string,
      instruction: ci.instruction as string,
      examples: ci.examples as string | undefined,
      branch_id: ci.branch_id as string | undefined,
    })),
    business_policies: (data.business_policies || []).map((bp: Record<string, unknown>) => ({
      type: bp.type as string,
      title: bp.title as string,
      policy: bp.policy as string,
      short_version: bp.short_version as string | undefined,
    })),
    knowledge_articles: (data.knowledge_articles || []).map((ka: Record<string, unknown>) => ({
      category: ka.category as string,
      title: ka.title as string,
      content: ka.content as string,
      summary: ka.summary as string | undefined,
      branch_id: ka.branch_id as string | undefined,
    })),
    response_templates: (data.response_templates || []).map((rt: Record<string, unknown>) => ({
      trigger: rt.trigger as string,
      name: rt.name as string,
      template: rt.template as string,
      variables: rt.variables as string[] | undefined,
      branch_id: rt.branch_id as string | undefined,
    })),
    competitor_handling: (data.competitor_handling || []).map((ch: Record<string, unknown>) => ({
      competitor: ch.competitor as string,
      aliases: ch.aliases as string[] | undefined,
      strategy: ch.strategy as string,
      talking_points: ch.talking_points as string[] | undefined,
      avoid_saying: ch.avoid_saying as string[] | undefined,
    })),
  };
}

// ======================
// MAIN SERVICE FUNCTION
// ======================

/**
 * Genera una respuesta AI usando el grafo LangGraph
 *
 * Esta función reemplaza a generateAIResponse() del ai.service.ts original.
 * Mantiene la misma interfaz de salida para compatibilidad.
 */
export async function generateAIResponseWithGraph(
  tenantId: string,
  conversationId: string,
  currentMessage: string,
  leadId?: string
): Promise<AIProcessingResult> {
  const startTime = Date.now();

  console.log(`[LangGraph AI] Processing message for tenant ${tenantId}`);

  try {
    // 1. Cargar todos los contextos en paralelo
    const [tenantContext, leadContext, conversationContext, businessContext] = await Promise.all([
      loadTenantContext(tenantId),
      leadId ? loadLeadContext(leadId) : Promise.resolve(null),
      loadConversationContext(conversationId),
      loadBusinessContext(tenantId),
    ]);

    if (!tenantContext) {
      throw new Error('Could not load tenant context');
    }

    // 2. Preparar input para el grafo
    const graphInput: GraphExecutionInput = {
      tenant_id: tenantId,
      conversation_id: conversationId,
      lead_id: leadId || '',
      current_message: currentMessage,
      channel: conversationContext?.channel || 'whatsapp',
      tenant_context: tenantContext,
      lead_context: leadContext,
      conversation_context: conversationContext,
      business_context: businessContext,
    };

    // 3. Ejecutar el grafo
    const result = await executeGraph(graphInput);

    // 4. Convertir resultado al formato AIProcessingResult
    const processingTime = Date.now() - startTime;

    console.log(`[LangGraph AI] Completed in ${processingTime}ms. Agents: ${result.agents_used.join(' -> ')}`);

    // 5. Encolar mensaje para aprendizaje (en background, no bloquea)
    queueForLearning(
      tenantId,
      conversationId,
      currentMessage,
      result.intent,
      result.signals,
      result.response,
      leadId
    ).catch(err => {
      console.error('[LangGraph AI] Error queuing for learning:', err);
    });

    return {
      response: result.response,
      intent: result.intent as AIProcessingResult['intent'],
      signals: result.signals,
      score_change: result.score_change,
      escalate: result.escalated,
      escalate_reason: result.escalation_reason,
      tokens_used: result.tokens_used,
      model_used: 'langgraph-gpt-5-mini',
      processing_time_ms: processingTime,
      appointment_created: result.booking_result?.success
        ? {
            appointment_id: result.booking_result.appointment_id!,
            scheduled_at: result.booking_result.scheduled_at!,
            branch_name: result.booking_result.branch_name!,
            service_name: result.booking_result.service_name,
            staff_name: result.booking_result.staff_name,
          }
        : undefined,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[LangGraph AI] Error:', error);

    return {
      response: 'Disculpa, estoy experimentando dificultades técnicas. Un asesor te atenderá pronto.',
      intent: 'UNKNOWN',
      signals: [],
      score_change: 0,
      escalate: true,
      escalate_reason: error instanceof Error ? error.message : 'Unknown error',
      tokens_used: 0,
      model_used: 'langgraph-error',
      processing_time_ms: processingTime,
    };
  }
}

// ======================
// FEATURE FLAG
// ======================

/**
 * Determina si usar el nuevo sistema LangGraph o el legacy
 *
 * Prioridad de decisión:
 * 1. Variable de entorno USE_LANGGRAPH (override global)
 * 2. Configuración del tenant en ai_tenant_config.use_langgraph
 * 3. Default: false (usar sistema legacy)
 */
export async function shouldUseLangGraph(tenantId: string): Promise<boolean> {
  // Feature flag global (override)
  if (process.env.USE_LANGGRAPH === 'true') {
    return true;
  }

  if (process.env.USE_LANGGRAPH === 'false') {
    return false;
  }

  // Verificar configuración del tenant en ai_tenant_config
  const supabase = createServerClient();
  const { data: config } = await supabase
    .from('ai_tenant_config')
    .select('use_langgraph')
    .eq('tenant_id', tenantId)
    .single();

  if (config?.use_langgraph === true) {
    return true;
  }

  // Por defecto, usar legacy mientras se hace rollout gradual
  return false;
}

/**
 * Wrapper que decide qué sistema usar
 */
export async function generateAIResponseSmart(
  tenantId: string,
  conversationId: string,
  currentMessage: string,
  leadId?: string
): Promise<AIProcessingResult> {
  const useLangGraph = await shouldUseLangGraph(tenantId);

  if (useLangGraph) {
    console.log('[AI Router] Using LangGraph system');
    return generateAIResponseWithGraph(tenantId, conversationId, currentMessage, leadId);
  } else {
    console.log('[AI Router] Using legacy AI system');
    // Importar dinámicamente para evitar dependencia circular
    const { generateAIResponse } = await import('./ai.service');
    return generateAIResponse(tenantId, conversationId, currentMessage);
  }
}

// ======================
// EXPORTS
// ======================

export const LangGraphAIService = {
  generateResponse: generateAIResponseWithGraph,
  generateSmart: generateAIResponseSmart,
  shouldUseLangGraph,
  loadTenantContext,
  loadLeadContext,
  loadConversationContext,
  loadBusinessContext,
};

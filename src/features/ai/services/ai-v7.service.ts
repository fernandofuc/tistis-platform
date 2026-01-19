// =====================================================
// TIS TIS PLATFORM - AI V7 Unified Service
// Servicio unificado para Preview y Producción
// =====================================================
// ARQUITECTURA V7:
// - Una sola función principal (generateAIResponseV7)
// - Mismo código path para Preview y Producción
// - LangGraph como sistema principal
// - Legacy solo como fallback de emergencia
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import {
  executeGraph,
  resumeConversation,
  hasResumableCheckpoint,
  type GraphExecutionInput,
  type GraphExecutionResult,
} from '../graph';
// MEJORA-2.1: Inicialización del servicio de checkpoints
import { getCheckpointService, shutdownCheckpointService } from './checkpoint.service';
import type {
  TenantInfo,
  LeadInfo,
  ConversationInfo,
  BusinessContext,
} from '../state';
import type { AISignal } from '@/src/shared/types/whatsapp';
import { MessageLearningService } from './message-learning.service';
import {
  getOptimizedPrompt,
  generateMinimalPrompt,
  generateAndCacheMinimalPrompt,
  type CacheChannel,
  type BusinessContext as PromptBusinessContext,
  type PromptType,
} from './prompt-generator.service';
import { PromptSanitizer } from './prompt-sanitizer.service';
import { getProfileForAI } from './agent-profile.service';
import type { ProfileType } from '@/src/shared/config/agent-templates';
// MEJORA-1.1: PII Detection Service
import { getPIIDetectionService, type PIIDetectionResult } from '@/src/shared/lib/pii-detection.service';
// MEJORA-1.2: LLM Output Sanitizer
import { createSanitizerForTenant, type BusinessContext as SanitizerBusinessContext } from '@/src/shared/lib/llm-output-sanitizer.service';
// MEJORA-1.3: Redis Rate Limiter distribuido
import { getRedisRateLimiter } from '@/src/shared/lib/redis-rate-limiter';
// MEJORA-2.4: Dead Letter Queue para mensajes fallidos
import { getDLQService, type ProcessingStage } from '@/src/shared/services/dead-letter-queue.service';

// ======================
// TYPES V7
// ======================

/**
 * Opciones para la generación de respuesta V7
 */
export interface AIResponseV7Options {
  /** ID de conversación (null/undefined para preview) */
  conversationId?: string;

  /** ID del lead (null/undefined para preview) */
  leadId?: string;

  /** Canal de comunicación */
  channel: CacheChannel;

  /** Tipo de perfil del agente */
  profileType: ProfileType;

  /** Historial de conversación para multi-turn */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;

  /** Si es modo preview (no guarda en DB, no envía mensajes) */
  isPreview: boolean;
}

/**
 * Resultado unificado de la generación V7
 */
export interface AIResponseV7Result {
  success: boolean;
  response: string;
  intent: string;
  signals: AISignal[];
  score_change: number;
  agents_used: string[];
  processing_time_ms: number;
  tokens_used: number;
  model_used: string;
  escalated: boolean;
  escalation_reason?: string;
  booking_result?: GraphExecutionResult['booking_result'];
  profile_config: {
    profile_type: ProfileType;
    response_style: string;
    template_key: string;
    delay_minutes: number;
    delay_first_only: boolean;
  };
  prompt_source?: string;
  error?: string;
}

// ======================
// LEARNING + LOYALTY CONTEXT TYPES
// ======================

interface LearningContextData {
  topServiceRequests: Array<{ service: string; frequency: number }>;
  commonObjections: Array<{ objection: string; frequency: number }>;
  schedulingPreferences: Array<{ preference: string; frequency: number }>;
  painPoints: Array<{ pain: string; frequency: number }>;
  learnedVocabulary: Array<{ term: string; meaning: string; category: string }>;
}

interface LoyaltyContextData {
  program: {
    id: string;
    name: string;
    tokens_name: string;
    tokens_enabled: boolean;
    tokens_per_currency: number;
    tokens_currency_threshold: number;
    membership_enabled: boolean;
  } | null;
  lead_status: {
    token_balance: number;
    total_earned: number;
    total_redeemed: number;
    tier: string | null;
    membership_id: string | null;
    membership_plan: string | null;
    membership_status: string | null;
    membership_end_date: string | null;
  } | null;
  available_rewards: Array<{
    id: string;
    name: string;
    tokens_required: number;
    category: string;
  }>;
}

// ======================
// CONTEXT LOADERS (Reutilizados de langgraph-ai.service.ts)
// ======================

async function loadLearningContext(tenantId: string): Promise<LearningContextData | null> {
  try {
    const learningContext = await MessageLearningService.getLearningContext(tenantId);
    if (!learningContext) return null;

    console.log(`[AI V7] Learning context loaded: ${learningContext.topServiceRequests.length} patterns`);
    return learningContext;
  } catch (err) {
    console.log('[AI V7] Learning context not available:', err instanceof Error ? err.message : 'Unknown');
    return null;
  }
}

async function loadLoyaltyContext(tenantId: string, leadId?: string): Promise<LoyaltyContextData | null> {
  const supabase = createServerClient();

  try {
    const { data: program } = await supabase
      .from('loyalty_programs')
      .select('id, program_name, is_active, tokens_enabled, tokens_name, tokens_per_currency, tokens_currency_threshold, membership_enabled')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (!program?.is_active) return null;

    let leadStatus: LoyaltyContextData['lead_status'] = null;
    let availableRewards: LoyaltyContextData['available_rewards'] = [];

    if (leadId) {
      const [balanceResult, membershipResult, rewardsResult] = await Promise.all([
        supabase.from('loyalty_balances').select('current_balance, total_earned, total_spent')
          .eq('program_id', program.id).eq('lead_id', leadId).maybeSingle(),
        supabase.from('loyalty_memberships')
          .select('id, status, end_date, plan:loyalty_membership_plans(name, tier_level)')
          .eq('program_id', program.id).eq('lead_id', leadId).eq('status', 'active').maybeSingle(),
        supabase.from('loyalty_rewards').select('id, name, tokens_required, category')
          .eq('program_id', program.id).eq('is_active', true).order('tokens_required').limit(10),
      ]);

      const balance = balanceResult.data;
      const membership = membershipResult.data as {
        id: string; status: string; end_date: string | null;
        plan: { name: string; tier_level: string } | null;
      } | null;

      leadStatus = {
        token_balance: balance?.current_balance || 0,
        total_earned: balance?.total_earned || 0,
        total_redeemed: balance?.total_spent || 0,
        tier: membership?.plan?.tier_level || null,
        membership_id: membership?.id || null,
        membership_plan: membership?.plan?.name || null,
        membership_status: membership?.status || null,
        membership_end_date: membership?.end_date || null,
      };

      availableRewards = (rewardsResult.data || []).filter(
        (r) => r.tokens_required <= (balance?.current_balance || 0)
      );
    }

    return {
      program: {
        id: program.id,
        name: program.program_name,
        tokens_name: program.tokens_name || 'puntos',
        tokens_enabled: program.tokens_enabled,
        tokens_per_currency: program.tokens_per_currency || 1,
        tokens_currency_threshold: program.tokens_currency_threshold || 1,
        membership_enabled: program.membership_enabled,
      },
      lead_status: leadStatus,
      available_rewards: availableRewards,
    };
  } catch (err) {
    console.log('[AI V7] Loyalty context not available:', err instanceof Error ? err.message : 'Unknown');
    return null;
  }
}

async function loadTenantContext(
  tenantId: string,
  channel: CacheChannel = 'whatsapp',
  profileType: ProfileType = 'business',
  useMinimalPrompt: boolean = false
): Promise<TenantInfo | null> {
  const supabase = createServerClient();

  console.log(`[AI V7] Loading tenant context for: ${tenantId}, channel: ${channel}, profile: ${profileType}`);

  const [rpcResult, agentProfile] = await Promise.all([
    supabase.rpc('get_tenant_ai_context', { p_tenant_id: tenantId }),
    getProfileForAI(tenantId, profileType),
  ]);

  const { data, error } = rpcResult;

  if (error) {
    console.error('[AI V7] RPC error loading tenant context:', {
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      tenantId,
    });
    return null;
  }

  if (!data) {
    // El RPC retornó null - el tenant no existe o no está activo
    console.error('[AI V7] Tenant context is null - tenant may not exist or status is not active:', { tenantId });

    // Verificar si el tenant existe para dar mejor diagnóstico
    const { data: tenantCheck, error: tenantCheckError } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('id', tenantId)
      .single();

    if (tenantCheckError) {
      console.error('[AI V7] Tenant lookup failed:', tenantCheckError.message);
    } else if (tenantCheck) {
      console.error('[AI V7] Tenant found but RPC returned null:', {
        tenantId: tenantCheck.id,
        tenantName: tenantCheck.name,
        tenantStatus: tenantCheck.status,
        hint: tenantCheck.status !== 'active' ? 'Tenant status is not active!' : 'Check ai_tenant_config table',
      });
    } else {
      console.error('[AI V7] Tenant does not exist in tenants table:', { tenantId });
    }

    return null;
  }

  const aiConfig = data.ai_config as Record<string, unknown> | undefined;

  let finalSystemPrompt: string;
  let promptSource: string;

  if (useMinimalPrompt) {
    try {
      const minimalResult = await generateAndCacheMinimalPrompt(tenantId, channel);

      if (minimalResult.success) {
        finalSystemPrompt = minimalResult.prompt;
        promptSource = 'minimal-v7-cached';
      } else {
        const promptType: PromptType = channel === 'voice' ? 'voice' : 'messaging';
        const businessContext: PromptBusinessContext = {
          tenantId: data.tenant_id,
          tenantName: data.tenant_name,
          vertical: data.vertical || 'general',
          assistantName: aiConfig?.assistant_name as string || 'el asistente',
          assistantPersonality: aiConfig?.response_style as string || 'professional_friendly',
          template_key: agentProfile?.template_key || 'general_full',
          useFillerPhrases: (aiConfig?.use_filler_phrases as boolean) ?? true,
          services: [],
          branches: [],
          staff: [],
          faqs: [],
          customInstructionsList: [],
          businessPolicies: [],
          knowledgeArticles: [],
          responseTemplates: [],
          competitorHandling: [],
        };
        const directResult = await generateMinimalPrompt(businessContext, promptType);
        finalSystemPrompt = directResult.prompt;
        promptSource = 'minimal-v7-direct';
      }
    } catch (minimalError) {
      console.error('[AI V7] Error with minimal prompt, falling back:', minimalError);
      const legacyResult = await getOptimizedPrompt(tenantId, channel);
      finalSystemPrompt = legacyResult.prompt || (aiConfig?.system_prompt as string) || '';
      promptSource = 'v7-fallback';
    }
  } else {
    const promptResult = await getOptimizedPrompt(tenantId, channel);
    finalSystemPrompt = promptResult.prompt || (aiConfig?.system_prompt as string) || '';
    promptSource = promptResult.fromCache ? `v7-cached-v${promptResult.version}` : 'v7-fresh';
  }

  let responseStyle = (aiConfig?.response_style as string) || 'professional';

  if (agentProfile) {
    responseStyle = agentProfile.response_style || responseStyle;

    if (agentProfile.custom_instructions) {
      finalSystemPrompt = `${finalSystemPrompt}\n\n## INSTRUCCIONES DEL PERFIL\n${agentProfile.custom_instructions}`;
    }
  }

  const validVerticals = ['dental', 'restaurant', 'clinic', 'gym', 'beauty', 'veterinary'] as const;
  const rawVertical = data.vertical || 'dental';
  const vertical = validVerticals.includes(rawVertical as typeof validVerticals[number])
    ? rawVertical as typeof validVerticals[number]
    : 'dental';

  return {
    tenant_id: data.tenant_id,
    tenant_name: data.tenant_name,
    vertical,
    timezone: data.timezone || 'America/Mexico_City',
    ai_config: {
      system_prompt: finalSystemPrompt,
      model: (aiConfig?.model as string) || 'gpt-5-mini',
      temperature: (aiConfig?.temperature as number) || 0.7,
      response_style: responseStyle as 'professional' | 'professional_friendly' | 'casual' | 'formal',
      max_response_length: (aiConfig?.max_response_length as number) || 300,
      enable_scoring: (aiConfig?.enable_scoring as boolean) ?? true,
      auto_escalate_keywords: (aiConfig?.auto_escalate_keywords as string[]) || [],
      // Configuración de escalación (desde ai_tenant_config y agent_profiles)
      max_turns_before_escalation: (aiConfig?.max_turns_before_escalation as number) || 10,
      escalate_on_hot_lead: (aiConfig?.escalate_on_hot_lead as boolean) ?? true,
      business_hours: (aiConfig?.business_hours as { start: string; end: string; days: number[] }) || {
        start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5],
      },
    },
    agent_profile: agentProfile ? {
      profile_id: agentProfile.profile?.id,
      profile_type: profileType,
      template_key: agentProfile.template_key,
      response_delay_minutes: agentProfile.delay_config.minutes,
      response_delay_first_only: agentProfile.delay_config.first_only,
      ai_learning_config: agentProfile.learning_config,
    } : undefined,
    prompt_source: promptSource,
  };
}

async function loadLeadContext(leadId: string): Promise<LeadInfo | null> {
  const supabase = createServerClient();

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .is('deleted_at', null)
    .single();

  if (error || !lead) return null;

  const leadName = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Cliente';

  return {
    lead_id: lead.id,
    name: leadName,
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

async function loadConversationContext(conversationId: string): Promise<ConversationInfo | null> {
  const supabase = createServerClient();

  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error || !conversation) return null;

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

async function loadBusinessContext(tenantId: string): Promise<BusinessContext | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('get_tenant_ai_context', { p_tenant_id: tenantId });

  if (error || !data) {
    console.error('[AI V7] Error loading business context:', error);
    return null;
  }

  return {
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
// ENRICHMENT BUILDERS
// ======================

function buildLearningEnrichment(learningContext: LearningContextData): string {
  const sections: string[] = ['## CONTEXTO APRENDIDO'];

  if (learningContext.topServiceRequests.length > 0) {
    const services = learningContext.topServiceRequests.slice(0, 5)
      .map(s => `- "${s.service}" (${s.frequency} veces)`).join('\n');
    sections.push(`\n### Servicios más solicitados:\n${services}`);
  }

  if (learningContext.commonObjections.length > 0) {
    const objections = learningContext.commonObjections.slice(0, 5)
      .map(o => `- "${o.objection}"`).join('\n');
    sections.push(`\n### Objeciones comunes:\n${objections}`);
  }

  if (learningContext.learnedVocabulary.length > 0) {
    const vocab = learningContext.learnedVocabulary.slice(0, 10)
      .map(v => `- "${v.term}" = ${v.meaning}`).join('\n');
    sections.push(`\n### Vocabulario del cliente:\n${vocab}`);
  }

  return sections.join('\n');
}

function buildLoyaltyEnrichment(loyaltyContext: LoyaltyContextData): string {
  if (!loyaltyContext.program) return '';

  const { program, lead_status, available_rewards } = loyaltyContext;
  const sections: string[] = [];

  sections.push(`## PROGRAMA DE LEALTAD: ${program.name}`);
  sections.push(`- Moneda: "${program.tokens_name}"`);
  sections.push(`- Acumulación: ${program.tokens_per_currency} ${program.tokens_name} por $${program.tokens_currency_threshold}`);

  if (lead_status) {
    sections.push(`\n### Balance del cliente: **${lead_status.token_balance} ${program.tokens_name}**`);
    if (lead_status.membership_plan) {
      sections.push(`- Membresía: ${lead_status.membership_plan}`);
    }
  }

  if (available_rewards.length > 0) {
    const rewards = available_rewards.slice(0, 5)
      .map(r => `- ${r.name}: ${r.tokens_required} ${program.tokens_name}`).join('\n');
    sections.push(`\n### Recompensas disponibles:\n${rewards}`);
  }

  return sections.join('\n');
}

// ======================
// HELPER FUNCTIONS
// ======================

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function queueForLearning(
  tenantId: string,
  conversationId: string,
  message: string,
  intent: string,
  signals: AISignal[],
  aiResponse: string,
  leadId?: string
): Promise<void> {
  const messageId = generateUUID();

  await MessageLearningService.queueMessageForLearning(
    tenantId,
    conversationId,
    messageId,
    message,
    'lead',
    {
      leadId,
      detectedIntent: intent,
      detectedSignals: { signals },
      aiResponse,
    }
  );
}

// MEJORA-1.1: Función para loguear detecciones de PII (compliance GDPR/HIPAA)
async function logPIIDetection(
  tenantId: string,
  conversationId: string | undefined,
  piiResult: PIIDetectionResult
): Promise<void> {
  try {
    const supabase = createServerClient();
    await supabase.from('ai_pii_detection_logs').insert({
      tenant_id: tenantId,
      conversation_id: conversationId || null,
      pii_types: piiResult.matches.map(m => m.type),
      detection_count: piiResult.matches.length,
      detection_time_ms: piiResult.detectionTimeMs,
      original_hash: piiResult.originalHash,
      detected_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AI V7] Error logging PII detection:', error);
  }
}

// ======================
// FEATURE FLAG CHECK
// ======================

/**
 * Verifica si el tenant debe usar V7 (arquitectura unificada)
 * Por ahora, retorna true si tiene LangGraph habilitado
 */
export async function shouldUseV7(tenantId: string): Promise<boolean> {
  // Environment override
  if (process.env.USE_V7_UNIFIED === 'true') return true;
  if (process.env.USE_V7_UNIFIED === 'false') return false;

  const supabase = createServerClient();

  // Verificar flag V7 específico (cuando exista)
  const { data: config } = await supabase
    .from('ai_tenant_config')
    .select('use_langgraph, use_v7_unified')
    .eq('tenant_id', tenantId)
    .single();

  // Si tiene V7 explícito, usar ese
  if (config?.use_v7_unified === true) return true;
  if (config?.use_v7_unified === false) return false;

  // Fallback a LangGraph flag (compatibilidad hacia atrás)
  return config?.use_langgraph === true;
}

/**
 * Verifica si usar prompt minimal
 */
async function shouldUseMinimalPrompt(tenantId: string): Promise<boolean> {
  if (process.env.USE_MINIMAL_PROMPT === 'true') return true;
  if (process.env.USE_MINIMAL_PROMPT === 'false') return false;

  const supabase = createServerClient();
  const { data: config } = await supabase
    .from('ai_tenant_config')
    .select('use_minimal_prompt_v6')
    .eq('tenant_id', tenantId)
    .single();

  return config?.use_minimal_prompt_v6 === true;
}

// ======================
// MAIN V7 FUNCTION
// ======================

/**
 * Función principal V7 - Unifica Preview y Producción
 *
 * Esta es la función canónica que debe usarse para TODAS las respuestas AI.
 * El parámetro `isPreview` determina si se guardan datos en DB o no.
 *
 * @param tenantId - ID del tenant
 * @param message - Mensaje del usuario
 * @param options - Opciones de configuración
 * @returns Resultado unificado con respuesta y metadata
 */
export async function generateAIResponseV7(
  tenantId: string,
  message: string,
  options: AIResponseV7Options
): Promise<AIResponseV7Result> {
  const startTime = Date.now();
  const {
    conversationId,
    leadId,
    channel,
    profileType,
    conversationHistory = [],
    isPreview,
  } = options;

  console.log(`[AI V7] ${isPreview ? 'PREVIEW' : 'PRODUCTION'} - Tenant: ${tenantId}, Profile: ${profileType}`);

  try {
    // MEJORA-1.3: Rate limiting distribuido con Redis
    const rateLimiter = getRedisRateLimiter('aiMessages');
    const rateLimitResult = await rateLimiter.check(tenantId);

    if (!rateLimitResult.allowed) {
      console.warn('[AI V7] Rate limit exceeded:', {
        tenantId,
        totalHits: rateLimitResult.totalHits,
        retryAfterMs: rateLimitResult.retryAfterMs,
      });

      return {
        success: false,
        response: 'Estamos recibiendo muchas solicitudes. Por favor, espera un momento antes de enviar otro mensaje.',
        intent: 'RATE_LIMITED',
        signals: [],
        score_change: 0,
        agents_used: [],
        processing_time_ms: Date.now() - startTime,
        tokens_used: 0,
        model_used: 'rate-limited',
        escalated: false,
        profile_config: {
          profile_type: profileType,
          response_style: 'professional_friendly',
          template_key: 'general_full',
          delay_minutes: 0,
          delay_first_only: true,
        },
        error: `Rate limit exceeded. Retry after ${Math.ceil(rateLimitResult.retryAfterMs / 1000)} seconds`,
      };
    }
    // MEJORA-1.3: FIN

    // 1. SANITIZACIÓN
    const sanitizationResult = PromptSanitizer.sanitizeUserPrompt(message);
    let sanitizedMessage = sanitizationResult.sanitized;

    if (sanitizationResult.wasModified) {
      console.warn(
        `[AI V7] Message sanitized. Risk: ${sanitizationResult.riskLevel}, ` +
        `Patterns: ${sanitizationResult.detectedPatterns.map(p => p.type).join(', ')}`
      );
    }

    // MEJORA-1.1: Detectar y enmascarar PII en mensaje del usuario
    const piiService = getPIIDetectionService();
    const piiResult = await piiService.detect(sanitizedMessage);

    if (piiResult.hasPII) {
      console.log('[AI V7] PII detected in user message:', {
        tenantId,
        conversationId,
        types: piiResult.matches.map(m => m.type),
        count: piiResult.matches.length,
        detectionTimeMs: piiResult.detectionTimeMs,
      });

      // Usar mensaje con PII enmascarado para el LLM
      sanitizedMessage = piiResult.sanitizedText;

      // Guardar log de detección para compliance (async, no bloquea)
      logPIIDetection(tenantId, conversationId, piiResult).catch(err => {
        console.error('[AI V7] Error in PII logging:', err);
      });
    }
    // MEJORA-1.1: FIN

    // 2. DETERMINAR SI USAR PROMPT MINIMAL
    const useMinimalPrompt = await shouldUseMinimalPrompt(tenantId);

    // 3. CARGAR CONTEXTOS EN PARALELO
    const contextPromises: Promise<unknown>[] = [
      loadTenantContext(tenantId, channel, profileType, useMinimalPrompt),
      loadBusinessContext(tenantId),
      loadLearningContext(tenantId),
      loadLoyaltyContext(tenantId, leadId),
    ];

    // Solo cargar contexto de conversación/lead si NO es preview
    if (!isPreview && conversationId) {
      contextPromises.push(loadConversationContext(conversationId));
    }
    if (!isPreview && leadId) {
      contextPromises.push(loadLeadContext(leadId));
    }

    const [tenantContext, businessContext, learningContext, loyaltyContext, conversationContext, leadContext] =
      await Promise.all(contextPromises) as [
        TenantInfo | null,
        BusinessContext | null,
        LearningContextData | null,
        LoyaltyContextData | null,
        ConversationInfo | null | undefined,
        LeadInfo | null | undefined
      ];

    if (!tenantContext) {
      throw new Error(`Could not load tenant context for preview. TenantId: ${tenantId}. Check server logs for details.`);
    }

    // 4. EXTRAER CONFIGURACIÓN DEL PERFIL
    const profileConfig = {
      profile_type: profileType,
      response_style: tenantContext.ai_config.response_style,
      template_key: tenantContext.agent_profile?.template_key || 'general_full',
      delay_minutes: tenantContext.agent_profile?.response_delay_minutes || 0,
      delay_first_only: tenantContext.agent_profile?.response_delay_first_only ?? true,
    };

    // 5. ENRIQUECER PROMPT CON CONTEXTO DE APRENDIZAJE
    if (learningContext && (
      learningContext.topServiceRequests.length > 0 ||
      learningContext.commonObjections.length > 0 ||
      learningContext.learnedVocabulary.length > 0
    )) {
      const learningEnrichment = buildLearningEnrichment(learningContext);
      tenantContext.ai_config.system_prompt = `${tenantContext.ai_config.system_prompt}\n\n${learningEnrichment}`;
    }

    // 6. ENRIQUECER CON CONTEXTO DE LEALTAD
    if (loyaltyContext?.program) {
      const loyaltyEnrichment = buildLoyaltyEnrichment(loyaltyContext);
      tenantContext.ai_config.system_prompt = `${tenantContext.ai_config.system_prompt}\n\n${loyaltyEnrichment}`;
    }

    // 7. CONSTRUIR CONTEXTO DE CONVERSACIÓN
    const effectiveConversationContext: ConversationInfo = conversationContext || {
      conversation_id: isPreview ? `preview-${tenantId}-${Date.now()}` : conversationId || '',
      channel: channel,
      status: 'active',
      ai_handling: true,
      message_count: conversationHistory.length + 1,
      started_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    };

    // 8. PREPARAR INPUT PARA EL GRAFO
    const graphInput: GraphExecutionInput = {
      tenant_id: tenantId,
      conversation_id: effectiveConversationContext.conversation_id,
      lead_id: leadId || '',
      current_message: sanitizedMessage,
      channel: channel as GraphExecutionInput['channel'],
      tenant_context: tenantContext,
      lead_context: (leadContext as LeadInfo) || null,
      conversation_context: effectiveConversationContext,
      business_context: businessContext,
      previous_messages: conversationHistory,
    };

    // MEJORA-2.1: Inicializar servicio de checkpoints (lazy, solo si DATABASE_URL está configurado)
    getCheckpointService().catch((err) => {
      console.warn('[AI V7] Checkpoint service not available:', err.message);
    });

    // 9. EJECUTAR EL GRAFO (con checkpointing habilitado)
    const result = await executeGraph(graphInput, {
      enableCheckpointing: !isPreview, // Solo checkpointing en producción
      resumeFromCheckpoint: false, // No resumir automáticamente en primera ejecución
    });

    // MEJORA-1.2: Sanitizar respuesta del LLM antes de enviarla
    // Construir dominios del tenant (nueva instancia por request para evitar contaminación)
    const tenantDomains: string[] = [];
    if (tenantContext.tenant_name) {
      tenantDomains.push(
        `${tenantContext.tenant_name.toLowerCase().replace(/\s+/g, '')}.com`,
        `${tenantContext.tenant_name.toLowerCase().replace(/\s+/g, '')}.mx`,
      );
    }

    // Construir contexto de negocio para validación de coherencia
    let sanitizerBusinessContext: SanitizerBusinessContext | undefined;
    if (businessContext && businessContext.services.length > 0) {
      sanitizerBusinessContext = {
        businessName: tenantContext.tenant_name,
        businessType: tenantContext.vertical,
        validServices: businessContext.services.map(s => s.name),
        validPrices: new Map(
          businessContext.services.map(s => [
            s.name,
            { min: s.price_min * 0.8, max: s.price_max * 1.2 }
          ])
        ),
        validLocations: businessContext.branches.map(b => b.address).filter(Boolean),
        validHours: '',
      };
    }

    // Crear sanitizer específico para este tenant (evita contaminación entre tenants)
    const outputSanitizer = createSanitizerForTenant(tenantDomains, sanitizerBusinessContext);

    const outputSanitizationResult = await outputSanitizer.sanitize(result.response, {
      userMessage: sanitizedMessage,
      businessContext: sanitizerBusinessContext,
    });

    // Log issues encontrados
    if (outputSanitizationResult.issues.length > 0) {
      console.log('[AI V7] Output sanitization issues:', {
        tenantId,
        conversationId,
        issueCount: outputSanitizationResult.issues.length,
        issues: outputSanitizationResult.issues.map((i: { type: string; severity: string }) => ({ type: i.type, severity: i.severity })),
        confidence: outputSanitizationResult.confidence,
      });
    }

    // Si la respuesta no es válida, usar fallback
    if (!outputSanitizationResult.isValid) {
      console.error('[AI V7] Invalid LLM response, using fallback:', {
        tenantId,
        conversationId,
        issues: outputSanitizationResult.issues,
      });

      const processingTime = Date.now() - startTime;
      return {
        success: false,
        response: 'Lo siento, no pude procesar tu solicitud correctamente. ¿Podrías reformular tu pregunta?',
        intent: result.intent || 'UNKNOWN',
        signals: [],
        score_change: 0,
        agents_used: result.agents_used,
        processing_time_ms: processingTime,
        tokens_used: result.tokens_used,
        model_used: 'langgraph-gpt-5-mini',
        escalated: true,
        escalation_reason: 'output_validation_failed',
        profile_config: profileConfig,
        prompt_source: tenantContext.prompt_source,
        error: 'Output validation failed',
      };
    }

    // Usar respuesta sanitizada
    const finalResponse = outputSanitizationResult.sanitizedText;
    // MEJORA-1.2: FIN

    const processingTime = Date.now() - startTime;

    console.log(`[AI V7] Completed in ${processingTime}ms. Agents: ${result.agents_used.join(' -> ')}`);

    // 10. POST-PROCESAMIENTO (solo si NO es preview)
    if (!isPreview && conversationId) {
      queueForLearning(
        tenantId,
        conversationId,
        message,
        result.intent,
        result.signals,
        result.response,
        leadId
      ).catch(err => {
        console.error('[AI V7] Error queuing for learning:', err);
      });
    }

    // 11. RETORNAR RESULTADO UNIFICADO
    return {
      success: result.success,
      response: finalResponse, // MEJORA-1.2: Usar respuesta sanitizada
      intent: result.intent,
      signals: result.signals,
      score_change: result.score_change,
      agents_used: result.agents_used,
      processing_time_ms: processingTime,
      tokens_used: result.tokens_used,
      model_used: 'langgraph-gpt-5-mini',
      escalated: result.escalated,
      escalation_reason: result.escalation_reason,
      booking_result: result.booking_result,
      profile_config: profileConfig,
      prompt_source: tenantContext.prompt_source,
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI V7] Error:', error);

    // MEJORA-2.1: Intentar recuperar desde checkpoint si fue timeout
    if (
      !isPreview &&
      conversationId &&
      (errorMessage.includes('timeout') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ECONNRESET'))
    ) {
      console.log('[AI V7] Timeout detected, attempting checkpoint recovery...');

      try {
        // Verificar si hay un checkpoint recuperable
        const hasCheckpoint = await hasResumableCheckpoint(conversationId);

        if (hasCheckpoint) {
          // Intentar resumir desde checkpoint
          // Nota: resumeConversation cargará los contextos desde el checkpoint,
          // pero necesitamos proveer valores mínimos para satisfacer los tipos
          const minimalConversationContext: ConversationInfo = {
            conversation_id: conversationId,
            channel: channel,
            status: 'active',
            ai_handling: true,
            message_count: 0,
            started_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
          };

          const resumedResult = await resumeConversation({
            tenant_id: tenantId,
            conversation_id: conversationId,
            lead_id: leadId || '',
            current_message: message,
            channel: channel as GraphExecutionInput['channel'],
            // Los contextos se recuperarán del checkpoint, estos son fallbacks mínimos
            tenant_context: undefined as unknown as TenantInfo, // Will be loaded from checkpoint
            lead_context: null,
            conversation_context: minimalConversationContext,
            business_context: null,
          });

          if (resumedResult && resumedResult.success) {
            console.log('[AI V7] Successfully recovered from checkpoint');
            return {
              success: true,
              response: resumedResult.response,
              intent: resumedResult.intent,
              signals: resumedResult.signals,
              score_change: resumedResult.score_change,
              agents_used: resumedResult.agents_used,
              processing_time_ms: Date.now() - startTime,
              tokens_used: resumedResult.tokens_used,
              model_used: 'langgraph-recovered',
              escalated: resumedResult.escalated,
              escalation_reason: resumedResult.escalation_reason,
              profile_config: {
                profile_type: profileType,
                response_style: 'professional_friendly',
                template_key: 'general_full',
                delay_minutes: 0,
                delay_first_only: true,
              },
              error: 'Recovered from checkpoint after timeout',
            };
          }
        }
      } catch (recoveryError) {
        console.error('[AI V7] Checkpoint recovery failed:', recoveryError);
      }
    }
    // MEJORA-2.1: FIN

    // MEJORA-2.4: Añadir a Dead Letter Queue para investigación y retry
    if (!isPreview) {
      try {
        const dlqService = getDLQService();
        await dlqService.addMessage({
          tenantId,
          conversationId,
          originalMessage: message,
          originalPayload: {
            channel,
            profileType,
            leadId,
            conversationHistory: conversationHistory.length,
          },
          error: error as Error,
          channel,
          processingStage: 'ai_processing' as ProcessingStage,
        });
      } catch (dlqError) {
        // No fallar si DLQ falla, solo loguear
        console.error('[AI V7] Error adding to DLQ:', dlqError);
      }
    }
    // MEJORA-2.4: FIN

    return {
      success: false,
      response: 'Lo siento, ocurrió un error al procesar tu mensaje. Un asesor te atenderá pronto.',
      intent: 'UNKNOWN',
      signals: [],
      score_change: 0,
      agents_used: [],
      processing_time_ms: processingTime,
      tokens_used: 0,
      model_used: 'langgraph-error',
      escalated: true,
      escalation_reason: errorMessage,
      profile_config: {
        profile_type: profileType,
        response_style: 'professional_friendly',
        template_key: 'general_full',
        delay_minutes: 0,
        delay_first_only: true,
      },
      error: errorMessage,
    };
  }
}

// ======================
// EXPORTS
// ======================

export const AIV7Service = {
  generateResponse: generateAIResponseV7,
  shouldUseV7,
  // MEJORA-2.1: Función para shutdown limpio de checkpoints
  shutdown: shutdownCheckpointService,
};
